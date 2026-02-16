-- Migration: Add transcript_latest_attempt for non-destructive retry-transcription
-- When retry-transcription would overwrite an existing non-empty transcript,
-- the new attempt is stored here instead. Primary transcript remains untouched.
-- No migration of existing rows - only adds column.

ALTER TABLE recordings ADD COLUMN IF NOT EXISTS transcript_latest_attempt TEXT;
COMMENT ON COLUMN recordings.transcript_latest_attempt IS 'Latest Whisper retry result when primary transcript was preserved (non-destructive).';
