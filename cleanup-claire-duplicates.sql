-- SQL Script to Remove Duplicate Claire Schillaci Entries
-- This script keeps ONE Claire Schillaci and reassigns all related data to it

-- STEP 1: Identify all Claire Schillaci entries
-- View all duplicates first (for verification)
SELECT id, name, email, phone, created_at, updated_at, 
       (SELECT COUNT(*) FROM sessions WHERE client_id = clients.id) as session_count,
       (SELECT COUNT(*) FROM session_notes WHERE client_id = clients.id) as note_count
FROM clients
WHERE LOWER(TRIM(name)) = 'claire schillaci'
ORDER BY created_at DESC;

-- STEP 2: Choose which Claire Schillaci to KEEP
-- Option A: Keep the most recent one (by created_at)
-- Option B: Keep the one with the most sessions/notes
-- Option C: Keep a specific ID

-- For this script, we'll keep the one with the MOST related data (sessions + notes)
-- If tied, keep the most recent

-- First, let's find the ID to keep:
WITH claire_entries AS (
    SELECT 
        id,
        name,
        (SELECT COUNT(*) FROM sessions WHERE client_id = clients.id) as session_count,
        (SELECT COUNT(*) FROM session_notes WHERE client_id = clients.id) as note_count,
        created_at
    FROM clients
    WHERE LOWER(TRIM(name)) = 'claire schillaci'
),
ranked_claires AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            ORDER BY (session_count + note_count) DESC, created_at DESC
        ) as rn
    FROM claire_entries
)
SELECT id INTO TEMP keep_id FROM ranked_claires WHERE rn = 1;

-- STEP 3: Reassign all sessions from duplicate Claires to the kept one
UPDATE sessions
SET client_id = (SELECT id FROM keep_id)
WHERE client_id IN (
    SELECT c.id 
    FROM clients c
    WHERE LOWER(TRIM(c.name)) = 'claire schillaci'
    AND c.id != (SELECT id FROM keep_id)
);

-- STEP 4: Reassign all session notes from duplicate Claires to the kept one
UPDATE session_notes
SET client_id = (SELECT id FROM keep_id)
WHERE client_id IN (
    SELECT c.id 
    FROM clients c
    WHERE LOWER(TRIM(c.name)) = 'claire schillaci'
    AND c.id != (SELECT id FROM keep_id)
);

-- STEP 5: Delete duplicate Claire Schillaci entries (keep only one)
DELETE FROM clients
WHERE LOWER(TRIM(name)) = 'claire schillaci'
AND id != (SELECT id FROM keep_id);

-- STEP 6: Verify cleanup
SELECT 
    COUNT(*) as remaining_claires,
    (SELECT id FROM keep_id) as kept_id
FROM clients
WHERE LOWER(TRIM(name)) = 'claire schillaci';

-- Clean up temp table
DROP TABLE IF EXISTS keep_id;

-- ============================================
-- ALTERNATIVE: Simpler version (keeps most recent)
-- ============================================

-- If you prefer to keep the MOST RECENT Claire Schillaci, use this instead:

/*
-- Find the ID of the most recent Claire Schillaci
DO $$
DECLARE
    keep_id TEXT;
BEGIN
    -- Get the ID of the most recent Claire Schillaci
    SELECT id INTO keep_id
    FROM clients
    WHERE LOWER(TRIM(name)) = 'claire schillaci'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Reassign sessions
    UPDATE sessions
    SET client_id = keep_id
    WHERE client_id IN (
        SELECT id FROM clients
        WHERE LOWER(TRIM(name)) = 'claire schillaci'
        AND id != keep_id
    );
    
    -- Reassign session notes
    UPDATE session_notes
    SET client_id = keep_id
    WHERE client_id IN (
        SELECT id FROM clients
        WHERE LOWER(TRIM(name)) = 'claire schillaci'
        AND id != keep_id
    );
    
    -- Delete duplicates
    DELETE FROM clients
    WHERE LOWER(TRIM(name)) = 'claire schillaci'
    AND id != keep_id;
    
    RAISE NOTICE 'Kept Claire Schillaci with ID: %', keep_id;
END $$;
*/

-- ============================================
-- SIMPLEST VERSION: Keep specific ID
-- ============================================

-- If you know the ID you want to keep (e.g., '1764154407453'), use this:

/*
-- Replace 'KEEP_THIS_ID' with the actual ID you want to keep
UPDATE sessions
SET client_id = 'KEEP_THIS_ID'
WHERE client_id IN (
    SELECT id FROM clients
    WHERE LOWER(TRIM(name)) = 'claire schillaci'
    AND id != 'KEEP_THIS_ID'
);

UPDATE session_notes
SET client_id = 'KEEP_THIS_ID'
WHERE client_id IN (
    SELECT id FROM clients
    WHERE LOWER(TRIM(name)) = 'claire schillaci'
    AND id != 'KEEP_THIS_ID'
);

DELETE FROM clients
WHERE LOWER(TRIM(name)) = 'claire schillaci'
AND id != 'KEEP_THIS_ID';
*/










