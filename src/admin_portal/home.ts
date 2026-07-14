// src/admin_portal/home.ts
import { Session } from '@supabase/supabase-js';
import { supabase } from '../core/supabase';
import { showToast } from '../core/toast';
import { showSwitchPortalModal, showSignOutModal } from '../core/PortalModal';
import { adminState, MOCK_MEMBERS, MOCK_GROUPS, MOCK_BROADCASTS, MOCK_USER_PROFILES, MOCK_AUDIT_LOGS, subscribeAdmin, notifyAdminStateChange, syncAdminData, setSession } from './store';

import { renderDashboardTab } from './tabs/dashboard';
import { renderMembersTab, launchNewMemberModal, closeMemberModal } from './tabs/members';
import { renderGroupsTab, closeGroupModal, closeEnrollmentModal } from './tabs/groups';
import { renderGroupDetails } from './tabs/group_details';
import { renderAccountsTab, closeAccountModal } from './tabs/accounts';
import { renderBroadcastsTab } from './tabs/broadcasts';
import { renderAuditTab } from './tabs/audit';
import { renderMembersHome } from '../members_portal/home';

// Shared event bus for modals and cross-tab communication
export const AdminEventBus = new EventTarget();

// Stored session reference for portal switching (set on mount)
let _currentSession: Session | null = null;

