// src/auth/login.ts
//
// Login screen — full CACI Hub sign-in UI.
//
// Responsibilities:
//   • Render the branded login UI into the #app element
//   • Handle the sign-in form submission via Supabase Auth
//   • On success: trigger the auth guard to route to the app shell
//   • On failure: surface errors via a dismissible bottom-right toast

import './auth.css'
import bgImage from '../asset/image/caci-congregation.jpg'
import { supabase } from '../core/supabase'
import { guardRoute } from './auth-guard'
import { showToast } from '../core/toast'
import { formatGhanaLocalDigits, isValidGhanaPhone as validateGhanaPhone, normalizeGhanaPhone } from '../core/phone'

export function renderLoginView(app: HTMLElement): void {
  app.id = 'auth-root'
  app.innerHTML = _buildLoginHTML()
  _attachLoginHandlers(app)
}

function _buildLoginHTML(): string {
  return `
  <!-- Background photo -->
  <div class="page-bg">
    <img src="${bgImage}" alt="" />
  </div>

  <div class="shell">
    <!-- Top bar -->
    <header class="topbar">
      <img class="topbar-logo" src="/caci-logo.jpeg" alt="CACI Logo" />
      <div>
        <div class="topbar-name">CACI Hub</div>
        <div class="topbar-sub">Assembly Management Platform</div>
      </div>
      <div class="topbar-links">
        <a href="#announcements">
          <span class="material-symbols-outlined">campaign</span>
          <span class="nav-label">Announcements</span>
        </a>
        <a href="#contact">
          <span class="material-symbols-outlined">mail</span>
          <span class="nav-label">Contact</span>
        </a>
        <a href="#support">
          <span class="material-symbols-outlined">help</span>
          <span class="nav-label">Support</span>
        </a>
      </div>
    </header>

    <!-- Main -->
    <main class="main">
      <div class="stage">
        
        <!-- Hero copy -->
        <div class="hero" aria-hidden="true">
          <div class="hero-eyebrow">Church System</div>
          <h1 class="hero-headline">
            One place for<br>every part of<br>our <span>assembly.</span>
          </h1>
          <p class="hero-sub">
            Manage attendance, groups, events, and pastoral care —
            for every member, across every assembly, in one unified hub.
          </p>
          
          <div class="hero-verse">
            <div class="verse-bar"></div>
            <div>
              <p class="verse-text">
                "And let us consider how we may spur one another on toward love and good deeds, not giving up meeting together..."
              </p>
              <span class="verse-ref">— Hebrews 10:24-25</span>
            </div>
          </div>
        </div>

        <!-- Login card -->
        <div class="card-wrap">
          <div class="card" role="main">
            <!-- Card header -->
            <div class="card-head">
              <div class="card-logo-ring">
                <img src="/caci-logo.jpeg" alt="CACI Logo" />
              </div>
              <div class="card-badge">
                <span class="badge-dot"></span>
                CACI Hub
              </div>
              <h2 class="card-title">Welcome back</h2>
              <p class="card-sub">Enter your phone number and password</p>
            </div>

            <!-- Form -->
            <form class="login-form" id="auth-login-form" novalidate>
              
              <!-- Phone Number -->
              <div class="field-group">
                <label class="field-label" for="phone">Phone Number</label>
                <div class="field-wrap">
                  <span class="fi-left">
                    <span class="material-symbols-outlined">call</span>
                  </span>
                  <input
                    class="field-input"
                    id="phone"
                    name="phone"
                    type="tel"
                    inputmode="numeric"
                    autocomplete="tel-national"
                    placeholder="024 412 3456"
                    maxlength="13"
                    required
                  />
                </div>
              </div>

              <!-- Password -->
              <div class="field-group">
                <label class="field-label" for="password">Password</label>
                <div class="field-wrap">
                  <span class="fi-left">
                    <span class="material-symbols-outlined">lock</span>
                  </span>
                  <input class="field-input" id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required />
                  <button type="button" class="fi-right" id="auth-toggle-password" aria-label="Toggle password visibility">
                    <span class="material-symbols-outlined" id="auth-eye-icon">visibility</span>
                  </button>
                </div>
              </div>

              <!-- Remember / forgot -->
              <div class="form-row">
                <label class="remember-wrap">
                  <input type="checkbox" name="remember" />
                  <span class="remember-label">Remember me</span>
                </label>
                <a href="#forgot" class="forgot-link">Forgot password?</a>
              </div>

              <!-- Submit -->
              <button class="sign-btn" id="auth-submit-btn" type="submit">
                <span class="material-symbols-outlined" id="auth-submit-icon">login</span>
                <span id="auth-submit-label">Sign in</span>
              </button>

              <div class="divider">
                <span></span>
                <p>Admin-provisioned accounts only</p>
                <span></span>
              </div>
              
              <p class="card-note">
                Don't have an account?<br>
                <strong>Contact your assembly admin</strong> to get access.
              </p>

            </form>
          </div>
        </div>

      </div>
    </main>

    <!-- Page footer -->
    <footer class="page-footer">
      <p class="footer-slogan">In His Name · Since 1938</p>
      <div class="footer-bar">
        <span>© 2026 Christ Apostolic Church International, Ghana</span>
        <div class="footer-links">
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
          <a href="#help">Help</a>
        </div>
      </div>
    </footer>

  </div>
  `
}

