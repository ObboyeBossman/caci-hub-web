// src/modules/membership/pages/MemberProfile.ts
// Read-only member profile — hero card, personal/contact/emergency/pastoral sections,
// membership sidebar, linked modules, record info.
// Mirrors: caci-member-detail.html reference design.
// Data: getMember(id) from repository.ts
// Route param: container.dataset.id

import type { PageModule }   from '../../../types/module.types'
import { navigate }          from '@core/router'
import { getCurrentUser }    from '@core/auth'
import { can }               from '@core/authorization/authorization-service'
import { getMember }         from '../repository'
import { getMemberAuditLog } from '../repository'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { renderBreadcrumbs } from '@shell/Breadcrumbs'
import { avatarColor, initials, fmtDate } from '../utils/member-helpers'
import { formatPhone, formatDate } from '@shared/utils/format'
import type { MemberView }   from '../../../types/member.types'

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = /* css */`
/* ═══════════════════════════════════════════════════════════════════
   MEMBER PROFILE PAGE
═══════════════════════════════════════════════════════════════════ */

.mp-wrap {
  max-width: 960px;
  margin: 0 auto;
  padding: 14px 16px 64px;
}
@media (min-width: 480px) { .mp-wrap { padding: 18px 20px 64px; } }
@media (min-width: 640px) { .mp-wrap { padding: 18px 24px 64px; } }

/* ── Hero ───────────────────────────────────────────────────── */
.mp-hero {
  border: 1px solid var(--border-default);
  border-radius: 20px; overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.08);
  position: relative;
  background: linear-gradient(160deg, var(--bg-card) 0%, var(--bg-info) 60%, var(--border-default) 100%);
}
[data-theme="dark"] .mp-hero {
  background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
}
.mp-hero::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse 60% 80% at 85% 50%, rgba(198,0,38,0.07), transparent);
}
[data-theme="light"] .mp-hero::before {
  background:
    radial-gradient(ellipse 70% 100% at 90% 50%, rgba(0,75,160,0.06), transparent),
    radial-gradient(ellipse 40% 60% at 10% 0%, rgba(198,0,38,0.04), transparent);
}
.mp-hero-stripe {
  height: 3px;
  background: linear-gradient(90deg, var(--caci-red), var(--caci-red-light), var(--caci-blue), var(--caci-blue-light));
}
.mp-hero-body { position: relative; z-index: 1; padding: 24px 28px; }
@media (max-width: 480px) { .mp-hero-body { padding: 18px 18px; } }

/* ── Avatar ring ────────────────────────────────────────────── */
.mp-avatar-ring {
  padding: 3px; border-radius: 50%; flex-shrink: 0;
  background: conic-gradient(#22c55e 0deg 285deg, rgba(26,127,55,0.25) 285deg 360deg);
  box-shadow: 0 0 20px rgba(26,127,55,0.3);
  animation: mp-ring-pulse 2.5s infinite;
}
@keyframes mp-ring-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.35); }
  50%      { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
}
.mp-avatar-inner {
  width: 96px; height: 96px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 30px; font-weight: 700; color: #fff;
  border: 3px solid var(--bg-card);
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  background-size: cover; background-position: center;
}

/* ── Meta pills ─────────────────────────────────────────────── */
.mp-meta-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 99px;
  background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18);
  font-size: 12px; color: rgba(255,255,255,0.9);
  transition: background 0.2s;
}
[data-theme="light"] .mp-meta-pill {
  background: #ffffff; border: 1px solid #e6edf3;
  color: #6e7681; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
[data-theme="light"] .mp-meta-pill i { color: var(--caci-blue); }

/* ── Toolbar ────────────────────────────────────────────────── */
.mp-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 16px; flex-wrap: wrap;
}
.mp-act-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 0 14px; height: 36px; border-radius: 10px;
  font-size: 12.5px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--border-default);
  background: var(--bg-card); color: var(--text-secondary);
  transition: all 0.18s; font-family: var(--font-sans); white-space: nowrap;
  text-decoration: none;
}
.mp-act-btn:hover { border-color: var(--border-strong); color: var(--text-primary); transform: translateY(-1px); box-shadow: var(--shadow-overlay); }
.mp-act-btn:active { transform: translateY(0); }
.mp-act-btn-primary { background: var(--caci-blue); border-color: var(--caci-blue-dim); color: #fff; font-weight: 600; box-shadow: 0 2px 8px rgba(0,75,160,0.3); }
.mp-act-btn-primary:hover { background: var(--caci-blue-light); border-color: var(--caci-blue); color: #fff; }
.mp-act-btn-danger { border-color: rgba(198,0,38,0.3); color: var(--text-danger); }
.mp-act-btn-danger:hover { background: var(--bg-danger); border-color: rgba(198,0,38,0.5); color: var(--text-danger); }

/* ── Two-column grid ────────────────────────────────────────── */
.mp-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 1024px) {
  .mp-grid { grid-template-columns: 2fr 1fr; }
}

/* ── Section cards ──────────────────────────────────────────── */
.mp-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default); border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.07);
  transition: border-color 0.2s, box-shadow 0.2s;
}
[data-theme="dark"] .mp-card { background: linear-gradient(145deg, #1c2128, #161b22); }
.mp-card:hover { border-color: var(--border-strong); box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
.mp-card-head {
  display: flex; align-items: center; gap: 10px;
  padding: 13px 20px; border-bottom: 1px solid var(--border-default);
  background: rgba(0,0,0,0.015);
}
[data-theme="dark"] .mp-card-head { background: rgba(255,255,255,0.015); }
.mp-card-icon {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 16px;
}
.mp-card-body { padding: 20px 22px; }
@media (max-width: 480px) { .mp-card-body { padding: 14px 16px; } }

/* ── Fields ─────────────────────────────────────────────────── */
.mp-field-grid-2 { display: grid; grid-template-columns: repeat(2,1fr); gap: 20px 24px; }
.mp-field-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px 24px; }
@media (max-width: 479px) {
  .mp-field-grid-2, .mp-field-grid-3 { grid-template-columns: 1fr; }
}
@media (min-width: 480px) and (max-width: 639px) {
  .mp-field-grid-3 { grid-template-columns: repeat(2,1fr); }
}
.mp-col2 { grid-column: span 2; }
.mp-col3 { grid-column: span 3; }
@media (max-width: 479px) { .mp-col2, .mp-col3 { grid-column: span 1; } }

.mp-field { display: flex; flex-direction: column; gap: 4px; }
.mp-field-label {
  font-size: 10.5px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--text-muted);
}
.mp-field-value { font-size: 13.5px; color: var(--text-primary); font-weight: 500; line-height: 1.4; }
.mp-field-mono  { font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary); letter-spacing: 0.03em; }
.mp-field-empty { font-size: 13px; color: var(--border-strong); font-style: italic; }
.mp-field-link  {
  color: var(--text-link); display: inline-flex; align-items: center; gap: 4px;
  text-decoration: none; transition: opacity 0.15s;
}
.mp-field-link:hover { opacity: 0.8; text-decoration: underline; }

/* ── Divider ────────────────────────────────────────────────── */
.mp-divider { height: 1px; background: var(--border-default); margin: 18px 0; }

/* ── Badges ─────────────────────────────────────────────────── */
.mp-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 99px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.03em;
}
.mp-badge-green  { background: var(--bg-success); border: 1px solid rgba(26,127,55,0.25);  color: var(--caci-success); }
.mp-badge-blue   { background: var(--bg-info);    border: 1px solid rgba(0,75,160,0.25);   color: var(--text-link); }
.mp-badge-red    { background: var(--bg-danger);  border: 1px solid rgba(198,0,38,0.25);   color: var(--text-danger); }
.mp-badge-amber  { background: var(--bg-warning); border: 1px solid rgba(154,103,0,0.25);  color: var(--amber); }
.mp-badge-gray   { background: var(--bg-hover);   border: 1px solid var(--border-default); color: var(--text-secondary); }

/* ── Module link rows ───────────────────────────────────────── */
.mp-mod-link {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 13px; border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-page); text-decoration: none; color: inherit;
  transition: all 0.2s cubic-bezier(0.16,1,0.3,1); cursor: pointer;
}
.mp-mod-link:hover {
  border-color: rgba(198,0,38,0.3);
  background: var(--bg-card); transform: translateX(3px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}
.mp-mod-link:hover .mp-mod-arrow { color: var(--caci-red); transform: translateX(3px); }
.mp-mod-icon {
  width: 38px; height: 38px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 18px;
}
.mp-mod-arrow { color: var(--text-muted); transition: all 0.2s; font-size: 15px; }

/* ── Record timeline ────────────────────────────────────────── */
.mp-record-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
.mp-record-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--border-strong); }
.mp-record-dot.active { background: var(--caci-success); }

/* ── Deactivate modal ───────────────────────────────────────── */
.mp-modal-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 16px;
}

/* ── Animations ─────────────────────────────────────────────── */
@keyframes mp-fade-up { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
.mp-fade-up { animation: mp-fade-up 0.45s cubic-bezier(0.16,1,0.3,1) both; }
`

