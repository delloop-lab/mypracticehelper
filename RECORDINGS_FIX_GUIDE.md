# Recordings Fix Guide

## Problem
Some recordings are missing `client_id` and/or `session_id` in the database.

## Solution

### Step 1: Add session_id Column (if needed)
If the recordings table doesn't have a `session_id` column, run this SQL in Supabase SQL Editor:

```sql
-- Add session_id column to recordings table if it doesn't exist
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
        
        CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id);
    END IF;
END $$;
```

Or use the provided SQL file: `add-session-id-to-recordings.sql`

### Step 2: Fix Missing Assignments
Go to `/backup` page and click the **"FIX RECORDINGS ASSIGNMENTS"** button.

This will:
1. **Fix missing client_id**: Matches recordings to clients by:
   - Client name from joined clients table
   - Client name found in transcript
   - Client name found in title
   - Client name from client_name field

2. **Fix missing session_id**: Matches recordings to sessions by:
   - Recording date + client_id
   - If exact date match not found, searches within ±3 days

### Step 3: Verify
After running the fix, check:
- Recordings should have `client_id` set
- Recordings should have `session_id` set (if sessions exist for that date/client)

## API Endpoint
The fix endpoint is available at: `/api/recordings/fix-assignments`

POST request will:
- Find all recordings with missing `client_id` or `session_id`
- Attempt to match them to clients and sessions
- Update the database
- Return a summary of fixes applied

## Manual SQL Fix (if needed)
If you know the specific recording IDs and want to fix them manually:

```sql
-- Fix client_id for a specific recording
UPDATE recordings 
SET client_id = 'CLIENT_ID_HERE'
WHERE id = 'recording-1764079988675';

-- Fix session_id for a specific recording
UPDATE recordings 
SET session_id = 'SESSION_ID_HERE'
WHERE id = 'recording-1764079988675';
```

## Notes
- Recordings are matched to clients by name (case-insensitive)
- Recordings are matched to sessions by date (within ±3 days if exact match not found)
- The fix endpoint logs all actions for debugging






