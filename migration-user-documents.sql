-- ============================================================================
-- USER DOCUMENTS TABLE MIGRATION
-- ============================================================================
-- This migration creates a table for storing user-specific documents
-- (documents that belong to the user, not associated with any client)
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Create user_documents table
CREATE TABLE IF NOT EXISTS user_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  size TEXT,
  url TEXT NOT NULL,
  category TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for faster user_id lookups
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id);

-- Create index for faster URL lookups (for deletion)
CREATE INDEX IF NOT EXISTS idx_user_documents_url ON user_documents(url);

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the migration worked)
-- ============================================================================
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'user_documents';
-- ============================================================================

