// src/core/theme.ts

const THEME_KEY          = 'caci-theme'
const ACCENT_KEY         = 'caci-accent'
const FONT_SIZE_KEY      = 'caci-font-size'
const REDUCE_MOTION_KEY  = 'caci-reduce-motion'
const HIGH_CONTRAST_KEY  = 'caci-high-contrast'

/**
 * Applies the correct theme to the document.
 * Priority: localStorage preference > System preference.
 */
export function applyTheme(): void {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved) {
    document.documentElement.dataset['theme'] = saved
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.dataset['theme'] = prefersDark ? 'dark' : 'light'
  }
}

/**
 * Initializes a system-level listener for theme changes.
 * Ensures the app switches live if no manual preference is set.
 */
export function initThemeListener(): void {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    // Only auto-switch if user hasn't set a manual preference
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme()
    }
  })
}

// ── Accent colour ─────────────────────────────────────────────────────────────

export function applyAccent(hex: string): void {
  document.documentElement.style.setProperty('--accent',     hex)
  document.documentElement.style.setProperty('--caci-blue',  hex)
  localStorage.setItem(ACCENT_KEY, hex)
}

export function getSavedAccent(): string | null {
  return localStorage.getItem(ACCENT_KEY)
}

// ── Font size ─────────────────────────────────────────────────────────────────

export function applyFontSize(px: string): void {
  document.documentElement.style.fontSize = px + 'px'
  localStorage.setItem(FONT_SIZE_KEY, px)
}

export function getSavedFontSize(): string | null {
  return localStorage.getItem(FONT_SIZE_KEY)
}

// ── Accessibility ─────────────────────────────────────────────────────────────

export function applyReduceMotion(enabled: boolean): void {
  document.documentElement.dataset['reducedMotion'] = enabled ? '1' : '0'
  localStorage.setItem(REDUCE_MOTION_KEY, enabled ? '1' : '0')
}

export function applyHighContrast(enabled: boolean): void {
  document.documentElement.dataset['highContrast'] = enabled ? '1' : '0'
  localStorage.setItem(HIGH_CONTRAST_KEY, enabled ? '1' : '0')
}

export function getSavedReduceMotion(): boolean {
  return localStorage.getItem(REDUCE_MOTION_KEY) === '1'
}

export function getSavedHighContrast(): boolean {
  return localStorage.getItem(HIGH_CONTRAST_KEY) === '1'
}

// ── Apply all saved appearance prefs at once (call at boot) ───────────────────

export function applyAppearance(): void {
  applyTheme()

  const accent = getSavedAccent()
  if (accent) {
    document.documentElement.style.setProperty('--accent',    accent)
    document.documentElement.style.setProperty('--caci-blue', accent)
  }

  const fontSize = getSavedFontSize()
  if (fontSize) {
    document.documentElement.style.fontSize = fontSize + 'px'
  }

  const reduceMotion = getSavedReduceMotion()
  document.documentElement.dataset['reducedMotion'] = reduceMotion ? '1' : '0'

  const highContrast = getSavedHighContrast()
  document.documentElement.dataset['highContrast'] = highContrast ? '1' : '0'
}
