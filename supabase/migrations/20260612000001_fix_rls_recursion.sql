-- Fix infinite recursion in communication RLS policies
-- 
-- Problem: communication_threads SELECT policy checks communication_thread_participants,
--          and communication_thread_participants SELECT policy checks back into
--          communication_threads, creating infinite recursion.
--
-- Solution: Create SECURITY DEFINER helper functions that bypass RLS to check
--           participant membership directly, breaking the circular dependency.

---
-- PART 1: Helper functions (SECURITY DEFINER — bypass RLS to break the cycle)
---

-- Returns true if the current auth user's member profile is a participant in the given thread.
-- SECURITY DEFINER means this query runs WITHOUT RLS on the participants table,
-- which is safe because we only SELECT a boolean (no data leakage).
CREATE OR REPLACE FUNCTION auth_is_thread_participant(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM communication_thread_participants
    WHERE thread_id = p_thread_id
    AND   member_id = auth_member_id()
    AND   left_at IS NULL
  );
$$;

-- Returns true if the current user is a participant of the thread that owns a given participant row.
-- Used by the communication_thread_participants SELECT policy.
CREATE OR REPLACE FUNCTION auth_is_participant_of_thread(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM communication_thread_participants
    WHERE thread_id = p_thread_id
    AND   member_id = auth_member_id()
    AND   left_at IS NULL
  );
$$;

---
-- PART 2: Drop old recursive policies
---

DROP POLICY IF EXISTS "threads: participants read"       ON communication_threads;
DROP POLICY IF EXISTS "threads: pastoral restricted"     ON communication_threads;
DROP POLICY IF EXISTS "thread_participants: read own threads" ON communication_thread_participants;

---
-- PART 3: Recreate non-recursive policies using the helper functions
---

-- communication_threads: allow read if user is a participant (uses SECURITY DEFINER fn)
CREATE POLICY "threads: participants read"
ON communication_threads FOR SELECT
USING (
  assembly_id = auth_assembly_id()
  AND deleted_at IS NULL
  AND auth_is_thread_participant(id)
);

-- communication_threads: restrict pastoral/sensitive threads (uses SECURITY DEFINER fn)
CREATE POLICY "threads: pastoral restricted"
ON communication_threads FOR SELECT
USING (
  assembly_id = auth_assembly_id()
  AND deleted_at IS NULL
  AND (
    is_sensitive = false
    OR auth_has_permission('communications.attachments.view_pastoral')
  )
  AND auth_is_thread_participant(id)
);

-- communication_thread_participants: allow read via SECURITY DEFINER fn
-- (no longer references communication_threads to break the cycle)
CREATE POLICY "thread_participants: read own threads"
ON communication_thread_participants FOR SELECT
USING (
  auth_is_participant_of_thread(thread_id)
);
