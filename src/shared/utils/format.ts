// src/shared/utils/format.ts
// Date, phone, membership number, name formatters.
// Mirrors: time_utils.dart (Flutter) + format helpers from caci_members_module.html

import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

// ── Dates ─────────────────────────────────────────────────────────────────────

/** "12 May 2026" */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return dayjs(dateStr).format('D MMM YYYY')
}

/** "12 May 2026, 14:30" */
export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  return dayjs(dateStr).format('D MMM YYYY, HH:mm')
}

/**
 * Relative time — mirrors time_utils.dart formatRelativeTime()
 * "just now" / "3 minutes ago" / "2 days ago" / "12 May 2026"
 */
export function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  const date = dayjs(dateStr)
  const diffMins  = dayjs().diff(date, 'minute')
  const diffHours = dayjs().diff(date, 'hour')
  const diffDays  = dayjs().diff(date, 'day')

  if (diffMins < 1)    return 'just now'
  if (diffMins < 60)   return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`
  if (diffHours < 24)  return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  if (diffDays < 7)    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  return formatDate(dateStr)
}

/** "01 Jan 1990" → age: "34" */
export function formatAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return '—'
  return String(dayjs().diff(dayjs(dateOfBirth), 'year'))
}

// ── Names ─────────────────────────────────────────────────────────────────────

/** "JA" from "John Asante" or first/last name pair */
export function initials(first: string, last: string): string {
  const f = first.trim()
  const l = last.trim()
  return `${f ? f[0] : ''}${l ? l[0] : ''}`.toUpperCase()
}

/** Title-case a role string: "finance_officer" → "Finance Officer" */
export function formatRole(role: string): string {
  return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ── Phone ─────────────────────────────────────────────────────────────────────

/** "+233241234567" → "+233 24 123 4567" */
export function formatPhone(phone: string | null): string {
  if (!phone) return '—'
  // Very light formatting — preserve international prefix
  const digits = phone.replace(/\s+/g, '')
  if (digits.startsWith('+233') && digits.length >= 12) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
  }
  return phone
}

// ── Membership number ─────────────────────────────────────────────────────────

/** "ACA-2026-0042" */
export function formatMembershipNumber(num: string | null): string {
  return num ?? 'Pending'
}

// ── Status labels ─────────────────────────────────────────────────────────────

/** "active" → "Active" */
export function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

// ── Numbers ───────────────────────────────────────────────────────────────────

/** 1234567 → "1,234,567" */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-GB').format(n)
}

/** 1234567.89 → "GH₵ 1,234,567.89" */
export function formatCurrency(amount: number, currency = 'GHS'): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}