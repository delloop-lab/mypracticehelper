-- Create settings table
CREATE TABLE settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow all access
CREATE POLICY "Allow all operations on settings" ON settings FOR ALL USING (true) WITH CHECK (true);

-- Insert default settings
INSERT INTO settings (id, config) VALUES ('default', '{
    "calendlyUrl": "",
    "appointmentTypes": [
        { "name": "Initial Consultation", "duration": 60, "fee": 80, "enabled": true },
        { "name": "Follow-up Session", "duration": 60, "fee": 80, "enabled": true },
        { "name": "Therapy Session", "duration": 60, "fee": 80, "enabled": true },
        { "name": "Couples Therapy Session", "duration": 60, "fee": 100, "enabled": true },
        { "name": "Family Therapy", "duration": 60, "fee": 80, "enabled": true },
        { "name": "Discovery Session", "duration": 30, "fee": 0, "enabled": true }
    ],
    "defaultDuration": 60,
    "defaultFee": 80,
    "currency": "EUR"
}'::jsonb) ON CONFLICT (id) DO NOTHING;
