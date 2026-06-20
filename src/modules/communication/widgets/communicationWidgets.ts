// src/modules/communication/widgets/communicationWidgets.ts
// Shared widget utilities for the Communication module.
// Provides: injectWidgetCSS, showToast, openModal.

// ─── CSS ─────────────────────────────────────────────────────────────────────

const WIDGET_CSS = /* css */`
/* ── Spinner ── */
.cw-spinner {
  display: inline-block; width: 28px; height: 28px;
  border: 3px solid var(--border-default);
  border-top-color: var(--caci-blue);
  border-radius: 50%; animation: cwSpin 0.7s linear infinite;
}
@keyframes cwSpin { to { transform: rotate(360deg); } }

/* ── Empty state ── */
.cw-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 60px 20px; text-align: center;
  color: var(--text-secondary);
}
.cw-empty-icon-wrap {
  width: 56px; height: 56px; border-radius: var(--radius-lg);
  background: var(--bg-card); border: 1px solid var(--border-default);
  display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
}
.cw-empty-icon-wrap i { font-size: 24px; color: var(--text-muted); }
.cw-empty-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 0 0 6px; }
.cw-empty-desc  { font-size: 13px; color: var(--text-secondary); margin: 0; max-width: 360px; line-height: 1.6; }

/* ── Search box ── */
.cw-search {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); padding: 0 12px;
  transition: border-color 0.2s;
}
.cw-search:focus-within { border-color: var(--caci-blue); }
.cw-search i { color: var(--text-muted); font-size: 14px; flex-shrink: 0; }
.cw-search input {
  background: none; border: none; outline: none; font-size: 13px;
  color: var(--text-primary); font-family: var(--font-sans); flex: 1;
  padding: 8px 0;
}
.cw-search input::placeholder { color: var(--text-muted); }

/* ── Toolbar button ── */
.cw-tbtn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-card); color: var(--text-secondary);
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.2s; font-family: var(--font-sans);
}
.cw-tbtn:hover { border-color: var(--caci-blue); color: var(--text-primary); }
.cw-tbtn.primary {
  background: var(--caci-blue); border-color: var(--caci-blue); color: #fff;
}
.cw-tbtn.primary:hover { background: var(--caci-blue-light); border-color: var(--caci-blue-light); }

/* ── Toast ── */
#cw-toast-container {
  position: fixed; bottom: 24px; right: 24px; z-index: 9999;
  display: flex; flex-direction: column; gap: 8px; pointer-events: none;
}
.cw-toast {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); padding: 12px 16px;
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; color: var(--text-primary);
  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  animation: cwToastIn 0.3s cubic-bezier(0.16,1,0.3,1) both;
  pointer-events: auto; max-width: 340px;
}
.cw-toast.success { border-left: 3px solid #22c55e; }
.cw-toast.error   { border-left: 3px solid var(--caci-red, #ef4444); }
.cw-toast.info    { border-left: 3px solid var(--caci-blue); }
@keyframes cwToastIn {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* ── Modal ── */
#cw-shared-modal {
  position: fixed; inset: 0; z-index: 8888;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
  animation: cwFadeIn 0.2s ease both;
}
@keyframes cwFadeIn { from { opacity: 0; } to { opacity: 1; } }
.cw-modal-box {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); padding: 28px;
  width: min(540px, 94vw); max-height: 90vh;
  overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,0.4);
  animation: cwSlideUp 0.25s cubic-bezier(0.16,1,0.3,1) both;
}
@keyframes cwSlideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.cw-modal-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 20px; }
.cw-modal-icon {
  width: 40px; height: 40px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.cw-modal-title    { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0 0 3px; }
.cw-modal-subtitle { font-size: 12px; color: var(--text-muted); margin: 0; }
.cw-modal-body     { margin-bottom: 20px; }
.cw-modal-footer   { display: flex; justify-content: flex-end; gap: 8px; padding-top: 16px; border-top: 1px solid var(--border-default); }
`

let _widgetCSSInjected = false

export function injectWidgetCSS(): void {
  if (_widgetCSSInjected) return; _widgetCSSInjected = true
  const s = document.createElement('style')
  s.id = 'cw-widget-css'
  s.textContent = WIDGET_CSS
  document.head.appendChild(s)
}

// ─── Toast ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info'

export function showToast(message: string, type: ToastType = 'info', durationMs = 3500): void {
  injectWidgetCSS()
  let container = document.getElementById('cw-toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'cw-toast-container'
    document.body.appendChild(container)
  }

  const icons: Record<ToastType, string> = {
    success: 'check-circle-fill',
    error:   'exclamation-circle-fill',
    info:    'info-circle-fill',
  }

  const toast = document.createElement('div')
  toast.className = `cw-toast ${type}`
  toast.innerHTML = `
    <i class="bi bi-${icons[type]}" style="font-size:16px;flex-shrink:0;"></i>
    <span>${message}</span>
  `
  container.appendChild(toast)

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s'
    toast.style.opacity    = '0'
    toast.style.transform  = 'translateX(20px)'
    setTimeout(() => toast.remove(), 300)
  }, durationMs)
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export interface ModalOptions {
  title:      string
  subtitle?:  string
  icon?:      string     // Bootstrap Icons suffix
  iconBg?:    string
  iconColor?: string
  body:       string     // raw HTML
  footer?:    string     // raw HTML — buttons etc.
}

export function openModal(opts: ModalOptions): void {
  injectWidgetCSS()

  // Remove any existing modal first
  document.getElementById('cw-shared-modal')?.remove()

  const iconHtml = opts.icon ? `
    <div class="cw-modal-icon" style="background:${opts.iconBg ?? 'var(--bg-page)'};border:1px solid var(--border-default);">
      <i class="bi bi-${opts.icon}" style="color:${opts.iconColor ?? 'var(--text-primary)'};font-size:18px;"></i>
    </div>` : ''

  const overlay = document.createElement('div')
  overlay.id = 'cw-shared-modal'
  overlay.innerHTML = `
    <div class="cw-modal-box">
      <div class="cw-modal-header">
        ${iconHtml}
        <div>
          <p class="cw-modal-title">${opts.title}</p>
          ${opts.subtitle ? `<p class="cw-modal-subtitle">${opts.subtitle}</p>` : ''}
        </div>
      </div>
      <div class="cw-modal-body">${opts.body}</div>
      ${opts.footer ? `<div class="cw-modal-footer">${opts.footer}</div>` : ''}
    </div>
  `

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })

  document.body.appendChild(overlay)
}
