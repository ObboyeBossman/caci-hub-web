// src/admin_portal/tabs/dashboard.ts
import { MEMBERS, GROUPS, BROADCASTS, AUDIT_LOGS } from '../store';
import { AdminEventBus } from '../home';
import { formatGhanaPhoneForDisplay } from '../../core/phone';

export function renderDashboardTab(container: HTMLElement) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="bg-white border border-[#e6edf3] rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-3xs">
        <div>
          <p class="text-xs font-bold text-caci-red uppercase tracking-widest flex items-center space-x-1">
            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
            <span class="ml-1">Adabraka Central Administration Control panel</span>
          </p>
          <h1 class="text-2xl font-black text-gray-900 tracking-tight mt-1">Registry Operational Control Center</h1>
          <p class="text-xs text-gray-500 mt-0.5">Manage members, enforce system compliance, broadcast messages, and view audit trail logs.</p>
        </div>
        <div class="flex items-center space-x-2 shrink-0">
          <button id="dash-add-member" class="bg-caci-blue hover:bg-caci-blueDim text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2">
            <i data-lucide="user-plus" class="w-4 h-4"></i><span>Add New Assembly Member</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white border border-[#e6edf3] p-5 rounded-2xl shadow-3xs flex items-center justify-between">
          <div>
            <span class="text-xs text-gray-400 uppercase font-extrabold tracking-wider block">Total Members</span>
            <span class="text-3xl font-black text-gray-900 block mt-1">${MEMBERS.length}</span>
          </div>
          <div class="w-12 h-12 bg-blue-50 text-caci-blue rounded-full flex items-center justify-center">
            <i data-lucide="users" class="w-6 h-6"></i>
          </div>
        </div>

        <div class="bg-white border border-[#e6edf3] p-5 rounded-2xl shadow-3xs flex items-center justify-between">
          <div>
            <span class="text-xs text-gray-400 uppercase font-extrabold tracking-wider block">Active Departments</span>
            <span class="text-3xl font-black text-gray-900 block mt-1">${GROUPS.length}</span>
          </div>
          <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
            <i data-lucide="layers" class="w-6 h-6"></i>
          </div>
        </div>

        <div class="bg-white border border-[#e6edf3] p-5 rounded-2xl shadow-3xs flex items-center justify-between">
          <div>
            <span class="text-xs text-gray-400 uppercase font-extrabold tracking-wider block">Broadcasts Dispatched</span>
            <span class="text-3xl font-black text-gray-900 block mt-1">${BROADCASTS.length}</span>
          </div>
          <div class="w-12 h-12 bg-red-50 text-caci-red rounded-full flex items-center justify-center">
            <i data-lucide="megaphone" class="w-6 h-6"></i>
          </div>
        </div>

        <div class="bg-white border border-[#e6edf3] p-5 rounded-2xl shadow-3xs flex items-center justify-between">
          <div>
            <span class="text-xs text-gray-400 uppercase font-extrabold tracking-wider block">System Security Alerts</span>
            <span class="text-3xl font-black text-amber-600 block mt-1">${AUDIT_LOGS.length}</span>
          </div>
          <div class="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
            <i data-lucide="shield-alert" class="w-6 h-6"></i>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div class="xl:col-span-8 bg-white border border-[#e6edf3] rounded-2xl p-5 shadow-3xs space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black uppercase text-gray-500 tracking-wider">Recent Registered Members</h3>
            <button id="dash-view-all-members" class="text-xs text-caci-blue hover:underline font-bold">View all directory &rarr;</button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-[#e6edf3] text-gray-400 font-bold uppercase">
                  <th class="py-3 px-2">Member</th>
                  <th class="py-3 px-2">Membership ID</th>
                  <th class="py-3 px-2">Phone</th>
                  <th class="py-3 px-2">Status</th>
                </tr>
              </thead>
              <tbody id="dash-recent-members">
                ${renderRecentMembers()}
              </tbody>
            </table>
          </div>
        </div>

        <div class="xl:col-span-4 bg-white border border-[#e6edf3] rounded-2xl p-5 shadow-3xs space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black uppercase text-gray-500 tracking-wider">Latest Audit Logs</h3>
            <button id="dash-view-audit" class="text-xs text-caci-blue hover:underline font-bold">Inspect ledger &rarr;</button>
          </div>
          <div class="space-y-3 max-h-64 overflow-y-auto pr-1">
            ${renderRecentLogs()}
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('dash-add-member')?.addEventListener('click', () => {
    AdminEventBus.dispatchEvent(new CustomEvent('switchTab', { detail: 'members' }));
    setTimeout(() => {
      // Small hack to ensure it triggers the member tab's modal open
      const btn = document.getElementById('btn-add-member');
      if (btn) btn.click();
    }, 50);
  });

  document.getElementById('dash-view-all-members')?.addEventListener('click', () => {
    AdminEventBus.dispatchEvent(new CustomEvent('switchTab', { detail: 'members' }));
  });
  
  document.getElementById('dash-view-audit')?.addEventListener('click', () => {
    AdminEventBus.dispatchEvent(new CustomEvent('switchTab', { detail: 'audit' }));
  });

  lucide.createIcons({ root: container });
}

function renderRecentMembers() {
  const reversed = [...MEMBERS].reverse().slice(0, 5);
  return reversed.map(m => `
    <tr class="border-b border-gray-50 hover:bg-gray-50/50">
      <td class="py-3 px-2">
        <div class="flex items-center space-x-3">
          <img src="${m.profile_photo_url}" class="w-8 h-8 rounded-full border border-gray-200 object-cover shrink-0">
          <div>
            <p class="font-bold text-gray-900">${m.title} ${m.full_name}</p>
            <p class="text-[10px] text-gray-500">${m.location}</p>
          </div>
        </div>
      </td>
      <td class="py-3 px-2 font-mono text-gray-500">${m.membership_number}</td>
      <td class="py-3 px-2 font-semibold text-gray-600">${formatGhanaPhoneForDisplay(m.phone_number) || m.phone_number || ''}</td>
      <td class="py-3 px-2">
        ${m.is_active 
          ? `<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">Active</span>`
          : `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">Inactive</span>`
        }
      </td>
    </tr>
  `).join('');
}

function renderRecentLogs() {
  const reversed = [...AUDIT_LOGS].reverse().slice(0, 5);
  if (reversed.length === 0) {
    return `<p class="text-xs text-gray-400 py-4 text-center">No recent ledger entries.</p>`;
  }
  return reversed.map(log => `
    <div class="p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
      <div class="flex justify-between items-start">
        <span class="text-[10px] font-bold text-amber-700 uppercase bg-amber-100 px-1.5 rounded">${log.field_changed}</span>
        <span class="text-[9px] text-gray-400 font-mono">${new Date(log.changed_at).toLocaleTimeString()}</span>
      </div>
      <p class="text-xs text-gray-800 mt-1.5 font-medium leading-relaxed">
        <span class="font-bold">${log.changed_by}</span> updated <span class="font-mono text-caci-blue">${log.member_id}</span>
      </p>
    </div>
  `).join('');
}
