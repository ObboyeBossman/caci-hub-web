// src/shared/utils/pageHelpers.ts
// The three required helpers every data page uses.
// No page may inline its own skeleton, empty state, or error HTML.
// Mirrors: member_list_shimmer.dart, renderSkeleton/renderEmpty/renderError patterns.

import type { RepositoryError } from '../../types/common.types'

export type SkeletonVariant = 'table' | 'card' | 'form' | 'profile'

export interface EmptyStateOptions {
  icon:    string           // Bootstrap Icons name e.g. 'people', 'calendar'
  title:   string
  message: string
  action?: { label: string; onClick: () => void }
}

export interface ErrorStateOptions {
  retry?: () => void
}

// ── renderSkeleton ────────────────────────────────────────────────────────────
// Call as the FIRST line of every data-page render(), before any await.
// variant 'table'   → 5 shimmer rows (mirrors member_list_shimmer.dart)
//         'card'    → 3 shimmer cards in a grid
//         'form'    → label + input pairs
//         'profile' → avatar circle + detail rows

export function renderSkeleton(
  container: HTMLElement,
  variant: SkeletonVariant = 'table'
): void {
  container.innerHTML = _skeletonHtml(variant)
}

function _skeletonHtml(variant: SkeletonVariant): string {
  switch (variant) {
    case 'table':
      return `
        <div style="padding:var(--sp-xl) var(--sp-x2l)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-xl)">
            <div class="skeleton" style="width:160px;height:24px"></div>
            <div class="skeleton" style="width:100px;height:32px;border-radius:var(--radius-sm)"></div>
          </div>
          <div class="caci-card" style="padding:0;overflow:hidden">
            <div style="padding:12px 16px;border-bottom:1px solid var(--border-default);
              display:flex;gap:12px;align-items:center">
              <div class="skeleton" style="width:220px;height:32px;border-radius:var(--radius-sm)"></div>
              <div class="skeleton" style="width:100px;height:32px;border-radius:var(--radius-sm)"></div>
            </div>
            ${Array.from({ length: 7 }).map(() => `
              <div style="display:flex;align-items:center;gap:16px;padding:12px 16px;
                border-bottom:1px solid var(--border-default)">
                <div class="skeleton skel-avatar" style="width:36px;height:36px"></div>
                <div style="flex:1">
                  <div class="skeleton skel-text" style="width:140px;margin-bottom:6px"></div>
                  <div class="skeleton skel-text-sm" style="width:100px"></div>
                </div>
                <div class="skeleton skel-pill" style="width:60px;height:20px"></div>
                <div class="skeleton" style="width:80px;height:14px"></div>
              </div>
            `).join('')}
          </div>
        </div>
      `

    case 'card':
      return `
        <div style="padding:var(--sp-xl) var(--sp-x2l)">
          <div class="skeleton" style="width:180px;height:24px;margin-bottom:var(--sp-xl)"></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--sp-lg)">
            ${Array.from({ length: 6 }).map(() => `
              <div class="caci-card">
                <div class="skeleton" style="width:40px;height:40px;border-radius:var(--radius-sm);margin-bottom:12px"></div>
                <div class="skeleton skel-text" style="width:120px;margin-bottom:8px"></div>
                <div class="skeleton skel-text-sm" style="width:80px"></div>
              </div>
            `).join('')}
          </div>
        </div>
      `

    case 'form':
      return `
        <div style="padding:var(--sp-xl) var(--sp-x2l);max-width:680px">
          <div class="skeleton" style="width:160px;height:24px;margin-bottom:var(--sp-x2l)"></div>
          ${Array.from({ length: 6 }).map(() => `
            <div style="margin-bottom:var(--sp-lg)">
              <div class="skeleton skel-text-sm" style="width:100px;margin-bottom:6px"></div>
              <div class="skeleton" style="width:100%;height:38px;border-radius:var(--radius-sm)"></div>
            </div>
          `).join('')}
          <div style="display:flex;gap:var(--sp-sm);margin-top:var(--sp-xl)">
            <div class="skeleton" style="width:90px;height:36px;border-radius:var(--radius-sm)"></div>
            <div class="skeleton" style="width:70px;height:36px;border-radius:var(--radius-sm)"></div>
          </div>
        </div>
      `

    case 'profile':
      return `
        <div style="padding:var(--sp-xl) var(--sp-x2l)">
          <div style="display:flex;align-items:flex-start;gap:var(--sp-lg);margin-bottom:var(--sp-x2l)">
            <div class="skeleton skel-avatar" style="width:72px;height:72px;flex-shrink:0"></div>
            <div style="flex:1">
              <div class="skeleton skel-text" style="width:180px;margin-bottom:8px"></div>
              <div class="skeleton skel-text-sm" style="width:120px;margin-bottom:8px"></div>
              <div class="skeleton skel-pill" style="width:70px;height:22px"></div>
            </div>
          </div>
          <div class="caci-card">
            ${Array.from({ length: 6 }).map(() => `
              <div style="display:flex;gap:var(--sp-lg);margin-bottom:var(--sp-lg)">
                <div class="skeleton skel-text-sm" style="width:120px"></div>
                <div class="skeleton skel-text-sm" style="width:200px"></div>
              </div>
            `).join('')}
          </div>
        </div>
      `
  }
}

