// src/members_portal/home.ts

import { Session } from '@supabase/supabase-js';
import { supabase } from '../core/supabase';
import { showToast } from '../core/toast';
import { globalState, MEMBER, BROADCASTS, GROUPS, notifications, notifyStateChange, subscribe, syncMemberData } from './store';
import { renderAdminHome } from '../admin_portal/home';
import { showSwitchPortalModal, showSignOutModal } from '../core/PortalModal';

import { renderInboxTab } from './tabs/inbox';
import { renderBroadcastsTab } from './tabs/broadcasts';
import { renderSermonsTab } from './tabs/sermons';
import { renderForumTab } from './tabs/forum';
import { renderGroupsTab } from './tabs/groups';
import { renderProfileTab } from './tabs/profile';
import { renderSettingsTab } from './tabs/settings';

// Create a simple custom event bus for cross-tab communication
export const AppEventBus = new EventTarget();

// Stored session reference for portal switching
let _currentSession: Session | null = null;

export async function renderMembersHome(app: HTMLElement, session: Session): Promise<void> {
  console.log('[members-home] Initializing...');
  _currentSession = session;

  try {
    // Sync member data from Supabase before rendering the shell
    await syncMemberData(session.user.id);
    console.log('[members-home] Data sync complete');

    app.id = 'mp-root';
    app.innerHTML = buildShellHtml();

    attachShellHandlers();

    // Initial render
    updateActiveTab();

    // Trigger initial tab
    switchTab('inbox');

    // Re-render when state changes
    subscribe(() => {
      updateActiveTab();
      refreshBadgeCounts();
    });

    refreshBadgeCounts();
    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (err: any) {
    console.error('[members-home] Render failed:', err);
    throw err; // Let guardRoute catch it and show a toast
  }
}

function buildShellHtml() {
  const name = MEMBER?.full_name || 'Member';
  const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const firstName = name.split(' ')[0];

  return `
    <style>
      .transition-tab { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: #f6f8fa; }
      ::-webkit-scrollbar-thumb { background: #c9d1d9; border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: #8b949e; }
    </style>

    <!-- Mobile Top Header -->
    <header class="bg-caci-blue text-white py-3.5 px-4 flex items-center justify-between shadow-md lg:hidden sticky top-0 z-40">
      <div class="flex items-center space-x-3">
        <div class="w-9 h-9 bg-white rounded-full flex items-center justify-center border-2 border-caci-red overflow-hidden shadow-sm">
          <span class="font-extrabold text-[10px] text-caci-blue">CACI</span>
        </div>
        <div>
          <h1 class="font-black text-sm tracking-wide">CACI HUB</h1>
          <span class="text-[9px] text-blue-200 uppercase tracking-widest block font-bold leading-none">Member Portal</span>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <button id="mobile-btn-bell" class="relative p-2 text-white hover:bg-caci-blueDim rounded-full transition-colors">
          <i data-lucide="bell" class="w-5.5 h-5.5"></i>
          <span id="mobile-unread-dot" class="hidden absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-caci-red rounded-full border border-white"></span>
        </button>
        <button id="mobile-btn-menu" class="p-2 text-white hover:bg-caci-blueDim rounded-md transition-colors">
          <i data-lucide="menu" class="w-6 h-6"></i>
        </button>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden h-full">
      <!-- Desktop Sidebar -->
      <aside class="hidden lg:flex flex-col w-64 bg-caci-blue text-white shrink-0 h-full justify-between">
        <div class="flex flex-col">
          <div class="p-6 border-b border-white/10 flex items-center space-x-3">
            <div class="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center border border-white/20 relative overflow-hidden shrink-0">
              <img src="/caci-logo.jpeg" alt="CACI Logo" class="w-full h-full object-cover">
            </div>
            <div>
              <h2 class="font-black text-base uppercase tracking-wider leading-none text-white">
                CACI <span class="text-caci-redLight">Hub</span>
              </h2>
              <p class="text-[10px] text-blue-200 mt-1 font-medium tracking-wide">Member Portal</p>
            </div>
          </div>
          <nav class="p-4 space-y-6 overflow-y-auto">
            <div class="space-y-1.5">
              <p class="text-[10px] uppercase font-bold text-blue-300/70 px-3 tracking-widest">Main</p>
              <button data-tab="inbox" class="tab-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-tab text-white/80 hover:bg-white/10 hover:text-white">
                <div class="flex items-center space-x-3"><i data-lucide="home" class="w-4.5 h-4.5"></i><span>Home</span></div>
                <span id="badge-unread-count" class="hidden bg-caci-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">0</span>
              </button>
              <button data-tab="broadcasts" class="tab-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-tab text-white/80 hover:bg-white/10 hover:text-white">
                <div class="flex items-center space-x-3"><i data-lucide="megaphone" class="w-4.5 h-4.5"></i><span>Announcements</span></div>
                <span id="badge-broadcast-count" class="bg-caci-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">0</span>
              </button>
              <button data-tab="sermons" class="tab-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-tab text-white/80 hover:bg-white/10 hover:text-white">
                <div class="flex items-center space-x-3"><i data-lucide="headphones" class="w-4.5 h-4.5"></i><span>Sermons</span></div>
                <span class="bg-green-500 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm tracking-wide">New</span>
              </button>
              <button data-tab="forum" class="tab-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-tab text-white/80 hover:bg-white/10 hover:text-white">
                <div class="flex items-center space-x-3"><i data-lucide="message-square" class="w-4.5 h-4.5"></i><span>Assembly Forum</span></div>
                <span class="bg-green-500 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm tracking-wide">Live</span>
              </button>
              <button data-tab="groups" class="tab-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-tab text-white/80 hover:bg-white/10 hover:text-white">
                <div class="flex items-center space-x-3"><i data-lucide="users" class="w-4.5 h-4.5"></i><span>My Groups</span></div>
                <span id="badge-groups-count" class="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">0</span>
              </button>
            </div>
            <div class="space-y-1.5">
              <p class="text-[10px] uppercase font-bold text-blue-300/70 px-3 tracking-widest">Account</p>
              <button data-tab="profile" class="tab-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-tab text-white/80 hover:bg-white/10 hover:text-white">
                <div class="flex items-center space-x-3"><i data-lucide="user" class="w-4.5 h-4.5"></i><span>My Profile</span></div>
              </button>
              <button data-tab="settings" class="tab-btn w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-tab text-white/80 hover:bg-white/10 hover:text-white">
                <div class="flex items-center space-x-3"><i data-lucide="settings" class="w-4.5 h-4.5"></i><span>Settings</span></div>
              </button>
            </div>
          </nav>
        </div>
        <div class="p-3 border-t border-white/10 mt-auto">
          <button id="btn-switch-to-admin" class="w-full flex items-center space-x-2 px-3 py-2 mb-2.5 text-xs font-semibold text-white/85 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
            <i data-lucide="arrow-left-right" class="w-3.5 h-3.5 shrink-0"></i><span>Switch to Admin Portal</span>
          </button>
          <div class="group flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-full p-1 transition-all shadow-md shadow-black/20 cursor-default">
            <div class="flex items-center space-x-3 min-w-0">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center shrink-0 shadow-sm shadow-black/30 relative overflow-hidden">
                <span class="font-extrabold text-[11px] text-white uppercase tracking-wider">${initials}</span>
              </div>
              <div class="flex flex-col justify-center min-w-0 py-0.5">
                <span class="text-[11.5px] font-bold text-white truncate leading-tight tracking-wide">${name}</span>
                <span class="text-[8.5px] text-blue-200/70 truncate leading-tight uppercase font-extrabold tracking-widest mt-0.5">Member</span>
              </div>
            </div>
            <button id="btn-logout" title="Sign Out" class="w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-caci-red transition-all shrink-0 mr-0.5">
              <i data-lucide="log-out" class="w-3.5 h-3.5 ml-0.5"></i>
            </button>
          </div>
        </div>
      </aside>

      <!-- Mobile Drawer -->
      <div id="mobile-drawer" class="fixed inset-0 z-50 flex lg:hidden hidden" role="dialog" aria-modal="true">
        <div id="mobile-drawer-backdrop" class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"></div>
        <div class="relative flex flex-col w-4/5 max-w-xs bg-caci-blue text-white h-full shadow-2xl transition-transform transform duration-300 translate-x-0">
          <div class="p-5 border-b border-white/10">
            <div class="flex justify-between items-start">
              <div class="flex items-center space-x-3">
                <div class="w-9 h-9 bg-white rounded-full flex items-center justify-center border-2 border-caci-red shrink-0">
                  <span class="font-bold text-xs text-caci-blue">CACI</span>
                </div>
                <div>
                  <h3 class="font-extrabold text-sm tracking-wide text-white">CACI Hub</h3>
                  <p class="text-[10px] text-blue-200 leading-none mt-0.5">Adabraka Assembly</p>
                </div>
              </div>
              <button id="mobile-btn-close-drawer" class="text-white/85 hover:text-white p-1 rounded-md"><i data-lucide="x" class="w-5.5 h-5.5"></i></button>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-6">
            <div class="space-y-1">
              <p class="text-[10px] uppercase font-black text-blue-300/70 px-3 mb-2 tracking-widest">Main Menu</p>
              <button data-tab="inbox" class="mobile-tab-btn w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-white/80 hover:bg-white/10">
                <div class="flex items-center space-x-3"><i data-lucide="home" class="w-5 h-5"></i><span>Home</span></div>
                <span id="mobile-unread-badge" class="bg-caci-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full">0</span>
              </button>
              <button data-tab="broadcasts" class="mobile-tab-btn w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-white/80 hover:bg-white/10">
                <div class="flex items-center space-x-3"><i data-lucide="megaphone" class="w-5 h-5"></i><span>Announcements</span></div>
              </button>
              <button data-tab="sermons" class="mobile-tab-btn w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-white/80 hover:bg-white/10">
                <div class="flex items-center space-x-3"><i data-lucide="headphones" class="w-5 h-5"></i><span>Sermons</span></div>
              </button>
              <button data-tab="forum" class="mobile-tab-btn w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-white/80 hover:bg-white/10">
                <div class="flex items-center space-x-3"><i data-lucide="message-square" class="w-5 h-5"></i><span>Assembly Forum</span></div>
              </button>
              <button data-tab="groups" class="mobile-tab-btn w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-white/80 hover:bg-white/10">
                <div class="flex items-center space-x-3"><i data-lucide="users" class="w-5 h-5"></i><span>My Groups</span></div>
              </button>
            </div>
            <div class="space-y-1">
              <p class="text-[10px] uppercase font-black text-blue-300/70 px-3 mb-2 tracking-widest">Account</p>
              <button data-tab="profile" class="mobile-tab-btn w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-white/80 hover:bg-white/10">
                <div class="flex items-center space-x-3"><i data-lucide="user" class="w-5 h-5"></i><span>My Profile</span></div>
              </button>
              <button data-tab="settings" class="mobile-tab-btn w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold text-white/80 hover:bg-white/10">
                <div class="flex items-center space-x-3"><i data-lucide="settings" class="w-5 h-5"></i><span>Settings</span></div>
              </button>
            </div>
          </div>
          <div class="p-4 border-t border-white/10 bg-black/15 flex items-center justify-between">
            <button id="mobile-btn-switch-to-admin" class="flex items-center space-x-1.5 text-xs text-white/80 hover:text-white font-bold">
              <i data-lucide="arrow-left-right" class="w-4 h-4"></i><span>Admin Portal</span>
            </button>
            <button id="mobile-btn-logout" class="flex items-center space-x-1 text-xs text-caci-redLight font-bold">
              <i data-lucide="log-out" class="w-4 h-4"></i><span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Action Workspace -->
      <main class="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div class="h-14 bg-white border-b border-[#e6edf3] px-6 flex items-center justify-between shrink-0 shadow-3xs">
          <div class="flex items-center space-x-2 text-xs font-semibold text-gray-500">
            <span class="text-caci-blue uppercase tracking-widest font-bold">Workspace</span>
            <span class="text-gray-300">/</span>
            <span id="top-bar-breadcrumb" class="text-gray-800 capitalize font-bold">Home</span>
          </div>
          <div class="flex items-center space-x-4">
            <span class="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-caci-blue border border-blue-100 font-mono">
              ID: ${MEMBER?.membership_number || '---'}
            </span>
            <div class="h-4 w-[1px] bg-gray-200 hidden sm:block"></div>
            <span class="text-xs text-gray-500 font-medium" id="top-bar-date-display"></span>
          </div>
        </div>
        
        <div class="bg-white border-b border-[#e6edf3] px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div class="relative flex-1 max-w-md">
            <i data-lucide="search" class="absolute left-3 top-2.5 h-4 w-4 text-gray-400"></i>
            <input type="text" id="global-search-input" placeholder="Search..." class="w-full pl-9 pr-4 py-2 border border-[#c9d1d9] rounded-lg text-sm bg-white focus:outline-none focus:border-caci-blue focus:ring-1 focus:ring-caci-blue placeholder:text-gray-400 transition-all"/>
          </div>
          <div class="flex items-center space-x-2.5 overflow-x-auto self-start md:self-auto pb-1 md:pb-0">
            <i data-lucide="filter" class="w-4 h-4 text-gray-400 shrink-0"></i>
            <span class="text-xs text-gray-500 font-medium shrink-0">Filters:</span>
            <div id="filter-pills-container" class="flex space-x-1 shrink-0"></div>
          </div>
        </div>

        <div class="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-6 p-6 overflow-y-auto">
          <!-- Left Content -->
          <div class="xl:col-span-8 space-y-6" id="tab-content-root">
            <!-- Dynamic tab content renders here -->
          </div>
          
          <!-- Right Sidebar -->
          <aside class="xl:col-span-4 space-y-6">
            <div class="bg-white border border-[#e6edf3] rounded-2xl p-5 shadow-xs">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Forum Update</h3>
                <span class="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span>
              </div>
              <div class="bg-green-50/50 rounded-xl p-3 border border-green-100 space-y-2">
                <p class="text-xs font-semibold text-green-950 leading-relaxed">
                  Connect and share instantly with all church members globally inside the general open Assembly Forum chatroom.
                </p>
                <button id="btn-enter-forum" class="text-[11px] font-bold text-green-700 hover:underline flex items-center space-x-1">
                  <span>Enter Public Forum Chat</span>
                  <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <div class="bg-white border border-[#e6edf3] rounded-2xl p-5 shadow-xs">
              <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Enrolled Fellowships</h3>
              <div id="quick-groups-list" class="space-y-3"></div>
              <button id="btn-manage-groups" class="mt-4 w-full text-center text-xs text-caci-blue hover:text-caci-blueDim font-bold block transition-colors">
                Manage Enrolled Ministries &rarr;
              </button>
            </div>

            <div class="bg-amber-50 border border-caci-warningBg rounded-2xl p-5 shadow-2xs space-y-3">
              <div class="flex items-center space-x-2 text-amber-900">
                <i data-lucide="info" class="w-4.5 h-4.5 shrink-0"></i>
                <h4 class="text-xs font-bold uppercase tracking-wider">Security Architecture Notice</h4>
              </div>
              <p class="text-[11px] text-amber-800 leading-relaxed">
                Notice: All profile edits require strict logging onto the <code class="bg-amber-100 px-1 rounded text-red-700">member_audit_log</code> table automatically. System backups occur daily.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
    
    <!-- Attachment Modal -->
    <div id="attachment-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 hidden" role="dialog" aria-modal="true">
      <div id="attachment-modal-backdrop" class="fixed inset-0 bg-black/60 transition-opacity"></div>
      <div class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform scale-100 transition-all">
        <div class="p-5 border-b border-gray-150 bg-gradient-to-r from-caci-blue to-caci-blueDim text-white flex justify-between items-center">
          <div>
            <span class="text-[9px] bg-caci-red px-2.5 py-0.5 rounded text-white uppercase font-black tracking-widest">Document Attachment</span>
            <h3 id="modal-filename" class="font-extrabold text-sm truncate mt-1 leading-none"></h3>
          </div>
          <button id="modal-close-btn" class="text-white hover:bg-caci-blueDim p-1 rounded-lg transition-colors"><i data-lucide="x" class="w-5 h-5"></i></button>
        </div>
        <div class="p-6 space-y-4">
          <div class="flex items-center space-x-3 bg-blue-50 p-3.5 rounded-xl border border-blue-100">
            <i data-lucide="file-text" class="w-8 h-8 text-caci-blue shrink-0"></i>
            <div class="overflow-hidden">
              <p id="modal-desc-filename" class="text-xs font-bold text-gray-800 truncate"></p>
              <p class="text-[10px] text-gray-500 uppercase font-semibold">Authentic Document Preview</p>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Announcement Content Context</label>
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 max-h-32 overflow-y-auto">
              <h4 id="modal-broadcast-title" class="text-xs font-bold text-gray-900 mb-1"></h4>
              <p id="modal-broadcast-body" class="text-xs text-gray-600 whitespace-pre-line leading-relaxed"></p>
            </div>
          </div>
          <div class="bg-gray-50 p-4 rounded-xl flex flex-col items-center justify-center py-6 border border-dashed border-gray-200">
            <div id="modal-attachment-placeholder" class="text-center"></div>
          </div>
        </div>
        <div class="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end space-x-2.5">
          <button id="modal-btn-cancel" class="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors">Close Preview</button>
          <button id="modal-btn-download" class="px-4 py-2 bg-caci-blue hover:bg-caci-blueDim text-white rounded-xl text-xs font-bold transition-colors shadow-xs">Download File</button>
        </div>
      </div>
    </div>
  `;
}

function attachShellHandlers() {
  const options = { weekday: 'long' as const, year: 'numeric' as const, month: 'long' as const, day: 'numeric' as const };
  const dateEl = document.getElementById("top-bar-date-display");
  if (dateEl) dateEl.innerText = new Date().toLocaleDateString(undefined, options);

  // Search input
  const searchInput = document.getElementById("global-search-input") as HTMLInputElement;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      globalState.searchQuery = (e.target as HTMLInputElement).value;
      notifyStateChange();
    });
  }

  // Tab switching desktop
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab((btn as HTMLElement).dataset.tab!);
    });
  });

  // Tab switching mobile
  document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab((btn as HTMLElement).dataset.tab!);
      toggleMobileDrawer(false);
    });
  });

  // Mobile drawer controls
  document.getElementById("mobile-btn-menu")?.addEventListener("click", () => toggleMobileDrawer(true));
  document.getElementById("mobile-btn-close-drawer")?.addEventListener("click", () => toggleMobileDrawer(false));
  document.getElementById("mobile-drawer-backdrop")?.addEventListener("click", () => toggleMobileDrawer(false));

  // Side bar links
  document.getElementById("btn-enter-forum")?.addEventListener("click", () => switchTab("forum"));
  document.getElementById("btn-manage-groups")?.addEventListener("click", () => switchTab("groups"));

  // Switch to Admin Portal (no sign-out)
  const handleSwitchToAdmin = () => {
    const initials = MEMBER.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    showSwitchPortalModal({
      targetLabel: 'Admin Portal',
      userName: MEMBER.full_name,
      userRole: `${MEMBER.title || ''} · ${MEMBER.membership_number}`.trim(),
      initials,
      onConfirm: async () => {
        const app = document.getElementById('app') ?? document.body;
        await renderAdminHome(app as HTMLElement, _currentSession!);
      }
    });
  };
  document.getElementById('btn-switch-to-admin')?.addEventListener('click', handleSwitchToAdmin);
  document.getElementById('mobile-btn-switch-to-admin')?.addEventListener('click', handleSwitchToAdmin);

  // Logout
  const handleLogout = () => {
    const name = MEMBER?.full_name || 'Member';
    const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
    showSignOutModal({
      userName: name,
      userRole: `Member · ${MEMBER.membership_number}`,
      initials,
      onConfirm: async () => {
        await supabase.auth.signOut();
        window.location.reload();
      }
    });
  };
  document.getElementById("btn-logout")?.addEventListener("click", handleLogout);
  document.getElementById("mobile-btn-logout")?.addEventListener("click", handleLogout);

  // Quick groups rendering
  renderQuickMinistries();
  
  // Custom Events listener
  AppEventBus.addEventListener('openAttachment', (e: any) => openAttachmentModalDirectly(e.detail));
}

