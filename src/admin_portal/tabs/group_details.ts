import { GROUPS, GROUP_MEMBERS, MEMBERS, adminState, notifyAdminStateChange, syncAdminData } from '../store';
import { showToast } from '../../core/toast';
import { supabase } from '../../core/supabase';
import { Tables } from '../../types/database.types';

let isActionProcessing = false;

export function renderGroupDetails(container: HTMLElement, modalsContainer: HTMLElement) {
  const group = GROUPS.find(g => g.id === adminState.selectedGroupId);
  if (!group) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-20 text-center">
        <div class="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <i data-lucide="alert-circle" class="w-8 h-8"></i>
        </div>
        <h2 class="text-xl font-bold text-gray-900">Department Not Found</h2>
        <p class="text-gray-500 mt-2">The department you are looking for does not exist or has been removed.</p>
        <button id="btn-back-to-groups" class="mt-6 text-caci-blue font-bold hover:underline flex items-center gap-2">
          <i data-lucide="arrow-left" class="w-4 h-4"></i> Back to Departments
        </button>
      </div>
    `;
    lucide.createIcons({ root: container });
    document.getElementById('btn-back-to-groups')?.addEventListener('click', () => {
      adminState.selectedGroupId = null;
      notifyAdminStateChange();
    });
    return;
  }

  const leader = MEMBERS.find(m => m.id === group.leader_id);
  const memberCount = GROUP_MEMBERS.filter(gm => gm.group_id === group.id).length;

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="bg-white border border-[#e6edf3] rounded-2xl p-6 shadow-3xs">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="flex items-start gap-4">
            <div class="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0 shadow-sm border border-indigo-100">
              <i data-lucide="layers" class="w-7 h-7"></i>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-2xl font-black text-gray-900 truncate">${group.name}</h1>
                <span class="${group.messaging_mode === 'open' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-[10px] font-black uppercase px-2.5 py-1 rounded-lg">
                  ${group.messaging_mode} Comms
                </span>
                ${!group.is_active ? `<span class="bg-amber-100 text-amber-700 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border border-amber-200">Archived</span>` : ''}
              </div>
              <p class="text-sm text-gray-500 mt-1 max-w-2xl">${group.description || 'No description provided.'}</p>
              <div class="flex items-center gap-4 mt-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <div class="flex items-center gap-1.5">
                  <i data-lucide="users" class="w-4 h-4"></i>
                  <span class="text-gray-900">${memberCount}</span> <span>Enrolled Members</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <i data-lucide="user-check" class="w-4 h-4 text-indigo-500"></i>
                  <span class="text-gray-700">Head: ${leader ? leader.full_name : 'Unassigned'}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button id="btn-edit-dept" class="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 flex items-center gap-2 transition-colors">
              <i data-lucide="edit-3" class="w-4 h-4"></i> Edit
            </button>
            <button id="btn-back-to-groups-header" class="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 flex items-center gap-2 transition-colors">
              <i data-lucide="arrow-left" class="w-4 h-4"></i> Back
            </button>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide border-b border-gray-100">
        ${['overview', 'members', 'leadership', 'communication', 'settings'].map(tab => `
          <button data-dept-tab="${tab}" class="px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-all rounded-t-xl border-b-2 ${adminState.groupDetailTab === tab ? 'text-indigo-600 border-indigo-600 bg-indigo-50/50' : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50'}">
            ${tab}
          </button>
        `).join('')}
      </div>

      <!-- Tab Content -->
      <div id="dept-tab-content" class="min-h-[400px]">
        ${renderTabContent(group)}
      </div>
    </div>
  `;

  renderModals(modalsContainer, group);
  attachDetailsHandlers(container, group);
  lucide.createIcons({ root: container });
}

function renderTabContent(group: Tables<'groups'>) {
  switch (adminState.groupDetailTab) {
    case 'overview': return renderOverview(group);
    case 'members': return renderMembers(group);
    case 'leadership': return renderLeadership(group);
    case 'communication': return renderCommunication(group);
    case 'settings': return renderSettings(group);
    default: return renderOverview(group);
  }
}

