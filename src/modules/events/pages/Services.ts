// src/modules/events_&_services/pages/Services.ts
// Services & Events workspace — single PageModule, tab-based.

import type { PageModule } from '../../../types/module.types'
import { getCurrentUser }  from '@core/auth'
import { on, off }         from '@core/events'

const SVC_CSS = `
/* ══════════════════════════════════════════════════════
   SERVICES PAGE — scoped under .svc-page
   Mirrors Groups.ts / Accounts design language exactly
══════════════════════════════════════════════════════ */

/* ── Page wrapper ── */
.svc-page {
  padding: var(--space-xl) var(--space-2xl);
  max-width: 1400px;
  font-family: var(--font-sans);
  margin: 0 auto;
}
@media (max-width: 640px) {
  .svc-page { padding: var(--space-lg) var(--space-md); }
}


/* ── Tab bar ── */
.svc-tab-bar {
  display: inline-flex; align-items: center;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 999px; padding: 4px; gap: 2px;
  overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.35);
  scroll-behavior: smooth; margin-bottom: var(--space-xl);
}
.svc-tab-bar::-webkit-scrollbar { display: none; }
.svc-tab-bar-wrap {
  display: flex; justify-content: center;
  margin-bottom: var(--space-xl);
}
.svc-tab-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 8px 18px; border-radius: 999px; border: none;
  background: transparent; color: var(--text-secondary);
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
  white-space: nowrap; font-family: var(--font-sans); flex-shrink: 0;
}
.svc-tab-btn i { font-size: 15px; }
.svc-tab-btn:hover:not(.active) {
  color: var(--text-primary);
  background: rgba(255,255,255,0.04);
}
.svc-tab-btn.active {
  background: var(--bg-elevated, var(--bg-hover));
  color: var(--text-primary); font-weight: 600;
  box-shadow: 0 1px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
}
.svc-tab-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 20px; height: 18px; padding: 0 5px; border-radius: 99px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  font-size: 10px; font-weight: 600; color: var(--text-secondary); line-height: 1;
}
.svc-tab-btn.active .svc-tab-count {
  background: rgba(0,75,160,0.15); border-color: rgba(0,75,160,0.3);
  color: var(--caci-blue-light);
}
@media (max-width: 400px) {
  .svc-tab-btn { padding: 8px 10px; gap: 0; }
  .svc-tab-btn span.svc-tab-label { display: none; }
  .svc-tab-count { display: none; }
}

/* ── Stat cards row ── */
.svc-stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}
@media (max-width: 900px) { .svc-stats-row { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .svc-stats-row { grid-template-columns: 1fr 1fr; gap: var(--space-sm); } }

.svc-stat {
  background: linear-gradient(145deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  cursor: pointer; position: relative; overflow: hidden;
  transition: transform 0.22s cubic-bezier(0.16,1,0.3,1), box-shadow 0.22s, border-color 0.22s;
  user-select: none;
}
.svc-stat:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(0,0,0,0.22);
  border-color: var(--border-strong);
}
.svc-stat:active { transform: translateY(0) scale(0.98); }
.svc-stat.active-filter {
  border-width: 1.5px; border-color: var(--stat-accent);
  box-shadow: 0 0 0 3px var(--stat-glow), 0 8px 28px rgba(0,0,0,0.3);
  transform: translateY(-2px);
}
.svc-stat-icon-row {
  display: flex; align-items: center; gap: 10px; margin-bottom: var(--space-md);
}
.svc-stat-icon {
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.svc-stat-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.09em; color: var(--text-secondary);
}
.svc-stat-value {
  font-size: 28px; font-weight: 700; color: var(--text-primary);
  line-height: 1; display: flex; align-items: baseline; gap: 8px;
}
.svc-stat-sub { font-size: 11px; font-weight: 400; color: var(--text-secondary); }
.svc-stat-bar {
  margin-top: 10px; height: 2px; border-radius: 99px;
  background: var(--border-default); overflow: hidden;
}
.svc-stat-bar-fill {
  height: 100%; border-radius: 99px;
  transition: width 0.5s cubic-bezier(0.16,1,0.3,1);
}
.svc-stat-hint {
  position: absolute; top: 10px; right: 10px;
  font-size: 10px; color: var(--text-muted);
  opacity: 0; transition: opacity 0.2s;
  display: flex; align-items: center; gap: 3px;
}
.svc-stat:hover .svc-stat-hint { opacity: 1; }
.svc-stat.active-filter .svc-stat-hint { opacity: 0; }

/* ── Toolbar ── */
.svc-toolbar {
  display: flex; align-items: center; gap: var(--space-sm);
  background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); padding: 10px var(--space-md);
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  flex-wrap: wrap; margin-bottom: var(--space-md);
}
.svc-search-wrap {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); padding: 0 12px;
  height: 40px; flex: 1; min-width: 180px; max-width: 380px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.svc-search-wrap:focus-within {
  border-color: var(--caci-blue);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.svc-search-wrap i { font-size: 15px; color: var(--text-muted); flex-shrink: 0; transition: color 0.2s; }
.svc-search-wrap:focus-within i { color: var(--caci-blue); }
.svc-search-wrap input {
  background: transparent; border: none; outline: none;
  font-size: 13px; color: var(--text-primary);
  font-family: var(--font-sans); width: 100%; caret-color: var(--caci-blue);
}
.svc-search-wrap input::placeholder { color: var(--text-muted); }

.svc-filter-wrap { position: relative; display: flex; align-items: center; }
.svc-filter-wrap > i {
  position: absolute; left: 10px; font-size: 14px;
  color: var(--text-secondary); pointer-events: none; z-index: 1;
}
.svc-filter-select {
  appearance: none; -webkit-appearance: none;
  padding: 0 30px 0 28px; height: 40px; border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-page);
  color: var(--text-primary); font-size: 13px;
  font-family: var(--font-sans); font-weight: 500;
  cursor: pointer; outline: none; min-width: 150px;
  transition: border-color 0.2s, box-shadow 0.2s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center;
}
.svc-filter-select:focus {
  border-color: var(--caci-blue);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.svc-filter-select option { background: var(--bg-card); color: var(--text-primary); }

.svc-toolbar-actions {
  display: flex; align-items: center; gap: var(--space-sm);
  margin-left: auto;
}

.svc-tbtn {
  display: flex; align-items: center; gap: 6px;
  padding: 0 14px; height: 40px; border-radius: var(--radius-md);
  font-size: 13px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--border-default);
  background: var(--bg-page); color: var(--text-secondary);
  transition: all 0.18s cubic-bezier(0.16,1,0.3,1);
  white-space: nowrap; font-family: var(--font-sans);
}
.svc-tbtn i { font-size: 15px; }
.svc-tbtn:hover {
  border-color: var(--border-strong); color: var(--text-primary);
  transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.12);
}
.svc-tbtn-primary {
  background: linear-gradient(135deg, var(--caci-blue) 0%, var(--caci-blue-light) 100%);
  border-color: transparent; color: #fff; font-weight: 600;
  box-shadow: 0 2px 10px rgba(0,75,160,0.3);
}
.svc-tbtn-primary:hover {
  background: linear-gradient(135deg, var(--caci-blue-light) 0%, var(--caci-blue) 100%);
  box-shadow: 0 6px 20px rgba(0,75,160,0.45);
  border-color: transparent; color: #fff;
}
.svc-tbtn-icon {
  display: none; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: var(--radius-md);
  border: 1px solid var(--border-default); background: var(--bg-page);
  color: var(--text-secondary); cursor: pointer;
  transition: all 0.18s; font-size: 17px;
}
.svc-tbtn-icon:hover { border-color: var(--border-strong); color: var(--text-primary); }

@media (max-width: 860px) {
  .svc-btn-label { display: none; }
  .svc-tbtn { padding: 0 10px; }
  .svc-filter-select { min-width: 40px; width: 40px; padding: 0; color: transparent; background-image: none; }
  .svc-filter-wrap > i { left: 50%; transform: translateX(-50%); }
}
@media (max-width: 540px) {
  .svc-search-wrap { display: none; }
  .svc-search-wrap.open { display: flex; width: 100%; max-width: none; order: -1; }
  .svc-toolbar.search-open { flex-wrap: wrap; }
  .svc-tbtn-icon { display: flex; }
}

/* ── View toggle ── */
.svc-view-toggle {
  display: flex; border: 1px solid var(--border-default);
  border-radius: var(--radius-md); overflow: hidden; flex-shrink: 0;
}
.svc-view-btn {
  width: 40px; height: 40px; display: flex; align-items: center;
  justify-content: center; border: none; background: var(--bg-page);
  color: var(--text-muted); cursor: pointer; font-size: 15px;
  transition: background 0.15s, color 0.15s;
}
.svc-view-btn + .svc-view-btn { border-left: 1px solid var(--border-default); }
.svc-view-btn.active { background: var(--bg-hover); color: var(--text-primary); }
.svc-view-btn:hover:not(.active) { background: var(--bg-hover); color: var(--text-secondary); }

/* ── Filter banner ── */
.svc-filter-banner {
  display: none; align-items: center; gap: var(--space-sm);
  padding: 10px 14px; border-radius: var(--radius-md);
  background: rgba(0,75,160,0.06); border: 1px solid rgba(0,75,160,0.2);
  animation: svcSlideRight 0.32s cubic-bezier(0.16,1,0.3,1) both;
  margin-bottom: var(--space-sm);
}
.svc-filter-banner.show { display: flex; }
@keyframes svcSlideRight {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
.svc-filter-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 99px;
  background: rgba(0,75,160,0.14); border: 1px solid rgba(0,75,160,0.35);
  font-size: 12px; font-weight: 600; color: var(--caci-blue-light);
}
[data-theme="light"] .svc-filter-pill { color: var(--caci-blue); }
.svc-filter-clear {
  margin-left: auto; display: flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-default); background: transparent;
  color: var(--text-secondary); font-size: 12px;
  font-family: var(--font-sans); cursor: pointer; transition: all 0.18s;
}
.svc-filter-clear:hover { border-color: var(--border-strong); color: var(--text-primary); }

/* ── Results meta ── */
.svc-meta {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 2px; font-size: 12px; color: var(--text-secondary);
  margin-bottom: var(--space-md);
}
.svc-meta strong { color: var(--text-primary); }

/* ── Service table (desktop) ── */
.svc-table-wrap {
  background: linear-gradient(145deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border: 1px solid var(--border-default); border-radius: var(--radius-lg);
  overflow: hidden;
}
.svc-table-row {
  display: grid;
  grid-template-columns: 1fr 140px 110px 110px 140px 120px 110px 90px;
  align-items: center; gap: 0; padding: 0 14px;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.15s; min-height: 60px;
}
.svc-table-row:last-child { border-bottom: none; }
.svc-table-row:hover:not(.header) { background: rgba(255,255,255,0.02); }
.svc-table-row.header {
  min-height: 40px; background: var(--bg-card);
  border-bottom: 1px solid var(--border-default);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
.svc-col-hd {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-muted); white-space: nowrap;
  display: flex; align-items: center; gap: 4px;
  padding: 10px 8px; user-select: none;
}
.svc-col-cell { padding: 0 8px; display: flex; align-items: center; }

/* Responsive column hiding */
@media (max-width: 1100px) {
  .svc-table-row { grid-template-columns: 1fr 140px 110px 140px 120px 110px 90px; }
  .svc-col-hide-venue { display: none !important; }
}
@media (max-width: 860px) {
  .svc-table-row { grid-template-columns: 1fr 140px 110px 120px 90px; }
  .svc-col-hide-venue, .svc-col-hide-group, .svc-col-hide-time { display: none !important; }
}
@media (max-width: 640px) {
  .svc-table-row.header { display: none !important; }
  .svc-table-row:not(.header) { display: none !important; }
  .svc-table-wrap {
    background: transparent !important; border: none !important;
    border-radius: 0 !important; overflow: visible !important;
  }
  #svc-list-body { display: flex !important; flex-direction: column; gap: 10px; }
}

/* ── Service card (mobile) ── */
.svc-card-row {
  display: none;
  background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border: 1px solid var(--border-default); border-radius: var(--radius-lg);
  padding: 12px 14px; align-items: center; gap: 12px;
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
  animation: svcFadeUp 0.38s cubic-bezier(0.16,1,0.3,1) both;
  cursor: pointer;
}
.svc-card-row:hover {
  border-color: rgba(0,75,160,0.35); transform: translateX(2px);
  box-shadow: 0 4px 18px rgba(0,0,0,0.18);
}
@media (max-width: 639px) { .svc-card-row { display: flex !important; } }

/* ── Empty state ── */
.svc-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 64px var(--space-lg); text-align: center;
  color: var(--text-secondary);
}
.svc-empty i { font-size: 3rem; color: var(--border-strong); margin-bottom: var(--space-lg); }
.svc-empty-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
.svc-empty-sub   { font-size: 13px; color: var(--text-secondary); max-width: 300px; }

/* ── Animations ── */
@keyframes svcFadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes svcFadeIn { from { opacity: 0; } to { opacity: 1; } }

/* ── Spinner ── */
.svc-spinner {
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.25);
  border-top-color: #fff;
  animation: svcSpin 0.7s linear infinite;
  display: inline-block;
}
@keyframes svcSpin { to { transform: rotate(360deg); } }


/* ══════════════════════════════════════════════════════
   SERVICES SETTINGS TAB  —  scoped under .svc-set-*
   Design language: structured command-centre.
   Left nav rail + right content panel.
   Dark-first. Precise. Every row earns its space.
══════════════════════════════════════════════════════ */

/* ── Root layout ── */
.svc-set-shell {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 0;
  min-height: 580px;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  overflow: hidden;
  animation: svcFadeUp 0.38s cubic-bezier(0.16,1,0.3,1) both;
}
@media (max-width: 760px) {
  .svc-set-shell { grid-template-columns: 1fr; }
}

/* ── Left rail ── */
.svc-set-rail {
  border-right: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, var(--bg-page) 0%, var(--bg-card) 100%);
  padding: 8px 0;
  overflow-y: auto;
}
@media (max-width: 760px) {
  .svc-set-rail {
    flex-direction: row;
    border-right: none;
    border-bottom: 1px solid var(--border-default);
    padding: 0;
    overflow-x: auto;
    overflow-y: visible;
    scrollbar-width: none;
  }
  .svc-set-rail::-webkit-scrollbar { display: none; }
}

/* Rail section label */
.svc-set-rail-label {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  padding: 10px 16px 4px;
  user-select: none;
}
@media (max-width: 760px) {
  .svc-set-rail-label { display: none; }
}

/* Rail nav item */
.svc-set-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px 9px 16px;
  margin: 0 6px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-sans);
  text-align: left;
  width: calc(100% - 12px);
  position: relative;
  user-select: none;
}
.svc-set-nav i {
  font-size: 15px;
  flex-shrink: 0;
  color: var(--text-muted);
  transition: color 0.15s;
}
.svc-set-nav:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.svc-set-nav:hover i { color: var(--text-secondary); }
.svc-set-nav.active {
  background: rgba(0,75,160,0.1);
  color: var(--caci-blue-light);
  font-weight: 600;
}
.svc-set-nav.active i { color: var(--caci-blue-light); }
.svc-set-nav.active::before {
  content: '';
  position: absolute;
  left: 0; top: 50%;
  transform: translateY(-50%);
  width: 3px; height: 60%;
  background: var(--caci-blue);
  border-radius: 0 3px 3px 0;
}
[data-theme="light"] .svc-set-nav.active { color: var(--caci-blue); }
[data-theme="light"] .svc-set-nav.active i { color: var(--caci-blue); }

.svc-set-nav-badge {
  margin-left: auto;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 99px;
  background: rgba(0,75,160,0.15);
  border: 1px solid rgba(0,75,160,0.25);
  color: var(--caci-blue-light);
  line-height: 1.4;
}

@media (max-width: 760px) {
  .svc-set-nav {
    width: auto; flex-shrink: 0; margin: 6px 0 6px 4px;
    padding: 7px 14px; border-radius: 99px;
    border: 1px solid transparent;
  }
  .svc-set-nav.active {
    background: rgba(0,75,160,0.12);
    border-color: rgba(0,75,160,0.3);
  }
  .svc-set-nav.active::before { display: none; }
  .svc-set-nav-badge { display: none; }
}

/* Rail separator */
.svc-set-rail-sep {
  height: 1px;
  background: var(--border-subtle);
  margin: 6px 14px;
}
@media (max-width: 760px) {
  .svc-set-rail-sep { display: none; }
}

/* ── Content panel ── */
.svc-set-panel {
  overflow-y: auto;
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 0;
}
@media (max-width: 900px) { .svc-set-panel { padding: 20px 20px; } }
@media (max-width: 540px) { .svc-set-panel { padding: 16px 14px; } }

/* Panel header */
.svc-set-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.svc-set-panel-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 3px;
  letter-spacing: -0.01em;
}
.svc-set-panel-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.55;
}
.svc-set-save-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

/* ── Section block ── */
.svc-set-section {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: 16px;
  background: linear-gradient(145deg, var(--bg-card) 0%, var(--bg-page) 100%);
}
.svc-set-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  background: rgba(255,255,255,0.015);
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.svc-set-section-head:hover { background: rgba(255,255,255,0.025); }
.svc-set-section-icon {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.svc-set-section-icon i { font-size: 14px; }
.svc-set-section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}
.svc-set-section-sub {
  font-size: 11px;
  color: var(--text-muted);
  display: none;
}
@media (min-width: 541px) { .svc-set-section-sub { display: block; } }
.svc-set-chevron {
  font-size: 13px;
  color: var(--text-muted);
  transition: transform 0.25s cubic-bezier(0.16,1,0.3,1);
  flex-shrink: 0;
}
.svc-set-section.collapsed .svc-set-chevron { transform: rotate(-90deg); }
.svc-set-section-body {
  overflow: hidden;
  transition: max-height 0.32s cubic-bezier(0.16,1,0.3,1);
}
.svc-set-section.collapsed .svc-set-section-body { max-height: 0 !important; }

/* ── Setting row ── */
.svc-set-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.12s;
  min-height: 56px;
}
.svc-set-row:last-child { border-bottom: none; }
.svc-set-row:hover { background: rgba(255,255,255,0.012); }

.svc-set-row-icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 15px;
}

.svc-set-row-text { flex: 1; min-width: 0; }
.svc-set-row-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}
.svc-set-row-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.45;
}
.svc-set-row-control { flex-shrink: 0; }

/* ── Toggle switch ── */
.svc-toggle-wrap {
  display: flex;
  align-items: center;
  cursor: pointer;
  gap: 0;
}
.svc-toggle-track {
  width: 40px;
  height: 22px;
  border-radius: 99px;
  background: var(--bg-hover);
  border: 1px solid var(--border-default);
  position: relative;
  transition: background 0.22s cubic-bezier(0.16,1,0.3,1), border-color 0.22s;
  flex-shrink: 0;
}
.svc-toggle-track.on {
  background: var(--caci-blue);
  border-color: var(--caci-blue);
}
.svc-toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: transform 0.22s cubic-bezier(0.16,1,0.3,1), background 0.22s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
.svc-toggle-track.on .svc-toggle-thumb {
  transform: translateX(18px);
  background: #fff;
}
input[type="checkbox"].svc-toggle-input {
  position: absolute; opacity: 0; width: 0; height: 0;
}

/* ── Inline select ── */
.svc-set-select {
  appearance: none;
  -webkit-appearance: none;
  height: 34px;
  padding: 0 30px 0 11px;
  background: var(--bg-page);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-family: var(--font-sans);
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  outline: none;
  min-width: 140px;
  transition: border-color 0.18s, box-shadow 0.18s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 9px center;
}
.svc-set-select:focus {
  border-color: var(--caci-blue);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.svc-set-select option { background: var(--bg-card); color: var(--text-primary); }

/* ── Inline input ── */
.svc-set-input {
  height: 34px;
  padding: 0 11px;
  background: var(--bg-page);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-family: var(--font-sans);
  color: var(--text-primary);
  outline: none;
  min-width: 80px;
  max-width: 120px;
  transition: border-color 0.18s, box-shadow 0.18s;
}
.svc-set-input:focus {
  border-color: var(--caci-blue);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

/* ── Stepper control ── */
.svc-set-stepper {
  display: flex;
  align-items: center;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-page);
}
.svc-set-step-btn {
  width: 30px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  transition: background 0.12s, color 0.12s;
  font-family: var(--font-sans);
}
.svc-set-step-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.svc-set-step-val {
  min-width: 36px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  border-left: 1px solid var(--border-default);
  border-right: 1px solid var(--border-default);
  user-select: none;
}

/* ── Service type chip grid ── */
.svc-set-type-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 14px 16px;
}
.svc-set-type-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 99px;
  font-size: 11.5px;
  font-weight: 500;
  font-family: var(--font-sans);
  cursor: default;
  user-select: none;
  border: 1px solid transparent;
  transition: transform 0.15s;
}
.svc-set-type-chip:hover { transform: translateY(-1px); }
.svc-set-type-chip i { font-size: 11px; }

/* ── Colour picker row ── */
.svc-set-color-row {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.svc-set-color-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
  flex-shrink: 0;
}
.svc-set-color-dot:hover { transform: scale(1.15); }
.svc-set-color-dot.selected {
  border-color: var(--text-primary);
  transform: scale(1.15);
  box-shadow: 0 0 0 3px rgba(255,255,255,0.12);
}

/* ── Danger zone section ── */
.svc-set-danger-section {
  border: 1px solid rgba(198,0,38,0.2);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: rgba(198,0,38,0.03);
  margin-bottom: 16px;
}
.svc-set-danger-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  background: rgba(198,0,38,0.05);
  border-bottom: 1px solid rgba(198,0,38,0.15);
}
.svc-set-danger-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--caci-red);
}

/* ── Save confirmation flash ── */
@keyframes svcSetFlash {
  0%   { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.3); }
  100% { background: transparent; border-color: var(--border-default); }
}
.svc-set-section.saved { animation: svcSetFlash 1.2s ease both; }

/* ── Unsaved indicator dot ── */
.svc-set-unsaved-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d29922;
  display: none;
  flex-shrink: 0;
}
.svc-set-unsaved-dot.show { display: inline-block; }

/* ── Info callout ── */
.svc-set-callout {
  display: flex;
  gap: 10px;
  padding: 11px 14px;
  background: rgba(88,166,255,0.06);
  border: 1px solid rgba(88,166,255,0.18);
  border-radius: var(--radius-sm);
  margin: 10px 16px 14px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.55;
}
.svc-set-callout i { color: #58a6ff; flex-shrink: 0; font-size: 14px; margin-top: 1px; }

/* ── Export / import buttons ── */
.svc-set-action-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 14px 16px;
  border-top: 1px solid var(--border-subtle);
}

/* ── Keyboard shortcut pill ── */
.svc-kbd {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  background: var(--bg-page);
  border: 1px solid var(--border-default);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  font-family: var(--font-mono, monospace);
  letter-spacing: 0.02em;
  margin-left: 6px;
  flex-shrink: 0;
}




`

