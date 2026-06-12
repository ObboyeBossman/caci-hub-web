// src/modules/membership/pages/AuditLogs.ts
// Audit Logs page — field-level change history for all member records.
// Tab: "Audit Logs" in MembershipTab widget → /audit-logs
//
// Features:
//   • 4 Stat cards: Total Changes, Today, This Week, Unique Members Affected
//   • Toolbar: free-text search + field-category chips + date range + Export CSV
//   • Infinite-scroll timeline (50 entries per page)
//   • Each entry: actor avatar, member name (link → profile), field + value diff
//   • Sensitive-field badge for pastoral_notes changes
//   • Scoped CSS under .al-* prefix

import type { PageModule } from '../../../types/module.types'
import { navigate } from '@core/router'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { debounce } from '@shared/utils/debounce'
import { renderMembershipTab, bindMembershipTabEvents } from '../widgets/MembershipTab'
import { listAllAuditLogs } from '../repository'
import type { AuditLogEntry } from '../repository'

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = /* css */`
/* ══════════════════════════════════════════════════════════════
   AUDIT LOGS PAGE  — scoped under .al-*
══════════════════════════════════════════════════════════════ */

.al-page {
  font-family: var(--font-sans);
}

/* ── Stat cards ────────────────────────────────────────────── */
.al-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}
@media (max-width: 900px) { .al-stats { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .al-stats { grid-template-columns: 1fr 1fr; gap: 10px; } }

.al-stat {
  background: linear-gradient(145deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border: 1px solid var(--border-default);
  border-radius: 16px;
  padding: 16px;
  position: relative;
  overflow: hidden;
  transition: transform 0.22s cubic-bezier(0.16,1,0.3,1), box-shadow 0.22s, border-color 0.22s;
  animation: alFadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
}
.al-stat:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
}
.al-stat-icon-row {
  display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
}
.al-stat-icon {
  width: 32px; height: 32px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.al-stat-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.09em; color: var(--text-secondary);
}
.al-stat-value {
  font-size: 28px; font-weight: 700; color: var(--text-primary); line-height: 1;
  display: flex; align-items: baseline; gap: 8px;
}
.al-stat-sub {
  font-size: 11px; font-weight: 400; color: var(--text-secondary);
}
.al-stat-bar {
  margin-top: 10px; height: 2px; border-radius: 99px;
  background: var(--border-default); overflow: hidden;
}
.al-stat-bar-fill {
  height: 100%; border-radius: 99px;
  transition: width 0.6s cubic-bezier(0.16,1,0.3,1);
}

/* ── Toolbar ───────────────────────────────────────────────── */
.al-toolbar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 10px 14px;
  background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border: 1px solid var(--border-default);
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  margin-bottom: 14px;
}
.al-search-wrap {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: 10px; padding: 0 12px;
  height: 40px; flex: 1; min-width: 200px; max-width: 380px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.al-search-wrap:focus-within {
  border-color: var(--caci-blue);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.al-search-wrap i { font-size: 15px; color: var(--text-muted); flex-shrink: 0; transition: color 0.2s; }
.al-search-wrap:focus-within i { color: var(--caci-blue); }
.al-search-inp {
  background: transparent; border: none; outline: none;
  font-size: 13px; color: var(--text-primary);
  font-family: var(--font-sans); width: 100%;
  caret-color: var(--caci-blue);
}
.al-search-inp::placeholder { color: var(--text-muted); }

.al-date-input {
  height: 40px; padding: 0 12px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: 10px; color: var(--text-primary);
  font-size: 12.5px; font-family: var(--font-sans);
  outline: none; cursor: pointer;
  transition: border-color 0.2s;
  color-scheme: dark;
}
.al-date-input:focus { border-color: var(--caci-blue); }

.al-tbtn {
  display: flex; align-items: center; gap: 6px;
  padding: 0 14px; height: 40px; border-radius: 10px;
  font-size: 12.5px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--border-default);
  background: var(--bg-page); color: var(--text-secondary);
  transition: all 0.18s; white-space: nowrap; font-family: var(--font-sans);
}
.al-tbtn i { font-size: 14px; }
.al-tbtn:hover { border-color: var(--border-strong); color: var(--text-primary); transform: translateY(-1px); }
.al-tbtn-primary {
  background: linear-gradient(135deg, var(--caci-blue), var(--caci-blue-light));
  border-color: transparent; color: #fff; font-weight: 600;
  box-shadow: 0 2px 10px rgba(0,75,160,0.3);
}
.al-tbtn-primary:hover {
  box-shadow: 0 5px 18px rgba(0,75,160,0.45);
  color: #fff; border-color: transparent;
}
@media (max-width: 640px) {
  .al-btn-label { display: none; }
  .al-tbtn { padding: 0 10px; }
  .al-date-input { width: 42px; padding: 0; color: transparent; }
}

/* ── Field-category chips ──────────────────────────────────── */
.al-chips {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin-bottom: 14px;
}
.al-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 13px; border-radius: 99px;
  border: 1px solid var(--border-default);
  background: transparent;
  font-size: 12px; font-weight: 500; color: var(--text-secondary);
  cursor: pointer; white-space: nowrap; font-family: var(--font-sans);
  transition: all 0.18s cubic-bezier(0.16,1,0.3,1);
}
.al-chip:hover { border-color: var(--border-strong); color: var(--text-primary); }
.al-chip.active {
  background: rgba(0,75,160,0.1); border-color: rgba(0,75,160,0.4);
  color: var(--caci-blue-light);
}
[data-theme="light"] .al-chip.active { color: var(--caci-blue); }
.al-chip i { font-size: 12px; }

/* ── Results meta ──────────────────────────────────────────── */
.al-meta {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 2px; margin-bottom: 12px;
  font-size: 12px; color: var(--text-secondary);
}
.al-meta strong { color: var(--text-primary); }

/* ── Timeline list ─────────────────────────────────────────── */
.al-timeline {
  display: flex; flex-direction: column; gap: 6px;
}

.al-entry {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 14px;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
  animation: alFadeUp 0.38s cubic-bezier(0.16,1,0.3,1) both;
}
.al-entry:hover {
  border-color: rgba(0,75,160,0.3);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  transform: translateX(3px);
}

/* Actor avatar */
.al-actor-avatar {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: #fff;
  box-shadow: 0 0 0 2px var(--bg-card), 0 0 0 3.5px var(--border-default);
}

/* Entry body */
.al-entry-body { flex: 1; min-width: 0; }
.al-entry-header {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin-bottom: 6px;
}
.al-actor-name {
  font-size: 13px; font-weight: 600; color: var(--text-primary);
}
.al-action-text {
  font-size: 12.5px; color: var(--text-secondary);
}
.al-member-link {
  font-size: 12.5px; font-weight: 600;
  color: var(--caci-blue-light); cursor: pointer;
  text-decoration: none; border: none; background: none;
  padding: 0; font-family: var(--font-sans);
  transition: color 0.15s;
}
[data-theme="light"] .al-member-link { color: var(--caci-blue); }
.al-member-link:hover { text-decoration: underline; }

/* Timestamp */
.al-ts {
  font-size: 11px; color: var(--text-muted); margin-left: auto; flex-shrink: 0;
  cursor: default; white-space: nowrap;
}

/* Field + value diff */
.al-diff {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin-top: 4px;
}
.al-field-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 9px; border-radius: 6px;
  font-size: 10.5px; font-weight: 600;
  background: rgba(0,75,160,0.08); border: 1px solid rgba(0,75,160,0.2);
  color: var(--caci-blue-light); font-family: var(--font-mono);
  letter-spacing: 0.02em;
}
[data-theme="light"] .al-field-badge { color: var(--caci-blue); }
.al-sensitive-badge {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700;
  background: rgba(198,0,38,0.08); border: 1px solid rgba(198,0,38,0.2);
  color: var(--caci-red); text-transform: uppercase; letter-spacing: 0.05em;
}
.al-value-old {
  font-size: 11.5px; color: var(--text-muted);
  text-decoration: line-through; max-width: 200px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.al-arrow { font-size: 13px; color: var(--text-muted); flex-shrink: 0; }
.al-value-new {
  font-size: 11.5px; color: var(--caci-success); font-weight: 500;
  max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.al-value-new.empty { color: var(--text-muted); font-style: italic; }
.al-value-new.status-active   { color: #22c55e; }
.al-value-new.status-visitor  { color: var(--caci-blue-light); }
.al-value-new.status-inactive { color: var(--text-muted); }

/* ── Load more ─────────────────────────────────────────────── */
.al-load-more {
  display: flex; justify-content: center; padding: 20px 0;
}
.al-load-more-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 24px; border-radius: 99px;
  border: 1px solid var(--border-default);
  background: var(--bg-card); color: var(--text-secondary);
  font-size: 13px; font-weight: 500; cursor: pointer;
  font-family: var(--font-sans);
  transition: all 0.18s;
}
.al-load-more-btn:hover { border-color: var(--border-strong); color: var(--text-primary); }
.al-load-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Empty state ───────────────────────────────────────────── */
.al-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 64px 24px; text-align: center;
  color: var(--text-secondary);
}
.al-empty i { font-size: 3rem; color: var(--border-strong); margin-bottom: 16px; }
.al-empty-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
.al-empty-sub   { font-size: 13px; max-width: 320px; }

/* ── Spinner ───────────────────────────────────────────────── */
.al-spinner {
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid rgba(0,75,160,0.2);
  border-top-color: var(--caci-blue);
  animation: alSpin 0.7s linear infinite; display: inline-block;
}

/* ── Animations ────────────────────────────────────────────── */
@keyframes alFadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes alSpin { to { transform: rotate(360deg); } }
`

