// src/modules/membership/pages/AddMember.ts
// 4-step add member wizard — Personal Info → Contact Details → Membership Info → Review.
// Mirrors: caci-add-member.html reference design.
// Queue drawer (right panel) + avatar modal + success screen.
// Real save: createMember() from repository.ts
// Phone is OPTIONAL throughout (no required validation on phone fields).

import type { PageModule } from '../../../types/module.types'
import { navigate } from '@core/router'
import { getActiveAssemblyId } from '@core/auth'
import { getHouseholdDropdownItems } from '../repository'
import { registerMember } from '../services/memberService'
import { CreateMemberSchema } from '../schemas/member.schema'
import type { ZodError } from 'zod'
import { renderBreadcrumbs } from '@shell/Breadcrumbs'
import type { CreateMemberPayload } from '../../../types/member.types'

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = /* css */`
/* ═══════════════════════════════════════════════════════════════════
   ADD MEMBER WIZARD
═══════════════════════════════════════════════════════════════════ */

.am-wrap {
  max-width: 1060px; margin: 0 auto;
  padding: 0 16px 48px; position: relative; z-index: 1;
}
@media (min-width: 480px) { .am-wrap { padding: 0 20px 48px; } }

/* ── Shell grid ─────────────────────────────────────────────────── */
.am-shell {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 20px; align-items: start;
}
@media (max-width: 780px) {
  .am-shell { grid-template-columns: 1fr; }
  .am-sidebar { display: none !important; }
}

/* ── Progress bar (mobile) ──────────────────────────────────────── */
.am-mob-progress {
  height: 3px; background: var(--border-default); margin-bottom: 16px; border-radius: 99px;
}
.am-mob-progress-fill {
  height: 100%; border-radius: 99px;
  background: linear-gradient(90deg, var(--caci-red), var(--caci-blue));
  transition: width 0.5s cubic-bezier(0.16,1,0.3,1);
}
@media (min-width: 781px) { .am-mob-progress { display: none; } }

/* ── Sidebar ────────────────────────────────────────────────────── */
.am-sidebar {
  position: sticky; top: 20px;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 18px; box-shadow: var(--shadow-raised); overflow: hidden;
}
.am-sidebar-progress { height: 3px; background: var(--border-default); }
.am-sidebar-progress-fill {
  height: 100%; border-radius: 0 99px 99px 0;
  background: linear-gradient(90deg, var(--caci-red), var(--caci-blue));
  transition: width 0.5s cubic-bezier(0.16,1,0.3,1);
}
.am-sidebar-inner { padding: 20px 16px; }

/* Step items */
.am-vstep {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 10px 11px; border-radius: 12px; cursor: pointer;
  transition: background 0.18s, transform 0.15s; position: relative;
}
.am-vstep:hover { background: var(--bg-hover); }
.am-vstep:hover:not(.active) { transform: translateX(3px); }
.am-vstep.active { background: rgba(198,0,38,0.07); }
[data-theme="dark"] .am-vstep.active { background: rgba(198,0,38,0.1); }
.am-vstep.active::before {
  content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 3px; height: 60%; background: var(--caci-red); border-radius: 0 3px 3px 0;
}
.am-step-indicator {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
  border: 2px solid var(--border-default);
  background: var(--border-default); color: var(--text-muted);
  transition: all 0.35s cubic-bezier(0.16,1,0.3,1);
}
.am-vstep.active .am-step-indicator {
  background: var(--caci-red); border-color: var(--caci-red-dim);
  color: #fff; box-shadow: 0 3px 12px rgba(198,0,38,0.35);
}
.am-vstep.done .am-step-indicator {
  background: var(--caci-success); border-color: var(--caci-success);
  color: #fff; box-shadow: 0 2px 8px rgba(26,127,55,0.3);
}
.am-vstep-num { font-size: 9.5px; color: var(--text-muted); font-weight: 500; margin-bottom: 1px; }
.am-vstep-label { font-size: 12.5px; font-weight: 600; color: var(--text-secondary); transition: color 0.2s; }
.am-vstep.active .am-vstep-label { color: var(--text-primary); }
.am-vstep.done .am-vstep-label { color: var(--caci-success); }
.am-vconn {
  width: 2px; height: 18px; margin: 0 0 0 26px; border-radius: 99px;
  background: var(--border-default); transition: background 0.35s;
}
.am-vconn.done { background: var(--caci-success); }

/* Tip box */
.am-tip {
  margin: 14px 0 0; padding: 11px 13px; border-radius: 10px;
  background: rgba(0,75,160,0.05); border: 1px solid var(--border-default);
  display: flex; gap: 9px; align-items: flex-start;
}
[data-theme="dark"] .am-tip { background: rgba(77,159,255,0.06); }
.am-tip i { color: var(--caci-blue-light); font-size: 15px; flex-shrink: 0; margin-top: 1px; }
.am-tip p { font-size: 11px; color: var(--text-secondary); line-height: 1.55; }
.am-tip p strong { color: var(--text-primary); }

/* Sidebar queue */
.am-sq-divider { height: 1px; background: var(--border-default); margin: 14px 0; }
.am-sq-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
.am-sq-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 9px; border-radius: 10px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  margin-bottom: 5px; cursor: pointer; transition: all 0.18s;
}
.am-sq-item:hover { background: var(--bg-hover); border-color: var(--border-strong); }
.am-sq-avatar {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, var(--caci-red), var(--caci-blue));
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #fff;
  background-size: cover; background-position: center;
}
.am-sq-name { font-size: 11.5px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.am-sq-meta { font-size: 10px; color: var(--text-muted); }
.am-sq-btn {
  width: 24px; height: 24px; border-radius: 6px; border: none;
  background: transparent; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text-muted); transition: all 0.15s; font-size: 11px;
}
.am-sq-btn:hover { background: var(--border-default); color: var(--text-primary); }
.am-sq-btn.del:hover { background: var(--bg-danger); color: var(--text-danger); }

/* ── Content panel ──────────────────────────────────────────────── */
.am-panel {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 18px; box-shadow: var(--shadow-raised); overflow: hidden;
}
.am-panel-progress { height: 3px; background: var(--border-default); }
.am-panel-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--caci-red), var(--caci-blue));
  transition: width 0.5s cubic-bezier(0.16,1,0.3,1);
}
.am-editing-banner {
  display: none; align-items: center; gap: 8px;
  padding: 10px 20px; background: var(--bg-info);
  border-bottom: 1px solid var(--border-default);
  font-size: 12px; color: var(--text-secondary); flex-wrap: wrap;
}
.am-editing-banner.visible { display: flex; }
.am-editing-banner strong { color: var(--text-primary); }

/* Step head */
.am-step-head {
  padding: 22px 22px 18px; border-bottom: 1px solid var(--border-default);
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
}
@media (min-width: 640px) { .am-step-head { padding: 26px 30px 20px; } }
.am-step-eyebrow {
  font-size: 9.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--caci-red); margin-bottom: 6px;
  display: flex; align-items: center; gap: 4px;
}
.am-step-head h1 { font-size: 19px; font-weight: 700; color: var(--text-primary); }
.am-step-head p  { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
.am-step-icon {
  width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-page); border: 1px solid var(--border-default);
  font-size: 20px; color: var(--caci-red);
}

/* Step content */
.am-step-body { padding: 20px 22px; }
@media (min-width: 640px) { .am-step-body { padding: 26px 30px; } }

/* Form grid */
.am-form-grid { display: grid; gap: 14px 18px; }
.am-form-grid-2 { grid-template-columns: repeat(2, 1fr); }
.am-form-grid-3 { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 560px) { .am-form-grid-2, .am-form-grid-3 { grid-template-columns: 1fr; } }
@media (min-width: 481px) and (max-width: 780px) { .am-form-grid-3 { grid-template-columns: repeat(2, 1fr); } }
.am-col2 { grid-column: span 2; }
.am-col3 { grid-column: span 3; }
@media (max-width: 560px) { .am-col2, .am-col3 { grid-column: span 1; } }

.am-form-group { display: flex; flex-direction: column; gap: 5px; }
.am-form-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--text-muted);
  display: flex; align-items: center; gap: 3px;
}
.am-req { color: var(--caci-red); font-size: 13px; }
.am-form-group.has-error .am-inp { border-color: var(--caci-red) !important; box-shadow: 0 0 0 3px rgba(198,0,38,0.12) !important; }
.am-form-error { font-size: 10.5px; color: var(--text-danger); display: none; align-items: center; gap: 3px; }
.am-form-group.has-error .am-form-error { display: flex; }
.am-form-hint { font-size: 11px; color: var(--text-muted); }

/* Inputs */
.am-inp {
  width: 100%; height: 40px; border: 1px solid var(--border-default);
  border-radius: 9px; padding: 0 12px; font-family: var(--font-sans);
  font-size: 13px; color: var(--text-primary); background: var(--bg-page);
  outline: none; transition: border-color 0.18s, box-shadow 0.18s;
  appearance: none;
}
.am-inp::placeholder { color: var(--text-muted); opacity: 0.65; }
.am-inp:hover { border-color: var(--border-strong); }
.am-inp:focus { border-color: var(--border-focus); box-shadow: 0 0 0 3px var(--focus-ring); }
.am-inp-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236e7681' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center; padding-right: 30px; cursor: pointer;
}
.am-inp-select option { background: var(--bg-card); color: var(--text-primary); }
textarea.am-inp { height: auto; padding: 10px 12px; resize: vertical; min-height: 80px; line-height: 1.5; }
.am-phone-wrap { display: flex; }
.am-phone-prefix {
  height: 40px; padding: 0 10px; flex-shrink: 0;
  border: 1px solid var(--border-default); border-right: none;
  border-radius: 9px 0 0 9px; background: var(--bg-hover);
  display: flex; align-items: center; gap: 4px;
  font-size: 12px; color: var(--text-secondary); cursor: default; white-space: nowrap;
}
.am-phone-wrap .am-inp { border-radius: 0 9px 9px 0; }

/* Photo area */
.am-photo-area { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 18px; }
.am-photo-preview {
  width: 70px; height: 70px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, var(--caci-red), var(--caci-blue));
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 700; color: #fff;
  border: 3px solid var(--bg-card); box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  cursor: pointer; transition: transform 0.2s;
  background-size: cover; background-position: center;
}
.am-photo-preview:hover { transform: scale(1.06); }
.am-photo-upload {
  flex: 1; min-width: 140px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 5px; padding: 14px; border-radius: 10px;
  border: 2px dashed var(--border-default); background: var(--bg-page);
  cursor: pointer; transition: all 0.2s; text-align: center;
}
.am-photo-upload:hover { border-color: var(--caci-blue); background: var(--bg-info); }
.am-photo-upload.has-photo { border-style: solid; border-color: var(--caci-success); background: var(--bg-success); }

/* Section title */
.am-section-title {
  font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em;
  color: var(--text-muted); margin-bottom: 14px; display: flex; align-items: center; gap: 5px;
}
.am-divider { height: 1px; background: var(--border-default); margin: 20px 0; }

/* Review */
.am-review-block {
  margin-bottom: 20px; padding: 14px 16px; border-radius: 12px;
  background: var(--bg-page); border: 1px solid var(--border-default);
}
.am-review-section-title {
  font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-muted); margin-bottom: 10px; display: flex; align-items: center; gap: 5px;
}
.am-review-section-title button {
  margin-left: auto; font-size: 11.5px; color: var(--text-link); background: none;
  border: none; cursor: pointer; font-family: var(--font-sans); font-weight: 500;
  padding: 3px 7px; border-radius: 5px; transition: background 0.15s;
}
.am-review-section-title button:hover { background: var(--bg-info); }
.am-review-row {
  display: flex; gap: 8px; padding: 7px 0;
  border-bottom: 1px solid var(--border-default); flex-wrap: wrap;
}
.am-review-row:last-child { border-bottom: none; }
.am-review-label {
  font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--text-muted); min-width: 110px; flex-shrink: 0; padding-top: 2px;
}
.am-review-value { font-size: 13px; color: var(--text-primary); font-weight: 500; flex: 1; word-break: break-word; }
.am-review-empty { color: var(--border-strong); font-style: italic; font-weight: 400; }

/* Add queue btn */
.am-add-queue-btn {
  display: flex; align-items: center; gap: 9px;
  padding: 13px 18px; border-radius: 12px;
  border: 2px dashed var(--caci-blue); background: var(--bg-info);
  color: var(--caci-blue); font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 0.2s; font-family: var(--font-sans); width: 100%; margin-top: 20px;
}
[data-theme="dark"] .am-add-queue-btn { color: var(--caci-blue-light); border-color: var(--caci-blue-light); }
.am-add-queue-btn:hover { background: rgba(0,75,160,0.12); transform: translateY(-1px); }

/* Footer nav */
.am-foot {
  padding: 14px 20px; border-top: 1px solid var(--border-default);
  display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;
}
@media (min-width: 640px) { .am-foot { padding: 16px 30px; } }
.am-foot-meta { font-size: 12px; color: var(--text-muted); }
.am-foot-meta strong { color: var(--text-primary); }
.am-foot-actions { display: flex; gap: 8px; flex-wrap: wrap; }

/* Buttons */
.am-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 0 16px; height: 38px; border-radius: 10px;
  font-size: 12.5px; font-weight: 600; cursor: pointer;
  border: 1px solid var(--border-default); background: var(--bg-card);
  color: var(--text-secondary); transition: all 0.18s; font-family: var(--font-sans);
  white-space: nowrap;
}
.am-btn:hover { border-color: var(--border-strong); color: var(--text-primary); transform: translateY(-1px); }
.am-btn:active { transform: translateY(0); }
.am-btn-red   { background: var(--caci-red); border-color: var(--caci-red-dim); color: #fff; box-shadow: 0 2px 10px rgba(198,0,38,0.3); }
.am-btn-red:hover { background: var(--caci-red-light); color: #fff; box-shadow: 0 5px 18px rgba(198,0,38,0.4); }
.am-btn-blue  { background: var(--caci-blue); border-color: var(--caci-blue-dim); color: #fff; box-shadow: 0 2px 10px rgba(0,75,160,0.3); }
.am-btn-blue:hover { background: var(--caci-blue-light); color: #fff; box-shadow: 0 5px 18px rgba(0,75,160,0.4); }
.am-btn-green { background: var(--caci-success); border-color: #155d27; color: #fff; box-shadow: 0 2px 10px rgba(26,127,55,0.3); }
.am-btn-green:hover { background: #22a24a; color: #fff; }
.am-btn:disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; transform: none; box-shadow: none; }

/* Spinner */
.am-spinner {
  width: 14px; height: 14px; border: 2px solid var(--border-default);
  border-top-color: var(--caci-success); border-radius: 50%;
  animation: am-spin 0.7s linear infinite; flex-shrink: 0;
}
@keyframes am-spin { to { transform: rotate(360deg); } }

/* Queue drawer */
.am-overlay {
  position: fixed; inset: 0; z-index: 300;
  display: flex; align-items: stretch; justify-content: flex-end;
  background: rgba(0,0,0,0); backdrop-filter: blur(0);
  pointer-events: none; transition: background 0.3s, backdrop-filter 0.3s;
}
.am-overlay.open { background: rgba(0,0,0,0.55); backdrop-filter: blur(6px); pointer-events: all; }
.am-drawer {
  width: 100%; max-width: 400px; height: 100%;
  background: var(--bg-card); border-left: 1px solid var(--border-default);
  box-shadow: -16px 0 48px rgba(0,0,0,0.25);
  transform: translateX(100%); transition: transform 0.4s cubic-bezier(0.16,1,0.3,1);
  display: flex; flex-direction: column; overflow: hidden;
}
.am-overlay.open .am-drawer { transform: translateX(0); }
.am-drawer-accent { height: 3px; flex-shrink: 0; background: linear-gradient(90deg, var(--caci-red), var(--caci-blue)); }
.am-drawer-head {
  padding: 18px 20px 14px; border-bottom: 1px solid var(--border-default);
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-shrink: 0;
}
.am-drawer-head h2 { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.am-drawer-head p  { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.am-drawer-body { flex: 1; overflow-y: auto; padding: 14px 16px; }
.am-uq-item {
  display: flex; align-items: center; gap: 11px;
  padding: 11px 13px; border-radius: 11px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  margin-bottom: 8px; transition: all 0.2s;
}
.am-uq-item.uploading { border-color: rgba(26,127,55,0.4); background: var(--bg-success); }
.am-uq-item.done { border-color: var(--caci-success); opacity: 0.6; }
.am-uq-avatar {
  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, var(--caci-red), var(--caci-blue));
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: #fff;
  background-size: cover; background-position: center;
}
.am-uq-name { font-size: 12.5px; font-weight: 600; color: var(--text-primary); }
.am-uq-sub  { font-size: 10.5px; color: var(--text-muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.am-uq-prog { height: 2px; background: var(--border-default); border-radius: 99px; margin-top: 5px; overflow: hidden; }
.am-uq-prog-fill { height: 100%; background: linear-gradient(90deg, var(--caci-success), var(--caci-blue-light)); transition: width 0.4s; }
.am-drawer-empty { text-align: center; padding: 48px 20px; color: var(--text-muted); font-size: 13px; }
.am-drawer-empty i { font-size: 36px; display: block; margin-bottom: 12px; opacity: 0.3; }
.am-drawer-foot {
  padding: 12px 16px; background: var(--bg-page); border-top: 1px solid var(--border-default);
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
}
.am-up-counter { font-size: 11.5px; color: var(--text-muted); }
.am-up-counter strong { color: var(--text-primary); }

/* Avatar modal */
.am-avatar-modal {
  position: fixed; inset: 0; z-index: 999;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0); backdrop-filter: blur(0);
  transition: background 0.26s, backdrop-filter 0.26s; pointer-events: none;
}
.am-avatar-modal.open {
  background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); pointer-events: all;
}
.am-avatar-modal-inner {
  position: relative; transform: scale(0.75); opacity: 0;
  transition: transform 0.32s cubic-bezier(0.16,1,0.3,1), opacity 0.26s;
}
.am-avatar-modal.open .am-avatar-modal-inner { transform: scale(1); opacity: 1; }
.am-avatar-modal-img {
  width: 260px; height: 260px; border-radius: 50%;
  background: linear-gradient(135deg, var(--caci-red), var(--caci-blue));
  display: flex; align-items: center; justify-content: center;
  font-size: 80px; font-weight: 700; color: #fff;
  border: 4px solid rgba(255,255,255,0.15); box-shadow: 0 28px 64px rgba(0,0,0,0.6);
  background-size: cover; background-position: center;
}
.am-avatar-modal-name {
  margin-top: 16px; text-align: center; font-size: 14px;
  font-weight: 600; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,0.5);
}
.am-avatar-modal-close {
  position: absolute; top: -12px; right: -12px;
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--bg-card); border: 1px solid var(--border-default);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text-secondary); transition: all 0.18s;
  box-shadow: var(--shadow-overlay);
}
.am-avatar-modal-close:hover { color: var(--text-primary); }

/* Queue pill (top bar) */
.am-queue-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border-radius: 9px; border: 1px solid var(--border-default);
  background: var(--bg-card); color: var(--text-secondary);
  font-size: 12px; font-weight: 500; cursor: pointer;
  transition: all 0.2s; white-space: nowrap;
}
.am-queue-pill:hover { border-color: var(--border-strong); color: var(--text-primary); }
.am-queue-pill.has-items { border-color: var(--caci-blue-light); color: var(--caci-blue-light); background: var(--bg-info); }
[data-theme="light"] .am-queue-pill.has-items { color: var(--caci-blue); border-color: var(--caci-blue); }
.am-q-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 4px; border-radius: 99px;
  background: var(--caci-red); color: #fff; font-size: 10px; font-weight: 700;
  box-shadow: 0 2px 6px rgba(198,0,38,0.4);
}

/* Success screen */
.am-success {
  display: none; flex-direction: column; align-items: center;
  text-align: center; padding: 60px 24px; gap: 16px;
}
.am-success-ring {
  width: 84px; height: 84px; border-radius: 50%;
  background: var(--bg-success); border: 2px solid var(--caci-success);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 0 10px rgba(26,127,55,0.08), 0 0 28px rgba(26,127,55,0.25);
}

/* Animations */
@keyframes am-fade-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes am-shake { 0%,100% { transform:translateX(0); } 20%,60% { transform:translateX(-5px); } 40%,80% { transform:translateX(5px); } }
.am-fade-up { animation: am-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both; }
`

