import { members, memberPermissions, auditLogs, adminState, notifyAdminStateChange, syncAdminData, getSession } from '../store';
import { showToast } from '../../core/toast';
import { supabase } from '../../core/supabase';
import { formatGhanaPhoneForDisplay, normalizeGhanaPhone, attachPhoneInputFormatter } from '../../core/phone';
import { Tables } from '../../types/database.types';

export function renderMembersTab(container: HTMLElement, modalsContainer: HTMLElement) {
  container.innerHTML = `
    <div class="space-y-4">
      <div class="bg-white border border-[#e6edf3] p-4 rounded-2xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 shadow-3xs">
        <div class="relative flex-1 max-w-md">
          <i data-lucide="search" class="absolute left-3 top-2.5 h-4 w-4 text-gray-400"></i>
          <input 
            type="text" 
            id="members-search-input"
            placeholder="Search by name, code, contact or district..."
            value="${adminState.searchQuery}"
            class="w-full pl-9 pr-4 py-1.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:border-caci-blue focus:ring-1 focus:ring-caci-blue"
          />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <select id="members-filter-status" class="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none">
            <option value="all" ${adminState.memberStatusFilter === 'all' ? 'selected' : ''}>All Membership Status</option>
            <option value="active" ${adminState.memberStatusFilter === 'active' ? 'selected' : ''}>Active Members</option>
            <option value="inactive" ${adminState.memberStatusFilter === 'inactive' ? 'selected' : ''}>Inactive Members</option>
            <option value="visitor" ${adminState.memberStatusFilter === 'visitor' ? 'selected' : ''}>Visitor Registry</option>
          </select>
          <select id="members-filter-gender" class="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none">
            <option value="all" ${adminState.memberGenderFilter === 'all' ? 'selected' : ''}>All Genders</option>
            <option value="male" ${adminState.memberGenderFilter === 'male' ? 'selected' : ''}>Male</option>
            <option value="female" ${adminState.memberGenderFilter === 'female' ? 'selected' : ''}>Female</option>
          </select>
          <button id="btn-add-member" class="bg-caci-blue hover:bg-caci-blueDim text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1">
            <i data-lucide="plus" class="w-4 h-4"></i><span>Add Member</span>
          </button>
        </div>
      </div>

      <div class="bg-white border border-[#e6edf3] rounded-2xl shadow-3xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-gray-50 border-b border-[#e6edf3] text-gray-400 font-extrabold uppercase">
                <th class="py-3 px-4">Registry Number</th>
                <th class="py-3 px-4">Member Name</th>
                <th class="py-3 px-4">Phone / Whatsapp</th>
                <th class="py-3 px-4">District / Location</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${renderMembersRows()}
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

function renderMembersRows() {
  const filtered = members.filter((m: Tables<'members'>) => {
    let matches = true;
    const q = adminState.searchQuery.toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    if (q) {
      matches = (m.full_name?.toLowerCase().includes(q) ?? false) || 
                (m.membership_number?.toLowerCase().includes(q) ?? false) || 
                (m.phone_number?.includes(qDigits) ?? false) ||
                (formatGhanaPhoneForDisplay(m.phone_number)?.replace(/\D/g, '').includes(qDigits) ?? false);
    }
    if (adminState.memberStatusFilter === 'active' && (!m.is_active || m.membership_status !== 'active')) matches = false;
    if (adminState.memberStatusFilter === 'inactive' && m.is_active && m.membership_status === 'active') matches = false;
    if (adminState.memberGenderFilter !== 'all' && m.gender !== adminState.memberGenderFilter) matches = false;
    return matches;
  });

  if (filtered.length === 0) {
    return `<tr><td colspan="6" class="py-12 text-center text-gray-400">No members matching current filters found in schema.</td></tr>`;
  }

  return filtered.map((m: Tables<'members'>) => {
    const avatarUrl = m.profile_photo_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200";
    return `
      <tr class="border-b border-[#e6edf3] hover:bg-gray-50/50">
        <td class="py-3 px-4 font-mono font-semibold text-gray-500">${m.membership_number}</td>
        <td class="py-3 px-4">
          <div class="flex items-center space-x-3">
            <img src="${avatarUrl}" class="w-8 h-8 rounded-full border border-gray-200 object-cover shrink-0">
            <div>
              <p class="font-bold text-gray-900">${m.title || ''} ${m.full_name}</p>
              <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <p class="text-[10px] text-gray-500 capitalize">${m.gender || ''} • ${m.marital_status || ''}</p>
                ${m.assembly_role ? `<span class="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded capitalize">${m.assembly_role}</span>` : ''}
              </div>
            </div>
          </div>
        </td>
        <td class="py-3 px-4">
          <p class="font-semibold text-gray-800">${formatGhanaPhoneForDisplay(m.phone_number) || m.phone_number || ''}</p>
          <p class="text-[10px] text-green-600 font-bold flex items-center gap-1 mt-0.5">
            <i data-lucide="message-circle" class="w-3 h-3"></i> WA: ${formatGhanaPhoneForDisplay(m.whatsapp_number) || m.whatsapp_number || ''}
          </p>
        </td>
        <td class="py-3 px-4 text-gray-600 font-medium">${m.location || ''}</td>
        <td class="py-3 px-4">
          ${m.is_active 
            ? `<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase shadow-sm">Active Member</span>`
            : `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase shadow-sm">Inactive Profile</span>`
          }
        </td>
        <td class="py-3 px-4 text-right">
          <button class="text-caci-blue hover:text-caci-blueDim p-1 rounded transition-colors btn-edit-member" data-id="${m.id}" title="Edit Member Base Data">
            <i data-lucide="edit" class="w-4 h-4"></i>
          </button>
          <button class="text-indigo-600 hover:text-indigo-800 p-1 rounded transition-colors btn-perms-member" data-id="${m.id}" title="View System Permission Grants">
            <i data-lucide="shield" class="w-4 h-4"></i>
          </button>
          <button class="text-caci-red hover:text-caci-redDim p-1 rounded transition-colors btn-delete-member" data-id="${m.id}" title="Soft Delete Member">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderModals(modalsContainer: HTMLElement) {
  let memberModal = document.getElementById('member-modal');
  if (!memberModal) {
    memberModal = document.createElement('div');
    memberModal.id = 'member-modal';
    memberModal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 hidden';
    memberModal.innerHTML = `
      <div id="member-modal-backdrop" class="fixed inset-0 bg-black/60 transition-opacity"></div>
      <div class="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden transform scale-100 transition-all">
        <div class="p-5 border-b border-gray-150 bg-gradient-to-r from-caci-blue to-caci-blueDim text-white flex justify-between items-center">
          <div>
            <span class="text-[9px] bg-caci-red px-2.5 py-0.5 rounded text-white uppercase font-black tracking-widest">PostgreSQL Engine Schema</span>
            <h3 id="member-modal-title" class="font-extrabold text-sm mt-1">Add Member</h3>
          </div>
          <button id="member-modal-close" class="text-white hover:bg-caci-blueDim p-1 rounded-lg">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div class="p-6 max-h-[480px] overflow-y-auto space-y-5 text-left">
          <input type="hidden" id="form-member-id">
          
          <div>
            <h4 class="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider mb-2.5">Primary Member Information</h4>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="space-y-1">
                <label class="text-[10px] text-gray-500 font-bold block">Prefix / Title</label>
                <input type="text" id="form-title" placeholder="e.g. Elder, Mrs, Brother" class="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none">
              </div>
              <div class="space-y-1 sm:col-span-2">
                <label class="text-[10px] text-gray-500 font-bold block">Full Name *</label>
                <input type="text" id="form-full-name" placeholder="First Name & Surname" class="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none">
              </div>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div class="space-y-1">
              <label class="text-[10px] text-gray-500 font-bold block">Date of Birth</label>
              <input type="date" id="form-dob" class="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-xs bg-white focus:outline-none">
            </div>
            <div class="space-y-1">
              <label class="text-[10px] text-gray-500 font-bold block">Gender</label>
              <select id="form-gender" class="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-xs bg-white focus:outline-none">
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] text-gray-500 font-bold block">Marital Status</label>
              <select id="form-marital-status" class="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-xs bg-white focus:outline-none">
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] text-gray-500 font-bold block">Membership Status</label>
              <select id="form-status" class="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-xs bg-white focus:outline-none">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="visitor">Visitor</option>
              </select>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] text-gray-500 font-bold block">Assembly Role / Ministry</label>
            <input type="text" id="form-assembly-role" placeholder="e.g. Usher, Elder, Choir Member, Youth Leader, Pastor" class="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-caci-blue focus:ring-1 focus:ring-caci-blue">
            <p class="text-[9px] text-gray-400 mt-0.5">Free text — type the member's ministry or service role. Leave blank if none.</p>
          </div>
          <hr class="border-gray-150">
          <div>
            <h4 class="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider mb-2.5">Contact & Location</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[10px] text-gray-500 font-bold block">Primary Phone Line *</label>
                <input type="text" id="form-phone" placeholder="e.g. +233 24 000 0000" class="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none">
              </div>
              <div class="space-y-1">
                <label class="text-[10px] text-gray-500 font-bold block">Whatsapp Contact</label>
                <input type="text" id="form-whatsapp" placeholder="e.g. +233 24 000 0000" class="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none">
              </div>
              <div class="space-y-1">
                <label class="text-[10px] text-gray-500 font-bold block">Occupation / Profession</label>
                <input type="text" id="form-occupation" placeholder="e.g. Banker, Student" class="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none">
              </div>
              <div class="space-y-1">
                <label class="text-[10px] text-gray-500 font-bold block">Residential District / Location</label>
                <input type="text" id="form-location" placeholder="e.g. Adabraka, Osu" class="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none">
              </div>
            </div>
          </div>
          <hr class="border-gray-150">
          <div>
            <h4 class="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider mb-2.5">Emergency Contact Details</h4>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="space-y-1">
                <label class="text-[10px] text-gray-500 font-bold block">Contact Name</label>
                <input type="text" id="form-emergency-name" placeholder="Full Name" class="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none">
              </div>
              <div class="space-y-1">
                <label class="text-[10px] text-gray-500 font-bold block">Relationship</label>
                <input type="text" id="form-emergency-relationship" placeholder="e.g. Brother, Spouse" class="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none">
              </div>
              <div class="space-y-1">
                <label class="text-[10px] text-gray-500 font-bold block">Phone Number</label>
                <input type="text" id="form-emergency-phone" placeholder="Emergency Line" class="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none">
              </div>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div class="space-y-1">
              <label class="text-[10px] text-gray-500 font-bold block">Official Join Date</label>
              <input type="date" id="form-join-date" class="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none">
            </div>
            <div class="space-y-1">
              <label class="text-[10px] text-gray-500 font-bold block">Profile Avatar URL</label>
              <input type="text" id="form-avatar" placeholder="https://..." class="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none">
            </div>
          </div>
        </div>
        <div class="p-4 bg-gray-50 border-t border-gray-150 flex items-center justify-end space-x-2.5">
          <button id="member-modal-cancel" class="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-100">Cancel</button>
          <button id="btn-save-member" class="px-5 py-2 bg-caci-blue hover:bg-caci-blueDim text-white rounded-xl text-xs font-bold shadow-xs">Mutate Table Schema</button>
        </div>
      </div>
    `;
    modalsContainer.appendChild(memberModal);
  }

  let permModal = document.getElementById('permissions-modal');
  if (!permModal) {
    permModal = document.createElement('div');
    permModal.id = 'permissions-modal';
    permModal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 hidden';
    permModal.innerHTML = `
      <div id="permissions-modal-backdrop" class="fixed inset-0 bg-black/60 transition-opacity"></div>
      <div class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform scale-100 transition-all">
        <div class="p-5 border-b border-gray-150 bg-gradient-to-r from-caci-blue to-caci-blueDim text-white flex justify-between items-center">
          <div>
            <span class="text-[9px] bg-caci-red px-2.5 py-0.5 rounded text-white uppercase font-black tracking-widest">Table: member_permissions</span>
            <h3 id="permissions-modal-title" class="font-extrabold text-sm mt-1">Inspect Scope Grants</h3>
          </div>
          <button id="permissions-modal-close" class="text-white hover:bg-caci-blueDim p-1 rounded-lg">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div class="p-6 space-y-4 text-left">
          <input type="hidden" id="permissions-member-id">
          <p class="text-xs text-gray-500 leading-normal">Select which specific modules the member can read or modify inside CACI Hub.</p>
          <div class="space-y-3">
            <label class="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-150 cursor-pointer hover:bg-gray-100 transition-colors">
              <input type="checkbox" id="perm-members-read" class="mt-0.5 text-caci-blue focus:ring-caci-blue border-gray-300 rounded">
              <div>
                <strong class="text-xs text-gray-900 block font-bold">members.read</strong>
                <span class="text-[10px] text-gray-500 block">Allows inspection of the local Assembly Members Registry.</span>
              </div>
            </label>
            <label class="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-150 cursor-pointer hover:bg-gray-100 transition-colors">
              <input type="checkbox" id="perm-members-write" class="mt-0.5 text-caci-blue focus:ring-caci-blue border-gray-300 rounded">
              <div>
                <strong class="text-xs text-gray-900 block font-bold">members.write</strong>
                <span class="text-[10px] text-gray-500 block">Allows creation and updating of Registry Records.</span>
              </div>
            </label>
            <label class="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-150 cursor-pointer hover:bg-gray-100 transition-colors">
              <input type="checkbox" id="perm-broadcasts-read" class="mt-0.5 text-caci-blue focus:ring-caci-blue border-gray-300 rounded">
              <div>
                <strong class="text-xs text-gray-900 block font-bold">broadcasts.read</strong>
                <span class="text-[10px] text-gray-500 block">Allows reading targeted announcements inside workspace inbox.</span>
              </div>
            </label>
          </div>
        </div>
        <div class="p-4 bg-gray-50 border-t border-gray-150 flex items-center justify-end space-x-2.5">
          <button id="permissions-modal-cancel" class="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-100">Cancel</button>
          <button id="btn-save-permissions" class="px-5 py-2 bg-caci-blue hover:bg-caci-blueDim text-white rounded-xl text-xs font-bold">Save Grants</button>
        </div>
      </div>
    `;
    modalsContainer.appendChild(permModal);
  }

  // Event bindings
  document.getElementById('member-modal-close')?.addEventListener('click', closeMemberModal);
  document.getElementById('member-modal-cancel')?.addEventListener('click', closeMemberModal);
  document.getElementById('member-modal-backdrop')?.addEventListener('click', closeMemberModal);
  
  attachPhoneInputFormatter(document.getElementById('form-phone') as HTMLInputElement);
  attachPhoneInputFormatter(document.getElementById('form-whatsapp') as HTMLInputElement);
  attachPhoneInputFormatter(document.getElementById('form-emergency-phone') as HTMLInputElement);

  document.getElementById('btn-save-member')?.addEventListener('click', saveMemberFormData);

  document.getElementById('permissions-modal-close')?.addEventListener('click', closePermissionsModal);
  document.getElementById('permissions-modal-cancel')?.addEventListener('click', closePermissionsModal);
  document.getElementById('permissions-modal-backdrop')?.addEventListener('click', closePermissionsModal);

  document.getElementById('btn-save-permissions')?.addEventListener('click', saveMemberPermissions);
}

function attachHandlers(container: HTMLElement) {
  document.getElementById('btn-add-member')?.addEventListener('click', launchNewMemberModal);

  document.getElementById('members-search-input')?.addEventListener('input', (e) => {
    adminState.searchQuery = (e.target as HTMLInputElement).value;
    notifyAdminStateChange();
  });

  document.getElementById('members-filter-status')?.addEventListener('change', (e) => {
    adminState.memberStatusFilter = (e.target as HTMLSelectElement).value;
    notifyAdminStateChange();
  });

  document.getElementById('members-filter-gender')?.addEventListener('change', (e) => {
    adminState.memberGenderFilter = (e.target as HTMLSelectElement).value;
    notifyAdminStateChange();
  });

  container.querySelectorAll('.btn-edit-member').forEach(btn => {
    btn.addEventListener('click', (e) => launchEditMemberModal((e.currentTarget as HTMLElement).dataset.id!));
  });
  
  container.querySelectorAll('.btn-perms-member').forEach(btn => {
    btn.addEventListener('click', (e) => launchPermissionsModal((e.currentTarget as HTMLElement).dataset.id!));
  });

  container.querySelectorAll('.btn-delete-member').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id!;
      const { error } = await supabase
        .from('members')
        .update({
          deleted_at: new Date().toISOString(),
          is_active: false
        })
        .eq('id', id);

      if (error) {
        showToast("Error", error.message, "error");
      } else {
        showToast("Success", "Member Soft Deleted. Flagged database records to inactive state.", "success");
        await syncAdminData();
      }
    });
  });
}
 
