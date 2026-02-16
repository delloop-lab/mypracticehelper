-- Migration: Add deleted_at for soft delete on recordings
-- PROTECTIVE GUARDRAIL: Never hard-delete recordings. Use soft delete only.
-- No physical storage files are ever deleted by application code.
-- Per RECORDINGS_TRANSCRIPTION_AUDIT.md

ALTER TABLE recordings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
COMMENT ON COLUMN recordings.deleted_at IS 'Soft delete: set when user deletes; row kept, audio file untouched. NULL = active.';

-- Index for filtering out deleted recordings efficiently
CREATE INDEX IF NOT EXISTS idx_recordings_deleted_at ON recordings (deleted_at) WHERE deleted_at IS NULL;
