// src/shell/Shell.ts
// ─────────────────────────────────────────────────────────────────────────────
// CACI Hub Web — Shell entry point  (drawer-first redesign)
//
// Layout: full-width topnav  +  overlay drawer sidebar (always).
// No persistent sidebar at any breakpoint — the drawer is the only nav surface.
// ─────────────────────────────────────────────────────────────────────────────

import { _Toolbar } from './Toolbar'
import { _Sidebar } from './Sidebar'
import { closeDrawer } from './Drawer'
import { _initNotificationBell } from './NotificationBell'

import logoUrl from '../assets/caci-logo.png'
export { logoUrl }

// ─────────────────────────────────────────────────────────────────────────────
// Design-system tokens + layout CSS
// ─────────────────────────────────────────────────────────────────────────────

const SHELL_CSS = /* css */`
/* ═══════════════════════════════════════════════════════════════════════════
   CACI Hub Shell — Design tokens + drawer-first layout
═══════════════════════════════════════════════════════════════════════════ */

/* ── 1. Design tokens ────────────────────────────────────────────────────── */
:root {
  /* Brand */
  --ds-red:        #C60026;
  --ds-red-light:  #FF1A46;
  --ds-red-dim:    #8C001A;
  --ds-red-bg:     rgba(198,0,38,.10);
  --ds-blue:       #004BA0;
  --ds-blue-light: #4D9FFF;
  --ds-blue-dim:   #003578;
  --ds-blue-bg:    rgba(0,75,160,.12);
  --ds-night:      #010409;

  /* Neutral scale */
  --ds-n900: #0d1117;
  --ds-n800: #161b22;
  --ds-n700: #21262d;
  --ds-n600: #30363d;
  --ds-n500: #484f58;
  --ds-n400: #6e7681;
  --ds-n300: #8b949e;
  --ds-n200: #c9d1d9;
  --ds-n100: #e6edf3;
  --ds-n50:  #f6f8fa;

  /* Semantic */
  --ds-green:     #1a7f37;
  --ds-green-bg:  rgba(26,127,55,.12);
  --ds-amber:     #9a6700;
  --ds-amber-bg:  rgba(154,103,0,.12);

  /* Font */
  --ds-font-sans: 'Segoe UI', system-ui, -apple-system, sans-serif;

  /* Spacing */
  --sp-xs: 4px;  --sp-sm: 8px;  --sp-md: 12px; --sp-lg: 16px;
  --sp-xl: 24px; --sp-2xl: 32px;

  /* Radii */
  --r-sm: 6px; --r-md: 8px; --r-lg: 12px; --r-pill: 9999px;

  /* Shell */
  --topnav-height: 56px;
  --drawer-width:  248px;
}

/* ── 2. Light-mode tokens ─────────────────────────────────────────────────── */
:root,
[data-theme="light"] {
  --bg-page:        #f0f2f5;
  --bg-card:        #ffffff;
  --bg-topnav:      #ffffff;
  --bg-hover:       rgba(0,0,0,0.04);
  --bg-input:       #ffffff;

  --text-primary:   var(--ds-n900);
  --text-secondary: var(--ds-n400);
  --text-muted:     var(--ds-n300);
  --text-on-brand:  #ffffff;
  --text-link:      var(--ds-blue);
  --text-danger:    var(--ds-red);
  --text-success:   var(--ds-green);
  --text-warning:   var(--ds-amber);
  --text-placeholder: var(--ds-n300);

  --border-default: var(--ds-n100);
  --border-strong:  var(--ds-n200);
  --border-focus:   var(--ds-blue);

  --topnav-border:  var(--ds-n100);
}

/* ── 3. Dark-mode tokens ──────────────────────────────────────────────────── */
[data-theme="dark"] {
  --bg-page:        var(--ds-n900);
  --bg-card:        var(--ds-n800);
  --bg-topnav:      var(--ds-n900);
  --bg-hover:       var(--ds-n700);
  --bg-input:       var(--ds-n900);

  --text-primary:   var(--ds-n100);
  --text-secondary: var(--ds-n300);
  --text-muted:     var(--ds-n400);
  --text-on-brand:  #ffffff;
  --text-link:      var(--ds-blue-light);
  --text-danger:    var(--ds-red-light);
  --text-success:   #56d364;
  --text-warning:   #e3b341;
  --text-placeholder: var(--ds-n500);

  --border-default: var(--ds-n700);
  --border-strong:  var(--ds-n600);
  --border-focus:   var(--ds-blue-light);

  --topnav-border:  var(--ds-n700);

  --ds-blue-bg:   rgba(0,75,160,.18);
  --ds-red-bg:    rgba(198,0,38,.14);
  --ds-green:     #56d364;
  --ds-amber:     #e3b341;
  --ds-red-dim:   #FF1A46;
  --ds-blue-dim:  var(--ds-blue-light);
}

/* ── 4. Reset ────────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }
html, body {
  height: 100%; margin: 0; padding: 0;
  font-family: var(--ds-font-sans);
  font-size: 14px; line-height: 1.5;
  color: var(--text-primary);
  background: var(--bg-page);
  -webkit-font-smoothing: antialiased;
}

/* ── 5. App root ──────────────────────────────────────────────────────────── */
#app {
  display: flex; flex-direction: column;
  height: 100vh; overflow: hidden;
}

/* ── 6. Offline banner ────────────────────────────────────────────────────── */
.offline-banner {
  display: none; align-items: center; justify-content: center;
  gap: 8px; padding: 7px 16px;
  background: var(--ds-amber); color: #fff;
  font-size: 13px; font-weight: 500; flex-shrink: 0; z-index: 90;
}
.offline-banner.show { display: flex; }

/* ── 7. Shell layout — no sidebar slot, just page content ─────────────────── */
.shell-layout {
  display: flex; flex: 1; overflow: hidden;
  position: relative;
}

/* ── 8. Page content ─────────────────────────────────────────────────────── */
#page-content {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  background: var(--bg-page);
  position: relative;
}
`

