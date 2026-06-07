// src/modules/membership/pages/Groups.ts
// Groups & Units page — full PageModule implementation.
// Mirrors the reference design (caci-hub-groups.html) adapted to the
// CACI Hub web architecture (dark-mode tokens, Bootstrap Icons, no Tailwind).
//
// Features:
//   • Stat cards (Total / Active / Inactive / Departments) — clickable filters
//   • Type filter chips (All, Department, Age Group)
//   • Search + sort toolbar
//   • Card grid (desktop) / list rows (mobile ≤ 639px)
//   • List panel (shown when a stat card filter is active)
//   • Create group modal (name, type, description, leader)
//   • Delete (soft) confirmation
//   • Realtime-safe: listens to group:created / group:updated / group:deleted events
//
// Data layer: groups.repository.ts  (listGroups, createGroup, softDeleteGroup)
// Permissions: PERMISSIONS.GROUPS_VIEW / GROUPS_CREATE / GROUPS_DELETE

import type { PageModule }   from '../../../types/module.types'
import { getCurrentUser }    from '@core/auth'
import { can }               from '@core/authorization/authorization-service'
import { PERMISSIONS }       from '@core/authorization/permissions'
import { on, off }           from '@core/events'
import { navigate }          from '@core/router'
import { renderSkeleton, renderError, renderEmpty } from '@shared/utils/pageHelpers'
import { debounce }          from '@shared/utils/debounce'
import {
  listGroups,
  createGroup,
  softDeleteGroup,
} from '../groups.repository'
import type { Group, GroupType, CreateGroupPayload } from '../../../types/group.types'

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = /* css */`
/* ══════════════════════════════════════════════════════
   GROUPS PAGE  — scoped under .grp-page
══════════════════════════════════════════════════════ */

/* Page wrapper */
.grp-page {
  padding: var(--space-xl) var(--space-2xl);
  max-width: 1400px;
  font-family: var(--font-sans);
}
@media (max-width: 640px) {
  .grp-page { padding: var(--space-lg) var(--space-md); }
}

/* ── Header ── */
.grp-page-header {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: var(--space-lg);
  flex-wrap: wrap; margin-bottom: var(--space-xl);
}
.grp-page-title {
  font-size: var(--text-h1); font-weight: 700;
  color: var(--text-primary); margin: 0 0 2px;
  letter-spacing: -0.02em;
}
.grp-page-sub {
  font-size: var(--text-small); color: var(--text-secondary); margin: 0;
}

/* ── Stat cards row ── */
.grp-stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}
@media (max-width: 900px) { .grp-stats-row { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .grp-stats-row { grid-template-columns: 1fr 1fr; gap: var(--space-sm); } }

.grp-stat {
  background: linear-gradient(145deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  cursor: pointer; position: relative; overflow: hidden;
  transition: transform 0.22s cubic-bezier(0.16,1,0.3,1),
              box-shadow  0.22s,
              border-color 0.22s;
  user-select: none;
}
.grp-stat:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(0,0,0,0.22);
  border-color: var(--border-strong);
}
.grp-stat:active { transform: translateY(0) scale(0.98); }
.grp-stat.active-filter {
  border-width: 1.5px;
  border-color: var(--stat-accent);
  box-shadow: 0 0 0 3px var(--stat-glow), 0 8px 28px rgba(0,0,0,0.3);
  transform: translateY(-2px);
}
.grp-stat-icon-row {
  display: flex; align-items: center; gap: 10px; margin-bottom: var(--space-md);
}
.grp-stat-icon {
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.grp-stat-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.09em; color: var(--text-secondary);
}
.grp-stat-value {
  font-size: 28px; font-weight: 700; color: var(--text-primary);
  line-height: 1; display: flex; align-items: baseline; gap: 8px;
}
.grp-stat-sub {
  font-size: 11px; font-weight: 400; color: var(--text-secondary);
}
.grp-stat-bar {
  margin-top: 10px; height: 2px; border-radius: 99px;
  background: var(--border-default); overflow: hidden;
}
.grp-stat-bar-fill {
  height: 100%; border-radius: 99px;
  transition: width 0.5s cubic-bezier(0.16,1,0.3,1);
}
.grp-stat-hint {
  position: absolute; top: 10px; right: 10px;
  font-size: 10px; color: var(--text-muted);
  opacity: 0; transition: opacity 0.2s;
  display: flex; align-items: center; gap: 3px;
}
.grp-stat:hover .grp-stat-hint { opacity: 1; }
.grp-stat.active-filter .grp-stat-hint { opacity: 0; }

/* ── Toolbar ── */
.grp-toolbar {
  display: flex; align-items: center; gap: var(--space-sm);
  background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: 10px var(--space-md);
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  flex-wrap: wrap;
}
.grp-search-wrap {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); padding: 0 12px;
  height: 40px; flex: 1; min-width: 180px; max-width: 400px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.grp-search-wrap:focus-within {
  border-color: var(--caci-blue);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.grp-search-wrap i { font-size: 15px; color: var(--text-muted); flex-shrink: 0; transition: color 0.2s; }
.grp-search-wrap:focus-within i { color: var(--caci-blue); }
.grp-search-wrap input {
  background: transparent; border: none; outline: none;
  font-size: 13px; color: var(--text-primary);
  font-family: var(--font-sans); width: 100%;
  caret-color: var(--caci-blue);
}
.grp-search-wrap input::placeholder { color: var(--text-muted); }

.grp-sort-wrap { position: relative; display: flex; align-items: center; }
.grp-sort-wrap i {
  position: absolute; left: 10px; font-size: 14px;
  color: var(--text-secondary); pointer-events: none; z-index: 1;
}
.grp-sort-select {
  appearance: none; -webkit-appearance: none;
  padding: 0 32px 0 28px; height: 40px; border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-page);
  color: var(--text-primary); font-size: 13px;
  font-family: var(--font-sans); font-weight: 500;
  cursor: pointer; outline: none; min-width: 160px;
  transition: border-color 0.2s, box-shadow 0.2s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}
.grp-sort-select:focus {
  border-color: var(--caci-blue);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.grp-sort-select option { background: var(--bg-card); color: var(--text-primary); }

.grp-tbtn {
  display: flex; align-items: center; gap: 6px;
  padding: 0 14px; height: 40px; border-radius: var(--radius-md);
  font-size: 13px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--border-default);
  background: var(--bg-page); color: var(--text-secondary);
  transition: all 0.18s cubic-bezier(0.16,1,0.3,1);
  white-space: nowrap; font-family: var(--font-sans);
}
.grp-tbtn i { font-size: 15px; }
.grp-tbtn:hover {
  border-color: var(--border-strong); color: var(--text-primary);
  transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.12);
}
.grp-tbtn-primary {
  background: linear-gradient(135deg, var(--caci-blue) 0%, var(--caci-blue-light) 100%);
  border-color: transparent; color: #fff; font-weight: 600;
  box-shadow: 0 2px 10px rgba(0,75,160,0.3);
}
.grp-tbtn-primary:hover {
  background: linear-gradient(135deg, var(--caci-blue-light) 0%, var(--caci-blue) 100%);
  box-shadow: 0 6px 20px rgba(0,75,160,0.45);
  border-color: transparent; color: #fff;
}

@media (max-width: 640px) {
  .grp-btn-label { display: none; }
  .grp-tbtn { padding: 0 10px; }
  .grp-sort-select { min-width: 40px; width: 40px; padding: 0; color: transparent; background-image: none; }
  .grp-sort-wrap i { left: 50%; transform: translateX(-50%); }
}

/* ── Type chips ── */
.grp-chips {
  display: flex; align-items: center; gap: var(--space-sm);
  flex-wrap: wrap; margin-bottom: var(--space-sm);
}
.grp-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 13px; border-radius: 99px;
  border: 1px solid var(--border-default); background: transparent;
  font-size: 12px; font-weight: 500; color: var(--text-secondary);
  cursor: pointer; white-space: nowrap; font-family: var(--font-sans);
  transition: all 0.18s cubic-bezier(0.16,1,0.3,1);
}
.grp-chip:hover { border-color: var(--border-strong); color: var(--text-primary); }
.grp-chip.active {
  background: rgba(0,75,160,0.1); border-color: rgba(0,75,160,0.4);
  color: var(--caci-blue-light);
}
[data-theme="light"] .grp-chip.active {
  color: var(--caci-blue);
}
.grp-chip i { font-size: 12px; }

/* ── Filter banner ── */
.grp-filter-banner {
  display: none; align-items: center; gap: var(--space-sm);
  padding: 10px 14px; border-radius: var(--radius-md);
  background: rgba(0,75,160,0.06); border: 1px solid rgba(0,75,160,0.2);
  animation: grpSlideRight 0.32s cubic-bezier(0.16,1,0.3,1) both;
}
.grp-filter-banner.show { display: flex; }
@keyframes grpSlideRight {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
.grp-filter-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 99px;
  background: rgba(0,75,160,0.14); border: 1px solid rgba(0,75,160,0.35);
  font-size: 12px; font-weight: 600; color: var(--caci-blue-light);
}
[data-theme="light"] .grp-filter-pill { color: var(--caci-blue); }
.grp-filter-clear {
  margin-left: auto; display: flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-default); background: transparent;
  color: var(--text-secondary); font-size: 12px;
  font-family: var(--font-sans); cursor: pointer;
  transition: all 0.18s;
}
.grp-filter-clear:hover { border-color: var(--border-strong); color: var(--text-primary); }

/* ── Results meta ── */
.grp-meta {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 2px;
  font-size: 12px; color: var(--text-secondary);
}
.grp-meta strong { color: var(--text-primary); }

/* ── List panel (shown on stat filter) ── */
.grp-list-panel {
  display: none; flex-direction: column;
  background: var(--bg-card);
  border: 1px solid var(--border-default); border-radius: var(--radius-lg);
  overflow: hidden;
  animation: grpScaleIn 0.3s cubic-bezier(0.16,1,0.3,1) both;
}
.grp-list-panel.show { display: flex; }
@keyframes grpScaleIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
.grp-lp-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; border-bottom: 1px solid var(--border-default);
  background: rgba(255,255,255,0.015);
}
.grp-lp-icon-wrap {
  width: 36px; height: 36px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.grp-lp-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.grp-lp-sub   { font-size: 11px; color: var(--text-secondary); margin-top: 1px; }
.grp-lp-count { font-size: 12px; font-weight: 600; color: var(--caci-blue-light); white-space: nowrap; margin-left: auto; }
.grp-lp-body  { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }

.grp-lp-row {
  background: var(--bg-page);
  border: 1px solid var(--border-default); border-radius: var(--radius-md);
  padding: 12px 14px;
  display: flex; align-items: center; gap: 12px;
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}
.grp-lp-row:hover {
  border-color: rgba(0,75,160,0.4);
  transform: translateX(3px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}

/* ── Groups grid ── */
.grp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-lg);
}
@media (max-width: 639px) {
  .grp-grid { display: flex; flex-direction: column; gap: 10px; }
  .grp-card  { display: none !important; }
  .grp-list-row { display: flex !important; }
}

/* ── Group card ── */
.grp-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 18px; overflow: hidden; position: relative;
  transition: transform 0.25s cubic-bezier(0.16,1,0.3,1),
              box-shadow 0.25s, border-color 0.25s;
  cursor: pointer;
  animation: grpFadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both;
}
.grp-card::before {
  content: ''; position: absolute; inset: 0; border-radius: 18px; opacity: 0;
  background: radial-gradient(500px circle at var(--mx,50%) var(--my,50%),
    rgba(0,75,160,0.06), transparent 40%);
  transition: opacity 0.4s; pointer-events: none;
}
.grp-card::after {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(0,75,160,0.5) 50%, transparent 100%);
  opacity: 0; transition: opacity 0.3s;
}
.grp-card:hover {
  transform: translateY(-4px);
  border-color: rgba(0,75,160,0.3);
  box-shadow: 0 12px 36px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,75,160,0.12);
}
.grp-card:hover::before { opacity: 1; }
.grp-card:hover::after  { opacity: 1; }

@keyframes grpFadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}

.grp-card-banner {
  height: 70px; position: relative;
  display: flex; align-items: flex-end; padding: 0 14px 10px;
}
.grp-card-banner-icon {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  border: 2.5px solid var(--bg-card); position: relative; z-index: 1;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  flex-shrink: 0;
}
.grp-card-banner-badge {
  position: absolute; top: 10px; right: 12px;
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 99px;
  font-size: 11px; font-weight: 500; font-family: var(--font-sans);
}

.grp-card-body { padding: 10px 14px 14px; }
.grp-card-name {
  font-size: 14px; font-weight: 600; color: var(--text-primary);
  line-height: 1.35; margin-bottom: var(--space-xs);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.grp-card-desc {
  font-size: 11.5px; color: var(--text-secondary);
  line-height: 1.55; margin-bottom: var(--space-md);
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}

.grp-type-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 99px;
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.03em; text-transform: uppercase;
  margin-bottom: 10px;
}
.grp-type-badge i { font-size: 10px; }

/* Avatar stack */
.grp-av-stack { display: flex; align-items: center; }
.grp-av {
  width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700;
  border: 2px solid var(--bg-card);
  margin-left: -8px;
}
.grp-av:first-child { margin-left: 0; }
.grp-av-more {
  background: var(--bg-page); color: var(--text-secondary);
  border-color: var(--border-default); font-size: 9px; font-weight: 600;
}

.grp-card-footer {
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--border-default);
  display: flex; align-items: center; gap: 8px;
}
.grp-leader-avatar {
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 8px; font-weight: 700; flex-shrink: 0;
}
.grp-leader-label {
  font-size: 10px; color: var(--text-muted); text-transform: uppercase;
  letter-spacing: 0.06em; font-weight: 500;
}
.grp-leader-name {
  font-size: 12px; color: var(--text-primary); font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* card action menu */
.grp-card-actions {
  position: absolute; top: 8px; left: 10px; z-index: 2;
  opacity: 0; transition: opacity 0.15s;
}
.grp-card:hover .grp-card-actions { opacity: 1; }
.grp-card-menu-btn {
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  border: none; background: rgba(0,0,0,0.35);
  color: rgba(255,255,255,0.7); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s; backdrop-filter: blur(4px);
  font-size: 14px;
}
.grp-card-menu-btn:hover { background: rgba(0,0,0,0.6); color: #fff; }

/* ── Mobile list row ── */
.grp-list-row {
  display: none;
  background: var(--bg-card);
  border: 1px solid var(--border-default); border-radius: var(--radius-md);
  padding: 12px 14px; align-items: center; gap: 12px;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s;
  animation: grpFadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
}
.grp-list-row:hover {
  border-color: rgba(0,75,160,0.4);
  transform: translateX(2px);
}

/* ── Create Group Modal ── */
.grp-modal-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: var(--space-lg);
  animation: grpFadeIn 0.2s ease both;
}
@keyframes grpFadeIn { from { opacity:0; } to { opacity:1; } }
.grp-modal {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 64px rgba(0,0,0,0.35);
  width: 100%; max-width: 500px; max-height: 90vh;
  display: flex; flex-direction: column;
  animation: grpSlideUp 0.3s cubic-bezier(0.16,1,0.3,1) both;
}
@keyframes grpSlideUp {
  from { opacity:0; transform: translateY(16px); }
  to   { opacity:1; transform: translateY(0); }
}
.grp-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-lg); border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}
.grp-modal-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin:0; }
.grp-modal-close {
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  border: none; background: transparent; color: var(--text-muted);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 16px; transition: background 0.12s, color 0.12s;
}
.grp-modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }
.grp-modal-body { padding: var(--space-lg); overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: var(--space-md); }
.grp-modal-footer {
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid var(--border-default);
  display: flex; justify-content: flex-end; gap: var(--space-sm);
  flex-shrink: 0;
}

/* form fields */
.grp-field label {
  display: block; font-size: 12px; font-weight: 600;
  color: var(--text-secondary); margin-bottom: 5px;
  text-transform: uppercase; letter-spacing: 0.05em;
}
.grp-field input,
.grp-field select,
.grp-field textarea {
  width: 100%;
  background: var(--bg-page);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-size: 13px; font-family: var(--font-sans);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.grp-field input::placeholder,
.grp-field textarea::placeholder { color: var(--text-muted); }
.grp-field input:focus,
.grp-field select:focus,
.grp-field textarea:focus {
  border-color: var(--caci-blue);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.grp-field textarea { resize: vertical; min-height: 76px; }
.grp-field select option { background: var(--bg-card); }
.grp-field-error { font-size: 11px; color: var(--caci-red); margin-top: 3px; display: none; }
.grp-field-error.show { display: block; }

/* type grid selector */
.grp-type-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
}
.grp-type-option {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 12px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  cursor: pointer; transition: all 0.15s;
  background: transparent; font-family: var(--font-sans);
}
.grp-type-option:hover { border-color: var(--border-strong); }
.grp-type-option.selected {
  border-color: var(--caci-blue); background: rgba(0,75,160,0.08);
}
.grp-type-option-icon {
  width: 30px; height: 30px; border-radius: var(--radius-xs);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.grp-type-option-icon i { font-size: 15px; }
.grp-type-option-label { font-size: 12px; font-weight: 600; color: var(--text-primary); }
.grp-type-option-sub   { font-size: 10px; color: var(--text-secondary); margin-top: 1px; }

/* ── Confirm delete modal ── */
.grp-confirm-backdrop {
  position: fixed; inset: 0; z-index: 1010;
  background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: var(--space-lg);
  animation: grpFadeIn 0.2s ease both;
}
.grp-confirm-box {
  background: var(--bg-card);
  border: 1px solid var(--border-default); border-radius: var(--radius-xl);
  box-shadow: 0 24px 64px rgba(0,0,0,0.4);
  padding: var(--space-2xl); width: 100%; max-width: 380px; text-align: center;
  animation: grpSlideUp 0.28s cubic-bezier(0.16,1,0.3,1) both;
}
.grp-confirm-icon {
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--bg-danger); border: 1px solid rgba(198,0,38,0.25);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto var(--space-md); font-size: 20px; color: var(--caci-red);
}
.grp-confirm-title {
  font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;
}
.grp-confirm-msg {
  font-size: 13px; color: var(--text-secondary); line-height: 1.55; margin-bottom: var(--space-xl);
}
.grp-confirm-btns { display: flex; gap: var(--space-sm); }
.grp-confirm-btns button { flex: 1; }

/* ── Empty / loading states ── */
.grp-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 64px var(--space-lg); text-align: center;
  color: var(--text-secondary); grid-column: 1 / -1;
}
.grp-empty i { font-size: 3rem; color: var(--border-strong); margin-bottom: var(--space-lg); }
.grp-empty-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
.grp-empty-sub   { font-size: 13px; color: var(--text-secondary); max-width: 320px; }

/* ── Spinner inline ── */
.grp-spinner {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.25);
  border-top-color: #fff;
  animation: grpSpin 0.7s linear infinite;
  display: inline-block;
}
@keyframes grpSpin { to { transform: rotate(360deg); } }
`

