// src/modules/pastoral/pages/PastoralCare.ts
// Pastoral Care page — full PageModule implementation.
// Design language matches Groups / GroupDetail exactly:
//   — CSS design tokens (--bg-card, --border-default, --text-primary, etc.)
//   — Bootstrap Icons (bi-*)
//   — Same stat card, toolbar, modal, and badge patterns
//
// Sub-views:
//   Cases   — split layout: searchable/filterable list + inline detail panel
//   Prayers — card grid: prayer requests with mark-answered action
//
// Database tables (from migration 20260602000001):
//   pastoral_cases    — cases with type, priority, status, assigned_to, is_private
//   pastoral_visits   — child visits per case (timeline)
//   prayer_requests   — assembly-scoped, optional member, optional anonymous
//
// Permissions:
//   PASTORAL_VIEW          — read gate (router enforces)
//   PASTORAL_MANAGE        — create/update cases, log visits, mark answered
//   PASTORAL_PRAYER_MANAGE — submit & manage prayer requests

import type { PageModule }           from '../../../types/module.types'
import { getCurrentUser }             from '@core/auth'
import { getActiveAssemblyId }        from '@core/auth'
import { can }                        from '@core/authorization/authorization-service'
import { PERMISSIONS }                from '@core/authorization/permissions'
import { supabase }                   from '@core/supabase'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { renderBreadcrumbs }           from '../../../shell/Breadcrumbs'
import { debounce }                    from '@shared/utils/debounce'
import { navigate }                    from '@core/router'
import type { Database }               from '../../../types/database.types'
import type { WorkspaceTab }           from '@shell/WorkspaceShell'

// ── DB row type aliases ───────────────────────────────────────────────────────
type PastoralCase   = Database['public']['Tables']['pastoral_cases']['Row']
type PastoralVisit  = Database['public']['Tables']['pastoral_visits']['Row']
type PrayerRequest  = Database['public']['Tables']['prayer_requests']['Row']

