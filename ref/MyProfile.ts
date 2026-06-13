// src/modules/membership/pages/MyProfile.ts
// Member self-profile — digital ID card, personal info, contact, social, church info.
// Every authenticated user can view/manage their own profile record.
// Route: /my-profile  (no permission required)
// Data: members_view WHERE auth_user_id = auth.uid()

import type { PageModule }   from '../../../types/module.types'
import { getCurrentUser }    from '@core/auth'
import { supabase }          from '@core/supabase'
import { navigate }          from '@core/router'
import { renderBreadcrumbs } from '@shell/Breadcrumbs'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { avatarColor, initials, fmtDate } from '../utils/member-helpers'
import { formatPhone, formatDate }       from '@shared/utils/format'
import type { MemberView }   from '../../../types/member.types'

// ── Listener cleanup ──────────────────────────────────────────────────────────
const _listeners: [EventTarget, string, EventListener][] = []

function _on<K extends keyof HTMLElementEventMap>(
  el: EventTarget | null, ev: K, fn: (e: HTMLElementEventMap[K]) => void
): void {
  if (!el) return
  el.addEventListener(ev, fn as EventListener)
  _listeners.push([el, ev, fn as EventListener])
}

function _cleanup(): void {
  _listeners.forEach(([el, ev, fn]) => el.removeEventListener(ev, fn))
  _listeners.length = 0
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS_ID = 'my-profile-css'

const CSS = /* css */`

/* ── Page wrap ──────────────────────────────────────────────────────────── */
.mpr-wrap {
  max-width: 960px;
  margin: 0 auto;
  padding: 14px 16px 80px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
@media (min-width: 640px) { .mpr-wrap { padding: 20px 24px 80px; } }

/* ── Digital ID Card ────────────────────────────────────────────────────── */
.mpr-id-card {
  border-radius: 20px;
  overflow: hidden;
  position: relative;
  background: linear-gradient(135deg, #003578 0%, #004BA0 45%, #1A6FC4 100%);
  box-shadow: 0 12px 40px rgba(0, 75, 160, 0.35), 0 2px 8px rgba(0,0,0,0.15);
  color: #fff;
  min-height: 200px;
}
.mpr-id-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 90% at 90% 60%, rgba(255,255,255,0.08), transparent),
    radial-gradient(ellipse 40% 60% at 5% 10%, rgba(198,0,38,0.15), transparent);
  pointer-events: none;
}
.mpr-id-stripe {
  height: 4px;
  background: linear-gradient(90deg, #C60026, #FF1A46, #C60026);
}
.mpr-id-body {
  position: relative;
  z-index: 1;
  padding: 24px 28px;
  display: flex;
  align-items: flex-start;
  gap: 24px;
}
@media (max-width: 560px) {
  .mpr-id-body { flex-direction: column; align-items: center; padding: 20px; gap: 16px; }
}

/* ── ID Card: left column ────────────────────────────────────────────────── */
.mpr-id-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.mpr-id-avatar-ring {
  padding: 3px;
  border-radius: 50%;
  background: rgba(255,255,255,0.25);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.15);
}
.mpr-id-avatar {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  border: 3px solid rgba(255,255,255,0.3);
  background-size: cover;
  background-position: center;
  cursor: pointer;
  transition: transform 0.2s;
}
.mpr-id-avatar:hover { transform: scale(1.04); }
.mpr-id-scan {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.6);
}

/* ── ID Card: right column ───────────────────────────────────────────────── */
.mpr-id-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.mpr-id-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.mpr-id-org {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mpr-id-org-logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: rgba(255,255,255,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 900;
  color: #fff;
  letter-spacing: -0.05em;
}
.mpr-id-org-name {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.8);
  line-height: 1.3;
}
.mpr-id-name {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
}
@media (max-width: 560px) { .mpr-id-name { text-align: center; font-size: 20px; } }

.mpr-id-title {
  font-size: 13px;
  color: rgba(255,255,255,0.7);
  margin-top: -4px;
}

.mpr-id-fields {
  display: grid;
  grid-template-columns: repeat(2, auto) 1fr;
  gap: 12px 24px;
  align-items: start;
  margin-top: 4px;
}
@media (max-width: 560px) { .mpr-id-fields { grid-template-columns: 1fr 1fr; } }

.mpr-id-field { display: flex; flex-direction: column; gap: 2px; }
.mpr-id-field-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
}
.mpr-id-field-value {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  font-family: var(--font-mono);
}

.mpr-id-number {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  padding: 6px 12px;
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  margin-top: 2px;
  cursor: pointer;
  transition: background 0.15s;
}
.mpr-id-number:hover { background: rgba(255,255,255,0.2); }
.mpr-id-number i { font-size: 11px; color: rgba(255,255,255,0.6); }

/* Status chip on card */
.mpr-id-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.mpr-id-chip.active   { background: rgba(26,127,55,0.25); color: #4ade80; border: 1px solid rgba(74,222,128,0.3); }
.mpr-id-chip.visitor  { background: rgba(77,159,255,0.2); color: #93c5fd; border: 1px solid rgba(147,197,253,0.3); }
.mpr-id-chip.inactive { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.15); }
.mpr-id-chip.prospect { background: rgba(154,103,0,0.25); color: #fbbf24; border: 1px solid rgba(251,191,36,0.3); }
.mpr-id-chip.transfer { background: rgba(77,159,255,0.2); color: #60a5fa; border: 1px solid rgba(96,165,250,0.3); }
.mpr-id-chip.deceased { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.1); }

/* ── Section cards ──────────────────────────────────────────────────────── */
.mpr-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: border-color 0.2s, box-shadow 0.2s;
}
[data-theme="dark"] .mpr-card { background: linear-gradient(145deg, #1c2128, #161b22); }
.mpr-card:hover { border-color: var(--border-strong); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }

.mpr-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 20px;
  border-bottom: 1px solid var(--border-default);
  background: rgba(0,0,0,0.015);
}
[data-theme="dark"] .mpr-card-head { background: rgba(255,255,255,0.015); }
.mpr-card-head-left { display: flex; align-items: center; gap: 10px; }
.mpr-card-icon {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 15px;
}
.mpr-card-title {
  font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 0;
}
.mpr-card-body { padding: 20px 22px; }
@media (max-width: 480px) { .mpr-card-body { padding: 14px 16px; } }

/* ── Field grid ─────────────────────────────────────────────────────────── */
.mpr-fg2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px 28px; }
.mpr-fg3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px 28px; }
@media (max-width: 479px) { .mpr-fg2, .mpr-fg3 { grid-template-columns: 1fr; } }
@media (min-width: 480px) and (max-width: 639px) { .mpr-fg3 { grid-template-columns: repeat(2, 1fr); } }
.mpr-col2 { grid-column: span 2; }
@media (max-width: 479px) { .mpr-col2 { grid-column: span 1; } }

.mpr-field { display: flex; flex-direction: column; gap: 4px; }
.mpr-field-label {
  font-size: 10.5px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--text-muted);
}
.mpr-field-value {
  font-size: 13.5px; color: var(--text-primary); font-weight: 500; line-height: 1.4;
}
.mpr-field-empty { font-size: 13px; color: var(--border-strong); font-style: italic; }
.mpr-field-link {
  color: var(--text-link); display: inline-flex; align-items: center; gap: 4px;
  text-decoration: none; transition: opacity 0.15s; font-size: 13.5px; font-weight: 500;
}
.mpr-field-link:hover { opacity: 0.75; }

/* ── Social pills ───────────────────────────────────────────────────────── */
.mpr-social-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.mpr-social-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-page); color: var(--text-secondary);
  font-size: 13px; font-weight: 500; text-decoration: none;
  transition: all 0.18s;
}
.mpr-social-pill:hover { border-color: var(--border-strong); color: var(--text-primary); transform: translateY(-1px); }
.mpr-social-pill.unset { color: var(--text-muted); font-style: italic; }
.mpr-social-pill i { font-size: 16px; }

/* ── My modules grid ────────────────────────────────────────────────────── */
.mpr-modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
.mpr-module-btn {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 20px 16px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: 14px; cursor: pointer; text-align: center;
  transition: all 0.2s; font-family: var(--font-sans);
  text-decoration: none;
}
.mpr-module-btn:hover { background: var(--bg-card); border-color: var(--caci-blue); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,75,160,0.1); }
.mpr-module-btn:hover .mpr-module-icon { background: rgba(0,75,160,0.1); }
.mpr-module-icon {
  width: 48px; height: 48px; border-radius: 14px;
  background: var(--bg-card); border: 1px solid var(--border-default);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; transition: background 0.2s;
}
.mpr-module-label { font-size: 12.5px; font-weight: 600; color: var(--text-primary); }
.mpr-module-sub   { font-size: 11px; color: var(--text-muted); margin-top: -4px; }
.mpr-module-soon  {
  font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  background: var(--n100); color: var(--n400); padding: 2px 7px; border-radius: 99px;
}

/* ── Edit button ────────────────────────────────────────────────────────── */
.mpr-edit-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 0 14px; height: 34px; border-radius: 10px;
  font-size: 12.5px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--border-default);
  background: var(--bg-card); color: var(--text-secondary);
  transition: all 0.18s; font-family: var(--font-sans);
}
.mpr-edit-btn:hover { border-color: var(--caci-blue); color: var(--caci-blue); background: var(--bg-info); }

/* ── Copy toast ─────────────────────────────────────────────────────────── */
.mpr-copy-toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(12px);
  background: var(--n900); color: #fff; border-radius: 10px; padding: 8px 16px;
  font-size: 12.5px; font-weight: 500; pointer-events: none;
  opacity: 0; transition: opacity 0.2s, transform 0.2s; z-index: 9000;
}
.mpr-copy-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

/* ── Avatar zoom modal ──────────────────────────────────────────────────── */
.mpr-avatar-modal {
  position: fixed; inset: 0; z-index: 8000;
  background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center; gap: 0;
  opacity: 0; pointer-events: none; transition: opacity 0.2s;
}
.mpr-avatar-modal.open { opacity: 1; pointer-events: all; }
.mpr-avatar-modal-inner {
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  padding: 24px; position: relative;
}
.mpr-avatar-modal-img {
  width: 220px; height: 220px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 72px; font-weight: 700; color: #fff;
  background-size: cover; background-position: center;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.mpr-avatar-modal-name { font-size: 22px; font-weight: 700; color: #fff; text-align: center; }
.mpr-avatar-modal-sub  { font-size: 13px; color: rgba(255,255,255,0.6); font-family: var(--font-mono); }
.mpr-avatar-modal-close {
  position: absolute; top: -8px; right: -8px; width: 36px; height: 36px;
  border-radius: 50%; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2);
  color: #fff; display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 16px; transition: background 0.15s;
}
.mpr-avatar-modal-close:hover { background: rgba(255,255,255,0.25); }

/* ── Divider ────────────────────────────────────────────────────────────── */
.mpr-divider { height: 1px; background: var(--border-default); margin: 14px 0; }

/* ── Fade-up animation ──────────────────────────────────────────────────── */
@keyframes mpr-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.mpr-fade-up { animation: mpr-fade-up 0.35s ease both; }
`

// ── Helpers ───────────────────────────────────────────────────────────────────

function _chipHtml(status: string): string {
  const map: Record<string, { icon: string; label: string }> = {
    active:   { icon: 'bi-check-circle-fill', label: 'Active' },
    visitor:  { icon: 'bi-person-walking',    label: 'Visitor' },
    inactive: { icon: 'bi-pause-circle-fill', label: 'Inactive' },
    prospect: { icon: 'bi-person-plus-fill',  label: 'Prospect' },
    transfer: { icon: 'bi-arrow-left-right',  label: 'Transfer' },
    deceased: { icon: 'bi-moon-fill',         label: 'Deceased' },
  }
  const s = map[status] ?? map['inactive']
  return `<span class="mpr-id-chip ${status}"><i class="bi ${s.icon}"></i>${s.label}</span>`
}

function _val(v: string | null | undefined, fallback = '—'): string {
  return v ? v : `<span class="mpr-field-empty">${fallback}</span>`
}

// ── Page HTML ─────────────────────────────────────────────────────────────────

function _html(m: MemberView, assemblyName: string): string {
  const bg       = avatarColor(m.id ?? '')
  const ini      = initials((m.first_name ?? '') + ' ' + (m.last_name ?? ''))
  const fullName = [m.title, m.first_name, m.other_names, m.last_name].filter(Boolean).join(' ')
  const displayName = [m.first_name, m.last_name].filter(Boolean).join(' ')

  const avatarStyle = m.profile_photo_url
    ? `background-image:url(${m.profile_photo_url});`
    : `background:linear-gradient(135deg,${bg},var(--caci-blue));`

  const memberSince = m.join_date ? formatDate(m.join_date) : 'Unknown'

  return /* html */`
<div class="mpr-wrap">

  <!-- ── Digital ID Card ─────────────────────────────────────────────────── -->
  <div class="mpr-id-card mpr-fade-up">
    <div class="mpr-id-stripe"></div>
    <div class="mpr-id-body">

      <!-- Left: avatar + scan label -->
      <div class="mpr-id-left">
        <div class="mpr-id-avatar-ring">
          <div
            class="mpr-id-avatar"
            id="mpr-avatar"
            style="${avatarStyle}"
            title="Click to enlarge"
          >${m.profile_photo_url ? '' : ini}</div>
        </div>
        <span class="mpr-id-scan"><i class="bi bi-person-badge"></i> Member</span>
      </div>

      <!-- Right: card details -->
      <div class="mpr-id-right">
        <div class="mpr-id-header">
          <!-- Org badge -->
          <div class="mpr-id-org">
            <div class="mpr-id-org-logo">C</div>
            <div class="mpr-id-org-name">CACI Hub<br>${assemblyName}</div>
          </div>
          <!-- Status chip -->
          ${_chipHtml(m.membership_status ?? 'inactive')}
        </div>

        <!-- Name -->
        ${m.title ? `<div class="mpr-id-title">${m.title}</div>` : ''}
        <div class="mpr-id-name">${displayName}</div>

        <!-- Membership number -->
        ${m.membership_number ? `
          <div
            class="mpr-id-number"
            id="mpr-copy-num"
            title="Click to copy"
          >
            <i class="bi bi-upc-scan"></i>
            ${m.membership_number}
            <i class="bi bi-copy" style="margin-left:4px;"></i>
          </div>
        ` : `<div style="font-size:12px;color:rgba(255,255,255,0.45);font-style:italic;">Membership number not assigned</div>`}

        <!-- Key fields row -->
        <div class="mpr-id-fields">
          <div class="mpr-id-field">
            <span class="mpr-id-field-label">Member Since</span>
            <span class="mpr-id-field-value">${memberSince}</span>
          </div>
          <div class="mpr-id-field">
            <span class="mpr-id-field-label">Gender</span>
            <span class="mpr-id-field-value">${m.gender ? (m.gender.charAt(0).toUpperCase() + m.gender.slice(1)) : '—'}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── 2-col layout (wide) / stack (narrow) ────────────────────────────── -->
  <div style="display:grid;grid-template-columns:1fr;gap:16px;" class="mpr-grid-outer">

    <!-- Personal Information -->
    <div class="mpr-card mpr-fade-up" style="animation-delay:60ms;">
      <div class="mpr-card-head">
        <div class="mpr-card-head-left">
          <div class="mpr-card-icon" style="background:var(--bg-info);"><i class="bi bi-person-fill" style="color:var(--caci-blue);font-size:15px;"></i></div>
          <h2 class="mpr-card-title">Personal Information</h2>
        </div>
        <button class="mpr-edit-btn" id="mpr-edit-personal">
          <i class="bi bi-pencil"></i> Edit
        </button>
      </div>
      <div class="mpr-card-body">
        <div class="mpr-fg3">
          <div class="mpr-field">
            <span class="mpr-field-label">First Name</span>
            <span class="mpr-field-value">${_val(m.first_name)}</span>
          </div>
          <div class="mpr-field">
            <span class="mpr-field-label">Other Names</span>
            <span class="mpr-field-value">${_val(m.other_names)}</span>
          </div>
          <div class="mpr-field">
            <span class="mpr-field-label">Last Name</span>
            <span class="mpr-field-value">${_val(m.last_name)}</span>
          </div>
          <div class="mpr-field">
            <span class="mpr-field-label">Date of Birth</span>
            <span class="mpr-field-value">${m.date_of_birth ? formatDate(m.date_of_birth) : '<span class="mpr-field-empty">—</span>'}</span>
          </div>
          <div class="mpr-field">
            <span class="mpr-field-label">Gender</span>
            <span class="mpr-field-value">${m.gender ? (m.gender.charAt(0).toUpperCase() + m.gender.slice(1)) : '<span class="mpr-field-empty">—</span>'}</span>
          </div>
          <div class="mpr-field">
            <span class="mpr-field-label">Marital Status</span>
            <span class="mpr-field-value">${m.marital_status ? (m.marital_status.charAt(0).toUpperCase() + m.marital_status.slice(1)) : '<span class="mpr-field-empty">—</span>'}</span>
          </div>
          <div class="mpr-field mpr-col2">
            <span class="mpr-field-label">Occupation</span>
            <span class="mpr-field-value">${_val(m.occupation)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Contact -->
    <div class="mpr-card mpr-fade-up" style="animation-delay:80ms;">
      <div class="mpr-card-head">
        <div class="mpr-card-head-left">
          <div class="mpr-card-icon" style="background:rgba(26,127,55,0.1);"><i class="bi bi-telephone-fill" style="color:var(--caci-success);font-size:15px;"></i></div>
          <h2 class="mpr-card-title">Contact</h2>
        </div>
        <button class="mpr-edit-btn" id="mpr-edit-contact">
          <i class="bi bi-pencil"></i> Edit
        </button>
      </div>
      <div class="mpr-card-body">
        <div class="mpr-fg2">
          <div class="mpr-field">
            <span class="mpr-field-label">Primary Phone</span>
            ${m.primary_phone
              ? `<a class="mpr-field-link" href="tel:${m.primary_phone}">${formatPhone(m.primary_phone)}</a>`
              : `<span class="mpr-field-empty">—</span>`}
          </div>
          <div class="mpr-field">
            <span class="mpr-field-label">Secondary Phone</span>
            ${m.secondary_phone
              ? `<a class="mpr-field-link" href="tel:${m.secondary_phone}">${formatPhone(m.secondary_phone)}</a>`
              : `<span class="mpr-field-empty">—</span>`}
          </div>
          <div class="mpr-field">
            <span class="mpr-field-label">Email</span>
            ${m.email
              ? `<a class="mpr-field-link" href="mailto:${m.email}">${m.email}</a>`
              : `<span class="mpr-field-empty">—</span>`}
          </div>
          <div class="mpr-field">
            <span class="mpr-field-label">WhatsApp</span>
            ${m.whatsapp_number
              ? `<a class="mpr-field-link" href="https://wa.me/${m.whatsapp_number.replace(/\D/g, '')}" target="_blank" rel="noopener">${m.whatsapp_number} <i class="bi bi-box-arrow-up-right" style="font-size:11px;"></i></a>`
              : `<span class="mpr-field-empty">—</span>`}
          </div>
          <div class="mpr-field mpr-col2">
            <span class="mpr-field-label">Physical Address</span>
            <span class="mpr-field-value">${_val(m.physical_address)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Social Profiles -->
    <div class="mpr-card mpr-fade-up" style="animation-delay:100ms;">
      <div class="mpr-card-head">
        <div class="mpr-card-head-left">
          <div class="mpr-card-icon" style="background:rgba(77,159,255,0.1);"><i class="bi bi-share-fill" style="color:var(--caci-blue-light);font-size:14px;"></i></div>
          <h2 class="mpr-card-title">Social Profiles</h2>
        </div>
        <button class="mpr-edit-btn" id="mpr-edit-social">
          <i class="bi bi-pencil"></i> Edit
        </button>
      </div>
      <div class="mpr-card-body">
        <div class="mpr-social-grid">
          ${m.facebook_url
            ? `<a class="mpr-social-pill" href="${m.facebook_url}" target="_blank" rel="noopener"><i class="bi bi-facebook" style="color:#1877f2;"></i> Facebook <i class="bi bi-box-arrow-up-right" style="font-size:10px;opacity:0.5;"></i></a>`
            : `<span class="mpr-social-pill unset"><i class="bi bi-facebook" style="opacity:0.4;"></i> Facebook — Not linked</span>`}
          ${m.instagram_url
            ? `<a class="mpr-social-pill" href="${m.instagram_url}" target="_blank" rel="noopener"><i class="bi bi-instagram" style="color:#e4405f;"></i> Instagram <i class="bi bi-box-arrow-up-right" style="font-size:10px;opacity:0.5;"></i></a>`
            : `<span class="mpr-social-pill unset"><i class="bi bi-instagram" style="opacity:0.4;"></i> Instagram — Not linked</span>`}
        </div>
      </div>
    </div>

    <!-- Church & Household -->
    <div class="mpr-card mpr-fade-up" style="animation-delay:120ms;">
      <div class="mpr-card-head">
        <div class="mpr-card-head-left">
          <div class="mpr-card-icon" style="background:var(--bg-danger);"><i class="bi bi-building-fill" style="color:var(--caci-red);font-size:14px;"></i></div>
          <h2 class="mpr-card-title">Church & Household</h2>
        </div>
        <span style="font-size:10.5px;color:var(--text-muted);font-style:italic;display:flex;align-items:center;gap:5px;"><i class="bi bi-shield-lock" style="font-size:11px;"></i> Managed by admin</span>
      </div>
      <div class="mpr-card-body">
        <div class="mpr-fg2">
          <div class="mpr-field">
            <span class="mpr-field-label">Membership Number</span>
            <span class="mpr-field-value" style="font-family:var(--font-mono);font-size:12.5px;">${_val(m.membership_number)}</span>
          </div>
          <div class="mpr-field">
            <span class="mpr-field-label">Membership Status</span>
            <span class="mpr-field-value">${m.membership_status ? (m.membership_status.charAt(0).toUpperCase() + m.membership_status.replace('_',' ').slice(1)) : '<span class="mpr-field-empty">—</span>'}</span>
          </div>
          <div class="mpr-field">
            <span class="mpr-field-label">Join Date</span>
            <span class="mpr-field-value">${m.join_date ? formatDate(m.join_date) : '<span class="mpr-field-empty">—</span>'}</span>
          </div>
          <div class="mpr-field">
            <span class="mpr-field-label">Assembly</span>
            <span class="mpr-field-value">${_val(assemblyName)}</span>
          </div>
          <div class="mpr-field mpr-col2" id="mpr-household-field">
            <span class="mpr-field-label">Household</span>
            <span class="mpr-field-value mpr-field-empty">—</span>
          </div>
        </div>
      </div>
    </div>

    <!-- My Modules -->
    <div class="mpr-card mpr-fade-up" style="animation-delay:140ms;">
      <div class="mpr-card-head">
        <div class="mpr-card-head-left">
          <div class="mpr-card-icon" style="background:var(--bg-hover);"><i class="bi bi-grid-fill" style="color:var(--text-muted);font-size:14px;"></i></div>
          <h2 class="mpr-card-title">My Hub</h2>
        </div>
      </div>
      <div class="mpr-card-body">
        <div class="mpr-modules-grid">
          ${[
            { icon: 'bi-calendar-check-fill',  color: '#22c55e', bg: 'rgba(26,127,55,0.1)',   label: 'My Attendance',        sub: 'Service history',         path: '/my-attendance',  soon: false },
            { icon: 'bi-wallet2',              color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'My Giving',            sub: 'Contributions & tithes',  path: '/my-giving',      soon: false },
            { icon: 'bi-diagram-3-fill',       color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  label: 'My Groups',            sub: 'Departments & age groups', path: '/my-groups',      soon: false },
            { icon: 'bi-megaphone-fill',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  label: 'Announcements',        sub: 'Assembly notices',        path: '/announcements',  soon: false },
            { icon: 'bi-calendar3',            color: '#ec4899', bg: 'rgba(236,72,153,0.1)',  label: 'Church Calendar',      sub: 'Upcoming services',       path: '/calendar',       soon: false },
          ].map(m => `
            <button class="mpr-module-btn" data-mod-path="${m.path}">
              <div class="mpr-module-icon" style="background:${m.bg};">
                <i class="bi ${m.icon}" style="color:${m.color};"></i>
              </div>
              <div>
                <div class="mpr-module-label">${m.label}</div>
                <div class="mpr-module-sub">${m.sub}</div>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    </div>

  </div>
</div>

<!-- Copy toast -->
<div class="mpr-copy-toast" id="mpr-copy-toast">Copied to clipboard</div>

<!-- Avatar zoom modal -->
<div class="mpr-avatar-modal" id="mpr-avatar-modal">
  <div class="mpr-avatar-modal-inner">
    <div class="mpr-avatar-modal-img" id="mpr-modal-img"></div>
    <div class="mpr-avatar-modal-name" id="mpr-modal-name"></div>
    <div class="mpr-avatar-modal-sub" id="mpr-modal-sub"></div>
    <button class="mpr-avatar-modal-close" id="mpr-modal-close"><i class="bi bi-x-lg"></i></button>
  </div>
</div>
`
}

// ── Helpers: copy + modal + household ────────────────────────────────────────

function _showCopyToast(): void {
  const t = document.getElementById('mpr-copy-toast')
  if (!t) return
  t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), 2200)
}

function _openAvatarModal(m: MemberView, fullName: string, ini: string, bg: string): void {
  const modal  = document.getElementById('mpr-avatar-modal')
  const img    = document.getElementById('mpr-modal-img') as HTMLElement | null
  const nameEl = document.getElementById('mpr-modal-name')
  const subEl  = document.getElementById('mpr-modal-sub')
  if (!modal || !img) return
  if (m.profile_photo_url) {
    img.style.backgroundColor = 'transparent'
    img.style.backgroundImage = `url(${m.profile_photo_url})`
    img.textContent = ''
  } else {
    img.style.backgroundImage = ''
    img.style.background = `linear-gradient(135deg,${bg},var(--caci-blue))`
    img.textContent = ini
  }
  if (nameEl) nameEl.textContent = fullName
  if (subEl)  subEl.textContent  = m.membership_number ?? ''
  modal.classList.add('open')
}

function _closeAvatarModal(): void {
  document.getElementById('mpr-avatar-modal')?.classList.remove('open')
}

// ── Module ────────────────────────────────────────────────────────────────────

export default {
  async render(container: HTMLElement): Promise<void> {
    _cleanup()

    // Inject CSS once
    if (!document.getElementById(CSS_ID)) {
      const s = document.createElement('style')
      s.id = CSS_ID
      s.textContent = CSS
      document.head.appendChild(s)
    }

    // Skeleton while loading
    renderSkeleton(container, 4)

    try {
      const user = getCurrentUser()
      if (!user) { navigate('/login'); return }

      // Fetch own member record via auth_user_id link
      const { data: memberRaw, error: memberErr } = await supabase
        .from('members_view')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (memberErr) throw memberErr

      // User is authenticated but has no linked member record
      if (!memberRaw) {
        container.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
            min-height:55vh;gap:12px;font-family:var(--font-sans);text-align:center;padding:24px;">
            <div style="width:64px;height:64px;border-radius:50%;background:var(--bg-page);border:1px solid var(--border-default);
              display:flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:8px;">
              <i class="bi bi-person-x" style="color:var(--text-muted);"></i>
            </div>
            <h2 style="margin:0;font-size:1.1rem;font-weight:600;color:var(--text-primary);">No member record linked</h2>
            <p style="margin:0;font-size:0.875rem;color:var(--text-secondary);max-width:360px;line-height:1.6;">
              Your account hasn't been linked to a member profile yet. Please contact your assembly administrator.
            </p>
          </div>
        `
        renderBreadcrumbs(container, [{ label: 'My Profile' }])
        return
      }

      const m = memberRaw as unknown as MemberView

      // Fetch assembly name
      let assemblyName = 'My Assembly'
      if (m.assembly_id) {
        const { data: asm } = await supabase
          .from('assemblies')
          .select('name')
          .eq('id', m.assembly_id)
          .maybeSingle()
        if (asm) assemblyName = (asm as any).name
      }

      // Render page
      container.innerHTML = _html(m, assemblyName)
      renderBreadcrumbs(container, [{ label: 'My Profile' }])

      // Hydrate household name if linked
      if (m.household_id) {
        const { data: hh } = await supabase
          .from('households')
          .select('family_name')
          .eq('id', m.household_id)
          .maybeSingle()
        const hhField = document.getElementById('mpr-household-field')
        if (hhField && hh) {
          const name = (hh as any).family_name ?? '—'
          hhField.innerHTML = `
            <span class="mpr-field-label">Household</span>
            <span class="mpr-field-value">${name}</span>
          `
        }
      }

      // ── Bind events ─────────────────────────────────────────────────────
      const bg       = avatarColor(m.id ?? '')
      const ini      = initials((m.first_name ?? '') + ' ' + (m.last_name ?? ''))
      const fullName = [m.title, m.first_name, m.other_names, m.last_name].filter(Boolean).join(' ')

      // Avatar → zoom modal
      _on(document.getElementById('mpr-avatar'), 'click', () => _openAvatarModal(m, fullName, ini, bg))
      _on(document.getElementById('mpr-modal-close'), 'click', _closeAvatarModal)
      _on(document.getElementById('mpr-avatar-modal'), 'click', (e) => {
        if ((e.target as HTMLElement).id === 'mpr-avatar-modal') _closeAvatarModal()
      })
      const _onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') _closeAvatarModal() }
      document.addEventListener('keydown', _onKey)
      _listeners.push([document, 'keydown', _onKey as EventListener])

      // Copy membership number
      _on(document.getElementById('mpr-copy-num'), 'click', () => {
        if (m.membership_number) {
          navigator.clipboard.writeText(m.membership_number).then(_showCopyToast).catch(() => {})
        }
      })

      // Edit buttons → navigate to EditMember for own record
      // (EditMember handles rendering own-profile edit with restricted fields at app layer)
      const editPath = m.id ? `/members/${m.id}/edit` : '/settings'
      _on(document.getElementById('mpr-edit-personal'), 'click', () => navigate(editPath))
      _on(document.getElementById('mpr-edit-contact'),  'click', () => navigate(editPath))
      _on(document.getElementById('mpr-edit-social'),   'click', () => navigate(editPath))

      // My module links
      container.querySelectorAll<HTMLElement>('[data-mod-path]').forEach(btn => {
        _on(btn, 'click', () => navigate(btn.dataset.modPath ?? '/home'))
      })

    } catch (err) {
      renderError(container, err, 'Failed to load your profile.')
    }
  },

  destroy(): void {
    _cleanup()
  }
} satisfies PageModule
