-- ============================================================================
-- Confirm Email for: withvics@gmail.com
-- ============================================================================
-- This SQL adds email_confirmed field if needed and marks email as confirmed
-- ============================================================================

-- STEP 1: Add email_confirmed column if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN DEFAULT FALSE;

-- STEP 2: Mark email as confirmed for withvics@gmail.com
UPDATE users 
SET 
    email_confirmed = TRUE,
    updated_at = NOW()
WHERE email = 'withvics@gmail.com';

-- STEP 3: Verify the email is confirmed
SELECT 
    id, 
    email, 
    first_name, 
    last_name,
    email_confirmed,
    CASE 
        WHEN email_confirmed = TRUE THEN 'Email Confirmed ✓'
        ELSE 'Email Not Confirmed ✗'
    END as confirmation_status
FROM users 
WHERE email = 'withvics@gmail.com';









