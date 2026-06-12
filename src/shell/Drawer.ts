// src/shell/Drawer.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mobile overlay drawer + desktop sidebar collapse.
// CSS lives here; Shell.ts imports SIDEBAR_COLLAPSE_KEY and _isMobile.
// ─────────────────────────────────────────────────────────────────────────────

const DRAWER_CSS = /* css */`
/* ═══════════════════════════════════════════════════════════════════════════
   DRAWER BACKDROP  (mobile / tablet only)
═══════════════════════════════════════════════════════════════════════════ */
.drawer-backdrop {
  display: none; position: fixed; inset: 0;
  background: rgba(0,0,0,0.42); z-index: 200;
  opacity: 0; transition: opacity 0.28s ease;
}
.drawer-backdrop.show { opacity: 1; }

@media (max-width: 1024px) {
  /* No overrides needed here anymore, backdrop is global */
}
@media (min-width: 1025px) {
  .drawer-backdrop { display: none !important; }
}
`

function _injectDrawerCSS(): void {
  if (document.getElementById('caci-drawer-css')) return
  const style = document.createElement('style')
  style.id = 'caci-drawer-css'
  style.textContent = DRAWER_CSS
  document.head.appendChild(style)
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers (shared with Shell.ts and Sidebar.ts)
// ─────────────────────────────────────────────────────────────────────────────

export const SIDEBAR_COLLAPSE_KEY = 'caci:sidebar-collapsed'

export function _isMobile(): boolean {
  return window.innerWidth <= 1024
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

let _drawerOpen = false

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function openDrawer(): void {
  _injectDrawerCSS()
  _drawerOpen = true
  document.body.classList.add('drawer-open')
  const sidebar  = document.getElementById('shell-sidebar')
  const backdrop = document.getElementById('drawerBackdrop')
  sidebar?.classList.add('drawer-open')
  if (backdrop) {
    backdrop.style.display = 'block'
    requestAnimationFrame(() => backdrop.classList.add('show'))
  }
}

export function closeDrawer(): void {
  _drawerOpen = false
  document.body.classList.remove('drawer-open')
  const sidebar  = document.getElementById('shell-sidebar')
  const backdrop = document.getElementById('drawerBackdrop')
  sidebar?.classList.remove('drawer-open')
  if (backdrop) {
    backdrop.classList.remove('show')
    setTimeout(() => { if (!_drawerOpen) backdrop.style.display = 'none' }, 300)
  }
}

export function toggleDrawer(): void {
  _injectDrawerCSS()
  _drawerOpen ? closeDrawer() : openDrawer()
}

// Legacy aliases
export const openMobileDrawer   = openDrawer
export const closeMobileDrawer  = closeDrawer
export const toggleMobileDrawer = toggleDrawer