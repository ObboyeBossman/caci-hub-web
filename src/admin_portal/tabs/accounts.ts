import { userProfiles, members, syncAdminData } from '../store';
import { showToast } from '../../core/toast';
import { supabase } from '../../core/supabase';
import { toSupabaseAuthPhone } from '../../core/phone';
import { Tables } from '../../types/database.types';

let selectedMemberIds: string[] = [];
let memberSearchQuery = "";

export function renderAccountsTab(container: HTMLElement, modalsContainer: HTMLElement) {
  container.innerHTML = `
    <div class="space-y-4">
      <div class="bg-white border border-[#e6edf3] p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-3xs">
        <div>
          <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
            <i data-lucide="shield" class="text-caci-blue"></i>
            <span>CACI User Accounts Registry (user_profiles)</span>
          </h2>
          <p class="text-xs text-gray-500 mt-0.5">Manage authentication credentials, activate/suspend accounts, reset passwords, and assign database access profiles.</p>
        </div>
        <button id="btn-add-account" class="bg-caci-blue hover:bg-caci-blueDim text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2">
          <i data-lucide="plus-circle" class="w-4 h-4"></i><span>Provision New Account</span>
        </button>
      </div>

      <div class="bg-white border border-[#e6edf3] rounded-2xl shadow-3xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-gray-50 border-b border-[#e6edf3] text-gray-400 font-extrabold uppercase">
                <th class="py-3 px-4">User Details</th>
                <th class="py-3 px-4">Role</th>
                <th class="py-3 px-4">Linked Member ID</th>
                <th class="py-3 px-4">Status Flags</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${renderAccountsRows()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  renderModals(modalsContainer);
  attachHandlers(container);
  lucide.createIcons({ root: container });
}

function renderAccountsRows() {
  if (userProfiles.length === 0) {
    return `<tr><td colspan="5" class="py-8 text-center text-gray-400">No user accounts found.</td></tr>`;
  }
  return userProfiles.map((u: Tables<'user_profiles'>) => {
    const linkedMember = members.find((m: Tables<'members'>) => m.auth_user_id === u.id);
    const linkedMemberStr = linkedMember ? `${linkedMember.membership_number} — ${linkedMember.full_name}` : 'System Base / Unlinked';

    return `
      <tr class="border-b border-[#e6edf3] hover:bg-gray-50/50">
        <td class="py-3 px-4">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
              <i data-lucide="user" class="w-4 h-4 text-gray-400"></i>
            </div>
            <span class="font-bold text-gray-900">${u.full_name}</span>
          </div>
        </td>
        <td class="py-3 px-4">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
            u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-caci-blue'
          } uppercase tracking-wider">${u.role}</span>
        </td>
        <td class="py-3 px-4 font-mono text-gray-500">${linkedMemberStr}</td>
        <td class="py-3 px-4">
          <div class="flex flex-col gap-1 items-start">
            ${u.is_active 
              ? `<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[9px] font-bold uppercase">Active Session</span>`
              : `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[9px] font-bold uppercase">Suspended</span>`
            }
            ${u.must_change_password ? `<span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-amber-200">Force Password Reset</span>` : ''}
          </div>
        </td>
        <td class="py-3 px-4 text-right space-x-2">
          <button class="btn-toggle-suspend text-xs font-bold text-amber-600 hover:underline" data-id="${u.id}">${u.is_active ? 'Suspend' : 'Activate'}</button>
          <button class="btn-force-reset text-xs font-bold text-caci-blue hover:underline" data-id="${u.id}">Reset Pass</button>
          <button class="btn-delete-acc text-xs font-bold text-caci-red hover:underline" data-id="${u.id}">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderModals(modalsContainer: HTMLElement) {
  let modal = document.getElementById('account-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'account-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modalsContainer.appendChild(modal);
  }

  modal.innerHTML = `
    <div id="account-modal-backdrop" class="fixed inset-0 bg-black/60 transition-opacity cursor-pointer"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform scale-100 transition-all flex flex-col max-h-[90vh]">
      <div class="p-5 border-b border-gray-150 bg-caci-blue text-white flex justify-between items-center shrink-0">
        <div>
          <span class="text-[9px] bg-caci-red px-2.5 py-0.5 rounded text-white uppercase font-black tracking-widest">Provisioning Engine</span>
          <h3 class="font-extrabold text-sm mt-1">Batch Provision User Accounts</h3>
        </div>
        <button id="account-modal-close" class="text-white hover:bg-caci-blueDim p-1 rounded-lg">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <div class="p-6 space-y-6 text-left overflow-y-auto">
        <!-- Step 1: Member Selection -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Step 1: Select Members without accounts</label>
            <span id="selected-count-badge" class="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">0 selected</span>
          </div>
          <div class="relative">
            <i data-lucide="search" class="absolute left-3 top-2.5 w-4 h-4 text-gray-400"></i>
            <input type="text" id="acc-member-search" placeholder="Search by name, ID or phone..." class="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs bg-white focus:outline-none focus:border-caci-blue">
          </div>
          <div id="acc-member-list" class="border border-gray-100 rounded-xl max-h-44 overflow-y-auto p-1 bg-gray-50/50 space-y-1">
            <!-- Members rendered dynamically -->
          </div>
        </div>

        <div class="h-px bg-gray-100"></div>

        <!-- Step 2: Configuration -->
        <div class="space-y-4">
          <label class="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Step 2: Account Configuration</label>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-[10px] text-gray-500 font-bold block">Access Role</label>
              <select id="acc-form-role" class="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs bg-white focus:outline-none focus:border-caci-blue">
                <option value="member">Member Portal</option>
                <option value="admin">Admin Portal</option>
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] text-gray-500 font-bold block">Password Mode</label>
              <select id="acc-password-mode" class="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs bg-white focus:outline-none focus:border-caci-blue">
                <option value="manual">Manual Entry</option>
                <option value="auto">Auto-Generate Secure</option>
              </select>
            </div>
          </div>

          <div id="acc-password-container" class="space-y-1">
            <label class="text-[10px] text-gray-500 font-bold block">Temporary Password *</label>
            <div class="relative">
              <input type="text" id="acc-form-password" value="CACI#Adabraka2026" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white font-mono focus:outline-none focus:border-caci-blue">
              <button id="btn-toggle-pass-visibility" class="absolute right-3 top-2 text-gray-400 hover:text-gray-600">
                <i data-lucide="eye" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <div class="space-y-3 pt-1">
            <label class="flex items-center gap-3 cursor-pointer group">
              <div class="relative flex items-center">
                <input type="checkbox" id="acc-force-reset" checked class="peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 checked:bg-caci-blue checked:border-caci-blue transition-all">
                <i data-lucide="check" class="absolute w-3 h-3 text-white left-0.5 opacity-0 peer-checked:opacity-100 pointer-events-none"></i>
              </div>
              <span class="text-xs text-gray-700 font-medium group-hover:text-gray-900 transition-colors">Force password change on first login</span>
            </label>

            <label class="flex items-center gap-3 cursor-pointer group opacity-60">
              <div class="relative flex items-center">
                <input type="checkbox" id="acc-notify-sms" class="peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 checked:bg-green-600 checked:border-green-600 transition-all" disabled>
                <i data-lucide="check" class="absolute w-3 h-3 text-white left-0.5 opacity-0 peer-checked:opacity-100 pointer-events-none"></i>
              </div>
              <span class="text-xs text-gray-700 font-medium group-hover:text-gray-900 transition-colors">Send SMS credentials notification <span class="text-[9px] font-black uppercase text-amber-600 ml-1">Coming Soon</span></span>
            </label>

            <label class="flex items-center gap-3 cursor-pointer group opacity-60">
              <div class="relative flex items-center">
                <input type="checkbox" id="acc-notify-email" class="peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 checked:bg-green-600 checked:border-green-600 transition-all" disabled>
                <i data-lucide="check" class="absolute w-3 h-3 text-white left-0.5 opacity-0 peer-checked:opacity-100 pointer-events-none"></i>
              </div>
              <span class="text-xs text-gray-700 font-medium group-hover:text-gray-900 transition-colors">Send Email credentials notification <span class="text-[9px] font-black uppercase text-amber-600 ml-1">Coming Soon</span></span>
            </label>
          </div>
        </div>
      </div>

      <div class="p-4 bg-gray-50 border-t border-gray-150 flex items-center justify-end space-x-2.5 shrink-0">
        <button id="account-modal-cancel" class="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors">Cancel</button>
        <button id="btn-save-account" disabled class="px-5 py-2 bg-caci-blue hover:bg-caci-blueDim text-white rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95">
          Provision User Profile
        </button>
      </div>
    </div>
  `;

  document.getElementById('account-modal-close')?.addEventListener('click', closeAccountModal);
  document.getElementById('account-modal-cancel')?.addEventListener('click', closeAccountModal);
  document.getElementById('account-modal-backdrop')?.addEventListener('click', closeAccountModal);

  document.getElementById('acc-member-search')?.addEventListener('input', (e) => {
    memberSearchQuery = (e.target as HTMLInputElement).value;
    renderMemberList();
  });

  document.getElementById('acc-password-mode')?.addEventListener('change', (e) => {
    const mode = (e.target as HTMLSelectElement).value;
    const container = document.getElementById('acc-password-container');
    const input = document.getElementById('acc-form-password') as HTMLInputElement;
    if (mode === 'auto') {
      if (container) container.classList.add('opacity-50', 'pointer-events-none');
      if (input) input.value = "******** (Auto-Generated)";
    } else {
      if (container) container.classList.remove('opacity-50', 'pointer-events-none');
      if (input) input.value = "CACI#Adabraka2026";
    }
  });

  document.getElementById('btn-save-account')?.addEventListener('click', async () => {
    if (selectedMemberIds.length === 0) return;

    const role = (document.getElementById('acc-form-role') as HTMLSelectElement).value;
    const passwordMode = (document.getElementById('acc-password-mode') as HTMLSelectElement).value;
    const manualPassword = (document.getElementById('acc-form-password') as HTMLInputElement).value.trim();
    const forceReset = (document.getElementById('acc-force-reset') as HTMLInputElement).checked;
    
    const saveBtn = document.getElementById('btn-save-account') as HTMLButtonElement;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin mr-2"></i> Processing...`;
    lucide.createIcons({ root: saveBtn });

    let successCount = 0;
    let failCount = 0;

    for (const memberId of selectedMemberIds) {
      const member = members.find(m => m.id === memberId);
      if (!member || !member.phone_number) {
        failCount++;
        continue;
      }

      const password = passwordMode === 'auto' ? generateSecurePassword() : manualPassword;
      const resolvedPhone = toSupabaseAuthPhone(member.phone_number);

      if (!resolvedPhone) {
        failCount++;
        continue;
      }

      try {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          phone: resolvedPhone,
          password: password
        });

        if (signUpErr) throw signUpErr;
        if (!data.user) throw new Error("No user returned");

        const { error: profileErr } = await supabase.from('user_profiles').insert({
          id: data.user.id,
          full_name: member.full_name || 'Unnamed Member',
          role: role as 'admin' | 'member',
          is_active: true,
          must_change_password: forceReset
        });

        if (profileErr) throw profileErr;

        const { error: memberLinkErr } = await supabase
          .from('members')
          .update({ auth_user_id: data.user.id })
          .eq('id', memberId);

        if (memberLinkErr) throw memberLinkErr;

        successCount++;
      } catch (err: any) {
        console.error(`Failed to provision account for member ${memberId}:`, err);
        failCount++;
      }
    }

    if (successCount > 0) {
      showToast("Success", `Provisioned ${successCount} account(s) successfully.`, "success");
    }
    if (failCount > 0) {
      showToast("Error", `Failed to provision ${failCount} account(s).`, "error");
    }

    closeAccountModal();
    await syncAdminData();
  });

  lucide.createIcons({ root: modal });
  renderMemberList();
}

