-- Cleanup Script: Remove AI Clinical Assessment from Live Recordings
-- This script removes AI Clinical Assessment notes from recordings that were recorded live
-- It does NOT delete any recordings or session notes - only updates the transcript JSON data
-- 
-- SAFETY: This script only modifies the transcript JSON field, removing AI assessment notes
-- All recordings and their data remain intact

-- Step 1: View recordings that will be affected (for review before running)
-- Uncomment and run this first to see what will be changed:
/*
SELECT 
    id,
    title,
    client_id,
    created_at,
    transcript,
    audio_url
FROM recordings
WHERE transcript IS NOT NULL
  AND transcript != ''
  AND transcript::jsonb ? 'notes'
  AND (
    transcript::jsonb->'notes' @> '[{"title": "AI Clinical Assessment"}]'::jsonb
    OR transcript::jsonb->'notes' @> '[{"title": "AI-Structured Notes"}]'::jsonb
  )
ORDER BY created_at DESC;
*/

-- Step 2: Create a backup of affected recordings (recommended)
-- This creates a backup table with the original data
CREATE TABLE IF NOT EXISTS recordings_backup_before_ai_cleanup AS
SELECT *
FROM recordings
WHERE transcript IS NOT NULL
  AND transcript != ''
  AND transcript::jsonb ? 'notes'
  AND (
    transcript::jsonb->'notes' @> '[{"title": "AI Clinical Assessment"}]'::jsonb
    OR transcript::jsonb->'notes' @> '[{"title": "AI-Structured Notes"}]'::jsonb
  );

-- Step 3: Update recordings to remove AI Clinical Assessment notes
-- This keeps the transcript but removes the notes array or filters out AI assessment notes
UPDATE recordings
SET transcript = (
    SELECT jsonb_build_object(
        'transcript', 
        COALESCE(
            (transcript::jsonb->>'transcript'),
            -- Fallback: if transcript field doesn't exist, try to extract from notes content
            -- This handles edge cases where the structure might be different
            CASE 
                WHEN transcript::jsonb ? 'notes' 
                THEN (
                    SELECT string_agg(
                        COALESCE(note->>'content', note->>'text', ''),
                        E'\n\n'
                    )
                    FROM jsonb_array_elements(transcript::jsonb->'notes') AS note
                    WHERE note->>'title' NOT IN ('AI Clinical Assessment', 'AI-Structured Notes')
                )
                ELSE transcript::text
            END
        ),
        'notes', 
        -- Keep only notes that are NOT AI Clinical Assessment
        COALESCE(
            (
                SELECT jsonb_agg(note)
                FROM jsonb_array_elements(transcript::jsonb->'notes') AS note
                WHERE note->>'title' NOT IN ('AI Clinical Assessment', 'AI-Structured Notes')
            ),
            '[]'::jsonb  -- Empty array if no non-AI notes remain
        )
    )
)
WHERE transcript IS NOT NULL
  AND transcript != ''
  AND transcript::jsonb ? 'notes'
  AND (
    transcript::jsonb->'notes' @> '[{"title": "AI Clinical Assessment"}]'::jsonb
    OR transcript::jsonb->'notes' @> '[{"title": "AI-Structured Notes"}]'::jsonb
  );

-- Step 4: Verify the changes
-- Run this to see the updated recordings:
/*
SELECT 
    id,
    title,
    client_id,
    created_at,
    transcript,
    audio_url
FROM recordings
WHERE id IN (
    SELECT id FROM recordings_backup_before_ai_cleanup
)
ORDER BY created_at DESC
LIMIT 10;
*/

-- Step 5: If you need to restore from backup (rollback):
-- Uncomment and run this ONLY if you need to undo the changes:
/*
UPDATE recordings r
SET transcript = b.transcript
FROM recordings_backup_before_ai_cleanup b
WHERE r.id = b.id;
*/

-- Step 6: After verifying everything is correct, you can drop the backup table:
-- DROP TABLE IF EXISTS recordings_backup_before_ai_cleanup;
