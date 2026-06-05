// src/shell/Sidebar.ts
// ─────────────────────────────────────────────────────────────────────────────
// Glassmorphism navigation drawer — light/dark theme-aware.
// Profile card, animated role switcher, scrollable nav panels,
// accordion sub-menus, footer with theme toggle.
// ─────────────────────────────────────────────────────────────────────────────

import { getSidebarItems } from '@core/registry'
import { getCurrentUser } from '@core/auth'
import { can } from '@core/authorization/authorization-service'
import { navigate } from '@core/router'
import { closeDrawer } from './Drawer'
import { showToast, _showComingSoonToast } from './Toast'
import { _showSignOutConfirm } from './SignOutModal'
import type { SidebarItem } from '../types/module.types'

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const SIDEBAR_CSS = /* css */`
/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR — glassmorphism, theme-aware
═══════════════════════════════════════════════════════════════════════════ */

/* ── Slide-in animation ──────────────────────────────────────────────────── */
@keyframes sb-slide-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.sb-slide { animation: sb-slide-up 0.38s cubic-bezier(0.175,0.885,0.32,1.275) both; }

/* ── Sidebar shell (Drawer-first overlay) ────────────────────────────────── */
.dash-sidebar {
  position: fixed; top: 0; left: 0; bottom: 0; z-index: 210;
  width: var(--drawer-width, 350px);
  max-width: 100vw;
  background: var(--sb-bg);
  backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
  border-right: 1px solid var(--sb-border);
  display: flex; flex-direction: column; flex-shrink: 0;
  overflow: hidden;
  transform: translateX(-100%);
  box-shadow: 0 8px 48px rgba(0,0,0,0.22);
  transition: transform 0.32s cubic-bezier(0.175,0.885,0.32,1.1);
}
.dash-sidebar.drawer-open { transform: translateX(0); }

/* Light theme glass */
:root .dash-sidebar,
[data-theme="light"] .dash-sidebar {
  --sb-bg:          rgba(255,255,255,0.72);
  --sb-border:      rgba(0,0,0,0.07);
  --sb-text:        var(--text-primary, #0d1117);
  --sb-text-dim:    var(--text-secondary, #6e7681);
  --sb-hover-bg:    rgba(0,0,0,0.045);
  --sb-active-bg:   rgba(0, 75, 160, 0.09);
  --sb-active-text: var(--caci-blue, #004BA0);
  --sb-section:     rgba(0,0,0,0.35);
  --sb-divider:     rgba(0,0,0,0.07);
  --sb-footer-bg:   rgba(0,0,0,0.025);
  --sb-role-bg:     rgba(0,0,0,0.06);
  --sb-role-border: rgba(0,0,0,0.08);
  --sb-role-pill:   #004BA0;
  --sb-role-active: #ffffff;
  --sb-role-idle:   var(--text-secondary, #6e7681);
  --sb-accord-line: rgba(0,0,0,0.1);
  --sb-soon-bg:     rgba(0,75,160,0.1);
  --sb-soon-text:   var(--caci-blue, #004BA0);
  --sb-badge-bg:    var(--caci-red, #C60026);
  --sb-scroll-thumb: rgba(0,75,160,0.3);
  --sb-glow:        rgba(0, 75, 160, 0.18);
}
/* Dark theme glass */
[data-theme="dark"] .dash-sidebar {
  --sb-bg:          rgba(22,27,34,0.72);
  --sb-border:      rgba(255,255,255,0.07);
  --sb-text:        var(--text-primary, #e6edf3);
  --sb-text-dim:    var(--text-secondary, #8b949e);
  --sb-hover-bg:    rgba(255,255,255,0.07);
  --sb-active-bg:   rgba(77,159,255,0.15);
  --sb-active-text: var(--caci-blue-light, #4D9FFF);
  --sb-section:     rgba(255,255,255,0.3);
  --sb-divider:     rgba(255,255,255,0.07);
  --sb-footer-bg:   rgba(0,0,0,0.2);
  --sb-role-bg:     rgba(255,255,255,0.05);
  --sb-role-border: rgba(255,255,255,0.08);
  --sb-role-pill:   #007AFF;
  --sb-role-active: #ffffff;
  --sb-role-idle:   var(--n400, #6e7681);
  --sb-accord-line: rgba(255,255,255,0.1);
  --sb-soon-bg:     rgba(77,159,255,0.12);
  --sb-soon-text:   var(--caci-blue-light, #4D9FFF);
  --sb-badge-bg:    var(--caci-red, #C60026);
  --sb-scroll-thumb: rgba(77,159,255,0.4);
  --sb-glow:        rgba(77, 159, 255, 0.2);
}

.sidebar-inner {
  display: flex; flex-direction: column; height: 100%;
  width: 100%; overflow: hidden;
}

/* ── Profile header ──────────────────────────────────────────────────────── */
.sb-profile-header {
  display: flex; flex-direction: column; align-items: center;
  padding: 32px 16px 16px; position: relative;
}
.sb-close-btn {
  position: absolute; top: 8px; left: 8px;
  width: 40px; height: 40px; border-radius: var(--r-md, 8px);
  background: none; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--sb-text-dim); font-size: 18px;
  transition: background 0.15s, color 0.15s;
  z-index: 10;
}
.sb-close-btn:hover { background: var(--sb-hover-bg); color: var(--sb-text); }

.sb-avatar-wrap {
  width: 76px; height: 76px; border-radius: 50%;
  border: 2.5px solid #4ADE80;
  overflow: hidden; margin-bottom: 12px;
  box-shadow: 0 4px 20px rgba(74,222,128,0.25);
  flex-shrink: 0;
  animation: sb-slide-up 0.4s cubic-bezier(0.175,0.885,0.32,1.275) 50ms both;
}
.sb-avatar-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sb-avatar-initials {
  width: 100%; height: 100%;
  background: linear-gradient(135deg, var(--caci-blue,#004BA0), var(--caci-blue-light,#4D9FFF));
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 1.375rem; font-weight: 700; letter-spacing: 0.03em;
}

.sb-profile-name {
  font-size: 1rem; font-weight: 600; color: var(--sb-text);
  text-align: center; line-height: 1.3; margin-bottom: 2px;
  animation: sb-slide-up 0.4s cubic-bezier(0.175,0.885,0.32,1.275) 100ms both;
}
.sb-profile-no {
  font-size: 0.714rem; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--sb-text-dim); margin-bottom: 4px; opacity: 0.7;
  animation: sb-slide-up 0.4s cubic-bezier(0.175,0.885,0.32,1.275) 125ms both;
}
.sb-profile-role {
  font-size: 0.785rem; font-weight: 500; color: var(--sb-text-dim);
  text-transform: uppercase; letter-spacing: 0.06em;
  animation: sb-slide-up 0.4s cubic-bezier(0.175,0.885,0.32,1.275) 150ms both;
}

/* ── Role switcher ───────────────────────────────────────────────────────── */
.sb-role-switcher-wrap {
  padding: 0 12px 12px;
  animation: sb-slide-up 0.4s cubic-bezier(0.175,0.885,0.32,1.275) 200ms both;
}
.sb-role-switcher {
  display: flex; align-items: center; position: relative;
  background: var(--sb-role-bg); border: 1px solid var(--sb-role-border);
  border-radius: 9999px; padding: 3px;
}
.sb-role-pill {
  position: absolute; top: 3px; bottom: 3px;
  width: calc(50% - 3px);
  background: var(--sb-role-pill);
  border-radius: 9999px;
  transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
  z-index: 0;
  box-shadow: 0 2px 10px var(--sb-glow);
}
.sb-role-pill.admin { transform: translateX(100%); }
.sb-role-btn {
  flex: 1; position: relative; z-index: 1;
  padding: 5px 12px; border: none; background: none; cursor: pointer;
  font-size: 0.857rem; font-weight: 500; border-radius: 9999px;
  color: var(--sb-role-idle); font-family: var(--font-sans, inherit);
  transition: color 0.25s ease;
}
.sb-role-btn.active { color: var(--sb-role-active); font-weight: 600; }

/* ── Divider ─────────────────────────────────────────────────────────────── */
.sb-hr { height: 1px; background: var(--sb-divider); margin: 0 12px 0; flex-shrink: 0; }

/* ── Scrollable nav ──────────────────────────────────────────────────────── */
.sb-scroll {
  flex: 1; overflow: hidden; position: relative;
}
.sb-scroll-inner { height: 100%; overflow-y: auto; overflow-x: hidden; }
.sb-scroll-inner::-webkit-scrollbar { width: 4px; }
.sb-scroll-inner::-webkit-scrollbar-track { background: transparent; border-radius: 10px; }
.sb-scroll-inner::-webkit-scrollbar-thumb { background: var(--sb-scroll-thumb); border-radius: 10px; }

/* Sliding panels */
.sb-panel {
  width: 100%; padding: 6px 8px 12px;
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.sb-panel.hidden {
  display: none;
}

/* ── Section label ───────────────────────────────────────────────────────── */
.sb-section-label {
  font-size: 0.714rem; font-weight: 700; letter-spacing: 0.09em;
  text-transform: uppercase; color: var(--sb-section);
  padding: 10px 12px 4px;
}

/* ── Nav item (pill shaped) ──────────────────────────────────────────────── */
.sb-nav-item {
  width: 100%; display: flex; align-items: center; gap: 11px;
  padding: 9px 14px; border-radius: 9999px; border: none;
  background: none; cursor: pointer; text-align: left;
  color: var(--sb-text-dim); font-size: 1rem; font-weight: 500;
  font-family: var(--font-sans, inherit);
  transition: background 0.18s ease, color 0.18s ease, transform 0.15s ease;
}
.sb-nav-item:hover {
  background: var(--sb-hover-bg); color: var(--sb-text);
  transform: scale(0.99);
}
.sb-nav-item.active {
  background: linear-gradient(90deg, var(--sb-active-bg), transparent);
  color: var(--sb-active-text); font-weight: 600;
  box-shadow: 0 0 0 1px var(--sb-active-bg);
}
.sb-nav-item i { font-size: 1.143rem; flex-shrink: 0; }
.sb-nav-item-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* active item special glow for admin */
.sb-nav-item.active-glow {
  background: linear-gradient(90deg, var(--sb-role-pill), color-mix(in srgb, var(--sb-role-pill) 60%, transparent));
  color: #fff; font-weight: 600;
  box-shadow: 0 4px 14px var(--sb-glow);
  border: 1px solid rgba(255,255,255,0.12);
}
.sb-nav-item.active-glow i { color: #fff; }

/* ── Badge chips ─────────────────────────────────────────────────────────── */
.sb-soon-badge {
  font-size: 0.643rem; font-weight: 700; letter-spacing: 0.04em;
  background: var(--sb-soon-bg); color: var(--sb-soon-text);
  padding: 2px 6px; border-radius: 9999px; flex-shrink: 0;
}
.sb-count-badge {
  min-width: 18px; height: 18px; padding: 0 5px;
  background: var(--sb-badge-bg); color: #fff;
  font-size: 0.714rem; font-weight: 700; border-radius: 9999px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.sb-number-badge {
  font-size: 0.714rem; font-weight: 600;
  background: var(--sb-soon-bg); color: var(--sb-soon-text);
  border: 1px solid color-mix(in srgb, var(--sb-role-pill) 25%, transparent);
  padding: 1px 7px; border-radius: 4px; flex-shrink: 0;
}

/* ── Accordion ───────────────────────────────────────────────────────────── */
.sb-accord-content {
  max-height: 0; opacity: 0; overflow: hidden;
  transition: max-height 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.28s ease;
}
.sb-accord-item.open .sb-accord-content {
  max-height: 300px; opacity: 1;
}
.sb-accord-chevron {
  font-size: 13px; flex-shrink: 0; margin-left: auto;
  transition: transform 0.28s ease;
}
.sb-accord-item.open .sb-accord-chevron { transform: rotate(180deg); }

.sb-accord-sub { padding: 4px 0 4px 36px; position: relative; }
.sb-accord-sub::before {
  content: ''; position: absolute;
  left: 22px; top: 0; bottom: 8px;
  width: 1px; background: var(--sb-accord-line);
}
.sb-sub-item {
  display: block; padding: 6px 8px 6px 12px;
  font-size: 0.929rem; font-weight: 500; color: var(--sb-text-dim);
  border: none; background: none; cursor: pointer; text-align: left;
  width: 100%; border-radius: 6px; position: relative;
  font-family: var(--font-sans, inherit);
  transition: color 0.18s ease, background 0.18s ease;
}
.sb-sub-item::before {
  content: ''; position: absolute;
  left: -14px; top: 50%; width: 10px; height: 1px;
  background: var(--sb-accord-line);
}
.sb-sub-item:hover { color: var(--sb-text); background: var(--sb-hover-bg); }
.sb-sub-item.active { color: var(--sb-active-text); }

/* ── Footer ──────────────────────────────────────────────────────────────── */
.sb-footer {
  border-top: 1px solid var(--sb-divider);
  background: var(--sb-footer-bg);
  padding: 8px; flex-shrink: 0;
}
.sb-footer-link {
  width: 100%; display: flex; align-items: center; gap: 11px;
  padding: 9px 14px; border-radius: 9999px; border: none;
  background: none; cursor: pointer; text-align: left;
  color: var(--sb-text-dim); font-size: 1rem; font-weight: 500;
  font-family: var(--font-sans, inherit);
  transition: background 0.18s ease, color 0.18s ease;
}
.sb-footer-link:hover { background: var(--sb-hover-bg); color: var(--sb-text); }
.sb-footer-link i { font-size: 1.143rem; flex-shrink: 0; }

/* Theme toggle row */
.sb-theme-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 14px; border-radius: 10px;
  background: var(--sb-hover-bg); border: 1px solid var(--sb-divider);
  cursor: pointer; margin-top: 4px;
  transition: background 0.18s ease;
}
.sb-theme-row:hover { background: var(--sb-role-bg); }
.sb-theme-left { display: flex; align-items: center; gap: 10px; }
.sb-theme-left i { font-size: 1.143rem; color: var(--sb-text-dim); }
.sb-theme-label { font-size: 0.929rem; font-weight: 500; color: var(--sb-text); font-family: var(--font-sans, inherit); }

/* Toggle switch */
.sb-toggle-track {
  width: 36px; height: 20px; border-radius: 9999px;
  background: var(--sb-soon-bg); border: 1px solid color-mix(in srgb, var(--sb-role-pill) 30%, transparent);
  position: relative; transition: background 0.22s; flex-shrink: 0;
}
[data-theme="dark"] .sb-toggle-track { background: color-mix(in srgb, var(--sb-role-pill) 20%, transparent); }
.sb-toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--sb-role-pill);
  box-shadow: 0 0 8px var(--sb-glow);
  transition: transform 0.24s cubic-bezier(0.4,0,0.2,1);
}
[data-theme="dark"] .sb-toggle-thumb { transform: translateX(16px); }
`

