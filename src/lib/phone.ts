// ============================================================
// CACI HUB — Phone Number Utilities (Ghana format)
// Spec: lib/phone.ts
// ============================================================

/**
 * Normalise any Ghana format → '233XXXXXXXXX' (12 digits, no +)
 * Rules:
 *  - '0241234567' (10 digits, leading 0) → '233241234567'
 *  - '241234567'  (9 digits)              → '233241234567'
 *  - '233241234567' (already normalised)  → '233241234567'
 *  - '+233241234567'                      → '233241234567'
 *  - Anything else → null
 */
export function normalizeGhanaPhone(raw: string): string | null {
  if (!raw) return null;
  let s = raw.replace(/[^\d+]/g, "").trim();

  // strip leading +
  if (s.startsWith("+")) s = s.slice(1);

  if (/^233\d{9}$/.test(s)) return s;
  if (/^0\d{9}$/.test(s)) return "233" + s.slice(1);
  if (/^\d{9}$/.test(s)) return "233" + s;

  return null;
}

/** Validate Ghana phone (any format). */
export function isValidGhanaPhone(raw: string): boolean {
  return normalizeGhanaPhone(raw) !== null;
}

/** Display format → '024 123 4567' */
export function formatGhanaPhoneForDisplay(raw: string): string {
  const norm = normalizeGhanaPhone(raw);
  if (!norm) return raw; // keep what user typed
  // norm = 233XXXXXXXXX (12 chars)
  const local = "0" + norm.slice(3); // 0XXXXXXXXX (10 chars)
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/** For Supabase/Auth calls → '+233XXXXXXXXX' */
export function toSupabaseAuthPhone(raw: string): string | null {
  const norm = normalizeGhanaPhone(raw);
  return norm ? "+" + norm : null;
}

/** Bind live formatting to an input element as user types. */
export function attachPhoneInputFormatter(el: HTMLInputElement): () => void {
  const handler = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const cursorPos = target.selectionStart ?? 0;
    const prevDisplay = target.value;
    const newDisplay = formatGhanaPhoneForDisplay(prevDisplay);
    if (newDisplay !== prevDisplay) {
      target.value = newDisplay;
      // try to keep cursor near where it was
      const delta = newDisplay.length - prevDisplay.length;
      const newPos = Math.max(0, Math.min(newDisplay.length, cursorPos + delta));
      target.setSelectionRange(newPos, newPos);
    }
  };
  el.addEventListener("input", handler);
  return () => el.removeEventListener("input", handler);
}
