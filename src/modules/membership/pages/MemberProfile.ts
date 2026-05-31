// src/modules/membership/pages/MemberProfile.ts
// Full-page member profile — navigated to via /members/:id

import { formatName } from '@modules/membership/utils/member-helpers'
import type { PageModule }             from '../../../types/module.types'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast }                       from '@shared/components/Toast'
import { navigate }                    from '@core/router'
import { getCurrentUser }                  from '../../../core/auth'
import { isAdmin as userIsAdmin }          from '../../../core/authorization/authorization-service'
import { supabase }                        from '../../../core/supabase'
import { emit }                            from '../../../core/events'
import { getMember, deactivateMember, updateMember, getMemberAuditLog } from '../repository'
import type { MemberView, MemberAuditEntry } from '../../../types/member.types'
import { avatarColor, initials, fmtDate, statusBadge, injectMembershipCSS } from '../utils/member-helpers'

let _container: HTMLElement | null = null

const MemberProfile: PageModule = {
  async render(container) {
    _container = container
    renderSkeleton(container, 'profile')

    // Inject CSS
    injectMembershipCSS()

    const memberId = container.dataset['id']
    if (!memberId) { renderError(container, new Error('No member ID in route')); return }

    let member: MemberView
    let auditLog: MemberAuditEntry[] = []

    try {
      member   = await getMember(memberId)
      try { auditLog = await getMemberAuditLog(memberId) } catch { /* permission denied — non-fatal */ }
    } catch (err) {
      renderError(container, err, { retry: () => MemberProfile.render(container) })
      return
    }

    const s  = statusBadge(member.membership_status)
    const bg = avatarColor(`${formatName(member.first_name, member.last_name, member.title)}`)
    const ini = initials(member.first_name, member.last_name)
    const currentUser = getCurrentUser()
    const isAdmin = currentUser?.role === 'admin'

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:900px;margin:0 auto;">

  <!-- Back -->
  <button id="mp-back" style="display:inline-flex;align-items:center;gap:6px;
    color:var(--mm-text-secondary);font-size: var(--text-base);border:none;background:none;
    cursor:pointer;margin-bottom:20px;font-family:inherit;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    Back to Members
  </button>

  <!-- Profile header -->
  <div style="display:flex;align-items:flex-start;gap:20px;margin-bottom:28px;
    flex-wrap:wrap;background:var(--mm-bg-card);border:1px solid var(--mm-border);
    border-radius:12px;padding:24px;">
    <div style="width:72px;height:72px;border-radius:50%;background:${bg};
      display:flex;align-items:center;justify-content:center;color:#fff;
      font-size: var(--text-3xl);font-weight:700;flex-shrink:0;">${ini}</div>
    <div style="flex:1;">
      <div style="font-size: var(--text-3xl);font-weight:700;color:var(--mm-text-primary);
        margin-bottom:4px;">${formatName(member.first_name, member.last_name, member.title)}</div>
      <div style="font-size: var(--text-sm);color:var(--mm-text-muted);font-family:monospace;
        margin-bottom:10px;">${member.membership_number ?? 'No membership number yet'}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <span class="mm-badge ${s.cls}">${s.label}</span>
        <span class="mm-badge ${member.gender === 'female' ? 'purple' : ''}">${member.gender}</span>
        ${member.marital_status ? `<span class="mm-badge">${member.marital_status}</span>` : ''}
        ${member.auth_user_id ? `<span class="mm-badge" style="background:#e0f2fe;color:#0369a1;border-color:#b9e6fe;"><i class="bi bi-shield-check"></i> Login active</span>` : ''}
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="mm-btn-primary" id="mp-editBtn">Edit Profile</button>
      <button class="mm-btn-outline" id="mp-smsBtn">Send SMS</button>
      <button class="mm-btn-danger" id="mp-deactivateBtn">Deactivate</button>
      ${!member.auth_user_id && userIsAdmin(currentUser) ? `<button class="mm-btn-outline" id="mp-provisionBtn">Provision Login</button>` : ''}
      ${member.auth_user_id && userIsAdmin(currentUser) ? `<button class="mm-btn-outline" id="mp-resetPwBtn">Reset Password</button>` : ''}
      ${member.auth_user_id && userIsAdmin(currentUser) ? `<button class="mm-btn-danger" style="background:#fee2e2;color:#b91c1c;border-color:#fecaca;" id="mp-deleteAuthBtn">Delete Login</button>` : ''}
    </div>
  </div>

  <!-- Tabs -->
  <div class="mm-detail-tabs" style="background:var(--mm-bg-card);border:1px solid var(--mm-border);
    border-radius:12px 12px 0 0;padding:0 24px;margin-bottom:0;">
    <button class="mm-detail-tab active" data-mptab="info">Profile Info</button>
    <button class="mm-detail-tab" data-mptab="contact">Contact</button>
    <button class="mm-detail-tab" data-mptab="audit">Audit Log</button>
  </div>

  <!-- Tab panels -->
  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);
    border-top:none;border-radius:0 0 12px 12px;padding:24px;">

    <!-- Info -->
    <div id="mm-mptab-info">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div>
          <div class="mm-detail-section-title">Personal</div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Date of Birth</span><span class="mm-detail-field-val">${fmtDate(member.date_of_birth)}</span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Gender</span><span class="mm-detail-field-val">${member.gender}</span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Marital Status</span><span class="mm-detail-field-val">${member.marital_status ?? '—'}</span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Occupation</span><span class="mm-detail-field-val">${member.occupation ?? '—'}</span></div>
        </div>
        <div>
          <div class="mm-detail-section-title">Church Info</div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Status</span><span class="mm-detail-field-val"><span class="mm-badge ${s.cls}">${s.label}</span></span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Joined</span><span class="mm-detail-field-val">${fmtDate(member.join_date)}</span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Member Since</span><span class="mm-detail-field-val">${fmtDate(member.created_at)}</span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Membership #</span><span class="mm-detail-field-val" style="font-family:monospace;font-size: var(--text-sm);">${member.membership_number ?? '—'}</span></div>
        </div>
      </div>
      ${member.pastoral_notes ? `
      <div style="margin-top:20px;">
        <div class="mm-detail-section-title">Pastoral Notes</div>
        <div style="font-size: var(--text-base);color:var(--mm-text-primary);line-height:1.6;
          background:var(--mm-bg-card2);border:1px solid var(--mm-border-subtle);
          border-radius:6px;padding:12px;">${member.pastoral_notes}</div>
      </div>` : ''}
    </div>

    <!-- Contact -->
    <div id="mm-mptab-contact" style="display:none;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div>
          <div class="mm-detail-section-title">Contact Details</div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Primary Phone</span><span class="mm-detail-field-val">${member.primary_phone ?? '—'}</span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Secondary Phone</span><span class="mm-detail-field-val">${member.secondary_phone ?? '—'}</span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Email</span><span class="mm-detail-field-val" style="word-break:break-all;font-size: var(--text-sm);">${member.email ?? '—'}</span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Address</span><span class="mm-detail-field-val" style="font-size: var(--text-sm);">${member.physical_address ?? '—'}</span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">WhatsApp</span><span class="mm-detail-field-val">${member.whatsapp_number ?? '—'}</span></div>
        </div>
        ${member.emergency_contact_name ? `
        <div>
          <div class="mm-detail-section-title">Emergency Contact</div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Name</span><span class="mm-detail-field-val">${member.emergency_contact_name}</span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Phone</span><span class="mm-detail-field-val">${member.emergency_contact_phone ?? '—'}</span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Relationship</span><span class="mm-detail-field-val">${member.emergency_contact_relationship ?? '—'}</span></div>
        </div>` : ''}
      </div>
    </div>

    <!-- Audit log -->
    <div id="mm-mptab-audit" style="display:none;">
      ${auditLog.length === 0
        ? `<div style="font-size: var(--text-base);color:var(--mm-text-secondary);padding:20px 0;text-align:center;">
             No audit entries or insufficient permissions to view.
           </div>`
        : `<table class="mm-table">
             <thead><tr><th>Field</th><th>Old Value</th><th>New Value</th><th>Changed By</th><th>When</th></tr></thead>
             <tbody>${auditLog.map(e => `
               <tr>
                 <td style="font-size: var(--text-sm);font-family:monospace;">${e.field_changed}</td>
                 <td style="font-size: var(--text-sm);color:var(--mm-text-muted);">${e.old_value ?? '—'}</td>
                 <td style="font-size: var(--text-sm);">${e.new_value ?? '—'}</td>
                 <td style="font-size: var(--text-sm);">${e.changed_by_name ?? 'System'}</td>
                 <td style="font-size: var(--text-sm);">${fmtDate(e.changed_at)}</td>
               </tr>`).join('')}
             </tbody>
           </table>`}
    </div>

  </div>
  </div>
</div>

  </div>
</div>
`

    // Tab switching
    container.querySelectorAll<HTMLButtonElement>('[data-mptab]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('[data-mptab]').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        const tab = btn.dataset['mptab']!
        container.querySelectorAll<HTMLElement>('[id^="mm-mptab-"]').forEach(p => {
          p.style.display = p.id === `mm-mptab-${tab}` ? '' : 'none'
        })
      })
    })

    // Back
    container.querySelector('#mp-back')?.addEventListener('click', () => navigate('/members'))

    // Edit
    container.querySelector('#mp-editBtn')?.addEventListener('click', () => {
      navigate(`/members/${member.id}/edit`)
    })

    // SMS
    container.querySelector('#mp-smsBtn')?.addEventListener('click', () => {
      if (member.primary_phone) {
        Toast.info(`SMS compose for ${member.first_name} — ${member.primary_phone}`)
      } else {
        Toast.warning('No phone number on record.')
      }
    })

    // Deactivate
    container.querySelector('#mp-deactivateBtn')?.addEventListener('click', async () => {
      if (!confirm(`Deactivate ${formatName(member.first_name, member.last_name, member.title)}?`)) return
      try {
        await deactivateMember(member.id)
        Toast.success(`${formatName(member.first_name, member.last_name, member.title)} deactivated.`)
        navigate('/members')
      } catch (err) {
        Toast.fromError(err)
      }
    })

    // Provision
    container.querySelector('#mp-provisionBtn')?.addEventListener('click', () => {
      navigate(`/admin/users/provision/${member.id}`)
    })

    // Reset Password
    container.querySelector('#mp-resetPwBtn')?.addEventListener('click', async () => {
      if (!confirm(`Reset ${formatName(member.first_name, member.last_name, member.title)} to assembly default password? They will be required to change it on next login.`)) return
      const { error } = await supabase.functions.invoke('reset-member-password', {
        body: { memberId: member.id }
      })
      if (error) {
        Toast.error(error.message ?? 'Failed to reset password.')
        return
      }
      Toast.success('Password reset to assembly default.')
    })

    // Delete Auth
    container.querySelector('#mp-deleteAuthBtn')?.addEventListener('click', async () => {
      if (!confirm(`Remove login access for ${member.first_name}? Their member record is not affected.`)) return
      const { error } = await supabase.functions.invoke('delete-member-auth', {
        body: { memberId: member.id }
      })
      if (error) {
        Toast.error(error.message ?? 'Failed to delete login account.')
        return
      }
      Toast.success('Login account removed.')
      emit('member:updated', { memberId: member.id })
      navigate(`/members/${member.id}`)
    })
  },

  destroy() {
    _container = null
  },
}

export default MemberProfile