// Extended with joined fields
interface CaseWithVisits extends PastoralCase {
  member_name:    string | null
  assigned_name:  string | null
  visits:         VisitWithActor[]
}
interface VisitWithActor extends PastoralVisit {
  actor_name: string | null
}
interface PrayerWithMember extends PrayerRequest {
  member_name: string | null
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = /* css */`
/* ══════════════════════════════════════════════════════
   PASTORAL CARE PAGE  — scoped under .pc-*
══════════════════════════════════════════════════════ */

.pc-page {
  font-family: var(--font-sans);
}

/* ── Page header ── */
.pc-page-header {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: var(--space-md);
  flex-wrap: wrap; margin-bottom: var(--space-xl);
}
.pc-page-title {
  font-size: var(--text-h1); font-weight: 700;
  color: var(--text-primary); margin: 0 0 2px;
  letter-spacing: -0.02em;
}
.pc-page-sub { font-size: var(--text-small); color: var(--text-secondary); margin: 0; }

/* ── Stat cards ── */
.pc-stats-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
  overflow-x: auto; scrollbar-width: none;
}
.pc-stats-row::-webkit-scrollbar { display: none; }
@media (max-width: 1100px) { .pc-stats-row { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 700px)  { .pc-stats-row { grid-template-columns: repeat(2, 1fr); } }

.pc-stat {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  cursor: pointer; position: relative;
  transition: border-color .2s, box-shadow .2s, transform .2s;
  min-width: 150px;
}
.pc-stat:hover { border-color: var(--border-strong); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,.1); }
.pc-stat.selected {
  border-color: var(--stat-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--stat-color) 14%, transparent);
}
.pc-stat-icon-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.pc-stat-icon {
  width: 28px; height: 28px; border-radius: var(--radius-xs);
  background: var(--stat-icon-bg, var(--bg-info));
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.pc-stat-icon i { font-size: 14px; color: var(--stat-color, var(--caci-blue)); }
.pc-stat-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .07em; color: var(--text-muted);
}
.pc-stat-num  { font-size: 26px; font-weight: 700; color: var(--text-primary); line-height: 1; margin-bottom: 3px; }
.pc-stat-sub  { font-size: 11px; color: var(--text-secondary); margin-bottom: 10px; }
.pc-stat-bar  { height: 3px; background: var(--border-default); border-radius: 99px; overflow: hidden; }
.pc-stat-fill { height: 100%; border-radius: 99px; background: var(--stat-color, var(--caci-blue)); transition: width .6s; }

/* ── Sub-nav tabs ── */
.pc-subnav {
  display: flex; align-items: center;
  border-bottom: 1px solid var(--border-default);
  margin-bottom: var(--space-lg);
  gap: 0; overflow-x: auto; scrollbar-width: none;
}
.pc-subnav::-webkit-scrollbar { display: none; }
.pc-snav-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 10px 18px; font-size: 13px; font-weight: 500;
  color: var(--text-secondary); background: none;
  border: none; border-bottom: 2px solid transparent;
  cursor: pointer; transition: color .15s, border-color .15s;
  margin-bottom: -1px; white-space: nowrap;
  font-family: var(--font-sans); flex-shrink: 0;
}
.pc-snav-btn:hover { color: var(--text-primary); }
.pc-snav-btn.active { color: var(--text-primary); border-bottom-color: var(--caci-red); font-weight: 600; }
.pc-snav-count {
  background: var(--bg-hover); color: var(--text-secondary);
  font-size: 11px; font-weight: 600;
  padding: 1px 6px; border-radius: 99px;
  transition: background .15s, color .15s;
}
.pc-snav-btn.active .pc-snav-count { background: var(--caci-red); color: #fff; }
.pc-snav-actions { margin-left: auto; display: flex; gap: 8px; padding: 6px 0; flex-shrink: 0; }

/* ── View sections ── */
.pc-view { display: none; }
.pc-view.active { display: block; }

/* ── Toolbar ── */
.pc-toolbar {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 16px; padding: 10px 14px;
  display: flex; align-items: center; gap: 10px;
  box-shadow: var(--shadow-raised);
  flex-wrap: wrap; margin-bottom: var(--space-md);
}
.pc-search-wrap {
  display: flex; align-items: center; gap: 9px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: 10px; padding: 0 12px; height: 40px;
  flex: 1; max-width: 420px; min-width: 0;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.pc-search-wrap:focus-within { border-color: var(--border-focus); box-shadow: 0 0 0 3px var(--focus-ring); }
.pc-search-wrap i { font-size: 15px; color: var(--text-muted); flex-shrink: 0; }
.pc-search-wrap:focus-within i { color: var(--caci-blue); }
.pc-search-wrap input {
  background: transparent; border: none; outline: none;
  font-size: 13px; color: var(--text-primary);
  font-family: var(--font-sans); width: 100%;
  caret-color: var(--caci-blue);
}
.pc-search-wrap input::placeholder { color: var(--text-muted); }

.pc-sort-wrap { position: relative; display: flex; align-items: center; }
.pc-sort-wrap i {
  position: absolute; left: 10px; font-size: 14px;
  color: var(--text-secondary); pointer-events: none; z-index: 1;
}

.pc-sel {
  appearance: none; -webkit-appearance: none;
  padding: 0 32px 0 14px; height: 40px;
  border-radius: 10px; border: 1px solid var(--border-default);
  background: var(--bg-page);
  color: var(--text-primary); font-size: 12.5px;
  font-family: var(--font-sans); font-weight: 500;
  cursor: pointer; outline: none; min-width: 140px;
  transition: border-color 0.2s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236e7681' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center;
}
.pc-sel.with-icon { padding-left: 30px; }
.pc-sel:focus { border-color: var(--border-focus); }
.pc-sel option { background: var(--bg-card); color: var(--text-primary); }

.pc-toolbar-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: auto; flex-wrap: wrap; }

@media (max-width: 640px) {
  .pc-toolbar { flex-wrap: wrap; gap: 8px; }
  .pc-search-wrap { order: 0; width: 100%; flex: none; max-width: none; }
  .pc-toolbar-actions { order: 1; margin-left: 0; width: 100%; display: grid; grid-template-columns: 1fr 1fr; }
  .pc-sort-wrap { grid-column: 1 / -1; }
  .pc-sel { min-width: 0; width: 100%; }
}

/* ── Filter bar ── */
.pc-filter-bar {
  display: flex; align-items: center; gap: 10px;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); padding: 10px 14px;
  margin-bottom: var(--space-sm); flex-wrap: wrap;
}
.pc-filter-chip {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--bg-hover); color: var(--text-primary);
  font-size: 12px; font-weight: 600;
  padding: 2px 9px; border-radius: 99px;
}
.pc-filter-clear {
  font-size: 12px; color: var(--text-secondary);
  background: none; border: none; cursor: pointer;
  display: flex; align-items: center; gap: 3px;
  padding: 3px 6px; border-radius: var(--radius-xs);
  font-family: var(--font-sans); transition: background .15s;
  margin-left: auto;
}
.pc-filter-clear:hover { background: var(--bg-hover); color: var(--text-primary); }

.pc-results-bar { font-size: 13px; color: var(--text-secondary); margin-bottom: 10px; }
.pc-results-bar strong { color: var(--text-primary); }

/* ── Cases split layout ── */
.pc-cases-layout {
  display: grid; grid-template-columns: 1fr 360px;
  gap: var(--space-lg); align-items: start;
}
@media (max-width: 1060px) { .pc-cases-layout { grid-template-columns: 1fr; } }
@media (max-width: 1060px) { .pc-detail-panel { display: none; } }

/* ── Case list card ── */
.pc-case-list {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); overflow: hidden;
}
.pc-case-list-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 11px 16px; background: var(--bg-page);
  border-bottom: 1px solid var(--border-default);
  font-size: 12px;
}
.pc-case-list-title { font-weight: 600; color: var(--text-secondary); }
.pc-case-list-meta  { color: var(--text-muted); }
.pc-case-list-clear {
  font-size: 12px; color: var(--caci-blue-light); background: none;
  border: none; cursor: pointer; font-family: var(--font-sans);
}
.pc-case-list-clear:hover { text-decoration: underline; }

/* ── Case row ── */
.pc-case-row {
  display: flex; align-items: center; gap: 13px;
  padding: 13px 16px 13px 19px;
  border-bottom: 1px solid var(--border-default);
  cursor: pointer; position: relative;
  transition: background .12s;
  animation: pcFadeUp .38s ease both;
}
.pc-case-row:last-child { border-bottom: none; }
.pc-case-row:hover { background: var(--bg-hover); }
.pc-case-row.selected { background: var(--bg-info); }

/* priority left stripe */
.pc-case-row::before {
  content: ''; position: absolute;
  left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--pri-color, var(--border-default));
  border-radius: 0 2px 2px 0;
}
.pc-case-row.p-urgent { --pri-color: var(--caci-red); }
.pc-case-row.p-high   { --pri-color: #e67700; }
.pc-case-row.p-medium { --pri-color: var(--caci-blue); }
.pc-case-row.p-low    { --pri-color: var(--green); }

@keyframes pcFadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.pc-row-avatar {
  width: 38px; height: 38px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.pc-row-body { flex: 1; min-width: 0; }
.pc-row-top  {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: 8px; margin-bottom: 4px;
}
.pc-row-title {
  font-size: 13px; font-weight: 600; color: var(--text-primary);
  line-height: 1.35; overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.pc-row-id { font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); flex-shrink: 0; margin-top: 1px; }
.pc-row-meta {
  display: flex; align-items: center; gap: 6px;
  flex-wrap: wrap; font-size: 11px;
}
.pc-row-member { font-size: 12px; color: var(--text-secondary); }
.pc-row-dot    { width: 3px; height: 3px; border-radius: 50%; background: var(--border-strong); }
.pc-row-date   { font-size: 11px; color: var(--text-muted); }
.pc-row-right  { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
.pc-row-actions { display: flex; gap: 5px; }
.pc-row-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; height: 28px; border-radius: var(--radius-xs);
  border: 1px solid var(--border-default); background: var(--bg-card);
  color: var(--text-secondary); font-size: 12px; font-weight: 500;
  cursor: pointer; font-family: var(--font-sans);
  transition: all .12s; white-space: nowrap;
}
.pc-row-btn i { font-size: 14px; }
.pc-row-btn:hover { border-color: var(--border-strong); color: var(--text-primary); }
.pc-row-btn.primary {
  background: var(--bg-info); border-color: rgba(0,75,160,.25);
  color: var(--caci-blue-light);
}
.pc-row-btn.primary:hover { background: rgba(0,75,160,.15); }
@media (hover: hover) {
  .pc-row-actions .pc-row-btn { opacity: 0; transition: opacity .12s; }
  .pc-case-row:hover .pc-row-actions .pc-row-btn { opacity: 1; }
}

/* ── Badges ── */
.pc-badge {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 7px; border-radius: 99px;
  font-size: 10px; font-weight: 600; white-space: nowrap;
}
/* type */
.pc-t-follow_up    { background: var(--bg-info);    color: var(--caci-blue-light); border: 1px solid rgba(0,75,160,.18); }
.pc-t-bereavement  { background: var(--bg-hover);   color: var(--text-secondary);  border: 1px solid var(--border-default); }
.pc-t-illness      { background: var(--bg-danger);  color: var(--caci-red);        border: 1px solid rgba(198,0,38,.18); }
.pc-t-counselling  { background: var(--bg-info);    color: var(--caci-blue);       border: 1px solid rgba(0,75,160,.18); }
.pc-t-discipline   { background: var(--bg-warning); color: var(--amber);           border: 1px solid rgba(154,103,0,.2); }
.pc-t-other        { background: var(--bg-hover);   color: var(--text-secondary);  border: 1px solid var(--border-default); }
/* priority */
.pc-p-urgent { background: var(--bg-danger);  color: var(--caci-red-dim);    border: 1px solid rgba(198,0,38,.2); }
.pc-p-high   { background: var(--bg-warning); color: #92400e;                border: 1px solid rgba(154,103,0,.2); }
.pc-p-medium { background: var(--bg-info);    color: var(--caci-blue-dim);   border: 1px solid rgba(0,75,160,.18); }
.pc-p-low    { background: var(--green-bg);   color: var(--green);           border: 1px solid rgba(26,127,55,.18); }
/* status */
.pc-s-open        { background: var(--bg-info);    color: var(--caci-blue-dim);  border: 1px solid rgba(0,75,160,.18); }
.pc-s-in_progress { background: var(--bg-warning); color: var(--amber);          border: 1px solid rgba(154,103,0,.2); }
.pc-s-resolved    { background: var(--green-bg);   color: var(--green);          border: 1px solid rgba(26,127,55,.18); }
.pc-s-closed      { background: var(--bg-hover);   color: var(--text-muted);     border: 1px solid var(--border-default); }
/* private */
.pc-private-badge { background: var(--bg-hover); color: var(--text-muted); border: 1px solid var(--border-default); }
/* prayer status */
.pc-pr-active   { background: var(--bg-info);    color: var(--caci-blue-dim);  border: 1px solid rgba(0,75,160,.18); }
.pc-pr-answered { background: var(--green-bg);   color: var(--green);          border: 1px solid rgba(26,127,55,.18); }
.pc-pr-closed   { background: var(--bg-hover);   color: var(--text-muted);     border: 1px solid var(--border-default); }

/* ── Detail panel ── */
.pc-detail-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); overflow: hidden;
  position: sticky; top: var(--space-xl);
}
.pc-dp-empty {
  display: flex; flex-direction: column; align-items: center;
  padding: 48px 20px; text-align: center; color: var(--text-muted);
}
.pc-dp-empty i { font-size: 2.5rem; margin-bottom: 12px; color: var(--border-strong); }
.pc-dp-empty p { font-size: 13px; }
.pc-dp-empty span { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

.pc-dp-header {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px 16px; border-bottom: 1px solid var(--border-default);
}
.pc-dp-header-body { flex: 1; min-width: 0; }
.pc-dp-title { font-size: 13px; font-weight: 700; color: var(--text-primary); line-height: 1.4; margin-bottom: 6px; }
.pc-dp-meta  { display: flex; gap: 5px; flex-wrap: wrap; }

.pc-dp-body  { padding: 14px 16px; display: flex; flex-direction: column; gap: 14px; max-height: 60vh; overflow-y: auto; }
.pc-dp-body::-webkit-scrollbar { width: 4px; }
.pc-dp-body::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 10px; }

.pc-dp-section { display: flex; flex-direction: column; gap: 4px; }
.pc-dp-sect-lbl {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .07em; color: var(--text-muted);
  padding-bottom: 5px; border-bottom: 1px solid var(--border-default);
  margin-bottom: 2px;
}
.pc-dp-field {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 10px; padding: 3px 0;
}
.pc-dp-field-lbl { font-size: 12px; color: var(--text-secondary); flex-shrink: 0; }
.pc-dp-field-val { font-size: 12px; font-weight: 500; color: var(--text-primary); text-align: right; max-width: 200px; }
.pc-dp-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.6; }

.pc-dp-footer {
  padding: 12px 14px; border-top: 1px solid var(--border-default);
  display: flex; gap: 8px;
}
.pc-dp-btn {
  flex: 1; padding: 8px; border-radius: var(--radius-md);
  font-size: 12px; font-weight: 600; cursor: pointer;
  border: 1px solid var(--border-default); background: var(--bg-page);
  color: var(--text-secondary); font-family: var(--font-sans);
  display: flex; align-items: center; justify-content: center; gap: 5px;
  transition: all .15s;
}
.pc-dp-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.pc-dp-btn.primary {
  background: var(--caci-red); border-color: var(--caci-red-dim);
  color: #fff; box-shadow: 0 2px 8px rgba(198,0,38,.2);
}
.pc-dp-btn.primary:hover { background: var(--caci-red-dim); }
.pc-dp-btn:disabled { opacity: .5; cursor: not-allowed; }

/* ── Visit timeline ── */
.pc-visit-item {
  display: flex; gap: 10px; position: relative;
  padding-bottom: 12px;
}
.pc-visit-item:last-child { padding-bottom: 0; }
.pc-visit-item::before {
  content: ''; position: absolute;
  left: 13px; top: 27px; bottom: 0; width: 1px;
  background: var(--border-default);
}
.pc-visit-item:last-child::before { display: none; }
.pc-visit-dot {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--bg-page); border: 1.5px solid var(--border-default);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; margin-top: 1px; z-index: 1;
}
.pc-visit-dot i { font-size: 13px; color: var(--text-secondary); }
.pc-visit-content { flex: 1; min-width: 0; }
.pc-visit-type { font-size: 12px; font-weight: 600; color: var(--text-primary); }
.pc-visit-meta { font-size: 11px; color: var(--text-muted); margin-top: 1px; }
.pc-visit-notes {
  font-size: 11px; color: var(--text-secondary); margin-top: 5px;
  padding: 6px 10px; background: var(--bg-page); border-radius: var(--radius-xs);
  border: 1px solid var(--border-default); line-height: 1.5; font-style: italic;
}
.pc-visit-outcome {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; font-weight: 600;
  padding: 2px 6px; border-radius: 99px; margin-top: 4px;
}
.pc-vo-positive      { background: var(--green-bg);   color: var(--green); border: 1px solid rgba(26,127,55,.2); }
.pc-vo-needs_follow_up{ background: var(--bg-warning); color: var(--amber); border: 1px solid rgba(154,103,0,.2); }
.pc-vo-no_response   { background: var(--bg-hover);   color: var(--text-muted); border: 1px solid var(--border-default); }
.pc-vo-referred      { background: var(--bg-info);    color: var(--caci-blue-light); border: 1px solid rgba(0,75,160,.2); }

/* ── Prayer grid ── */
.pc-prayer-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
}
@media (max-width: 1100px) { .pc-prayer-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px)  { .pc-prayer-grid { grid-template-columns: 1fr; } }

.pc-prayer-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); padding: var(--space-md);
  transition: box-shadow .2s, border-color .2s;
  animation: pcFadeUp .4s ease both;
}
.pc-prayer-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,.1); border-color: var(--border-strong); }
.pc-prayer-card.answered {
  border-color: rgba(26,127,55,.28);
  background: color-mix(in srgb, var(--green-bg) 30%, var(--bg-card));
}
.pc-prayer-header {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: 8px; margin-bottom: 8px;
}
.pc-prayer-title { font-size: 13px; font-weight: 600; color: var(--text-primary); flex: 1; line-height: 1.4; }
.pc-prayer-desc  {
  font-size: 12px; color: var(--text-secondary); line-height: 1.55; margin-bottom: 10px;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.pc-prayer-footer {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  border-top: 1px solid var(--border-default); padding-top: 10px;
}
.pc-prayer-card.answered .pc-prayer-footer { border-top-color: rgba(26,127,55,.15); }
.pc-prayer-member { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary); }
.pc-prayer-date   { font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 2px; }
.pc-prayer-anon   {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; color: var(--text-muted);
  background: var(--bg-hover); padding: 2px 7px; border-radius: 99px;
}
.pc-prayer-answered-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 10px; border-radius: var(--radius-xs);
  border: 1px solid rgba(26,127,55,.25); background: rgba(26,127,55,.06);
  color: var(--green); font-size: 11px; font-weight: 600;
  cursor: pointer; transition: all .15s; font-family: var(--font-sans); flex-shrink: 0;
}
.pc-prayer-answered-btn:hover { background: var(--green-bg); box-shadow: 0 2px 8px rgba(26,127,55,.12); }
.pc-prayer-answered-tag {
  display: flex; align-items: center; gap: 3px;
  font-size: 11px; font-weight: 600; color: var(--green); flex-shrink: 0;
}
.pc-mini-av-sm {
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0;
}

/* ── Modal ── */
.pc-modal-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: var(--space-lg);
  opacity: 0; pointer-events: none; transition: opacity .2s;
}
.pc-modal-backdrop.open { opacity: 1; pointer-events: all; }
.pc-modal {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 64px rgba(0,0,0,.3);
  width: 100%; max-width: 540px; max-height: 90vh;
  display: flex; flex-direction: column;
  transform: scale(.97) translateY(8px);
  transition: transform .28s cubic-bezier(.16,1,.3,1);
}
.pc-modal-backdrop.open .pc-modal { transform: scale(1) translateY(0); }
.pc-modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--border-default);
  flex-shrink: 0; position: sticky; top: 0; background: var(--bg-card); z-index: 1;
}
.pc-modal-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.pc-modal-close {
  width: 28px; height: 28px; border: none; background: transparent;
  color: var(--text-muted); cursor: pointer; border-radius: var(--radius-xs);
  display: flex; align-items: center; justify-content: center;
  font-size: 17px; transition: background .12s;
}
.pc-modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }
.pc-modal-body {
  padding: 18px 20px; overflow-y: auto; flex: 1;
  display: flex; flex-direction: column; gap: 13px;
}
.pc-modal-foot {
  padding: 12px 20px; border-top: 1px solid var(--border-default);
  display: flex; justify-content: flex-end; gap: var(--space-sm); flex-shrink: 0;
}

/* form */
.pc-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 480px) { .pc-form-row { grid-template-columns: 1fr; } }
.pc-form-group { display: flex; flex-direction: column; gap: 5px; }
.pc-form-group.full { grid-column: 1 / -1; }
.pc-form-label {
  font-size: 11px; font-weight: 600; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: .04em;
}
.pc-form-input {
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: var(--radius-sm); padding: 0 12px; height: 38px;
  color: var(--text-primary); font-size: 13px; font-family: var(--font-sans);
  outline: none; width: 100%;
  transition: border-color .15s, box-shadow .15s;
}
.pc-form-input:focus { border-color: var(--caci-blue); box-shadow: 0 0 0 3px var(--focus-ring); }
.pc-form-input::placeholder { color: var(--text-muted); }
textarea.pc-form-input { height: auto; padding: 10px 12px; resize: vertical; line-height: 1.5; min-height: 76px; }
select.pc-form-input {
  cursor: pointer; appearance: none; -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' stroke='%236e7681' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px;
}
.pc-form-check {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  font-size: 13px; color: var(--text-secondary);
  padding: 8px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-default); transition: border-color .15s, background .15s;
  user-select: none;
}
.pc-form-check:hover { border-color: var(--border-strong); background: var(--bg-hover); }
.pc-form-check input { width: 14px; height: 14px; accent-color: var(--caci-blue); cursor: pointer; }
.pc-field-err { font-size: 11px; color: var(--caci-red); display: none; }
.pc-field-err.show { display: block; }

/* modal buttons */
.pc-modal-btn {
  padding: 8px 16px; border-radius: var(--radius-md);
  font-size: 13px; font-weight: 600; cursor: pointer;
  border: 1px solid var(--border-default);
  background: var(--bg-page); color: var(--text-secondary);
  font-family: var(--font-sans); display: inline-flex; align-items: center; gap: 5px;
  transition: all .15s;
}
.pc-modal-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.pc-modal-btn.primary {
  background: var(--caci-blue); border-color: var(--caci-blue-dim); color: #fff;
  box-shadow: 0 2px 8px rgba(0,75,160,.2);
}
.pc-modal-btn.primary:hover { background: var(--caci-blue-dim); }
.pc-modal-btn:disabled { opacity: .5; cursor: not-allowed; }

/* ── Spinner ── */
.pc-spinner {
  width: 15px; height: 15px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
  animation: pcSpin .7s linear infinite; display: inline-block; vertical-align: middle;
}
.pc-spinner.dark { border-color: rgba(0,0,0,.12); border-top-color: var(--text-secondary); }
@keyframes pcSpin { to { transform: rotate(360deg); } }

/* ── Empty state ── */
.pc-empty {
  display: flex; flex-direction: column; align-items: center;
  padding: 56px 20px; text-align: center; color: var(--text-secondary);
}
.pc-empty i { font-size: 2.5rem; color: var(--border-strong); margin-bottom: var(--space-md); }
.pc-empty h3 { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.pc-empty p  { font-size: 12px; max-width: 280px; line-height: 1.55; }

/* ── Toast ── */
#pc-toast {
  position: fixed; bottom: 24px; right: 24px; z-index: 2000;
  display: flex; align-items: center; gap: 10px;
  padding: 11px 16px; border-radius: var(--radius-md);
  background: var(--bg-card); border: 1px solid var(--border-default);
  box-shadow: 0 8px 32px rgba(0,0,0,.18);
  font-size: 13px; font-weight: 500; color: var(--text-primary);
  transform: translateY(64px); opacity: 0;
  transition: all .3s cubic-bezier(.16,1,.3,1); pointer-events: none;
}
#pc-toast.show { transform: translateY(0); opacity: 1; }
#pc-toast i { font-size: 17px; flex-shrink: 0; }

@media (max-width: 640px) {
  .pc-prayer-grid { gap: 10px; }
  .pc-cases-layout { grid-template-columns: 1fr; gap: 0; }
}
`

function _injectCSS(): void {
  if (document.getElementById('pc-page-css')) return
  const s = document.createElement('style')
  s.id = 'pc-page-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#004BA0','#C60026','#1a5fb4','#7c3aed','#1a7f37','#9a6700','#0969da','#b45309']
function avatarColor(name: string): string {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(name: string): string {
  const p = (name || '?').trim().split(' ')
  return ((p[0]?.[0] ?? '') + (p[p.length - 1]?.[0] ?? '')).toUpperCase()
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d + (d.includes('T') ? '' : 'T00:00:00'))
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function daysAgo(d: string | null): string {
  if (!d) return '—'
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

// ── Config maps ───────────────────────────────────────────────────────────────
const CASE_TYPE_CFG: Record<string, { label: string; icon: string; cls: string }> = {
  follow_up:   { label: 'Follow Up',   icon: 'bi-person-check',   cls: 'pc-t-follow_up'   },
  bereavement: { label: 'Bereavement', icon: 'bi-heart-pulse',    cls: 'pc-t-bereavement' },
  illness:     { label: 'Illness',     icon: 'bi-hospital',       cls: 'pc-t-illness'      },
  counselling: { label: 'Counselling', icon: 'bi-chat-heart',     cls: 'pc-t-counselling' },
  discipline:  { label: 'Discipline',  icon: 'bi-shield-exclamation', cls: 'pc-t-discipline' },
  other:       { label: 'Other',       icon: 'bi-three-dots',     cls: 'pc-t-other'       },
}
const PRIORITY_CFG: Record<string, { label: string; cls: string }> = {
  urgent: { label: 'Urgent', cls: 'pc-p-urgent' },
  high:   { label: 'High',   cls: 'pc-p-high'   },
  medium: { label: 'Medium', cls: 'pc-p-medium' },
  low:    { label: 'Low',    cls: 'pc-p-low'    },
}
const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  open:        { label: 'Open',        cls: 'pc-s-open'        },
  in_progress: { label: 'In Progress', cls: 'pc-s-in_progress' },
  resolved:    { label: 'Resolved',    cls: 'pc-s-resolved'    },
  closed:      { label: 'Closed',      cls: 'pc-s-closed'      },
}
const VISIT_TYPE_ICON: Record<string, string> = {
  home_visit:     'bi-house-fill',
  hospital_visit: 'bi-hospital-fill',
  phone_call:     'bi-telephone-fill',
  video_call:     'bi-camera-video-fill',
  in_person:      'bi-building',
}
const OUTCOME_CFG: Record<string, { label: string; cls: string }> = {
  positive:       { label: 'Improving',         cls: 'pc-vo-positive'       },
  needs_follow_up:{ label: 'Follow-up Needed',  cls: 'pc-vo-needs_follow_up'},
  no_response:    { label: 'No Response',       cls: 'pc-vo-no_response'    },
  referred:       { label: 'Referred',          cls: 'pc-vo-referred'       },
}

function typeBadge(t: string): string {
  const c = CASE_TYPE_CFG[t] ?? CASE_TYPE_CFG['other']
  return `<span class="pc-badge ${c.cls}"><i class="bi ${c.icon}" style="font-size:10px;"></i>${c.label}</span>`
}
function priorityBadge(p: string): string {
  const c = PRIORITY_CFG[p] ?? PRIORITY_CFG['low']
  return `<span class="pc-badge ${c.cls}">${c.label}</span>`
}
function statusBadge(s: string): string {
  const c = STATUS_CFG[s] ?? STATUS_CFG['open']
  return `<span class="pc-badge ${c.cls}">${c.label}</span>`
}
function prayerStatusBadge(s: string, answered: boolean): string {
  if (answered) return `<span class="pc-badge pc-pr-answered"><i class="bi bi-check-circle-fill" style="font-size:10px;"></i>Answered</span>`
  if (s === 'closed') return `<span class="pc-badge pc-pr-closed">Closed</span>`
  return `<span class="pc-badge pc-pr-active">Active</span>`
}

// ── Page state ────────────────────────────────────────────────────────────────
let _container: HTMLElement | null = null
let _destroyed  = false
let _activeView: 'cases' | 'prayers' = 'cases'
let _cases:   CaseWithVisits[] = []
let _prayers: PrayerWithMember[] = []
let _activeCase: CaseWithVisits | null = null

// filter state
let _caseSearch  = ''
let _caseType    = 'all'
let _caseStatus  = 'all'
let _caseSort    = 'newest'
let _prayerSearch = ''
let _prayerStatus = 'all'
let _prayerSort   = 'newest'

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer: ReturnType<typeof setTimeout> | null = null
function _toast(type: 'success' | 'error', msg: string): void {
  let el = document.getElementById('pc-toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'pc-toast'
    document.body.appendChild(el)
  }
  const icon = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'
  const color = type === 'success' ? 'var(--green)' : 'var(--caci-red)'
  el.innerHTML = `<i class="bi ${icon}" style="color:${color};"></i><span>${msg}</span>`
  el.classList.add('show')
  if (_toastTimer) clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => el?.classList.remove('show'), 3200)
}

// ── Data layer ────────────────────────────────────────────────────────────────
async function _loadCases(): Promise<void> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) { _cases = []; return }

  const { data, error } = await supabase
    .from('pastoral_cases')
    .select('*')
    .eq('assembly_id', assemblyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error || !data) { _cases = []; return }

  const rows = data as PastoralCase[]

  // Resolve member names
  const memberIds   = [...new Set(rows.map(r => r.member_id).filter(Boolean))] as string[]
  const assignedIds = [...new Set(rows.map(r => r.assigned_to).filter(Boolean))] as string[]
  const userIds     = [...new Set(assignedIds)]

  const memberMap = new Map<string, string>()
  const userMap   = new Map<string, string>()

  if (memberIds.length) {
    const { data: members } = await supabase
      .from('members_view')
      .select('id, first_name, last_name')
      .in('id', memberIds)
    ;(members ?? []).forEach((m: any) => memberMap.set(m.id, `${m.first_name} ${m.last_name}`))
  }
  if (userIds.length) {
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', userIds)
    ;(users ?? []).forEach((u: any) => userMap.set(u.id, u.full_name))
  }

  // Fetch all visits for these cases in one query
  const caseIds = rows.map(r => r.id)
  let visitMap = new Map<string, VisitWithActor[]>()
  if (caseIds.length) {
    const { data: visits } = await supabase
      .from('pastoral_visits')
      .select('*')
      .in('case_id', caseIds)
      .is('deleted_at', null)
      .order('visit_date', { ascending: false })

    if (visits) {
      // Resolve actor names
      const actorIds = [...new Set((visits as PastoralVisit[]).map(v => v.visited_by).filter(Boolean))] as string[]
      const actorMap = new Map<string, string>()
      if (actorIds.length) {
        const { data: actors } = await supabase
          .from('user_profiles').select('id, full_name').in('id', actorIds)
        ;(actors ?? []).forEach((a: any) => actorMap.set(a.id, a.full_name))
      }
      ;(visits as PastoralVisit[]).forEach(v => {
        const arr = visitMap.get(v.case_id) ?? []
        arr.push({ ...v, actor_name: actorMap.get(v.visited_by) ?? null })
        visitMap.set(v.case_id, arr)
      })
    }
  }

  _cases = rows.map(r => ({
    ...r,
    member_name:   memberMap.get(r.member_id) ?? null,
    assigned_name: r.assigned_to ? (userMap.get(r.assigned_to) ?? null) : null,
    visits:        visitMap.get(r.id) ?? [],
  }))
}