function renderMemberList() {
  const container = document.getElementById('acc-member-list');
  if (!container) return;

  const membersWithoutAccounts = members.filter(m => !m.auth_user_id && m.is_active);
  const filtered = membersWithoutAccounts.filter(m => {
    const q = memberSearchQuery.toLowerCase();
    return (m.full_name?.toLowerCase().includes(q) ||
           m.membership_number?.toLowerCase().includes(q) ||
           m.phone_number?.toLowerCase().includes(q));
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-gray-400 text-[10px] font-medium">No eligible members found.</div>`;
    return;
  }

  container.innerHTML = filtered.map(m => `
    <label class="flex items-center justify-between p-2 hover:bg-white rounded-xl cursor-pointer transition-all border border-transparent hover:border-gray-200 group">
      <div class="flex items-center gap-3 min-w-0">
        <div class="relative flex items-center">
          <input type="checkbox" class="acc-member-checkbox peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 checked:bg-caci-blue checked:border-caci-blue transition-all"
            value="${m.id}" ${selectedMemberIds.includes(m.id) ? 'checked' : ''}>
          <i data-lucide="check" class="absolute w-3 h-3 text-white left-0.5 opacity-0 peer-checked:opacity-100 pointer-events-none"></i>
        </div>
        <div class="min-w-0">
          <p class="text-[11px] font-bold text-gray-900 truncate group-hover:text-caci-blue transition-colors">${m.full_name}</p>
          <p class="text-[9px] text-gray-500 font-mono flex items-center gap-1.5">
            <span class="bg-gray-100 px-1 rounded">${m.membership_number}</span>
            <span>•</span>
            <span>${m.phone_number}</span>
          </p>
        </div>
      </div>
      <i data-lucide="user-plus" class="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 transition-colors"></i>
    </label>
  `).join('');

  lucide.createIcons({ root: container });

  container.querySelectorAll('.acc-member-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const checkbox = e.target as HTMLInputElement;
      if (checkbox.checked) {
        if (!selectedMemberIds.includes(checkbox.value)) {
          selectedMemberIds.push(checkbox.value);
        }
      } else {
        selectedMemberIds = selectedMemberIds.filter(id => id !== checkbox.value);
      }
      updateProvisionButton();
    });
  });
}