// State and shared variables
import { state, shared } from './state'
import { injectComponentsCSS, toast } from './components'

// Tab imports
import { _loadSchedule, _renderScheduleTab } from './tabs/ScheduleTab'
import { _renderAttendanceTab } from './tabs/AttendanceTab'
import { _loadTemplates, _renderTemplatesTab } from './tabs/TemplatesTab'
import { _renderReportsTab } from './tabs/ReportsTab'
import { _renderEventsTab } from './tabs/EventsTab'
import { _renderSettingsTab } from './tabs/SettingsTab'

// ── CSS injection ─────────────────────────────────────────────────────────────

function injectCSS(): void {
  injectComponentsCSS();
  if (document.getElementById('svc-page-css')) return
  const s = document.createElement('style')
  s.id = 'svc-page-css'
  s.textContent = SVC_CSS
  document.head.appendChild(s)
}

// ── Realtime listeners ────────────────────────────────────────────────────────

function _onServiceCreated() { if (shared.activeTab === 'schedule')   _loadSchedule() }
function _onServiceUpdated() { if (shared.activeTab === 'schedule')   _loadSchedule() }
function _onServiceDeleted() { if (shared.activeTab === 'schedule')   _loadSchedule() }
function _onTmplCreated()    { if (shared.activeTab === 'templates')  _loadTemplates() }
function _onTmplUpdated()    { if (shared.activeTab === 'templates')  _loadTemplates() }


