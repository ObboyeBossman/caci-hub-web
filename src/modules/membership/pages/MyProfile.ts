// src/modules/membership/pages/MyProfile.ts
// The current user's own member profile page.
// Looks up the linked member record via getCurrentUser().

import type { PageModule } from '../../../types/module.types'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { Toast } from '@shared/components/Toast'
import { navigate } from '@core/router'
import { getMember, deactivateMember, getMemberAuditLog } from '../repository'
import type { MemberView, MemberAuditEntry } from '../../../types/member.types'
import { avatarColor, initials, fmtDate, statusBadge, injectMembershipCSS } from '../utils/member-helpers'
import { getCurrentUser } from '@core/auth'

const MyProfile: PageModule = {
  async render(container) {
    renderSkeleton(container, 'profile')
    injectMembershipCSS()

    const user = getCurrentUser()
    // MyProfile uses the member ID passed in dataset (e.g. from sidebar),
    // or falls back to a lookup. AppUser doesn't carry linked_member_id.
    const memberId = container.dataset['id'] ?? null

    if (!memberId) {
      container.innerHTML = `
<div class="mm-root" style="padding:40px;text-align:center;color:var(--mm-text-secondary);">
  <div style="font-size:40px;margin-bottom:12px;">👤</div>
  <div style="font-size:17px;font-weight:600;color:var(--mm-text-primary);margin-bottom:8px;">No Member Profile Linked</div>
  <div style="font-size:13px;">Your account is not yet linked to a member record.</div>
  <button class="mm-btn-outline" style="margin-top:20px;" onclick="history.back()">Go Back</button>
</div>`
      return
    }

    let member: MemberView
    let auditLog: MemberAuditEntry[] = []
    try {
      member = await getMember(memberId)
      try { auditLog = await getMemberAuditLog(memberId) } catch { /* permission denied */ }
    } catch (err) {
      renderError(container, err, { retry: () => MyProfile.render(container) })
      return
    }

    const s   = statusBadge(member.membership_status)
    const bg  = avatarColor(`${member.first_name} ${member.last_name}`)
    const ini = initials(member.first_name, member.last_name)

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:900px;margin:0 auto;">
  <div style="margin-bottom:20px;">
    <div style="font-size:13px;color:var(--mm-text-secondary);">Logged in as: <strong>${user?.email ?? 'unknown'}</strong></div>
  </div>

  <!-- Profile header -->
  <div style="display:flex;align-items:flex-start;gap:20px;margin-bottom:28px;
    flex-wrap:wrap;background:var(--mm-bg-card);border:1px solid var(--mm-border);
    border-radius:12px;padding:24px;">
    <div style="width:72px;height:72px;border-radius:50%;background:${bg};
      display:flex;align-items:center;justify-content:center;color:#fff;
      font-size:24px;font-weight:700;flex-shrink:0;">${ini}</div>
    <div style="flex:1;">
      <div style="font-size:22px;font-weight:700;color:var(--mm-text-primary);margin-bottom:4px;">
        ${member.first_name} ${member.last_name}
      </div>
      <div style="font-size:12px;color:var(--mm-text-muted);font-family:monospace;margin-bottom:10px;">
        ${member.membership_number ?? 'No membership number yet'}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <span class="mm-badge ${s.cls}">${s.label}</span>
        <span class="mm-badge ${member.gender === 'female' ? 'purple' : ''}">${member.gender}</span>
        ${member.marital_status ? `<span class="mm-badge">${member.marital_status}</span>` : ''}
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="mm-btn-primary" id="mp-editBtn">Edit Profile</button>
      <button class="mm-btn-outline" id="mp-smsBtn">Send SMS</button>
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
    </div>

    <div id="mm-mptab-contact" style="display:none;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div>
          <div class="mm-detail-section-title">Contact Details</div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Phone</span><span class="mm-detail-field-val">${member.phone_number ?? '—'}</span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Email</span><span class="mm-detail-field-val" style="word-break:break-all;font-size:12px;">${member.email ?? '—'}</span></div>
          <div class="mm-detail-field"><span class="mm-detail-field-label">Address</span><span class="mm-detail-field-val" style="font-size:12px;">${member.physical_address ?? '—'}</span></div>
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

    <div id="mm-mptab-audit" style="display:none;">
      ${auditLog.length === 0
        ? `<div style="font-size:13px;color:var(--mm-text-secondary);padding:20px 0;text-align:center;">No audit entries found.</div>`
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
</div>`

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

    container.querySelector('#mp-editBtn')?.addEventListener('click', () =>
      navigate(`/members/${member.id}/edit`)
    )
    container.querySelector('#mp-smsBtn')?.addEventListener('click', () => {
      if (member.phone_number) Toast.info(`SMS compose for ${member.first_name} — ${member.phone_number}`)
      else Toast.warning('No phone number on record.')
    })
  },

  destroy() {},
}

export default MyProfile
