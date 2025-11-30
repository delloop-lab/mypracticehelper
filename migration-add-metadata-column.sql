-- Add metadata column to clients table for storing extra fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_clients_metadata ON clients USING gin (metadata);







