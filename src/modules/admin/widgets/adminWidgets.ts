// src/modules/admin/widgets/adminWidgets.ts
// Reusable UI widgets extracted from the Admin module.
// All widgets are pure DOM — no framework dependency.
// Designed for reuse by: Membership, Finance, Services, Pastoral modules.

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface StatCardConfig {
  id:         string
  label:      string
  icon:       string          // Bootstrap Icons class suffix (e.g. 'check-circle-fill')
  accentColor: string         // CSS color
  glowColor:  string          // rgba()
  getValue:   () => number
  getSub?:    () => string    // optional sub-label under the number
}

export interface ToolbarConfig {
  searchPlaceholder?: string
  filters?:  ToolbarFilter[]
  actions?:  ToolbarAction[]
  onSearch:  (q: string) => void
}

export interface ToolbarFilter {
  id:       string
  icon:     string
  options:  { value: string; label: string }[]
  onChange: (value: string) => void
}

export interface ToolbarAction {
  id:       string
  label:    string
  icon:     string
  variant?: 'default' | 'primary' | 'danger'
  onClick:  () => void
}

export interface ContextMenuItem {
  id:       string
  label:    string
  icon:     string
  variant?: 'default' | 'danger' | 'success'
  divider?: boolean   // renders a divider BEFORE this item
  onClick:  () => void
}

export interface BulkBarAction {
  id:       string
  label:    string
  icon:     string
  variant?: 'default' | 'danger' | 'success'
  onClick:  (selectedIds: Set<string>) => void
}

export interface EmptyStateConfig {
  icon:        string
  title:       string
  description: string
  action?:     { label: string; icon: string; onClick: () => void }
}

export interface ColumnDef<T> {
  id:           string
  header:       string
  hideAt?:      number          // hide column at this viewport width
  sortable?:    boolean
  renderCell:   (row: T) => string
  renderMobile?: (row: T) => string  // mobile card section (optional override)
}

