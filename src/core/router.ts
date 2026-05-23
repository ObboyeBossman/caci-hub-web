// src/core/router.ts
// Hash-based SPA router.
// Reads routes from the registry, runs the middleware pipeline,
// and hands matched pages the #page-content element to render into.
//
// PAGE RENDERING CONTRACT:
//   navigate away from current page → currentPage.destroy?.()
//   navigate into new page          → await newPage.render(contentArea)
//
// Route params are passed via container.dataset before render():
//   container.dataset.memberId = params.id
//   // Page reads: const memberId = container.dataset.memberId!
//
// Mirrors: app_router.dart (GoRouter) redirect + ShellRoute logic (Flutter)

import { getRoutes }     from './registry'
import { runMiddleware } from './middleware'
import type { PageModule } from '../types/module.types'
import { mountShell, mountFullscreen } from '../shell/Shell'

let _activePage: PageModule | null = null
let _currentPresentation: string = 'shell'
let _routerStarted = false
let _lastResolvedHash: string | null = null

/**
 * Start the hash router. Call this LAST in the boot sequence —
 * after registerModule(), loadCurrentUser(), and initModules().
 * Attaches hashchange listener and resolves the current URL immediately.
 */
export function startRouter(): void {
  if (_routerStarted) return
  _routerStarted = true
  
  window.addEventListener('hashchange', _resolve)
  document.addEventListener('click', _handleLinkClick)
  _resolve()
}

/**
 * Navigate to a hash path (without the leading '#').
 * e.g. navigate('/members') → sets location.hash = '/members'
 */
export function navigate(path: string): void {
  location.hash = path
}

// ── Internal ──────────────────────────────────────────────────────────────────

async function _resolve(): Promise<void> {
  const currentHash = location.hash || '#/'
  if (_lastResolvedHash === currentHash) return
  _lastResolvedHash = currentHash

  const path   = currentHash.slice(1)
  const routes = getRoutes()
  const matched = routes.find(r => _matchPath(r.path, path))

  if (!matched) {
    console.log(`[router] No route matched: ${path}`)
    _render404(path)
    return
  }

  const result = await runMiddleware(matched, path)
  if (!result.allowed) {
    navigate(result.redirect ?? '/login')
    return
  }

  // Redirect-only routes (no page) — e.g. '/' → '/members'
  if (matched.redirect) {
    navigate(matched.redirect)
    return
  }

  if (!matched.page) {
    console.error(`[router] Route ${matched.path} has neither page nor redirect`)
    return
  }

  // Destroy the current page before loading the next one.
  // Mirrors: Flutter Navigator.pop + new route push lifecycle.
  try {
    _activePage?.destroy?.()
  } catch (err) {
    console.error('[router] Error in page destroy()', err)
  }

  // Lazy-load the page module (Vite code-splits each dynamic import).
  const { default: page } = await matched.page!()
  _activePage = page

  // Layout handling (Presentation switch)
  const targetPresentation = matched.presentation || 'shell'
  if (targetPresentation !== _currentPresentation) {
    if (targetPresentation === 'fullscreen') {
      mountFullscreen()
    } else {
      mountShell()
    }
    _currentPresentation = targetPresentation
  }

  // Pass route params via dataset — pages read them inside render().
  const params    = _extractParams(matched.path, path)
  const container = document.getElementById('page-content')
  if (!container) {
    console.error('[router] #page-content element not found in DOM')
    return
  }

  // Clear stale params from previous route before setting new ones
  for (const key of Object.keys(container.dataset)) {
    delete container.dataset[key]
  }
  Object.assign(container.dataset, params)

  await page.render(container)
}

/**
 * Test whether a route pattern matches a URL path.
 * Pattern segments starting with ':' are treated as named wildcards.
 *
 * Examples:
 *   /members              matches /members             → {}
 *   /members/:id          matches /members/abc-123     → { id: 'abc-123' }
 *   /members/:id/edit     matches /members/abc-123/edit → { id: 'abc-123' }
 *   /members/:id          does NOT match /members/abc/edit
 */
function _matchPath(pattern: string, path: string): boolean {
  const regex = new RegExp(
    '^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$'
  )
  return regex.test(path)
}

/**
 * Extract named params from a matched path.
 * e.g. pattern='/members/:id', path='/members/abc-123' → { id: 'abc-123' }
 */
function _extractParams(
  pattern: string,
  path:    string
): Record<string, string> {
  const keys   = [...pattern.matchAll(/:([^/]+)/g)].map(m => m[1])
  const values = path.match(
    new RegExp('^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$')
  )?.slice(1) ?? []
  return Object.fromEntries(keys.map((k, i) => [k, values[i] ?? '']))
}

/**
 * Intercept <a href> clicks and route them through the hash router
 * instead of triggering a full page reload.
 */
function _handleLinkClick(e: MouseEvent): void {
  const anchor = (e.target as Element).closest('a[href]')
  if (!anchor) return
  const href = anchor.getAttribute('href')!
  // Only intercept internal-looking paths, not external URLs
  if (href.startsWith('/') || href.startsWith('#/')) {
    e.preventDefault()
    navigate(href.startsWith('#') ? href.slice(1) : href)
  }
}

function _render404(path: string): void {
  const container = document.getElementById('page-content')
  if (!container) return
  container.innerHTML = `
    <div style="
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; min-height: 60vh; gap: 1rem;
      font-family: var(--font-sans); color: var(--text-secondary);
    ">
      <i class="bi bi-exclamation-circle" style="font-size: 3rem; color: var(--caci-n400);"></i>
      <h2 style="margin: 0; color: var(--text-primary); font-size: 1.25rem;">
        404 — Page not found
      </h2>
      <p style="margin: 0; font-size: 0.875rem;">
        No route matched <code style="
          background: var(--caci-n100); padding: 2px 6px;
          border-radius: var(--radius-xs); font-size: 0.8rem;
        ">${path}</code>
      </p>
      <a href="#/" style="
        color: var(--caci-blue); font-size: 0.875rem;
        text-decoration: none;
      ">← Go home</a>
    </div>
  `
}
