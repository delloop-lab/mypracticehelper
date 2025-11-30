-- ============================================================================
-- MULTI-USER MIGRATION - STEP 2: Create First User (Run AFTER auth code is ready)
-- ============================================================================
-- This creates the first user from existing credentials
-- IMPORTANT: Only run this AFTER the authentication code is implemented
-- The password hash below is for '22Picnic!' - you'll need to generate this
-- using bcrypt in your auth code first
-- ============================================================================

-- STEP 1: Generate password hash first!
-- Run this command in your terminal to generate the bcrypt hash:
--   node scripts/generate-password-hash.js
-- 
-- Copy the hash that's printed, then replace 'REPLACE_WITH_BCRYPT_HASH' below

-- STEP 2: Create the first user (Claire)
-- Generate a unique ID for the user (or use a fixed one)
DO $$
DECLARE
  user_id TEXT;
  password_hash TEXT := 'REPLACE_WITH_BCRYPT_HASH'; -- REPLACE THIS with hash from script!
BEGIN
  -- Generate user ID
  user_id := gen_random_uuid()::TEXT;
  
  -- Insert user
  INSERT INTO users (id, email, password_hash, first_name, last_name)
  VALUES (
    user_id,
    'claire@claireschillaci.com',
    password_hash,
    'Claire',
    'Schillaci'
  )
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
  RETURNING id INTO user_id;
  
  -- Store user_id for next step (you'll need to copy it)
  RAISE NOTICE 'User created with ID: %', user_id;
  
  -- Now update all existing data to use this user_id
  -- (Continue with STEP 3 below, but replace 'claire-user-id' with the ID above)
END $$;

-- STEP 3: Assign all existing data to the user created above
-- IMPORTANT: Replace 'YOUR_USER_ID_HERE' with the actual user_id from STEP 2 output
-- You can also get it by running: SELECT id FROM users WHERE email = 'claire@claireschillaci.com';

-- Get the user_id first (replace this query result with YOUR_USER_ID_HERE below)
-- SELECT id FROM users WHERE email = 'claire@claireschillaci.com';

-- Update clients
UPDATE clients SET user_id = 'YOUR_USER_ID_HERE' WHERE user_id IS NULL;

-- Update sessions (via client relationship first, then direct assignment)
UPDATE sessions 
SET user_id = (
  SELECT user_id FROM clients WHERE clients.id = sessions.client_id LIMIT 1
)
WHERE user_id IS NULL AND client_id IS NOT NULL;

-- Update sessions without clients (assign directly)
UPDATE sessions SET user_id = 'YOUR_USER_ID_HERE' WHERE user_id IS NULL;

-- Update session_notes (via client relationship)
UPDATE session_notes 
SET user_id = (
  SELECT user_id FROM clients WHERE clients.id = session_notes.client_id LIMIT 1
)
WHERE user_id IS NULL AND client_id IS NOT NULL;

-- Update recordings (via client relationship)
UPDATE recordings 
SET user_id = (
  SELECT user_id FROM clients WHERE clients.id = recordings.client_id LIMIT 1
)
WHERE user_id IS NULL AND client_id IS NOT NULL;

-- Update payments (via client relationship)
UPDATE payments 
SET user_id = (
  SELECT user_id FROM clients WHERE clients.id = payments.client_id LIMIT 1
)
WHERE user_id IS NULL AND client_id IS NOT NULL;

-- Update reminders (via client relationship)
UPDATE reminders 
SET user_id = (
  SELECT user_id FROM clients WHERE clients.id = reminders.client_id LIMIT 1
)
WHERE user_id IS NULL AND client_id IS NOT NULL;

-- Update settings (migrate 'default' settings to first user)
UPDATE settings 
SET user_id = 'YOUR_USER_ID_HERE' 
WHERE id = 'default' AND user_id IS NULL;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Check that all data is assigned to the user:
-- SELECT COUNT(*) as total_clients, COUNT(user_id) as clients_with_user FROM clients;
-- SELECT COUNT(*) as total_sessions, COUNT(user_id) as sessions_with_user FROM sessions;
-- SELECT * FROM users WHERE email = 'claire@claireschillaci.com';
-- ============================================================================

