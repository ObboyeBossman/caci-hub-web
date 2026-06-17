// src/modules/membership/pages/MemberList.ts
// Member directory — stat cards, tab bar, toolbar, grid/list view, stat-filter panel.
// Mirrors: caci-hub-members.html reference design.
// Data: listMembers() + getMemberCounts() from repository.ts
// Bootstrap Icons replace Material Symbols from the reference HTML.

import type { PageModule } from '../../../types/module.types'
import { navigate } from '@core/router'
import { getCurrentUser } from '@core/auth'
import { can } from '@core/authorization/authorization-service'
import { listMembers, getMemberCounts } from '../repository'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { debounce } from '@shared/utils/debounce'
import { avatarColor, initials, fmtDate, formatName } from '../utils/member-helpers'
import type { MemberView, MemberFilter } from '../../../types/member.types'
import type { WorkspaceTab } from '@shell/WorkspaceShell'

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = /* css */`
/* ═══════════════════════════════════════════════════════════════════
   MEMBER LIST PAGE
═══════════════════════════════════════════════════════════════════ */

/* ── Stat cards ─────────────────────────────────────────────────── */
.ml-stats-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
}
@media (min-width: 640px) {
  .ml-stats-grid { grid-template-columns: repeat(4, 1fr); gap: 16px; }
}
.ml-stat-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 16px; padding: 16px;
  cursor: pointer; position: relative; overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
  user-select: none;
}
.ml-stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-overlay); }
.ml-stat-card:active { transform: translateY(0) scale(0.98); }
.ml-stat-card.active-filter {
  border-width: 1.5px;
  transform: translateY(-2px);
}
.ml-stat-icon {
  width: 32px; height: 32px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; flex-shrink: 0;
}
.ml-stat-label {
  font-size: 9.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.09em; color: var(--text-secondary);
}
.ml-stat-value {
  font-size: 24px; font-weight: 700; color: var(--text-primary);
  line-height: 1.1;
}
.ml-stat-bar {
  height: 2px; border-radius: 99px;
  background: var(--border-default); overflow: hidden; margin-top: 8px;
}
.ml-stat-bar-fill { height: 100%; border-radius: 99px; }
.ml-click-hint {
  position: absolute; top: 10px; right: 10px;
  font-size: 9.5px; color: var(--text-muted);
  opacity: 0; transition: opacity 0.2s;
  display: flex; align-items: center; gap: 3px;
}
.ml-stat-card:hover .ml-click-hint { opacity: 1; }
.ml-stat-card.active-filter .ml-click-hint { opacity: 0; }

/* ── Toolbar ────────────────────────────────────────────────────── */
.ml-toolbar {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 16px; padding: 10px 14px;
  display: flex; align-items: center; gap: 10px;
  box-shadow: var(--shadow-raised);
  flex-wrap: wrap;
}
.ml-search-wrap {
  display: flex; align-items: center; gap: 9px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: 10px; padding: 0 12px; height: 40px;
  flex: 1; max-width: 420px; min-width: 0;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.ml-search-wrap:focus-within {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.ml-search-wrap i { font-size: 15px; color: var(--text-muted); flex-shrink: 0; }
.ml-search-wrap:focus-within i { color: var(--caci-blue); }
.ml-search-inp {
  background: transparent; border: none; outline: none;
  font-size: 13px; color: var(--text-primary);
  font-family: var(--font-sans); width: 100%;
  caret-color: var(--caci-blue);
}
.ml-search-inp::placeholder { color: var(--text-muted); }
.ml-sort-wrap { position: relative; display: flex; align-items: center; }
.ml-sort-wrap i {
  position: absolute; left: 10px; font-size: 14px;
  color: var(--text-secondary); pointer-events: none; z-index: 1;
}
.ml-sort-select {
  appearance: none; -webkit-appearance: none;
  padding: 0 32px 0 30px; height: 40px;
  border-radius: 10px; border: 1px solid var(--border-default);
  background: var(--bg-page);
  color: var(--text-primary); font-size: 12.5px;
  font-family: var(--font-sans); font-weight: 500;
  cursor: pointer; outline: none; min-width: 168px;
  transition: border-color 0.2s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236e7681' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center;
}
.ml-sort-select:focus { border-color: var(--border-focus); }
.ml-sort-select option { background: var(--bg-card); color: var(--text-primary); }
.ml-tbtn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 0 14px; height: 40px; border-radius: 10px;
  font-size: 12.5px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--border-default); background: var(--bg-page);
  color: var(--text-secondary); transition: all 0.18s;
  white-space: nowrap; font-family: var(--font-sans);
}
.ml-tbtn i { font-size: 15px; }
.ml-tbtn:hover { border-color: var(--border-strong); color: var(--text-primary); transform: translateY(-1px); }
.ml-tbtn:active { transform: translateY(0); }
.ml-tbtn-primary {
  background: var(--caci-blue); border-color: var(--caci-blue-dim);
  color: #fff; font-weight: 600;
  box-shadow: 0 2px 10px rgba(0,75,160,0.3);
}
.ml-tbtn-primary:hover {
  background: var(--caci-blue-light); border-color: var(--caci-blue);
  color: #fff; box-shadow: 0 5px 18px rgba(0,75,160,0.4);
}
@media (min-width: 641px) and (max-width: 860px) {
  .ml-btn-label { display: none; }
  .ml-tbtn { padding: 0 10px; }
  .ml-sort-select { min-width: 42px; width: 42px; padding: 0; color: transparent;
    background-image: none; text-align: center; }
  .ml-sort-wrap i { left: 50%; transform: translateX(-50%); }
}
@media (max-width: 640px) {
  .ml-toolbar { flex-wrap: wrap; gap: 8px; }
  .ml-search-wrap { order: 0; width: 100%; flex: none; max-width: none; }
  .ml-mob-search-btn { display: none !important; }
  #ml-toolbar-actions { order: 1; margin-left: auto; display: flex; align-items: center; gap: 8px; }
  .ml-btn-label { display: none; }
  .ml-tbtn { padding: 0 !important; width: 42px; height: 42px; border-radius: 10px; }
  .ml-sort-select { min-width: 42px; width: 42px; padding: 0; color: transparent; background-image: none; }
  .ml-sort-wrap i { left: 50%; transform: translateX(-50%); }
  .ml-tbtn-primary { width: 42px; height: 42px; }
}

/* ── Filter banner ──────────────────────────────────────────────── */
.ml-filter-banner {
  display: none; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: 12px;
  background: rgba(0,75,160,0.06); border: 1px solid rgba(0,75,160,0.2);
}
.ml-filter-banner.show { display: flex; }
.ml-filter-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 99px;
  background: rgba(0,75,160,0.12); border: 1px solid rgba(0,75,160,0.3);
  font-size: 11.5px; font-weight: 600; color: var(--caci-blue);
}
[data-theme="dark"] .ml-filter-pill { color: var(--caci-blue-light); }
.ml-clear-filter {
  margin-left: auto; display: flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 7px; border: 1px solid var(--border-default);
  background: transparent; color: var(--text-secondary); font-size: 11.5px;
  font-family: var(--font-sans); cursor: pointer; transition: all 0.18s;
}
.ml-clear-filter:hover { border-color: var(--border-strong); color: var(--text-primary); }

/* ── List panel (stat-filter view) ─────────────────────────────── */
.ml-list-panel {
  display: none; flex-direction: column;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 16px; overflow: hidden;
}
.ml-list-panel.show { display: flex; }
.ml-list-panel-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; border-bottom: 1px solid var(--border-default);
  background: rgba(0,0,0,0.01);
}
.ml-list-panel-icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.ml-list-panel-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }

/* ── List row ───────────────────────────────────────────────────── */
.ml-list-row {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 12px; padding: 11px 14px;
  display: flex; align-items: center; gap: 12px;
  transition: border-color 0.18s, transform 0.18s, box-shadow 0.18s;
  cursor: pointer;
}
.ml-list-row:hover {
  border-color: rgba(0,75,160,0.35); transform: translateX(3px);
  box-shadow: 0 4px 14px rgba(0,0,0,0.08);
}
.ml-list-avatar {
  width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: #fff;
  border: 2px solid var(--bg-card);
  box-shadow: 0 0 0 2px rgba(34,197,94,0.5);
}
.ml-status-dot {
  position: absolute; bottom: -1px; right: -1px;
  width: 11px; height: 11px; border-radius: 50%;
  border: 2px solid var(--bg-card);
}

/* ── Grid cards ─────────────────────────────────────────────────── */
.ml-grid {
  display: grid; gap: 14px;
  grid-template-columns: repeat(2, 1fr);
}
@media (max-width: 639px)  { .ml-grid { grid-template-columns: 1fr; gap: 8px; } }
@media (min-width: 640px)  { .ml-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1024px) { .ml-grid { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 1280px) { .ml-grid { grid-template-columns: repeat(5, 1fr); } }

.ml-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 18px; padding: 18px 16px 16px;
  display: flex; flex-direction: column; align-items: center;
  text-align: center; position: relative; overflow: hidden;
  transition: transform 0.22s, box-shadow 0.22s, border-color 0.22s;
  cursor: pointer;
}
.ml-card:hover {
  transform: translateY(-4px);
  border-color: rgba(0,75,160,0.3);
  box-shadow: 0 12px 36px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,75,160,0.1);
}
.ml-card-avatar {
  width: 68px; height: 68px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 700; color: #fff;
  margin-bottom: 14px; position: relative;
  box-shadow: 0 0 0 3px var(--bg-card), 0 0 0 5px rgba(34,197,94,0.4);
}
.ml-gender-badge {
  position: absolute; bottom: -1px; right: -1px;
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--bg-card); border: 2px solid var(--bg-page);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px;
}
.ml-role-pill {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; border-radius: 99px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  font-size: 10.5px; color: var(--text-secondary); font-weight: 500;
  margin-bottom: 14px;
}
.ml-card-btn {
  flex: 1; padding: 7px 0; border-radius: 8px;
  font-size: 12px; font-weight: 500; cursor: pointer;
  transition: all 0.15s; font-family: var(--font-sans);
  border: 1px solid var(--border-default);
}
.ml-card-btn:active { transform: scale(0.97); }
.ml-card-btn-view {
  background: var(--bg-page); color: var(--text-primary);
}
.ml-card-btn-view:hover { background: var(--bg-hover); border-color: var(--border-strong); }
.ml-card-btn-edit {
  background: rgba(0,75,160,0.08); border-color: rgba(0,75,160,0.25);
  color: var(--caci-blue);
}
.ml-card-btn-edit:hover { background: rgba(0,75,160,0.14); border-color: rgba(0,75,160,0.5); }

/* Mobile card row (≤639px swap) */
@media (max-width: 639px) {
  .ml-card { display: none !important; }
  .ml-card-mob { display: flex !important; }
}
.ml-card-mob {
  display: none;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 12px; padding: 11px 13px;
  align-items: center; gap: 11px;
  transition: border-color 0.18s, box-shadow 0.18s;
}
.ml-card-mob:hover { border-color: rgba(0,75,160,0.3); box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
.ml-card-mob-avatar {
  width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: #fff;
  box-shadow: 0 0 0 2px var(--bg-card), 0 0 0 3.5px rgba(34,197,94,0.45);
}
.ml-mob-btn {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 9px;
  cursor: pointer; flex-shrink: 0;
  transition: all 0.15s cubic-bezier(0.16,1,0.3,1);
  border: 1px solid var(--border-default); background: var(--bg-page);
  color: var(--text-secondary);
}
.ml-mob-btn i { font-size: 16px; }
.ml-mob-btn:hover { background: var(--bg-hover); border-color: var(--border-strong); color: var(--text-primary); }
.ml-mob-btn:active { transform: scale(0.93); }
.ml-mob-btn-edit {
  background: rgba(0,75,160,0.08); border-color: rgba(0,75,160,0.25);
  color: var(--caci-blue);
}
.ml-mob-btn-edit:hover { background: rgba(0,75,160,0.15); border-color: rgba(0,75,160,0.5); }

/* ── Empty / results ────────────────────────────────────────────── */
.ml-results-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 2px; font-size: 12px; color: var(--text-secondary);
}
.ml-results-bar strong { color: var(--text-primary); }

/* ── Animations ─────────────────────────────────────────────────── */
@keyframes ml-fade-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ml-slide-right {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
.ml-fade-up   { animation: ml-fade-up 0.42s cubic-bezier(0.16,1,0.3,1) both; }
.ml-slide-right { animation: ml-slide-right 0.35s cubic-bezier(0.16,1,0.3,1) both; }
`

