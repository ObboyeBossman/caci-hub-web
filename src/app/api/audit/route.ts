import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/audit?[memberId=...][&limit=50]
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

  const where: any = {};
  if (memberId) where.memberId = memberId;

  const logs = await db.memberAuditLog.findMany({
    where,
    include: {
      member: { select: { fullName: true } },
      changedBy: { select: { fullName: true } },
    },
    orderBy: { changedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      memberId: l.memberId,
      memberName: l.member?.fullName ?? null,
      changedById: l.changedById,
      changedByName: l.changedBy?.fullName ?? null,
      fieldChanged: l.fieldChanged,
      oldValue: l.oldValue,
      newValue: l.newValue,
      changedAt: l.changedAt.toISOString(),
    })),
  });
}
