-- ============================================================================
-- Fix RLS Policies for Custom Authentication
-- ============================================================================
-- Since we're using custom authentication (not Supabase Auth), we need to
-- either disable RLS or ensure policies allow access via the anon key
-- We're handling security in application code (filtering by user_id),
-- so we can safely allow all access through RLS
-- ============================================================================

-- Option 1: Disable RLS (Recommended for custom auth)
-- This is safe because we're filtering by user_id in application code
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE recordings DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE reminders DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Option 2: Keep RLS enabled but ensure policies allow all (if Option 1 doesn't work)
-- Uncomment below if you prefer to keep RLS enabled

/*
-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations on clients" ON clients;
DROP POLICY IF EXISTS "Allow all operations on sessions" ON sessions;
DROP POLICY IF EXISTS "Allow all operations on session_notes" ON session_notes;
DROP POLICY IF EXISTS "Allow all operations on recordings" ON recordings;
DROP POLICY IF EXISTS "Allow all operations on payments" ON payments;
DROP POLICY IF EXISTS "Allow all operations on reminders" ON reminders;
DROP POLICY IF EXISTS "Allow all operations on settings" ON settings;

-- Recreate policies that definitely allow all (for anon key)
CREATE POLICY "Allow all operations on clients" ON clients 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow all operations on sessions" ON sessions 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow all operations on session_notes" ON session_notes 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow all operations on recordings" ON recordings 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow all operations on payments" ON payments 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow all operations on reminders" ON reminders 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow all operations on settings" ON settings 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);
*/

-- ============================================================================
-- Verification
-- ============================================================================
-- After running, verify RLS is disabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('clients', 'sessions', 'session_notes', 'recordings', 'payments', 'reminders', 'settings', 'users');
-- 
-- rowsecurity should be 'f' (false) for all tables
-- ============================================================================