function injectCSS(): void {
  if (document.getElementById('grp-page-css')) return
  const s = document.createElement('style')
  s.id = 'grp-page-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

// ── Type config (maps GroupType enum → display info) ──────────────────────────
// NOTE: DB enum is 'department' | 'age_group' (from migration + group.types.ts).
// We show them with friendlier labels and colours.

interface TypeInfo {
  label:  string
  icon:   string      // Bootstrap Icons class suffix
  color:  string
  bg:     string
  border: string
  banner: string
}

const TYPE_INFO: Record<string, TypeInfo> = {
  department: {
    label:  'Department',
    icon:   'building',
    color:  '#58a6ff',
    bg:     'rgba(88,166,255,0.12)',
    border: 'rgba(88,166,255,0.3)',
    banner: 'linear-gradient(135deg,#1a3a5c 0%,#111e2e 100%)',
  },
  age_group: {
    label:  'Age Group',
    icon:   'people-fill',
    color:  '#e3b341',
    bg:     'rgba(227,179,65,0.12)',
    border: 'rgba(227,179,65,0.3)',
    banner: 'linear-gradient(135deg,#3a2800 0%,#1e1500 100%)',
  },
}
function typeInfo(t: string): TypeInfo {
  return TYPE_INFO[t] ?? TYPE_INFO['department']
}

// ── Avatar colour helpers (mirrors member-helpers) ────────────────────────────
const AVATAR_COLORS = ['#004BA0','#C60026','#1a5fb4','#7c3aed','#1a7f37','#9a6700','#0969da']
function avatarColor(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(name: string): string {
  const parts = name.trim().split(' ')
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

// ── Page state ────────────────────────────────────────────────────────────────
interface PageState {
  groups:          Group[]
  filtered:        Group[]
  search:          string
  sort:            string
  typeFilter:      string
  statFilter:      string | null
  deleteTarget:    Group | null
}

const _state: PageState = {
  groups:       [],
  filtered:     [],
  search:       '',
  sort:         'name_az',
  typeFilter:   'all',
  statFilter:   null,
  deleteTarget: null,
}

let _container: HTMLElement | null = null
let _destroyed  = false

// ── Event listeners we need to clean up ──────────────────────────────────────
function _onGroupCreated() { _reload() }
function _onGroupUpdated() { _reload() }
function _onGroupDeleted() { _reload() }

// ── Reload from DB ────────────────────────────────────────────────────────────
async function _reload(): Promise<void> {
  if (_destroyed) return
  try {
    _state.groups = await listGroups({ includeDeleted: false })
    _applyFilters()
    _renderStats()
    _renderChips()
    _renderContent()
  } catch (err) {
    console.error('[Groups] reload error', err)
  }
}

// ── Filtering / sorting ───────────────────────────────────────────────────────
function _applyFilters(): void {
  const q = _state.search.toLowerCase()
  let list = _state.groups.filter(g => {
    const ti      = typeInfo(g.group_type)
    const typeOk  = _state.typeFilter === 'all' || g.group_type === _state.typeFilter
    const searchOk = !q
      || g.name.toLowerCase().includes(q)
      || (g.description ?? '').toLowerCase().includes(q)
      || ti.label.toLowerCase().includes(q)
    const statOk = !_state.statFilter || _state.statFilter === 'all'
      || (_state.statFilter === 'active'     &&  g.is_active)
      || (_state.statFilter === 'inactive'   && !g.is_active)
      || (_state.statFilter === 'department' &&  g.group_type === 'department')
    return typeOk && searchOk && statOk
  })

  const s = _state.sort
  if (s === 'name_az')            list.sort((a,b) => a.name.localeCompare(b.name))
  else if (s === 'name_za')       list.sort((a,b) => b.name.localeCompare(a.name))
  else if (s === 'most_members')  list.sort((a,b) => b.member_count - a.member_count)
  else if (s === 'least_members') list.sort((a,b) => a.member_count - b.member_count)
  else if (s === 'active_first')  list.sort((a,b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0))

  _state.filtered = list
}

// ── Render: stat cards ────────────────────────────────────────────────────────
function _renderStats(): void {
  const el = _container?.querySelector<HTMLElement>('.grp-stats-row')
  if (!el) return
  const { groups } = _state
  const total      = groups.length
  const active     = groups.filter(g => g.is_active).length
  const inactive   = total - active
  const depts      = groups.filter(g => g.group_type === 'department').length
  const pct        = total ? Math.round(active / total * 100) : 0

  el.innerHTML = `
  <div class="grp-stat" data-filter="all" style="--stat-accent:var(--caci-blue);--stat-glow:rgba(0,75,160,0.2);">
    <div class="grp-stat-hint"><i class="bi bi-funnel"></i> Filter</div>
    <div class="grp-stat-icon-row">
      <div class="grp-stat-icon" style="background:rgba(0,75,160,0.12);">
        <i class="bi bi-diagram-3-fill" style="color:var(--caci-blue-light);font-size:15px;"></i>
      </div>
      <span class="grp-stat-label">Total Groups</span>
    </div>
    <div class="grp-stat-value">${total}
      <span class="grp-stat-sub">${active} active</span>
    </div>
    <div class="grp-stat-bar">
      <div class="grp-stat-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--caci-blue),var(--caci-blue-light));"></div>
    </div>
  </div>

  <div class="grp-stat" data-filter="active" style="--stat-accent:#22c55e;--stat-glow:rgba(34,197,94,0.18);">
    <div class="grp-stat-hint"><i class="bi bi-funnel"></i> Filter</div>
    <div class="grp-stat-icon-row">
      <div class="grp-stat-icon" style="background:rgba(34,197,94,0.12);">
        <i class="bi bi-check-circle-fill" style="color:#22c55e;font-size:15px;"></i>
      </div>
      <span class="grp-stat-label">Active</span>
    </div>
    <div class="grp-stat-value">${active}</div>
    <div class="grp-stat-bar"><div class="grp-stat-bar-fill" style="width:100%;background:rgba(34,197,94,0.4);"></div></div>
  </div>

  <div class="grp-stat" data-filter="inactive" style="--stat-accent:var(--text-muted);--stat-glow:rgba(139,148,158,0.15);">
    <div class="grp-stat-hint"><i class="bi bi-funnel"></i> Filter</div>
    <div class="grp-stat-icon-row">
      <div class="grp-stat-icon" style="background:var(--bg-hover);">
        <i class="bi bi-slash-circle" style="color:var(--text-muted);font-size:15px;"></i>
      </div>
      <span class="grp-stat-label">Inactive</span>
    </div>
    <div class="grp-stat-value">${inactive}</div>
    <div class="grp-stat-bar"><div class="grp-stat-bar-fill" style="width:${total ? Math.round(inactive/total*100) : 0}%;background:var(--border-strong);"></div></div>
  </div>

  <div class="grp-stat" data-filter="department" style="--stat-accent:#58a6ff;--stat-glow:rgba(88,166,255,0.18);">
    <div class="grp-stat-hint"><i class="bi bi-funnel"></i> Filter</div>
    <div class="grp-stat-icon-row">
      <div class="grp-stat-icon" style="background:rgba(88,166,255,0.12);">
        <i class="bi bi-building" style="color:#58a6ff;font-size:15px;"></i>
      </div>
      <span class="grp-stat-label">Departments</span>
    </div>
    <div class="grp-stat-value">${depts}</div>
    <div class="grp-stat-bar"><div class="grp-stat-bar-fill" style="width:100%;background:rgba(88,166,255,0.35);"></div></div>
  </div>`

  // Re-bind stat card clicks
  el.querySelectorAll<HTMLElement>('.grp-stat').forEach(card => {
    card.addEventListener('click', () => {
      const key = card.dataset['filter']!
      if (_state.statFilter === key) {
        _clearStatFilter()
      } else {
        _applyStatFilter(key)
      }
    })
  })

  // Re-apply active styling if a stat filter is set
  if (_state.statFilter) {
    const active = el.querySelector<HTMLElement>(`[data-filter="${_state.statFilter}"]`)
    active?.classList.add('active-filter')
  }
}

function _applyStatFilter(key: string): void {
  _state.statFilter = key
  _container?.querySelectorAll('.grp-stat').forEach(c => {
    c.classList.remove('active-filter')
    if ((c as HTMLElement).dataset['filter'] === key) c.classList.add('active-filter')
  })
  _applyFilters()
  _renderContent()
}

function _clearStatFilter(): void {
  _state.statFilter = null
  _container?.querySelectorAll('.grp-stat').forEach(c => c.classList.remove('active-filter'))
  _applyFilters()
  _renderContent()
}

// ── Render: type chips ────────────────────────────────────────────────────────
function _renderChips(): void {
  const el = _container?.querySelector<HTMLElement>('.grp-chips')
  if (!el) return
  const counts: Record<string, number> = {}
  _state.groups.forEach(g => { counts[g.group_type] = (counts[g.group_type] ?? 0) + 1 })

  let html = `<button class="grp-chip${_state.typeFilter === 'all' ? ' active' : ''}" data-type="all">
    <i class="bi bi-grid-3x3-gap"></i> All <span style="opacity:.55;">${_state.groups.length}</span>
  </button>`

  Object.entries(TYPE_INFO).forEach(([key, ti]) => {
    if (!counts[key]) return
    html += `<button class="grp-chip${_state.typeFilter === key ? ' active' : ''}" data-type="${key}">
      <i class="bi bi-${ti.icon}" style="color:${ti.color};"></i>
      ${ti.label} <span style="opacity:.55;">${counts[key]}</span>
    </button>`
  })

  el.innerHTML = html
  el.querySelectorAll<HTMLElement>('.grp-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.typeFilter = btn.dataset['type'] ?? 'all'
      el.querySelectorAll('.grp-chip').forEach(c => c.classList.toggle('active', c === btn))
      _applyFilters()
      _renderContent()
    })
  })
}

