// src/modules/services/repository.ts
import { supabase } from '@core/supabase'
import { getActiveAssemblyId } from '@core/auth'
import { emit } from '@core/events'
import { RepositoryError, DB_ERROR_CODES } from '../../types/common.types'
import type {
  ServiceTemplate,
  CreateServiceTemplatePayload,
  UpdateServiceTemplatePayload,
  ServiceWithTemplate,
  ServiceFilter,
  CreateServicePayload,
  UpdateServicePayload,
  ServiceStats,
  ServiceAttendanceWithMember,
  UpsertAttendancePayload,
  ServiceAuditEntry
} from '../../types/service.types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapError(err: unknown, context: string): RepositoryError {
  const e = err as { code?: string; message?: string; details?: string }
  const code = e.code ?? 'UNKNOWN'
  
  let message = `Something went wrong. Please try again. (Code: ${code})`
  if (code === DB_ERROR_CODES.NOT_FOUND) message = 'Record not found.'
  else if (code === DB_ERROR_CODES.PERMISSION_DENIED) message = 'You do not have permission to perform this action.'
  else if (code === DB_ERROR_CODES.UNIQUE_VIOLATION) message = 'A record with these details already exists.'

  if (code !== DB_ERROR_CODES.NOT_FOUND && code !== DB_ERROR_CODES.PERMISSION_DENIED) {
    console.error(`[services/repository Error] ${context}:`, err)
  }
  
  return new RepositoryError(message, err, code)
}

// ── ─────────────────────────────────────────────────────────────────────────
// TEMPLATES
// ── ─────────────────────────────────────────────────────────────────────────

export async function listServiceTemplates(filter?: { includeDeleted?: boolean }): Promise<ServiceTemplate[]> {
  try {
    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) return []

    let query = supabase.from('service_templates').select('*').eq('assembly_id', assemblyId)
    if (!filter?.includeDeleted) {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query.order('title')
    if (error) throw error
    return data as ServiceTemplate[]
  } catch (err) {
    throw mapError(err, 'listServiceTemplates')
  }
}

export async function getServiceTemplate(id: string): Promise<ServiceTemplate> {
  try {
    const { data, error } = await supabase.from('service_templates').select('*').eq('id', id).single()
    if (error) throw error
    return data as ServiceTemplate
  } catch (err) {
    throw mapError(err, `getServiceTemplate(${id})`)
  }
}

export async function createServiceTemplate(payload: CreateServiceTemplatePayload): Promise<ServiceTemplate> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) throw new RepositoryError('No active assembly selected.', null, 'NO_ASSEMBLY')

  try {
    const { data: inserted, error } = await supabase
      .from('service_templates')
      .insert({ ...payload, assembly_id: assemblyId } as any)
      .select('id')
      .single()

    if (error) throw error

    const template = await getServiceTemplate(inserted.id)
    emit('serviceTemplate:created', { id: inserted.id })
    return template
  } catch (err) {
    throw mapError(err, 'createServiceTemplate')
  }
}

export async function updateServiceTemplate(id: string, payload: UpdateServiceTemplatePayload): Promise<ServiceTemplate> {
  try {
    const { error } = await supabase.from('service_templates').update(payload as any).eq('id', id)
    if (error) throw error

    const template = await getServiceTemplate(id)
    emit('serviceTemplate:updated', { id })
    return template
  } catch (err) {
    throw mapError(err, `updateServiceTemplate(${id})`)
  }
}

export async function deactivateServiceTemplate(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('service_templates')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
      } as any)
      .eq('id', id)

    if (error) throw error
    emit('serviceTemplate:deleted', { id })
  } catch (err) {
    throw mapError(err, `deactivateServiceTemplate(${id})`)
  }
}

// ── ─────────────────────────────────────────────────────────────────────────
// SERVICES
// ── ─────────────────────────────────────────────────────────────────────────

export async function listServices(filter?: ServiceFilter, opts: { limit?: number; offset?: number } = {}): Promise<ServiceWithTemplate[]> {
  try {
    const { limit = 50, offset = 0 } = opts
    
    let query = supabase
      .from('services')
      .select('*, service_templates(title)')

    const f = filter
    if (f) {
      if (f.status) query = query.eq('status', f.status)
      if (f.serviceType) query = query.eq('service_type', f.serviceType)
      if (f.groupId) query = query.eq('group_id', f.groupId)
      if (f.templateId) query = query.eq('template_id', f.templateId)
      if (f.fromDate) query = query.gte('service_date', f.fromDate)
      if (f.toDate) query = query.lte('service_date', f.toDate)
      if (f.searchQuery) query = query.ilike('title', `%${f.searchQuery.trim()}%`)
      if (!f.includeDeleted) query = query.is('deleted_at', null)
    } else {
      query = query.is('deleted_at', null)
    }

    const activeAssembly = getActiveAssemblyId()
    if (activeAssembly) {
      query = query.eq('assembly_id', activeAssembly)
    }

    const { data, error } = await query
      .order('service_date', { ascending: false })
      .order('start_time', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    
    return (data ?? []).map((row: any) => ({
      ...row,
      template_title: row.service_templates?.title ?? null
    })) as ServiceWithTemplate[]
  } catch (err) {
    throw mapError(err, 'listServices')
  }
}

export async function getService(id: string): Promise<ServiceWithTemplate> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*, service_templates(title)')
      .eq('id', id)
      .single()

    if (error) throw error
    
    const row = data as any
    return {
      ...row,
      template_title: row.service_templates?.title ?? null
    } as ServiceWithTemplate
  } catch (err) {
    throw mapError(err, `getService(${id})`)
  }
}

