// src/modules/membership/pages/GroupDetail.ts
// Group Detail page — full PageModule implementation.
// Mirrors the reference design (caci-hub-group-detail.html) adapted to the
// CACI Hub web architecture (Bootstrap Icons, CSS tokens, no Tailwind).
//
// Tabs:
//   Overview  — hero card, mini stats, members preview, recent services, sidebar info
//   Members   — full searchable / filterable member list, add member modal, member detail modal
//   Services  — service list, record service modal, service detail modal
//   Activity  — (placeholder — real audit log needs a backend endpoint)
//
// Data layer:
//   getGroup()           → groups.repository.ts
//   listGroupMembers()   → groups.repository.ts
//   assignGroupMember()  → groups.repository.ts
//   removeGroupMember()  → groups.repository.ts
//   updateGroup()        → groups.repository.ts
//   listMembers()        → repository.ts  (for member search in add-member modal)
//
// Permissions:
//   GROUPS_VIEW          — read gate (enforced by router)
//   GROUPS_EDIT          — shows Edit button + edit modal
//   GROUPS_MEMBERS_MANAGE — shows Add Member + remove/role-change actions
//   GROUPS_DELETE        — shows deactivate/activate toggle

import type { PageModule }         from '../../../types/module.types'
import { getCurrentUser }           from '@core/auth'
import { can }                      from '@core/authorization/authorization-service'
import { PERMISSIONS }              from '@core/authorization/permissions'
import { on, off }                  from '@core/events'
import { navigate }                 from '@core/router'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { renderBreadcrumbs }        from '../../../shell/Breadcrumbs'
import { debounce }                 from '@shared/utils/debounce'
import {
  getGroup,
  listGroupMembers,
  assignGroupMember,
  removeGroupMember,
  updateGroup,
} from '../groups.repository'
import { listMembers }              from '../repository'
import type { Group, GroupMemberWithMember, GroupMemberRole } from '../../../types/group.types'
import type { MemberView }          from '../../../types/member.types'

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = /* css */`
/* ══════════════════════════════════════════════════════
   GROUP DETAIL PAGE  — scoped under .gd-*
══════════════════════════════════════════════════════ */

/* Page wrapper */
.gd-page {
  padding: var(--space-xl) var(--space-2xl);
  max-width: 1400px;
  font-family: var(--font-sans);
  margin: 0 auto;
}
@media (max-width: 640px) { .gd-page { padding: var(--space-lg) var(--space-md); } }


/* ── Page header ── */
.gd-page-header {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: var(--space-md);
  flex-wrap: wrap; margin-bottom: var(--space-lg);
}
.gd-header-left { display: flex; flex-direction: column; gap: var(--space-sm); }
.gd-header-actions { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }

/* ── Back button ── */
.gd-back {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-default); background: transparent;
  color: var(--text-secondary); font-size: 12px; font-weight: 500;
  cursor: pointer; font-family: var(--font-sans);
  transition: all 0.18s cubic-bezier(0.16,1,0.3,1);
}
.gd-back:hover { border-color: var(--border-strong); color: var(--text-primary); background: var(--bg-hover); }
.gd-back i { font-size: 13px; }

/* ── Page title row ── */
.gd-title-row {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.gd-title-icon {
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.gd-title-icon i { font-size: 16px; }
.gd-title-name { font-size: 20px; font-weight: 700; color: var(--text-primary); }
.gd-title-asm  { font-size: 11px; color: var(--text-muted); margin-top: 1px; }

/* ── Tab bar ── */
.gd-tab-bar {
  display: inline-flex; align-items: center;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 99px; padding: 4px; gap: 2px;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.06);
  margin-bottom: var(--space-xl);
  overflow-x: auto; scrollbar-width: none;
}
.gd-tab-bar::-webkit-scrollbar { display: none; }
.gd-tab-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 16px; border-radius: 99px; border: none;
  background: transparent; color: var(--text-secondary);
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
  white-space: nowrap; font-family: var(--font-sans); flex-shrink: 0;
}
.gd-tab-btn i { font-size: 14px; }
.gd-tab-btn:hover:not(.active) { color: var(--text-primary); background: var(--bg-hover); }
.gd-tab-btn.active {
  background: var(--bg-page); color: var(--text-primary); font-weight: 600;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.06);
}
.gd-tab-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 20px; height: 18px; padding: 0 5px; border-radius: 99px;
  background: var(--bg-hover); border: 1px solid var(--border-default);
  font-size: 10px; font-weight: 600; color: var(--text-secondary);
}
.gd-tab-btn.active .gd-tab-count {
  background: rgba(0,75,160,0.12);
  border-color: rgba(0,75,160,0.3);
  color: var(--caci-blue-light);
}

/* ── Tab panels ── */
.gd-tab-panel { display: none; }
.gd-tab-panel.active { display: block; }

/* ── Action buttons ── */
.gd-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 0 14px; height: 36px; border-radius: var(--radius-md);
  font-size: 13px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--border-default);
  background: var(--bg-page); color: var(--text-secondary);
  transition: all 0.18s cubic-bezier(0.16,1,0.3,1);
  white-space: nowrap; font-family: var(--font-sans);
}
.gd-btn i { font-size: 15px; }
.gd-btn:hover { border-color: var(--border-strong); color: var(--text-primary); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.12); }
.gd-btn:active { transform: translateY(0); box-shadow: none; }
.gd-btn-primary {
  background: linear-gradient(135deg, var(--caci-blue) 0%, var(--caci-blue-light) 100%);
  border-color: transparent; color: #fff; font-weight: 600;
  box-shadow: 0 2px 10px rgba(0,75,160,0.3);
}
.gd-btn-primary:hover { box-shadow: 0 6px 20px rgba(0,75,160,0.4); border-color: transparent; color: #fff; }
.gd-btn-danger { background: rgba(198,0,38,0.06); border-color: rgba(198,0,38,0.22); color: var(--caci-red); }
.gd-btn-danger:hover { background: rgba(198,0,38,0.12); border-color: rgba(198,0,38,0.4); color: var(--caci-red); }

/* ── Hero card ── */
.gd-hero {
  border: 1px solid var(--border-default); border-radius: 18px; overflow: hidden;
  background: var(--bg-card);
  animation: gdFadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both;
  margin-bottom: var(--space-lg);
}
@keyframes gdFadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
.gd-hero-banner { height: 96px; position: relative; }
.gd-hero-banner-icon {
  position: absolute; bottom: 14px; left: 22px;
  width: 52px; height: 52px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  border: 2.5px solid var(--bg-card);
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
}
.gd-hero-banner-icon i { font-size: 24px; }
.gd-hero-body { padding: 12px 22px 20px; }
.gd-hero-name {
  font-size: 20px; font-weight: 700; color: var(--text-primary);
  margin: 0 0 6px; line-height: 1.2;
}
.gd-hero-desc {
  font-size: 13px; color: var(--text-secondary); line-height: 1.6;
  margin: 10px 0 0; max-width: 720px;
}

/* ── Mini stat cards ── */
.gd-stats-row {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md); margin-bottom: var(--space-lg);
  animation: gdFadeUp 0.45s cubic-bezier(0.16,1,0.3,1) 80ms both;
}
@media (max-width: 860px) { .gd-stats-row { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .gd-stats-row { grid-template-columns: 1fr 1fr; gap: var(--space-sm); } }
.gd-mini-stat {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); padding: var(--space-md);
  transition: border-color 0.2s, transform 0.2s;
}
.gd-mini-stat:hover { border-color: var(--border-strong); transform: translateY(-1px); }
.gd-mini-stat-icon-row {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
}
.gd-mini-stat-icon {
  width: 30px; height: 30px; border-radius: var(--radius-xs);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.gd-mini-stat-icon i { font-size: 14px; }
.gd-mini-stat-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--text-muted);
}
.gd-mini-stat-value { font-size: 22px; font-weight: 700; color: var(--text-primary); }
.gd-mini-stat-sub   { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }

/* ── Two-column overview layout ── */
.gd-overview-grid {
  display: grid; grid-template-columns: 1fr 340px;
  gap: var(--space-xl);
  animation: gdFadeUp 0.45s cubic-bezier(0.16,1,0.3,1) 120ms both;
}
@media (max-width: 1100px) { .gd-overview-grid { grid-template-columns: 1fr; } }

/* ── Detail card ── */
.gd-detail-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); overflow: hidden;
  margin-bottom: var(--space-lg);
}
.gd-detail-card:last-child { margin-bottom: 0; }
.gd-detail-card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--border-default);
  background: rgba(255,255,255,0.01);
}
.gd-detail-card-title { display: flex; align-items: center; gap: 8px; }
.gd-detail-card-title i { font-size: 16px; }
.gd-detail-card-title span { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.gd-detail-card-body { padding: 14px 16px; }

/* ── Sidebar panel ── */
.gd-sidebar-panel {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); overflow: hidden;
  margin-bottom: var(--space-lg);
}
.gd-sidebar-panel:last-child { margin-bottom: 0; }
.gd-sidebar-section { padding: 14px 16px; border-bottom: 1px solid var(--border-default); }
.gd-sidebar-section:last-child { border-bottom: none; }
.gd-sidebar-section-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 10px;
}

/* ── Info fields ── */
.gd-info-field { margin-bottom: 13px; }
.gd-info-field:last-child { margin-bottom: 0; }
.gd-info-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 4px;
}
.gd-info-value { font-size: 13px; color: var(--text-primary); }

/* ── Progress bar ── */
.gd-progress { height: 4px; border-radius: 99px; background: var(--border-default); overflow: hidden; }
.gd-progress-fill { height: 100%; border-radius: 99px; transition: width 0.6s cubic-bezier(0.16,1,0.3,1); }

/* ── Role breakdown row ── */
.gd-role-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 5px 0; border-bottom: 1px solid var(--border-default);
  font-size: 12px;
}
.gd-role-row:last-child { border-bottom: none; }

/* ── Member row ── */
.gd-member-row {
  display: flex; align-items: center; gap: 12px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); padding: 11px 14px;
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
  cursor: pointer; margin-bottom: 8px;
  animation: gdSlideUp 0.35s cubic-bezier(0.16,1,0.3,1) both;
}
.gd-member-row:last-child { margin-bottom: 0; }
.gd-member-row:hover { border-color: rgba(0,75,160,0.35); transform: translateX(3px); box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
@keyframes gdSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Role badge ── */
.gd-role-badge {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 8px; border-radius: 99px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.02em;
  white-space: nowrap;
}

/* ── Avatar ── */
.gd-avatar {
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-weight: 700; color: #fff; flex-shrink: 0;
}

/* ── Activity row ── */
.gd-activity-row {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 11px 0; border-bottom: 1px solid var(--border-default);
}
.gd-activity-row:last-child { border-bottom: none; }

/* ── Toolbar (members / services tabs) ── */
.gd-toolbar {
  display: flex; align-items: center; gap: var(--space-sm);
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); padding: 10px var(--space-md);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}
.gd-search-wrap {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); padding: 0 12px;
  height: 36px; flex: 1; min-width: 160px; max-width: 300px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.gd-search-wrap:focus-within { border-color: var(--caci-blue); box-shadow: 0 0 0 3px var(--focus-ring); }
.gd-search-wrap i { font-size: 14px; color: var(--text-muted); transition: color 0.2s; flex-shrink: 0; }
.gd-search-wrap:focus-within i { color: var(--caci-blue); }
.gd-search-wrap input {
  background: transparent; border: none; outline: none;
  font-size: 13px; color: var(--text-primary); font-family: var(--font-sans); width: 100%;
}
.gd-search-wrap input::placeholder { color: var(--text-muted); }

.gd-filter-select {
  appearance: none; -webkit-appearance: none;
  height: 36px; border-radius: var(--radius-md);
  border: 1px solid var(--border-default); background: var(--bg-page);
  color: var(--text-primary); font-size: 12px; font-family: var(--font-sans);
  font-weight: 500; cursor: pointer; outline: none; padding: 0 28px 0 10px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 8px center;
  transition: border-color 0.2s;
}
.gd-filter-select:focus { border-color: var(--caci-blue); }
.gd-filter-select option { background: var(--bg-card); }

/* ── Status badge ── */
.gd-status-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 99px;
  font-size: 10px; font-weight: 600;
}

/* ── Quick action button (sidebar) ── */
.gd-quick-btn {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-default); background: transparent;
  color: var(--text-secondary); font-size: 13px; font-weight: 500;
  cursor: pointer; font-family: var(--font-sans);
  transition: all 0.18s; margin-bottom: 6px;
  text-align: left;
}
.gd-quick-btn:last-child { margin-bottom: 0; }
.gd-quick-btn i { font-size: 15px; flex-shrink: 0; }
.gd-quick-btn:hover { border-color: var(--border-strong); color: var(--text-primary); background: var(--bg-hover); }
.gd-quick-btn-danger { border-color: rgba(198,0,38,0.2); color: var(--caci-red); }
.gd-quick-btn-danger:hover { border-color: rgba(198,0,38,0.4); background: var(--bg-danger); }

/* ── Modal ── */
.gd-modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px); z-index: 1000;
  display: flex; align-items: center; justify-content: center; padding: var(--space-lg);
  opacity: 0; transition: opacity 0.2s; pointer-events: none;
}
.gd-modal-backdrop.visible { opacity: 1; pointer-events: all; }
.gd-modal-box {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 80px rgba(0,0,0,0.35);
  width: 100%; max-width: 520px; max-height: 88vh;
  display: flex; flex-direction: column;
  transform: translateY(10px) scale(0.98);
  transition: transform 0.25s cubic-bezier(0.16,1,0.3,1);
}
.gd-modal-backdrop.visible .gd-modal-box { transform: translateY(0) scale(1); }
.gd-modal-sm .gd-modal-box { max-width: 400px; }
.gd-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid var(--border-default); flex-shrink: 0;
}
.gd-modal-title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0; }
.gd-modal-close {
  width: 28px; height: 28px; border: none; background: transparent;
  color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; transition: background 0.12s;
}
.gd-modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }
.gd-modal-body { padding: 18px; overflow-y: auto; flex: 1; }
.gd-modal-footer {
  padding: 12px 18px; border-top: 1px solid var(--border-default);
  display: flex; justify-content: flex-end; gap: var(--space-sm); flex-shrink: 0;
}

/* ── Form fields (modal) ── */
.gd-field { margin-bottom: 14px; }
.gd-field:last-child { margin-bottom: 0; }
.gd-field label {
  display: block; font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--text-secondary); margin-bottom: 5px;
}
.gd-field input, .gd-field select, .gd-field textarea {
  width: 100%; background: var(--bg-page);
  border: 1px solid var(--border-default); border-radius: var(--radius-sm);
  padding: 8px 12px; font-size: 13px; font-family: var(--font-sans);
  color: var(--text-primary); outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.gd-field input::placeholder, .gd-field textarea::placeholder { color: var(--text-muted); }
.gd-field input:focus, .gd-field select:focus, .gd-field textarea:focus {
  border-color: var(--caci-blue); box-shadow: 0 0 0 3px var(--focus-ring);
}
.gd-field textarea { resize: vertical; min-height: 72px; }
.gd-field select { cursor: pointer; appearance: none; -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center; padding-right: 30px;
}
.gd-field select option { background: var(--bg-card); }
.gd-field-err { font-size: 11px; color: var(--caci-red); margin-top: 3px; display: none; }
.gd-field-err.show { display: block; }

/* ── Member search results ── */
.gd-member-search-result {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: var(--radius-sm);
  cursor: pointer; transition: background 0.15s; border: 1px solid transparent;
}
.gd-member-search-result:hover { background: var(--bg-hover); }
.gd-member-search-result.selected {
  background: rgba(0,75,160,0.08);
  border-color: rgba(0,75,160,0.3);
  border-radius: var(--radius-sm);
}

/* ── Selected member info chip ── */
.gd-selected-chip {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  background: rgba(0,75,160,0.06); border: 1px solid rgba(0,75,160,0.2);
  margin-top: var(--space-sm);
}

/* ── Attendance mark row ── */
.gd-att-mark-row {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 10px; border-radius: var(--radius-sm);
  background: var(--bg-page); border: 1px solid var(--border-default);
  margin-bottom: 6px;
}
.gd-att-mark-row:last-child { margin-bottom: 0; }
.gd-att-mark-select {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-xs); padding: 3px 8px;
  color: var(--text-primary); font-size: 12px; font-family: var(--font-sans);
  cursor: pointer; outline: none;
}

/* ── Confirm dialog ── */
.gd-confirm-icon {
  width: 42px; height: 42px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 20px;
  margin-bottom: 12px;
}
.gd-confirm-title { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
.gd-confirm-msg   { font-size: 13px; color: var(--text-secondary); line-height: 1.55; }

/* ── Spinner ── */
.gd-spinner {
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  animation: gdSpin 0.7s linear infinite; display: inline-block; vertical-align: middle;
}
@keyframes gdSpin { to { transform: rotate(360deg); } }

/* ── Service detail info chip grid ── */
.gd-info-chip-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 14px; }
.gd-info-chip {
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: var(--radius-sm); padding: 10px 12px;
}
.gd-info-chip-label {
  display: flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 4px;
}
.gd-info-chip-label i { font-size: 12px; }
.gd-info-chip-value { font-size: 13px; font-weight: 600; color: var(--text-primary); }

/* ── Attendance summary row (service detail) ── */
.gd-att-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0; border-bottom: 1px solid var(--border-default);
}
.gd-att-row:last-child { border-bottom: none; }

/* ── Empty state ── */
.gd-empty {
  display: flex; flex-direction: column; align-items: center;
  padding: 40px 16px; text-align: center; color: var(--text-secondary);
}
.gd-empty i { font-size: 2.5rem; color: var(--border-strong); margin-bottom: var(--space-md); }
.gd-empty p { font-size: 13px; }
`

