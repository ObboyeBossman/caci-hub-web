import { showToast } from '../../core/toast';
import { supabase } from '../../core/supabase';
import { adminState, notifyAdminStateChange, sermons, syncAdminData } from '../store';
import dayjs from 'dayjs';

export function renderSermonsTab(container: HTMLElement) {
  container.innerHTML = `
    <div class="space-y-6 pb-20">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#e6edf3] p-4 sm:p-6 rounded-2xl shadow-3xs">
        <div>
          <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
            <i data-lucide="book-open" class="text-caci-blue w-5 h-5"></i>
            <span>Sermons</span>
          </h2>
          <p class="text-xs text-gray-500 mt-1">Manage and publish assembly sermons and teachings.</p>
        </div>
        <button id="btn-add-sermon" class="bg-caci-blue hover:bg-caci-blueDim text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-colors flex items-center gap-2">
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>Add New Sermon</span>
        </button>
      </div>

      <div class="bg-white border border-[#e6edf3] rounded-2xl shadow-3xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="bg-gray-50/50 border-b border-[#e6edf3] text-gray-500 text-xs uppercase tracking-wider font-extrabold">
                <th class="py-4 px-6">Sermon Details</th>
                <th class="py-4 px-6">Speaker</th>
                <th class="py-4 px-6">Date</th>
                <th class="py-4 px-6">Media</th>
                <th class="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="sermons-list" class="divide-y divide-gray-50">
              <!-- Rendered via JS -->
            </tbody>
          </table>
          <div id="empty-state" class="hidden p-12 text-center">
            <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i data-lucide="mic" class="w-8 h-8 text-caci-blue"></i>
            </div>
            <h3 class="text-sm font-bold text-gray-900">No Sermons Found</h3>
            <p class="text-xs text-gray-500 mt-1">There are no sermons recorded yet.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  renderSermonList();
  lucide.createIcons({ root: container });

  document.getElementById('btn-add-sermon')?.addEventListener('click', () => {
    renderSermonModal();
  });
}

function renderSermonList() {
  const tbody = document.getElementById('sermons-list');
  const emptyState = document.getElementById('empty-state');
  if (!tbody || !emptyState) return;

  if (sermons.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  tbody.innerHTML = sermons.map(sermon => `
    <tr class="hover:bg-gray-50/50 transition-colors group">
      <td class="py-4 px-6">
        <div class="flex items-center gap-3">
          ${sermon.cover_image_url 
            ? `<img src="${sermon.cover_image_url}" class="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0">`
            : `<div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                 <i data-lucide="image" class="w-5 h-5 text-gray-400"></i>
               </div>`
          }
          <div>
            <div class="font-bold text-gray-900">${sermon.title}</div>
            <div class="text-[11px] text-gray-500 truncate max-w-[200px]">${sermon.scripture_reference || 'No scripture ref'}</div>
          </div>
        </div>
      </td>
      <td class="py-4 px-6">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-700">
            ${sermon.speaker.substring(0,2).toUpperCase()}
          </div>
          <span class="text-sm font-medium text-gray-700">${sermon.speaker}</span>
        </div>
      </td>
      <td class="py-4 px-6 text-sm text-gray-600">
        ${dayjs(sermon.date).format('MMM D, YYYY')}
      </td>
      <td class="py-4 px-6">
        <div class="flex gap-2">
          ${sermon.audio_url ? '<i data-lucide="headphones" class="w-4 h-4 text-green-500" title="Audio available"></i>' : ''}
          ${sermon.video_url ? '<i data-lucide="video" class="w-4 h-4 text-blue-500" title="Video available"></i>' : ''}
          ${!sermon.audio_url && !sermon.video_url ? '<span class="text-[10px] text-gray-400">None</span>' : ''}
        </div>
      </td>
      <td class="py-4 px-6 text-right">
        <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button class="btn-edit text-gray-400 hover:text-caci-blue transition-colors p-1" data-id="${sermon!.id}" title="Edit">
            <i data-lucide="edit-2" class="w-4 h-4 pointer-events-none"></i>
          </button>
          <button class="btn-delete text-gray-400 hover:text-caci-red transition-colors p-1" data-id="${sermon!.id}" title="Delete">
            <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  lucide.createIcons({ root: tbody });

  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLButtonElement).dataset.id;
      if (id) renderSermonModal(id);
    });
  });

  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLButtonElement).dataset.id;
      if (id && confirm('Are you sure you want to delete this sermon?')) {
        const { error } = await supabase.from('sermons').delete().eq('id', id);
        if (error) {
          showToast('Error', 'Failed to delete sermon', 'error');
        } else {
          showToast('Success', 'Sermon deleted successfully', 'success');
          await syncAdminData();
          renderSermonList();
        }
      }
    });
  });
}

