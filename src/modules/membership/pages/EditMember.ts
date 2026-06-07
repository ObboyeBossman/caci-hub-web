// src/modules/membership/pages/EditMember.ts
// Tabbed member edit form — Personal · Contact · Membership · Emergency · Pastoral Notes.
// Mirrors: caci-member-edit.html reference design.
// Loads member via getMember(id), saves via updateMember(id, payload).
// Phone is OPTIONAL (no required validation on phone fields).

import type { PageModule } from '../../../types/module.types'
import { navigate } from '@core/router'
import { getCurrentUser } from '@core/auth'
import { can } from '@core/authorization/authorization-service'
import { getMember, updateMember } from '../repository'
import { UpdateMemberSchema } from '../schemas/member.schema'
import type { ZodError } from 'zod'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { renderBreadcrumbs } from '@shell/Breadcrumbs'
import { avatarColor, initials } from '../utils/member-helpers'
import type { MemberView, UpdateMemberPayload } from '../../../types/member.types'

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = /* css */`
/* ═══════════════════════════════════════════════════════════════════
   EDIT MEMBER PAGE
═══════════════════════════════════════════════════════════════════ */

.em-wrap {
  max-width: 960px;
  margin: 0 auto;
  padding: 14px 16px 100px;
}
@media (min-width: 480px) { .em-wrap { padding: 18px 20px 100px; } }
@media (min-width: 640px) { .em-wrap { padding: 18px 24px 100px; } }

/* ── Section card ───────────────────────────────────────────────── */
.em-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 16px; overflow: hidden;
  transition: border-color 0.18s;
  margin-bottom: 16px;
}
.em-card:hover { border-color: var(--border-strong); }
.em-card.has-error { border-color: rgba(198,0,38,0.4); }
.em-card-header {
  display: flex; align-items: center; gap: 10px;
  padding: 13px 18px; border-bottom: 1px solid var(--border-default);
  background: rgba(0,0,0,0.01);
}
.em-card-icon {
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 15px;
}
.em-card-body { padding: 18px 20px; }
@media (max-width: 480px) { .em-card-body { padding: 13px 14px; } }

/* ── Avatar ring ────────────────────────────────────────────────── */
.em-avatar-ring {
  padding: 3px; border-radius: 50%;
  background: conic-gradient(#22c55e 0deg 285deg, #166534 285deg 360deg);
  animation: em-ring-pulse 2.5s infinite;
  flex-shrink: 0;
}
@keyframes em-ring-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.35); }
  50%      { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
}
.em-avatar-inner {
  width: 88px; height: 88px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 700; color: #fff;
  border: 3px solid var(--bg-card);
  background-size: cover; background-position: center;
  position: relative;
}
.em-avatar-upload-btn {
  position: absolute; inset: 0; border-radius: 50%;
  background: rgba(0,0,0,0); display: flex;
  align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.2s;
  border: none; color: transparent; font-size: 0;
}
.em-avatar-upload-btn:hover { background: rgba(0,0,0,0.55); color: #fff; font-size: 20px; }

/* ── Tab strip ──────────────────────────────────────────────────── */
.em-tabs {
  display: flex; gap: 0; border-bottom: 1px solid var(--border-default);
  background: rgba(0,0,0,0.01); overflow-x: auto;
  -ms-overflow-style: none; scrollbar-width: none;
}
.em-tabs::-webkit-scrollbar { display: none; }
.em-tab-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 11px 16px; border-bottom: 2px solid transparent;
  font-size: 12.5px; font-weight: 500; color: var(--text-secondary);
  cursor: pointer; white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
  background: none; border-left: none; border-right: none; border-top: none;
  font-family: var(--font-sans);
}
.em-tab-btn:hover:not(.active) { color: var(--text-primary); }
.em-tab-btn.active { color: var(--caci-blue); border-bottom-color: var(--caci-blue); }
[data-theme="dark"] .em-tab-btn.active { color: var(--caci-blue-light); border-bottom-color: var(--caci-blue-light); }
@media (max-width: 400px) {
  .em-tab-btn { padding: 10px 10px; gap: 0; font-size: 0; }
  .em-tab-btn i { font-size: 16px !important; }
}

/* ── Tab pane ───────────────────────────────────────────────────── */
.em-tab-pane { display: none; }
.em-tab-pane.active { display: block; }

/* ── Form fields ────────────────────────────────────────────────── */
.em-form-group { display: flex; flex-direction: column; gap: 4px; }
.em-form-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-muted);
}
.em-form-label .req { color: var(--caci-red); margin-left: 2px; }
.em-inp, .em-sel, .em-txt {
  width: 100%; background: var(--bg-page);
  border: 1px solid var(--border-default); border-radius: 9px;
  color: var(--text-primary); font-family: var(--font-sans); font-size: 13px;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}
.em-inp, .em-sel { padding: 8px 11px; height: 38px; }
.em-txt { padding: 9px 11px; resize: vertical; min-height: 88px; }
.em-inp:focus, .em-sel:focus, .em-txt:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.em-inp:hover:not(:focus), .em-sel:hover:not(:focus), .em-txt:hover:not(:focus) {
  border-color: var(--border-strong);
}
.em-inp.error, .em-sel.error { border-color: var(--caci-red); box-shadow: 0 0 0 3px rgba(198,0,38,0.1); }
.em-inp::placeholder, .em-txt::placeholder { color: var(--text-muted); }
.em-sel {
  appearance: none; cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236e7681' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center; padding-right: 30px;
}
.em-sel option { background: var(--bg-card); color: var(--text-primary); }
.em-err-msg { font-size: 10.5px; color: var(--text-danger); display: flex; align-items: center; gap: 3px; }

/* Input with icon */
.em-inp-icon-wrap { position: relative; }
.em-inp-icon-wrap .em-ico { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 14px; pointer-events: none; }
.em-inp-icon-wrap .em-inp { padding-left: 32px; }

/* Phone prefix */
.em-phone-wrap { display: flex; }
.em-phone-prefix {
  flex-shrink: 0; height: 38px; padding: 0 9px;
  background: var(--bg-hover); border: 1px solid var(--border-default); border-right: none;
  border-radius: 9px 0 0 9px; color: var(--text-secondary); font-size: 12.5px;
  display: flex; align-items: center; gap: 4px; white-space: nowrap;
}
.em-phone-wrap .em-inp { border-radius: 0 9px 9px 0; }

/* Form grids */
.em-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 18px; }
.em-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 18px; }
@media (max-width: 479px) {
  .em-grid-2, .em-grid-3 { grid-template-columns: 1fr; }
}
@media (min-width: 480px) and (max-width: 640px) {
  .em-grid-3 { grid-template-columns: repeat(2, 1fr); }
}
.em-col2 { grid-column: span 2; }
.em-col3 { grid-column: span 3; }
@media (max-width: 479px) { .em-col2, .em-col3 { grid-column: span 1; } }

.em-divider { height: 1px; background: var(--border-default); margin: 16px 0; }
.em-section-sub { font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 14px; }

/* Toggle switch */
.em-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.em-toggle-label { font-size: 13px; color: var(--text-primary); font-weight: 500; }
.em-toggle-sub   { font-size: 11px; color: var(--text-secondary); margin-top: 1px; }
.em-toggle {
  flex-shrink: 0; width: 38px; height: 20px; border-radius: 99px;
  background: var(--bg-hover); border: 1px solid var(--border-default);
  cursor: pointer; position: relative; transition: background 0.18s;
  appearance: none;
}
.em-toggle::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--text-muted); transition: transform 0.2s, background 0.2s;
}
.em-toggle:checked { background: rgba(0,75,160,0.2); border-color: rgba(0,75,160,0.4); }
.em-toggle:checked::after { transform: translateX(18px); background: var(--caci-blue); }

/* Char counter */
.em-char-counter { font-size: 10px; color: var(--text-muted); text-align: right; margin-top: 2px; }
.em-char-counter.warn { color: var(--amber); }

/* Unsaved indicator */
.em-unsaved-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--amber); flex-shrink: 0;
  box-shadow: 0 0 5px rgba(154,103,0,0.5);
  animation: em-ring-pulse 2s infinite;
}

/* ── Save bar (sticky bottom) ───────────────────────────────────── */
.em-save-bar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
  background: rgba(var(--bg-page-rgb, 246,248,250), 0.92);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--border-default);
  padding: 12px 0;
}
[data-theme="dark"] .em-save-bar {
  background: rgba(13,17,23,0.92);
}
.em-save-bar-inner {
  max-width: 960px; margin: 0 auto;
  padding: 0 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
@media (min-width: 640px) { .em-save-bar-inner { padding: 0 24px; } }

/* Action buttons */
.em-action-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 0 14px; height: 36px; border-radius: 9px;
  font-size: 12.5px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--border-default); background: var(--bg-page);
  color: var(--text-secondary); transition: all 0.15s; font-family: var(--font-sans); white-space: nowrap;
}
.em-action-btn:hover { border-color: var(--border-strong); color: var(--text-primary); transform: translateY(-1px); }
.em-action-btn:active { transform: translateY(0); }
.em-action-btn-primary {
  background: var(--caci-blue); border-color: var(--caci-blue-dim);
  color: #fff; font-weight: 600; box-shadow: 0 2px 8px rgba(0,75,160,0.3);
}
.em-action-btn-primary:hover { background: var(--caci-blue-light); color: #fff; border-color: var(--caci-blue); }
.em-action-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
@media (max-width: 480px) {
  .em-action-btn { height: 32px; padding: 0 10px; font-size: 12px; }
  .em-save-bar-label { display: none; }
}

/* ── Toast ──────────────────────────────────────────────────────── */
#em-toast {
  position: fixed; bottom: 72px; left: 50%; transform: translateX(-50%) translateY(60px);
  z-index: 200; opacity: 0; pointer-events: none;
  transition: transform 0.38s cubic-bezier(0.16,1,0.3,1), opacity 0.28s;
}
#em-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; pointer-events: auto; }
.em-toast-inner {
  display: flex; align-items: center; gap: 9px; padding: 11px 16px;
  border-radius: 11px; font-size: 13px; font-weight: 500;
  box-shadow: 0 8px 28px rgba(0,0,0,0.25); min-width: 240px;
}
.em-toast-success { background: var(--bg-success); border: 1px solid rgba(26,127,55,0.3); color: var(--caci-success); }
.em-toast-error   { background: var(--bg-danger);  border: 1px solid rgba(198,0,38,0.3);  color: var(--text-danger); }

/* ── Discard modal ──────────────────────────────────────────────── */
.em-modal-backdrop {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 16px;
}

/* ── Avatar zoom modal ──────────────────────────────────────────── */
.em-avatar-modal {
  position: fixed; inset: 0; z-index: 999;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0); backdrop-filter: blur(0);
  transition: background 0.26s, backdrop-filter 0.26s; pointer-events: none;
}
.em-avatar-modal.open {
  background: rgba(0,0,0,0.82); backdrop-filter: blur(12px); pointer-events: all;
}
.em-avatar-modal-inner {
  position: relative; transform: scale(0.75); opacity: 0;
  transition: transform 0.32s cubic-bezier(0.16,1,0.3,1), opacity 0.26s;
}
.em-avatar-modal.open .em-avatar-modal-inner { transform: scale(1); opacity: 1; }
.em-avatar-modal-img {
  width: 280px; height: 280px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 88px; font-weight: 700; color: #fff;
  border: 4px solid rgba(255,255,255,0.15);
  box-shadow: 0 28px 64px rgba(0,0,0,0.6);
  background-size: cover; background-position: center;
}
.em-avatar-modal-name {
  margin-top: 18px; text-align: center;
  font-size: 15px; font-weight: 600; color: #fff;
  text-shadow: 0 1px 6px rgba(0,0,0,0.5);
}
.em-avatar-modal-close {
  position: absolute; top: -14px; right: -14px;
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--bg-card); border: 1px solid var(--border-default);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text-secondary); transition: all 0.18s;
  box-shadow: 0 4px 14px rgba(0,0,0,0.3);
}
.em-avatar-modal-close:hover { color: var(--text-primary); transform: scale(1.1); }

/* ── Animations ─────────────────────────────────────────────────── */
@keyframes em-fade-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
@keyframes em-shake { 0%,100% { transform:translateX(0); } 20% { transform:translateX(-4px); } 40% { transform:translateX(4px); } 60% { transform:translateX(-3px); } 80% { transform:translateX(3px); } }
.em-fade-up { animation: em-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both; }
`

