// src/modules/settings/pages/panels/AccountPanel.ts

import type { SettingsContext } from '../utils/settingsTypes';
import { getCurrentUser }       from '@core/auth';
import { showSignOutConfirm }   from '../../../../shared/components/SignOutConfirm';

// ─────────────────────────────────────────────────────────────────────────────
// HTML
// ─────────────────────────────────────────────────────────────────────────────

export function accountPanelHTML(): string {
  const user     = getCurrentUser();
  const email    = user?.email ?? null;
  const phone    = user?.phone ?? null;

  return `
    <section class="settings-panel" id="s-panel-account">

      <p class="acc2-page-label">Account &amp; Security</p>

      <!-- ── Sign-in identity ──────────────────────────────────────────────── -->
      <div class="acc2-card">
        <div class="acc2-card-head">
          <div class="acc2-card-icon-wrap acc2-icon-blue">
            <i class="bi bi-person-badge-fill"></i>
          </div>
          <div class="acc2-card-head-text">
            <span class="acc2-card-title">Sign-in identity</span>
            <span class="acc2-card-subtitle">Credentials used to access your account</span>
          </div>
        </div>

        <div class="acc2-card-body">

          <!-- Email field row -->
          <div class="acc2-field" id="acc2-email-row">
            <div class="acc2-field-info">
              <span class="acc2-field-label">Email address</span>
              <span class="acc2-field-value" id="acc2-email-display">
                ${email
                  ? `<a href="mailto:${email}" class="acc2-link">${email}</a>`
                  : `<span class="acc2-value-muted">Not set</span>`}
              </span>
            </div>
            <div class="acc2-field-actions">
              <button class="btn btn-ghost btn-sm acc2-edit-btn" id="acc2-email-edit-btn">
                <i class="bi bi-pencil"></i> Edit
              </button>
            </div>
          </div>

          <!-- Email inline edit -->
          <div class="acc2-inline-edit" id="acc2-email-edit">
            <div class="acc2-inline-edit-inner">
              <label class="acc2-input-label" for="acc2-email-input">New email address</label>
              <input
                type="email"
                id="acc2-email-input"
                class="acc2-input"
                placeholder="you@example.com"
                value="${email ?? ''}"
              />
            </div>
            <div class="acc2-inline-edit-actions">
              <button class="btn btn-primary btn-sm" id="acc2-email-save-btn">
                <i class="bi bi-check-lg"></i> Save
              </button>
              <button class="btn btn-ghost btn-sm" id="acc2-email-cancel-btn">Cancel</button>
            </div>
          </div>

          ${phone !== null ? `
          <!-- Phone field row -->
          <div class="acc2-field" id="acc2-phone-row">
            <div class="acc2-field-info">
              <span class="acc2-field-label">Phone number</span>
              <span class="acc2-field-value" id="acc2-phone-display">${phone}</span>
            </div>
            <div class="acc2-field-actions">
              <button class="btn btn-ghost btn-sm acc2-edit-btn" id="acc2-phone-edit-btn">
                <i class="bi bi-pencil"></i> Edit
              </button>
            </div>
          </div>

          <!-- Phone inline edit -->
          <div class="acc2-inline-edit" id="acc2-phone-edit">
            <div class="acc2-inline-edit-inner">
              <label class="acc2-input-label" for="acc2-phone-input">Phone number</label>
              <input
                type="tel"
                id="acc2-phone-input"
                class="acc2-input"
                placeholder="+1 (555) 000-0000"
                value="${phone}"
              />
            </div>
            <div class="acc2-inline-edit-actions">
              <button class="btn btn-primary btn-sm" id="acc2-phone-save-btn">
                <i class="bi bi-check-lg"></i> Save
              </button>
              <button class="btn btn-ghost btn-sm" id="acc2-phone-cancel-btn">Cancel</button>
            </div>
          </div>
          ` : ''}

        </div>
      </div>

      <!-- ── Password ──────────────────────────────────────────────────────── -->
      <div class="acc2-card">
        <div class="acc2-card-head">
          <div class="acc2-card-icon-wrap acc2-icon-amber">
            <i class="bi bi-key-fill"></i>
          </div>
          <div class="acc2-card-head-text">
            <span class="acc2-card-title">Password</span>
            <span class="acc2-card-subtitle">Manage your account password</span>
          </div>
        </div>

        <div class="acc2-card-body">
          <div class="acc2-pwd-body">
            <div class="acc2-pwd-icon-wrap">
              <i class="bi bi-shield-lock-fill"></i>
            </div>
            <div class="acc2-pwd-content">

              <p class="acc2-pwd-desc">
                Keep your account secure with a strong, unique password.
                You'll need your current password to make changes.
              </p>

              <!-- Collapsed: shows only the trigger button -->
              <div id="acc2-pwd-toggle">
                <button class="btn btn-ghost btn-sm" id="acc2-change-pwd-btn">
                  <i class="bi bi-pencil-square"></i> Change password
                </button>
              </div>

              <!-- Expanded: inline password form -->
              <div class="acc2-pwd-form" id="acc2-pwd-form">

                <div class="acc2-pwd-field-group">
                  <label class="acc2-input-label" for="acc2-pwd-current">Current password</label>
                  <input type="password" id="acc2-pwd-current" class="acc2-input"
                    placeholder="Enter current password"/>
                </div>

                <div class="acc2-pwd-field-group">
                  <label class="acc2-input-label" for="acc2-pwd-new">New password</label>
                  <input type="password" id="acc2-pwd-new" class="acc2-input"
                    placeholder="At least 8 characters"/>
                  <div class="acc2-strength-bar">
                    <div class="acc2-strength-seg" id="acc2-s1"></div>
                    <div class="acc2-strength-seg" id="acc2-s2"></div>
                    <div class="acc2-strength-seg" id="acc2-s3"></div>
                    <div class="acc2-strength-seg" id="acc2-s4"></div>
                  </div>
                  <div class="acc2-strength-label" id="acc2-strength-label"></div>
                </div>

                <div class="acc2-pwd-field-group">
                  <label class="acc2-input-label" for="acc2-pwd-confirm">Confirm new password</label>
                  <input type="password" id="acc2-pwd-confirm" class="acc2-input"
                    placeholder="Repeat new password"/>
                </div>

                <div class="acc2-pwd-form-actions">
                  <button class="btn btn-primary btn-sm" id="acc2-pwd-save-btn">
                    <i class="bi bi-check-lg"></i> Update password
                  </button>
                  <button class="btn btn-ghost btn-sm" id="acc2-pwd-cancel-btn">Cancel</button>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Danger zone ────────────────────────────────────────────────────── -->
      <div class="acc2-card acc2-danger-card">
        <div class="acc2-card-head">
          <div class="acc2-card-icon-wrap acc2-icon-red">
            <i class="bi bi-exclamation-triangle-fill"></i>
          </div>
          <div class="acc2-card-head-text">
            <span class="acc2-card-title acc2-danger-title">Danger zone</span>
            <span class="acc2-card-subtitle">Irreversible or sensitive actions</span>
          </div>
        </div>

        <div class="acc2-card-body">
          <div class="acc2-danger-body">
            <div class="acc2-danger-icon-wrap">
              <i class="bi bi-box-arrow-right"></i>
            </div>
            <div class="acc2-danger-content">
              <p class="acc2-pwd-desc">
                This will end your current session on this device.
                You'll need to sign in again to access your account.
              </p>
              <button class="btn btn-danger btn-sm" id="s-signout-btn">
                <i class="bi bi-box-arrow-right"></i> Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

    </section>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bindings
// ─────────────────────────────────────────────────────────────────────────────

export function bindAccountPanel(ctx: SettingsContext): void {
  const { el, toast } = ctx;

  // ── Email inline edit ──────────────────────────────────────────────────────
  const emailEdit    = el.querySelector<HTMLElement>('#acc2-email-edit');
  const emailDisplay = el.querySelector<HTMLElement>('#acc2-email-display');
  const emailInput   = el.querySelector<HTMLInputElement>('#acc2-email-input');

  el.querySelector('#acc2-email-edit-btn')?.addEventListener('click', () => {
    _closeAllInlineEdits(el);
    emailEdit?.classList.add('open');
    emailInput?.focus();
  });

  el.querySelector('#acc2-email-cancel-btn')?.addEventListener('click', () => {
    emailEdit?.classList.remove('open');
    // Restore original value
    if (emailInput && emailDisplay) {
      const anchor = emailDisplay.querySelector('a');
      emailInput.value = anchor ? anchor.textContent?.trim() ?? '' : '';
    }
  });

  el.querySelector('#acc2-email-save-btn')?.addEventListener('click', async () => {
    const val = emailInput?.value.trim() ?? '';
    if (!val || !val.includes('@')) {
      toast('Please enter a valid email address.', 'error');
      return;
    }
    // TODO: wire to your API/service here
    if (emailDisplay) {
      emailDisplay.innerHTML = `<a href="mailto:${val}" class="acc2-link">${val}</a>`;
    }
    emailEdit?.classList.remove('open');
    toast('Email address updated.');
  });

  // ── Phone inline edit ──────────────────────────────────────────────────────
  const phoneEdit    = el.querySelector<HTMLElement>('#acc2-phone-edit');
  const phoneDisplay = el.querySelector<HTMLElement>('#acc2-phone-display');
  const phoneInput   = el.querySelector<HTMLInputElement>('#acc2-phone-input');

  el.querySelector('#acc2-phone-edit-btn')?.addEventListener('click', () => {
    _closeAllInlineEdits(el);
    phoneEdit?.classList.add('open');
    phoneInput?.focus();
  });

  el.querySelector('#acc2-phone-cancel-btn')?.addEventListener('click', () => {
    phoneEdit?.classList.remove('open');
    if (phoneInput && phoneDisplay) {
      phoneInput.value = phoneDisplay.textContent?.trim() ?? '';
    }
  });

  el.querySelector('#acc2-phone-save-btn')?.addEventListener('click', async () => {
    const val = phoneInput?.value.trim() ?? '';
    if (!val) {
      toast('Please enter a phone number.', 'error');
      return;
    }
    // TODO: wire to your API/service here
    if (phoneDisplay) phoneDisplay.textContent = val;
    phoneEdit?.classList.remove('open');
    toast('Phone number updated.');
  });

  // ── Password form ──────────────────────────────────────────────────────────
  const pwdForm   = el.querySelector<HTMLElement>('#acc2-pwd-form');
  const pwdToggle = el.querySelector<HTMLElement>('#acc2-pwd-toggle');

  el.querySelector('#acc2-change-pwd-btn')?.addEventListener('click', () => {
    _closeAllInlineEdits(el);
    pwdForm?.classList.add('open');
    pwdToggle?.classList.add('hidden');
    el.querySelector<HTMLInputElement>('#acc2-pwd-current')?.focus();
  });

  el.querySelector('#acc2-pwd-cancel-btn')?.addEventListener('click', () => {
    _closePwdForm(el);
  });

  el.querySelector('#acc2-pwd-new')?.addEventListener('input', (e) => {
    _updateStrengthMeter((e.target as HTMLInputElement).value, el);
  });

  el.querySelector('#acc2-pwd-save-btn')?.addEventListener('click', async () => {
    const cur = el.querySelector<HTMLInputElement>('#acc2-pwd-current')?.value ?? '';
    const nw  = el.querySelector<HTMLInputElement>('#acc2-pwd-new')?.value    ?? '';
    const cf  = el.querySelector<HTMLInputElement>('#acc2-pwd-confirm')?.value ?? '';

    if (!cur || !nw || !cf) {
      toast('Please fill in all password fields.', 'error');
      return;
    }
    if (nw !== cf) {
      toast('New passwords do not match.', 'error');
      return;
    }
    if (nw.length < 8) {
      toast('Password must be at least 8 characters.', 'error');
      return;
    }
    // TODO: wire to your API/service here
    _closePwdForm(el);
    toast('Password updated successfully.');
  });

  // ── Sign-out ───────────────────────────────────────────────────────────────
  el.querySelector('#s-signout-btn')?.addEventListener('click', () => {
    showSignOutConfirm();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Collapse every inline-edit form inside the panel. */
function _closeAllInlineEdits(el: HTMLElement): void {
  el.querySelectorAll('.acc2-inline-edit').forEach(e => e.classList.remove('open'));
}

/** Collapse the password form and clear all its fields. */
function _closePwdForm(el: HTMLElement): void {
  el.querySelector<HTMLElement>('#acc2-pwd-form')?.classList.remove('open');
  el.querySelector<HTMLElement>('#acc2-pwd-toggle')?.classList.remove('hidden');

  (['acc2-pwd-current', 'acc2-pwd-new', 'acc2-pwd-confirm'] as const).forEach(id => {
    const input = el.querySelector<HTMLInputElement>(`#${id}`);
    if (input) input.value = '';
  });

  _updateStrengthMeter('', el);
}

/** Drive the four-segment password-strength indicator. */
function _updateStrengthMeter(password: string, el: HTMLElement): void {
  const SEGS   = ['acc2-s1', 'acc2-s2', 'acc2-s3', 'acc2-s4'] as const;
  const label  = el.querySelector<HTMLElement>('#acc2-strength-label');

  // Reset all segments
  SEGS.forEach(id => {
    const seg = el.querySelector<HTMLElement>(`#${id}`);
    if (seg) seg.className = 'acc2-strength-seg';
  });

  if (!password) {
    if (label) label.textContent = '';
    return;
  }

  let score = 0;
  if (password.length >= 8)                             score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password))                               score++;
  if (/[^A-Za-z0-9]/.test(password))                    score++;

  const labels  = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;
  const classes = ['', 'weak', 'fair', 'good', 'strong'] as const;

  for (let i = 0; i < score; i++) {
    const seg = el.querySelector<HTMLElement>(`#acc2-s${i + 1}`);
    seg?.classList.add(classes[score]);
  }
  if (label) label.textContent = labels[score];
}