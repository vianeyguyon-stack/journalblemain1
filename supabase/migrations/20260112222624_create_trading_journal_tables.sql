/*
  # Trading Journal Database Schema

  ## Overview
  Complete database schema for MT4/MT5 Trading Journal application with MetaAPI integration.

  ## Tables Created
  
  ### 1. mt_accounts
  Stores MetaTrader accounts connected via MetaAPI
  - `id`: Unique identifier (UUID)
  - `user_id`: Foreign key to auth.users
  - `metaapi_account_id`: Unique MetaAPI account identifier
  - `broker`: Broker/server name
  - `platform`: MT4 or MT5
  - `name`: Account display name
  - `status`: Configuration status (pending_configuration, connected, disconnected)
  - `configuration_link`: MetaAPI configuration URL
  - `expires_at`: Configuration link expiration timestamp
  - `connection_status`: Real-time connection status
  - `created_at`, `updated_at`: Timestamps

  ### 2. trades
  Stores complete trading history (imported and manual)
  - `id`: Unique identifier (UUID)
  - `user_id`: Foreign key to auth.users
  - `account_id`: Foreign key to mt_accounts (nullable)
  - `symbol`: Trading pair (e.g., EURUSD)
  - `type`: Trade type (BUY, SELL, BALANCE)
  - `entry_time`: Position open time
  - `exit_time`: Position close time
  - `entry_price`: Entry price
  - `exit_price`: Exit price
  - `volume`: Lot size
  - `profit`: Net profit/loss
  - `commission`: Broker commission
  - `swap`: Swap/rollover fees
  - `notes`: User notes
  - `metaapi_deal_id`: Unique MetaAPI deal identifier (for deduplication)
  - `metaapi_position_id`: MetaAPI position identifier
  - `pips`: Pip movement
  - `created_at`, `updated_at`: Timestamps

  ### 3. journal_entries
  Stores manual trading journal entries
  - `id`: Unique identifier (UUID)
  - `user_id`: Foreign key to auth.users
  - `trade_id`: Foreign key to trades (nullable)
  - `date`: Journal entry date
  - `title`: Entry title
  - `content`: Entry content (markdown supported)
  - `emotional_state`: Trader's emotional state (excellent, good, neutral, bad, terrible)
  - `discipline_score`: Self-assessment score (1-10)
  - `session_pnl`: Session profit/loss
  - `trades_count`: Number of trades in session
  - `tags`: Array of tags for categorization
  - `created_at`, `updated_at`: Timestamps

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Users can only access their own data
  - Policies for SELECT, INSERT, UPDATE, DELETE operations
  - Foreign key constraints with CASCADE DELETE for data integrity

  ## Indexes
  - Optimized indexes on user_id, dates, and MetaAPI identifiers
  - Supports fast queries and efficient data retrieval

  ## Triggers
  - Automatic timestamp updates on record modification
*/

-- =====================================================
-- TABLE: mt_accounts
-- =====================================================

CREATE TABLE IF NOT EXISTS mt_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  metaapi_account_id TEXT UNIQUE NOT NULL,
  broker TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('MT4', 'MT5')),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'pending_configuration' NOT NULL,
  configuration_link TEXT,
  expires_at TIMESTAMPTZ,
  connection_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for mt_accounts
CREATE INDEX IF NOT EXISTS idx_mt_accounts_user_id ON mt_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_mt_accounts_metaapi_id ON mt_accounts(metaapi_account_id);
CREATE INDEX IF NOT EXISTS idx_mt_accounts_status ON mt_accounts(status);

-- RLS Policies for mt_accounts
ALTER TABLE mt_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own MT accounts" ON mt_accounts;
CREATE POLICY "Users can view own MT accounts"
  ON mt_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own MT accounts" ON mt_accounts;
CREATE POLICY "Users can insert own MT accounts"
  ON mt_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own MT accounts" ON mt_accounts;
CREATE POLICY "Users can update own MT accounts"
  ON mt_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own MT accounts" ON mt_accounts;
CREATE POLICY "Users can delete own MT accounts"
  ON mt_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: trades
-- =====================================================

CREATE TABLE IF NOT EXISTS trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES mt_accounts(id) ON DELETE SET NULL,
  symbol TEXT,
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL', 'BALANCE')),
  entry_time TIMESTAMPTZ NOT NULL,
  exit_time TIMESTAMPTZ,
  entry_price DECIMAL(15,5) NOT NULL DEFAULT 0,
  exit_price DECIMAL(15,5),
  volume DECIMAL(15,2) NOT NULL DEFAULT 0,
  profit DECIMAL(15,2) DEFAULT 0,
  commission DECIMAL(15,2) DEFAULT 0,
  swap DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  metaapi_deal_id TEXT UNIQUE,
  metaapi_position_id TEXT,
  pips NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for trades
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_account_id ON trades(account_id);
CREATE INDEX IF NOT EXISTS idx_trades_metaapi_deal_id ON trades(metaapi_deal_id);
CREATE INDEX IF NOT EXISTS idx_trades_metaapi_position_id ON trades(metaapi_position_id);

-- RLS Policies for trades
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own trades" ON trades;
CREATE POLICY "Users can view own trades"
  ON trades FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own trades" ON trades;
CREATE POLICY "Users can insert own trades"
  ON trades FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own trades" ON trades;
CREATE POLICY "Users can update own trades"
  ON trades FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own trades" ON trades;
CREATE POLICY "Users can delete own trades"
  ON trades FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: journal_entries
-- =====================================================

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  emotional_state TEXT CHECK (emotional_state IN ('excellent', 'good', 'neutral', 'bad', 'terrible')),
  discipline_score INTEGER CHECK (discipline_score >= 1 AND discipline_score <= 10),
  session_pnl DECIMAL(15,2) DEFAULT 0,
  trades_count INTEGER DEFAULT 0,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for journal_entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_trade_id ON journal_entries(trade_id);

-- RLS Policies for journal_entries
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own journal entries" ON journal_entries;
CREATE POLICY "Users can view own journal entries"
  ON journal_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own journal entries" ON journal_entries;
CREATE POLICY "Users can insert own journal entries"
  ON journal_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own journal entries" ON journal_entries;
CREATE POLICY "Users can update own journal entries"
  ON journal_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own journal entries" ON journal_entries;
CREATE POLICY "Users can delete own journal entries"
  ON journal_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS: Auto-update timestamps
-- =====================================================

-- Function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for mt_accounts
DROP TRIGGER IF EXISTS trigger_update_mt_accounts_updated_at ON mt_accounts;
CREATE TRIGGER trigger_update_mt_accounts_updated_at
  BEFORE UPDATE ON mt_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for trades
DROP TRIGGER IF EXISTS trigger_update_trades_updated_at ON trades;
CREATE TRIGGER trigger_update_trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for journal_entries
DROP TRIGGER IF EXISTS trigger_update_journal_entries_updated_at ON journal_entries;
CREATE TRIGGER trigger_update_journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();