function injectCSS(): void {
    if (document.getElementById('em-css')) return
    const s = document.createElement('style')
    s.id = 'em-css'
    s.textContent = CSS
    document.head.appendChild(s)
}

// ── Page Module ───────────────────────────────────────────────────────────────

const EditMemberPage: PageModule = { render: _render, destroy: _destroy }
export default EditMemberPage

// ── State ─────────────────────────────────────────────────────────────────────

let _member: MemberView | null = null
let _isDirty = false
let _pendingPhotoFile: File | null = null
let _container_: HTMLElement | null = null
let _saveBar: HTMLElement | null = null
let _toastTimer: ReturnType<typeof setTimeout> | null = null
let _listeners__: Array<[EventTarget, string, EventListener]> = []
let _destroyed__ = false

// ── Lifecycle ─────────────────────────────────────────────────────────────────

async function _render(container: HTMLElement): Promise<void> {
    _container_ = container
    _destroyed__ = false
    _listeners__ = []
    _isDirty = false
    _member = null
    _pendingPhotoFile = null
    injectCSS()

    const memberId = container.dataset.id ?? ''
    if (!memberId) { renderError(container, new Error('No member ID provided')); return }

    renderSkeleton(container, 'profile')

    try {
        _member = await getMember(memberId)
        if (_destroyed__) return
        _mountPage(container)
    } catch (err) {
        if (_destroyed__) return
        renderError(container, err, { retry: () => _render(container) })
    }
}