export interface ResponsiveDataViewConfig<T> {
  columns:       ColumnDef<T>[]
  getRowId:      (row: T) => string
  renderMobileRow: (row: T, index: number) => string
  onRowClick?:   (row: T) => void
  selectable?:   boolean
  onSelectionChange?: (ids: Set<string>) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS  (injected once)
// ─────────────────────────────────────────────────────────────────────────────

const WIDGET_CSS = /* css */`
/* ══════════════════════════════════════════════════════════════════════════
   ADMIN WIDGETS — shared across all admin tabs
   Scoped under: .aw-* prefix
══════════════════════════════════════════════════════════════════════════ */

/* ── Stat Cards ── */
.aw-stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}
@media (max-width: 900px) { .aw-stats-row { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .aw-stats-row { grid-template-columns: 1fr 1fr; gap: var(--space-sm); } }

.aw-stat {
  background: linear-gradient(145deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  cursor: pointer; position: relative; overflow: hidden;
  transition: transform 0.22s cubic-bezier(0.16,1,0.3,1),
              box-shadow 0.22s, border-color 0.22s;
  user-select: none;
}
.aw-stat:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(0,0,0,0.22);
  border-color: var(--border-strong);
}
.aw-stat:active { transform: translateY(0) scale(0.98); }
.aw-stat.active {
  border-width: 1.5px;
  border-color: var(--stat-accent);
  box-shadow: 0 0 0 3px var(--stat-glow), 0 8px 28px rgba(0,0,0,0.3);
  transform: translateY(-2px);
}
.aw-stat-hint {
  position: absolute; top: 10px; right: 10px;
  font-size: 10px; color: var(--text-muted);
  opacity: 0; transition: opacity 0.2s;
  display: flex; align-items: center; gap: 3px;
}
.aw-stat:hover .aw-stat-hint { opacity: 1; }
.aw-stat.active .aw-stat-hint { opacity: 0; }
.aw-stat-icon-row {
  display: flex; align-items: center; gap: 10px; margin-bottom: var(--space-md);
}
.aw-stat-icon {
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.aw-stat-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.09em; color: var(--text-secondary);
}
.aw-stat-value {
  font-size: 28px; font-weight: 700; color: var(--text-primary);
  line-height: 1; display: flex; align-items: baseline; gap: 8px;
}
.aw-stat-sub { font-size: 11px; font-weight: 400; color: var(--text-secondary); }
.aw-stat-bar {
  margin-top: 10px; height: 2px; border-radius: 99px;
  background: var(--border-default); overflow: hidden;
}
.aw-stat-bar-fill {
  height: 100%; border-radius: 99px;
  transition: width 0.5s cubic-bezier(0.16,1,0.3,1);
}

/* ── Toolbar ── */
.aw-toolbar {
  display: flex; align-items: center; gap: var(--space-sm);
  background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: 10px var(--space-md);
  box-shadow: 0 4px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04);
  flex-wrap: wrap;
}
.aw-search {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); padding: 0 12px;
  height: 40px; flex: 1; min-width: 180px; max-width: 400px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.aw-search:focus-within {
  border-color: var(--caci-blue);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.aw-search i { font-size: 15px; color: var(--text-muted); flex-shrink: 0; transition: color 0.2s; }
.aw-search:focus-within i { color: var(--caci-blue-light); }
.aw-search input {
  background: transparent; border: none; outline: none;
  font-size: 13px; color: var(--text-primary);
  font-family: var(--font-sans); width: 100%;
  caret-color: var(--caci-blue);
}
.aw-search input::placeholder { color: var(--text-muted); }

.aw-filter-wrap { position: relative; display: flex; align-items: center; }
.aw-filter-wrap i {
  position: absolute; left: 10px; font-size: 14px;
  color: var(--text-secondary); pointer-events: none; z-index: 1;
}
.aw-filter-select {
  appearance: none; -webkit-appearance: none;
  padding: 0 32px 0 28px; height: 40px; border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-page);
  color: var(--text-primary); font-size: 13px;
  font-family: var(--font-sans); font-weight: 500;
  cursor: pointer; outline: none; min-width: 140px;
  transition: border-color 0.2s, box-shadow 0.2s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}
.aw-filter-select:focus {
  border-color: var(--caci-blue);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.aw-filter-select option { background: var(--bg-card); color: var(--text-primary); }

.aw-tbtn {
  display: flex; align-items: center; gap: 6px;
  padding: 0 14px; height: 40px; border-radius: var(--radius-md);
  font-size: 13px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--border-default);
  background: var(--bg-page); color: var(--text-secondary);
  transition: all 0.18s cubic-bezier(0.16,1,0.3,1);
  white-space: nowrap; font-family: var(--font-sans);
}
.aw-tbtn i { font-size: 15px; }
.aw-tbtn:hover {
  border-color: var(--border-strong); color: var(--text-primary);
  transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.12);
}
.aw-tbtn:active { transform: translateY(0); }
.aw-tbtn-primary {
  background: linear-gradient(135deg, var(--caci-blue) 0%, var(--caci-blue-light) 100%);
  border-color: transparent; color: #fff; font-weight: 600;
  box-shadow: 0 2px 10px rgba(0,75,160,0.3);
}
.aw-tbtn-primary:hover {
  background: linear-gradient(135deg, var(--caci-blue-light) 0%, var(--caci-blue) 100%);
  box-shadow: 0 6px 20px rgba(0,75,160,0.45);
  border-color: transparent; color: #fff;
}
.aw-tbtn-danger {
  background: rgba(198,0,38,0.08); border-color: rgba(198,0,38,0.3); color: var(--caci-red);
}
.aw-tbtn-danger:hover {
  background: rgba(198,0,38,0.15); border-color: rgba(198,0,38,0.5);
  transform: translateY(-1px);
}

@media (max-width: 860px) {
  .aw-btn-label { display: none; }
  .aw-tbtn { padding: 0 10px; }
  .aw-filter-select {
    min-width: 40px; width: 40px; padding: 0;
    color: transparent; background-image: none;
  }
  .aw-filter-wrap i { left: 50%; transform: translateX(-50%); }
}
@media (max-width: 540px) {
  .aw-search { display: none; }
  .aw-mob-search-btn { display: flex !important; }
  .aw-toolbar.search-open { flex-wrap: wrap; gap: 10px; }
  .aw-toolbar.search-open .aw-search {
    display: flex; width: 100%; max-width: none; order: -1;
    animation: awFadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both;
  }
  .aw-toolbar.search-open .aw-mob-search-btn { display: none !important; }
}

/* ── Empty State ── */
.aw-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 72px var(--space-lg); text-align: center;
  gap: var(--space-md); grid-column: 1 / -1; width: 100%;
}
.aw-empty-icon-wrap {
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--bg-hover); border: 1px solid var(--border-default);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: var(--space-sm);
}
.aw-empty-icon-wrap i { font-size: 28px; color: var(--text-muted); }
.aw-empty-title {
  font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 0;
}
.aw-empty-desc {
  font-size: 13px; color: var(--text-secondary);
  max-width: 340px; line-height: 1.6; margin: 0;
}

/* ── Context Menu ── */
.aw-ctx {
  position: fixed; z-index: 500;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 4px; min-width: 188px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2);
  animation: awCtxIn 0.18s cubic-bezier(0.16,1,0.3,1) both;
  transform-origin: top right;
}
@keyframes awCtxIn {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}
.aw-ctx-item {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 10px; border-radius: var(--radius-sm);
  font-size: 13px; color: var(--text-primary); cursor: pointer;
  transition: background 0.12s; font-family: var(--font-sans);
  white-space: nowrap;
}
.aw-ctx-item i { font-size: 16px; color: var(--text-secondary); }
.aw-ctx-item:hover { background: var(--bg-hover); }
.aw-ctx-item:hover i { color: var(--text-primary); }
.aw-ctx-item.danger { color: var(--caci-red); }
.aw-ctx-item.danger i { color: var(--caci-red); }
.aw-ctx-item.danger:hover { background: rgba(198,0,38,0.08); }
.aw-ctx-item.success { color: #22c55e; }
.aw-ctx-item.success i { color: #22c55e; }
.aw-ctx-item.success:hover { background: rgba(34,197,94,0.08); }
.aw-ctx-divider { height: 1px; background: var(--border-default); margin: 3px 0; }

/* ── Bulk Bar ── */
.aw-bulk-bar {
  display: none;
  align-items: center; gap: var(--space-sm);
  background: linear-gradient(135deg, var(--bg-card), var(--bg-page));
  border: 1px solid rgba(0,75,160,0.3);
  border-radius: var(--radius-lg); padding: 10px 16px;
  box-shadow: 0 0 0 1px rgba(0,75,160,0.12), 0 4px 24px rgba(0,0,0,0.2);
  animation: awSlideDown 0.3s cubic-bezier(0.16,1,0.3,1) both;
}
.aw-bulk-bar.show { display: flex; }
@keyframes awSlideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.aw-bulk-count {
  font-size: 13px; font-weight: 600; color: var(--text-primary);
  display: flex; align-items: center; gap: 6px;
}
.aw-bulk-count i { font-size: 16px; color: var(--caci-blue-light); }
.aw-bulk-spacer { flex: 1; }

/* ── Table ── */
.aw-table-wrap {
  background: linear-gradient(145deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); overflow: hidden;
}
.aw-table-header {
  display: grid;
  align-items: center;
  min-height: 40px;
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid var(--border-default);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 0 16px;
}
.aw-col-hd {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-muted);
  display: flex; align-items: center; gap: 4px;
  cursor: pointer; user-select: none; padding: 10px 8px;
  transition: color 0.15s; white-space: nowrap;
}
.aw-col-hd:hover { color: var(--text-secondary); }
.aw-col-hd i { font-size: 12px; }
.aw-col-hd.sorted { color: var(--caci-blue-light); }
.aw-table-body { display: flex; flex-direction: column; }
.aw-table-row {
  display: grid;
  align-items: center;
  min-height: 64px;
  border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.04));
  padding: 0 16px;
  transition: background 0.15s;
  cursor: pointer;
}
.aw-table-row:last-child { border-bottom: none; }
.aw-table-row:hover { background: rgba(255,255,255,0.025); }
.aw-table-row.selected { background: rgba(0,75,160,0.06); }
.aw-col-cell { padding: 0 8px; display: flex; align-items: center; }

/* Table → mobile card swap */
.aw-mobile-rows { display: none; flex-direction: column; gap: 10px; }
@media (max-width: 639px) {
  .aw-table-header { display: none; }
  .aw-table-body   { display: none; }
  .aw-table-wrap {
    background: transparent;
    border: none;
    border-radius: 0;
    overflow: visible;
  }
  .aw-mobile-rows { display: flex; }
}

/* Mobile card row */
.aw-mob-row {
  background: linear-gradient(135deg, var(--bg-card), var(--bg-page));
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  display: flex; align-items: center; gap: 12px;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
  animation: awFadeUp 0.38s cubic-bezier(0.16,1,0.3,1) both;
}
.aw-mob-row:hover {
  border-color: rgba(0,75,160,0.4);
  transform: translateX(2px);
  box-shadow: 0 4px 18px rgba(0,0,0,0.15);
}

/* ── Results meta ── */
.aw-results-meta {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 2px; font-size: 12px; color: var(--text-secondary);
}
.aw-results-meta strong { color: var(--text-primary); }

/* ── Sort select inline ── */
.aw-sort-inline {
  appearance: none; -webkit-appearance: none;
  height: 32px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: var(--bg-page); color: var(--text-primary);
  font-size: 12px; font-family: var(--font-sans);
  padding: 0 28px 0 10px; cursor: pointer; outline: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 8px center;
  transition: border-color 0.2s;
}
.aw-sort-inline:focus { border-color: var(--caci-blue); }
.aw-sort-inline option { background: var(--bg-card); }

/* ── Filter banner ── */
.aw-filter-banner {
  display: none; align-items: center; gap: var(--space-sm);
  padding: 10px 14px; border-radius: var(--radius-md);
  background: rgba(0,75,160,0.06); border: 1px solid rgba(0,75,160,0.2);
  animation: awSlideRight 0.32s cubic-bezier(0.16,1,0.3,1) both;
}
.aw-filter-banner.show { display: flex; }
@keyframes awSlideRight {
  from { opacity: 0; transform: translateX(-10px); }
  to   { opacity: 1; transform: translateX(0); }
}
.aw-filter-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 99px;
  background: rgba(0,75,160,0.14); border: 1px solid rgba(0,75,160,0.35);
  font-size: 12px; font-weight: 600; color: var(--caci-blue-light);
}
[data-theme="light"] .aw-filter-pill { color: var(--caci-blue); }
.aw-filter-clear {
  margin-left: auto; display: flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-default); background: transparent;
  color: var(--text-secondary); font-size: 12px;
  font-family: var(--font-sans); cursor: pointer; transition: all 0.18s;
}
.aw-filter-clear:hover { border-color: var(--border-strong); color: var(--text-primary); }

/* ── Spinner ── */
.aw-spinner {
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: #fff;
  animation: awSpin 0.7s linear infinite; display: inline-block;
}
@keyframes awSpin { to { transform: rotate(360deg); } }

/* ── Checkbox ── */
.aw-chk {
  appearance: none; width: 16px; height: 16px;
  border: 1.5px solid var(--border-strong); border-radius: 4px;
  background: transparent; cursor: pointer; flex-shrink: 0;
  transition: all 0.15s cubic-bezier(0.16,1,0.3,1);
}
.aw-chk:checked {
  background: var(--caci-blue); border-color: var(--caci-blue);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 6l3 3 5-5' stroke='white' stroke-width='1.8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-size: 10px; background-repeat: no-repeat; background-position: center;
}
.aw-chk:hover:not(:checked) { border-color: var(--text-secondary); }

/* ── Status & Role badges ── */
.aw-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 99px;
  font-size: 11px; font-weight: 500;
}
.aw-badge-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.aw-badge-active   { background: rgba(34,197,94,0.1);  color: #56d364; }
.aw-badge-active   .aw-badge-dot { background: #22c55e; }
.aw-badge-inactive { background: var(--bg-hover); color: var(--text-secondary); }
.aw-badge-inactive .aw-badge-dot { background: var(--text-muted); }
.aw-badge-pending  { background: rgba(210,153,34,0.1); color: #d29922; }
.aw-badge-pending  .aw-badge-dot { background: #d29922; }
.aw-badge-locked   { background: rgba(198,0,38,0.1);   color: var(--caci-red); }
.aw-badge-locked   .aw-badge-dot { background: var(--caci-red); }

.aw-role-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 99px;
  background: var(--bg-hover); border: 1px solid var(--border-default);
  font-size: 11px; color: var(--text-secondary); font-weight: 500;
  white-space: nowrap;
}
.aw-role-pill i { font-size: 12px; color: var(--caci-blue-light); }

/* ── Toggle switch ── */
.aw-toggle {
  display: flex; align-items: center; gap: 10px; cursor: pointer;
}
.aw-toggle-track {
  width: 36px; height: 20px; border-radius: 99px;
  background: var(--bg-hover); border: 1px solid var(--border-default);
  position: relative; transition: background 0.2s, border-color 0.2s; flex-shrink: 0;
}
.aw-toggle-track.on { background: var(--caci-blue); border-color: var(--caci-blue-light); }
.aw-toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%; background: var(--text-muted);
  transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), background 0.2s;
}
.aw-toggle-track.on .aw-toggle-thumb { transform: translateX(16px); background: #fff; }

/* ── Avatar ring ── */
.aw-avatar-ring {
  padding: 2px; border-radius: 50%; flex-shrink: 0;
  background: conic-gradient(#22c55e 0deg 300deg, #166534 300deg 360deg);
}
.aw-avatar-ring.inactive { background: conic-gradient(var(--text-muted) 0deg 360deg); }
.aw-avatar-ring.pending  { background: conic-gradient(#d29922 0deg 200deg, var(--border-strong) 200deg 360deg); }
.aw-avatar-inner {
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 13px; letter-spacing: 0.5px;
  border: 2.5px solid var(--bg-page); width: 38px; height: 38px;
}

/* ── PWD badge ── */
.aw-pwd-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 7px; border-radius: 5px;
  background: rgba(210,153,34,0.12); border: 1px solid rgba(210,153,34,0.25);
  font-size: 10px; font-weight: 600; color: #d29922;
  text-transform: uppercase; letter-spacing: 0.4px;
}
.aw-pwd-badge i { font-size: 10px; }

/* ── Modal ── */
.aw-modal-overlay {
  position: fixed; inset: 0; z-index: 600;
  background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
  display: none; align-items: center; justify-content: center;
  padding: var(--space-lg);
  animation: awFadeIn 0.2s ease both;
}
.aw-modal-overlay.open { display: flex; }
@keyframes awFadeIn { from { opacity: 0; } to { opacity: 1; } }
.aw-modal {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 64px rgba(0,0,0,0.45);
  width: 100%; max-width: 520px; max-height: 90vh;
  display: flex; flex-direction: column;
  animation: awModalIn 0.3s cubic-bezier(0.16,1,0.3,1) both;
  overflow: hidden;
}
@keyframes awModalIn {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
.aw-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 22px 16px; border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}
.aw-modal-header-icon {
  width: 36px; height: 36px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.aw-modal-header-icon i { font-size: 18px; }
.aw-modal-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 0; }
.aw-modal-subtitle { font-size: 11px; color: var(--text-secondary); margin-top: 1px; }
.aw-modal-close-btn {
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  border: none; background: transparent; color: var(--text-muted);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 16px; transition: background 0.12s, color 0.12s;
}
.aw-modal-close-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.aw-modal-body {
  padding: 20px 22px; overflow-y: auto; flex: 1;
  display: flex; flex-direction: column; gap: 16px;
}
.aw-modal-footer {
  padding: 14px 22px; border-top: 1px solid var(--border-default);
  display: flex; justify-content: flex-end; gap: var(--space-sm);
  flex-shrink: 0;
}

/* ── Form fields ── */
.aw-form-group { display: flex; flex-direction: column; gap: 6px; }
.aw-form-label {
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.aw-form-inp,
.aw-form-select,
.aw-form-textarea {
  width: 100%; height: 40px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: var(--radius-sm); padding: 0 14px;
  font-family: var(--font-sans); font-size: 13.5px;
  color: var(--text-primary); outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.aw-form-textarea { height: auto; padding: 10px 14px; resize: vertical; min-height: 80px; }
.aw-form-inp::placeholder,
.aw-form-textarea::placeholder { color: var(--text-muted); }
.aw-form-inp:focus,
.aw-form-select:focus,
.aw-form-textarea:focus {
  border-color: var(--caci-blue);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.aw-form-select {
  appearance: none; -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 12px center;
  padding-right: 36px;
}
.aw-form-select option { background: var(--bg-card); }
.aw-form-error { font-size: 11px; color: var(--caci-red); margin-top: 3px; display: none; }
.aw-form-error.show { display: block; }

/* ── Toast ── */
.aw-toast {
  position: fixed; bottom: 24px; left: 50%;
  transform: translateX(-50%) translateY(80px);
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 10px 18px; font-size: 13px; color: var(--text-primary);
  display: flex; align-items: center; gap: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35);
  transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.35s;
  opacity: 0; z-index: 700; white-space: nowrap; pointer-events: none;
  font-family: var(--font-sans);
}
.aw-toast i { font-size: 16px; }

/* ── Section scaffold (placeholder tabs) ── */
.aw-scaffold {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 80px 20px; text-align: center; gap: 16px;
}
.aw-scaffold-icon {
  width: 72px; height: 72px; border-radius: 50%;
  background: linear-gradient(145deg, var(--bg-card), var(--bg-page));
  border: 1px solid var(--border-default);
  display: flex; align-items: center; justify-content: center;
}
.aw-scaffold-icon i { font-size: 32px; color: var(--text-muted); }
.aw-scaffold-title {
  font-size: 17px; font-weight: 700; color: var(--text-primary);
  margin: 0; letter-spacing: -0.01em;
}
.aw-scaffold-desc {
  font-size: 13px; color: var(--text-secondary);
  max-width: 340px; line-height: 1.6; margin: 0;
}
.aw-scaffold-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 14px; border-radius: 99px;
  background: rgba(0,75,160,0.08); border: 1px solid rgba(0,75,160,0.2);
  font-size: 11px; font-weight: 600; color: var(--caci-blue-light);
  text-transform: uppercase; letter-spacing: 0.06em;
}

/* ── Shared keyframes ── */
@keyframes awFadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
`

let _widgetCSSInjected = false
export function injectWidgetCSS(): void {
  if (_widgetCSSInjected) return
  _widgetCSSInjected = true
  const s = document.createElement('style')
  s.id = 'aw-widget-css'
  s.textContent = WIDGET_CSS
  document.head.appendChild(s)
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS CARD GROUP
// ─────────────────────────────────────────────────────────────────────────────

export class StatsCardGroup {
  private _el: HTMLElement
  private _cards: StatCardConfig[]
  private _activeId: string | null = null
  private _onFilter: (id: string | null) => void

  constructor(
    container: HTMLElement,
    cards: StatCardConfig[],
    onFilter: (id: string | null) => void
  ) {
    this._cards = cards
    this._onFilter = onFilter
    this._el = document.createElement('div')
    this._el.className = 'aw-stats-row'
    container.appendChild(this._el)
    this.render()
  }

  private render(): void {
    this._el.innerHTML = this._cards.map(c => {
      const val = c.getValue()
      const sub = c.getSub?.() ?? ''
      return `
      <div class="aw-stat${this._activeId === c.id ? ' active' : ''}" 
           data-stat-id="${c.id}"
           style="--stat-accent:${c.accentColor};--stat-glow:${c.glowColor};">
        <div class="aw-stat-hint"><i class="bi bi-funnel"></i> Filter</div>
        <div class="aw-stat-icon-row">
          <div class="aw-stat-icon" style="background:${c.glowColor};">
            <i class="bi bi-${c.icon}" style="color:${c.accentColor};font-size:15px;"></i>
          </div>
          <span class="aw-stat-label">${c.label}</span>
        </div>
        <div class="aw-stat-value">${val}${sub ? `<span class="aw-stat-sub">${sub}</span>` : ''}</div>
        <div class="aw-stat-bar">
          <div class="aw-stat-bar-fill" style="width:100%;background:linear-gradient(90deg,${c.accentColor},${c.glowColor});"></div>
        </div>
      </div>`
    }).join('')

    this._el.querySelectorAll<HTMLElement>('[data-stat-id]').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset['statId']!
        if (this._activeId === id) {
          this._activeId = null
          this._onFilter(null)
        } else {
          this._activeId = id
          this._onFilter(id)
        }
        this.render()
      })
    })
  }

  update(): void { this.render() }

  clearFilter(): void {
    this._activeId = null
    this.render()
  }

  getActiveId(): string | null { return this._activeId }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLBAR
// ─────────────────────────────────────────────────────────────────────────────

export class Toolbar {
  private _el: HTMLElement
  private _cfg: ToolbarConfig
  private _searchTimer: ReturnType<typeof setTimeout> | null = null
  private readonly IDLE_MS = 10000

  constructor(container: HTMLElement, cfg: ToolbarConfig) {
    this._cfg = cfg
    this._el = document.createElement('div')
    this._el.className = 'aw-toolbar'
    container.appendChild(this._el)
    this._render()
    this._bindGlobalEvents()
  }

  private _render(): void {
    const filters = (this._cfg.filters ?? []).map(f => `
      <div class="aw-filter-wrap">
        <i class="bi bi-${f.icon}"></i>
        <select class="aw-filter-select" data-filter-id="${f.id}">
          ${f.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>`).join('')

    const actions = (this._cfg.actions ?? []).map(a => `
      <button class="aw-tbtn${a.variant === 'primary' ? ' aw-tbtn-primary' : a.variant === 'danger' ? ' aw-tbtn-danger' : ''}"
              data-action-id="${a.id}" title="${a.label}">
        <i class="bi bi-${a.icon}"></i>
        <span class="aw-btn-label">${a.label}</span>
      </button>`).join('')

    this._el.innerHTML = `
      <div class="aw-search">
        <i class="bi bi-search"></i>
        <input type="text" placeholder="${this._cfg.searchPlaceholder ?? 'Search…'}" autocomplete="off">
      </div>
      <button class="aw-tbtn aw-mob-search-btn" style="display:none;" title="Search">
        <i class="bi bi-search" style="font-size:15px;"></i>
      </button>
      <div style="flex: 1;"></div>
      <div style="display:flex;align-items:center;gap:var(--space-sm);flex-shrink:0;">
        ${filters}${actions}
      </div>`

    // Search input
    const inp = this._el.querySelector<HTMLInputElement>('.aw-search input')!
    inp.addEventListener('input', () => {
      this._resetTimer()
      this._cfg.onSearch(inp.value)
    })
    inp.addEventListener('focus', () => this._resetTimer())
    inp.addEventListener('blur', () => this._resetTimer())

    // Mob search toggle
    this._el.querySelector('.aw-mob-search-btn')?.addEventListener('click', () => {
      const isOpen = this._el.classList.toggle('search-open')
      if (isOpen) {
        inp.style.display = ''
        inp.focus()
        this._resetTimer()
      } else {
        inp.value = ''
        this._cfg.onSearch('')
      }
    })

    // Filters
    ;(this._cfg.filters ?? []).forEach(f => {
      const sel = this._el.querySelector<HTMLSelectElement>(`[data-filter-id="${f.id}"]`)!
      sel.addEventListener('change', () => f.onChange(sel.value))
    })

    // Actions
    ;(this._cfg.actions ?? []).forEach(a => {
      this._el.querySelector<HTMLButtonElement>(`[data-action-id="${a.id}"]`)
        ?.addEventListener('click', a.onClick)
    })
  }