// ══════════════════════════════════════════════════════
// TAB BAR
// ══════════════════════════════════════════════════════

const TABS = [
  { key: 'schedule',   label: 'Schedule',   icon: 'bi-calendar-event' },
  { key: 'attendance', label: 'Attendance', icon: 'bi-person-check'   },
  { key: 'templates',  label: 'Templates',  icon: 'bi-arrow-repeat'   },
  { key: 'reports',    label: 'Reports',    icon: 'bi-bar-chart-line'  },
  { key: 'events',     label: 'Events',     icon: 'bi-calendar-star'  },
  { key: 'settings',   label: 'Settings',   icon: 'bi-gear'           },
]

export function _switchTabAndLoad(tab: string, serviceId?: string): void {
  shared.activeTab = tab
  if (tab === 'attendance' && serviceId) {
    state.attServiceId = serviceId
  }
  _renderTabBar()
  _renderActiveTab()
}

function _renderTabBar(): void {
  const bar = shared.container?.querySelector<HTMLElement>('#svc-tab-bar')
  if (!bar) return

  bar.innerHTML = TABS.map(t => {
    const count = t.key === 'schedule'
      ? state.services.length
      : t.key === 'templates'
      ? state.templates.length
      : null

    return `<button
      class="svc-tab-btn${shared.activeTab === t.key ? ' active' : ''}"
      data-tab="${t.key}"
      aria-selected="${shared.activeTab === t.key}"
      role="tab"
      aria-controls="svc-tab-panel">
      <i class="bi ${t.icon}"></i>
      <span class="svc-tab-label">${t.label}</span>
      ${count !== null && count > 0 ? `<span class="svc-tab-count">${count}</span>` : ''}
    </button>`
  }).join('')

  bar.querySelectorAll<HTMLElement>('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset['tab']!
      if (tab === shared.activeTab) return
      shared.activeTab = tab
      
      // Update URL silently
      history.replaceState(null, '', `#/services?tab=${tab}`)
      // Sync sidebar highlight
      import('../../../shell/Shell').then(({ updateActiveNav }) => {
        updateActiveNav(`/services?tab=${tab}`)
      })

      _renderTabBar()
      _renderActiveTab()
    })
  })
}

