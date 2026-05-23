// src/modules/settings/pages/panels/ProfilePanel.ts

import type { SettingsContext } from '../utils/settingsTypes';
import type { MemberView }      from '../../../../types/member.types';
import { getCurrentUser }       from '@core/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function cap(s: string | null | undefined): string {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function val(s: string | null | undefined): string {
  return s?.trim() || '—';
}

// ─────────────────────────────────────────────────────────────────────────────
// Field renderers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single labelled field — used inside prof-grid or standalone.
 */
function field(label: string, value: string, opts: { mono?: boolean; locked?: boolean; link?: boolean } = {}): string {
  const valueClass = [
    'prof-field-value',
    opts.mono   ? 'prof-field-mono'   : '',
    opts.locked ? 'prof-field-locked' : '',
  ].filter(Boolean).join(' ');

  const lockIcon = opts.locked
    ? `<i class="bi bi-lock prof-lock-icon" title="System assigned"></i>`
    : '';

  return `
    <div class="prof-field">
      <span class="prof-field-label">${label}</span>
      <span class="${valueClass}">${lockIcon}${value}</span>
    </div>`;
}

/** Two fields side by side in a responsive grid row. */
function row2(a: string, b: string): string {
  return `<div class="prof-grid-row">${a}${b}</div>`;
}

/** One field taking the full width of a grid row. */
function row1(a: string): string {
  return `<div class="prof-grid-row prof-grid-row--full">${a}</div>`;
}

/** A card-style group with a title and grid content. */
function card(title: string, icon: string, content: string, adminLocked = false): string {
  const banner = adminLocked ? `
    <div class="prof-admin-banner">
      <i class="bi bi-shield-lock"></i>
      <span>Managed by your assembly administrator.</span>
    </div>` : '';

  return `
    <div class="prof-card">
      <div class="prof-card-head">
        <i class="bi bi-${icon} prof-card-icon"></i>
        <span class="prof-card-title">${title}</span>
      </div>
      ${banner}
      <div class="prof-grid">
        ${content}
      </div>
    </div>`;
}

/** A badge rendered as a field value. */
function badgeField(label: string, text: string, badgeClass: string): string {
  return `
    <div class="prof-field">
      <span class="prof-field-label">${label}</span>
      <span class="settings-badge ${badgeClass}">${text}</span>
    </div>`;
}