// ── Render: content area (filter banner + list panel OR grid) ─────────────────
function _renderContent(): void {
  const banner    = _container?.querySelector<HTMLElement>('.grp-filter-banner')!
  const listPanel = _container?.querySelector<HTMLElement>('.grp-list-panel')!
  const grid      = _container?.querySelector<HTMLElement>('.grp-grid')!
  const meta      = _container?.querySelector<HTMLElement>('.grp-meta')!
  if (!banner || !listPanel || !grid || !meta) return

  const { filtered, statFilter } = _state

  meta.innerHTML = `<span>Showing <strong>${filtered.length}</strong> group${filtered.length !== 1 ? 's' : ''}</span>`

  // Filter banner
  if (statFilter && statFilter !== 'all') {
    const labels: Record<string, string> = { active:'Active', inactive:'Inactive', department:'Departments', all:'All Groups' }
    banner.classList.add('show')
    banner.innerHTML = `
      <i class="bi bi-funnel-fill" style="color:var(--caci-blue-light);"></i>
      <span class="grp-filter-pill">${labels[statFilter] ?? statFilter}</span>
      <span style="font-size:12px;color:var(--text-secondary);">${filtered.length} result${filtered.length !== 1 ? 's' : ''}</span>
      <button class="grp-filter-clear" id="grp-clear-filter">
        <i class="bi bi-x"></i> Clear filter
      </button>`
    banner.querySelector('#grp-clear-filter')?.addEventListener('click', () => _clearStatFilter())
  } else {
    banner.classList.remove('show')
  }

  // List panel vs grid
  if (statFilter) {
    listPanel.classList.add('show')
    grid.style.display = 'none'
    _renderListPanel(filtered, statFilter)
  } else {
    listPanel.classList.remove('show')
    grid.style.display = ''
    _renderGrid(filtered)
  }
}

