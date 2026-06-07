// src/modules/membership/groups.repository.ts
// CRUD + Realtime for the `groups` and `group_members` tables.
//
// RULES (mirrors membership/repository.ts conventions):
//   - assembly_id is ALWAYS sourced from getActiveAssemblyId() — never from form input
//   - All errors are re-thrown as RepositoryError with the raw PostgREST code preserved
//   - After any write, emit the appropriate event for cache invalidation
//   - Realtime is subscribed once in module init(), NOT in page render()

import { supabase }            from '@core/supabase'
import { getActiveAssemblyId } from '@core/auth'
import { emit }                from '@core/events'
import { RepositoryError, DB_ERROR_CODES } from '../../types/common.types'
import type {
  Group,
  GroupMemberWithMember,
  GroupFilter,
  GroupType,
  GroupMemberRole,
  CreateGroupPayload,
  UpdateGroupPayload,
} from '../../types/group.types'
import type { GroupSummary } from './utils/groupCache'

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapError(err: unknown, context: string): RepositoryError {
  const e    = err as { code?: string; message?: string; details?: string }
  const code = e.code ?? 'UNKNOWN'

  if (code !== DB_ERROR_CODES.NOT_FOUND && code !== DB_ERROR_CODES.PERMISSION_DENIED) {
    console.error(`[groups.repository] ${context}:`, err)
  }

  const message = _errorMessage(code)
  return new RepositoryError(message, err, code)
}

function _errorMessage(code: string): string {
  switch (code) {
    case DB_ERROR_CODES.NOT_FOUND:        return 'Group not found.'
    case DB_ERROR_CODES.PERMISSION_DENIED: return 'You do not have permission to perform this action.'
    case DB_ERROR_CODES.SESSION_EXPIRED:   return 'Your session has expired. Please log in again.'
    case DB_ERROR_CODES.UNIQUE_VIOLATION:  return 'A group with this name already exists.'
    default:                               return `Something went wrong. Please try again. (Code: ${code})`
  }
}

/** Resolve a leader name from members_view for a given member ID. */
async function _resolveLeaderName(leaderId: string | null): Promise<string | null> {
  if (!leaderId) return null
  try {
    const { data } = await supabase
      .from('members_view')
      .select('first_name, last_name')
      .eq('id', leaderId)
      .maybeSingle()
    if (!data) return null
    const d = data as { first_name: string | null; last_name: string | null }
    return [d.first_name, d.last_name].filter(Boolean).join(' ') || null
  } catch {
    return null
  }
}

// ── GROUPS ────────────────────────────────────────────────────────────────────

/**
 * List groups for the active assembly.
 * Includes live member_count via a join and resolves leader names in a single batch.
 */
export async function listGroups(filter?: GroupFilter): Promise<Group[]> {
  try {
    const assemblyId = getActiveAssemblyId()

    let query = supabase
      .from('groups')
      .select('*, group_members(count)')

    if (assemblyId) query = query.eq('assembly_id', assemblyId)

    if (filter?.type) {
      query = query.eq('group_type', filter.type)
    }
    if (filter?.search) {
      query = query.ilike('name', `%${filter.search}%`)
    }
    if (!filter?.includeDeleted) {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query.order('name', { ascending: true })
    if (error) throw error

    const rows = (data ?? []) as any[]

    // Batch-resolve leader names
    const leaderIds = [...new Set(rows.map((r) => r.leader_id).filter(Boolean))] as string[]
    const leaderMap = new Map<string, string>()
    if (leaderIds.length > 0) {
      const { data: leaders } = await supabase
        .from('members_view')
        .select('id, first_name, last_name')
        .in('id', leaderIds)
      ;(leaders ?? []).forEach((l: any) => {
        leaderMap.set(l.id, [l.first_name, l.last_name].filter(Boolean).join(' '))
      })
    }

    return rows.map((row) => ({
      id:           row.id          as string,
      assembly_id:  row.assembly_id as string,
      name:         row.name        as string,
      group_type:   row.group_type  as GroupType,
      description:  row.description as string | null,
      is_active:    row.is_active   as boolean,
      leader_id:    row.leader_id   as string | null,
      created_by:   row.created_by  as string | null,
      created_at:   row.created_at  as string,
      deleted_at:   row.deleted_at  as string | null,
      deleted_by:   row.deleted_by  as string | null,
      member_count: (row.group_members as { count: number }[])?.[0]?.count ?? 0,
      leader_name:  row.leader_id ? (leaderMap.get(row.leader_id) ?? null) : null,
    })) satisfies Group[]
  } catch (err) {
    throw mapError(err, 'listGroups')
  }
}

/**
 * Fetch a single group by ID with leader name resolved.
 */
export async function getGroup(id: string): Promise<Group> {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('*, group_members(count)')
      .eq('id', id)
      .single()

    if (error) throw error

    const row = data as any
    const leaderName = await _resolveLeaderName(row.leader_id)

    return {
      id:           row.id          as string,
      assembly_id:  row.assembly_id as string,
      name:         row.name        as string,
      group_type:   row.group_type  as GroupType,
      description:  row.description as string | null,
      is_active:    row.is_active   as boolean,
      leader_id:    row.leader_id   as string | null,
      created_by:   row.created_by  as string | null,
      created_at:   row.created_at  as string,
      deleted_at:   row.deleted_at  as string | null,
      deleted_by:   row.deleted_by  as string | null,
      member_count: (row.group_members as { count: number }[])?.[0]?.count ?? 0,
      leader_name:  leaderName,
    }
  } catch (err) {
    throw mapError(err, `getGroup(${id})`)
  }
}

