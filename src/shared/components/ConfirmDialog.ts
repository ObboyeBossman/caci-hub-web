// src/shared/components/ConfirmDialog.ts
// One-shot confirmation dialog.
// Mirrors: remove_member_dialog.dart (Flutter)
//
// Usage:
//   const confirmed = await ConfirmDialog.show({
//     title:   'Remove Member?',
//     message: 'John Asante will be removed from the directory.',
//     confirm: 'Remove',
//     type:    'danger',
//   })
//   if (confirmed) { ... }

export interface ConfirmDialogOptions {
  title:       string
  message:     string
  confirm?:    string   // default: 'Confirm'
  cancel?:     string   // default: 'Cancel'
  type?:       'danger' | 'warning' | 'info'
}

export const ConfirmDialog = {
  show(opts: ConfirmDialogOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const iconMap = {
        danger:  { icon: 'bi-trash3',              bg: 'danger' },
        warning: { icon: 'bi-exclamation-triangle', bg: 'warning' },
        info:    { icon: 'bi-info-circle',          bg: 'info' },
      }
      const type = opts.type ?? 'danger'
      const { icon, bg } = iconMap[type]
      const confirmLabel = opts.confirm ?? 'Confirm'
      const cancelLabel  = opts.cancel  ?? 'Cancel'

      const backdrop = document.createElement('div')
      backdrop.className = 'modal-backdrop'
      backdrop.style.zIndex = '1100'
      backdrop.innerHTML = `
        <div class="modal-box" style="max-width:400px">
          <div class="modal-body" style="text-align:center;padding:var(--sp-x2l) var(--sp-xl)">
            <div class="confirm-dialog-icon ${bg}" style="margin:0 auto var(--sp-md)">
              <i class="bi ${icon}"></i>
            </div>
            <div class="confirm-dialog-title">${opts.title}</div>
            <div class="confirm-dialog-message">${opts.message}</div>
          </div>
          <div class="modal-footer" style="justify-content:center;gap:var(--sp-sm)">
            <button class="btn btn-outline-secondary btn-sm" id="confirm-cancel" style="font-size:13px;min-width:80px">
              ${cancelLabel}
            </button>
            <button class="btn ${type === 'danger' ? 'btn-danger' : type === 'warning' ? 'btn-warning' : 'btn-primary'} btn-sm"
              id="confirm-ok" style="font-size:13px;min-width:80px">
              ${confirmLabel}
            </button>
          </div>
        </div>
      `

      document.body.appendChild(backdrop)
      document.body.style.overflow = 'hidden'
      requestAnimationFrame(() => backdrop.classList.add('visible'))

      const cleanup = (result: boolean) => {
        backdrop.classList.remove('visible')
        setTimeout(() => {
          backdrop.remove()
          document.body.style.overflow = ''
          resolve(result)
        }, 200)
      }

      backdrop.querySelector('#confirm-ok')?.addEventListener('click', () => cleanup(true))
      backdrop.querySelector('#confirm-cancel')?.addEventListener('click', () => cleanup(false))
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) cleanup(false) })
    })
  },
}