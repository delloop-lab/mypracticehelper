-- ============================================================================
-- Add Admin Reminders System
-- ============================================================================
-- This adds support for:
-- 1. New Client Form reminders (daily until form is signed)
-- 2. Unpaid session reminders (daily until paid)
-- 3. Custom reminders (user-created)
-- ============================================================================

-- Step 1: Add newClientFormSigned field to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS new_client_form_signed BOOLEAN DEFAULT FALSE;

-- Step 2: Create admin_reminders table for system-generated reminders
CREATE TABLE IF NOT EXISTS admin_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'new_client_form', 'unpaid_session', 'custom'
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_reminders_user_id ON admin_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_reminders_type ON admin_reminders(type);
CREATE INDEX IF NOT EXISTS idx_admin_reminders_client_id ON admin_reminders(client_id);
CREATE INDEX IF NOT EXISTS idx_admin_reminders_session_id ON admin_reminders(session_id);
CREATE INDEX IF NOT EXISTS idx_admin_reminders_active ON admin_reminders(is_active);

-- Step 4: Add user_id to existing reminders table (if not already added)
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);

-- ============================================================================
-- Notes:
-- - admin_reminders: System-generated reminders (auto-created by cron)
-- - reminders: User-created custom reminders (existing table)
-- - new_client_form_signed: Checkbox on client card
-- ============================================================================