function injectCSS(): void {
    if (document.getElementById('am-css')) return
    const s = document.createElement('style')
    s.id = 'am-css'
    s.textContent = CSS
    document.head.appendChild(s)
}

// ── State ─────────────────────────────────────────────────────────────────────

interface QueueItem {
    id: number
    data: FormData_
    photoDataUrl: string | null
    status: 'pending' | 'uploading' | 'done'
}

interface FormData_ {
    title: string; first: string; other: string; last: string
    dob: string; gender: string; marital: string; occupation: string
    phone: string; phone2: string; email: string; digital_addr: string
    address: string; whatsapp: string; facebook: string; instagram: string
    ec_name: string; ec_phone: string; ec_relation: string
    mem_type: string; join_date: string; household_id: string; status: string
    pastoral_notes: string
}

let _currentStep = 1
const _totalSteps = 4
let _queue: QueueItem[] = []
let _editingId: number | null = null
let _uploadedCount = 0
let _isUploading = false
let _photoDataUrl: string | null = null
let _householdItems: { id: string; family_name: string }[] = []
let _destroyed_ = false
let _listeners_: Array<[EventTarget, string, EventListener]> = []

const TIPS = [
    'Fields marked <strong>*</strong> are required to continue.',
    '<strong>Tip:</strong> Phone is optional — you can add it later.',
    'Household is optional — assign or create one later.',
    'Click <em>Add to Queue</em> to stage, or <em>Save Member</em> to save immediately.',
]

