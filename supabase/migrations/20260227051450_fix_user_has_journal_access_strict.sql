/*
  # Fix user_has_journal_access - Strict Mode

  ## Description
  Correction de la fonction user_has_journal_access pour supprimer TOUT bypass NULL.
  La fonction doit retourner TRUE uniquement si :
  - L'utilisateur possède une activation active (access_code_activations)
  - Le journal_id correspond exactement

  Aucun bypass autorisé.
  Aucune logique "return true if NULL".

  ## Sécurité
  - Validation stricte via access_code_activations
  - Vérification status = 'active'
  - Pas de fallback sur journals.user_id
*/

-- =====================================================
-- Fix user_has_journal_access - STRICT MODE
-- =====================================================

DROP FUNCTION IF EXISTS user_has_journal_access(uuid, uuid) CASCADE;

CREATE OR REPLACE FUNCTION user_has_journal_access(
  check_user_id uuid,
  check_journal_id uuid
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM access_code_activations aca
    JOIN access_codes ac ON ac.id = aca.access_code_id
    WHERE aca.activated_by_user_id = check_user_id
    AND ac.journal_id = check_journal_id
    AND aca.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Recreate RLS policies after function drop CASCADE
-- =====================================================

-- mt_accounts policies
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

-- trades policies
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

-- journal_entries policies
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
