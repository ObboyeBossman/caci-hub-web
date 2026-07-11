// src/admin_portal/tabs/audit.ts
import { MOCK_AUDIT_LOGS, MOCK_MEMBERS } from '../store';

export function renderAuditTab(container: HTMLElement) {
  container.innerHTML = `
    <div class="space-y-4">
      <div class="bg-white border border-[#e6edf3] p-5 rounded-2xl shadow-3xs space-y-2">
        <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
          <i data-lucide="shield-alert" class="text-amber-600"></i>
          <span>Supabase Field Audit Trail Ledger</span>
        </h2>
        <p class="text-xs text-gray-500">Immutable registry entries recording mutations and creations on key database tables.</p>
      </div>

      <div class="bg-white border border-[#e6edf3] rounded-2xl shadow-3xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-gray-50 border-b border-[#e6edf3] text-gray-400 font-extrabold uppercase">
                <th class="py-3 px-4">Event Code</th>
                <th class="py-3 px-4">Author</th>
                <th class="py-3 px-4">Target Member</th>
                <th class="py-3 px-4">Field Changed</th>
                <th class="py-3 px-4">Old Value</th>
                <th class="py-3 px-4">New Value</th>
                <th class="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${renderAuditRows()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  lucide.createIcons({ root: container });
}

function renderAuditRows() {
  const reversedLogs = [...MOCK_AUDIT_LOGS].reverse();

  if (reversedLogs.length === 0) {
    return `
      <tr>
        <td colspan="7" class="py-12 text-center text-gray-400">No logs on local member_audit_log schema.</td>
      </tr>
    `;
  }

  return reversedLogs.map(log => {
    const targetMember = MOCK_MEMBERS.find(m => m.id === log.member_id);
    return `
      <tr class="border-b border-[#e6edf3] hover:bg-gray-50/50">
        <td class="py-3 px-4 font-mono font-semibold text-gray-400">${log.id}</td>
        <td class="py-3 px-4 font-bold text-gray-800">${log.changed_by}</td>
        <td class="py-3 px-4 text-gray-900 font-medium">${targetMember ? targetMember.full_name : 'System Profile'}</td>
        <td class="py-3 px-4 font-mono text-red-700 font-bold bg-red-50/50 rounded inline-block mt-2">${log.field_changed}</td>
        <td class="py-3 px-4 text-gray-500 italic">"${log.old_value || 'none'}"</td>
        <td class="py-3 px-4 text-green-700 font-bold">"${log.new_value || 'none'}"</td>
        <td class="py-3 px-4 text-gray-400 font-semibold">${new Date(log.changed_at).toLocaleString()}</td>
      </tr>
    `;
  }).join('');
}
