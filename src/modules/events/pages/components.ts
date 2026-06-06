// src/modules/events_&_services/pages/components.ts

import type { ServiceStatus, AttendanceStatus } from '../../../types/service.types'

const COMPONENTS_CSS = /* css */`
/* ── Shared Badges ── */
.svc-status-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px; border-radius: 99px;
  font-size: 11px; font-weight: 500; white-space: nowrap;
}
.svc-status-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.svc-status-scheduled { background: rgba(0,75,160,0.1); color: var(--caci-blue-light); }
.svc-status-scheduled .svc-status-dot { background: var(--caci-blue); }
.svc-status-completed  { background: rgba(34,197,94,0.1); color: #56d364; }
.svc-status-completed .svc-status-dot  { background: #22c55e; }
.svc-status-cancelled  { background: rgba(198,0,38,0.08); color: #ff6b7a; }
.svc-status-cancelled .svc-status-dot  { background: var(--caci-red); }

.svc-att-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px; border-radius: 99px; font-size: 11px; font-weight: 500;
}
.svc-att-badge-present  { background: rgba(34,197,94,0.1);   color: #56d364; }
.svc-att-badge-absent   { background: rgba(198,0,38,0.08);   color: #ff6b7a; }
.svc-att-badge-excused  { background: rgba(210,153,34,0.12); color: #d29922; }

/* ── Context menu ── */
.svc-ctx-menu {
  position: fixed; background: var(--bg-card);
  border: 1px solid var(--border-default); border-radius: var(--radius-md);
  padding: 4px; min-width: 170px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  z-index: 500; animation: svcScaleIn 0.18s cubic-bezier(0.16,1,0.3,1) both;
  transform-origin: top right;
}
@keyframes svcScaleIn {
  from { opacity: 0; transform: scale(0.93); }
  to   { opacity: 1; transform: scale(1); }
}
.svc-ctx-item {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 10px; border-radius: var(--radius-xs);
  font-size: 13px; color: var(--text-secondary); cursor: pointer;
  transition: background 0.12s;
}
.svc-ctx-item i { font-size: 15px; color: var(--text-muted); }
.svc-ctx-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.svc-ctx-item.danger { color: var(--caci-red); }
.svc-ctx-item.danger i { color: var(--caci-red); }
.svc-ctx-item.danger:hover { background: rgba(198,0,38,0.08); }

/* ── Drawer ── */
.svc-drawer-backdrop {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(3px);
  animation: svcFadeIn 0.2s ease both;
}
.svc-drawer {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: min(460px, 100vw); background: var(--bg-card);
  border-left: 1px solid var(--border-default);
  box-shadow: -12px 0 40px rgba(0,0,0,0.3);
  display: flex; flex-direction: column; z-index: 301;
  animation: svcDrawerIn 0.32s cubic-bezier(0.16,1,0.3,1) both;
}
@keyframes svcDrawerIn {
  from { transform: translateX(100%); opacity: 0.6; }
  to   { transform: translateX(0); opacity: 1; }
}
.svc-drawer-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px; border-bottom: 1px solid var(--border-default); flex-shrink: 0;
}
.svc-drawer-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 0; }
.svc-drawer-close {
  width: 30px; height: 30px; border-radius: var(--radius-sm);
  border: none; background: transparent; color: var(--text-muted);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 17px; transition: background 0.12s, color 0.12s;
}
.svc-drawer-close:hover { background: var(--bg-hover); color: var(--text-primary); }
.svc-drawer-body { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 18px; }
.svc-drawer-footer {
  padding: 14px 18px; border-top: 1px solid var(--border-default);
  display: flex; gap: var(--space-sm); flex-shrink: 0;
}

/* ── Modal ── */
.svc-modal-backdrop {
  position: fixed; inset: 0; z-index: 400;
  background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: var(--space-lg);
  animation: svcFadeIn 0.2s ease both;
}
.svc-modal {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 64px rgba(0,0,0,0.35);
  width: 100%; max-width: 520px; max-height: 90vh;
  display: flex; flex-direction: column;
  animation: svcSlideUp 0.3s cubic-bezier(0.16,1,0.3,1) both;
}
.svc-modal-lg { max-width: 660px; }
@keyframes svcSlideUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.svc-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-lg); border-bottom: 1px solid var(--border-default); flex-shrink: 0;
}
.svc-modal-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 0; }
.svc-modal-close {
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  border: none; background: transparent; color: var(--text-muted);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 16px; transition: background 0.12s, color 0.12s;
}
.svc-modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }
.svc-modal-body { padding: var(--space-lg); overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: var(--space-md); }
.svc-modal-footer {
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid var(--border-default);
  display: flex; justify-content: flex-end; gap: var(--space-sm); flex-shrink: 0;
}

/* ── Confirm dialog ── */
.svc-confirm-box {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-xl); box-shadow: 0 24px 64px rgba(0,0,0,0.4);
  padding: var(--space-2xl); width: 100%; max-width: 360px; text-align: center;
  animation: svcSlideUp 0.28s cubic-bezier(0.16,1,0.3,1) both;
}
.svc-confirm-icon {
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(198,0,38,0.08); border: 1px solid rgba(198,0,38,0.2);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto var(--space-md); font-size: 20px; color: var(--caci-red);
}
.svc-confirm-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
.svc-confirm-msg   { font-size: 13px; color: var(--text-secondary); line-height: 1.55; margin-bottom: var(--space-xl); }
.svc-confirm-btns  { display: flex; gap: var(--space-sm); }
.svc-confirm-btns button { flex: 1; }

/* ── Empty state ── */
.svc-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 64px var(--space-lg); text-align: center;
  color: var(--text-secondary);
}
.svc-empty i { font-size: 3rem; color: var(--border-strong); margin-bottom: var(--space-lg); }
.svc-empty-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
.svc-empty-sub   { font-size: 13px; color: var(--text-secondary); max-width: 300px; }

/* ── Toast notification ── */
.svc-toast {
  position: fixed; bottom: 24px; left: 50%;
  transform: translateX(-50%) translateY(80px);
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); padding: 10px 18px;
  font-size: 13px; color: var(--text-primary);
  display: flex; align-items: center; gap: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.35s;
  opacity: 0; z-index: 600; white-space: nowrap; pointer-events: none;
}
.svc-toast.show {
  transform: translateX(-50%) translateY(0); opacity: 1;
}

/* ── Animations ── */
@keyframes svcFadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes svcFadeIn { from { opacity: 0; } to { opacity: 1; } }

/* ── Spinner ── */
.svc-spinner {
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.25);
  border-top-color: #fff;
  animation: svcSpin 0.7s linear infinite;
  display: inline-block;
}
@keyframes svcSpin { to { transform: rotate(360deg); } }

/* ── Detail section in drawer ── */
.svc-detail-section {
  background: var(--bg-page); border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md); padding: 14px;
}
.svc-detail-section-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 10px;
}
.svc-detail-row {
  display: flex; align-items: flex-start; gap: 10px; padding: 6px 0;
  border-bottom: 1px solid var(--border-subtle);
}
.svc-detail-row:last-child { border-bottom: none; }
.svc-detail-key {
  font-size: 11px; color: var(--text-muted); width: 90px; flex-shrink: 0; padding-top: 1px;
}
.svc-detail-val {
  font-size: 12px; color: var(--text-primary); font-weight: 500; flex: 1; word-break: break-word;
}
`

