import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { NotificationDTO } from "@/lib/types";

export const runtime = "nodejs";

function toDTO(n: any): NotificationDTO {
  return {
    id: n.id,
    memberId: n.memberId,
    broadcastId: n.broadcastId,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}

// GET /api/notifications?[memberId=...][&unreadOnly=true]
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId") || session.memberId;
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  if (!memberId) return NextResponse.json({ notifications: [] });

  // Authorisation: admin can read any; members only their own
  if (session.role !== "admin" && memberId !== session.memberId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where: any = { memberId };
  if (unreadOnly) where.isRead = false;

  const notifications = await db.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ notifications: notifications.map(toDTO) });
}

// PATCH /api/notifications — body: { id, isRead } or { allForMember: memberId, isRead: true }
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, allForMember, isRead } = body;

  if (allForMember) {
    if (session.role !== "admin" && allForMember !== session.memberId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await db.notification.updateMany({
      where: { memberId: allForMember, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const notif = await db.notification.findUnique({ where: { id } });
  if (!notif) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.role !== "admin" && notif.memberId !== session.memberId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.notification.update({ where: { id }, data: { isRead } });
  return NextResponse.json({ notification: toDTO(updated) });
}
