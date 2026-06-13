-- =============================================================================
-- CACI Hub — Squashed Migration 10: Communication Module
-- Final state of all communication tables, RLS policies, and storage tables.
-- Incorporates: 20260610000001, 20260610000002, 20260612000001,
--               20260612000002 (admin bypass on INSERT/UPDATE policies)
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.communication_templates (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id            uuid        NOT NULL REFERENCES public.assemblies(id),
  title                  text        NOT NULL,
  body                   text        NOT NULL,
  channel                text        NOT NULL CHECK (channel IN ('in_app','email','sms','whatsapp','push')),
  category               text        NOT NULL CHECK (category IN ('broadcast','direct','automated','announcement')),
  variables              jsonb       DEFAULT '[]',
  whatsapp_template_name text,
  is_active              boolean     DEFAULT true,
  created_by             uuid        REFERENCES public.user_profiles(id),
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  deleted_at             timestamptz,
  deleted_by             uuid        REFERENCES public.user_profiles(id)
);

CREATE TABLE public.communication_campaigns (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id      uuid        NOT NULL REFERENCES public.assemblies(id),
  template_id      uuid        REFERENCES public.communication_templates(id),
  title            text        NOT NULL,
  channel          text        NOT NULL CHECK (channel IN ('in_app','email','sms','whatsapp','push')),
  audience_type    text        NOT NULL CHECK (audience_type IN ('assembly','group','member_list','filter')),
  audience_ids     uuid[]      DEFAULT '{}',
  trigger_type     text        NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual','birthday','event_reminder','pledge_reminder','custom')),
  status           text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed','cancelled')),
  scheduled_at     timestamptz,
  sent_at          timestamptz,
  total_recipients int4        DEFAULT 0,
  created_by       uuid        REFERENCES public.user_profiles(id),
  created_at       timestamptz DEFAULT now(),
  deleted_at       timestamptz,
  deleted_by       uuid        REFERENCES public.user_profiles(id)
);

CREATE TABLE public.communication_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid        REFERENCES public.communication_campaigns(id),
  assembly_id     uuid        NOT NULL REFERENCES public.assemblies(id),
  member_id       uuid        NOT NULL REFERENCES public.members(id),
  channel         text        NOT NULL,
  body_resolved   text        NOT NULL,
  status          text        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','read','failed')),
  provider        text        CHECK (provider IN ('sendgrid','twilio','arkesel','fcm','internal')),
  external_ref    text,
  provider_status text,
  failed_reason   text,
  cost_units      int4        DEFAULT 0,
  delivered_at    timestamptz,
  read_at         timestamptz,
  created_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz
);

CREATE TABLE public.communication_threads (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id  uuid        NOT NULL REFERENCES public.assemblies(id),
  subject      text,
  is_pastoral  boolean     DEFAULT false,
  is_sensitive boolean     DEFAULT false,
  created_by   uuid        REFERENCES public.user_profiles(id),
  created_at   timestamptz DEFAULT now(),
  deleted_at   timestamptz,
  deleted_by   uuid        REFERENCES public.user_profiles(id)
);

CREATE TABLE public.communication_thread_participants (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id    uuid        NOT NULL REFERENCES public.communication_threads(id),
  member_id    uuid        NOT NULL REFERENCES public.members(id),
  role         text        DEFAULT 'member' CHECK (role IN ('member','pastor','admin')),
  joined_at    timestamptz DEFAULT now(),
  left_at      timestamptz,
  last_read_at timestamptz,
  UNIQUE(thread_id, member_id)
);

CREATE TABLE public.communication_thread_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id    uuid        NOT NULL REFERENCES public.communication_threads(id),
  sender_id    uuid        NOT NULL REFERENCES public.members(id),
  message_type text        NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','audio','image','document')),
  body         text,
  storage_tier text        DEFAULT 'hot' CHECK (storage_tier IN ('hot','warm','cold')),
  created_at   timestamptz DEFAULT now(),
  edited_at    timestamptz,
  deleted_at   timestamptz,
  deleted_by   uuid        REFERENCES public.user_profiles(id)
);

