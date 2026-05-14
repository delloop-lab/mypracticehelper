-- ============================================================================
-- One-shot cleanup: orphan session_notes shadow rows from "Delete AI Assessment"
-- ============================================================================
-- Context
-- -------
-- An earlier version of confirmDeleteAIAssessment (src/app/clients/page.tsx)
-- cleared session_notes.content instead of hard-deleting the shadow row.
-- Those rows have id "recording-<uuid>" matching a real recording id, and
-- they shadow the recording in /api/session-notes GET (which dedupes by id
-- and keeps the session_note), hiding the audio card from the client
-- session view even though the recording itself is still healthy in the
-- recordings table.
--
-- This script removes ONLY rows that satisfy ALL of:
--   (1) session_notes.id LIKE 'recording-%'
--   (2) session_notes.content IS NULL OR TRIM(content) = ''
--   (3) a matching recording exists whose id equals the uuid portion of the
--       session_notes.id (i.e. 'recording-' || recordings.id::text)
--
-- It does NOT touch:
--   - session_notes with any other id (manual / written / admin notes, etc.)
--   - session_notes that still carry content (real AI assessments are kept)
--   - the recordings table
--   - any transcript text, audio storage, or schema
-- ============================================================================

-- ---------------------------------------------------------------------------
-- DRY-RUN PREVIEW
-- Inspect this list first. These are the rows that the DELETE block below
-- will remove. If anything looks wrong, abort before running the BEGIN block.
-- ---------------------------------------------------------------------------
SELECT sn.id          AS shadow_id,
       sn.content     AS shadow_content,
       sn.transcript IS NOT NULL AS has_transcript,
       sn.audio_url  IS NOT NULL AS has_audio_url,
       sn.created_at  AS shadow_created_at,
       r.id           AS recording_id
FROM session_notes sn
INNER JOIN recordings r
        ON sn.id = 'recording-' || r.id::text
WHERE sn.id LIKE 'recording-%'
  AND (sn.content IS NULL OR TRIM(sn.content) = '')
ORDER BY sn.created_at DESC;

-- ---------------------------------------------------------------------------
-- CLEANUP
-- Wrapped in a transaction. The final SELECT returns the number of rows
-- removed. The INNER JOIN to recordings is the safety guarantee from rule (3)
-- — a shadow without a matching recording is left in place.
-- ---------------------------------------------------------------------------
BEGIN;

WITH deleted AS (
    DELETE FROM session_notes sn
    USING recordings r
    WHERE sn.id LIKE 'recording-%'
      AND (sn.content IS NULL OR TRIM(sn.content) = '')
      AND sn.id = 'recording-' || r.id::text
    RETURNING sn.id
)
SELECT COUNT(*)::int AS shadow_rows_deleted FROM deleted;

COMMIT;