function _destroy(): void {
    _destroyed__ = true
    _listeners__.forEach(([el, ev, fn]) => el.removeEventListener(ev, fn))
    _listeners__ = []
    // Remove save bar from DOM (it's appended to body)
    _saveBar?.remove()
    _saveBar = null
    _container_ = null
}

// ── Mount ─────────────────────────────────────────────────────────────────────

function _mountPage(container: HTMLElement): void {
    if (!_member) return
    const m = _member

    const fullName = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
    const ini = initials(m.first_name ?? '', m.last_name ?? '')
    const bg = avatarColor(fullName)

    container.innerHTML = ''

    // Wrap — breadcrumb toolbar + page content share the same max-width
    const wrap = document.createElement('div')
    wrap.className = 'em-wrap'

    renderBreadcrumbs(wrap, [
        { label: 'Members', path: '/members' },
        { label: fullName, path: `/members/${m.id}` },
        { label: 'Edit' },
    ])

    const pageDiv = document.createElement('div')
    pageDiv.innerHTML = _buildPage(m, fullName, ini, bg)
    while (pageDiv.firstChild) wrap.appendChild(pageDiv.firstChild)

    container.appendChild(wrap)

    // Append save bar to body (fixed positioning)
    _saveBar = document.createElement('div')
    _saveBar.className = 'em-save-bar'
    _saveBar.innerHTML = `
    <div class="em-save-bar-inner">
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary);">
        <i class="bi bi-pencil-square" style="font-size:14px;color:var(--text-muted);"></i>
        <span class="em-save-bar-label">Editing <strong style="color:var(--text-primary);">${fullName}</strong></span>
        <span id="em-unsaved-badge" style="display:none;align-items:center;gap:5px;font-size:11.5px;color:var(--amber);font-weight:500;">
          <span class="em-unsaved-dot"></span> Unsaved changes
        </span>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="em-action-btn" id="em-discard-btn" disabled>
          <i class="bi bi-x-lg" style="font-size:13px;"></i>
          <span class="em-save-bar-label">Discard</span>
        </button>
        <button class="em-action-btn em-action-btn-primary" id="em-save-btn" disabled>
          <i class="bi bi-floppy" style="font-size:13px;"></i>
          <span class="em-save-bar-label">Save Changes</span>
        </button>
      </div>
    </div>`
    document.body.appendChild(_saveBar)

    // Toast element
    const toast = document.createElement('div')
    toast.id = 'em-toast'
    toast.innerHTML = `<div class="em-toast-inner" id="em-toast-inner">
    <i class="bi" id="em-toast-icon" style="font-size:16px;"></i>
    <span id="em-toast-msg"></span>
  </div>`
    document.body.appendChild(toast)
    _listeners__.push([toast, '__cleanup', (() => toast.remove()) as EventListener])

    _bindEvents(container, m, fullName, ini, bg)
}

// ── Page HTML ─────────────────────────────────────────────────────────────────

