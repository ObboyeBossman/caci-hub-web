import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { BroadcastDTO, NotificationDTO } from "@/lib/types";

export const runtime = "nodejs";

function toDTO(b: any): BroadcastDTO {
  return {
    id: b.id,
    sentById: b.sentById,
    sentByName: b.sentBy?.fullName ?? null,
    title: b.title,
    body: b.body,
    targetGroupId: b.targetGroupId,
    targetGroupName: b.targetGroup?.name ?? null,
    targetingMode: b.targetingMode,
    attachmentUrl: b.attachmentUrl,
    sentAt: b.sentAt.toISOString(),
    recipientCount: b.recipients?.length ?? 0,
  };
}

// GET /api/broadcasts?[id=...][&targetingMode=...][&memberId=...]
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const memberId = searchParams.get("memberId");

  if (id) {
    const b = await db.broadcast.findUnique({
      where: { id },
      include: { sentBy: true, targetGroup: true, recipients: true },
    });
    if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ broadcast: toDTO(b) });
  }

  const where: any = {};

  // For members: filter to broadcasts they should see (assembly-wide + their groups + targeted to them)
  if (session.role === "member" && memberId) {
    const memberGroups = await db.groupMember.findMany({
      where: { memberId },
      select: { groupId: true },
    });
    const groupIds = memberGroups.map((g) => g.groupId);
    const targetedBroadcasts = await db.broadcastRecipient.findMany({
      where: { memberId },
      select: { broadcastId: true },
    });
    const targetedIds = targetedBroadcasts.map((t) => t.broadcastId);

    where.OR = [
      { targetingMode: "assembly" },
      ...(groupIds.length ? [{ targetingMode: "group", targetGroupId: { in: groupIds } }] : []),
      ...(targetedIds.length ? [{ id: { in: targetedIds } }] : []),
    ];
  }

  const broadcasts = await db.broadcast.findMany({
    where,
    include: { sentBy: true, targetGroup: true, recipients: true },
    orderBy: { sentAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ broadcasts: broadcasts.map(toDTO) });
}

// POST /api/broadcasts (admin only)
// body: { title, body, targetingMode, targetGroupId?, attachmentUrl?, notifyMemberIds?: string[] }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, body: text, targetingMode, targetGroupId, attachmentUrl, notifyMemberIds } = body;

  if (!title?.trim() || !text?.trim()) {
    return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  }
  if (targetingMode === "group" && !targetGroupId) {
    return NextResponse.json({ error: "targetGroupId required for group targeting." }, { status: 400 });
  }
  if (targetingMode === "members" && (!notifyMemberIds || notifyMemberIds.length === 0)) {
    return NextResponse.json({ error: "At least one recipient is required for member targeting." }, { status: 400 });
  }

  const broadcast = await db.broadcast.create({
    data: {
      sentById: session.id,
      title: title.trim(),
      body: text.trim(),
      targetingMode,
      targetGroupId: targetingMode === "group" ? targetGroupId : null,
      attachmentUrl: attachmentUrl || null,
    },
    include: { sentBy: true, targetGroup: true, recipients: true },
  });

  // Determine recipients & create notifications
  let recipients: { id: string }[] = [];
  if (targetingMode === "assembly") {
    recipients = await db.member.findMany({
      where: { deletedAt: null, isActive: true, membershipStatus: "active" },
      select: { id: true },
    });
  } else if (targetingMode === "group") {
    const groupMembers = await db.groupMember.findMany({
      where: { groupId: targetGroupId },
      include: { member: true },
    });
    recipients = groupMembers
      .filter((gm) => gm.member.deletedAt === null && gm.member.isActive)
      .map((gm) => ({ id: gm.member.id }));
  } else if (targetingMode === "members") {
    recipients = notifyMemberIds.map((id: string) => ({ id }));
    // Also persist broadcast_recipients
    await db.broadcastRecipient.createMany({
      data: notifyMemberIds.map((memberId: string) => ({ broadcastId: broadcast.id, memberId })),
    });
  }

  // Create notifications for all recipients
  if (recipients.length > 0) {
    await db.notification.createMany({
      data: recipients.map((r) => ({
        memberId: r.id,
        broadcastId: broadcast.id,
        title: broadcast.title,
        body: broadcast.body.slice(0, 180),
      })),
    });
  }

  return NextResponse.json({ broadcast: toDTO(broadcast), recipientCount: recipients.length }, { status: 201 });
}
