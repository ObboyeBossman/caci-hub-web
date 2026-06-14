-- Fix: add is_admin() bypass to audio attachment upload policy
-- Previously admins could not insert unless they had the specific JWT permission.

DROP POLICY IF EXISTS "attachments: pastor upload audio"      ON public.communication_attachments;
DROP POLICY IF EXISTS "attachments: members upload non-audio" ON public.communication_attachments;

-- Audio uploads: admins always allowed; others need the explicit JWT permission
CREATE POLICY "attachments: pastor upload audio" ON public.communication_attachments FOR INSERT
  WITH CHECK (
    assembly_id = public.auth_assembly_id()
    AND mime_type LIKE 'audio/%'
    AND (public.is_admin() OR public.auth_has_permission('communications.audio.broadcast'))
    AND uploaded_by = auth.uid()
  );

-- Non-audio uploads: admins always allowed; regular members for non-sensitive files
CREATE POLICY "attachments: members upload non-audio" ON public.communication_attachments FOR INSERT
  WITH CHECK (
    assembly_id = public.auth_assembly_id()
    AND mime_type NOT LIKE 'audio/%'
    AND (public.is_admin() OR (is_sensitive = false AND uploaded_by = auth.uid()))
  );