export async function renderAdminHome(app: HTMLElement, session: Session): Promise<void> {
  console.log('[admin-home] Initializing...');
  _currentSession = session;
  setSession(session);

  try {
    // Sync admin data from Supabase before rendering the shell
    await syncAdminData();
    console.log('[admin-home] Data sync complete');

    app.id = 'admin-root';
    app.innerHTML = buildAdminShellHtml();

    attachShellHandlers();
    initRouter();

    // Re-render when state changes
    subscribeAdmin(() => {
      updateActiveTab();
      refreshBadges();
      syncUrlWithState();
      if (window.lucide) {
        window.lucide.createIcons();
      }
    });

    refreshBadges();
    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (err: any) {
    console.error('[admin-home] Render failed:', err);
    throw err;
  }
}

function buildAdminShellHtml() {
  return `
    <!-- Modals Containers (Hidden by default) -->
    <div id="admin-modals-container"></div>

    <!-- Mobile Header -->
    <header class="bg-caci-blue text-white py-3.5 px-4 flex items-center justify-between shadow-md lg:hidden sticky top-0 z-40">
      <div class="flex items-center space-x-3">
        <div class="w-9 h-9 bg-white rounded-full flex items-center justify-center border-2 border-caci-red overflow-hidden shadow-sm">
          <span class="font-extrabold text-[10px] text-caci-blue">CACI</span>
        </div>
        <div>
          <h1 class="font-black text-sm tracking-wide text-white">CACI ADMIN</h1>
          <span class="text-[9px] text-blue-200 uppercase tracking-widest block font-bold leading-none">Assembly Control</span>
        </div>
      </div>
      <button id="admin-mobile-menu-btn" class="p-2 text-white hover:bg-caci-blueDim rounded-md transition-colors">
        <i data-lucide="menu" class="w-6 h-6"></i>
      </button>
    </header>

    <div class="flex flex-1 overflow-hidden h-full">
      <!-- Desktop Sidebar -->
      <aside class="hidden lg:flex flex-col w-64 bg-caci-blue text-white shrink-0 h-full justify-between">
        <div class="flex flex-col">
          <div class="p-6 border-b border-white/10 flex items-center space-x-3">
            <div class="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center border border-white/20 overflow-hidden shrink-0">
              <span class="font-black text-xs text-white">CACI</span>
            </div>
            <div>
              <h2 class="font-black text-base uppercase tracking-wider leading-none text-white">CACI <span class="text-caci-redLight font-extrabold">Hub</span></h2>
              <p class="text-[10px] text-blue-200 mt-1 font-medium tracking-wide">Admin Portal</p>
            </div>
          </div>

          <nav class="p-4 space-y-6 overflow-y-auto">
            <div class="space-y-1.5">
              <p class="text-[10px] uppercase font-bold text-blue-300/70 px-3 tracking-widest mb-1">Assembly Control</p>
              
              <button data-tab="dashboard" class="admin-tab-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-tab text-white hover:bg-white/10">
                <div class="flex items-center space-x-3">
                  <i data-lucide="layout-dashboard" class="w-4.5 h-4.5"></i><span>Dashboard Overview</span>
                </div>
              </button>

              <button data-tab="members" class="admin-tab-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-tab text-white hover:bg-white/10">
                <div class="flex items-center space-x-3">
                  <i data-lucide="users" class="w-4.5 h-4.5"></i><span>Manage Members</span>
                </div>
                <span id="badge-total-members" class="bg-caci-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">0</span>
              </button>

              <button data-tab="groups" class="admin-tab-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-tab text-white hover:bg-white/10">
                <div class="flex items-center space-x-3">
                  <i data-lucide="layers" class="w-4.5 h-4.5"></i><span>Departments / Groups</span>
                </div>
                <span id="badge-total-groups" class="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">0</span>
              </button>

              <button data-tab="broadcasts" class="admin-tab-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-tab text-white hover:bg-white/10">
                <div class="flex items-center space-x-3">
                  <i data-lucide="megaphone" class="w-4.5 h-4.5"></i><span>Announcements</span>
                </div>
                <span class="bg-green-500 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm tracking-wide">R2</span>
              </button>
            </div>

            <div class="space-y-1.5">
              <p class="text-[10px] uppercase font-bold text-blue-300/70 px-3 tracking-widest mb-1">System Security</p>
              <button data-tab="accounts" class="admin-tab-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-tab text-white hover:bg-white/10">
                <div class="flex items-center space-x-3">
                  <i data-lucide="shield" class="w-4.5 h-4.5"></i><span>Manage User Accounts</span>
                </div>
                <span id="badge-total-accounts" class="bg-white/25 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">0</span>
              </button>

              <button data-tab="audit" class="admin-tab-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-tab text-white hover:bg-white/10">
                <div class="flex items-center space-x-3">
                  <i data-lucide="shield-alert" class="w-4.5 h-4.5"></i><span>Audit Log Registry</span>
                </div>
              </button>
            </div>
          </nav>
        </div>

        <div class="p-3 border-t border-white/10 mt-auto">
          <button id="admin-btn-switch-portal" class="w-full flex items-center space-x-2 px-3 py-2 mb-2.5 text-xs font-semibold text-white/85 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
            <i data-lucide="arrow-left-right" class="w-3.5 h-3.5 shrink-0"></i><span>Switch to Member Portal</span>
          </button>
          <div class="group flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-full p-1 transition-all shadow-md shadow-black/20 cursor-default">
            <div class="flex items-center space-x-3 min-w-0">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center shrink-0 shadow-sm shadow-black/30 relative overflow-hidden">
                <span class="font-extrabold text-[11px] text-white uppercase tracking-wider">AD</span>
              </div>
              <div class="flex flex-col justify-center min-w-0 py-0.5">
                <span class="text-[11.5px] font-bold text-white truncate leading-tight tracking-wide">Assembly Admin</span>
                <span class="text-[8.5px] text-blue-200/70 truncate leading-tight uppercase font-extrabold tracking-widest mt-0.5">Super User</span>
              </div>
            </div>
            <button id="admin-btn-logout" title="Sign Out" class="w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-caci-red transition-all shrink-0 mr-0.5">
              <i data-lucide="log-out" class="w-3.5 h-3.5 ml-0.5"></i>
            </button>
          </div>
        </div>
      </aside>

      <!-- Mobile Drawer -->
      <div id="admin-mobile-drawer" class="fixed inset-0 z-50 flex lg:hidden hidden" role="dialog" aria-modal="true">
        <div id="admin-mobile-backdrop" class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"></div>
        <div class="relative flex flex-col w-4/5 max-w-xs bg-caci-blue text-white h-full shadow-2xl transition-transform transform duration-300 translate-x-0">
          <div class="p-5 border-b border-white/10 flex justify-between items-start">
            <div class="flex items-center space-x-3">
              <div class="w-9 h-9 bg-white rounded-full flex items-center justify-center border-2 border-caci-red shrink-0">
                <span class="font-bold text-xs text-caci-blue">CACI</span>
              </div>
              <div>
                <h3 class="font-extrabold text-sm tracking-wide text-white">CACI Hub Admin</h3>
                <p class="text-[10px] text-blue-200 leading-none mt-0.5">Adabraka District</p>
              </div>
            </div>
            <button id="admin-mobile-close" class="text-white/85 hover:text-white p-1 rounded-md">
              <i data-lucide="x" class="w-5.5 h-5.5"></i>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 space-y-6">
            <div class="space-y-1">
              <p class="text-[10px] uppercase font-black text-blue-300/70 px-3 mb-2 tracking-widest">Controls</p>
              <button data-tab="dashboard" class="admin-mobile-tab-btn w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-white/85 hover:bg-white/10">
                <div class="flex items-center space-x-3"><i data-lucide="layout-dashboard" class="w-5 h-5"></i><span>Overview</span></div>
              </button>
              <button data-tab="members" class="admin-mobile-tab-btn w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-white/85 hover:bg-white/10">
                <div class="flex items-center space-x-3"><i data-lucide="users" class="w-5 h-5"></i><span>Members</span></div>
              </button>
              <button data-tab="groups" class="admin-mobile-tab-btn w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-white/85 hover:bg-white/10">
                <div class="flex items-center space-x-3"><i data-lucide="layers" class="w-5 h-5"></i><span>Departments</span></div>
              </button>
              <button data-tab="broadcasts" class="admin-mobile-tab-btn w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-white/85 hover:bg-white/10">
                <div class="flex items-center space-x-3"><i data-lucide="megaphone" class="w-5 h-5"></i><span>Broadcasts</span></div>
              </button>
              <button data-tab="accounts" class="admin-mobile-tab-btn w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-white/85 hover:bg-white/10">
                <div class="flex items-center space-x-3"><i data-lucide="shield" class="w-5 h-5"></i><span>User Accounts</span></div>
              </button>
              <button data-tab="audit" class="admin-mobile-tab-btn w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-white/85 hover:bg-white/10">
                <div class="flex items-center space-x-3"><i data-lucide="shield-alert" class="w-5 h-5"></i><span>Audit Log</span></div>
              </button>
            </div>
          </div>
          <div class="p-4 border-t border-white/10 bg-black/15 flex items-center justify-between">
            <button id="admin-mobile-switch-portal" class="flex items-center space-x-1.5 text-xs text-white/80 hover:text-white font-bold">
              <i data-lucide="arrow-left-right" class="w-4 h-4"></i><span>Member Portal</span>
            </button>
            <button id="admin-mobile-logout" class="flex items-center space-x-1 text-xs text-caci-redLight font-bold">
              <i data-lucide="log-out" class="w-4 h-4"></i><span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <main class="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div class="h-14 bg-white border-b border-[#e6edf3] px-6 flex items-center justify-between shrink-0 shadow-3xs">
          <div class="flex items-center space-x-2 text-xs font-semibold text-gray-500">
            <span class="text-caci-blue uppercase tracking-widest font-bold">CACI Admin</span>
            <span class="text-gray-300">/</span>
            <span id="admin-top-bar-breadcrumb" class="text-gray-800 capitalize font-bold">Dashboard Overview</span>
          </div>
          <div class="flex items-center space-x-4">
            <span class="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-caci-red border border-red-100 font-mono uppercase">
              Supabase Public Schema v1
            </span>
            <div class="h-4 w-[1px] bg-gray-200 hidden sm:block"></div>
            <span class="text-xs text-gray-500 font-medium" id="admin-top-bar-date"></span>
          </div>
        </div>

        <div class="flex-1 p-6 overflow-y-auto" id="admin-tab-content-root">
          <!-- Dynamic Content Loads Here -->
        </div>
      </main>
    </div>
  `;
}

function attachShellHandlers() {
  const dateEl = document.getElementById('admin-top-bar-date');
  if (dateEl) dateEl.innerText = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Tab switching desktop
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchAdminTab((btn as HTMLElement).dataset.tab!);
    });
  });

  // Tab switching mobile
  document.querySelectorAll('.admin-mobile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchAdminTab((btn as HTMLElement).dataset.tab!);
      toggleAdminMobileDrawer(false);
    });
  });

  // Drawer
  document.getElementById("admin-mobile-menu-btn")?.addEventListener("click", () => toggleAdminMobileDrawer(true));
  document.getElementById("admin-mobile-close")?.addEventListener("click", () => toggleAdminMobileDrawer(false));
  document.getElementById("admin-mobile-backdrop")?.addEventListener("click", () => toggleAdminMobileDrawer(false));

  // Shared bus
  AdminEventBus.addEventListener('switchTab', (e: any) => switchAdminTab(e.detail));

  // Switch to Member Portal
  const handleSwitchToMember = async () => {
    showSwitchPortalModal({
      targetLabel: 'Member Portal',
      userName: 'Assembly Admin',
      userRole: 'Administrator',
      initials: 'AD',
      onConfirm: async () => {
        const app = document.getElementById('app') ?? document.body;
        await renderMembersHome(app as HTMLElement, _currentSession!);
      }
    });
  };
  document.getElementById('admin-btn-switch-portal')?.addEventListener('click', handleSwitchToMember);
  document.getElementById('admin-mobile-switch-portal')?.addEventListener('click', handleSwitchToMember);

  // Logout
  const handleLogout = () => {
    showSignOutModal({
      userName: 'Assembly Admin',
      userRole: 'Administrator · Admin Portal',
      initials: 'AD',
      onConfirm: async () => {
        await supabase.auth.signOut();
        window.location.reload();
      }
    });
  };
  document.getElementById("admin-btn-logout")?.addEventListener("click", handleLogout);
  document.getElementById("admin-mobile-logout")?.addEventListener("click", handleLogout);
}

