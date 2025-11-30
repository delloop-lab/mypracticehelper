-- Zero all revenue by resetting payment statuses and fees
-- This is for testing purposes
-- Run this in Supabase SQL Editor

-- Option 1: Set all payment statuses to 'unpaid' (keeps fees but marks as unpaid)
UPDATE sessions
SET 
    metadata = COALESCE(metadata, '{}'::jsonb) || 
    jsonb_build_object(
        'paymentStatus', 'unpaid'
    ),
    updated_at = NOW()
WHERE metadata->>'paymentStatus' = 'paid'
   OR (metadata->>'paymentStatus' IS NULL AND EXISTS (
       SELECT 1 FROM sessions s2 
       WHERE s2.id = sessions.id 
       AND s2.metadata IS NOT NULL
   ));

-- Option 2: Set all fees to 0 (keeps payment status but removes fees)
UPDATE sessions
SET 
    metadata = COALESCE(metadata, '{}'::jsonb) || 
    jsonb_build_object(
        'fee', 0
    ),
    updated_at = NOW()
WHERE (metadata->>'fee')::numeric > 0
   OR (metadata->>'fee' IS NULL AND EXISTS (
       SELECT 1 FROM sessions s2 
       WHERE s2.id = sessions.id 
       AND s2.metadata IS NOT NULL
   ));

-- Option 3: Remove payment status and set fee to 0 (complete reset)
-- Uncomment the lines below if you want to completely reset everything:
/*
UPDATE sessions
SET 
    metadata = COALESCE(metadata, '{}'::jsonb) - 'paymentStatus' - 'fee' ||
    jsonb_build_object(
        'fee', 0,
        'paymentStatus', 'unpaid'
    ),
    updated_at = NOW();
*/

-- Verify the changes - show all sessions with their payment status and fees
SELECT 
    id,
    date,
    client_id,
    metadata->>'paymentStatus' as payment_status,
    metadata->>'fee' as fee,
    metadata->>'currency' as currency
FROM sessions
ORDER BY date DESC
LIMIT 50;

-- Count sessions by payment status
SELECT 
    COALESCE(metadata->>'paymentStatus', 'unpaid') as payment_status,
    COUNT(*) as count,
    SUM(COALESCE((metadata->>'fee')::numeric, 0)) as total_fees
FROM sessions
GROUP BY COALESCE(metadata->>'paymentStatus', 'unpaid')
ORDER BY payment_status;


