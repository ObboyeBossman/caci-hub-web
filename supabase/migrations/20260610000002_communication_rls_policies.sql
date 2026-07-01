-- Communication module RLS policies and helpers
-- Adds row-level security to all communication tables + permission seeds

---
-- PART 1: Helper functions
---

-- Helper function: get assembly_id for the current auth user
CREATE OR REPLACE FUNCTION auth_assembly_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT assembly_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Helper function: check a permission key for the current auth user
CREATE OR REPLACE FUNCTION auth_has_permission(perm_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN assembly_roles ar  ON ar.id = up.assembly_role_id
    JOIN role_permissions rp ON rp.role_id = ar.id
    WHERE up.id = auth.uid()
    AND   rp.permission_key = perm_key
    AND   ar.is_active = true
    AND   up.is_active = true
  );
$$;

-- Helper function: check if current user is a member of an assembly
CREATE OR REPLACE FUNCTION auth_member_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM members
  WHERE auth_user_id = auth.uid()
  AND   is_active = true
  LIMIT 1;
$$;

---
-- PART 2: Enable RLS on all communication tables
---

ALTER TABLE communication_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_threads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_thread_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_attachments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_posts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_trigger_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_preferences        ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_device_tokens               ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_signed_url_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_storage_usage           ENABLE ROW LEVEL SECURITY;

---
-- PART 3: RLS Policies
---

-- communication_templates
CREATE POLICY "templates: members read own assembly"
ON communication_templates FOR SELECT
USING (
  assembly_id = auth_assembly_id()
  AND is_active = true
  AND deleted_at IS NULL
);

CREATE POLICY "templates: managers insert"
ON communication_templates FOR INSERT
WITH CHECK (
  assembly_id = auth_assembly_id()
  AND auth_has_permission('communications.templates.manage')
);

CREATE POLICY "templates: managers update"
ON communication_templates FOR UPDATE
USING (
  assembly_id = auth_assembly_id()
  AND auth_has_permission('communications.templates.manage')
);

CREATE POLICY "templates: managers soft delete"
ON communication_templates FOR UPDATE
USING (
  assembly_id = auth_assembly_id()
  AND auth_has_permission('communications.templates.manage')
);

-- communication_campaigns
CREATE POLICY "campaigns: members read own assembly"
ON communication_campaigns FOR SELECT
USING (
  assembly_id = auth_assembly_id()
  AND deleted_at IS NULL
);

CREATE POLICY "campaigns: senders insert"
ON communication_campaigns FOR INSERT
WITH CHECK (
  assembly_id = auth_assembly_id()
  AND auth_has_permission('communications.broadcast.send')
);

CREATE POLICY "campaigns: senders update own or admin any"
ON communication_campaigns FOR UPDATE
USING (
  assembly_id = auth_assembly_id()
  AND (
    created_by = auth.uid()
    OR auth_has_permission('communications.broadcast.schedule')
  )
  AND deleted_at IS NULL
);

-- communication_messages
CREATE POLICY "messages: members read own"
ON communication_messages FOR SELECT
USING (
  assembly_id = auth_assembly_id()
  AND member_id = auth_member_id()
  AND deleted_at IS NULL
);

CREATE POLICY "messages: reporters read assembly"
ON communication_messages FOR SELECT
USING (
  assembly_id = auth_assembly_id()
  AND auth_has_permission('communications.reports.view')
  AND deleted_at IS NULL
);

-- communication_threads
CREATE POLICY "threads: participants read"
ON communication_threads FOR SELECT
USING (
  assembly_id = auth_assembly_id()
  AND deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM communication_thread_participants ctp
    WHERE ctp.thread_id = id
    AND   ctp.member_id = auth_member_id()
    AND   ctp.left_at IS NULL
  )
);

CREATE POLICY "threads: pastoral restricted"
ON communication_threads FOR SELECT
USING (
  assembly_id = auth_assembly_id()
  AND deleted_at IS NULL
  AND (
    is_sensitive = false
    OR auth_has_permission('communications.attachments.view_pastoral')
  )
  AND EXISTS (
    SELECT 1 FROM communication_thread_participants ctp
    WHERE ctp.thread_id = id
    AND   ctp.member_id = auth_member_id()
    AND   ctp.left_at IS NULL
  )
);

CREATE POLICY "threads: members insert non-pastoral"
ON communication_threads FOR INSERT
WITH CHECK (
  assembly_id = auth_assembly_id()
  AND is_pastoral = false
  AND is_sensitive = false
);

CREATE POLICY "threads: pastoral role insert sensitive"
ON communication_threads FOR INSERT
WITH CHECK (
  assembly_id = auth_assembly_id()
  AND auth_has_permission('communications.direct.send_pastoral')
);

-- communication_thread_participants
CREATE POLICY "thread_participants: read own threads"
ON communication_thread_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM communication_threads ct
    WHERE ct.id = thread_id
    AND   ct.assembly_id = auth_assembly_id()
    AND   ct.deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM communication_thread_participants ctp2
    WHERE ctp2.thread_id = thread_id
    AND   ctp2.member_id = auth_member_id()
    AND   ctp2.left_at IS NULL
  )
);

