import { globalState, MOCK_BROADCASTS, MOCK_GROUPS } from '../store';
import { AppEventBus } from '../home';

export function renderBroadcastsTab(container: HTMLElement) {
  const filtered = MOCK_BROADCASTS.filter(bc => {
    const matchesSearch = bc.title.toLowerCase().includes(globalState.searchQuery.toLowerCase()) || 
                          bc.body.toLowerCase().includes(globalState.searchQuery.toLowerCase());
    const matchesType = globalState.broadcastFilter === 'all' || 
                        (globalState.broadcastFilter === 'assembly' && bc.targeting_mode === 'assembly') || 
                        (globalState.broadcastFilter === 'group' && bc.targeting_mode === 'group');
    return matchesSearch && matchesType;
  });

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-900 flex items-center space-x-2">
          <i data-lucide="megaphone" class="w-5 h-5 text-caci-red"></i>
          <span class="ml-1">Church Announcements</span>
        </h2>
      </div>
      <div id="broadcasts-cards-list" class="space-y-4"></div>
    </div>
  `;

  const list = container.querySelector('#broadcasts-cards-list')!;

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="bg-white border border-[#e6edf3] rounded-2xl p-12 text-center shadow-xs">
        <div class="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <i data-lucide="file-text" class="text-caci-red w-6 h-6"></i>
        </div>
        <h3 class="font-bold text-gray-800">No broadcasts found</h3>
        <p class="text-xs text-gray-500 max-w-sm mx-auto mt-1">Adjust your filter rules or search strings.</p>
      </div>
    `;
    lucide.createIcons({ root: container });
    return;
  }

  filtered.forEach(bc => {
    const groupName = bc.target_group_id ? MOCK_GROUPS.find(g => g.id === bc.target_group_id)?.name : null;
    const isAssembly = bc.targeting_mode === 'assembly';

    const card = document.createElement("div");
    card.className = "bg-white border border-gray-200 rounded-xl shadow-xs hover:border-gray-300 transition-all overflow-hidden";
    card.innerHTML = `
      <div class="p-5">
        <div class="flex items-start justify-between flex-wrap gap-2">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                isAssembly ? 'bg-red-50 text-caci-red' : 'bg-blue-50 text-caci-blue'
              }">
                ${isAssembly ? 'Assembly Wide' : `Group Module: ${groupName || 'Department'}`}
              </span>
              <span class="text-xs text-gray-400 font-semibold">
                ${new Date(bc.sent_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h3 class="text-base font-extrabold text-gray-900 mt-2.5 leading-snug">${bc.title}</h3>
          </div>
        </div>
        <p class="text-xs text-gray-700 whitespace-pre-line mt-3.5 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">${bc.body}</p>
        <div class="mt-4 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-100">
          <div class="flex items-center space-x-1.5 text-xs text-gray-500">
            <span class="font-bold text-gray-700">Issued by:</span>
            <span>${bc.sent_by}</span>
          </div>
          ${bc.attachment_url ? `
            <button data-action="preview" data-id="${bc.id}" class="inline-flex items-center space-x-1.5 text-xs font-bold text-white bg-caci-blue hover:bg-caci-blueDim px-3.5 py-2 rounded-xl transition-colors shadow-xs">
              <i data-lucide="file-text" class="w-4 h-4"></i>
              <span>Preview File Attachment</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('button[data-action="preview"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      AppEventBus.dispatchEvent(new CustomEvent('openAttachment', { detail: target.dataset.id }));
    });
  });

  lucide.createIcons({ root: container });
}
