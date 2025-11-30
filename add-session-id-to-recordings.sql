-- Add session_id column to recordings table if it doesn't exist
-- This allows recordings to be linked to specific sessions

-- Check if column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'recordings' 
        AND column_name = 'session_id'
    ) THEN
        ALTER TABLE recordings 
        ADD COLUMN session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL;
        
        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id);
        
        RAISE NOTICE 'Added session_id column to recordings table';
    ELSE
        RAISE NOTICE 'session_id column already exists in recordings table';
    END IF;
END $$;






