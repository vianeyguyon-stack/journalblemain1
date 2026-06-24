/*
  # Drop metaapi_request_logs and Fix RLS Policies

  ## Description
  Alignement strict sur le modèle Journal 2:
  1. Suppression de la table metaapi_request_logs
  2. Correction de la table metaapi_rate_limits (suppression de active_requests)
  3. Refactorisation complète des RLS policies pour utiliser UNIQUEMENT user_has_journal_access

  ## Tables modifiées
  - metaapi_request_logs: SUPPRIMÉE
  - metaapi_rate_limits: Suppression de la colonne active_requests
  - mt_accounts: Ajout de journal_id, refactorisation RLS
  - trades: Ajout de journal_id, refactorisation RLS
  - journal_entries: Ajout de journal_id, refactorisation RLS

  ## Sécurité
  - Fonction user_has_journal_access pour vérifier l'accès journal
  - Toutes les policies utilisent STRICTEMENT user_has_journal_access
  - Suppression de toute logique auth.uid() = user_id
  - Suppression de toute logique OR ou USING(true)
*/

-- =====================================================
-- 1. DROP metaapi_request_logs
-- =====================================================

DROP TABLE IF EXISTS metaapi_request_logs CASCADE;

-- =====================================================
-- 2. FIX metaapi_rate_limits (remove active_requests)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'metaapi_rate_limits' AND column_name = 'active_requests'
  ) THEN
    ALTER TABLE metaapi_rate_limits DROP COLUMN active_requests;
  END IF;
END $$;

