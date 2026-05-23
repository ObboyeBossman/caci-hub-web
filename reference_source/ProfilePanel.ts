// src/modules/settings/pages/panels/ProfilePanel.ts

import type { SettingsContext } from '../utils/settingsTypes';
import type { Member }          from '@/types/models';
import { getCurrentUser }       from '@core/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Friendly label for MembershipStatus enum values.
 * Avoids exposing raw DB strings like "prospect" to members.
 */
function friendlyStatus(raw: string | null | undefined): string {
  const map: Record<string, string> = {
    active:   'Active member',
    inactive: 'Inactive',
    visitor:  'Visitor',
    prospect: 'Prospective member',
    transfer: 'Transfer pending',
    deceased: 'Deceased',
  };
  return raw ? (map[raw] ?? raw) : '—';
}

/** CSS class for the membership status badge. */
function statusBadgeClass(raw: string | null | undefined): string {
  const map: Record<string, string> = {
    active:   'settings-badge-green',
    inactive: 'settings-badge-grey',
    visitor:  'settings-badge-blue',
    prospect: 'settings-badge-yellow',
    transfer: 'settings-badge-blue',
    deceased: 'settings-badge-grey',
  };
  return raw ? (map[raw] ?? 'settings-badge-grey') : 'settings-badge-grey';
}

/** Format ISO date strings into a readable form (e.g. 12 March 1990). */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