CREATE TABLE public.communication_attachments (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id          uuid        NOT NULL REFERENCES public.assemblies(id),
  thread_message_id    uuid        REFERENCES public.communication_thread_messages(id),
  campaign_id          uuid        REFERENCES public.communication_campaigns(id),
  storage_tier         text        NOT NULL DEFAULT 'hot' CHECK (storage_tier IN ('hot','warm','cold')),
  storage_provider     text        NOT NULL DEFAULT 'supabase' CHECK (storage_provider IN ('supabase','r2')),
  storage_bucket       text        NOT NULL,
  storage_path         text        NOT NULL,
  public_url           text,
  mime_type            text        NOT NULL,
  file_size_bytes      int8        NOT NULL,
  original_filename    text,
  checksum             text,
  duration_seconds     int4,
  waveform_data        jsonb,
  normalised_path      text,
  transcription_text   text,
  transcription_status text        DEFAULT 'skipped' CHECK (transcription_status IN ('pending','processing','done','failed','skipped')),
  is_sensitive         boolean     DEFAULT false,
  virus_scan_status    text        DEFAULT 'pending' CHECK (virus_scan_status IN ('pending','clean','infected','skipped')),
  uploaded_by          uuid        REFERENCES public.user_profiles(id),
  archive_after        timestamptz,
  purge_after          timestamptz,
  archived_at          timestamptz,
  created_at           timestamptz DEFAULT now(),
  deleted_at           timestamptz,
  deleted_by           uuid        REFERENCES public.user_profiles(id)
);

CREATE TABLE public.announcement_posts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id      uuid        NOT NULL REFERENCES public.assemblies(id),
  title            text        NOT NULL,
  body             text        NOT NULL,
  target_group_ids uuid[]      DEFAULT '{}',
  is_pinned        boolean     DEFAULT false,
  visible_from     timestamptz DEFAULT now(),
  visible_until    timestamptz,
  posted_by        uuid        REFERENCES public.user_profiles(id),
  created_at       timestamptz DEFAULT now(),
  deleted_at       timestamptz,
  deleted_by       uuid        REFERENCES public.user_profiles(id)
);

