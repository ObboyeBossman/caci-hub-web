# CACI Hub Security Review & Remediation Plan

## Overview

This review inspects the current CACI Hub web project and identifies key
security flaws, trust assumptions, and operational risks. The goal is to
establish a practical implementation base for fixing the project’s largest
loopholes.

## Major issues found

1. Client-side authorization is treated as enforcement.
   - `src/core/guards/permissionGuard.ts` and
     `src/core/authorization/authorization-service.ts` only protect routes in
     the browser.
   - These checks are useful for UX, but they do not prevent a user from calling
     Supabase directly with the anon key.

2. Assembly scoping is client-trusted.
   - `src/core/auth.ts` stores `assemblyId` in `_activeAssemblyId` and
     `localStorage`.
   - Many repositories rely on `getActiveAssemblyId()` for queries.
   - If the browser state is manipulated, it can lead to incorrect query filters
     unless server-side RLS fully enforces assembly boundaries.

3. Known RLS loophole in `members` access.
   - `supabase/migrations/20260427000013_create_rls_policies.sql` uses
     `members_select_own_member_role` with `created_by = auth.uid()`.
   - The migration comment explicitly notes this is a Phase 1 limitation and can
     allow member self-access to the wrong record if `created_by` is not the
     actual auth user ID.

4. Service role key handling is unsafe.
   - `verify.ts` derives `SUPABASE_SERVICE_ROLE_KEY` from the anon key:
     `process.env.VITE_SUPABASE_ANON_KEY?.replace('anon', 'service_role')`.
   - This pattern is insecure and brittle; service_role keys must be explicitly
     provided from a secure server-side environment.

5. Production deployment is brittle.
   - `package.json` has direct
     `supabase db push --project-ref cyjkjzcthbpkufbsyosz` scripts.
   - This encourages accidental prod pushes and relies on local CLI
     configuration.

6. Environment separation is weak.
   - `supabase/config.toml` is local-first and uses permissive defaults like
     `allowed_cidrs = ["0.0.0.0/0"]`.
   - There is no project-level enforcement shown for production-specific
     `site_url`, TLS, and auth redirect settings.

## Recommended remediation steps

### 1. Strengthen server-side security first

- Audit all Supabase RLS policies and helper functions.
- Ensure every sensitive table and RPC is protected by a policy based on
  `auth.uid()` and/or `get_user_assembly_id()`.
- Replace `members_select_own_member_role` with a policy that uses an actual
  member auth relation, such as `auth_user_id = auth.uid()`.
- Add explicit `WITH CHECK` conditions for inserts/updates when data includes
  `assembly_id`.

### 2. Stop trusting local assembly state

- Keep `getActiveAssemblyId()` in the UI only for display state, not for
  critical authorization decisions.
- Whenever possible, derive assembly context from the authenticated user’s
  profile on the server.
- Add validation in API queries or RLS that the requested assembly matches the
  authenticated user’s assembly.

### 3. Treat client authorization as UX only

- Keep route-level guards for user experience, but accept that they are not
  security boundaries.
- Do not rely on `user.permissions` in the browser as the only gate for mutation
  operations.
- Add server-side permission checks in Edge functions or database policies for
  critical actions.

### 4. Remove unsafe service-role handling

- Eliminate any client-side inference of service role keys.
- Use a proper server-only secret environment variable such as
  `SUPABASE_SERVICE_ROLE_KEY` in backend scripts.
- Restrict service-role operations to build-time tools, maintenance scripts, or
  backend-only code.

### 5. Harden deployment and migration workflow

- Replace direct prod CLI scripts with safer commands or CI jobs.
- Use explicit environment detection and confirmation before prod pushes.
- Add `supabase db diff` or `supabase migration list` checks before production
  deployment.

### 6. Harden environment config

- Create a production `.env.example` and avoid committing real project refs or
  keys.
- Set strict `site_url` and `additional_redirect_urls` for prod.
- Enable TLS and tighten `allowed_cidrs` for prod database connections.

## Practical implementation base

### Short-term fixes

- Update `verify.ts` to require `SUPABASE_SERVICE_ROLE_KEY` explicitly and fail
  if missing.
- Add a dedicated policy migration to fix member self-access using
  `auth_user_id` or a direct user relationship.
- Add a lint/check rule or `README` note that production deployments must use a
  separate CI workflow.

### Medium-term fixes

- Refactor repository code so assembly-specific queries use server-validated
  context rather than browser-local storage wherever possible.
- Introduce a server-side wrapper or edge function for permission-sensitive
  mutations.
- Add a `SECURITY_REVIEW.md` to document this remediation plan and track
  progress.

### Long-term architecture improvements

- Implement a full backend authorization layer instead of relying solely on
  Supabase anon client logic.
- Add automated security tests that exercise RLS and role-based access for
  production schemas.
- Use a staging environment for migration validation before pushing to prod.

## Next recommended tasks

1. Fix the `members_select_own_member_role` RLS policy.
2. Remove service-role inference from `verify.ts`.
3. Add production-safe deployment scripts and CI checks.
4. Audit all `assembly_id` query filters and tighten RLS enforcement.
5. Add documentation so future developers understand that UI guards are not
   security boundaries.

---

This document is a practical base for resolving the main gaps in the current
project. If you want, I can also turn this into concrete code changes for the
top 3 fixes.
