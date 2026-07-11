function _cleanPhone(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.replace(/\D/g, '')
}

export function normalizeGhanaPhone(raw: string | null | undefined): string | null {
  const digits = _cleanPhone(raw)
  if (!digits) return null

  if (digits.startsWith('0')) {
    if (digits.length === 10) {
      return '233' + digits.slice(1)
    }
    return null
  }

  if (digits.startsWith('233') && digits.length === 12) {
    return digits
  }

  if (digits.length === 9) {
    return '233' + digits
  }

  return null
}

export function isValidGhanaPhone(raw: string | null | undefined): boolean {
  return normalizeGhanaPhone(raw) !== null
}

export function formatGhanaLocalDigits(raw: string | null | undefined): string | null {
  const digits = _cleanPhone(raw)
  if (!digits) return null

  if (digits.startsWith('0')) {
    const trimmed = digits.slice(0, 10)
    if (trimmed.length <= 3) return trimmed
    if (trimmed.length <= 6) return `${trimmed.slice(0, 3)} ${trimmed.slice(3)}`
    return `${trimmed.slice(0, 3)} ${trimmed.slice(3, 6)} ${trimmed.slice(6)}`
  }

  if (digits.startsWith('233') && digits.length >= 4) {
    const local = '0' + digits.slice(3)
    const trimmed = local.slice(0, 10)
    if (trimmed.length <= 3) return trimmed
    if (trimmed.length <= 6) return `${trimmed.slice(0, 3)} ${trimmed.slice(3)}`
    return `${trimmed.slice(0, 3)} ${trimmed.slice(3, 6)} ${trimmed.slice(6)}`
  }

  if (digits.length === 9) {
    const local = '0' + digits
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  }

  return digits
}

export function formatGhanaPhoneForDisplay(raw: string | null | undefined): string | null {
  const normalized = normalizeGhanaPhone(raw)
  if (!normalized) return null
  return formatGhanaLocalDigits('0' + normalized.slice(3))
}

export function normalizeGhanaPhoneOrNull(raw: string | null | undefined): string | null {
  return normalizeGhanaPhone(raw)
}
