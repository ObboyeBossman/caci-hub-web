// src/modules/membership/repository.ts
// Mirrors: supabase_member_data_source.dart + member_repository.dart
//          households_repository.dart
//
// RULES (from architecture doc + Flutter source):
//   - ALL member reads → members_view (column-level masking via security_barrier)
//   - ALL member writes → members table directly
//   - Household reads/writes → households table directly
//   - assembly_id is ALWAYS sourced from getActiveAssemblyId() here,
//     never trusted from form input (injected at service/repo layer)
//   - After any write, emit the appropriate event for cache invalidation
//   - Re-throw all errors as RepositoryError with the raw PostgREST code
//     preserved so renderError() / permissionGuard can map them correctly

import { supabase } from '@core/supabase'
import { getActiveAssemblyId } from '@core/auth'
import { emit } from '@core/events'
import { RepositoryError, DB_ERROR_CODES } from '../../types/common.types'
import type {
  MemberView,
  MemberFilter,
  CreateMemberPayload,
  UpdateMemberPayload,
  MemberAuditEntry,
  HouseholdView,
  HouseholdWithMembers,
  HouseholdFilter,
  HouseholdDropdownItem,
  CreateHouseholdPayload,
  UpdateHouseholdPayload,
} from '../../types/member.types'

// ── PostgREST embed — mirrors SupabaseMemberDataSource._memberViewSelect ──────
// Join household name inline so the view row includes households.family_name.
const MEMBER_VIEW_SELECT =
  '*, households!members_household_id_fkey(id, family_name)'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Map a raw Supabase/PostgREST error to a typed RepositoryError.
 * Mirrors: MemberRepository._mapPostgrestException() in Flutter.
 * Preserves the original error code so renderError() can display the
 * correct user-facing message.
 */
function mapError(err: unknown, context: string): RepositoryError {
  const e = err as { code?: string; message?: string; details?: string }
  const code = e.code ?? 'UNKNOWN'
  const message = _errorMessage(code, e.details)
  
  // Log all unmapped or unhandled errors to console so we don't lose the raw cause
  if (code !== DB_ERROR_CODES.NOT_FOUND && code !== DB_ERROR_CODES.PERMISSION_DENIED) {
    console.error(`[repository Error] ${context}:`, err)
  }
  
  return new RepositoryError(message, err, code)
}

function _errorMessage(code: string, details?: string): string {
  switch (code) {
    case DB_ERROR_CODES.NOT_FOUND:
      return 'Member not found.'
    case DB_ERROR_CODES.PERMISSION_DENIED:
      return 'You do not have permission to perform this action.'
    case DB_ERROR_CODES.SESSION_EXPIRED:
      return 'Your session has expired. Please log in again.'
    case DB_ERROR_CODES.UNIQUE_VIOLATION:
      return _mapUniqueViolation(details ?? '')
    default:
      return `Something went wrong. Please try again. (Code: ${code})`
  }
}

// Mirrors: MemberRepository._mapUniqueViolation() in Flutter
function _mapUniqueViolation(details: string): string {
  const d = details.toLowerCase()
  if (d.includes('phone')) return 'A member with this phone number already exists.'
  if (d.includes('email')) return 'A member with this email already exists.'
  if (d.includes('auth_user_id')) return 'This account is already linked to another member.'
  return 'A record with these details already exists.'
}

// ── ─────────────────────────────────────────────────────────────────────────
// MEMBERS
// ── ─────────────────────────────────────────────────────────────────────────

/**
 * List members with optional filter, sort, and pagination.
 * Mirrors: SupabaseMemberDataSource.fetchMembers()
 * ALL reads go through members_view.
 */