  private _resetTimer(): void {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    const inp = this._el.querySelector<HTMLInputElement>('.aw-search input')!
    if (document.activeElement === inp || inp.value.length > 0) {
      this._searchTimer = setTimeout(() => {
        inp.blur()
        if (this._el.classList.contains('search-open')) {
          this._el.classList.remove('search-open')
          inp.value = ''
          this._cfg.onSearch('')
        }
      }, this.IDLE_MS)
    }
  }

  private _bindGlobalEvents(): void {
    this._outsideClick = (e: MouseEvent) => {
      if (!this._el.contains(e.target as Node)) {
        this._el.classList.remove('search-open')
      }
    }
    document.addEventListener('click', this._outsideClick)
  }

  private _outsideClick!: (e: MouseEvent) => void

  getSearchValue(): string {
    return this._el.querySelector<HTMLInputElement>('.aw-search input')?.value ?? ''
  }

  getFilterValue(id: string): string {
    return this._el.querySelector<HTMLSelectElement>(`[data-filter-id="${id}"]`)?.value ?? 'all'
  }

  destroy(): void {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    document.removeEventListener('click', this._outsideClick)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

export function renderEmptyState(container: HTMLElement, cfg: EmptyStateConfig): void {
  container.innerHTML = `
    <div class="aw-empty">
      <div class="aw-empty-icon-wrap">
        <i class="bi bi-${cfg.icon}"></i>
      </div>
      <p class="aw-empty-title">${cfg.title}</p>
      <p class="aw-empty-desc">${cfg.description}</p>
      ${cfg.action ? `
      <button class="aw-tbtn aw-tbtn-primary" id="aw-empty-action" style="margin-top:4px;">
        <i class="bi bi-${cfg.action.icon}"></i>
        <span>${cfg.action.label}</span>
      </button>` : ''}
    </div>`
  if (cfg.action) {
    container.querySelector('#aw-empty-action')?.addEventListener('click', cfg.action.onClick)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT MENU
// ─────────────────────────────────────────────────────────────────────────────

let _activeCtxMenu: HTMLElement | null = null

export class ContextMenu {
  private _el: HTMLElement | null = null
  private _closeHandler!: (e: MouseEvent | KeyboardEvent) => void

  show(
    anchorRect: DOMRect,
    items: ContextMenuItem[]
  ): void {
    this.close()

    const menu = document.createElement('div')
    menu.className = 'aw-ctx'
    menu.style.display = 'block'

    menu.innerHTML = items.map(item => `
      ${item.divider ? '<div class="aw-ctx-divider"></div>' : ''}
      <div class="aw-ctx-item${item.variant ? ' ' + item.variant : ''}" data-item-id="${item.id}">
        <i class="bi bi-${item.icon}"></i>
        ${item.label}
      </div>`).join('')

    document.body.appendChild(menu)
    this._el = menu
    _activeCtxMenu = menu

    // Position: align right edge to anchor right, open below
    const menuW = 200
    let left = anchorRect.right - menuW
    let top  = anchorRect.bottom + 6
    if (left < 4) left = 4
    if (top + 200 > window.innerHeight) top = anchorRect.top - 200 - 6
    menu.style.left = left + 'px'
    menu.style.top  = top + 'px'

    items.forEach(item => {
      menu.querySelector(`[data-item-id="${item.id}"]`)
        ?.addEventListener('click', (e) => {
          e.stopPropagation()
          this.close()
          item.onClick()
        })
    })

    this._closeHandler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') this.close()
      } else {
        if (!menu.contains(e.target as Node)) this.close()
      }
    }
    setTimeout(() => {
      document.addEventListener('click', this._closeHandler as (e: MouseEvent) => void)
      document.addEventListener('keydown', this._closeHandler as (e: KeyboardEvent) => void)
    }, 0)
  }

  close(): void {
    if (this._el) {
      this._el.remove()
      this._el = null
      _activeCtxMenu = null
    }
    if (this._closeHandler) {
      document.removeEventListener('click', this._closeHandler as (e: MouseEvent) => void)
      document.removeEventListener('keydown', this._closeHandler as (e: KeyboardEvent) => void)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK ACTION BAR
// ─────────────────────────────────────────────────────────────────────────────

export class BulkActionBar {
  private _el: HTMLElement
  private _selectedIds: Set<string> = new Set()
  private _actions: BulkBarAction[]
  private _onClear: () => void

  constructor(container: HTMLElement, actions: BulkBarAction[], onClear: () => void) {
    this._actions = actions
    this._onClear = onClear
    this._el = document.createElement('div')
    this._el.className = 'aw-bulk-bar'
    container.appendChild(this._el)
    this._render()
  }

  private _render(): void {
    const n = this._selectedIds.size
    this._el.innerHTML = `
      <span class="aw-bulk-count">
        <i class="bi bi-check2-square"></i>
        ${n} selected
      </span>
      <div class="aw-bulk-spacer"></div>
      ${this._actions.map(a => `
        <button class="aw-tbtn${a.variant === 'danger' ? ' aw-tbtn-danger' : ''}"
                style="height:36px;" data-bulk-id="${a.id}" title="${a.label}">
          <i class="bi bi-${a.icon}"></i>
          <span class="aw-btn-label">${a.label}</span>
        </button>`).join('')}
      <button class="aw-tbtn" style="height:36px;padding:0 10px;" id="aw-bulk-clear" title="Clear selection">
        <i class="bi bi-x-lg" style="font-size:13px;"></i>
      </button>`

    this._actions.forEach(a => {
      this._el.querySelector(`[data-bulk-id="${a.id}"]`)
        ?.addEventListener('click', () => a.onClick(new Set(this._selectedIds)))
    })
    this._el.querySelector('#aw-bulk-clear')
      ?.addEventListener('click', () => this._onClear())
  }

  update(ids: Set<string>): void {
    this._selectedIds = new Set(ids)
    const show = ids.size > 0
    this._el.classList.toggle('show', show)
    if (show) this._render()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────

let _toastEl: HTMLElement | null = null
let _toastTimer: ReturnType<typeof setTimeout> | null = null

export function showToast(
  message: string,
  type: 'success' | 'warning' | 'danger' | 'info' = 'success'
): void {
  if (!_toastEl) {
    _toastEl = document.createElement('div')
    _toastEl.className = 'aw-toast'
    _toastEl.id = 'aw-global-toast'
    _toastEl.innerHTML = '<i class="bi"></i><span></span>'
    document.body.appendChild(_toastEl)
  }

  const iconMap = {
    success: 'check-circle-fill',
    warning: 'exclamation-triangle-fill',
    danger:  'x-circle-fill',
    info:    'info-circle-fill',
  }
  const colorMap = {
    success: '#56d364',
    warning: '#d29922',
    danger:  'var(--caci-red)',
    info:    'var(--caci-blue-light)',
  }

  const icon = _toastEl.querySelector<HTMLElement>('i')!
  const text = _toastEl.querySelector<HTMLElement>('span')!
  icon.className = `bi bi-${iconMap[type]}`
  icon.style.color = colorMap[type]
  text.textContent = message

  _toastEl.style.opacity = '1'
  _toastEl.style.transform = 'translateX(-50%) translateY(0)'

  if (_toastTimer) clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => {
    _toastEl!.style.opacity = '0'
    _toastEl!.style.transform = 'translateX(-50%) translateY(80px)'
  }, 3200)
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL BUILDER
// ─────────────────────────────────────────────────────────────────────────────

export interface ModalConfig {
  title:     string
  subtitle?: string
  icon:      string
  iconBg?:   string
  iconColor?: string
  body:      string
  footer:    string
  onClose?:  () => void
}

export function openModal(cfg: ModalConfig): () => void {
  const existingOverlay = document.getElementById('aw-shared-modal')
  existingOverlay?.remove()

  const overlay = document.createElement('div')
  overlay.className = 'aw-modal-overlay open'
  overlay.id = 'aw-shared-modal'

  overlay.innerHTML = `
    <div class="aw-modal">
      <div class="aw-modal-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="aw-modal-header-icon" style="background:${cfg.iconBg ?? 'rgba(0,75,160,0.12)'};">
            <i class="bi bi-${cfg.icon}" style="color:${cfg.iconColor ?? 'var(--caci-blue-light)'}"></i>
          </div>
          <div>
            <div class="aw-modal-title">${cfg.title}</div>
            ${cfg.subtitle ? `<div class="aw-modal-subtitle">${cfg.subtitle}</div>` : ''}
          </div>
        </div>
        <button class="aw-modal-close-btn" id="aw-modal-close">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="aw-modal-body">${cfg.body}</div>
      <div class="aw-modal-footer">${cfg.footer}</div>
    </div>`

  document.body.appendChild(overlay)

  const close = () => {
    overlay.remove()
    cfg.onClose?.()
  }

  overlay.querySelector('#aw-modal-close')?.addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })
  const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler) } }
  document.addEventListener('keydown', escHandler)

  return close
}

// ─────────────────────────────────────────────────────────────────────────────
// SCAFFOLD TAB HELPER
// ─────────────────────────────────────────────────────────────────────────────

export function renderScaffold(
  container: HTMLElement,
  icon: string,
  title: string,
  description: string,
  badgeText = 'Coming Soon'
): void {
  container.innerHTML = `
    <div class="aw-scaffold">
      <div class="aw-scaffold-icon">
        <i class="bi bi-${icon}"></i>
      </div>
      <p class="aw-scaffold-title">${title}</p>
      <p class="aw-scaffold-desc">${description}</p>
      <span class="aw-scaffold-badge">
        <i class="bi bi-hourglass-split" style="font-size:10px;"></i>
        ${badgeText}
      </span>
    </div>`
}

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR HELPERS (shared)
// ─────────────────────────────────────────────────────────────────────────────

const _AV_COLORS = ['#004BA0','#C60026','#1a5fb4','#7c3aed','#1a7f37','#9a6700','#0969da']

export function avatarColor(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0
  return _AV_COLORS[Math.abs(h) % _AV_COLORS.length]
}

export function initials(name: string): string {
  const parts = name.trim().split(' ')
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

export function avatarRingClass(status: string): string {
  if (status === 'inactive' || status === 'locked') return 'aw-avatar-ring inactive'
  if (status === 'pending') return 'aw-avatar-ring pending'
  return 'aw-avatar-ring'
}