// src/modules/membership/pages/MemberProfile.ts
// Full-page member profile — navigated to via /members/:id

import type { PageModule }             from '../../../types/module.types'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast }                       from '@shared/components/Toast'
import { navigate }                    from '@core/router'
import { getCurrentUser }                  from '@core/auth'
import { getMember, deactivateMember, updateMember, getMemberAuditLog, provisionUser } from '../repository'
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
    const bg = avatarColor(`${member.first_name} ${member.last_name}`)
    const ini = initials(member.first_name, member.last_name)
    const currentUser = getCurrentUser()
    const isAdmin = currentUser?.role === 'admin'

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:900px;margin:0 auto;">

  <!-- Back -->
  <button id="mp-back" style="display:inline-flex;align-items:center;gap:6px;
    color:var(--mm-text-secondary);font-size:13px;border:none;background:none;
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
      font-size:24px;font-weight:700;flex-shrink:0;">${ini}</div>
    <div style="flex:1;">
      <div style="font-size:22px;font-weight:700;color:var(--mm-text-primary);
        margin-bottom:4px;">${member.first_name} ${member.last_name}</div>
      <div style="font-size:12px;color:var(--mm-text-muted);font-family:monospace;
        margin-bottom:10px;">${member.membership_number ?? 'No membership number yet'}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <span class="mm-badge ${s.cls}">${s.label}</span>
        <span class="mm-badge ${member.gender === 'female' ? 'purple' : ''}">${member.gender}</span>
        ${member.marital_status ? `<span class="mm-badge">${member.marital_status}</span>` : ''}
        ${member.auth_user_id ? `<span class="mm-badge" style="background:#e0f2fe;color:#0369a1;border-color:#b9e6fe;"><i class="bi bi-shield-check"></i> Login active</span>` : ''}
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${isAdmin && !member.auth_user_id ? `<button class="mm-btn-primary" id="mp-provisionBtn" style="background:var(--caci-accent);">Provision login</button>` : ''}
      <button class="mm-btn-primary" id="mp-editBtn">Edit Profile</button>
      <button class="mm-btn-outline" id="mp-smsBtn">Send SMS</button>
      <button class="mm-btn-danger" id="mp-deactivateBtn">Deactivate</button>
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
          <div class="mm-detail-field"><span class="mm-detail-field-label">Membership #</span><span class="mm-detail-field-val" style="font-family:monospace;font-size:12px;">${member.membership_number ?? '—'}</span></div>
        </div>
      </div>
      ${member.pastoral_notes ? `
      <div style="margin-top:20px;">
        <div class="mm-detail-section-title">Pastoral Notes</div>
        <div style="font-size:13px;color:var(--mm-text-primary);line-height:1.6;
          background:var(--mm-bg-card2);border:1px solid var(--mm-border-subtle);
          border-radius:6px;padding:12px;">${member.pastoral_notes}</div>
      </div>` : ''}
    </div>

    <!-- Contact -->
    <div id="mm-mptab-contact" style="display:none;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div>
          <div class="mm-detail-section-title">Contact Details</div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Phone</span><span class="mm-detail-field-val">${member.phone_number ?? '—'}</span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Email</span><span class="mm-detail-field-val" style="word-break:break-all;font-size:12px;">${member.email ?? '—'}</span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Address</span><span class="mm-detail-field-val" style="font-size:12px;">${member.physical_address ?? '—'}</span></div>
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
        ? `<div style="font-size:13px;color:var(--mm-text-secondary);padding:20px 0;text-align:center;">
             No audit entries or insufficient permissions to view.
           </div>`
        : `<table class="mm-table">
             <thead><tr><th>Field</th><th>Old Value</th><th>New Value</th><th>Changed By</th><th>When</th></tr></thead>
             <tbody>${auditLog.map(e => `
               <tr>
                 <td style="font-size:12px;font-family:monospace;">${e.field_changed}</td>
                 <td style="font-size:12px;color:var(--mm-text-muted);">${e.old_value ?? '—'}</td>
                 <td style="font-size:12px;">${e.new_value ?? '—'}</td>
                 <td style="font-size:12px;">${e.changed_by_name ?? 'System'}</td>
                 <td style="font-size:12px;">${fmtDate(e.changed_at)}</td>
               </tr>`).join('')}
             </tbody>
           </table>`}
    </div>

  </div>
  </div>