export async function listMembers(
  filter?: MemberFilter,
  opts: {
    limit?: number
    offset?: number
    sortBy?: string
    ascending?: boolean
  } = {}
): Promise<MemberView[]> {
  try {
    const { limit = 50, offset = 0, sortBy = 'last_name', ascending = true } = opts

    // eslint-disable-next-line prefer-const
    let query = supabase
      .from('members_view')
      .select(MEMBER_VIEW_SELECT)

    // ── Filter predicates — mirrors SupabaseMemberDataSource fetchMembers() ──

    const f = filter
    if (f) {
      // Multi-status OR — PostgREST: in.(val1,val2)
      if (f.statuses && f.statuses.length > 0) {
        query = query.in('membership_status', f.statuses)
      }

      if (f.gender) {
        query = query.eq('gender', f.gender)
      }

      if (f.householdId) {
        query = query.eq('household_id', f.householdId)
      }

      // Full-text search — ilike on first_name OR last_name
      const q = f.searchQuery?.trim()
      if (q) {
        query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      }

      if (f.assemblyId) {
        query = query.eq('assembly_id', f.assemblyId)
      } else {
        const activeAssembly = getActiveAssemblyId()
        if (activeAssembly) {
          query = query.eq('assembly_id', activeAssembly)
        }
      }

      if (!f.includeDeleted) {
        query = query.is('deleted_at', null)
      }
    } else {
      // Default: all non-deleted members, filtered by active assembly
      const activeAssembly = getActiveAssemblyId()
      if (activeAssembly) {
        query = query.eq('assembly_id', activeAssembly)
      }
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query
      .order(sortBy, { ascending })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return (data ?? []) as MemberView[]
  } catch (err) {
    throw mapError(err, 'listMembers')
  }
}

/**
 * Fetch accurate counts for different member categories.
 * Bypasses the listMembers fetch limit to ensure UI badges are always correct.
 */
export async function getMemberCounts(): Promise<{
  total: number
  active: number
  visitor: number
  new: number
}> {
  const assemblyId = getActiveAssemblyId()
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30)

  try {
    // 1. Total (Active + Non-deleted)
    const qTotal = supabase
      .from('members_view')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
    if (assemblyId) qTotal.eq('assembly_id', assemblyId)
    const { count: total } = await qTotal

    // 2. Active status
    const qActive = supabase
      .from('members_view')
      .select('*', { count: 'exact', head: true })
      .eq('membership_status', 'active')
      .is('deleted_at', null)
    if (assemblyId) qActive.eq('assembly_id', assemblyId)
    const { count: active } = await qActive

    // 3. Visitor status
    const qVisitor = supabase
      .from('members_view')
      .select('*', { count: 'exact', head: true })
      .eq('membership_status', 'visitor')
      .is('deleted_at', null)
    if (assemblyId) qVisitor.eq('assembly_id', assemblyId)
    const { count: visitor } = await qVisitor

    // 4. New (Joined or Registered in last 30 days)
    const iso = cutoff.toISOString()
    const qNew = supabase
      .from('members_view')
      .select('*', { count: 'exact', head: true })
      .or(`join_date.gte.${iso},and(join_date.is.null,created_at.gte.${iso})`)
      .is('deleted_at', null)
    if (assemblyId) qNew.eq('assembly_id', assemblyId)
    const { count: newCount } = await qNew

    return {
      total:   total   || 0,
      active:  active  || 0,
      visitor: visitor || 0,
      new:     newCount || 0,
    }
  } catch (err) {
    console.error('[repository] Failed to fetch member counts:', err)
    return { total: 0, active: 0, visitor: 0, new: 0 }
  }
}


/**
 * Fetch a single member by ID through members_view.
 * Mirrors: SupabaseMemberDataSource.fetchMember()
 * Throws RepositoryError with code PGRST116 if not found.
 */
export async function getMember(memberId: string): Promise<MemberView> {
  try {
    const { data, error } = await supabase
      .from('members_view')
      .select(MEMBER_VIEW_SELECT)
      .eq('id', memberId)
      .single()

    if (error) throw error
    return data as MemberView
  } catch (err) {
    throw mapError(err, `getMember(${memberId})`)
  }
}

/**
 * Fetch the members_view row for the currently authenticated user.
 * Matches on auth_user_id — the Supabase Auth UID stored on the member record.
 *
 * Returns null when:
 *   - No active Supabase session exists.
 *   - The user has no linked member record yet.
 *
 * Extra fields `assemblyName` and `householdName` are resolved in the same
 * PostgREST request so the profile panel can display them without extra calls.
 *
 * Used by SettingsOverlay to populate the Profile tab.
 */
export async function getOwnMemberProfile(): Promise<
  (MemberView & { assemblyName: string | null; householdName: string | null }) | null
> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('members_view')
      .select(
        `*,
         households!members_household_id_fkey(id, family_name),
         assemblies(id, name)`
      )
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (error) {
      console.warn('[getOwnMemberProfile] query error:', error)
      return null
    }
    if (!data) return null

    const row = data as any
    return {
      ...(row as MemberView),
      assemblyName: (row.assemblies as { name?: string } | null)?.name ?? null,
      householdName: (row.households as { family_name?: string } | null)?.family_name ?? null,
    }
  } catch (err) {
    console.warn('[getOwnMemberProfile] unexpected error:', err)
    return null
  }
}

/**
 * Fetch a lightweight summary of a single member — used by memberCache fetcher.
 * Returns null if the member is not found (no throw).
 */
export async function getMemberSummary(memberId: string) {
  try {
    const { data, error } = await supabase
      .from('members_view')
      .select('id, first_name, last_name, profile_photo_url, membership_status, assembly_id')
      .eq('id', memberId)
      .single()

    if (error) return null
    if (!data) return null

    const d = data as {
      id: string
      first_name: string
      last_name: string
      profile_photo_url: string | null
      membership_status: string
      assembly_id: string
    }

    const full_name = `${d.first_name} ${d.last_name}`
    const initials = [d.first_name[0], d.last_name[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase()

    return {
      id: d.id,
      first_name: d.first_name,
      last_name: d.last_name,
      full_name,
      initials,
      profile_photo_url: d.profile_photo_url,
      membership_status: d.membership_status,
      assembly_id: d.assembly_id,
    }
  } catch {
    return null
  }
}

/**
 * Bulk fetch member summaries — used by memberCache bulk fetcher.
 */
export async function getMemberSummaries(ids: string[]) {
  if (ids.length === 0) return []
  try {
    const { data, error } = await supabase
      .from('members_view')
      .select('id, first_name, last_name, profile_photo_url, membership_status, assembly_id')
      .in('id', ids)

    if (error) return []

    return (data ?? []).map((d: any) => ({
      id: d.id as string,
      first_name: d.first_name as string,
      last_name: d.last_name as string,
      full_name: `${d.first_name} ${d.last_name}`,
      initials: `${(d.first_name as string)[0] ?? ''}${(d.last_name as string)[0] ?? ''}`.toUpperCase(),
      profile_photo_url: d.profile_photo_url as string | null,
      membership_status: d.membership_status as string,
      assembly_id: d.assembly_id as string,
    }))
  } catch {
    return []
  }
}

/**
 * Insert a new member into the `members` table, then re-fetch through the view.
 * Mirrors: SupabaseMemberDataSource.insertMember()
 * assembly_id is injected here from getActiveAssemblyId() — never from form input.
 * Emits 'member:registered' after success.
 */
export async function createMember(
  payload: Omit<CreateMemberPayload, 'assembly_id'>
): Promise<MemberView> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) throw new RepositoryError('No active assembly selected.', null, 'NO_ASSEMBLY')

  try {
    // Write to the underlying table
    const { data: inserted, error: insertError } = await supabase
      .from('members')
      .insert({ ...payload, assembly_id: assemblyId } as any)
      .select('id')
      .single()

    if (insertError) throw insertError

    const id = (inserted as { id: string }).id

    // Re-fetch through the view for column masking + household join
    const member = await getMember(id)

    emit('member:registered', { id })
    return member
  } catch (err) {
    throw mapError(err, 'createMember')
  }
}

/**
 * Patch an existing member in the `members` table, then re-fetch through the view.
 * Mirrors: SupabaseMemberDataSource.updateMember()
 * Only the keys present in payload are sent — patch semantics.
 * Emits 'member:updated' after success.
 */
export async function updateMember(
  id: string,
  payload: UpdateMemberPayload
): Promise<MemberView> {
  try {
    const { error } = await supabase
      .from('members')
      .update(payload as any)
      .eq('id', id)

    if (error) throw error

    const member = await getMember(id)
    emit('member:updated', { id })
    return member
  } catch (err) {
    throw mapError(err, `updateMember(${id})`)
  }
}

/**
 * Soft-delete: sets is_active = false, deleted_at = now().
 * Mirrors: SupabaseMemberDataSource.deactivateMember()
 * Emits 'member:deleted' after success.
 */
export async function deactivateMember(memberId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('members')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
      } as any)
      .eq('id', memberId)

    if (error) throw error
    emit('member:deleted', { id: memberId })
  } catch (err) {
    throw mapError(err, `deactivateMember(${memberId})`)
  }
}

/**
 * Restore a soft-deleted member.
 * Emits 'member:restored' after success.
 */