// ── Render: list panel ────────────────────────────────────────────────────────
const _LP_LABELS: Record<string, { title: string; sub: string; icon: string; iconColor: string; iconBg: string }> = {
  all:        { title:'All Groups',      sub:'Every group and unit',         icon:'bi-diagram-3-fill', iconColor:'var(--caci-blue-light)', iconBg:'rgba(0,75,160,0.12)'  },
  active:     { title:'Active Groups',   sub:'Groups currently running',     icon:'bi-check-circle-fill', iconColor:'#22c55e',            iconBg:'rgba(34,197,94,0.12)' },
  inactive:   { title:'Inactive Groups', sub:'Groups that are not running',  icon:'bi-slash-circle',      iconColor:'var(--text-muted)',   iconBg:'var(--bg-hover)'      },
  department: { title:'Departments',     sub:'All department-type groups',   icon:'bi-building',          iconColor:'#58a6ff',             iconBg:'rgba(88,166,255,0.12)'},
}

function _renderListPanel(list: Group[], filterKey: string): void {
  const panel = _container?.querySelector<HTMLElement>('.grp-list-panel')
  if (!panel) return
  const cfg = _LP_LABELS[filterKey] ?? _LP_LABELS['all']

  panel.innerHTML = `
    <div class="grp-lp-header">
      <div class="grp-lp-icon-wrap" style="background:${cfg.iconBg};">
        <i class="bi ${cfg.icon}" style="color:${cfg.iconColor};font-size:18px;"></i>
      </div>
      <div>
        <div class="grp-lp-title">${cfg.title}</div>
        <div class="grp-lp-sub">${cfg.sub}</div>
      </div>
      <span class="grp-lp-count">${list.length} group${list.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="grp-lp-body">
      ${list.length === 0
        ? `<div style="display:flex;flex-direction:column;align-items:center;padding:40px 20px;gap:10px;text-align:center;">
            <i class="bi bi-search" style="font-size:2rem;color:var(--border-strong);"></i>
            <p style="font-size:13px;color:var(--text-secondary);">No groups found</p>
           </div>`
        : list.map(g => {
            const ti = typeInfo(g.group_type)
            return `
            <div class="grp-lp-row" data-group-id="${g.id}">
              <div style="width:42px;height:42px;border-radius:11px;background:${ti.bg};border:1px solid ${ti.border};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="bi bi-${ti.icon}" style="font-size:18px;color:${ti.color};"></i>
              </div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px;">
                  <span style="font-size:13px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${g.name}</span>
                  <span style="display:inline-flex;align-items:center;padding:1px 8px;border-radius:99px;font-size:10px;font-weight:600;background:${g.is_active ? 'rgba(34,197,94,0.08)' : 'var(--bg-hover)'};border:1px solid ${g.is_active ? 'rgba(34,197,94,0.25)' : 'var(--border-default)'};color:${g.is_active ? '#56d364' : 'var(--text-secondary)'};">${g.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <div style="font-size:11px;color:var(--text-secondary);">${ti.label} · ${g.member_count} member${g.member_count !== 1 ? 's' : ''}${g.leader_name ? ' · Led by ' + g.leader_name : ''}</div>
              </div>
              <i class="bi bi-chevron-right" style="font-size:16px;color:var(--text-muted);flex-shrink:0;"></i>
            </div>`
          }).join('')
      }
    </div>`

  panel.querySelectorAll<HTMLElement>('[data-group-id]').forEach(row => {
    row.addEventListener('click', () => navigate(`/groups/${row.dataset['groupId']}`))
  })
}

// ── Render: card grid ─────────────────────────────────────────────────────────
function _renderGrid(list: Group[]): void {
  const grid = _container?.querySelector<HTMLElement>('.grp-grid')
  if (!grid) return
  const user = getCurrentUser()
  const canCreate = user && can(user, PERMISSIONS.GROUPS_CREATE)
  const canDelete = user && can(user, PERMISSIONS.GROUPS_DELETE)

  if (!list.length) {
    grid.innerHTML = `
      <div class="grp-empty">
        <i class="bi bi-search"></i>
        <div class="grp-empty-title">No groups found</div>
        <div class="grp-empty-sub">Try adjusting your search or filters${canCreate ? ', or create a new group' : ''}.</div>
      </div>`
    return
  }

  grid.innerHTML = list.map((g, i) => {
    const ti      = typeInfo(g.group_type)
    const delay   = Math.min(i * 40, 480)
    const dot     = g.is_active
      ? `<span style="width:5px;height:5px;border-radius:50%;background:#56d364;display:inline-block;margin-right:4px;"></span>Active`
      : `<span style="width:5px;height:5px;border-radius:50%;background:var(--text-muted);display:inline-block;margin-right:4px;"></span>Inactive`
    const badgeBg  = g.is_active ? 'rgba(34,197,94,0.1)' : 'var(--bg-hover)'
    const badgeBdr = g.is_active ? 'rgba(34,197,94,0.25)' : 'var(--border-default)'
    const badgeFg  = g.is_active ? '#56d364' : 'var(--text-secondary)'

    // Avatar stack — up to 4 leader_name avatars (leader only; members need extra fetch)
    const leaderInitials = g.leader_name ? initials(g.leader_name) : '?'
    const leaderBg       = g.leader_name ? avatarColor(g.leader_name) : 'var(--bg-hover)'
    const extraCount     = Math.max(0, g.member_count - 1)
    const stackHtml      = g.leader_name
      ? `<div class="grp-av-stack">
          <div class="grp-av" style="background:${leaderBg};color:#fff;" title="${g.leader_name}">${leaderInitials}</div>
          ${extraCount > 0 ? `<div class="grp-av grp-av-more">+${extraCount}</div>` : ''}
         </div>`
      : `<div class="grp-av-stack"><div class="grp-av grp-av-more">${g.member_count}</div></div>`

    return `
    <div class="grp-card" style="animation-delay:${delay}ms;" data-group-id="${g.id}"
      onmousemove="this._grpMove?.(event)" onmouseleave="this._grpLeave?.()">
      ${canDelete ? `
      <div class="grp-card-actions">
        <button class="grp-card-menu-btn" data-delete-id="${g.id}" data-delete-name="${g.name.replace(/"/g,'&quot;')}" title="Delete group">
          <i class="bi bi-trash3"></i>
        </button>
      </div>` : ''}
      <div class="grp-card-banner" style="background:${ti.banner};">
        <div class="grp-card-banner-badge" style="background:${badgeBg};border:1px solid ${badgeBdr};color:${badgeFg};">${dot}</div>
        <div class="grp-card-banner-icon" style="background:${ti.bg};">
          <i class="bi bi-${ti.icon}" style="font-size:20px;color:${ti.color};"></i>
        </div>
      </div>
      <div class="grp-card-body">
        <p class="grp-card-name">${g.name}</p>
        <span class="grp-type-badge" style="background:${ti.bg};border:1px solid ${ti.border};color:${ti.color};">
          <i class="bi bi-${ti.icon}"></i>${ti.label}
        </span>
        <p class="grp-card-desc">${g.description ?? 'No description provided.'}</p>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          ${stackHtml}
          <div style="text-align:right;">
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${g.member_count}<span style="color:var(--text-secondary);font-weight:400;"> members</span></div>
          </div>
        </div>
        ${g.leader_name ? `
        <div class="grp-card-footer">
          <div class="grp-leader-avatar" style="background:${leaderBg};color:#fff;">${leaderInitials}</div>
          <div style="min-width:0;">
            <div class="grp-leader-label">Leader</div>
            <div class="grp-leader-name">${g.leader_name}</div>
          </div>
        </div>` : ''}
      </div>
    </div>

    <!-- Mobile list row -->
    <div class="grp-list-row" style="animation-delay:${delay}ms;" data-group-id="${g.id}">
      <div style="width:42px;height:42px;border-radius:11px;background:${ti.bg};border:1px solid ${ti.border};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="bi bi-${ti.icon}" style="font-size:18px;color:${ti.color};"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${g.name}</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${ti.label} · ${g.member_count} member${g.member_count !== 1 ? 's' : ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        <span style="width:7px;height:7px;border-radius:50%;background:${g.is_active ? '#56d364' : 'var(--text-muted)'};"></span>
        <i class="bi bi-chevron-right" style="font-size:16px;color:var(--text-muted);"></i>
      </div>
    </div>`
  }).join('')

  // Attach spotlight effect via JS property (avoids inline script)
  grid.querySelectorAll<HTMLElement>('.grp-card').forEach(card => {
    ;(card as any)._grpMove = (e: MouseEvent) => {
      const r = card.getBoundingClientRect()
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%')
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%')
    }
    ;(card as any)._grpLeave = () => {
      card.style.setProperty('--mx', '50%')
      card.style.setProperty('--my', '50%')
    }
  })

  // Navigate to detail on card click (but not delete button)
  grid.querySelectorAll<HTMLElement>('[data-group-id]').forEach(el => {
    el.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('[data-delete-id]')) return
      const id = el.dataset['groupId']
      if (id) navigate(`/groups/${id}`)
    })
  })

  // Delete buttons
  if (canDelete) {
    grid.querySelectorAll<HTMLElement>('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const id   = btn.dataset['deleteId']!
        const name = btn.dataset['deleteName']!
        const group = _state.groups.find(g => g.id === id)
        if (group) _showDeleteConfirm(group)
      })
    })
  }
}

