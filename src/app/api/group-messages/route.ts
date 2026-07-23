import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/group-messages?groupId=...
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  if (!groupId) return NextResponse.json({ error: "groupId is required" }, { status: 400 });

  const messages = await db.groupMessage.findMany({
    where: { groupId },
    include: { member: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      groupId: m.groupId,
      memberId: m.memberId,
      memberName: m.member.fullName,
      memberTitle: m.member.title,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      isOwn: m.member.authUserId === session.id,
    })),
  });
}

// POST /api/group-messages
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.memberId) return NextResponse.json({ error: "No linked member profile." }, { status: 400 });

  const body = await req.json();
  const { groupId, content } = body;
  if (!groupId || !content?.trim()) {
    return NextResponse.json({ error: "groupId and content are required." }, { status: 400 });
  }

  // Check group exists, member is part of it, and messaging permissions
  const group = await db.group.findUnique({ where: { id: groupId } });
  if (!group || !group.isActive) {
    return NextResponse.json({ error: "Group not found or archived." }, { status: 404 });
  }

  const membership = await db.groupMember.findUnique({
    where: { groupId_memberId: { groupId, memberId: session.memberId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "You are not a member of this group." }, { status: 403 });
  }

  // In restricted mode, only leader or admin can post
  if (group.messagingMode === "restricted" && session.role !== "admin" && group.leaderId !== session.memberId) {
    return NextResponse.json({ error: "This group is restricted. Only the leader can post." }, { status: 403 });
  }

  const msg = await db.groupMessage.create({
    data: { groupId, memberId: session.memberId, content: content.trim() },
    include: { member: true },
  });

  return NextResponse.json({
    message: {
      id: msg.id,
      groupId: msg.groupId,
      memberId: msg.memberId,
      memberName: msg.member.fullName,
      memberTitle: msg.member.title,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
      isOwn: true,
    },
  }, { status: 201 });
}

// DELETE /api/group-messages?id=... (admin or sender)
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const msg = await db.groupMessage.findUnique({ where: { id } });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = msg.memberId === session.memberId;
  if (session.role !== "admin" && !member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.groupMessage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
