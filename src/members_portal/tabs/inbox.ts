import { globalState, notifications, notifyStateChange, MEMBER, BIBLE_VERSES } from '../store';
import { AppEventBus } from '../home';
import { showToast } from '../../core/toast';

export function renderInboxTab(container: HTMLElement) {
  const filtered = notifications.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(globalState.searchQuery.toLowerCase()) || 
                          n.body.toLowerCase().includes(globalState.searchQuery.toLowerCase());
    const matchesStatus = globalState.statusFilter === 'all' || 
                          (globalState.statusFilter === 'unread' && !n.is_read) || 
                          (globalState.statusFilter === 'read' && n.is_read);
    return matchesSearch && matchesStatus;
  });

  const bibleVerse = BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)];

  container.innerHTML = `
    <div class="space-y-4">
      <div class="p-6 border border-[#e6edf3] bg-white rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-3xs">
        <div>
          <p class="text-xs font-bold text-caci-red uppercase tracking-widest flex items-center space-x-1">
            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
            <span class="ml-1">Christ Apostolic Church International</span>
          </p>
          <h1 class="text-2xl font-black text-gray-900 tracking-tight mt-1">
            Blessed Day, ${MEMBER.title} ${MEMBER.full_name.split(' ')[0]}!
          </h1>
          <p class="text-xs text-gray-500 mt-0.5">
            Assembly Registry Reference: <strong class="text-gray-800 font-mono">${MEMBER.membership_number}</strong>
          </p>
        </div>
        <div class="p-3 bg-amber-50/70 border border-caci-warningBg rounded-xl max-w-sm text-left shadow-2xs">
          <span class="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1">Spiritual Pill</span>
          <p class="text-xs italic text-gray-700 leading-normal">"${bibleVerse.text}"</p>
          <span class="text-[10px] font-semibold text-gray-500 block mt-1 text-right">— ${bibleVerse.ref}</span>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-900 flex items-center space-x-2">
          <i data-lucide="inbox" class="w-5 h-5 text-caci-blue"></i>
          <span class="ml-1">Home Notifications</span>
          <span class="text-xs font-normal text-gray-500 ml-1">(${filtered.length} notices found)</span>
        </h2>
        <button id="btn-mark-all-read" class="text-xs text-caci-blue hover:text-caci-blueDim font-bold transition-colors">
          Mark all as read
        </button>
      </div>

      <div id="inbox-cards-list" class="space-y-3">
        ${filtered.length === 0 ? `
          <div class="bg-white border border-[#e6edf3] rounded-2xl p-12 text-center shadow-xs">
            <div class="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <i data-lucide="inbox" class="text-caci-blue w-6 h-6"></i>
            </div>
            <h3 class="font-bold text-gray-800">Clear notification flow</h3>
            <p class="text-xs text-gray-500 max-w-sm mx-auto mt-1">
              You are completely caught up! Senders' administrative notices will appear right here when deployed.
            </p>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  const list = container.querySelector('#inbox-cards-list');
  if(list) {
    filtered.forEach(notif => {
      const wrapper = document.createElement("div");
      wrapper.className = `border rounded-xl bg-white shadow-xs transition-all ${
        notif.is_read ? 'border-gray-200 opacity-80' : 'border-l-4 border-l-caci-blue border-gray-300'
      }`;

      wrapper.innerHTML = `
        <div class="p-4 sm:p-5 flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="w-2 h-2 rounded-full ${notif.is_read ? 'bg-transparent' : 'bg-caci-blue'}"></span>
              <h3 class="text-sm font-black text-gray-950 hover:text-caci-blueDim cursor-pointer leading-tight truncate">
                ${notif.title}
              </h3>
              <span class="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold ml-auto sm:ml-0">
                ${new Date(notif.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <p class="text-xs text-gray-600 mt-2 leading-relaxed">${notif.body}</p>
            <div class="mt-4 flex items-center gap-3">
              ${notif.broadcast_id ? `
                <button data-action="view-attach" data-bid="${notif.broadcast_id}" data-nid="${notif.id}" class="text-xs text-caci-blue hover:underline font-bold flex items-center space-x-1.5">
                  <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
                  <span>Open Associated R2 Attachment</span>
                </button>
              ` : `<span class="text-[9px] text-gray-400 font-semibold uppercase italic tracking-wide">Hub System Notification</span>`}
            </div>
          </div>
          <div class="flex items-center space-x-1 shrink-0">
            <button data-action="toggle-read" data-nid="${notif.id}" class="p-1.5 rounded-lg hover:bg-gray-50 transition-colors ${notif.is_read ? 'text-gray-400' : 'text-caci-blue'}">
              <i data-lucide="mail" class="w-4 h-4"></i>
            </button>
            <button data-action="delete" data-nid="${notif.id}" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-caci-red transition-colors">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
      list.appendChild(wrapper);
    });
  }

  // Bind Events
  container.querySelector('#btn-mark-all-read')?.addEventListener('click', () => {
    notifications.forEach(n => n.is_read = true);
    showToast("Success", "All notifications marked as read", "success");
    notifyStateChange();
  });

  list?.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const action = target.dataset.action;
      const nid = target.dataset.nid;
      const notif = notifications.find(n => n.id === nid);
      
      if (!notif) return;

      if (action === 'toggle-read') {
        notif.is_read = !notif.is_read;
        showToast("Updated", `Notification marked as ${notif.is_read ? 'read' : 'unread'}`, "info");
        notifyStateChange();
      } else if (action === 'delete') {
        const index = notifications.indexOf(notif);
        if (index > -1) notifications.splice(index, 1);
        showToast("Dismissed", "Notification removed from inbox.", "info");
        notifyStateChange();
      } else if (action === 'view-attach') {
        notif.is_read = true;
        notifyStateChange();
        AppEventBus.dispatchEvent(new CustomEvent('openAttachment', { detail: target.dataset.bid }));
      }
    });
  });

  lucide.createIcons({ root: container });
}