function _injectCSS(): void {
  if (document.getElementById('gd-page-css')) return
  const s = document.createElement('style')
  s.id = 'gd-page-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

// ── Type info ─────────────────────────────────────────────────────────────────
interface TypeInfo { label: string; icon: string; color: string; bg: string; border: string; banner: string }
const TYPE_INFO: Record<string, TypeInfo> = {
  department: { label:'Department', icon:'bi-building',     color:'#58a6ff', bg:'rgba(88,166,255,0.12)',  border:'rgba(88,166,255,0.3)',  banner:'linear-gradient(135deg,#1a3a5c 0%,#111e2e 100%)' },
  age_group:  { label:'Age Group',  icon:'bi-people-fill',  color:'#e3b341', bg:'rgba(227,179,65,0.12)',  border:'rgba(227,179,65,0.3)',  banner:'linear-gradient(135deg,#3a2800 0%,#1e1500 100%)' },
}
function typeInfo(t: string): TypeInfo { return TYPE_INFO[t] ?? TYPE_INFO['department'] }

// ── Role config ───────────────────────────────────────────────────────────────
interface RoleCfg { label: string; bg: string; border: string; color: string }
function roleCfg(role: string): RoleCfg {
  switch (role) {
    case 'leader':           return { label:'Leader',       bg:'rgba(0,75,160,0.12)',  border:'rgba(0,75,160,0.3)',  color:'var(--caci-blue-light)' }
    case 'assistant_leader': return { label:'Asst. Leader', bg:'rgba(124,58,237,0.1)', border:'rgba(124,58,237,0.3)',color:'#a78bfa'                }
    default:                 return { label:'Member',       bg:'rgba(139,148,158,0.1)',border:'rgba(139,148,158,0.2)',color:'var(--text-secondary)'  }
  }
}

// ── Service status config ─────────────────────────────────────────────────────
interface StatusCfg { color: string; bg: string; border: string; icon: string }
function statusCfg(s: string): StatusCfg {
  switch (s) {
    case 'completed': return { color:'#56d364', bg:'rgba(34,197,94,0.08)',   border:'rgba(34,197,94,0.22)',   icon:'bi-check-circle-fill' }
    case 'scheduled': return { color:'var(--caci-blue-light)', bg:'rgba(0,75,160,0.08)', border:'rgba(0,75,160,0.22)', icon:'bi-clock-fill' }
    case 'cancelled': return { color:'var(--text-muted)', bg:'rgba(139,148,158,0.08)', border:'rgba(139,148,158,0.22)', icon:'bi-x-circle-fill' }
    default:          return { color:'var(--text-muted)', bg:'var(--bg-hover)', border:'var(--border-default)', icon:'bi-question-circle' }
  }
}

// ── Attendance status config ──────────────────────────────────────────────────
function attCfg(s: string) {
  switch (s) {
    case 'present': return { color:'#56d364', icon:'bi-check-circle-fill' }
    case 'absent':  return { color:'var(--caci-red)', icon:'bi-x-circle-fill' }
    case 'excused': return { color:'#e3b341', icon:'bi-clock-fill' }
    default:        return { color:'var(--text-muted)', icon:'bi-question-circle' }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#004BA0','#C60026','#1a5fb4','#7c3aed','#1a7f37','#9a6700','#0969da']
function avatarColor(name: string): string {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(name: string): string {
  const p = name.trim().split(' ')
  return ((p[0]?.[0] ?? '') + (p[p.length - 1]?.[0] ?? '')).toUpperCase()
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
}
function fmtTime(t: string | null | undefined): string {
  if (!t) return ''
  const [hStr, m] = t.split(':')
  const h = parseInt(hStr)
  return `${h > 12 ? h - 12 : h || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`
}

// ── Page state ────────────────────────────────────────────────────────────────
let _groupId:   string | null = null
let _group:     Group | null = null
let _members:   GroupMemberWithMember[] = []
let _container: HTMLElement | null = null
let _destroyed  = false
let _activeTab  = 'overview'

// ── Event handlers ────────────────────────────────────────────────────────────
function _onGroupUpdated(data: unknown) {
  const d = data as { id: string }
  if (d?.id === _groupId) _reload()
}

// ── Data load ─────────────────────────────────────────────────────────────────
async function _reload(): Promise<void> {
  if (_destroyed || !_groupId) return
  try {
    const [group, members] = await Promise.all([
      getGroup(_groupId),
      listGroupMembers(_groupId),
    ])
    _group   = group
    _members = members
    _renderPage()
  } catch (err) {
    console.error('[GroupDetail] reload error', err)
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer: ReturnType<typeof setTimeout> | null = null
function _toast(type: 'success' | 'error' | 'info', msg: string): void {
  const icons  = { success:'bi-check-circle-fill', error:'bi-exclamation-circle-fill', info:'bi-info-circle-fill' }
  const colors = { success:'#56d364', error:'var(--caci-red)', info:'var(--caci-blue-light)' }
  let el = document.getElementById('gd-toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'gd-toast'
    el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(10px);
      background:var(--bg-card);border:1px solid var(--border-default);border-radius:var(--radius-md);
      padding:10px 16px;display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-primary);
      z-index:2000;box-shadow:0 8px 32px rgba(0,0,0,0.2);
      opacity:0;transition:opacity 0.2s,transform 0.2s;pointer-events:none;`
    document.body.appendChild(el)
  }
  el.innerHTML = `<i class="bi ${icons[type]}" style="color:${colors[type]};font-size:16px;"></i><span>${msg}</span>`
  el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)'
  if (_toastTimer) clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => {
    if (el) { el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(10px)' }
  }, 3200)
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function _openModal(id: string): void {
  const el = document.getElementById(id); if (!el) return
  el.classList.add('visible'); document.body.style.overflow = 'hidden'
}
function _closeModal(id: string): void {
  const el = document.getElementById(id); if (!el) return
  el.classList.remove('visible'); document.body.style.overflow = ''
}

// ── Stats helpers ─────────────────────────────────────────────────────────────
function _calcAttRate(): number { return 0 /* services not in scope yet — real impl would query service_attendance */ }

// ── Full page render ──────────────────────────────────────────────────────────
function _renderPage(): void {
  if (_destroyed || !_group || !_container) return
  const user = getCurrentUser()
  const canEdit    = user && can(user, PERMISSIONS.GROUPS_EDIT)
  const canManage  = user && can(user, PERMISSIONS.GROUPS_MEMBERS_MANAGE)
  const canDelete  = user && can(user, PERMISSIONS.GROUPS_DELETE)

  const ti        = typeInfo(_group.group_type)
  const active    = _members.filter(m => m.is_active)
  const total     = _members.length
  const leaderM   = _members.find(m => m.role === 'leader')

  _container.innerHTML = /* html */`
  <div class="gd-page">

    <!-- Breadcrumbs injected via renderBreadcrumbs below -->
    <div id="gd-breadcrumbs"></div>

    <!-- Page header removed (actions moved to breadcrumbs) -->

    <!-- Tab bar -->
    <div class="gd-tab-bar">
      <button class="gd-tab-btn active" data-tab="overview">
        <i class="bi bi-grid-3x3-gap-fill"></i> Overview
      </button>
      <button class="gd-tab-btn" data-tab="members">
        <i class="bi bi-people-fill"></i> Members
        <span class="gd-tab-count" id="gd-tab-count-members">${active.length}</span>
      </button>
      <button class="gd-tab-btn" data-tab="activity">
        <i class="bi bi-clock-history"></i> Activity
      </button>
    </div>

    <!-- TAB: Overview -->
    <div class="gd-tab-panel active" id="gd-tab-overview">

      <!-- Hero -->
      <div class="gd-hero">
        <div class="gd-hero-banner" style="background:${ti.banner};">
          <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 20% 50%,${ti.bg},transparent 60%);"></div>
          <div style="position:absolute;top:12px;right:14px;">
            <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;
              background:${_group.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(139,148,158,0.1)'};
              border:1px solid ${_group.is_active ? 'rgba(34,197,94,0.28)' : 'rgba(139,148,158,0.2)'};
              font-size:11px;font-weight:600;color:${_group.is_active ? '#56d364' : 'var(--text-muted)'};">
              <span style="width:5px;height:5px;border-radius:50%;background:${_group.is_active ? '#56d364' : 'var(--text-muted)'};display:inline-block;"></span>
              ${_group.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div class="gd-hero-banner-icon" style="background:${ti.bg};">
            <i class="bi ${ti.icon}" style="color:${ti.color};font-size:22px;"></i>
          </div>
        </div>
        <div class="gd-hero-body">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-lg);flex-wrap:wrap;">
            <div>
              <h1 class="gd-hero-name">${_group.name}</h1>
              <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:99px;
                background:${ti.bg};border:1px solid ${ti.border};font-size:11px;font-weight:600;color:${ti.color};">
                <i class="bi ${ti.icon}" style="font-size:10px;"></i>${ti.label}
              </span>
            </div>
            <div style="text-align:right;">
              <div style="font-size:22px;font-weight:700;color:var(--text-primary);">
                ${active.length}<span style="font-size:14px;font-weight:400;color:var(--text-secondary);">/${total}</span>
              </div>
              <div style="font-size:10px;color:var(--text-secondary);">active members</div>
            </div>
          </div>
          ${_group.description ? `<p class="gd-hero-desc">${_group.description}</p>` : ''}
          ${leaderM ? `
          <div style="margin-top:14px;display:flex;align-items:center;gap:10px;">
            <div class="gd-avatar" style="width:28px;height:28px;font-size:10px;background:${avatarColor(leaderM.member_name)};">${initials(leaderM.member_name)}</div>
            <div>
              <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Leader</div>
              <div style="font-size:13px;color:var(--text-primary);font-weight:500;">${leaderM.member_name}</div>
            </div>
          </div>` : ''}
        </div>
      </div>

      <!-- Mini stats -->
      <div class="gd-stats-row">
        ${_miniStat('bi-people-fill','var(--caci-blue-light)','rgba(0,75,160,0.1)','Total Members', String(total), `${active.length} active`)}
        ${_miniStat('bi-check-circle-fill','#56d364','rgba(34,197,94,0.1)','Active Members', String(active.length), `${total - active.length} inactive`)}
        ${_miniStat('bi-person-fill','var(--caci-blue-light)','rgba(0,75,160,0.1)','Leader', leaderM ? leaderM.member_name.split(' ')[0] : '—', leaderM ? 'Group leader' : 'Not assigned')}
        ${_miniStat('bi-calendar-check-fill','#e3b341','rgba(227,179,65,0.1)','Created', fmtDate(_group.created_at), ti.label)}
      </div>

      <!-- Two-column layout -->
      <div class="gd-overview-grid">

        <!-- Left col -->
        <div>
          <!-- Members preview -->
          <div class="gd-detail-card">
            <div class="gd-detail-card-header">
              <div class="gd-detail-card-title">
                <i class="bi bi-people-fill" style="color:var(--caci-blue-light);"></i>
                <span>Members</span>
              </div>
              <button class="gd-btn" style="height:28px;font-size:11px;" data-tab-goto="members">
                <i class="bi bi-arrow-right" style="font-size:12px;"></i> View all
              </button>
            </div>
            <div class="gd-detail-card-body" id="gd-overview-members">
              ${_renderOverviewMembers()}
            </div>
          </div>

          <!-- Activity preview -->
          <div class="gd-detail-card">
            <div class="gd-detail-card-header">
              <div class="gd-detail-card-title">
                <i class="bi bi-clock-history" style="color:#e3b341;"></i>
                <span>Recent Activity</span>
              </div>
            </div>
            <div class="gd-detail-card-body">
              <div class="gd-activity-row">
                <div style="width:32px;height:32px;border-radius:50%;background:var(--bg-hover);border:1px solid var(--border-default);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                  <i class="bi bi-pencil" style="font-size:14px;color:var(--text-secondary);"></i>
                </div>
                <div>
                  <div style="font-size:13px;color:var(--text-primary);">Group created</div>
                  <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${fmtDate(_group.created_at)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right col -->
        <div>

          <!-- Group info sidebar -->
          <div class="gd-sidebar-panel">
            <div class="gd-sidebar-section">
              <div class="gd-sidebar-section-title">Group Info</div>
              <div class="gd-info-field">
                <div class="gd-info-label">Type</div>
                <div class="gd-info-value" style="display:flex;align-items:center;gap:5px;">
                  <i class="bi ${ti.icon}" style="color:${ti.color};font-size:13px;"></i> ${ti.label}
                </div>
              </div>
              <div class="gd-info-field">
                <div class="gd-info-label">Status</div>
                <div class="gd-info-value">
                  <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;
                    font-size:11px;font-weight:600;
                    background:${_group.is_active ? 'rgba(34,197,94,0.1)' : 'var(--bg-hover)'};
                    border:1px solid ${_group.is_active ? 'rgba(34,197,94,0.25)' : 'var(--border-default)'};
                    color:${_group.is_active ? '#56d364' : 'var(--text-secondary)'};">
                    <span style="width:5px;height:5px;border-radius:50%;background:${_group.is_active ? '#56d364' : 'var(--text-muted)'};display:inline-block;"></span>
                    ${_group.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div class="gd-info-field" style="margin-bottom:0;">
                <div class="gd-info-label">Created</div>
                <div class="gd-info-value">${fmtDate(_group.created_at)}</div>
              </div>
            </div>

            <div class="gd-sidebar-section">
              <div class="gd-sidebar-section-title">Role Breakdown</div>
              ${_renderRoleBreakdown()}
            </div>
          </div>

          <!-- Quick actions -->
          <div class="gd-sidebar-panel">
            <div class="gd-sidebar-section">
              <div class="gd-sidebar-section-title">Quick Actions</div>
              ${canManage ? `<button class="gd-quick-btn" id="gd-qa-add-member"><i class="bi bi-person-plus" style="color:#56d364;"></i> Add Member</button>` : ''}
              ${canEdit   ? `<button class="gd-quick-btn" id="gd-qa-edit"><i class="bi bi-pencil" style="color:var(--caci-blue-light);"></i> Edit Group</button>` : ''}
              ${canDelete ? `
              <button class="gd-quick-btn gd-quick-btn-danger" id="gd-qa-toggle">
                <i class="bi bi-${_group.is_active ? 'slash-circle' : 'arrow-clockwise'}"></i>
                ${_group.is_active ? 'Deactivate Group' : 'Activate Group'}
              </button>` : ''}
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- TAB: Members -->
    <div class="gd-tab-panel" id="gd-tab-members">
      <div class="gd-toolbar">
        <div class="gd-search-wrap">
          <i class="bi bi-search"></i>
          <input type="text" id="gd-member-search" placeholder="Search members…" autocomplete="off">
        </div>
        <select class="gd-filter-select" id="gd-role-filter">
          <option value="all">All roles</option>
          <option value="leader">Leader</option>
          <option value="assistant_leader">Asst. Leader</option>
          <option value="member">Member</option>
        </select>
        ${canManage ? `<button class="gd-btn gd-btn-primary" id="gd-members-add-btn"><i class="bi bi-person-plus"></i> Add Member</button>` : ''}
      </div>
      <div id="gd-member-list"></div>
    </div>

    <!-- TAB: Activity -->
    <div class="gd-tab-panel" id="gd-tab-activity">
      <div class="gd-detail-card">
        <div class="gd-detail-card-header">
          <div class="gd-detail-card-title">
            <i class="bi bi-clock-history" style="color:#e3b341;"></i>
            <span>Audit Log</span>
          </div>
        </div>
        <div class="gd-detail-card-body">
          <div class="gd-activity-row">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--bg-hover);border:1px solid var(--border-default);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="bi bi-plus-circle" style="font-size:14px;color:#56d364;"></i>
            </div>
            <div>
              <div style="font-size:13px;color:var(--text-primary);">Group created</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${fmtDate(_group.created_at)}</div>
            </div>
          </div>
          <div style="margin-top:var(--space-lg);padding:var(--space-md);background:var(--bg-hover);border-radius:var(--radius-sm);font-size:12px;color:var(--text-secondary);">
            <i class="bi bi-info-circle" style="margin-right:5px;"></i>
            Full audit log integration is coming soon. All member and group changes will appear here.
          </div>
        </div>
      </div>
    </div>

  </div>

  <!-- ── Modals ── -->

  <!-- Edit Group Modal -->
  <div class="gd-modal-backdrop" id="gd-edit-modal">
    <div class="gd-modal-box">
      <div class="gd-modal-header">
        <h2 class="gd-modal-title">Edit Group</h2>
        <button class="gd-modal-close" data-close-modal="gd-edit-modal"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="gd-modal-body">
        <div class="gd-field">
          <label for="gd-edit-name">Group Name *</label>
          <input type="text" id="gd-edit-name" maxlength="80" autocomplete="off">
          <div class="gd-field-err" id="gd-edit-name-err">Name is required.</div>
        </div>
        <div class="gd-field">
          <label for="gd-edit-type">Group Type</label>
          <select id="gd-edit-type">
            <option value="department">Department</option>
            <option value="age_group">Age Group</option>
          </select>
        </div>
        <div class="gd-field">
          <label for="gd-edit-desc">Description</label>
          <textarea id="gd-edit-desc" placeholder="What does this group do?"></textarea>
        </div>
      </div>
      <div class="gd-modal-footer">
        <button class="gd-btn" data-close-modal="gd-edit-modal">Cancel</button>
        <button class="gd-btn gd-btn-primary" id="gd-edit-save-btn">
          <i class="bi bi-floppy"></i> Save Changes
        </button>
      </div>
    </div>
  </div>

  <!-- Add Member Modal -->
  <div class="gd-modal-backdrop" id="gd-add-member-modal">
    <div class="gd-modal-box">
      <div class="gd-modal-header">
        <h2 class="gd-modal-title">Add Member to Group</h2>
        <button class="gd-modal-close" data-close-modal="gd-add-member-modal"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="gd-modal-body">
        <div class="gd-field">
          <label>Search Member</label>
          <div class="gd-search-wrap" style="max-width:100%;height:40px;">
            <i class="bi bi-search"></i>
            <input type="text" id="gd-add-search" placeholder="Name or membership number…" autocomplete="off">
          </div>
        </div>
        <div id="gd-add-results" style="display:flex;flex-direction:column;gap:2px;margin-top:4px;max-height:200px;overflow-y:auto;"></div>
        <div id="gd-add-selected" class="gd-selected-chip" style="display:none;">
          <i class="bi bi-person-check-fill" style="color:var(--caci-blue-light);font-size:16px;"></i>
          <span id="gd-add-selected-name" style="font-size:13px;font-weight:600;color:var(--text-primary);flex:1;"></span>
        </div>
        <div class="gd-field" style="margin-top:var(--space-md);">
          <label for="gd-add-role">Role in Group</label>
          <select id="gd-add-role">
            <option value="member">Member</option>
            <option value="assistant_leader">Assistant Leader</option>
            <option value="leader">Leader</option>
          </select>
        </div>
        <div class="gd-field-err" id="gd-add-err" style="display:none;"></div>
      </div>
      <div class="gd-modal-footer">
        <button class="gd-btn" data-close-modal="gd-add-member-modal">Cancel</button>
        <button class="gd-btn gd-btn-primary" id="gd-add-confirm-btn">
          <i class="bi bi-person-plus"></i> Add to Group
        </button>
      </div>
    </div>
  </div>

  <!-- Member Detail Modal -->
  <div class="gd-modal-backdrop" id="gd-member-detail-modal">
    <div class="gd-modal-box" style="max-width:440px;">
      <div class="gd-modal-header">
        <h2 class="gd-modal-title">Member Details</h2>
        <button class="gd-modal-close" data-close-modal="gd-member-detail-modal"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="gd-modal-body" id="gd-member-detail-body"></div>
      <div class="gd-modal-footer" id="gd-member-detail-footer"></div>
    </div>
  </div>

  <!-- Confirm Modal (generic) -->
  <div class="gd-modal-backdrop gd-modal-sm" id="gd-confirm-modal">
    <div class="gd-modal-box">
      <div class="gd-modal-body" style="padding:28px 22px 20px;text-align:center;">
        <div class="gd-confirm-icon" id="gd-confirm-icon" style="margin:0 auto 12px;background:var(--bg-danger);color:var(--caci-red);">
          <i class="bi" id="gd-confirm-icon-i" style="font-size:20px;"></i>
        </div>
        <div class="gd-confirm-title" id="gd-confirm-title"></div>
        <div class="gd-confirm-msg"   id="gd-confirm-msg"></div>
      </div>
      <div class="gd-modal-footer">
        <button class="gd-btn" data-close-modal="gd-confirm-modal">Cancel</button>
        <button class="gd-btn gd-btn-danger" id="gd-confirm-action-btn">Confirm</button>
      </div>
    </div>
  </div>
  `

  // ── Breadcrumbs ──
  const breadcrumbEl = _container.querySelector<HTMLElement>('#gd-breadcrumbs')!
  const trailingActions = document.createElement('div')
  trailingActions.className = 'gd-header-actions'
  if (canEdit) {
    const btn = document.createElement('button')
    btn.className = 'gd-btn'
    btn.id = 'gd-edit-btn'
    btn.innerHTML = `<i class="bi bi-pencil"></i> Edit`
    trailingActions.appendChild(btn)
  }
  if (canManage) {
    const btn = document.createElement('button')
    btn.className = 'gd-btn gd-btn-primary'
    btn.id = 'gd-add-member-btn'
    btn.innerHTML = `<i class="bi bi-person-plus"></i> Add Member`
    trailingActions.appendChild(btn)
  }

  renderBreadcrumbs(breadcrumbEl, [
    { label: 'Groups & Units', path: '/groups' },
    { label: _group.name },
  ], { trailing: trailingActions })

  // ── Bind events ──
  _bindEvents()

  // ── Members tab initial render ──
  _renderMemberList()
}

// ── Mini stat helper ──────────────────────────────────────────────────────────
function _miniStat(icon: string, color: string, bg: string, label: string, value: string, sub: string): string {
  return `<div class="gd-mini-stat">
    <div class="gd-mini-stat-icon-row">
      <div class="gd-mini-stat-icon" style="background:${bg};">
        <i class="bi ${icon}" style="color:${color};"></i>
      </div>
      <span class="gd-mini-stat-label">${label}</span>
    </div>
    <div class="gd-mini-stat-value">${value}</div>
    ${sub ? `<div class="gd-mini-stat-sub">${sub}</div>` : ''}
  </div>`
}

// ── Overview members ──────────────────────────────────────────────────────────
function _renderOverviewMembers(): string {
  const active = _members.filter(m => m.is_active).slice(0, 5)
  if (!active.length) return `<div class="gd-empty"><i class="bi bi-person-x"></i><p>No active members yet</p></div>`
  return active.map(gm => {
    const rc   = roleCfg(gm.role)
    const bg   = avatarColor(gm.member_name)
    const init = initials(gm.member_name)
    return `<div class="gd-member-row" data-gm-id="${gm.id}" style="margin-bottom:6px;">
      <div class="gd-avatar" style="width:36px;height:36px;font-size:12px;background:${bg};">${init}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${gm.member_name}</div>
        <div style="font-size:11px;color:var(--text-secondary);">Joined ${fmtDate(gm.joined_at)}</div>
      </div>
      <span class="gd-role-badge" style="background:${rc.bg};border:1px solid ${rc.border};color:${rc.color};">${rc.label}</span>
    </div>`
  }).join('')
}

// ── Role breakdown ────────────────────────────────────────────────────────────
function _renderRoleBreakdown(): string {
  const counts = { leader: 0, assistant_leader: 0, member: 0 }
  _members.filter(m => m.is_active).forEach(m => {
    if (m.role in counts) counts[m.role as keyof typeof counts]++
  })
  return [
    ['Leader',       counts.leader,           'var(--caci-blue-light)'],
    ['Asst. Leader', counts.assistant_leader,  '#a78bfa'],
    ['Member',       counts.member,            'var(--text-secondary)'],
  ].map(([label, count, color]) => `
    <div class="gd-role-row">
      <span style="color:var(--text-secondary);">${label}</span>
      <span style="font-weight:600;color:${color};">${count}</span>
    </div>`).join('')
}

// ── Members tab full list ─────────────────────────────────────────────────────
function _renderMemberList(search = '', role = 'all'): void {
  const el = _container?.querySelector<HTMLElement>('#gd-member-list')
  if (!el) return
  const user = getCurrentUser()
  const canManage = user && can(user, PERMISSIONS.GROUPS_MEMBERS_MANAGE)

  const list = _members.filter(m => {
    const nameOk = !search || m.member_name.toLowerCase().includes(search) || m.member_id.toLowerCase().includes(search)
    const roleOk = role === 'all' || m.role === role
    return nameOk && roleOk
  })

  if (!list.length) {
    el.innerHTML = `<div class="gd-empty"><i class="bi bi-search"></i><p>No members match your filter</p></div>`
    return
  }

  el.innerHTML = list.map((gm, i) => {
    const rc   = roleCfg(gm.role)
    const bg   = avatarColor(gm.member_name)
    const init = initials(gm.member_name)
    const delay = Math.min(i * 30, 350)
    return `<div class="gd-member-row" data-gm-id="${gm.id}" style="animation-delay:${delay}ms;">
      <div class="gd-avatar" style="width:40px;height:40px;font-size:13px;background:${bg};">${init}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:13px;font-weight:600;color:var(--text-primary);">${gm.member_name}</span>
          ${!gm.is_active ? `<span style="font-size:10px;padding:1px 6px;border-radius:99px;background:var(--bg-hover);border:1px solid var(--border-default);color:var(--text-muted);">Inactive</span>` : ''}
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px;font-family:var(--font-mono);">${gm.member_id}</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:1px;">Joined ${fmtDate(gm.joined_at)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
        <span class="gd-role-badge" style="background:${rc.bg};border:1px solid ${rc.border};color:${rc.color};">${rc.label}</span>
        <i class="bi bi-chevron-right" style="font-size:14px;color:var(--text-muted);"></i>
      </div>
    </div>`
  }).join('')

  // Bind row clicks to member detail modal
  el.querySelectorAll<HTMLElement>('[data-gm-id]').forEach(row => {
    row.addEventListener('click', () => {
      const gm = _members.find(m => m.id === row.dataset['gmId'])
      if (gm) _openMemberDetail(gm, canManage ?? false)
    })
  })
}

// ── Member detail modal ───────────────────────────────────────────────────────
function _openMemberDetail(gm: GroupMemberWithMember, canManage: boolean): void {
  const bodyEl   = _container?.querySelector<HTMLElement>('#gd-member-detail-body')
  const footerEl = _container?.querySelector<HTMLElement>('#gd-member-detail-footer')
  if (!bodyEl || !footerEl) return

  const rc   = roleCfg(gm.role)
  const bg   = avatarColor(gm.member_name)
  const init = initials(gm.member_name)

  bodyEl.innerHTML = /* html */`
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
      <div class="gd-avatar" style="width:52px;height:52px;font-size:16px;background:${bg};">${init}</div>
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--text-primary);">${gm.member_name}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;font-family:var(--font-mono);">${gm.member_id}</div>
        <div style="margin-top:6px;">
          <span class="gd-role-badge" style="background:${rc.bg};border:1px solid ${rc.border};color:${rc.color};">${rc.label}</span>
          ${!gm.is_active ? `<span class="gd-role-badge" style="background:var(--bg-hover);border:1px solid var(--border-default);color:var(--text-muted);margin-left:5px;">Inactive</span>` : ''}
        </div>
      </div>
    </div>

    <div style="background:var(--bg-page);border:1px solid var(--border-default);border-radius:var(--radius-sm);padding:14px;margin-bottom:14px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div><div class="gd-info-label">Joined</div><div class="gd-info-value" style="font-size:13px;">${fmtDate(gm.joined_at)}</div></div>
        <div><div class="gd-info-label">Role</div><div class="gd-info-value" style="font-size:13px;">${rc.label}</div></div>
        <div><div class="gd-info-label">Status</div><div class="gd-info-value" style="font-size:13px;">${gm.is_active ? 'Active' : 'Inactive'}</div></div>
      </div>
    </div>

    <button class="gd-btn" style="width:100%;justify-content:center;margin-bottom:6px;" id="gd-goto-member-btn">
      <i class="bi bi-arrow-right"></i> View Full Profile
    </button>
  `

  footerEl.innerHTML = canManage ? `
    <button class="gd-btn" id="gd-change-role-btn"><i class="bi bi-person-gear"></i> Change Role</button>
    <button class="gd-btn gd-btn-danger" id="gd-remove-member-btn"><i class="bi bi-person-dash"></i> Remove</button>
  ` : ''

  _container?.querySelector('#gd-goto-member-btn')?.addEventListener('click', () => {
    _closeModal('gd-member-detail-modal')
    navigate(`/members/${gm.member_id}`)
  })

  if (canManage) {
    _container?.querySelector('#gd-change-role-btn')?.addEventListener('click', () => {
      _closeModal('gd-member-detail-modal')
      _openChangeRoleConfirm(gm)
    })
    _container?.querySelector('#gd-remove-member-btn')?.addEventListener('click', () => {
      _closeModal('gd-member-detail-modal')
      _openRemoveConfirm(gm)
    })
  }

  _openModal('gd-member-detail-modal')
}

// ── Change role confirm ───────────────────────────────────────────────────────
function _openChangeRoleConfirm(gm: GroupMemberWithMember): void {
  const iconEl   = _container?.querySelector<HTMLElement>('#gd-confirm-icon')
  const iconI    = _container?.querySelector<HTMLElement>('#gd-confirm-icon-i')
  const titleEl  = _container?.querySelector<HTMLElement>('#gd-confirm-title')
  const msgEl    = _container?.querySelector<HTMLElement>('#gd-confirm-msg')
  const actionEl = _container?.querySelector<HTMLElement>('#gd-confirm-action-btn')
  if (!iconEl || !iconI || !titleEl || !msgEl || !actionEl) return

  iconEl.style.cssText = 'margin:0 auto 12px;background:rgba(0,75,160,0.1);color:var(--caci-blue-light);'
  iconI.className = 'bi bi-person-gear'
  titleEl.textContent = 'Change Role'
  msgEl.innerHTML = `
    <p style="margin-bottom:var(--space-md);">Select new role for <strong style="color:var(--text-primary);">${gm.member_name}</strong>:</p>
    <select id="gd-new-role-select" style="width:100%;background:var(--bg-page);border:1px solid var(--border-default);
      border-radius:var(--radius-sm);padding:8px 12px;color:var(--text-primary);font-size:13px;
      font-family:var(--font-sans);outline:none;">
      <option value="member" ${gm.role === 'member' ? 'selected' : ''}>Member</option>
      <option value="assistant_leader" ${gm.role === 'assistant_leader' ? 'selected' : ''}>Assistant Leader</option>
      <option value="leader" ${gm.role === 'leader' ? 'selected' : ''}>Leader</option>
    </select>`

  actionEl.className = 'gd-btn gd-btn-primary'
  actionEl.textContent = 'Save'

  const oldHandler = actionEl.cloneNode(true) as HTMLElement
  actionEl.replaceWith(oldHandler)
  oldHandler.addEventListener('click', async () => {
    const newRole = (_container?.querySelector<HTMLSelectElement>('#gd-new-role-select'))?.value as GroupMemberRole
    if (!newRole || !_groupId) return
    oldHandler.innerHTML = `<span class="gd-spinner"></span>`
    oldHandler.setAttribute('disabled', '')
    try {
      await assignGroupMember(_groupId, gm.member_id, newRole)
      _closeModal('gd-confirm-modal')
      await _reload()
      _toast('success', 'Role updated.')
    } catch (err: any) {
      _toast('error', err?.message ?? 'Failed to update role.')
      oldHandler.removeAttribute('disabled')
      oldHandler.textContent = 'Save'
    }
  })

  // Reset confirm icon style on close
  iconEl.style.cssText = 'margin:0 auto 12px;background:var(--bg-danger);color:var(--caci-red);'
  _openModal('gd-confirm-modal')
}

// ── Remove member confirm ─────────────────────────────────────────────────────
function _openRemoveConfirm(gm: GroupMemberWithMember): void {
  const iconEl   = _container?.querySelector<HTMLElement>('#gd-confirm-icon')
  const iconI    = _container?.querySelector<HTMLElement>('#gd-confirm-icon-i')
  const titleEl  = _container?.querySelector<HTMLElement>('#gd-confirm-title')
  const msgEl    = _container?.querySelector<HTMLElement>('#gd-confirm-msg')
  const actionEl = _container?.querySelector<HTMLElement>('#gd-confirm-action-btn')
  if (!iconEl || !iconI || !titleEl || !msgEl || !actionEl) return

  iconEl.style.cssText = 'margin:0 auto 12px;background:var(--bg-danger);color:var(--caci-red);'
  iconI.className = 'bi bi-person-dash-fill'
  titleEl.textContent = 'Remove Member'
  msgEl.textContent = `Remove ${gm.member_name} from ${_group?.name ?? 'this group'}? Their member record remains, but they'll no longer appear in this group.`
  actionEl.className = 'gd-btn gd-btn-danger'
  actionEl.textContent = 'Remove'

  const fresh = actionEl.cloneNode(true) as HTMLElement
  actionEl.replaceWith(fresh)
  fresh.addEventListener('click', async () => {
    if (!_groupId) return
    fresh.innerHTML = `<span class="gd-spinner"></span>`
    fresh.setAttribute('disabled', '')
    try {
      await removeGroupMember(_groupId, gm.member_id)
      _closeModal('gd-confirm-modal')
      await _reload()
      _toast('success', `${gm.member_name} removed from group.`)
    } catch (err: any) {
      _toast('error', err?.message ?? 'Failed to remove member.')
      fresh.removeAttribute('disabled')
      fresh.textContent = 'Remove'
    }
  })

  _openModal('gd-confirm-modal')
}

// ── Deactivate/activate confirm ───────────────────────────────────────────────
function _openToggleGroupConfirm(): void {
  if (!_group) return
  const isActive = _group.is_active
  const iconEl   = _container?.querySelector<HTMLElement>('#gd-confirm-icon')
  const iconI    = _container?.querySelector<HTMLElement>('#gd-confirm-icon-i')
  const titleEl  = _container?.querySelector<HTMLElement>('#gd-confirm-title')
  const msgEl    = _container?.querySelector<HTMLElement>('#gd-confirm-msg')
  const actionEl = _container?.querySelector<HTMLElement>('#gd-confirm-action-btn')
  if (!iconEl || !iconI || !titleEl || !msgEl || !actionEl) return

  iconEl.style.cssText = `margin:0 auto 12px;background:${isActive ? 'var(--bg-danger)' : 'rgba(34,197,94,0.1)'};color:${isActive ? 'var(--caci-red)' : '#56d364'};`
  iconI.className = `bi bi-${isActive ? 'slash-circle-fill' : 'arrow-clockwise'}`
  titleEl.textContent = isActive ? 'Deactivate Group' : 'Activate Group'
  msgEl.textContent = isActive
    ? 'This group will be marked as inactive. Members remain, but the group will be hidden from active views.'
    : 'This group will be reactivated and shown in active views.'
  actionEl.className = isActive ? 'gd-btn gd-btn-danger' : 'gd-btn gd-btn-primary'
  actionEl.textContent = isActive ? 'Deactivate' : 'Activate'

  const fresh = actionEl.cloneNode(true) as HTMLElement
  actionEl.replaceWith(fresh)
  fresh.addEventListener('click', async () => {
    if (!_groupId || !_group) return
    fresh.innerHTML = `<span class="gd-spinner"></span>`
    fresh.setAttribute('disabled', '')
    try {
      await updateGroup(_groupId, { is_active: !_group.is_active } as any)
      _closeModal('gd-confirm-modal')
      await _reload()
      _toast('success', _group.is_active ? 'Group activated.' : 'Group deactivated.')
    } catch (err: any) {
      _toast('error', err?.message ?? 'Failed to update group status.')
      fresh.removeAttribute('disabled')
      fresh.textContent = isActive ? 'Deactivate' : 'Activate'
    }
  })

  _openModal('gd-confirm-modal')
}

// ── Add member modal ──────────────────────────────────────────────────────────
let _selectedMemberId: string | null = null

function _openAddMemberModal(): void {
  _selectedMemberId = null
  const searchInput = _container?.querySelector<HTMLInputElement>('#gd-add-search')
  const results     = _container?.querySelector<HTMLElement>('#gd-add-results')
  const selected    = _container?.querySelector<HTMLElement>('#gd-add-selected')
  const roleSelect  = _container?.querySelector<HTMLSelectElement>('#gd-add-role')
  const errEl       = _container?.querySelector<HTMLElement>('#gd-add-err')
  if (searchInput) searchInput.value = ''
  if (results) results.innerHTML = ''
  if (selected) selected.style.display = 'none'
  if (roleSelect) roleSelect.value = 'member'
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = '' }
  _openModal('gd-add-member-modal')
  setTimeout(() => searchInput?.focus(), 80)
}

async function _searchMembersForAdd(q: string): Promise<void> {
  const resultsEl = _container?.querySelector<HTMLElement>('#gd-add-results')
  if (!resultsEl) return
  if (!q) { resultsEl.innerHTML = ''; return }

  const existingIds = new Set(_members.map(m => m.member_id))
  let candidates: MemberView[] = []
  try {
    candidates = await listMembers({ searchQuery: q })
    candidates = candidates.filter(m => m.id && !existingIds.has(m.id!)).slice(0, 8)
  } catch { candidates = [] }

  if (!candidates.length) {
    resultsEl.innerHTML = `<div style="padding:12px;font-size:13px;color:var(--text-secondary);text-align:center;">No members found</div>`
    return
  }

  resultsEl.innerHTML = candidates.map(m => {
    const bg   = avatarColor(`${m.first_name} ${m.last_name}`)
    const init = ((m.first_name?.[0] ?? '') + (m.last_name?.[0] ?? '')).toUpperCase()
    return `<div class="gd-member-search-result" data-member-id="${m.id}">
      <div class="gd-avatar" style="width:30px;height:30px;font-size:10px;flex-shrink:0;background:${bg};">${init}</div>
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${m.first_name} ${m.last_name}</div>
        <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">${m.membership_number ?? m.id}</div>
      </div>
    </div>`
  }).join('')

  resultsEl.querySelectorAll<HTMLElement>('[data-member-id]').forEach(row => {
    row.addEventListener('click', () => {
      resultsEl.querySelectorAll('.gd-member-search-result').forEach(r => r.classList.remove('selected'))
      row.classList.add('selected')
      _selectedMemberId = row.dataset['memberId'] ?? null
      const nameEl  = _container?.querySelector<HTMLElement>('#gd-add-selected-name')
      const chipEl  = _container?.querySelector<HTMLElement>('#gd-add-selected')
      const nameDiv = row.querySelector<HTMLElement>('div > div:first-child')
      if (nameEl && nameDiv) nameEl.textContent = nameDiv.textContent ?? ''
      if (chipEl) chipEl.style.display = 'flex'
    })
  })
}

// ── Edit group save ───────────────────────────────────────────────────────────
async function _saveGroupEdit(): Promise<void> {
  if (!_groupId) return
  const nameInput = _container?.querySelector<HTMLInputElement>('#gd-edit-name')
  const typeInput = _container?.querySelector<HTMLSelectElement>('#gd-edit-type')
  const descInput = _container?.querySelector<HTMLTextAreaElement>('#gd-edit-desc')
  const nameErr   = _container?.querySelector<HTMLElement>('#gd-edit-name-err')
  const saveBtn   = _container?.querySelector<HTMLButtonElement>('#gd-edit-save-btn')
  if (!nameInput || !typeInput || !descInput || !saveBtn) return

  const name = nameInput.value.trim()
  if (!name) { nameErr?.classList.add('show'); nameInput.focus(); return }
  nameErr?.classList.remove('show')

  saveBtn.disabled = true
  saveBtn.innerHTML = `<span class="gd-spinner"></span> Saving…`
  try {
    await updateGroup(_groupId, { name, group_type: typeInput.value as any, description: descInput.value.trim() || null })
    _closeModal('gd-edit-modal')
    await _reload()
    _toast('success', 'Group updated.')
  } catch (err: any) {
    saveBtn.disabled = false
    saveBtn.innerHTML = `<i class="bi bi-floppy"></i> Save Changes`
    _toast('error', err?.message ?? 'Failed to save changes.')
  }
}

// ── Event binding ─────────────────────────────────────────────────────────────
function _bindEvents(): void {
  if (!_container) return

  // Back button
  _container.querySelector('#gd-back-btn')?.addEventListener('click', () => navigate('/groups'))

  // Tab buttons
  _container.querySelectorAll<HTMLElement>('.gd-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset['tab']!
      _activeTab = tab
      _container?.querySelectorAll('.gd-tab-btn').forEach(b => b.classList.toggle('active', b === btn))
      _container?.querySelectorAll<HTMLElement>('.gd-tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `gd-tab-${tab}`)
      })
      if (tab === 'members') _renderMemberList()
    })
  })

  // "View all" links that switch tabs
  _container.querySelectorAll<HTMLElement>('[data-tab-goto]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset['tabGoto']!
      _container?.querySelector<HTMLElement>(`[data-tab="${target}"]`)?.click()
    })
  })

  // Header action buttons
  _container.querySelector('#gd-edit-btn')?.addEventListener('click', () => _openEditModal())
  _container.querySelector('#gd-add-member-btn')?.addEventListener('click', () => _openAddMemberModal())

  // Quick action buttons (sidebar)
  _container.querySelector('#gd-qa-edit')?.addEventListener('click', () => _openEditModal())
  _container.querySelector('#gd-qa-add-member')?.addEventListener('click', () => _openAddMemberModal())
  _container.querySelector('#gd-qa-toggle')?.addEventListener('click', () => _openToggleGroupConfirm())

  // Members tab toolbar
  const memberSearch = _container.querySelector<HTMLInputElement>('#gd-member-search')
  const roleFilter   = _container.querySelector<HTMLSelectElement>('#gd-role-filter')
  if (memberSearch) {
    const deb = debounce((q: string) => _renderMemberList(q, roleFilter?.value ?? 'all'), 220)
    memberSearch.addEventListener('input', () => deb(memberSearch.value.toLowerCase()))
  }
  roleFilter?.addEventListener('change', () => _renderMemberList(memberSearch?.value.toLowerCase() ?? '', roleFilter.value))
  _container.querySelector('#gd-members-add-btn')?.addEventListener('click', () => _openAddMemberModal())

  // Modal close buttons (data-close-modal attribute)
  _container.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => _closeModal(btn.dataset['closeModal']!))
  })
  // Backdrop clicks close modals
  _container.querySelectorAll<HTMLElement>('.gd-modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', e => { if (e.target === backdrop) _closeModal(backdrop.id) })
  })

  // Edit modal pre-fill & save
  _container.querySelector('#gd-edit-save-btn')?.addEventListener('click', () => _saveGroupEdit())

  // Add member modal search
  const addSearch = _container.querySelector<HTMLInputElement>('#gd-add-search')
  if (addSearch) {
    const deb = debounce((q: string) => _searchMembersForAdd(q), 280)
    addSearch.addEventListener('input', () => deb(addSearch.value.trim()))
  }

  // Add member confirm
  _container.querySelector('#gd-add-confirm-btn')?.addEventListener('click', async () => {
    const errEl  = _container?.querySelector<HTMLElement>('#gd-add-err')
    const btn    = _container?.querySelector<HTMLButtonElement>('#gd-add-confirm-btn')
    const role   = (_container?.querySelector<HTMLSelectElement>('#gd-add-role'))?.value as GroupMemberRole ?? 'member'
    if (!_selectedMemberId) {
      if (errEl) { errEl.textContent = 'Please select a member first.'; errEl.style.display = 'block' }
      return
    }
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="gd-spinner"></span> Adding…` }
    try {
      await assignGroupMember(_groupId!, _selectedMemberId, role)
      _closeModal('gd-add-member-modal')
      await _reload()
      _toast('success', 'Member added to group.')
    } catch (err: any) {
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-person-plus"></i> Add to Group` }
      if (errEl) { errEl.textContent = err?.message ?? 'Failed to add member.'; errEl.style.display = 'block' }
    }
  })

  // Overview member rows open member detail
  _container.querySelectorAll<HTMLElement>('#gd-overview-members [data-gm-id]').forEach(row => {
    row.addEventListener('click', () => {
      const gm = _members.find(m => m.id === row.dataset['gmId'])
      const user = getCurrentUser()
      if (gm) _openMemberDetail(gm, !!(user && can(user, PERMISSIONS.GROUPS_MEMBERS_MANAGE)))
    })
  })
}

