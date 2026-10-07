-- One-off cleanup: POS orders used to hardcode last_name='Customer',
-- making derived customer names read like "Mohamed Customer".
-- Run once in the Supabase SQL editor AFTER deploying the panel fix.
UPDATE orders
SET last_name = ''
WHERE source = 'POS'
  AND last_name = 'Customer';