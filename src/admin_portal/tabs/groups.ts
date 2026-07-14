import { MOCK_GROUPS, MOCK_GROUP_MEMBERS, MOCK_MEMBERS, adminState, notifyAdminStateChange, syncAdminData } from '../store';
import { showToast } from '../../core/toast';
import { supabase } from '../../core/supabase';
import { Tables } from '../../types/database.types';

export function renderGroupsTab(container: HTMLElement, modalsContainer: HTMLElement) {
  container.innerHTML = `
    <div class="space-y-4">
      <div class="bg-white border border-[#e6edf3] p-4 rounded-2xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 shadow-3xs">
        <div class="relative flex-1 max-w-md">
          <i data-lucide="search" class="absolute left-3 top-2.5 h-4 w-4 text-gray-400"></i>
          <input
            type="text"
            id="groups-search-input"
            placeholder="Search departments by name or description..."
            value="${adminState.groupSearchQuery}"
            class="w-full pl-9 pr-4 py-1.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <select id="groups-filter-status" class="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none">
            <option value="all" ${adminState.groupStatusFilter === 'all' ? 'selected' : ''}>All Departments</option>
            <option value="active" ${adminState.groupStatusFilter === 'active' ? 'selected' : ''}>Active Only</option>
            <option value="archived" ${adminState.groupStatusFilter === 'archived' ? 'selected' : ''}>Archived Only</option>
          </select>
          <button id="btn-create-group" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
            <i data-lucide="plus" class="w-4 h-4"></i><span>Create Department Group</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="groups-grid-container">
        ${renderGroupsGrid()}
      </div>
    </div>
  `;

  renderModals(modalsContainer);
  attachHandlers(container);
  lucide.createIcons({ root: container });
}