CREATE TABLE public.communication_trigger_rules (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id      uuid        NOT NULL REFERENCES public.assemblies(id),
  trigger_event    text        NOT NULL CHECK (trigger_event IN ('member.birthday','service.reminder','pledge.overdue','member.join_anniversary')),
  template_id      uuid        NOT NULL REFERENCES public.communication_templates(id),
  channels         text[]      NOT NULL,
  days_offset      int4        DEFAULT 0,
  offset_direction text        DEFAULT 'before' CHECK (offset_direction IN ('before','after')),
  is_active        boolean     DEFAULT true,
  created_by       uuid        REFERENCES public.user_profiles(id),
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE public.communication_preferences (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid        NOT NULL REFERENCES public.members(id),
  assembly_id uuid        NOT NULL REFERENCES public.assemblies(id),
  channel     text        NOT NULL,
  category    text        NOT NULL,
  opted_in    boolean     DEFAULT true,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(member_id, channel, category)
);

CREATE TABLE public.push_device_tokens (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid        NOT NULL REFERENCES public.members(id),
  assembly_id  uuid        NOT NULL REFERENCES public.assemblies(id),
  device_token text        NOT NULL,
  platform     text        NOT NULL CHECK (platform IN ('ios','android','web')),
  is_active    boolean     DEFAULT true,
  last_used_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(member_id, device_token)
);

CREATE TABLE public.webhook_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     text        NOT NULL,
  event_type   text        NOT NULL,
  payload      jsonb       NOT NULL,
  message_id   uuid        REFERENCES public.communication_messages(id),
  processed_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE public.storage_signed_url_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id uuid        NOT NULL REFERENCES public.communication_attachments(id),
  requested_by  uuid        NOT NULL REFERENCES public.user_profiles(id),
  ip_address    text,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE public.assembly_storage_usage (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id      uuid        NOT NULL REFERENCES public.assemblies(id),
  snapshot_month   date        NOT NULL,
  supabase_bytes   int8        DEFAULT 0,
  r2_warm_bytes    int8        DEFAULT 0,
  r2_cold_bytes    int8        DEFAULT 0,
  total_bytes      int8        GENERATED ALWAYS AS (supabase_bytes + r2_warm_bytes + r2_cold_bytes) STORED,
  sms_segments_sent int4       DEFAULT 0,
  whatsapp_msgs_sent int4      DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  UNIQUE(assembly_id, snapshot_month)
);

-- Indexes
CREATE INDEX idx_comm_messages_campaign   ON public.communication_messages(campaign_id);
CREATE INDEX idx_comm_messages_member     ON public.communication_messages(member_id);
CREATE INDEX idx_comm_messages_status     ON public.communication_messages(status);
CREATE INDEX idx_comm_attachments_tier    ON public.communication_attachments(storage_tier, storage_provider);
CREATE INDEX idx_comm_attachments_archive ON public.communication_attachments(archive_after) WHERE archived_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_thread_messages_thread   ON public.communication_thread_messages(thread_id, created_at);
CREATE INDEX idx_webhook_events_msg       ON public.webhook_events(message_id);
CREATE INDEX idx_push_tokens_member       ON public.push_device_tokens(member_id) WHERE is_active = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.communication_templates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_campaigns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_threads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_thread_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_attachments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_posts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_trigger_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_preferences         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_device_tokens                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_signed_url_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembly_storage_usage            ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- RLS Policies (with admin bypass from 20260612000002)
-- ─────────────────────────────────────────────────────────────────────────────

-- communication_templates
CREATE POLICY "templates: members read own assembly" ON public.communication_templates FOR SELECT
  USING (assembly_id = public.auth_assembly_id() AND is_active = true AND deleted_at IS NULL);
CREATE POLICY "templates: managers insert" ON public.communication_templates FOR INSERT
  WITH CHECK (assembly_id = public.auth_assembly_id() AND (public.is_admin() OR public.auth_has_permission('communications.templates.manage')));
CREATE POLICY "templates: managers update" ON public.communication_templates FOR UPDATE
  USING (assembly_id = public.auth_assembly_id() AND (public.is_admin() OR public.auth_has_permission('communications.templates.manage')));

-- communication_campaigns
CREATE POLICY "campaigns: members read own assembly" ON public.communication_campaigns FOR SELECT
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL);
CREATE POLICY "campaigns: senders insert" ON public.communication_campaigns FOR INSERT
  WITH CHECK (assembly_id = public.auth_assembly_id() AND (public.is_admin() OR public.auth_has_permission('communications.broadcast.send')));
CREATE POLICY "campaigns: senders update own or admin any" ON public.communication_campaigns FOR UPDATE
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL
    AND (public.is_admin() OR created_by = auth.uid() OR public.auth_has_permission('communications.broadcast.schedule')));

-- communication_messages
CREATE POLICY "messages: members read own" ON public.communication_messages FOR SELECT
  USING (assembly_id = public.auth_assembly_id() AND member_id = public.auth_member_id() AND deleted_at IS NULL);
CREATE POLICY "messages: reporters read assembly" ON public.communication_messages FOR SELECT
  USING (assembly_id = public.auth_assembly_id() AND public.auth_has_permission('communications.reports.view') AND deleted_at IS NULL);

-- communication_threads (non-recursive — uses SECURITY DEFINER helper)
CREATE POLICY "threads: participants read" ON public.communication_threads FOR SELECT
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL AND public.auth_is_thread_participant(id));
CREATE POLICY "threads: pastoral restricted" ON public.communication_threads FOR SELECT
  USING (
    assembly_id = public.auth_assembly_id() AND deleted_at IS NULL
    AND (is_sensitive = false OR public.auth_has_permission('communications.attachments.view_pastoral'))
    AND public.auth_is_thread_participant(id)
  );
