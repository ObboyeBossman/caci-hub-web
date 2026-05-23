// src/modules/settings/pages/panels/ProfilePanel.ts

import type { SettingsContext } from '../utils/settingsTypes';

export function profilePanelHTML(displayName: string, email: string, role: string, initials: string): string {
  return `
    <section class="settings-panel active" id="s-panel-profile">
      <p class="settings-sec">Profile photo</p>
      <div class="settings-row">
        <span class="settings-lbl">Avatar<small>JPEG, PNG or WEBP · max 5 MB.</small></span>
        <div class="settings-field-r">
          <div class="settings-avatar" id="s-avatar" title="Click to upload photo">
            <span id="s-avatar-initials">${initials}</span>
            <div class="settings-av-overlay"><i class="bi bi-camera"></i></div>
          </div>
          <input type="file" id="s-avatar-input" accept="image/jpeg,image/png,image/webp" style="display:none"/>
          <div>
            <button class="btn btn-ghost btn-sm" id="s-avatar-upload-btn">Upload</button>
            <div class="settings-upload-progress" id="s-upload-progress">
              <div class="settings-upload-bar-track">
                <div class="settings-upload-bar-fill" id="s-upload-bar"></div>
              </div>
              <div class="settings-upload-status" id="s-upload-status"></div>
            </div>
          </div>
        </div>
      </div>

      <p class="settings-sec">Personal information</p>
      <div class="settings-row">
        <span class="settings-lbl">Display name</span>
        <div class="settings-field-r">
          <input type="text" id="s-display-name" value="${displayName}" style="min-width:240px"/>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-lbl">Email address<small>Changes require email verification.</small></span>
        <div class="settings-field-r" style="flex-direction:column;align-items:flex-start">
          <input type="email" id="s-email" value="${email}" style="min-width:240px"/>
          <div class="settings-email-pending" id="s-email-pending">
            <i class="bi bi-envelope-exclamation"></i>
            Verification email sent — check your inbox.
            <button class="btn btn-ghost btn-sm" style="margin-left:auto">Resend</button>
          </div>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-lbl">Role / Title<small>Visible to other members.</small></span>
        <div class="settings-field-r">
          <input type="text" id="s-role" value="${role}" style="min-width:240px"/>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-lbl">Bio</span>
        <div class="settings-field-r" style="flex:1;max-width:380px">
          <textarea id="s-bio" placeholder="A short bio visible on your profile…" style="min-width:240px"></textarea>
        </div>
      </div>
      <div class="settings-save-bar">
        <button class="btn btn-ghost" id="s-profile-cancel">Cancel</button>
        <button class="btn btn-primary" id="s-profile-save"><i class="bi bi-check2"></i> Save changes</button>
      </div>
    </section>

    <section class="settings-panel" id="s-panel-account">
      <p class="settings-sec">Password</p>
      <div class="settings-row">
        <span class="settings-lbl">Password<small>Last changed: never</small></span>
        <div class="settings-field-r">
          <button class="btn btn-ghost btn-sm" id="s-change-pwd-btn">
            <i class="bi bi-key"></i> Change password
          </button>
        </div>
      </div>

      <p class="settings-sec">Phone number</p>
      <div class="settings-row">
        <span class="settings-lbl">Mobile<small>Used for SMS notifications and account recovery.</small></span>
        <div class="settings-field-r">
          <input type="tel" id="s-phone" placeholder="+233 XX XXX XXXX" style="min-width:200px"/>
          <span class="settings-badge settings-badge-grey" id="s-phone-badge">Not verified</span>
        </div>
      </div>

      <p class="settings-sec">Linked accounts</p>
      <div class="settings-row">
        <span class="settings-lbl">Google<small>Sign in with your Google account.</small></span>
        <div class="settings-field-r">
          <span class="settings-badge settings-badge-grey">Not connected</span>
          <button class="btn btn-ghost btn-sm">Connect</button>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-lbl">Microsoft<small>Sign in with your Microsoft account.</small></span>
        <div class="settings-field-r">
          <span class="settings-badge settings-badge-grey">Not connected</span>
          <button class="btn btn-ghost btn-sm">Connect</button>
        </div>
      </div>
    </section>
  `;
}

