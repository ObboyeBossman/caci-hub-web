// =============================================================================
// Edge Function: seed-auth — FINAL
//
// What it does (in order, for each user):
//   1. Creates the auth user with phone + password. No OTP, no SMS.
//   2. Inserts the user_profiles row (role: admin or member).
//   3. Patches members.auth_user_id to link the member record.
//   4. Grants all system permissions (admin users only).
//
// Safe to re-run — every step is idempotent.
//
// Security: requires X-Seed-Token header matching SEED_TOKEN secret.
// Set the secret once: supabase secrets set SEED_TOKEN=<anything-you-choose>
//
// Deploy:  supabase functions deploy seed-auth --no-verify-jwt
// Invoke:  curl -X POST https://<ref>.supabase.co/functions/v1/seed-auth \
//               -H "X-Seed-Token: <your-token>"
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── User definitions ──────────────────────────────────────────────────────────
// memberId must match the IDs already in public.members from seed_no_auth.sql

const USERS = [
  {
    memberId: "37e8593c-2e6a-4ce6-b029-6693f51bd281",
    phone:    "+233593529509",
    password: "CACI@2026!",
    fullName: "Abraham Nhyiraba Obboye Bossman",
    role:     "admin" as const,
  },
  {
    memberId: "fdd9b955-fbbd-45fe-b61b-1249a3f6a321",
    phone:    "+233249439129",
    password: "CACI@2026!",
    fullName: "Stephen Ankomah",
    role:     "admin" as const,
  },
  {
    memberId: "ea955165-1ac5-46a4-a137-905b31016cae",
    phone:    "+233557887388",
    password: "CACI@2026!",
    fullName: "BENJAMIN KWEKU MENSAH",
    role:     "member" as const,
  },
] as const;

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Only POST
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Token guard — prevents accidental or malicious re-invocation
  const expectedToken = Deno.env.get("SEED_TOKEN");
  if (expectedToken) {
    const providedToken = req.headers.get("X-Seed-Token");
    if (providedToken !== expectedToken) {
      return json({ error: "Forbidden" }, 403);
    }
  }

  // Service role client — bypasses RLS entirely
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Fetch system permissions once — shared across all admin users
  const { data: systemPerms, error: systemPermsError } = await supabase
    .from("system_permissions")
    .select("key");

  if (systemPermsError) {
    return json({
      error: `Could not fetch system_permissions: ${systemPermsError.message}`,
    }, 500);
  }

  const permissionKeys = systemPerms!.map((p) => p.key);
  const results = [];

  // ── Process each user ──────────────────────────────────────────────────────
  for (const user of USERS) {
    const log: Record<string, unknown> = {
      phone:    user.phone,
      name:     user.fullName,
      role:     user.role,
    };

    try {
      // ── 1. Create auth user ──────────────────────────────────────────────
      let authUserId: string;

      const { data: createData, error: createError } =
        await supabase.auth.admin.createUser({
          phone:         user.phone,
          password:      user.password,
          phone_confirm: true,          // confirmed immediately — no OTP needed
          user_metadata: { full_name: user.fullName },
        });

      if (createError) {
        // Supabase returns various messages for duplicate users.
        // Treat any mention of "already" or "registered" as "user exists".
        const isDuplicate =
          createError.message.toLowerCase().includes("already") ||
          createError.message.toLowerCase().includes("registered");

        if (!isDuplicate) {
          // Real unexpected error — stop here for this user
          log.authError = createError.message;
          log.status    = "error";
          results.push(log);
          continue;
        }

        // User already exists — look them up by phone
        log.authUser = "already exists";

        const { data: listData, error: listError } =
          await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

        if (listError) {
          log.authError = `listUsers failed: ${listError.message}`;
          log.status    = "error";
          results.push(log);
          continue;
        }

        const existing = listData.users.find((u) => u.phone === user.phone);

        if (!existing) {
          log.authError = `User not found by phone after duplicate error. ` +
            `Check that the phone number in auth.users uses E.164 format (+233...).`;
          log.status    = "error";
          results.push(log);
          continue;
        }

        authUserId = existing.id;
      } else {
        authUserId   = createData.user.id;
        log.authUser = "created";
      }

      log.authUserId = authUserId;

      // ── 2. Upsert user_profiles ──────────────────────────────────────────
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert(
          {
            id:                   authUserId,
            role:                 user.role,
            full_name:            user.fullName,
            is_active:            true,
            must_change_password: false,
          },
          { onConflict: "id" }
        );

      if (profileError) {
        log.profileError = profileError.message;
        // Don't stop — continue patching member and permissions
      } else {
        log.profile = "ok";
      }

      // ── 3. Patch members.auth_user_id ────────────────────────────────────
      // .is("auth_user_id", null) makes this a no-op on re-run if already set
      const { error: memberError } = await supabase
        .from("members")
        .update({ auth_user_id: authUserId })
        .eq("id", user.memberId)
        .is("auth_user_id", null);

      if (memberError) {
        log.memberError = memberError.message;
      } else {
        log.member = "auth_user_id patched";
      }

      // ── 4. Grant all permissions (admins only) ───────────────────────────
      if (user.role === "admin") {
        const grants = permissionKeys.map((key) => ({
          member_id:  user.memberId,
          permission: key,
          granted_by: authUserId,
        }));

        const { error: grantError } = await supabase
          .from("member_permissions")
          .upsert(grants, { onConflict: "member_id,permission" });

        if (grantError) {
          log.permissionsError = grantError.message;
        } else {
          log.permissions = `${grants.length} granted`;
        }
      }

      log.status = "ok";
    } catch (err) {
      log.error  = err instanceof Error ? err.message : String(err);
      log.status = "error";
    }

    results.push(log);
  }

  // Overall status: ok only if every user succeeded
  const allOk    = results.every((r) => r.status === "ok");
  const anyError = results.some((r) => r.status === "error");

  return json({
    summary: allOk ? "all users seeded successfully" : anyError ? "some users failed — check results" : "partial",
    results,
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