CREATE POLICY "thread_participants: thread creator insert"
ON communication_thread_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM communication_threads ct
    WHERE ct.id = thread_id
    AND   ct.assembly_id = auth_assembly_id()
    AND   ct.created_by = auth.uid()
    AND   ct.deleted_at IS NULL
  )
);

CREATE POLICY "thread_participants: update own read timestamp"
ON communication_thread_participants FOR UPDATE
USING (member_id = auth_member_id())
WITH CHECK (member_id = auth_member_id());

-- communication_thread_messages
CREATE POLICY "thread_messages: participants read"
ON communication_thread_messages FOR SELECT
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM communication_thread_participants ctp
    WHERE ctp.thread_id = thread_id
    AND   ctp.member_id = auth_member_id()
    AND   ctp.left_at IS NULL
  )
);

CREATE POLICY "thread_messages: participants insert text"
ON communication_thread_messages FOR INSERT
WITH CHECK (
  message_type = 'text'
  AND sender_id = auth_member_id()
  AND EXISTS (
    SELECT 1 FROM communication_thread_participants ctp
    WHERE ctp.thread_id = thread_id
    AND   ctp.member_id = auth_member_id()
    AND   ctp.left_at IS NULL
  )
);

CREATE POLICY "thread_messages: pastor insert audio"
ON communication_thread_messages FOR INSERT
WITH CHECK (
  message_type = 'audio'
  AND sender_id = auth_member_id()
  AND auth_has_permission('communications.audio.broadcast')
  AND EXISTS (
    SELECT 1 FROM communication_thread_participants ctp
    WHERE ctp.thread_id = thread_id
    AND   ctp.member_id = auth_member_id()
    AND   ctp.left_at IS NULL
  )
);

CREATE POLICY "thread_messages: sender soft delete within 24h"
ON communication_thread_messages FOR UPDATE
USING (
  sender_id = auth_member_id()
  AND created_at > now() - interval '24 hours'
  AND deleted_at IS NULL
)
WITH CHECK (
  deleted_at IS NOT NULL
  AND deleted_by = auth.uid()
);

CREATE POLICY "thread_messages: admin soft delete"
ON communication_thread_messages FOR UPDATE
USING (
  auth_has_permission('communications.direct.moderate')
  AND EXISTS (
    SELECT 1 FROM communication_threads ct
    WHERE ct.id = thread_id
    AND   ct.assembly_id = auth_assembly_id()
  )
);

-- communication_attachments
CREATE POLICY "attachments: assembly scoped read"
ON communication_attachments FOR SELECT
USING (
  assembly_id = auth_assembly_id()
  AND deleted_at IS NULL
  AND (
    is_sensitive = false
    OR auth_has_permission('communications.attachments.view_pastoral')
  )
);

CREATE POLICY "attachments: pastor upload audio"
ON communication_attachments FOR INSERT
WITH CHECK (
  assembly_id = auth_assembly_id()
  AND mime_type LIKE 'audio/%'
  AND auth_has_permission('communications.audio.broadcast')
  AND uploaded_by = auth.uid()
);

CREATE POLICY "attachments: members upload non-audio"
ON communication_attachments FOR INSERT
WITH CHECK (
  assembly_id = auth_assembly_id()
  AND mime_type NOT LIKE 'audio/%'
  AND is_sensitive = false
  AND uploaded_by = auth.uid()
);

CREATE POLICY "attachments: uploader or admin soft delete"
ON communication_attachments FOR UPDATE
USING (
  assembly_id = auth_assembly_id()
  AND deleted_at IS NULL
  AND (
    uploaded_by = auth.uid()
    OR auth_has_permission('communications.attachments.manage')
  )
);

-- announcement_posts
CREATE POLICY "announcements: members read active"
ON announcement_posts FOR SELECT
USING (
  assembly_id = auth_assembly_id()
  AND deleted_at IS NULL
  AND visible_from <= now()
  AND (visible_until IS NULL OR visible_until > now())
  AND (
    target_group_ids = '{}'
    OR EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.member_id = auth_member_id()
      AND   gm.group_id = ANY(target_group_ids)
      AND   gm.is_active = true
    )
  )
);

CREATE POLICY "announcements: managers insert"
ON announcement_posts FOR INSERT
WITH CHECK (
  assembly_id = auth_assembly_id()
  AND auth_has_permission('communications.announcements.manage')
);

CREATE POLICY "announcements: managers update"
ON announcement_posts FOR UPDATE
USING (
  assembly_id = auth_assembly_id()
  AND auth_has_permission('communications.announcements.manage')
  AND deleted_at IS NULL
);

-- communication_preferences
CREATE POLICY "preferences: members read own"
ON communication_preferences FOR SELECT
USING (member_id = auth_member_id());

CREATE POLICY "preferences: members insert own"
ON communication_preferences FOR INSERT
WITH CHECK (
  member_id = auth_member_id()
  AND assembly_id = auth_assembly_id()
);