// ── Create Group Modal ────────────────────────────────────────────────────────
function _openCreateModal(): void {
  const existing = document.getElementById('grp-create-modal')
  existing?.remove()

  const user = getCurrentUser()
  if (!user || !can(user, PERMISSIONS.GROUPS_CREATE)) return

  let selectedType: GroupType = 'department'

  const backdrop = document.createElement('div')
  backdrop.className = 'grp-modal-backdrop'
  backdrop.id = 'grp-create-modal'

  backdrop.innerHTML = `
    <div class="grp-modal" id="grp-modal-box">
      <div class="grp-modal-header">
        <h2 class="grp-modal-title">Create New Group</h2>
        <button class="grp-modal-close" id="grp-modal-close"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="grp-modal-body">

        <div class="grp-field">
          <label>Group Type</label>
          <div class="grp-type-grid" id="grp-type-grid">
            ${Object.entries(TYPE_INFO).map(([key, ti]) => `
            <div class="grp-type-option${key === 'department' ? ' selected' : ''}" data-type="${key}">
              <div class="grp-type-option-icon" style="background:${ti.bg};">
                <i class="bi bi-${ti.icon}" style="color:${ti.color};"></i>
              </div>
              <div>
                <div class="grp-type-option-label">${ti.label}</div>
              </div>
            </div>`).join('')}
          </div>
        </div>

        <div class="grp-field">
          <label for="grp-new-name">Group Name *</label>
          <input type="text" id="grp-new-name" placeholder="e.g. Worship Team" maxlength="80" autocomplete="off">
          <div class="grp-field-error" id="grp-name-err">Name is required.</div>
        </div>

        <div class="grp-field">
          <label for="grp-new-desc">Description</label>
          <textarea id="grp-new-desc" placeholder="What does this group do?" maxlength="500"></textarea>
        </div>

      </div>
      <div class="grp-modal-footer">
        <button class="btn btn-outline" id="grp-modal-cancel">Cancel</button>
        <button class="btn btn-secondary" id="grp-modal-save">
          <i class="bi bi-plus-circle"></i> Create Group
        </button>
      </div>
    </div>`

  document.body.appendChild(backdrop)

  // Close handlers
  const close = () => backdrop.remove()
  backdrop.querySelector('#grp-modal-close')?.addEventListener('click', close)
  backdrop.querySelector('#grp-modal-cancel')?.addEventListener('click', close)
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close() })

  // Type selection
  const typeGrid = backdrop.querySelector('#grp-type-grid')!
  typeGrid.querySelectorAll<HTMLElement>('.grp-type-option').forEach(opt => {
    opt.addEventListener('click', () => {
      typeGrid.querySelectorAll('.grp-type-option').forEach(o => o.classList.remove('selected'))
      opt.classList.add('selected')
      selectedType = opt.dataset['type'] as GroupType
    })
  })

  // Save
  backdrop.querySelector('#grp-modal-save')?.addEventListener('click', async () => {
    const nameInput = backdrop.querySelector<HTMLInputElement>('#grp-new-name')!
    const descInput = backdrop.querySelector<HTMLTextAreaElement>('#grp-new-desc')!
    const nameErr   = backdrop.querySelector<HTMLElement>('#grp-name-err')!
    const saveBtn   = backdrop.querySelector<HTMLButtonElement>('#grp-modal-save')!

    const name = nameInput.value.trim()
    if (!name) {
      nameErr.classList.add('show')
      nameInput.focus()
      return
    }
    nameErr.classList.remove('show')

    saveBtn.disabled = true
    saveBtn.innerHTML = `<span class="grp-spinner"></span> Creating…`

    try {
      const payload: CreateGroupPayload = {
        name,
        group_type: selectedType,
        description: descInput.value.trim() || null,
      }
      await createGroup(payload)
      close()
      await _reload()
    } catch (err: any) {
      saveBtn.disabled = false
      saveBtn.innerHTML = `<i class="bi bi-plus-circle"></i> Create Group`
      nameErr.textContent = err?.message ?? 'Failed to create group. Try again.'
      nameErr.classList.add('show')
    }
  })

  // Focus name input
  setTimeout(() => backdrop.querySelector<HTMLInputElement>('#grp-new-name')?.focus(), 80)
}

