import { supabase } from '@core/supabase'
import { emit } from '@core/events'
import { getActiveAssemblyId } from '@core/auth'
import { RepositoryError } from '../../types/common.types'
import type { UserProfileSummary } from './utils/userProfileCache'
import type { SystemRole } from '../../types/auth.types'

export async function resetMemberPassword(memberId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('reset-member-password', {
    body: { memberId },
  })
  if (error) throw new RepositoryError(
    extractErrorMessage(error, 'Password reset failed'),
    error,
  )
}

export async function deleteMemberAuth(memberId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-member-auth', {
    body: { memberId },
  })
  if (error) throw new RepositoryError(
    extractErrorMessage(error, 'Failed to delete login account'),
    error,
  )
}

export async function setAssemblyDefaultPassword(password: string): Promise<void> {
  const { error } = await supabase.functions.invoke(
    'set-assembly-default-password',
    { body: { password } }
  )
  if (error) throw new RepositoryError(
    extractErrorMessage(error, 'Failed to set default password'),
    error,
  )
}

export async function getAssembly(assemblyId: string) {
  const { data, error } = await supabase
    .from('assemblies')
    .select('id, name, assembly_code, address, default_member_password')
    .eq('id', assemblyId)
    .single()
  if (error) throw new RepositoryError('Failed to load assembly', error)
  return data
}

// Helpers to extract message and code from Supabase FunctionsHttpError
function extractErrorMessage(error: any, fallback: string): string {
  if (error && typeof error === 'object' && 'context' in error) {
    const ctx = (error as any).context
    if (ctx?.error) return ctx.error
  }
  return fallback
}

function extractErrorCode(error: any): string | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    return String((error as any).status)
  }
  return undefined
}

function mapError(err: unknown, ctx: string): RepositoryError {
  if (err instanceof RepositoryError) return err
  const msg = (err as any)?.message ?? String(err)
  console.error(`[admin/${ctx}]`, err)
  return new RepositoryError(msg, err)
}

// ── List all accounts ─────────────────────────────────────────────────────────

/**
 * List all user_profiles for the active assembly,
 * joined with the linked member row for email and member_id.
 * Used by AccountList page and to warm userProfileCache.
 */
export async function listAccounts(assemblyId?: string): Promise<UserProfileSummary[]> {
  const aid = assemblyId ?? getActiveAssemblyId()
  try {
    let query = supabase
      .from('user_profiles')
      .select('id, assembly_id, role, full_name, is_active')

    if (aid) query = (query as any).eq('assembly_id', aid)

    const { data: profiles, error } = await query.order('full_name', { ascending: true })
    if (error) throw error

    if (!profiles || profiles.length === 0) return []

    // Fetch linked member rows in one batch to get email + member_id
    // members.auth_user_id = user_profiles.id (Supabase Auth UID)
    const userIds = (profiles as any[]).map((p: any) => p.id)
    const { data: members } = await supabase
      .from('members')
      .select('auth_user_id, id, email')
      .in('auth_user_id', userIds)

    const memberMap = new Map<string, { memberId: string; email: string | null }>();
    (members ?? []).forEach((m: any) => {
      memberMap.set(m.auth_user_id, { memberId: m.id, email: m.email ?? null })
    })

    return (profiles as any[]).map((p: any) => ({
      id: p.id,
      memberId: memberMap.get(p.id)?.memberId ?? null,
      fullName: p.full_name,
      email: memberMap.get(p.id)?.email ?? null,
      role: p.role as SystemRole,
      isActive: p.is_active,
      assemblyId: p.assembly_id,
    })) satisfies UserProfileSummary[]
  } catch (err) {
    throw mapError(err, 'listAccounts')
  }
}

// ── Single account ────────────────────────────────────────────────────────────

/** Fetch a single user profile by its auth UID (user_profiles.id). */
export async function getAccountById(userId: string): Promise<UserProfileSummary> {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('id, assembly_id, role, full_name, is_active')
      .eq('id', userId)
      .single()

    if (error) throw error

    const p = profile as any

    // One-off member read for email + member_id
    const { data: member } = await supabase
      .from('members')
      .select('id, email')
      .eq('auth_user_id', userId)
      .maybeSingle()

    const m = member as any | null

    return {
      id: p.id,
      memberId: m?.id ?? null,
      fullName: p.full_name,
      email: m?.email ?? null,
      role: p.role as SystemRole,
      isActive: p.is_active,
      assemblyId: p.assembly_id,
    }
  } catch (err) {
    throw mapError(err, `getAccountById(${userId})`)
  }
}