export async function restoreMember(memberId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('members')
      .update({ is_active: true, deleted_at: null } as any)
      .eq('id', memberId)

    if (error) throw error
    emit('member:restored', { id: memberId })
  } catch (err) {
    throw mapError(err, `restoreMember(${memberId})`)
  }
}

// ── Membership number ─────────────────────────────────────────────────────────

/**
 * Call the assign-membership-number Edge Function.
 * Mirrors: SupabaseMemberDataSource.callAssignMembershipNumber()
 * Returns the generated membership number string.
 */
export async function assignMembershipNumber(memberId: string): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'generate-membership-number',
      { body: { memberId } }
    )

    if (error) throw error

    const number = (data as { membershipNumber?: string })?.membershipNumber
    if (!number) throw new Error('Edge Function returned null membershipNumber')

    return number
  } catch (err) {
    throw new RepositoryError(
      'Failed to assign membership number.',
      err,
      'EF_ERROR'
    )
  }
}


// ── Photo upload ──────────────────────────────────────────────────────────────

/**
 * Upload a member profile photo to `member-photos/<authUid>/<fileName>`.
 * Mirrors: SupabaseMemberDataSource.uploadProfilePhoto()
 * Returns the public URL (not just the storage path).
 */
export async function uploadProfilePhoto(opts: {
  authUid: string
  fileName: string
  blob: Blob
  mimeType: string
}): Promise<string> {
  const path = `${opts.authUid}/${opts.fileName}`
  try {
    const { error } = await supabase.storage
      .from('member-photos')
      .upload(path, opts.blob, {
        contentType: opts.mimeType,
        upsert: true,
      })

    if (error) throw error

    const { data: urlData } = supabase.storage
      .from('member-photos')
      .getPublicUrl(path)

    return urlData.publicUrl
  } catch (err) {
    throw new RepositoryError(
      'Photo upload failed. Please try again.',
      err,
      'STORAGE_ERROR'
    )
  }
}

/**
 * Delete a member profile photo from storage.
 * Mirrors: SupabaseMemberDataSource.deleteProfilePhoto()
 */
export async function deleteProfilePhoto(storagePath: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from('member-photos')
      .remove([storagePath])

    if (error) throw error
  } catch (err) {
    throw new RepositoryError(
      'Photo deletion failed. Please try again.',
      err,
      'STORAGE_ERROR'
    )
  }
}

// ── Audit log ─────────────────────────────────────────────────────────────────

/**
 * Fetch the full audit log for a member, joined with user_profiles for changedByName.
 * Mirrors: SupabaseMemberDataSource.fetchAuditLog()
 * Throws RepositoryError with code 42501 if the caller is not admin/pastor.
 */
export async function getMemberAuditLog(memberId: string): Promise<MemberAuditEntry[]> {
  try {
    const { data, error } = await supabase
      .from('member_audit_log')
      .select('*')
      .eq('member_id', memberId)
      .order('changed_at', { ascending: false })

    if (error) throw error

    // Manual join of user profiles
    const actorIds = [...new Set((data ?? []).map((r: any) => r.changed_by).filter(Boolean))] as string[]
    const actorMap = new Map<string, string>()
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', actorIds)
      ;(profiles ?? []).forEach((p: any) => actorMap.set(p.id, p.full_name))
    }

    // Mirrors MemberAuditEntry.fromJson() dual-shape handling
    return (data ?? []).map((row: any) => ({
      id: row.id as string,
      member_id: row.member_id as string,
      assembly_id: row.assembly_id as string,
      changed_by: row.changed_by as string | null,
      changed_by_name: actorMap.get(row.changed_by) ?? null,
      field_changed: row.field_changed as string,
      old_value: row.old_value as string | null,
      new_value: row.new_value as string | null,
      changed_at: row.changed_at as string,
    })) satisfies MemberAuditEntry[]
  } catch (err) {
    throw mapError(err, `getMemberAuditLog(${memberId})`)
  }
}

/**
 * Fetch the most recent audit log entry for a member.
 * Used by the member list "last edited" column.
 */
export async function getLastAuditEntry(
  memberId: string
): Promise<{ changed_at: string; changed_by_name: string | null } | null> {
  try {
    const { data, error } = await supabase
      .from('member_audit_log')
      .select('changed_at, changed_by')
      .eq('member_id', memberId)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    let changed_by_name = null
    const row = data as any
    if (row.changed_by) {
      const { data: profile } = await supabase.from('user_profiles').select('full_name').eq('id', row.changed_by).maybeSingle()
      if (profile) changed_by_name = (profile as any).full_name
    }

    return {
      changed_at: row.changed_at as string,
      changed_by_name,
    }
  } catch {
    return null
  }
}

