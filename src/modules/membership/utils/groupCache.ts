/// src/modules/membership/utils/groupCache.ts
// In-memory group summary cache for cross-module use.
// Same pattern as memberCache.ts — see that file for design notes.
//
// Invalidation events:
//   group:updated  → invalidateGroup(id)
//   group:created  → (no cache entry yet, no-op)
//   group:deleted  → invalidateGroup(id)
//   auth:signedOut → clearGroupCache()

import { on } from '@core/events'
import { storageGet, storageSet, storageRemove } from '@shared/utils/storage'

const STORAGE_KEY = 'group_summaries'

export interface GroupSummary {
  id:          string
  name:        string
  type:        string
  leader_name: string | null
  member_count: number
  assembly_id: string
}

type SummaryFetcher = (id: string) => Promise<GroupSummary | null>
type BulkFetcher    = (ids: string[]) => Promise<GroupSummary[]>

const _cache = new Map<string, GroupSummary>()
let _fetcher:     SummaryFetcher | null = null
let _bulkFetcher: BulkFetcher    | null = null
let _initialised  = false

/**
 * Register the fetch functions.
 * Called once from the membership (or groups) module's init() hook.
 */
export function initGroupCache(
  fetcher: SummaryFetcher,
  bulkFetcher: BulkFetcher
): void {
  if (_initialised) return
  _fetcher     = fetcher
  _bulkFetcher = bulkFetcher
  _initialised = true

  // Hydrate from persistence
  const saved = storageGet<Record<string, GroupSummary>>(STORAGE_KEY, {})
  Object.entries(saved).forEach(([id, g]) => _cache.set(id, g))

  on('group:updated',  (d) => { const { id } = d as { id: string }; invalidateGroup(id) })
  on('group:deleted',  (d) => { const { id } = d as { id: string }; invalidateGroup(id) })
  on('auth:signedOut', () => clearGroupCache())
  on('auth:assemblyChanged', () => clearGroupCache())
}

function _persist(): void {
  storageSet(STORAGE_KEY, Object.fromEntries(_cache))
}

export async function getGroupSummary(id: string): Promise<GroupSummary | null> {
  if (_cache.has(id)) return _cache.get(id)!

  if (!_fetcher) {
    console.warn('[groupCache] No fetcher registered — call initGroupCache() first')
    return null
  }

  const group = await _fetcher(id)
  if (group) {
    _cache.set(id, group)
    _persist()
  }
  return group
}

export async function getGroupSummaries(ids: string[]): Promise<GroupSummary[]> {
  const unique   = [...new Set(ids)]
  const cached   = unique.filter(id => _cache.has(id)).map(id => _cache.get(id)!)
  const uncached = unique.filter(id => !_cache.has(id))

  if (uncached.length === 0) return cached

  if (!_bulkFetcher) {
    console.warn('[groupCache] No bulk fetcher registered')
    return cached
  }

  const fetched = await _bulkFetcher(uncached)
  if (fetched.length > 0) {
    fetched.forEach(g => _cache.set(g.id, g))
    _persist()
  }

  return [...cached, ...fetched]
}

export function invalidateGroup(id: string): void {
  _cache.delete(id)
  _persist()
}

export function clearGroupCache(): void {
  _cache.clear()
  storageRemove(STORAGE_KEY)
}
