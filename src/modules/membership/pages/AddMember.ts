// src/modules/membership/pages/AddMember.ts
// Full-page host that mounts the Add Member right-drawer overlay.
// The drawer uses the existing mm-modal-overlay + mm-modal-drawer classes.
// Navigation: 4-step stepper with circular progress indicator.

import { formatName } from '@modules/membership/utils/member-helpers'
import type { PageModule }           from '../../../types/module.types'
import { Toast }                     from '@shared/components/Toast'
import { navigate }                  from '@core/router'
import { registerMember }            from '../services/memberService'
import { getHouseholdDropdownItems } from '../repository'
import { CreateMemberSchema }        from '../schemas/member.schema'
import { injectMembershipCSS }       from '../utils/member-helpers'
import { PhoneInput }                from '@shared/components/PhoneInput'

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Personal Info',      next: 'Contact Details'   },
  { label: 'Contact Details',    next: 'Membership Info'   },
  { label: 'Membership Info',    next: 'Emergency Contact' },
  { label: 'Emergency Contact',  next: 'Review & Register' },
]

// ── State ─────────────────────────────────────────────────────────────────────
let _step = 0
let _container: HTMLElement | null = null
let _primaryPhone: PhoneInput | null = null
let _secondaryPhone: PhoneInput | null = null

// ── Module ────────────────────────────────────────────────────────────────────
const AddMember: PageModule = {
  async render(container) {
    injectMembershipCSS()
    _injectStepperCSS()
    _step = 0
    _container = container

    container.innerHTML = _buildPageShell()

    // Open overlay on next tick so CSS transition fires
    requestAnimationFrame(() => {
      container.querySelector('.mm-modal-overlay')?.classList.add('open')
      container.querySelector('.mm-modal-centred')?.classList.add('open')
    })

    // ── Mount PhoneInput components into step 1 ───────────────────────────────
    const primaryPhoneSlot = container.querySelector<HTMLElement>('#am-phone-primary-slot')
    const secondaryPhoneSlot = container.querySelector<HTMLElement>('#am-phone-secondary-slot')

    if (primaryPhoneSlot) {
      _primaryPhone = new PhoneInput({
        id:           'am-primary',
        placeholder:  '24 123 4567',
        selectClass:  'mm-form-select',
        inputClass:   'mm-form-input',
      })
      _primaryPhone.mount(primaryPhoneSlot)
    }

    if (secondaryPhoneSlot) {
      _secondaryPhone = new PhoneInput({
        id:           'am-secondary',
        placeholder:  '24 123 4567',
        selectClass:  'mm-form-select',
        inputClass:   'mm-form-input',
      })
      _secondaryPhone.mount(secondaryPhoneSlot)
    }

    // Populate household dropdown (step 3)
    try {
      const items = await getHouseholdDropdownItems()
      const sel = container.querySelector<HTMLSelectElement>('#am-fHousehold')
      if (sel) {
        items.forEach(h => {
          const o = document.createElement('option')
          o.value = h.id
          o.textContent = h.family_name
          sel.appendChild(o)
        })
      }
    } catch { /* non-fatal */ }

    // Default join date
    const jEl = container.querySelector<HTMLInputElement>('#am-fJoined')
    if (jEl) jEl.value = new Date().toISOString().split('T')[0]

    // Photo preview
    container.querySelector('#am-photoInput')?.addEventListener('change', e => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => {
        const preview = container.querySelector<HTMLElement>('#am-photoPreview')
        const placeholder = container.querySelector<HTMLElement>('#am-photoPlaceholder')
        if (preview && ev.target?.result) {
          preview.style.backgroundImage = `url(${ev.target.result})`
          preview.style.display = 'block'
          if (placeholder) placeholder.style.display = 'none'
        }
      }
      reader.readAsDataURL(file)
    })

    // Close / cancel — only the explicit close button dismisses the overlay;
    // clicking the backdrop is intentionally ignored to prevent accidental closes.
    container.querySelector('#am-close-btn')?.addEventListener('click', () => _close(container))

    // Step navigation
    container.querySelector('#am-btn-next')?.addEventListener('click', () => _next(container))
    container.querySelector('#am-btn-back')?.addEventListener('click', () => _back(container))
    container.querySelector('#am-btn-submit')?.addEventListener('click', () => _submit(container))

    _renderStep(container)
  },

  destroy() {
    _primaryPhone   = null
    _secondaryPhone = null
    _container      = null
  },
}