export function injectComponentsCSS(): void {
  if (document.getElementById('svc-components-css')) return
  const s = document.createElement('style')
  s.id = 'svc-components-css'
  s.textContent = COMPONENTS_CSS
  document.head.appendChild(s)
}

// ── Avatar & Visual helpers ───────────────────────────────────────────────────

const AVATAR_COLORS = ['#004BA0','#C60026','#1a5fb4','#7c3aed','#1a7f37','#9a6700','#0969da']

export function avatarColor(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export function initials(name: string): string {
  const parts = name.trim().split(' ')
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

export function statusBadge(status: ServiceStatus): string {
  return `<span class="svc-status-badge svc-status-${status}">
    <span class="svc-status-dot"></span>${status}
  </span>`
}

export function attBadge(status: AttendanceStatus): string {
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return `<span class="svc-att-badge svc-att-badge-${status}">${label}</span>`
}

export function serviceTypeColor(type: string): { bg: string; color: string } {
  const map: Record<string, { bg: string; color: string }> = {
    'Sunday Service':    { bg: 'rgba(0,75,160,0.1)',  color: 'var(--caci-blue-light)' },
    'Midweek Service':   { bg: 'rgba(34,197,94,0.1)', color: '#56d364' },
    'Prayer Meeting':    { bg: 'rgba(88,166,255,0.1)',color: '#58a6ff' },
    'Cell Meeting':      { bg: 'rgba(210,153,34,0.1)',color: '#d29922' },
    'Youth Service':     { bg: 'rgba(124,58,237,0.1)',color: '#a78bfa' },
    'Bible Study':       { bg: 'rgba(20,184,166,0.1)',color: '#2dd4bf' },
  }
  return map[type] ?? { bg: 'rgba(139,148,158,0.1)', color: 'var(--text-secondary)' }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

export function toast(msg: string, icon = 'bi-check-circle-fill', color = '#56d364'): void {
  const id = 'svc-toast-el'
  let el = document.getElementById(id) as HTMLElement
  if (!el) {
    el = document.createElement('div')
    el.id = id
    el.className = 'svc-toast'
    document.body.appendChild(el)
  }
  el.innerHTML = `<i class="bi ${icon}" style="font-size:15px;color:${color};"></i><span>${msg}</span>`
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 3000)
}

// ── Context menu ──────────────────────────────────────────────────────────────

export function closeCtx(): void {
  document.getElementById('svc-ctx')?.remove()
}

export function openCtx(
  x: number, y: number,
  items: Array<{ label: string; icon: string; danger?: boolean; action: () => void }>
): void {
  closeCtx()
  const menu = document.createElement('div')
  menu.id = 'svc-ctx'
  menu.className = 'svc-ctx-menu'
  menu.style.cssText = `left:${x}px;top:${y}px;`
  menu.innerHTML = items.map((item, i) =>
    `<div class="svc-ctx-item${item.danger ? ' danger' : ''}" data-idx="${i}">
      <i class="bi ${item.icon}"></i>${item.label}
    </div>`
  ).join('')
  document.body.appendChild(menu)

  // Flip if off-screen
  requestAnimationFrame(() => {
    const r = menu.getBoundingClientRect()
    if (r.right > window.innerWidth)  menu.style.left = `${x - r.width}px`
    if (r.bottom > window.innerHeight) menu.style.top = `${y - r.height}px`
  })

  menu.querySelectorAll<HTMLElement>('.svc-ctx-item').forEach((el, i) => {
    el.addEventListener('click', () => { closeCtx(); items[i].action() })
  })
  setTimeout(() => {
    document.addEventListener('click', closeCtx, { once: true })
  }, 0)
}

// ── Drawer ────────────────────────────────────────────────────────────────────

export function openDrawer(
  title: string,
  bodyHtml: string,
  footerHtml: string,
  onClose?: () => void
): { update: (body: string, footer: string) => void; close: () => void } {
  document.getElementById('svc-drawer-wrap')?.remove()

  const wrap = document.createElement('div')
  wrap.id = 'svc-drawer-wrap'
  wrap.innerHTML = `
    <div class="svc-drawer-backdrop" id="svc-drawer-bd"></div>
    <div class="svc-drawer" id="svc-drawer" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="svc-drawer-header">
        <h2 class="svc-drawer-title" id="svc-drawer-title">${title}</h2>
        <button class="svc-drawer-close" id="svc-drawer-close" aria-label="Close">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="svc-drawer-body" id="svc-drawer-body">${bodyHtml}</div>
      <div class="svc-drawer-footer" id="svc-drawer-footer">${footerHtml}</div>
    </div>`
  document.body.appendChild(wrap)

  const closeDrawerFunc = () => {
    wrap.remove()
    onClose?.()
  }

  wrap.querySelector('#svc-drawer-bd')?.addEventListener('click', closeDrawerFunc)
  wrap.querySelector('#svc-drawer-close')?.addEventListener('click', closeDrawerFunc)

  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { closeDrawerFunc(); document.removeEventListener('keydown', esc) }
  })

  return {
    close: closeDrawerFunc,
    update(body: string, footer: string) {
      const b = document.getElementById('svc-drawer-body')
      const f = document.getElementById('svc-drawer-footer')
      if (b) b.innerHTML = body
      if (f) f.innerHTML = footer
    }
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function openModal(
  title: string,
  bodyHtml: string,
  footerHtml: string,
  opts: { large?: boolean } = {}
): { el: HTMLElement; close: () => void } {
  document.getElementById('svc-modal-wrap')?.remove()

  const wrap = document.createElement('div')
  wrap.id = 'svc-modal-wrap'
  wrap.className = 'svc-modal-backdrop'
  wrap.innerHTML = `
    <div class="svc-modal${opts.large ? ' svc-modal-lg' : ''}" role="dialog" aria-modal="true">
      <div class="svc-modal-header">
        <h2 class="svc-modal-title">${title}</h2>
        <button class="svc-modal-close" id="svc-modal-close" aria-label="Close">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="svc-modal-body" id="svc-modal-body">${bodyHtml}</div>
      <div class="svc-modal-footer" id="svc-modal-footer">${footerHtml}</div>
    </div>`
  document.body.appendChild(wrap)

  const closeModalFunc = () => wrap.remove()
  wrap.querySelector('#svc-modal-close')?.addEventListener('click', closeModalFunc)
  wrap.addEventListener('click', e => { if (e.target === wrap) closeModalFunc() })
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { closeModalFunc(); document.removeEventListener('keydown', esc) }
  })

  return { el: wrap, close: closeModalFunc }
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

export function confirm(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => Promise<void>
): void {
  const { el, close } = openModal('', `
    <div class="svc-confirm-box" style="margin:auto;">
      <div class="svc-confirm-icon"><i class="bi bi-exclamation-triangle-fill"></i></div>
      <div class="svc-confirm-title">${title}</div>
      <div class="svc-confirm-msg">${message}</div>
      <div class="svc-confirm-btns">
        <button class="btn btn-outline" id="svc-conf-cancel">Cancel</button>
        <button class="btn btn-danger" id="svc-conf-ok">
          <i class="bi bi-trash3"></i> ${confirmLabel}
        </button>
      </div>
    </div>`, '', { large: false })

  el.querySelector<HTMLElement>('#svc-conf-cancel')?.addEventListener('click', close)
  el.querySelector<HTMLElement>('#svc-conf-ok')?.addEventListener('click', async () => {
    const btn = el.querySelector<HTMLButtonElement>('#svc-conf-ok')!
    btn.disabled = true
    btn.innerHTML = `<span class="svc-spinner"></span>`
    try {
      await onConfirm()
      close()
    } catch (err: any) {
      btn.disabled = false
      btn.innerHTML = `<i class="bi bi-trash3"></i> ${confirmLabel}`
      toast(err?.message ?? 'Operation failed.', 'bi-exclamation-circle', 'var(--caci-red)')
    }
  })
}
