-- First, let's see the session booked by Claire Schillaci on November 30th
-- Run this query first to verify which session will be deleted
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
WHERE LOWER(c.name) = 'claire schillaci'
  AND DATE(s.date AT TIME ZONE 'UTC') = '2025-11-30'
ORDER BY s.date;

-- DELETE the session booked by Claire Schillaci on November 30th, 2025
-- WARNING: This will permanently delete the session!
-- Run the SELECT query above first to verify what will be deleted
DELETE FROM sessions
WHERE client_id IN (
    SELECT id FROM clients WHERE LOWER(name) = 'claire schillaci'
)
AND DATE(date AT TIME ZONE 'UTC') = '2025-11-30';

-- Alternative: If you want to delete by specific session ID (safer):
-- First find the session ID using the SELECT query above, then:
-- DELETE FROM sessions WHERE id = 'YOUR_SESSION_ID_HERE';