async function _loadPrayers(): Promise<void> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) { _prayers = []; return }

  const { data, error } = await supabase
    .from('prayer_requests')
    .select('*')
    .eq('assembly_id', assemblyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error || !data) { _prayers = []; return }
  const rows = data as PrayerRequest[]

  const memberIds = [...new Set(rows.map(r => r.member_id).filter(Boolean))] as string[]
  const memberMap = new Map<string, string>()
  if (memberIds.length) {
    const { data: members } = await supabase
      .from('members_view').select('id, first_name, last_name').in('id', memberIds)
    ;(members ?? []).forEach((m: any) => memberMap.set(m.id, `${m.first_name} ${m.last_name}`))
  }

  _prayers = rows.map(r => ({
    ...r,
    member_name: r.member_id ? (memberMap.get(r.member_id) ?? null) : null,
  }))
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function _renderStats(): void {
  const el = _container?.querySelector<HTMLElement>('.pc-stats-row')
  if (!el) return

  const total    = _cases.length
  const open     = _cases.filter(c => c.status === 'open' || c.status === 'in_progress').length
  const urgent   = _cases.filter(c => (c.priority === 'urgent' || c.priority === 'high') && c.status !== 'resolved' && c.status !== 'closed').length
  const resolved = _cases.filter(c => c.status === 'resolved').length
  const visits   = _cases.reduce((a, c) => a + c.visits.length, 0)
  const pTotal   = _prayers.length
  const answered = _prayers.filter(p => p.is_answered).length
  const resPct   = total ? Math.round(resolved / total * 100) : 0
  const urgPct   = total ? Math.max(Math.round(urgent / total * 100), total ? 8 : 0) : 0
  const ansPct   = pTotal ? Math.round(answered / pTotal * 100) : 0

  // Update tab counts
  _container?.querySelector<HTMLElement>('#pc-sn-cases')
    && (_container.querySelector<HTMLElement>('#pc-sn-cases')!.textContent = String(total))
  _container?.querySelector<HTMLElement>('#pc-sn-prayers')
    && (_container.querySelector<HTMLElement>('#pc-sn-prayers')!.textContent = String(pTotal))

  el.innerHTML = `
  ${_statCard('bi-folder-fill', 'rgba(0,75,160,0.1)', 'var(--caci-blue)', 'Total Cases',  String(total),    `${open} open`,         '100%', 'cases')}
  ${_statCard('bi-exclamation-circle-fill', 'rgba(198,0,38,0.1)', 'var(--caci-red)', 'Urgent / High', String(urgent),   'Needs attention',      `${urgPct}%`, '')}
  ${_statCard('bi-check-circle-fill', 'rgba(26,127,55,0.1)', 'var(--green)', 'Resolved',     String(resolved), `${resPct}% rate`,       `${resPct}%`, '')}
  ${_statCard('bi-map-fill', 'rgba(154,103,0,0.1)', '#b45309', 'Visits Logged',  String(visits),   'Across all cases',      '72%', '')}
  ${_statCard('bi-heart-fill', 'rgba(0,75,160,0.1)', 'var(--caci-blue-light)', 'Prayer Requests', String(pTotal), `${answered} answered`, `${ansPct}%`, 'prayers')}
  `

  el.querySelectorAll<HTMLElement>('[data-stat-view]').forEach(card => {
    card.addEventListener('click', () => {
      const v = card.dataset['statView'] as 'cases' | 'prayers' | ''
      if (v) _switchView(v)
    })
  })
}

