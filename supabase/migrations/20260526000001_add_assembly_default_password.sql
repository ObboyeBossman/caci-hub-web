ALTER TABLE public.assemblies
  ADD COLUMN IF NOT EXISTS default_member_password text;

COMMENT ON COLUMN public.assemblies.default_member_password IS
  'Assembly-level temporary password for members with no email.
   Set once by admin via the set-assembly-default-password Edge Function.
   NULL means not yet configured. Never stored per-member.';
