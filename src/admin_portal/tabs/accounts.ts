import { MOCK_USER_PROFILES, MOCK_MEMBERS, notifyAdminStateChange, syncAdminData, getSession } from '../store';
import { showToast } from '../../core/toast';
import { supabase } from '../../core/supabase';
import { Tables } from '../../types/database.types';

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
  if (MOCK_USER_PROFILES.length === 0) {
    return `<tr><td colspan="5" class="py-8 text-center text-gray-400">No user accounts found.</td></tr>`;
  }
  return MOCK_USER_PROFILES.map((u: Tables<'user_profiles'>) => {
    const linkedMember = MOCK_MEMBERS.find((m: Tables<'members'>) => m.auth_user_id === u.id);
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

  const memberOptions = MOCK_MEMBERS.map((m: Tables<'members'>) => `<option value="${m.id}">${m.membership_number} — ${m.full_name}</option>`).join('');

  modal.innerHTML = `
    <div id="account-modal-backdrop" class="fixed inset-0 bg-black/60 transition-opacity cursor-pointer"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform scale-100 transition-all">
      <div class="p-5 border-b border-gray-150 bg-caci-blue text-white flex justify-between items-center">
        <div>
          <span class="text-[9px] bg-caci-red px-2.5 py-0.5 rounded text-white uppercase font-black tracking-widest">Table: user_profiles</span>
          <h3 class="font-extrabold text-sm mt-1">Provision New Credentials</h3>
        </div>
        <button id="account-modal-close" class="text-white hover:bg-caci-blueDim p-1 rounded-lg">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="p-6 space-y-4 text-left">
        <div class="space-y-1">
          <label class="text-[10px] text-gray-500 font-bold block">User Profile Full Name *</label>
          <input type="text" id="acc-form-name" placeholder="First Name & Last Name" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-caci-blue">
        </div>
        <div class="space-y-1">
          <label class="text-[10px] text-gray-500 font-bold block">Phone Number *</label>
          <input type="tel" id="acc-form-phone" placeholder="e.g. 024 412 3456" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-caci-blue">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-[10px] text-gray-500 font-bold block">System Access Role *</label>
            <select id="acc-form-role" class="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs bg-white focus:outline-none focus:border-caci-blue">
              <option value="member">Member Scope</option>
              <option value="admin">Admin Portal Scope</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] text-gray-500 font-bold block">Link to Member Profile</label>
            <select id="acc-form-member-id" class="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs bg-white focus:outline-none focus:border-caci-blue">
              <option value="">None (System Base)</option>
              ${memberOptions}
            </select>
          </div>
        </div>
        <div class="space-y-1">
          <label class="text-[10px] text-gray-500 font-bold block">Temporary Password (Stored Encrypted) *</label>
          <input type="text" id="acc-form-password" value="CACI#Adabraka2026" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50 font-mono focus:outline-none">
        </div>
      </div>
      <div class="p-4 bg-gray-50 border-t border-gray-150 flex items-center justify-end space-x-2.5">
        <button id="account-modal-cancel" class="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-100">Cancel</button>
        <button id="btn-save-account" class="px-5 py-2 bg-caci-blue hover:bg-caci-blueDim text-white rounded-xl text-xs font-bold">Provision User Profile</button>
      </div>
    </div>
  `;

  document.getElementById('account-modal-close')?.addEventListener('click', closeAccountModal);
  document.getElementById('account-modal-cancel')?.addEventListener('click', closeAccountModal);
  document.getElementById('account-modal-backdrop')?.addEventListener('click', closeAccountModal);

  document.getElementById('btn-save-account')?.addEventListener('click', async () => {
    const name = (document.getElementById('acc-form-name') as HTMLInputElement).value.trim();
    const phoneInput = (document.getElementById('acc-form-phone') as HTMLInputElement).value.trim();
    const role = (document.getElementById('acc-form-role') as HTMLSelectElement).value;
    const memberId = (document.getElementById('acc-form-member-id') as HTMLSelectElement).value;
    const password = (document.getElementById('acc-form-password') as HTMLInputElement).value.trim();
    
    if (!name || !phoneInput || !password) {
      showToast("Error", "Name, Phone Number, and Temporary Password are required.", "error");
      return;
    }

    // Format phone: 0244123456 -> +233244123456
    let digits = phoneInput.replace(/\D/g, '');
    let resolvedPhone = digits;
    if (digits.startsWith('0')) {
      resolvedPhone = '+233' + digits.slice(1);
    } else if (!digits.startsWith('+')) {
      resolvedPhone = '+' + digits;
    }

    showToast("Info", "Signing up credentials in GoTrue Auth...", "info");

    const { data, error: signUpErr } = await supabase.auth.signUp({
      phone: resolvedPhone,
      password: password
    });

    if (signUpErr) {
      showToast("Error", signUpErr.message, "error");
      return;
    }

    if (!data.user) {
      showToast("Error", "Auth user provision succeeded but no UUID returned.", "error");
      return;
    }

    const { error: profileErr } = await supabase.from('user_profiles').insert({
      id: data.user.id,
      full_name: name,
      role: role as 'admin' | 'member',
      is_active: true,
      must_change_password: true
    });

    if (profileErr) {
      showToast("Error", `Auth created, but profile insertion failed: ${profileErr.message}`, "error");
      return;
    }

    if (memberId) {
      const { error: memberLinkErr } = await supabase
        .from('members')
        .update({ auth_user_id: data.user.id })
        .eq('id', memberId);

      if (memberLinkErr) {
        showToast("Warning", `User provisioned, but linking to member failed: ${memberLinkErr.message}`, "warning");
      }
    }

    showToast("Success", `Account provisioned successfully for ${resolvedPhone}`, "success");
    closeAccountModal();
    await syncAdminData();
  });
}

function attachHandlers(container: HTMLElement) {
  document.getElementById('btn-add-account')?.addEventListener('click', launchNewAccountModal);

  container.querySelectorAll('.btn-toggle-suspend').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      if (!id) return;
      const user = MOCK_USER_PROFILES.find((u: Tables<'user_profiles'>) => u.id === id);
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
      const user = MOCK_USER_PROFILES.find((u: Tables<'user_profiles'>) => u.id === id);
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
      const user = MOCK_USER_PROFILES.find((u: Tables<'user_profiles'>) => u.id === id);
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
  const nameInp = document.getElementById('acc-form-name') as HTMLInputElement;
  const phoneInp = document.getElementById('acc-form-phone') as HTMLInputElement;
  const roleInp = document.getElementById('acc-form-role') as HTMLSelectElement;
  const memInp = document.getElementById('acc-form-member-id') as HTMLSelectElement;
  
  if (nameInp) nameInp.value = "";
  if (phoneInp) phoneInp.value = "";
  if (roleInp) roleInp.value = "member";
  if (memInp) memInp.value = "";

  document.getElementById('account-modal')?.classList.remove('hidden');
}

export function closeAccountModal() {
  document.getElementById('account-modal')?.classList.add('hidden');
}