// ── Real-time ─────────────────────────────────────────────────────────────────

/**
 * Subscribe to real-time changes on the `members` table for the active assembly.
 * Mirrors: SupabaseMemberDataSource.streamMembers()
 *
 * IMPORTANT: Called once in the module's init() hook, NOT in page render().
 * A single channel handles all member updates across all pages.
 *
 * Returns the RealtimeChannel so the module can call .unsubscribe() in dispose().
 */
export function subscribeToMembers(
  assemblyId: string,
  onUpdate: (type: 'INSERT' | 'UPDATE' | 'DELETE', memberId: string) => void
) {
  return supabase
    .channel(`members:${assemblyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'members',
        filter: `assembly_id=eq.${assemblyId}`,
      },
      (payload) => {
        const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
        const id =
          (payload.new as { id?: string })?.id ??
          (payload.old as { id?: string })?.id ??
          ''
        if (id) onUpdate(eventType, id)
      }
    )
    .subscribe()
}

// ── ─────────────────────────────────────────────────────────────────────────
// HOUSEHOLDS
// ── ─────────────────────────────────────────────────────────────────────────

/**
 * List households with optional search filter and computed fields.
 * Reads from `households` table with a member count join.
 * Mirrors: households_repository.dart listHouseholds()
 */
export async function listHouseholds(
  filter?: HouseholdFilter
): Promise<HouseholdView[]> {
  try {
    // Step 1: fetch households with member count
    let query = supabase
      .from('households')
      .select(
        `*,
         members(count)`
      )

    if (filter?.assembly_id) {
      query = query.eq('assembly_id', filter.assembly_id)
    } else {
      const assemblyId = getActiveAssemblyId()
      if (assemblyId) query = query.eq('assembly_id', assemblyId)
    }

    if (filter?.search) {
      query = query.ilike('family_name', `%${filter.search}%`)
    }

    const { data, error } = await query.order('family_name', { ascending: true })
    if (error) throw error

    const rows = data ?? []

    // Step 2: resolve primary contact names in a single batch uery
    const contactIds = [...new Set((rows as any[]).map(r => r.primary_contact_id).filter(Boolean))] as string[]
    const contactMap = new Map<string, string>()
    if (contactIds.length > 0) {
      const { data: contacts } = await supabase
        .from('members')
        .select('id, first_name, last_name')
        .in('id', contactIds)
        ; (contacts ?? []).forEach((c: any) => {
          contactMap.set(c.id, `${c.first_name} ${c.last_name}`)
        })
    }

    return rows.map((row: any) => ({
      id: row.id as string,
      assembly_id: row.assembly_id as string,
      family_name: row.family_name as string,
      address: row.address as string | null,
      primary_contact_id: row.primary_contact_id as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      member_count: (row.members as { count: number }[])?.[0]?.count ?? 0,
      primary_contact_name: row.primary_contact_id ? (contactMap.get(row.primary_contact_id) ?? null) : null,
    })) satisfies HouseholdView[]
  } catch (err) {
    throw mapError(err, 'listHouseholds')
  }
}


/**
 * Fetch a single household with its full member list.
 * Mirrors: households_repository.dart getHousehold()
 */
export async function getHousehold(householdId: string): Promise<HouseholdWithMembers> {
  try {
    const { data, error } = await supabase
      .from('households')
      .select(
        `*,
         members!members_household_id_fkey(count),
         primary_contact:members!households_primary_contact_id_fkey(
           id, first_name, last_name
         )`
      )
      .eq('id', householdId)
      .single()

    if (error) throw error

    const row = data as any

    // Fetch members separately through the view for column masking
    const { data: memberData, error: memberError } = await supabase
      .from('members_view')
      .select(MEMBER_VIEW_SELECT)
      .eq('household_id', householdId)
      .eq('is_active', true)
      .order('last_name', { ascending: true })

    if (memberError) throw memberError

    return {
      id: row.id as string,
      assembly_id: row.assembly_id as string,
      family_name: row.family_name as string,
      address: row.address as string | null,
      primary_contact_id: row.primary_contact_id as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      member_count: (row.members as { count: number }[])?.[0]?.count ?? 0,
      primary_contact_name: row.primary_contact
        ? `${(row.primary_contact as any).first_name} ${(row.primary_contact as any).last_name}`
        : null,
      members: (memberData ?? []) as MemberView[],
    }
  } catch (err) {
    throw mapError(err, `getHousehold(${householdId})`)
  }
}

/**
 * Fetch a flat list of households for form dropdowns.
 * Returns only id + family_name — mirrors Flutter HouseholdFilter dropdown item.
 * Mirrors: Flutter member_create_screen.dart household dropdown population.
 */
export async function getHouseholdDropdownItems(): Promise<HouseholdDropdownItem[]> {
  const assemblyId = getActiveAssemblyId()
  try {
    let query = supabase
      .from('households')
      .select('id, family_name')
      .order('family_name', { ascending: true })

    if (assemblyId) query = query.eq('assembly_id', assemblyId)

    const { data, error } = await query
    if (error) throw error

    return (data ?? []) as HouseholdDropdownItem[]
  } catch (err) {
    throw mapError(err, 'getHouseholdDropdownItems')
  }
}

/**
 * Fetch members available to be set as primary contact for a household.
 * Calls the DB function get_available_primary_contacts (migration 20260502053000).
 */
export async function getAvailablePrimaryContacts(
  householdId: string
): Promise<{ id: string; full_name: string }[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_available_primary_contacts', { p_household_id: householdId } as any)

    if (error) throw error
    return (data ?? []).map((row: any) => ({
      id: row.id,
      full_name: `${row.first_name} ${row.last_name}`,
    }))
  } catch (err) {
    throw mapError(err, `getAvailablePrimaryContacts(${householdId})`)
  }
}

/**
 * Create a new household.
 * assembly_id is injected from getActiveAssemblyId() — never from form input.
 * Emits 'household:created' after success.
 */
export async function createHousehold(
  payload: Omit<CreateHouseholdPayload, 'assembly_id'>
): Promise<HouseholdView> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) throw new RepositoryError('No active assembly selected.', null, 'NO_ASSEMBLY')

  try {
    const { data, error } = await supabase
      .from('households')
      .insert({ ...payload, assembly_id: assemblyId } as any)
      .select('id')
      .single()

    if (error) throw error

    const id = (data as { id: string }).id
    const household = await getHousehold(id)

    emit('household:created', { id })
    return household
  } catch (err) {
    throw mapError(err, 'createHousehold')
  }
}

/**
 * Update an existing household.
 * Emits 'household:updated' after success.
 */
export async function updateHousehold(
  id: string,
  payload: UpdateHouseholdPayload
): Promise<HouseholdView> {
  try {
    const { error } = await supabase
      .from('households')
      .update(payload as any)
      .eq('id', id)

    if (error) throw error

    const household = await getHousehold(id)
    emit('household:updated', { id })
    return household
  } catch (err) {
    throw mapError(err, `updateHousehold(${id})`)
  }
}

/**
 * Delete a household (hard delete — no soft-delete on households).
 * Emits 'household:deleted' after success.
 * Will fail with FK violation if members still reference this household.
 */
export async function deleteHousehold(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('households')
      .delete()
      .eq('id', id)

    if (error) throw error
    emit('household:deleted', { id })
  } catch (err) {
    throw mapError(err, `deleteHousehold(${id})`)
  }
}

/**
 * Set the primary contact for a household.
 * Shortcut for updateHousehold — used by HouseholdDetail action button.
 */
export async function setPrimaryContact(
  householdId: string,
  memberId: string | null
): Promise<HouseholdView> {
  return updateHousehold(householdId, { primary_contact_id: memberId })
}

/**
 * Subscribe to real-time changes on the `households` table.
 * Called once from module init().
 */
export function subscribeToHouseholds(
  assemblyId: string,
  onUpdate: (type: 'INSERT' | 'UPDATE' | 'DELETE', householdId: string) => void
) {
  return supabase
    .channel(`households:${assemblyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'households',
        filter: `assembly_id=eq.${assemblyId}`,
      },
      (payload) => {
        const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
        const id =
          (payload.new as { id?: string })?.id ??
          (payload.old as { id?: string })?.id ??
          ''
        if (id) onUpdate(eventType, id)
      }
    )
    .subscribe()
}