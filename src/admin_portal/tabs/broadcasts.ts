import { BROADCASTS, GROUPS, notifyAdminStateChange, syncAdminData, getSession, USER_PROFILES } from '../store';
import { showToast } from '../../core/toast';
import { supabase } from '../../core/supabase';

export function renderBroadcastsTab(container: HTMLElement) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <!-- Composer -->
        <div class="xl:col-span-5 bg-white border border-[#e6edf3] p-5 rounded-2xl shadow-3xs space-y-4">
          <h3 class="text-sm font-black uppercase text-gray-500 tracking-wider">Compose Announcement</h3>
          
          <div class="space-y-3.5">
            <div class="space-y-1">
              <label class="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">Bulletin Title</label>
              <input type="text" id="bc-input-title" placeholder="e.g. Adabraka Central Annual Fasting" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-caci-blue focus:ring-1 focus:ring-caci-blue">
            </div>

            <div class="space-y-1">
              <label class="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">Message Body Content</label>
              <textarea id="bc-input-body" rows="5" placeholder="Write full details..." class="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-caci-blue focus:ring-1 focus:ring-caci-blue"></textarea>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">Target scope</label>
                <select id="bc-select-mode" class="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs bg-white focus:outline-none">
                  <option value="assembly">Entire Assembly</option>
                  <option value="group">Specific Department</option>
                </select>
              </div>
              <div class="space-y-1">
                <label class="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">Specific Group Module</label>
                <select id="bc-select-group" disabled class="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs bg-white focus:outline-none disabled:bg-gray-50 disabled:text-gray-400">
                  <option value="">Select Group...</option>
                  ${GROUPS.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- File upload to Supabase Storage -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <span class="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block mb-1">Attachment Upload (Supabase Storage)</span>
              <div class="flex items-center gap-2">
                <input type="file" id="bc-file-input" class="hidden" accept="image/*,.pdf,.doc,.docx">
                <input type="text" id="bc-input-attachment" placeholder="No file selected..." readonly class="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-[10px] focus:outline-none text-gray-500 cursor-pointer" onclick="document.getElementById('bc-file-input').click()">
                <button id="btn-select-file" class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold px-3 py-2 border border-gray-300 rounded-lg shrink-0" onclick="document.getElementById('bc-file-input').click()">
                  Select File
                </button>
              </div>
            </div>

            <div class="pt-2">
              <button id="btn-dispatch-broadcast" class="w-full bg-caci-red hover:bg-caci-redDim text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs">
                <i data-lucide="send" class="w-4 h-4"></i><span>Broadcast Announcement Bulletin</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Outgoing Logs history -->
        <div class="xl:col-span-7 bg-white border border-[#e6edf3] p-5 rounded-2xl shadow-3xs space-y-4">
          <h3 class="text-sm font-black uppercase text-gray-500 tracking-wider">Outgoing Broadcast History</h3>
          <div class="space-y-4 max-h-[550px] overflow-y-auto pr-1">
            ${renderBroadcastHistory()}
          </div>
        </div>
      </div>
    </div>
  `;

  attachBroadcastHandlers(container);
  lucide.createIcons({ root: container });
}

function renderBroadcastHistory() {
  if (BROADCASTS.length === 0) {
    return `<p class="text-xs text-gray-400">No broadcasts have been sent yet.</p>`;
  }

  return [...BROADCASTS].reverse().map(bc => {
    let targetLabel = "Assembly-Wide";
    if (bc.targeting_mode === "group" && bc.target_group_id) {
      const g = GROUPS.find(gr => gr.id === bc.target_group_id);
      targetLabel = g ? `Group: ${g.name}` : "Group (Unknown)";
    }

    const senderProfile = USER_PROFILES.find(u => u.id === bc.sent_by);
    const senderName = senderProfile ? senderProfile.full_name : "Assembly Admin";

    return `
      <div class="p-4 bg-gray-50 border border-gray-100 rounded-xl relative">
        <div class="absolute top-4 right-4 text-[10px] font-mono text-gray-400">
          ${new Date(bc.sent_at).toLocaleString()}
        </div>
        <div class="flex items-center space-x-2 mb-2">
          <span class="${bc.targeting_mode === 'assembly' ? 'bg-caci-red/10 text-caci-red' : 'bg-caci-blue/10 text-caci-blue'} text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wider">
            ${targetLabel}
          </span>
          ${bc.attachment_url ? `<span class="bg-gray-200 text-gray-700 text-[9px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1"><i data-lucide="paperclip" class="w-3 h-3"></i> Attached</span>` : ''}
        </div>
        <h4 class="font-bold text-gray-900 text-sm">${bc.title}</h4>
        <p class="text-xs text-gray-600 mt-1 leading-relaxed">${bc.body}</p>
        <p class="text-[10px] text-gray-400 mt-3 font-semibold border-t border-gray-200 pt-2 block">Dispatched by: ${senderName}</p>
      </div>
    `;
  }).join('');
}

function attachBroadcastHandlers(container: HTMLElement) {
  const modeSelect = container.querySelector('#bc-select-mode') as HTMLSelectElement;
  const groupSelect = container.querySelector('#bc-select-group') as HTMLSelectElement;
  const fileInput = container.querySelector('#bc-file-input') as HTMLInputElement;
  const attachInput = container.querySelector('#bc-input-attachment') as HTMLInputElement;
  const dispatchBtn = container.querySelector('#btn-dispatch-broadcast') as HTMLButtonElement;

  modeSelect.addEventListener('change', () => {
    if (modeSelect.value === 'group') {
      groupSelect.removeAttribute('disabled');
    } else {
      groupSelect.setAttribute('disabled', 'true');
      groupSelect.value = '';
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      attachInput.value = fileInput.files[0].name;
    } else {
      attachInput.value = '';
    }
  });

  dispatchBtn.addEventListener('click', async () => {
    const titleInput = container.querySelector('#bc-input-title') as HTMLInputElement;
    const bodyInput = container.querySelector('#bc-input-body') as HTMLTextAreaElement;

    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    const mode = modeSelect.value;
    const targetGrp = groupSelect.value;

    if (!title || !body) {
      showToast("Error", "A clear Title and Announcement content body are required.", "error");
      return;
    }
    if (mode === "group" && !targetGrp) {
      showToast("Error", "Please specify which Department group this announcement targets.", "error");
      return;
    }

    const session = getSession();
    if (!session || !session.user) {
      showToast("Error", "Authentication session not found.", "error");
      return;
    }

    let attachmentUrl = null;

    if (fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `announcements/${fileName}`;

      dispatchBtn.disabled = true;
      dispatchBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Uploading Attachment...</span>`;
      if (window.lucide) window.lucide.createIcons();

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('broadcasts_attachments')
        .upload(filePath, file);

      if (uploadError) {
        // Fallback to older bucket name if the new one fails due to migration not running
        const { data: uploadDataFallback, error: uploadErrorFallback } = await supabase.storage
          .from('broadcast_attachments')
          .upload(filePath, file);

        if (uploadErrorFallback) {
           showToast("Error", "Failed to upload attachment: " + uploadErrorFallback.message, "error");
           dispatchBtn.disabled = false;
           dispatchBtn.innerHTML = `<i data-lucide="send" class="w-4 h-4"></i><span>Broadcast Announcement Bulletin</span>`;
           if (window.lucide) window.lucide.createIcons();
           return;
        } else {
           const { data: { publicUrl } } = supabase.storage
              .from('broadcast_attachments')
              .getPublicUrl(filePath);
           attachmentUrl = publicUrl;
        }
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('broadcasts_attachments')
          .getPublicUrl(filePath);
        attachmentUrl = publicUrl;
      }
    } else {
       dispatchBtn.disabled = true;
       dispatchBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Broadcasting...</span>`;
       if (window.lucide) window.lucide.createIcons();
    }

    const { error } = await supabase.from('broadcasts').insert({
      title,
      body,
      targeting_mode: mode,
      target_group_id: mode === "group" ? targetGrp : null,
      attachment_url: attachmentUrl,
      sent_by: session.user.id
    });

    dispatchBtn.disabled = false;
    dispatchBtn.innerHTML = `<i data-lucide="send" class="w-4 h-4"></i><span>Broadcast Announcement Bulletin</span>`;
    if (window.lucide) window.lucide.createIcons();

    if (error) {
      showToast("Error", error.message, "error");
      return;
    }

    showToast("Success", "Announcement broadcasted! Notifications generated inside recipient workspaces.", "success");
    titleInput.value = '';
    bodyInput.value = '';
    attachInput.value = '';
    fileInput.value = '';
    if (mode === 'group') {
      groupSelect.value = '';
      groupSelect.setAttribute('disabled', 'true');
      modeSelect.value = 'assembly';
    }
    
    await syncAdminData();
  });
}