function switchTab(tabId: string) {
  globalState.activeTab = tabId;
  globalState.searchQuery = "";
  
  const searchInput = document.getElementById("global-search-input") as HTMLInputElement;
  if(searchInput) searchInput.value = "";

  const breadcrumbLabelMap: Record<string, string> = {
    'inbox': 'Home',
    'broadcasts': 'Announcements',
    'sermons': 'Sermons',
    'forum': 'Assembly Forum',
    'groups': 'My Groups',
    'profile': 'My Profile',
    'settings': 'Settings'
  };
  const label = breadcrumbLabelMap[tabId] || tabId;
  const breadcrumbElement = document.getElementById("top-bar-breadcrumb");
  if (breadcrumbElement) breadcrumbElement.innerText = label;

  // Reset tab UI
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove("bg-white/15", "text-white");
    btn.classList.add("text-white/80", "hover:bg-white/10", "hover:text-white");
  });
  document.querySelectorAll('.mobile-tab-btn').forEach(btn => btn.classList.remove("bg-white/15", "text-white"));

  // Highlight active
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`)?.classList.add("bg-white/15", "text-white");
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`)?.classList.remove("text-white/80", "hover:bg-white/10", "hover:text-white");
  document.querySelector(`.mobile-tab-btn[data-tab="${tabId}"]`)?.classList.add("bg-white/15", "text-white");

  updateActiveTab();
}

