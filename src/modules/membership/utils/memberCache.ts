// src/modules/membership/utils/memberCache.ts
// In-memory member summary cache for cross-module use.
// Provides fast name/avatar lookups without re-querying the database.
//
// Architecture doc §24: "memberCache is read-only for all consumers.
// Only the membership module writes to the database; the cache is
// invalidated via events."
//
// Invalidation events:
//   member:updated   → invalidateMember(id)
//   member:deleted   → invalidateMember(id)
//   member:restored  → invalidateMember(id)
//   auth:signedOut   → clearMemberCache()

import { on } from '@core/events'
import { storageGet, storageSet, storageRemove } from '@shared/utils/storage'

const STORAGE_KEY = 'member_summaries'

export interface MemberSummary {
  id:              string
  first_name:      string
  last_name:       string
  full_name:       string
  initials:        string
  profile_photo_url: string | null
  membership_status: string
  assembly_id:     string
}

type SummaryFetcher = (id: string) => Promise<MemberSummary | null>
type BulkFetcher    = (ids: string[]) => Promise<MemberSummary[]>

const _cache = new Map<string, MemberSummary>()
let _fetcher:      SummaryFetcher | null = null
let _bulkFetcher:  BulkFetcher    | null = null
let _initialised   = false

/**
 * Register the fetch functions.
 * Called once from the membership module's init() hook.
 * The cache is lazy — it never pulls data on its own.
 */
export function initMemberCache(
  fetcher: SummaryFetcher,
  bulkFetcher: BulkFetcher
): void {
  if (_initialised) return
  _fetcher     = fetcher
  _bulkFetcher = bulkFetcher
  _initialised = true

  // Hydrate from persistence
  const saved = storageGet<Record<string, MemberSummary>>(STORAGE_KEY, {})
  Object.entries(saved).forEach(([id, m]) => _cache.set(id, m))

  // Bind invalidation listeners once
  on('member:updated',  (d) => { const { id } = d as { id: string }; invalidateMember(id) })
  on('member:deleted',  (d) => { const { id } = d as { id: string }; invalidateMember(id) })
  on('member:restored', (d) => { const { id } = d as { id: string }; invalidateMember(id) })
  on('auth:signedOut',  () => clearMemberCache())
  on('auth:assemblyChanged', () => clearMemberCache())
}

function _persist(): void {
  storageSet(STORAGE_KEY, Object.fromEntries(_cache))
}

/**
 * Get a single member summary.
 * Returns from cache if present, otherwise fetches and caches.
 */
export async function getMemberSummary(id: string): Promise<MemberSummary | null> {
  if (_cache.has(id)) return _cache.get(id)!

  if (!_fetcher) {
    console.warn('[memberCache] No fetcher registered — call initMemberCache() first')
    return null
  }

  const member = await _fetcher(id)
  if (member) {
    _cache.set(id, member)
    _persist()
  }
  return member
}

/**
 * Get multiple member summaries in one call.
 * Splits into cached + uncached, fetches only the uncached ones.
 */
export async function getMemberSummaries(ids: string[]): Promise<MemberSummary[]> {
  const unique    = [...new Set(ids)]
  const cached    = unique.filter(id => _cache.has(id)).map(id => _cache.get(id)!)
  const uncached  = unique.filter(id => !_cache.has(id))

  if (uncached.length === 0) return cached

  if (!_bulkFetcher) {
    console.warn('[memberCache] No bulk fetcher registered')
    return cached
  }

  const fetched = await _bulkFetcher(uncached)
  if (fetched.length > 0) {
    fetched.forEach(m => _cache.set(m.id, m))
    _persist()
  }

  return [...cached, ...fetched]
}

/** Remove a specific member from the cache (forces re-fetch on next access). */
export function invalidateMember(id: string): void {
  _cache.delete(id)
  _persist()
}

/** Clear the entire cache (on logout or assembly switch). */
export function clearMemberCache(): void {
  _cache.clear()
  storageRemove(STORAGE_KEY)
}
