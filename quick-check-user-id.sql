-- ============================================================================
-- QUICK CHECK: user_id Usage Summary
-- ============================================================================
-- Run this single query to see a summary of user_id usage across all tables
-- ============================================================================

SELECT 
    'clients' as table_name,
    COUNT(*) as total_records,
    COUNT(user_id) as records_with_user_id,
    COUNT(*) - COUNT(user_id) as records_without_user_id,
    ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 1) as percent_with_user_id,
    COUNT(DISTINCT user_id) as unique_user_ids
FROM clients
UNION ALL
SELECT 'sessions', COUNT(*), COUNT(user_id), COUNT(*) - COUNT(user_id), 
    ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 1), COUNT(DISTINCT user_id) FROM sessions
UNION ALL
SELECT 'session_notes', COUNT(*), COUNT(user_id), COUNT(*) - COUNT(user_id), 
    ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 1), COUNT(DISTINCT user_id) FROM session_notes
UNION ALL
SELECT 'recordings', COUNT(*), COUNT(user_id), COUNT(*) - COUNT(user_id), 
    ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 1), COUNT(DISTINCT user_id) FROM recordings
UNION ALL
SELECT 'payments', COUNT(*), COUNT(user_id), COUNT(*) - COUNT(user_id), 
    ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 1), COUNT(DISTINCT user_id) FROM payments
UNION ALL
SELECT 'reminders', COUNT(*), COUNT(user_id), COUNT(*) - COUNT(user_id), 
    ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 1), COUNT(DISTINCT user_id) FROM reminders
UNION ALL
SELECT 'settings', COUNT(*), COUNT(user_id), COUNT(*) - COUNT(user_id), 
    ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 1), COUNT(DISTINCT user_id) FROM settings
UNION ALL
SELECT 'admin_reminders', COUNT(*), COUNT(user_id), COUNT(*) - COUNT(user_id), 
    ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 1), COUNT(DISTINCT user_id) FROM admin_reminders
UNION ALL
SELECT 'custom_reminder_templates', COUNT(*), COUNT(user_id), COUNT(*) - COUNT(user_id), 
    ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 1), COUNT(DISTINCT user_id) FROM custom_reminder_templates
ORDER BY table_name;

-- ============================================================================
-- Check if you have a user account
-- ============================================================================
SELECT 
    id as user_id,
    email,
    first_name,
    last_name,
    created_at
FROM users
WHERE email = 'claire@claireschillaci.com';


