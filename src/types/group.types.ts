// src/types/group.types.ts
// Domain types for the Groups feature.
// Mirrors the `groups` and `group_members` Supabase tables.
// Field names follow the Supabase snake_case column names exactly.

import type { Database } from './database.types'

// ── Enum aliases ──────────────────────────────────────────────────────────────
export type GroupType       = Database['public']['Enums']['group_type']        // "department" | "age_group"
export type GroupMemberRole = Database['public']['Enums']['group_member_role'] // "leader" | "assistant_leader" | "member"

// ── Core DB row types ─────────────────────────────────────────────────────────
export type GroupRow       = Database['public']['Tables']['groups']['Row']
export type GroupMemberRow = Database['public']['Tables']['group_members']['Row']

// ── Group — extended row with computed/joined fields ──────────────────────────
// member_count and leader_name are resolved in repository.ts — NOT DB columns.
export interface Group extends GroupRow {
  member_count: number          // COUNT of active group_members
  leader_name:  string | null   // joined from members_view: first_name + last_name
}

// ── GroupMemberWithMember — joined shape for the slide-in member panel ─────────
export interface GroupMemberWithMember extends GroupMemberRow {
  member_name:      string        // joined: first_name + ' ' + last_name
  member_photo_url: string | null // joined: profile_photo_url
}

// ── CreateGroupPayload ────────────────────────────────────────────────────────
export interface CreateGroupPayload {
  name:         string
  group_type:   GroupType
  description?: string | null
  leader_id?:   string | null
}

// ── UpdateGroupPayload ────────────────────────────────────────────────────────
export type UpdateGroupPayload = Partial<CreateGroupPayload>

// ── AssignGroupMemberPayload ──────────────────────────────────────────────────
export interface AssignGroupMemberPayload {
  group_id:  string
  member_id: string
  role:      GroupMemberRole
}

// ── GroupFilter — passed to listGroups() ──────────────────────────────────────
export interface GroupFilter {
  type?:           GroupType   // filter to a single group_type
  search?:         string      // ilike on name
  includeDeleted?: boolean     // default false
}
