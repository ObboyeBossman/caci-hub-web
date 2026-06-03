// src/shell/Breadcrumbs.ts
// ─────────────────────────────────────────────────────────────────────────────
// Breadcrumb nav — injected by pages into their own containers.
// ─────────────────────────────────────────────────────────────────────────────

const BREADCRUMBS_CSS = /* css */`
/* ═══════════════════════════════════════════════════════════════════════════
   BREADCRUMBS
═══════════════════════════════════════════════════════════════════════════ */
.breadcrumbs {
  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
  padding: 0 0 14px; font-size: 0.857rem; color: var(--text-secondary);
}
.breadcrumbs a { color: var(--text-secondary); text-decoration: none; transition: color 0.15s; }
.breadcrumbs a:hover { color: var(--text-primary); }
.breadcrumb-sep { display: flex; align-items: center; color: var(--text-placeholder); font-size: 0.785rem; }
.breadcrumb-current { color: var(--text-primary); font-weight: 500; }
`

function _injectBreadcrumbsCSS(): void {
  if (document.getElementById('caci-breadcrumbs-css')) return
  const style = document.createElement('style')
  style.id = 'caci-breadcrumbs-css'
  style.textContent = BREADCRUMBS_CSS
  document.head.appendChild(style)
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string
  path?: string    // omit for the last (current) item
}

/**
 * Inject breadcrumb nav into a container element.
 * Pages call this at the top of their render() to add navigation context.
 *
 * @example
 *   const header = document.createElement('div')
 *   renderBreadcrumbs(header, [
 *     { label: 'Members', path: '/members' },
 *     { label: 'John Asante' },
 *   ])
 *   container.prepend(header)
 */
export function renderBreadcrumbs(container: HTMLElement, items: BreadcrumbItem[]): void {
  _injectBreadcrumbsCSS()

  const html = items
    .map((item, i) => {
      const isLast = i === items.length - 1
      if (isLast || !item.path) {
        return `<span class="breadcrumb-current">${item.label}</span>`
      }
      return `
        <a href="#${item.path}">${item.label}</a>
        <span class="breadcrumb-sep"><i class="bi bi-chevron-right" aria-hidden="true"></i></span>
      `
    })
    .join('')

  const nav = document.createElement('nav')
  nav.className = 'breadcrumbs'
  nav.setAttribute('aria-label', 'Breadcrumb')
  nav.innerHTML = html
  container.prepend(nav)
}