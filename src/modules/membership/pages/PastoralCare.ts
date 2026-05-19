// src/modules/membership/pages/PastoralCare.ts
// Standalone pastoral care page — flags, first-timers, life events.

import type { PageModule } from '../../../types/module.types'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { listMembers } from '../repository'
import { injectMembershipCSS } from '../member-helpers'

interface PcFlag { id: string; member: string; memberId: string; type: string; reason: string; date: string; assignTo: string; priority: string; resolved: boolean }

let _container: HTMLElement | null = null
let _flags: PcFlag[] = []

const PastoralCare: PageModule = {
  async render(container) {
    _container = container
    injectMembershipCSS()

    // Load real members for the flag form
    let memberOptions = ''
    try {
      const members = await listMembers({ includeDeleted: false }, { limit: 500, sortBy: 'last_name' })
      memberOptions = members.map(m => `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`).join('')
    } catch { /* non-fatal */ }

    // Seed mock flags (TODO: wire to pastoral_flags table when available)
    _flags = [
      { id:'f1', member:'Kofi Acheampong', memberId:'', type:'absent', reason:'Absent 5+ weeks', date:'May 3, 2025', assignTo:'Elder Mensah', priority:'high', resolved:false },
      { id:'f2', member:'Akosua Frimpong', memberId:'', type:'followup', reason:'Prospect — needs follow-up', date:'Apr 29, 2025', assignTo:'Deaconess Ama', priority:'normal', resolved:false },
      { id:'f3', member:'Yaa Asantewaa', memberId:'', type:'life-event', reason:'Bereavement — lost mother', date:'May 1, 2025', assignTo:'Pastor', priority:'urgent', resolved:false },
    ]

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:960px;margin:0 auto;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
    <div>
      <h2 style="margin:0;font-size:20px;font-weight:700;color:var(--mm-text-primary);">Pastoral Care</h2>
      <div style="font-size:13px;color:var(--mm-text-secondary);">Track pastoral flags, first-timers, and life events.</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="mm-btn-primary" id="pc-addFlagBtn">+ Add Flag</button>
      <button class="mm-btn-outline" onclick="history.back()">← Back</button>
    </div>
  </div>

  <!-- Active Flags -->
  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:20px;margin-bottom:20px;">
    <div style="font-size:15px;font-weight:600;color:var(--mm-text-primary);margin-bottom:14px;">
      Active Flags <span class="mm-badge red" id="pc-flagCount">0</span>
    </div>
    <div id="pc-flagsContainer"></div>
  </div>

  <!-- Flag Modal -->
  <div class="mm-modal-overlay" id="pc-flagOverlay" style="display:none;"></div>
  <div class="mm-modal" id="pc-flagModal" style="display:none;">
    <div class="mm-modal-header">
      <span class="mm-modal-title">Add Pastoral Flag</span>
      <button class="mm-modal-close" id="pc-closeFlag">✕</button>
    </div>
    <div class="mm-modal-body">
      <div class="mm-form-group">
        <label class="mm-form-label">Member *</label>
        <select class="mm-form-select" id="pc-flagMember">
          <option value="">Select member…</option>
          ${memberOptions}
        </select>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Flag Type</label>
        <select class="mm-form-select" id="pc-flagType">
          <option value="followup">Follow-up</option>
          <option value="absent">Extended Absence</option>
          <option value="life-event">Life Event</option>
          <option value="first-timer">First Timer</option>
        </select>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Priority</label>
        <select class="mm-form-select" id="pc-flagPriority">
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Assign To</label>
        <input class="mm-form-input" id="pc-flagAssign" placeholder="e.g. Elder Mensah">
      </div>
      <div class="mm-form-group">
        <label class="mm-form-label">Notes / Reason</label>
        <textarea class="mm-form-textarea" id="pc-flagNotes" rows="3" placeholder="Describe the pastoral situation…"></textarea>
      </div>
    </div>
    <div class="mm-modal-footer">
      <button class="mm-btn-primary" id="pc-saveFlag">Add Flag</button>
      <button class="mm-btn-outline" id="pc-cancelFlag">Cancel</button>
    </div>
  </div>
</div>`

    _renderFlags()
    _bindEvents(memberOptions)
  },

  destroy() { _container = null; _flags = [] },
}

export default PastoralCare

function _renderFlags(): void {
  if (!_container) return
  const el = _container.querySelector('#pc-flagsContainer')
  const countEl = _container.querySelector('#pc-flagCount')
  const open = _flags.filter(f => !f.resolved)
  if (countEl) countEl.textContent = String(open.length)

  const priorityBadge = (p: string) => p === 'high' || p === 'urgent'
    ? `<span class="mm-badge red" style="font-size:10px;">${p}</span>` : ''

  const typeColors: Record<string, string> = {
    followup: 'followup', absent: 'absent', 'life-event': 'life-event', 'first-timer': 'first-timer',
  }

  if (el) {
    el.innerHTML = open.length ? open.map(f => `
<div class="mm-flag-item">
  <div class="mm-flag-dot ${typeColors[f.type] ?? 'followup'}"></div>
  <div class="mm-flag-content">
    <div class="mm-flag-name">${f.member} ${priorityBadge(f.priority)}</div>
    <div class="mm-flag-reason">${f.reason}</div>
    <div class="mm-flag-date">${f.date}${f.assignTo ? ' · Assigned to ' + f.assignTo : ''}</div>
  </div>
  <div class="mm-flag-actions">
    <button class="mm-pc-action-btn" data-resolve-flag="${f.id}">Resolve</button>
    ${f.memberId ? `<button class="mm-btn-icon" data-view-member="${f.memberId}" title="View member">
      <svg viewBox="0 0 24 24" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    </button>` : ''}
  </div>
</div>`).join('')
      : `<div style="font-size:13px;color:var(--mm-text-secondary);padding:12px 0;">All clear — no open flags.</div>`

    el.querySelectorAll<HTMLButtonElement>('[data-resolve-flag]').forEach(btn => {
      btn.addEventListener('click', () => {
        const flag = _flags.find(f => f.id === btn.dataset['resolveFlag'])
        if (flag) { flag.resolved = true; _renderFlags(); Toast.success('Flag resolved.') }
      })
    })
    el.querySelectorAll<HTMLButtonElement>('[data-view-member]').forEach(btn => {
      btn.addEventListener('click', () => navigate(`/members/${btn.dataset['viewMember']}`))
    })
  }
}

function _bindEvents(_memberOptions: string): void {
  if (!_container) return
  const openModal = () => {
    _container!.querySelector<HTMLElement>('#pc-flagModal')!.style.display = ''
    _container!.querySelector<HTMLElement>('#pc-flagOverlay')!.style.display = ''
    document.body.style.overflow = 'hidden'
  }
  const closeModal = () => {
    _container!.querySelector<HTMLElement>('#pc-flagModal')!.style.display = 'none'
    _container!.querySelector<HTMLElement>('#pc-flagOverlay')!.style.display = 'none'
    document.body.style.overflow = ''
  }

  _container.querySelector('#pc-addFlagBtn')?.addEventListener('click', openModal)
  _container.querySelector('#pc-closeFlag')?.addEventListener('click', closeModal)
  _container.querySelector('#pc-cancelFlag')?.addEventListener('click', closeModal)
  _container.querySelector('#pc-flagOverlay')?.addEventListener('click', closeModal)

  _container.querySelector('#pc-saveFlag')?.addEventListener('click', () => {
    const memberId = (_container!.querySelector<HTMLSelectElement>('#pc-flagMember')?.value ?? '').trim()
    const notes    = (_container!.querySelector<HTMLTextAreaElement>('#pc-flagNotes')?.value ?? '').trim()
    if (!memberId) { Toast.warning('Please select a member.'); return }
    const sel = _container!.querySelector<HTMLSelectElement>('#pc-flagMember')!
    const memberName = sel.options[sel.selectedIndex]?.text ?? memberId
    _flags.unshift({
      id: 'f' + Date.now(),
      member: memberName,
      memberId,
      type:     _container!.querySelector<HTMLSelectElement>('#pc-flagType')?.value ?? 'followup',
      reason:   notes || 'Follow-up required',
      date:     new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }),
      assignTo: _container!.querySelector<HTMLInputElement>('#pc-flagAssign')?.value.trim() ?? '',
      priority: _container!.querySelector<HTMLSelectElement>('#pc-flagPriority')?.value ?? 'normal',
      resolved: false,
    })
    closeModal()
    _renderFlags()
    Toast.success('Flag added.')
  })
}
