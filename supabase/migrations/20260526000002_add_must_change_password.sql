ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.must_change_password IS
  'True when account was provisioned with a default or custom password.
   Forces a non-dismissable password change screen on first login.
   Cleared to false after the member sets their own password.';
