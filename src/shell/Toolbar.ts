// src/shell/Toolbar.ts
// Renders the topnav bar: toggle button, logo, assembly info popover.
// Mirrors: new shell design (topnav pattern).

import { getCurrentUser, getActiveAssemblyId } from '@core/auth'
import { navigate } from '@core/router'
import { toggleDrawer } from './Shell'
import { supabase } from '@core/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { applyTheme } from '../core/theme'
import logoUrl from '../assets/caci-logo.png'
import { showSignOutConfirm } from '../shared/components/SignOutConfirm'

export class Toolbar {
  private _el: HTMLElement
  private _assemblyChannel: RealtimeChannel | null = null

  constructor(el: HTMLElement) {
    this._el = el
  }

  render(): void {
    const now = new Date()
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
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
          <img src="${logoUrl}" alt="" class="logo-img" />
          <span class="logo-text">CACI Hub</span>
        </a>
      </div>

      <!-- Main area: assembly info button -->
      <div class="topnav-main-area">
        <button class="topnav-info-btn" id="topnav-info-btn">
          <div class="info-dot"></div>
          <span id="toolbar-assembly-name-btn">Loading assembly...</span>
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>

      <div class="topnav-right-area">
        <button class="topnav-avatar-btn" id="topnav-avatar-btn" aria-label="Assembly info">
          <div class="info-dot"></div>
          <div class="topnav-avatar" id="topnav-asm-avatar-initials">UA</div>
          <span class="topnav-notif-dot" id="topnav-notif-dot" style="display:none"></span>

          <!-- The popover anchors to the avatar now -->
          <div class="info-popover" id="infoPopover">
            <div class="info-popover-row">
              <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              <strong id="toolbar-assembly-name-popover">Loading assembly...</strong>
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
    this._initAssemblySync()
  }

  private _updateAssemblyName(name: string): void {
    const btnSpan = this._el.querySelector('#toolbar-assembly-name-btn')
    const popSpan = this._el.querySelector('#toolbar-assembly-name-popover')
    const avEl = this._el.querySelector('#topnav-asm-avatar-initials')
    const ctxSpan = document.getElementById('shell-asm-name')

    if (btnSpan) btnSpan.textContent = name
    if (popSpan) popSpan.textContent = name
    if (ctxSpan) ctxSpan.textContent = name

    if (avEl) {
      avEl.textContent = name
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    }
  }