// ── Open edit modal ───────────────────────────────────────────────────────────
function _openEditModal(): void {
  if (!_group) return
  const nameInput = _container?.querySelector<HTMLInputElement>('#gd-edit-name')
  const typeInput = _container?.querySelector<HTMLSelectElement>('#gd-edit-type')
  const descInput = _container?.querySelector<HTMLTextAreaElement>('#gd-edit-desc')
  if (nameInput) nameInput.value = _group.name
  if (typeInput) typeInput.value = _group.group_type
  if (descInput) descInput.value = _group.description ?? ''
  _openModal('gd-edit-modal')
  setTimeout(() => nameInput?.focus(), 80)
}

// ── PageModule ────────────────────────────────────────────────────────────────
const GroupDetail: PageModule = {

  async render(container: HTMLElement): Promise<void> {
    _destroyed  = false
    _container  = container
    _activeTab  = 'overview'
    _group      = null
    _members    = []

    _injectCSS()
    renderSkeleton(container, 'profile')

    // Read group ID from route params
    _groupId = container.dataset['id'] ?? null
    if (!_groupId) {
      renderError(container, new Error('No group ID provided'))
      return
    }

    on('group:updated', _onGroupUpdated as any)
    on('group:deleted', _onGroupUpdated as any)

    try {
      const [group, members] = await Promise.all([
        getGroup(_groupId),
        listGroupMembers(_groupId),
      ])
      _group   = group
      _members = members
    } catch (err) {
      renderError(container, err, { retry: () => GroupDetail.render(container) })
      return
    }

    if (_destroyed) return
    _renderPage()
  },

  destroy(): void {
    _destroyed  = false
    _container  = null
    _group      = null
    _members    = []
    _groupId    = null
    off('group:updated', _onGroupUpdated as any)
    off('group:deleted', _onGroupUpdated as any)
    document.getElementById('gd-toast')?.remove()
  },
}

export default GroupDetail
