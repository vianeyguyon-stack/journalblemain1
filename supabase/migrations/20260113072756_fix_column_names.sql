/*
  # Fix Column Names to Match Frontend

  ## Changes
  
  ### trades table
  - Rename `open_time` to `entry_time`
  - Rename `close_time` to `exit_time`
  - Rename `open_price` to `entry_price`
  - Rename `close_price` to `exit_price`
  - Rename `trade_type` to `type`
  
  ### journal_entries table
  - Rename `entry_date` to `date`
  
  ## Security
  - No changes to RLS policies needed
*/

-- Fix trades table column names
DO $$
BEGIN
  -- Rename open_time to entry_time
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'open_time'
  ) THEN
    ALTER TABLE trades RENAME COLUMN open_time TO entry_time;
  END IF;
  
  -- Rename close_time to exit_time
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'close_time'
  ) THEN
    ALTER TABLE trades RENAME COLUMN close_time TO exit_time;
  END IF;
  
  -- Rename open_price to entry_price
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'open_price'
  ) THEN
    ALTER TABLE trades RENAME COLUMN open_price TO entry_price;
  END IF;
  
  -- Rename close_price to exit_price
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'close_price'
  ) THEN
    ALTER TABLE trades RENAME COLUMN close_price TO exit_price;
  END IF;
  
  -- Rename trade_type to type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'trade_type'
  ) THEN
    ALTER TABLE trades RENAME COLUMN trade_type TO type;
  END IF;
END $$;

-- Fix journal_entries table column names
DO $$
BEGIN
  -- Rename entry_date to date
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'entry_date'
  ) THEN
    ALTER TABLE journal_entries RENAME COLUMN entry_date TO date;
  END IF;
END $$;

-- Recreate indexes with new column names
DROP INDEX IF EXISTS idx_trades_entry_time;
CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time DESC);
