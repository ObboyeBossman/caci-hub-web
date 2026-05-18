// src/shell/Toolbar.ts
// Top toolbar: assembly context, avatar dropdown, notification bell, mobile menu.
// Mirrors: mobile_top_nav.dart, sidebar_bottom.dart profile popup, assembly_popover.dart

import { getCurrentUser, getActiveAssemblyId } from '@core/auth'
import { navigate } from '@core/router'
import { toggleMobileDrawer } from './Shell'

let _profileOverlay: HTMLElement | null = null

export class Toolbar {
  private _el: HTMLElement

  constructor(el: HTMLElement) {
    this._el = el
  }

  render(): void {
    const user = getCurrentUser()
    const initials = user
      ? user.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
      : 'U'

    this._el.innerHTML = `
      <button class="toolbar-icon-btn d-md-none" id="mobile-menu-btn" aria-label="Open menu">
        <i class="bi bi-list" style="font-size:18px"></i>
      </button>

      <a href="#/" class="toolbar-logo" id="toolbar-logo">
        <svg class="toolbar-logo-cross" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="0" width="4" height="22" rx="2" fill="var(--caci-blue)"/>
          <rect x="0" y="9" width="22" height="4" rx="2" fill="var(--caci-blue)"/>
        </svg>
        <span class="toolbar-logo-text">CACI Hub</span>
      </a>

      <div class="toolbar-spacer"></div>

      <div class="toolbar-actions">
        <button class="toolbar-assembly" id="assembly-btn" aria-label="Assembly info">
          <span class="toolbar-assembly-dot"></span>
          <span>Accra Central Assembly</span>
          <i class="bi bi-chevron-down" style="font-size:10px;margin-left:2px"></i>
        </button>

        <div class="notif-bell-wrap">
          <button class="toolbar-icon-btn" id="notif-btn" aria-label="Notifications">
            <i class="bi bi-bell" style="font-size:16px"></i>
          </button>
          <span class="notif-badge" id="notif-badge" style="display:none">0</span>
        </div>

        <button class="toolbar-avatar-btn" id="profile-btn" aria-label="Profile menu">
          <div class="caci-avatar" style="width:32px;height:32px;font-size:12px">${initials}</div>
          <span class="toolbar-avatar-dot"></span>
        </button>
      </div>
    `

    this._bindEvents()
    this._applyTheme()
  }

  private _bindEvents(): void {
    this._el.querySelector('#mobile-menu-btn')?.addEventListener('click', toggleMobileDrawer)

    this._el.querySelector('#profile-btn')?.addEventListener('click', (e) => {
      e.stopPropagation()
      showProfilePopup()
    })

    this._el.querySelector('#assembly-btn')?.addEventListener('click', (e) => {
      e.stopPropagation()
      _showAssemblyPopover(e.currentTarget as HTMLElement)
    })

    this._el.querySelector('#toolbar-logo')?.addEventListener('click', (e) => {
      e.preventDefault()
      navigate('/')
    })
  }

  private _applyTheme(): void {
    const saved = localStorage.getItem('caci-theme')
    if (saved) {
      document.documentElement.dataset['theme'] = saved
    }
  }
}

/** Show the profile popup overlay (also called from Sidebar) */
export function showProfilePopup(): void {
  if (_profileOverlay) {
    _closeProfilePopup()
    return
  }

  const profileBtn = document.getElementById('profile-btn')
  if (!profileBtn) return
  const rect = profileBtn.getBoundingClientRect()
  const user = getCurrentUser()
  const initials = user
    ? user.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'
  const displayName = user?.fullName ?? 'User'
  const roleLabel   = user?.role?.replace(/_/g, ' ') ?? 'Member'

  const el = document.createElement('div')
  el.className = 'profile-popup'
  el.style.cssText = `
    top: ${rect.bottom + 8}px;
    right: ${window.innerWidth - rect.right}px;
  `
  el.innerHTML = `
    <div class="profile-popup-header">
      <div class="caci-avatar" style="width:34px;height:34px;font-size:13px;flex-shrink:0">${initials}</div>
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
        <i class="bi bi-box-arrow-up-right" style="font-size:11px;margin-left:auto;color:var(--text-muted)"></i>
      </button>
      <button class="profile-menu-item" data-action="settings" disabled style="opacity:0.5;cursor:not-allowed">
        <i class="bi bi-gear" style="font-size:15px"></i>
        <span>Settings</span>
        <span class="soon-chip">SOON</span>
      </button>
      <button class="profile-menu-item" data-action="help" disabled style="opacity:0.5;cursor:not-allowed">
        <i class="bi bi-question-circle" style="font-size:15px"></i>
        <span>Get Help</span>
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

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', _closeProfilePopup, { once: true })
  }, 0)

  // Bind menu actions
  el.querySelectorAll<HTMLElement>('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const action = btn.dataset['action']
      _closeProfilePopup()
      if (action === 'logout') _handleLogout()
      if (action === 'profile') navigate('/profile')
    })
  })
}

function _closeProfilePopup(): void {
  _profileOverlay?.remove()
  _profileOverlay = null
}

function _showAssemblyPopover(anchor: HTMLElement): void {
  // Simple popover showing assembly info
  const existing = document.getElementById('assembly-popover')
  if (existing) { existing.remove(); return }

  const rect = anchor.getBoundingClientRect()
  const now  = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const weekNum = Math.ceil(
    (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
  )

  const el = document.createElement('div')
  el.id = 'assembly-popover'
  el.className = 'assembly-popover'
  el.style.cssText = `top:${rect.bottom + 8}px;right:${window.innerWidth - rect.right}px;`
  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px">
      <div style="width:32px;height:32px;border-radius:8px;background:var(--caci-success);
        display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="bi bi-house" style="color:white;font-size:16px"></i>
      </div>
      <div style="flex:1;overflow:hidden">
        <div style="font-size:13px;font-weight:600;color:var(--text-primary)">Accra Central Assembly</div>
        <div style="font-size:11px;color:var(--text-muted)">${dateStr}</div>
      </div>
    </div>
    <hr style="border-color:var(--border-default);margin:0 0 10px">
    <div style="display:flex;align-items:center;gap:9px;font-size:12px;color:var(--text-secondary)">
      <i class="bi bi-calendar3" style="color:var(--caci-blue);font-size:13px"></i>
      ${dateStr} · Week ${weekNum} of 52
    </div>
    <hr style="border-color:var(--border-default);margin:10px 0">
    <div style="display:flex;align-items:center;gap:9px">
      <i class="bi bi-info-circle" style="color:var(--caci-blue);font-size:13px"></i>
      <span style="width:7px;height:7px;border-radius:50%;background:var(--caci-success);display:inline-block"></span>
      <span style="font-size:12px;font-weight:600;color:var(--caci-success)">All systems operational</span>
    </div>
  `

  document.body.appendChild(el)
  setTimeout(() => {
    document.addEventListener('click', () => el.remove(), { once: true })
  }, 0)
}

async function _handleLogout(): Promise<void> {
  try {
    const { supabase } = await import('@core/supabase')
    const { clearCurrentUser } = await import('@core/auth')
    await supabase.auth.signOut()
    clearCurrentUser()
    navigate('/login')
  } catch (err) {
    console.error('[Toolbar] Logout failed', err)
  }
}