-- Fix communication module INSERT RLS policies to allow admin bypass
--
-- Problem: Admin user has role = 'admin' in user_profiles but assembly_role_id = null,
--          so auth_has_permission() always returns false for them.
--          The INSERT policies require specific permissions, blocking admin from creating
--          campaigns, templates, and announcements.
--
-- Solution: Add `public.is_admin()` (OR) bypass to all communication INSERT/UPDATE policies
--           so that users with role = 'admin' in user_profiles are always permitted.

---
-- communication_campaigns
---

DROP POLICY IF EXISTS "campaigns: senders insert" ON communication_campaigns;
CREATE POLICY "campaigns: senders insert"
ON communication_campaigns FOR INSERT
WITH CHECK (
  assembly_id = auth_assembly_id()
  AND (
    public.is_admin()
    OR auth_has_permission('communications.broadcast.send')
  )
);

DROP POLICY IF EXISTS "campaigns: senders update own or admin any" ON communication_campaigns;
CREATE POLICY "campaigns: senders update own or admin any"
ON communication_campaigns FOR UPDATE
USING (
  assembly_id = auth_assembly_id()
  AND deleted_at IS NULL
  AND (
    public.is_admin()
    OR created_by = auth.uid()
    OR auth_has_permission('communications.broadcast.schedule')
  )
);

---
-- communication_templates
---

DROP POLICY IF EXISTS "templates: managers insert" ON communication_templates;
CREATE POLICY "templates: managers insert"
ON communication_templates FOR INSERT
WITH CHECK (
  assembly_id = auth_assembly_id()
  AND (
    public.is_admin()
    OR auth_has_permission('communications.templates.manage')
  )
);

DROP POLICY IF EXISTS "templates: managers update" ON communication_templates;
CREATE POLICY "templates: managers update"
ON communication_templates FOR UPDATE
USING (
  assembly_id = auth_assembly_id()
  AND (
    public.is_admin()
    OR auth_has_permission('communications.templates.manage')
  )
);

DROP POLICY IF EXISTS "templates: managers soft delete" ON communication_templates;
CREATE POLICY "templates: managers soft delete"
ON communication_templates FOR UPDATE
USING (
  assembly_id = auth_assembly_id()
  AND (
    public.is_admin()
    OR auth_has_permission('communications.templates.manage')
  )
);

---
-- announcement_posts
---

DROP POLICY IF EXISTS "announcements: managers insert" ON announcement_posts;
CREATE POLICY "announcements: managers insert"
ON announcement_posts FOR INSERT
WITH CHECK (
  assembly_id = auth_assembly_id()
  AND (
    public.is_admin()
    OR auth_has_permission('communications.announcements.manage')
  )
);

DROP POLICY IF EXISTS "announcements: managers update" ON announcement_posts;
CREATE POLICY "announcements: managers update"
ON announcement_posts FOR UPDATE
USING (
  assembly_id = auth_assembly_id()
  AND deleted_at IS NULL
  AND (
    public.is_admin()
    OR auth_has_permission('communications.announcements.manage')
  )
);

---
-- communication_trigger_rules
---

DROP POLICY IF EXISTS "trigger_rules: admins insert" ON communication_trigger_rules;
CREATE POLICY "trigger_rules: admins insert"
ON communication_trigger_rules FOR INSERT
WITH CHECK (
  assembly_id = auth_assembly_id()
  AND (
    public.is_admin()
    OR auth_has_permission('communications.templates.manage')
  )
);

DROP POLICY IF EXISTS "trigger_rules: admins update" ON communication_trigger_rules;
CREATE POLICY "trigger_rules: admins update"
ON communication_trigger_rules FOR UPDATE
USING (
  assembly_id = auth_assembly_id()
  AND (
    public.is_admin()
    OR auth_has_permission('communications.templates.manage')
  )
);