function initRouter() {
  window.addEventListener('popstate', () => {
    adminState.isNavigating = true;
    parseUrlToState();
    adminState.isNavigating = false;
    notifyAdminStateChange();
  });

  parseUrlToState();
}

function parseUrlToState() {
  const path = window.location.pathname;
  if (path.startsWith('/admin/departments/')) {
    const parts = path.split('/').filter(Boolean);
    adminState.activeTab = 'groups';
    adminState.selectedGroupId = parts[2] || null;
    adminState.groupDetailTab = (parts[3] as any) || 'overview';
  } else {
    const tab = path.split('/').filter(Boolean)[1];
    if (tab && ['dashboard', 'members', 'groups', 'broadcasts', 'accounts', 'audit'].includes(tab)) {
      adminState.activeTab = tab;
    } else {
      adminState.activeTab = 'dashboard';
    }
    adminState.selectedGroupId = null;
  }
}

function syncUrlWithState() {
  if (adminState.isNavigating) return;

  let newPath = `/admin/${adminState.activeTab}`;
  if (adminState.activeTab === 'groups' && adminState.selectedGroupId) {
    newPath = `/admin/departments/${adminState.selectedGroupId}/${adminState.groupDetailTab}`;
  }

  if (window.location.pathname !== newPath) {
    window.history.pushState(null, '', newPath);
  }
}

