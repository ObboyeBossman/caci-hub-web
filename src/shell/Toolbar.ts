// src/shell/Toolbar.ts
// ─────────────────────────────────────────────────────────────────────────────
// Topnav — drawer-first redesign.
// Layout: [hamburger]  [CACI Hub title — centered]  [bell + avatar]
// ─────────────────────────────────────────────────────────────────────────────

import { getActiveAssemblyId } from '@core/auth'
import { navigate }            from '@core/router'
import { supabase }            from '@core/supabase'
import { applyTheme }          from '@core/theme'
import { toggleDrawer }        from './Drawer'
import { logoUrl }             from './Shell'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const TOOLBAR_CSS = /* css */`
/* ═══════════════════════════════════════════════════════════════════════════
   TOPNAV  — drawer-first
═══════════════════════════════════════════════════════════════════════════ */
.topnav {
  height: var(--topnav-height, 56px);
  background: var(--bg-topnav);
  border-bottom: 1px solid var(--topnav-border, var(--border-default));
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8px;
  flex-shrink: 0;
  position: relative;
  z-index: 100;
}

/* ── Left zone ── */
.topnav-left {
  display: flex; align-items: center; gap: 12px;
}

/* Hamburger */
.topnav-hamburger {
  width: 40px; height: 40px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 5px; background: none; border: none; cursor: pointer;
  border-radius: var(--r-md, 8px);
  color: var(--text-primary);
  transition: background 0.15s;
  flex-shrink: 0;
}
.topnav-hamburger:hover { background: var(--bg-hover); }
.topnav-hamburger span {
  display: block; width: 20px; height: 1.5px;
  background: currentColor; border-radius: 2px;
  transition: transform 0.25s ease, opacity 0.25s ease;
}

/* ── Title ── */
.topnav-title {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 16px; font-weight: 600; letter-spacing: -0.01em;
  color: var(--text-primary); white-space: nowrap;
  cursor: pointer; user-select: none;
  text-decoration: none;
}
.topnav-logo {
  height: 24px; width: auto; object-fit: contain; flex-shrink: 0;
}

/* ── Right zone ── */
.topnav-right {
  display: flex; align-items: center; justify-content: flex-end; gap: 4px;
}

/* Icon buttons */
.topnav-icon-btn {
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer;
  border-radius: var(--r-md, 8px);
  color: var(--text-secondary); font-size: 18px;
  position: relative;
  transition: background 0.15s, color 0.15s;
}
.topnav-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* Assembly info pill */
.topnav-popover-wrap { position: relative; display: flex; align-items: center; }
.topnav-info-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  background: none; border: 1px solid var(--border-default);
  border-radius: var(--r-pill, 9999px);
  padding: 5px 12px; cursor: pointer;
  font-size: 13px; font-family: var(--ds-font-sans, inherit);
  color: var(--text-secondary);
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 200px;
}
.topnav-info-btn:hover {
  background: var(--bg-hover); border-color: var(--border-strong); color: var(--text-primary);
}
.topnav-info-btn .info-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--text-success, #1a7f37); flex-shrink: 0;
}
.topnav-info-btn svg {
  width: 13px; height: 13px;
  stroke: currentColor; fill: none; stroke-width: 2; flex-shrink: 0;
}
.mobile-only { display: none; }

@media (max-width: 768px) {
  .topnav-info-btn {
    width: 36px; height: 36px; padding: 0;
    border-radius: 50%; border: none;
    background: linear-gradient(135deg, var(--caci-blue, #004BA0), var(--ds-blue-light, #4D9FFF));
    color: #fff; font-weight: 700; font-size: 14px;
    box-shadow: 0 4px 10px rgba(0,75,160,0.15);
  }
  .topnav-info-btn:hover {
    background: linear-gradient(135deg, var(--caci-blue, #004BA0), var(--ds-blue-light, #4D9FFF));
    color: #fff; opacity: 0.9; border: none;
  }
  .topnav-info-btn .info-dot,
  .topnav-info-btn svg,
  #toolbar-assembly-name { display: none; }
  .mobile-only { display: block; }
}

/* Assembly info popover */
.info-popover {
  display: none; position: absolute; top: calc(100% + 8px); right: 0;
  min-width: 240px; background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--r-md, 8px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  padding: 10px 14px; z-index: 9000;
}
.info-popover.show { display: block; }
.info-popover-row {
  display: flex; align-items: center; gap: 9px; padding: 5px 0;
  font-size: 13px; color: var(--text-secondary);
  border-bottom: 1px solid var(--border-default);
}
.info-popover-row:last-child { border-bottom: none; }
.info-popover-row svg {
  width: 14px; height: 14px; flex-shrink: 0;
  stroke: currentColor; fill: none; stroke-width: 2;
  color: var(--text-placeholder);
}
.info-popover-row strong { color: var(--text-primary); font-weight: 600; }
.ipr-status { color: var(--text-success, #1a7f37); font-weight: 500; }

/* Notification badge */
#notif-badge {
  display: none; position: absolute; top: 4px; right: 4px;
  min-width: 14px; height: 14px;
  background: var(--ds-red); color: #fff;
  font-size: 8px; font-weight: 700;
  border-radius: var(--r-pill);
  border: 1.5px solid var(--bg-topnav);
  align-items: center; justify-content: center; padding: 0 3px;
}
#notif-badge.visible { display: flex; }
`

function _injectToolbarCSS(): void {
  if (document.getElementById('caci-toolbar-css')) return
  const style = document.createElement('style')
  style.id = 'caci-toolbar-css'
  style.textContent = TOOLBAR_CSS
  document.head.appendChild(style)
}

// ─────────────────────────────────────────────────────────────────────────────
// Class
// ─────────────────────────────────────────────────────────────────────────────