// ── Fetchers for userProfileCache ─────────────────────────────────────────────

/** Single fetcher — wired into initUserProfileCache(). */
export async function fetchUserProfile(id: string): Promise<UserProfileSummary | null> {
  try { return await getAccountById(id) } catch { return null }
}

/** Bulk fetcher — wired into initUserProfileCache(). */
export async function fetchUserProfiles(ids: string[]): Promise<UserProfileSummary[]> {
  if (ids.length === 0) return []
  try {
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, assembly_id, role, full_name, is_active')
      .in('id', ids)

    if (error) return []

    const { data: members } = await supabase
      .from('members')
      .select('auth_user_id, id, email')
      .in('auth_user_id', ids)

    const memberMap = new Map<string, { memberId: string; email: string | null }>();
    (members ?? []).forEach((m: any) => {
      memberMap.set(m.auth_user_id, { memberId: m.id, email: m.email ?? null })
    })

    return (profiles as any[]).map((p: any) => ({
      id: p.id,
      memberId: memberMap.get(p.id)?.memberId ?? null,
      fullName: p.full_name,
      email: memberMap.get(p.id)?.email ?? null,
      role: p.role as SystemRole,
      isActive: p.is_active,
      assemblyId: p.assembly_id,
    }))
  } catch { return [] }
}

// ── Member queries (for Provisioning) ─────────────────────────────────────────

/**
 * Fetch all members in the active assembly who do not yet have an account.
 */
export async function listUnprovisionedMembers(
  assemblyId?: string
): Promise<Array<{ id: string; fullName: string; email: string | null }>> {
  const aid = assemblyId ?? getActiveAssemblyId()
  try {
    let query = supabase
      .from('members')
      .select('id, first_name, last_name, email')
      .is('auth_user_id', null)

    if (aid) query = query.eq('assembly_id', aid)

    const { data, error } = await query.order('first_name', { ascending: true })
    if (error) throw error

    return (data ?? []).map((m: any) => ({
      id: m.id,
      fullName: `${m.first_name} ${m.last_name}`,
      email: m.email ?? null,
    }))
  } catch (err) {
    throw mapError(err, 'listUnprovisionedMembers')
  }
}

/**
 * Fetch minimal member data needed to pre-fill the provision form.
 * This is the only place accounts/ reads from the members table directly.
 * Returns null if the member has not yet been provisioned or not found.
 */
export async function getMemberStub(
  memberId: string
): Promise<{ fullName: string; email: string | null; authUserId: string | null } | null> {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('first_name, last_name, email, auth_user_id')
      .eq('id', memberId)
      .single()

    if (error || !data) return null
    const d = data as any
    return {
      fullName: `${d.first_name} ${d.last_name}`,
      email: d.email ?? null,
      authUserId: d.auth_user_id ?? null,
    }
  } catch {
    return null
  }
}

// ── Role management ───────────────────────────────────────────────────────────

/** Update a user's role. Emits 'account:roleChanged'. */
export async function updateUserRole(userId: string, role: SystemRole): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ role } as any)
      .eq('id', userId)

    if (error) throw error
    emit('account:roleChanged', { userId, role })
  } catch (err) {
    throw mapError(err, `updateUserRole(${userId})`)
  }
}

// ── Account lifecycle ─────────────────────────────────────────────────────────

/** Suspend or reactivate a user account. */
export async function setUserActive(userId: string, active: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: active } as any)
      .eq('id', userId)

    if (error) throw error
    emit(active ? 'account:reactivated' : 'account:suspended', { userId })
  } catch (err) {
    throw mapError(err, `setUserActive(${userId}, ${active})`)
  }
}

// ── Provisioning ──────────────────────────────────────────────────────────────

/**
 * Call the provision-user Edge Function to create a Supabase Auth user
 * and link them to an existing member record.
 * Emits 'account:provisioned' on success.
 */


export async function provisionUser(payload: {
  memberId: string
  role: SystemRole | string
  path: 'invite' | 'default_password' | 'explicit'
  email?: string
  password?: string
}): Promise<{ userId: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'provision-user',
      { body: payload }
    )

    if (error) {
      if (error.context instanceof Response) {
        let body: any
        try {
          body = await error.context.json()
        } catch {
          // JSON parse failed — throw the raw Supabase error as-is
          throw error
        }
        // Throw the real message from the Edge Function response body
        throw new Error(body?.error || body?.message || error.message)
      }
      throw error
    }

    const result = data as { userId?: string }
    if (!result?.userId) throw new Error('Edge Function returned no userId')

    emit('account:provisioned', { memberId: payload.memberId, userId: result.userId })
    return { userId: result.userId }
  } catch (err) {
    throw mapError(err, 'provisionUser')
  }
}

