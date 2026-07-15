import { globalState, GROUPS, GROUP_DIRECTORY, mockChatMessages, MEMBER, notifyStateChange } from '../store';
import { AppEventBus } from '../home';
import { showToast } from '../../core/toast';

export function renderGroupsTab(container: HTMLElement) {
  container.innerHTML = `
    <div class="space-y-4 h-full flex flex-col">
      <!-- Grid View -->
      <div id="groups-grid-view" class="space-y-4 ${globalState.activeChatGroupId ? 'hidden' : ''}">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-gray-900 flex items-center space-x-2">
            <i data-lucide="users" class="w-5 h-5 text-indigo-600"></i>
            <span class="ml-1">My Enrolled Departments</span>
          </h2>
        </div>
        <p class="text-xs text-gray-500 leading-relaxed">
          Click on any department card to enter the discussion chatroom, consult assigned leaders, and inspect fellowship directory lists.
        </p>
        <div id="groups-cards-list" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
      </div>

      <!-- Chat View -->
      <div id="groups-chat-view" class="flex flex-col space-y-4 ${globalState.activeChatGroupId ? '' : 'hidden'} h-full">
        <!-- Header -->
        <div class="bg-white border border-gray-200 p-4 rounded-xl flex items-center justify-between shadow-2xs shrink-0">
          <div class="flex items-center space-x-3">
            <button id="btn-chat-back" class="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg transition-all" title="Back to Departments">
              <i data-lucide="arrow-left" class="w-4 h-4"></i>
            </button>
            <div>
              <h3 id="chat-header-group-name" class="text-base font-extrabold text-gray-900"></h3>
              <div class="flex items-center space-x-2 mt-0.5">
                <span id="chat-header-messaging-badge" class="text-[9px] font-bold px-1.5 py-0.5 rounded"></span>
                <span id="chat-header-members-count" class="text-[10px] text-gray-500 font-medium"></span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-[480px] flex-1">
          <div class="lg:col-span-8 bg-white border border-gray-200 rounded-xl flex flex-col shadow-3xs overflow-hidden">
            <div id="chat-messages-container" class="flex-1 p-4 overflow-y-auto space-y-4 max-h-[380px] bg-gray-50/50"></div>
            <div id="chat-restricted-banner" class="hidden bg-amber-50 border-t border-amber-200 p-3 flex items-center space-x-2 text-amber-800 text-xs shrink-0">
              <i data-lucide="lock" class="w-4 h-4 shrink-0 text-amber-600"></i>
              <span>This workspace is in <strong>Read-Only Broadcast</strong> mode. Only leaders and staff may publish announcements.</span>
            </div>
            <div id="chat-input-bar" class="p-3 bg-white border-t border-gray-200 flex items-center gap-2 shrink-0">
              <input type="text" id="chat-text-input" placeholder="Type a message to the group..." class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-caci-blue focus:ring-1 focus:ring-caci-blue bg-white"/>
              <button id="btn-chat-send" class="bg-caci-blue hover:bg-caci-blueDim text-white p-2.5 rounded-lg transition-all shadow-sm shrink-0">
                <i data-lucide="send" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <div class="lg:col-span-4 bg-white border border-gray-200 rounded-xl p-4 flex flex-col space-y-4 shadow-3xs overflow-hidden">
            <div>
              <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Fellowship Focus</h4>
              <p id="chat-group-description" class="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100"></p>
            </div>
            <div class="flex-1 flex flex-col overflow-hidden min-h-[220px]">
              <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Staff & Leaders</h4>
              <div id="chat-group-staff-list" class="space-y-2.5 overflow-y-auto pr-1"></div>
              <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mt-5 mb-3">Enrolled Members</h4>
              <div id="chat-group-members-list" class="flex-1 overflow-y-auto space-y-2 pr-1"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  renderGroupsGrid(container);

  if (globalState.activeChatGroupId) {
    launchChatroom(container, globalState.activeChatGroupId);
  }

  // Setup listeners
  container.querySelector('#btn-chat-back')?.addEventListener('click', () => {
    globalState.activeChatGroupId = null;
    notifyStateChange();
  });

  const sendMsg = () => dispatchChatMessage(container);
  container.querySelector('#btn-chat-send')?.addEventListener('click', sendMsg);
  container.querySelector('#chat-text-input')?.addEventListener('keydown', (e: any) => {
    if(e.key === 'Enter') sendMsg();
  });

  // Listen for open requests from quick links
  AppEventBus.addEventListener('openChat', (e: any) => {
    globalState.activeChatGroupId = e.detail;
    notifyStateChange();
  });

  lucide.createIcons({ root: container });
}

function renderGroupsGrid(container: HTMLElement) {
  const list = container.querySelector('#groups-cards-list')!;
  list.innerHTML = "";

  GROUPS.forEach(grp => {
    const card = document.createElement("div");
    card.className = "bg-white border border-[#e6edf3] p-5 rounded-xl shadow-xs flex flex-col justify-between hover:border-indigo-400 transition-all cursor-pointer hover:shadow-md";
    card.onclick = () => {
      globalState.activeChatGroupId = grp.id;
      notifyStateChange();
    };
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between">
          <span class="text-[9px] bg-indigo-50 text-indigo-700 font-black uppercase px-2 py-0.5 rounded tracking-wide">${grp.role}</span>
          <span class="text-[9px] font-bold px-2 py-0.5 rounded ${grp.messaging_mode === 'open' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}">
            ${grp.messaging_mode === 'open' ? 'Open Chatroom' : 'One-way Broadcast'}
          </span>
        </div>
        <h3 class="text-base font-extrabold text-gray-900 mt-3">${grp.name}</h3>
        <p class="text-xs text-gray-500 mt-1 leading-normal">${grp.description}</p>
      </div>
      <div class="mt-5 pt-3.5 border-t border-gray-100 flex items-center justify-between">
        <span class="text-xs font-semibold text-gray-400">ID: ${grp.id.toUpperCase()}</span>
        <span class="text-xs text-indigo-600 hover:underline font-bold flex items-center gap-1">
          <span>Open Group Hub</span>
          <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
        </span>
      </div>
    `;
    list.appendChild(card);
  });
}

