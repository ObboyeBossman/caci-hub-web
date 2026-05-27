// src/shared/components/PhoneInput.ts
// Reusable phone number input with country code selector.
// Extracted from Login.ts (panel-signin phone field).
//
// Usage:
//   const phone = new PhoneInput({ containerId: 'my-container', inputId: 'my-phone' })
//   phone.mount(parentElement)
//   const fullNumber = phone.getValue()   // e.g. "+233241234567"
//   phone.getValue(true)                   // raw local number without country code
//   phone.reset()

export interface PhoneInputOptions {
  /** Unique id prefix used for the generated DOM elements (avoids collisions). */
  id?: string
  /** Placeholder text for the number field. Default: "24 123 4567" */
  placeholder?: string
  /** Label shown above the control. If omitted no label is rendered. */
  label?: string
  /** CSS classes appended to the outer wrapper div. */
  wrapperClass?: string
  /** CSS classes applied to the select element. */
  selectClass?: string
  /** CSS classes applied to the text input element. */
  inputClass?: string
  /** Called whenever the value changes. Receives the full E.164 number. */
  onChange?: (value: string) => void
}

export interface CountryOption {
  flag:   string
  code:   string
  label:  string
}

const DEFAULT_COUNTRIES: CountryOption[] = [
  { flag: '🇬🇭', code: '+233', label: '🇬🇭 +233' },
  { flag: '🇳🇬', code: '+234', label: '🇳🇬 +234' },
  { flag: '🇺🇸', code: '+1',   label: '🇺🇸 +1'   },
  { flag: '🇬🇧', code: '+44',  label: '🇬🇧 +44'  },
  { flag: '🇨🇮', code: '+225', label: '🇨🇮 +225' },
  { flag: '🇸🇱', code: '+232', label: '🇸🇱 +232' },
  { flag: '🇱🇷', code: '+231', label: '🇱🇷 +231' },
  { flag: '🇿🇦', code: '+27',  label: '🇿🇦 +27'  },
  { flag: '🇰🇪', code: '+254', label: '🇰🇪 +254' },
  { flag: '🇹🇿', code: '+255', label: '🇹🇿 +255' },
  { flag: '🇺🇬', code: '+256', label: '🇺🇬 +256' },
]

let _idCounter = 0

export class PhoneInput {
  private _opts: Required<Omit<PhoneInputOptions, 'label' | 'onChange'>> &
    Pick<PhoneInputOptions, 'label' | 'onChange'>

  private _root: HTMLElement | null = null
  private _select: HTMLSelectElement | null = null
  private _input:  HTMLInputElement  | null = null

  constructor(opts: PhoneInputOptions = {}) {
    const uid = `pi-${++_idCounter}`
    this._opts = {
      id:            opts.id           ?? uid,
      placeholder:   opts.placeholder  ?? '24 123 4567',
      wrapperClass:  opts.wrapperClass ?? '',
      selectClass:   opts.selectClass  ?? '',
      inputClass:    opts.inputClass   ?? '',
      label:         opts.label,
      onChange:      opts.onChange,
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Render the component into `parent`.
   * Returns the root wrapper element.
   */
  mount(parent: HTMLElement): HTMLElement {
    const id    = this._opts.id
    const label = this._opts.label

    const wrapper = document.createElement('div')
    wrapper.className   = `phone-input-wrapper ${this._opts.wrapperClass}`.trim()
    wrapper.style.cssText = 'display:flex; flex-direction:column; gap:6px;'

    if (label) {
      const lbl = document.createElement('label')
      lbl.htmlFor   = `${id}-number`
      lbl.textContent = label
      lbl.style.cssText = 'font-size:13px; font-weight:500;'
      wrapper.appendChild(lbl)
    }

    const row = document.createElement('div')
    row.style.cssText = 'display:flex; gap:8px; align-items:center;'

    // Country-code dropdown
    const sel = document.createElement('select')
    sel.id        = `${id}-code`
    sel.className = this._opts.selectClass
    sel.style.cssText = 'width:120px; cursor:pointer; flex-shrink:0;'
    DEFAULT_COUNTRIES.forEach(c => {
      const opt = document.createElement('option')
      opt.value       = c.code
      opt.textContent = c.label
      sel.appendChild(opt)
    })

    // Number text input
    const inp = document.createElement('input')
    inp.type        = 'tel'
    inp.id          = `${id}-number`
    inp.className   = this._opts.inputClass
    inp.placeholder = this._opts.placeholder
    inp.autocomplete = 'tel'
    inp.maxLength   = 12  // formatted: "XX XXX XXXX" = 11 chars + spare
    inp.style.cssText = 'flex:1;'

    row.appendChild(sel)
    row.appendChild(inp)
    wrapper.appendChild(row)
    parent.appendChild(wrapper)

    this._root   = wrapper
    this._select = sel
    this._input  = inp

    // Auto-format: XX XXX XXXX
    inp.addEventListener('input', () => this._onInput())
    sel.addEventListener('change', () => this._opts.onChange?.(this.getValue()))

    return wrapper
  }

  /**
   * Returns the full E.164-style number, e.g. "+233241234567".
   * If `rawLocal` is true, returns just the local digits without country code.
   */
  getValue(rawLocal = false): string {
    if (!this._select || !this._input) return ''
    const digits = this._input.value.replace(/\s/g, '').replace(/^0+/, '')
    if (rawLocal) return digits
    return digits ? this._select.value + digits : ''
  }

  /** Returns the selected country code, e.g. "+233". */
  getCountryCode(): string {
    return this._select?.value ?? '+233'
  }

  /** Programmatically set a full E.164 phone number. */
  setValue(e164: string): void {
    if (!this._select || !this._input) return
    const match = DEFAULT_COUNTRIES.find(c => e164.startsWith(c.code))
    if (match) {
      this._select.value = match.code
      const local = e164.slice(match.code.length).replace(/^0+/, '')
      this._input.value  = this._format(local)
    } else {
      this._input.value = e164
    }
  }

  /** Clear the input fields. */
  reset(): void {
    if (this._input)  this._input.value  = ''
    if (this._select) this._select.value = '+233'
  }

  /**
   * Return the root HTMLElement, or null if not yet mounted.
   */
  getElement(): HTMLElement | null {
    return this._root
  }

  /**
   * Add an error message below the control (shows a red hint).
   * Pass null/empty to clear.
   */
  setError(msg: string | null): void {
    if (!this._root) return
    let errEl = this._root.querySelector<HTMLElement>('.phone-input-error')
    if (!errEl) {
      errEl = document.createElement('div')
      errEl.className = 'phone-input-error'
      errEl.style.cssText = 'color:#c60026;font-size:12px;margin-top:2px;'
      this._root.appendChild(errEl)
    }
    errEl.textContent  = msg ?? ''
    errEl.style.display = msg ? 'block' : 'none'
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _onInput(): void {
    if (!this._input) return
    const el = this._input
    const cursorPos = el.selectionStart ?? 0
    const prevLen   = el.value.length
    const digits    = el.value.replace(/\D/g, '').slice(0, 9)
    const formatted = this._format(digits)
    el.value = formatted
    const diff = formatted.length - prevLen
    el.setSelectionRange(cursorPos + diff, cursorPos + diff)
    this._opts.onChange?.(this.getValue())
  }

  /** Format local digits as "XX XXX XXXX". */
  private _format(digits: string): string {
    if (digits.length <= 2)  return digits
    if (digits.length <= 5)  return digits.slice(0, 2) + ' ' + digits.slice(2)
    return digits.slice(0, 2) + ' ' + digits.slice(2, 5) + ' ' + digits.slice(5)
  }
}
