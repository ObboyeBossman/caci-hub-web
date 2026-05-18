// src/shell/Breadcrumbs.ts
// Renders breadcrumb navigation above the page content area.
// Called by pages that want breadcrumb context.

export interface BreadcrumbItem {
  label: string
  path?: string  // omit for the current (last) item
}

/**
 * Render breadcrumbs into a container element.
 * Pages call this at the top of their render() to inject nav context.
 *
 * Usage:
 *   const header = document.createElement('div')
 *   renderBreadcrumbs(header, [
 *     { label: 'Members', path: '/members' },
 *     { label: 'John Asante' },
 *   ])
 *   container.prepend(header)
 */
export function renderBreadcrumbs(
  container: HTMLElement,
  items: BreadcrumbItem[]
): void {
  const html = items
    .map((item, i) => {
      const isLast = i === items.length - 1
      if (isLast || !item.path) {
        return `<span class="breadcrumb-current">${item.label}</span>`
      }
      return `
        <a href="#${item.path}">${item.label}</a>
        <span class="breadcrumb-sep"><i class="bi bi-chevron-right"></i></span>
      `
    })
    .join('')

  const nav = document.createElement('nav')
  nav.className = 'breadcrumbs'
  nav.setAttribute('aria-label', 'Breadcrumb')
  nav.innerHTML = html
  container.prepend(nav)
}