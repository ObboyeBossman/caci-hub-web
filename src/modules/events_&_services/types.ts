// src/modules/services/types.ts
// Extended domain types local to the Services page layer.
// (Base types live in src/types/service.types.ts)

import type {
  ServiceRow,
  ServiceTemplateRow,
  ServiceAttendanceRow,
  ServiceStatus,
  AttendanceStatus,
  RecurrenceType,
} from '../../types/service.types'

// ── Display helpers ───────────────────────────────────────────────────────────

export interface ServiceDisplay extends ServiceRow {
  template_title:  string | null
  group_name:      string | null
  attendance_count: number
  present_count:   number
}

export interface AttendanceDisplay extends ServiceAttendanceRow {
  member_name:      string
  member_number:    string | null
  member_photo_url: string | null
  group_name:       string | null
}

export interface TemplateDisplay extends ServiceTemplateRow {
  recurrence_label: string     // "Every Sunday at 9:00 AM"
  group_name:       string | null
  instance_count:   number
}

// ── Page state ────────────────────────────────────────────────────────────────

export type ServicesView = 'list' | 'calendar'

export interface ServicesPageState {
  // schedule tab
  services:      ServiceDisplay[]
  filtered:      ServiceDisplay[]
  search:        string
  statusFilter:  ServiceStatus | 'all'
  typeFilter:    string
  groupFilter:   string
  statFilter:    string | null
  view:          ServicesView
  calYear:       number
  calMonth:      number  // 0-11
  openServiceId: string | null

  // attendance tab
  attServices:       ServiceDisplay[]   // recent services for picker
  attServiceId:      string | null
  attRecords:        AttendanceDisplay[]
  attFiltered:       AttendanceDisplay[]
  attSearch:         string
  attStatusFilter:   AttendanceStatus | 'all'
  attChanged:        Set<string>        // member IDs with unsaved changes
  attCurrentStatus:  Map<string, AttendanceStatus>

  // templates tab
  templates:     TemplateDisplay[]
  tmplFiltered:  TemplateDisplay[]
  tmplSearch:    string

  // reports tab
  reportRange:   '7d' | '30d' | '90d' | '1y'

  // shared
  loading:       boolean
  saving:        boolean
}

// ── Stat card config ─────────────────────────────────────────────────────────

export interface StatConfig {
  key:     string
  label:   string
  icon:    string
  color:   string
  bg:      string
  accent:  string
  glow:    string
}

// ── Recurrence helpers ───────────────────────────────────────────────────────

export const DAYS_OF_WEEK = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] as const
export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none:     'One-time',
  daily:    'Daily',
  weekly:   'Weekly',
  biweekly: 'Every 2 weeks',
  monthly:  'Monthly',
}

export const SERVICE_TYPES = [
  'Sunday Service',
  'Midweek Service',
  'Prayer Meeting',
  'Cell Meeting',
  'Bible Study',
  'Youth Service',
  'Women\'s Fellowship',
  'Men\'s Fellowship',
  'Convention',
  'Conference',
  'Retreat',
  'Outreach',
  'Other',
] as const

export type ServiceType = typeof SERVICE_TYPES[number]