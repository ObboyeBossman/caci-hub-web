// ============================================================
// CACI HUB — Shared Types
// ============================================================

export type Role = "admin" | "member";

export type MembershipStatus = "visitor" | "active" | "inactive";

export type GenderType = "male" | "female";

export type MaritalStatusType =
  | "single"
  | "married"
  | "divorced"
  | "widowed"
  | "other";

export type TargetingMode = "assembly" | "group" | "members";

export type MessagingMode = "open" | "restricted";

export type PermissionKey =
  | "members.read"
  | "members.write"
  | "groups.read"
  | "groups.write"
  | "broadcasts.read"
  | "broadcasts.write";

export interface SessionUser {
  id: string;
  role: Role;
  fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  phone: string;
  memberId?: string; // linked member profile (for member role)
}

// Client-facing DTOs (no sensitive fields)
export interface MemberDTO {
  id: string;
  membershipNumber: string | null;
  title: string | null;
  fullName: string;
  dateOfBirth: string | null;
  gender: GenderType | null;
  maritalStatus: MaritalStatusType | null;
  occupation: string | null;
  location: string | null;
  phoneNumber: string | null;
  whatsappNumber: string | null;
  membershipStatus: MembershipStatus;
  assemblyRole: string | null;
  joinDate: string | null;
  profilePhotoUrl: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  isActive: boolean;
  deletedAt: string | null;
  authUserId: string | null;
  createdAt: string;
  updatedAt: string;
  groupCount?: number;
  permissions?: PermissionKey[];
}

export interface GroupDTO {
  id: string;
  name: string;
  description: string | null;
  leaderId: string | null;
  leaderName: string | null;
  messagingMode: MessagingMode;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  isMember?: boolean;
}

export interface BroadcastDTO {
  id: string;
  sentById: string;
  sentByName: string | null;
  title: string;
  body: string;
  targetGroupId: string | null;
  targetGroupName: string | null;
  targetingMode: TargetingMode;
  attachmentUrl: string | null;
  sentAt: string;
  recipientCount?: number;
}

export interface SermonDTO {
  id: string;
  title: string;
  speaker: string;
  date: string;
  description: string | null;
  scriptureReference: string | null;
  audioUrl: string | null;
  videoUrl: string | null;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDTO {
  id: string;
  memberId: string;
  broadcastId: string | null;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLogDTO {
  id: string;
  memberId: string;
  memberName: string | null;
  changedById: string | null;
  changedByName: string | null;
  fieldChanged: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
}

export interface AssemblySettingsDTO {
  id: string;
  assemblyName: string;
  assemblyLocation: string;
  assemblyAddress: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  defaultPassword: string;
  forcePasswordReset: boolean;
}

export interface ForumMessageDTO {
  id: string;
  memberId: string;
  memberName: string;
  memberRole: string | null;
  memberTitle: string | null;
  content: string;
  createdAt: string;
  isOwn?: boolean;
}

export interface GroupMessageDTO {
  id: string;
  groupId: string;
  memberId: string;
  memberName: string;
  memberTitle: string | null;
  content: string;
  createdAt: string;
  isOwn?: boolean;
}

export interface UserProfileDTO {
  id: string;
  role: Role;
  fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  phone: string;
  createdAt: string;
  linkedMemberId: string | null;
}

export interface DashboardStatsDTO {
  totalMembers: number;
  activeMembers: number;
  visitorCount: number;
  inactiveCount: number;
  totalGroups: number;
  activeGroups: number;
  totalBroadcasts: number;
  broadcastsThisWeek: number;
  totalSermons: number;
  unreadNotifications: number;
  memberGrowth: { label: string; value: number }[];
  statusBreakdown: { label: string; value: number; color: string }[];
  recentMembers: MemberDTO[];
  recentBroadcasts: BroadcastDTO[];
}