/**
 * Insert a new group for the active assembly.
 * Emits 'group:created' on success.
 */
export async function createGroup(payload: CreateGroupPayload): Promise<Group> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) throw new RepositoryError('No active assembly selected.', null, 'NO_ASSEMBLY')

  try {
    const { data: inserted, error } = await supabase
      .from('groups')
      .insert({
        assembly_id:  assemblyId,
        name:         payload.name,
        group_type:   payload.group_type,
        description:  payload.description ?? null,
        leader_id:    payload.leader_id   ?? null,
      })
      .select('id')
      .single()

    if (error) throw error

    const id = (inserted as { id: string }).id
    const group = await getGroup(id)
    emit('group:created', { id })
    return group
  } catch (err) {
    throw mapError(err, 'createGroup')
  }
}

/**
 * Patch an existing group. Only sends changed keys.
 * Emits 'group:updated' on success.
 */
export async function updateGroup(id: string, payload: UpdateGroupPayload): Promise<Group> {
  try {
    const { error } = await supabase
      .from('groups')
      .update(payload as any)
      .eq('id', id)

    if (error) throw error

    const group = await getGroup(id)
    emit('group:updated', { id })
    return group
  } catch (err) {
    throw mapError(err, `updateGroup(${id})`)
  }
}

/**
 * Soft-delete a group by setting deleted_at = now().
 * Emits 'group:deleted' on success.
 */
export async function softDeleteGroup(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('groups')
      .update({ deleted_at: new Date().toISOString(), is_active: false } as any)
      .eq('id', id)

    if (error) throw error
    emit('group:deleted', { id })
  } catch (err) {
    throw mapError(err, `softDeleteGroup(${id})`)
  }
}

// ── GROUP MEMBERS ─────────────────────────────────────────────────────────────

/**
 * List active members of a group, joined with name and photo from members_view.
 */
export async function listGroupMembers(groupId: string): Promise<GroupMemberWithMember[]> {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('joined_at', { ascending: true })

    if (error) throw error

    const rows = (data ?? []) as any[]
    if (rows.length === 0) return []

    // Batch resolve member names + photos
    const memberIds = rows.map((r) => r.member_id as string)
    const { data: members } = await supabase
      .from('members_view')
      .select('id, first_name, last_name, profile_photo_url')
      .in('id', memberIds)

    const memberMap = new Map<string, { name: string; photo: string | null }>()
    ;(members ?? []).forEach((m: any) => {
      memberMap.set(m.id, {
        name:  [m.first_name, m.last_name].filter(Boolean).join(' '),
        photo: m.profile_photo_url,
      })
    })

    return rows.map((row) => ({
      id:               row.id        as string,
      group_id:         row.group_id  as string,
      member_id:        row.member_id as string,
      role:             row.role      as GroupMemberRole,
      joined_at:        row.joined_at as string,
      left_at:          row.left_at   as string | null,
      is_active:        row.is_active as boolean,
      created_by:       row.created_by as string | null,
      created_at:       row.created_at as string,
      deleted_at:       row.deleted_at as string | null,
      deleted_by:       row.deleted_by as string | null,
      member_name:      memberMap.get(row.member_id)?.name  ?? row.member_id,
      member_photo_url: memberMap.get(row.member_id)?.photo ?? null,
    })) satisfies GroupMemberWithMember[]
  } catch (err) {
    throw mapError(err, `listGroupMembers(${groupId})`)
  }
}