export function launchNewMemberModal() {
  document.getElementById("member-modal-title")!.innerText = "Register New Assembly Member";
  (document.getElementById("form-member-id") as HTMLInputElement).value = "";
  (document.getElementById("form-title") as HTMLInputElement).value = "Brother";
  (document.getElementById("form-full-name") as HTMLInputElement).value = "";
  (document.getElementById("form-dob") as HTMLInputElement).value = "";
  (document.getElementById("form-gender") as HTMLSelectElement).value = "male";
  (document.getElementById("form-marital-status") as HTMLSelectElement).value = "single";
  (document.getElementById("form-status") as HTMLSelectElement).value = "active";
  (document.getElementById("form-occupation") as HTMLInputElement).value = "";
  (document.getElementById("form-location") as HTMLInputElement).value = "";
  (document.getElementById("form-phone") as HTMLInputElement).value = "";
  (document.getElementById("form-whatsapp") as HTMLInputElement).value = "";
  (document.getElementById("form-emergency-name") as HTMLInputElement).value = "";
  (document.getElementById("form-emergency-relationship") as HTMLInputElement).value = "";
  (document.getElementById("form-emergency-phone") as HTMLInputElement).value = "";
  (document.getElementById("form-join-date") as HTMLInputElement).value = new Date().toISOString().split('T')[0];
  (document.getElementById("form-avatar") as HTMLInputElement).value = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200";
  (document.getElementById("form-assembly-role") as HTMLInputElement).value = "";

  document.getElementById("member-modal")?.classList.remove("hidden");
}