// ── Lifecycle ─────────────────────────────────────────────────────────────────

const AddMemberPage: PageModule = { render: _render, destroy: _destroy }
export default AddMemberPage

async function _render(container: HTMLElement): Promise<void> {
    _destroyed_ = false
    _listeners_ = []
    _currentStep = 1
    _queue = []
    _editingId = null
    _uploadedCount = 0
    _isUploading = false
    _photoDataUrl = null
    injectCSS()

    // Breadcrumbs
    const bc = document.createElement('div')
    renderBreadcrumbs(bc, [
        { label: 'Members', path: '/members' },
        { label: 'Add Member' },
    ])
    container.innerHTML = ''
    container.appendChild(bc)

    // Queue pill header row
    const topBar = document.createElement('div')
    topBar.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;padding:0 0 12px;max-width:1060px;margin:0 auto;'
    topBar.innerHTML = `
    <button class="am-queue-pill" id="am-queue-pill-btn">
      <i class="bi bi-inbox" style="font-size:15px;"></i>
      Queue
      <span class="am-q-badge" id="am-q-badge" style="display:none;">0</span>
    </button>`
    container.appendChild(topBar)

    // Main wrap
    const wrap = document.createElement('div')
    wrap.className = 'am-wrap'
    wrap.innerHTML = _buildShell()
    container.appendChild(wrap)

    // Load households for dropdown
    try {
        _householdItems = await getHouseholdDropdownItems()
        _populateHouseholdDropdown()
    } catch { /* non-fatal */ }

    _updateStepper()
    _renderSidebarQueue()
    _bindAllEvents(container)
}

function _destroy(): void {
    _destroyed_ = true
    _listeners_.forEach(([el, ev, fn]) => el.removeEventListener(ev, fn))
    _listeners_ = []
}

// ── Shell HTML ────────────────────────────────────────────────────────────────

function _buildShell(): string {
    return /* html */`
<!-- Mobile progress -->
<div class="am-mob-progress">
  <div class="am-mob-progress-fill" id="am-mob-prog" style="width:25%;"></div>
</div>

<div class="am-shell">
  <!-- Sidebar -->
  <aside class="am-sidebar am-fade-up" style="animation-delay:50ms;">
    <div class="am-sidebar-progress">
      <div class="am-sidebar-progress-fill" id="am-sb-prog" style="width:25%;"></div>
    </div>
    <div class="am-sidebar-inner">
      ${[
            { n: 1, label: 'Personal Info', sub: 'Step 1 of 4' },
            { n: 2, label: 'Contact Details', sub: 'Step 2 of 4' },
            { n: 3, label: 'Membership Info', sub: 'Step 3 of 4' },
            { n: 4, label: 'Review', sub: 'Step 4 of 4' },
        ].map((s, i, arr) => /* html */`
        <div class="am-vstep ${i === 0 ? 'active' : ''}" id="am-vstep${s.n}" data-step="${s.n}">
          <div class="am-step-indicator" id="am-vi${s.n}">${s.n}</div>
          <div>
            <div class="am-vstep-num">${s.sub}</div>
            <div class="am-vstep-label">${s.label}</div>
          </div>
        </div>
        ${i < arr.length - 1 ? `<div class="am-vconn" id="am-vc${s.n}"></div>` : ''}
      `).join('')}
      <div class="am-tip">
        <i class="bi bi-info-circle-fill"></i>
        <p id="am-tip-text">${TIPS[0]}</p>
      </div>
      <!-- Sidebar queue -->
      <div id="am-sb-queue" style="display:none;">
        <div class="am-sq-divider"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span class="am-sq-label">Pending Queue</span>
          <button class="am-btn am-btn-green" id="am-sb-upload-btn"
                  style="height:26px;font-size:10.5px;padding:0 9px;gap:4px;">
            <i class="bi bi-cloud-upload" style="font-size:11px;"></i> Upload All
          </button>
        </div>
        <div id="am-sq-list"></div>
      </div>
    </div>
  </aside>

  <!-- Content panel -->
  <div class="am-panel am-fade-up" style="animation-delay:110ms;">
    <div class="am-panel-progress">
      <div class="am-panel-progress-fill" id="am-panel-prog" style="width:25%;"></div>
    </div>
    <div class="am-editing-banner" id="am-editing-banner">
      <i class="bi bi-pencil-square" style="font-size:14px;color:var(--caci-blue-light);"></i>
      Editing: <strong id="am-editing-name">—</strong>
      <button id="am-cancel-edit-btn"
              style="margin-left:auto;font-size:11px;color:var(--text-danger);background:none;
                     border:none;cursor:pointer;font-family:var(--font-sans);font-weight:600;
                     display:flex;align-items:center;gap:3px;">
        <i class="bi bi-x" style="font-size:13px;"></i> Cancel Edit
      </button>
    </div>

    ${_buildStep1()}
    ${_buildStep2()}
    ${_buildStep3()}
    ${_buildStep4()}

    <!-- Success screen -->
    <div class="am-success" id="am-success">
      <div class="am-success-ring">
        <i class="bi bi-check-circle-fill" style="font-size:40px;color:var(--caci-success);"></i>
      </div>
      <h2 style="font-size:20px;font-weight:700;color:var(--text-primary);">Member Saved!</h2>
      <p style="font-size:13px;color:var(--text-muted);max-width:280px;line-height:1.6;"
         id="am-success-msg">Member has been successfully added to CACI Hub.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:6px;">
        <button class="am-btn am-btn-red" id="am-add-more-btn">
          <i class="bi bi-person-plus-fill"></i> Add Another
        </button>
        <button class="am-btn am-btn-blue" id="am-view-members-btn">
          <i class="bi bi-people-fill"></i> View Members
        </button>
      </div>
    </div>

    <!-- Footer nav -->
    <div class="am-foot" id="am-nav-footer">
      <div class="am-foot-meta">Step <strong id="am-step-label">1</strong> of ${_totalSteps}</div>
      <div class="am-foot-actions">
        <button class="am-btn" id="am-btn-back" style="display:none;">
          <i class="bi bi-arrow-left"></i> Back
        </button>
        <button class="am-btn am-btn-blue" id="am-btn-next">
          Continue <i class="bi bi-arrow-right"></i>
        </button>
        <button class="am-btn am-btn-red" id="am-btn-queue" style="display:none;">
          <i class="bi bi-plus-circle-fill"></i> Add to Queue
        </button>
        <button class="am-btn am-btn-green" id="am-btn-save" style="display:none;">
          <i class="bi bi-cloud-upload-fill"></i> Save Member
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Queue drawer -->
<div class="am-overlay" id="am-overlay">
  <div class="am-drawer">
    <div class="am-drawer-accent"></div>
    <div class="am-drawer-head">
      <div>
        <h2>Upload Queue</h2>
        <p id="am-drawer-sub">0 members pending</p>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
        <button id="am-drawer-close" style="background:none;border:none;cursor:pointer;
                color:var(--text-muted);font-size:18px;padding:4px;">
          <i class="bi bi-x-lg"></i>
        </button>
        <button class="am-btn am-btn-green" id="am-drawer-upload-btn"
                style="height:34px;font-size:11.5px;padding:0 12px;gap:5px;">
          <i class="bi bi-cloud-upload-fill" style="font-size:13px;"></i> Upload All
        </button>
      </div>
    </div>
    <div class="am-drawer-body" id="am-drawer-body">
      <div class="am-drawer-empty" id="am-drawer-empty">
        <i class="bi bi-inbox"></i>
        <p>No members queued yet.<br>Fill in the form and click <strong>Add to Queue</strong>.</p>
      </div>
    </div>
    <div class="am-drawer-foot">
      <i class="bi bi-info-circle" style="font-size:13px;color:var(--text-muted);flex-shrink:0;"></i>
      <span class="am-up-counter" id="am-up-counter">Uploaded: <strong>0</strong> / <strong>0</strong></span>
      <button class="am-btn am-btn-red" id="am-drawer-add-btn"
              style="margin-left:auto;height:32px;font-size:11px;padding:0 12px;">
        <i class="bi bi-person-plus-fill" style="font-size:12px;"></i> Add Member
      </button>
    </div>
  </div>
</div>

<!-- Avatar modal -->
<div class="am-avatar-modal" id="am-avatar-modal">
  <div class="am-avatar-modal-inner">
    <div class="am-avatar-modal-img" id="am-modal-img"></div>
    <div class="am-avatar-modal-name" id="am-modal-name"></div>
    <button class="am-avatar-modal-close" id="am-modal-close">
      <i class="bi bi-x-lg" style="font-size:15px;"></i>
    </button>
  </div>
</div>
`
}