function _injectSidebarCSS(): void {
  if (document.getElementById('caci-sidebar-css')) return
  const style = document.createElement('style')
  style.id = 'caci-sidebar-css'
  style.textContent = SIDEBAR_CSS
  document.head.appendChild(style)
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const COMING_SOON_PATHS = new Set([
  '/pastoral-care', '/pastoral', '/reports', '/audit-logs',
  '/contributions', '/calendar', '/announcements', '/profile', '/my-attendance',
])

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function _initials(fullName: string): string {
  return fullName.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
}

// ─────────────────────────────────────────────────────────────────────────────
// Class
// ─────────────────────────────────────────────────────────────────────────────

export class _Sidebar {
  private _el: HTMLElement
  private _currentPath = ''
  private _activeView: 'member' | 'admin' = 'member'

  constructor(el: HTMLElement) {
    this._el = el
    _injectSidebarCSS()
  }

  render(): void {
    const user = getCurrentUser()
    const isDark = document.documentElement.dataset['theme'] === 'dark'

    // Compute permitted items upfront to decide whether to show admin tab
    const allItems = getSidebarItems()
    const permitted = user ? allItems.filter(item => can(user, item.permission)) : []
    // Show admin switcher/panel only if the user has a non-member role AND has
    // at least one permitted item to display in the admin panel.
    const hasAdminAccess = user != null && user.role !== 'member' && permitted.length > 0

    const displayName = user?.fullName ?? 'User'
    const roleLabel = user?.role?.replace(/_/g, ' ') ?? 'Member'
    const membershipNo = (user as any)?.membershipNumber ?? ''
    const photoUrl = (user as any)?.avatarUrl ?? (user as any)?.photoUrl ?? ''
    const initials = _initials(displayName)

    this._el.innerHTML = /* html */`
      <div class="sidebar-inner">

        <!-- Profile header -->
        <div class="sb-profile-header">
          <button class="sb-close-btn" id="sb-close-btn" type="button" aria-label="Close menu">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
          <div class="sb-avatar-wrap">
            ${photoUrl
        ? `<img src="${photoUrl}" alt="${displayName}" loading="lazy"/>`
        : `<div class="sb-avatar-initials">${initials}</div>`}
          </div>
          <div class="sb-profile-name">${displayName}</div>
          ${membershipNo ? `<div class="sb-profile-no">${membershipNo}</div>` : ''}
          <div class="sb-profile-role">${roleLabel}</div>
        </div>

        <!-- Role switcher: only shown when user has actual admin privileges -->
        ${hasAdminAccess ? /* html */`
          <div class="sb-role-switcher-wrap">
            <div class="sb-role-switcher" id="sb-role-switcher" role="tablist" aria-label="View">
              <div class="sb-role-pill ${this._activeView === 'admin' ? 'admin' : ''}" id="sb-role-pill"></div>
              <button class="sb-role-btn ${this._activeView === 'member' ? 'active' : ''}"
                data-role="member" id="sb-role-member"
                role="tab" aria-selected="${this._activeView === 'member'}" type="button">
                Member
              </button>
              <button class="sb-role-btn ${this._activeView === 'admin' ? 'active' : ''}"
                data-role="admin" id="sb-role-admin"
                role="tab" aria-selected="${this._activeView === 'admin'}" type="button">
                Admin
              </button>
            </div>
          </div>
        ` : ''}

        <div class="sb-hr"></div>

        <!-- Scrollable nav -->
        <div class="sb-scroll">
          <div class="sb-scroll-inner" id="sb-scroll-inner">

            <!-- Member panel (always visible) -->
            <div class="sb-panel ${this._activeView !== 'member' ? 'hidden' : ''}" id="sb-member-panel">
              ${this._renderMemberNav()}
            </div>

            <!-- Admin panel (only when hasAdminAccess) -->
            ${hasAdminAccess ? /* html */`
              <div class="sb-panel ${this._activeView !== 'admin' ? 'hidden' : ''}" id="sb-admin-panel">
                ${this._renderAdminNav(user, permitted)}
              </div>
            ` : ''}

          </div>
        </div>

        <!-- Footer -->
        <div class="sb-footer">
          <button class="sb-footer-link" id="sb-settings-btn" type="button">
            <i class="bi bi-gear" aria-hidden="true"></i>
            <span>Settings</span>
          </button>
          <button class="sb-footer-link danger" id="sb-logout-btn" type="button"
            style="color: var(--text-danger, #C60026);">
            <i class="bi bi-box-arrow-right" aria-hidden="true"></i>
            <span>Sign out</span>
          </button>
          <div class="sb-theme-row" id="sb-theme-row" role="button" tabindex="0"
            aria-label="${isDark ? 'Switch to light mode' : 'Switch to dark mode'}">
            <div class="sb-theme-left">
              <i class="bi ${isDark ? 'bi-moon-fill' : 'bi-sun-fill'}" id="sb-theme-icon" aria-hidden="true"></i>
              <span class="sb-theme-label" id="sb-theme-label">${isDark ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <div class="sb-toggle-track" aria-hidden="true">
              <div class="sb-toggle-thumb"></div>
            </div>
          </div>
        </div>

      </div>
    `

    this._bindEvents()
  }

  setActivePath(path: string, prevPath?: string): void {
    this._currentPath = path
    // Re-render on path change for simplicity; active state is cheap
    this.render()
  }

  // ── Private renderers ──────────────────────────────────────────────────────

  private _renderMemberNav(): string {
    const myArea = [
      { path: '/home', icon: 'bi-house-fill', label: 'Home' },
      { path: '/profile', icon: 'bi-person-badge', label: 'Profile & Digital ID', soon: true as const },
      { path: '/my-attendance', icon: 'bi-calendar-check', label: 'My Attendance', soon: true as const },
      { path: '/contributions', icon: 'bi-cash-stack', label: 'Contributions & Tithes', soon: true as const },
      { path: '/groups', icon: 'bi-people-fill', label: 'My Groups', soon: true as const },
    ]
    const churchInfo = [
      { path: '/announcements', icon: 'bi-megaphone', label: 'Announcements', soon: true as const },
      { path: '/calendar', icon: 'bi-calendar3', label: 'Church Calendar', soon: true as const },
    ]
    return /* html */`
      <div class="sb-section-label">My Area</div>
      ${myArea.map(i => this._navItem(i)).join('')}
      <div style="height:4px"></div>
      <div class="sb-section-label" style="margin-top:4px">Church Info</div>
      ${churchInfo.map(i => this._navItem(i)).join('')}
    `
  }

  private _renderAdminNav(user: any, permitted: ReturnType<typeof getSidebarItems>): string {

    // Build accordion groups from registered modules
    const membershipItems = permitted.filter(i =>
      ['/members', '/groups', '/audit-logs', '/reports'].includes(i.path)
    )
    const servicesParent = permitted.find(i => i.path === '/services')
    const servicesTabs   = permitted.filter(i => i.parentPath === '/services')
    const servicesItems  = servicesParent ? [servicesParent, ...servicesTabs] : []
    const financeItems = permitted.filter(i => i.path.startsWith('/finance'))
    const accountsItems = permitted.filter(i =>
      ['/admin/users', '/admin/roles', '/admin/audit'].includes(i.path)
    )
    const otherItems = permitted.filter(i =>
      !membershipItems.includes(i) &&
      !servicesItems.includes(i) &&
      !financeItems.includes(i) &&
      !accountsItems.includes(i)
    )

    // Quick actions (always shown)
    const quickActions = [
      { path: '/members/add', icon: 'bi-person-plus', label: 'Add Member' },
    ]

    return /* html */`
      <div class="sb-section-label">Main Menu</div>

      ${membershipItems.length > 0 ? /* html */`
        <div class="sb-accord-item ${this._anyActive(membershipItems) ? 'open' : ''}" data-accord="members">
          <button class="sb-nav-item ${this._anyActive(membershipItems) ? 'active-glow' : ''} w-full" type="button" data-accord-trigger="members">
            <i class="bi bi-people-fill" aria-hidden="true"></i>
            <span class="sb-nav-item-label">Members</span>
            <i class="bi bi-chevron-down sb-accord-chevron" aria-hidden="true"></i>
          </button>
          <div class="sb-accord-content">
            <div class="sb-accord-sub">
              ${membershipItems.map(item => /* html */`
                <button class="sb-sub-item ${this._isActive(item.path) ? 'active' : ''}"
                  data-route="${item.path}"
                  ${COMING_SOON_PATHS.has(item.path) ? 'data-coming-soon="true"' : ''}
                  type="button">
                  ${item.label}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      ` : this._navItem({ path: '/members', icon: 'bi-people-fill', label: 'All Members' })}

      ${servicesParent ? /* html */`
        <div class="sb-accord-item ${this._anyActiveQ([servicesParent, ...servicesTabs]) ? 'open' : ''}" data-accord="services">
          <button class="sb-nav-item ${this._anyActiveQ([servicesParent, ...servicesTabs]) ? 'active-glow' : ''} w-full" type="button" data-accord-trigger="services">
            <i class="bi bi-calendar-event-fill" aria-hidden="true"></i>
            <span class="sb-nav-item-label">Services &amp; Events</span>
            <i class="bi bi-chevron-down sb-accord-chevron" aria-hidden="true"></i>
          </button>
          <div class="sb-accord-content">
            <div class="sb-accord-sub">
              ${servicesTabs.length > 0 ? servicesTabs.map(item => /* html */`
                <button class="sb-sub-item ${this._isActiveQ(item.path) ? 'active' : ''}"
                  data-route-full="${item.path}"
                  type="button">
                  ${item.label}
                </button>
              `).join('') : `
                <button class="sb-sub-item ${this._isActive('/services') ? 'active' : ''}"
                  data-route="/services" type="button">All Services</button>
              `}
            </div>
          </div>
        </div>
      ` : ''}

      ${financeItems.length > 0 ? /* html */`
        <div class="sb-accord-item ${this._anyActive(financeItems) ? 'open' : ''}" data-accord="finance">
          <button class="sb-nav-item ${this._anyActive(financeItems) ? 'active-glow' : ''} w-full" type="button" data-accord-trigger="finance">
            <i class="bi bi-cash-coin" aria-hidden="true"></i>
            <span class="sb-nav-item-label">Finance</span>
            <i class="bi bi-chevron-down sb-accord-chevron" aria-hidden="true"></i>
          </button>
          <div class="sb-accord-content">
            <div class="sb-accord-sub">
              ${financeItems.map(item => /* html */`
                <button class="sb-sub-item ${this._isActive(item.path) ? 'active' : ''}"
                  data-route="${item.path}" type="button">
                  ${item.label}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      ` : ''}

      ${accountsItems.length > 0 ? /* html */`
        <div class="sb-accord-item ${this._anyActive(accountsItems) ? 'open' : ''}" data-accord="accounts">
          <button class="sb-nav-item ${this._anyActive(accountsItems) ? 'active-glow' : ''} w-full" type="button" data-accord-trigger="accounts">
            <i class="bi bi-person-lock" aria-hidden="true"></i>
            <span class="sb-nav-item-label">Accounts &amp; Roles</span>
            <i class="bi bi-chevron-down sb-accord-chevron" aria-hidden="true"></i>
          </button>
          <div class="sb-accord-content">
            <div class="sb-accord-sub">
              ${accountsItems.map(item => /* html */`
                <button class="sb-sub-item ${this._isActive(item.path) ? 'active' : ''}"
                  data-route="${item.path}"
                  ${COMING_SOON_PATHS.has(item.path) ? 'data-coming-soon="true"' : ''}
                  type="button">
                  ${item.label}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      ` : ''}

      ${otherItems.map(item => this._navItem({
      path: item.path,
      icon: `bi-${item.icon}`,
      label: item.label,
      badge: item.badge,
      soon: COMING_SOON_PATHS.has(item.path) ? true : undefined,
    })).join('')}

      <div style="height:4px"></div>
      <div class="sb-section-label" style="margin-top:4px">Quick Actions</div>
      ${quickActions.map(i => this._navItem(i)).join('')}
    `
  }

  private _navItem(item: {
    path: string; icon: string; label: string;
    badge?: number | string | null; soon?: true
  }): string {
    const isSoon = item.soon || COMING_SOON_PATHS.has(item.path)
    const isActive = this._isActive(item.path)
    const badgeHtml = isSoon
      ? `<span class="sb-soon-badge" aria-label="Coming soon">SOON</span>`
      : item.badge
        ? `<span class="sb-count-badge" aria-label="${item.badge} items">${item.badge}</span>`
        : ''
    return /* html */`
      <button class="sb-nav-item${isActive ? ' active' : ''}"
        data-route="${item.path}"
        ${isSoon ? 'data-coming-soon="true"' : ''}
        style="${isSoon ? 'opacity:0.65;' : ''}"
        type="button"
        aria-current="${isActive ? 'page' : 'false'}">
        <i class="bi ${item.icon}" aria-hidden="true"></i>
        <span class="sb-nav-item-label">${item.label}</span>
        ${badgeHtml}
      </button>
    `
  }

  // ── Event binding ──────────────────────────────────────────────────────────

  private _bindEvents(): void {
    const el = this._el

    // Close button (mobile)
    el.querySelector('#sb-close-btn')?.addEventListener('click', () => closeDrawer())

    // Nav items (routes + coming soon)
    el.querySelectorAll<HTMLElement>('[data-route], [data-route-full]').forEach(btn => {
      btn.addEventListener('click', () => {
        const route = btn.dataset['route'] || btn.dataset['routeFull']
        if (!route) return
        if (btn.dataset['comingSoon'] === 'true') {
          closeDrawer()
          _showComingSoonToast(
            btn.querySelector('.sb-nav-item-label, .sb-sub-item')?.textContent?.trim()
            ?? btn.textContent?.trim()
            ?? 'This section'
          )
          return
        }
        closeDrawer()
        navigate(route)
      })
    })

    // Role switcher tabs
    el.querySelector('#sb-role-member')?.addEventListener('click', () => this._switchView('member'))
    el.querySelector('#sb-role-admin')?.addEventListener('click', () => this._switchView('admin'))

    // Accordion triggers — click to toggle, hover to expand
    el.querySelectorAll<HTMLElement>('[data-accord-trigger]').forEach(btn => {
      const getParent = () => {
        const key = btn.dataset['accordTrigger']!
        return el.querySelector<HTMLElement>(`[data-accord="${key}"]`)
      }
      btn.addEventListener('click', () => getParent()?.classList.toggle('open'))
      btn.addEventListener('mouseenter', () => getParent()?.classList.add('open'))
    })

    // Settings
    el.querySelector('#sb-settings-btn')?.addEventListener('click', () => {
      closeDrawer()
      import('@modules/settings/pages/SettingsOverlay').then(({ SettingsOverlay }) => SettingsOverlay.open())
    })

    // Logout
    el.querySelector('#sb-logout-btn')?.addEventListener('click', () => {
      closeDrawer()
      _showSignOutConfirm()
    })

    // Theme toggle
    const themeRow = el.querySelector('#sb-theme-row')
    const _doTheme = () => {
      const isDark = document.documentElement.dataset['theme'] === 'dark'
      const next = isDark ? 'light' : 'dark'
      document.documentElement.dataset['theme'] = next
      localStorage.setItem('caci-theme', next)
      this.render()
    }
    themeRow?.addEventListener('click', _doTheme)
    themeRow?.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent
      if (ke.key === 'Enter' || ke.key === ' ') { ke.preventDefault(); _doTheme() }
    })
  }

  // ── Role-view switching ────────────────────────────────────────────────────

  private _switchView(view: 'member' | 'admin'): void {
    this._activeView = view

    const memberPanel = this._el.querySelector<HTMLElement>('#sb-member-panel')
    const adminPanel = this._el.querySelector<HTMLElement>('#sb-admin-panel')
    const pill = this._el.querySelector<HTMLElement>('#sb-role-pill')
    const btnMember = this._el.querySelector<HTMLElement>('#sb-role-member')
    const btnAdmin = this._el.querySelector<HTMLElement>('#sb-role-admin')

    if (memberPanel) memberPanel.classList.toggle('hidden', view !== 'member')
    if (adminPanel) adminPanel.classList.toggle('hidden', view !== 'admin')

    pill?.classList.toggle('admin', view === 'admin')

    btnMember?.classList.toggle('active', view === 'member')
    btnAdmin?.classList.toggle('active', view === 'admin')
    btnMember?.setAttribute('aria-selected', String(view === 'member'))
    btnAdmin?.setAttribute('aria-selected', String(view === 'admin'))
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _isActive(path: string): boolean {
    return this._currentPath === path || this._currentPath.startsWith(path + '/')
  }

  private _anyActive(items: SidebarItem[]): boolean {
    return items.some(i => this._isActive(i.path))
  }

  private _isActiveQ(pathWithQuery: string): boolean {
    const rawHash = location.hash.replace(/^#/, '')
    // Default to schedule tab if no tab is specified
    if (rawHash === '/services' && pathWithQuery === '/services?tab=schedule') return true
    return rawHash === pathWithQuery || rawHash.startsWith(pathWithQuery + '&')
  }

  private _anyActiveQ(items: SidebarItem[]): boolean {
    return items.some(i => this._isActive(i.path.split('?')[0]))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level refresh helper (called by Shell.ts)
// ─────────────────────────────────────────────────────────────────────────────
// (Shell.ts holds the singleton instance and exposes refreshSidebar())