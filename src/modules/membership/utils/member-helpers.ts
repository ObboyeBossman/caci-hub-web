// src/modules/membership/utils/member-helpers.ts
// Shared presentation helpers used across membership pages.
// Extracted from MemberList.ts and MemberProfile.ts to avoid duplication.

/** Avatar colour cycle — mirrors reference HTML */
const AVATAR_COLORS = [
  '#004BA0', '#C60026', '#1a5fb4', '#7c3aed',
  '#1a7f37', '#9a6700', '#8c959f', '#0969da',
]

export function avatarColor(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export function statusBadge(s: string): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    active:   { cls: 'green',  label: 'Active' },
    inactive: { cls: '',       label: 'Inactive' },
    visitor:  { cls: 'blue',   label: 'Visitor' },
    prospect: { cls: 'yellow', label: 'Prospect' },
    transfer: { cls: 'purple', label: 'Transfer' },
    deceased: { cls: 'red',    label: 'Deceased' },
  }
  return map[s] ?? { cls: '', label: s }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Inject the membership CSS file if not already present. */
export function injectMembershipCSS(): void {
  if (document.getElementById('mm-ui-css')) return
  const link = document.createElement('link')
  link.id   = 'mm-ui-css'
  link.rel  = 'stylesheet'
  link.href = '/src/modules/membership/styles/membership.css'
  document.head.appendChild(link)
}

export function formatName(firstName: string, lastName: string, title?: string | null): string {
  const name = `${firstName} ${lastName}`
  return title ? `${title} ${name}` : name
}
