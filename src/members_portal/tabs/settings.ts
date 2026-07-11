import { MOCK_MEMBER, MOCK_MEMBER_PERMISSIONS } from '../store';

export function renderSettingsTab(container: HTMLElement) {
  container.innerHTML = `
    <div class="bg-white border border-[#e6edf3] rounded-2xl p-6 shadow-xs space-y-6">
      <div>
        <h2 class="text-lg font-bold text-gray-900 flex items-center space-x-2">
          <i data-lucide="settings" class="w-5 h-5 text-caci-blue"></i>
          <span class="ml-1">System Settings & Policies</span>
        </h2>
        <p class="text-xs text-gray-500 mt-1">Configure your workspace preference logs and review security permissions.</p>
      </div>

      <div class="space-y-4">
        <div class="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start space-x-3.5">
          <i data-lucide="shield-alert" class="w-5 h-5 text-caci-red shrink-0 mt-0.5"></i>
          <div>
            <h4 class="text-xs font-bold text-gray-800">Database & RLS Compliance</h4>
            <p class="text-[11px] text-gray-500 mt-1 leading-relaxed">
              All communications are bound to your unique account code <span class="font-mono text-gray-700 font-bold bg-gray-200 px-1 py-0.2 rounded">${MOCK_MEMBER.membership_number}</span>. Profile photo modifications undergo automated logging in compliance with data tracking guidelines.
            </p>
          </div>
        </div>

        <div class="space-y-3.5">
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">User Permissions Scope</h3>
          <div id="permissions-badges-grid" class="flex flex-wrap gap-2"></div>
        </div>
      </div>
    </div>
  `;

  const badgesGrid = container.querySelector('#permissions-badges-grid')!;
  MOCK_MEMBER_PERMISSIONS.forEach(perm => {
    const span = document.createElement("span");
    span.className = "text-[11px] font-bold px-2.5 py-1 bg-blue-50 text-caci-blue border border-blue-200 rounded-lg flex items-center space-x-1";
    span.innerHTML = `<i data-lucide="shield" class="w-3 h-3 text-caci-blue"></i> <span class="capitalize">${perm.permission.replace('.', ' ')}</span>`;
    badgesGrid.appendChild(span);
  });

  lucide.createIcons({ root: container });
}
