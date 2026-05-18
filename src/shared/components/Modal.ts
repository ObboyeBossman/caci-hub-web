// src/shared/components/Modal.ts
// Generic modal container — renders content inside a centred overlay.
// Usage:
//   const modal = new Modal({ title: 'Add Member' })
//   modal.setContent('<form>...</form>')
//   modal.open()
//   modal.close()

export interface ModalOptions {
  title:       string
  size?:       'sm' | 'md' | 'lg'   // default: 'md'
  onClose?:    () => void
}

export class Modal {
  private _opts:     ModalOptions
  private _backdrop: HTMLElement | null = null

  constructor(opts: ModalOptions) {
    this._opts = opts
  }

  open(): void {
    if (this._backdrop) return

    const maxWidth: Record<string, string> = { sm: '400px', md: '520px', lg: '720px' }
    const size = this._opts.size ?? 'md'

    const backdrop = document.createElement('div')
    backdrop.className = 'modal-backdrop'
    backdrop.setAttribute('role', 'dialog')
    backdrop.setAttribute('aria-modal', 'true')
    backdrop.setAttribute('aria-label', this._opts.title)
    backdrop.innerHTML = `
      <div class="modal-box" style="max-width:${maxWidth[size]}">
        <div class="modal-header">
          <h2 class="modal-title">${this._opts.title}</h2>
          <button class="modal-close-btn" id="modal-close" aria-label="Close">
            <i class="bi bi-x"></i>
          </button>
        </div>
        <div class="modal-body" id="modal-body"></div>
        <div class="modal-footer" id="modal-footer" style="display:none"></div>
      </div>
    `

    document.body.appendChild(backdrop)
    document.body.style.overflow = 'hidden'
    this._backdrop = backdrop

    // Animate in
    requestAnimationFrame(() => backdrop.classList.add('visible'))

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.close()
    })

    // Close button
    backdrop.querySelector('#modal-close')?.addEventListener('click', () => this.close())

    // ESC key
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { this.close(); document.removeEventListener('keydown', onKeyDown) }
    }
    document.addEventListener('keydown', onKeyDown)
  }

  setContent(html: string): void {
    const body = this._backdrop?.querySelector<HTMLElement>('#modal-body')
    if (body) body.innerHTML = html
  }

  setFooter(html: string): void {
    const footer = this._backdrop?.querySelector<HTMLElement>('#modal-footer')
    if (!footer) return
    footer.innerHTML = html
    footer.style.display = 'flex'
  }

  getBodyEl(): HTMLElement | null {
    return this._backdrop?.querySelector<HTMLElement>('#modal-body') ?? null
  }

  close(): void {
    if (!this._backdrop) return
    this._backdrop.classList.remove('visible')
    setTimeout(() => {
      this._backdrop?.remove()
      this._backdrop = null
      document.body.style.overflow = ''
      this._opts.onClose?.()
    }, 200)
  }

  isOpen(): boolean {
    return this._backdrop !== null
  }
}