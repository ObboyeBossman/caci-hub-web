// src/shell/Toast.ts
// ─────────────────────────────────────────────────────────────────────────────
// Simple bottom toast + coming-soon card toast.
// ─────────────────────────────────────────────────────────────────────────────

const TOAST_CSS = /* css */`
/* ═══════════════════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════════════════ */
.shell-toast {
  position: fixed; bottom: 22px; left: 50%;
  transform: translateX(-50%) translateY(10px);
  background: var(--caci-n900, #1B1F23); color: #fff;
  padding: 9px 18px; border-radius: var(--radius-pill, 9999px);
  font-size: var(--text-sm); font-weight: 500; font-family: var(--font-sans);
  opacity: 0; pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 9999; white-space: nowrap;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
}
.shell-toast.show {
  opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMING-SOON TOAST
═══════════════════════════════════════════════════════════════════════════ */
@keyframes _csSlideUp {
  from { opacity: 0; transform: translateX(-50%) translateY(16px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.coming-soon-toast {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  z-index: 10000; display: flex; align-items: flex-start; gap: 12px;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg, 10px); padding: 13px 15px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.16);
  max-width: 340px; width: calc(100% - 32px);
  animation: _csSlideUp 0.28s cubic-bezier(0.16,1,0.3,1);
}
.coming-soon-toast-icon {
  width: 34px; height: 34px; border-radius: var(--radius-md, 8px);
  background: var(--caci-blue-bg, #EFF5FF);
  display: flex; align-items: center; justify-content: center;
  font-size: 17px; color: var(--caci-blue, #004BA0); flex-shrink: 0;
}
.coming-soon-toast-body { flex: 1; min-width: 0; }
.coming-soon-toast-title { font-size: var(--text-base); font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
.coming-soon-toast-msg  { font-size: var(--text-xs); color: var(--text-secondary); line-height: 1.5; }
.coming-soon-toast-close {
  background: none; border: none; cursor: pointer;
  padding: 2px; color: var(--text-secondary); font-size: 13px; flex-shrink: 0;
}
`

function _injectToastCSS(): void {
  if (document.getElementById('caci-toast-css')) return
  const style = document.createElement('style')
  style.id = 'caci-toast-css'
  style.textContent = TOAST_CSS
  document.head.appendChild(style)
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple toast
// ─────────────────────────────────────────────────────────────────────────────

let _toastTimer: ReturnType<typeof setTimeout> | null = null

export function showToast(msg: string, duration = 2600): void {
  _injectToastCSS()
  const t = document.getElementById('shell-toast')
  if (!t) return
  t.textContent = msg
  t.classList.add('show')
  if (_toastTimer) clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => t.classList.remove('show'), duration)
}

// ─────────────────────────────────────────────────────────────────────────────
// Coming-soon toast
// ─────────────────────────────────────────────────────────────────────────────

export function _showComingSoonToast(section: string): void {
  _injectToastCSS()
  document.getElementById('caci-cs-toast')?.remove()

  const el = document.createElement('div')
  el.id = 'caci-cs-toast'
  el.className = 'coming-soon-toast'
  el.innerHTML = /* html */`
    <div class="coming-soon-toast-icon"><i class="bi bi-hammer" aria-hidden="true"></i></div>
    <div class="coming-soon-toast-body">
      <div class="coming-soon-toast-title">Coming Soon</div>
      <div class="coming-soon-toast-msg">
        <strong>${section}</strong> is being built and will be released soon. Stay tuned!
      </div>
    </div>
    <button class="coming-soon-toast-close" aria-label="Dismiss">
      <i class="bi bi-x-lg" aria-hidden="true"></i>
    </button>
  `
  document.body.appendChild(el)
  el.querySelector('.coming-soon-toast-close')?.addEventListener('click', () => el.remove())
  setTimeout(() => el?.remove(), 5000)
}