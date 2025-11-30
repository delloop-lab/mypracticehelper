-- ============================================================================
-- MULTI-USER MIGRATION - STEP 1: Database Schema (SAFE, NON-BREAKING)
-- ============================================================================
-- This migration adds multi-user support WITHOUT breaking existing functionality
-- All user_id columns are NULLABLE, so existing data continues to work
-- Run this in Supabase SQL Editor
-- ============================================================================

-- STEP 1: Create users table
-- This table stores user accounts with email/password authentication
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Note: We'll generate IDs in application code (using crypto.randomUUID() or similar)
-- This keeps it consistent with TEXT IDs used elsewhere

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- STEP 2: Add user_id columns to all data tables (NULLABLE for backwards compatibility)
-- Existing data will have NULL user_id, which is fine - we'll migrate it later

-- Add user_id to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- Add user_id to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- Add user_id to session_notes table
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- Add user_id to recordings table
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- Add user_id to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- Add user_id to reminders table
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- STEP 3: Create indexes for performance (user_id lookups will be common)
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_user_id ON session_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_recordings_user_id ON recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);

-- STEP 4: Update settings table to support per-user settings
-- Settings table currently has id='default'. We'll keep that for backwards compatibility
-- but also add user_id so each user can have their own settings

ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- Create index for settings user_id lookups
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the migration worked)
-- ============================================================================
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'users';
--
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'clients' AND column_name = 'user_id';
-- ============================================================================

-- ============================================================================
-- NOTES:
-- 1. All user_id columns are NULLABLE - existing data will work fine
-- 2. No data is migrated yet - that's STEP 2 (we'll do that after auth is ready)
-- 3. The app will continue to work because it doesn't filter by user_id yet
-- 4. Once auth is implemented, we'll migrate existing data to the first user
-- ============================================================================

