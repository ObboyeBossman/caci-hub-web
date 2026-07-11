import { MOCK_MEMBER } from '../store';
import { showToast } from '../../core/toast';

export function renderProfileTab(container: HTMLElement) {
  container.innerHTML = `
    <div class="bg-white border border-[#e6edf3] rounded-2xl shadow-xs overflow-hidden">
      <div class="p-6 bg-gradient-to-r from-caci-blue to-caci-blueDim text-white">
        <div class="flex flex-col sm:flex-row items-center gap-4">
          <div class="relative">
            <div class="w-20 h-20 rounded-full overflow-hidden bg-white border-2 border-white shadow-sm">
              <img src="${MOCK_MEMBER.profile_photo_url}" alt="Avatar" class="w-full h-full object-cover">
            </div>
            <button id="btn-edit-photo" class="absolute -bottom-1 -right-1 bg-caci-red hover:bg-caci-redDim text-white p-1.5 rounded-full shadow transition-all">
              <i data-lucide="settings" class="w-3.5 h-3.5"></i>
            </button>
          </div>
          <div class="text-center sm:text-left">
            <span class="bg-green-500 text-white text-[9px] uppercase font-extrabold tracking-widest px-2.5 py-0.5 rounded-full">
              Verified Member
            </span>
            <h2 class="text-xl font-bold mt-1">${MOCK_MEMBER.full_name}</h2>
            <p class="text-xs text-blue-200 mt-0.5">
              <span class="font-mono">${MOCK_MEMBER.membership_number}</span> &bull; Enrolled <span>${new Date(MOCK_MEMBER.join_date || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</span>
            </p>
          </div>
        </div>
      </div>
      <div class="p-6 space-y-6">
        <div>
          <h3 class="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Personal Information</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1">
              <span class="text-[11px] text-gray-400 uppercase font-semibold">Marital Status</span>
              <p class="text-sm font-medium text-gray-800 capitalize">${MOCK_MEMBER.marital_status}</p>
            </div>
            <div class="space-y-1">
              <span class="text-[11px] text-gray-400 uppercase font-semibold">Occupation</span>
              <p class="text-sm font-medium text-gray-800">${MOCK_MEMBER.occupation}</p>
            </div>
            <div class="space-y-1">
              <span class="text-[11px] text-gray-400 uppercase font-semibold">Location / District</span>
              <p class="text-sm font-medium text-gray-800">${MOCK_MEMBER.location}</p>
            </div>
            <div class="space-y-1">
              <span class="text-[11px] text-gray-400 uppercase font-semibold">Gender</span>
              <p class="text-sm font-medium text-gray-800 capitalize">${MOCK_MEMBER.gender}</p>
            </div>
          </div>
        </div>
        <hr class="border-gray-100" />
        <div>
          <h3 class="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Primary Contact & Whatsapp Links</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1">
              <span class="text-[11px] text-gray-400 uppercase font-semibold">Phone Number</span>
              <p class="text-sm font-medium text-gray-800 flex items-center space-x-2">
                <i data-lucide="phone" class="w-4 h-4 text-green-600"></i>
                <span>${MOCK_MEMBER.phone_number}</span>
              </p>
            </div>
            <div class="space-y-1">
              <span class="text-[11px] text-gray-400 uppercase font-semibold">WhatsApp Sync Line</span>
              <p class="text-sm font-medium text-gray-800">${MOCK_MEMBER.whatsapp_number}</p>
            </div>
          </div>
        </div>
        <hr class="border-gray-100" />
        <div>
          <h3 class="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Emergency Contact Details</h3>
          <div class="bg-gray-50 p-4 rounded-xl border border-gray-200/60 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="space-y-1">
              <span class="text-[10px] text-gray-400 uppercase font-bold">Contact Person</span>
              <p class="text-xs font-semibold text-gray-800">${MOCK_MEMBER.emergency_contact_name}</p>
            </div>
            <div class="space-y-1">
              <span class="text-[10px] text-gray-400 uppercase font-bold">Relationship</span>
              <p class="text-xs font-semibold text-gray-800 capitalize">${MOCK_MEMBER.emergency_contact_relationship}</p>
            </div>
            <div class="space-y-1">
              <span class="text-[10px] text-gray-400 uppercase font-bold">Mobile Line</span>
              <p class="text-xs font-semibold text-gray-800">${MOCK_MEMBER.emergency_contact_phone}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btn-edit-photo')?.addEventListener('click', () => {
    showToast("Access Token authorized. Choose a small graphic block file under 1MB to upload to Supabase bucket storage.", "info");
  });

  lucide.createIcons({ root: container });
}