export async function getServiceStats(): Promise<ServiceStats> {
  const assemblyId = getActiveAssemblyId()
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

  try {
    let baseQuery = supabase.from('services').select('*', { count: 'exact', head: true }).is('deleted_at', null)
    if (assemblyId) baseQuery = baseQuery.eq('assembly_id', assemblyId)

    const thisMonthQuery = baseQuery.gte('service_date', firstDay).lte('service_date', lastDay)

    const [total, scheduled, completed, cancelled, thisMonth] = await Promise.all([
      baseQuery.then(r => r.count ?? 0),
      baseQuery.eq('status', 'scheduled').then(r => r.count ?? 0),
      baseQuery.eq('status', 'completed').then(r => r.count ?? 0),
      baseQuery.eq('status', 'cancelled').then(r => r.count ?? 0),
      thisMonthQuery.then(r => r.count ?? 0),
    ])

    return { total, scheduled, completed, cancelled, thisMonth }
  } catch (err) {
    console.error('[services/repository] Failed to fetch service stats:', err)
    return { total: 0, scheduled: 0, completed: 0, cancelled: 0, thisMonth: 0 }
  }
}

export async function createService(payload: CreateServicePayload): Promise<ServiceWithTemplate> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) throw new RepositoryError('No active assembly selected.', null, 'NO_ASSEMBLY')

  try {
    const { data: inserted, error } = await supabase
      .from('services')
      .insert({ ...payload, assembly_id: assemblyId } as any)
      .select('id')
      .single()

    if (error) throw error

    const service = await getService(inserted.id)
    emit('service:created', { id: inserted.id })
    return service
  } catch (err) {
    throw mapError(err, 'createService')
  }
}

export async function updateService(id: string, payload: UpdateServicePayload): Promise<ServiceWithTemplate> {
  try {
    const { error } = await supabase.from('services').update(payload as any).eq('id', id)
    if (error) throw error

    const service = await getService(id)
    emit('service:updated', { id })
    return service
  } catch (err) {
    throw mapError(err, `updateService(${id})`)
  }
}

export async function deactivateService(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('services')
      .update({
        deleted_at: new Date().toISOString(),
      } as any)
      .eq('id', id)

    if (error) throw error
    emit('service:deleted', { id })
  } catch (err) {
    throw mapError(err, `deactivateService(${id})`)
  }
}

// ── ─────────────────────────────────────────────────────────────────────────
// ATTENDANCE
// ── ─────────────────────────────────────────────────────────────────────────

export async function listAttendance(serviceId: string): Promise<ServiceAttendanceWithMember[]> {
  try {
    const { data, error } = await supabase
      .from('service_attendance')
      .select(`
        *,
        members(title, first_name, last_name, profile_photo_url)
      `)
      .eq('service_id', serviceId)
      .is('deleted_at', null)

    if (error) throw error
    
    return (data ?? []).map((row: any) => {
      const m = row.members as any
      const nameParts = [m.title, m.first_name, m.last_name].filter(Boolean)
      return {
        ...row,
        member_name: nameParts.join(' '),
        member_photo_url: m.profile_photo_url ?? null
      }
    }) as ServiceAttendanceWithMember[]
  } catch (err) {
    throw mapError(err, `listAttendance(${serviceId})`)
  }
}

export async function upsertAttendance(payload: UpsertAttendancePayload): Promise<void> {
  try {
    const { error } = await supabase
      .from('service_attendance')
      .upsert(
        { ...payload } as any,
        { onConflict: 'service_id,member_id' }
      )

    if (error) throw error
  } catch (err) {
    throw mapError(err, 'upsertAttendance')
  }
}

export async function bulkUpsertAttendance(records: UpsertAttendancePayload[]): Promise<void> {
  if (records.length === 0) return
  try {
    const { error } = await supabase
      .from('service_attendance')
      .upsert(records as any, { onConflict: 'service_id,member_id' })
    if (error) throw error
  } catch (err) {
    throw mapError(err, 'bulkUpsertAttendance')
  }
}

// ── ─────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// ── ─────────────────────────────────────────────────────────────────────────

export async function getServiceAuditLog(serviceId: string): Promise<ServiceAuditEntry[]> {
  try {
    const { data, error } = await supabase
      .from('service_audit_log')
      .select('*')
      .eq('service_id', serviceId)
      .order('changed_at', { ascending: false })

    if (error) throw error

    const actorIds = [...new Set((data ?? []).map((r: any) => r.changed_by).filter(Boolean))] as string[]
    const actorMap = new Map<string, string>()
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', actorIds)
      ;(profiles ?? []).forEach((p: any) => actorMap.set(p.id, p.full_name))
    }

    return (data ?? []).map((row: any) => ({
      ...row,
      changed_by_name: actorMap.get(row.changed_by) ?? null,
    })) as ServiceAuditEntry[]
  } catch (err) {
    throw mapError(err, `getServiceAuditLog(${serviceId})`)
  }
}

// ── ─────────────────────────────────────────────────────────────────────────
// REALTIME
// ── ─────────────────────────────────────────────────────────────────────────

export function subscribeToServices(
  assemblyId: string,
  onUpdate: (type: 'INSERT' | 'UPDATE' | 'DELETE', serviceId: string) => void
) {
  return supabase
    .channel(`services:${assemblyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'services',
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