// ── Assembly Roles & Permissions ──────────────────────────────────────────────

export interface AssemblyRole {
  id: string
  assemblyId: string
  name: string
  description: string | null
  permissions: string[]  // array of permission IDs
}

export interface Permission {
  id: string
  description: string | null
}

/**
 * Fetch the system permission catalogue (all rows from public.permissions).
 * Sorted alphabetically by id for consistent display.
 */
export async function listPermissions(): Promise<Permission[]> {
  try {
    const { data, error } = await supabase
      .from('system_permissions')
      .select('id, description')
      .order('id', { ascending: true })
    if (error) throw error
    return (data ?? []).map((p: any) => ({ id: p.id, description: p.description }))
  } catch (err) {
    throw mapError(err, 'listPermissions')
  }
}

/**
 * Fetch all assembly_roles for the active assembly, including
 * their role_permissions as an array of permission IDs.
 */
export async function listAssemblyRoles(assemblyId?: string): Promise<AssemblyRole[]> {
  const aid = assemblyId ?? getActiveAssemblyId()
  try {
    let query = supabase
      .from('assembly_roles')
      .select('id, assembly_id, name, description, role_permissions(permission_key)')
      .order('name', { ascending: true })

    if (aid) query = (query as any).eq('assembly_id', aid)

    const { data, error } = await query
    if (error) throw error

    return (data ?? []).map((r: any) => ({
      id: r.id,
      assemblyId: r.assembly_id,
      name: r.name,
      description: r.description,
      permissions: (r.role_permissions ?? []).map((rp: any) => rp.permission_key),
    }))
  } catch (err) {
    throw mapError(err, 'listAssemblyRoles')
  }
}

/**
 * Create a new assembly role. assemblyId defaults to the active assembly.
 * Returns the created role's id.
 */
export async function createAssemblyRole(payload: {
  name: string
  description?: string
  assemblyId?: string
}): Promise<string> {
  const aid = payload.assemblyId ?? getActiveAssemblyId()
  if (!aid) throw new RepositoryError('No active assembly — cannot create role', undefined)
  try {
    const { data, error } = await supabase
      .from('assembly_roles')
      .insert({ assembly_id: aid, name: payload.name, description: payload.description ?? null } as any)
      .select('id')
      .single()
    if (error) throw error
    return (data as any).id as string
  } catch (err) {
    throw mapError(err, 'createAssemblyRole')
  }
}

/**
 * Update name and/or description of an existing assembly role.
 */
export async function updateAssemblyRole(
  id: string,
  payload: { name?: string; description?: string | null }
): Promise<void> {
  try {
    const { error } = await supabase
      .from('assembly_roles')
      .update(payload as any)
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    throw mapError(err, `updateAssemblyRole(${id})`)
  }
}

/**
 * Delete an assembly role. Cascades to role_permissions and
 * sets user_profiles.assembly_role_id → NULL for affected users.
 */
export async function deleteAssemblyRole(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('assembly_roles')
      .delete()
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    throw mapError(err, `deleteAssemblyRole(${id})`)
  }
}

/**
 * Replace all permission assignments for a role.
 * Deletes existing role_permissions rows then bulk-inserts the new set.
 */
export async function setRolePermissions(
  roleId: string,
  permissionIds: string[]
): Promise<void> {
  try {
    // Delete existing
    const { error: delErr } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
    if (delErr) throw delErr

    if (permissionIds.length === 0) return

    // Insert new
    const rows = permissionIds.map(pid => ({ role_id: roleId, permission_key: pid }))
    const { error: insErr } = await supabase
      .from('role_permissions')
      .insert(rows as any)
    if (insErr) throw insErr
  } catch (err) {
    throw mapError(err, `setRolePermissions(${roleId})`)
  }
}

/**
 * Assign a custom assembly role to a user_profiles row.
 * Pass null to clear the custom role.
 * The JWT sync trigger fires automatically on UPDATE of assembly_role_id.
 * Emits 'account:roleChanged'.
 */
export async function assignRoleToUser(
  userId: string,
  roleId: string | null
): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ assembly_role_id: roleId } as any)
      .eq('id', userId)
    if (error) throw error
    emit('account:roleChanged', { userId, roleId })
  } catch (err) {
    throw mapError(err, `assignRoleToUser(${userId})`)
  }
}