function injectCSS(): void {
  if (document.getElementById('al-page-css')) return
  const s = document.createElement('style')
  s.id = 'al-page-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

// ── Field category config ─────────────────────────────────────────────────────

interface FieldCategory {
  key:    string
  label:  string
  icon:   string
  fields: string[]   // empty = all
}

const FIELD_CATEGORIES: FieldCategory[] = [
  { key: 'all',        label: 'All Changes',    icon: 'clock-history',      fields: [] },
  { key: 'info',       label: 'Member Info',    icon: 'person-fill',        fields: ['first_name','last_name','other_names','title','gender','date_of_birth','marital_status','occupation','physical_address'] },
  { key: 'contact',    label: 'Contact',        icon: 'telephone-fill',     fields: ['primary_phone','secondary_phone','email','whatsapp_number','facebook_url','instagram_url'] },
  { key: 'status',     label: 'Status',         icon: 'toggle-on',          fields: ['membership_status','is_active','join_date'] },
  { key: 'pastoral',   label: 'Pastoral',       icon: 'heart-fill',         fields: ['pastoral_notes','flag_reason','flagged_at'] },
  { key: 'photo',      label: 'Photo',          icon: 'image-fill',         fields: ['profile_photo_url'] },
]

const SENSITIVE_FIELDS = new Set(['pastoral_notes','flag_reason','flagged_at'])

// ── Avatar colour ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#004BA0','#C60026','#1a5fb4','#7c3aed','#1a7f37','#9a6700','#0969da']
function actorColor(name: string): string {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function actorInitials(name: string): string {
  const p = name.trim().split(' ')
  return ((p[0]?.[0] ?? '') + (p[p.length - 1]?.[0] ?? '')).toUpperCase()
}

// ── Relative time ─────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)   return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)   return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)    return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

/** Human-readable field label */
function fieldLabel(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/** Format a raw value for display */
function fmtValue(v: string | null, field: string): string {
  if (!v) return '(empty)'
  if (field === 'profile_photo_url') return '[photo]'
  if (field.includes('date') || field === 'changed_at' || field === 'flagged_at') {
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  if (v.length > 60) return v.slice(0, 60) + '…'
  return v
}

// ── Page module ───────────────────────────────────────────────────────────────

const AuditLogsPage: PageModule = { render, destroy }
export default AuditLogsPage

// ── State ─────────────────────────────────────────────────────────────────────

let _container:    HTMLElement | null = null
let _destroyed     = false

let _entries:      AuditLogEntry[] = []
let _totalDB       = 0          // total in DB matching current filter
let _offset        = 0
const PAGE_SIZE    = 50

let _search        = ''
let _category      = 'all'
let _dateFrom      = ''
let _dateTo        = ''
let _loading       = false

// Stat totals (loaded once on render)
let _statTotal     = 0
let _statToday     = 0
let _statWeek      = 0
let _statMembers   = 0

// ── Lifecycle ─────────────────────────────────────────────────────────────────

async function render(container: HTMLElement): Promise<void> {
  _container = container
  _destroyed  = false
  _entries    = []
  _offset     = 0
  _search     = ''
  _category   = 'all'
  _dateFrom   = ''
  _dateTo     = ''

  injectCSS()
  renderSkeleton(container, 'table')
  container.innerHTML = _buildShell()

  try {
    // Load stats + first page in parallel
    const [statsResult, firstPage] = await Promise.all([
      _fetchStats(),
      _fetchPage(0),
    ])
    if (_destroyed) return

    _statTotal   = statsResult.total
    _statToday   = statsResult.today
    _statWeek    = statsResult.week
    _statMembers = statsResult.members

    _entries  = firstPage.entries
    _totalDB  = firstPage.total
    _offset   = firstPage.entries.length

    _renderStats()
    _renderEntries(false)
    _bindEvents()
  } catch (err) {
    if (_destroyed) return
    renderError(container, err, { retry: () => render(container) })
  }
}

function destroy(): void {
  _destroyed = true
  _container = null
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function _fetchPage(offset: number) {
  const category = FIELD_CATEGORIES.find(c => c.key === _category)
  const field = (category && category.fields.length === 1) ? category.fields[0] : undefined

  const result = await listAllAuditLogs({
    search:   _search || undefined,
    field,
    dateFrom: _dateFrom || undefined,
    dateTo:   _dateTo   || undefined,
    limit:    PAGE_SIZE,
    offset,
  })

  // Apply multi-field category filter client-side when fields.length > 1
  if (category && category.fields.length > 1) {
    const set = new Set(category.fields)
    result.entries = result.entries.filter(e => set.has(e.field_changed))
  }

  return result
}

async function _fetchStats(): Promise<{ total: number; today: number; week: number; members: number }> {
  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const week  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString()

  const [total, todayResult, weekResult] = await Promise.all([
    listAllAuditLogs({ limit: 1 }),
    listAllAuditLogs({ dateFrom: today, limit: 1 }),
    listAllAuditLogs({ dateFrom: week,  limit: 200 }),
  ])

  const uniqueMembers = new Set(weekResult.entries.map(e => e.member_id)).size
  return {
    total:   total.total,
    today:   todayResult.total,
    week:    weekResult.total,
    members: uniqueMembers,
  }
}

// ── Shell HTML ────────────────────────────────────────────────────────────────

function _buildShell(): string {
  return /* html */`
<div class="al-page">

  ${renderMembershipTab('audit')}

  <!-- Stat cards -->
  <div class="al-stats" id="al-stats">
    ${[0,1,2,3].map(i => `
    <div class="al-stat" style="animation-delay:${i * 60}ms">
      <div class="al-stat-icon-row">
        <div class="al-stat-icon" id="al-stat-icon-${i}"></div>
        <span class="al-stat-label" id="al-stat-label-${i}">—</span>
      </div>
      <div class="al-stat-value" id="al-stat-val-${i}"><span class="al-spinner"></span></div>
      <div class="al-stat-bar"><div class="al-stat-bar-fill" id="al-stat-bar-${i}" style="width:0%"></div></div>
    </div>`).join('')}
  </div>

  <!-- Toolbar -->
  <div class="al-toolbar">
    <div class="al-search-wrap">
      <i class="bi bi-search"></i>
      <input class="al-search-inp" id="al-search" type="text"
             placeholder="Search member, actor, field…" autocomplete="off">
    </div>

    <div style="flex:1;"></div>

    <input type="date" class="al-date-input" id="al-date-from" title="From date">
    <input type="date" class="al-date-input" id="al-date-to"   title="To date">

    <button class="al-tbtn al-tbtn-primary" id="al-export-btn" title="Export CSV">
      <i class="bi bi-download"></i>
      <span class="al-btn-label">Export CSV</span>
    </button>
  </div>

  <!-- Category chips -->
  <div class="al-chips" id="al-chips">
    ${FIELD_CATEGORIES.map(c => `
    <button class="al-chip${c.key === 'all' ? ' active' : ''}" data-cat="${c.key}">
      <i class="bi bi-${c.icon}"></i> ${c.label}
    </button>`).join('')}
  </div>

  <!-- Results meta -->
  <div class="al-meta">
    <p>Showing <strong id="al-count">—</strong> changes</p>
  </div>

  <!-- Timeline -->
  <div class="al-timeline" id="al-timeline"></div>

  <!-- Load more -->
  <div class="al-load-more" id="al-load-more" style="display:none">
    <button class="al-load-more-btn" id="al-load-more-btn">
      <i class="bi bi-chevron-down"></i>
      Load more
    </button>
  </div>

</div>
`
}

// ── Render stats cards ────────────────────────────────────────────────────────

const STAT_DEFS = [
  { label: 'Total Changes',        icon: 'clock-history',    iconBg: 'rgba(0,75,160,0.1)',        iconColor: 'var(--caci-blue-light)',   barBg: 'var(--caci-blue)',  pct: 100 },
  { label: 'Today',                icon: 'calendar-day',     iconBg: 'rgba(34,197,94,0.1)',        iconColor: '#22c55e',                   barBg: '#22c55e',           pct: 0 },
  { label: 'This Week',            icon: 'calendar-week',    iconBg: 'rgba(240,136,62,0.1)',       iconColor: '#f0883e',                   barBg: '#f0883e',           pct: 0 },
  { label: 'Members Affected',     icon: 'people-fill',      iconBg: 'rgba(124,58,237,0.1)',       iconColor: '#7c3aed',                   barBg: '#7c3aed',           pct: 0 },
]

function _renderStats(): void {
  const values = [_statTotal, _statToday, _statWeek, _statMembers]

  STAT_DEFS.forEach((def, i) => {
    const iconEl  = document.getElementById(`al-stat-icon-${i}`)
    const labelEl = document.getElementById(`al-stat-label-${i}`)
    const valEl   = document.getElementById(`al-stat-val-${i}`)
    const barEl   = document.getElementById(`al-stat-bar-${i}`)

    if (iconEl)  iconEl.innerHTML  = `<i class="bi bi-${def.icon}" style="font-size:15px;color:${def.iconColor};"></i>`
    if (iconEl)  iconEl.style.background = def.iconBg
    if (labelEl) labelEl.textContent = def.label

    const val = values[i]
    if (valEl) valEl.innerHTML = `${val}<span class="al-stat-sub">${i === 1 ? 'changes' : i === 2 ? 'changes' : i === 3 ? 'unique' : 'total'}</span>`

    const pct = _statTotal > 0
      ? i === 0 ? 100
      : i === 1 ? Math.min(100, Math.round(val / _statTotal * 100))
      : i === 2 ? Math.min(100, Math.round(val / _statTotal * 100))
      : Math.min(100, Math.round((_statMembers / Math.max(_statTotal, 1)) * 100))
      : 0

    if (barEl) { barEl.style.width = pct + '%'; barEl.style.background = def.barBg }
  })
}

// ── Render entries (timeline) ─────────────────────────────────────────────────

function _renderEntries(append: boolean): void {
  const tl = document.getElementById('al-timeline')
  if (!tl) return

  // Update meta count
  const countEl = document.getElementById('al-count')
  if (countEl) countEl.textContent = `${_entries.length} of ${_totalDB}`

  if (!_entries.length) {
    tl.innerHTML = `
    <div class="al-empty">
      <i class="bi bi-clock-history"></i>
      <div class="al-empty-title">No audit logs found</div>
      <div class="al-empty-sub">${_search ? 'Try a different search term or clear your filters.' : 'Changes to member records will appear here.'}</div>
    </div>`
    _hideLoadMore()
    return
  }

  const entries = append ? _entries.slice(_offset - PAGE_SIZE) : _entries
  const fragment = entries.map((e, i) => _entryHtml(e, append ? _entries.length - PAGE_SIZE + i : i)).join('')

  if (append) {
    tl.insertAdjacentHTML('beforeend', fragment)
  } else {
    tl.innerHTML = fragment
  }

  // Bind member-link clicks
  tl.querySelectorAll<HTMLElement>('[data-member-id]').forEach(btn => {
    btn.addEventListener('click', () => navigate(`/members/${btn.dataset.memberId}`))
  })

  // Show/hide load more
  if (_entries.length < _totalDB) {
    _showLoadMore()
  } else {
    _hideLoadMore()
  }
}

function _entryHtml(e: AuditLogEntry, animIndex: number): string {
  const actorName = e.changed_by_name ?? 'System'
  const avatarBg  = actorColor(actorName)
  const ini       = actorInitials(actorName)
  const delay     = `${Math.min(animIndex * 30, 300)}ms`
  const isSensitive = SENSITIVE_FIELDS.has(e.field_changed)

  const oldDisplay = fmtValue(e.old_value, e.field_changed)
  const newDisplay = fmtValue(e.new_value, e.field_changed)
  const newColorCls = !e.new_value ? 'empty'
    : e.field_changed === 'membership_status' ? `status-${e.new_value}` : ''

  return /* html */`
<div class="al-entry" style="animation-delay:${delay}">
  <div class="al-actor-avatar" style="background:${avatarBg};" title="${actorName}">${ini}</div>
  <div class="al-entry-body">
    <div class="al-entry-header">
      <span class="al-actor-name">${actorName}</span>
      <span class="al-action-text">updated</span>
      ${e.member_name
        ? `<button class="al-member-link" data-member-id="${e.member_id}">${e.member_name}</button>`
        : `<span class="al-action-text">a member</span>`}
      <span class="al-ts" title="${absoluteTime(e.changed_at)}">${relativeTime(e.changed_at)}</span>
    </div>
    <div class="al-diff">
      <span class="al-field-badge">${fieldLabel(e.field_changed)}</span>
      ${isSensitive ? `<span class="al-sensitive-badge"><i class="bi bi-lock-fill"></i> Sensitive</span>` : ''}
      ${e.old_value !== null
        ? `<span class="al-value-old" title="${e.old_value ?? ''}">${oldDisplay}</span>
           <span class="al-arrow">→</span>`
        : ''}
      <span class="al-value-new ${newColorCls}" title="${e.new_value ?? ''}">${newDisplay}</span>
    </div>
  </div>
</div>`
}

function _showLoadMore(): void {
  const wrap = document.getElementById('al-load-more')
  if (wrap) wrap.style.display = 'flex'
}
function _hideLoadMore(): void {
  const wrap = document.getElementById('al-load-more')
  if (wrap) wrap.style.display = 'none'
}

// ── Events ────────────────────────────────────────────────────────────────────

function _bindEvents(): void {
  const container = _container
  if (!container) return

  // Tab bar
  bindMembershipTabEvents(container)

  // Search (debounced)
  const searchInp = container.querySelector<HTMLInputElement>('#al-search')
  if (searchInp) {
    searchInp.addEventListener('input', debounce(() => {
      _search = searchInp.value.trim()
      _reload()
    }, 350))
  }

  // Date range
  const dateFrom = container.querySelector<HTMLInputElement>('#al-date-from')
  const dateTo   = container.querySelector<HTMLInputElement>('#al-date-to')
  if (dateFrom) dateFrom.addEventListener('change', () => { _dateFrom = dateFrom.value; _reload() })
  if (dateTo)   dateTo.addEventListener('change',   () => { _dateTo   = dateTo.value;   _reload() })

  // Category chips
  container.querySelectorAll<HTMLElement>('.al-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.al-chip').forEach(c => c.classList.remove('active'))
      chip.classList.add('active')
      _category = chip.dataset.cat ?? 'all'
      _reload()
    })
  })

  // Export CSV
  const exportBtn = container.querySelector<HTMLElement>('#al-export-btn')
  if (exportBtn) exportBtn.addEventListener('click', _exportCSV)

  // Load more
  const loadMoreBtn = container.querySelector<HTMLElement>('#al-load-more-btn')
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', _loadMore)
}

async function _reload(): Promise<void> {
  if (_loading) return
  _loading = true
  _entries = []
  _offset  = 0

  const tl = document.getElementById('al-timeline')
  if (tl) tl.innerHTML = `<div style="display:flex;justify-content:center;padding:40px;"><span class="al-spinner"></span></div>`
  _hideLoadMore()

  try {
    const result = await _fetchPage(0)
    if (_destroyed) return
    _entries = result.entries
    _totalDB = result.total
    _offset  = result.entries.length
    _renderEntries(false)
  } catch (err) {
    const tl = document.getElementById('al-timeline')
    if (tl) tl.innerHTML = `<div class="al-empty"><i class="bi bi-exclamation-triangle"></i><div class="al-empty-title">Failed to load logs</div><div class="al-empty-sub">${(err as Error).message}</div></div>`
  } finally {
    _loading = false
  }
}

async function _loadMore(): Promise<void> {
  if (_loading || _entries.length >= _totalDB) return
  _loading = true

  const btn = document.getElementById('al-load-more-btn') as HTMLButtonElement | null
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="al-spinner"></span> Loading…' }

  try {
    const result = await _fetchPage(_offset)
    if (_destroyed) return
    _entries.push(...result.entries)
    _totalDB = result.total
    _offset  = _entries.length
    _renderEntries(true)
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-chevron-down"></i> Load more' }
    _loading = false
  }
}

// ── CSV Export ────────────────────────────────────────────────────────────────

async function _exportCSV(): Promise<void> {
  const btn = document.getElementById('al-export-btn') as HTMLButtonElement | null
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="al-spinner"></span> <span class="al-btn-label">Exporting…</span>' }

  try {
    // Fetch all (up to 5000) with current filters applied
    const { entries } = await listAllAuditLogs({
      search:   _search   || undefined,
      dateFrom: _dateFrom || undefined,
      dateTo:   _dateTo   || undefined,
      limit:    5000,
      offset:   0,
    })

    const headers = ['Date & Time', 'Actor', 'Member', 'Field Changed', 'Old Value', 'New Value']
    const rows = entries.map(e => [
      absoluteTime(e.changed_at),
      e.changed_by_name ?? 'System',
      e.member_name ?? e.member_id,
      fieldLabel(e.field_changed),
      e.old_value ?? '',
      e.new_value ?? '',
    ])

    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `audit-logs-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-download"></i> <span class="al-btn-label">Export CSV</span>' }
  }
}
