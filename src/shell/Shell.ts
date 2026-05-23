// src/shell/Shell.ts
// The top-level rendering container.
// Renders topnav + drawer sidebar + #page-content.
// Reads from the registry — has zero knowledge of which modules exist.

import { Sidebar } from './Sidebar'
import { Toolbar } from './Toolbar'

let _sidebar: Sidebar | null = null
let _toolbar: Toolbar | null = null

/**
 * Mount the shell into #app.
 * Creates the topnav + sidebar drawer + page-content area.
 * Called once at boot, before startRouter().
 */
export function mountShell(): void {
  const app = document.getElementById('app')
  if (!app) return

  if (app.querySelector('.shell-layout')) return

  app.innerHTML = `
    <nav class="topnav" id="shell-topnav"></nav>
    <div class="offline-banner" id="shell-offline-banner">
      <i class="bi bi-wifi-off"></i>
      <span>You're offline — some data may be out of date.</span>
    </div>
    <div class="drawer-backdrop" id="drawerBackdrop"></div>
    <div class="shell-layout">
      <aside class="dash-sidebar" id="shell-sidebar" aria-label="Main navigation"></aside>
      <main id="page-content" role="main"></main>
    </div>
    <div class="toast" id="toast"></div>
  `

  // Offline banner logic
  const updateOfflineStatus = () => {
    const banner = document.getElementById('shell-offline-banner')
    if (!banner) return
    const isOffline = !navigator.onLine
    if (isOffline) banner.classList.add('show')
    else banner.classList.remove('show')
    console.log(`[Shell] Connectivity changed: ${isOffline ? 'OFFLINE' : 'online'}`)
  }
  window.addEventListener('online',  updateOfflineStatus)
  window.addEventListener('offline', updateOfflineStatus)
  setTimeout(updateOfflineStatus, 100)

  // Mount toolbar
  const toolbarEl = document.getElementById('shell-topnav')!
  _toolbar = new Toolbar(toolbarEl)
  _toolbar.render()

  // Mount sidebar
  const sidebarEl = document.getElementById('shell-sidebar')!
  _sidebar = new Sidebar(sidebarEl)
  _sidebar.render()

  // Backdrop closes drawer
  const backdrop = document.getElementById('drawerBackdrop')!
  backdrop.addEventListener('click', () => closeDrawer())
}

/**
 * Render a fullscreen page (auth, onboarding) — no shell chrome.
 */
export function mountFullscreen(): void {
  const app = document.getElementById('app')
  if (!app) return

  if (!app.querySelector('.shell-layout') && app.querySelector('#page-content')) return

  app.innerHTML = `<div id="page-content" role="main"></div>`
}

/**
 * Update the active nav item in the sidebar after each navigation.
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

export function openDrawer(): void {
  document.body.classList.add('drawer-open')
  const bd = document.getElementById('drawerBackdrop')
  if (bd) {
    bd.style.display = 'block'
    requestAnimationFrame(() => bd.classList.add('show'))
  }
}

export function closeDrawer(): void {
  document.body.classList.remove('drawer-open')
  const bd = document.getElementById('drawerBackdrop')
  if (bd) {
    bd.classList.remove('show')
    setTimeout(() => {
      if (!document.body.classList.contains('drawer-open')) bd.style.display = 'none'
    }, 260)
  }
}

export function toggleDrawer(): void {
  document.body.classList.contains('drawer-open') ? closeDrawer() : openDrawer()
}

// Legacy aliases kept for backward compat
export const openMobileDrawer  = openDrawer
export const closeMobileDrawer = closeDrawer
export const toggleMobileDrawer = toggleDrawer

export function showToast(msg: string, duration = 2400): void {
  const t = document.getElementById('toast')
  if (!t) return
  t.textContent = msg
  t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), duration)
}