// ── Step HTML builders ────────────────────────────────────────────────────────

function _buildStep1(): string {
    return /* html */`
<div id="am-step1">
  <div class="am-step-head">
    <div>
      <div class="am-step-eyebrow"><i class="bi bi-record-circle-fill" style="font-size:10px;"></i> Step 1 of 4</div>
      <h1>Personal Info</h1>
      <p>Basic details about the new member</p>
    </div>
    <div class="am-step-icon"><i class="bi bi-person"></i></div>
  </div>
  <div class="am-step-body">
    <div class="am-photo-area">
      <div class="am-photo-preview" id="am-avatar-preview" title="Click to enlarge">?</div>
      <div style="flex:1;min-width:140px;display:flex;flex-direction:column;gap:7px;">
        <p class="am-form-label">Profile Photo</p>
        <div class="am-photo-upload" id="am-photo-upload">
          <i class="bi bi-image" style="font-size:22px;color:var(--text-muted);"></i>
          <p style="font-size:11.5px;color:var(--text-muted);font-weight:500;">Click to upload photo</p>
          <p style="font-size:10px;color:var(--text-muted);opacity:0.55;">JPG, PNG up to 5MB</p>
        </div>
        <input type="file" id="am-photo-input" accept="image/*" style="display:none;">
      </div>
    </div>
    <div class="am-divider"></div>
    <div class="am-form-grid am-form-grid-3" style="margin-bottom:14px;">
      <div class="am-form-group">
        <label class="am-form-label">Title</label>
        <select class="am-inp am-inp-select" id="am-f-title">
          <option value="">Select…</option>
          <option>Mr.</option><option>Mrs.</option><option>Miss</option>
          <option>Dr.</option><option>Rev.</option><option>Prof.</option><option>Apostle</option>
        </select>
      </div>
      <div class="am-form-group am-col2">
        <label class="am-form-label">First Name <span class="am-req">*</span></label>
        <input class="am-inp" id="am-f-first" type="text" placeholder="e.g. Stephen">
        <span class="am-form-error"><i class="bi bi-exclamation-circle" style="font-size:11px;"></i> First name is required</span>
      </div>
      <div class="am-form-group am-col3">
        <label class="am-form-label">Other Names</label>
        <input class="am-inp" id="am-f-other" type="text" placeholder="Middle names (optional)">
      </div>
      <div class="am-form-group am-col3">
        <label class="am-form-label">Last Name <span class="am-req">*</span></label>
        <input class="am-inp" id="am-f-last" type="text" placeholder="e.g. Ankomah">
        <span class="am-form-error"><i class="bi bi-exclamation-circle" style="font-size:11px;"></i> Last name is required</span>
      </div>
    </div>
    <div class="am-divider"></div>
    <p class="am-section-title"><i class="bi bi-people" style="color:var(--caci-success);"></i> Demographics</p>
    <div class="am-form-grid am-form-grid-3">
      <div class="am-form-group">
        <label class="am-form-label">Date of Birth</label>
        <input class="am-inp" id="am-f-dob" type="date">
      </div>
      <div class="am-form-group">
        <label class="am-form-label">Gender <span class="am-req">*</span></label>
        <select class="am-inp am-inp-select" id="am-f-gender">
          <option value="">Select…</option><option value="male">Male</option><option value="female">Female</option>
        </select>
        <span class="am-form-error"><i class="bi bi-exclamation-circle" style="font-size:11px;"></i> Gender is required</span>
      </div>
      <div class="am-form-group">
        <label class="am-form-label">Marital Status</label>
        <select class="am-inp am-inp-select" id="am-f-marital">
          <option value="">Select…</option><option value="single">Single</option>
          <option value="married">Married</option><option value="divorced">Divorced</option>
          <option value="widowed">Widowed</option><option value="separated">Separated</option>
        </select>
      </div>
      <div class="am-form-group am-col3">
        <label class="am-form-label">Occupation</label>
        <input class="am-inp" id="am-f-occupation" type="text" placeholder="e.g. Teacher, Engineer, Student…">
      </div>
    </div>
  </div>
</div>`
}

