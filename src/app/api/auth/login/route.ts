import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, setSession, verifyPassword } from "@/lib/auth";
import { normalizeGhanaPhone } from "@/lib/phone";
import type { SessionUser } from "@/lib/types";

export const runtime = "nodejs";

// POST /api/auth/login
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, password } = body as { phone?: string; password?: string };

    if (!phone || !password) {
      return NextResponse.json(
        { error: "Phone number and password are required." },
        { status: 400 },
      );
    }

    const normalized = normalizeGhanaPhone(phone);
    if (!normalized) {
      return NextResponse.json(
        { error: "Please enter a valid Ghana phone number (e.g. 024 XXX XXXX)." },
        { status: 400 },
      );
    }

    const profile = await db.userProfile.findUnique({
      where: { phone: normalized },
    });

    if (!profile || !verifyPassword(password, profile.passwordHash)) {
      return NextResponse.json(
        { error: "Incorrect phone number or password." },
        { status: 401 },
      );
    }

    if (!profile.isActive) {
      return NextResponse.json(
        { error: "Account suspended. Please contact your assembly administrator." },
        { status: 403 },
      );
    }

    let memberId: string | undefined = undefined;
    if (profile.role === "member") {
      const member = await db.member.findFirst({
        where: { authUserId: profile.id, deletedAt: null },
        select: { id: true },
      });
      memberId = member?.id;
    }

    const session: SessionUser = {
      id: profile.id,
      role: profile.role as "admin" | "member",
      fullName: profile.fullName,
      isActive: profile.isActive,
      mustChangePassword: profile.mustChangePassword,
      phone: profile.phone,
      memberId,
    };

    await setSession(session);

    return NextResponse.json({
      ok: true,
      user: session,
      redirect:
        session.role === "admin" ? "/admin/dashboard" : "/member/inbox",
    });
  } catch (err) {
    console.error("[auth/login] error", err);
    return NextResponse.json(
      { error: "Network error. Please try again." },
      { status: 500 },
    );
  }
}