function updateActiveTab() {
  const container = document.getElementById("tab-content-root");
  if(!container) return;

  renderFilterPills();

  switch (globalState.activeTab) {
    case 'inbox': renderInboxTab(container); break;
    case 'broadcasts': renderBroadcastsTab(container); break;
    case 'sermons': renderSermonsTab(container); break;
    case 'forum': renderForumTab(container); break;
    case 'groups': renderGroupsTab(container); break;
    case 'profile': renderProfileTab(container); break;
    case 'settings': renderSettingsTab(container); break;
  }
}

function toggleMobileDrawer(isOpen: boolean) {
  const drawer = document.getElementById("mobile-drawer");
  if(drawer) {
    if (isOpen) drawer.classList.remove("hidden");
    else drawer.classList.add("hidden");
  }
}

function renderFilterPills() {
  const filterContainer = document.getElementById("filter-pills-container");
  if(!filterContainer) return;
  filterContainer.innerHTML = "";

  if (globalState.activeTab === 'inbox') {
    const statuses = ['all', 'unread', 'read'];
    statuses.forEach(opt => {
      const btn = document.createElement("button");
      btn.className = `px-2.5 py-1 rounded-md text-xs capitalize transition-colors ${
        globalState.statusFilter === opt 
          ? 'bg-caci-blue text-white font-semibold shadow-2xs' 
          : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
      }`;
      btn.innerText = opt;
      btn.onclick = () => {
        globalState.statusFilter = opt;
        notifyStateChange();
      };
      filterContainer.appendChild(btn);
    });
  } else if (globalState.activeTab === 'broadcasts') {
    const options = ['all', 'assembly', 'group'];
    options.forEach(opt => {
      const btn = document.createElement("button");
      btn.className = `px-2.5 py-1 rounded-md text-xs capitalize transition-colors ${
        globalState.broadcastFilter === opt 
          ? 'bg-caci-blue text-white font-semibold shadow-2xs' 
          : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
      }`;
      btn.innerText = opt === 'all' ? 'All' : opt === 'assembly' ? 'Assembly Wide' : 'Group Modules';
      btn.onclick = () => {
        globalState.broadcastFilter = opt;
        notifyStateChange();
      };
      filterContainer.appendChild(btn);
    });
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "text-xs text-gray-400 italic";
    placeholder.innerText = "General Scope";
    filterContainer.appendChild(placeholder);
  }
}

