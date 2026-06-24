/*
  # Remove Insecure View

  ## Overview
  Removes the `user_mt_accounts` view that was created with SECURITY DEFINER,
  which poses a security risk by applying the creator's permissions instead
  of the user's permissions.

  ## Changes
  1. Drop the `user_mt_accounts` view
  
  ## Security
  - Improves security by removing a view with SECURITY DEFINER
  - The underlying `mt_accounts` table already has proper RLS policies
  - Direct queries to `mt_accounts` table should be used instead

  ## Notes
  - This view references columns that don't exist in the current schema
  - The view is not used in the application codebase
  - Direct access to `mt_accounts` table is more secure and up-to-date
*/

-- Drop the insecure view
DROP VIEW IF EXISTS public.user_mt_accounts CASCADE;