export default AddMember

// ── Close drawer ──────────────────────────────────────────────────────────────
function _close(container: HTMLElement) {
  container.querySelector('.mm-modal-overlay')?.classList.remove('open')
  container.querySelector('.mm-modal-centred')?.classList.remove('open')
  setTimeout(() => navigate('/members'), 300)
}

// ── Step rendering ────────────────────────────────────────────────────────────
function _renderStep(container: HTMLElement) {
  const total   = STEPS.length
  const current = STEPS[_step]!

  // ── Circular progress ─────────────────────────────────────────────────────
  const pct   = ((_step) / total) * 100
  const circ  = 2 * Math.PI * 20 // r=20
  const dash  = (pct / 100) * circ
  const gap   = circ - dash

  const circEl = container.querySelector('#am-circ-progress')
  if (circEl) {
    circEl.setAttribute('stroke-dasharray', `${dash.toFixed(1)} ${gap.toFixed(1)}`)
  }
  const counterEl = container.querySelector('#am-step-counter')
  if (counterEl) counterEl.textContent = `${_step + 1} of ${total}`

  const titleEl = container.querySelector('#am-step-title')
  if (titleEl) titleEl.textContent = current.label

  const subtitleEl = container.querySelector('#am-step-subtitle')
  if (subtitleEl) {
    subtitleEl.textContent = _step < total - 1
      ? `Next: ${current.next}`
      : 'Ready to register'
  }

  // ── Show/hide steps ───────────────────────────────────────────────────────
  for (let i = 0; i < total; i++) {
    const el = container.querySelector<HTMLElement>(`#am-step-${i}`)
    if (el) el.style.display = i === _step ? 'block' : 'none'
  }

  // ── Back / Next / Submit buttons ──────────────────────────────────────────
  const btnBack   = container.querySelector<HTMLButtonElement>('#am-btn-back')
  const btnNext   = container.querySelector<HTMLButtonElement>('#am-btn-next')
  const btnSubmit = container.querySelector<HTMLButtonElement>('#am-btn-submit')

  if (btnBack)   btnBack.style.display   = _step === 0 ? 'none' : 'inline-flex'
  if (btnNext)   btnNext.style.display   = _step < total - 1 ? 'inline-flex' : 'none'
  if (btnSubmit) btnSubmit.style.display = _step === total - 1 ? 'inline-flex' : 'none'

  // ── Progress dots ─────────────────────────────────────────────────────────
  container.querySelectorAll('.am-dot').forEach((dot, i) => {
    dot.classList.toggle('am-dot-active', i === _step)
    dot.classList.toggle('am-dot-done',   i < _step)
  })
}

// ── Validate current step ─────────────────────────────────────────────────────
function _validateStep(container: HTMLElement): boolean {
  const show = (id: string, inputId: string) => {
    container.querySelector(`#${id}`)?.classList.add('show')
    container.querySelector(`#${inputId}`)?.classList.add('error')
  }
  const hide = (id: string, inputId: string) => {
    container.querySelector(`#${id}`)?.classList.remove('show')
    container.querySelector(`#${inputId}`)?.classList.remove('error')
  }
  const val = (id: string) =>
    (container.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)?.value ?? '').trim()

  if (_step === 0) {
    let ok = true
    if (!val('am-fFirstName')) { show('am-err-firstName', 'am-fFirstName'); ok = false }
    else hide('am-err-firstName', 'am-fFirstName')
    if (!val('am-fLastName'))  { show('am-err-lastName',  'am-fLastName');  ok = false }
    else hide('am-err-lastName', 'am-fLastName')
    if (!val('am-fGender'))    { show('am-err-gender',    'am-fGender');    ok = false }
    else hide('am-err-gender', 'am-fGender')
    return ok
  }

  if (_step === 1) {
    return true
  }

  return true
}

