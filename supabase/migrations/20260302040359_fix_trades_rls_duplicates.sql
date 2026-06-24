/*
  # Fix Trades RLS Policies

  1. Changes
    - Remove ALL existing policies on trades
    - Create clean policies using user_has_journal_access
    
  2. Security
    - Maintains strict multi-tenant access via user_has_journal_access
*/

DROP POLICY IF EXISTS "Users can view trades with journal access" ON trades;
DROP POLICY IF EXISTS "Users can insert trades with journal access" ON trades;
DROP POLICY IF EXISTS "Users can update trades with journal access" ON trades;
DROP POLICY IF EXISTS "Users can delete trades with journal access" ON trades;
DROP POLICY IF EXISTS "Users can view trades via journal access" ON trades;
DROP POLICY IF EXISTS "Users can insert trades via journal access" ON trades;
DROP POLICY IF EXISTS "Users can update trades via journal access" ON trades;
DROP POLICY IF EXISTS "Users can delete trades via journal access" ON trades;

CREATE POLICY "Users can view trades via journal access" 
  ON trades FOR SELECT 
  TO authenticated 
  USING (journal_id IS NOT NULL AND user_has_journal_access(auth.uid(), journal_id));

CREATE POLICY "Users can insert trades via journal access" 
  ON trades FOR INSERT 
  TO authenticated 
  WITH CHECK (journal_id IS NOT NULL AND user_has_journal_access(auth.uid(), journal_id));

CREATE POLICY "Users can update trades via journal access" 
  ON trades FOR UPDATE 
  TO authenticated 
  USING (journal_id IS NOT NULL AND user_has_journal_access(auth.uid(), journal_id))
  WITH CHECK (journal_id IS NOT NULL AND user_has_journal_access(auth.uid(), journal_id));

CREATE POLICY "Users can delete trades via journal access" 
  ON trades FOR DELETE 
  TO authenticated 
  USING (journal_id IS NOT NULL AND user_has_journal_access(auth.uid(), journal_id));