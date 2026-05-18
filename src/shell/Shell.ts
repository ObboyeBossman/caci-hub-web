// src/shell/Shell.ts
// The top-level rendering container.
// Renders toolbar + sidebar + #page-content.
// Reads from the registry — has zero knowledge of which modules exist.

import { getSidebarItems } from '@core/registry'
import { getCurrentUser, isAuthenticated } from '@core/auth'
import { hasPermission } from '@core/permissions'
import { Sidebar } from './Sidebar'
import { Toolbar } from './Toolbar'

let _sidebar: Sidebar | null = null
let _toolbar: Toolbar | null = null

/**
 * Mount the shell into #app.
 * Creates the toolbar + sidebar + page-content area.
 * Called once at boot, before startRouter().
 * For fullscreen routes, the shell is bypassed — the router renders directly.
 */
export function mountShell(): void {
  const app = document.getElementById('app')
  if (!app) return

  app.innerHTML = `
    <div class="shell-toolbar" id="shell-toolbar"></div>
    <div class="shell-layout">
      <nav class="sidebar" id="shell-sidebar" aria-label="Main navigation"></nav>
      <div class="sidebar-scrim" id="sidebar-scrim"></div>
      <main id="page-content" role="main"></main>
    </div>
  `

  // Mount toolbar
  const toolbarEl = document.getElementById('shell-toolbar')!
  _toolbar = new Toolbar(toolbarEl)
  _toolbar.render()

  // Mount sidebar
  const sidebarEl = document.getElementById('shell-sidebar')!
  _sidebar = new Sidebar(sidebarEl)
  _sidebar.render()

  // Scrim tap closes mobile drawer
  const scrim = document.getElementById('sidebar-scrim')!
  scrim.addEventListener('click', () => closeMobileDrawer())
}

/**
 * Render a fullscreen page (auth, onboarding) — no shell chrome.
 * Replaces the #app content entirely.
 */
export function mountFullscreen(): void {
  const app = document.getElementById('app')
  if (!app) return
  app.innerHTML = `<div id="page-content" role="main"></div>`
}

/**
 * Update the active nav item in the sidebar after each navigation.
 * Called by the router after every successful page render.
 */
export function updateActiveNav(path: string): void {
  _sidebar?.setActivePath(path)
}

/**
 * Refresh sidebar items (e.g. after login when user role is known).
 */
export function refreshSidebar(): void {
  _sidebar?.render()
}

export function openMobileDrawer(): void {
  const sidebar = document.getElementById('shell-sidebar')
  const scrim   = document.getElementById('sidebar-scrim')
  sidebar?.classList.add('mobile-open')
  scrim?.classList.add('visible')
  document.body.style.overflow = 'hidden'
}

export function closeMobileDrawer(): void {
  const sidebar = document.getElementById('shell-sidebar')
  const scrim   = document.getElementById('sidebar-scrim')
  sidebar?.classList.remove('mobile-open')
  scrim?.classList.remove('visible')
  document.body.style.overflow = ''
}

export function toggleMobileDrawer(): void {
  const sidebar = document.getElementById('shell-sidebar')
  if (sidebar?.classList.contains('mobile-open')) {
    closeMobileDrawer()
  } else {
    openMobileDrawer()
  }
}