export class _Toolbar {
  private _el: HTMLElement
  private _asmChannel: RealtimeChannel | null = null

  constructor(el: HTMLElement) {
    this._el = el
    _injectToolbarCSS()
  }

  render(): void {
    // Resolve asm info
    const saved = localStorage.getItem('caci:selected_assembly')
    let asmName = 'CACI Hub'
    try {
      const asm = saved ? JSON.parse(saved) as { name?: string } : null
      if (asm?.name) asmName = asm.name
    } catch { /* ignore */ }
    const asmInitials = asmName.substring(0, 2).toUpperCase()

    const now    = new Date()
    const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`

    this._el.className = 'topnav'
    this._el.innerHTML = /* html */`
      <div class="topnav-left">
        <button class="topnav-hamburger" id="topnav-hamburger" aria-label="Open menu" aria-expanded="false">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <a class="topnav-title" id="topnav-title" href="#/" aria-label="CACI Hub home">
          <img src="${logoUrl}" alt="Logo" class="topnav-logo" />
          CACI Hub
        </a>
      </div>

      <div class="topnav-right">
        <button class="topnav-icon-btn" id="topnav-notif-btn" title="Notifications" aria-label="Notifications">
          <i class="bi bi-bell"></i>
          <span id="notif-badge"></span>
        </button>
        <div class="topnav-popover-wrap">
          <button class="topnav-info-btn" id="topnav-info-btn" aria-haspopup="true" aria-expanded="false">
            <div class="info-dot"></div>
            <span id="toolbar-assembly-name">${asmName}</span>
            <span id="toolbar-assembly-initials" class="mobile-only">${asmInitials}</span>
            <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="info-popover" id="infoPopover" role="tooltip">
            <div class="info-popover-row">
              <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              <strong id="toolbar-assembly-name-popover">${asmName}</strong>
            </div>
            <div class="info-popover-row">
              <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>${dateStr}</span>
            </div>
            <div class="info-popover-row">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span class="ipr-status">All systems operational</span>
            </div>
          </div>
        </div>
      </div>
    `

    this._bindEvents()
    applyTheme()
    this._initAssemblySync()
  }

  private _updateAssemblyName(name: string): void {
    const btn = this._el.querySelector<HTMLElement>('#toolbar-assembly-name')
    const ini = this._el.querySelector<HTMLElement>('#toolbar-assembly-initials')
    const pop = this._el.querySelector<HTMLElement>('#toolbar-assembly-name-popover')
    if (btn) btn.textContent = name
    if (pop) pop.textContent = name
    if (ini) ini.textContent = name.substring(0, 2).toUpperCase()
  }

  private _initAssemblySync(): void {
    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) {
      this._updateAssemblyName('Global View')
      return
    }

    supabase
      .from('assemblies')
      .select('name')
      .eq('id', assemblyId)
      .single()
      .then(({ data }) => {
        const d = data as { name?: string } | null
        if (d?.name) {
          this._updateAssemblyName(d.name)
          try {
            const cs = localStorage.getItem('caci:selected_assembly')
            const parsed = cs ? JSON.parse(cs) : {}
            localStorage.setItem('caci:selected_assembly', JSON.stringify({ ...parsed, id: assemblyId, name: d.name }))
          } catch { /* ignore */ }
        }
      })

    const channelName = `public:assemblies:id=eq.${assemblyId}`
    if (this._asmChannel) supabase.removeChannel(this._asmChannel)
    else {
      const existing = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`)
      if (existing) supabase.removeChannel(existing)
    }

    this._asmChannel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'assemblies',
        filter: `id=eq.${assemblyId}`
      }, payload => {
        if (payload.new?.name) {
          this._updateAssemblyName(payload.new.name)
          try {
            const cs = localStorage.getItem('caci:selected_assembly')
            const p = cs ? JSON.parse(cs) : {}
            localStorage.setItem('caci:selected_assembly', JSON.stringify({ ...p, name: payload.new.name }))
          } catch { /* ignore */ }
        }
      })
      .subscribe()
  }

  private _bindEvents(): void {
    // Hamburger — opens drawer
    const hamburger = this._el.querySelector<HTMLElement>('#topnav-hamburger')
    hamburger?.addEventListener('click', () => {
      toggleDrawer()
      const isOpen = document.getElementById('shell-sidebar')?.classList.contains('drawer-open') ?? false
      hamburger.setAttribute('aria-expanded', String(isOpen))
    })

    // Assembly info Popover
    const infoBtn = this._el.querySelector<HTMLElement>('#topnav-info-btn')
    const popover = this._el.querySelector<HTMLElement>('#infoPopover')

    infoBtn?.addEventListener('click', e => {
      e.stopPropagation()
      const isOpen = popover?.classList.contains('show') ?? false
      popover?.classList.toggle('show', !isOpen)
      infoBtn.setAttribute('aria-expanded', String(!isOpen))
    })

    document.addEventListener('click', e => {
      if (infoBtn && !infoBtn.contains(e.target as Node)) {
        popover?.classList.remove('show')
        infoBtn.setAttribute('aria-expanded', 'false')
      }
    })

    // Title → home
    this._el.querySelector('#topnav-title')?.addEventListener('click', e => {
      e.preventDefault()
      navigate('/')
    })

    // Settings (via notification button long-press isn't needed; keep bell simple)
    this._el.querySelector('#topnav-notif-btn')?.addEventListener('click', () => {
      // Notifications panel — hook up to your notifications module
      // For now, open the drawer so the user can navigate
    })
  }

  destroy(): void {
    if (this._asmChannel) {
      this._asmChannel.unsubscribe()
      this._asmChannel = null
    }
  }
}