function _next(container: HTMLElement) {
  if (!_validateStep(container)) return
  if (_step < STEPS.length - 1) {
    _step++
    _renderStep(container)
    container.querySelector('.mm-modal-body')?.scrollTo(0, 0)
  }
}

function _back(container: HTMLElement) {
  if (_step > 0) {
    _step--
    _renderStep(container)
    container.querySelector('.mm-modal-body')?.scrollTo(0, 0)
  }
}

// ── Submit ────────────────────────────────────────────────────────────────────
async function _submit(container: HTMLElement): Promise<void> {
  if (!_validateStep(container)) return

  const get = (id: string) =>
    (container.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`#${id}`)?.value ?? '').trim()

  const payload = {
    title:                           get('am-fTitle') || null,
    first_name:                      get('am-fFirstName'),
    last_name:                       get('am-fLastName'),
    other_names:                     get('am-fOtherNames') || null,
    gender:                          get('am-fGender') as 'male' | 'female',
    date_of_birth:                   get('am-fDOB') || null,
    marital_status:                  (get('am-fMarital') || null) as any,
    occupation:                      get('am-fOccupation') || null,
    primary_phone:                   _primaryPhone?.getValue()   || null,
    secondary_phone:                 _secondaryPhone?.getValue() || null,
    email:                           get('am-fEmail') || null,
    physical_address:                get('am-fAddress') || null,
    whatsapp_number:                 get('am-fWhatsapp') || null,
    facebook_url:                    get('am-fFacebook') || null,
    instagram_url:                   get('am-fInstagram') || null,
    membership_status:               (get('am-fStatus') || 'visitor') as any,
    join_date:                       get('am-fJoined') || null,
    household_id:                    get('am-fHousehold') || null,
    emergency_contact_name:          get('am-fECName') || null,
    emergency_contact_phone:         get('am-fECPhone') || null,
    emergency_contact_relationship:  get('am-fECRel') || null,
    pastoral_notes:                  get('am-fNotes') || null,
  }

  const parse = CreateMemberSchema.safeParse({
    assembly_id: '00000000-0000-0000-0000-000000000000',
    ...payload,
  })
  if (!parse.success) {
    Toast.error(parse.error.errors[0]?.message ?? 'Validation failed')
    return
  }

  const btn = container.querySelector<HTMLButtonElement>('#am-btn-submit')!
  btn.disabled = true
  btn.innerHTML = `<svg class="am-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83
    M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
    Registering…`

  try {
    const result = await registerMember(payload)
    let msg = `${formatName(payload.first_name, payload.last_name, payload.title)} registered successfully.`
    if (result.membershipNumber) msg += ` Membership #: ${result.membershipNumber}`
    Toast.success(msg)
    navigate(`/members/${result.member.id}`)
  } catch (err) {
    Toast.fromError(err)
    btn.disabled = false
    btn.textContent = 'Register Member'
  }
}

