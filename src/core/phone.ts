// src/core/phone.ts
//
// Ghana phone number utilities for CACI Hub.

/** Strip everything that is not a digit. */
function _digits(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.replace(/\D/g, '')
}

/**
 * normalizeGhanaPhone
 * Converts to canonical 12-digit format: "233XXXXXXXXX"
 */
export function normalizeGhanaPhone(raw: string | null | undefined): string | null {
  const d = _digits(raw)
  if (!d) return null
  if (d.startsWith('233') && d.length === 12) return d
  if (d.startsWith('0') && d.length === 10) return '233' + d.slice(1)
  if (d.length === 9) return '233' + d
  return null
}

export function isValidGhanaPhone(raw: string | null | undefined): boolean {
  return normalizeGhanaPhone(raw) !== null
}

export function formatGhanaPhoneForDisplay(raw: string | null | undefined): string | null {
  const normalized = normalizeGhanaPhone(raw)
  if (!normalized) return null
  const local = '0' + normalized.slice(3)
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
}

export function formatGhanaLocalDigits(raw: string | null | undefined): string | null {
  const d = _digits(raw)
  if (!d) return null
  let local = d.startsWith('233') ? '0' + d.slice(3) : d.startsWith('0') ? d : '0' + d
  local = local.slice(0, 10)
  if (local.length <= 3) return local
  if (local.length <= 6) return `${local.slice(0, 3)} ${local.slice(3)}`
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
}


/**
 * toSupabaseAuthPhone
 * Returns "+233XXXXXXXXX" — Required E.164 format for Supabase Auth.
 */
export function toSupabaseAuthPhone(raw: string | null | undefined): string | null {
  const normalized = normalizeGhanaPhone(raw)
  return normalized ? '+' + normalized : null
}

export function attachPhoneInputFormatter(el: HTMLInputElement | null): void {
  if (!el) return
  el.addEventListener('input', () => {
    const formatted = formatGhanaLocalDigits(el.value)
    if (formatted !== null) el.value = formatted
    else el.value = el.value.replace(/\D/g, '').slice(0, 13)
  })
}