function _statCard(icon: string, iconBg: string, color: string, label: string,
  num: string, sub: string, fillPct: string, view: string): string {
  return `<div class="pc-stat" style="--stat-color:${color};--stat-icon-bg:${iconBg};"
    ${view ? `data-stat-view="${view}" title="Switch to ${view}"` : ''}>
    <div class="pc-stat-icon-row">
      <div class="pc-stat-icon"><i class="bi ${icon}"></i></div>
      <span class="pc-stat-label">${label}</span>
    </div>
    <div class="pc-stat-num">${num}</div>
    <div class="pc-stat-sub">${sub}</div>
    <div class="pc-stat-bar"><div class="pc-stat-fill" style="width:${fillPct};"></div></div>
  </div>`
}

// ── View switch ───────────────────────────────────────────────────────────────
function _switchView(view: 'cases' | 'prayers'): void {
  _activeView = view
  _container?.querySelectorAll<HTMLElement>('.pc-view')
    .forEach(s => s.classList.toggle('active', s.id === `pc-view-${view}`))
  _container?.querySelectorAll<HTMLElement>('.pc-snav-btn')
    .forEach(b => b.classList.toggle('active', b.dataset['view'] === view))

  // Update "New" button label + handler
  const addBtn = _container?.querySelector<HTMLButtonElement>('#pc-add-btn')
  if (addBtn) {
    if (view === 'prayers') {
      addBtn.innerHTML = `<i class="bi bi-plus-lg"></i> <span class="pc-btn-lbl">New Request</span>`
      addBtn.onclick = () => _openPrayerModal()
    } else {
      addBtn.innerHTML = `<i class="bi bi-plus-lg"></i> <span class="pc-btn-lbl">New Case</span>`
      addBtn.onclick = () => _openCaseModal()
    }
  }
}

