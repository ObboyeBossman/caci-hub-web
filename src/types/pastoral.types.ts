// src/types/pastoral.types.ts
// Domain types for the Pastoral Care module.
// Mirrors three DB tables: pastoral_cases, pastoral_visits, prayer_requests.

import type { Database } from './database.types'

// ── Enum aliases ──────────────────────────────────────────────────────────────
export type PastoralCaseType     = Database['public']['Enums']['pastoral_case_type']
// 'follow_up' | 'bereavement' | 'illness' | 'counselling' | 'discipline' | 'other'

export type PastoralPriority     = Database['public']['Enums']['pastoral_priority']
// 'low' | 'medium' | 'high' | 'urgent'

export type PastoralCaseStatus   = Database['public']['Enums']['pastoral_case_status']
// 'open' | 'in_progress' | 'resolved' | 'closed'

export type VisitType            = Database['public']['Enums']['visit_type']
// 'home_visit' | 'hospital_visit' | 'phone_call' | 'video_call' | 'in_person'

export type VisitOutcome         = Database['public']['Enums']['visit_outcome']
// 'positive' | 'needs_follow_up' | 'no_response' | 'referred'

export type PrayerRequestStatus  = Database['public']['Enums']['prayer_request_status']
// 'active' | 'answered' | 'closed'

// ── Raw DB row types ──────────────────────────────────────────────────────────
export type PastoralCaseRow    = Database['public']['Tables']['pastoral_cases']['Row']
export type PastoralVisitRow   = Database['public']['Tables']['pastoral_visits']['Row']
export type PrayerRequestRow   = Database['public']['Tables']['prayer_requests']['Row']

// ── Extended / joined types ───────────────────────────────────────────────────

/** PastoralCase with resolved member + assignee display names */
export interface PastoralCase extends PastoralCaseRow {
  member_name?:    string | null  // joined from members_view
  assigned_name?:  string | null  // joined from user_profiles.full_name
  visit_count?:    number         // count of non-deleted child visits
}

/** PastoralVisit with resolved display names */
export interface PastoralVisit extends PastoralVisitRow {
  visited_by_name?: string | null // joined from user_profiles.full_name
  member_name?:     string | null // joined from members_view
}

/** PrayerRequest with optional member name (hidden when is_anonymous) */
export interface PrayerRequest extends PrayerRequestRow {
  /** Null-ed out in app layer when is_anonymous = true */
  member_name?: string | null
}

// ── Payload types for CRUD ────────────────────────────────────────────────────

export interface CreateCasePayload {
  member_id:    string
  case_type:    PastoralCaseType
  title:        string
  description?: string | null
  priority?:    PastoralPriority    // defaults to 'medium'
  assigned_to?: string | null
  is_private?:  boolean             // defaults to true
}
export type UpdateCasePayload = Partial<Omit<CreateCasePayload, 'member_id'>> & {
  status?:       PastoralCaseStatus
  resolved_at?:  string | null
}

export interface CreateVisitPayload {
  case_id:          string
  member_id:        string
  visit_type:       VisitType
  visit_date:       string          // ISO date
  notes?:           string | null
  outcome?:         VisitOutcome    // defaults to 'positive'
  next_visit_date?: string | null
}
export type UpdateVisitPayload = Partial<Omit<CreateVisitPayload, 'case_id' | 'member_id'>>

export interface CreatePrayerRequestPayload {
  title:        string
  description?: string | null
  member_id?:   string | null       // omit for anonymous
  is_anonymous?: boolean            // defaults to false
}
export type UpdatePrayerRequestPayload = Partial<Omit<CreatePrayerRequestPayload, 'member_id'>> & {
  status?:       PrayerRequestStatus
  is_answered?:  boolean
  answered_at?:  string | null
}

// ── Filter types ──────────────────────────────────────────────────────────────

export interface CaseFilter {
  status?:      PastoralCaseStatus
  priority?:    PastoralPriority
  case_type?:   PastoralCaseType
  assignedToMe?: boolean           // filters to auth.uid() in app layer
  memberId?:    string
  search?:      string             // ilike on title
}

export interface PrayerRequestFilter {
  status?:         PrayerRequestStatus
  memberId?:       string
  includeAnswered?: boolean
}
