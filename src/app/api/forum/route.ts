import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/forum
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messages = await db.forumMessage.findMany({
    include: { member: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      memberId: m.memberId,
      memberName: m.member.fullName,
      memberTitle: m.member.title,
      memberRole: m.member.assemblyRole,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      isOwn: m.member.authUserId === session.id,
    })),
  });
}

// POST /api/forum
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.memberId) return NextResponse.json({ error: "No linked member profile." }, { status: 400 });

  const body = await req.json();
  const { content } = body;
  if (!content?.trim()) return NextResponse.json({ error: "Content is required." }, { status: 400 });

  // Check member is active & not deleted
  const member = await db.member.findUnique({ where: { id: session.memberId } });
  if (!member || member.deletedAt || !member.isActive) {
    return NextResponse.json({ error: "Member not permitted to post." }, { status: 403 });
  }

  const msg = await db.forumMessage.create({
    data: { memberId: session.memberId, content: content.trim() },
    include: { member: true },
  });

  return NextResponse.json({
    message: {
      id: msg.id,
      memberId: msg.memberId,
      memberName: msg.member.fullName,
      memberTitle: msg.member.title,
      memberRole: msg.member.assemblyRole,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
      isOwn: true,
    },
  }, { status: 201 });
}

// DELETE /api/forum?id=... (admin only)
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  await db.forumMessage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