/** An external link rendered as a field value. */
function linkField(label: string, href: string | null | undefined): string {
  const display = href
    ? `<a href="${href}" target="_blank" rel="noreferrer" class="prof-link">${href}</a>`
    : '—';
  return field(label, display);
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel HTML
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lightweight loading skeleton — shown while getOwnMemberProfile() is in-flight.
 * Uses the same panel ID so tab switching still works during load.
 */
export function profilePanelSkeleton(): string {
  const shimRow = `
    <div class="prof-grid-row">
      <div class="prof-field"><span class="prof-skeleton prof-sk-label"></span><span class="prof-skeleton prof-sk-value"></span></div>
      <div class="prof-field"><span class="prof-skeleton prof-sk-label"></span><span class="prof-skeleton prof-sk-value"></span></div>
    </div>`;
  return `
    <section class="settings-panel active" id="s-panel-profile">
      <div class="prof-sk-banner"></div>
      <div class="prof-avatar-row">
        <div class="settings-avatar prof-avatar-ro prof-skeleton" style="border:none"></div>
        <div class="prof-avatar-meta" style="gap:6px">
          <span class="prof-skeleton prof-sk-name"></span>
          <span class="prof-skeleton prof-sk-role"></span>
        </div>
      </div>
      <div class="prof-cards">
        <div class="prof-card">
          <div class="prof-card-head"><span class="prof-skeleton" style="width:120px;height:14px"></span></div>
          <div class="prof-grid">${shimRow}${shimRow}${shimRow}</div>
        </div>
        <div class="prof-card">
          <div class="prof-card-head"><span class="prof-skeleton" style="width:140px;height:14px"></span></div>
          <div class="prof-grid">${shimRow}${shimRow}</div>
        </div>
      </div>
    </section>`;
}

export function profilePanelHTML(
  displayName: string,
  email:       string,
  role:        string,
  initials:    string,
  member?:     Partial<MemberView>,
): string {

  // ── Derived values ────────────────────────────────────────────────────────
  const membershipNumber = member?.membership_number ?? null;
  const firstName        = member?.first_name  ?? displayName.split(' ')[0] ?? '';
  const lastName         = member?.last_name   ?? (displayName.split(' ').slice(1).join(' ') || '');
  const derivedName      = member?.first_name ? `${member.first_name} ${member.last_name}` : displayName;
  const derivedEmail     = member?.email ?? email;
  const derivedInitials  = member?.first_name
    ? (member.first_name[0] + (member.last_name ? member.last_name[0] : '')).toUpperCase()
    : initials;

  const dob              = member?.date_of_birth ?? null;
  const gender           = member?.gender ?? null;
  const marital          = member?.marital_status ?? null;
  const phone            = member?.phone_number ?? null;
  const whatsapp         = member?.whatsapp_number ?? null;
  const address          = member?.physical_address ?? null;
  const occupation       = member?.occupation ?? null;
  const facebook         = member?.facebook_url ?? null;
  const instagram        = member?.instagram_url ?? null;
  const profilePhoto     = member?.profile_photo_url ?? null;
  const status           = member?.membership_status ?? null;
  const joinDate         = member?.join_date ?? null;
  const ecName           = member?.emergency_contact_name ?? null;
  const ecPhone          = member?.emergency_contact_phone ?? null;
  const ecRel            = member?.emergency_contact_relationship ?? null;
  const assemblyDisplay  = (member as any)?.assemblyName ?? member?.assembly_id ?? '—';
  const householdDisplay = (member as any)?.householdName ?? (member?.household_id ? 'Assigned' : '—');

  // ── Avatar ────────────────────────────────────────────────────────────────
  const avatarInner = profilePhoto
    ? `<img src="${profilePhoto}" alt="${derivedName}" />`
    : `<span id="s-avatar-initials">${derivedInitials}</span>`;

  // ── Emergency contact card — only render if data exists ───────────────────
  const hasEmergency = ecName || ecPhone;
  const emergencyCard = hasEmergency ? card(
    'Emergency contact', 'heart-pulse',
    row2(
      field('Name', val(ecName)),
      field('Phone', val(ecPhone)),
    ) +
    row1(
      field('Relationship', cap(ecRel)),
    ),
    true,
  ) : '';

  // ── Render ────────────────────────────────────────────────────────────────
  return `
    <section class="settings-panel active" id="s-panel-profile">

      <!-- Notice banner -->
      <div class="prof-notice-banner">
        <i class="bi bi-info-circle-fill prof-notice-icon"></i>
        <div class="prof-notice-body">
          <strong>Profile editing coming soon</strong>
          <span>To correct any information, contact your assembly administrator.</span>
        </div>
      </div>

      <!-- Avatar row -->
      <div class="prof-avatar-row">
        <div class="settings-avatar prof-avatar-ro" title="Photo editing not yet available">
          ${avatarInner}
          <div class="settings-av-overlay prof-av-lock"><i class="bi bi-lock"></i></div>
        </div>
        <div class="prof-avatar-meta">
          <span class="prof-avatar-name">${derivedName}</span>
          <span class="prof-avatar-role">${cap(role)}</span>
          ${membershipNumber
            ? `<span class="prof-avatar-number">
                <i class="bi bi-lock prof-lock-icon"></i>${membershipNumber}
               </span>`
            : `<span class="prof-avatar-number prof-field-locked">
                <i class="bi bi-lock prof-lock-icon"></i>Membership number pending
               </span>`
          }
        </div>
      </div>

      <!-- Cards -->
      <div class="prof-cards">

        <!-- Personal -->
        ${card('Personal information', 'person',
          row2(
            field('First name',  val(firstName)),
            field('Last name',   val(lastName)),
          ) +
          row2(
            field('Date of birth', fmtDate(dob)),
            badgeField('Gender', cap(gender),
              gender === 'male' ? 'settings-badge-blue'
              : gender === 'female' ? 'settings-badge-yellow'
              : 'settings-badge-grey'),
          ) +
          row2(
            field('Marital status', cap(marital)),
            field('Occupation',     val(occupation)),
          ),
        )}

        <!-- Contact -->
        ${card('Contact information', 'telephone',
          row1(
            field('Email address', val(derivedEmail), ),
          ) +
          row2(
            field('Phone number',   val(phone)),
            field('WhatsApp',       val(whatsapp)),
          ) +
          row1(
            field('Physical address', val(address)),
          ),
        )}

        <!-- Social -->
        ${card('Social profiles', 'share',
          row1(linkField('Facebook',  facebook)) +
          row1(linkField('Instagram', instagram)),
        )}

        <!-- Emergency contact -->
        ${emergencyCard}

        <!-- Church & household -->
        ${card('Church & household', 'building',
          row2(
            badgeField('Membership status', friendlyStatus(status), statusBadgeClass(status)),
            field('Joined', fmtDate(joinDate)),
          ) +
          row2(
            field('Assembly',  assemblyDisplay),
            field('Household', householdDisplay),
          ),
          true,
        )}

      </div>

      <!-- Bottom CTA -->
      <div class="prof-cta-bar">
        <i class="bi bi-envelope-paper"></i>
        <span>Something look incorrect?</span>
        <button class="btn btn-ghost btn-sm" id="s-profile-contact-admin" disabled>
          Contact your administrator
        </button>
      </div>

    </section>

    <!-- Account panel — kept in DOM for tab shell -->
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

  // Contact admin button is disabled in V1

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