function renderSermonModal(sermonId?: string) {
  const isEdit = !!sermonId;
  const sermon = isEdit ? sermons.find(s => s.id === sermonId) : null;

  const modalHtml = `
    <div id="sermon-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm opacity-0 transition-opacity">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden scale-95 transition-transform flex flex-col max-h-[90vh]">
        <div class="px-6 py-4 border-b border-[#e6edf3] flex justify-between items-center bg-gray-50/50 shrink-0">
          <h3 class="font-bold text-gray-900 flex items-center gap-2">
            <i data-lucide="${isEdit ? 'edit-2' : 'plus'}" class="w-4 h-4 text-caci-blue"></i>
            ${isEdit ? 'Edit Sermon' : 'Add New Sermon'}
          </h3>
          <button id="btn-close-modal" class="text-gray-400 hover:text-gray-600 p-1 transition-colors">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div class="p-6 overflow-y-auto flex-1">
          <form id="sermon-form" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1.5 sm:col-span-2">
                <label class="text-[11px] font-bold text-gray-700">Sermon Title *</label>
                <input type="text" id="sermon-title" value="${sermon?.title || ''}" required class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-caci-blue">
              </div>
              <div class="space-y-1.5">
                <label class="text-[11px] font-bold text-gray-700">Speaker *</label>
                <input type="text" id="sermon-speaker" value="${sermon?.speaker || ''}" required class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-caci-blue">
              </div>
              <div class="space-y-1.5">
                <label class="text-[11px] font-bold text-gray-700">Date *</label>
                <input type="date" id="sermon-date" value="${sermon?.date || dayjs().format('YYYY-MM-DD')}" required class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-caci-blue">
              </div>
              <div class="space-y-1.5 sm:col-span-2">
                <label class="text-[11px] font-bold text-gray-700">Scripture Reference</label>
                <input type="text" id="sermon-scripture" value="${sermon?.scripture_reference || ''}" placeholder="e.g. John 3:16" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-caci-blue">
              </div>
              <div class="space-y-1.5 sm:col-span-2">
                <label class="text-[11px] font-bold text-gray-700">Description</label>
                <textarea id="sermon-desc" rows="3" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-caci-blue">${sermon?.description || ''}</textarea>
              </div>
              <div class="space-y-1.5 sm:col-span-2">
                <label class="text-[11px] font-bold text-gray-700">Cover Image</label>
                <input type="file" id="sermon-cover" accept="image/*" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-caci-blue file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-caci-blue/10 file:text-caci-blue hover:file:bg-caci-blue/20">
                ${sermon?.cover_image_url ? `<p class="text-[10px] text-gray-500 mt-1">Current: <a href="${sermon.cover_image_url}" target="_blank" class="text-caci-blue hover:underline">View Image</a></p>` : ''}
              </div>
              <div class="space-y-1.5 sm:col-span-2">
                <label class="text-[11px] font-bold text-gray-700">Audio File</label>
                <input type="file" id="sermon-audio" accept="audio/*" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-caci-blue file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100">
                ${sermon?.audio_url ? `<p class="text-[10px] text-gray-500 mt-1">Current: <a href="${sermon.audio_url}" target="_blank" class="text-caci-blue hover:underline">View Audio</a></p>` : ''}
              </div>
              <div class="space-y-1.5 sm:col-span-2">
                <label class="text-[11px] font-bold text-gray-700">YouTube Video URL</label>
                <input type="url" id="sermon-video" value="${sermon?.video_url || ''}" placeholder="https://youtube.com/watch?v=..." class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-caci-blue">
              </div>
            </div>
          </form>
        </div>
        <div class="px-6 py-4 border-t border-[#e6edf3] bg-gray-50/50 flex justify-end gap-3 shrink-0">
          <button id="btn-cancel" class="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
          <button id="btn-save-sermon" class="px-6 py-2 bg-caci-blue hover:bg-caci-blueDim text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2">
            <span>Save Sermon</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  lucide.createIcons({ root: document.getElementById('sermon-modal')! });

  const modal = document.getElementById('sermon-modal')!;
  const inner = modal.querySelector('div')!;
  
  // Animate in
  requestAnimationFrame(() => {
    modal.classList.remove('opacity-0');
    inner.classList.remove('scale-95');
  });

  const closeModal = () => {
    modal.classList.add('opacity-0');
    inner.classList.add('scale-95');
    setTimeout(() => modal.remove(), 200);
  };

  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel')?.addEventListener('click', closeModal);

  document.getElementById('btn-save-sermon')?.addEventListener('click', async () => {
    const title = (document.getElementById('sermon-title') as HTMLInputElement).value.trim();
    const speaker = (document.getElementById('sermon-speaker') as HTMLInputElement).value.trim();
    const date = (document.getElementById('sermon-date') as HTMLInputElement).value;
    const scripture = (document.getElementById('sermon-scripture') as HTMLInputElement).value.trim();
    const desc = (document.getElementById('sermon-desc') as HTMLTextAreaElement).value.trim();
    const videoUrl = (document.getElementById('sermon-video') as HTMLInputElement).value.trim();
    
    if (!title || !speaker || !date) {
      showToast('Error', 'Please fill in all required fields.', 'error');
      return;
    }

    const saveBtn = document.getElementById('btn-save-sermon')!;
    saveBtn.innerHTML = '<i class="lucide-loader w-4 h-4 animate-spin"></i> Saving...';
    (saveBtn as HTMLButtonElement).disabled = true;

    try {
      let coverUrl = sermon?.cover_image_url || null;
      let audioUrl = sermon?.audio_url || null;

      const coverFile = (document.getElementById('sermon-cover') as HTMLInputElement).files?.[0];
      const audioFile = (document.getElementById('sermon-audio') as HTMLInputElement).files?.[0];

      if (coverFile) {
        const ext = coverFile.name.split('.').pop();
        const fileName = `covers/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage.from('sermon_media').upload(fileName, coverFile);
        if (uploadErr) throw uploadErr;
        coverUrl = supabase.storage.from('sermon_media').getPublicUrl(uploadData.path).data.publicUrl;
      }

      if (audioFile) {
        const ext = audioFile.name.split('.').pop();
        const fileName = `audio/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage.from('sermon_media').upload(fileName, audioFile);
        if (uploadErr) throw uploadErr;
        audioUrl = supabase.storage.from('sermon_media').getPublicUrl(uploadData.path).data.publicUrl;
      }

      const payload = {
        title,
        speaker,
        date,
        scripture_reference: scripture || null,
        description: desc || null,
        video_url: videoUrl || null,
        cover_image_url: coverUrl,
        audio_url: audioUrl,
        updated_at: new Date().toISOString()
      };

      if (isEdit) {
        const { error } = await supabase.from('sermons').update(payload).eq('id', sermon!.id);
        if (error) throw error;
        showToast('Success', 'Sermon updated successfully', 'success');
      } else {
        const { error } = await supabase.from('sermons').insert(payload);
        if (error) throw error;
        showToast('Success', 'Sermon added successfully', 'success');
      }

      await syncAdminData();
      renderSermonList();
      closeModal();
    } catch (err: any) {
      console.error(err);
      showToast('Error', err.message || 'Failed to save sermon', 'error');
      saveBtn.innerHTML = 'Save Sermon';
      (saveBtn as HTMLButtonElement).disabled = false;
    }
  });
}
