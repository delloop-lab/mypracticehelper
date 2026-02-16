-- Migration: Add status columns for recordings (allocation, recording, transcript)
-- Legacy rows have NULL; after populate step they get defaults.
-- No filters use these until defaults are set.

ALTER TABLE recordings ADD COLUMN IF NOT EXISTS allocation_status TEXT;
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS recording_status TEXT;
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS transcript_status TEXT;
COMMENT ON COLUMN recordings.allocation_status IS 'allocated | unallocated. Derived from client_id.';
COMMENT ON COLUMN recordings.recording_status IS 'uploaded | pending. All existing = uploaded.';
COMMENT ON COLUMN recordings.transcript_status IS 'complete | pending. Derived from transcript.';

-- Populate defaults for legacy rows (NULL statuses) - no audio/transcript changes
UPDATE recordings
SET allocation_status = CASE WHEN client_id IS NOT NULL THEN 'allocated' ELSE 'unallocated' END,
    recording_status = 'uploaded',
    transcript_status = CASE WHEN transcript IS NOT NULL THEN 'complete' ELSE 'pending' END
WHERE allocation_status IS NULL;
