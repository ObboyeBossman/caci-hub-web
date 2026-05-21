// src/shell/Toolbar.ts
// Renders the topnav bar: toggle button, logo, assembly info popover.
// Mirrors: new shell design (topnav pattern).

import { getCurrentUser } from '@core/auth'
import { navigate }       from '@core/router'
import { toggleDrawer }   from './Shell'

export class Toolbar {
  private _el: HTMLElement

  constructor(el: HTMLElement) {
    this._el = el
  }

  render(): void {
    const now  = new Date()
    const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`

    this._el.className = 'topnav'
    this._el.innerHTML = `
      <!-- Toggle + Logo -->
      <div class="topnav-sidebar-area">
        <button class="topnav-toggle" id="topnav-toggle-btn" title="Toggle sidebar">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
        </button>
        <a class="logo" href="#/" id="topnav-logo">
          <img src="/src/assets/caci-logo.png" alt="CACI Hub" class="logo-img" />
        </a>
      </div>

      <!-- Main area: assembly info button -->
      <div class="topnav-main-area">
        <button class="topnav-info-btn" id="topnav-info-btn">
          <div class="info-dot"></div>
          Accra Central Assembly
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>

          <div class="info-popover" id="infoPopover">
            <div class="info-popover-row">
              <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              <strong>Accra Central Assembly</strong>
            </div>
            <div class="info-popover-row">
              <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span id="popoverDate">${dateStr}</span>
            </div>
            <div class="info-popover-row">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span class="ipr-status">All systems operational</span>
            </div>
          </div>
        </button>
      </div>
    `

    this._bindEvents()
    this._applyTheme()
  }

  private _bindEvents(): void {
    // Sidebar toggle
    this._el.querySelector('#topnav-toggle-btn')?.addEventListener('click', toggleDrawer)

    // Logo click → navigate home
    this._el.querySelector('#topnav-logo')?.addEventListener('click', (e) => {
      e.preventDefault()
      navigate('/')
    })

    // Info popover toggle
    const infoBtn = this._el.querySelector('#topnav-info-btn') as HTMLElement | null
    const popover = this._el.querySelector('#infoPopover') as HTMLElement | null

    infoBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      popover?.classList.toggle('show')
    })

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (infoBtn && !infoBtn.contains(e.target as Node)) {
        popover?.classList.remove('show')
      }
    })
  }

  private _applyTheme(): void {
    const saved = localStorage.getItem('caci-theme')
    if (saved) document.documentElement.dataset['theme'] = saved
  }
}

/** Profile popup — can also be called from Sidebar */
let _profileOverlay: HTMLElement | null = null

export function showProfilePopup(): void {
  if (_profileOverlay) { _closeProfilePopup(); return }

  const user     = getCurrentUser()
  const initials = user ? user.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'U'
  const displayName = user?.fullName ?? 'User'
  const roleLabel   = user?.role?.replace(/_/g, ' ') ?? 'Member'

  // Always position at top-right of screen, just below the topnav
  const el = document.createElement('div')
  el.className = 'profile-popup'
  el.style.cssText = `position:fixed;top:56px;right:16px;z-index:9999;`
  el.innerHTML = `
    <div class="profile-popup-header">
      <div class="sidebar-avatar" style="width:34px;height:34px;font-size:13px">${initials}</div>
      <div style="overflow:hidden">
        <div class="profile-popup-name">${displayName}</div>
        <div class="profile-popup-role" style="text-transform:capitalize">${roleLabel}</div>
      </div>
    </div>
    <div class="profile-popup-divider"></div>
    <div class="profile-popup-menu">
      <button class="profile-menu-item" data-action="profile">
        <i class="bi bi-person" style="font-size:15px"></i>
        <span>My Profile</span>
      </button>
      <button class="profile-menu-item" data-action="settings" disabled style="opacity:0.5;cursor:not-allowed">
        <i class="bi bi-gear" style="font-size:15px"></i>
        <span>Settings</span>
        <span class="soon-chip">SOON</span>
      </button>
      <hr style="margin:4px 0;border-color:var(--border-default)">
      <button class="profile-menu-item danger" data-action="logout">
        <i class="bi bi-box-arrow-right" style="font-size:15px"></i>
        <span>Log out</span>
      </button>
    </div>
  `

  document.body.appendChild(el)
  _profileOverlay = el

  setTimeout(() => {
    document.addEventListener('click', _closeProfilePopup, { once: true })
  }, 0)

  el.querySelectorAll<HTMLElement>('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const action = btn.dataset['action']
      _closeProfilePopup()
      if (action === 'logout')  _handleLogout()
      if (action === 'profile') navigate('/profile')
    })
  })
}

function _closeProfilePopup(): void {
  _profileOverlay?.remove()
  _profileOverlay = null
}

async function _handleLogout(): Promise<void> {
  try {
    const { supabase }        = await import('@core/supabase')
    const { clearCurrentUser } = await import('@core/auth')
    await supabase.auth.signOut()
    clearCurrentUser()
    navigate('/login')
  } catch (err) {
    console.error('[Toolbar] Logout failed', err)
  }
}