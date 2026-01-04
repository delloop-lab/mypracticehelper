-- Zero unpaid sessions - remove or reset unpaid sessions
-- This is for testing purposes
-- Run this in Supabase SQL Editor

-- Option 1: Delete all unpaid sessions (permanently removes them)
-- Uncomment the lines below if you want to delete unpaid sessions:
/*
DELETE FROM sessions
WHERE COALESCE(metadata->>'paymentStatus', 'unpaid') = 'unpaid'
   OR metadata->>'paymentStatus' IS NULL;
*/

-- Option 2: Set all unpaid session fees to 0 (keeps sessions but removes fees)
UPDATE sessions
SET 
    metadata = COALESCE(metadata, '{}'::jsonb) || 
    jsonb_build_object(
        'fee', 0
    ),
    updated_at = NOW()
WHERE COALESCE(metadata->>'paymentStatus', 'unpaid') = 'unpaid'
   OR metadata->>'paymentStatus' IS NULL;

-- Option 3: Mark all unpaid sessions as paid with 0 fee (clears outstanding)
-- Uncomment the lines below if you want to mark unpaid as paid with 0 fee:
/*
UPDATE sessions
SET 
    metadata = COALESCE(metadata, '{}'::jsonb) || 
    jsonb_build_object(
        'paymentStatus', 'paid',
        'fee', 0
    ),
    updated_at = NOW()
WHERE COALESCE(metadata->>'paymentStatus', 'unpaid') = 'unpaid'
   OR metadata->>'paymentStatus' IS NULL;
*/

-- Verify the changes - show unpaid sessions before/after
SELECT 
    id,
    date,
    client_id,
    metadata->>'paymentStatus' as payment_status,
    metadata->>'fee' as fee,
    metadata->>'currency' as currency
FROM sessions
WHERE COALESCE(metadata->>'paymentStatus', 'unpaid') = 'unpaid'
   OR metadata->>'paymentStatus' IS NULL
ORDER BY date DESC;

-- Count unpaid sessions
SELECT 
    COUNT(*) as unpaid_sessions_count,
    SUM(COALESCE((metadata->>'fee')::numeric, 0)) as total_unpaid_fees
FROM sessions
WHERE COALESCE(metadata->>'paymentStatus', 'unpaid') = 'unpaid'
   OR metadata->>'paymentStatus' IS NULL;





