import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { normalizeGhanaPhone } from "@/lib/phone";
import type { DashboardStatsDTO } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/dashboard
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // For members, return minimal personal stats
  if (session.role === "member" && session.memberId) {
    const [unread, myGroups, myBroadcasts] = await Promise.all([
      db.notification.count({ where: { memberId: session.memberId, isRead: false } }),
      db.groupMember.count({ where: { memberId: session.memberId } }),
      db.broadcast.count(),
    ]);
    return NextResponse.json({
      stats: {
        totalMembers: 0,
        activeMembers: 0,
        visitorCount: 0,
        inactiveCount: 0,
        totalGroups: myGroups,
        activeGroups: myGroups,
        totalBroadcasts: myBroadcasts,
        broadcastsThisWeek: 0,
        totalSermons: 0,
        unreadNotifications: unread,
        memberGrowth: [],
        statusBreakdown: [],
        recentMembers: [],
        recentBroadcasts: [],
      } as DashboardStatsDTO,
    });
  }

  // Admin dashboard
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [
    totalMembers,
    activeMembers,
    visitorCount,
    inactiveCount,
    totalGroups,
    activeGroups,
    totalBroadcasts,
    broadcastsThisWeek,
    totalSermons,
    recentMembersRaw,
    recentBroadcastsRaw,
  ] = await Promise.all([
    db.member.count({ where: { deletedAt: null } }),
    db.member.count({ where: { deletedAt: null, membershipStatus: "active" } }),
    db.member.count({ where: { deletedAt: null, membershipStatus: "visitor" } }),
    db.member.count({ where: { deletedAt: null, membershipStatus: "inactive" } }),
    db.group.count(),
    db.group.count({ where: { isActive: true } }),
    db.broadcast.count(),
    db.broadcast.count({ where: { sentAt: { gte: oneWeekAgo } } }),
    db.sermon.count(),
    db.member.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { groups: true },
    }),
    db.broadcast.findMany({
      orderBy: { sentAt: "desc" },
      take: 5,
      include: { sentBy: true, targetGroup: true },
    }),
  ]);

  // Last 6 months growth
  const now = new Date();
  const months: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const count = await db.member.count({
      where: { createdAt: { gte: start, lt: end } },
    });
    months.push({
      label: start.toLocaleDateString("en-GB", { month: "short" }),
      value: count,
    });
  }

  const stats: DashboardStatsDTO = {
    totalMembers,
    activeMembers,
    visitorCount,
    inactiveCount,
    totalGroups,
    activeGroups,
    totalBroadcasts,
    broadcastsThisWeek,
    totalSermons,
    unreadNotifications: 0,
    memberGrowth: months,
    statusBreakdown: [
      { label: "Active", value: activeMembers, color: "#1a7f37" },
      { label: "Visitors", value: visitorCount, color: "#9a6700" },
      { label: "Inactive", value: inactiveCount, color: "#6e7681" },
    ],
    recentMembers: recentMembersRaw.map((m) => ({
      id: m.id,
      membershipNumber: m.membershipNumber,
      title: m.title,
      fullName: m.fullName,
      dateOfBirth: m.dateOfBirth?.toISOString() ?? null,
      gender: m.gender as any,
      maritalStatus: m.maritalStatus as any,
      occupation: m.occupation,
      location: m.location,
      phoneNumber: m.phoneNumber,
      whatsappNumber: m.whatsappNumber,
      membershipStatus: m.membershipStatus as any,
      assemblyRole: m.assemblyRole,
      joinDate: m.joinDate?.toISOString() ?? null,
      profilePhotoUrl: m.profilePhotoUrl,
      emergencyContactName: m.emergencyContactName,
      emergencyContactPhone: m.emergencyContactPhone,
      emergencyContactRelationship: m.emergencyContactRelationship,
      isActive: m.isActive,
      deletedAt: m.deletedAt?.toISOString() ?? null,
      authUserId: m.authUserId,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      groupCount: m.groups.length,
    })),
    recentBroadcasts: recentBroadcastsRaw.map((b) => ({
      id: b.id,
      sentById: b.sentById,
      sentByName: b.sentBy?.fullName ?? null,
      title: b.title,
      body: b.body,
      targetGroupId: b.targetGroupId,
      targetGroupName: b.targetGroup?.name ?? null,
      targetingMode: b.targetingMode as any,
      attachmentUrl: b.attachmentUrl,
      sentAt: b.sentAt.toISOString(),
    })),
  };

  return NextResponse.json({ stats });
}

// POST /api/dashboard?sub=provision (admin) — provision a member account
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { fullName, phone, role, linkedMemberId, password } = body;

  if (!fullName?.trim() || !phone) {
    return NextResponse.json({ error: "Full name and phone are required." }, { status: 400 });
  }
  const normalized = normalizeGhanaPhone(phone);
  if (!normalized) return NextResponse.json({ error: "Invalid Ghana phone." }, { status: 400 });

  const existing = await db.userProfile.findUnique({ where: { phone: normalized } });
  if (existing) return NextResponse.json({ error: "A user with this phone already exists." }, { status: 400 });

  const settings = await db.assemblySetting.findFirst();
  const defaultPw = password || settings?.defaultPassword || "CACI@2026!";
  const forceReset = settings?.forcePasswordReset ?? true;

  const profile = await db.userProfile.create({
    data: {
      role: role || "member",
      fullName: fullName.trim(),
      phone: normalized,
      passwordHash: hashPassword(defaultPw),
      isActive: true,
      mustChangePassword: forceReset,
    },
  });

  // Link to member if provided
  if (linkedMemberId && role === "member") {
    await db.member.update({
      where: { id: linkedMemberId },
      data: { authUserId: profile.id },
    });
  }

  return NextResponse.json({
    user: {
      id: profile.id,
      role: profile.role,
      fullName: profile.fullName,
      isActive: profile.isActive,
      mustChangePassword: profile.mustChangePassword,
      phone: profile.phone,
      createdAt: profile.createdAt.toISOString(),
      linkedMemberId: linkedMemberId || null,
    },
    defaultPassword: defaultPw,
  }, { status: 201 });
}

// GET /api/accounts (handled here too for listing)
export async function LIST_ACCOUNTS() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;

  const users = await db.userProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: { members: { select: { id: true, fullName: true } } },
  });

  return users.map((u) => ({
    id: u.id,
    role: u.role,
    fullName: u.fullName,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    phone: u.phone,
    createdAt: u.createdAt.toISOString(),
    linkedMemberId: u.members[0]?.id ?? null,
    linkedMemberName: u.members[0]?.fullName ?? null,
  }));
}