// ── Cases rendering ───────────────────────────────────────────────────────────
function _filteredCases(): CaseWithVisits[] {
  const q = _caseSearch.toLowerCase()
  let list = _cases.filter(c => {
    const searchOk = !q
      || c.title.toLowerCase().includes(q)
      || (c.member_name ?? '').toLowerCase().includes(q)
      || c.id.toLowerCase().includes(q)
    const typeOk   = _caseType   === 'all' || c.case_type === _caseType
    const statusOk = _caseStatus === 'all' || c.status    === _caseStatus
    return searchOk && typeOk && statusOk
  })
  const priOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
  if (_caseSort === 'priority') list.sort((a, b) => (priOrder[a.priority] ?? 4) - (priOrder[b.priority] ?? 4))
  else if (_caseSort === 'oldest') list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  else list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return list
}

function _renderCases(): void {
  const list      = _filteredCases()
  const countEl   = _container?.querySelector<HTMLElement>('#pc-case-count')
  const metaEl    = _container?.querySelector<HTMLElement>('#pc-case-group-meta')
  const listEl    = _container?.querySelector<HTMLElement>('#pc-cases-list')
  if (!listEl) return
  if (countEl) countEl.textContent = String(list.length)
  if (metaEl)  metaEl.textContent  = `${list.length} case${list.length !== 1 ? 's' : ''}`

  const user      = getCurrentUser()
  const canManage = user && can(user, PERMISSIONS.PASTORAL_MANAGE)

  if (!list.length) {
    listEl.innerHTML = `<div class="pc-empty">
      <i class="bi bi-search"></i><h3>No cases found</h3>
      <p>Try adjusting your filters or search query.</p>
    </div>`
    return
  }

  listEl.innerHTML = list.map((c, i) => {
    const name    = c.member_name ?? 'Unknown'
    const avBg    = avatarColor(name)
    const init    = initials(name)
    const delay   = Math.min(i * 35, 420)
    const isActive = _activeCase?.id === c.id
    return `<div class="pc-case-row p-${c.priority}${isActive ? ' selected' : ''}"
      data-case-id="${c.id}" style="animation-delay:${delay}ms;">
      <div class="pc-row-avatar" style="background:${avBg};">${init}</div>
      <div class="pc-row-body">
        <div class="pc-row-top">
          <div class="pc-row-title">${c.title}${c.is_private
            ? `<span class="pc-badge pc-private-badge" style="margin-left:6px;"><i class="bi bi-lock-fill" style="font-size:9px;"></i>Private</span>`
            : ''}</div>
          <span class="pc-row-id">${c.id.slice(0, 8)}</span>
        </div>
        <div class="pc-row-meta">
          <span class="pc-row-member">${name}</span>
          <span class="pc-row-dot"></span>
          ${typeBadge(c.case_type)}
          <span class="pc-row-dot"></span>
          ${priorityBadge(c.priority)}
          ${statusBadge(c.status)}
          <span class="pc-row-dot"></span>
          <span class="pc-row-date">${daysAgo(c.created_at)}</span>
        </div>
      </div>
      <div class="pc-row-right">
        <div class="pc-row-actions">
          <button class="pc-row-btn" data-row-view="${c.id}">
            <i class="bi bi-eye"></i><span class="pc-crb-lbl">View</span>
          </button>
          ${canManage ? `
          <button class="pc-row-btn primary" data-row-log="${c.id}">
            <i class="bi bi-plus-circle"></i><span class="pc-crb-lbl">Log Visit</span>
          </button>` : ''}
        </div>
      </div>
    </div>`
  }).join('')

  // Bind row events
  listEl.querySelectorAll<HTMLElement>('[data-case-id]').forEach(row => {
    row.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('[data-row-view],[data-row-log]')) return
      _selectCase(row.dataset['caseId']!)
    })
  })
  listEl.querySelectorAll<HTMLElement>('[data-row-view]').forEach(btn => {
    btn.addEventListener('click', () => _selectCase(btn.dataset['rowView']!))
  })
  listEl.querySelectorAll<HTMLElement>('[data-row-log]').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectCase(btn.dataset['rowLog']!)
      _openVisitModal()
    })
  })
}

function _selectCase(id: string): void {
  _activeCase = _cases.find(c => c.id === id) ?? null
  _renderCases()       // re-renders to update selected state
  _renderDetailPanel()
}

function _renderDetailPanel(): void {
  const dpEl = _container?.querySelector<HTMLElement>('#pc-detail-panel')
  if (!dpEl) return
  const user = getCurrentUser()
  const canManage = user && can(user, PERMISSIONS.PASTORAL_MANAGE)

  if (!_activeCase) {
    dpEl.innerHTML = `<div class="pc-dp-empty">
      <i class="bi bi-search"></i>
      <p>Select a case</p>
      <span>Click any case to view details and visit history.</span>
    </div>`
    return
  }

  const c    = _activeCase
  const name = c.member_name ?? 'Unknown'
  const avBg = avatarColor(name)
  const init = initials(name)
  const isResolved = c.status === 'resolved' || c.status === 'closed'
  const lastUpdated = c.resolved_at || (c.visits.length > 0 ? c.visits[0].created_at : c.created_at)

  dpEl.innerHTML = /* html */`
    <div class="pc-dp-header">
      <div class="pc-row-avatar" style="width:40px;height:40px;font-size:13px;background:${avBg};border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-shrink:0;">${init}</div>
      <div class="pc-dp-header-body">
        <div class="pc-dp-title">${c.title}</div>
        <div class="pc-dp-meta">
          ${typeBadge(c.case_type)}
          ${priorityBadge(c.priority)}
          ${statusBadge(c.status)}
          ${c.is_private ? `<span class="pc-badge pc-private-badge"><i class="bi bi-lock-fill" style="font-size:9px;"></i>Private</span>` : ''}
        </div>
      </div>
    </div>

    <div class="pc-dp-body">
      <div class="pc-dp-section">
        <div class="pc-dp-sect-lbl">Case Details</div>
        <div class="pc-dp-field">
          <span class="pc-dp-field-lbl">Member</span>
          <span class="pc-dp-field-val">${name}</span>
        </div>
        ${c.assigned_name ? `<div class="pc-dp-field">
          <span class="pc-dp-field-lbl">Assigned To</span>
          <span class="pc-dp-field-val">${c.assigned_name}</span>
        </div>` : ''}
        <div class="pc-dp-field">
          <span class="pc-dp-field-lbl">Opened</span>
          <span class="pc-dp-field-val">${fmtDate(c.created_at)}</span>
        </div>
        <div class="pc-dp-field">
          <span class="pc-dp-field-lbl">Last Updated</span>
          <span class="pc-dp-field-val">${fmtDate(lastUpdated)}</span>
        </div>
      </div>

      ${c.description ? `<div class="pc-dp-section">
        <div class="pc-dp-sect-lbl">Description</div>
        <p class="pc-dp-desc">${c.description}</p>
      </div>` : ''}

      <div class="pc-dp-section">
        <div class="pc-dp-sect-lbl">Visit History (${c.visits.length})</div>
        ${c.visits.length
          ? c.visits.map(v => {
              const oc = OUTCOME_CFG[v.outcome] ?? OUTCOME_CFG['no_response']
              const vi = VISIT_TYPE_ICON[v.visit_type] ?? 'bi-geo-alt-fill'
              return `<div class="pc-visit-item">
                <div class="pc-visit-dot"><i class="bi ${vi}"></i></div>
                <div class="pc-visit-content">
                  <div class="pc-visit-type">${v.visit_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                  <div class="pc-visit-meta">By ${v.actor_name ?? 'Unknown'} · ${fmtDate(v.visit_date)}</div>
                  ${v.notes ? `<div class="pc-visit-notes">${v.notes}</div>` : ''}
                  <span class="pc-visit-outcome ${oc.cls}">${oc.label}</span>
                </div>
              </div>`
            }).join('')
          : `<p style="font-size:12px;color:var(--text-muted);padding:6px 0;">No visits logged yet.</p>`
        }
      </div>
    </div>

    ${canManage ? `<div class="pc-dp-footer">
      <button class="pc-dp-btn" id="pc-dp-log-btn"><i class="bi bi-plus-circle"></i> Log Visit</button>
      <button class="pc-dp-btn primary" id="pc-dp-resolve-btn" ${isResolved ? 'disabled' : ''}>
        <i class="bi bi-check-circle"></i> ${isResolved ? 'Resolved' : 'Resolve'}
      </button>
    </div>` : ''}
  `

  // Bind detail panel actions
  dpEl.querySelector('#pc-dp-log-btn')?.addEventListener('click', () => _openVisitModal())
  dpEl.querySelector('#pc-dp-resolve-btn')?.addEventListener('click', () => _resolveCase())
}

async function _resolveCase(): Promise<void> {
  if (!_activeCase || _activeCase.status === 'resolved') return
  const btn = _container?.querySelector<HTMLButtonElement>('#pc-dp-resolve-btn')
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="pc-spinner"></span> Resolving…` }

  const { error } = await supabase
    .from('pastoral_cases')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', _activeCase.id)

  if (error) {
    _toast('error', 'Failed to resolve case.')
    if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-check-circle"></i> Resolve` }
    return
  }
  _toast('success', 'Case marked as resolved.')
  await _loadCases()
  _activeCase = _cases.find(c => c.id === _activeCase?.id) ?? null
  _renderStats()
  _renderCases()
  _renderDetailPanel()
}