// ── Shell HTML ────────────────────────────────────────────────────────────────
function _buildPageShell(): string {
  return `
<div class="mm-root">
  <!-- Overlay backdrop -->
  <div class="mm-modal-overlay" id="am-overlay-bg"></div>

  <!-- Right drawer -> Centered Modal -->
  <div class="mm-modal-centred" style="width:min(540px,96vw);">

    <!-- Header -->
    <div class="mm-modal-header">
      <div style="display:flex;align-items:center;gap:14px;">
        <!-- Circular progress indicator -->
        <div style="position:relative;width:52px;height:52px;flex-shrink:0;">
          <svg width="52" height="52" viewBox="0 0 52 52">
            <!-- Track -->
            <circle cx="26" cy="26" r="20" fill="none"
              stroke="var(--mm-border)" stroke-width="3.5"/>
            <!-- Progress arc — starts at top (rotate -90deg) -->
            <circle id="am-circ-progress" cx="26" cy="26" r="20" fill="none"
              stroke="var(--mm-blue)" stroke-width="3.5"
              stroke-linecap="round"
              stroke-dasharray="0 125.7"
              transform="rotate(-90 26 26)"
              style="transition:stroke-dasharray .4s cubic-bezier(.4,0,.2,1)"/>
          </svg>
          <!-- Counter label centred -->
          <div id="am-step-counter" style="position:absolute;inset:0;display:flex;
            align-items:center;justify-content:center;font-size: var(--text-xs);font-weight:700;
            color:var(--mm-blue);line-height:1;">1 of 4</div>
        </div>

        <div>
          <div id="am-step-title" style="font-size: var(--text-lg);font-weight:700;
            color:var(--mm-text-primary);line-height:1.2;">Personal Info</div>
          <div id="am-step-subtitle" style="font-size: var(--text-sm);color:var(--mm-text-muted);
            margin-top:3px;">Next: Contact Details</div>
        </div>
      </div>

      <!-- Dots + close -->
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="display:flex;gap:5px;align-items:center;">
          ${[0,1,2,3].map(i => `<div class="am-dot${i===0?' am-dot-active':''}"
            data-step="${i}"></div>`).join('')}
        </div>
        <button class="mm-modal-close" id="am-close-btn">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- Scrollable body -->
    <div class="mm-modal-body">

      <!-- ── Step 0: Personal Info ── -->
      <div id="am-step-0">
        <div style="display:flex;gap:20px;align-items:flex-start;margin-bottom:20px;">
          <!-- Photo upload -->
          <div style="flex-shrink:0;">
            <div style="position:relative;width:80px;height:80px;border-radius:50%;
              background:var(--mm-bg-card2);border:2px dashed var(--mm-border);
              cursor:pointer;overflow:hidden;display:flex;align-items:center;
              justify-content:center;" onclick="document.getElementById('am-photoInput').click()">
              <div id="am-photoPreview" style="display:none;position:absolute;inset:0;
                background-size:cover;background-position:center;border-radius:50%;"></div>
              <div id="am-photoPlaceholder" style="text-align:center;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="var(--mm-text-muted)" stroke-width="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <div style="font-size: var(--text-xs);color:var(--mm-text-muted);margin-top:3px;line-height:1.2;">
                  Add Photo
                </div>
              </div>
            </div>
            <input type="file" id="am-photoInput" accept="image/*" style="display:none;">
          </div>

          <!-- Title + name -->
          <div style="flex:1;display:flex;flex-direction:column;gap:12px;">
            <div class="mm-form-field" style="margin-bottom:0;">
              <label class="mm-form-label">Title</label>
              <select class="mm-form-select" id="am-fTitle" style="max-width:180px;">
                <option value="">None</option>
                <option value="Mr.">Mr.</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Ms.">Ms.</option>
                <option value="Miss">Miss</option>
                <option value="Dr.">Dr.</option>
                <option value="Prof.">Prof.</option>
                <option value="Rev.">Rev.</option>
                <option value="Pastor">Pastor</option>
                <option value="Elder">Elder</option>
                <option value="Deacon">Deacon</option>
                <option value="Deaconess">Deaconess</option>
                <option value="Apostle">Apostle</option>
                <option value="Bishop">Bishop</option>
              </select>
            </div>
          </div>
        </div>

        <div class="mm-form-row">
          <div class="mm-form-field">
            <label class="mm-form-label">First Name <span class="req">*</span></label>
            <input class="mm-form-input" id="am-fFirstName" placeholder="First name" autocomplete="given-name">
            <div class="mm-form-error" id="am-err-firstName">First name is required.</div>
          </div>
          <div class="mm-form-field">
            <label class="mm-form-label">Last Name <span class="req">*</span></label>
            <input class="mm-form-input" id="am-fLastName" placeholder="Last name" autocomplete="family-name">
            <div class="mm-form-error" id="am-err-lastName">Last name is required.</div>
          </div>
        </div>

        <div class="mm-form-field">
          <label class="mm-form-label">Other Names</label>
          <input class="mm-form-input" id="am-fOtherNames" placeholder="Middle name or other names">
        </div>

        <div class="mm-form-row">
          <div class="mm-form-field">
            <label class="mm-form-label">Gender <span class="req">*</span></label>
            <select class="mm-form-select" id="am-fGender">
              <option value="">Select gender…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <div class="mm-form-error" id="am-err-gender">Gender is required.</div>
          </div>
          <div class="mm-form-field">
            <label class="mm-form-label">Date of Birth</label>
            <input class="mm-form-input" id="am-fDOB" type="date">
          </div>
        </div>

        <div class="mm-form-row">
          <div class="mm-form-field">
            <label class="mm-form-label">Marital Status</label>
            <select class="mm-form-select" id="am-fMarital">
              <option value="">Select…</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
              <option value="separated">Separated</option>
            </select>
          </div>
          <div class="mm-form-field">
            <label class="mm-form-label">Occupation</label>
            <input class="mm-form-input" id="am-fOccupation" placeholder="Job title or profession">
          </div>
        </div>
      </div>

      <!-- ── Step 1: Contact Details ── -->
      <div id="am-step-1" style="display:none;">
        <div class="mm-form-section-title">Phone Numbers</div>
        <div class="mm-form-row">
          <div class="mm-form-field">
            <label class="mm-form-label">Primary Phone</label>
            <!-- PhoneInput mounts here -->
            <div id="am-phone-primary-slot"></div>
          </div>
          <div class="mm-form-field">
            <label class="mm-form-label">Secondary Phone</label>
            <!-- PhoneInput mounts here -->
            <div id="am-phone-secondary-slot"></div>
          </div>
        </div>

        <div class="mm-form-section-title">Email & Address</div>
        <div class="mm-form-field">
          <label class="mm-form-label">Email Address</label>
          <input class="mm-form-input" id="am-fEmail" type="email"
            placeholder="email@example.com" autocomplete="email">
        </div>
        <div class="mm-form-field">
          <label class="mm-form-label">Physical Address</label>
          <input class="mm-form-input" id="am-fAddress" placeholder="Home address">
        </div>

        <div class="mm-form-section-title">Social Media <span style="font-weight:400;text-transform:none;letter-spacing:0;">(optional)</span></div>
        <div class="mm-form-field">
          <label class="mm-form-label">WhatsApp Number</label>
          <input class="mm-form-input" id="am-fWhatsapp" type="tel" placeholder="+233 …">
        </div>
        <div class="mm-form-row">
          <div class="mm-form-field">
            <label class="mm-form-label">Facebook URL</label>
            <input class="mm-form-input" id="am-fFacebook" placeholder="https://facebook.com/…">
          </div>
          <div class="mm-form-field">
            <label class="mm-form-label">Instagram URL</label>
            <input class="mm-form-input" id="am-fInstagram" placeholder="https://instagram.com/…">
          </div>
        </div>
      </div>

      <!-- ── Step 2: Membership Info ── -->
      <div id="am-step-2" style="display:none;">
        <div class="mm-form-section-title">Membership Details</div>
        <div class="mm-form-row">
          <div class="mm-form-field">
            <label class="mm-form-label">Membership Status</label>
            <select class="mm-form-select" id="am-fStatus">
              <option value="visitor">Visitor</option>
              <option value="active">Active Member</option>
              <option value="prospect">Prospect</option>
              <option value="inactive">Inactive</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <div class="mm-form-field">
            <label class="mm-form-label">Join Date</label>
            <input class="mm-form-input" id="am-fJoined" type="date">
          </div>
        </div>

        <div class="mm-form-field">
          <label class="mm-form-label">Household</label>
          <select class="mm-form-select" id="am-fHousehold">
            <option value="">— None —</option>
          </select>
          <div style="font-size: var(--text-sm);color:var(--mm-text-muted);margin-top:4px;">
            Assign to an existing household, or leave blank.
          </div>
        </div>
      </div>

      <!-- ── Step 3: Emergency Contact ── -->
      <div id="am-step-3" style="display:none;">
        <div class="mm-form-section-title">Emergency Contact <span style="font-weight:400;text-transform:none;letter-spacing:0;">(optional)</span></div>
        <div class="mm-form-field">
          <label class="mm-form-label">Contact Name</label>
          <input class="mm-form-input" id="am-fECName" placeholder="Full name">
        </div>
        <div class="mm-form-row">
          <div class="mm-form-field">
            <label class="mm-form-label">Phone Number</label>
            <input class="mm-form-input" id="am-fECPhone" type="tel" placeholder="+233 …">
          </div>
          <div class="mm-form-field">
            <label class="mm-form-label">Relationship</label>
            <select class="mm-form-select" id="am-fECRel">
              <option value="">Select…</option>
              <option value="spouse">Spouse</option>
              <option value="parent">Parent</option>
              <option value="sibling">Sibling</option>
              <option value="child">Child</option>
              <option value="friend">Friend</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div class="mm-form-section-title" style="margin-top:24px;">Pastoral Notes
          <span style="font-weight:400;text-transform:none;letter-spacing:0;">
            (admin/pastor only)
          </span>
        </div>
        <div class="mm-form-field">
          <textarea class="mm-form-textarea" id="am-fNotes" rows="4"
            placeholder="Internal pastoral notes — not visible to the member…"></textarea>
        </div>

        <!-- Summary preview -->
        <div id="am-summary" style="background:var(--mm-bg-card2);border:1px solid var(--mm-border);
          border-radius:8px;padding:14px;margin-top:8px;">
          <div style="font-size: var(--text-sm);font-weight:600;color:var(--mm-text-muted);
            text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Registration Summary</div>
          <div id="am-summary-body" style="font-size: var(--text-base);color:var(--mm-text-secondary);
            line-height:1.8;"></div>
        </div>
      </div>

    </div><!-- /mm-modal-body -->

    <!-- Footer -->
    <div class="mm-modal-footer" style="justify-content:space-between;">
      <button class="mm-btn-outline" id="am-btn-back" style="display:none;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back
      </button>
      <div style="flex:1;"></div>
      <button class="mm-btn-primary" id="am-btn-next">
        Continue
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      <button class="mm-btn-primary" id="am-btn-submit" style="display:none;gap:8px;">
        Register Member
      </button>
    </div>

  </div><!-- /mm-modal-centred -->
</div>`
}

// ── Stepper CSS (injected once) ───────────────────────────────────────────────
let _stepperCSSInjected = false
function _injectStepperCSS() {
  if (_stepperCSSInjected) return
  _stepperCSSInjected = true
  const style = document.createElement('style')
  style.textContent = `
    /* Progress dots */
    .am-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--mm-border); transition: background .25s, transform .25s;
    }
    .am-dot-done   { background: var(--mm-blue); opacity: .45; }
    .am-dot-active { background: var(--mm-blue); transform: scale(1.35); }

    /* Spinner for submit button */
    @keyframes am-spin { to { transform: rotate(360deg); } }
    .am-spin { animation: am-spin .7s linear infinite; }

    /* Tighten modal body padding on mobile */
    @media (max-width: 540px) {
      .mm-modal-centred .mm-modal-body { padding: 16px; }
      .mm-modal-centred .mm-modal-footer { padding: 12px 16px; }
    }
  `
  document.head.appendChild(style)
}