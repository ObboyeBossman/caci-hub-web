import { showToast } from '../../core/toast';
import { sermons } from '../store';
import dayjs from 'dayjs';

export function renderSermonsTab(container: HTMLElement) {
  container.innerHTML = `
    <div class="space-y-6 pb-24">
      <div class="bg-gradient-to-br from-caci-blue to-caci-blueDim p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div class="absolute -right-4 -bottom-4 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl pointer-events-none"></div>
        <div class="relative z-10">
          <h2 class="text-2xl font-black text-white mb-2">Sermons & Teachings</h2>
          <p class="text-blue-100 text-sm font-medium">Listen and re-listen to recent teachings from the assembly.</p>
        </div>
      </div>

      <div class="space-y-4" id="member-sermons-list">
        <!-- Rendered via JS -->
      </div>
    </div>
  `;

  renderSermonsList();
  lucide.createIcons({ root: container });
}

function renderSermonsList() {
  const container = document.getElementById('member-sermons-list');
  if (!container) return;

  if (sermons.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl p-8 text-center shadow-3xs border border-[#e6edf3]">
        <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <i data-lucide="mic" class="w-8 h-8 text-caci-blue"></i>
        </div>
        <h3 class="text-sm font-bold text-gray-900 mb-1">No Sermons Available</h3>
        <p class="text-xs text-gray-500">Check back later for new teachings.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = sermons.map(sermon => `
    <div class="bg-white rounded-2xl shadow-3xs border border-[#e6edf3] p-4 flex flex-col sm:flex-row gap-4">
      <div class="shrink-0 w-full sm:w-32 h-40 sm:h-auto rounded-xl overflow-hidden bg-gray-100 relative">
        ${sermon.cover_image_url 
          ? `<img src="${sermon.cover_image_url}" class="w-full h-full object-cover">`
          : `<div class="w-full h-full flex flex-col items-center justify-center text-gray-300">
               <i data-lucide="book-open" class="w-8 h-8 mb-2"></i>
               <span class="text-[10px] font-bold uppercase tracking-wider">CACI Hub</span>
             </div>`
        }
      </div>
      
      <div class="flex-1 flex flex-col">
        <div class="flex justify-between items-start gap-2 mb-1">
          <h3 class="text-lg font-bold text-gray-900 leading-tight">${sermon.title}</h3>
          <span class="text-[10px] font-bold text-gray-400 shrink-0 bg-gray-100 px-2 py-1 rounded-lg">${dayjs(sermon.date).format('MMM D, YYYY')}</span>
        </div>
        <p class="text-sm font-semibold text-caci-blue mb-2">${sermon.speaker}</p>
        
        ${sermon.scripture_reference ? `
          <div class="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 mb-2">
            <i data-lucide="book" class="w-3.5 h-3.5"></i>
            <span>${sermon.scripture_reference}</span>
          </div>
        ` : ''}
        
        ${sermon.description ? `
          <p class="text-xs text-gray-600 mb-4 line-clamp-2">${sermon.description}</p>
        ` : '<div class="mb-4"></div>'}
        
        <div class="mt-auto flex gap-2 flex-wrap">
          ${sermon.audio_url ? `
            <a href="${sermon.audio_url}" target="_blank" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
              <i data-lucide="headphones" class="w-4 h-4"></i> Listen Audio
            </a>
          ` : ''}
          ${sermon.video_url ? `
            <a href="${sermon.video_url}" target="_blank" class="bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
              <i data-lucide="video" class="w-4 h-4"></i> Watch Video
            </a>
          ` : ''}
        </div>
      </div>
    </div>
  `).join('');

  lucide.createIcons({ root: container });
}
