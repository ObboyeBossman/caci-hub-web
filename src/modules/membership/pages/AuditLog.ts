// src/modules/membership/pages/AuditLog.ts
// Assembly-wide member audit log — visible to admin and pastor roles.

import type { PageModule } from '../../../types/module.types'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { navigate } from '@core/router'
import { supabase } from '@core/supabase'
import { getActiveAssemblyId } from '@core/auth'
import { fmtDate, injectMembershipCSS } from '../utils/member-helpers'
import { Toast } from '@shared/components/Toast'

interface AuditRow {
  id: string
  member_id: string
  field_changed: string
  old_value: string | null
  new_value: string | null
  changed_at: string
  changed_by_name: string | null
  member_name: string | null
}

const AuditLog: PageModule = {
  async render(container) {
    renderSkeleton(container, 'table')
    injectMembershipCSS()

    let rows: AuditRow[] = []
    try {
      const assemblyId = getActiveAssemblyId()
      let query = supabase
        .from('member_audit_log')
        .select('*, members_view!member_audit_log_member_id_fkey(first_name, last_name)')
        .order('changed_at', { ascending: false })
        .limit(200)

      if (assemblyId) query = query.eq('assembly_id', assemblyId)

      const { data, error } = await query
      if (error) throw error

      // Manual join of user profiles
      const actorIds = [...new Set((data ?? []).map((r: any) => r.changed_by).filter(Boolean))] as string[]
      const actorMap = new Map<string, string>()
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', actorIds)
        ;(profiles ?? []).forEach((p: any) => actorMap.set(p.id, p.full_name))
      }

      rows = (data ?? []).map((r: any) => ({
        id:             r.id,
        member_id:      r.member_id,
        field_changed:  r.field_changed,
        old_value:      r.old_value,
        new_value:      r.new_value,
        changed_at:     r.changed_at,
        changed_by_name: actorMap.get(r.changed_by) ?? null,
        member_name: r.members_view
          ? `${r.members_view.first_name} ${r.members_view.last_name}`
          : null,
      }))
    } catch (err) {
      renderError(container, err, { retry: () => AuditLog.render(container) })
      return
    }

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:1000px;margin:0 auto;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
    <div>
      <h2 style="margin:0;font-size:20px;font-weight:700;color:var(--mm-text-primary);">Audit Log</h2>
      <div style="font-size:13px;color:var(--mm-text-secondary);margin-top:2px;">
        Last ${rows.length} member changes — most recent first.
      </div>
    </div>
    <button class="mm-btn-outline" onclick="history.back()">← Back</button>
  </div>

  ${rows.length === 0
    ? `<div style="text-align:center;padding:60px 20px;color:var(--mm-text-secondary);font-size:13px;">
         No audit entries found. Changes to member records will appear here.
       </div>`
    : `<div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;overflow:hidden;">
         <table class="mm-table">
           <thead>
             <tr>
               <th>Member</th>
               <th>Field</th>
               <th>Old Value</th>
               <th>New Value</th>
               <th>Changed By</th>
               <th>When</th>
             </tr>
           </thead>
           <tbody>
             ${rows.map(r => `
             <tr>
               <td>
                 <button class="mm-btn-link" data-al-member="${r.member_id}"
                   style="background:none;border:none;cursor:pointer;color:var(--mm-blue);font-size:13px;padding:0;text-decoration:underline;">
                   ${r.member_name ?? r.member_id.slice(0, 8) + '…'}
                 </button>
               </td>
               <td style="font-size:12px;font-family:monospace;">${r.field_changed}</td>
               <td style="font-size:12px;color:var(--mm-text-muted);max-width:180px;word-break:break-all;">${r.old_value ?? '—'}</td>
               <td style="font-size:12px;max-width:180px;word-break:break-all;">${r.new_value ?? '—'}</td>
               <td style="font-size:12px;">${r.changed_by_name ?? 'System'}</td>
               <td style="font-size:12px;white-space:nowrap;">${fmtDate(r.changed_at)}</td>
             </tr>`).join('')}
           </tbody>
         </table>
       </div>`}
</div>`

    container.querySelectorAll<HTMLElement>('[data-al-member]').forEach(btn => {
      btn.addEventListener('click', () => navigate(`/members/${btn.dataset['alMember']}`))
    })
  },

  destroy() {},
}

export default AuditLog
