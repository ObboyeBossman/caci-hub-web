// src/shared/utils/storage.ts
// Thin wrappers around localStorage with JSON serialisation and error safety.
// Used for non-sensitive preferences: theme, sidebar collapse state, filter presets.
// Never store auth tokens or PII here — Supabase Auth manages its own session.

const PREFIX = 'caci:'

export function storageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function storageSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch (err) {
    console.warn('[storage] Failed to write:', key, err)
  }
}

export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // Silently ignore
  }
}

export function storageClear(): void {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k))
  } catch {
    // Silently ignore
  }
}