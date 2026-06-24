/*
  # RESET COMPLET METAAPI - Architecture V2
  
  ## Changements Majeurs
  
  1. **Suppression complète de l'ancien système**
    - Drop de toutes les anciennes tables MetaAPI
    - Nettoyage complet pour repartir de zéro
  
  2. **Nouvelles Tables**
    - `journals` - Journaux de trading (déjà existe, on garde)
    - `journal_members` - Système multi-tenant strict
    - `mt_accounts` - Comptes MT avec région london uniquement
    - `trades` - Historique des trades synchronisés
    - `sync_queue` - Queue persistée pour synchronisation asynchrone
    - `metaapi_rate_limits` - Gestion intelligente du rate limiting
  
  3. **Fonction Multi-tenant**
    - `user_has_journal_access()` - Vérification stricte des accès
  
  4. **Sécurité**
    - RLS activé sur toutes les tables
    - Politique stricte d'accès par journal
    - Protection contre les accès non autorisés
  
  5. **Architecture pour Scheduled Functions**
    - sync_queue conçu pour worker cron
    - Gestion robuste des erreurs 202 et 429
    - System de retry intelligent
*/

-- ===== NETTOYAGE COMPLET =====

-- Drop anciennes tables si elles existent
DROP TABLE IF EXISTS metaapi_rate_limits CASCADE;
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS mt_accounts CASCADE;
DROP TABLE IF EXISTS journal_members CASCADE;
DROP TABLE IF EXISTS sync_queue CASCADE;

-- Drop anciennes fonctions
DROP FUNCTION IF EXISTS user_has_journal_access(UUID, UUID) CASCADE;

-- ===== CRÉATION TABLE JOURNAL_MEMBERS (Multi-tenant) =====

CREATE TABLE journal_members (
  journal_id UUID REFERENCES journals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (journal_id, user_id)
);

CREATE INDEX idx_journal_members_user ON journal_members(user_id);
CREATE INDEX idx_journal_members_journal ON journal_members(journal_id);

-- RLS pour journal_members
ALTER TABLE journal_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their journal memberships"
  ON journal_members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Journal owners can manage members"
  ON journal_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_members jm
      WHERE jm.journal_id = journal_members.journal_id
        AND jm.user_id = auth.uid()
        AND jm.role = 'owner'
    )
  );

-- ===== CRÉATION TABLE MT_ACCOUNTS (V2) =====

CREATE TABLE mt_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  metaapi_account_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  broker TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('MT4', 'MT5')),
  region TEXT NOT NULL DEFAULT 'london',
  account_type TEXT NOT NULL CHECK (account_type IN ('demo', 'live')),
  status TEXT NOT NULL DEFAULT 'pending_configuration' CHECK (status IN (
    'pending_configuration',
    'deploying',
    'deployed',
    'undeploying',
    'undeployed',
    'connected',
    'disconnected',
    'error'
  )),
  deployment_state TEXT,
  connection_status TEXT,
  config_link TEXT,
  config_expires_at TIMESTAMPTZ,
  balance NUMERIC DEFAULT 0,
  equity NUMERIC DEFAULT 0,
  last_sync_at TIMESTAMPTZ,
  consecutive_errors INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_accounts_journal ON mt_accounts(journal_id);
CREATE INDEX idx_mt_accounts_status ON mt_accounts(status);
CREATE INDEX idx_mt_accounts_metaapi_id ON mt_accounts(metaapi_account_id);

-- RLS pour mt_accounts
ALTER TABLE mt_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accounts in their journals"
  ON mt_accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_members
      WHERE journal_members.journal_id = mt_accounts.journal_id
        AND journal_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage accounts in their journals"
  ON mt_accounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_members
      WHERE journal_members.journal_id = mt_accounts.journal_id
        AND journal_members.user_id = auth.uid()
        AND journal_members.role IN ('owner', 'member')
    )
  );

-- ===== CRÉATION TABLE TRADES (V2) =====

CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mt_account_id UUID NOT NULL REFERENCES mt_accounts(id) ON DELETE CASCADE,
  journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  metaapi_deal_id TEXT UNIQUE NOT NULL,
  position_id TEXT,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,
  volume DECIMAL NOT NULL,
  price DECIMAL NOT NULL,
  profit DECIMAL DEFAULT 0,
  commission DECIMAL DEFAULT 0,
  swap DECIMAL DEFAULT 0,
  open_time TIMESTAMPTZ NOT NULL,
  close_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trades_account ON trades(mt_account_id);
CREATE INDEX idx_trades_journal ON trades(journal_id);
CREATE INDEX idx_trades_open_time ON trades(open_time DESC);
CREATE INDEX idx_trades_metaapi_deal ON trades(metaapi_deal_id);

-- RLS pour trades
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view trades in their journals"
  ON trades FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_members
      WHERE journal_members.journal_id = trades.journal_id
        AND journal_members.user_id = auth.uid()
    )
  );

-- ===== CRÉATION TABLE SYNC_QUEUE (Persistante) =====

CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mt_account_id UUID NOT NULL REFERENCES mt_accounts(id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (operation IN ('sync_trades', 'check_status', 'deploy', 'undeploy')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_queue_ready ON sync_queue(status, next_retry_at, locked);
CREATE INDEX idx_sync_queue_account ON sync_queue(mt_account_id);

-- RLS pour sync_queue (géré par service role uniquement)
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Pas de policy pour authenticated users, seulement service role

-- ===== CRÉATION TABLE METAAPI_RATE_LIMITS (Persistante) =====

CREATE TABLE metaapi_rate_limits (
  mt_account_id UUID PRIMARY KEY REFERENCES mt_accounts(id) ON DELETE CASCADE,
  throttled_until TIMESTAMPTZ,
  consecutive_429 INTEGER DEFAULT 0,
  last_429_at TIMESTAMPTZ,
  last_202_at TIMESTAMPTZ,
  consecutive_202 INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS pour metaapi_rate_limits (géré par service role uniquement)
ALTER TABLE metaapi_rate_limits ENABLE ROW LEVEL SECURITY;

-- ===== FONCTION MULTI-TENANT =====

CREATE OR REPLACE FUNCTION user_has_journal_access(p_user_id UUID, p_journal_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM journal_members
    WHERE journal_id = p_journal_id 
      AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ===== TRIGGERS UPDATED_AT =====

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mt_accounts_updated_at
  BEFORE UPDATE ON mt_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sync_queue_updated_at
  BEFORE UPDATE ON sync_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER metaapi_rate_limits_updated_at
  BEFORE UPDATE ON metaapi_rate_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