/** Capitalise the first letter of a string. */
function cap(s: string | null | undefined): string {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Read-only field renderers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A standard read-only row: label on the left, value on the right.
 * Optional `note` appears as small descriptive text under the label.
 */
function roRow(label: string, value: string, note?: string): string {
  return `
    <div class="settings-row">
      <span class="settings-lbl">
        ${label}
        ${note ? `<small>${note}</small>` : ''}
      </span>
      <div class="settings-field-r">
        <span class="prof-ro-value">${value}</span>
      </div>
    </div>`;
}

/**
 * A read-only row that renders the value as a status badge
 * (using the existing settings-badge palette).
 */
function roBadgeRow(label: string, value: string, badgeClass: string, note?: string): string {
  return `
    <div class="settings-row">
      <span class="settings-lbl">
        ${label}
        ${note ? `<small>${note}</small>` : ''}
      </span>
      <div class="settings-field-r">
        <span class="settings-badge ${badgeClass}">${value}</span>
      </div>
    </div>`;
}

/**
 * A row where the value is intentionally locked from even admin edits
 * in this UI — e.g. system-assigned membership number.
 * Shows a small lock icon alongside the value.
 */
function lockedRow(label: string, value: string, note?: string): string {
  return `
    <div class="settings-row">
      <span class="settings-lbl">
        ${label}
        ${note ? `<small>${note}</small>` : ''}
      </span>
      <div class="settings-field-r" style="gap:6px">
        <i class="bi bi-lock prof-lock-icon" title="System assigned — cannot be changed"></i>
        <span class="prof-ro-value prof-ro-muted">${value}</span>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel HTML
// ─────────────────────────────────────────────────────────────────────────────

export function profilePanelHTML(
  displayName: string,
  email:       string,
  role:        string,
  initials:    string,
  member?:     Partial<Member>,
): string {

  // ── Derive values from the Member model ──────────────────────────────────
  const membershipNumber = member?.membershipNumber ?? null;
  const firstName        = member?.firstName  ?? displayName.split(' ')[0] ?? '—';
  const lastName         = member?.lastName   ?? displayName.split(' ').slice(1).join(' ') || '—';
  const dob              = member?.dateOfBirth ?? null;
  const gender           = member?.gender ?? null;
  const marital          = member?.maritalStatus ?? null;
  const phone            = member?.phoneNumber ?? null;
  const whatsapp         = member?.whatsappNumber ?? null;
  const address          = member?.physicalAddress ?? null;
  const occupation       = member?.occupation ?? null;
  const facebook         = member?.facebookUrl ?? null;
  const instagram        = member?.instagramUrl ?? null;
  const profilePhoto     = member?.profilePhotoUrl ?? null;
  const status           = member?.membershipStatus ?? null;
  const joinDate         = member?.joinDate ?? null;
  // emergencyContact fields — safe to show when member views their own profile
  const ecName           = member?.emergencyContactName ?? null;
  const ecPhone          = member?.emergencyContactPhone ?? null;
  const ecRel            = member?.emergencyContactRelationship ?? null;
  // assemblyId is shown as the resolved name — caller should pass it resolved;
  // fall back gracefully if only the raw ID is available.
  const assemblyDisplay  = (member as any)?.assemblyName ?? member?.assemblyId ?? '—';
  // householdId resolved to householdName via embed
  const householdDisplay = member?.householdName ?? (member?.householdId ? 'Assigned' : '—');

  // ── Avatar element ───────────────────────────────────────────────────────
  const avatarInner = profilePhoto
    ? `<img src="${profilePhoto}" alt="${displayName}" />`
    : `<span id="s-avatar-initials">${initials}</span>`;

  // ── Emergency contact section — only render if at least one field present ─
  const hasEmergency = ecName || ecPhone;
  const emergencySection = hasEmergency ? `
    <p class="settings-sec">Emergency contact</p>
    <div class="prof-admin-banner">
      <i class="bi bi-shield-lock"></i>
      <span>Contact your assembly administrator to update emergency contact details.</span>
    </div>
    ${roRow('Name', ecName ?? '—')}
    ${roRow('Phone', ecPhone ?? '—')}
    ${roRow('Relationship', cap(ecRel))}
  ` : '';

  // ── Household & church section ───────────────────────────────────────────
  const churchSection = `
    <p class="settings-sec">Church & household</p>
    <div class="prof-admin-banner">
      <i class="bi bi-shield-lock"></i>
      <span>These fields are managed by your assembly administrator.</span>
    </div>
    ${roBadgeRow(
        'Membership status',
        friendlyStatus(status),
        statusBadgeClass(status),
        'Assigned by leadership.',
      )}
    ${roRow('Assembly', assemblyDisplay)}
    ${roRow('Household', householdDisplay)}
    ${roRow('Joined', fmtDate(joinDate))}
  `;

  return `
    <!-- ═══════════════════════════════════════════════════════════
         PROFILE PANEL  (V1 — Read-Only)
         Members can see all fields listed here but cannot edit them.
         Full self-service editing ships in V2.
    ═══════════════════════════════════════════════════════════════ -->
    <section class="settings-panel active" id="s-panel-profile">

      <!-- ── Top notice banner ─────────────────────────────────── -->
      <div class="prof-notice-banner">
        <div class="prof-notice-icon"><i class="bi bi-info-circle-fill"></i></div>
        <div class="prof-notice-body">
          <strong>Profile editing coming soon</strong>
          <span>Self-service updates are on their way. To correct any information now, contact your assembly administrator.</span>
        </div>
      </div>

      <!-- ── Avatar (display only) ─────────────────────────────── -->
      <p class="settings-sec">Profile photo</p>
      <div class="settings-row">
        <span class="settings-lbl">
          Avatar
          <small>Photo updates will be available in the next release.</small>
        </span>
        <div class="settings-field-r" style="gap:var(--sp-md)">
          <div class="settings-avatar prof-avatar-ro" title="Profile photo — editing not yet available">
            ${avatarInner}
            <div class="settings-av-overlay prof-av-lock">
              <i class="bi bi-lock"></i>
            </div>
          </div>
          <span class="settings-badge settings-badge-grey" style="align-self:flex-end">
            <i class="bi bi-clock" style="font-size:11px;margin-right:3px"></i>Coming soon
          </span>
        </div>
      </div>

      <!-- ── Personal information ───────────────────────────────── -->
      <p class="settings-sec">Personal information</p>

      ${lockedRow('Membership number',
          membershipNumber ?? 'Pending assignment',
          'System-assigned — unique to your membership record.',
        )}

      ${roRow('First name', firstName)}
      ${roRow('Last name',  lastName)}
      ${roRow('Date of birth', fmtDate(dob))}
      ${roBadgeRow(
          'Gender',
          cap(gender),
          gender === 'male' ? 'settings-badge-blue' : gender === 'female' ? 'settings-badge-yellow' : 'settings-badge-grey',
        )}
      ${roRow('Marital status', cap(marital))}
      ${roRow('Occupation',     occupation ?? '—')}

      <!-- ── Contact information ────────────────────────────────── -->
      <p class="settings-sec">Contact information</p>
      ${roRow('Email address',    email || '—', 'Used for notifications and account access.')}
      ${roRow('Phone number',     phone ?? '—')}
      ${roRow('WhatsApp number',  whatsapp ?? '—')}
      ${roRow('Physical address', address ?? '—')}

      <!-- ── Social profiles ───────────────────────────────────── -->
      <p class="settings-sec">Social profiles</p>
      ${roRow('Facebook',  facebook  ? `<a href="${facebook}"  target="_blank" rel="noreferrer" class="prof-link">${facebook}</a>`  : '—')}
      ${roRow('Instagram', instagram ? `<a href="${instagram}" target="_blank" rel="noreferrer" class="prof-link">${instagram}</a>` : '—')}

      <!-- ── Emergency contact ──────────────────────────────────── -->
      ${emergencySection}

      <!-- ── Church & household ────────────────────────────────── -->
      ${churchSection}

      <!-- ── Bottom CTA ─────────────────────────────────────────── -->
      <div class="prof-cta-bar">
        <i class="bi bi-envelope" style="font-size:14px;color:var(--text-secondary)"></i>
        <span>Something incorrect?</span>
        <button class="btn btn-ghost btn-sm" id="s-profile-contact-admin">
          Contact your administrator
        </button>
      </div>

    </section>

    <!-- ═══════════════════════════════════════════════════════════
         ACCOUNT PANEL  (V1 — Coming Soon)
         Kept in the DOM so the tab shell doesn't break.
    ═══════════════════════════════════════════════════════════════ -->
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

// ─────────────────────────────────────────────────────────────────────────────
// Bindings
// ─────────────────────────────────────────────────────────────────────────────

export function bindProfilePanel(ctx: SettingsContext): void {
  const { el, toast } = ctx;

  // "Contact your administrator" button — opens a mailto to the church
  // secretary. Replace the address with your real support email.
  el.querySelector('#s-profile-contact-admin')?.addEventListener('click', () => {
    const user    = getCurrentUser();
    const subject = encodeURIComponent('Profile update request');
    const body    = encodeURIComponent(
      `Hello,\n\nI would like to update some details on my profile.\n\nName: ${user?.fullName ?? ''}\nEmail: ${user?.email ?? ''}\n\nDetails to update:\n\n`,
    );
    window.location.href = `mailto:admin@yourchurch.org?subject=${subject}&body=${body}`;
  });

  // Password modal (account panel — kept from original)
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

/** Password strength meter — called from SettingsOverlay on #s-pwd-new input. */
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