function _buildStep2(): string {
    return /* html */`
<div id="am-step2" style="display:none;">
  <div class="am-step-head">
    <div>
      <div class="am-step-eyebrow"><i class="bi bi-record-circle-fill" style="font-size:10px;"></i> Step 2 of 4</div>
      <h1>Contact Details</h1>
      <p>Phone, email and address information</p>
    </div>
    <div class="am-step-icon"><i class="bi bi-telephone"></i></div>
  </div>
  <div class="am-step-body">
    <div class="am-form-grid am-form-grid-2" style="margin-bottom:14px;">
      <div class="am-form-group">
        <label class="am-form-label">Primary Phone</label>
        <div class="am-phone-wrap">
          <div class="am-phone-prefix"><span style="font-size:14px;">🇬🇭</span> +233</div>
          <input class="am-inp" id="am-f-phone" type="tel" placeholder="24 123 4567">
        </div>
      </div>
      <div class="am-form-group">
        <label class="am-form-label">Secondary Phone</label>
        <div class="am-phone-wrap">
          <div class="am-phone-prefix"><span style="font-size:14px;">🇬🇭</span> +233</div>
          <input class="am-inp" id="am-f-phone2" type="tel" placeholder="24 123 4567">
        </div>
      </div>
      <div class="am-form-group">
        <label class="am-form-label">Email Address</label>
        <input class="am-inp" id="am-f-email" type="email" placeholder="email@example.com">
      </div>
      <div class="am-form-group">
        <label class="am-form-label">Digital Address (GhanaPost)</label>
        <input class="am-inp" id="am-f-digital-addr" type="text" placeholder="e.g. AK-123-4567">
      </div>
      <div class="am-form-group am-col2">
        <label class="am-form-label">Physical Address</label>
        <textarea class="am-inp" id="am-f-address" placeholder="Home address" style="min-height:68px;"></textarea>
      </div>
    </div>
    <div class="am-divider"></div>
    <p class="am-section-title">
      <i class="bi bi-share" style="color:var(--caci-blue-light);"></i>
      Social Media <span style="font-size:9.5px;font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-muted);">(optional)</span>
    </p>
    <div class="am-form-group" style="margin-bottom:14px;">
      <label class="am-form-label">WhatsApp Number</label>
      <div class="am-phone-wrap">
        <div class="am-phone-prefix"><span style="font-size:14px;">🇬🇭</span> +233</div>
        <input class="am-inp" id="am-f-whatsapp" type="tel" placeholder="+233 24 …">
      </div>
    </div>
    <div class="am-form-grid am-form-grid-2">
      <div class="am-form-group">
        <label class="am-form-label">Facebook URL</label>
        <input class="am-inp" id="am-f-facebook" type="url" placeholder="https://facebook.com/…">
      </div>
      <div class="am-form-group">
        <label class="am-form-label">Instagram URL</label>
        <input class="am-inp" id="am-f-instagram" type="url" placeholder="https://instagram.com/…">
      </div>
    </div>
    <div class="am-divider"></div>
    <p class="am-section-title"><i class="bi bi-shield-exclamation" style="color:var(--amber);"></i> Emergency Contact</p>
    <div class="am-form-grid am-form-grid-3">
      <div class="am-form-group">
        <label class="am-form-label">Full Name</label>
        <input class="am-inp" id="am-f-ec-name" type="text" placeholder="Contact person's name">
      </div>
      <div class="am-form-group">
        <label class="am-form-label">Phone</label>
        <div class="am-phone-wrap">
          <div class="am-phone-prefix"><span style="font-size:14px;">🇬🇭</span> +233</div>
          <input class="am-inp" id="am-f-ec-phone" type="tel" placeholder="24 123 4567">
        </div>
      </div>
      <div class="am-form-group">
        <label class="am-form-label">Relationship</label>
        <select class="am-inp am-inp-select" id="am-f-ec-relation">
          <option value="">Select…</option>
          <option>Spouse</option><option>Parent</option><option>Child</option>
          <option>Sibling</option><option>Friend</option><option>Other</option>
        </select>
      </div>
    </div>
  </div>
</div>`
}

function _buildStep3(): string {
    return /* html */`
<div id="am-step3" style="display:none;">
  <div class="am-step-head">
    <div>
      <div class="am-step-eyebrow"><i class="bi bi-record-circle-fill" style="font-size:10px;"></i> Step 3 of 4</div>
      <h1>Membership Info</h1>
      <p>Membership type and assignment details</p>
    </div>
    <div class="am-step-icon"><i class="bi bi-card-text"></i></div>
  </div>
  <div class="am-step-body">
    <div class="am-form-grid am-form-grid-2">
      <div class="am-form-group">
        <label class="am-form-label">Membership Type <span class="am-req">*</span></label>
        <select class="am-inp am-inp-select" id="am-f-mem-type">
          <option value="">Select…</option>
          <option value="active">Active Member</option>
          <option value="visitor">Visitor</option>
          <option value="prospect">Prospect</option>
          <option value="transfer">Transfer</option>
          <option value="inactive">Inactive</option>
        </select>
        <span class="am-form-error"><i class="bi bi-exclamation-circle" style="font-size:11px;"></i> Membership type is required</span>
      </div>
      <div class="am-form-group">
        <label class="am-form-label">Join Date</label>
        <input class="am-inp" id="am-f-join-date" type="date">
        <span class="am-form-hint">Defaults to today's date</span>
      </div>
      <div class="am-form-group">
        <label class="am-form-label">Household</label>
        <select class="am-inp am-inp-select" id="am-f-household">
          <option value="">None (assign later)</option>
        </select>
        <span class="am-form-hint">Optional — assign to an existing household</span>
      </div>
    </div>
    <div class="am-divider"></div>
    <p class="am-section-title">
      <i class="bi bi-lock-fill" style="color:var(--caci-red);"></i>
      Pastoral Notes <span style="font-size:9.5px;font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-muted);">— staff only, optional</span>
    </p>
    <div class="am-form-group">
      <textarea class="am-inp" id="am-f-pastoral-notes"
                placeholder="Any initial pastoral observations or notes…"
                style="min-height:100px;"></textarea>
    </div>
  </div>
</div>`
}

function _buildStep4(): string {
    return /* html */`
<div id="am-step4" style="display:none;">
  <div class="am-step-head">
    <div>
      <div class="am-step-eyebrow"><i class="bi bi-record-circle-fill" style="font-size:10px;"></i> Step 4 of 4</div>
      <h1>Review &amp; Confirm</h1>
      <p>Verify all details before saving</p>
    </div>
    <div class="am-step-icon"><i class="bi bi-clipboard-check"></i></div>
  </div>
  <div class="am-step-body">
    <div class="am-review-block">
      <div class="am-review-section-title">
        <i class="bi bi-person-fill" style="color:var(--caci-blue);font-size:14px;"></i> Personal
        <button id="am-rev-edit-1">Edit</button>
      </div>
      <div id="am-review-personal"></div>
    </div>
    <div class="am-review-block">
      <div class="am-review-section-title">
        <i class="bi bi-telephone-fill" style="color:var(--caci-success);font-size:14px;"></i> Contact
        <button id="am-rev-edit-2">Edit</button>
      </div>
      <div id="am-review-contact"></div>
    </div>
    <div class="am-review-block">
      <div class="am-review-section-title">
        <i class="bi bi-card-text" style="color:var(--caci-red);font-size:14px;"></i> Membership
        <button id="am-rev-edit-3">Edit</button>
      </div>
      <div id="am-review-membership"></div>
    </div>
    <button class="am-add-queue-btn" id="am-add-queue-btn">
      <i class="bi bi-person-plus" style="font-size:18px;"></i>
      Save &amp; add another member
    </button>
  </div>
</div>`
}

// ── Stepper ───────────────────────────────────────────────────────────────────

function _updateStepper(): void {
    const pct = (_currentStep / _totalSteps) * 100
    const setW = (id: string) => {
        const el = document.getElementById(id)
        if (el) el.style.width = `${pct}%`
    }
    setW('am-sb-prog')
    setW('am-panel-prog')
    setW('am-mob-prog')

    const stepLabel = document.getElementById('am-step-label')
    if (stepLabel) stepLabel.textContent = String(_currentStep)

    for (let i = 1; i <= _totalSteps; i++) {
        const vstep = document.getElementById(`am-vstep${i}`)
        const vi = document.getElementById(`am-vi${i}`)
        const vc = document.getElementById(`am-vc${i}`)
        if (!vstep || !vi) continue

        vstep.classList.remove('active', 'done')
        if (i < _currentStep) {
            vstep.classList.add('done')
            vi.innerHTML = '<i class="bi bi-check" style="font-size:13px;"></i>'
        } else if (i === _currentStep) {
            vstep.classList.add('active')
            vi.textContent = String(i)
        } else {
            vi.textContent = String(i)
        }
        if (vc) vc.classList.toggle('done', i < _currentStep)

        // Show/hide step panels
        const panel = document.getElementById(`am-step${i}`)
        if (panel) panel.style.display = i === _currentStep ? '' : 'none'
    }

    // Footer buttons
    const btnBack = document.getElementById('am-btn-back')
    const btnNext = document.getElementById('am-btn-next')
    const btnQueue = document.getElementById('am-btn-queue')
    const btnSave = document.getElementById('am-btn-save')
    if (btnBack) btnBack.style.display = _currentStep > 1 ? '' : 'none'
    if (btnNext) btnNext.style.display = _currentStep < _totalSteps ? '' : 'none'
    if (btnQueue) btnQueue.style.display = _currentStep === _totalSteps ? '' : 'none'
    if (btnSave) btnSave.style.display = _currentStep === _totalSteps ? '' : 'none'

    // Tip text
    const tip = document.getElementById('am-tip-text')
    if (tip) tip.innerHTML = TIPS[_currentStep - 1]
}

function _goToStep(n: number): void {
    if (n > _currentStep && !_validateStep(_currentStep)) return
    if (n === _totalSteps && _currentStep === _totalSteps - 1) _buildReview()
    if (n >= 1 && n <= _totalSteps) { _currentStep = n; _updateStepper() }
}

function _nextStep(): void {
    if (!_validateStep(_currentStep)) return
    if (_currentStep === _totalSteps - 1) _buildReview()
    if (_currentStep < _totalSteps) { _currentStep++; _updateStepper() }
}

function _prevStep(): void {
    if (_currentStep > 1) { _currentStep--; _updateStepper() }
}

// ── Validation ────────────────────────────────────────────────────────────────

const REQUIRED: Record<number, string[]> = {
    1: ['am-f-first', 'am-f-last', 'am-f-gender'],
    3: ['am-f-mem-type'],
}

function _validateStep(step: number): boolean {
    let ok = true
        ; (REQUIRED[step] ?? []).forEach(id => {
            const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null
            const fg = el?.closest('.am-form-group')
            if (!el?.value.trim()) {
                fg?.classList.add('has-error')
                ok = false
            } else {
                fg?.classList.remove('has-error')
            }
        })
    return ok
}

// ── Form data ─────────────────────────────────────────────────────────────────

