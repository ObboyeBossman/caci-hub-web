import { FORUM_ACTIVE_USERS, MEMBER, mockForumMessages } from '../store';
import { showToast } from '../../core/toast';

export function renderForumTab(container: HTMLElement) {
  container.innerHTML = `
    <div class="space-y-4 h-full flex flex-col">
      <div class="flex items-center justify-between shrink-0">
        <div>
          <h2 class="text-lg font-bold text-gray-900 flex items-center space-x-2">
            <i data-lucide="message-square" class="w-5 h-5 text-green-600"></i>
            <span class="ml-1">Assembly Forum</span>
          </h2>
          <p class="text-xs text-gray-500 mt-1 leading-relaxed">
            Interactive community platform. Every verified member is authorized to post, share messages, ask prayer support queries, and interact directly without structural locks.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-[460px] flex-1">
        <div class="lg:col-span-8 bg-white border border-gray-200 rounded-xl flex flex-col shadow-xs overflow-hidden">
          <div id="forum-messages-container" class="flex-1 p-4 overflow-y-auto space-y-4 max-h-[350px] bg-gray-50/50">
          </div>
          <div class="p-3 bg-white border-t border-gray-200 flex items-center gap-2 shrink-0">
            <input type="text" id="forum-text-input" placeholder="Share a word, verse, greeting or update with the assembly..." class="flex-1 border border-gray-300 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-caci-blue focus:ring-1 focus:ring-caci-blue bg-white"/>
            <button id="btn-forum-send" class="bg-caci-blue hover:bg-caci-blueDim text-white p-2.5 rounded-xl transition-all shadow-sm shrink-0">
              <i data-lucide="send" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <div class="lg:col-span-4 bg-white border border-gray-200 rounded-xl p-4 flex flex-col shadow-xs overflow-hidden">
          <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Topic & Guidelines</h4>
          <div class="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-900 leading-relaxed mb-4">
            <strong>Assembly Notice board:</strong> Ensure all discussions remain respectful and constructive. General announcements go here, while department meetings are routed into respective <strong>My Groups</strong>.
          </div>
          <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Active Forum Members</h4>
          <div id="forum-active-users-list" class="flex-1 overflow-y-auto space-y-2"></div>
        </div>
      </div>
    </div>
  `;

  renderForumActiveUsers(container);
  renderForumChatMessages(container);

  const sendBtn = container.querySelector('#btn-forum-send');
  const input = container.querySelector('#forum-text-input') as HTMLInputElement;

  const dispatch = () => {
    const text = input.value.trim();
    if (!text) return;
    const timeStr = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
    
    mockForumMessages.push({
      sender: MEMBER.full_name,
      title: "Member",
      body: text,
      time: timeStr,
      initials: "JM",
      is_self: true
    } as any);

    input.value = "";
    renderForumChatMessages(container);
    showToast("Post dispatched to Assembly Forum.", "success");
  };

  sendBtn?.addEventListener('click', dispatch);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') dispatch();
  });

  lucide.createIcons({ root: container });
}

function renderForumActiveUsers(container: HTMLElement) {
  const list = container.querySelector('#forum-active-users-list')!;
  list.innerHTML = "";

  const meItem = document.createElement("div");
  meItem.className = "flex items-center space-x-2 p-1.5 bg-green-50 rounded-lg border border-green-100";
  meItem.innerHTML = `
    <span class="relative flex h-2.5 w-2.5 shrink-0 ml-1">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
      <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
    </span>
    <div class="min-w-0">
      <p class="text-xs font-bold text-gray-950 truncate">${MEMBER.full_name} (You)</p>
      <p class="text-[9px] text-green-700 leading-none">${MEMBER.occupation}</p>
    </div>
  `;
  list.appendChild(meItem);

  FORUM_ACTIVE_USERS.forEach(usr => {
    const item = document.createElement("div");
    item.className = "flex items-center space-x-2 p-1.5 hover:bg-gray-50 rounded-lg transition-colors";
    item.innerHTML = `
      <div class="w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0 ml-1"></div>
      <div class="min-w-0">
        <p class="text-xs font-medium text-gray-800 truncate">${usr.name}</p>
        <p class="text-[9px] text-gray-400 leading-none truncate">${usr.title}</p>
      </div>
    `;
    list.appendChild(item);
  });
}

function renderForumChatMessages(container: HTMLElement) {
  const list = container.querySelector('#forum-messages-container')!;
  list.innerHTML = "";

  mockForumMessages.forEach((msg: any) => {
    const isMe = msg.is_self || msg.sender === MEMBER.full_name;
    const bubble = document.createElement("div");
    bubble.className = `flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`;

    bubble.innerHTML = `
      <span class="text-[10px] text-gray-400 mb-0.5 px-1 font-semibold flex items-center gap-1">
        <span>${msg.sender}</span>
        <span class="text-gray-500 bg-gray-100 px-1 py-0.2 rounded text-[8px] uppercase font-bold">${msg.title}</span>
      </span>
      <div class="p-3 rounded-2xl text-xs leading-relaxed ${
        isMe 
          ? 'bg-caci-blue text-white rounded-tr-none shadow-3xs' 
          : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-3xs'
      }">
        <p class="whitespace-pre-line">${msg.body}</p>
        <span class="block text-[8px] text-right mt-1.5 opacity-70">${msg.time}</span>
      </div>
    `;
    list.appendChild(bubble);
  });

  list.scrollTop = list.scrollHeight;
}
