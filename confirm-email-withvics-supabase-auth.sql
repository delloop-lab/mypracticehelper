-- ============================================================================
-- Confirm Email for: withvics@gmail.com (Supabase Auth)
-- ============================================================================
-- This SQL confirms the email in Supabase Auth system
-- ============================================================================

-- STEP 1: Find the user UUID
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at
FROM auth.users
WHERE email = 'withvics@gmail.com';

-- STEP 2: Confirm the email (replace 'user-uuid-here' with actual UUID from STEP 1)
-- Uncomment and update the UUID after running STEP 1:
/*
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'withvics@gmail.com';
*/

-- OR use this version that works directly:
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'withvics@gmail.com'
RETURNING id, email, email_confirmed_at;

-- STEP 3: Verify the email is confirmed
SELECT 
    id,
    email,
    email_confirmed_at,
    CASE 
        WHEN email_confirmed_at IS NOT NULL THEN 'Email Confirmed ✓'
        ELSE 'Email Not Confirmed ✗'
    END as confirmation_status
FROM auth.users
WHERE email = 'withvics@gmail.com';





