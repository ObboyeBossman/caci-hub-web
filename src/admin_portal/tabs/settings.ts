import { showToast } from '../../core/toast';
import { syncAdminData } from '../store';

export function renderSettingsTab(container: HTMLElement) {
  // Load settings from localStorage for now
  const defaultPassword = localStorage.getItem('caci_default_password') || 'CACI#Adabraka2026';
  const assemblyName = localStorage.getItem('caci_assembly_name') || 'Adabraka Central Assembly';

  container.innerHTML = `
    <div class="space-y-6">
      <div class="bg-white border border-[#e6edf3] p-6 rounded-2xl shadow-3xs">
        <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
          <i data-lucide="settings" class="text-caci-blue"></i>
          <span>Global Assembly Settings</span>
        </h2>
        <p class="text-xs text-gray-500 mt-1">Configure system-wide defaults, assembly branding, and staff access policies.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white border border-[#e6edf3] rounded-2xl shadow-3xs overflow-hidden">
          <div class="p-4 border-b border-[#e6edf3] bg-gray-50/50">
            <h3 class="text-xs font-extrabold uppercase text-gray-400 tracking-wider">Authentication Defaults</h3>
          </div>
          <div class="p-6 space-y-4">
            <div class="space-y-1.5">
              <label class="text-[11px] font-bold text-gray-700">Provisioning Default Password</label>
              <div class="relative">
                <input type="text" id="set-default-password" value="${defaultPassword}" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white font-mono focus:outline-none focus:border-caci-blue">
                <p class="text-[9px] text-gray-400 mt-1">This password will be pre-filled when provisioning new member accounts.</p>
              </div>
            </div>

            <div class="pt-2">
              <label class="flex items-center gap-3 cursor-pointer group">
                <div class="relative flex items-center">
                  <input type="checkbox" id="set-force-reset" checked class="peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 checked:bg-caci-blue checked:border-caci-blue transition-all">
                  <i data-lucide="check" class="absolute w-3 h-3 text-white left-0.5 opacity-0 peer-checked:opacity-100 pointer-events-none"></i>
                </div>
                <span class="text-xs text-gray-700 font-medium">Always force password change on first login</span>
              </label>
            </div>
          </div>
        </div>

        <div class="bg-white border border-[#e6edf3] rounded-2xl shadow-3xs overflow-hidden">
          <div class="p-4 border-b border-[#e6edf3] bg-gray-50/50">
            <h3 class="text-xs font-extrabold uppercase text-gray-400 tracking-wider">Assembly Branding</h3>
          </div>
          <div class="p-6 space-y-4">
            <div class="space-y-1.5">
              <label class="text-[11px] font-bold text-gray-700">Display Assembly Name</label>
              <input type="text" id="set-assembly-name" value="${assemblyName}" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-caci-blue">
            </div>

            <div class="space-y-1.5">
              <label class="text-[11px] font-bold text-gray-700">Assembly Location / District</label>
              <input type="text" value="Adabraka District" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-caci-blue">
            </div>
          </div>
        </div>

        <div class="bg-white border border-[#e6edf3] rounded-2xl shadow-3xs overflow-hidden md:col-span-2">
          <div class="p-4 border-b border-[#e6edf3] bg-gray-50/50 flex justify-between items-center">
            <h3 class="text-xs font-extrabold uppercase text-gray-400 tracking-wider">Staff Management & Permissions</h3>
            <button class="text-[10px] bg-caci-blue text-white px-3 py-1 rounded-lg font-bold hover:bg-caci-blueDim transition-colors">Add Staff Member</button>
          </div>
          <div class="p-6">
            <p class="text-xs text-gray-500 mb-4">The following members have elevated staff/leader roles within the assembly registry.</p>
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="text-gray-400 font-extrabold uppercase border-b border-[#e6edf3]">
                    <th class="py-3 px-2">Staff Member</th>
                    <th class="py-3 px-2">System Role</th>
                    <th class="py-3 px-2">Registry ID</th>
                    <th class="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-b border-gray-50">
                    <td class="py-3 px-2">
                      <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[10px]">JO</div>
                        <span class="font-bold">Elder James Owusu</span>
                      </div>
                    </td>
                    <td class="py-3 px-2"><span class="bg-blue-50 text-caci-blue px-2 py-0.5 rounded font-bold uppercase text-[9px]">Assembly Secretary</span></td>
                    <td class="py-3 px-2 font-mono text-gray-400">CACI-00045</td>
                    <td class="py-3 px-2 text-right"><button class="text-caci-red font-bold hover:underline">Remove</button></td>
                  </tr>
                  <tr class="border-b border-gray-50">
                    <td class="py-3 px-2">
                      <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-[10px]">GA</div>
                        <span class="font-bold">Deaconess Grace Appiah</span>
                      </div>
                    </td>
                    <td class="py-3 px-2"><span class="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold uppercase text-[9px]">Choir Director</span></td>
                    <td class="py-3 px-2 font-mono text-gray-400">CACI-00082</td>
                    <td class="py-3 px-2 text-right"><button class="text-caci-red font-bold hover:underline">Remove</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end pt-4">
        <button id="btn-save-settings" class="bg-caci-blue hover:bg-caci-blueDim text-white text-xs font-bold px-8 py-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2">
          <i data-lucide="save" class="w-4 h-4"></i>
          <span>Save Assembly Configuration</span>
        </button>
      </div>
    </div>
  `;

  lucide.createIcons({ root: container });

  document.getElementById('btn-save-settings')?.addEventListener('click', () => {
    const newPass = (document.getElementById('set-default-password') as HTMLInputElement).value;
    const newName = (document.getElementById('set-assembly-name') as HTMLInputElement).value;

    localStorage.setItem('caci_default_password', newPass);
    localStorage.setItem('caci_assembly_name', newName);

    showToast("Settings Saved", "Global assembly configuration updated successfully.", "success");
  });
}
