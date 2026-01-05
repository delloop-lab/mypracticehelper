-- Add transcript, audio_url, and ai_overview columns to session_notes table
-- This allows session notes to store the actual transcription, voice recording, and AI session overview

-- Check if columns exist, if not add them
DO $$ 
BEGIN
    -- Add transcript column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'session_notes' 
        AND column_name = 'transcript'
    ) THEN
        ALTER TABLE session_notes 
        ADD COLUMN transcript TEXT;
        
        RAISE NOTICE 'Added transcript column to session_notes table';
    ELSE
        RAISE NOTICE 'transcript column already exists in session_notes table';
    END IF;
    
    -- Add audio_url column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'session_notes' 
        AND column_name = 'audio_url'
    ) THEN
        ALTER TABLE session_notes 
        ADD COLUMN audio_url TEXT;
        
        RAISE NOTICE 'Added audio_url column to session_notes table';
    ELSE
        RAISE NOTICE 'audio_url column already exists in session_notes table';
    END IF;
    
    -- Add ai_overview column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'session_notes' 
        AND column_name = 'ai_overview'
    ) THEN
        ALTER TABLE session_notes 
        ADD COLUMN ai_overview TEXT;
        
        RAISE NOTICE 'Added ai_overview column to session_notes table';
    ELSE
        RAISE NOTICE 'ai_overview column already exists in session_notes table';
    END IF;
END $$;


