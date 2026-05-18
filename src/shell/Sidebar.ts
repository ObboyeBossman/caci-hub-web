// src/shell/Sidebar.ts
// Renders the sidebar from getSidebarItems(), filtered by hasPermission().
// Zero knowledge of which modules exist — all driven by the registry.
// Mirrors: app_sidebar.dart + sidebar_nav_item.dart

import { getSidebarItems } from '@core/registry'
import { getCurrentUser } from '@core/auth'
import { hasPermission } from '@core/permissions'
import { navigate } from '@core/router'
import { closeMobileDrawer } from './Shell'
import type { SidebarItem } from '../types/module.types'

export class Sidebar {
  private _el: HTMLElement
  private _collapsed = false
  private _currentPath = ''

  constructor(el: HTMLElement) {
    this._el = el
  }

  render(): void {
    const user        = getCurrentUser()
    const items       = getSidebarItems()
    const permitted   = user
      ? items.filter(item => hasPermission(user.role, item.permission))
      : []
    const isDark      = document.documentElement.dataset['theme'] === 'dark'
    const collapsed   = this._collapsed

    this._el.innerHTML = `
      ${this._renderHeader(collapsed)}
      <div class="px-2 pt-1 pb-0" style="padding: 6px 8px 0">
        ${this._renderAssemblyBtn(collapsed, user?.assemblyId ?? null)}
      </div>
      <div class="sidebar-scroll">
        ${permitted.length ? this._renderNavItems(permitted, collapsed) : ''}
      </div>
      ${this._renderBottom(collapsed)}
    `

    this._bindEvents()
  }

  private _renderHeader(collapsed: boolean): string {
    return `
      <div class="sidebar-header">
        ${!collapsed ? `
          <div class="sidebar-logo">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="9" y="0" width="4" height="22" rx="2" fill="var(--caci-blue)"/>
              <rect x="0" y="9" width="22" height="4" rx="2" fill="var(--caci-blue)"/>
            </svg>
            <span>CACI Hub</span>
          </div>
        ` : ''}
        <button
          class="sidebar-toggle-btn ${collapsed ? '' : 'rotated'}"
          id="sidebar-toggle"
          title="${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}"
          aria-label="${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}"
        >
          <i class="bi bi-layout-text-sidebar-reverse" style="font-size:17px"></i>
        </button>
      </div>
    `
  }

  private _renderAssemblyBtn(collapsed: boolean, _assemblyId: string | null): string {
    if (collapsed) {
      return `
        <div style="display:flex;justify-content:center;margin-bottom:6px">
          <button class="assembly-info-btn collapsed-dot" id="assembly-btn" title="Accra Central Assembly">
            <span style="width:10px;height:10px;border-radius:50%;background:var(--caci-success);
              box-shadow:0 0 0 3px rgba(26,127,55,0.18);display:inline-block"></span>
          </button>
        </div>
      `
    }
    return `
      <button class="assembly-info-btn" id="assembly-btn" style="margin-bottom:6px">
        <span class="assembly-status-dot"></span>
        <span style="flex:1;font-size:12px;font-weight:500;color:var(--text-secondary);
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Accra Central Assembly</span>
        <i class="bi bi-chevron-down" style="font-size:11px;color:var(--text-secondary)"></i>
      </button>
    `
  }

  private _renderNavItems(items: SidebarItem[], collapsed: boolean): string {
    const navHtml = items.map(item => this._renderNavItem(item, collapsed)).join('')

    if (collapsed) {
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:1px">${navHtml}</div>`
    }

    return `
      <div style="margin-bottom:4px">
        <div class="sidebar-section-label">Navigation</div>
        ${navHtml}
      </div>
    `
  }

  private _renderNavItem(item: SidebarItem, collapsed: boolean): string {
    const isActive = this._isActive(item.path)
    const badgeHtml = item.badge
      ? `<span class="nav-badge">${item.badge}</span>`
      : ''

    if (collapsed) {
      return `
        <button
          class="sidebar-nav-item collapsed-item ${isActive ? 'active' : ''}"
          data-route="${item.path}"
          title="${item.label}"
        >
          <i class="bi bi-${item.icon} nav-icon"></i>
          ${badgeHtml}
        </button>
      `
    }

    return `
      <button
        class="sidebar-nav-item ${isActive ? 'active' : ''}"
        data-route="${item.path}"
        style="margin-bottom:1px"
      >
        <i class="bi bi-${item.icon} nav-icon"></i>
        <span class="nav-label">${item.label}</span>
        ${badgeHtml}
      </button>
    `
  }

  private _renderBottom(collapsed: boolean): string {
    return `
      <div class="sidebar-bottom">
        <button class="sidebar-bottom-item" id="theme-toggle-btn" style="${collapsed ? 'justify-content:center' : ''}">
          <i class="bi bi-sun" id="theme-icon" style="font-size:15px"></i>
          ${!collapsed ? `
            <span style="flex:1">Light mode</span>
            <div class="theme-toggle-track" id="theme-track">
              <div class="theme-toggle-thumb"></div>
            </div>
          ` : ''}
        </button>
        <button class="sidebar-bottom-item" id="profile-btn" style="${collapsed ? 'justify-content:center' : ''}">
          <div class="caci-avatar" style="width:28px;height:28px;font-size:11px;flex-shrink:0">RA</div>
          ${!collapsed ? `
            <div style="flex:1;overflow:hidden">
              <div style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Rev. Admin</div>
              <div style="font-size:11px;color:var(--text-muted)">Senior Pastor · Admin</div>
            </div>
            <span class="user-status-dot"></span>
          ` : ''}
        </button>
      </div>
    `
  }

  private _bindEvents(): void {
    // Nav items
    this._el.querySelectorAll<HTMLElement>('[data-route]').forEach(btn => {
      btn.addEventListener('click', () => {
        const route = btn.dataset['route']
        if (route) {
          closeMobileDrawer()
          navigate(route)
        }
      })
    })

    // Sidebar toggle
    this._el.querySelector('#sidebar-toggle')?.addEventListener('click', () => {
      this._collapsed = !this._collapsed
      this._el.classList.toggle('collapsed', this._collapsed)
      this.render()
    })

    // Theme toggle
    this._el.querySelector('#theme-toggle-btn')?.addEventListener('click', () => {
      const isDark = document.documentElement.dataset['theme'] === 'dark'
      document.documentElement.dataset['theme'] = isDark ? 'light' : 'dark'
      localStorage.setItem('caci-theme', isDark ? 'light' : 'dark')
      this.render()
    })

    // Profile btn
    this._el.querySelector('#profile-btn')?.addEventListener('click', (e) => {
      e.stopPropagation()
      import('./Toolbar').then(({ showProfilePopup }) => showProfilePopup())
    })
  }

  private _isActive(path: string): boolean {
    return this._currentPath === path ||
      this._currentPath.startsWith(path + '/')
  }

  setActivePath(path: string): void {
    this._currentPath = path
    // Update active classes without full re-render
    this._el.querySelectorAll<HTMLElement>('[data-route]').forEach(btn => {
      const route = btn.dataset['route'] ?? ''
      const active = path === route || path.startsWith(route + '/')
      btn.classList.toggle('active', active)
    })
  }
}