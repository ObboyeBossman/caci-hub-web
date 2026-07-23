// Standalone seed runner — execute with: bun run scripts/seed.ts
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { createHash } from "crypto";

async function main() {
  const permissions = [
    { key: "members.read", label: "View Members", description: "View member directory", module: "members", sortOrder: 1 },
    { key: "members.write", label: "Manage Members", description: "Create, edit, soft-delete members", module: "members", sortOrder: 2 },
    { key: "groups.read", label: "View Groups", description: "View groups and group membership", module: "groups", sortOrder: 3 },
    { key: "groups.write", label: "Manage Groups", description: "Create and edit groups", module: "groups", sortOrder: 4 },
    { key: "broadcasts.read", label: "View Broadcasts", description: "View assembly broadcasts", module: "broadcasts", sortOrder: 5 },
    { key: "broadcasts.write", label: "Send Broadcasts", description: "Compose and send broadcasts", module: "broadcasts", sortOrder: 6 },
  ];
  for (const p of permissions) {
    await db.systemPermission.upsert({ where: { key: p.key }, update: p, create: p });
  }
  console.log("✓ system_permissions");

  await db.memberCounter.upsert({ where: { id: 1 }, update: {}, create: { id: 1, lastNumber: 12 } });

  const existingSettings = await db.assemblySetting.findFirst();
  if (!existingSettings) {
    await db.assemblySetting.create({
      data: {
        assemblyName: "Assakae Central Assembly",
        assemblyLocation: "Assakae District, Takoradi",
        assemblyAddress: "House 12, Assakae Layout, near St. Mary's Clinic, Takoradi",
        contactPhone: "233244567890",
        contactEmail: "assakae@cacighana.org",
        defaultPassword: "CACI@2026!",
        forcePasswordReset: true,
      },
    });
  }
  console.log("✓ assembly_settings");

  const adminPhone = "233244000001";
  const admin = await db.userProfile.upsert({
    where: { phone: adminPhone },
    update: {},
    create: {
      id: "admin-caci-001",
      role: "admin",
      fullName: "Pastor Emmanuel Mensah",
      isActive: true,
      mustChangePassword: false,
      phone: adminPhone,
      passwordHash: hashPassword("CACI@2026!"),
    },
  });
  console.log("✓ admin user");

  const sampleMembers = [
    { id: "member-001", title: "Mr", fullName: "Kwabena Owusu", gender: "male", maritalStatus: "married", occupation: "Civil Engineer", location: "Assakae, Takoradi", phone: "233244000002", membershipStatus: "active", assemblyRole: "Elder", user: { id: "user-member-001", fullName: "Kwabena Owusu", phone: "233244000002", password: "CACI@2026!" } },
    { id: "member-002", title: "Mrs", fullName: "Abena Adjei", gender: "female", maritalStatus: "married", occupation: "Teacher", location: "Effia Kuma, Takoradi", phone: "233244000003", membershipStatus: "active", assemblyRole: "Women's Leader", user: { id: "user-member-002", fullName: "Abena Adjei", phone: "233244000003", password: "CACI@2026!" } },
    { id: "member-003", title: "Brother", fullName: "Daniel Asare", gender: "male", maritalStatus: "single", occupation: "Software Developer", location: "Bankyim, Takoradi", phone: "233244000004", membershipStatus: "active", assemblyRole: "Youth Leader", user: { id: "user-member-003", fullName: "Daniel Asare", phone: "233244000004", password: "CACI@2026!" } },
    { id: "member-004", title: "Sister", fullName: "Grace Mensimah", gender: "female", maritalStatus: "single", occupation: "Nurse", location: "Assakae, Takoradi", phone: "233244000005", membershipStatus: "active", assemblyRole: "Usher", user: { id: "user-member-004", fullName: "Grace Mensimah", phone: "233244000005", password: "CACI@2026!" } },
    { id: "member-005", title: "Rev", fullName: "Samuel Boateng", gender: "male", maritalStatus: "married", occupation: "Pastor", location: "Assakae, Takoradi", phone: "233244000006", membershipStatus: "active", assemblyRole: "Associate Pastor", user: { id: "user-member-005", fullName: "Samuel Boateng", phone: "233244000006", password: "CACI@2026!" } },
    { id: "member-006", title: "Mrs", fullName: "Joyce Frimpong", gender: "female", maritalStatus: "married", occupation: "Trader", location: "Effia, Takoradi", phone: "233244000007", membershipStatus: "active", assemblyRole: "Choir Member" },
    { id: "member-007", title: "Mr", fullName: "Isaac Nyamekye", gender: "male", maritalStatus: "single", occupation: "University Student", location: "KNUST, Kumasi", phone: "233244000008", membershipStatus: "visitor", assemblyRole: null },
    { id: "member-008", title: "Sister", fullName: "Felicia Agyemang", gender: "female", maritalStatus: "single", occupation: "Seamstress", location: "Assakae, Takoradi", phone: "233244000009", membershipStatus: "active", assemblyRole: "Sunday School Teacher" },
    { id: "member-009", title: "Elder", fullName: "Joseph Tetteh", gender: "male", maritalStatus: "married", occupation: "Accountant", location: "Anaji, Takoradi", phone: "233244000010", membershipStatus: "active", assemblyRole: "Church Treasurer" },
    { id: "member-010", title: "Mrs", fullName: "Comfort Eshun", gender: "female", maritalStatus: "widowed", occupation: "Retired Civil Servant", location: "Assakae, Takoradi", phone: "233244000011", membershipStatus: "inactive", assemblyRole: "Mother of the Church" },
    { id: "member-011", title: "Brother", fullName: "Michael Asiedu", gender: "male", maritalStatus: "single", occupation: "Banker", location: "Fijai, Takoradi", phone: "233244000012", membershipStatus: "active", assemblyRole: "Media Team" },
    { id: "member-012", title: "Sister", fullName: "Ruth Bonsu", gender: "female", maritalStatus: "single", occupation: "Pharmacist", location: "Effia Kuma, Takoradi", phone: "233244000013", membershipStatus: "active", assemblyRole: "Health Team Lead" },
  ];

  for (const m of sampleMembers) {
    const membershipNumber = `CACI/ASS/2026/${String(parseInt(m.id.replace("member-", ""))).padStart(3, "0")}`;
    const data: any = {
      id: m.id,
      membershipNumber,
      title: m.title,
      fullName: m.fullName,
      gender: m.gender,
      maritalStatus: m.maritalStatus,
      occupation: m.occupation,
      location: m.location,
      phoneNumber: m.phone,
      whatsappNumber: m.phone,
      membershipStatus: m.membershipStatus,
      assemblyRole: m.assemblyRole,
      joinDate: new Date(Date.now() - Math.floor(Math.random() * 5 * 365 * 24 * 3600 * 1000)),
      emergencyContactName: m.maritalStatus === "married" ? `${m.fullName.split(" ")[1] || "Family"} Family` : "Next of Kin",
      emergencyContactPhone: "233244000099",
      emergencyContactRelationship: m.maritalStatus === "married" ? "Spouse" : "Sibling",
      isActive: m.membershipStatus !== "inactive",
      createdById: admin.id,
      dateOfBirth: new Date(1985 + Math.floor(Math.random() * 20), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
    };
    if (m.user) {
      await db.userProfile.upsert({
        where: { phone: m.user.phone },
        update: {},
        create: { id: m.user.id, role: "member", fullName: m.user.fullName, isActive: true, mustChangePassword: false, phone: m.user.phone, passwordHash: hashPassword(m.user.password) },
      });
      data.authUserId = m.user.id;
    }
    await db.member.upsert({ where: { id: m.id }, update: data, create: data });
  }
  console.log("✓ members");

  const groups = [
    { id: "group-001", name: "Youth Fellowship", description: "Vibrant youth wing (ages 18-35) of CACI Assakae. Meets every Saturday at 4:30 PM.", leaderId: "member-003", messagingMode: "open" as const, memberIds: ["member-001", "member-003", "member-004", "member-007", "member-011", "member-012"] },
    { id: "group-002", name: "Women's Fellowship", description: "Sisters united in Christ. Meetings every Tuesday at 5:00 PM.", leaderId: "member-002", messagingMode: "open" as const, memberIds: ["member-002", "member-004", "member-006", "member-008", "member-010", "member-012"] },
    { id: "group-003", name: "Men's Fellowship", description: "Men of valour. First Saturday of each month at 6:00 AM.", leaderId: "member-001", messagingMode: "open" as const, memberIds: ["member-001", "member-005", "member-009", "member-011"] },
    { id: "group-004", name: "Choir & Music Ministry", description: "Leading worship through song. Rehearsals every Friday at 6:30 PM.", leaderId: "member-006", messagingMode: "restricted" as const, memberIds: ["member-002", "member-006", "member-008", "member-012"] },
    { id: "group-005", name: "Sunday School Teachers", description: "Nurturing the next generation in Christ.", leaderId: "member-008", messagingMode: "open" as const, memberIds: ["member-002", "member-008", "member-004"] },
    { id: "group-006", name: "Ushering & Protocol", description: "Welcoming all with the love of Christ.", leaderId: "member-004", messagingMode: "restricted" as const, memberIds: ["member-004", "member-011"] },
    { id: "group-007", name: "Media & Technical Team", description: "Audio, video, livestream and social media.", leaderId: "member-011", messagingMode: "open" as const, memberIds: ["member-003", "member-011"] },
  ];
  for (const g of groups) {
    await db.group.upsert({ where: { id: g.id }, update: {}, create: { id: g.id, name: g.name, description: g.description, leaderId: g.leaderId, messagingMode: g.messagingMode, isActive: true, createdById: admin.id } });
    await db.groupMember.deleteMany({ where: { groupId: g.id } });
    for (const memberId of g.memberIds) {
      await db.groupMember.create({ data: { groupId: g.id, memberId } }).catch(() => {});
    }
  }
  console.log("✓ groups");

  const broadcasts = [
    { id: "bcast-001", title: "Sunday Service — Resurrection Power", body: "Beloved, this Sunday we celebrate the resurrection power of our Lord Jesus Christ. Service starts at 9:00 AM. Come with a friend, come expectant. Christ is risen indeed!", targetingMode: "assembly" as const, sentAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) },
    { id: "bcast-002", title: "Youth Fellowship Weekend Retreat", body: "Calling all youth! Our annual retreat is happening next weekend at Ankomah Beach Resort. Registration is GHC 150. See Elder Daniel Asare to register by Friday.", targetingMode: "group" as const, targetGroupId: "group-001", sentAt: new Date(Date.now() - 1 * 24 * 3600 * 1000) },
    { id: "bcast-003", title: "Midweek Bible Study Cancelled", body: "Due to the rainstorm affecting our area, tonight's midweek Bible study is cancelled. Please stay safe and study the Word at home. We resume next Wednesday.", targetingMode: "assembly" as const, sentAt: new Date(Date.now() - 6 * 3600 * 1000) },
    { id: "bcast-004", title: "Women's Fellowship Meeting Reminder", body: "Dear sisters, our weekly meeting holds tomorrow at 5:00 PM in the main auditorium. Sister Abena will lead the study on 'The Virtuous Woman'.", targetingMode: "group" as const, targetGroupId: "group-002", sentAt: new Date(Date.now() - 3 * 3600 * 1000) },
    { id: "bcast-005", title: "Emergency Prayer Meeting Tonight", body: "Beloved, in view of the recent events in our community, the church leadership has called for an emergency prayer meeting tonight at 7 PM. Please endeavour to attend.", targetingMode: "assembly" as const, sentAt: new Date(Date.now() - 1 * 3600 * 1000) },
  ];
  for (const b of broadcasts) {
    await db.broadcast.upsert({ where: { id: b.id }, update: {}, create: { id: b.id, sentById: admin.id, title: b.title, body: b.body, targetingMode: b.targetingMode, targetGroupId: b.targetGroupId ?? null, sentAt: b.sentAt } });
  }
  console.log("✓ broadcasts");

  const member1 = await db.member.findUnique({ where: { id: "member-001" } });
  if (member1) {
    const existingNotifs = await db.notification.count({ where: { memberId: member1.id } });
    if (existingNotifs === 0) {
      const notifs = [
        { title: "Sunday Service Reminder", body: "Join us this Sunday at 9:00 AM for Resurrection Power service.", broadcastId: "bcast-001", isRead: false, createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) },
        { title: "Midweek Bible Study Cancelled", body: "Tonight's midweek Bible study is cancelled due to rainstorm.", broadcastId: "bcast-003", isRead: false, createdAt: new Date(Date.now() - 6 * 3600 * 1000) },
        { title: "Emergency Prayer Meeting", body: "Emergency prayer meeting tonight at 7 PM.", broadcastId: "bcast-005", isRead: false, createdAt: new Date(Date.now() - 1 * 3600 * 1000) },
        { title: "Welcome to CACI Hub", body: "Your account has been provisioned. Explore your assembly anytime.", broadcastId: null, isRead: true, createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000) },
      ];
      for (const n of notifs) {
        await db.notification.create({ data: { ...n, memberId: member1.id } });
      }
    }
  }
  console.log("✓ notifications");

  const sermons = [
    { id: "sermon-001", title: "The Power of the Cross", speaker: "Pastor Emmanuel Mensah", date: new Date(Date.now() - 7 * 24 * 3600 * 1000), description: "A powerful Easter message on the finished work of Christ on the cross.", scriptureReference: "1 Corinthians 1:18" },
    { id: "sermon-002", title: "Walking in the Spirit", speaker: "Rev. Samuel Boateng", date: new Date(Date.now() - 14 * 24 * 3600 * 1000), description: "Understanding what it means to live a Spirit-led life.", scriptureReference: "Galatians 5:16-25" },
    { id: "sermon-003", title: "Faith that Moves Mountains", speaker: "Pastor Emmanuel Mensah", date: new Date(Date.now() - 21 * 24 * 3600 * 1000), description: "Practical steps to grow your faith in God.", scriptureReference: "Matthew 17:20" },
    { id: "sermon-004", title: "The Virtuous Woman", speaker: "Mrs. Abena Adjei", date: new Date(Date.now() - 28 * 24 * 3600 * 1000), description: "A study of Proverbs 31 for today's Christian woman.", scriptureReference: "Proverbs 31:10-31" },
  ];
  for (const s of sermons) {
    await db.sermon.upsert({ where: { id: s.id }, update: {}, create: { ...s, createdById: admin.id, coverImageUrl: null } });
  }
  console.log("✓ sermons");

  const forumMsgs = [
    { memberId: "member-002", content: "Praise the Lord family! God's mercies are new every morning. 🙏", createdAt: new Date(Date.now() - 5 * 3600 * 1000) },
    { memberId: "member-003", content: "Hallelujah! The youth retreat was truly life-changing.", createdAt: new Date(Date.now() - 4 * 3600 * 1000) },
    { memberId: "member-005", content: "Let us remember Sister Comfort in our prayers for quick recovery.", createdAt: new Date(Date.now() - 2 * 3600 * 1000) },
    { memberId: "member-009", content: "Reminder: tithes and offerings can now be made via mobile money on 024 456 7890. God bless your giving.", createdAt: new Date(Date.now() - 1 * 3600 * 1000) },
  ];
  for (const f of forumMsgs) {
    const existing = await db.forumMessage.findFirst({ where: { memberId: f.memberId, content: f.content } });
    if (!existing) await db.forumMessage.create({ data: f });
  }
  console.log("✓ forum_messages");

  const groupMsgs = [
    { groupId: "group-001", memberId: "member-003", content: "Hello youth fam! Reminder about Saturday rehearsal.", createdAt: new Date(Date.now() - 5 * 3600 * 1000) },
    { groupId: "group-001", memberId: "member-004", content: "Noted! Will be there by 4 PM.", createdAt: new Date(Date.now() - 4 * 3600 * 1000) },
    { groupId: "group-001", memberId: "member-007", content: "Is it okay if I join? I'm new 😊", createdAt: new Date(Date.now() - 3 * 3600 * 1000) },
    { groupId: "group-001", memberId: "member-003", content: "Of course Isaac, you're always welcome! See you there.", createdAt: new Date(Date.now() - 2 * 3600 * 1000) },
    { groupId: "group-002", memberId: "member-002", content: "Dear sisters, remember tomorrow's meeting at 5 PM.", createdAt: new Date(Date.now() - 3 * 3600 * 1000) },
    { groupId: "group-002", memberId: "member-006", content: "Will be there. May God bless our gathering.", createdAt: new Date(Date.now() - 2 * 3600 * 1000) },
  ];
  for (const g of groupMsgs) {
    const existing = await db.groupMessage.findFirst({ where: { groupId: g.groupId, memberId: g.memberId, content: g.content } });
    if (!existing) await db.groupMessage.create({ data: g });
  }
  console.log("✓ group_messages");

  const m1Perms = ["members.read", "groups.read"];
  for (const p of m1Perms) {
    const exists = await db.memberPermission.findUnique({ where: { memberId_permission: { memberId: "member-001", permission: p } } });
    if (!exists) {
      await db.memberPermission.create({ data: { memberId: "member-001", permission: p, grantedById: admin.id } });
    }
  }
  console.log("✓ member_permissions");

  const auditEntries = [
    { memberId: "member-001", changedById: admin.id, fieldChanged: "assembly_role", oldValue: null, newValue: "Elder", changedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
    { memberId: "member-003", changedById: admin.id, fieldChanged: "assembly_role", oldValue: null, newValue: "Youth Leader", changedAt: new Date(Date.now() - 25 * 24 * 3600 * 1000) },
    { memberId: "member-007", changedById: admin.id, fieldChanged: "membership_status", oldValue: null, newValue: "visitor", changedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000) },
    { memberId: "member-010", changedById: admin.id, fieldChanged: "membership_status", oldValue: "active", newValue: "inactive", changedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000) },
    { memberId: "member-010", changedById: admin.id, fieldChanged: "is_active", oldValue: "true", newValue: "false", changedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000) },
    { memberId: "member-003", changedById: admin.id, fieldChanged: "phone_number", oldValue: "233244000000", newValue: "233244000004", changedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) },
  ];
  for (const a of auditEntries) {
    const exists = await db.memberAuditLog.findFirst({ where: { memberId: a.memberId, fieldChanged: a.fieldChanged, changedAt: a.changedAt } });
    if (!exists) await db.memberAuditLog.create({ data: a });
  }
  console.log("✓ audit_logs");

  console.log("\n✅ Seed complete!");
  console.log("Login credentials:");
  console.log("  Admin:    phone 024 400 0001, password CACI@2026!");
  console.log("  Member:   phone 024 400 0002, password CACI@2026!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
