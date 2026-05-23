// src/core/theme.ts

/**
 * Applies the correct theme to the document.
 * Priority: localStorage preference > System preference.
 */
export function applyTheme(): void {
  const saved = localStorage.getItem('caci-theme')
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
    if (!localStorage.getItem('caci-theme')) {
      applyTheme()
    }
  })
}
