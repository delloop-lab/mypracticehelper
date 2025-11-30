-- ============================================================================
-- Custom Reminder Templates System
-- ============================================================================
-- Allows admins to create custom reminders that check conditions daily
-- ============================================================================

-- Create custom_reminder_templates table
CREATE TABLE IF NOT EXISTS custom_reminder_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  condition_type TEXT NOT NULL, -- 'new_client_form', 'custom_sql', 'client_field'
  condition_config JSONB, -- Stores condition-specific config
  is_enabled BOOLEAN DEFAULT TRUE,
  frequency TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_custom_reminder_templates_user_id ON custom_reminder_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_reminder_templates_enabled ON custom_reminder_templates(is_enabled);

-- ============================================================================
-- Notes:
-- - condition_type: Type of condition to check
-- - condition_config: JSON object with condition-specific settings
--   Example for 'new_client_form': { "field": "new_client_form_signed", "value": false }
--   Example for 'client_field': { "field": "email", "operator": "is_empty" }
-- ============================================================================


