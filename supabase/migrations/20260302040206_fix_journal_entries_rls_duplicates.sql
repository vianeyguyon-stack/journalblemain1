/*
  # Fix Journal Entries RLS Policies

  1. Changes
    - Remove ALL existing policies on journal_entries
    - Create clean policies using user_has_journal_access
    
  2. Security
    - Maintains strict multi-tenant access via user_has_journal_access
*/

DROP POLICY IF EXISTS "Users can view journal entries with journal access" ON journal_entries;
DROP POLICY IF EXISTS "Users can insert journal entries with journal access" ON journal_entries;
DROP POLICY IF EXISTS "Users can update journal entries with journal access" ON journal_entries;
DROP POLICY IF EXISTS "Users can delete journal entries with journal access" ON journal_entries;
DROP POLICY IF EXISTS "Users can view journal_entries via journal access" ON journal_entries;
DROP POLICY IF EXISTS "Users can insert journal_entries via journal access" ON journal_entries;
DROP POLICY IF EXISTS "Users can update journal_entries via journal access" ON journal_entries;
DROP POLICY IF EXISTS "Users can delete journal_entries via journal access" ON journal_entries;

CREATE POLICY "Users can view journal_entries via journal access" 
  ON journal_entries FOR SELECT 
  TO authenticated 
  USING (journal_id IS NOT NULL AND user_has_journal_access(auth.uid(), journal_id));

CREATE POLICY "Users can insert journal_entries via journal access" 
  ON journal_entries FOR INSERT 
  TO authenticated 
  WITH CHECK (journal_id IS NOT NULL AND user_has_journal_access(auth.uid(), journal_id));

CREATE POLICY "Users can update journal_entries via journal access" 
  ON journal_entries FOR UPDATE 
  TO authenticated 
  USING (journal_id IS NOT NULL AND user_has_journal_access(auth.uid(), journal_id))
  WITH CHECK (journal_id IS NOT NULL AND user_has_journal_access(auth.uid(), journal_id));

CREATE POLICY "Users can delete journal_entries via journal access" 
  ON journal_entries FOR DELETE 
  TO authenticated 
  USING (journal_id IS NOT NULL AND user_has_journal_access(auth.uid(), journal_id));