function switchAdminTab(tabId: string) {
  adminState.activeTab = tabId;
  adminState.searchQuery = "";

  // Reset group selection when switching tabs unless we are already in groups
  if (tabId !== 'groups') {
    adminState.selectedGroupId = null;
  }

  // Visuals Reset
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.remove("bg-white/10", "bg-white/15");
  });
  document.querySelectorAll('.admin-mobile-tab-btn').forEach(btn => {
    btn.classList.remove("bg-white/10", "bg-white/15");
  });

  // Highlight Active
  document.querySelector(`.admin-tab-btn[data-tab="${tabId}"]`)?.classList.add("bg-white/15");
  document.querySelector(`.admin-mobile-tab-btn[data-tab="${tabId}"]`)?.classList.add("bg-white/15");

  updateActiveTab();
}

function updateActiveTab() {
  const container = document.getElementById("admin-tab-content-root");
  if (!container) return;

  const modalsContainer = document.getElementById("admin-modals-container");
  if (modalsContainer) modalsContainer.innerHTML = "";

  const breadcrumbEl = document.getElementById("admin-top-bar-breadcrumb");

  switch (adminState.activeTab) {
    case 'dashboard': renderDashboardTab(container); break;
    case 'members': renderMembersTab(container, modalsContainer!); break;
    case 'groups':
      if (adminState.selectedGroupId) {
        const group = MOCK_GROUPS.find(g => g.id === adminState.selectedGroupId);
        if (breadcrumbEl && group) breadcrumbEl.innerText = `Departments / ${group.name}`;
        renderGroupDetails(container, modalsContainer!);
      } else {
        if (breadcrumbEl) breadcrumbEl.innerText = 'Departments / Groups';
        renderGroupsTab(container, modalsContainer!);
      }
      break;
    case 'broadcasts': renderBroadcastsTab(container); break;
    case 'accounts': renderAccountsTab(container, modalsContainer!); break;
    case 'audit': renderAuditTab(container); break;
  }
}

function toggleAdminMobileDrawer(isOpen: boolean) {
  const drawer = document.getElementById("admin-mobile-drawer");
  if (drawer) {
    if (isOpen) drawer.classList.remove("hidden");
    else drawer.classList.add("hidden");
  }
}

function refreshBadges() {
  const membersBadge = document.getElementById("badge-total-members");
  if (membersBadge) membersBadge.innerText = MOCK_MEMBERS.length.toString();

  const groupsBadge = document.getElementById("badge-total-groups");
  if (groupsBadge) groupsBadge.innerText = MOCK_GROUPS.length.toString();

  const accountsBadge = document.getElementById("badge-total-accounts");
  if (accountsBadge) accountsBadge.innerText = MOCK_USER_PROFILES.length.toString();
}