// ── Delete confirm ────────────────────────────────────────────────────────────
function _showDeleteConfirm(group: Group): void {
  const existing = document.getElementById('grp-confirm-modal')
  existing?.remove()

  const backdrop = document.createElement('div')
  backdrop.className = 'grp-confirm-backdrop'
  backdrop.id = 'grp-confirm-modal'

  backdrop.innerHTML = `
    <div class="grp-confirm-box">
      <div class="grp-confirm-icon"><i class="bi bi-trash3-fill"></i></div>
      <div class="grp-confirm-title">Delete "${group.name}"?</div>
      <div class="grp-confirm-msg">
        This group will be soft-deleted and hidden from all views.
        Members won't be affected. You can restore it from the database if needed.
      </div>
      <div class="grp-confirm-btns">
        <button class="btn btn-outline" id="grp-del-cancel">Cancel</button>
        <button class="btn btn-danger" id="grp-del-confirm">
          <i class="bi bi-trash3"></i> Delete
        </button>
      </div>
    </div>`

  document.body.appendChild(backdrop)

  const close = () => backdrop.remove()
  backdrop.querySelector('#grp-del-cancel')?.addEventListener('click', close)
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close() })

  backdrop.querySelector('#grp-del-confirm')?.addEventListener('click', async () => {
    const btn = backdrop.querySelector<HTMLButtonElement>('#grp-del-confirm')!
    btn.disabled = true
    btn.innerHTML = `<span class="grp-spinner"></span> Deleting…`
    try {
      await softDeleteGroup(group.id)
      close()
      await _reload()
    } catch (err: any) {
      btn.disabled = false
      btn.innerHTML = `<i class="bi bi-trash3"></i> Delete`
      const msg = document.createElement('p')
      msg.style.cssText = 'font-size:12px;color:var(--caci-red);margin-top:8px;text-align:center;'
      msg.textContent = err?.message ?? 'Failed to delete. Try again.'
      backdrop.querySelector('.grp-confirm-box')?.appendChild(msg)
    }
  })
}

