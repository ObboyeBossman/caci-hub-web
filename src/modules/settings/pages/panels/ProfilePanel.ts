// src/modules/settings/pages/panels/ProfilePanel.ts

import type { SettingsContext } from '../utils/settingsTypes';
import type { MemberView }      from '../../../../types/member.types';
import { getCurrentUser }       from '@core/auth';
import { updateMember }         from '../../../membership/repository';
import { UpdateMemberSchema }   from '../../../membership/schemas/member.schema';
import { authService }          from '../../../auth/services/authService';

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state (survives re-renders within the same overlay session)
// ─────────────────────────────────────────────────────────────────────────────

let _currentDisplayName = '';
let _currentEmail       = '';
let _currentRole        = '';
let _currentInitials    = '';
let _currentMember: Partial<MemberView> | undefined = undefined;

export function reRenderProfile(ctx: SettingsContext, editMode: boolean) {
  const profileContent = ctx.el.querySelector('#s-panel-profile');
  if (!profileContent?.parentElement) return;
  const wasActive = profileContent.classList.contains('active');
  const div = document.createElement('div');
  div.innerHTML = profilePanelHTML(
    _currentDisplayName,
    _currentEmail,
    _currentRole,
    _currentInitials,
    _currentMember,
    editMode
  );
  const newPanel = div.querySelector('#s-panel-profile') as HTMLElement;
  if (!newPanel) return;
  if (wasActive) newPanel.classList.add('active');
  profileContent.parentElement.replaceChild(newPanel, profileContent);
  bindProfilePanel(ctx);
}

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
    active:   'prof2-status-green',
    inactive: 'prof2-status-grey',
    visitor:  'prof2-status-blue',
    prospect: 'prof2-status-yellow',
    transfer: 'prof2-status-blue',
    deceased: 'prof2-status-grey',
  };
  return raw ? (map[raw] ?? 'prof2-status-grey') : 'prof2-status-grey';
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
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

function roField(label: string, value: string, opts: { mono?: boolean; locked?: boolean } = {}): string {
  const lockIcon = opts.locked
    ? `<i class="bi bi-lock prof2-lock-icon" title="System assigned"></i>`
    : '';
  const cls = ['prof2-field-value', opts.locked ? 'prof2-value-muted' : '', opts.mono ? 'prof2-value-mono' : ''].filter(Boolean).join(' ');
  return `
    <div class="prof2-field">
      <span class="prof2-field-label">${label}</span>
      <span class="${cls}">${lockIcon}${value}</span>
    </div>`;
}

function inputField(id: string, label: string, value: string, type = 'text'): string {
  return `
    <div class="prof2-field">
      <label class="prof2-field-label" for="${id}">${label}</label>
      <input class="mm-form-input prof2-input" id="${id}" type="${type}" value="${value.replace(/"/g, '&quot;')}">
    </div>`;
}

function selectField(id: string, label: string, value: string, options: {val: string; txt: string}[]): string {
  const opts = options.map(o => `<option value="${o.val}" ${value === o.val ? 'selected' : ''}>${o.txt}</option>`).join('');
  return `
    <div class="prof2-field">
      <label class="prof2-field-label" for="${id}">${label}</label>
      <select class="mm-form-select prof2-input" id="${id}">${opts}</select>
    </div>`;
}