export function launchEditMemberModal(id: string) {
  const m = members.find((item: Tables<'members'>) => item.id === id);
  if (!m) return;

  document.getElementById("member-modal-title")!.innerText = `Edit: ${m.title || ''} ${m.full_name} Records`;

  (document.getElementById("form-member-id") as HTMLInputElement).value = m.id;
  (document.getElementById("form-title") as HTMLInputElement).value = m.title || '';
  (document.getElementById("form-full-name") as HTMLInputElement).value = m.full_name;
  (document.getElementById("form-dob") as HTMLInputElement).value = m.date_of_birth || '';
  (document.getElementById("form-gender") as HTMLSelectElement).value = m.gender || 'male';
  (document.getElementById("form-marital-status") as HTMLSelectElement).value = m.marital_status || 'single';
  (document.getElementById("form-status") as HTMLSelectElement).value = m.membership_status || 'active';
  (document.getElementById("form-occupation") as HTMLInputElement).value = m.occupation || '';
  (document.getElementById("form-location") as HTMLInputElement).value = m.location || '';
  (document.getElementById("form-phone") as HTMLInputElement).value = formatGhanaPhoneForDisplay(m.phone_number) || m.phone_number || '';
  (document.getElementById("form-whatsapp") as HTMLInputElement).value = formatGhanaPhoneForDisplay(m.whatsapp_number) || m.whatsapp_number || '';
  (document.getElementById("form-emergency-name") as HTMLInputElement).value = m.emergency_contact_name || '';
  (document.getElementById("form-emergency-relationship") as HTMLInputElement).value = m.emergency_contact_relationship || '';
  (document.getElementById("form-emergency-phone") as HTMLInputElement).value = formatGhanaPhoneForDisplay(m.emergency_contact_phone) || m.emergency_contact_phone || '';
  (document.getElementById("form-join-date") as HTMLInputElement).value = m.join_date || '';
  (document.getElementById("form-avatar") as HTMLInputElement).value = m.profile_photo_url || '';
  (document.getElementById("form-assembly-role") as HTMLInputElement).value = m.assembly_role || '';

  document.getElementById("member-modal")?.classList.remove("hidden");
}

