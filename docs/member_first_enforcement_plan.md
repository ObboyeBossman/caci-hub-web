# Member-first enforcement — implementation plan

> **Rule:** A user account (app login) may only be created for a person who
> already exists as a member record. The flow is always:
> Add member → Assign membership number → Provision login.

---

## Phase 1 — Database: seed the baseline admin member record

### 1.1 Re-run seed data
- Execute `20260428000001_seed_admin_data.sql` in the Supabase SQL editor.
- Restores the assembly row, admin member row (`8cf54258...`), and admin
  user_profile row (`deed0df7...`).

### 1.2 Backfill admin `auth_user_id`
- Link the admin member row to the auth account:
  ```sql
  UPDATE public.members
  SET auth_user_id = 'deed0df7-d6de-404a-853d-0428c4196c9a'
  WHERE id = '8cf54258-0050-423d-b9a3-7f344ead04df';
  ```
- Without this, the admin member appears unprovisioned and the
  `members_select_own_member_role` RLS policy cannot match via `auth_user_id = auth.uid()`.

### 1.3 Verify baseline integrity
- Run the three verification queries from `seed.sql`:
  ```sql
  SELECT name, assembly_code, address FROM public.assemblies;
  SELECT first_name, last_name, membership_number FROM public.members;
  SELECT full_name, role FROM public.user_profiles;
  ```
- Run the JOIN verification:
  ```sql
  SELECT
    m.id            AS member_id,
    m.first_name,
    m.last_name,
    m.auth_user_id,
    up.id           AS profile_id,
    up.role,
    up.is_active
  FROM public.members m
  JOIN public.user_profiles up ON up.id = m.auth_user_id
  WHERE m.id = '8cf54258-0050-423d-b9a3-7f344ead04df';
  ```
- Expected: one row, `role = admin`, `is_active = true`, `auth_user_id` non-null.

---

## Phase 2 — Flutter app: remove standalone "create user" route

### 2.1 Audit navigation routes
- Search the router and all nav menus for any route that reaches user
  provisioning without a `memberId` in scope.
- Any such route must be removed or hard-gated behind a member selection step.

### 2.2 Gate "Provision login" behind member detail
- The provision action is only reachable from an existing member's detail screen.
- `memberId` is a required parameter — the button must not render without it.
- No route in the app may call the `provision-user` Edge Function without a
  member having been selected first.

### 2.3 Conditionally show the "Provision login" button
- Show the button only when `member.hasLoginAccount == false`
  (i.e. `authUserId == null`).
- Once provisioned, replace the button with a read-only **Login active** badge.
- Role-gate: visible to `UserRole.admin` only.

```dart
if (currentUser.role == UserRole.admin && !member.hasLoginAccount)
  ProvisionLoginButton(memberId: member.id)
else if (member.hasLoginAccount)
  LoginActiveBadge()
```

### 2.4 Build the provision login bottom sheet / modal
- **Fields:**
  - Email — pre-filled from `member.email`; editable if null.
  - Password — minimum 8 characters (enforced by the Edge Function).
  - Role selector — shows only assignable roles
    (`admin`, `pastor`, `secretary`, `volunteer`, `member`).
- **On submit:** call `provisionUser(memberId, email, password, role)`.
- **On 409:** surface "This member already has a login account" — not a
  generic error.
- **On success:** patch the local member state — set `authUserId` to the
  returned `userId` so the button swaps to the badge without a manual refresh.

### 2.5 Confirm "Add member" is the only onboarding entry point
- The admin's primary onboarding action is the **Add member** FAB / button.
- The member form collects all biographical data first.
- Provisioning a login is a deliberate second step from the member's profile.
- There must be no shortcut that skips member creation.

---

## Phase 3 — Edge function: harden `provision-user` guards

### 3.1 Confirm membership number is NOT required to provision
- The Edge Function currently does not check for a `membership_number` before
  provisioning a login. This is intentional — number assignment is a
  separate step.
- Confirm this is still the desired policy.
- If a membership number should be required first, add an explicit guard:
  ```typescript
  if (!member.membership_number) {
    return new Response(
      JSON.stringify({ error: 'Member must have a membership number before provisioning a login.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  ```

### 3.2 Verify assembly-scoping on member lookup
- The function checks `member.assembly_id !== adminAssemblyId` and returns 403.
- Manually test a cross-assembly scenario before going live to confirm the
  guard fires correctly.
- Test case: admin from assembly A attempts to provision a member from assembly B.

---

## Phase 4 — Testing: end-to-end flow verification

### 4.1 Happy path — add member → provision login → sign in
1. Add a real member via the app form (admin role).
2. Assign a membership number from the member's detail screen.
3. Provision a login from the member's profile.
4. Sign in as that member.
5. Confirm `members_select_own_member_role` returns their row:
   `auth_user_id = auth.uid()` must match.

### 4.2 Duplicate provision attempt returns 409
- Attempt to provision a login for a member who already has `auth_user_id` set.
- Confirm the Edge Function returns HTTP 409.
- Confirm the app surfaces "This member already has a login account" — not a
  generic 500 or unknown error.

### 4.3 Provision button invisible after provisioning
- After a successful provision, the member detail screen must re-fetch
  the member record and show the **Login active** badge in place of the
  provision button.
- This must happen automatically — the user must not need to navigate away
  and back to see the updated state.
- Verify: `MemberDetailNotifier` patches local state with `authUserId` on
  successful provision response before dismissing the bottom sheet.

---

## Dependency order

```
1.1 Seed data
  └─ 1.2 Backfill auth_user_id
       └─ 1.3 Verify integrity
            └─ 2.x Flutter UI changes (can proceed in parallel)
                 └─ 3.x Edge function hardening
                      └─ 4.x End-to-end testing
```

---

## Files touched

| File | Change |
|---|---|
| SQL editor (manual) | Phases 1.1 – 1.3 |
| `provision-user/index.ts` | Phase 3.1 optional guard, 3.2 test |
| `member_detail_screen.dart` (or equivalent) | Phases 2.2, 2.3, 2.4 |
| `member_list_screen.dart` (or equivalent) | Phase 2.5 |
| `auth_router.dart` | Phase 2.1 route audit |
| `i_member_repository.dart` + `member_repository.dart` | Phase 2.4 `provisionUser` method if not yet present |
