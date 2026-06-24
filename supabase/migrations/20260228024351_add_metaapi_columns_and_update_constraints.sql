/*
  # Add MetaAPI Columns and Update Constraints

  1. Table Extensions
    - Add deployment_state, connection_status, error_message, last_status_check_at to mt_accounts (if not exists)
    
  2. Update Existing Table
    - Update metaapi_rate_limits to match new schema
    
  3. Indexes
    - Add indexes for status queries and rate limit lookups
    
  4. Update Constraints
    - Update mt_accounts status constraint
*/

-- Add columns to mt_accounts (columns already exist, safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mt_accounts' AND column_name = 'deployment_state') THEN
    ALTER TABLE mt_accounts ADD COLUMN deployment_state TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mt_accounts' AND column_name = 'connection_status') THEN
    ALTER TABLE mt_accounts ADD COLUMN connection_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mt_accounts' AND column_name = 'error_message') THEN
    ALTER TABLE mt_accounts ADD COLUMN error_message TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mt_accounts' AND column_name = 'last_status_check_at') THEN
    ALTER TABLE mt_accounts ADD COLUMN last_status_check_at TIMESTAMPTZ;
  END IF;
END $$;

-- Update status constraint
ALTER TABLE mt_accounts DROP CONSTRAINT IF EXISTS mt_accounts_status_check;
ALTER TABLE mt_accounts ADD CONSTRAINT mt_accounts_status_check 
CHECK (status IN ('pending_configuration', 'deploying', 'connected', 'disconnected', 'deployment_failed', 'connection_failed', 'expired', 'error'));

-- Update metaapi_rate_limits table to match requirements
DO $$
BEGIN
  -- Remove old columns that are no longer needed
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'metaapi_rate_limits' AND column_name = 'last_request_at') THEN
    ALTER TABLE metaapi_rate_limits DROP COLUMN last_request_at;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'metaapi_rate_limits' AND column_name = 'consecutive_errors') THEN
    ALTER TABLE metaapi_rate_limits DROP COLUMN consecutive_errors;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'metaapi_rate_limits' AND column_name = 'is_throttled') THEN
    ALTER TABLE metaapi_rate_limits DROP COLUMN is_throttled;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'metaapi_rate_limits' AND column_name = 'updated_at') THEN
    ALTER TABLE metaapi_rate_limits DROP COLUMN updated_at;
  END IF;
  
  -- Add created_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'metaapi_rate_limits' AND column_name = 'created_at') THEN
    ALTER TABLE metaapi_rate_limits ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mt_accounts_status ON mt_accounts(status);
CREATE INDEX IF NOT EXISTS idx_mt_accounts_journal_status ON mt_accounts(journal_id, status);
CREATE INDEX IF NOT EXISTS idx_metaapi_rate_limits_account ON metaapi_rate_limits(account_id);
CREATE INDEX IF NOT EXISTS idx_metaapi_rate_limits_throttled_time ON metaapi_rate_limits(throttled_until) WHERE throttled_until IS NOT NULL;