-- Add flagged column to recordings table for "flag for review" feature.
-- Per RECORDINGS_DATA_INTEGRITY.md: never delete or overwrite audio files.

ALTER TABLE recordings ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;
COMMENT ON COLUMN recordings.flagged IS 'User-flagged for review (e.g. unallocated or needs attention)';