function refreshBadgeCounts() {
  const unreadCount = notifications.filter(n => !n.is_read).length;
  
  const unreadBadge = document.getElementById("badge-unread-count");
  if (unreadBadge) {
    unreadBadge.innerText = unreadCount.toString();
    if(unreadCount > 0) unreadBadge.classList.remove("hidden");
    else unreadBadge.classList.add("hidden");
  }

  const mobileDot = document.getElementById("mobile-unread-dot");
  if (mobileDot) {
    if(unreadCount > 0) mobileDot.classList.remove("hidden");
    else mobileDot.classList.add("hidden");
  }

  const mobileUnreadBadge = document.getElementById("mobile-unread-badge");
  if (mobileUnreadBadge) {
    mobileUnreadBadge.innerText = unreadCount.toString();
    if(unreadCount > 0) mobileUnreadBadge.classList.remove("hidden");
    else mobileUnreadBadge.classList.add("hidden");
  }

  const broadcastBadge = document.getElementById("badge-broadcast-count");
  if (broadcastBadge) broadcastBadge.innerText = BROADCASTS.length.toString();

  const groupsBadge = document.getElementById("badge-groups-count");
  if (groupsBadge) groupsBadge.innerText = GROUPS.length.toString();
}

function renderQuickMinistries() {
  const container = document.getElementById("quick-groups-list");
  if(!container) return;
  container.innerHTML = "";
  
  GROUPS.slice(0, 2).forEach(g => {
    const item = document.createElement("div");
    item.className = "flex items-center justify-between p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer";
    item.onclick = () => {
      switchTab('groups');
      // trigger chat view
      setTimeout(() => AppEventBus.dispatchEvent(new CustomEvent('openChat', { detail: g.id })), 100);
    };
    item.innerHTML = `
      <div class="flex items-center space-x-3 min-w-0">
        <div class="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
          <i data-lucide="users" class="w-4 h-4 text-caci-blue"></i>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-bold text-gray-800 leading-none truncate">${g.name}</p>
          <span class="text-[10px] text-gray-500">${g.role}</span>
        </div>
      </div>
      <span class="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
        g.messaging_mode === 'open' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
      }">${g.messaging_mode}</span>
    `;
    container.appendChild(item);
  });
}

