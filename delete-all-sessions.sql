-- Delete All Sessions
-- WARNING: This will permanently delete ALL sessions from the database!
-- This action cannot be undone.

-- IMPORTANT NOTES:
-- 1. This will also delete related session_notes (due to CASCADE)
-- 2. Payments linked to sessions will have their session_id set to NULL (due to ON DELETE SET NULL)
-- 3. If you have multi-user setup, this deletes sessions for ALL users
-- 4. Make sure you have a backup before running this!

-- STEP 1: Verify how many sessions will be deleted
-- Run this first to see what will be deleted:
SELECT COUNT(*) as total_sessions FROM sessions;

-- If you want to see sessions by user (for multi-user setup):
-- SELECT user_id, COUNT(*) as session_count 
-- FROM sessions 
-- GROUP BY user_id;

-- STEP 2: Delete all sessions
-- Uncomment the line below to actually delete all sessions:
-- DELETE FROM sessions;

-- STEP 3: Verify deletion (run after deleting)
-- SELECT COUNT(*) as remaining_sessions FROM sessions;
-- Should return 0

-- ALTERNATIVE: Delete sessions for a specific user only (if multi-user)
-- Replace 'YOUR_USER_ID_HERE' with the actual user ID:
-- DELETE FROM sessions WHERE user_id = 'YOUR_USER_ID_HERE';

-- ALTERNATIVE: Delete sessions without user_id (legacy sessions)
-- DELETE FROM sessions WHERE user_id IS NULL;





