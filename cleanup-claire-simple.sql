-- SIMPLE SQL to Remove Duplicate Claire Schillaci Entries
-- Keeps the most recent one and reassigns all sessions/notes

-- STEP 1: View duplicates first (optional - for verification)
SELECT id, name, email, created_at,
       (SELECT COUNT(*) FROM sessions WHERE client_id = clients.id) as sessions,
       (SELECT COUNT(*) FROM session_notes WHERE client_id = clients.id) as notes
FROM clients
WHERE LOWER(TRIM(name)) = 'claire schillaci'
ORDER BY created_at DESC;

-- STEP 2: Keep the most recent Claire Schillaci and delete others
-- This uses a CTE to find the ID to keep, then reassigns and deletes

WITH keep_claire AS (
    SELECT id
    FROM clients
    WHERE LOWER(TRIM(name)) = 'claire schillaci'
    ORDER BY created_at DESC
    LIMIT 1
)
-- Reassign sessions
UPDATE sessions
SET client_id = (SELECT id FROM keep_claire)
WHERE client_id IN (
    SELECT c.id 
    FROM clients c
    WHERE LOWER(TRIM(c.name)) = 'claire schillaci'
    AND c.id != (SELECT id FROM keep_claire)
);

WITH keep_claire AS (
    SELECT id
    FROM clients
    WHERE LOWER(TRIM(name)) = 'claire schillaci'
    ORDER BY created_at DESC
    LIMIT 1
)
-- Reassign session notes
UPDATE session_notes
SET client_id = (SELECT id FROM keep_claire)
WHERE client_id IN (
    SELECT c.id 
    FROM clients c
    WHERE LOWER(TRIM(c.name)) = 'claire schillaci'
    AND c.id != (SELECT id FROM keep_claire)
);

WITH keep_claire AS (
    SELECT id
    FROM clients
    WHERE LOWER(TRIM(name)) = 'claire schillaci'
    ORDER BY created_at DESC
    LIMIT 1
)
-- Delete duplicates
DELETE FROM clients
WHERE LOWER(TRIM(name)) = 'claire schillaci'
AND id != (SELECT id FROM keep_claire);

-- STEP 3: Verify (should return 1)
SELECT COUNT(*) as remaining_claires
FROM clients
WHERE LOWER(TRIM(name)) = 'claire schillaci';






