// src/modules/pastoral/repository.ts
// CRUD + Realtime for the three pastoral care tables.
//
// RULES (mirrors finance/repository.ts conventions):
//   - assembly_id is ALWAYS sourced from getActiveAssemblyId()
//   - All errors are re-thrown as RepositoryError with the raw PostgREST code
//   - Realtime is subscribed once in module init()

import { supabase }            from '@core/supabase'
import { getActiveAssemblyId } from '@core/auth'
import { RepositoryError, DB_ERROR_CODES } from '../../types/common.types'
import type {
  PastoralCase,
  PastoralVisit,
  PrayerRequest,
  PastoralCaseStatus,
  PrayerRequestStatus,
  CreateCasePayload,
  UpdateCasePayload,
  CreateVisitPayload,
  UpdateVisitPayload,
  CreatePrayerRequestPayload,
  UpdatePrayerRequestPayload,
  CaseFilter,
  PrayerRequestFilter,
} from '../../types/pastoral.types'

// ── Error helper ──────────────────────────────────────────────────────────────

function mapError(err: unknown, context: string): RepositoryError {
  const e    = err as { code?: string; message?: string }
  const code = e.code ?? 'UNKNOWN'

  if (code !== DB_ERROR_CODES.NOT_FOUND && code !== DB_ERROR_CODES.PERMISSION_DENIED) {
    console.error(`[pastoral.repository] ${context}:`, err)
  }

  const msg = _errorMessage(code)
  return new RepositoryError(msg, err, code)
}

function _errorMessage(code: string): string {
  switch (code) {
    case DB_ERROR_CODES.NOT_FOUND:         return 'Record not found.'
    case DB_ERROR_CODES.PERMISSION_DENIED: return 'You do not have permission to perform this action.'
    case DB_ERROR_CODES.SESSION_EXPIRED:   return 'Your session has expired. Please log in again.'
    case DB_ERROR_CODES.UNIQUE_VIOLATION:  return 'A record with those details already exists.'
    default:                               return `Something went wrong. Please try again. (Code: ${code})`
  }
}

// ── pastoral_cases ────────────────────────────────────────────────────────────

export async function listCases(filter?: CaseFilter): Promise<PastoralCase[]> {
  try {
    const assemblyId = getActiveAssemblyId()
    let q = supabase
      .from('pastoral_cases')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (assemblyId)          q = q.eq('assembly_id', assemblyId)
    if (filter?.status)      q = q.eq('status', filter.status)
    if (filter?.priority)    q = q.eq('priority', filter.priority)
    if (filter?.case_type)   q = q.eq('case_type', filter.case_type)
    if (filter?.memberId)    q = q.eq('member_id', filter.memberId)
    if (filter?.search)      q = q.ilike('title', `%${filter.search}%`)

    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as PastoralCase[]
  } catch (err) {
    throw mapError(err, 'listCases')
  }
}

export async function getCase(id: string): Promise<PastoralCase> {
  try {
    const { data, error } = await supabase
      .from('pastoral_cases')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as PastoralCase
  } catch (err) {
    throw mapError(err, `getCase(${id})`)
  }
}

export async function createCase(payload: CreateCasePayload): Promise<PastoralCase> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) throw new RepositoryError('No active assembly.', null, 'NO_ASSEMBLY')
  try {
    const { data, error } = await supabase
      .from('pastoral_cases')
      .insert({
        ...payload,
        assembly_id: assemblyId,
        priority:    payload.priority    ?? 'medium',
        is_private:  payload.is_private  ?? true,
      } as any)
      .select()
      .single()
    if (error) throw error
    return data as PastoralCase
  } catch (err) {
    throw mapError(err, 'createCase')
  }
}

export async function updateCase(id: string, payload: UpdateCasePayload): Promise<PastoralCase> {
  try {
    const { data, error } = await supabase
      .from('pastoral_cases')
      .update(payload as any)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as PastoralCase
  } catch (err) {
    throw mapError(err, `updateCase(${id})`)
  }
}

export async function updateCaseStatus(id: string, status: PastoralCaseStatus): Promise<void> {
  try {
    const updates: Record<string, unknown> = { status }
    if (status === 'resolved' || status === 'closed') {
      updates.resolved_at = new Date().toISOString()
    }
    const { error } = await supabase
      .from('pastoral_cases')
      .update(updates as any)
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    throw mapError(err, `updateCaseStatus(${id})`)
  }
}

export async function softDeleteCase(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('pastoral_cases')
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    throw mapError(err, `softDeleteCase(${id})`)
  }
}

// ── pastoral_visits ───────────────────────────────────────────────────────────

export async function listVisits(caseId: string): Promise<PastoralVisit[]> {
  try {
    const { data, error } = await supabase
      .from('pastoral_visits')
      .select('*')
      .eq('case_id', caseId)
      .is('deleted_at', null)
      .order('visit_date', { ascending: false })
    if (error) throw error
    return (data ?? []) as PastoralVisit[]
  } catch (err) {
    throw mapError(err, `listVisits(caseId=${caseId})`)
  }
}

