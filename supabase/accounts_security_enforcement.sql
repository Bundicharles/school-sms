-- ==========================================================
-- ACCOUNTS ROLE SECURITY HARDENING
-- ==========================================================
-- This script restricts write access to financial tables 
-- so that ONLY users with the 'accounts' role can edit them.
--
-- Tables: fees, level_fees, transactions, documents
-- ==========================================================

-- 1. Helper Function to check if the user has the 'accounts' role
-- Note: Requires Supabase Auth to be synced with Profiles via user_id
CREATE OR REPLACE FUNCTION public.check_is_accounts()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'accounts'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RE-CONFIGURE 'FEES'
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow Write Fees" ON fees;
CREATE POLICY "Finance View Access" ON fees FOR SELECT USING (true); -- Public read
CREATE POLICY "Accounts Write Access" ON fees FOR ALL 
  USING (check_is_accounts()) 
  WITH CHECK (check_is_accounts());

-- 3. RE-CONFIGURE 'LEVEL_FEES'
ALTER TABLE level_fees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow Write Level Fees" ON level_fees;
CREATE POLICY "Finance View Access" ON level_fees FOR SELECT USING (true); -- Public read
CREATE POLICY "Accounts Write Access" ON level_fees FOR ALL 
  USING (check_is_accounts()) 
  WITH CHECK (check_is_accounts());

-- 4. RE-CONFIGURE 'TRANSACTIONS'
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow Write Transactions" ON transactions;
CREATE POLICY "Finance View Access" ON transactions FOR SELECT USING (true); -- Public read
CREATE POLICY "Accounts Write Access" ON transactions FOR ALL 
  USING (check_is_accounts()) 
  WITH CHECK (check_is_accounts());

-- 5. RE-CONFIGURE 'DOCUMENTS'
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow Write Documents" ON documents;
CREATE POLICY "Finance View Access" ON documents FOR SELECT USING (true); -- Public read
CREATE POLICY "Accounts Write Access" ON documents FOR ALL 
  USING (check_is_accounts()) 
  WITH CHECK (check_is_accounts());

-- ==========================================================
-- IMPORTANT: This enforcement relies on Supabase Auth.
-- If you are using the 'anon' key without a synced JWT,
-- these policies will prevent EVERYONE (including accounts)
-- from editing. Ensure your Clerk-Supabase sync is active.
-- ==========================================================
