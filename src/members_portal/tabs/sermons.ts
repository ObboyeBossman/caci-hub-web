import { globalState, SERMONS } from '../store';
import { showToast } from '../../core/toast';

export function renderSermonsTab(container: HTMLElement) {
  const filtered = SERMONS.filter(s => {
    return s.title.toLowerCase().includes(globalState.searchQuery.toLowerCase()) || 
           s.speaker.toLowerCase().includes(globalState.searchQuery.toLowerCase()) || 
           s.passage.toLowerCase().includes(globalState.searchQuery.toLowerCase());
  });

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-900 flex items-center space-x-2">
            <i data-lucide="headphones" class="w-5 h-5 text-indigo-600"></i>
            <span class="ml-1">Sermon Archives</span>
          </h2>
          <p class="text-xs text-gray-500 mt-1">Access past sermon audio messages, teaching outlines, and scripture references delivered by assembly speakers.</p>
        </div>
      </div>
      <div id="sermons-cards-list" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
    </div>
  `;

  const list = container.querySelector('#sermons-cards-list')!;

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="col-span-1 md:col-span-2 bg-white border border-[#e6edf3] rounded-2xl p-12 text-center shadow-xs">
        <div class="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <i data-lucide="headphones" class="text-indigo-600 w-6 h-6"></i>
        </div>
        <h3 class="font-bold text-gray-800">No Sermons Found</h3>
        <p class="text-xs text-gray-500 max-w-sm mx-auto mt-1">Adjust your search parameters or query keywords.</p>
      </div>
    `;
    lucide.createIcons({ root: container });
    return;
  }

  filtered.forEach(s => {
    const card = document.createElement("div");
    card.className = "bg-white border border-gray-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-indigo-400 transition-all";
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-3">
          <span class="text-[9px] bg-indigo-50 text-indigo-700 font-black uppercase px-2 py-0.5 rounded tracking-wide">Audio Stream</span>
          <span class="text-xs text-gray-400 font-semibold">${new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
        <h3 class="text-sm font-black text-gray-950 leading-tight">${s.title}</h3>
        <p class="text-[11px] text-gray-500 mt-1 font-bold">Speaker: ${s.speaker}</p>
        <p class="text-[11px] text-indigo-600 italic font-medium mt-0.5">Passage: ${s.passage}</p>
        <p class="text-xs text-gray-600 mt-3 leading-relaxed bg-gray-50 p-3.5 rounded-lg border border-gray-100">${s.description}</p>
      </div>
      <div class="mt-5 pt-3.5 border-t border-gray-100 flex items-center justify-between">
        <span class="text-xs text-gray-400 font-medium flex items-center gap-1.5">
          <i data-lucide="clock" class="w-3.5 h-3.5"></i>
          <span>${s.audio_duration}</span>
        </span>
        <button data-action="play" data-title="${s.title}" class="text-xs text-indigo-600 hover:underline font-bold flex items-center gap-1.5">
          <i data-lucide="play" class="w-3.5 h-3.5 fill-indigo-600"></i>
          <span>Listen Message</span>
        </button>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('button[data-action="play"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      showToast(`Streaming audio: '${target.dataset.title}'`, "info");
    });
  });

  lucide.createIcons({ root: container });
}
