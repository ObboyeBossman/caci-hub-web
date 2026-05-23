// src/shell/Toolbar.ts
// Renders the topnav bar: toggle button, logo, assembly info popover.
// Mirrors: new shell design (topnav pattern).

import { getCurrentUser, getActiveAssemblyId } from '@core/auth'
import { navigate }       from '@core/router'
import { toggleDrawer }   from './Shell'
import { supabase }       from '@core/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export class Toolbar {
  private _el: HTMLElement
  private _assemblyChannel: RealtimeChannel | null = null

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
          CACI Hub
        </a>
      </div>

      <!-- Main area: assembly info button -->
      <div class="topnav-main-area">
        <button class="topnav-info-btn" id="topnav-info-btn">
          <div class="info-dot"></div>
          <span id="toolbar-assembly-name-btn">Loading assembly...</span>
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>

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
    if (btnSpan) btnSpan.textContent = name
    if (popSpan) popSpan.textContent = name
  }

  private _initAssemblySync(): void {
    const assemblyId = getActiveAssemblyId()
    
    // First try to load from session storage (populated during assembly selection)
    const sessionAsm = sessionStorage.getItem('selectedAssembly')
    if (sessionAsm) {
      try {
        const asm = JSON.parse(sessionAsm) as { name: string }
        if (asm && asm.name) this._updateAssemblyName(asm.name)
      } catch (e) {}
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
          
          // Also update sessionStorage to keep things in sync across reloads
          if (sessionAsm) {
             try {
               const asm = JSON.parse(sessionAsm) as { name: string }
               sessionStorage.setItem('selectedAssembly', JSON.stringify({ ...asm, name: asmData.name }))
             } catch(e) {}
          } else {
             sessionStorage.setItem('selectedAssembly', JSON.stringify({ id: assemblyId, name: asmData.name }))
          }
        }
      })

      // 2. Subscribe to realtime updates
      this._assemblyChannel = supabase.channel(`public:assemblies:id=eq.${assemblyId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assemblies', filter: `id=eq.${assemblyId}` }, payload => {
          if (payload.new && payload.new.name) {
            this._updateAssemblyName(payload.new.name)
            
            // Sync with session storage
            const currentSession = sessionStorage.getItem('selectedAssembly')
            if (currentSession) {
               try {
                 const asm = JSON.parse(currentSession) as { name: string }
                 sessionStorage.setItem('selectedAssembly', JSON.stringify({ ...asm, name: payload.new.name }))
               } catch(e) {}
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

  // Anchor above the sidebar profile button, aligned to its left edge
  const anchor = document.getElementById('sidebar-profile-btn')
  let css = 'position:fixed; z-index:9999;'
  if (anchor) {
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
      <div class="sidebar-avatar" style="width:34px;height:34px;font-size:13px">${initials}</div>
      <div style="overflow:hidden">
        <div class="profile-popup-name">${displayName}</div>
        <div class="profile-popup-role" style="text-transform:capitalize">${roleLabel}</div>
      </div>
    </div>
    <div class="profile-popup-divider"></div>
    <div class="profile-popup-menu">

      <button class="profile-menu-item" data-action="settings">
        <i class="bi bi-gear" style="font-size:15px"></i>
        <span>Settings</span>
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
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const action = btn.dataset['action']
      _closeProfilePopup()
      if (action === 'logout')  _handleLogout()

      if (action === 'settings') {
        const { SettingsOverlay } = await import('@modules/settings/pages/SettingsOverlay')
        SettingsOverlay.open()
      }
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