function injectCSS(): void {
  if (document.getElementById('mp-css')) return
  const s = document.createElement('style')
  s.id = 'mp-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

// ── Page Module ───────────────────────────────────────────────────────────────

const MemberProfilePage: PageModule = { render: _render, destroy: _destroy }
export default MemberProfilePage

// ── State ─────────────────────────────────────────────────────────────────────

let _member: MemberView | null = null
let _destroyed = false
let _listeners: Array<[EventTarget, string, EventListener]> = []

// ── Lifecycle ─────────────────────────────────────────────────────────────────

async function _render(container: HTMLElement): Promise<void> {
  _destroyed = false
  _listeners = []
  _member    = null
  injectCSS()

  const memberId = container.dataset.id ?? ''
  if (!memberId) { renderError(container, new Error('No member ID')); return }

  renderSkeleton(container, 'profile')

  try {
    _member = await getMember(memberId)
    if (_destroyed) return
    _mount(container)
  } catch (err) {
    if (_destroyed) return
    renderError(container, err, { retry: () => _render(container) })
  }
}

function _destroy(): void {
  _destroyed = true
  _listeners.forEach(([el, ev, fn]) => el.removeEventListener(ev, fn))
  _listeners = []
  _member    = null
}

// ── Mount ─────────────────────────────────────────────────────────────────────

function _mount(container: HTMLElement): void {
  if (!_member) return
  const m        = _member
  const user     = getCurrentUser()
  const canEdit  = user ? can(user, 'members.edit') : false
  const canNotes = user ? can(user, 'members.edit') : false

  const fullName = [m.title, m.first_name, m.last_name].filter(Boolean).join(' ')
  const ini      = initials(m.first_name ?? '', m.last_name ?? '')
  const bg       = avatarColor(fullName)

  container.innerHTML = ''

  // Wrap — breadcrumb toolbar + page content share the same max-width
  const wrap = document.createElement('div')
  wrap.className = 'mp-wrap'

  // Build trailing action buttons (only when canEdit)
  let trailing: HTMLElement | undefined
  if (canEdit) {
    trailing = document.createElement('div')
    trailing.style.cssText = 'display:flex;gap:8px;align-items:center;'
    trailing.innerHTML = `
      <button class="mp-act-btn mp-act-btn-danger" id="mp-deactivate-btn"
              style="${m.is_active ? '' : 'display:none;'}">
        <i class="bi bi-person-dash" style="font-size:14px;"></i>
        <span class="mp-btn-label">Deactivate</span>
      </button>
      <button class="mp-act-btn mp-act-btn-primary" id="mp-edit-btn">
        <i class="bi bi-pencil-fill" style="font-size:13px;"></i>
        Edit Member
      </button>
    `
  }

  renderBreadcrumbs(wrap, [
    { label: 'Members', path: '/members' },
    { label: fullName },
  ], { trailing })

  const pageDiv = document.createElement('div')
  pageDiv.innerHTML = _buildPage(m, fullName, ini, bg, canEdit, canNotes)
  while (pageDiv.firstChild) wrap.appendChild(pageDiv.firstChild)

  container.appendChild(wrap)

  _bindEvents(container, m, canEdit)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _field(label: string, value: string | null | undefined, opts: {
  mono?: boolean; link?: string; linkHref?: string; empty?: string; fullWidth?: boolean
} = {}): string {
  const cls = opts.fullWidth ? 'mp-field mp-col2' : 'mp-field'
  if (!value?.trim()) {
    return `<div class="${cls}">
      <span class="mp-field-label">${label}</span>
      <span class="mp-field-empty">${opts.empty ?? '—'}</span>
    </div>`
  }
  const valClass = opts.mono ? 'mp-field-value mp-field-mono' : 'mp-field-value'
  const inner = opts.link
    ? `<a href="${opts.link}" class="mp-field-link">${value}</a>`
    : `<span class="${valClass}">${value}</span>`
  return `<div class="${cls}">
    <span class="mp-field-label">${label}</span>
    ${inner}
  </div>`
}

function _statusBadge(status: string): string {
  const map: Record<string, [string, string]> = {
    active:   ['mp-badge-green', 'Active'],
    inactive: ['mp-badge-gray',  'Inactive'],
    visitor:  ['mp-badge-blue',  'Visitor'],
    prospect: ['mp-badge-amber', 'Prospect'],
    transfer: ['mp-badge-blue',  'Transfer'],
    deceased: ['mp-badge-gray',  'Deceased'],
  }
  const [cls, label] = map[status] ?? ['mp-badge-gray', status]
  const dot = status === 'active'
    ? `<span style="width:6px;height:6px;border-radius:50%;background:var(--caci-success);display:inline-block;"></span>`
    : ''
  return `<span class="mp-badge ${cls}">${dot}${label}</span>`
}

function _cap(s: string | null | undefined): string {
  if (!s) return '—'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Page HTML ─────────────────────────────────────────────────────────────────

function _buildPage(
  m: MemberView,
  fullName: string,
  ini: string,
  bg: string,
  canEdit: boolean,
  canNotes: boolean,
): string {
  const joinMonthYear = m.join_date
    ? new Date(m.join_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null
  const householdName = (m as any).households?.family_name ?? null
  const householdId   = m.household_id

  return /* html */`
<!-- Hero -->
<div class="mp-hero mp-fade-up" style="animation-delay:40ms; margin-bottom:16px;">
  <div class="mp-hero-stripe"></div>
  <div class="mp-hero-body">
    <div style="display:flex;flex-direction:column;gap:20px;align-items:flex-start;">
      <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;width:100%;">

        <!-- Avatar -->
        <div style="position:relative;flex-shrink:0;">
          <div class="mp-avatar-ring">
            <div class="mp-avatar-inner" id="mp-avatar"
                 style="background-color:${bg};${m.profile_photo_url ? `background-image:url(${m.profile_photo_url});` : ''}">
              ${m.profile_photo_url ? '' : ini}
            </div>
          </div>
          <div style="position:absolute;bottom:4px;right:4px;
                      width:18px;height:18px;border-radius:50%;
                      background:${m.is_active ? 'var(--caci-success)' : 'var(--border-strong)'};
                      border:3px solid var(--bg-card);
                      box-shadow:0 1px 4px rgba(0,0,0,0.2);"></div>
        </div>

        <!-- Name block -->
        <div style="flex:1;min-width:0;">
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:4px;">
            <h1 style="font-size:22px;font-weight:700;color:var(--text-primary);line-height:1.2;">
              ${fullName}
            </h1>
            ${_statusBadge(m.membership_status ?? 'inactive')}
          </div>
          <p style="font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);
                    margin-bottom:14px;letter-spacing:0.04em;">
            ${m.membership_number ?? 'No membership number'}
          </p>
          <!-- Meta pills -->
          <div style="display:flex;flex-wrap:wrap;gap:7px;">
            ${m.occupation    ? `<span class="mp-meta-pill"><i class="bi bi-briefcase" style="font-size:13px;"></i>${m.occupation}</span>` : ''}
            ${joinMonthYear   ? `<span class="mp-meta-pill"><i class="bi bi-calendar3" style="font-size:13px;"></i>Joined ${joinMonthYear}</span>` : ''}
            ${m.gender        ? `<span class="mp-meta-pill"><i class="bi bi-person" style="font-size:13px;"></i>${_cap(m.gender)}</span>` : ''}
            ${m.marital_status ? `<span class="mp-meta-pill"><i class="bi bi-heart" style="font-size:13px;"></i>${_cap(m.marital_status)}</span>` : ''}
            ${householdName   ? `<span class="mp-meta-pill"><i class="bi bi-house-fill" style="font-size:13px;"></i>${householdName}</span>` : ''}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Two-column grid -->
<div class="mp-grid">

  <!-- ══ LEFT (2/3) ══ -->
  <div style="display:flex;flex-direction:column;gap:16px;">

    <!-- Personal Information -->
    <div class="mp-card mp-fade-up" style="animation-delay:80ms;">
      <div class="mp-card-head">
        <div class="mp-card-icon" style="background:var(--bg-info);">
          <i class="bi bi-person-fill" style="color:var(--caci-blue);"></i>
        </div>
        <div style="flex:1;">
          <h2 style="font-size:13px;font-weight:600;color:var(--text-primary);">Personal Information</h2>
        </div>
      </div>
      <div class="mp-card-body">
        <div class="mp-field-grid-3">
          ${_field('Title',          m.title)}
          ${_field('First Name',     m.first_name)}
          ${_field('Last Name',      m.last_name)}
          ${_field('Other Names',    m.other_names)}
          ${_field('Date of Birth',  m.date_of_birth ? formatDate(m.date_of_birth) : null)}
          ${_field('Gender',         _cap(m.gender))}
          ${_field('Marital Status', _cap(m.marital_status ?? null))}
          ${_field('Occupation',     m.occupation)}
          <div class="mp-field">
            <span class="mp-field-label">Membership Type</span>
            ${_statusBadge(m.membership_status ?? 'inactive')}
          </div>
        </div>
      </div>
    </div>

    <!-- Contact Information -->
    <div class="mp-card mp-fade-up" style="animation-delay:120ms;">
      <div class="mp-card-head">
        <div class="mp-card-icon" style="background:rgba(26,127,55,0.1);">
          <i class="bi bi-telephone-fill" style="color:var(--caci-success);"></i>
        </div>
        <div style="flex:1;">
          <h2 style="font-size:13px;font-weight:600;color:var(--text-primary);">Contact Information</h2>
        </div>
      </div>
      <div class="mp-card-body">
        <div class="mp-field-grid-2">
          <div class="mp-field">
            <span class="mp-field-label">Primary Phone</span>
            ${m.primary_phone
              ? `<a href="tel:${m.primary_phone}" class="mp-field-value mp-field-link">
                   <i class="bi bi-telephone" style="font-size:13px;"></i>
                   ${formatPhone(m.primary_phone)}
                 </a>`
              : `<span class="mp-field-empty">—</span>`}
          </div>
          <div class="mp-field">
            <span class="mp-field-label">Secondary Phone</span>
            ${m.secondary_phone
              ? `<a href="tel:${m.secondary_phone}" class="mp-field-value mp-field-link">
                   <i class="bi bi-telephone" style="font-size:13px;"></i>
                   ${formatPhone(m.secondary_phone)}
                 </a>`
              : `<span class="mp-field-empty">—</span>`}
          </div>
          <div class="mp-field">
            <span class="mp-field-label">WhatsApp</span>
            ${m.whatsapp_number
              ? `<a href="https://wa.me/${m.whatsapp_number.replace(/\D/g,'')}" target="_blank"
                    class="mp-field-value mp-field-link">
                   <i class="bi bi-whatsapp" style="font-size:13px;color:#25d366;"></i>
                   ${formatPhone(m.whatsapp_number)}
                 </a>`
              : `<span class="mp-field-empty">—</span>`}
          </div>
          <div class="mp-field">
            <span class="mp-field-label">Email Address</span>
            ${m.email
              ? `<a href="mailto:${m.email}" class="mp-field-value mp-field-link">
                   <i class="bi bi-envelope" style="font-size:13px;"></i>${m.email}
                 </a>`
              : `<span class="mp-field-empty">—</span>`}
          </div>
          <div class="mp-field mp-col2">
            <span class="mp-field-label">Physical Address</span>
            ${m.physical_address
              ? `<span class="mp-field-value">${m.physical_address}</span>`
              : `<span class="mp-field-empty">—</span>`}
          </div>
        </div>

        <div class="mp-divider"></div>
        <p style="font-size:10.5px;font-weight:600;text-transform:uppercase;
                  letter-spacing:0.07em;color:var(--text-muted);margin-bottom:16px;">
          Social Media
        </p>
        <div class="mp-field-grid-2">
          <div class="mp-field">
            <span class="mp-field-label">Facebook</span>
            ${m.facebook_url
              ? `<a href="${m.facebook_url}" target="_blank" class="mp-field-value mp-field-link">
                   <i class="bi bi-facebook" style="font-size:13px;color:#1877f2;"></i>
                   ${m.facebook_url.replace(/^https?:\/\/(www\.)?facebook\.com\//,'').slice(0,28)}
                 </a>`
              : `<span class="mp-field-empty">—</span>`}
          </div>
          <div class="mp-field">
            <span class="mp-field-label">Instagram</span>
            ${m.instagram_url
              ? `<a href="${m.instagram_url}" target="_blank" class="mp-field-value mp-field-link">
                   <i class="bi bi-instagram" style="font-size:13px;color:#e1306c;"></i>
                   ${m.instagram_url.replace(/^https?:\/\/(www\.)?instagram\.com\//,'').slice(0,28)}
                 </a>`
              : `<span class="mp-field-empty">—</span>`}
          </div>
        </div>
      </div>
    </div>

    <!-- Emergency Contact -->
    <div class="mp-card mp-fade-up" style="animation-delay:160ms;">
      <div class="mp-card-head">
        <div class="mp-card-icon" style="background:var(--bg-warning);">
          <i class="bi bi-shield-exclamation" style="color:var(--amber);font-size:16px;"></i>
        </div>
        <div style="flex:1;">
          <h2 style="font-size:13px;font-weight:600;color:var(--text-primary);">Emergency Contact</h2>
        </div>
      </div>
      <div class="mp-card-body">
        ${m.emergency_contact_name || m.emergency_contact_phone
          ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px 24px;">
               ${_field('Full Name', m.emergency_contact_name)}
               <div class="mp-field">
                 <span class="mp-field-label">Phone</span>
                 ${m.emergency_contact_phone
                   ? `<a href="tel:${m.emergency_contact_phone}" class="mp-field-value mp-field-link">
                        <i class="bi bi-telephone" style="font-size:13px;"></i>
                        ${formatPhone(m.emergency_contact_phone)}
                      </a>`
                   : `<span class="mp-field-empty">—</span>`}
               </div>
               ${_field('Relationship', m.emergency_contact_relationship)}
             </div>`
          : `<div style="background:var(--bg-page);border:1px dashed var(--border-default);
                         border-radius:10px;padding:20px;text-align:center;">
               <i class="bi bi-shield-x" style="font-size:28px;color:var(--border-strong);display:block;margin-bottom:8px;"></i>
               <p style="font-size:13px;color:var(--text-muted);font-style:italic;">No emergency contact recorded.</p>
             </div>`}
      </div>
    </div>

    <!-- Pastoral Notes -->
    ${canNotes ? `
    <div class="mp-card mp-fade-up" style="animation-delay:200ms;">
      <div class="mp-card-head">
        <div class="mp-card-icon" style="background:var(--bg-danger);">
          <i class="bi bi-lock-fill" style="color:var(--caci-red);font-size:15px;"></i>
        </div>
        <div style="flex:1;">
          <h2 style="font-size:13px;font-weight:600;color:var(--text-primary);">Pastoral Notes</h2>
          <p style="font-size:11px;color:var(--text-muted);margin-top:1px;">Visible to pastoral staff only</p>
        </div>
      </div>
      <div class="mp-card-body">
        ${m.pastoral_notes?.trim()
          ? `<div style="background:var(--bg-page);border-radius:10px;padding:16px;
                         border:1px solid var(--border-default);">
               <p style="font-size:13px;color:var(--text-primary);line-height:1.65;
                          white-space:pre-wrap;">${m.pastoral_notes}</p>
             </div>`
          : `<div style="background:var(--bg-page);border:1px dashed var(--border-default);
                         border-radius:10px;padding:20px;text-align:center;">
               <i class="bi bi-journal-text" style="font-size:28px;color:var(--border-strong);display:block;margin-bottom:8px;"></i>
               <p style="font-size:13px;color:var(--text-muted);font-style:italic;">No pastoral notes recorded yet.</p>
             </div>`}
      </div>
    </div>` : ''}

  </div>

  <!-- ══ RIGHT (1/3) ══ -->
  <div style="display:flex;flex-direction:column;gap:16px;">

    <!-- Membership card -->
    <div class="mp-card mp-fade-up" style="animation-delay:80ms;">
      <div class="mp-card-head">
        <div class="mp-card-icon" style="background:var(--bg-info);">
          <i class="bi bi-person-badge-fill" style="color:var(--caci-blue);"></i>
        </div>
        <h2 style="font-size:13px;font-weight:600;color:var(--text-primary);">Membership</h2>
      </div>
      <div class="mp-card-body" style="display:flex;flex-direction:column;gap:16px;">
        <div class="mp-field">
          <span class="mp-field-label">Membership No.</span>
          <span class="mp-field-value mp-field-mono">${m.membership_number ?? '—'}</span>
        </div>
        <div class="mp-field">
          <span class="mp-field-label">Join Date</span>
          <span class="mp-field-value">${m.join_date ? formatDate(m.join_date) : '—'}</span>
        </div>
        <div class="mp-field">
          <span class="mp-field-label">Household</span>
          ${householdName && householdId
            ? `<a class="mp-field-value mp-field-link" data-household-link="${householdId}" href="javascript:void(0)">
                 ${householdName}
                 <i class="bi bi-box-arrow-up-right" style="font-size:11px;"></i>
               </a>`
            : `<span class="mp-field-empty">—</span>`}
        </div>
        <div class="mp-field">
          <span class="mp-field-label">Membership Type</span>
          <div style="margin-top:3px;">${_statusBadge(m.membership_status ?? 'inactive')}</div>
        </div>
        <div class="mp-field">
          <span class="mp-field-label">Status</span>
          <div style="display:flex;align-items:center;gap:7px;margin-top:3px;">
            <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;
                         background:${m.is_active ? 'var(--caci-success)' : 'var(--border-strong)'};
                         box-shadow:${m.is_active ? '0 0 6px rgba(34,197,94,0.5)' : 'none'};"></span>
            <span style="font-size:13px;font-weight:500;color:var(--text-primary);">
              ${m.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Linked Modules -->
    <div class="mp-card mp-fade-up" style="animation-delay:120ms;">
      <div class="mp-card-head">
        <div class="mp-card-icon" style="background:var(--bg-hover);">
          <i class="bi bi-grid-fill" style="color:var(--text-muted);font-size:15px;"></i>
        </div>
        <h2 style="font-size:13px;font-weight:600;color:var(--text-primary);">Linked Modules</h2>
      </div>
      <div class="mp-card-body" style="display:flex;flex-direction:column;gap:8px;">
        ${[
          { label: 'Groups & Units',  sub: 'Departments & age groups', icon: 'bi-diagram-3-fill',   bg: 'var(--bg-info)',    color: 'var(--caci-blue)',        path: '/groups' },
          { label: 'Finance',         sub: 'Pledges & transactions',  icon: 'bi-cash-coin',         bg: 'var(--bg-warning)', color: 'var(--amber)',            path: '/finance' },
          { label: 'Attendance',      sub: 'Service history',         icon: 'bi-calendar-check-fill',bg:'rgba(26,127,55,0.1)',color: 'var(--caci-success)',     path: '/attendance' },
          { label: 'Pastoral Care',   sub: 'Cases & visits',          icon: 'bi-heart-fill',        bg: 'var(--bg-danger)',  color: 'var(--caci-red)',         path: '/pastoral-care' },
          { label: 'Services',        sub: 'Roles & participation',   icon: 'bi-church',            bg: 'var(--bg-info)',    color: 'var(--caci-blue-light)',  path: '/services' },
        ].map(mod => `
        <button class="mp-mod-link" data-mod-path="${mod.path}">
          <div class="mp-mod-icon" style="background:${mod.bg};">
            <i class="bi ${mod.icon}" style="color:${mod.color};font-size:17px;"></i>
          </div>
          <div style="flex:1;min-width:0;text-align:left;">
            <p style="font-size:13px;font-weight:500;color:var(--text-primary);">${mod.label}</p>
            <p style="font-size:11px;color:var(--text-muted);">${mod.sub}</p>
          </div>
          <i class="bi bi-arrow-right mp-mod-arrow"></i>
        </button>`).join('')}
      </div>
    </div>

    <!-- Record Info -->
    <div class="mp-card mp-fade-up" style="animation-delay:160ms;">
      <div class="mp-card-head">
        <div class="mp-card-icon" style="background:var(--bg-hover);">
          <i class="bi bi-info-circle" style="color:var(--text-muted);font-size:15px;"></i>
        </div>
        <h2 style="font-size:13px;font-weight:600;color:var(--text-secondary);">Record Info</h2>
      </div>
      <div class="mp-card-body" style="display:flex;flex-direction:column;gap:0;">
        <div class="mp-record-row">
          <div class="mp-record-dot active"></div>
          <div style="flex:1;">
            <p style="font-size:11px;font-weight:600;color:var(--text-secondary);">Last Updated</p>
            <p style="font-size:12px;color:var(--text-primary);">
              ${m.updated_at ? formatDate(m.updated_at) : '—'}
            </p>
          </div>
        </div>
        <div style="width:1px;height:16px;background:var(--border-default);margin-left:3.5px;"></div>
        <div class="mp-record-row">
          <div class="mp-record-dot"></div>
          <div style="flex:1;">
            <p style="font-size:11px;font-weight:600;color:var(--text-secondary);">Created</p>
            <p style="font-size:12px;color:var(--text-primary);">
              ${m.created_at ? formatDate(m.created_at) : '—'}
            </p>
          </div>
        </div>
        <div class="mp-divider" style="margin:14px 0 10px;"></div>
        <div class="mp-field">
          <span class="mp-field-label">Assembly</span>
          <span class="mp-field-value" style="font-size:12.5px;">
            ${(m as any).assemblies?.name ?? m.assembly_id ?? '—'}
          </span>
        </div>
      </div>
    </div>

  </div>
</div>
`
}

// ── Events ────────────────────────────────────────────────────────────────────

function _on<K extends keyof HTMLElementEventMap>(
  el: EventTarget | null, ev: K, fn: (e: HTMLElementEventMap[K]) => void
): void {
  if (!el) return
  el.addEventListener(ev, fn as EventListener)
  _listeners.push([el, ev, fn as EventListener])
}

function _bindEvents(container: HTMLElement, m: MemberView, canEdit: boolean): void {
  // Edit button
  _on(document.getElementById('mp-edit-btn'), 'click', () => {
    navigate(`/members/${m.id}/edit`)
  })

  // Household link
  container.querySelectorAll<HTMLElement>('[data-household-link]').forEach(a => {
    _on(a, 'click', () => navigate(`/households/${a.dataset.householdLink}`))
  })

  // Linked module navigation
  container.querySelectorAll<HTMLElement>('[data-mod-path]').forEach(btn => {
    _on(btn, 'click', () => navigate(btn.dataset.modPath ?? '/'))
  })

  // Deactivate button
  if (canEdit) {
    _on(document.getElementById('mp-deactivate-btn'), 'click', () => {
      _showDeactivateModal(m)
    })
  }
}

// ── Deactivate modal ──────────────────────────────────────────────────────────

function _showDeactivateModal(m: MemberView): void {
  const fullName = [m.title, m.first_name, m.last_name].filter(Boolean).join(' ')
  const backdrop = document.createElement('div')
  backdrop.className = 'mp-modal-backdrop'
  backdrop.innerHTML = `
    <div class="mp-card" style="max-width:400px;width:100%;border-color:rgba(198,0,38,0.4);">
      <div class="mp-card-head">
        <div class="mp-card-icon" style="background:var(--bg-danger);">
          <i class="bi bi-person-dash-fill" style="font-size:15px;color:var(--caci-red);"></i>
        </div>
        <h2 style="font-size:13px;font-weight:600;color:var(--text-primary);">Deactivate Member?</h2>
      </div>
      <div class="mp-card-body">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;line-height:1.55;">
          This will deactivate <strong style="color:var(--text-primary);">${fullName}</strong> and
          remove them from active member counts. Their record will be preserved and can be restored.
        </p>
        <div style="background:var(--bg-warning);border:1px solid rgba(154,103,0,0.25);
                    border-radius:8px;padding:10px 12px;margin-bottom:16px;
                    display:flex;gap:8px;align-items:flex-start;">
          <i class="bi bi-exclamation-triangle-fill" style="font-size:14px;color:var(--amber);flex-shrink:0;margin-top:1px;"></i>
          <p style="font-size:11.5px;color:var(--amber);line-height:1.5;">
            This action can be reversed by an admin at any time.
          </p>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="mp-act-btn" id="mp-modal-cancel">Cancel</button>
          <button class="mp-act-btn mp-act-btn-danger" id="mp-modal-confirm"
                  style="background:var(--caci-red);border-color:var(--caci-red-dim);color:#fff;font-weight:600;">
            <i class="bi bi-person-dash" style="font-size:13px;"></i> Deactivate
          </button>
        </div>
      </div>
    </div>`

  document.body.appendChild(backdrop)

  backdrop.querySelector('#mp-modal-cancel')?.addEventListener('click', () => backdrop.remove())
  backdrop.querySelector('#mp-modal-confirm')?.addEventListener('click', async () => {
    const confirmBtn = backdrop.querySelector('#mp-modal-confirm') as HTMLButtonElement | null
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Deactivating…' }
    try {
      const { deactivateMember } = await import('../repository')
      await deactivateMember(m.id)
      backdrop.remove()
      // Refresh the page
      navigate(`/members/${m.id}`)
    } catch (err: any) {
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Deactivate' }
      const errP = document.createElement('p')
      errP.style.cssText = 'font-size:11.5px;color:var(--text-danger);margin-top:8px;text-align:right;'
      errP.textContent = err?.message ?? 'Failed to deactivate. Try again.'
      backdrop.querySelector('.mp-card-body')?.appendChild(errP)
    }
  })

  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove() })

  // Escape key
  const _onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', _onKeydown) }
  }
  document.addEventListener('keydown', _onKeydown)
}