function renderOverview(group: Tables<'groups'>) {
  const enrollment = GROUP_MEMBERS.filter(gm => gm.group_id === group.id);
  const createdDate = new Date(group.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-white border border-[#e6edf3] rounded-2xl p-6 shadow-3xs">
          <h3 class="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">Department Summary</h3>
          <p class="text-gray-600 text-sm leading-relaxed">${group.description || 'This department has no official mission statement yet. Click edit to define one.'}</p>

          <div class="grid grid-cols-2 gap-6 mt-8 pt-6 border-t border-gray-50">
            <div>
              <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Date Created</span>
              <p class="text-xs font-bold text-gray-700">${createdDate}</p>
            </div>
            <div>
              <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Status</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${group.is_active ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'} uppercase">
                ${group.is_active ? 'Active' : 'Archived'}
              </span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white border border-[#e6edf3] rounded-2xl p-5 shadow-3xs">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Enrollment Total</span>
            <div class="text-2xl font-black text-gray-900 mt-1">${enrollment.length}</div>
            <p class="text-[10px] text-gray-500 font-bold mt-1">Active Members</p>
          </div>
          <div class="bg-white border border-[#e6edf3] rounded-2xl p-5 shadow-3xs">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Comms Mode</span>
            <div class="text-2xl font-black text-gray-900 mt-1 capitalize">${group.messaging_mode}</div>
            <p class="text-[10px] text-indigo-600 font-bold mt-1">Configured Privilege</p>
          </div>
          <div class="bg-white border border-[#e6edf3] rounded-2xl p-5 shadow-3xs">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Permission Level</span>
            <div class="text-2xl font-black text-gray-900 mt-1">Level 2</div>
            <p class="text-[10px] text-gray-500 font-bold mt-1">Standard Department</p>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="bg-white border border-[#e6edf3] rounded-2xl p-6 shadow-3xs">
          <h3 class="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">Quick Actions</h3>
          <div class="space-y-2">
            <button id="quick-add-member" class="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-100 transition-all flex items-center justify-between group">
              <div class="flex items-center gap-3">
                <i data-lucide="user-plus" class="w-4 h-4 text-indigo-600"></i>
                <span class="text-xs font-bold text-gray-700">Manage Roster</span>
              </div>
              <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-gray-300 group-hover:translate-x-1 transition-transform"></i>
            </button>
            <button id="btn-export-roster" class="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-100 transition-all flex items-center justify-between group">
              <div class="flex items-center gap-3">
                <i data-lucide="file-text" class="w-4 h-4 text-indigo-600"></i>
                <span class="text-xs font-bold text-gray-700">Export Roster (CSV)</span>
              </div>
              <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-gray-300 group-hover:translate-x-1 transition-transform"></i>
            </button>
            <button class="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-100 transition-all flex items-center justify-between group opacity-50 cursor-not-allowed">
              <div class="flex items-center gap-3">
                <i data-lucide="megaphone" class="w-4 h-4 text-indigo-600"></i>
                <span class="text-xs font-bold text-gray-700">New Group Broadcast</span>
              </div>
              <span class="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-black uppercase">Alpha</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMembers(group: Tables<'groups'>) {
  const enrollment = GROUP_MEMBERS.filter(gm => gm.group_id === group.id);
  const groupMembers = enrollment.map(e => MEMBERS.find(m => m.id === e.member_id)).filter(Boolean);

  return `
    <div class="bg-white border border-[#e6edf3] rounded-2xl shadow-3xs overflow-hidden">
      <div class="p-5 border-b border-[#e6edf3] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="relative max-w-sm w-full">
          <i data-lucide="search" class="absolute left-3 top-2.5 w-4 h-4 text-gray-400"></i>
          <input type="text" id="dept-member-search" placeholder="Search members in ${group.name}..." class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:border-indigo-500">
        </div>
        <button id="btn-add-member-to-dept" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2">
          <i data-lucide="plus" class="w-4 h-4"></i> Add Members
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-gray-50 border-b border-[#e6edf3] text-gray-400 font-extrabold uppercase">
              <th class="py-3 px-5">Member Details</th>
              <th class="py-3 px-5">Membership #</th>
              <th class="py-3 px-5">Role in Dept</th>
              <th class="py-3 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="dept-members-tbody">
            ${renderMembersRows(groupMembers as Tables<'members'>[], group)}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderMembersRows(members: Tables<'members'>[], group: Tables<'groups'>) {
  if (members.length === 0) {
    return `<tr><td colspan="4" class="py-12 text-center text-gray-400">No members enrolled in this department.</td></tr>`;
  }
  return members.map(m => {
    const isLeader = group.leader_id === m.id;
    return `
      <tr class="border-b border-[#e6edf3] hover:bg-gray-50/50">
        <td class="py-3 px-5">
          <div class="flex items-center space-x-3 cursor-pointer group/item btn-view-member-profile" data-id="${m.id}">
            <div class="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 overflow-hidden">
              ${m.profile_photo_url ? `<img src="${m.profile_photo_url}" class="w-full h-full object-cover">` : `<i data-lucide="user" class="w-4 h-4 text-indigo-400"></i>`}
            </div>
            <div>
              <p class="font-bold text-gray-900 group-hover/item:text-indigo-600 transition-colors">${m.full_name}</p>
              <p class="text-[10px] text-gray-400">${m.phone_number}</p>
            </div>
          </div>
        </td>
        <td class="py-3 px-5 font-mono text-gray-500">${m.membership_number}</td>
        <td class="py-3 px-5">
          ${isLeader ? `<span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">Dept Head</span>` : `<span class="text-gray-400 italic">Member</span>`}
        </td>
        <td class="py-3 px-5 text-right">
          <button class="btn-remove-from-dept text-red-600 font-bold hover:underline" data-id="${m.id}" data-name="${m.full_name}">Remove</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderLeadership(group: Tables<'groups'>) {
  const leader = MEMBERS.find(m => m.id === group.leader_id);

  return `
    <div class="space-y-6">
      <div class="bg-white border border-[#e6edf3] rounded-2xl p-6 shadow-3xs">
        <h3 class="text-sm font-black text-gray-900 uppercase tracking-wider mb-6">Executive Leadership</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="p-6 border border-indigo-100 bg-indigo-50/30 rounded-2xl">
            <div class="flex items-center justify-between mb-4">
              <span class="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Department Head</span>
              ${leader ? `<button id="btn-remove-leader" class="text-red-500 hover:text-red-700 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
            </div>
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-full bg-white border border-indigo-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                ${leader?.profile_photo_url ? `<img src="${leader.profile_photo_url}" class="w-full h-full object-cover">` : `<i data-lucide="user" class="w-7 h-7 text-indigo-300"></i>`}
              </div>
              <div class="min-w-0 flex-1">
                ${leader ? `
                  <p class="text-base font-bold text-gray-900 truncate">${leader.full_name}</p>
                  <p class="text-xs text-gray-500">${leader.phone_number}</p>
                ` : `
                  <p class="text-sm font-bold text-gray-400 italic">No Leader Assigned</p>
                  <button id="btn-assign-leader" class="text-xs font-bold text-indigo-600 hover:underline mt-1">Assign from enrolled roster</button>
                `}
              </div>
            </div>
            ${leader ? `<button id="btn-change-leader" class="w-full mt-4 py-2 border border-indigo-200 text-indigo-600 rounded-xl text-xs font-bold hover:bg-white transition-colors">Change Head</button>` : ''}
          </div>

          <div class="p-6 border border-gray-100 bg-gray-50/50 rounded-2xl flex flex-col justify-center border-dashed">
             <div class="text-center py-2">
                <i data-lucide="plus-circle" class="w-8 h-8 text-gray-300 mx-auto mb-2"></i>
                <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">Assistant Role</p>
                <p class="text-[10px] text-gray-400 mt-1 italic">Coming soon: Multi-layer leadership</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCommunication(group: Tables<'groups'>) {
  return `
    <div class="bg-white border border-[#e6edf3] rounded-2xl p-6 shadow-3xs space-y-8">
      <div>
        <h3 class="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">Messaging Protocol</h3>
        <div class="space-y-4 max-w-2xl">
          <label class="flex items-start gap-4 p-4 rounded-xl border border-gray-100 cursor-pointer transition-all hover:border-indigo-200 ${group.messaging_mode === 'open' ? 'bg-green-50/50 border-green-100' : ''}">
            <div class="mt-0.5">
              <input type="radio" name="comms_mode" value="open" ${group.messaging_mode === 'open' ? 'checked' : ''} class="w-5 h-5 accent-indigo-600">
            </div>
            <div>
              <span class="font-bold text-gray-900 text-sm block">Open Communication</span>
              <p class="text-xs text-gray-500 mt-1">Every member enrolled in this department can post messages and media to the group chat.</p>
            </div>
          </label>
          <label class="flex items-start gap-4 p-4 rounded-xl border border-gray-100 cursor-pointer transition-all hover:border-indigo-200 ${group.messaging_mode === 'restricted' ? 'bg-red-50/50 border-red-100' : ''}">
            <div class="mt-0.5">
              <input type="radio" name="comms_mode" value="restricted" ${group.messaging_mode === 'restricted' ? 'checked' : ''} class="w-5 h-5 accent-indigo-600">
            </div>
            <div>
              <span class="font-bold text-gray-900 text-sm block">Restricted / Broadcast Only</span>
              <p class="text-xs text-gray-500 mt-1">Only the Department Head and district administrators can send messages. Members are viewers.</p>
            </div>
          </label>
        </div>
        <button id="btn-save-comms" class="mt-6 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2">
           <i data-lucide="save" class="w-4 h-4"></i> Save Comms Policy
        </button>
      </div>
    </div>
  `;
}

function renderSettings(group: Tables<'groups'>) {
  return `
    <div class="space-y-6">
      <div class="bg-white border border-[#e6edf3] rounded-2xl p-6 shadow-3xs">
        <h3 class="text-sm font-black text-gray-900 uppercase tracking-wider mb-6">Danger Zone</h3>
        <div class="space-y-4">
          <div class="flex flex-col md:flex-row md:items-center justify-between p-5 border border-amber-100 bg-amber-50/30 rounded-2xl gap-4">
            <div>
              <h4 class="text-sm font-bold text-amber-900">Archive Department</h4>
              <p class="text-xs text-amber-700/80 mt-1">Members will no longer see this department in their portal, but enrollment data is preserved.</p>
            </div>
            <button id="btn-archive-dept" class="px-4 py-2 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors">
               ${group.is_active ? 'Archive Department' : 'Restore Department'}
            </button>
          </div>
          <div class="flex flex-col md:flex-row md:items-center justify-between p-5 border border-red-100 bg-red-50/30 rounded-2xl gap-4">
            <div>
              <h4 class="text-sm font-bold text-red-900">Delete Permanently</h4>
              <p class="text-xs text-red-700/80 mt-1">This will remove the department and all enrollment records. This action cannot be undone.</p>
            </div>
            <button id="btn-delete-dept-permanent" class="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors">Delete Group</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderModals(modalsContainer: HTMLElement, group: Tables<'groups'>) {
  let editModal = document.getElementById('edit-dept-modal');
  if (!editModal) {
    editModal = document.createElement('div');
    editModal.id = 'edit-dept-modal';
    editModal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 hidden';
    modalsContainer.appendChild(editModal);
  }

  editModal.innerHTML = `
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" id="edit-dept-modal-backdrop"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform scale-100 transition-all">
      <div class="p-5 border-b border-gray-150 bg-indigo-600 text-white flex justify-between items-center">
        <div>
          <h3 class="font-extrabold text-sm">Update Department Schema</h3>
          <p class="text-[9px] text-indigo-100 uppercase tracking-widest font-bold mt-0.5">${group.id}</p>
        </div>
        <button id="edit-dept-modal-close" class="text-white hover:bg-indigo-700 p-1 rounded-lg">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="p-6 space-y-4 text-left">
        <div class="space-y-1">
          <label class="text-[10px] text-gray-500 font-bold block">Department Name *</label>
          <input type="text" id="edit-dept-name" value="${group.name}" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-indigo-600">
        </div>
        <div class="space-y-1">
          <label class="text-[10px] text-gray-500 font-bold block">Description</label>
          <textarea id="edit-dept-desc" rows="4" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-indigo-600">${group.description || ''}</textarea>
        </div>
      </div>
      <div class="p-4 bg-gray-50 border-t border-gray-150 flex items-center justify-end space-x-2.5">
        <button id="edit-dept-modal-cancel" class="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-100">Cancel</button>
        <button id="btn-update-dept" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold">Apply Changes</button>
      </div>
    </div>
  `;

  let leaderModal = document.getElementById('assign-leader-modal');
  if (!leaderModal) {
    leaderModal = document.createElement('div');
    leaderModal.id = 'assign-leader-modal';
    leaderModal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 hidden';
    modalsContainer.appendChild(leaderModal);
  }

  const enrollment = GROUP_MEMBERS.filter(gm => gm.group_id === group.id);
  const eligibleLeaders = enrollment.map(e => MEMBERS.find(m => m.id === e.member_id)).filter(Boolean);

  leaderModal.innerHTML = `
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" id="assign-leader-modal-backdrop"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden transform scale-100 transition-all flex flex-col max-h-[80vh]">
      <div class="p-5 border-b border-gray-150 bg-gray-900 text-white flex justify-between items-center shrink-0">
        <h3 class="font-extrabold text-sm">Assign Department Head</h3>
        <button id="assign-leader-modal-close" class="text-white hover:bg-gray-800 p-1 rounded-lg"><i data-lucide="x" class="w-5 h-5"></i></button>
      </div>
      <div class="p-5 space-y-4 overflow-y-auto">
        <p class="text-[11px] text-gray-500 leading-relaxed italic border-l-2 border-indigo-500 pl-3">Only members currently enrolled in the department roster can be assigned as the primary leader.</p>
        <div id="eligible-leaders-list" class="space-y-1">
          ${eligibleLeaders.length > 0 ? eligibleLeaders.map(m => `
            <button class="btn-select-leader w-full flex items-center gap-3 p-2.5 hover:bg-indigo-50 rounded-xl transition-all group text-left" data-id="${m?.id}" data-name="${m?.full_name}">
              <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                ${m?.profile_photo_url ? `<img src="${m.profile_photo_url}" class="w-full h-full object-cover">` : `<i data-lucide="user" class="w-4 h-4 text-gray-400"></i>`}
              </div>
              <div class="min-w-0 flex-1">
                 <p class="text-xs font-bold text-gray-900 truncate group-hover:text-indigo-600">${m?.full_name}</p>
                 <p class="text-[10px] text-gray-500 font-mono">${m?.membership_number}</p>
              </div>
            </button>
          `).join('') : `<p class="py-10 text-center text-gray-400 text-xs">No enrolled members available.</p>`}
        </div>
      </div>
    </div>
  `;

  // Bind edit modal
  document.getElementById('edit-dept-modal-close')?.addEventListener('click', () => editModal?.classList.add('hidden'));
  document.getElementById('edit-dept-modal-cancel')?.addEventListener('click', () => editModal?.classList.add('hidden'));
  document.getElementById('edit-dept-modal-backdrop')?.addEventListener('click', () => editModal?.classList.add('hidden'));

  document.getElementById('btn-update-dept')?.addEventListener('click', async () => {
    if (isActionProcessing) return;
    const name = (document.getElementById('edit-dept-name') as HTMLInputElement).value.trim();
    const desc = (document.getElementById('edit-dept-desc') as HTMLTextAreaElement).value.trim();

    if (!name) return showToast("Error", "Name is required.", "error");

    isActionProcessing = true;
    const { error } = await supabase.from('groups').update({ name, description: desc }).eq('id', group.id);
    isActionProcessing = false;

    if (error) {
      showToast("Error", error.message, "error");
    } else {
      showToast("Success", "Department metadata updated.", "success");
      editModal?.classList.add('hidden');
      await syncAdminData();
    }
  });

  // Bind leader modal
  document.getElementById('assign-leader-modal-close')?.addEventListener('click', () => leaderModal?.classList.add('hidden'));
  document.getElementById('assign-leader-modal-backdrop')?.addEventListener('click', () => leaderModal?.classList.add('hidden'));

  leaderModal?.querySelectorAll('.btn-select-leader').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (isActionProcessing) return;
      const leaderId = (btn as HTMLElement).dataset.id!;
      const leaderName = (btn as HTMLElement).dataset.name!;

      isActionProcessing = true;
      const { error } = await supabase.from('groups').update({ leader_id: leaderId }).eq('id', group.id);
      isActionProcessing = false;

      if (error) {
        showToast("Error", error.message, "error");
      } else {
        showToast("Success", `${leaderName} assigned as Department Head.`, "success");
        leaderModal?.classList.add('hidden');
        await syncAdminData();
      }
    });
  });

  lucide.createIcons({ root: editModal });
  lucide.createIcons({ root: leaderModal });
}

function attachDetailsHandlers(container: HTMLElement, group: Tables<'groups'>) {
  // Navigation
  container.querySelectorAll('[data-dept-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      adminState.groupDetailTab = (btn as HTMLElement).dataset.deptTab as any;
      notifyAdminStateChange();
    });
  });

  document.getElementById('btn-export-roster')?.addEventListener('click', () => {
    const enrollment = GROUP_MEMBERS.filter(gm => gm.group_id === group.id);
    const members = enrollment.map(e => MEMBERS.find(m => m.id === e.member_id)).filter(Boolean) as Tables<'members'>[];

    let csv = 'Full Name,Membership Number,Phone Number,Location\n';
    members.forEach(m => {
      csv += `"${m.full_name}","${m.membership_number}","${m.phone_number}","${m.location || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${group.name.replace(/\s+/g, '_')}_Roster.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast("Success", "Department roster exported to CSV.", "success");
  });

  document.getElementById('btn-back-to-groups-header')?.addEventListener('click', () => {
    adminState.selectedGroupId = null;
    notifyAdminStateChange();
  });

  document.getElementById('btn-edit-dept')?.addEventListener('click', () => {
     document.getElementById('edit-dept-modal')?.classList.remove('hidden');
  });

  // Tab: Overview
  document.getElementById('quick-add-member')?.addEventListener('click', () => {
     adminState.groupDetailTab = 'members';
     notifyAdminStateChange();
  });

  // Tab: Members
  if (adminState.groupDetailTab === 'members') {
    document.getElementById('btn-add-member-to-dept')?.addEventListener('click', () => {
      import('./groups').then(m => m.launchEnrollmentModal(group.id));
    });

    container.querySelectorAll('.btn-view-member-profile').forEach(btn => {
      btn.addEventListener('click', (e) => {
         const id = (e.currentTarget as HTMLElement).dataset.id!;
         import('./members').then(m => m.launchEditMemberModal(id));
      });
    });

    container.querySelectorAll('.btn-remove-from-dept').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (isActionProcessing) return;
        const id = (btn as HTMLElement).dataset.id!;
        const name = (btn as HTMLElement).dataset.name!;

        if (!confirm(`Are you sure you want to remove ${name} from ${group.name}?`)) return;

        isActionProcessing = true;
        const { error } = await supabase.from('group_members').delete().eq('group_id', group.id).eq('member_id', id);
        isActionProcessing = false;

        if (error) {
          showToast("Error", error.message, "error");
        } else {
          showToast("Removed", "Member removed from department roster.", "success");
          await syncAdminData();
        }
      });
    });

    document.getElementById('dept-member-search')?.addEventListener('input', (e) => {
       const query = (e.target as HTMLInputElement).value.toLowerCase();
       const tbody = document.getElementById('dept-members-tbody');
       if (!tbody) return;

       const enrollment = GROUP_MEMBERS.filter(gm => gm.group_id === group.id);
       const members = enrollment.map(e => MEMBERS.find(m => m.id === e.member_id)).filter(Boolean) as Tables<'members'>[];
       const filtered = members.filter(m => m.full_name?.toLowerCase().includes(query) || m.membership_number?.toLowerCase().includes(query));

       tbody.innerHTML = renderMembersRows(filtered, group);
       lucide.createIcons({ root: tbody });
    });
  }

  // Tab: Leadership
  if (adminState.groupDetailTab === 'leadership') {
    document.getElementById('btn-assign-leader')?.addEventListener('click', () => {
      document.getElementById('assign-leader-modal')?.classList.remove('hidden');
    });
    document.getElementById('btn-change-leader')?.addEventListener('click', () => {
      document.getElementById('assign-leader-modal')?.classList.remove('hidden');
    });
    document.getElementById('btn-remove-leader')?.addEventListener('click', async () => {
       if (isActionProcessing) return;
       if (!confirm("Are you sure you want to remove the current Department Head?")) return;

       isActionProcessing = true;
       const { error } = await supabase.from('groups').update({ leader_id: null }).eq('id', group.id);
       isActionProcessing = false;

       if (error) {
         showToast("Error", error.message, "error");
       } else {
         showToast("Success", "Department Head role vacated.", "success");
         await syncAdminData();
       }
    });
  }

  // Tab: Communication
  if (adminState.groupDetailTab === 'communication') {
    document.getElementById('btn-save-comms')?.addEventListener('click', async () => {
      if (isActionProcessing) return;
      const mode = (container.querySelector('input[name="comms_mode"]:checked') as HTMLInputElement)?.value;
      if (!mode) return;

      isActionProcessing = true;
      const { error } = await supabase.from('groups').update({ messaging_mode: mode }).eq('id', group.id);
      isActionProcessing = false;

      if (error) {
        showToast("Error", error.message, "error");
      } else {
        showToast("Success", `Communication policy set to ${mode}.`, "success");
        await syncAdminData();
      }
    });
  }

  // Tab: Settings
  if (adminState.groupDetailTab === 'settings') {
    document.getElementById('btn-archive-dept')?.addEventListener('click', async () => {
       if (isActionProcessing) return;
       const newState = !group.is_active;
       const actionText = newState ? 'restore' : 'archive';
       if (!confirm(`Are you sure you want to ${actionText} this department?`)) return;

       isActionProcessing = true;
       const { error } = await supabase.from('groups').update({ is_active: newState }).eq('id', group.id);
       isActionProcessing = false;

       if (error) {
         showToast("Error", error.message, "error");
       } else {
         showToast("Success", `Department ${newState ? 'restored' : 'archived'} successfully.`, "success");
         await syncAdminData();
       }
    });

    document.getElementById('btn-delete-dept-permanent')?.addEventListener('click', async () => {
      if (isActionProcessing) return;

      const confirmMsg = `WARNING: This will permanently delete '${group.name}' and ALL ${GROUP_MEMBERS.filter(gm => gm.group_id === group.id).length} enrollment records. This cannot be undone. Type 'DELETE' to confirm.`;
      const val = prompt(confirmMsg);
      if (val !== 'DELETE') return;

      isActionProcessing = true;
      const { error } = await supabase.from('groups').delete().eq('id', group.id);
      isActionProcessing = false;

      if (error) {
        showToast("Error", error.message, "error");
      } else {
        showToast("Deleted", `${group.name} and its history removed from database.`, "success");
        adminState.selectedGroupId = null;
        await syncAdminData();
      }
    });
  }
}
