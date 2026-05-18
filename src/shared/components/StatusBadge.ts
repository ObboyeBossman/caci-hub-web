// src/shared/components/StatusBadge.ts
// Renders a membership status badge pill.
// Mirrors: member_status_badge.dart (Flutter)

import type { MemberStatus } from '../../types/member.types'

interface BadgeStyle {
  label: string
  cssClass: string  // uses .badge-* classes from theme.css
}

const STYLES: Record<MemberStatus, BadgeStyle> = {
  active:   { label: 'Active',   cssClass: 'badge-active'   },
  inactive: { label: 'Inactive', cssClass: 'badge-inactive' },
  visitor:  { label: 'Visitor',  cssClass: 'badge-visitor'  },
  prospect: { label: 'Prospect', cssClass: 'badge-prospect' },
  transfer: { label: 'Transfer', cssClass: 'badge-transfer' },
  deceased: { label: 'Deceased', cssClass: 'badge-deceased' },
}

/**
 * Returns HTML string for a status badge pill.
 *
 * Usage:
 *   cell.innerHTML = statusBadgeHtml(member.membership_status)
 */
export function statusBadgeHtml(status: MemberStatus): string {
  const style = STYLES[status] ?? { label: status, cssClass: 'badge-inactive' }
  return `<span class="status-badge ${style.cssClass}">${style.label}</span>`
}