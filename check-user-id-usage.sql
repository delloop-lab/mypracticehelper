-- ============================================================================
-- Check user_id Usage Across All Tables
-- ============================================================================
-- This query shows:
-- 1. Which tables have user_id columns
-- 2. How many records have user_id set vs NULL
-- 3. Sample user_id values if they exist
-- ============================================================================

-- Method 1: Check which tables have user_id column
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE column_name = 'user_id'
    AND table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- Method 2: Count records with/without user_id for each table
-- ============================================================================

-- Check clients table
SELECT 
    'clients' as table_name,
    COUNT(*) as total_records,
    COUNT(user_id) as records_with_user_id,
    COUNT(*) - COUNT(user_id) as records_without_user_id,
    COUNT(DISTINCT user_id) as unique_user_ids
FROM clients;

-- Check sessions table
SELECT 
    'sessions' as table_name,
    COUNT(*) as total_records,
    COUNT(user_id) as records_with_user_id,
    COUNT(*) - COUNT(user_id) as records_without_user_id,
    COUNT(DISTINCT user_id) as unique_user_ids
FROM sessions;

-- Check session_notes table
SELECT 
    'session_notes' as table_name,
    COUNT(*) as total_records,
    COUNT(user_id) as records_with_user_id,
    COUNT(*) - COUNT(user_id) as records_without_user_id,
    COUNT(DISTINCT user_id) as unique_user_ids
FROM session_notes;

-- Check recordings table
SELECT 
    'recordings' as table_name,
    COUNT(*) as total_records,
    COUNT(user_id) as records_with_user_id,
    COUNT(*) - COUNT(user_id) as records_without_user_id,
    COUNT(DISTINCT user_id) as unique_user_ids
FROM recordings;

-- Check payments table
SELECT 
    'payments' as table_name,
    COUNT(*) as total_records,
    COUNT(user_id) as records_with_user_id,
    COUNT(*) - COUNT(user_id) as records_without_user_id,
    COUNT(DISTINCT user_id) as unique_user_ids
FROM payments;

-- Check reminders table
SELECT 
    'reminders' as table_name,
    COUNT(*) as total_records,
    COUNT(user_id) as records_with_user_id,
    COUNT(*) - COUNT(user_id) as records_without_user_id,
    COUNT(DISTINCT user_id) as unique_user_ids
FROM reminders;

-- Check settings table
SELECT 
    'settings' as table_name,
    COUNT(*) as total_records,
    COUNT(user_id) as records_with_user_id,
    COUNT(*) - COUNT(user_id) as records_without_user_id,
    COUNT(DISTINCT user_id) as unique_user_ids
FROM settings;

-- Check admin_reminders table
SELECT 
    'admin_reminders' as table_name,
    COUNT(*) as total_records,
    COUNT(user_id) as records_with_user_id,
    COUNT(*) - COUNT(user_id) as records_without_user_id,
    COUNT(DISTINCT user_id) as unique_user_ids
FROM admin_reminders;

-- Check custom_reminder_templates table
SELECT 
    'custom_reminder_templates' as table_name,
    COUNT(*) as total_records,
    COUNT(user_id) as records_with_user_id,
    COUNT(*) - COUNT(user_id) as records_without_user_id,
    COUNT(DISTINCT user_id) as unique_user_ids
FROM custom_reminder_templates;

-- ============================================================================
-- Method 3: Check if users table exists and has any users
-- ============================================================================
SELECT 
    'users' as table_name,
    COUNT(*) as total_users,
    COUNT(DISTINCT id) as unique_user_ids,
    STRING_AGG(DISTINCT email, ', ') as user_emails
FROM users;

-- ============================================================================
-- Method 4: Show sample user_id values from each table (if they exist)
-- ============================================================================

-- Sample from clients
SELECT 'clients' as table_name, user_id, COUNT(*) as count
FROM clients
WHERE user_id IS NOT NULL
GROUP BY user_id
LIMIT 5;

-- Sample from sessions
SELECT 'sessions' as table_name, user_id, COUNT(*) as count
FROM sessions
WHERE user_id IS NOT NULL
GROUP BY user_id
LIMIT 5;

-- Sample from session_notes
SELECT 'session_notes' as table_name, user_id, COUNT(*) as count
FROM session_notes
WHERE user_id IS NOT NULL
GROUP BY user_id
LIMIT 5;

-- Sample from recordings
SELECT 'recordings' as table_name, user_id, COUNT(*) as count
FROM recordings
WHERE user_id IS NOT NULL
GROUP BY user_id
LIMIT 5;

-- Sample from payments
SELECT 'payments' as table_name, user_id, COUNT(*) as count
FROM payments
WHERE user_id IS NOT NULL
GROUP BY user_id
LIMIT 5;

-- Sample from reminders
SELECT 'reminders' as table_name, user_id, COUNT(*) as count
FROM reminders
WHERE user_id IS NOT NULL
GROUP BY user_id
LIMIT 5;

-- Sample from settings
SELECT 'settings' as table_name, id, user_id, 
    CASE WHEN user_id IS NOT NULL THEN 'Has user_id' ELSE 'No user_id (legacy)' END as status
FROM settings
LIMIT 10;

-- Sample from admin_reminders
SELECT 'admin_reminders' as table_name, user_id, COUNT(*) as count
FROM admin_reminders
WHERE user_id IS NOT NULL
GROUP BY user_id
LIMIT 5;

-- Sample from custom_reminder_templates
SELECT 'custom_reminder_templates' as table_name, user_id, COUNT(*) as count
FROM custom_reminder_templates
WHERE user_id IS NOT NULL
GROUP BY user_id
LIMIT 5;

-- ============================================================================
-- Method 5: Check for claire@claireschillaci.com specifically
-- ============================================================================
SELECT 
    'User Check' as check_type,
    id as user_id,
    email,
    first_name,
    last_name,
    created_at
FROM users
WHERE email = 'claire@claireschillaci.com';

-- ============================================================================
-- Method 6: Summary - All tables with user_id usage in one view
-- ============================================================================
SELECT 
    'clients' as table_name,
    COUNT(*) as total,
    COUNT(user_id) as with_user_id,
    ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 2) as percent_with_user_id
FROM clients
UNION ALL
SELECT 'sessions', COUNT(*), COUNT(user_id), ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 2) FROM sessions
UNION ALL
SELECT 'session_notes', COUNT(*), COUNT(user_id), ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 2) FROM session_notes
UNION ALL
SELECT 'recordings', COUNT(*), COUNT(user_id), ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 2) FROM recordings
UNION ALL
SELECT 'payments', COUNT(*), COUNT(user_id), ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 2) FROM payments
UNION ALL
SELECT 'reminders', COUNT(*), COUNT(user_id), ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 2) FROM reminders
UNION ALL
SELECT 'settings', COUNT(*), COUNT(user_id), ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 2) FROM settings
UNION ALL
SELECT 'admin_reminders', COUNT(*), COUNT(user_id), ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 2) FROM admin_reminders
UNION ALL
SELECT 'custom_reminder_templates', COUNT(*), COUNT(user_id), ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 2) FROM custom_reminder_templates
ORDER BY table_name;