// ── renderEmpty ───────────────────────────────────────────────────────────────
// Call when a successful fetch returns zero results.

export function renderEmpty(
  container: HTMLElement,
  options: EmptyStateOptions
): void {
  const actionHtml = options.action
    ? `<button class="btn btn-primary" id="empty-action-btn" style="font-size: var(--text-base)">
         ${options.action.label}
       </button>`
    : ''

  container.innerHTML = `
    <div class="empty-state">
      <i class="bi bi-${options.icon} empty-state-icon"></i>
      <div class="empty-state-title">${options.title}</div>
      <div class="empty-state-message">${options.message}</div>
      ${actionHtml}
    </div>
  `

  if (options.action) {
    container.querySelector('#empty-action-btn')
      ?.addEventListener('click', options.action.onClick)
  }
}

// ── renderError ───────────────────────────────────────────────────────────────
// Call in the catch block of every render().
//
// Error code mapping (mirrors RepositoryError codes in common.types.ts):
//   42501    → 'You don't have permission to view this'
//   PGRST116 → 'The record was not found'
//   PGRST301 → 'Session expired — please log in again'
//   23505    → 'A record with these details already exists'
//   default  → 'Something went wrong. Please try again.'

export function renderError(
  container: HTMLElement,
  error: unknown,
  options?: ErrorStateOptions
): void {
  const message = _errorMessage(error)
  const retryHtml = options?.retry
    ? `<button class="btn btn-outline-secondary btn-sm" id="error-retry-btn" style="font-size: var(--text-base)">
         <i class="bi bi-arrow-clockwise me-1"></i> Try again
       </button>`
    : ''

  container.innerHTML = `
    <div class="empty-state">
      <i class="bi bi-exclamation-circle empty-state-icon" style="color:var(--caci-red)"></i>
      <div class="empty-state-title">Something went wrong</div>
      <div class="empty-state-message">${message}</div>
      ${retryHtml}
    </div>
  `

  if (options?.retry) {
    container.querySelector('#error-retry-btn')
      ?.addEventListener('click', options.retry)
  }
}

function _errorMessage(error: unknown): string {
  if (!error) return 'Something went wrong. Please try again.'

  // RepositoryError with a code
  const err = error as { code?: string; message?: string }
  switch (err.code) {
    case '42501':    return "You don't have permission to view this."
    case 'PGRST116': return 'The record was not found.'
    case 'PGRST301': return 'Your session has expired. Please log in again.'
    case '23505':    return 'A record with these details already exists.'
  }

  // Fallback to the error message if it's a string
  if (typeof err.message === 'string' && err.message.length < 200) {
    return err.message
  }

  return 'Something went wrong. Please try again.'
}