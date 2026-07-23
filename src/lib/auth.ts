// ============================================================
// CACI HUB — Auth Helpers (server-side)
// Session stored in httpOnly cookie 'caci_session'.
// Plain demo-only password hashing (NOT for production).
// ============================================================

import { cookies } from "next/headers";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "caci_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** Demo-only hash. Replace with bcrypt/argon2 in production. */
export function hashPassword(pw: string): string {
  // simple salted hash via node crypto
  return createHash("sha256")
    .update("caci_salt_" + pw)
    .digest("hex");
}

export function verifyPassword(pw: string, hash: string): boolean {
  return hashPassword(pw) === hash;
}

/** Encode session payload as base64 JSON. */
function encodeSession(payload: SessionUser): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
}

function decodeSession(raw: string): SessionUser | null {
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

export async function setSession(payload: SessionUser): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Read & validate the session against the DB. Returns null if invalid/inactive. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const payload = decodeSession(raw);
  if (!payload) return null;

  // Validate against DB
  const profile = await db.userProfile.findUnique({
    where: { id: payload.id },
  });
  if (!profile || !profile.isActive) return null;

  const refreshed: SessionUser = {
    id: profile.id,
    role: profile.role as "admin" | "member",
    fullName: profile.fullName,
    isActive: profile.isActive,
    mustChangePassword: profile.mustChangePassword,
    phone: profile.phone,
    memberId: payload.memberId,
  };

  return refreshed;
}

/** Require a session; throws redirect-friendly null otherwise. */
export async function requireSession(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) {
    throw new Error("UNAUTHORIZED");
  }
  return s;
}

export async function requireAdmin(): Promise<SessionUser> {
  const s = await requireSession();
  if (s.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  return s;
}
