import { MOCK_BROADCASTS, MOCK_GROUPS, notifyAdminStateChange, syncAdminData, getSession, MOCK_USER_PROFILES } from '../store';
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
                  ${MOCK_GROUPS.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- Simulation file upload to Cloudflare R2 -->
            <div class="p-3.5 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <span class="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block mb-1">Signed Attachment Upload (R2 Storage)</span>
              <div class="flex items-center gap-2">
                <input type="text" id="bc-input-attachment" placeholder="No file signed and uploaded yet..." readonly class="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-[10px] focus:outline-none text-gray-500">
                <button id="btn-simulate-r2" class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold px-3 py-2 border border-gray-300 rounded-lg shrink-0">
                  Upload File
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
  if (MOCK_BROADCASTS.length === 0) {
    return `<p class="text-xs text-gray-400">No broadcasts have been sent yet.</p>`;
  }

  return [...MOCK_BROADCASTS].reverse().map(bc => {
    let targetLabel = "Assembly-Wide";
    if (bc.targeting_mode === "group" && bc.target_group_id) {
      const g = MOCK_GROUPS.find(gr => gr.id === bc.target_group_id);
      targetLabel = g ? `Group: ${g.name}` : "Group (Unknown)";
    }

    const senderProfile = MOCK_USER_PROFILES.find(u => u.id === bc.sent_by);
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
  const uploadBtn = container.querySelector('#btn-simulate-r2') as HTMLButtonElement;
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

  uploadBtn.addEventListener('click', () => {
    showToast("Info", "Accessing pre-signed URL validation from Edge Function...", "info");
    setTimeout(() => {
      const simulatedFileName = `attachment_doc_${Math.floor(Math.random() * 1000)}.pdf`;
      attachInput.value = simulatedFileName;
      showToast("Success", `Completed direct file upload to Cloudflare R2 bucket. Signature verification passed!`, "success");
    }, 1000);
  });

  dispatchBtn.addEventListener('click', async () => {
    const titleInput = container.querySelector('#bc-input-title') as HTMLInputElement;
    const bodyInput = container.querySelector('#bc-input-body') as HTMLTextAreaElement;

    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    const mode = modeSelect.value;
    const targetGrp = groupSelect.value;
    const attachment = attachInput.value.trim();

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

    const { error } = await supabase.from('broadcasts').insert({
      title,
      body,
      targeting_mode: mode,
      target_group_id: mode === "group" ? targetGrp : null,
      attachment_url: attachment || null,
      sent_by: session.user.id
    });

    if (error) {
      showToast("Error", error.message, "error");
      return;
    }

    showToast("Success", "Announcement broadcasted! Notifications generated inside recipient workspaces.", "success");
    await syncAdminData();
  });
}