  private _initAssemblySync(): void {
    const assemblyId = getActiveAssemblyId()

    // First try to load from persistent storage (populated during assembly selection)
    const savedAsm = localStorage.getItem('caci:selected_assembly')
    if (savedAsm) {
      try {
        const asm = JSON.parse(savedAsm) as { name: string }
        if (asm && asm.name) this._updateAssemblyName(asm.name)
      } catch (e) { }
    } else if (!assemblyId) {
      this._updateAssemblyName('Global View')
      return // Super admin not tied to any assembly yet
    }

    if (assemblyId) {
      // 1. Fetch initial name to ensure accuracy
      supabase.from('assemblies').select('name').eq('id', assemblyId).single().then(({ data }) => {
        const asmData = data as { name: string } | null
        if (asmData && asmData.name) {
          this._updateAssemblyName(asmData.name)

          // Also update localStorage to keep things in sync across reloads
          if (savedAsm) {
            try {
              const asm = JSON.parse(savedAsm) as { name: string }
              localStorage.setItem('caci:selected_assembly', JSON.stringify({ ...asm, name: asmData.name }))
            } catch (e) { }
          } else {
            localStorage.setItem('caci:selected_assembly', JSON.stringify({ id: assemblyId, name: asmData.name }))
          }
        }
      })

      // 2. Subscribe to realtime updates
      // Cleanup previous channel if exists to avoid "Initialization Failed: cannot add postgres_changes... after subscribe"
      const channelName = `public:assemblies:id=eq.${assemblyId}`
      if (this._assemblyChannel) {
        supabase.removeChannel(this._assemblyChannel)
      } else {
        // Also remove any existing channel with the same name from the client's internal registry
        // (This handles cases where the old Toolbar instance was destroyed but the channel remained)
        const existingChannel = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`)
        if (existingChannel) supabase.removeChannel(existingChannel)
      }

      this._assemblyChannel = supabase.channel(channelName)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assemblies', filter: `id=eq.${assemblyId}` }, payload => {
          if (payload.new && payload.new.name) {
            this._updateAssemblyName(payload.new.name)

            // Sync with persistent storage
            const currentSaved = localStorage.getItem('caci:selected_assembly')
            if (currentSaved) {
              try {
                const asm = JSON.parse(currentSaved) as { name: string }
                localStorage.setItem('caci:selected_assembly', JSON.stringify({ ...asm, name: payload.new.name }))
              } catch (e) { }
            }
          }
        })
        .subscribe()
    }
  }

  destroy(): void {
    if (this._assemblyChannel) {
      this._assemblyChannel.unsubscribe()
      this._assemblyChannel = null
    }
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
    const avBtn = this._el.querySelector('#topnav-avatar-btn') as HTMLElement | null
    const popover = this._el.querySelector('#infoPopover') as HTMLElement | null

    const toggle = (e: Event) => {
      e.stopPropagation()
      if (popover && e.currentTarget && !(e.currentTarget as HTMLElement).contains(popover)) {
        (e.currentTarget as HTMLElement).appendChild(popover)
      }
      popover?.classList.toggle('show')
    }

    infoBtn?.addEventListener('click', toggle)
    avBtn?.addEventListener('click', toggle)

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (infoBtn && !infoBtn.contains(e.target as Node)) {
        popover?.classList.remove('show')
      }
    })
  }

  private _applyTheme(): void {
    applyTheme()
  }
}

/** Profile popup — can also be called from Sidebar */
let _profileOverlay: HTMLElement | null = null

export function showProfilePopup(): void {
  if (_profileOverlay) { _closeProfilePopup(); return }

  const user = getCurrentUser()
  const initials = user ? user.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'U'
  const displayName = user?.fullName ?? 'User'
  const roleLabel = user?.role?.replace(/_/g, ' ') ?? 'Member'

  // Anchor above the sidebar profile button, aligned to its left edge
  const anchor = document.getElementById('sidebar-profile-btn')
  let css = 'position:fixed; z-index:9999;'
  if (anchor) {
    anchor.classList.add('active')
    const rect = anchor.getBoundingClientRect()
    const bottom = window.innerHeight - rect.top + 8
    css += `bottom:${bottom}px; left:${rect.left}px;`
  } else {
    css += `bottom:20px; left:20px;` // Fallback
  }

  const el = document.createElement('div')
  el.className = 'profile-popup'
  el.style.cssText = css
  el.innerHTML = `
    <div class="profile-popup-header">
      <div class="profile-popup-avatar">${initials}</div>
      <div style="overflow:hidden">
        <div class="profile-popup-name">${displayName}</div>
        <div class="profile-popup-role">${roleLabel}</div>
      </div>
    </div>
    <div class="profile-popup-divider"></div>
    <div class="profile-popup-menu">

      <button class="profile-menu-item" data-action="settings">
        <i class="bi bi-gear" style="font-size: var(--text-md)"></i>
        <span>Settings</span>
      </button>
      <div class="profile-popup-divider"></div>
      <button class="profile-menu-item danger" data-action="logout">
        <i class="bi bi-box-arrow-right" style="font-size: var(--text-md)"></i>
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
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const action = btn.dataset['action']

      if (action === 'logout') {
        _closeProfilePopup()
        showSignOutConfirm()
      } else {
        _closeProfilePopup()
        if (action === 'settings') {
          const { SettingsOverlay } = await import('@modules/settings/pages/SettingsOverlay')
          SettingsOverlay.open()
        }
      }
    })
  })
}

function _closeProfilePopup(): void {
  _profileOverlay?.remove()
  _profileOverlay = null
  document.getElementById('sidebar-profile-btn')?.classList.remove('active')
}