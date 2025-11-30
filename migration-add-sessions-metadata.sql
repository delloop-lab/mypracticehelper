-- Add metadata column to sessions table for storing payment status, fee, and currency
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_metadata ON sessions USING gin (metadata);






