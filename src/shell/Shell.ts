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

/* ── 1. Primitive tokens ─────────────────────────────────────────────────── */
:root {
  /* Brand */
  --caci-red:         #C60026;
  --caci-red-light:   #FF1A46;
  --caci-red-dim:     #8C001A;
  --caci-blue:        #004BA0;
  --caci-blue-light:  #4D9FFF;
  --caci-blue-dim:    #003578;
  --caci-white:       #FFFFFF;
  --caci-night:       #010409;

  /* Red scale */
  --red-50:  #fff0f2;
  --red-100: #ffc0cc;
  --red-200: #ff7090;
  --red-300: #e8003a;
  --red-500: #C60026;
  --red-700: #8C001A;
  --red-800: #5a0010;
  --red-900: #2d0008;

  /* Blue scale */
  --blue-50:  #EFF5FF;
  --blue-100: #b3d0ff;
  --blue-200: #6ba3f5;
  --blue-300: #4D9FFF;
  --blue-500: #004BA0;
  --blue-700: #003578;
  --blue-800: #002050;
  --blue-900: #000d28;

  /* Neutral scale */
  --n50:  #f6f8fa;
  --n100: #e6edf3;
  --n200: #c9d1d9;
  --n300: #8b949e;
  --n400: #6e7681;
  --n500: #484f58;
  --n600: #30363d;
  --n700: #21262d;
  --n800: #161b22;
  --n900: #0d1117;

  /* Semantic primitives */
  --green:        #1a7f37;
  --green-bg:     #dafbe1;
  --green-bg-dim: rgba(26, 127, 55, 0.15);
  --amber:        #9a6700;
  --amber-bg:     #fff8c5;
  --amber-bg-dim: rgba(154, 103, 0, 0.15);

  /* Typography */
  --font-sans:  'Segoe UI', system-ui, -apple-system, sans-serif;
  --font-serif: Georgia, 'Times New Roman', serif;
  --font-mono:  'SF Mono', Consolas, 'Courier New', monospace;

  --text-display: 32px;
  --text-h1:      24px;
  --text-h2:      20px;
  --text-h3:      16px;
  --text-body-lg: 15px;
  --text-body:    14px;
  --text-small:   12px;
  --text-label:   11px;
  --text-mono:    13px;

  /* Spacing */
  --space-xs:  4px;  --space-sm:  8px;  --space-md:  12px; --space-lg:  16px;
  --space-xl:  24px; --space-2xl: 32px; --space-3xl: 48px; --space-4xl: 64px;

  /* Aliases kept for any shell components still using old names */
  --sp-xs: var(--space-xs); --sp-sm: var(--space-sm);
  --sp-md: var(--space-md); --sp-lg: var(--space-lg);
  --sp-xl: var(--space-xl); --sp-2xl: var(--space-2xl);

  /* Border radius */
  --radius-none: 2px;
  --radius-xs:   4px;
  --radius-sm:   6px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-pill: 9999px;

  /* Aliases kept for any shell components still using old names */
  --r-sm: var(--radius-sm); --r-md: var(--radius-md);
  --r-lg: var(--radius-lg); --r-pill: var(--radius-pill);

  /* ds- aliases (backward compat for Toolbar/Sidebar) */
  --ds-font-sans:  var(--font-sans);
  --ds-red:        var(--caci-red);
  --ds-red-light:  var(--caci-red-light);
  --ds-red-dim:    var(--caci-red-dim);
  --ds-blue:       var(--caci-blue);
  --ds-blue-light: var(--caci-blue-light);
  --ds-blue-dim:   var(--caci-blue-dim);
  --ds-night:      var(--caci-night);
  --ds-amber:      var(--amber);
  --ds-n400:       var(--n400);

  /* Elevation */
  --shadow-flat:    none;
  --shadow-raised:  0 1px 3px rgba(0,0,0,.08);
  --shadow-overlay: 0 8px 24px rgba(0,0,0,.12);

  /* Shell */
  --topnav-height: 56px;
  --drawer-width:  300px;
}

/* ── 2. Light-mode tokens ─────────────────────────────────────────────────── */
:root,
[data-theme="light"] {
  /* Backgrounds */
  --bg-page:    #f6f8fa;
  --bg-card:    #ffffff;
  --bg-nav:     #004BA0;
  --bg-topnav:  #ffffff;
  --bg-hover:   rgba(0,0,0,0.04);
  --bg-input:   #ffffff;
  --bg-danger:  #fff0f2;
  --bg-info:    #EFF5FF;
  --bg-success: #dafbe1;
  --bg-warning: #fff8c5;

  /* Text */
  --text-primary:     #0d1117;
  --text-secondary:   #6e7681;
  --text-muted:       #8b949e;
  --text-link:        #004BA0;
  --text-danger:      #C60026;
  --text-success:     #1a7f37;
  --text-on-brand:    #ffffff;
  --text-placeholder: var(--n300);

  /* Borders */
  --border-default: #e6edf3;
  --border-strong:  #c9d1d9;
  --border-focus:   #004BA0;
  --border-danger:  #C60026;
  --topnav-border:  #e6edf3;

  /* Accent */
  --accent: #C60026;
  --link:   #004BA0;

  /* Focus rings */
  --focus-ring:        rgba(0, 75, 160, 0.15);
  --focus-ring-danger: rgba(198, 0, 38, 0.12);
}

/* ── 3. Dark-mode tokens ──────────────────────────────────────────────────── */
[data-theme="dark"] {
  /* Backgrounds */
  --bg-page:    #0d1117;
  --bg-card:    #161b22;
  --bg-nav:     #010409;
  --bg-topnav:  #0d1117;
  --bg-hover:   #21262d;
  --bg-input:   #0d1117;
  --bg-danger:  rgba(198, 0, 38, 0.12);
  --bg-info:    rgba(0, 75, 160, 0.15);
  --bg-success: rgba(26, 127, 55, 0.15);
  --bg-warning: rgba(154, 103, 0, 0.15);

  /* Text */
  --text-primary:     #e6edf3;
  --text-secondary:   #8b949e;
  --text-muted:       #6e7681;
  --text-link:        #4D9FFF;
  --text-danger:      #FF1A46;
  --text-success:     #1a7f37;
  --text-on-brand:    #ffffff;
  --text-placeholder: #484f58;

  /* Borders */
  --border-default: #30363d;
  --border-strong:  #484f58;
  --border-focus:   #4D9FFF;
  --border-danger:  #FF1A46;
  --topnav-border:  #21262d;

  /* Accent */
  --accent: #E8003A;
  --link:   #4D9FFF;

  /* Focus rings */
  --focus-ring:        rgba(77, 159, 255, 0.20);
  --focus-ring-danger: rgba(255, 26, 70, 0.20);
}

/* ── 4. Reset ────────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  height: 100%; 
  font-family: var(--font-sans);
  font-size: var(--text-body); line-height: 1.5;
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