export function closeMemberModal() {
  document.getElementById("member-modal")?.classList.add("hidden");
}

async function saveMemberFormData() {
  const id = (document.getElementById("form-member-id") as HTMLInputElement).value;
  const fullName = (document.getElementById("form-full-name") as HTMLInputElement).value.trim();
  const phoneValue = (document.getElementById("form-phone") as HTMLInputElement).value.trim();
  const whatsappValue = (document.getElementById("form-whatsapp") as HTMLInputElement).value.trim();
  const emergencyPhoneValue = (document.getElementById("form-emergency-phone") as HTMLInputElement).value.trim();

  if (!fullName || !phoneValue) {
    showToast("Error", "Full Name and Primary Mobile Line are mandatory database fields.", "error");
    return;
  }

  const normalizedPhone = normalizeGhanaPhone(phoneValue);
  if (!normalizedPhone) {
    showToast("Error", "Primary Mobile Line must be a valid Ghana phone number.", "error");
    return;
  }

  let normalizedWhatsapp: string | null = null;
  if (whatsappValue) {
    normalizedWhatsapp = normalizeGhanaPhone(whatsappValue);
    if (!normalizedWhatsapp) {
      showToast("Error", "WhatsApp number must be a valid Ghana phone number.", "error");
      return;
    }
  }

  let normalizedEmergency: string | null = null;
  if (emergencyPhoneValue) {
    normalizedEmergency = normalizeGhanaPhone(emergencyPhoneValue);
    if (!normalizedEmergency) {
      showToast("Error", "Emergency contact phone must be a valid Ghana phone number.", "error");
      return;
    }
  }

  const formPayload = {
    title: (document.getElementById("form-title") as HTMLInputElement).value.trim() || null,
    full_name: fullName,
    date_of_birth: (document.getElementById("form-dob") as HTMLInputElement).value || null,
    gender: (document.getElementById("form-gender") as HTMLSelectElement).value as any,
    marital_status: (document.getElementById("form-marital-status") as HTMLSelectElement).value as any,
    membership_status: (document.getElementById("form-status") as HTMLSelectElement).value as any,
    occupation: (document.getElementById("form-occupation") as HTMLInputElement).value.trim() || null,
    location: (document.getElementById("form-location") as HTMLInputElement).value.trim() || null,
    phone_number: normalizedPhone,
    whatsapp_number: normalizedWhatsapp,
    emergency_contact_name: (document.getElementById("form-emergency-name") as HTMLInputElement).value.trim() || null,
    emergency_contact_relationship: (document.getElementById("form-emergency-relationship") as HTMLInputElement).value.trim() || null,
    emergency_contact_phone: normalizedEmergency,
    join_date: (document.getElementById("form-join-date") as HTMLInputElement).value || null,
    profile_photo_url: (document.getElementById("form-avatar") as HTMLInputElement).value.trim() || null,
    assembly_role: (document.getElementById("form-assembly-role") as HTMLInputElement).value.trim() || null,
    is_active: true
  };

  if (!id) {
    const { error } = await supabase.from('members').insert(formPayload);
    if (error) {
      showToast("Error", error.message, "error");
      return;
    }
    showToast("Success", "Registered successfully.", "success");
  } else {
    const { error } = await supabase.from('members').update(formPayload).eq('id', id);
    if (error) {
      showToast("Error", error.message, "error");
      return;
    }
    showToast("Success", "Member Registry schema modified and audited successfully.", "success");
  }

  closeMemberModal();
  await syncAdminData();
}