export function bindProfilePanel(ctx: SettingsContext): void {
  const { el, toast } = ctx;

  el.querySelector('#s-profile-save')?.addEventListener('click', () => toast('Profile saved'));
  el.querySelector('#s-profile-cancel')?.addEventListener('click', () => toast('Changes discarded'));

  el.querySelector('#s-email')?.addEventListener('change', () => {
    el.querySelector('#s-email-pending')?.classList.add('show');
  });

  // Avatar upload
  const avatarBtn   = el.querySelector('#s-avatar-upload-btn');
  const avatarInput = el.querySelector<HTMLInputElement>('#s-avatar-input');
  const avatarEl    = el.querySelector<HTMLElement>('#s-avatar');
  avatarBtn?.addEventListener('click', () => avatarInput?.click());
  avatarEl?.addEventListener('click', () => avatarInput?.click());
  avatarInput?.addEventListener('change', () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('File exceeds 5 MB limit', 'error'); return; }
    const progress = el.querySelector<HTMLElement>('#s-upload-progress')!;
    const bar      = el.querySelector<HTMLElement>('#s-upload-bar')!;
    const status   = el.querySelector<HTMLElement>('#s-upload-status')!;
    progress.style.display = 'block';
    let pct = 0;
    const iv = setInterval(() => {
      pct = Math.min(pct + 10, 100);
      bar.style.width = pct + '%';
      status.textContent = pct < 100 ? `Uploading… ${pct}%` : 'Upload complete';
      if (pct === 100) {
        clearInterval(iv);
        setTimeout(() => { progress.style.display = 'none'; }, 1500);
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = document.createElement('img');
          img.src = ev.target!.result as string;
          el.querySelector('#s-avatar-initials')?.remove();
          avatarEl?.appendChild(img);
        };
        reader.readAsDataURL(file);
        toast('Avatar updated');
      }
    }, 80);
  });

  // Password modal
  el.querySelector('#s-change-pwd-btn')?.addEventListener('click', () => {
    el.querySelector<HTMLElement>('#s-pwd-overlay')!.classList.add('open');
  });
  el.querySelector('#s-pwd-cancel-btn')?.addEventListener('click', () => {
    el.querySelector<HTMLElement>('#s-pwd-overlay')!.classList.remove('open');
  });
  el.querySelector('#s-pwd-save-btn')?.addEventListener('click', () => {
    const cur  = el.querySelector<HTMLInputElement>('#s-pwd-current')!.value;
    const nw   = el.querySelector<HTMLInputElement>('#s-pwd-new')!.value;
    const conf = el.querySelector<HTMLInputElement>('#s-pwd-confirm')!.value;
    if (!cur)          { toast('Enter your current password', 'error'); return; }
    if (nw.length < 8) { toast('New password must be at least 8 characters', 'error'); return; }
    if (nw !== conf)   { toast('Passwords do not match', 'error'); return; }
    el.querySelector<HTMLElement>('#s-pwd-overlay')!.classList.remove('open');
    toast('Password updated');
  });
}

export function onPwdStrengthInput(val: string, el: HTMLElement): void {
  const colors = ['#C60026', '#e6820a', '#1A7F37', '#1A7F37'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  let score = 0;
  if (val.length >= 8)                           score++;
  if (val.length >= 12)                          score++;
  if (/[A-Z]/.test(val) && /[a-z]/.test(val))   score++;
  if (/[^A-Za-z0-9]/.test(val))                 score++;
  ['s-s1', 's-s2', 's-s3', 's-s4'].forEach((id, i) => {
    const seg = el.querySelector<HTMLElement>(`#${id}`);
    if (seg) seg.style.background = i < score ? colors[score - 1] : 'var(--border-default)';
  });
  const lbl = el.querySelector<HTMLElement>('#s-strength-lbl');
  if (lbl) {
    lbl.textContent = val.length ? labels[score] : '';
    lbl.style.color = score > 0 ? colors[score - 1] : 'var(--text-placeholder)';
  }
}