CREATE POLICY "preferences: members update own"
ON communication_preferences FOR UPDATE
USING (member_id = auth_member_id())
WITH CHECK (member_id = auth_member_id());

-- push_device_tokens
CREATE POLICY "push_tokens: members read own"
ON push_device_tokens FOR SELECT
USING (member_id = auth_member_id());

CREATE POLICY "push_tokens: members insert own"
ON push_device_tokens FOR INSERT
WITH CHECK (
  member_id = auth_member_id()
  AND assembly_id = auth_assembly_id()
);

CREATE POLICY "push_tokens: members update own"
ON push_device_tokens FOR UPDATE
USING (member_id = auth_member_id())
WITH CHECK (member_id = auth_member_id());

CREATE POLICY "push_tokens: members delete own"
ON push_device_tokens FOR DELETE
USING (member_id = auth_member_id());

-- storage_signed_url_log
CREATE POLICY "signed_url_log: admins read"
ON storage_signed_url_log FOR SELECT
USING (
  auth_has_permission('communications.reports.view')
  AND EXISTS (
    SELECT 1 FROM communication_attachments ca
    WHERE ca.id = attachment_id
    AND   ca.assembly_id = auth_assembly_id()
  )
);

CREATE POLICY "signed_url_log: members read own"
ON storage_signed_url_log FOR SELECT
USING (requested_by = auth.uid());

-- assembly_storage_usage
CREATE POLICY "storage_usage: admins read"
ON assembly_storage_usage FOR SELECT
USING (
  assembly_id = auth_assembly_id()
  AND auth_has_permission('communications.reports.view')
);

-- communication_trigger_rules
CREATE POLICY "trigger_rules: admins read"
ON communication_trigger_rules FOR SELECT
USING (
  assembly_id = auth_assembly_id()
  AND auth_has_permission('communications.templates.manage')
);

CREATE POLICY "trigger_rules: admins insert"
ON communication_trigger_rules FOR INSERT
WITH CHECK (
  assembly_id = auth_assembly_id()
  AND auth_has_permission('communications.templates.manage')
);

CREATE POLICY "trigger_rules: admins update"
ON communication_trigger_rules FOR UPDATE
USING (
  assembly_id = auth_assembly_id()
  AND auth_has_permission('communications.templates.manage')
);

-- webhook_events: only service role (Edge Functions)
-- no end-user policies

---
-- PART 4: Storage usage increment function
---

CREATE OR REPLACE FUNCTION increment_storage_usage(
  p_assembly_id uuid,
  p_bytes       int8
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_month date := date_trunc('month', now())::date;
BEGIN
  INSERT INTO assembly_storage_usage (assembly_id, snapshot_month, supabase_bytes)
  VALUES (p_assembly_id, v_month, p_bytes)
  ON CONFLICT (assembly_id, snapshot_month)
  DO UPDATE SET supabase_bytes = assembly_storage_usage.supabase_bytes + p_bytes;
END;
$$;

---
-- PART 5: Seed new permission keys
---

INSERT INTO system_permissions
  (id, key, label, module_name, category, is_assignable, is_active, description)
VALUES
  (gen_random_uuid(), 'communications.broadcast.send',          'Send Broadcasts',            'communications', 'messaging',    true, true, 'Create and send broadcast campaigns'),
  (gen_random_uuid(), 'communications.broadcast.schedule',      'Schedule Broadcasts',        'communications', 'messaging',    true, true, 'Schedule broadcast campaigns for future delivery'),
  (gen_random_uuid(), 'communications.direct.send',             'Send Direct Messages',       'communications', 'messaging',    true, true, 'Send direct messages to members'),
  (gen_random_uuid(), 'communications.direct.send_pastoral',    'Send Pastoral Messages',     'communications', 'pastoral',     true, true, 'Create pastoral threads and sensitive direct messages'),
  (gen_random_uuid(), 'communications.direct.moderate',         'Moderate Threads',           'communications', 'moderation',   true, true, 'Delete any message in any thread'),
  (gen_random_uuid(), 'communications.audio.broadcast',         'Send Audio Broadcasts',      'communications', 'media',        true, true, 'Upload and broadcast audio messages (pastor only)'),
  (gen_random_uuid(), 'communications.announcements.manage',    'Manage Announcements',       'communications', 'content',      true, true, 'Post, edit and pin assembly announcements'),
  (gen_random_uuid(), 'communications.templates.manage',        'Manage Templates',           'communications', 'admin',        true, true, 'Create and edit message templates and trigger rules'),
  (gen_random_uuid(), 'communications.attachments.view_pastoral','View Pastoral Attachments', 'communications', 'pastoral',     true, true, 'Access media in pastoral and sensitive threads'),
  (gen_random_uuid(), 'communications.attachments.manage',      'Manage Attachments',         'communications', 'admin',        true, true, 'Delete any attachment in the assembly'),
  (gen_random_uuid(), 'communications.reports.view',            'View Comms Reports',         'communications', 'reporting',    true, true, 'View delivery stats, signed URL logs, storage usage')
ON CONFLICT (key) DO NOTHING;