function launchPermissionsModal(memberId: string) {
  const m = members.find((item: Tables<'members'>) => item.id === memberId);
  if (!m) return;

  (document.getElementById("permissions-member-id") as HTMLInputElement).value = memberId;
  document.getElementById("permissions-modal-title")!.innerText = `Manage Scope: ${m.full_name}`;

  (document.getElementById("perm-members-read") as HTMLInputElement).checked = memberPermissions.some((mp: Tables<'member_permissions'>) => mp.member_id === memberId && mp.permission === "members.read");
  (document.getElementById("perm-members-write") as HTMLInputElement).checked = memberPermissions.some((mp: Tables<'member_permissions'>) => mp.member_id === memberId && mp.permission === "members.write");
  (document.getElementById("perm-broadcasts-read") as HTMLInputElement).checked = memberPermissions.some((mp: Tables<'member_permissions'>) => mp.member_id === memberId && mp.permission === "broadcasts.read");

  document.getElementById("permissions-modal")?.classList.remove("hidden");
}

function closePermissionsModal() {
  document.getElementById("permissions-modal")?.classList.add("hidden");
}

async function saveMemberPermissions() {
  const memberId = (document.getElementById("permissions-member-id") as HTMLInputElement).value;
  
  // Remove existing permissions from database
  const { error: deleteError } = await supabase
    .from('member_permissions')
    .delete()
    .eq('member_id', memberId);

  if (deleteError) {
    showToast("Error", deleteError.message, "error");
    return;
  }

  const session = getSession();
  if (!session || !session.user) {
    showToast("Error", "Authentication session not found.", "error");
    return;
  }

  const possiblePermissions = ["members.read", "members.write", "broadcasts.read"];
  const inserts: any[] = [];
  possiblePermissions.forEach(perm => {
    const checkbox = document.getElementById(`perm-${perm.replace('.', '-')}`) as HTMLInputElement;
    if (checkbox && checkbox.checked) {
      inserts.push({
        member_id: memberId,
        permission: perm,
        granted_by: session.user.id
      });
    }
  });

  if (inserts.length > 0) {
    const { error: insertError } = await supabase
      .from('member_permissions')
      .insert(inserts);

    if (insertError) {
      showToast("Error", insertError.message, "error");
      return;
    }
  }

  showToast("Success", "Permissions updated for user profile.", "success");
  closePermissionsModal();
  await syncAdminData();
}
