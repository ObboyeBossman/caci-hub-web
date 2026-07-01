// src/shell/WorkspaceShell.ts
// ─────────────────────────────────────────────────────────────────────────────
// Generic, reusable workspace shell.
// Renders a page header, pill tab-bar, and manages the active tab lifecycle.
// Modules configure it via ShellConfig — the shell itself never changes.
// ─────────────────────────────────────────────────────────────────────────────

import { can }            from '@core/authorization/authorization-service'
import { getCurrentUser } from '@core/auth'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkspaceTab {
  id:          string
  label:       string
  icon:        string     // Bootstrap Icons suffix
  permission?: string     // if set, tab is hidden unless user has this permission
  render(container: HTMLElement): void | Promise<void>
  destroy?(): void
}

export interface ShellConfig {
  /** Unique sessionStorage key for active-tab persistence */
  sessionKey:  string
  /** Bootstrap Icon suffix for the header icon (e.g. `'shield-lock-fill'`) */
  icon:        string
  /** Page title */
  title:       string
  /** Page subtitle */
  subtitle:    string
  /** Badge label (e.g. `'Admin Panel'`) */
  badgeLabel:  string
  /** Badge icon suffix */
  badgeIcon:   string
  /** Badge accent color — any CSS color value (e.g. `'var(--caci-red)'`) */
  badgeColor:  string
  /** Builds the URL pushed to history on each tab switch */
  buildUrl(tabId: string): string
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS  (scoped under .ws-*)
// ─────────────────────────────────────────────────────────────────────────────

const SHELL_CSS = /* css */`
/* ══════════════════════════════════════════════════════
   WORKSPACE SHELL  — scoped under .ws-*
══════════════════════════════════════════════════════ */

.ws-page {
  font-family: var(--font-sans);
}

/* ── Page header ── */
.ws-header {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: var(--space-lg);
  flex-wrap: wrap; margin-bottom: var(--space-xl);
}
.ws-header-left { display: flex; align-items: center; gap: 14px; }
.ws-header-icon-wrap {
  width: 48px; height: 48px; border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--caci-blue) 0%, var(--caci-blue-light) 100%);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(0,75,160,0.35); flex-shrink: 0;
}
.ws-header-icon-wrap i { font-size: 22px; color: #fff; }
.ws-page-title {
  font-size: var(--text-h1); font-weight: 700;
  color: var(--text-primary); margin: 0 0 2px;
  letter-spacing: -0.02em;
}
.ws-page-sub {
  font-size: var(--text-small); color: var(--text-secondary); margin: 0;
}
.ws-header-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 99px;
  font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em;
}
.ws-header-badge i { font-size: 11px; }

/* ── Tab bar ── */
.ws-tabbar-wrap {
  margin-bottom: var(--space-xl);
  display: flex; justify-content: center;
}
.ws-tabbar {
  display: inline-flex; align-items: center;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 999px; padding: 4px; gap: 2px;
  overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.25),
              0 2px 12px rgba(0,0,0,0.1);
  scroll-behavior: smooth;
}
.ws-tabbar::-webkit-scrollbar { display: none; }

.ws-tab {
  display: flex; align-items: center; gap: 7px;
  padding: 8px 18px; border-radius: 999px; border: none;
  background: transparent; color: var(--text-secondary);
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
  white-space: nowrap; font-family: var(--font-sans); flex-shrink: 0;
}
.ws-tab i { font-size: 15px; transition: transform 0.2s; }
.ws-tab:hover:not(.active) {
  color: var(--text-primary);
  background: rgba(255,255,255,0.04);
}
.ws-tab.active {
  background: var(--bg-page);
  color: var(--text-primary); font-weight: 600;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06);
}
.ws-tab.active i { color: var(--caci-blue-light); }

@media (max-width: 480px) {
  .ws-tab { padding: 8px 10px; gap: 0; }
  .ws-tab span:not(.ws-tab-icon) { display: none; }
  .ws-tab-icon { font-size: 18px !important; }
}

/* ── Content area ── */
.ws-content {
  animation: wsFadeIn 0.28s cubic-bezier(0.16,1,0.3,1) both;
}
@keyframes wsFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Divider under tab bar ── */
.ws-tab-divider {
  height: 1px;
  background: var(--border-default);
  margin-bottom: var(--space-xl);
  opacity: 0.5;
}
`

function _injectShellCSS(): void {
  if (document.getElementById('ws-shell-css')) return
  const s = document.createElement('style')
  s.id = 'ws-shell-css'
  s.textContent = SHELL_CSS
  document.head.appendChild(s)
}

// ─────────────────────────────────────────────────────────────────────────────
// SHELL CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class WorkspaceShell {
  private _container:   HTMLElement
  private _config:      ShellConfig
  private _tabs:        WorkspaceTab[]
  private _visibleTabs: WorkspaceTab[]
  private _activeTabId: string | null = null
  private _contentEl:   HTMLElement | null = null
  private _destroyed    = false

  constructor(
    container: HTMLElement,
    tabs:      WorkspaceTab[],
    config:    ShellConfig,
    initialTabId?: string,
  ) {
    _injectShellCSS()
    this._container = container
    this._config    = config
    this._tabs      = tabs

    // Filter tabs by permission
    const user = getCurrentUser()
    this._visibleTabs = tabs.filter(t =>
      !t.permission || (user && can(user, t.permission as any))
    )

    this._render(initialTabId)
  }