// ── Prayer rendering ──────────────────────────────────────────────────────────
function _filteredPrayers(): PrayerWithMember[] {
  const q = _prayerSearch.toLowerCase()
  let list = _prayers.filter(p => {
    const searchOk = !q || p.title.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)
    const statusOk = _prayerStatus === 'all'
      || (_prayerStatus === 'answered' && p.is_answered)
      || (_prayerStatus === 'active'   && !p.is_answered && p.status === 'active')
      || (_prayerStatus === 'closed'   && p.status === 'closed')
    return searchOk && statusOk
  })
  if (_prayerSort === 'oldest') list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  else if (_prayerSort === 'answered_last') list.sort((a, b) => (a.is_answered ? 1 : 0) - (b.is_answered ? 1 : 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  else list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return list
}

function _renderPrayers(): void {
  const list    = _filteredPrayers()
  const countEl = _container?.querySelector<HTMLElement>('#pc-prayer-count')
  const ansEl   = _container?.querySelector<HTMLElement>('#pc-answered-summary')
  const gridEl  = _container?.querySelector<HTMLElement>('#pc-prayer-grid')
  if (!gridEl) return
  if (countEl) countEl.textContent = String(list.length)
  const answered = _prayers.filter(p => p.is_answered).length
  if (ansEl) ansEl.textContent = `${answered} answered`

  const user = getCurrentUser()
  const canManage = user && can(user, PERMISSIONS.PASTORAL_PRAYER_MANAGE)

  if (!list.length) {
    gridEl.innerHTML = `<div class="pc-empty" style="grid-column:1/-1;">
      <i class="bi bi-heart"></i><h3>No prayer requests found</h3>
      <p>Try adjusting your filters or submit a new request.</p>
    </div>`
    return
  }

  gridEl.innerHTML = list.map((p, i) => {
    const delay = Math.min(i * 40, 480)
    const name  = p.is_anonymous ? null : p.member_name
    const avBg  = name ? avatarColor(name) : null
    const init  = name ? initials(name) : null
    return `<div class="pc-prayer-card${p.is_answered ? ' answered' : ''}" style="animation-delay:${delay}ms;" data-prayer-id="${p.id}">
      <div class="pc-prayer-header">
        <div class="pc-prayer-title">${p.title}</div>
        ${prayerStatusBadge(p.status, p.is_answered)}
      </div>
      ${p.description ? `<div class="pc-prayer-desc">${p.description}</div>` : ''}
      <div class="pc-prayer-footer">
        <div>
          ${p.is_anonymous || !name
            ? `<span class="pc-prayer-anon"><i class="bi bi-person-slash" style="font-size:11px;"></i>Anonymous</span>`
            : `<div class="pc-prayer-member">
                <div class="pc-mini-av-sm" style="background:${avBg};">${init}</div>
                <span>${name}</span>
              </div>`
          }
          <div class="pc-prayer-date">${fmtDate(p.created_at)}</div>
        </div>
        ${canManage
          ? p.is_answered
            ? `<div class="pc-prayer-answered-tag"><i class="bi bi-check-circle-fill" style="font-size:14px;"></i>Answered</div>`
            : `<button class="pc-prayer-answered-btn" data-mark-answered="${p.id}">
                <i class="bi bi-check-circle"></i>
                <span class="pc-pab-lbl">Mark Answered</span>
              </button>`
          : ''
        }
      </div>
    </div>`
  }).join('')

  gridEl.querySelectorAll<HTMLElement>('[data-mark-answered]').forEach(btn => {
    btn.addEventListener('click', () => _markAnswered(btn.dataset['markAnswered']!))
  })
}

async function _markAnswered(id: string): Promise<void> {
  const btn = _container?.querySelector<HTMLElement>(`[data-mark-answered="${id}"]`)
  if (btn) { btn.innerHTML = `<span class="pc-spinner dark"></span>`; (btn as HTMLButtonElement).disabled = true }

  const { error } = await supabase
    .from('prayer_requests')
    .update({ status: 'answered', is_answered: true, answered_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    _toast('error', 'Failed to update prayer request.')
    return
  }
  _toast('success', 'Praise God! Marked as answered.')
  await _loadPrayers()
  _renderStats()
  _renderPrayers()
}

// ── Open New Case Modal ───────────────────────────────────────────────────────
function _openCaseModal(): void {
  const modal = _container?.querySelector<HTMLElement>('#pc-case-modal')
  if (!modal) return
  // Reset form
  modal.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select')
    .forEach(el => { if (el.type === 'checkbox') (el as HTMLInputElement).checked = false; else el.value = el.tagName === 'SELECT' ? (el as HTMLSelectElement).options[0]?.value ?? '' : '' })
  modal.querySelector<HTMLInputElement>('#pc-cm-priority')
    && ((modal.querySelector<HTMLSelectElement>('#pc-cm-priority')!).value = 'medium')
  modal.querySelector<HTMLElement>('#pc-cm-title-err')?.classList.remove('show')
  modal.querySelector<HTMLElement>('#pc-cm-member-err')?.classList.remove('show')
  modal.classList.add('open')
  setTimeout(() => modal.querySelector<HTMLInputElement>('#pc-cm-title')?.focus(), 80)
}

async function _submitCase(): Promise<void> {
  const modal   = _container?.querySelector<HTMLElement>('#pc-case-modal')
  if (!modal) return
  const memberId  = modal.querySelector<HTMLSelectElement>('#pc-cm-member')?.value
  const title     = modal.querySelector<HTMLInputElement>('#pc-cm-title')?.value.trim()
  const caseType  = modal.querySelector<HTMLSelectElement>('#pc-cm-type')?.value
  const priority  = modal.querySelector<HTMLSelectElement>('#pc-cm-priority')?.value
  const assignedId = modal.querySelector<HTMLSelectElement>('#pc-cm-assigned')?.value || null
  const desc      = modal.querySelector<HTMLTextAreaElement>('#pc-cm-desc')?.value.trim()
  const isPrivate = modal.querySelector<HTMLInputElement>('#pc-cm-private')?.checked ?? false
  const saveBtn   = modal.querySelector<HTMLButtonElement>('#pc-cm-save')

  let valid = true
  if (!memberId) {
    modal.querySelector<HTMLElement>('#pc-cm-member-err')?.classList.add('show'); valid = false
  } else {
    modal.querySelector<HTMLElement>('#pc-cm-member-err')?.classList.remove('show')
  }
  if (!title) {
    modal.querySelector<HTMLElement>('#pc-cm-title-err')?.classList.add('show'); valid = false
  } else {
    modal.querySelector<HTMLElement>('#pc-cm-title-err')?.classList.remove('show')
  }
  if (!valid) return

  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) return

  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = `<span class="pc-spinner"></span> Creating…` }

  const { error } = await supabase.from('pastoral_cases').insert({
    assembly_id:  assemblyId,
    member_id:    memberId!,
    case_type:    caseType as any,
    title:        title!,
    description:  desc || null,
    priority:     priority as any,
    assigned_to:  assignedId,
    is_private:   isPrivate,
    status:       'open',
  })

  if (error) {
    _toast('error', error.message ?? 'Failed to create case.')
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = `<i class="bi bi-plus-circle"></i> Create Case` }
    return
  }

  modal.classList.remove('open')
  _toast('success', 'Case created successfully.')
  await _loadCases()
  _renderStats()
  _renderCases()
}

// ── Open Log Visit Modal ──────────────────────────────────────────────────────
function _openVisitModal(): void {
  if (!_activeCase) { _toast('error', 'Please select a case first.'); return }
  const modal = _container?.querySelector<HTMLElement>('#pc-visit-modal')
  if (!modal) return
  modal.querySelector<HTMLInputElement>('#pc-vm-date')!.value = new Date().toISOString().slice(0, 10)
  modal.querySelector<HTMLTextAreaElement>('#pc-vm-notes')!.value = ''
  modal.querySelector<HTMLElement>('#pc-vm-case-title')!.textContent = _activeCase.title
  modal.classList.add('open')
}

async function _submitVisit(): Promise<void> {
  if (!_activeCase) return
  const modal   = _container?.querySelector<HTMLElement>('#pc-visit-modal')
  if (!modal) return
  const visitType  = modal.querySelector<HTMLSelectElement>('#pc-vm-type')!.value
  const visitDate  = modal.querySelector<HTMLInputElement>('#pc-vm-date')!.value
  const notes      = modal.querySelector<HTMLTextAreaElement>('#pc-vm-notes')!.value.trim()
  const outcome    = modal.querySelector<HTMLSelectElement>('#pc-vm-outcome')!.value
  const user       = getCurrentUser()
  const saveBtn    = modal.querySelector<HTMLButtonElement>('#pc-vm-save')

  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = `<span class="pc-spinner"></span> Logging…` }

  // Insert visit
  const { error: vErr } = await supabase.from('pastoral_visits').insert({
    case_id:    _activeCase.id,
    member_id:  _activeCase.member_id,
    visited_by: user!.id,
    visit_type: visitType as any,
    visit_date: visitDate,
    notes:      notes || null,
    outcome:    outcome as any,
  })

  if (vErr) {
    _toast('error', vErr.message ?? 'Failed to log visit.')
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = `<i class="bi bi-plus-circle"></i> Log Visit` }
    return
  }

  // If case was 'open', move to 'in_progress'
  if (_activeCase.status === 'open') {
    await supabase.from('pastoral_cases').update({ status: 'in_progress' }).eq('id', _activeCase.id)
  }

  modal.classList.remove('open')
  _toast('success', 'Visit logged successfully.')
  await _loadCases()
  _activeCase = _cases.find(c => c.id === _activeCase?.id) ?? null
  _renderStats()
  _renderCases()
  _renderDetailPanel()
}

// ── Open Prayer Modal ─────────────────────────────────────────────────────────
function _openPrayerModal(): void {
  const modal = _container?.querySelector<HTMLElement>('#pc-prayer-modal')
  if (!modal) return
  modal.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select')
    .forEach(el => { if (el.type === 'checkbox') (el as HTMLInputElement).checked = false; else el.value = '' })
  modal.querySelector<HTMLElement>('#pc-pm-title-err')?.classList.remove('show')
  modal.classList.add('open')
  setTimeout(() => modal.querySelector<HTMLInputElement>('#pc-pm-title')?.focus(), 80)
}