function _g(id: string): string {
    return ((document.getElementById(id) as HTMLInputElement | null)?.value ?? '').trim()
}

function _collectFormData(): FormData_ {
    return {
        title: _g('am-f-title'), first: _g('am-f-first'), other: _g('am-f-other'),
        last: _g('am-f-last'), dob: _g('am-f-dob'), gender: _g('am-f-gender'),
        marital: _g('am-f-marital'), occupation: _g('am-f-occupation'),
        phone: _g('am-f-phone'), phone2: _g('am-f-phone2'), email: _g('am-f-email'),
        digital_addr: _g('am-f-digital-addr'), address: _g('am-f-address'),
        whatsapp: _g('am-f-whatsapp'), facebook: _g('am-f-facebook'), instagram: _g('am-f-instagram'),
        ec_name: _g('am-f-ec-name'), ec_phone: _g('am-f-ec-phone'), ec_relation: _g('am-f-ec-relation'),
        mem_type: _g('am-f-mem-type'), join_date: _g('am-f-join-date'),
        household_id: _g('am-f-household'), status: _g('am-f-mem-type'),
        pastoral_notes: _g('am-f-pastoral-notes'),
    }
}

function _mName(d: FormData_): string {
    return [d.title, d.first, d.last].filter(Boolean).join(' ') || 'Unnamed Member'
}

function _mInitials(d: FormData_): string {
    return ((d.first[0] ?? '') + (d.last[0] ?? '')).toUpperCase() || '?'
}

function _resetForm(): void {
    const fields = [
        'am-f-title', 'am-f-first', 'am-f-other', 'am-f-last', 'am-f-dob', 'am-f-gender',
        'am-f-marital', 'am-f-occupation', 'am-f-phone', 'am-f-phone2', 'am-f-email',
        'am-f-digital-addr', 'am-f-address', 'am-f-whatsapp', 'am-f-facebook', 'am-f-instagram',
        'am-f-ec-name', 'am-f-ec-phone', 'am-f-ec-relation', 'am-f-mem-type', 'am-f-household',
        'am-f-pastoral-notes',
    ]
    fields.forEach(id => { const el = document.getElementById(id) as HTMLInputElement | null; if (el) el.value = '' })

    const joinDate = document.getElementById('am-f-join-date') as HTMLInputElement | null
    if (joinDate) joinDate.value = new Date().toISOString().split('T')[0]

    _photoDataUrl = null
    const prev = document.getElementById('am-avatar-preview') as HTMLElement | null
    if (prev) { prev.style.backgroundImage = ''; prev.style.backgroundSize = ''; prev.textContent = '?' }

    const upload = document.getElementById('am-photo-upload')
    if (upload) {
        upload.classList.remove('has-photo')
        upload.innerHTML = `
      <i class="bi bi-image" style="font-size:22px;color:var(--text-muted);"></i>
      <p style="font-size:11.5px;color:var(--text-muted);font-weight:500;">Click to upload photo</p>
      <p style="font-size:10px;color:var(--text-muted);opacity:0.55;">JPG, PNG up to 5MB</p>`
    }
    const photoInput = document.getElementById('am-photo-input') as HTMLInputElement | null
    if (photoInput) photoInput.value = ''

    _editingId = null
    const editBanner = document.getElementById('am-editing-banner')
    editBanner?.classList.remove('visible')
}

function _populateHouseholdDropdown(): void {
    const sel = document.getElementById('am-f-household') as HTMLSelectElement | null
    if (!sel) return
    _householdItems.forEach(h => {
        const opt = document.createElement('option')
        opt.value = h.id
        opt.textContent = h.family_name
        sel.appendChild(opt)
    })
}

// ── Review builder ────────────────────────────────────────────────────────────

function _rv(label: string, value: string): string {
    const v = value.trim()
    return `<div class="am-review-row">
    <span class="am-review-label">${label}</span>
    <span class="am-review-value ${v ? '' : 'am-review-empty'}">${v || '—'}</span>
  </div>`
}

function _buildReview(): void {
    const p = document.getElementById('am-review-personal')
    const c = document.getElementById('am-review-contact')
    const m = document.getElementById('am-review-membership')
    if (p) p.innerHTML =
        _rv('Title', _g('am-f-title')) + _rv('First Name', _g('am-f-first')) +
        _rv('Other Names', _g('am-f-other')) + _rv('Last Name', _g('am-f-last')) +
        _rv('Date of Birth', _g('am-f-dob')) + _rv('Gender', _g('am-f-gender')) +
        _rv('Marital Status', _g('am-f-marital')) + _rv('Occupation', _g('am-f-occupation'))
    if (c) c.innerHTML =
        _rv('Primary Phone', _g('am-f-phone')) + _rv('Secondary Phone', _g('am-f-phone2')) +
        _rv('WhatsApp', _g('am-f-whatsapp')) + _rv('Email', _g('am-f-email')) +
        _rv('Address', _g('am-f-address')) + _rv('Digital Address', _g('am-f-digital-addr')) +
        _rv('Facebook', _g('am-f-facebook')) + _rv('Instagram', _g('am-f-instagram')) +
        _rv('Emergency – Name', _g('am-f-ec-name')) + _rv('Emergency – Phone', _g('am-f-ec-phone')) +
        _rv('Emergency – Relation', _g('am-f-ec-relation'))
    if (m) m.innerHTML =
        _rv('Membership Type', _g('am-f-mem-type')) + _rv('Join Date', _g('am-f-join-date')) +
        _rv('Pastoral Notes', _g('am-f-pastoral-notes'))
}

// ── Queue ops ─────────────────────────────────────────────────────────────────

function _addToQueue(): void {
    if (!_validateStep(_currentStep)) return
    const data = _collectFormData()
    if (_editingId !== null) {
        const idx = _queue.findIndex(m => m.id === _editingId)
        if (idx > -1) { _queue[idx].data = data; _queue[idx].photoDataUrl = _photoDataUrl }
        _editingId = null
        document.getElementById('am-editing-banner')?.classList.remove('visible')
    } else {
        _queue.push({ id: Date.now() + Math.random(), data, photoDataUrl: _photoDataUrl, status: 'pending' })
    }
    _renderSidebarQueue()
    _renderDrawer()
    _resetForm()
    _currentStep = 1
    _updateStepper()
}

function _removeFromQueue(id: number): void {
    _queue = _queue.filter(m => m.id !== id)
    _renderSidebarQueue()
    _renderDrawer()
}

function _editFromQueue(id: number): void {
    const m = _queue.find(x => x.id === id)
    if (!m || m.status !== 'pending') return
    _editingId = id
    const d = m.data
    const fields: Record<string, string> = {
        'am-f-title': d.title, 'am-f-first': d.first, 'am-f-other': d.other,
        'am-f-last': d.last, 'am-f-dob': d.dob, 'am-f-gender': d.gender,
        'am-f-marital': d.marital, 'am-f-occupation': d.occupation,
        'am-f-phone': d.phone, 'am-f-phone2': d.phone2, 'am-f-email': d.email,
        'am-f-digital-addr': d.digital_addr, 'am-f-address': d.address,
        'am-f-whatsapp': d.whatsapp, 'am-f-facebook': d.facebook, 'am-f-instagram': d.instagram,
        'am-f-ec-name': d.ec_name, 'am-f-ec-phone': d.ec_phone, 'am-f-ec-relation': d.ec_relation,
        'am-f-mem-type': d.mem_type, 'am-f-join-date': d.join_date,
        'am-f-household': d.household_id, 'am-f-pastoral-notes': d.pastoral_notes,
    }
    Object.entries(fields).forEach(([id_, val]) => {
        const el = document.getElementById(id_) as HTMLInputElement | null
        if (el) el.value = val
    })
    if (m.photoDataUrl) {
        _photoDataUrl = m.photoDataUrl
        const prev = document.getElementById('am-avatar-preview') as HTMLElement | null
        if (prev) { prev.style.backgroundImage = `url(${m.photoDataUrl})`; prev.style.backgroundSize = 'cover'; prev.textContent = '' }
    }
    const nameEl = document.getElementById('am-editing-name')
    if (nameEl) nameEl.textContent = _mName(d)
    document.getElementById('am-editing-banner')?.classList.add('visible')
    _closeDrawer()
    _currentStep = 1
    _updateStepper()
}

// ── Save member (real API call) ───────────────────────────────────────────────