// ── Main render ───────────────────────────────────────────────────────────────
const Groups: PageModule = {

  async render(container: HTMLElement): Promise<void> {
    _destroyed  = false
    _container  = container
    _state.search     = ''
    _state.sort       = 'name_az'
    _state.typeFilter = 'all'
    _state.statFilter = null

    injectCSS()
    renderSkeleton(container, 'card')

    const user     = getCurrentUser()
    const canCreate = user && can(user, PERMISSIONS.GROUPS_CREATE)

    // Register realtime listeners
    on('group:created', _onGroupCreated)
    on('group:updated', _onGroupUpdated)
    on('group:deleted', _onGroupDeleted)

    let groups: Group[] = []
    try {
      groups = await listGroups({ includeDeleted: false })
    } catch (err) {
      renderError(container, err, { retry: () => Groups.render(container) })
      return
    }

    if (_destroyed) return

    _state.groups = groups
    _applyFilters()

    container.innerHTML = /* html */`
      <div class="grp-page">

        <!-- Header -->
        <div class="grp-page-header">
          <div>
            <h1 class="grp-page-title">Groups &amp; Units</h1>
            <p class="grp-page-sub">Manage departments and age groups in your assembly</p>
          </div>
          ${canCreate ? `
          <button class="grp-tbtn grp-tbtn-primary" id="grp-create-btn">
            <i class="bi bi-plus-lg"></i>
            <span class="grp-btn-label">New Group</span>
          </button>` : ''}
        </div>

        <!-- Stat cards -->
        <div class="grp-stats-row"></div>

        <!-- Toolbar -->
        <div class="grp-toolbar" style="margin-bottom:var(--space-md);">
          <div class="grp-search-wrap">
            <i class="bi bi-search"></i>
            <input type="text" id="grp-search" placeholder="Search groups…" autocomplete="off">
          </div>
          <div class="grp-sort-wrap">
            <i class="bi bi-arrow-down-up"></i>
            <select class="grp-sort-select" id="grp-sort">
              <option value="name_az">Name (A–Z)</option>
              <option value="name_za">Name (Z–A)</option>
              <option value="most_members">Most Members</option>
              <option value="least_members">Fewest Members</option>
              <option value="active_first">Active First</option>
            </select>
          </div>
          ${canCreate ? `
          <button class="grp-tbtn grp-tbtn-primary" id="grp-create-btn-toolbar">
            <i class="bi bi-plus-lg"></i>
            <span class="grp-btn-label">New Group</span>
          </button>` : ''}
        </div>

        <!-- Type chips -->
        <div class="grp-chips"></div>

        <!-- Filter banner -->
        <div class="grp-filter-banner" style="margin-bottom:var(--space-sm);"></div>

        <!-- Results meta -->
        <div class="grp-meta" style="margin-bottom:var(--space-md);"></div>

        <!-- List panel -->
        <div class="grp-list-panel" style="margin-bottom:var(--space-lg);"></div>

        <!-- Card grid -->
        <div class="grp-grid"></div>

      </div>`

    // Render sub-sections
    _renderStats()
    _renderChips()
    _renderContent()

    // Search
    const searchInput = container.querySelector<HTMLInputElement>('#grp-search')!
    const _debouncedSearch = debounce((q: string) => {
      _state.search = q
      _applyFilters()
      _renderContent()
    }, 220)
    searchInput.addEventListener('input', () => _debouncedSearch(searchInput.value))

    // Sort
    container.querySelector('#grp-sort')?.addEventListener('change', e => {
      _state.sort = (e.target as HTMLSelectElement).value
      _applyFilters()
      _renderContent()
    })

    // Create buttons
    const openCreate = () => _openCreateModal()
    container.querySelector('#grp-create-btn')?.addEventListener('click', openCreate)
    container.querySelector('#grp-create-btn-toolbar')?.addEventListener('click', openCreate)
  },

  destroy(): void {
    _destroyed  = true
    _container  = null
    off('group:created', _onGroupCreated)
    off('group:updated', _onGroupUpdated)
    off('group:deleted', _onGroupDeleted)
    // Clean up any open modals
    document.getElementById('grp-create-modal')?.remove()
    document.getElementById('grp-confirm-modal')?.remove()
  },
}

export default Groups
