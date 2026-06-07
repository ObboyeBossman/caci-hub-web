// src/types/service.types.ts
// Domain types for the Services module.
// Mirrors the shape of service_templates, services, service_attendance,
// and service_audit_log tables defined in ref/services_final_sql.html.

import type { Database } from './database.types'

// ── Enum aliases ──────────────────────────────────────────────────────────────

export type ServiceStatus     = Database['public']['Enums']['service_status']
export type AttendanceStatus  = Database['public']['Enums']['attendance_status']
export type RecurrenceType    = Database['public']['Enums']['recurrence_type']

// ── Raw DB row types ──────────────────────────────────────────────────────────

export type ServiceTemplateRow  = Database['public']['Tables']['service_templates']['Row']
export type ServiceRow          = Database['public']['Tables']['services']['Row']
export type ServiceAttendanceRow = Database['public']['Tables']['service_attendance']['Row']
export type ServiceAuditLogRow  = Database['public']['Tables']['service_audit_log']['Row']

// ── ServiceTemplate ───────────────────────────────────────────────────────────

export interface ServiceTemplate extends ServiceTemplateRow {
  // No computed columns needed at this layer — raw row suffices
}

export type CreateServiceTemplatePayload = Omit<
  Database['public']['Tables']['service_templates']['Insert'],
  'id' | 'assembly_id' | 'created_at' | 'created_by' | 'deleted_at' | 'deleted_by'
>

export type UpdateServiceTemplatePayload = Partial<
  Omit<
    Database['public']['Tables']['service_templates']['Update'],
    'id' | 'assembly_id' | 'created_at' | 'created_by' | 'deleted_at' | 'deleted_by'
  >
>

// ── Service ───────────────────────────────────────────────────────────────────

export interface ServiceWithTemplate extends ServiceRow {
  /** Joined template title (null when no template_id) */
  template_title: string | null
}

export interface ServiceFilter {
  status?:       ServiceStatus
  serviceType?:  string
  groupId?:      string
  templateId?:   string
  fromDate?:     string   // ISO date string YYYY-MM-DD
  toDate?:       string   // ISO date string YYYY-MM-DD
  searchQuery?:  string
  includeDeleted?: boolean
}

export type CreateServicePayload = Omit<
  Database['public']['Tables']['services']['Insert'],
  'id' | 'assembly_id' | 'created_at' | 'created_by' | 'deleted_at' | 'deleted_by'
>

export type UpdateServicePayload = Partial<
  Omit<
    Database['public']['Tables']['services']['Update'],
    'id' | 'assembly_id' | 'created_at' | 'created_by' | 'deleted_at' | 'deleted_by'
  >
>

export interface ServiceStats {
  total:      number
  scheduled:  number
  completed:  number
  cancelled:  number
  thisMonth:  number  // services created/scheduled in the current calendar month
}

// ── Service Attendance ────────────────────────────────────────────────────────

export interface ServiceAttendanceWithMember extends ServiceAttendanceRow {
  /** Joined member display name */
  member_name: string
  /** Joined member profile photo URL */
  member_photo_url: string | null
}

export interface UpsertAttendancePayload {
  service_id: string
  member_id:  string
  status:     AttendanceStatus
  notes?:     string | null
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export interface ServiceAuditEntry extends ServiceAuditLogRow {
  /** Resolved from user_profiles.full_name for the changed_by UUID */
  changed_by_name: string | null
}
