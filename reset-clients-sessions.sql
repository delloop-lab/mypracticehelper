-- Reset all clients to have no sessions and no next appointment
-- This is for testing purposes
-- Run this in Supabase SQL Editor

-- Update all clients to set sessions to 0 and clear nextAppointment in metadata
UPDATE clients
SET 
    metadata = COALESCE(metadata, '{}'::jsonb) || 
    jsonb_build_object(
        'sessions', 0,
        'nextAppointment', ''
    ),
    updated_at = NOW();

-- Verify the changes - show all clients with their session counts
SELECT 
    id,
    name,
    COALESCE((metadata->>'sessions')::int, 0) as sessions,
    COALESCE(metadata->>'nextAppointment', '') as nextAppointment
FROM clients
ORDER BY name;