function linkField(label: string, href: string | null | undefined): string {
  const display = href
    ? `<a href="${href}" target="_blank" rel="noreferrer" class="prof2-link">${href}</a>`
    : '<span class="prof2-field-value">—</span>';
  return `
    <div class="prof2-field">
      <span class="prof2-field-label">${label}</span>
      ${display}
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

export function profilePanelSkeleton(): string {
  const shimRow = `
    <div class="prof2-2col">
      <div class="prof2-field"><span class="prof-skeleton prof-sk-label"></span><span class="prof-skeleton prof-sk-value"></span></div>
      <div class="prof2-field"><span class="prof-skeleton prof-sk-label"></span><span class="prof-skeleton prof-sk-value"></span></div>
    </div>`;
  return `
    <section class="settings-panel active" id="s-panel-profile">
      <div class="prof2-header prof-skeleton" style="height:110px;border:none;margin-bottom:16px"></div>
      <div class="prof2-layout">
        <div class="prof2-main">
          <div class="prof2-card" style="padding:20px">${shimRow}${shimRow}${shimRow}</div>
        </div>
        <div class="prof2-sidebar">
          <div class="prof2-card prof2-card-accent" style="padding:20px">${shimRow}</div>
        </div>
      </div>
    </section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel HTML (read-only + edit mode)
// ─────────────────────────────────────────────────────────────────────────────

export function profilePanelHTML(
  displayName: string,
  email:       string,
  role:        string,
  initials:    string,
  member?:     Partial<MemberView>,
  editMode = false
): string {

  // Persist state for re-renders
  _currentDisplayName = displayName;
  _currentEmail       = email;
  _currentRole        = role;
  _currentInitials    = initials;
  _currentMember      = member;

  // Derived values
  const membershipNumber = member?.membership_number ?? null;
  const firstName   = member?.first_name  ?? displayName.split(' ')[0] ?? '';
  const lastName    = member?.last_name   ?? (displayName.split(' ').slice(1).join(' ') || '');
  const title       = (member as any)?.title ?? null;
  const derivedName = member?.first_name ? `${title ? title + ' ' : ''}${member.first_name} ${member.last_name}` : displayName;
  const derivedEmail    = member?.email ?? email;
  const derivedInitials = member?.first_name
    ? (firstName[0] + (lastName[0] ?? '')).toUpperCase()
    : initials;

  const dob      = member?.date_of_birth    ?? null;
  const gender   = member?.gender           ?? null;
  const marital  = member?.marital_status   ?? null;
  const phone    = member?.primary_phone    ?? null;
  const whatsapp = member?.whatsapp_number  ?? null;
  const address  = member?.physical_address ?? null;
  const occupation = member?.occupation     ?? null;
  const facebook   = member?.facebook_url   ?? null;
  const instagram  = member?.instagram_url  ?? null;
  const profilePhoto = member?.profile_photo_url ?? null;
  const status       = member?.membership_status  ?? null;
  const joinDate     = member?.join_date    ?? null;
  const ecName  = member?.emergency_contact_name          ?? null;
  const ecPhone = member?.emergency_contact_phone         ?? null;
  const ecRel   = member?.emergency_contact_relationship  ?? null;
  const assemblyDisplay  = (member as any)?.assemblyName  ?? member?.assembly_id ?? '—';
  const householdDisplay = (member as any)?.householdName ?? (member?.household_id ? 'Assigned' : '—');

  // Avatar
  const avatarInner = profilePhoto
    ? `<img src="${profilePhoto}" alt="${derivedName}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;">`
    : `<span id="s-avatar-initials">${derivedInitials}</span>`;

  // Edit banner
  const editBanner = editMode ? `
    <div class="prof2-edit-notice">
      <i class="bi bi-pencil-square"></i>
      <span><strong>Editing your profile</strong> — changes are saved to your system records immediately.</span>
    </div>` : '';

  // ── Personal Information card ────────────────────────────────────────────
  const personalContent = editMode ? `
    <div class="prof2-2col">
      ${inputField('pe-firstName', 'First name', firstName)}
      ${inputField('pe-lastName',  'Last name',  lastName)}
    </div>
    <div class="prof2-2col">
      ${inputField('pe-dob', 'Date of birth', dob || '', 'date')}
      ${selectField('pe-gender', 'Gender', gender || '', [
        {val:'', txt:'Select…'},
        {val:'male',   txt:'Male'},
        {val:'female', txt:'Female'},
      ])}
    </div>
    <div class="prof2-2col">
      ${selectField('pe-marital', 'Marital status', marital || '', [
        {val:'', txt:'Select…'},
        {val:'single',    txt:'Single'},
        {val:'married',   txt:'Married'},
        {val:'divorced',  txt:'Divorced'},
        {val:'widowed',   txt:'Widowed'},
        {val:'separated', txt:'Separated'},
      ])}
      ${inputField('pe-occupation', 'Occupation', occupation || '')}
    </div>` : `
    <div class="prof2-2col">
      ${roField('First name', val(firstName))}
      ${roField('Last name',  val(lastName))}
    </div>
    <div class="prof2-2col">
      ${roField('Date of birth', fmtDate(dob))}
      ${roField('Gender', cap(gender))}
    </div>
    <div class="prof2-2col">
      ${roField('Marital status', cap(marital))}
      ${roField('Occupation',     val(occupation))}
    </div>`;

  // ── Contact card ─────────────────────────────────────────────────────────
  const contactContent = editMode ? `
    ${inputField('pe-email',    'Email address', derivedEmail, 'email')}
    ${inputField('pe-phone',    'Phone number',  phone    || '', 'tel')}
    ${inputField('pe-whatsapp', 'WhatsApp',      whatsapp || '', 'tel')}` : `
    <div class="prof2-field">
      <span class="prof2-field-label">Email address</span>
      ${derivedEmail
        ? `<a href="mailto:${derivedEmail}" class="prof2-link">${derivedEmail}</a>`
        : `<span class="prof2-field-value">—</span>`}
    </div>
    ${roField('Phone number', val(phone))}
    ${roField('WhatsApp',     val(whatsapp))}`;

  // ── Social tiles ─────────────────────────────────────────────────────────
  function socialTile(icon: string, label: string, href: string | null | undefined): string {
    const link = href ? href : null;
    return `
      <div class="prof2-social-tile ${link ? 'prof2-social-linked' : ''}">
        <div class="prof2-social-icon"><i class="bi bi-${icon}"></i></div>
        <div class="prof2-social-info">
          <span class="prof2-field-label">${label.toUpperCase()}</span>
          ${link
            ? `<a href="${link}" target="_blank" rel="noreferrer" class="prof2-link prof2-social-value">${link}</a>`
            : `<span class="prof2-social-value prof2-social-empty">Not linked</span>`}
        </div>
        ${link
          ? `<i class="bi bi-box-arrow-up-right prof2-social-action"></i>`
          : `<i class="bi bi-plus-circle prof2-social-action prof2-social-add"></i>`}
      </div>`;
  }

  // ── Emergency contact (only if data exists or editing)
  const hasEmergency = ecName || ecPhone || editMode;
  const emergencySection = hasEmergency ? `
    <div class="prof2-card prof2-section-full">
      <div class="prof2-card-head">
        <i class="bi bi-heart-pulse prof2-card-icon"></i>
        <span class="prof2-card-title">Emergency contact</span>
        <span class="prof2-admin-badge"><i class="bi bi-shield-lock"></i> Admin managed</span>
      </div>
      <div class="prof2-card-body">
        <div class="prof2-2col">
          ${roField('Name',         val(ecName),  { locked: true })}
          ${roField('Phone',        val(ecPhone), { locked: true })}
        </div>
        ${roField('Relationship', cap(ecRel), { locked: true })}
      </div>
    </div>` : '';

  // ── Church & household card ───────────────────────────────────────────────
  const churchSection = `
    <div class="prof2-card prof2-section-full">
      <div class="prof2-card-head">
        <i class="bi bi-building prof2-card-icon"></i>
        <span class="prof2-card-title">Church &amp; household</span>
        <span class="prof2-admin-badge"><i class="bi bi-shield-lock"></i> Admin managed</span>
      </div>
      <div class="prof2-card-body">
        <div class="prof2-2col">
          <div class="prof2-field">
            <span class="prof2-field-label">Membership status</span>
            <span class="prof2-status-badge ${statusBadgeClass(status)}">${friendlyStatus(status)}</span>
          </div>
          ${roField('Joined', fmtDate(joinDate), { locked: true })}
        </div>
        <div class="prof2-2col">
          ${roField('Assembly',  assemblyDisplay,  { locked: true })}
          ${roField('Household', householdDisplay, { locked: true })}
        </div>
      </div>
    </div>`;

  // ── Footer bar ───────────────────────────────────────────────────────────
  const footer = editMode ? `
    <div class="prof2-footer">
      <span class="prof2-footer-hint"><i class="bi bi-info-circle"></i> Changes update your member record immediately.</span>
      <div class="prof2-footer-actions">
        <button class="btn btn-ghost btn-sm" id="s-profile-cancel">Cancel</button>
        <button class="btn btn-primary btn-sm" id="s-profile-save">
          <i class="bi bi-check2"></i> Save Changes
        </button>
      </div>
    </div>` : '';

  return `
    <section class="settings-panel active" id="s-panel-profile">

      ${editBanner}

      <!-- Profile header card -->
      <div class="prof2-header">
        <div class="prof2-header-left">
          <div class="settings-avatar prof2-avatar prof-avatar-ro" title="Photo editing not yet available">
            ${avatarInner}
            <div class="settings-av-overlay prof-av-lock"><i class="bi bi-lock"></i></div>
          </div>
          <div class="prof2-avatar-meta">
            <span class="prof2-name">${derivedName}</span>
            <div class="prof2-meta-row">
              <span class="prof2-role-badge">${cap(role)}</span>
              ${membershipNumber
                ? `<span class="prof2-mem-pill"><i class="bi bi-lock prof-lock-icon"></i>${membershipNumber}</span>`
                : `<span class="prof2-mem-pill prof2-value-muted"><i class="bi bi-lock prof-lock-icon"></i>Membership number pending</span>`}
            </div>
          </div>
        </div>
        ${!editMode ? `
        <button class="btn btn-ghost btn-sm prof2-edit-btn" id="s-profile-edit">
          <i class="bi bi-pencil-square"></i> Edit Profile
        </button>` : ''}
      </div>

      <!-- Main layout grid -->
      <div class="prof2-layout">

        <!-- Personal information -->
        <div class="prof2-main">
          <div class="prof2-card">
            <div class="prof2-card-head">
              <i class="bi bi-person-check prof2-card-icon"></i>
              <span class="prof2-card-title">Personal information</span>
            </div>
            <div class="prof2-card-body">
              ${personalContent}
            </div>
          </div>
        </div>

        <!-- Sidebar: Contact + Address -->
        <div class="prof2-sidebar">

          <!-- Contact -->
          <div class="prof2-card prof2-card-accent">
            <div class="prof2-card-head">
              <i class="bi bi-envelope prof2-card-icon"></i>
              <span class="prof2-card-title">Contact</span>
            </div>
            <div class="prof2-card-body">
              ${contactContent}
            </div>
          </div>

          <!-- Address -->
          <div class="prof2-card">
            <div class="prof2-card-head">
              <i class="bi bi-geo-alt prof2-card-icon"></i>
              <span class="prof2-card-title">Address</span>
            </div>
            <div class="prof2-card-body">
              ${editMode
                ? inputField('pe-address', 'Physical address', address || '')
                : `<p class="prof2-address-text">${val(address)}</p>`}
            </div>
          </div>

        </div>
      </div>

      <!-- Social profiles (full-width) -->
      <div class="prof2-card prof2-section-full">
        <div class="prof2-card-head">
          <i class="bi bi-share prof2-card-icon"></i>
          <span class="prof2-card-title">Social profiles</span>
        </div>
        <div class="prof2-card-body prof2-social-grid">
          ${socialTile('facebook', 'Facebook',  facebook)}
          ${socialTile('instagram', 'Instagram', instagram)}
        </div>
      </div>

      ${emergencySection}
      ${churchSection}
      ${footer}

    </section>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bindings
// ─────────────────────────────────────────────────────────────────────────────

export function bindProfilePanel(ctx: SettingsContext): void {
  const { el, toast } = ctx;

  el.querySelector('#s-profile-edit')?.addEventListener('click', () => {
    reRenderProfile(ctx, true);
  });

  el.querySelector('#s-profile-cancel')?.addEventListener('click', () => {
    reRenderProfile(ctx, false);
  });

  el.querySelector('#s-profile-save')?.addEventListener('click', async () => {
    const memId = _currentMember?.id;
    if (!memId) { toast('Error: Member ID missing', 'error'); return; }

    const getVal = (id: string) =>
      (el.querySelector(`#${id}`) as HTMLInputElement)?.value.trim() || undefined;

    const firstName = getVal('pe-firstName');
    const lastName  = getVal('pe-lastName');
    if (!firstName || !lastName) {
      toast('First and last name are required.', 'error');
      return;
    }

    const payload: any = {
      id:               memId,
      first_name:       firstName,
      last_name:        lastName,
      date_of_birth:    getVal('pe-dob'),
      gender:           getVal('pe-gender'),
      marital_status:   getVal('pe-marital'),
      occupation:       getVal('pe-occupation'),
      email:            getVal('pe-email'),
      primary_phone:    getVal('pe-phone'),
      whatsapp_number:  getVal('pe-whatsapp'),
      physical_address: getVal('pe-address'),
    };

    // Clean empty strings → undefined
    Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = undefined; });

    const parse = UpdateMemberSchema.safeParse(payload);
    if (!parse.success) {
      // @ts-ignore
      toast(parse.error.errors[0]?.message ?? 'Validation failed', 'error');
      return;
    }

    const btn = el.querySelector('#s-profile-save') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving…';

    try {
      const updated = await updateMember(memId, parse.data);
      _currentMember = { ..._currentMember, ...updated };
      toast('Profile updated successfully');
      reRenderProfile(ctx, false);
    } catch (err: any) {
      toast(err?.message || 'Failed to update profile', 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-check2"></i> Save Changes';
    }
  });

  // Password modal triggers (from Account panel)
  el.querySelector('#s-change-pwd-btn')?.addEventListener('click', () => {
    el.querySelector<HTMLElement>('#s-pwd-overlay')!.classList.add('open');
  });
  el.querySelector('#s-pwd-cancel-btn')?.addEventListener('click', () => {
    el.querySelector<HTMLElement>('#s-pwd-overlay')!.classList.remove('open');
  });
  el.querySelector('#s-pwd-save-btn')?.addEventListener('click', async () => {
    const cur  = (el.querySelector<HTMLInputElement>('#s-pwd-current'))!;
    const nw   = (el.querySelector<HTMLInputElement>('#s-pwd-new'))!;
    const conf = (el.querySelector<HTMLInputElement>('#s-pwd-confirm'))!;
    const saveBtn = el.querySelector<HTMLButtonElement>('#s-pwd-save-btn')!;

    if (!cur.value)          { toast('Enter your current password', 'error'); return; }
    if (nw.value.length < 8) { toast('New password must be at least 8 characters', 'error'); return; }
    if (nw.value !== conf.value) { toast('Passwords do not match', 'error'); return; }

    // Disable save button and show loading state
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Updating…';

    try {
      const user = getCurrentUser();

      // Re-authenticate to verify current password
      if (user?.email) {
        await authService.signIn({ email: user.email }, cur.value);
      } else if (user?.phone) {
        await authService.signIn({ phone: user.phone }, cur.value);
      } else {
        throw new Error('No email or phone on account — cannot verify identity.');
      }

      // Update to new password
      await authService.updatePassword(nw.value);

      // Success
      el.querySelector<HTMLElement>('#s-pwd-overlay')!.classList.remove('open');
      cur.value = ''; nw.value = ''; conf.value = '';
      toast('Password updated successfully');
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('password')) {
        toast('Current password is incorrect', 'error');
      } else {
        toast(err?.message || 'Failed to update password', 'error');
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Update password';
    }
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