async function _submitPrayer(): Promise<void> {
  const modal   = _container?.querySelector<HTMLElement>('#pc-prayer-modal')
  if (!modal) return
  const title     = modal.querySelector<HTMLInputElement>('#pc-pm-title')?.value.trim()
  const desc      = modal.querySelector<HTMLTextAreaElement>('#pc-pm-desc')?.value.trim()
  const memberId  = modal.querySelector<HTMLSelectElement>('#pc-pm-member')?.value || null
  const isAnon    = modal.querySelector<HTMLInputElement>('#pc-pm-anon')?.checked ?? false
  const saveBtn   = modal.querySelector<HTMLButtonElement>('#pc-pm-save')

  if (!title) {
    modal.querySelector<HTMLElement>('#pc-pm-title-err')?.classList.add('show')
    return
  }
  modal.querySelector<HTMLElement>('#pc-pm-title-err')?.classList.remove('show')

  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) return

  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = `<span class="pc-spinner"></span> Submitting…` }

  const { error } = await supabase.from('prayer_requests').insert({
    assembly_id:  assemblyId,
    member_id:    isAnon ? null : (memberId || null),
    title:        title!,
    description:  desc || null,
    is_anonymous: isAnon,
    status:       'active',
    is_answered:  false,
  })

  if (error) {
    _toast('error', error.message ?? 'Failed to submit prayer request.')
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = `<i class="bi bi-heart"></i> Submit Request` }
    return
  }

  modal.classList.remove('open')
  _toast('success', 'Prayer request submitted.')
  await _loadPrayers()
  _renderStats()
  _renderPrayers()
}

// ── Member search for modals ──────────────────────────────────────────────────
async function _populateMemberSelects(): Promise<void> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) return

  const { data } = await supabase
    .from('members_view')
    .select('id, first_name, last_name')
    .eq('assembly_id', assemblyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('last_name', { ascending: true })
    .limit(200)

  const members = (data ?? []) as Array<{ id: string; first_name: string; last_name: string }>
  const opts = members.map(m => `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`).join('')
  const placeholder = `<option value="">Select member…</option>`

  _container?.querySelectorAll<HTMLSelectElement>('.pc-member-select').forEach(sel => {
    sel.innerHTML = placeholder + opts
  })
}

async function _populateUserSelects(): Promise<void> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) return
  const { data } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .eq('assembly_id', assemblyId)
    .eq('is_active', true)
    .order('full_name', { ascending: true })
    .limit(50)

  const users = (data ?? []) as Array<{ id: string; full_name: string }>
  const currentUser = getCurrentUser()
  const opts = users.map(u =>
    `<option value="${u.id}" ${u.id === currentUser?.id ? 'selected' : ''}>${u.full_name}</option>`
  ).join('')

  _container?.querySelectorAll<HTMLSelectElement>('.pc-user-select').forEach(sel => {
    sel.innerHTML = opts
  })
}

