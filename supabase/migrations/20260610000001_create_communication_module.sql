-- Communication module schema
-- Adds templates, campaigns, and messages tables for multi-channel outreach.

CREATE TABLE communication_templates (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id            uuid NOT NULL REFERENCES assemblies(id),
  title                  text NOT NULL,
  body                   text NOT NULL,
  channel                text NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'whatsapp', 'push')),
  category               text NOT NULL CHECK (category IN ('broadcast', 'direct', 'automated', 'announcement')),
  variables              jsonb DEFAULT '[]',
  whatsapp_template_name text,
  is_active              bool DEFAULT true,
  created_by             uuid REFERENCES user_profiles(id),
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  deleted_at             timestamptz,
  deleted_by             uuid REFERENCES user_profiles(id)
);

CREATE TABLE communication_campaigns (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id           uuid NOT NULL REFERENCES assemblies(id),
  template_id           uuid REFERENCES communication_templates(id),
  title                 text NOT NULL,
  channel               text NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'whatsapp', 'push')),
  audience_type         text NOT NULL CHECK (audience_type IN ('assembly', 'group', 'member_list', 'filter')),
  audience_ids          uuid[] DEFAULT '{}',
  trigger_type          text NOT NULL DEFAULT 'manual'
                          CHECK (trigger_type IN ('manual', 'birthday', 'event_reminder', 'pledge_reminder', 'custom')),
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_at          timestamptz,
  sent_at               timestamptz,
  total_recipients      int4 DEFAULT 0,
  created_by            uuid REFERENCES user_profiles(id),
  created_at            timestamptz DEFAULT now(),
  deleted_at            timestamptz,
  deleted_by            uuid REFERENCES user_profiles(id)
);

CREATE TABLE communication_messages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           uuid REFERENCES communication_campaigns(id),
  assembly_id           uuid NOT NULL REFERENCES assemblies(id),
  member_id             uuid NOT NULL REFERENCES members(id),
  channel               text NOT NULL,
  body_resolved         text NOT NULL,
  status                text NOT NULL DEFAULT 'queued'
                          CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  provider              text CHECK (provider IN ('sendgrid', 'twilio', 'arkesel', 'fcm', 'internal')),
  external_ref          text,
  provider_status       text,
  failed_reason         text,
  cost_units            int4 DEFAULT 0,
  delivered_at          timestamptz,
  read_at               timestamptz,
  created_at            timestamptz DEFAULT now(),
  deleted_at            timestamptz
);

CREATE TABLE communication_threads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id           uuid NOT NULL REFERENCES assemblies(id),
  subject               text,
  is_pastoral           bool DEFAULT false,
  is_sensitive          bool DEFAULT false,
  created_by            uuid REFERENCES user_profiles(id),
  created_at            timestamptz DEFAULT now(),
  deleted_at            timestamptz,
  deleted_by            uuid REFERENCES user_profiles(id)
);

CREATE TABLE communication_thread_participants (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id             uuid NOT NULL REFERENCES communication_threads(id),
  member_id             uuid NOT NULL REFERENCES members(id),
  role                  text DEFAULT 'member' CHECK (role IN ('member','pastor','admin')),
  joined_at             timestamptz DEFAULT now(),
  left_at               timestamptz,
  last_read_at          timestamptz,
  UNIQUE(thread_id, member_id)
);

CREATE TABLE communication_thread_messages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id             uuid NOT NULL REFERENCES communication_threads(id),
  sender_id             uuid NOT NULL REFERENCES members(id),
  message_type          text NOT NULL DEFAULT 'text'
                          CHECK (message_type IN ('text','audio','image','document')),
  body                  text,
  storage_tier          text DEFAULT 'hot'
                          CHECK (storage_tier IN ('hot','warm','cold')),
  created_at            timestamptz DEFAULT now(),
  edited_at             timestamptz,
  deleted_at            timestamptz,
  deleted_by            uuid REFERENCES user_profiles(id)
);