function renderGroupsGrid() {
  const filtered = MOCK_GROUPS.filter((g: Tables<'groups'>) => {
    let matches = true;
    const q = adminState.groupSearchQuery.toLowerCase();
    if (q) {
      matches = (g.name?.toLowerCase().includes(q) ?? false) || (g.description?.toLowerCase().includes(q) ?? false);
    }
    if (adminState.groupStatusFilter === 'active' && !g.is_active) matches = false;
    if (adminState.groupStatusFilter === 'archived' && g.is_active) matches = false;
    return matches;
  });

  if (filtered.length === 0) {
    return `<div class="col-span-full py-12 text-center text-gray-400">No departments matching current filters.</div>`;
  }
  return filtered.map((g: Tables<'groups'>) => {
    const leader = MOCK_MEMBERS.find((m: Tables<'members'>) => m.id === g.leader_id);
    const count = MOCK_GROUP_MEMBERS.filter((gm: Tables<'group_members'>) => gm.group_id === g.id).length;
    return `
      <div class="group-card bg-white border border-[#e6edf3] rounded-2xl p-5 shadow-3xs flex flex-col justify-between hover:shadow-md transition-all cursor-pointer hover:border-indigo-200 active:scale-[0.98]" data-id="${g.id}">
        <div>
          <div class="flex items-center justify-between mb-3">
            <div class="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <i data-lucide="layers" class="w-5 h-5"></i>
            </div>
            <span class="${g.messaging_mode === 'open' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-[9px] font-black uppercase px-2 py-1 rounded">
              ${g.messaging_mode} Comms
            </span>
          </div>
          <h3 class="font-bold text-gray-900 text-base group-hover:text-indigo-600 transition-colors">${g.name}</h3>
          <p class="text-xs text-gray-500 mt-1 line-clamp-2">${g.description || 'No description provided.'}</p>
          <div class="mt-4 bg-gray-50 rounded-xl p-3 border border-gray-100">
            <span class="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block mb-1">Department Head</span>
            <div class="flex items-center space-x-2">
              <div class="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                ${leader?.profile_photo_url ? `<img src="${leader.profile_photo_url}" class="w-full h-full object-cover">` : `<i data-lucide="user" class="w-3.5 h-3.5 text-gray-500"></i>`}
              </div>
              <span class="text-xs font-bold text-gray-800 truncate">${leader ? leader.full_name : 'No Leader Assigned'}</span>
            </div>
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <div class="flex items-center space-x-1.5 text-gray-500">
            <i data-lucide="users" class="w-4 h-4"></i>
            <span class="text-xs font-bold">${count} Enrolled</span>
          </div>
          <button class="btn-manage-roster-link text-xs font-bold text-indigo-600 hover:underline flex items-center" data-id="${g.id}">
            Manage Roster <i data-lucide="chevron-right" class="w-3.5 h-3.5 ml-0.5"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderModals(modalsContainer: HTMLElement) {
  let modalGroup = document.getElementById('group-modal');
  if (!modalGroup) {
    modalGroup = document.createElement('div');
    modalGroup.id = 'group-modal';
    modalGroup.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 hidden';
    modalGroup.innerHTML = `
      <div id="group-modal-backdrop" class="fixed inset-0 bg-black/60 transition-opacity"></div>
      <div class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform scale-100 transition-all">
        <div class="p-5 border-b border-gray-150 bg-gradient-to-r from-caci-blue to-caci-blueDim text-white flex justify-between items-center">
          <div>
            <span class="text-[9px] bg-caci-red px-2.5 py-0.5 rounded text-white uppercase font-black tracking-widest">PostgreSQL Engine Schema</span>
            <h3 class="font-extrabold text-sm mt-1">Create Assembly Department</h3>
          </div>
          <button id="group-modal-close" class="text-white hover:bg-caci-blueDim p-1 rounded-lg">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div class="p-6 space-y-4 text-left">
          <div class="space-y-1">
            <label class="text-[10px] text-gray-500 font-bold block">Department / Ministry Name *</label>
            <input type="text" id="group-form-name" placeholder="e.g. National Youth Ministry" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-caci-blue">
          </div>
          <div class="space-y-1">
            <label class="text-[10px] text-gray-500 font-bold block">Mission Description</label>
            <textarea id="group-form-desc" rows="3" placeholder="Core mandate of this group..." class="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-caci-blue"></textarea>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] text-gray-500 font-bold block">In-App Messaging Privilege</label>
            <select id="group-form-mode" class="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs bg-white focus:outline-none focus:border-caci-blue">
              <option value="open">Open (All members can post to group chat)</option>
              <option value="restricted">Restricted (Only leaders can post to chat)</option>
            </select>
          </div>
        </div>
        <div class="p-4 bg-gray-50 border-t border-gray-150 flex items-center justify-end space-x-2.5">
          <button id="group-modal-cancel" class="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-100">Cancel</button>
          <button id="btn-save-group" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold">Generate Group Schema</button>
        </div>
      </div>
    `;
    modalsContainer.appendChild(modalGroup);
  }

  let enrollModal = document.getElementById('enrollment-modal');
  if (!enrollModal) {
    enrollModal = document.createElement('div');
    enrollModal.id = 'enrollment-modal';
    enrollModal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 hidden';
    enrollModal.innerHTML = `
      <div id="enroll-modal-backdrop" class="fixed inset-0 bg-black/60 transition-opacity"></div>
      <div class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform scale-100 transition-all">
        <div class="p-5 border-b border-gray-150 bg-gray-900 text-white flex justify-between items-center">
          <div>
            <span class="text-[9px] bg-caci-red px-2.5 py-0.5 rounded text-white uppercase font-black tracking-widest">Table: group_members</span>
            <h3 id="enrollment-modal-title" class="font-extrabold text-sm mt-1">Manage Enrollments</h3>
          </div>
          <button id="enroll-modal-close" class="text-white hover:bg-gray-800 p-1 rounded-lg">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div class="p-5 space-y-4">
          <div class="relative">
            <i data-lucide="search" class="absolute left-3 top-2 h-4 w-4 text-gray-400"></i>
            <input type="text" id="enrollment-search" placeholder="Search assembly members to enroll..." class="w-full pl-9 pr-4 py-1.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:border-indigo-500" />
          </div>
          <div class="space-y-2">
            <h4 class="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">Select member to Add or Remove</h4>
            <div id="enrollment-candidates-list" class="space-y-2 max-h-56 overflow-y-auto border border-gray-100 p-2 rounded-xl bg-gray-50/50">
              <!-- rendered dynamically -->
            </div>
          </div>
        </div>
        <div class="p-4 bg-gray-50 border-t border-gray-150 flex items-center justify-end">
          <button id="enroll-modal-done" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold">Done</button>
        </div>
      </div>
    `;
    modalsContainer.appendChild(enrollModal);
  }

  // Bind close handlers
  document.getElementById('group-modal-close')?.addEventListener('click', closeGroupModal);
  document.getElementById('group-modal-cancel')?.addEventListener('click', closeGroupModal);
  document.getElementById('group-modal-backdrop')?.addEventListener('click', closeGroupModal);
  
  document.getElementById('enroll-modal-close')?.addEventListener('click', closeEnrollmentModal);
  document.getElementById('enroll-modal-done')?.addEventListener('click', closeEnrollmentModal);
  document.getElementById('enroll-modal-backdrop')?.addEventListener('click', closeEnrollmentModal);

  document.getElementById('btn-save-group')?.addEventListener('click', async () => {
    const name = (document.getElementById('group-form-name') as HTMLInputElement).value.trim();
    const desc = (document.getElementById('group-form-desc') as HTMLTextAreaElement).value.trim();
    const mode = (document.getElementById('group-form-mode') as HTMLSelectElement).value;

    if (!name) {
      showToast("Error", "Department Ministry Name is required.", "error");
      return;
    }

    const { error } = await supabase.from('groups').insert({
      name,
      description: desc || null,
      messaging_mode: mode,
      leader_id: null,
      is_active: true
    });

    if (error) {
      showToast("Error", error.message, "error");
      return;
    }

    showToast("Success", `Group module: '${name}' generated inside database.`, "success");
    closeGroupModal();
    await syncAdminData();
  });

  document.getElementById('enrollment-search')?.addEventListener('input', (e) => {
    adminState.enrollmentSearchQuery = (e.target as HTMLInputElement).value;
    renderEnrollmentCandidates();
  });
}

function attachHandlers(container: HTMLElement) {
  document.getElementById('btn-create-group')?.addEventListener('click', launchNewGroupModal);

  document.getElementById('groups-search-input')?.addEventListener('input', (e) => {
    adminState.groupSearchQuery = (e.target as HTMLInputElement).value;
    const grid = document.getElementById('groups-grid-container');
    if (grid) {
      grid.innerHTML = renderGroupsGrid();
      attachHandlers(container); // Re-attach for new elements
      lucide.createIcons({ root: grid });
    }
  });

  document.getElementById('groups-filter-status')?.addEventListener('change', (e) => {
    adminState.groupStatusFilter = (e.target as HTMLSelectElement).value;
    const grid = document.getElementById('groups-grid-container');
    if (grid) {
      grid.innerHTML = renderGroupsGrid();
      attachHandlers(container);
      lucide.createIcons({ root: grid });
    }
  });

  container.querySelectorAll('.group-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Prevent navigation if clicking on "Manage Roster" button specifically (which we handle below)
      if ((e.target as HTMLElement).closest('.btn-manage-roster-link')) return;

      const id = (e.currentTarget as HTMLElement).dataset.id!;
      adminState.selectedGroupId = id;
      adminState.groupDetailTab = 'overview';
      notifyAdminStateChange();
    });
  });

  container.querySelectorAll('.btn-manage-roster-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (e.currentTarget as HTMLElement).dataset.id!;
      adminState.selectedGroupId = id;
      adminState.groupDetailTab = 'members';
      notifyAdminStateChange();
    });
  });
}

export function launchNewGroupModal() {
  (document.getElementById('group-form-name') as HTMLInputElement).value = "";
  (document.getElementById('group-form-desc') as HTMLTextAreaElement).value = "";
  (document.getElementById('group-form-mode') as HTMLSelectElement).value = "open";
  document.getElementById('group-modal')?.classList.remove('hidden');
}

export function closeGroupModal() {
  document.getElementById('group-modal')?.classList.add('hidden');
}

export function launchEnrollmentModal(groupId: string) {
  const grp = MOCK_GROUPS.find((g: Tables<'groups'>) => g.id === groupId);
  if (!grp) return;

  adminState.enrollmentGroupId = groupId;
  adminState.enrollmentSearchQuery = "";
  
  const title = document.getElementById("enrollment-modal-title");
  if (title) title.innerText = `Manage Enrollments: ${grp.name}`;
  
  const searchInp = document.getElementById("enrollment-search") as HTMLInputElement;
  if (searchInp) searchInp.value = "";

  renderEnrollmentCandidates();
  document.getElementById("enrollment-modal")?.classList.remove("hidden");
}

export function closeEnrollmentModal() {
  document.getElementById("enrollment-modal")?.classList.add("hidden");
  adminState.enrollmentGroupId = null;
  notifyAdminStateChange(); // refresh to update counts
}

export function renderEnrollmentCandidates() {
  const groupId = adminState.enrollmentGroupId;
  if (!groupId) return;

  const query = adminState.enrollmentSearchQuery.toLowerCase();
  const container = document.getElementById("enrollment-candidates-list");
  if (!container) return;

  const activeMembers = MOCK_MEMBERS.filter((m: Tables<'members'>) => m.is_active);
  const filtered = activeMembers.filter((m: Tables<'members'>) => (m.full_name?.toLowerCase().includes(query) ?? false));

  if (filtered.length === 0) {
    container.innerHTML = `<p class="text-xs text-gray-400 p-4 text-center">No assembly candidates matching search.</p>`;
    return;
  }

  container.innerHTML = filtered.map((m: Tables<'members'>) => {
    const isEnrolled = MOCK_GROUP_MEMBERS.some((gm: Tables<'group_members'>) => gm.group_id === groupId && gm.member_id === m.id);
    return `
      <div class="flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg">
        <div class="min-w-0">
          <span class="text-xs font-bold text-gray-900 block truncate">${m.full_name}</span>
          <span class="text-[9px] text-gray-400 font-mono">${m.membership_number}</span>
        </div>
        <button data-member="${m.id}" data-enrolled="${isEnrolled}" class="btn-toggle-enrollment px-2.5 py-1 text-[10px] font-bold rounded-lg shrink-0 ${isEnrolled ? 'bg-red-50 hover:bg-red-100 text-caci-red' : 'bg-green-50 hover:bg-green-100 text-caci-success'}">
          ${isEnrolled ? 'Remove member' : 'Enroll member'}
        </button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-toggle-enrollment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const b = e.currentTarget as HTMLElement;
      const memId = b.dataset.member!;
      const isEnrolled = b.dataset.enrolled === 'true';
      toggleEnrollmentState(groupId, memId, isEnrolled);
    });
  });
}

async function toggleEnrollmentState(groupId: string, memberId: string, isEnrolled: boolean) {
  if (isEnrolled) {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('member_id', memberId);
    if (error) {
      showToast("Error", error.message, "error");
    } else {
      showToast("Revoked", "Revoked member from department registry.", "success");
      await syncAdminData();
      renderEnrollmentCandidates();
    }
  } else {
    const { error } = await supabase
      .from('group_members')
      .insert({
        group_id: groupId,
        member_id: memberId
      });
    if (error) {
      showToast("Error", error.message, "error");
    } else {
      showToast("Success", "Enrolled member into department successfully!", "success");
      await syncAdminData();
      renderEnrollmentCandidates();
    }
  }
}