// ── Main render ───────────────────────────────────────────────────────────────
export function createPastoralTab(): WorkspaceTab {
  return {
    id: 'pastoral',
    label: 'Pastoral Care',
    icon: 'heart-fill',

    async render(container: HTMLElement): Promise<void> {
    _destroyed    = false
    _container    = container
    _activeView   = 'cases'
    _activeCase   = null
    _caseSearch   = ''
    _caseType     = 'all'
    _caseStatus   = 'all'
    _caseSort     = 'newest'
    _prayerSearch = ''
    _prayerStatus = 'all'
    _prayerSort   = 'newest'

    _injectCSS()
    renderSkeleton(container, 'table')

    const user = getCurrentUser()
    const canManage      = user && can(user, PERMISSIONS.PASTORAL_MANAGE)
    const canPrayerMgmt  = user && can(user, PERMISSIONS.PASTORAL_PRAYER_MANAGE)

    try {
      await Promise.all([_loadCases(), _loadPrayers()])
    } catch (err) {
      renderError(container, err, { retry: () => PastoralCare.render(container) })
      return
    }
    if (_destroyed) return

    container.innerHTML = /* html */`
    <div class="pc-page">

      <!-- Breadcrumbs -->
      <div id="pc-breadcrumbs"></div>

      <!-- Header -->
      <div class="pc-page-header">
        <div>
          <h1 class="pc-page-title">Pastoral Care</h1>
          <p class="pc-page-sub">Track pastoral cases, visits, and prayer requests</p>
        </div>
      </div>

      <!-- Stat cards -->
      <div class="pc-stats-row"></div>

      <!-- Sub nav -->
      <div class="pc-subnav">
        <button class="pc-snav-btn active" data-view="cases">
          <i class="bi bi-folder-fill" style="font-size:14px;"></i>
          <span class="pc-snav-tab-lbl">Pastoral Cases</span>
          <span class="pc-snav-count" id="pc-sn-cases">${_cases.length}</span>
        </button>
        <button class="pc-snav-btn" data-view="prayers">
          <i class="bi bi-heart-fill" style="font-size:14px;"></i>
          <span class="pc-snav-tab-lbl">Prayer Requests</span>
          <span class="pc-snav-count" id="pc-sn-prayers">${_prayers.length}</span>
        </button>
        <div class="pc-snav-actions">
          ${canManage || canPrayerMgmt ? `
          <button class="btn btn-primary" id="pc-add-btn" style="height:34px;font-size:13px;">
            <i class="bi bi-plus-lg"></i>
            <span class="pc-btn-lbl">New Case</span>
          </button>` : ''}
        </div>
      </div>

      <!-- ═══ CASES VIEW ═══ -->
      <div class="pc-view active" id="pc-view-cases">

        <!-- Toolbar -->
        <div class="pc-toolbar">
          <div class="pc-search-wrap">
            <i class="bi bi-search"></i>
            <input type="text" id="pc-case-search" placeholder="Search cases or members…" autocomplete="off">
          </div>
          <div style="flex: 1;"></div>
          <div class="pc-toolbar-actions">
            <select class="pc-sel" id="pc-type-filter" style="min-width:132px;">
              <option value="all">All Types</option>
              <option value="follow_up">Follow Up</option>
              <option value="bereavement">Bereavement</option>
              <option value="illness">Illness</option>
              <option value="counselling">Counselling</option>
              <option value="discipline">Discipline</option>
              <option value="other">Other</option>
            </select>
            <select class="pc-sel" id="pc-status-filter" style="min-width:128px;">
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <div class="pc-sort-wrap">
              <i class="bi bi-arrow-down-up"></i>
              <select class="pc-sel with-icon" id="pc-case-sort" style="min-width:140px;">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="priority">By Priority</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Filter bar -->
        <div class="pc-filter-bar" id="pc-filter-bar" style="display:flex;">
          <i class="bi bi-funnel" style="font-size:14px;color:var(--text-muted);"></i>
          <span style="font-size:13px;color:var(--text-secondary);">Filtered by</span>
          <span class="pc-filter-chip"><i class="bi bi-folder-fill" style="font-size:11px;"></i> All Cases</span>
          <button class="pc-filter-clear" id="pc-clear-filters">
            <i class="bi bi-x"></i> Clear
          </button>
        </div>

        <div class="pc-results-bar">Showing <strong id="pc-case-count">0</strong> cases</div>

        <!-- Split layout -->
        <div class="pc-cases-layout">
          <div class="pc-case-list">
            <div class="pc-case-list-header">
              <span class="pc-case-list-title" id="pc-case-group-title">All Cases</span>
              <div style="display:flex;align-items:center;gap:12px;">
                <span class="pc-case-list-meta" id="pc-case-group-meta">0 cases</span>
                <button class="pc-case-list-clear" id="pc-clear-filters-2">× Clear</button>
              </div>
            </div>
            <div id="pc-cases-list"></div>
          </div>
          <div class="pc-detail-panel" id="pc-detail-panel">
            <div class="pc-dp-empty">
              <i class="bi bi-search" style="font-size:2.5rem;color:var(--border-strong);margin-bottom:12px;"></i>
              <p>Select a case</p>
              <span style="font-size:12px;color:var(--text-muted);">Click any case to view details and visit history.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ PRAYERS VIEW ═══ -->
      <div class="pc-view" id="pc-view-prayers">
        <div class="pc-toolbar">
          <div class="pc-search-wrap">
            <i class="bi bi-search"></i>
            <input type="text" id="pc-prayer-search" placeholder="Search prayer requests…" autocomplete="off">
          </div>
          <div style="flex: 1;"></div>
          <div class="pc-toolbar-actions">
            <select class="pc-sel" id="pc-prayer-status" style="min-width:140px;">
              <option value="all">All Requests</option>
              <option value="active">Active</option>
              <option value="answered">Answered</option>
              <option value="closed">Closed</option>
            </select>
            <div class="pc-sort-wrap">
              <i class="bi bi-arrow-down-up"></i>
              <select class="pc-sel with-icon" id="pc-prayer-sort" style="min-width:140px;">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="answered_last">Answered Last</option>
              </select>
            </div>
          </div>
        </div>
        <div class="pc-results-bar">
          Showing <strong id="pc-prayer-count">0</strong> prayer requests ·
          <span style="color:var(--green);" id="pc-answered-summary">0 answered</span>
        </div>
        <div class="pc-prayer-grid" id="pc-prayer-grid"></div>
      </div>

    </div>

    <!-- ══ NEW CASE MODAL ══ -->
    <div class="pc-modal-backdrop" id="pc-case-modal">
      <div class="pc-modal">
        <div class="pc-modal-head">
          <span class="pc-modal-title">Log New Case</span>
          <button class="pc-modal-close" data-close="pc-case-modal"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="pc-modal-body">
          <div class="pc-form-row">
            <div class="pc-form-group">
              <label class="pc-form-label">Member *</label>
              <select class="pc-form-input pc-member-select" id="pc-cm-member"></select>
              <span class="pc-field-err" id="pc-cm-member-err">Please select a member.</span>
            </div>
            <div class="pc-form-group">
              <label class="pc-form-label">Assigned To</label>
              <select class="pc-form-input pc-user-select" id="pc-cm-assigned"></select>
            </div>
          </div>
          <div class="pc-form-group full">
            <label class="pc-form-label">Case Title *</label>
            <input class="pc-form-input" id="pc-cm-title" placeholder="Brief description of the case…" maxlength="200">
            <span class="pc-field-err" id="pc-cm-title-err">Title is required.</span>
          </div>
          <div class="pc-form-row">
            <div class="pc-form-group">
              <label class="pc-form-label">Case Type</label>
              <select class="pc-form-input" id="pc-cm-type">
                <option value="follow_up">Follow Up</option>
                <option value="bereavement">Bereavement</option>
                <option value="illness">Illness</option>
                <option value="counselling">Counselling</option>
                <option value="discipline">Discipline</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="pc-form-group">
              <label class="pc-form-label">Priority</label>
              <select class="pc-form-input" id="pc-cm-priority">
                <option value="urgent">🔴 Urgent</option>
                <option value="high">🟠 High</option>
                <option value="medium" selected>🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
          </div>
          <div class="pc-form-group full">
            <label class="pc-form-label">Description</label>
            <textarea class="pc-form-input" id="pc-cm-desc" rows="3" placeholder="Provide case details…"></textarea>
          </div>
          <label class="pc-form-check">
            <input type="checkbox" id="pc-cm-private"> Mark as private (only visible to assigned pastor)
          </label>
        </div>
        <div class="pc-modal-foot">
          <button class="pc-modal-btn" data-close="pc-case-modal">Cancel</button>
          <button class="pc-modal-btn primary" id="pc-cm-save">
            <i class="bi bi-plus-circle"></i> Create Case
          </button>
        </div>
      </div>
    </div>

    <!-- ══ LOG VISIT MODAL ══ -->
    <div class="pc-modal-backdrop" id="pc-visit-modal">
      <div class="pc-modal">
        <div class="pc-modal-head">
          <span class="pc-modal-title">Log a Visit</span>
          <button class="pc-modal-close" data-close="pc-visit-modal"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="pc-modal-body">
          <div style="font-size:12px;color:var(--text-secondary);padding:8px 12px;
            background:var(--bg-info);border:1px solid rgba(0,75,160,.15);border-radius:var(--radius-sm);
            display:flex;align-items:center;gap:6px;">
            <i class="bi bi-folder-fill" style="color:var(--caci-blue-light);"></i>
            Case: <strong id="pc-vm-case-title" style="color:var(--text-primary);"></strong>
          </div>
          <div class="pc-form-row">
            <div class="pc-form-group">
              <label class="pc-form-label">Visit Type</label>
              <select class="pc-form-input" id="pc-vm-type">
                <option value="home_visit">Home Visit</option>
                <option value="hospital_visit">Hospital Visit</option>
                <option value="phone_call">Phone Call</option>
                <option value="video_call">Video Call</option>
                <option value="in_person">In Person (Church)</option>
              </select>
            </div>
            <div class="pc-form-group">
              <label class="pc-form-label">Visit Date</label>
              <input type="date" class="pc-form-input" id="pc-vm-date">
            </div>
          </div>
          <div class="pc-form-group">
            <label class="pc-form-label">Outcome</label>
            <select class="pc-form-input" id="pc-vm-outcome">
              <option value="positive">Improving</option>
              <option value="needs_follow_up">Follow-up Needed</option>
              <option value="no_response">No Response</option>
              <option value="referred">Referred</option>
            </select>
          </div>
          <div class="pc-form-group full">
            <label class="pc-form-label">Notes</label>
            <textarea class="pc-form-input" id="pc-vm-notes" rows="3" placeholder="Visit notes…"></textarea>
          </div>
        </div>
        <div class="pc-modal-foot">
          <button class="pc-modal-btn" data-close="pc-visit-modal">Cancel</button>
          <button class="pc-modal-btn primary" id="pc-vm-save">
            <i class="bi bi-plus-circle"></i> Log Visit
          </button>
        </div>
      </div>
    </div>

    <!-- ══ PRAYER MODAL ══ -->
    <div class="pc-modal-backdrop" id="pc-prayer-modal">
      <div class="pc-modal">
        <div class="pc-modal-head">
          <span class="pc-modal-title">New Prayer Request</span>
          <button class="pc-modal-close" data-close="pc-prayer-modal"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="pc-modal-body">
          <div class="pc-form-row">
            <div class="pc-form-group">
              <label class="pc-form-label">Member</label>
              <select class="pc-form-input pc-member-select" id="pc-pm-member"></select>
            </div>
          </div>
          <div class="pc-form-group full">
            <label class="pc-form-label">Title *</label>
            <input class="pc-form-input" id="pc-pm-title" placeholder="Brief title for the request…" maxlength="200">
            <span class="pc-field-err" id="pc-pm-title-err">Title is required.</span>
          </div>
          <div class="pc-form-group full">
            <label class="pc-form-label">Description</label>
            <textarea class="pc-form-input" id="pc-pm-desc" rows="3" placeholder="Describe the prayer need…"></textarea>
          </div>
          <label class="pc-form-check">
            <input type="checkbox" id="pc-pm-anon"> Submit anonymously
          </label>
        </div>
        <div class="pc-modal-foot">
          <button class="pc-modal-btn" data-close="pc-prayer-modal">Cancel</button>
          <button class="pc-modal-btn primary" id="pc-pm-save">
            <i class="bi bi-heart"></i> Submit Request
          </button>
        </div>
      </div>
    </div>
    `

    // Breadcrumbs
    renderBreadcrumbs(container.querySelector<HTMLElement>('#pc-breadcrumbs')!, [
      { label: 'Pastoral Care' },
    ])

    // Stats
    _renderStats()

    // Initial content renders
    _renderCases()
    _renderPrayers()

    // Populate member/user selects in modals
    await Promise.all([_populateMemberSelects(), _populateUserSelects()])

    // ── Bind all events ──

    // Sub-nav tabs
    container.querySelectorAll<HTMLElement>('.pc-snav-btn').forEach(btn => {
      btn.addEventListener('click', () => _switchView(btn.dataset['view'] as 'cases' | 'prayers'))
    })

    // Add button (cases view by default)
    container.querySelector('#pc-add-btn')?.addEventListener('click', () => {
      if (_activeView === 'prayers') _openPrayerModal()
      else _openCaseModal()
    })

    // Cases toolbar
    const caseSearchEl = container.querySelector<HTMLInputElement>('#pc-case-search')!
    const debSearch = debounce((q: string) => {
      _caseSearch = q; _renderCases()
    }, 220)
    caseSearchEl?.addEventListener('input', () => debSearch(caseSearchEl.value))

    container.querySelector('#pc-type-filter')?.addEventListener('change', e => {
      _caseType = (e.target as HTMLSelectElement).value; _renderCases()
    })
    container.querySelector('#pc-status-filter')?.addEventListener('change', e => {
      _caseStatus = (e.target as HTMLSelectElement).value; _renderCases()
    })
    container.querySelector('#pc-case-sort')?.addEventListener('change', e => {
      _caseSort = (e.target as HTMLSelectElement).value; _renderCases()
    })

    const clearFilters = () => {
      _caseSearch = ''; _caseType = 'all'; _caseStatus = 'all'
      if (caseSearchEl) caseSearchEl.value = ''
      const tf = container.querySelector<HTMLSelectElement>('#pc-type-filter'); if (tf) tf.value = 'all'
      const sf = container.querySelector<HTMLSelectElement>('#pc-status-filter'); if (sf) sf.value = 'all'
      _renderCases()
    }
    container.querySelector('#pc-clear-filters')?.addEventListener('click', clearFilters)
    container.querySelector('#pc-clear-filters-2')?.addEventListener('click', clearFilters)

    // Prayers toolbar
    const prayerSearchEl = container.querySelector<HTMLInputElement>('#pc-prayer-search')!
    const debPrayerSearch = debounce((q: string) => {
      _prayerSearch = q; _renderPrayers()
    }, 220)
    prayerSearchEl?.addEventListener('input', () => debPrayerSearch(prayerSearchEl.value))
    container.querySelector('#pc-prayer-status')?.addEventListener('change', e => {
      _prayerStatus = (e.target as HTMLSelectElement).value; _renderPrayers()
    })
    container.querySelector('#pc-prayer-sort')?.addEventListener('change', e => {
      _prayerSort = (e.target as HTMLSelectElement).value; _renderPrayers()
    })

    // Modal close buttons
    container.querySelectorAll<HTMLElement>('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelector<HTMLElement>(`#${btn.dataset['close']}`)?.classList.remove('open')
      })
    })
    container.querySelectorAll<HTMLElement>('.pc-modal-backdrop').forEach(bd => {
      bd.addEventListener('click', e => { if (e.target === bd) bd.classList.remove('open') })
    })

    // Modal save buttons
    container.querySelector('#pc-cm-save')?.addEventListener('click', () => _submitCase())
    container.querySelector('#pc-vm-save')?.addEventListener('click', () => _submitVisit())
    container.querySelector('#pc-pm-save')?.addEventListener('click', () => _submitPrayer())

    // Keyboard
    const _onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') container.querySelectorAll('.pc-modal-backdrop').forEach(m => m.classList.remove('open'))
    }
    document.addEventListener('keydown', _onKey)
    ;(container as any)._pcKeyHandler = _onKey
  },

  destroy(): void {
    _destroyed    = false
    _container    = null
    _cases        = []
    _prayers      = []
    _activeCase   = null
    const handler = (_container as any)?._pcKeyHandler
    if (handler) document.removeEventListener('keydown', handler)
    document.getElementById('pc-toast')?.remove()
  },
 }
}