CREATE TABLE communication_attachments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id           uuid NOT NULL REFERENCES assemblies(id),
  thread_message_id     uuid REFERENCES communication_thread_messages(id),
  campaign_id           uuid REFERENCES communication_campaigns(id),

  -- Storage location
  storage_tier          text NOT NULL DEFAULT 'hot'
                          CHECK (storage_tier IN ('hot','warm','cold')),
  storage_provider      text NOT NULL DEFAULT 'supabase'
                          CHECK (storage_provider IN ('supabase','r2')),
  storage_bucket        text NOT NULL,
  storage_path          text NOT NULL,
  public_url            text,

  -- File metadata
  mime_type             text NOT NULL,
  file_size_bytes       int8 NOT NULL,
  original_filename     text,
  checksum              text,

  -- Audio specific
  duration_seconds      int4,
  waveform_data         jsonb,
  normalised_path       text,
  transcription_text    text,
  transcription_status  text DEFAULT 'skipped'
                          CHECK (transcription_status IN ('pending','processing','done','failed','skipped')),

  -- Security
  is_sensitive          bool DEFAULT false,
  virus_scan_status     text DEFAULT 'pending'
                          CHECK (virus_scan_status IN ('pending','clean','infected','skipped')),

  -- Lifecycle
  uploaded_by           uuid REFERENCES user_profiles(id),
  archive_after         timestamptz,
  purge_after           timestamptz,
  archived_at           timestamptz,
  created_at            timestamptz DEFAULT now(),
  deleted_at            timestamptz,
  deleted_by            uuid REFERENCES user_profiles(id)
);


CREATE TABLE announcement_posts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id           uuid NOT NULL REFERENCES assemblies(id),
  title                 text NOT NULL,
  body                  text NOT NULL,
  target_group_ids      uuid[] DEFAULT '{}',
  is_pinned             bool DEFAULT false,
  visible_from          timestamptz DEFAULT now(),
  visible_until         timestamptz,
  posted_by             uuid REFERENCES user_profiles(id),
  created_at            timestamptz DEFAULT now(),
  deleted_at            timestamptz,
  deleted_by            uuid REFERENCES user_profiles(id)
);

CREATE TABLE communication_trigger_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id           uuid NOT NULL REFERENCES assemblies(id),
  trigger_event         text NOT NULL
                          CHECK (trigger_event IN (
                            'member.birthday','service.reminder',
                            'pledge.overdue','member.join_anniversary'
                          )),
  template_id           uuid NOT NULL REFERENCES communication_templates(id),
  channels              text[] NOT NULL,
  days_offset           int4 DEFAULT 0,
  offset_direction      text DEFAULT 'before' CHECK (offset_direction IN ('before','after')),
  is_active             bool DEFAULT true,
  created_by            uuid REFERENCES user_profiles(id),
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE communication_preferences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id             uuid NOT NULL REFERENCES members(id),
  assembly_id           uuid NOT NULL REFERENCES assemblies(id),
  channel               text NOT NULL,
  category              text NOT NULL,
  opted_in              bool DEFAULT true,
  updated_at            timestamptz DEFAULT now(),
  UNIQUE(member_id, channel, category)
);

CREATE TABLE push_device_tokens (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id             uuid NOT NULL REFERENCES members(id),
  assembly_id           uuid NOT NULL REFERENCES assemblies(id),
  device_token          text NOT NULL,
  platform              text NOT NULL CHECK (platform IN ('ios','android','web')),
  is_active             bool DEFAULT true,
  last_used_at          timestamptz,
  created_at            timestamptz DEFAULT now(),
  UNIQUE(member_id, device_token)
);

CREATE TABLE webhook_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider              text NOT NULL,
  event_type            text NOT NULL,
  payload               jsonb NOT NULL,
  message_id            uuid REFERENCES communication_messages(id),
  processed_at          timestamptz,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE storage_signed_url_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id         uuid NOT NULL REFERENCES communication_attachments(id),
  requested_by          uuid NOT NULL REFERENCES user_profiles(id),
  ip_address            text,
  expires_at            timestamptz NOT NULL,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE assembly_storage_usage (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id           uuid NOT NULL REFERENCES assemblies(id),
  snapshot_month        date NOT NULL,
  supabase_bytes        int8 DEFAULT 0,
  r2_warm_bytes         int8 DEFAULT 0,
  r2_cold_bytes         int8 DEFAULT 0,
  total_bytes           int8 GENERATED ALWAYS AS (supabase_bytes + r2_warm_bytes + r2_cold_bytes) STORED,
  sms_segments_sent     int4 DEFAULT 0,
  whatsapp_msgs_sent    int4 DEFAULT 0,
  created_at            timestamptz DEFAULT now(),
  UNIQUE(assembly_id, snapshot_month)
);

CREATE INDEX idx_comm_messages_campaign   ON communication_messages(campaign_id);
CREATE INDEX idx_comm_messages_member     ON communication_messages(member_id);
CREATE INDEX idx_comm_messages_status     ON communication_messages(status);
CREATE INDEX idx_comm_attachments_tier    ON communication_attachments(storage_tier, storage_provider);
CREATE INDEX idx_comm_attachments_archive ON communication_attachments(archive_after)
  WHERE archived_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_thread_messages_thread   ON communication_thread_messages(thread_id, created_at);
CREATE INDEX idx_webhook_events_msg       ON webhook_events(message_id);
CREATE INDEX idx_push_tokens_member       ON push_device_tokens(member_id) WHERE is_active = true;
