import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";
import { normalizeGhanaPhone } from "@/lib/phone";

export const runtime = "nodejs";

// GET /api/accounts
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await db.userProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: { members: { select: { id: true, fullName: true } } },
  });

  return NextResponse.json({
    accounts: users.map((u) => ({
      id: u.id,
      role: u.role,
      fullName: u.fullName,
      isActive: u.isActive,
      mustChangePassword: u.mustChangePassword,
      phone: u.phone,
      createdAt: u.createdAt.toISOString(),
      linkedMemberId: u.members[0]?.id ?? null,
      linkedMemberName: u.members[0]?.fullName ?? null,
    })),
  });
}

// PATCH /api/accounts — body: { id, isActive?, mustChangePassword?, resetPassword?, role? }
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, isActive, mustChangePassword, resetPassword, role } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const data: any = {};
  if (isActive !== undefined) data.isActive = isActive;
  if (mustChangePassword !== undefined) data.mustChangePassword = mustChangePassword;
  if (role !== undefined) data.role = role;

  if (resetPassword) {
    const settings = await db.assemblySetting.findFirst();
    const newPw = settings?.defaultPassword || "CACI@2026!";
    data.passwordHash = hashPassword(newPw);
    data.mustChangePassword = true;
  }

  const user = await db.userProfile.update({ where: { id }, data });

  return NextResponse.json({
    account: {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      phone: user.phone,
      createdAt: user.createdAt.toISOString(),
    },
    resetTo: resetPassword ? (await db.assemblySetting.findFirst())?.defaultPassword || "CACI@2026!" : null,
  });
}

// DELETE /api/accounts?id=... — suspends (sets isActive=false)
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  if (id === session.id) {
    return NextResponse.json({ error: "You cannot suspend your own account." }, { status: 400 });
  }

  await db.userProfile.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
