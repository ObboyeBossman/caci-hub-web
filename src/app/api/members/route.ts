import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { normalizeGhanaPhone } from "@/lib/phone";
import type { MemberDTO, MembershipStatus } from "@/lib/types";

export const runtime = "nodejs";

function toDTO(m: any): MemberDTO {
  return {
    id: m.id,
    membershipNumber: m.membershipNumber,
    title: m.title,
    fullName: m.fullName,
    dateOfBirth: m.dateOfBirth ? m.dateOfBirth.toISOString() : null,
    gender: m.gender,
    maritalStatus: m.maritalStatus,
    occupation: m.occupation,
    location: m.location,
    phoneNumber: m.phoneNumber,
    whatsappNumber: m.whatsappNumber,
    membershipStatus: m.membershipStatus as MembershipStatus,
    assemblyRole: m.assemblyRole,
    joinDate: m.joinDate ? m.joinDate.toISOString() : null,
    profilePhotoUrl: m.profilePhotoUrl,
    emergencyContactName: m.emergencyContactName,
    emergencyContactPhone: m.emergencyContactPhone,
    emergencyContactRelationship: m.emergencyContactRelationship,
    isActive: m.isActive,
    deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
    authUserId: m.authUserId,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    groupCount: m.groups?.length ?? 0,
    permissions: m.permissions?.map((p: any) => p.permission) ?? [],
  };
}

// GET /api/members?[q=...][&status=...][&id=...]
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const status = searchParams.get("status") || "";
  const id = searchParams.get("id");
  const includeDeleted = searchParams.get("includeDeleted") === "true";

  // Single member by id
  if (id) {
    const member = await db.member.findUnique({
      where: { id },
      include: { groups: true, permissions: true, authUser: true },
    });
    if (!member || (member.deletedAt && !includeDeleted)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ member: toDTO(member) });
  }

  // Members can only see active, non-deleted, and limited
  const where: any = {};
  if (!includeDeleted) where.deletedAt = null;
  if (status) where.membershipStatus = status;
  if (q) {
    where.OR = [
      { fullName: { contains: q } },
      { membershipNumber: { contains: q } },
      { phoneNumber: { contains: q } },
      { assemblyRole: { contains: q } },
      { occupation: { contains: q } },
    ];
  }

  const members = await db.member.findMany({
    where,
    include: { groups: true, permissions: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ members: members.map(toDTO) });
}

// POST /api/members (admin only)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    title, fullName, gender, maritalStatus, occupation, location,
    phoneNumber, whatsappNumber, membershipStatus, assemblyRole,
    dateOfBirth, joinDate, emergencyContactName, emergencyContactPhone,
    emergencyContactRelationship,
  } = body;

  if (!fullName?.trim()) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }

  // Generate membership number
  const counter = await db.memberCounter.upsert({
    where: { id: 1 },
    update: { lastNumber: { increment: 1 } },
    create: { id: 1, lastNumber: 1 },
  });
  const membershipNumber = `CACI/ASS/2026/${String(counter.lastNumber).padStart(3, "0")}`;

  // Normalise phone
  const normalizedPhone = phoneNumber ? normalizeGhanaPhone(phoneNumber) : null;
  const normalizedWhatsapp = whatsappNumber ? normalizeGhanaPhone(whatsappNumber) : normalizedPhone;

  const member = await db.member.create({
    data: {
      membershipNumber,
      title: title || null,
      fullName: fullName.trim(),
      gender: gender || null,
      maritalStatus: maritalStatus || null,
      occupation: occupation || null,
      location: location || null,
      phoneNumber: normalizedPhone,
      whatsappNumber: normalizedWhatsapp,
      membershipStatus: membershipStatus || "visitor",
      assemblyRole: assemblyRole || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      joinDate: joinDate ? new Date(joinDate) : new Date(),
      emergencyContactName: emergencyContactName || null,
      emergencyContactPhone: emergencyContactPhone ? normalizeGhanaPhone(emergencyContactPhone) : null,
      emergencyContactRelationship: emergencyContactRelationship || null,
      isActive: membershipStatus !== "inactive",
      createdById: session.id,
    },
    include: { groups: true, permissions: true },
  });

  // Audit log
  await db.memberAuditLog.create({
    data: {
      memberId: member.id,
      changedById: session.id,
      fieldChanged: "MEMBER_CREATED",
      oldValue: null,
      newValue: member.fullName,
    },
  });

  return NextResponse.json({ member: toDTO(member) }, { status: 201 });
}

// PATCH /api/members (admin only) — body includes { id, ...fields }
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "Member id is required." }, { status: 400 });

  const existing = await db.member.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Build update payload with normalisation
  const data: any = {};
  const trackedFields = [
    "title", "fullName", "gender", "maritalStatus", "occupation", "location",
    "membershipStatus", "assemblyRole", "emergencyContactName",
    "emergencyContactRelationship", "profilePhotoUrl",
  ];
  for (const f of trackedFields) {
    if (updates[f] !== undefined) data[f] = updates[f] || null;
  }
  if (updates.phoneNumber !== undefined) {
    data.phoneNumber = updates.phoneNumber ? normalizeGhanaPhone(updates.phoneNumber) : null;
  }
  if (updates.whatsappNumber !== undefined) {
    data.whatsappNumber = updates.whatsappNumber ? normalizeGhanaPhone(updates.whatsappNumber) : null;
  }
  if (updates.dateOfBirth !== undefined) {
    data.dateOfBirth = updates.dateOfBirth ? new Date(updates.dateOfBirth) : null;
  }
  if (updates.joinDate !== undefined) {
    data.joinDate = updates.joinDate ? new Date(updates.joinDate) : null;
  }
  if (updates.membershipStatus !== undefined) {
    data.isActive = updates.membershipStatus !== "inactive";
  }

  // Write audit entries for changed tracked fields
  const auditTracked = [
    "title", "fullName", "dateOfBirth", "gender", "maritalStatus", "occupation",
    "location", "phoneNumber", "whatsappNumber", "membershipStatus", "joinDate",
    "assemblyRole", "emergencyContactName", "emergencyContactPhone",
    "emergencyContactRelationship",
  ];

  const auditEntries: any[] = [];
  for (const f of auditTracked) {
    if (updates[f] === undefined) continue;
    const oldVal = (existing as any)[f];
    const newVal = data[f] ?? null;
    const oldStr = oldVal instanceof Date ? oldVal.toISOString() : (oldVal ?? null);
    const newStr = newVal instanceof Date ? newVal.toISOString() : (newVal ?? null);
    if (String(oldStr) !== String(newStr)) {
      auditEntries.push({
        memberId: id,
        changedById: session.id,
        fieldChanged: f,
        oldValue: oldStr ? String(oldStr) : null,
        newValue: newStr ? String(newStr) : null,
      });
    }
  }

  const updated = await db.member.update({
    where: { id },
    data,
    include: { groups: true, permissions: true },
  });

  if (auditEntries.length > 0) {
    await db.memberAuditLog.createMany({ data: auditEntries });
  }

  return NextResponse.json({ member: toDTO(updated) });
}

// DELETE /api/members (admin only) — soft delete
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const existing = await db.member.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Soft delete
  const updated = await db.member.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await db.memberAuditLog.create({
    data: {
      memberId: id,
      changedById: session.id,
      fieldChanged: "MEMBER_DELETED",
      oldValue: existing.fullName,
      newValue: null,
    },
  });

  return NextResponse.json({ ok: true, member: toDTO(updated) });
}