function injectCSS(): void {
  if (document.getElementById('ml-css')) return
  const s = document.createElement('style')
  s.id = 'ml-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type SortKey = 'name_az' | 'name_za' | 'newest' | 'oldest'
type FilterKey = 'all' | 'active' | 'visitor' | 'new' | null

interface StatConfig {
  key: string
  label: string
  sub: string
  icon: string          // Bootstrap icon class
  iconColor: string
  iconBg: string
  accentBorder: string
  accentGlow: string
  pill: string
}

const STAT_CONFIGS: StatConfig[] = [
  {
    key: 'all',    label: 'Total Members',     sub: 'Showing every member',
    icon: 'bi-people-fill',     iconColor: 'var(--caci-blue)',
    iconBg: 'rgba(0,75,160,0.1)',
    accentBorder: 'var(--caci-blue)', accentGlow: 'rgba(0,75,160,0.18)', pill: 'All Members',
  },
  {
    key: 'active', label: 'Active',            sub: 'Members with active status',
    icon: 'bi-check-circle-fill', iconColor: 'var(--caci-success)',
    iconBg: 'rgba(26,127,55,0.1)',
    accentBorder: '#22c55e', accentGlow: 'rgba(34,197,94,0.18)', pill: 'Active',
  },
  {
    key: 'visitor', label: 'Visitors',         sub: 'First-time and returning visitors',
    icon: 'bi-person-plus-fill', iconColor: '#f0883e',
    iconBg: 'rgba(240,136,62,0.1)',
    accentBorder: '#f0883e', accentGlow: 'rgba(240,136,62,0.18)', pill: 'Visitors',
  },
  {
    key: 'new',    label: 'New (30d)',          sub: 'Joined within the last 30 days',
    icon: 'bi-graph-up-arrow',  iconColor: 'var(--caci-blue-light)',
    iconBg: 'rgba(0,75,160,0.1)',
    accentBorder: 'var(--caci-blue-light)', accentGlow: 'rgba(77,159,255,0.2)', pill: 'New (30 days)',
  },
]

const STATUS_DOT: Record<string, string> = {
  active:   '#22c55e',
  inactive: '#6e7681',
  visitor:  '#f0883e',
  prospect: '#004BA0',
  transfer: '#9a6700',
  deceased: '#484f58',
}

function statusDotColor(s: string): string { return STATUS_DOT[s] ?? '#6e7681' }

function membershipBadgeHtml(status: string): string {
  const map: Record<string, [string, string]> = {
    active:   ['var(--caci-success-bg)', 'var(--caci-success)'],
    inactive: ['var(--n100)',             'var(--n600)'],
    visitor:  ['var(--caci-blue-bg)',     'var(--caci-blue-dim)'],
    prospect: ['var(--caci-warning-bg)', 'var(--caci-warning)'],
    transfer: ['var(--caci-blue-bg)',     'var(--caci-blue-mid)'],
    deceased: ['var(--n100)',             'var(--n700)'],
  }
  const [bg, fg] = map[status] ?? ['var(--n100)', 'var(--n600)']
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600;background:${bg};color:${fg};">${label}</span>`
}

function genderIcon(g: string): string {
  return g === 'male' ? '♂' : g === 'female' ? '♀' : '·'
}
function genderColor(g: string): string {
  return g === 'male' ? 'var(--caci-blue)' : g === 'female' ? '#f778ba' : 'var(--text-muted)'
}

export function createMembersTab(): WorkspaceTab {
  return {
    id: 'members',
    label: 'All Members',
    icon: 'people-fill',
    render,
    destroy,
  }
}

// ── State ─────────────────────────────────────────────────────────────────────

let _container: HTMLElement | null = null
let _members: MemberView[] = []
let _counts = { total: 0, active: 0, visitor: 0, new: 0 }
let _activeFilter: FilterKey = null
let _searchQuery = ''
let _sortKey: SortKey = 'newest'
let _destroyed = false
let _listeners: Array<[HTMLElement, string, EventListener]> = []

// ── Lifecycle ─────────────────────────────────────────────────────────────────

async function render(container: HTMLElement): Promise<void> {
  _container = container
  _destroyed  = false
  _listeners  = []
  injectCSS()

  // Skeleton immediately
  renderSkeleton(container, 'table')

  // Inject shell HTML
  container.innerHTML = buildShell()

  try {
    // Parallel fetch
    const [members, counts] = await Promise.all([
      listMembers({}, { limit: 200, sortBy: 'last_name', ascending: true }),
      getMemberCounts(),
    ])
    if (_destroyed) return
    _members = members
    _counts  = counts
    _updateStatCounts()
    _renderAll()
    _bindEvents()
  } catch (err) {
    if (_destroyed) return
    renderError(container, err, { retry: () => render(container) })
  }
}

function destroy(): void {
  _destroyed = true
  _listeners.forEach(([el, ev, fn]) => el.removeEventListener(ev, fn))
  _listeners = []
  _container = null
}

// ── Shell HTML ────────────────────────────────────────────────────────────────

function buildShell(): string {
  const user = getCurrentUser()
  const canCreate = user ? can(user, 'members.create') : false
  const canExport = user ? can(user, 'members.export') : false

  return /* html */`
<div class="ml-wrap">

  <!-- Stat cards -->
  <div class="ml-stats-grid" id="ml-stats-grid" style="margin-bottom:20px;">
    ${STAT_CONFIGS.map((cfg, i) => `
    <div class="ml-stat-card ml-fade-up" style="animation-delay:${i * 50}ms"
         data-stat-key="${cfg.key}"
         data-accent-border="${cfg.accentBorder}"
         data-accent-glow="${cfg.accentGlow}">
      <div class="ml-click-hint"><i class="bi bi-funnel" style="font-size:10px;"></i> Filter</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div class="ml-stat-icon" style="background:${cfg.iconBg};">
          <i class="bi ${cfg.icon}" style="color:${cfg.iconColor};"></i>
        </div>
        <span class="ml-stat-label">${cfg.label}</span>
      </div>
      <div class="ml-stat-value" id="ml-stat-${cfg.key}">—</div>
      <div class="ml-stat-bar">
        <div class="ml-stat-bar-fill" style="background:${cfg.accentBorder};width:0%;"
             id="ml-stat-bar-${cfg.key}"></div>
      </div>
    </div>`).join('')}
  </div>

  <div style="display:flex;flex-direction:column;gap:12px;">

    <!-- Filter banner -->
    <div class="ml-filter-banner" id="ml-filter-banner">
      <i class="bi bi-funnel-fill" style="font-size:15px;color:var(--caci-blue);flex-shrink:0;"></i>
      <span style="font-size:12px;color:var(--text-secondary);">Filtered by</span>
      <span class="ml-filter-pill" id="ml-filter-pill-text">Active</span>
      <span style="font-size:11px;color:var(--text-muted);" id="ml-filter-count-text"></span>
      <button class="ml-clear-filter" id="ml-clear-filter-btn">
        <i class="bi bi-x" style="font-size:13px;"></i> Clear filter
      </button>
    </div>

    <!-- Toolbar -->
    <div class="ml-toolbar ml-fade-up" style="animation-delay:220ms;">
      <div class="ml-search-wrap">
        <i class="bi bi-search"></i>
        <input class="ml-search-inp" id="ml-search-inp" type="text"
               placeholder="Search members…" autocomplete="off">
        <button id="ml-search-clear" style="display:none;background:none;border:none;
          cursor:pointer;color:var(--text-muted);padding:0;font-size:13px;">
          <i class="bi bi-x-circle-fill"></i>
        </button>
      </div>
      <button id="ml-mob-search-btn" class="ml-tbtn ml-mob-search-btn"
              style="display:none;width:40px;padding:0;">
        <i class="bi bi-search" style="font-size:15px;"></i>
      </button>

      <div style="flex: 1;"></div>
      
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;" id="ml-toolbar-actions">
        <div class="ml-sort-wrap">
          <i class="bi bi-arrow-down-up"></i>
          <select class="ml-sort-select" id="ml-sort-select">
            <option value="newest">Joined (Newest)</option>
            <option value="oldest">Joined (Oldest)</option>
            <option value="name_az">Name (A–Z)</option>
            <option value="name_za">Name (Z–A)</option>
          </select>
        </div>
        ${canExport ? `
        <button class="ml-tbtn" id="ml-export-btn" title="Export">
          <i class="bi bi-download"></i>
          <span class="ml-btn-label">Export</span>
        </button>` : ''}
        ${canCreate ? `
        <button class="ml-tbtn ml-tbtn-primary" id="ml-add-btn" title="Add Member">
          <i class="bi bi-person-plus-fill"></i>
          <span class="ml-btn-label">Add Member</span>
        </button>` : ''}
      </div>
    </div>

    <!-- Results bar -->
    <div class="ml-results-bar ml-fade-up" style="animation-delay:260ms;">
      <p>Showing <strong id="ml-results-count">—</strong> members</p>
      <p id="ml-page-info" style="color:var(--text-muted);font-size:11.5px;"></p>
    </div>

    <!-- List panel (stat-filter view) -->
    <div class="ml-list-panel" id="ml-list-panel">
      <div class="ml-list-panel-header">
        <div class="ml-list-panel-icon" id="ml-panel-icon-wrap">
          <i class="bi" id="ml-panel-icon" style="font-size:17px;"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <h2 style="font-size:13px;font-weight:600;color:var(--text-primary);"
              id="ml-panel-title">Active Members</h2>
          <p style="font-size:11px;color:var(--text-secondary);margin-top:2px;"
             id="ml-panel-sub">Members with active status</p>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:11.5px;color:var(--text-secondary);"
                id="ml-panel-count"></span>
          <button class="ml-tbtn" id="ml-panel-clear-btn"
                  style="height:32px;padding:0 10px;font-size:11.5px;">
            <i class="bi bi-x" style="font-size:13px;"></i> Clear
          </button>
        </div>
      </div>
      <div class="ml-list-panel-body" id="ml-list-panel-body"></div>
    </div>

    <!-- Grid / card list -->
    <div class="ml-grid" id="ml-grid"></div>

  </div>
</div>
`
}

// ── Stat counts & bars ────────────────────────────────────────────────────────

function _updateStatCounts(): void {
  const { total, active, visitor, new: newCount } = _counts
  const values: Record<string, number> = { all: total, active, visitor, new: newCount }

  STAT_CONFIGS.forEach(cfg => {
    const val = values[cfg.key] ?? 0
    const el  = document.getElementById(`ml-stat-${cfg.key}`)
    const bar = document.getElementById(`ml-stat-bar-${cfg.key}`)
    if (el)  el.textContent = String(val)
    if (bar) bar.style.width = total > 0 ? `${Math.round((val / total) * 100)}%` : '0%'
  })

  const tabCount = document.getElementById('ml-total-tab-count')
  if (tabCount) tabCount.textContent = String(total)
}

// ── Filter + Sort ─────────────────────────────────────────────────────────────

function _getFiltered(): MemberView[] {
  let list = [..._members]

  // Stat filter
  if (_activeFilter && _activeFilter !== 'all') {
    if (_activeFilter === 'new') {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 30)
      list = list.filter(m => {
        const date = m.join_date ?? m.created_at
        return date ? new Date(date) >= cutoff : false
      })
    } else {
      list = list.filter(m => m.membership_status === _activeFilter)
    }
  }

  // Search
  if (_searchQuery) {
    const q = _searchQuery.toLowerCase()
    list = list.filter(m =>
      (m.first_name ?? '').toLowerCase().includes(q) ||
      (m.last_name  ?? '').toLowerCase().includes(q) ||
      (m.membership_number ?? '').toLowerCase().includes(q) ||
      (m.occupation ?? '').toLowerCase().includes(q)
    )
  }

  // Sort
  switch (_sortKey) {
    case 'name_az': list.sort((a, b) => (a.last_name ?? '').localeCompare(b.last_name ?? '')); break
    case 'name_za': list.sort((a, b) => (b.last_name ?? '').localeCompare(a.last_name ?? '')); break
    case 'newest':  list.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()); break
    case 'oldest':  list.sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()); break
  }

  return list
}

