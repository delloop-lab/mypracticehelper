-- ============================================================================
-- Create/Update User: withvics@gmail.com (READY TO RUN)
-- ============================================================================
-- This SQL creates/updates the user with a temporary password
-- Password: TempPassword123!
-- User should change this password after first login
-- ============================================================================

-- Create or update the user (preserves existing password if user exists)
INSERT INTO users (id, email, password_hash, first_name, last_name, created_at, updated_at)
VALUES (
    gen_random_uuid()::text,
    'withvics@gmail.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',  -- Only used if user doesn't exist
    'Vics',
    NULL,
    NOW(),
    NOW()
)
ON CONFLICT (email) 
DO UPDATE SET
    updated_at = NOW()
    -- Password hash is NOT updated - preserves existing password
RETURNING id, email, first_name, last_name, created_at;

-- Verify the user was created/updated
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
-- NOTE: This preserves the existing password if user already exists
-- If user doesn't exist, creates with temporary password: TempPassword123!
-- ============================================================================










