-- ============================================================================
-- MULTI-USER MIGRATION - STEP 2: Create First User (FIXED VERSION)
-- ============================================================================
-- This creates the first user and assigns all existing data to them
-- Run this AFTER you've replaced 'REPLACE_WITH_BCRYPT_HASH' with actual hash
-- ============================================================================

-- STEP 1: Generate password hash first!
-- Run: node scripts/generate-password-hash.js
-- Then replace 'REPLACE_WITH_BCRYPT_HASH' below with the hash from the script

-- STEP 2: Create user and assign all data in one transaction
DO $$
DECLARE
  v_user_id TEXT;
  password_hash TEXT := '$2b$10$1PcdErAiMVoz1/KG4.gKnOOsDcd6Pd0EsJIEZMFU7mzw0VR.thzSm';
BEGIN
  -- Generate user ID
  v_user_id := gen_random_uuid()::TEXT;
  
  -- Insert user (or update if exists)
  INSERT INTO users (id, email, password_hash, first_name, last_name)
  VALUES (
    v_user_id,
    'claire@claireschillaci.com',
    password_hash,
    'Claire',
    'Schillaci'
  )
  ON CONFLICT (email) DO UPDATE 
    SET password_hash = EXCLUDED.password_hash,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name
  RETURNING id INTO v_user_id;
  
  RAISE NOTICE 'User ID: %', v_user_id;
  
  -- Update clients
  UPDATE clients SET user_id = v_user_id WHERE clients.user_id IS NULL;
  
  -- Update sessions (via client relationship first)
  UPDATE sessions 
  SET user_id = (
    SELECT c.user_id FROM clients c WHERE c.id = sessions.client_id LIMIT 1
  )
  WHERE sessions.user_id IS NULL AND sessions.client_id IS NOT NULL;
  
  -- Update sessions without clients (assign directly)
  UPDATE sessions SET user_id = v_user_id WHERE sessions.user_id IS NULL;
  
  -- Update session_notes (via client relationship)
  UPDATE session_notes 
  SET user_id = (
    SELECT c.user_id FROM clients c WHERE c.id = session_notes.client_id LIMIT 1
  )
  WHERE session_notes.user_id IS NULL AND session_notes.client_id IS NOT NULL;
  
  -- Update recordings (via client relationship)
  UPDATE recordings 
  SET user_id = (
    SELECT c.user_id FROM clients c WHERE c.id = recordings.client_id LIMIT 1
  )
  WHERE recordings.user_id IS NULL AND recordings.client_id IS NOT NULL;
  
  -- Update payments (via client relationship)
  UPDATE payments 
  SET user_id = (
    SELECT c.user_id FROM clients c WHERE c.id = payments.client_id LIMIT 1
  )
  WHERE payments.user_id IS NULL AND payments.client_id IS NOT NULL;
  
  -- Update reminders (via client relationship)
  UPDATE reminders 
  SET user_id = (
    SELECT c.user_id FROM clients c WHERE c.id = reminders.client_id LIMIT 1
  )
  WHERE reminders.user_id IS NULL AND reminders.client_id IS NOT NULL;
  
  -- Update settings (migrate 'default' settings to first user)
  UPDATE settings 
  SET user_id = v_user_id 
  WHERE settings.id = 'default' AND settings.user_id IS NULL;
  
  RAISE NOTICE 'Migration complete! User ID: %', v_user_id;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify)
-- ============================================================================
-- Get the user ID:
SELECT id, email, first_name, last_name FROM users WHERE email = 'claire@claireschillaci.com';

-- Check data assignment:
SELECT COUNT(*) as total_clients, COUNT(user_id) as clients_with_user FROM clients;
SELECT COUNT(*) as total_sessions, COUNT(user_id) as sessions_with_user FROM sessions;
SELECT COUNT(*) as total_recordings, COUNT(user_id) as recordings_with_user FROM recordings;

-- ============================================================================

