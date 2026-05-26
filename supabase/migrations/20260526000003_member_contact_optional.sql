ALTER TABLE public.members
  ALTER COLUMN phone_number DROP NOT NULL,
  ALTER COLUMN email        DROP NOT NULL;

ALTER TABLE public.members
  ADD CONSTRAINT chk_members_contact_required
  CHECK (
    phone_number IS NOT NULL
    OR email IS NOT NULL
  );

COMMENT ON CONSTRAINT chk_members_contact_required ON public.members IS
  'At least one of phone_number or email must be provided.
   Enforced here and mirrored in the CreateMemberSchema Zod schema.';
