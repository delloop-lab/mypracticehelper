-- Check if company logo exists in settings table
-- Run this in Supabase SQL Editor

-- Check default settings
SELECT 
    id,
    'default' as settings_type,
    config->>'companyLogo' as company_logo,
    config->>'companyName' as company_name,
    updated_at
FROM settings
WHERE id = 'default';

-- Check user-specific settings (replace with your user_id if needed)
SELECT 
    id,
    user_id,
    'user-specific' as settings_type,
    config->>'companyLogo' as company_logo,
    config->>'companyName' as company_name,
    updated_at
FROM settings
WHERE user_id IS NOT NULL
ORDER BY updated_at DESC
LIMIT 5;

-- Check all settings with logos
SELECT 
    id,
    user_id,
    config->>'companyLogo' as company_logo,
    CASE 
        WHEN config->>'companyLogo' IS NULL OR config->>'companyLogo' = '' THEN 'NO LOGO'
        WHEN config->>'companyLogo' = '/logo.png' THEN 'USING DEFAULT LOGO.PNG (SHOULD CHANGE)'
        ELSE 'HAS LOGO'
    END as logo_status,
    updated_at
FROM settings
ORDER BY updated_at DESC;