/**
 * Upsert a member into a group with the given role.
 * If the member already has an active (or soft-deleted) row it is updated/restored.
 */
export async function assignGroupMember(
  groupId:  string,
  memberId: string,
  role:     GroupMemberRole
): Promise<void> {
  try {
    const { error } = await supabase
      .from('group_members')
      .upsert(
        {
          group_id:   groupId,
          member_id:  memberId,
          role,
          is_active:  true,
          deleted_at: null,
          joined_at:  new Date().toISOString(),
        } as any,
        { onConflict: 'group_id,member_id' }
      )

    if (error) throw error
    emit('group:updated', { id: groupId })
  } catch (err) {
    throw mapError(err, `assignGroupMember(${groupId}, ${memberId})`)
  }
}

/**
 * Remove a member from a group (soft delete the group_members row).
 */
export async function removeGroupMember(groupId: string, memberId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('group_members')
      .update({ is_active: false, deleted_at: new Date().toISOString() } as any)
      .eq('group_id', groupId)
      .eq('member_id', memberId)

    if (error) throw error
    emit('group:updated', { id: groupId })
  } catch (err) {
    throw mapError(err, `removeGroupMember(${groupId}, ${memberId})`)
  }
}

// ── Realtime ──────────────────────────────────────────────────────────────────

/**
 * Subscribe to real-time changes on the `groups` table for the active assembly.
 * Returns a RealtimeChannel — call .unsubscribe() in module dispose().
 */
export function subscribeToGroups(
  assemblyId: string,
  onUpdate: (type: 'INSERT' | 'UPDATE' | 'DELETE', groupId: string) => void
) {
  return supabase
    .channel(`groups:${assemblyId}`)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'groups',
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

// ── GroupCache fetchers ───────────────────────────────────────────────────────

/**
 * Single-item fetcher for groupCache.
 * Returns null if the group is not found.
 */
export async function fetchGroupSummary(id: string): Promise<GroupSummary | null> {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, group_type, leader_id, assembly_id, group_members(count)')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !data) return null
    const row = data as any
    const leaderName = await _resolveLeaderName(row.leader_id)

    return {
      id:           row.id          as string,
      name:         row.name        as string,
      type:         row.group_type  as string,
      leader_name:  leaderName,
      member_count: (row.group_members as { count: number }[])?.[0]?.count ?? 0,
      assembly_id:  row.assembly_id as string,
    }
  } catch {
    return null
  }
}

/**
 * Bulk fetcher for groupCache.
 */
export async function fetchGroupSummaries(ids: string[]): Promise<GroupSummary[]> {
  if (ids.length === 0) return []
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, group_type, leader_id, assembly_id, group_members(count)')
      .in('id', ids)
      .is('deleted_at', null)

    if (error || !data) return []
    const rows = data as any[]

    // Batch leader resolution
    const leaderIds = [...new Set(rows.map((r) => r.leader_id).filter(Boolean))] as string[]
    const leaderMap = new Map<string, string>()
    if (leaderIds.length > 0) {
      const { data: leaders } = await supabase
        .from('members_view')
        .select('id, first_name, last_name')
        .in('id', leaderIds)
      ;(leaders ?? []).forEach((l: any) => {
        leaderMap.set(l.id, [l.first_name, l.last_name].filter(Boolean).join(' '))
      })
    }

    return rows.map((row) => ({
      id:           row.id          as string,
      name:         row.name        as string,
      type:         row.group_type  as string,
      leader_name:  row.leader_id ? (leaderMap.get(row.leader_id) ?? null) : null,
      member_count: (row.group_members as { count: number }[])?.[0]?.count ?? 0,
      assembly_id:  row.assembly_id as string,
    }))
  } catch {
    return []
  }
}
