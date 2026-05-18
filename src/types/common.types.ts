// common.types.ts
// Shared utility types used across all modules.
// Mirrors Flutter: AppError, app_error.dart, common result/state patterns.

// ── LoadState — the four states every data page cycles through ────────────────
// Matches the four-state diagram in the architecture document.
// Used by pageHelpers.ts to track which helper to call.
//
//   loading → renderSkeleton()   (immediate, before any await)
//   success → content HTML        (after data arrives, data.length > 0)
//   empty   → renderEmpty()       (after data arrives, data.length === 0)
//   error   → renderError()       (after a thrown exception)
export type LoadState = 'loading' | 'success' | 'empty' | 'error'

// ── PaginatedResult — generic paginated response ──────────────────────────────
export interface PaginatedResult<T> {
  data:    T[]
  total:   number
  page:    number
  perPage: number
  hasMore: boolean
}

// ── ApiResponse — generic discriminated union response ───────────────────────
// Use as the return type of service methods that can fail gracefully.
export type ApiResponse<T> =
  | { ok: true;  data: T }
  | { ok: false; error: RepositoryError }

// ── RepositoryError — structured error from the data layer ───────────────────
// Wraps raw Supabase/PostgREST errors with a typed code for display mapping.
//
// renderError() in pageHelpers.ts maps codes to user-friendly messages:
//   42501    → 'You don't have permission to view this'
//   PGRST116 → 'The record was not found'
//   PGRST301 → 'Session expired — please log in again'
//   23505    → 'A record with these details already exists'
//   default  → 'Something went wrong. Please try again.'
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'RepositoryError'
  }
}

// ── Known Supabase/PostgREST error codes ─────────────────────────────────────
// Reference these constants in repository.ts catch blocks rather than
// hard-coding string literals.
export const DB_ERROR_CODES = {
  PERMISSION_DENIED: '42501',   // RLS violation — user lacks permission
  NOT_FOUND:         'PGRST116', // .single() found no row
  SESSION_EXPIRED:   'PGRST301', // JWT expired or invalid
  UNIQUE_VIOLATION:  '23505',   // unique constraint conflict
  FK_VIOLATION:      '23503',   // foreign key constraint violation
} as const
