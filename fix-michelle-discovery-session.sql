-- Fix Michelle Duong's Discovery Session fee
-- This script corrects appointments that were incorrectly charged when they should have been free

-- First, let's check which appointments for Michelle Duong have a Discovery Session with an incorrect fee
SELECT 
    id,
    client_name,
    date,
    time,
    type,
    fee,
    currency,
    payment_status,
    payment_method
FROM appointments
WHERE client_name ILIKE '%Michelle%Duong%'
    AND type = 'Discovery Session'
    AND fee > 0
ORDER BY date DESC;

-- To fix Michelle Duong's Discovery Session:
-- Uncomment and run the UPDATE below after confirming the ID from the SELECT above

/*
UPDATE appointments
SET 
    fee = 0,
    payment_status = 'paid',  -- Mark as paid since there's nothing to pay
    metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{corrected}',
        to_jsonb(now()),
        true
    )
WHERE client_name ILIKE '%Michelle%Duong%'
    AND type = 'Discovery Session'
    AND fee > 0
RETURNING id, client_name, date, type, fee, payment_status;
*/

-- Alternative: If you want to fix ALL incorrectly charged Discovery Sessions for ALL clients:
/*
UPDATE appointments
SET 
    fee = 0,
    payment_status = 'paid',  -- Mark as paid since there's nothing to pay
    metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{corrected}',
        to_jsonb(now()),
        true
    )
WHERE type = 'Discovery Session'
    AND fee > 0
RETURNING id, client_name, date, type, fee, payment_status;
*/