function _buildPage(m: MemberView, fullName: string, ini: string, bg: string): string {
    const user = getCurrentUser()
    const canNotes = user ? can(user, 'members.edit') : false

    return /* html */`
<!-- Hero card + tabs -->
<div class="em-card em-fade-up" style="animation-delay:40ms;">
  <div style="padding:20px 20px 0;">
    <div style="display:flex;flex-direction:column;gap:16px;align-items:flex-start;
         margin-bottom:0;">
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
        <!-- Avatar -->
        <div id="em-avatar-wrap" style="position:relative;flex-shrink:0;">
          <div class="em-avatar-ring">
            <div class="em-avatar-inner" id="em-avatar-preview"
                 style="background-color:${bg};${m.profile_photo_url ? `background-image:url(${m.profile_photo_url});background-size:cover;background-position:center;` : ''}">
              ${m.profile_photo_url ? '' : ini}
            </div>
          </div>
          <div style="position:absolute;bottom:5px;right:5px;width:14px;height:14px;
                      border-radius:50%;background:${m.is_active ? 'var(--caci-success)' : 'var(--border-strong)'};
                      border:2.5px solid var(--bg-card);"></div>
          <button class="em-avatar-upload-btn" id="em-avatar-btn" title="Change photo">
            <i class="bi bi-camera-fill"></i>
          </button>
          <input type="file" id="em-avatar-file" accept="image/*" style="display:none;">
        </div>
        <!-- Name & meta -->
        <div style="flex:1;min-width:0;">
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:4px;">
            <h1 style="font-size:19px;font-weight:700;color:var(--text-primary);
                       word-break:break-word;" id="em-hero-name">${fullName}</h1>
            <span style="display:inline-flex;align-items:center;padding:2px 9px;border-radius:99px;
                         font-size:10.5px;font-weight:600;
                         background:var(--bg-success);color:var(--caci-success);
                         border:1px solid rgba(26,127,55,0.2);">
              <span style="width:6px;height:6px;border-radius:50%;background:var(--caci-success);
                           margin-right:5px;display:inline-block;"></span>
              Active
            </span>
            <span id="em-unsaved-hero" style="display:none;align-items:center;gap:4px;
                  font-size:11px;color:var(--amber);font-weight:500;">
              <span class="em-unsaved-dot"></span> Unsaved
            </span>
          </div>
          <p style="font-size:10.5px;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:3px;">
            ${m.membership_number ?? '—'}
          </p>
          <p style="font-size:11.5px;color:var(--text-muted);">
            Editing member record · Changes are not saved until you click Save
          </p>
        </div>
      </div>
    </div>
  </div>
  <!-- Tabs -->
  <div class="em-tabs" style="margin-top:14px;">
    <button class="em-tab-btn active" data-tab="personal">
      <i class="bi bi-person" style="font-size:14px;"></i> Personal
    </button>
    <button class="em-tab-btn" data-tab="contact">
      <i class="bi bi-telephone" style="font-size:14px;"></i> Contact
    </button>
    <button class="em-tab-btn" data-tab="membership">
      <i class="bi bi-card-text" style="font-size:14px;"></i> Membership
    </button>
    <button class="em-tab-btn" data-tab="emergency">
      <i class="bi bi-shield-exclamation" style="font-size:14px;"></i> Emergency
    </button>
    ${canNotes ? `<button class="em-tab-btn" data-tab="notes">
      <i class="bi bi-lock" style="font-size:14px;"></i> Pastoral Notes
    </button>` : ''}
  </div>
</div>

<!-- ═══ PERSONAL TAB ═══ -->
<div class="em-tab-pane active" id="em-tab-personal">
  <div class="em-card em-fade-up" style="animation-delay:80ms;">
    <div class="em-card-header">
      <div class="em-card-icon" style="background:rgba(0,75,160,0.1);">
        <i class="bi bi-person-fill" style="color:var(--caci-blue);"></i>
      </div>
      <h2 style="font-size:13px;font-weight:600;color:var(--text-primary);">Personal Information</h2>
    </div>
    <div class="em-card-body">
      <div class="em-grid-3">
        <div class="em-form-group">
          <label class="em-form-label">Title</label>
          <select class="em-sel" id="em-title">
            <option value="">— None —</option>
            ${['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Rev.', 'Elder', 'Deacon', 'Deaconess', 'Apostle', 'Bishop', 'Pastor']
            .map(t => `<option value="${t}" ${m.title === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="em-form-group">
          <label class="em-form-label">First Name <span class="req">*</span></label>
          <input class="em-inp" type="text" id="em-first-name" value="${m.first_name ?? ''}" placeholder="First name">
          <span class="em-err-msg" id="em-first-name-err" style="display:none;">
            <i class="bi bi-exclamation-circle" style="font-size:11px;"></i> Required
          </span>
        </div>
        <div class="em-form-group">
          <label class="em-form-label">Other Names</label>
          <input class="em-inp" type="text" id="em-other-names" value="${(m as any).other_names ?? ''}" placeholder="Middle / other names">
        </div>
        <div class="em-form-group">
          <label class="em-form-label">Last Name <span class="req">*</span></label>
          <input class="em-inp" type="text" id="em-last-name" value="${m.last_name ?? ''}" placeholder="Last name">
          <span class="em-err-msg" id="em-last-name-err" style="display:none;">
            <i class="bi bi-exclamation-circle" style="font-size:11px;"></i> Required
          </span>
        </div>
        <div class="em-form-group">
          <label class="em-form-label">Date of Birth</label>
          <input class="em-inp" type="date" id="em-dob" value="${m.date_of_birth ?? ''}">
        </div>
        <div class="em-form-group">
          <label class="em-form-label">Gender <span class="req">*</span></label>
          <select class="em-sel" id="em-gender">
            <option value="">— Select —</option>
            <option value="male"   ${m.gender === 'male' ? 'selected' : ''}>Male</option>
            <option value="female" ${m.gender === 'female' ? 'selected' : ''}>Female</option>
          </select>
          <span class="em-err-msg" id="em-gender-err" style="display:none;">
            <i class="bi bi-exclamation-circle" style="font-size:11px;"></i> Required
          </span>
        </div>
        <div class="em-form-group">
          <label class="em-form-label">Marital Status</label>
          <select class="em-sel" id="em-marital">
            <option value="">— Select —</option>
            ${['single', 'married', 'divorced', 'widowed', 'separated'].map(s =>
                `<option value="${s}" ${m.marital_status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="em-form-group">
          <label class="em-form-label">Occupation</label>
          <input class="em-inp" type="text" id="em-occupation" value="${m.occupation ?? ''}" placeholder="Occupation">
        </div>
        <div class="em-form-group">
          <label class="em-form-label">Membership Status</label>
          <select class="em-sel" id="em-mem-status">
            ${['active', 'inactive', 'visitor', 'prospect', 'transfer', 'deceased'].map(s =>
                `<option value="${s}" ${m.membership_status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ CONTACT TAB ═══ -->
<div class="em-tab-pane" id="em-tab-contact">
  <div class="em-card em-fade-up" style="animation-delay:80ms;">
    <div class="em-card-header">
      <div class="em-card-icon" style="background:rgba(26,127,55,0.1);">
        <i class="bi bi-telephone-fill" style="color:var(--caci-success);"></i>
      </div>
      <h2 style="font-size:13px;font-weight:600;color:var(--text-primary);">Contact Information</h2>
    </div>
    <div class="em-card-body">
      <div class="em-grid-2">
        <div class="em-form-group">
          <label class="em-form-label">Primary Phone</label>
          <div class="em-phone-wrap">
            <div class="em-phone-prefix"><span style="font-size:14px;">🇬🇭</span> +233</div>
            <input class="em-inp" type="tel" id="em-phone1" value="${m.primary_phone ?? ''}" placeholder="244 000 000">
          </div>
        </div>
        <div class="em-form-group">
          <label class="em-form-label">Secondary Phone</label>
          <div class="em-phone-wrap">
            <div class="em-phone-prefix"><span style="font-size:14px;">🇬🇭</span> +233</div>
            <input class="em-inp" type="tel" id="em-phone2" value="${m.secondary_phone ?? ''}" placeholder="244 000 000">
          </div>
        </div>
        <div class="em-form-group">
          <label class="em-form-label">Email Address</label>
          <div class="em-inp-icon-wrap">
            <i class="bi bi-envelope em-ico"></i>
            <input class="em-inp" type="email" id="em-email" value="${m.email ?? ''}" placeholder="email@example.com">
          </div>
          <span class="em-err-msg" id="em-email-err" style="display:none;">
            <i class="bi bi-exclamation-circle" style="font-size:11px;"></i> Enter a valid email
          </span>
        </div>
        <div class="em-form-group">
          <label class="em-form-label">WhatsApp Number</label>
          <div class="em-phone-wrap">
            <div class="em-phone-prefix"><span style="font-size:14px;">🇬🇭</span> +233</div>
            <input class="em-inp" type="tel" id="em-whatsapp" value="${m.whatsapp_number ?? ''}" placeholder="244 000 000">
          </div>
        </div>
        <div class="em-form-group em-col2">
          <label class="em-form-label">Physical / Residential Address</label>
          <textarea class="em-txt" id="em-address" placeholder="Street / Area, City, Region">${m.physical_address ?? ''}</textarea>
        </div>
        <div class="em-form-group">
          <label class="em-form-label">Digital Address (Ghana Post)</label>
          <input class="em-inp" type="text" id="em-digital-addr" value="${(m as any).digital_address ?? ''}" placeholder="e.g. GA-123-4567">
        </div>
      </div>
      <div class="em-divider"></div>
      <p class="em-section-sub">Social Media</p>
      <div class="em-grid-2">
        <div class="em-form-group">
          <label class="em-form-label">Facebook</label>
          <div class="em-inp-icon-wrap">
            <i class="bi bi-globe em-ico"></i>
            <input class="em-inp" type="url" id="em-facebook" value="${m.facebook_url ?? ''}" placeholder="https://facebook.com/…">
          </div>
        </div>
        <div class="em-form-group">
          <label class="em-form-label">Instagram</label>
          <div class="em-inp-icon-wrap">
            <i class="bi bi-camera em-ico"></i>
            <input class="em-inp" type="url" id="em-instagram" value="${m.instagram_url ?? ''}" placeholder="https://instagram.com/…">
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ MEMBERSHIP TAB ═══ -->
<div class="em-tab-pane" id="em-tab-membership">
  <div class="em-card em-fade-up" style="animation-delay:80ms;">
    <div class="em-card-header">
      <div class="em-card-icon" style="background:rgba(0,75,160,0.1);">
        <i class="bi bi-card-text" style="color:var(--caci-blue-light);"></i>
      </div>
      <h2 style="font-size:13px;font-weight:600;color:var(--text-primary);">Membership Details</h2>
    </div>
    <div class="em-card-body">
      <div class="em-grid-2">
        <div class="em-form-group">
          <label class="em-form-label">Membership No.</label>
          <input class="em-inp" type="text" value="${m.membership_number ?? '—'}" readonly
                 style="opacity:0.5;cursor:not-allowed;font-family:var(--font-mono);font-size:11.5px;">
          <span style="font-size:10px;color:var(--text-muted);">Auto-assigned · cannot be changed</span>
        </div>
        <div class="em-form-group">
          <label class="em-form-label">Join Date</label>
          <input class="em-inp" type="date" id="em-join-date" value="${m.join_date ?? ''}">
        </div>
        <div class="em-form-group em-col2">
          <label class="em-form-label">Previous Church / Background</label>
          <input class="em-inp" type="text" id="em-prev-church" value="" placeholder="Previous church name (optional)">
        </div>
      </div>
      <div class="em-divider"></div>
      <p class="em-section-sub">Preferences &amp; Communication</p>
      <div style="display:flex;flex-direction:column;gap:14px;">
        ${[
            { label: 'SMS Notifications', sub: 'Receive service reminders and announcements by SMS', id: 'em-tog-sms', checked: true },
            { label: 'Email Newsletters', sub: 'Monthly newsletter and event invitations', id: 'em-tog-email', checked: false },
            { label: 'WhatsApp Broadcasts', sub: 'Added to church WhatsApp broadcast list', id: 'em-tog-wa', checked: true },
            { label: 'Directory Listing', sub: 'Show in member directory visible to other members', id: 'em-tog-dir', checked: true },
        ].map(t => `
        <div class="em-toggle-row">
          <div>
            <p class="em-toggle-label">${t.label}</p>
            <p class="em-toggle-sub">${t.sub}</p>
          </div>
          <input type="checkbox" class="em-toggle" id="${t.id}" ${t.checked ? 'checked' : ''}>
        </div>`).join('')}
      </div>
    </div>
  </div>
</div>

<!-- ═══ EMERGENCY TAB ═══ -->
<div class="em-tab-pane" id="em-tab-emergency">
  <div class="em-card em-fade-up" style="animation-delay:80ms;">
    <div class="em-card-header">
      <div class="em-card-icon" style="background:rgba(240,136,62,0.1);">
        <i class="bi bi-shield-exclamation" style="color:#f0883e;"></i>
      </div>
      <h2 style="font-size:13px;font-weight:600;color:var(--text-primary);">Emergency Contact</h2>
      <p style="font-size:11px;color:var(--text-muted);margin-left:auto;">Contacted in case of emergency</p>
    </div>
    <div class="em-card-body">
      <div class="em-grid-3">
        <div class="em-form-group">
          <label class="em-form-label">Full Name</label>
          <input class="em-inp" type="text" id="em-ec-name"
                 value="${m.emergency_contact_name ?? ''}" placeholder="Contact full name">
        </div>
        <div class="em-form-group">
          <label class="em-form-label">Phone</label>
          <div class="em-phone-wrap">
            <div class="em-phone-prefix"><span style="font-size:14px;">🇬🇭</span> +233</div>
            <input class="em-inp" type="tel" id="em-ec-phone"
                   value="${m.emergency_contact_phone ?? ''}" placeholder="244 000 000">
          </div>
        </div>
        <div class="em-form-group">
          <label class="em-form-label">Relationship</label>
          <select class="em-sel" id="em-ec-relation">
            <option value="">— Select —</option>
            ${['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Other'].map(r =>
            `<option value="${r}" ${m.emergency_contact_relationship === r ? 'selected' : ''}>${r}</option>`
        ).join('')}
          </select>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ PASTORAL NOTES TAB ═══ -->
<div class="em-tab-pane" id="em-tab-notes">
  <div class="em-card em-fade-up" style="animation-delay:80ms;">
    <div class="em-card-header">
      <div class="em-card-icon" style="background:rgba(247,120,186,0.1);">
        <i class="bi bi-lock-fill" style="color:#f778ba;"></i>
      </div>
      <div style="flex:1;">
        <h2 style="font-size:13px;font-weight:600;color:var(--text-primary);">Pastoral Notes</h2>
        <p style="font-size:10.5px;color:var(--text-muted);margin-top:1px;">Visible to pastoral staff only</p>
      </div>
    </div>
    <div class="em-card-body" style="display:flex;flex-direction:column;gap:16px;">
      <div class="em-form-group">
        <label class="em-form-label">General Notes</label>
        <textarea class="em-txt" id="em-pastoral-notes" rows="5"
                  placeholder="Enter pastoral notes, observations, or follow-up items…"
                  style="min-height:116px;">${m.pastoral_notes ?? ''}</textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:2px;">
          <span class="em-char-counter" id="em-notes-count">0 / 500</span>
        </div>
      </div>
      <div style="background:rgba(240,136,62,0.06);border:1px solid rgba(240,136,62,0.2);
                  border-radius:9px;padding:11px 13px;display:flex;gap:10px;align-items:flex-start;">
        <i class="bi bi-info-circle" style="font-size:16px;color:#f0883e;flex-shrink:0;margin-top:1px;"></i>
        <p style="font-size:11.5px;color:var(--text-secondary);line-height:1.6;">
          Pastoral notes are encrypted and only accessible by authorised pastoral staff.
          They are excluded from standard member exports and reports.
        </p>
      </div>
    </div>
  </div>
</div>

<!-- Discard modal placeholder -->
<div id="em-discard-modal" style="display:none;"></div>

<!-- Avatar zoom modal -->
<div class="em-avatar-modal" id="em-avatar-modal">
  <div class="em-avatar-modal-inner">
    <div class="em-avatar-modal-img" id="em-modal-img"></div>
    <div class="em-avatar-modal-name" id="em-modal-name"></div>
    <button class="em-avatar-modal-close" id="em-modal-close">
      <i class="bi bi-x-lg" style="font-size:15px;"></i>
    </button>
  </div>
</div>
`
}

// ── Avatar modal ──────────────────────────────────────────────────────────────

function _openAvatarModal_em(fullName: string, ini: string, bg: string): void {
    const modal  = document.getElementById('em-avatar-modal')
    const img    = document.getElementById('em-modal-img') as HTMLElement | null
    const nameEl = document.getElementById('em-modal-name')
    if (!modal || !img) return
    const preview = document.getElementById('em-avatar-preview') as HTMLElement | null
    const bgImg = preview?.style.backgroundImage ?? ''
    if (bgImg && bgImg !== 'none') {
        img.style.backgroundColor = 'transparent'
        img.style.backgroundImage = bgImg
        img.textContent           = ''
    } else {
        img.style.backgroundImage = ''
        img.style.background      = `linear-gradient(135deg, ${bg}, var(--caci-blue))`
        img.textContent           = ini
    }
    if (nameEl) nameEl.textContent = fullName
    modal.classList.add('open')
}

function _closeAvatarModal_em(): void {
    document.getElementById('em-avatar-modal')?.classList.remove('open')
}

// ── Event binding ─────────────────────────────────────────────────────────────

function _on__<K extends keyof HTMLElementEventMap>(
    el: EventTarget | null, ev: K, fn: (e: HTMLElementEventMap[K]) => void
): void {
    if (!el) return
    el.addEventListener(ev, fn as EventListener)
    _listeners__.push([el, ev, fn as EventListener])
}

function _markDirty(): void {
    if (!_isDirty) {
        _isDirty = true
        const badge = document.getElementById('em-unsaved-badge')
        const heroBadge = document.getElementById('em-unsaved-hero')
        const saveBtn = document.getElementById('em-save-btn') as HTMLButtonElement | null
        const discardBtn = document.getElementById('em-discard-btn') as HTMLButtonElement | null
        if (badge) badge.style.display = 'flex'
        if (heroBadge) heroBadge.style.display = 'flex'
        if (saveBtn) saveBtn.disabled = false
        if (discardBtn) discardBtn.disabled = false
    }
}

function _updateHeroName(): void {
    const title = (document.getElementById('em-title') as HTMLSelectElement | null)?.value ?? ''
    const first = ((document.getElementById('em-first-name') as HTMLInputElement | null)?.value ?? '').trim()
    const last = ((document.getElementById('em-last-name') as HTMLInputElement | null)?.value ?? '').trim()
    const name = [title, first, last].filter(Boolean).join(' ')
    const heroEl = document.getElementById('em-hero-name')
    if (heroEl) heroEl.textContent = name || 'Member'
}

function _validateField(id: string, errId: string): boolean {
    const el = document.getElementById(id) as HTMLInputElement | null
    const errEl = document.getElementById(errId) as HTMLElement | null
    if (!el || !errEl) return true
    const empty = !el.value.trim()
    el.classList.toggle('error', empty)
    errEl.style.display = empty ? 'flex' : 'none'
    return !empty
}

function _validateEmail(): boolean {
    const el = document.getElementById('em-email') as HTMLInputElement | null
    const errEl = document.getElementById('em-email-err') as HTMLElement | null
    if (!el || !errEl) return true
    if (!el.value.trim()) { el.classList.remove('error'); errEl.style.display = 'none'; return true }
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim())
    el.classList.toggle('error', !valid)
    errEl.style.display = valid ? 'none' : 'flex'
    return valid
}

function _validateAll(): boolean {
    const a = _validateField('em-first-name', 'em-first-name-err')
    const b = _validateField('em-last-name', 'em-last-name-err')
    const c = _validateField('em-gender', 'em-gender-err')
    const d = _validateEmail()
    return a && b && c && d
}

function _showToast(msg: string, type: 'success' | 'error'): void {
    const toast = document.getElementById('em-toast')
    const inner = document.getElementById('em-toast-inner')
    const iconEl = document.getElementById('em-toast-icon')
    const msgEl = document.getElementById('em-toast-msg')
    if (!toast || !inner || !iconEl || !msgEl) return
    inner.className = `em-toast-inner em-toast-${type}`
    iconEl.className = `bi ${type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'}`
    msgEl.textContent = msg
    toast.classList.add('show')
    if (_toastTimer) clearTimeout(_toastTimer)
    _toastTimer = setTimeout(() => toast.classList.remove('show'), 3200)
}

async function _handleSave(): Promise<void> {
  if (!_member) return

  // Collect all form values
  const payload = {
    id:                             _member.id,
    title:                          (document.getElementById('em-title')       as HTMLSelectElement | null)?.value || null,
    first_name:                     (document.getElementById('em-first-name')  as HTMLInputElement  | null)?.value.trim() || undefined,
    last_name:                      (document.getElementById('em-last-name')   as HTMLInputElement  | null)?.value.trim() || undefined,
    date_of_birth:                  (document.getElementById('em-dob')         as HTMLInputElement  | null)?.value || null,
    gender:                         ((document.getElementById('em-gender')     as HTMLSelectElement | null)?.value || undefined) as 'male' | 'female' | undefined,
    marital_status:                 ((document.getElementById('em-marital')    as HTMLSelectElement | null)?.value || null) as any,
    occupation:                     (document.getElementById('em-occupation')   as HTMLInputElement  | null)?.value.trim() || null,
    membership_status:              ((document.getElementById('em-mem-status') as HTMLSelectElement | null)?.value || undefined) as any,
    primary_phone:                  (document.getElementById('em-phone1')      as HTMLInputElement  | null)?.value.trim() || null,
    secondary_phone:                (document.getElementById('em-phone2')      as HTMLInputElement  | null)?.value.trim() || null,
    email:                          (document.getElementById('em-email')        as HTMLInputElement  | null)?.value.trim() || null,
    whatsapp_number:                (document.getElementById('em-whatsapp')    as HTMLInputElement  | null)?.value.trim() || null,
    physical_address:               (document.getElementById('em-address')     as HTMLTextAreaElement | null)?.value.trim() || null,
    facebook_url:                   (document.getElementById('em-facebook')    as HTMLInputElement  | null)?.value.trim() || null,
    instagram_url:                  (document.getElementById('em-instagram')   as HTMLInputElement  | null)?.value.trim() || null,
    join_date:                      (document.getElementById('em-join-date')   as HTMLInputElement  | null)?.value || null,
    emergency_contact_name:         (document.getElementById('em-ec-name')     as HTMLInputElement  | null)?.value.trim() || null,
    emergency_contact_phone:        (document.getElementById('em-ec-phone')    as HTMLInputElement  | null)?.value.trim() || null,
    emergency_contact_relationship: (document.getElementById('em-ec-relation') as HTMLSelectElement | null)?.value || null,
    pastoral_notes:                 (document.getElementById('em-pastoral-notes') as HTMLTextAreaElement | null)?.value.trim() || null,
  }

  // Zod validation
  const parsed = UpdateMemberSchema.safeParse(payload)
  if (!parsed.success) {
    _displayZodErrors_em(parsed.error)
    _showToast('Please fix the highlighted fields.', 'error')
    const saveBtn = document.getElementById('em-save-btn') as HTMLButtonElement | null
    if (saveBtn) { saveBtn.style.animation = 'em-shake 0.4s ease'; setTimeout(() => saveBtn.style.animation = '', 500) }
    return
  }

  const saveBtn = document.getElementById('em-save-btn') as HTMLButtonElement | null
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> <span class="em-save-bar-label">Saving…</span>' }

  try {
    const { id, ...updatePayload } = parsed.data

    // Upload pending photo first if one was selected
    let profile_photo_url: string | undefined
    if (_pendingPhotoFile) {
      try {
        const { uploadProfilePhoto } = await import('../repository')
        const { supabase } = await import('@core/supabase')
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')
        profile_photo_url = await uploadProfilePhoto({
          authUid: user.id,
          fileName: `profile_${Date.now()}_${_pendingPhotoFile.name}`,
          blob: _pendingPhotoFile,
          mimeType: _pendingPhotoFile.type,
        })
        _pendingPhotoFile = null
      } catch (photoErr) {
        console.warn('[EditMember] Photo upload failed:', photoErr)
      }
    }

    await updateMember(_member.id, {
      ...updatePayload,
      ...(profile_photo_url ? { profile_photo_url } : {}),
    })

    _isDirty = false
    document.getElementById('em-unsaved-badge')!.style.display  = 'none'
    document.getElementById('em-unsaved-hero')!.style.display   = 'none'
    const sBtn = document.getElementById('em-save-btn') as HTMLButtonElement | null
    const dBtn = document.getElementById('em-discard-btn') as HTMLButtonElement | null
    if (sBtn) sBtn.disabled = true
    if (dBtn) dBtn.disabled = true
    _showToast('Changes saved successfully', 'success')

  } catch (err: any) {
    _showToast(err?.message ?? 'Save failed. Please try again.', 'error')
  } finally {
    if (saveBtn) {
      saveBtn.disabled = !_isDirty
      saveBtn.innerHTML = '<i class="bi bi-floppy" style="font-size:13px;"></i> <span class="em-save-bar-label">Save Changes</span>'
    }
  }
}

// ── Zod error display for edit form ───────────────────────────────────────────

function _displayZodErrors_em(error: ZodError): void {
  // Map Zod field paths to input IDs and highlight them
  const fieldMap: Record<string, string> = {
    first_name:    'em-first-name',
    last_name:     'em-last-name',
    gender:        'em-gender',
    email:         'em-email',
    facebook_url:  'em-facebook',
    instagram_url: 'em-instagram',
  }
  const errMsgMap: Record<string, string> = {
    first_name: 'em-first-name-err',
    last_name:  'em-last-name-err',
    gender:     'em-gender-err',
    email:      'em-email-err',
  }

  // Clear previous errors
  Object.values(fieldMap).forEach(id => {
    document.getElementById(id)?.classList.remove('error')
  })
  Object.values(errMsgMap).forEach(id => {
    const el = document.getElementById(id)
    if (el) el.style.display = 'none'
  })

  // Tab to switch to for the first error
  const tabFieldMap: Record<string, string> = {
    first_name: 'personal', last_name: 'personal', gender: 'personal',
    email: 'contact', facebook_url: 'contact', instagram_url: 'contact',
  }
  let firstErrTab: string | null = null

  error.errors.forEach(e => {
    const field    = e.path[0] as string
    const inputId  = fieldMap[field]
    const errId    = errMsgMap[field]
    if (inputId) document.getElementById(inputId)?.classList.add('error')
    if (errId) {
      const errEl = document.getElementById(errId)
      if (errEl) {
        errEl.style.display = 'flex'
        // Replace generic "Required" with Zod message when useful
        const span = errEl.querySelector('span') as HTMLElement | null
        if (span) span.textContent = e.message
      }
    }
    const tab = tabFieldMap[field]
    if (tab && !firstErrTab) firstErrTab = tab
  })

  // Switch to the tab containing the first error
  if (firstErrTab) {
    document.querySelectorAll<HTMLElement>('.em-tab-btn').forEach(btn => btn.classList.remove('active'))
    document.querySelectorAll<HTMLElement>('.em-tab-pane').forEach(pane => pane.classList.remove('active'))
    const targetBtn  = document.querySelector<HTMLElement>(`.em-tab-btn[data-tab="${firstErrTab}"]`)
    const targetPane = document.getElementById(`em-tab-${firstErrTab}`)
    targetBtn?.classList.add('active')
    targetPane?.classList.add('active')
  }
}

function _handleDiscard(): void {
    if (!_isDirty) { navigate(`/members/${_member?.id ?? ''}`); return }
    // Show discard modal
    const backdrop = document.createElement('div')
    backdrop.className = 'em-modal-backdrop'
    backdrop.innerHTML = `
    <div class="em-card" style="max-width:380px;width:100%;border-color:var(--border-strong);">
      <div class="em-card-header">
        <div class="em-card-icon" style="background:rgba(240,136,62,0.1);">
          <i class="bi bi-exclamation-triangle-fill" style="font-size:15px;color:#f0883e;"></i>
        </div>
        <h2 style="font-size:13px;font-weight:600;color:var(--text-primary);">Discard Changes?</h2>
      </div>
      <div class="em-card-body">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;line-height:1.55;">
          You have unsaved changes. If you leave now, all edits will be lost.
        </p>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="em-action-btn" id="em-modal-keep">Keep Editing</button>
          <button class="em-action-btn" id="em-modal-discard"
                  style="border-color:rgba(198,0,38,0.3);color:var(--text-danger);">
            <i class="bi bi-trash" style="font-size:13px;"></i> Discard
          </button>
        </div>
      </div>
    </div>`
    document.body.appendChild(backdrop)

    backdrop.querySelector('#em-modal-keep')?.addEventListener('click', () => backdrop.remove())
    backdrop.querySelector('#em-modal-discard')?.addEventListener('click', () => {
        backdrop.remove()
        navigate(`/members/${_member?.id ?? ''}`)
    })
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove() })
}

function _bindEvents(container: HTMLElement, m: MemberView, fullName: string, ini: string, bg: string): void {
    // Tab switching
    container.querySelectorAll<HTMLElement>('.em-tab-btn').forEach(btn => {
        _on__(btn, 'click', () => {
            container.querySelectorAll('.em-tab-btn').forEach(t => t.classList.remove('active'))
            container.querySelectorAll('.em-tab-pane').forEach(p => p.classList.remove('active'))
            btn.classList.add('active')
            const pane = document.getElementById(`em-tab-${btn.dataset.tab}`)
            pane?.classList.add('active')
        })
    })

    // Dirty on any input/change
    const _onInput = () => { _markDirty() }
    container.addEventListener('input', _onInput)
    container.addEventListener('change', _onInput)
    _listeners__.push([container, 'input', _onInput as EventListener])
    _listeners__.push([container, 'change', _onInput as EventListener])

    // Hero name sync
    _on__(document.getElementById('em-title'), 'input', _updateHeroName)
    _on__(document.getElementById('em-first-name'), 'input', _updateHeroName)
    _on__(document.getElementById('em-last-name'), 'input', _updateHeroName)

    // Save & discard from save bar
    _on__(document.getElementById('em-save-btn'), 'click', _handleSave)
    _on__(document.getElementById('em-discard-btn'), 'click', _handleDiscard)

    // Avatar preview click → expand modal (not the upload button)
    _on__(document.getElementById('em-avatar-preview'), 'click', (e) => {
        if ((e.target as HTMLElement).closest('#em-avatar-btn')) return
        _openAvatarModal_em(fullName, ini, bg)
    })
    _on__(document.getElementById('em-modal-close'), 'click', _closeAvatarModal_em)
    _on__(document.getElementById('em-avatar-modal'), 'click', (e) => {
        if ((e.target as HTMLElement).id === 'em-avatar-modal') _closeAvatarModal_em()
    })

    // Avatar upload
    _on__(document.getElementById('em-avatar-btn'), 'click', () => {
        document.getElementById('em-avatar-file')?.click()
    })
    _on__(document.getElementById('em-avatar-file') as HTMLInputElement, 'change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        _pendingPhotoFile = file
        const reader = new FileReader()
        reader.onload = ev => {
            const preview = document.getElementById('em-avatar-preview') as HTMLElement | null
            if (preview) {
                preview.style.backgroundImage = `url(${ev.target?.result})`
                preview.style.backgroundSize = 'cover'
                preview.style.backgroundPosition = 'center'
                preview.textContent = ''
            }
            _markDirty()
        }
        reader.readAsDataURL(file)
    })

    // Char counter for notes
    const notesEl = document.getElementById('em-pastoral-notes') as HTMLTextAreaElement | null
    const cntEl = document.getElementById('em-notes-count')
    if (notesEl && cntEl) {
        const _updateCount = () => {
            const len = notesEl.value.length
            cntEl.textContent = `${len} / 500`
            cntEl.classList.toggle('warn', len > 425)
            if (len > 500) notesEl.value = notesEl.value.slice(0, 500)
        }
        _on__(notesEl, 'input', _updateCount)
        _updateCount()
    }

    // Validation: clear error on fix
    _on__(document.getElementById('em-first-name') as HTMLInputElement, 'input', () => _validateField('em-first-name', 'em-first-name-err'))
    _on__(document.getElementById('em-last-name') as HTMLInputElement, 'input', () => _validateField('em-last-name', 'em-last-name-err'))
    _on__(document.getElementById('em-gender') as HTMLSelectElement, 'change', () => _validateField('em-gender', 'em-gender-err'))
    _on__(document.getElementById('em-email') as HTMLInputElement, 'input', _validateEmail)

    // Escape key closes any modal
    const _onKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            _closeAvatarModal_em()
            document.querySelector('.em-modal-backdrop')?.remove()
        }
    }
    document.addEventListener('keydown', _onKeydown)
    _listeners__.push([document, 'keydown', _onKeydown as EventListener])
}