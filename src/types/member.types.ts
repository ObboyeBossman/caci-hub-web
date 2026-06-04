// member.types.ts
// Mirrors Flutter source files:
//   member.dart, member_audit_entry.dart, create_member_request.dart,
//   update_member_request.dart, member_filter.dart, household_filter.dart
//   household.dart (via households_repository.dart)
// Field names follow the Supabase snake_case column names exactly.

import type { Database } from './database.types'

// ── Core DB types ─────────────────────────────────────────────────────────────
export type MemberRow  = Database['public']['Tables']['members']['Row']
export type MemberView = Database['public']['Views']['members_view']['Row'] & {
  id: string;
  assembly_id: string;
  first_name: string;
  last_name: string;
  other_names?: string | null;
  gender: Database['public']['Enums']['gender_type'];
  is_active: boolean;
  membership_status: Database['public']['Enums']['membership_status'];
  created_at: string;
  updated_at: string;
}

// ── Enums — mirrors gender_type.dart, membership_status.dart, marital_status.dart
export type MemberStatus  = Database['public']['Enums']['membership_status']
export type Gender        = Database['public']['Enums']['gender_type']
export type MaritalStatus = Database['public']['Enums']['marital_status_type']

// ── MemberFilter — mirrors member_filter.dart MemberFilter class ──────────────
// Web version adds assemblyId for super_admin scoping (RLS handles all others).
export interface MemberFilter {
  statuses?:       MemberStatus[]   // mirrors: List<MembershipStatus>? statuses
  gender?:         Gender           // mirrors: GenderType? gender
  householdId?:    string           // mirrors: String? householdId
  searchQuery?:    string           // mirrors: String? searchQuery
  includeDeleted?: boolean          // mirrors: bool includeDeleted (default: false)
  assemblyId?:     string           // required for super_admin; RLS handles others
}

// ── CreateMemberPayload — mirrors create_member_request.dart CreateMemberRequest
// Field names mirror the toJson() output keys exactly.
export interface CreateMemberPayload {
  assembly_id:                    string
  title?:                         string | null
  first_name:                     string
  last_name:                      string
  other_names?:                   string | null
  gender:                         Gender
  membership_status:              MemberStatus   // default: 'visitor'
  date_of_birth?:                 string | null  // ISO 8601 date string
  marital_status?:                MaritalStatus | null
  primary_phone?:                 string | null
  secondary_phone?:               string | null
  email?:                         string | null
  physical_address?:              string | null
  occupation?:                    string | null
  facebook_url?:                  string | null
  whatsapp_number?:               string | null
  instagram_url?:                 string | null
  emergency_contact_name?:        string | null
  emergency_contact_phone?:       string | null
  emergency_contact_relationship?: string | null
  join_date?:                     string | null  // ISO 8601 date string
  household_id?:                  string | null
  pastoral_notes?:                string | null
}

// ── UpdateMemberPayload — mirrors update_member_request.dart UpdateMemberRequest
// All fields optional — only set fields are sent to Supabase (patch semantics).
// The Nullable<T> pattern from Flutter (to explicitly clear a field to null)
// is handled here by using T | null — pass null to clear, omit to skip.
export type UpdateMemberPayload = Partial<CreateMemberPayload> & {
  // Admin/pastor only — DB enforces 42501 for other roles
  is_active?:         boolean
  deleted_at?:        string | null   // soft delete timestamp
  profile_photo_url?: string | null
}

// ── MemberStats — mirrors member_stat_card.dart stat shape ───────────────────
export interface MemberStats {
  total:          number
  active:         number
  inactive:       number
  visitors:       number
  flagged:        number
  new_this_month: number
}

// ── MemberAuditEntry — mirrors member_audit_entry.dart MemberAuditEntry ───────
export interface MemberAuditEntry {
  id:              string
  member_id:       string
  assembly_id:     string
  changed_by:      string | null    // auth.users.id of actor; NULL on account delete
  changed_by_name: string | null    // joined from user_profiles.full_name
  field_changed:   string
  old_value:       string | null
  new_value:       string | null
  changed_at:      string           // ISO 8601 timestamp
}

// ── Household types ───────────────────────────────────────────────────────────
// Mirrors: household.dart + households_repository.dart
// IMPORTANT: the DB column is `family_name` (not `name`) — per migration 20260427000004
// households.family_name = "Asante Family", "Mensah Household", etc.

export type HouseholdRow = Database['public']['Tables']['households']['Row']

// Extended view with computed fields (not in the raw households table).
// Mirrors: household_details_provider.dart joined shape.
// member_count and primary_contact_name are computed in repository.ts
// via COUNT + JOIN — they are NOT database columns.
export interface HouseholdView extends HouseholdRow {
  member_count:         number        // count of members with this household_id
  primary_contact_name: string | null // joined: members.first_name + ' ' + members.last_name
}

// Full household with its members list.
// Mirrors: household_screen.dart data shape (the detail page).
export interface HouseholdWithMembers extends HouseholdView {
  members: MemberView[]
}

// ── HouseholdFilter — web query filter ───────────────────────────────────────
// NOTE: The Flutter HouseholdFilter (household_filter.dart) was a simple
// dropdown item (id + familyName) for the member form household picker.
// The web HouseholdFilter drives the AG Grid server-side query on HouseholdList.
// These are different shapes serving different purposes.
export interface HouseholdFilter {
  search?:      string   // full-text search on family_name
  assembly_id?: string   // required for super_admin; RLS handles all other roles
}

// ── HouseholdDropdownItem — mirrors household_filter.dart HouseholdFilter ─────
// Used to populate the household dropdown in AddMember / EditMember forms.
// Mirrors the Flutter HouseholdFilter class (id + familyName display pair).
export interface HouseholdDropdownItem {
  id:          string
  family_name: string  // displayed in the dropdown
}

// ── CreateHouseholdPayload — mirrors create_household_screen.dart form fields ──
// family_name = DB column name (not 'name') — per migration 20260427000004
export interface CreateHouseholdPayload {
  family_name:        string         // required; min 2 chars
  address:            string | null
  assembly_id:        string
  primary_contact_id: string | null
}

// ── UpdateHouseholdPayload ────────────────────────────────────────────────────
// All fields optional — patch semantics, same as UpdateMemberPayload.
export type UpdateHouseholdPayload = Partial<CreateHouseholdPayload>

// ── Provision ─────────────────────────────────────────────────────────────────

export type ProvisionPath = 'invite' | 'default_password' | 'custom_password'

export interface ProvisionUserPayload {
  memberId:  string
  role:      string
  path:      ProvisionPath
  email?:    string
  password?: string   // custom_password path only
}

export interface ProvisionUserResult {
  userId:   string
  email?:   string
  phone?:   string
  fullName: string
  role:     string
  path:     ProvisionPath
}

// ── Bulk import ───────────────────────────────────────────────────────────────

export interface BulkMemberRow {
  first_name:        string
  last_name:         string
  gender:            'male' | 'female'
  membership_status?: string
  primary_phone?:    string | null
  secondary_phone?:  string | null
  email?:            string | null
  date_of_birth?:    string | null   // YYYY-MM-DD
  marital_status?:   string | null
  join_date?:        string | null   // YYYY-MM-DD
  occupation?:       string | null
  physical_address?: string | null
}

export interface BulkImportResult {
  imported: number
  skipped:  number
  errors:   Array<{ row: number; reason: string }>
}
