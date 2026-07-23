import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { GroupDTO } from "@/lib/types";

export const runtime = "nodejs";

function toDTO(g: any): GroupDTO {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    leaderId: g.leaderId,
    leaderName: g.leader?.fullName ?? null,
    messagingMode: g.messagingMode,
    isActive: g.isActive,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    memberCount: g.members?.length ?? 0,
  };
}

// GET /api/groups?[id=...][&memberId=...][&includeInactive=true]
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const memberId = searchParams.get("memberId");
  const includeInactive = searchParams.get("includeInactive") === "true";

  if (id) {
    const group = await db.group.findUnique({
      where: { id },
      include: {
        leader: true,
        members: { include: { member: true } },
        messages: { include: { member: true }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      group: {
        ...toDTO(group),
        members: group.members.map((gm: any) => ({
          id: gm.member.id,
          fullName: gm.member.fullName,
          title: gm.member.title,
          assemblyRole: gm.member.assemblyRole,
          membershipStatus: gm.member.membershipStatus,
          phoneNumber: gm.member.phoneNumber,
          joinedAt: gm.joinedAt.toISOString(),
          isLeader: gm.memberId === group.leaderId,
        })),
        messages: group.messages.map((m: any) => ({
          id: m.id,
          groupId: m.groupId,
          memberId: m.memberId,
          memberName: m.member.fullName,
          memberTitle: m.member.title,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    });
  }

  const where: any = {};
  if (!includeInactive || session.role !== "admin") where.isActive = true;

  const groups = await db.group.findMany({
    where,
    include: { leader: true, members: true },
    orderBy: { name: "asc" },
  });

  let result = groups.map(toDTO);
  if (memberId) {
    const memberships = await db.groupMember.findMany({
      where: { memberId },
      select: { groupId: true },
    });
    const memberGroupIds = new Set(memberships.map((m) => m.groupId));
    result = result.map((g) => ({ ...g, isMember: memberGroupIds.has(g.id) }));
  }

  return NextResponse.json({ groups: result });
}

// POST /api/groups (admin)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, leaderId, messagingMode } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Group name is required." }, { status: 400 });

  const existing = await db.group.findUnique({ where: { name: name.trim() } });
  if (existing) return NextResponse.json({ error: "A group with this name already exists." }, { status: 400 });

  const group = await db.group.create({
    data: {
      name: name.trim(),
      description: description || null,
      leaderId: leaderId || null,
      messagingMode: messagingMode || "open",
      isActive: true,
      createdById: session.id,
    },
    include: { leader: true, members: true },
  });

  // Add leader as member automatically
  if (leaderId) {
    await db.groupMember.create({ data: { groupId: group.id, memberId: leaderId } }).catch(() => {});
  }

  return NextResponse.json({ group: toDTO(group) }, { status: 201 });
}

// PATCH /api/groups (admin) — body: { id, name?, description?, leaderId?, messagingMode?, isActive? }
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const data: any = {};
  for (const f of ["name", "description", "leaderId", "messagingMode", "isActive"]) {
    if (updates[f] !== undefined) data[f] = updates[f] === null ? null : updates[f];
  }

  const group = await db.group.update({
    where: { id },
    data,
    include: { leader: true, members: true },
  });

  return NextResponse.json({ group: toDTO(group) });
}

// DELETE /api/groups (admin) — sets isActive=false (archive)
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Archive, don't hard delete
  await db.group.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}

// ----- Group Members -----
// POST /api/groups?sub=join  body: { groupId, memberId }
// POST /api/groups?sub=leave body: { groupId, memberId }
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sub = searchParams.get("sub");
  const body = await req.json();
  const { groupId, memberId } = body;

  if (!groupId || !memberId) return NextResponse.json({ error: "groupId and memberId required" }, { status: 400 });

  if (sub === "leave") {
    await db.groupMember.deleteMany({ where: { groupId, memberId } });
    return NextResponse.json({ ok: true, action: "left" });
  }

  // join (admin only, or self for member)
  const isAdmin = session.role === "admin";
  if (!isAdmin && memberId !== session.memberId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.groupMember.create({ data: { groupId, memberId } }).catch(() => {});
  return NextResponse.json({ ok: true, action: "joined" });
}