export async function getVisit(id: string): Promise<PastoralVisit> {
  try {
    const { data, error } = await supabase
      .from('pastoral_visits')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as PastoralVisit
  } catch (err) {
    throw mapError(err, `getVisit(${id})`)
  }
}

export async function createVisit(payload: CreateVisitPayload): Promise<PastoralVisit> {
  try {
    const { data, error } = await supabase
      .from('pastoral_visits')
      .insert({
        ...payload,
        outcome: payload.outcome ?? 'positive',
      } as any)
      .select()
      .single()
    if (error) throw error
    return data as PastoralVisit
  } catch (err) {
    throw mapError(err, 'createVisit')
  }
}

export async function updateVisit(id: string, payload: UpdateVisitPayload): Promise<PastoralVisit> {
  try {
    const { data, error } = await supabase
      .from('pastoral_visits')
      .update(payload as any)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as PastoralVisit
  } catch (err) {
    throw mapError(err, `updateVisit(${id})`)
  }
}

export async function softDeleteVisit(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('pastoral_visits')
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    throw mapError(err, `softDeleteVisit(${id})`)
  }
}

// ── prayer_requests ───────────────────────────────────────────────────────────

export async function listPrayerRequests(filter?: PrayerRequestFilter): Promise<PrayerRequest[]> {
  try {
    const assemblyId = getActiveAssemblyId()
    let q = supabase
      .from('prayer_requests')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (assemblyId)          q = q.eq('assembly_id', assemblyId)
    if (filter?.status)      q = q.eq('status', filter.status)
    if (filter?.memberId)    q = q.eq('member_id', filter.memberId)
    if (!filter?.includeAnswered) {
      q = q.eq('is_answered', false)
    }

    const { data, error } = await q
    if (error) throw error

    // Mask member_id for anonymous requests — app-layer privacy guard
    return ((data ?? []) as PrayerRequest[]).map(row => ({
      ...row,
      member_id:   row.is_anonymous ? null : row.member_id,
      member_name: row.is_anonymous ? null : (row as any).member_name ?? null,
    }))
  } catch (err) {
    throw mapError(err, 'listPrayerRequests')
  }
}

export async function getPrayerRequest(id: string): Promise<PrayerRequest> {
  try {
    const { data, error } = await supabase
      .from('prayer_requests')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    const row = data as PrayerRequest
    return {
      ...row,
      member_id: row.is_anonymous ? null : row.member_id,
    }
  } catch (err) {
    throw mapError(err, `getPrayerRequest(${id})`)
  }
}

export async function createPrayerRequest(payload: CreatePrayerRequestPayload): Promise<PrayerRequest> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) throw new RepositoryError('No active assembly.', null, 'NO_ASSEMBLY')
  try {
    const { data, error } = await supabase
      .from('prayer_requests')
      .insert({
        ...payload,
        assembly_id:  assemblyId,
        is_anonymous: payload.is_anonymous ?? false,
        // Do not store member_id when anonymous
        member_id: payload.is_anonymous ? null : (payload.member_id ?? null),
      } as any)
      .select()
      .single()
    if (error) throw error
    return data as PrayerRequest
  } catch (err) {
    throw mapError(err, 'createPrayerRequest')
  }
}

export async function updatePrayerRequest(
  id: string,
  payload: UpdatePrayerRequestPayload,
): Promise<PrayerRequest> {
  try {
    const updates: Record<string, unknown> = { ...payload }
    if (payload.is_answered && !payload.answered_at) {
      updates.answered_at = new Date().toISOString()
      updates.status      = 'answered'
    }
    const { data, error } = await supabase
      .from('prayer_requests')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as PrayerRequest
  } catch (err) {
    throw mapError(err, `updatePrayerRequest(${id})`)
  }
}

export async function updatePrayerRequestStatus(
  id: string,
  status: PrayerRequestStatus,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('prayer_requests')
      .update({ status } as any)
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    throw mapError(err, `updatePrayerRequestStatus(${id})`)
  }
}

export async function softDeletePrayerRequest(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('prayer_requests')
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    throw mapError(err, `softDeletePrayerRequest(${id})`)
  }
}

// ── Realtime ──────────────────────────────────────────────────────────────────

/**
 * Subscribe to changes on pastoral_cases for the active assembly.
 * Returns a RealtimeChannel — call .unsubscribe() in module dispose().
 */
export function subscribeToCases(
  assemblyId: string,
  onUpdate: (type: 'INSERT' | 'UPDATE' | 'DELETE', id: string) => void,
) {
  return supabase
    .channel(`pastoral_cases:${assemblyId}`)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'pastoral_cases',
        filter: `assembly_id=eq.${assemblyId}`,
      },
      payload => {
        const event = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
        const id =
          (payload.new as { id?: string })?.id ??
          (payload.old as { id?: string })?.id ?? ''
        if (id) onUpdate(event, id)
      },
    )
    .subscribe()
}