CREATE POLICY "threads: members insert non-pastoral" ON public.communication_threads FOR INSERT
  WITH CHECK (assembly_id = public.auth_assembly_id() AND is_pastoral = false AND is_sensitive = false);
CREATE POLICY "threads: pastoral role insert sensitive" ON public.communication_threads FOR INSERT
  WITH CHECK (assembly_id = public.auth_assembly_id() AND public.auth_has_permission('communications.direct.send_pastoral'));

-- communication_thread_participants (non-recursive — uses SECURITY DEFINER helper)
CREATE POLICY "thread_participants: read own threads" ON public.communication_thread_participants FOR SELECT
  USING (public.auth_is_participant_of_thread(thread_id));
CREATE POLICY "thread_participants: thread creator insert" ON public.communication_thread_participants FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.communication_threads ct
            WHERE ct.id = thread_id AND ct.assembly_id = public.auth_assembly_id()
              AND ct.created_by = auth.uid() AND ct.deleted_at IS NULL)
  );
CREATE POLICY "thread_participants: update own read timestamp" ON public.communication_thread_participants FOR UPDATE
  USING (member_id = public.auth_member_id()) WITH CHECK (member_id = public.auth_member_id());

-- communication_thread_messages
CREATE POLICY "thread_messages: participants read" ON public.communication_thread_messages FOR SELECT
  USING (deleted_at IS NULL AND EXISTS (SELECT 1 FROM public.communication_thread_participants ctp WHERE ctp.thread_id = thread_id AND ctp.member_id = public.auth_member_id() AND ctp.left_at IS NULL));
CREATE POLICY "thread_messages: participants insert text" ON public.communication_thread_messages FOR INSERT
  WITH CHECK (message_type = 'text' AND sender_id = public.auth_member_id()
    AND EXISTS (SELECT 1 FROM public.communication_thread_participants ctp WHERE ctp.thread_id = thread_id AND ctp.member_id = public.auth_member_id() AND ctp.left_at IS NULL));
CREATE POLICY "thread_messages: pastor insert audio" ON public.communication_thread_messages FOR INSERT
  WITH CHECK (message_type = 'audio' AND sender_id = public.auth_member_id() AND public.auth_has_permission('communications.audio.broadcast')
    AND EXISTS (SELECT 1 FROM public.communication_thread_participants ctp WHERE ctp.thread_id = thread_id AND ctp.member_id = public.auth_member_id() AND ctp.left_at IS NULL));
CREATE POLICY "thread_messages: sender soft delete within 24h" ON public.communication_thread_messages FOR UPDATE
  USING (sender_id = public.auth_member_id() AND created_at > now() - interval '24 hours' AND deleted_at IS NULL)
  WITH CHECK (deleted_at IS NOT NULL AND deleted_by = auth.uid());
CREATE POLICY "thread_messages: admin soft delete" ON public.communication_thread_messages FOR UPDATE
  USING (public.auth_has_permission('communications.direct.moderate')
    AND EXISTS (SELECT 1 FROM public.communication_threads ct WHERE ct.id = thread_id AND ct.assembly_id = public.auth_assembly_id()));

-- communication_attachments
CREATE POLICY "attachments: assembly scoped read" ON public.communication_attachments FOR SELECT
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL
    AND (is_sensitive = false OR public.auth_has_permission('communications.attachments.view_pastoral')));
CREATE POLICY "attachments: pastor upload audio" ON public.communication_attachments FOR INSERT
  WITH CHECK (assembly_id = public.auth_assembly_id() AND mime_type LIKE 'audio/%' AND public.auth_has_permission('communications.audio.broadcast') AND uploaded_by = auth.uid());
CREATE POLICY "attachments: members upload non-audio" ON public.communication_attachments FOR INSERT
  WITH CHECK (assembly_id = public.auth_assembly_id() AND mime_type NOT LIKE 'audio/%' AND is_sensitive = false AND uploaded_by = auth.uid());