function openAttachmentModalDirectly(broadcastId: string) {
  const bc = BROADCASTS.find(b => b.id === broadcastId);
  if (!bc) {
    showToast("Error", "Broadcast parent details were soft deleted.", "error");
    return;
  }
  globalState.currentSelectedBroadcast = bc;
  
  const fileUrl = bc.attachment_url || "";
  let fileName = fileUrl;
  try {
    const urlParts = fileUrl.split('/');
    fileName = urlParts[urlParts.length - 1].split('?')[0]; // basic extraction
  } catch(e) {}

  document.getElementById("modal-filename")!.innerText = fileName;
  document.getElementById("modal-desc-filename")!.innerText = fileName;
  document.getElementById("modal-broadcast-title")!.innerText = bc.title;
  document.getElementById("modal-broadcast-body")!.innerText = bc.body;

  const placeholder = document.getElementById("modal-attachment-placeholder");
  if(placeholder) {
    const lowerUrl = fileUrl.toLowerCase();
    const isImage = lowerUrl.includes('.png') || lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg') || lowerUrl.includes('.gif') || lowerUrl.includes('.webp');
    
    if (isImage) {
      placeholder.innerHTML = `
        <img src="${fileUrl}" class="max-w-full h-auto max-h-48 object-contain rounded-lg border border-gray-200 mb-2" alt="Attachment" />
        <span class="text-xs font-bold text-gray-700 block">${fileName}</span>
      `;
    } else {
      placeholder.innerHTML = `
        <i data-lucide="file-text" class="w-12 h-12 text-caci-blue mx-auto mb-2"></i>
        <span class="text-xs font-bold text-gray-700 block">${fileName}</span>
        <a href="${fileUrl}" target="_blank" class="text-[10px] text-caci-blue font-bold hover:underline mt-1 inline-block">Click here to open document</a>
      `;
    }
  }
  document.getElementById("attachment-modal")?.classList.remove("hidden");
  if (window.lucide) {
    window.lucide.createIcons();
  }

  const close = () => {
    document.getElementById("attachment-modal")?.classList.add("hidden");
    globalState.currentSelectedBroadcast = null;
  };
  const closeBtn = document.getElementById("modal-close-btn");
  if (closeBtn) closeBtn.onclick = close;
  
  const cancelBtn = document.getElementById("modal-btn-cancel");
  if (cancelBtn) cancelBtn.onclick = close;

  const backdrop = document.getElementById("attachment-modal-backdrop");
  if (backdrop) backdrop.onclick = close;

  const downloadBtn = document.getElementById("modal-btn-download");
  if (downloadBtn) {
    downloadBtn.onclick = () => {
      window.open(fileUrl, '_blank');
      close();
    };
  }
}

declare global {
  interface Window {
    lucide: any;
  }
}