function launchChatroom(container: HTMLElement, groupId: string) {
  const grp = GROUPS.find(g => g.id === groupId);
  if (!grp) return;

  container.querySelector('#chat-header-group-name')!.textContent = grp.name;
  container.querySelector('#chat-group-description')!.textContent = grp.description;
  
  const badge = container.querySelector('#chat-header-messaging-badge')!;
  badge.textContent = grp.messaging_mode === 'open' ? 'Open Community Chat' : 'Protected Broadcast Mode';
  
  if (grp.messaging_mode === 'open') {
    badge.className = "text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-800 uppercase tracking-wider";
    container.querySelector('#chat-restricted-banner')!.classList.add("hidden");
    container.querySelector('#chat-input-bar')!.classList.remove("hidden");
  } else {
    badge.className = "text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase tracking-wider";
    container.querySelector('#chat-restricted-banner')!.classList.remove("hidden");
    container.querySelector('#chat-input-bar')!.classList.add("hidden");
  }

  const directory = GROUP_DIRECTORY[groupId] || { staff: [], members: [] };
  container.querySelector('#chat-header-members-count')!.textContent = `${directory.members.length + directory.staff.length} enrolled users`;

  // Staff
  const staffList = container.querySelector('#chat-group-staff-list')!;
  staffList.innerHTML = "";
  directory.staff.forEach((person: any) => {
    const item = document.createElement("div");
    item.className = "flex items-center space-x-3 bg-gray-50/70 p-2 rounded-lg border border-gray-150";
    item.innerHTML = `
      <img src="${person.photo}" alt="${person.name}" class="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-300">
      <div class="min-w-0">
        <h5 class="text-xs font-bold text-gray-900 truncate">${person.name}</h5>
        <div class="flex items-center space-x-1">
          <span class="text-[9px] text-indigo-700 bg-indigo-50 font-bold px-1 py-0.1 rounded shrink-0">${person.role}</span>
          <span class="text-[10px] text-gray-400 truncate">${person.title}</span>
        </div>
      </div>
    `;
    staffList.appendChild(item);
  });

  // Members
  const membersList = container.querySelector('#chat-group-members-list')!;
  membersList.innerHTML = "";
  directory.members.forEach((member: any) => {
    const item = document.createElement("div");
    item.className = "flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors";
    item.innerHTML = `
      <div class="flex items-center space-x-2.5 min-w-0">
        <div class="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-[10px] shrink-0">
          ${member.name.split(' ').map((n:any)=>n[0]).join('').substring(0, 2)}
        </div>
        <div class="min-w-0">
          <p class="text-xs font-semibold text-gray-800 truncate">${member.name}</p>
          <p class="text-[10px] text-gray-400 truncate">${member.title}</p>
        </div>
      </div>
    `;
    membersList.appendChild(item);
  });

  renderChatMessages(container);
}

function renderChatMessages(container: HTMLElement) {
  if (!globalState.activeChatGroupId) return;
  const messages = mockChatMessages[globalState.activeChatGroupId] || [];
  const list = container.querySelector('#chat-messages-container')!;
  list.innerHTML = "";

  if (messages.length === 0) {
    list.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center py-10 text-center">
        <i data-lucide="message-square" class="w-10 h-10 text-gray-300 mb-2"></i>
        <p class="text-xs text-gray-500 font-medium">No messages posted in this channel yet.</p>
      </div>
    `;
    return;
  }

  messages.forEach(msg => {
    const bubble = document.createElement("div");
    bubble.className = `flex flex-col max-w-[85%] ${msg.is_self ? 'ml-auto items-end' : 'mr-auto items-start'}`;
    bubble.innerHTML = `
      <span class="text-[10px] text-gray-400 mb-0.5 px-1 font-semibold">
        ${msg.sender} <span class="text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded font-bold ml-1 text-[8px] uppercase">${msg.sender_role}</span>
      </span>
      <div class="p-3 rounded-2xl text-xs leading-relaxed ${
        msg.is_self ? 'bg-caci-blue text-white rounded-tr-none shadow-3xs' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-3xs'
      }">
        <p class="whitespace-pre-line">${msg.body}</p>
        <span class="block text-[8px] text-right mt-1.5 opacity-70">${msg.time}</span>
      </div>
    `;
    list.appendChild(bubble);
  });
  list.scrollTop = list.scrollHeight;
}

function dispatchChatMessage(container: HTMLElement) {
  const input = container.querySelector('#chat-text-input') as HTMLInputElement;
  const text = input.value.trim();
  if (!text || !globalState.activeChatGroupId) return;

  const group = GROUPS.find(g => g.id === globalState.activeChatGroupId);
  if (group && group.messaging_mode === 'restricted') {
    showToast("🔒 Unauthorized. Messaging access is restricted to Leaders.", "error");
    return;
  }

  const timeStr = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
  mockChatMessages[globalState.activeChatGroupId].push({
    sender: MEMBER.full_name,
    sender_role: "Member",
    body: text,
    time: timeStr,
    is_self: true
  });

  input.value = "";
  renderChatMessages(container);
}
