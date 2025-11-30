-- First, let's see what sessions exist on November 30th, 2025
-- Run this query first to verify which sessions will be deleted
SELECT 
    id,
    client_id,
    date,
    type,
    duration,
    notes,
    metadata
FROM sessions
WHERE DATE(date AT TIME ZONE 'UTC') = '2025-11-30'
ORDER BY date;

-- If you want to see the client names too:
SELECT 
    s.id,
    s.client_id,
    c.name AS client_name,
    s.date,
    s.type,
    s.duration,
    s.notes,
    s.metadata
FROM sessions s
LEFT JOIN clients c ON s.client_id = c.id
WHERE DATE(s.date AT TIME ZONE 'UTC') = '2025-11-30'
ORDER BY s.date;

-- DELETE all sessions on November 30th, 2025
-- WARNING: This will permanently delete all sessions on this date!
-- Run the SELECT queries above first to verify what will be deleted
DELETE FROM sessions
WHERE DATE(date AT TIME ZONE 'UTC') = '2025-11-30';

-- Alternative: If you want to delete sessions from November 30th of any year:
-- DELETE FROM sessions
-- WHERE EXTRACT(MONTH FROM date AT TIME ZONE 'UTC') = 11
--   AND EXTRACT(DAY FROM date AT TIME ZONE 'UTC') = 30;

-- Alternative: If you want to delete a specific session by ID (safer):
-- First find the session ID using the SELECT query above, then:
-- DELETE FROM sessions WHERE id = 'YOUR_SESSION_ID_HERE';