CREATE POLICY "attachments: uploader or admin soft delete" ON public.communication_attachments FOR UPDATE
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL
    AND (uploaded_by = auth.uid() OR public.auth_has_permission('communications.attachments.manage')));

-- announcement_posts
CREATE POLICY "announcements: members read active" ON public.announcement_posts FOR SELECT
  USING (
    assembly_id = public.auth_assembly_id() AND deleted_at IS NULL
    AND visible_from <= now() AND (visible_until IS NULL OR visible_until > now())
    AND (target_group_ids = '{}' OR EXISTS (
      SELECT 1 FROM public.group_members gm WHERE gm.member_id = public.auth_member_id() AND gm.group_id = ANY(target_group_ids) AND gm.is_active = true))
  );
CREATE POLICY "announcements: managers insert" ON public.announcement_posts FOR INSERT
  WITH CHECK (assembly_id = public.auth_assembly_id() AND (public.is_admin() OR public.auth_has_permission('communications.announcements.manage')));
CREATE POLICY "announcements: managers update" ON public.announcement_posts FOR UPDATE
  USING (assembly_id = public.auth_assembly_id() AND deleted_at IS NULL AND (public.is_admin() OR public.auth_has_permission('communications.announcements.manage')));

-- communication_preferences
CREATE POLICY "preferences: members read own" ON public.communication_preferences FOR SELECT USING (member_id = public.auth_member_id());
CREATE POLICY "preferences: members insert own" ON public.communication_preferences FOR INSERT WITH CHECK (member_id = public.auth_member_id() AND assembly_id = public.auth_assembly_id());
CREATE POLICY "preferences: members update own" ON public.communication_preferences FOR UPDATE USING (member_id = public.auth_member_id()) WITH CHECK (member_id = public.auth_member_id());

-- push_device_tokens
CREATE POLICY "push_tokens: members read own"   ON public.push_device_tokens FOR SELECT USING (member_id = public.auth_member_id());
CREATE POLICY "push_tokens: members insert own" ON public.push_device_tokens FOR INSERT WITH CHECK (member_id = public.auth_member_id() AND assembly_id = public.auth_assembly_id());
CREATE POLICY "push_tokens: members update own" ON public.push_device_tokens FOR UPDATE USING (member_id = public.auth_member_id()) WITH CHECK (member_id = public.auth_member_id());
CREATE POLICY "push_tokens: members delete own" ON public.push_device_tokens FOR DELETE USING (member_id = public.auth_member_id());

-- storage_signed_url_log
CREATE POLICY "signed_url_log: admins read" ON public.storage_signed_url_log FOR SELECT
  USING (public.auth_has_permission('communications.reports.view')
    AND EXISTS (SELECT 1 FROM public.communication_attachments ca WHERE ca.id = attachment_id AND ca.assembly_id = public.auth_assembly_id()));
CREATE POLICY "signed_url_log: members read own" ON public.storage_signed_url_log FOR SELECT USING (requested_by = auth.uid());

-- assembly_storage_usage
CREATE POLICY "storage_usage: admins read" ON public.assembly_storage_usage FOR SELECT
  USING (assembly_id = public.auth_assembly_id() AND public.auth_has_permission('communications.reports.view'));

-- communication_trigger_rules (with admin bypass)
CREATE POLICY "trigger_rules: admins read" ON public.communication_trigger_rules FOR SELECT
  USING (assembly_id = public.auth_assembly_id() AND (public.is_admin() OR public.auth_has_permission('communications.templates.manage')));
CREATE POLICY "trigger_rules: admins insert" ON public.communication_trigger_rules FOR INSERT
  WITH CHECK (assembly_id = public.auth_assembly_id() AND (public.is_admin() OR public.auth_has_permission('communications.templates.manage')));
CREATE POLICY "trigger_rules: admins update" ON public.communication_trigger_rules FOR UPDATE
  USING (assembly_id = public.auth_assembly_id() AND (public.is_admin() OR public.auth_has_permission('communications.templates.manage')));
-- webhook_events: service role only — no end-user policies.
