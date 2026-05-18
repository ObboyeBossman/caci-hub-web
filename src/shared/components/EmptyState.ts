// src/shared/components/EmptyState.ts
// Standalone empty-state web component helper.
// For inline usage inside a card or section (not a full-page empty state).
// Full-page empty state → use renderEmpty() from pageHelpers.ts

export interface InlineEmptyOptions {
  icon?:    string    // Bootstrap Icons name; default 'inbox'
  title:    string
  message?: string
}

export function inlineEmptyHtml(opts: InlineEmptyOptions): string {
  const icon = opts.icon ?? 'inbox'
  return `
    <div style="display:flex;flex-direction:column;align-items:center;
      justify-content:center;padding:var(--sp-x2l) var(--sp-lg);
      text-align:center;color:var(--text-secondary)">
      <i class="bi bi-${icon}" style="font-size:2rem;color:var(--caci-n400);margin-bottom:var(--sp-md)"></i>
      <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px">${opts.title}</div>
      ${opts.message ? `<div style="font-size:13px">${opts.message}</div>` : ''}
    </div>
  `
}