// ── Phone formatting ──────────────────────────────────────────────────────────
// Formats live input to Ghanaian local format: 0XX XXX XXXX (groups of 3-3-4).
// Numbers not starting with 0 are left as raw digits (no formatting).

function _formatPhoneInput(el: HTMLInputElement): void {
  const formatted = formatGhanaLocalDigits(el.value)
  if (formatted) {
    el.value = formatted
    return
  }

  el.value = el.value.replace(/\D/g, '').slice(0, 12)
}

function _resolvePhone(raw: string): string {
  const normalized = normalizeGhanaPhone(raw)
  if (!normalized) {
    return raw.replace(/\D/g, '')
  }
  return `+${normalized}`
}

function _isValidGhanaPhone(raw: string): boolean {
  return validateGhanaPhone(raw)
}



// ── Handlers ──────────────────────────────────────────────────────────────────

function _attachLoginHandlers(app: HTMLElement): void {
  const form       = app.querySelector<HTMLFormElement>('#auth-login-form')!
  const phoneInp   = app.querySelector<HTMLInputElement>('#phone')!
  const passInp    = app.querySelector<HTMLInputElement>('#password')!
  const toggleBtn  = app.querySelector<HTMLButtonElement>('#auth-toggle-password')!
  const eyeIcon    = app.querySelector<HTMLSpanElement>('#auth-eye-icon')!
  const submitBtn  = app.querySelector<HTMLButtonElement>('#auth-submit-btn')!
  const submitLbl  = app.querySelector<HTMLSpanElement>('#auth-submit-label')!
  const submitIcon = app.querySelector<HTMLSpanElement>('#auth-submit-icon')!

  // ── Live phone formatting ───────────────────────────────────────────────────
  phoneInp.addEventListener('input', () => _formatPhoneInput(phoneInp))

  // ── Toggle password visibility ──────────────────────────────────────────────
  toggleBtn.addEventListener('click', () => {
    const isText = passInp.type === 'text'
    passInp.type = isText ? 'password' : 'text'
    eyeIcon.textContent = isText ? 'visibility' : 'visibility_off'
  })

  // ── Form submission ─────────────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    const rawPhone = phoneInp.value.trim()
    const password = passInp.value

    if (!rawPhone || !password) {
      showToast('Validation Error', 'Please enter your phone number and password.', 'warning')
      return
    }

    if (!_isValidGhanaPhone(rawPhone)) {
      showToast('Invalid Phone', 'Please enter a valid 10-digit Ghana number.', 'warning')
      return
    }

    const phone = _resolvePhone(rawPhone) // → 233XXXXXXXXX

    // Loading state
    submitBtn.disabled = true
    submitLbl.textContent = 'Signing in…'
    submitIcon.classList.add('spin')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ phone, password })

      if (error) throw error

      if (!data.session) {
        throw new Error('Sign-in succeeded but no session was returned.')
      }

      console.log('[login] Authenticated:', data.session.user.phone)

      app.id = 'app'
      guardRoute(app, data.session)

    } catch (err: unknown) {
      const msg = err instanceof Error
        ? _friendlyAuthError(err.message)
        : 'An unexpected error occurred. Please try again.'
      showToast('Authentication Failed', msg, 'error')
    } finally {
      submitBtn.disabled = false
      submitLbl.textContent = 'Sign in'
      submitIcon.classList.remove('spin')
    }
  })
}

function _friendlyAuthError(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'Incorrect phone number or password. Please try again.'
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Too many sign-in attempts. Please wait a few minutes and try again.'
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Network error. Please check your connection and try again.'
  }
  return raw
}