function _renderActiveTab(): void {
  if (!shared.tabContent) return
  shared.tabContent.innerHTML = ''

  switch (shared.activeTab) {
    case 'schedule':   _renderScheduleTab();   _loadSchedule();   break
    case 'attendance': _renderAttendanceTab();                     break
    case 'templates':  _renderTemplatesTab();                      break
    case 'reports':    _renderReportsTab();                        break
    case 'events':     _renderEventsTab();                         break
    case 'settings':   _renderSettingsTab();                       break
  }
}

// ══════════════════════════════════════════════════════
// MAIN PageModule
// ══════════════════════════════════════════════════════

const ServicesPage: PageModule = {

  async render(container: HTMLElement): Promise<void> {
    shared.destroyed   = false
    shared.container   = container
    
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '')
    shared.activeTab   = urlParams.get('tab') || 'schedule'

    // Reset state
    Object.assign(state, {
      services: [], filtered: [],
      search: '', statusFilter: 'all', typeFilter: 'all', groupFilter: 'all',
      statFilter: null, view: 'list',
      calYear: new Date().getFullYear(), calMonth: new Date().getMonth(),
      openServiceId: null,
      attServices: [], attServiceId: null, attRecords: [], attFiltered: [],
      attSearch: '', attStatusFilter: 'all', attChanged: new Set(), attCurrentStatus: new Map(),
      templates: [], tmplFiltered: [], tmplSearch: '',
      reportRange: '30d',
      loading: false, saving: false,
    })

    injectCSS()

    const user = getCurrentUser()

    container.innerHTML = /* html */`
      <div class="svc-page">

        <!-- Tab bar -->
        <div class="svc-tab-bar-wrap">
          <div class="svc-tab-bar" id="svc-tab-bar" role="tablist" aria-label="Services workspace tabs"></div>
        </div>

        <!-- Tab panel -->
        <div id="svc-tab-content" role="tabpanel" id="svc-tab-panel"></div>

      </div>`

    shared.tabContent = container.querySelector('#svc-tab-content')!

    // Register realtime listeners
    on('service:created', _onServiceCreated)
    on('service:updated', _onServiceUpdated)
    on('service:deleted', _onServiceDeleted)
    on('serviceTemplate:created', _onTmplCreated)
    on('serviceTemplate:updated', _onTmplUpdated)

    _renderTabBar()
    _renderActiveTab()
  },

  destroy(): void {
    shared.destroyed  = true
    shared.container  = null
    shared.tabContent = null

    off('service:created', _onServiceCreated)
    off('service:updated', _onServiceUpdated)
    off('service:deleted', _onServiceDeleted)
    off('serviceTemplate:created', _onTmplCreated)
    off('serviceTemplate:updated', _onTmplUpdated)

    // Clean up overlays
    document.getElementById('svc-drawer-wrap')?.remove()
    document.getElementById('svc-modal-wrap')?.remove()
    document.getElementById('svc-ctx')?.remove()
    document.getElementById('svc-toast-el')?.remove()
  },
}

export default ServicesPage