</div>

<!-- Provision Modal -->
${isAdmin && !member.auth_user_id ? `
<div id="mp-provisionModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;z-index:9999;">
  <div style="background:var(--mm-bg-card);border-radius:12px;padding:24px;width:100%;max-width:400px;box-shadow:0 10px 25px rgba(0,0,0,0.1);">
    <h3 style="margin-top:0;margin-bottom:16px;">Provision Login</h3>
    <form id="mp-provisionForm">
      <div style="margin-bottom:12px;">
        <label style="display:block;margin-bottom:4px;font-size:13px;font-weight:500;">Email (Required for invite/explicit)</label>
        <input type="email" id="prov-email" value="${member.email ?? ''}" style="width:100%;padding:8px;border:1px solid var(--border-default);border-radius:4px;" />
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;margin-bottom:4px;font-size:13px;font-weight:500;">Role</label>
        <select id="prov-role" style="width:100%;padding:8px;border:1px solid var(--border-default);border-radius:4px;">
          <option value="member">Member</option>
          <option value="volunteer">Volunteer</option>
          <option value="secretary">Secretary</option>
          <option value="pastor">Pastor</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:4px;font-size:13px;font-weight:500;">Provisioning Method</label>
        <select id="prov-path" style="width:100%;padding:8px;border:1px solid var(--border-default);border-radius:4px;">
          <option value="invite">Send Email Invite</option>
          <option value="default_password">Use Assembly Default Password</option>
        </select>
      </div>
      <div style="display:flex;gap:12px;justify-content:flex-end;">
        <button type="button" id="prov-cancel" class="mm-btn-outline">Cancel</button>
        <button type="submit" id="prov-submit" class="mm-btn-primary">Provision</button>
      </div>
    </form>
  </div>
</div>` : ''}
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

    // Provision
    const provBtn = container.querySelector('#mp-provisionBtn')
    const provModal = container.querySelector<HTMLElement>('#mp-provisionModal')
    const provForm = container.querySelector<HTMLFormElement>('#mp-provisionForm')
    const provCancel = container.querySelector('#prov-cancel')

    if (provBtn && provModal && provForm && provCancel) {
      provBtn.addEventListener('click', () => provModal.style.display = 'flex')
      provCancel.addEventListener('click', () => provModal.style.display = 'none')

      provForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        const submitBtn = provForm.querySelector<HTMLButtonElement>('#prov-submit')!
        const email = provForm.querySelector<HTMLInputElement>('#prov-email')!.value.trim()
        const role = provForm.querySelector<HTMLSelectElement>('#prov-role')!.value
        const path = provForm.querySelector<HTMLSelectElement>('#prov-path')!.value as any
        
        submitBtn.disabled = true
        submitBtn.textContent = 'Provisioning...'
        
        try {
          const res = await provisionUser({ memberId: member.id, role, path, email })
          Toast.success('User provisioned successfully.')
          provModal.style.display = 'none'
          
          // Re-render the page to update the states (badge instead of button)
          await MemberProfile.render(container)
        } catch (err: any) {
          Toast.error(err?.message || 'Provisioning failed.')
          console.error(err)
        } finally {
          submitBtn.disabled = false
          submitBtn.textContent = 'Provision'
        }
      })
    }

    // Back
    container.querySelector('#mp-back')?.addEventListener('click', () => navigate('/members'))

    // Edit
    container.querySelector('#mp-editBtn')?.addEventListener('click', () => {
      navigate(`/members/${member.id}/edit`)
    })

    // SMS
    container.querySelector('#mp-smsBtn')?.addEventListener('click', () => {
      if (member.phone_number) {
        Toast.info(`SMS compose for ${member.first_name} — ${member.phone_number}`)
      } else {
        Toast.warning('No phone number on record.')
      }
    })

    // Deactivate
    container.querySelector('#mp-deactivateBtn')?.addEventListener('click', async () => {
      if (!confirm(`Deactivate ${member.first_name} ${member.last_name}?`)) return
      try {
        await deactivateMember(member.id)
        Toast.success(`${member.first_name} ${member.last_name} deactivated.`)
        navigate('/members')
      } catch (err) {
        Toast.fromError(err)
      }
    })
  },

  destroy() {
    _container = null
  },
}

export default MemberProfile