async function _saveMember(): Promise<void> {
  // Step 1 — collect raw form values
  const data = _collectFormData()

  // Step 2 — Zod parse (includes assembly_id so uuid check passes)
  const raw = {
    assembly_id:                    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', // placeholder — service overrides
    title:                          data.title || null,
    first_name:                     data.first,
    last_name:                      data.last,
    gender:                         data.gender,
    membership_status:              data.mem_type || 'visitor',
    date_of_birth:                  data.dob    || null,
    marital_status:                 data.marital || null,
    primary_phone:                  data.phone   || null,
    secondary_phone:                data.phone2  || null,
    email:                          data.email   || null,
    physical_address:               data.address || null,
    occupation:                     data.occupation || null,
    facebook_url:                   data.facebook   || null,
    whatsapp_number:                data.whatsapp   || null,
    instagram_url:                  data.instagram  || null,
    emergency_contact_name:         data.ec_name    || null,
    emergency_contact_phone:        data.ec_phone   || null,
    emergency_contact_relationship: data.ec_relation || null,
    join_date:                      data.join_date  || null,
    household_id:                   data.household_id || null,
  }

  const parsed = CreateMemberSchema.safeParse(raw)
  if (!parsed.success) {
    _displayZodErrors(parsed.error)
    return
  }

  // Step 3 — disable save button
  const saveBtn = document.getElementById('am-btn-save') as HTMLButtonElement | null
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<span class="am-spinner"></span> Saving…' }

  try {
    // Step 4 — call registerMember (service handles membership number EF, welcome emails etc.)
    const { first_name, last_name, ...rest } = parsed.data
    const payload: Omit<import('../../../types/member.types').CreateMemberPayload, 'assembly_id'> = {
      ...rest,
      first_name,
      last_name,
      pastoral_notes: data.pastoral_notes || null,
    }

    const result = await registerMember(payload)

    // Step 5 — show success
    for (let i = 1; i <= _totalSteps; i++) {
      const el = document.getElementById(`am-step${i}`)
      if (el) el.style.display = 'none'
    }
    const navFooter = document.getElementById('am-nav-footer')
    if (navFooter) navFooter.style.display = 'none'
    const successEl = document.getElementById('am-success')
    if (successEl) successEl.style.display = 'flex'

    const msgEl = document.getElementById('am-success-msg')
    if (msgEl) {
      const num = result.membershipNumber ? ` (${result.membershipNumber})` : ''
      msgEl.textContent = `${result.member.first_name} ${result.member.last_name}${num} has been successfully added to CACI Hub.`
    }

  } catch (err: any) {
    if (saveBtn) {
      saveBtn.disabled = false
      saveBtn.innerHTML = '<i class="bi bi-cloud-upload-fill"></i> Save Member'
    }
    const footer = document.getElementById('am-nav-footer')
    if (footer) {
      footer.querySelector('.am-save-error')?.remove()
      const errDiv = document.createElement('div')
      errDiv.className = 'am-save-error'
      errDiv.style.cssText = 'width:100%;font-size:11.5px;color:var(--text-danger);display:flex;align-items:center;gap:4px;'
      errDiv.innerHTML = `<i class="bi bi-exclamation-circle"></i> ${err?.message ?? 'Save failed. Please try again.'}`
      footer.prepend(errDiv)
    }
  }
}

// ── Zod error display ─────────────────────────────────────────────────────────

function _displayZodErrors(error: ZodError): void {
  // Map Zod field paths back to form group IDs and show errors inline
  const fieldMap: Record<string, string> = {
    first_name:         'am-f-first',
    last_name:          'am-f-last',
    gender:             'am-f-gender',
    membership_status:  'am-f-mem-type',
    email:              'am-f-email',
  }
  // Clear all errors first
  document.querySelectorAll<HTMLElement>('.am-form-group.has-error')
    .forEach(fg => fg.classList.remove('has-error'))

  let firstErrStep = _totalSteps + 1
  const stepFieldMap: Record<string, number> = {
    first_name: 1, last_name: 1, gender: 1,
    membership_status: 3, email: 2,
  }

  error.errors.forEach(e => {
    const field = e.path[0] as string
    const inputId = fieldMap[field]
    if (inputId) {
      const el = document.getElementById(inputId)
      const fg = el?.closest('.am-form-group')
      if (fg) fg.classList.add('has-error')
      const step = stepFieldMap[field] ?? _currentStep
      if (step < firstErrStep) firstErrStep = step
    }
  })

  // Navigate to the first step that has an error
  if (firstErrStep <= _totalSteps) {
    _currentStep = firstErrStep
    _updateStepper()
  }
}

// ── Queue renderer ────────────────────────────────────────────────────────────

function _renderSidebarQueue(): void {
    const total = _queue.length
    const pending = _queue.filter(m => m.status === 'pending').length

    // Queue pill
    const pillBtn = document.getElementById('am-queue-pill-btn')
    const badge = document.getElementById('am-q-badge')
    if (pillBtn) pillBtn.classList.toggle('has-items', total > 0)
    if (badge) { badge.style.display = total > 0 ? '' : 'none'; badge.textContent = String(total) }

    // Sidebar queue section
    const sbQueue = document.getElementById('am-sb-queue')
    if (sbQueue) sbQueue.style.display = total > 0 ? '' : 'none'

    const sqList = document.getElementById('am-sq-list')
    if (sqList) {
        sqList.innerHTML = _queue.map(m => `
      <div class="am-sq-item" data-sq-id="${m.id}">
        <div class="am-sq-avatar" ${m.photoDataUrl ? `style="background-image:url(${m.photoDataUrl});background-size:cover;background-position:center;"` : ''}>
          ${m.photoDataUrl ? '' : _mInitials(m.data)}
        </div>
        <div style="flex:1;min-width:0;">
          <div class="am-sq-name">${_mName(m.data)}</div>
          <div class="am-sq-meta">${m.data.mem_type || 'No type'} · ${m.status === 'pending' ? 'Pending' : 'Uploading…'}</div>
        </div>
        ${m.status === 'pending' ? `
        <div style="display:flex;gap:2px;">
          <button class="am-sq-btn" data-sq-edit="${m.id}" title="Edit"><i class="bi bi-pencil" style="font-size:11px;"></i></button>
          <button class="am-sq-btn del" data-sq-del="${m.id}" title="Remove"><i class="bi bi-trash" style="font-size:11px;"></i></button>
        </div>` : ''}
      </div>`).join('')

        sqList.querySelectorAll<HTMLElement>('[data-sq-edit]').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); _editFromQueue(Number(btn.dataset.sqEdit)) })
        })
        sqList.querySelectorAll<HTMLElement>('[data-sq-del]').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); _removeFromQueue(Number(btn.dataset.sqDel)) })
        })
        sqList.querySelectorAll<HTMLElement>('.am-sq-item').forEach(item => {
            item.addEventListener('click', () => _editFromQueue(Number(item.dataset.sqId)))
        })
    }

    const sbUpload = document.getElementById('am-sb-upload-btn') as HTMLButtonElement | null
    if (sbUpload) sbUpload.disabled = pending === 0 || _isUploading
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function _renderDrawer(): void {
    const body = document.getElementById('am-drawer-body')
    const emptyEl = document.getElementById('am-drawer-empty')
    const total = _queue.length
    const subEl = document.getElementById('am-drawer-sub')
    const counterEl = document.getElementById('am-up-counter')

    if (subEl) subEl.textContent = `${_queue.filter(m => m.status === 'pending').length} pending · ${_uploadedCount} uploaded`
    if (counterEl) counterEl.innerHTML = `Uploaded: <strong>${_uploadedCount}</strong> / <strong>${total + _uploadedCount}</strong>`

    if (!body) return
    if (emptyEl) emptyEl.style.display = total === 0 ? '' : 'none'

    body.querySelectorAll('.am-uq-item').forEach(el => el.remove())

    _queue.forEach(m => {
        const el = document.createElement('div')
        el.className = `am-uq-item ${m.status === 'uploading' ? 'uploading' : ''} ${m.status === 'done' ? 'done' : ''}`
        el.id = `am-uq-${m.id}`
        el.innerHTML = `
      <div class="am-uq-avatar" ${m.photoDataUrl ? `style="background-image:url(${m.photoDataUrl});background-size:cover;background-position:center;"` : ''}>
        ${m.photoDataUrl ? '' : _mInitials(m.data)}
      </div>
      <div style="flex:1;min-width:0;">
        <div class="am-uq-name">${_mName(m.data)}</div>
        <div class="am-uq-sub">${m.data.mem_type || 'No type'} · ${m.data.gender || '—'} · ${m.data.phone || 'No phone'}</div>
        <div class="am-uq-prog"><div class="am-uq-prog-fill" id="am-uqp-${m.id}" style="width:${m.status === 'done' ? 100 : 0}%;"></div></div>
      </div>
      <div style="flex-shrink:0;display:flex;align-items:center;gap:5px;">
        ${m.status === 'pending' ? `
          <button class="am-sq-btn" data-uq-edit="${m.id}" title="Edit" style="width:30px;height:30px;"><i class="bi bi-pencil" style="font-size:13px;"></i></button>
          <button class="am-sq-btn del" data-uq-del="${m.id}" title="Remove" style="width:30px;height:30px;"><i class="bi bi-trash" style="font-size:13px;"></i></button>` : ''}
        ${m.status === 'uploading' ? '<div class="am-spinner"></div>' : ''}
        ${m.status === 'done' ? '<i class="bi bi-check-circle-fill" style="font-size:20px;color:var(--caci-success);"></i>' : ''}
      </div>`
        body.appendChild(el)
        el.querySelector<HTMLElement>('[data-uq-edit]')?.addEventListener('click', e => { e.stopPropagation(); _editFromQueue(m.id) })
        el.querySelector<HTMLElement>('[data-uq-del]')?.addEventListener('click', e => { e.stopPropagation(); _removeFromQueue(m.id) })
    })

    const drawerUpload = document.getElementById('am-drawer-upload-btn') as HTMLButtonElement | null
    if (drawerUpload) drawerUpload.disabled = _queue.filter(m => m.status === 'pending').length === 0 || _isUploading
}

