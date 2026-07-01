-- =============================================================================
-- CACI Hub — Media Attachments Support
-- Extends the communication module to accept video, image, document and other
-- media types for campaigns and thread messages.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. communication_campaigns
--    Add attachment_id FK + widen channel constraint to include video/document
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.communication_campaigns
  ADD COLUMN IF NOT EXISTS attachment_id uuid REFERENCES public.communication_attachments(id);

ALTER TABLE public.communication_campaigns
  DROP CONSTRAINT IF EXISTS communication_campaigns_channel_check;

ALTER TABLE public.communication_campaigns
  ADD CONSTRAINT communication_campaigns_channel_check
  CHECK (channel IN ('in_app','email','sms','whatsapp','push','audio','video','document'));


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. communication_thread_messages
--    Add 'video' to message_type constraint
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.communication_thread_messages
  DROP CONSTRAINT IF EXISTS communication_thread_messages_message_type_check;

ALTER TABLE public.communication_thread_messages
  ADD CONSTRAINT communication_thread_messages_message_type_check
  CHECK (message_type IN ('text','audio','image','video','document'));


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. communication_attachments
--    Add media_category classification column
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.communication_attachments
  ADD COLUMN IF NOT EXISTS media_category text NOT NULL DEFAULT 'other'
    CHECK (media_category IN ('audio','video','image','document','other'));

-- Back-fill existing rows based on mime_type
UPDATE public.communication_attachments SET media_category =
  CASE
    WHEN mime_type LIKE 'audio/%'       THEN 'audio'
    WHEN mime_type LIKE 'video/%'       THEN 'video'
    WHEN mime_type LIKE 'image/%'       THEN 'image'
    WHEN mime_type IN (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv'
    )                                   THEN 'document'
    ELSE 'other'
  END
WHERE media_category = 'other';

-- Index for fast filtering by category
CREATE INDEX IF NOT EXISTS idx_comm_attachments_media_category
  ON public.communication_attachments(media_category, assembly_id)
  WHERE deleted_at IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS — Widen upload policies on communication_attachments
--    Replace the two narrow INSERT policies with broader permission-based ones
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "attachments: pastor upload audio"      ON public.communication_attachments;
DROP POLICY IF EXISTS "attachments: members upload non-audio" ON public.communication_attachments;

-- Admins / anyone with broadcast.send can upload any media type for campaigns
CREATE POLICY "attachments: broadcast managers upload"
  ON public.communication_attachments
  FOR INSERT
  WITH CHECK (
    assembly_id  = public.auth_assembly_id()
    AND uploaded_by = auth.uid()
    AND (public.is_admin() OR public.auth_has_permission('communications.broadcast.send'))
  );

-- Members can upload non-sensitive media into thread messages (images, docs, etc.)
CREATE POLICY "attachments: members upload thread media"
  ON public.communication_attachments
  FOR INSERT
  WITH CHECK (
    assembly_id       = public.auth_assembly_id()
    AND uploaded_by      = auth.uid()
    AND is_sensitive     = false
    AND thread_message_id IS NOT NULL
    AND campaign_id      IS NULL
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Storage bucket — campaigns-media-private
--    Separate bucket for campaign uploads (audio, video, image, document)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaigns-media-private',
  'campaigns-media-private',
  false,
  524288000,   -- 500 MB
  ARRAY[
    'audio/*',
    'video/*',
    'image/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage object RLS for the new bucket
CREATE POLICY "campaigns_media_private_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaigns-media-private');

CREATE POLICY "campaigns_media_private_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'campaigns-media-private');

CREATE POLICY "campaigns_media_private_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'campaigns-media-private');

CREATE POLICY "campaigns_media_private_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'campaigns-media-private');
