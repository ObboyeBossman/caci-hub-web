/// <reference types="vite/client" />

// ── Vite environment variable types ──────────────────────────────────────────
// All VITE_ prefixed vars are available via import.meta.env
// Variables without VITE_ prefix are NOT exposed to client code.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL:      string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// ── CSS module declarations ───────────────────────────────────────────────────
// Allows TypeScript to accept CSS file imports without errors.
// Vite handles the actual processing; these are type-level shims only.
declare module '*.css' {
  const content: Record<string, string>
  export default content
}

// ── Bootstrap Icons font import shim ─────────────────────────────────────────
declare module 'bootstrap-icons/font/bootstrap-icons.css' {
  const content: Record<string, string>
  export default content
}

// ── Notyf CSS import shim ─────────────────────────────────────────────────────
declare module 'notyf/notyf.min.css' {
  const content: Record<string, string>
  export default content
}