function _openDrawer(): void { document.getElementById('am-overlay')?.classList.add('open') }
function _closeDrawer(): void { document.getElementById('am-overlay')?.classList.remove('open') }

// ── Upload all (queue) — calls real createMember per item ─────────────────────

async function _startUploadAll(): Promise<void> {
    const pending = _queue.filter(m => m.status === 'pending')
    if (!pending.length || _isUploading) return
    _isUploading = true
    _openDrawer()
    _renderSidebarQueue()
    _renderDrawer()

    for (const m of pending) {
        m.status = 'uploading'
        _renderDrawer()

        try {
            const payload: Omit<import('../../../types/member.types').CreateMemberPayload, 'assembly_id'> = {
                title:                          m.data.title || null,
                first_name:                     m.data.first,
                last_name:                      m.data.last,
                other_names:                    m.data.other || null,
                gender:                         m.data.gender as 'male' | 'female',
                membership_status:              (m.data.mem_type || 'visitor') as any,
                date_of_birth:                  m.data.dob || null,
                marital_status:                 (m.data.marital || null) as any,
                primary_phone:                  m.data.phone || null,
                secondary_phone:                m.data.phone2 || null,
                email:                          m.data.email || null,
                physical_address:               m.data.address || null,
                occupation:                     m.data.occupation || null,
                facebook_url:                   m.data.facebook || null,
                whatsapp_number:                m.data.whatsapp || null,
                instagram_url:                  m.data.instagram || null,
                emergency_contact_name:         m.data.ec_name || null,
                emergency_contact_phone:        m.data.ec_phone || null,
                emergency_contact_relationship: m.data.ec_relation || null,
                join_date:                      m.data.join_date || null,
                household_id:                   m.data.household_id || null,
                pastoral_notes:                 m.data.pastoral_notes || null,
            }
            await registerMember(payload)
            m.status = 'done'
            const fill = document.getElementById(`am-uqp-${m.id}`)
            if (fill) fill.style.width = '100%'
            await new Promise(r => setTimeout(r, 500))
            _queue = _queue.filter(x => x.id !== m.id)
            _uploadedCount++
        } catch {
            m.status = 'pending'
        }
        _renderDrawer()
        _renderSidebarQueue()
    }

    _isUploading = false

    if (_queue.length === 0) {
        setTimeout(() => {
            _closeDrawer()
            for (let i = 1; i <= _totalSteps; i++) {
                const el = document.getElementById(`am-step${i}`)
                if (el) el.style.display = 'none'
            }
            const nav = document.getElementById('am-nav-footer')
            if (nav) nav.style.display = 'none'
            const suc = document.getElementById('am-success')
            if (suc) suc.style.display = 'flex'
            const msg = document.getElementById('am-success-msg')
            if (msg) msg.textContent = `${_uploadedCount} member${_uploadedCount !== 1 ? 's' : ''} successfully added to CACI Hub.`
        }, 700)
    }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function _handlePhoto(file: File): void {
    const reader = new FileReader()
    reader.onload = ev => {
        _photoDataUrl = ev.target?.result as string
        const prev = document.getElementById('am-avatar-preview') as HTMLElement | null
        if (prev) { prev.style.backgroundImage = `url(${_photoDataUrl})`; prev.style.backgroundSize = 'cover'; prev.style.backgroundPosition = 'center'; prev.textContent = '' }
        const upload = document.getElementById('am-photo-upload')
        if (upload) {
            upload.classList.add('has-photo')
            upload.innerHTML = '<i class="bi bi-check-circle-fill" style="font-size:22px;color:var(--caci-success);"></i><p style="font-size:11.5px;color:var(--caci-success);font-weight:500;">Photo uploaded</p>'
        }
    }
    reader.readAsDataURL(file)
}

function _updateAvatarPreview(): void {
    const first = _g('am-f-first'); const last = _g('am-f-last')
    const prev = document.getElementById('am-avatar-preview') as HTMLElement | null
    if (prev && !prev.style.backgroundImage) {
        prev.textContent = ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?'
    }
}

function _openAvatarModal(): void {
    const modal = document.getElementById('am-avatar-modal')
    const img = document.getElementById('am-modal-img') as HTMLElement | null
    const nameEl = document.getElementById('am-modal-name')
    const prev = document.getElementById('am-avatar-preview') as HTMLElement | null
    if (!modal || !img) return
    if (prev?.style.backgroundImage) {
        img.style.backgroundImage = prev.style.backgroundImage
        img.style.backgroundSize = 'cover'
        img.style.backgroundPosition = 'center'
        img.textContent = ''
    } else {
        img.style.backgroundImage = ''
        img.style.background = 'linear-gradient(135deg, var(--caci-red), var(--caci-blue))'
        img.textContent = prev?.textContent ?? '?'
    }
    if (nameEl) nameEl.textContent = [_g('am-f-title'), _g('am-f-first'), _g('am-f-last')].filter(Boolean).join(' ')
    modal.classList.add('open')
}

function _closeAvatarModal(): void {
    document.getElementById('am-avatar-modal')?.classList.remove('open')
}

// ── Event binding ─────────────────────────────────────────────────────────────

function _on_<K extends keyof HTMLElementEventMap>(
    el: EventTarget | null, ev: K, fn: (e: HTMLElementEventMap[K]) => void
): void {
    if (!el) return
    el.addEventListener(ev, fn as EventListener)
    _listeners_.push([el, ev, fn as EventListener])
}

function _bindAllEvents(container: HTMLElement): void {
    // Sidebar step clicks
    document.querySelectorAll<HTMLElement>('.am-vstep').forEach(step => {
        _on_(step, 'click', () => _goToStep(Number(step.dataset.step)))
    })

    // Footer nav
    _on_(document.getElementById('am-btn-back'), 'click', _prevStep)
    _on_(document.getElementById('am-btn-next'), 'click', _nextStep)
    _on_(document.getElementById('am-btn-queue'), 'click', _addToQueue)
    _on_(document.getElementById('am-btn-save'), 'click', _saveMember)

    // Review edit shortcuts
    _on_(document.getElementById('am-rev-edit-1'), 'click', () => _goToStep(1))
    _on_(document.getElementById('am-rev-edit-2'), 'click', () => _goToStep(2))
    _on_(document.getElementById('am-rev-edit-3'), 'click', () => _goToStep(3))

    // Add to queue btn in review
    _on_(document.getElementById('am-add-queue-btn'), 'click', _addToQueue)

    // Queue pill + drawer
    _on_(document.getElementById('am-queue-pill-btn'), 'click', () => { _renderDrawer(); _openDrawer() })
    _on_(document.getElementById('am-drawer-close'), 'click', _closeDrawer)
    _on_(document.getElementById('am-overlay'), 'click', (e) => {
        if ((e.target as HTMLElement).id === 'am-overlay') _closeDrawer()
    })
    _on_(document.getElementById('am-drawer-upload-btn'), 'click', _startUploadAll)
    _on_(document.getElementById('am-sb-upload-btn'), 'click', _startUploadAll)
    _on_(document.getElementById('am-drawer-add-btn'), 'click', () => { _closeDrawer(); _resetForm(); _currentStep = 1; _updateStepper() })

    // Cancel edit
    _on_(document.getElementById('am-cancel-edit-btn'), 'click', () => { _editingId = null; _resetForm() })

    // Success actions
    _on_(document.getElementById('am-add-more-btn'), 'click', () => { location.reload() })
    _on_(document.getElementById('am-view-members-btn'), 'click', () => navigate('/members'))

    // Photo
    _on_(document.getElementById('am-photo-upload'), 'click', () => {
        document.getElementById('am-photo-input')?.click()
    })
    _on_(document.getElementById('am-photo-input') as HTMLInputElement, 'change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) _handlePhoto(file)
    })
    _on_(document.getElementById('am-avatar-preview'), 'click', _openAvatarModal)
    _on_(document.getElementById('am-modal-close'), 'click', _closeAvatarModal)
    _on_(document.getElementById('am-avatar-modal'), 'click', (e) => {
        if ((e.target as HTMLElement).id === 'am-avatar-modal') _closeAvatarModal()
    })

    // Live preview update
    _on_(document.getElementById('am-f-first') as HTMLInputElement, 'input', _updateAvatarPreview)
    _on_(document.getElementById('am-f-last') as HTMLInputElement, 'input', _updateAvatarPreview)

    // Clear validation errors on input
    const _onInput = (e: Event) => {
        const fg = (e.target as HTMLElement).closest('.am-form-group')
        if (fg && (e.target as HTMLInputElement).value.trim()) fg.classList.remove('has-error')
    }
    container.addEventListener('input', _onInput)
    _listeners_.push([container, 'input', _onInput as EventListener])

    // Escape closes modals
    const _onKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') { _closeAvatarModal(); _closeDrawer() }
    }
    document.addEventListener('keydown', _onKeydown)
    _listeners_.push([document, 'keydown', _onKeydown as EventListener])

    // Set default join date
    const joinDate = document.getElementById('am-f-join-date') as HTMLInputElement | null
    if (joinDate && !joinDate.value) joinDate.value = new Date().toISOString().split('T')[0]
}