function updateProvisionButton() {
  const btn = document.getElementById('btn-save-account') as HTMLButtonElement;
  const badge = document.getElementById('selected-count-badge');
  if (badge) badge.innerText = `${selectedMemberIds.length} selected`;

  if (!btn) return;
  const count = selectedMemberIds.length;
  btn.disabled = count === 0;
  btn.innerText = count > 0 ? `Provision ${count} Account${count > 1 ? 's' : ''}` : 'Provision User Profile';
}

function generateSecurePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let pass = "";
  for (let i = 0; i < 12; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

function attachHandlers(container: HTMLElement) {
  document.getElementById('btn-add-account')?.addEventListener('click', launchNewAccountModal);

  container.querySelectorAll('.btn-toggle-suspend').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      if (!id) return;
      const user = userProfiles.find((u: Tables<'user_profiles'>) => u.id === id);
      if (user) {
        const newActiveState = !user.is_active;
        const { error } = await supabase
          .from('user_profiles')
          .update({ is_active: newActiveState })
          .eq('id', id);

        if (error) {
          showToast("Error", error.message, "error");
        } else {
          showToast("Success", `Account of ${user.full_name} ${newActiveState ? 'Suspension Lifted' : 'Suspended'}`, "success");
          await syncAdminData();
        }
      }
    });
  });

  container.querySelectorAll('.btn-force-reset').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      if (!id) return;
      const user = userProfiles.find((u: Tables<'user_profiles'>) => u.id === id);
      if (user) {
        const { error } = await supabase
          .from('user_profiles')
          .update({ must_change_password: true })
          .eq('id', id);

        if (error) {
          showToast("Error", error.message, "error");
        } else {
          showToast("Notice", `Forced password reset flag active for user: ${user.full_name}`, "info");
          await syncAdminData();
        }
      }
    });
  });

  container.querySelectorAll('.btn-delete-acc').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      if (!id) return;
      const user = userProfiles.find((u: Tables<'user_profiles'>) => u.id === id);
      if (user) {
        const { error } = await supabase
          .from('user_profiles')
          .delete()
          .eq('id', id);

        if (error) {
          showToast("Error", error.message, "error");
        } else {
          showToast("Deleted", `Account Profile credentials for ${user.full_name} removed permanently.`, "success");
          await syncAdminData();
        }
      }
    });
  });
}

export function launchNewAccountModal() {
  selectedMemberIds = [];
  memberSearchQuery = "";
  
  const searchInp = document.getElementById('acc-member-search') as HTMLInputElement;
  if (searchInp) searchInp.value = "";

  const roleInp = document.getElementById('acc-form-role') as HTMLSelectElement;
  if (roleInp) roleInp.value = "member";

  const passMode = document.getElementById('acc-password-mode') as HTMLSelectElement;
  if (passMode) passMode.value = "manual";

  const passInp = document.getElementById('acc-form-password') as HTMLInputElement;
  if (passInp) passInp.value = "CACI#Adabraka2026";

  const forceReset = document.getElementById('acc-force-reset') as HTMLInputElement;
  if (forceReset) forceReset.checked = true;

  renderMemberList();
  updateProvisionButton();

  document.getElementById('account-modal')?.classList.remove('hidden');
}

export function closeAccountModal() {
  document.getElementById('account-modal')?.classList.add('hidden');
}