-- Ensure metaapi_rate_limits has correct structure
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'metaapi_rate_limits'
  ) THEN
    CREATE TABLE metaapi_rate_limits (
      account_id uuid PRIMARY KEY REFERENCES mt_accounts(id) ON DELETE CASCADE,
      last_request_at timestamptz NOT NULL DEFAULT now(),
      consecutive_errors integer NOT NULL DEFAULT 0,
      total_429_errors integer NOT NULL DEFAULT 0,
      is_throttled boolean NOT NULL DEFAULT false,
      throttle_until timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    
    ALTER TABLE metaapi_rate_limits ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Service role can manage all rate limits"
      ON metaapi_rate_limits FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- =====================================================
-- 3. ADD journal_id to tables if not exists
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mt_accounts' AND column_name = 'journal_id'
  ) THEN
    ALTER TABLE mt_accounts ADD COLUMN journal_id uuid REFERENCES journals(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_mt_accounts_journal_id ON mt_accounts(journal_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'journal_id'
  ) THEN
    ALTER TABLE trades ADD COLUMN journal_id uuid REFERENCES journals(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_trades_journal_id ON trades(journal_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'journal_id'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN journal_id uuid REFERENCES journals(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_journal_entries_journal_id ON journal_entries(journal_id);
  END IF;
END $$;

-- =====================================================
-- 4. REFACTOR RLS POLICIES - mt_accounts
-- =====================================================

DROP POLICY IF EXISTS "Users can view own MT accounts" ON mt_accounts;
DROP POLICY IF EXISTS "Users can insert own MT accounts" ON mt_accounts;
DROP POLICY IF EXISTS "Users can update own MT accounts" ON mt_accounts;
DROP POLICY IF EXISTS "Users can delete own MT accounts" ON mt_accounts;
DROP POLICY IF EXISTS "Users can view MT accounts with journal access" ON mt_accounts;
DROP POLICY IF EXISTS "Users can insert MT accounts with journal access" ON mt_accounts;
DROP POLICY IF EXISTS "Users can update MT accounts with journal access" ON mt_accounts;
DROP POLICY IF EXISTS "Users can delete MT accounts with journal access" ON mt_accounts;

CREATE POLICY "Users can view MT accounts with journal access"
  ON mt_accounts FOR SELECT
  TO authenticated
  USING (user_has_journal_access(auth.uid(), journal_id));

CREATE POLICY "Users can insert MT accounts with journal access"
  ON mt_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_has_journal_access(auth.uid(), journal_id));

CREATE POLICY "Users can update MT accounts with journal access"
  ON mt_accounts FOR UPDATE
  TO authenticated
  USING (user_has_journal_access(auth.uid(), journal_id))
  WITH CHECK (user_has_journal_access(auth.uid(), journal_id));

CREATE POLICY "Users can delete MT accounts with journal access"
  ON mt_accounts FOR DELETE
  TO authenticated
  USING (user_has_journal_access(auth.uid(), journal_id));

-- =====================================================
-- 5. REFACTOR RLS POLICIES - trades
-- =====================================================

DROP POLICY IF EXISTS "Users can view own trades" ON trades;
DROP POLICY IF EXISTS "Users can insert own trades" ON trades;
DROP POLICY IF EXISTS "Users can update own trades" ON trades;
DROP POLICY IF EXISTS "Users can delete own trades" ON trades;
DROP POLICY IF EXISTS "Users can view trades in accessible journals" ON trades;
DROP POLICY IF EXISTS "Users can insert trades in accessible journals" ON trades;
DROP POLICY IF EXISTS "Users can update trades in accessible journals" ON trades;
DROP POLICY IF EXISTS "Users can delete trades in accessible journals" ON trades;
DROP POLICY IF EXISTS "Users can view trades with journal access" ON trades;
DROP POLICY IF EXISTS "Users can insert trades with journal access" ON trades;
DROP POLICY IF EXISTS "Users can update trades with journal access" ON trades;
DROP POLICY IF EXISTS "Users can delete trades with journal access" ON trades;

CREATE POLICY "Users can view trades with journal access"
  ON trades FOR SELECT
  TO authenticated
  USING (user_has_journal_access(auth.uid(), journal_id));

CREATE POLICY "Users can insert trades with journal access"
  ON trades FOR INSERT
  TO authenticated
  WITH CHECK (user_has_journal_access(auth.uid(), journal_id));

CREATE POLICY "Users can update trades with journal access"
  ON trades FOR UPDATE
  TO authenticated
  USING (user_has_journal_access(auth.uid(), journal_id))
  WITH CHECK (user_has_journal_access(auth.uid(), journal_id));

CREATE POLICY "Users can delete trades with journal access"
  ON trades FOR DELETE
  TO authenticated
  USING (user_has_journal_access(auth.uid(), journal_id));

-- =====================================================
-- 6. REFACTOR RLS POLICIES - journal_entries
-- =====================================================

DROP POLICY IF EXISTS "Users can view own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can insert own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can update own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can delete own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can view journal entries in accessible journals" ON journal_entries;
DROP POLICY IF EXISTS "Users can insert journal entries in accessible journals" ON journal_entries;
DROP POLICY IF EXISTS "Users can update journal entries in accessible journals" ON journal_entries;
DROP POLICY IF EXISTS "Users can delete journal entries in accessible journals" ON journal_entries;
DROP POLICY IF EXISTS "Users can view journal entries with journal access" ON journal_entries;
DROP POLICY IF EXISTS "Users can insert journal entries with journal access" ON journal_entries;
DROP POLICY IF EXISTS "Users can update journal entries with journal access" ON journal_entries;
DROP POLICY IF EXISTS "Users can delete journal entries with journal access" ON journal_entries;

CREATE POLICY "Users can view journal entries with journal access"
  ON journal_entries FOR SELECT
  TO authenticated
  USING (user_has_journal_access(auth.uid(), journal_id));

CREATE POLICY "Users can insert journal entries with journal access"
  ON journal_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_has_journal_access(auth.uid(), journal_id));

CREATE POLICY "Users can update journal entries with journal access"
  ON journal_entries FOR UPDATE
  TO authenticated
  USING (user_has_journal_access(auth.uid(), journal_id))
  WITH CHECK (user_has_journal_access(auth.uid(), journal_id));

CREATE POLICY "Users can delete journal entries with journal access"
  ON journal_entries FOR DELETE
  TO authenticated
  USING (user_has_journal_access(auth.uid(), journal_id));
