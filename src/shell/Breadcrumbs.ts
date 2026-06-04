// src/shell/Breadcrumbs.ts
// ─────────────────────────────────────────────────────────────────────────────
// Breadcrumb toolbar — renders a constrained row with:
//   leading  (optional) — icon button, back arrow, etc. on the left
//   nav                 — the actual breadcrumb links/separators
//   trailing (optional) — action buttons, pills, etc. on the right
//
// Usage:
//   renderBreadcrumbs(container, items)
//   renderBreadcrumbs(container, items, { trailing: queueBtn })
//   renderBreadcrumbs(container, items, { leading: backBtn, trailing: actionsGroup })
// ─────────────────────────────────────────────────────────────────────────────

const BREADCRUMBS_CSS = /* css */`
/* ═══════════════════════════════════════════════════════════════════════════
   BREADCRUMB TOOLBAR
═══════════════════════════════════════════════════════════════════════════ */

/* ── Outer toolbar row ─────────────────────────────────────────────────── */
.bc-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  min-width: 0;
}

/* ── Leading slot ──────────────────────────────────────────────────────── */
.bc-leading {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* ── Nav (grows to fill) ───────────────────────────────────────────────── */
.bc-nav {
  display: flex;
  align-items: center;
  gap: 0;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

/* ── Individual crumb ──────────────────────────────────────────────────── */
.bc-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 450;
  color: var(--text-muted);
  text-decoration: none;
  padding: 2px 0;
  white-space: nowrap;
  transition: color 0.15s;
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-sans, inherit);
}
.bc-link:hover { color: var(--text-primary); }
.bc-link i { font-size: 13px; flex-shrink: 0; }

/* ── Separator ─────────────────────────────────────────────────────────── */
.bc-sep {
  font-size: 13px;
  color: var(--text-muted);
  opacity: 0.4;
  margin: 0 5px;
  line-height: 1;
  user-select: none;
  flex-shrink: 0;
}

/* ── Current (last) crumb ──────────────────────────────────────────────── */
.bc-current {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

/* ── Trailing slot ─────────────────────────────────────────────────────── */
.bc-trailing {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}
`

function _injectCSS(): void {
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
  path?: string       // omit for the last (current) item
  icon?: string       // optional Bootstrap icon class, e.g. 'bi-house-fill'
}

export interface BreadcrumbOptions {
  /** Element placed before the nav — e.g. a back-button icon */
  leading?: HTMLElement
  /** Element(s) placed after the nav — e.g. action buttons, a queue pill */
  trailing?: HTMLElement
}

/**
 * Render a breadcrumb toolbar into a container.
 *
 * @example — minimal
 *   renderBreadcrumbs(container, [
 *     { label: 'Members', path: '/members' },
 *     { label: 'Add Member' },
 *   ])
 *
 * @example — with trailing action buttons
 *   const actions = document.createElement('div')
 *   actions.innerHTML = `<button class="…">Edit</button>`
 *   renderBreadcrumbs(container, [
 *     { label: 'Members', path: '/members' },
 *     { label: fullName },
 *   ], { trailing: actions })
 *
 * @example — with leading back-button
 *   const back = document.createElement('button')
 *   back.innerHTML = '<i class="bi bi-arrow-left"></i>'
 *   back.onclick = () => history.back()
 *   renderBreadcrumbs(container, […], { leading: back })
 */
export function renderBreadcrumbs(
  container: HTMLElement,
  items: BreadcrumbItem[],
  options: BreadcrumbOptions = {},
): void {
  _injectCSS()

  const toolbar = document.createElement('div')
  toolbar.className = 'bc-toolbar'
  toolbar.setAttribute('aria-label', 'Breadcrumb')

  // ── Leading slot ──────────────────────────────────────────────────────
  if (options.leading) {
    const leading = document.createElement('div')
    leading.className = 'bc-leading'
    leading.appendChild(options.leading)
    toolbar.appendChild(leading)
  }

  // ── Nav ───────────────────────────────────────────────────────────────
  const nav = document.createElement('nav')
  nav.className = 'bc-nav'

  items.forEach((item, i) => {
    const isLast = i === items.length - 1

    if (isLast || !item.path) {
      // Current page — non-interactive
      const span = document.createElement('span')
      span.className = 'bc-current'
      span.textContent = item.label
      nav.appendChild(span)
    } else {
      // Ancestor — clickable link
      const a = document.createElement('a')
      a.className = 'bc-link'
      a.href = `#${item.path}`
      if (item.icon) {
        const ico = document.createElement('i')
        ico.className = `bi ${item.icon}`
        a.appendChild(ico)
      }
      a.appendChild(document.createTextNode(item.label))
      nav.appendChild(a)

      // Separator
      const sep = document.createElement('span')
      sep.className = 'bc-sep'
      sep.setAttribute('aria-hidden', 'true')
      sep.textContent = '›'
      nav.appendChild(sep)
    }
  })

  toolbar.appendChild(nav)

  // ── Trailing slot ─────────────────────────────────────────────────────
  if (options.trailing) {
    const trailing = document.createElement('div')
    trailing.className = 'bc-trailing'
    trailing.appendChild(options.trailing)
    toolbar.appendChild(trailing)
  }

  // Replace any previous toolbar (idempotent)
  const existing = container.querySelector('.bc-toolbar')
  if (existing) existing.remove()

  container.appendChild(toolbar)
}