  private _render(initialTabId?: string): void {
    const user = getCurrentUser()
    const cfg  = this._config

    // Inline badge style derived from config color
    const badgeBg     = `color-mix(in srgb, ${cfg.badgeColor} 15%, transparent)`
    const badgeBorder = `color-mix(in srgb, ${cfg.badgeColor} 35%, transparent)`

    this._container.innerHTML = /* html */`
      <div class="ws-page">

        <!-- Header -->
        <div class="ws-header">
          <div class="ws-header-left">
            <div class="ws-header-icon-wrap">
              <i class="bi bi-${cfg.icon}"></i>
            </div>
            <div>
              <h1 class="ws-page-title">${cfg.title}</h1>
              <p class="ws-page-sub">${cfg.subtitle}</p>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:var(--space-sm);flex-wrap:wrap;">
            <span class="ws-header-badge" style="background:${badgeBg};border:1px solid ${badgeBorder};color:${cfg.badgeColor};">
              <i class="bi bi-${cfg.badgeIcon}"></i>
              ${cfg.badgeLabel}
            </span>
            ${user ? `<span style="font-size:12px;color:var(--text-muted);">
              Signed in as <strong style="color:var(--text-secondary);">${user.fullName}</strong>
            </span>` : ''}
          </div>
        </div>

        <!-- Tab bar -->
        <div class="ws-tabbar-wrap">
          <div class="ws-tabbar" id="ws-tabbar" role="tablist">
            ${this._visibleTabs.map(t => `
              <button
                class="ws-tab"
                role="tab"
                data-tab-id="${t.id}"
                aria-selected="false"
                title="${t.label}"
              >
                <i class="bi bi-${t.icon} ws-tab-icon"></i>
                <span>${t.label}</span>
              </button>`).join('')}
          </div>
        </div>

        <div class="ws-tab-divider"></div>

        <!-- Tab content -->
        <div class="ws-content" id="ws-content" role="tabpanel"></div>

      </div>`

    this._contentEl = this._container.querySelector<HTMLElement>('#ws-content')!

    // Bind tab buttons
    this._container.querySelectorAll<HTMLButtonElement>('.ws-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this._destroyed) this._switchTab(btn.dataset['tabId']!)
      })

      // Keyboard navigation
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (!this._destroyed) this._switchTab(btn.dataset['tabId']!)
        }
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault()
          const tabs   = [...this._container.querySelectorAll<HTMLButtonElement>('.ws-tab')]
          const idx    = tabs.indexOf(btn)
          const next   = e.key === 'ArrowRight'
            ? (idx + 1) % tabs.length
            : (idx - 1 + tabs.length) % tabs.length
          tabs[next]?.focus()
          this._switchTab(tabs[next]?.dataset['tabId']!)
        }
      })
    })

    // Activate initial tab, saved tab, or first
    // Priority: initialTabId (from URL) > savedTabId (session) > first available tab
    const savedTabId = sessionStorage.getItem(this._config.sessionKey)
    const firstTab   = this._visibleTabs[0]
    const targetId   =
      (initialTabId && this._visibleTabs.find(t => t.id === initialTabId)) ? initialTabId :
      (savedTabId   && this._visibleTabs.find(t => t.id === savedTabId))   ? savedTabId   :
      firstTab?.id ?? null

    if (targetId) this._switchTab(targetId)
  }

  private async _switchTab(id: string): Promise<void> {
    if (this._destroyed) return
    const tab = this._visibleTabs.find(t => t.id === id)
    if (!tab || !this._contentEl) return

    // Destroy current tab
    if (this._activeTabId) {
      const current = this._tabs.find(t => t.id === this._activeTabId)
      try { current?.destroy?.() } catch (e) { console.error('[WorkspaceShell] destroy error', e) }
    }

    // Update tab bar UI
    this._container.querySelectorAll<HTMLButtonElement>('.ws-tab').forEach(btn => {
      const isActive = btn.dataset['tabId'] === id
      btn.classList.toggle('active', isActive)
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false')
      if (isActive) this._scrollTabIntoView(btn)
    })

    this._activeTabId = id
    sessionStorage.setItem(this._config.sessionKey, id)

    // Sync URL silently without triggering router reload
    history.replaceState(null, '', this._config.buildUrl(id))

    // Clear and re-animate content
    this._contentEl.innerHTML = ''
    this._contentEl.style.animation = 'none'
    requestAnimationFrame(() => {
      this._contentEl!.style.animation = ''
    })

    try {
      await tab.render(this._contentEl)
    } catch (e) {
      console.error(`[WorkspaceShell] render error for tab "${id}"`, e)
      this._contentEl.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--text-secondary);font-size:13px;">
          <i class="bi bi-exclamation-circle" style="font-size:2rem;color:var(--caci-red);display:block;margin-bottom:12px;"></i>
          Failed to load this section. Please try again.
        </div>`
    }
  }

  private _scrollTabIntoView(btn: HTMLButtonElement): void {
    const bar = this._container.querySelector<HTMLElement>('#ws-tabbar')
    if (!bar) return
    const btnLeft   = btn.offsetLeft
    const btnW      = btn.offsetWidth
    const barW      = bar.offsetWidth
    const target    = btnLeft - (barW / 2) + (btnW / 2)
    const maxScroll = bar.scrollWidth - barW
    bar.scrollTo({ left: Math.max(0, Math.min(target, maxScroll)), behavior: 'smooth' })
  }

  /** Programmatically switch to a tab by id. */
  navigateTo(tabId: string): void {
    if (!this._destroyed) this._switchTab(tabId)
  }

  destroy(): void {
    this._destroyed = true
    if (this._activeTabId) {
      const current = this._tabs.find(t => t.id === this._activeTabId)
      try { current?.destroy?.() } catch (_) {}
    }
    this._container.innerHTML = ''
    this._contentEl = null
  }
}
