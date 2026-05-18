BEGIN;

-- Simulate the PostgREST JWT context
SELECT set_config('request.jwt.claims', '{"sub": "deed0df7-d6de-404a-853d-0428c4196c9a"}', true);

-- Perform the multi-field edit again
UPDATE public.members 
SET 
    first_name = 'Abraham Re-Verified', 
    phone_number = '+233593521111', 
    occupation = 'Senior Software Engineer' 
WHERE id = '8cf54258-0050-423d-b9a3-7f344ead04df';

COMMIT;

-- Query the audit log immediately after saving
SELECT field_changed, old_value, new_value, changed_at, changed_by
FROM member_audit_log
WHERE member_id = '8cf54258-0050-423d-b9a3-7f344ead04df'
ORDER BY changed_at DESC
LIMIT 10;
