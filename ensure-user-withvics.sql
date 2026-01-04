-- ============================================================================
-- Ensure User Exists: withvics@gmail.com
-- ============================================================================
-- This SQL ensures the user exists and can login
-- Does NOT change password if user already exists
-- ============================================================================

-- Check current user status
SELECT 
    id, 
    email, 
    first_name, 
    last_name, 
    created_at,
    updated_at,
    CASE 
        WHEN password_hash IS NOT NULL AND password_hash != '' THEN 'Password Set ✓ - Can Login'
        ELSE 'No Password ✗ - Cannot Login'
    END as login_status
FROM users 
WHERE email = 'withvics@gmail.com';

-- If user doesn't exist, create them (you'll need to provide password hash)
-- If user exists, this does nothing (preserves existing password)
INSERT INTO users (id, email, password_hash, first_name, last_name, created_at, updated_at)
SELECT 
    gen_random_uuid()::text,
    'withvics@gmail.com',
    'REQUIRED_IF_USER_DOES_NOT_EXIST',  -- Only used if creating new user
    'Vics',
    NULL,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'withvics@gmail.com'
);

-- Verify final status
SELECT 
    id, 
    email, 
    first_name, 
    last_name, 
    created_at,
    updated_at,
    CASE 
        WHEN password_hash IS NOT NULL AND password_hash != '' THEN 'Ready to Login ✓'
        ELSE 'Needs Password ✗'
    END as login_status
FROM users 
WHERE email = 'withvics@gmail.com';




