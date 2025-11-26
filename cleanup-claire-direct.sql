-- DIRECT SQL to Remove Duplicate Claire Schillaci Entries
-- Works with PostgreSQL/Supabase
-- Keeps the most recent Claire Schillaci

-- STEP 1: First, see what duplicates exist
SELECT id, name, email, created_at,
       (SELECT COUNT(*) FROM sessions WHERE client_id = clients.id) as session_count,
       (SELECT COUNT(*) FROM session_notes WHERE client_id = clients.id) as note_count
FROM clients
WHERE LOWER(TRIM(name)) = 'claire schillaci'
ORDER BY created_at DESC;

-- STEP 2: Reassign sessions to the most recent Claire Schillaci
UPDATE sessions
SET client_id = (
    SELECT id 
    FROM clients
    WHERE LOWER(TRIM(name)) = 'claire schillaci'
    ORDER BY created_at DESC
    LIMIT 1
)
WHERE client_id IN (
    SELECT id 
    FROM clients
    WHERE LOWER(TRIM(name)) = 'claire schillaci'
    AND id != (
        SELECT id 
        FROM clients
        WHERE LOWER(TRIM(name)) = 'claire schillaci'
        ORDER BY created_at DESC
        LIMIT 1
    )
);

-- STEP 3: Reassign session notes to the most recent Claire Schillaci
UPDATE session_notes
SET client_id = (
    SELECT id 
    FROM clients
    WHERE LOWER(TRIM(name)) = 'claire schillaci'
    ORDER BY created_at DESC
    LIMIT 1
)
WHERE client_id IN (
    SELECT id 
    FROM clients
    WHERE LOWER(TRIM(name)) = 'claire schillaci'
    AND id != (
        SELECT id 
        FROM clients
        WHERE LOWER(TRIM(name)) = 'claire schillaci'
        ORDER BY created_at DESC
        LIMIT 1
    )
);

-- STEP 4: Delete duplicate Claire Schillaci entries
DELETE FROM clients
WHERE LOWER(TRIM(name)) = 'claire schillaci'
AND id != (
    SELECT id 
    FROM clients
    WHERE LOWER(TRIM(name)) = 'claire schillaci'
    ORDER BY created_at DESC
    LIMIT 1
);

-- STEP 5: Verify (should return 1)
SELECT COUNT(*) as remaining_claires
FROM clients
WHERE LOWER(TRIM(name)) = 'claire schillaci';

-- ============================================
-- ALTERNATIVE: If you know the ID to keep
-- ============================================
-- Replace '1764154407453' with the actual ID you want to keep

/*
UPDATE sessions
SET client_id = '1764154407453'
WHERE client_id IN (
    SELECT id FROM clients
    WHERE LOWER(TRIM(name)) = 'claire schillaci'
    AND id != '1764154407453'
);

UPDATE session_notes
SET client_id = '1764154407453'
WHERE client_id IN (
    SELECT id FROM clients
    WHERE LOWER(TRIM(name)) = 'claire schillaci'
    AND id != '1764154407453'
);

DELETE FROM clients
WHERE LOWER(TRIM(name)) = 'claire schillaci'
AND id != '1764154407453';
*/



