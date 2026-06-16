// src/modules/accounts/utils/userProfileCache.ts
// In-memory user profile cache — mirrors the memberCache pattern exactly.
// Provides fast lookups of user account data without re-querying the database.
//
// Invalidation events:
//   account:roleChanged    → invalidateUserProfile(id)
//   account:suspended      → invalidateUserProfile(id)
//   account:reactivated    → invalidateUserProfile(id)
//   account:provisioned    → (new entry — no invalidation needed, just fetch on access)
//   auth:signedOut         → clearUserProfileCache()
//   auth:assemblyChanged   → clearUserProfileCache()

import { on }                                from '@core/events'
import { storageGet, storageSet, storageRemove } from '@shared/utils/storage'
import type { SystemRole }                   from '../../../types/auth.types'

const STORAGE_KEY = 'account_user_profiles'

export interface UserProfileSummary {
  id:         string        // user_profiles.id (= auth.users.id)
  memberId:   string | null // user_profiles.member_id
  fullName:   string        // user_profiles.full_name
  email:      string | null
  role:       SystemRole
  isActive:   boolean
  assemblyId: string | null
  assemblyRoleId?: string | null
  effectiveRoleName?: string | null  // from DB view: 'Administrator', 'Member', or custom role name
  roleSource?: 'system' | 'custom' | null  // from DB view: 'system' or 'custom'
}

type ProfileFetcher     = (id: string)      => Promise<UserProfileSummary | null>
type BulkProfileFetcher = (ids: string[])   => Promise<UserProfileSummary[]>

const _cache = new Map<string, UserProfileSummary>()
let _fetcher:     ProfileFetcher     | null = null
let _bulkFetcher: BulkProfileFetcher | null = null
let _initialised = false

/**
 * Register fetch functions and hydrate from localStorage.
 * Called once from accounts module init() hook.
 */
export function initUserProfileCache(
  fetcher:     ProfileFetcher,
  bulkFetcher: BulkProfileFetcher
): void {
  if (_initialised) return
  _fetcher     = fetcher
  _bulkFetcher = bulkFetcher
  _initialised = true

  // Hydrate from persistence
  const saved = storageGet<Record<string, UserProfileSummary>>(STORAGE_KEY, {})
  Object.entries(saved).forEach(([id, p]) => _cache.set(id, p))

  // Bind invalidation listeners
  on('account:roleChanged',  (d) => { const { userId } = d as { userId: string }; invalidateUserProfile(userId) })
  on('account:suspended',    (d) => { const { userId } = d as { userId: string }; invalidateUserProfile(userId) })
  on('account:reactivated',  (d) => { const { userId } = d as { userId: string }; invalidateUserProfile(userId) })
  on('auth:signedOut',       () => clearUserProfileCache())
  on('auth:assemblyChanged', () => clearUserProfileCache())
}

function _persist(): void {
  storageSet(STORAGE_KEY, Object.fromEntries(_cache))
}

/** Get a single user profile. Returns from cache if present, else fetches. */
export async function getUserProfile(id: string): Promise<UserProfileSummary | null> {
  if (_cache.has(id)) return _cache.get(id)!

  if (!_fetcher) {
    console.warn('[userProfileCache] No fetcher registered — call initUserProfileCache() first')
    return null
  }

  const profile = await _fetcher(id)
  if (profile) {
    _cache.set(id, profile)
    _persist()
  }
  return profile
}

/** Get multiple profiles in one call — fetches only uncached ones. */
export async function getUserProfiles(ids: string[]): Promise<UserProfileSummary[]> {
  const unique   = [...new Set(ids)]
  const cached   = unique.filter(id => _cache.has(id)).map(id => _cache.get(id)!)
  const uncached = unique.filter(id => !_cache.has(id))

  if (uncached.length === 0) return cached

  if (!_bulkFetcher) {
    console.warn('[userProfileCache] No bulk fetcher registered')
    return cached
  }

  const fetched = await _bulkFetcher(uncached)
  if (fetched.length > 0) {
    fetched.forEach(p => _cache.set(p.id, p))
    _persist()
  }

  return [...cached, ...fetched]
}

/** Remove a single entry (forces re-fetch on next access). */
export function invalidateUserProfile(id: string): void {
  _cache.delete(id)
  _persist()
}

/** Clear entire cache (on logout or assembly switch). */
export function clearUserProfileCache(): void {
  _cache.clear()
  storageRemove(STORAGE_KEY)
}
