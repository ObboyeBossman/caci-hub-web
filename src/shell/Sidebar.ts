// src/shell/Sidebar.ts
// Renders the drawer sidebar: module tiles + quick links + theme + profile.
// Zero knowledge of which modules exist — all driven by the registry.

import { getSidebarItems } from '@core/registry'
import { getCurrentUser }   from '@core/auth'
import { hasPermission }    from '@core/permissions'
import { navigate }         from '@core/router'
import { closeDrawer }      from './Shell'
import type { SidebarItem } from '../types/module.types'

export class Sidebar {
  private _el: HTMLElement
  private _currentPath = ''

  constructor(el: HTMLElement) {
    this._el = el
  }

  render(): void {
    const user      = getCurrentUser()
    const items     = getSidebarItems()
    const permitted = user
      ? items.filter(item => hasPermission(user.role, item.permission))
      : []

    const initials    = user ? user.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'RA'
    const displayName = user?.fullName ?? 'Rev. Admin'
    const roleLabel   = user?.role?.replace(/_/g, ' ') ?? 'Super Admin'
    const isDark      = document.documentElement.dataset['theme'] === 'dark'

    this._el.innerHTML = `
      <div class="sidebar-scroll">

        <!-- Module tiles -->
        <div class="sidebar-section">
          <div class="sidebar-section-label">Modules</div>
          ${this._renderModuleTiles()}

          ${permitted.length ? `
            <div class="sidebar-divider"></div>
            <div class="sidebar-section-label">Navigation</div>
            ${permitted.map(item => this._renderNavItem(item)).join('')}
          ` : ''}
        </div>

        <div class="sidebar-divider"></div>

        <!-- Quick links -->
        <div class="sidebar-section">
          <div class="sidebar-section-label">Quick Links</div>
          ${this._renderQuickLinks()}
        </div>

      </div>

      <!-- Bottom: theme + profile -->
      <div class="sidebar-bottom">
        <button class="sidebar-theme-row" id="sidebar-theme-btn">
          <div class="sidebar-theme-row-left">
            <svg id="sidebarThemeIcon" viewBox="0 0 24 24">
              ${isDark
                ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
                : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'}
            </svg>
            <span class="sidebar-item-label" id="sidebarThemeLabel">${isDark ? 'Dark mode' : 'Light mode'}</span>
          </div>
          <div class="toggle-track"><div class="toggle-thumb"></div></div>
        </button>

        <button class="sidebar-profile-row" id="sidebar-profile-btn">
          <div class="sidebar-avatar">${initials}</div>
          <div class="sidebar-profile-info">
            <div class="sidebar-profile-name">${displayName}</div>
            <div class="sidebar-profile-role" style="text-transform:capitalize">${roleLabel}</div>
          </div>
          <div class="sidebar-notif-dot"></div>
        </button>
      </div>
    `

    this._bindEvents()
  }

  private _renderModuleTiles(): string {
    const modules = [
      {
        label: 'Members',
        href: 'caci_members_module.html',
        svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      },
      {
        label: 'Finance',
        href: 'caci_finance_module.html',
        svg: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
      },
      {
        label: 'Events',
        href: 'caci_events_module.html',
        svg: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
      },
      {
        label: 'Communication',
        href: 'caci_communication_module.html',
        svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      },
      {
        label: 'Settings',
        href: 'caci_settings_module.html',
        svg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
      },
    ]

    const extIcon = `
      <svg class="ext-icon" viewBox="0 0 24 24">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>`

    return modules.map(m => `
      <div class="mod-placeholder" data-href="${m.href}">
        <svg viewBox="0 0 24 24">${m.svg}</svg>
        <span class="mod-placeholder-label">${m.label}</span>
        ${extIcon}
      </div>
    `).join('')
  }

  private _renderQuickLinks(): string {
    const links = [
      { label: 'Add Member',         toast: 'Opening Add Member…',          svg: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>' },
      { label: 'Record Transaction', toast: 'Opening Record Transaction…',  svg: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
      { label: 'New Event',          toast: 'Opening New Event…',           svg: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>' },
      { label: 'Send Message',       toast: 'Opening Compose Message…',     svg: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>' },
      { label: 'Export Reports',     toast: 'Opening Export…',              svg: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' },
    ]

    return links.map(lk => `
      <button class="sidebar-item" data-toast="${lk.toast}">
        <svg viewBox="0 0 24 24">${lk.svg}</svg>
        <span class="sidebar-item-label">${lk.label}</span>
      </button>
    `).join('')
  }

  private _renderNavItem(item: SidebarItem): string {
    const isActive = this._isActive(item.path)
    const badge    = item.badge ? `<span style="min-width:18px;height:18px;background:var(--caci-red);color:#fff;font-size:10px;font-weight:700;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 5px;flex-shrink:0">${item.badge}</span>` : ''
    return `
      <button class="sidebar-item ${isActive ? 'active' : ''}" data-route="${item.path}">
        <i class="bi bi-${item.icon}" style="font-size:15px;flex-shrink:0"></i>
        <span class="sidebar-item-label">${item.label}</span>
        ${badge}
      </button>
    `
  }

  private _bindEvents(): void {
    // Module tiles — navigate to their hrefs
    this._el.querySelectorAll<HTMLElement>('.mod-placeholder[data-href]').forEach(el => {
      el.addEventListener('click', () => {
        const href = el.dataset['href']
        if (href) window.location.href = href
        closeDrawer()
      })
    })

    // Registry-driven nav items
    this._el.querySelectorAll<HTMLElement>('[data-route]').forEach(btn => {
      btn.addEventListener('click', () => {
        const route = btn.dataset['route']
        if (route) { closeDrawer(); navigate(route) }
      })
    })

    // Quick-link toast buttons
    this._el.querySelectorAll<HTMLElement>('[data-toast]').forEach(btn => {
      btn.addEventListener('click', () => {
        const msg = btn.dataset['toast']
        if (msg) {
          import('./Shell').then(({ showToast }) => showToast(msg))
        }
        closeDrawer()
      })
    })

    // Theme toggle
    this._el.querySelector('#sidebar-theme-btn')?.addEventListener('click', () => {
      const isDark = document.documentElement.dataset['theme'] === 'dark'
      document.documentElement.dataset['theme'] = isDark ? 'light' : 'dark'
      localStorage.setItem('caci-theme', isDark ? 'light' : 'dark')
      this.render()
    })

    // Profile button
    this._el.querySelector('#sidebar-profile-btn')?.addEventListener('click', (e) => {
      e.stopPropagation()
      import('./Toolbar').then(({ showProfilePopup }) => showProfilePopup())
    })
  }

  private _isActive(path: string): boolean {
    return this._currentPath === path || this._currentPath.startsWith(path + '/')
  }

  setActivePath(path: string): void {
    this._currentPath = path
    this._el.querySelectorAll<HTMLElement>('[data-route]').forEach(btn => {
      const route  = btn.dataset['route'] ?? ''
      const active = path === route || path.startsWith(route + '/')
      btn.classList.toggle('active', active)
    })
  }
}