// ── Render all ────────────────────────────────────────────────────────────────

function _renderAll(): void {
  const list       = _getFiltered()
  const isFiltered = _activeFilter !== null
  const cfg        = STAT_CONFIGS.find(c => c.key === _activeFilter)

  // Results count
  const countEl = document.getElementById('ml-results-count')
  if (countEl) countEl.textContent = String(list.length)

  // Filter banner
  const banner = document.getElementById('ml-filter-banner')
  const pillEl = document.getElementById('ml-filter-pill-text')
  const cntEl  = document.getElementById('ml-filter-count-text')
  if (banner && cfg && _activeFilter !== null) {
    banner.classList.add('show')
    if (pillEl) pillEl.textContent = cfg.pill
    if (cntEl)  cntEl.textContent  = `${list.length} result${list.length !== 1 ? 's' : ''}`
  } else {
    banner?.classList.remove('show')
  }

  // List panel vs grid
  const listPanel = document.getElementById('ml-list-panel')
  const grid      = document.getElementById('ml-grid')
  if (isFiltered && cfg) {
    // Update panel header
    const iconWrap = document.getElementById('ml-panel-icon-wrap')
    const iconEl   = document.getElementById('ml-panel-icon')
    const titleEl  = document.getElementById('ml-panel-title')
    const subEl    = document.getElementById('ml-panel-sub')
    const panelCnt = document.getElementById('ml-panel-count')
    if (iconWrap) iconWrap.style.background = cfg.iconBg
    if (iconEl)   { iconEl.className = `bi ${cfg.icon}`; iconEl.style.color = cfg.iconColor }
    if (titleEl)  titleEl.textContent = cfg.label
    if (subEl)    subEl.textContent   = cfg.sub
    if (panelCnt) panelCnt.textContent = `${list.length} member${list.length !== 1 ? 's' : ''}`

    listPanel?.classList.add('show')
    if (grid) grid.style.display = 'none'
    _renderListPanel(list)
  } else {
    listPanel?.classList.remove('show')
    if (grid) grid.style.display = ''
    _renderGrid(list)
  }
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function _renderGrid(list: MemberView[]): void {
  const grid = document.getElementById('ml-grid')
  if (!grid) return

  if (!list.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;" class="empty-state">
        <i class="bi bi-search empty-state-icon"></i>
        <div class="empty-state-title">No members found</div>
        <div class="empty-state-message">${_searchQuery ? 'Try a different search term.' : 'No members have been added yet.'}</div>
        ${_searchQuery ? `<button class="btn btn-outline" id="ml-clear-search-empty">Clear search</button>` : ''}
      </div>`
    if (_searchQuery) {
      document.getElementById('ml-clear-search-empty')
        ?.addEventListener('click', _clearSearch)
    }
    return
  }

  grid.innerHTML = list.map((m, i) => _gridCard(m, i)).join('')

  // Bind card buttons
  grid.querySelectorAll<HTMLElement>('[data-member-view]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      navigate(`/members/${btn.dataset.memberView}`)
    })
  })
  grid.querySelectorAll<HTMLElement>('[data-member-edit]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      navigate(`/members/${btn.dataset.memberEdit}/edit`)
    })
  })
  // Card click → view
  grid.querySelectorAll<HTMLElement>('.ml-card, .ml-card-mob').forEach(card => {
    card.addEventListener('click', () => {
      const id = (card as HTMLElement).dataset.memberId
      if (id) navigate(`/members/${id}`)
    })
  })
}

function _gridCard(m: MemberView, i: number): string {
  const user = getCurrentUser()
  const canEdit = user ? can(user, 'members.edit') : false
  const ini  = initials(m.first_name ?? '', m.last_name ?? '')
  const fullName = formatName(m.first_name ?? '', m.last_name ?? '', m.title)
  const bg   = avatarColor(fullName)
  const avatarStyle = m.profile_photo_url
    ? `background-image:url(${m.profile_photo_url});background-size:cover;background-position:center;color:transparent;`
    : `background:${bg};`
  const avatarContent = m.profile_photo_url ? '' : ini
  const gi   = genderIcon(m.gender ?? '')
  const gc   = genderColor(m.gender ?? '')
  const dot  = statusDotColor(m.membership_status ?? '')
  const delay = Math.min(i * 40, 440)

  return /* html */`
  <!-- Desktop card -->
  <div class="ml-card ml-fade-up" style="animation-delay:${delay}ms;" data-member-id="${m.id}">
    <div style="width:100%;display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <input type="checkbox" style="width:15px;height:15px;accent-color:var(--caci-blue);cursor:pointer;"
             onclick="event.stopPropagation()">
      <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;
                     padding:2px 6px;border-radius:5px;font-size:13px;letter-spacing:2px;"
              onclick="event.stopPropagation()" title="More">•••</button>
    </div>
    <div class="ml-card-avatar" style="${avatarStyle}">
      ${avatarContent}
      <div class="ml-gender-badge" style="color:${gc};">${gi}</div>
    </div>
    <h3 style="font-size:13.5px;font-weight:600;color:var(--text-primary);
               margin-bottom:3px;line-height:1.3;
               overflow:hidden;text-overflow:ellipsis;
               display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
      ${fullName}
    </h3>
    <p style="font-size:9.5px;color:var(--text-muted);font-family:var(--font-mono);
              margin-bottom:10px;letter-spacing:0.04em;
              overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">
      ${m.membership_number ?? '—'}
    </p>
    <div class="ml-role-pill">
      <i class="bi bi-person" style="font-size:10px;color:var(--caci-blue);"></i>
      <span>${m.occupation ?? 'Member'}</span>
    </div>
    <div style="display:flex;gap:8px;width:100%;
                padding-top:12px;border-top:1px solid var(--border-default);">
      <button class="ml-card-btn ml-card-btn-view" data-member-view="${m.id}"
              onclick="event.stopPropagation()">View</button>
      ${canEdit ? `
      <button class="ml-card-btn ml-card-btn-edit" data-member-edit="${m.id}"
              onclick="event.stopPropagation()">Edit</button>` : ''}
    </div>
  </div>

  <!-- Mobile row -->
  <div class="ml-card-mob ml-fade-up" style="animation-delay:${delay}ms;" data-member-id="${m.id}">
    <div style="position:relative;flex-shrink:0;">
      <div class="ml-card-mob-avatar" style="${avatarStyle}">${avatarContent}</div>
      <div style="position:absolute;bottom:-2px;right:-2px;width:16px;height:16px;
                  border-radius:50%;background:var(--bg-card);border:2px solid var(--bg-card);
                  display:flex;align-items:center;justify-content:center;font-size:10px;color:${gc};">${gi}</div>
    </div>
    <div style="flex:1;min-width:0;">
      <h3 style="font-size:13.5px;font-weight:600;color:var(--text-primary);
                 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;">
        ${fullName}
      </h3>
      <p style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;">
        ${m.membership_number ?? '—'}
      </p>
      <div style="font-size:11px;color:var(--text-secondary);display:flex;align-items:center;gap:4px;">
        <i class="bi bi-person" style="font-size:11px;"></i>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.occupation ?? 'Member'}</span>
      </div>
    </div>
    <div style="display:flex;gap:7px;flex-shrink:0;">
      <button class="ml-mob-btn" data-member-view="${m.id}"
              onclick="event.stopPropagation()" title="View">
        <i class="bi bi-eye"></i>
      </button>
      ${canEdit ? `
      <button class="ml-mob-btn ml-mob-btn-edit" data-member-edit="${m.id}"
              onclick="event.stopPropagation()" title="Edit">
        <i class="bi bi-pencil"></i>
      </button>` : ''}
    </div>
  </div>`
}

// ── List panel ────────────────────────────────────────────────────────────────

function _renderListPanel(list: MemberView[]): void {
  const body = document.getElementById('ml-list-panel-body')
  if (!body) return

  if (!list.length) {
    body.innerHTML = `
      <div class="empty-state" style="padding:40px 20px;">
        <i class="bi bi-people empty-state-icon"></i>
        <div class="empty-state-title">No members in this category</div>
        <div class="empty-state-message">Try a different filter or add new members.</div>
      </div>`
    return
  }

  body.innerHTML = list.map((m, i) => _listRow(m, i)).join('')

  body.querySelectorAll<HTMLElement>('[data-member-view]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); navigate(`/members/${btn.dataset.memberView}`) })
  })
  body.querySelectorAll<HTMLElement>('[data-member-edit]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); navigate(`/members/${btn.dataset.memberEdit}/edit`) })
  })
  body.querySelectorAll<HTMLElement>('.ml-list-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = (row as HTMLElement).dataset.memberId
      if (id) navigate(`/members/${id}`)
    })
  })
}

function _listRow(m: MemberView, i: number): string {
  const user = getCurrentUser()
  const canEdit = user ? can(user, 'members.edit') : false
  const ini    = initials(m.first_name ?? '', m.last_name ?? '')
  const fullName = formatName(m.first_name ?? '', m.last_name ?? '', m.title)
  const bg     = avatarColor(fullName)
  const avatarStyle = m.profile_photo_url
    ? `background-image:url(${m.profile_photo_url});background-size:cover;background-position:center;color:transparent;`
    : `background:${bg};`
  const avatarContent = m.profile_photo_url ? '' : ini
  const gi     = genderIcon(m.gender ?? '')
  const gc     = genderColor(m.gender ?? '')
  const dot    = statusDotColor(m.membership_status ?? '')
  const delay  = Math.min(i * 35, 350)

  return /* html */`
  <div class="ml-list-row ml-slide-right" style="animation-delay:${delay}ms;"
       data-member-id="${m.id}">
    <div style="position:relative;flex-shrink:0;">
      <div class="ml-list-avatar" style="${avatarStyle}">${avatarContent}</div>
      <div style="position:absolute;bottom:-1px;right:-1px;width:13px;height:13px;
                  border-radius:50%;background:${dot};border:2px solid var(--bg-card);"></div>
      <div style="position:absolute;bottom:0;right:15px;font-size:11px;color:${gc};">${gi}</div>
    </div>
    <div style="flex:1;min-width:0;">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:2px;flex-wrap:wrap;">
        <h3 style="font-size:13px;font-weight:600;color:var(--text-primary);
                   white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${fullName}
        </h3>
        ${membershipBadgeHtml(m.membership_status ?? '')}
      </div>
      <p style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${m.membership_number ?? '—'}
      </p>
      <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">
        ${m.occupation ?? 'Member'}
        ${m.join_date ? `<span style="color:var(--border-strong);margin:0 4px;">·</span>
          <span style="font-size:10.5px;color:var(--text-muted);">Joined ${fmtDate(m.join_date)}</span>` : ''}
      </div>
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0;">
      <button class="ml-mob-btn" data-member-view="${m.id}"
              onclick="event.stopPropagation()">View</button>
      ${canEdit ? `
      <button class="ml-mob-btn ml-mob-btn-edit" data-member-edit="${m.id}"
              onclick="event.stopPropagation()">Edit</button>` : ''}
    </div>
  </div>`
}

// ── Events ────────────────────────────────────────────────────────────────────

function _on<K extends keyof HTMLElementEventMap>(
  el: HTMLElement | null, ev: K, fn: (e: HTMLElementEventMap[K]) => void
): void {
  if (!el) return
  el.addEventListener(ev, fn as EventListener)
  _listeners.push([el, ev, fn as EventListener])
}

function _clearSearch(): void {
  const inp = document.getElementById('ml-search-inp') as HTMLInputElement | null
  if (inp) inp.value = ''
  _searchQuery = ''
  const clr = document.getElementById('ml-search-clear')
  if (clr) clr.style.display = 'none'
  _renderAll()
}

function _clearFilter(): void {
  _activeFilter = null
  document.querySelectorAll<HTMLElement>('.ml-stat-card').forEach(c => {
    c.classList.remove('active-filter')
    c.style.borderColor = ''
    c.style.boxShadow   = ''
  })
  _renderAll()
}

function _applyStatFilter(cardEl: HTMLElement, key: FilterKey): void {
  if (_activeFilter === key) { _clearFilter(); return }
  _activeFilter = key

  document.querySelectorAll<HTMLElement>('.ml-stat-card').forEach(c => {
    c.classList.remove('active-filter')
    c.style.borderColor = ''
    c.style.boxShadow   = ''
  })
  cardEl.classList.add('active-filter')
  cardEl.style.borderColor = cardEl.dataset.accentBorder ?? ''
  cardEl.style.boxShadow   = `0 0 0 3px ${cardEl.dataset.accentGlow ?? 'transparent'}, 0 8px 24px rgba(0,0,0,0.15)`
  _renderAll()
}

const _debouncedSearch = debounce((q: string) => {
  _searchQuery = q
  const clr = document.getElementById('ml-search-clear')
  if (clr) clr.style.display = q ? '' : 'none'
  _renderAll()
}, 280)

function _bindEvents(): void {
  // Stat card clicks
  document.querySelectorAll<HTMLElement>('.ml-stat-card').forEach(card => {
    _on(card, 'click', () => _applyStatFilter(card, card.dataset.statKey as FilterKey))
  })

  // Clear filter buttons
  _on(document.getElementById('ml-clear-filter-btn')  as HTMLElement, 'click', _clearFilter)
  _on(document.getElementById('ml-panel-clear-btn')   as HTMLElement, 'click', _clearFilter)

  // Search input
  const searchInp = document.getElementById('ml-search-inp') as HTMLInputElement | null
  _on(searchInp, 'input', (e) => _debouncedSearch((e.target as HTMLInputElement).value))

  // Clear search button
  _on(document.getElementById('ml-search-clear') as HTMLElement, 'click', _clearSearch)

  // Sort select
  const sortSel = document.getElementById('ml-sort-select') as HTMLSelectElement | null
  _on(sortSel, 'change', (e) => {
    _sortKey = (e.target as HTMLSelectElement).value as SortKey
    _renderAll()
  })

  // Export — build CSV client-side from existing in-memory data
  _on(document.getElementById('ml-export-btn') as HTMLElement, 'click', () => {
    const btn = document.getElementById('ml-export-btn') as HTMLButtonElement | null
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> <span class="ml-btn-label">Exporting…</span>' }
    try {
      const list = _getFiltered()
      const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const headers = [
        'Membership Number', 'Title', 'First Name', 'Last Name', 'Gender',
        'Date of Birth', 'Primary Phone', 'Secondary Phone', 'Email',
        'Physical Address', 'Occupation', 'Marital Status', 'Membership Status',
        'Join Date', 'Is Active',
      ]
      const rows = list.map(m => [
        escape(m.membership_number),
        escape(m.title),
        escape(m.first_name),
        escape(m.last_name),
        escape(m.gender),
        escape(m.date_of_birth),
        escape(m.primary_phone),
        escape(m.secondary_phone),
        escape(m.email),
        escape(m.physical_address),
        escape(m.occupation),
        escape(m.marital_status),
        escape(m.membership_status),
        escape(m.join_date),
        escape(m.is_active ? 'Yes' : 'No'),
      ].join(','))

      const csv = [headers.map(escape).join(','), ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `members-export-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('[MemberList] Export failed:', err)
      const bar = document.getElementById('ml-results-count')
      if (bar) {
        const orig = bar.textContent
        bar.style.color = 'var(--text-danger)'
        bar.textContent = `Export failed: ${err?.message ?? err}`.substring(0, 80)
        setTimeout(() => { bar.style.color = ''; bar.textContent = orig }, 5000)
      }
    } finally {
      if (btn) {
        btn.disabled = false
        btn.innerHTML = '<i class="bi bi-download"></i> <span class="ml-btn-label">Export</span>'
      }
    }
  })

  // Add member
  _on(document.getElementById('ml-add-btn') as HTMLElement, 'click', () => navigate('/members/add'))

  // Tab bar
  if (_container) {
    bindMembershipTabEvents(_container)
  }

  // Mobile search toggle
  const mobBtn = document.getElementById('ml-mob-search-btn')
  const toolbar = _container?.querySelector<HTMLElement>('.ml-toolbar')
  _on(mobBtn as HTMLElement, 'click', () => {
    if (!toolbar) return
    const isOpen = toolbar.classList.toggle('search-open')
    if (isOpen) {
      const inp = toolbar.querySelector<HTMLElement>('.ml-search-wrap')
      if (inp) inp.style.display = 'flex'
      ;(toolbar.querySelector('#ml-search-inp') as HTMLInputElement | null)?.focus()
    } else {
      _clearSearch()
    }
  })

  // Escape key closes mobile search
  const _onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && toolbar?.classList.contains('search-open')) {
      toolbar.classList.remove('search-open')
      _clearSearch()
    }
  }
  document.addEventListener('keydown', _onKeydown)
  _listeners.push([document as unknown as HTMLElement, 'keydown', _onKeydown as EventListener])
}