export function _injectShellCSS(): void {
  if (document.getElementById('caci-shell-css')) return
  const style = document.createElement('style')
  style.id = 'caci-shell-css'
  style.textContent = SHELL_CSS
  document.head.appendChild(style)
}

// ─────────────────────────────────────────────────────────────────────────────
// Singletons
// ─────────────────────────────────────────────────────────────────────────────

let _sidebar: _Sidebar | null = null
let _toolbar: _Toolbar | null = null

// ─────────────────────────────────────────────────────────────────────────────
// Mount / unmount
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mount the shell (topnav + overlay drawer + page-content).
 * Idempotent — safe to call on every authenticated navigation.
 */
export function mountShell(): void {
  _injectShellCSS()

  const app = document.getElementById('app')
  if (!app) return
  if (app.querySelector('.shell-layout')) return  // already mounted

  app.innerHTML = /* html */`
    <nav class="topnav" id="shell-topnav" role="banner"></nav>
    <div class="offline-banner" id="shell-offline-banner" role="alert" aria-live="polite">
      <i class="bi bi-wifi-off" aria-hidden="true"></i>
      <span>You're offline — some data may be out of date.</span>
    </div>
    <div class="shell-layout">
      <div class="drawer-backdrop" id="drawerBackdrop" aria-hidden="true"></div>
      <aside class="dash-sidebar" id="shell-sidebar" aria-label="Main navigation"></aside>
      <main id="page-content" role="main"></main>
    </div>
    <div class="shell-toast" id="shell-toast" role="status" aria-live="polite"></div>
  `

  // Offline banner
  const _updateOffline = () => {
    const banner = document.getElementById('shell-offline-banner')
    if (!banner) return
    navigator.onLine ? banner.classList.remove('show') : banner.classList.add('show')
  }
  window.addEventListener('online',  _updateOffline)
  window.addEventListener('offline', _updateOffline)
  setTimeout(_updateOffline, 80)

  // Toolbar
  const toolbarEl = document.getElementById('shell-topnav')!
  _toolbar = new _Toolbar(toolbarEl)
  _toolbar.render()

  // Sidebar (drawer)
  const sidebarEl = document.getElementById('shell-sidebar')!
  _sidebar = new _Sidebar(sidebarEl)
  try { _sidebar.render() } catch (e) {
    console.error('[Shell] Sidebar render failed:', e)
  }

  // Backdrop click → close drawer
  document.getElementById('drawerBackdrop')!.addEventListener('click', closeDrawer)

  // Notification bell
  _initNotificationBell()
}

/**
 * Render a fullscreen page (auth, onboarding) — no shell chrome.
 * Only tears down the shell if it is currently mounted.
 */
export function mountFullscreen(): void {
  _injectShellCSS()

  const app = document.getElementById('app')
  if (!app) return

  const hasShell = !!app.querySelector('.shell-layout')
  if (!hasShell && app.querySelector('#page-content')) return // already fullscreen

  _toolbar?.destroy()
  _toolbar = null
  _sidebar = null

  app.innerHTML = `<div id="page-content" role="main"></div>`
}

/**
 * Update active nav item after each route change.
 */
export function updateActiveNav(path: string, prevPath?: string): void {
  _sidebar?.setActivePath(path, prevPath)
}

/**
 * Re-render the sidebar (e.g. after a profile update).
 */
export function refreshSidebar(): void {
  _sidebar?.render()
}