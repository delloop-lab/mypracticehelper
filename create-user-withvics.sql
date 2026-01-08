-- ============================================================================
-- Create/Update User: withvics@gmail.com
-- ============================================================================
-- This SQL ensures the user exists and can login
-- Run this in Supabase SQL Editor
-- ============================================================================

-- STEP 1: Check if user exists
SELECT id, email, first_name, last_name, created_at 
FROM users 
WHERE email = 'withvics@gmail.com';

-- STEP 2: Generate password hash first!
-- Run this command in your project directory:
--   node scripts/generate-password-hash.js your-password-here
-- Then copy the hash and replace 'YOUR_PASSWORD_HASH_HERE' below
--
-- Or use online tool: https://bcrypt-generator.com/ (rounds: 10)

INSERT INTO users (id, email, password_hash, first_name, last_name, created_at, updated_at)
VALUES (
    gen_random_uuid()::text,
    'withvics@gmail.com',
    'YOUR_PASSWORD_HASH_HERE',  -- REPLACE THIS with actual bcrypt hash
    'Vics',  -- Optional: Set first name
    NULL,     -- Optional: Set last name  
    NOW(),
    NOW()
)
ON CONFLICT (email) 
DO UPDATE SET
    updated_at = NOW(),
    -- Uncomment the line below if you want to update/reset the password
    -- password_hash = 'YOUR_PASSWORD_HASH_HERE'
RETURNING id, email, first_name, last_name, created_at;

-- STEP 3: Verify the user was created/updated successfully
SELECT 
    id, 
    email, 
    first_name, 
    last_name, 
    created_at,
    updated_at,
    CASE 
        WHEN password_hash IS NOT NULL AND password_hash != '' THEN 'Password Set ✓'
        ELSE 'No Password ✗'
    END as password_status
FROM users 
WHERE email = 'withvics@gmail.com';

-- ============================================================================
-- QUICK SETUP: If you want to use a temporary password "TempPassword123!"
-- ============================================================================
-- Uncomment and run this instead (password: TempPassword123!)
/*
INSERT INTO users (id, email, password_hash, first_name, last_name, created_at, updated_at)
VALUES (
    gen_random_uuid()::text,
    'withvics@gmail.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'Vics',
    NULL,
    NOW(),
    NOW()
)
ON CONFLICT (email) 
DO UPDATE SET
    updated_at = NOW()
RETURNING id, email, first_name, last_name;
*/










