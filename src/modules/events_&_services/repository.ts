// src/modules/services/repository.ts
// Full repository for the Services module.
// All Supabase calls are isolated here — no UI component calls Supabase directly.

import { supabase }            from '@core/supabase'
import { getActiveAssemblyId } from '@core/auth'
import { emit }                from '@core/events'
import { RepositoryError, DB_ERROR_CODES } from '../../types/common.types'
import type {
  ServiceTemplate,
  CreateServiceTemplatePayload,
  UpdateServiceTemplatePayload,
  ServiceFilter,
  CreateServicePayload,
  UpdateServicePayload,
  ServiceStats,
  ServiceAttendanceWithMember,
  UpsertAttendancePayload,
  ServiceAuditEntry,
  ServiceWithTemplate,
} from '../../types/service.types'
import type { ServiceDisplay, AttendanceDisplay, TemplateDisplay } from './types'

// ── Error mapper ──────────────────────────────────────────────────────────────

function mapError(err: unknown, context: string): RepositoryError {
  const e = err as { code?: string; message?: string }
  const code = e.code ?? 'UNKNOWN'
  let msg = `Something went wrong. Please try again. (${code})`
  if (code === DB_ERROR_CODES.NOT_FOUND)        msg = 'Record not found.'
  if (code === DB_ERROR_CODES.PERMISSION_DENIED) msg = 'You do not have permission to perform this action.'
  if (code === DB_ERROR_CODES.UNIQUE_VIOLATION)  msg = 'A record with these details already exists.'
  if (code !== DB_ERROR_CODES.NOT_FOUND && code !== DB_ERROR_CODES.PERMISSION_DENIED) {
    console.error(`[services/repo] ${context}:`, err)
  }
  return new RepositoryError(msg, err, code)
}

// ── Templates ─────────────────────────────────────────────────────────────────

export async function listServiceTemplates(
  opts: { includeInactive?: boolean } = {}
): Promise<TemplateDisplay[]> {
  try {
    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) return []

    let q = supabase
      .from('service_templates')
      .select('*, groups(name)')
      .eq('assembly_id', assemblyId)
      .is('deleted_at', null)

    if (!opts.includeInactive) q = q.eq('is_active', true)

    const { data, error } = await q.order('title')
    if (error) throw error

    const rows = data ?? []

    // Count instances generated per template
    const ids = rows.map((r: any) => r.id)
    let countMap: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: counts } = await supabase
        .from('services')
        .select('template_id')
        .in('template_id', ids)
        .is('deleted_at', null)
      ;(counts ?? []).forEach((c: any) => {
        countMap[c.template_id] = (countMap[c.template_id] ?? 0) + 1
      })
    }

    return rows.map((r: any) => ({
      ...r,
      group_name:      r.groups?.name ?? null,
      instance_count:  countMap[r.id] ?? 0,
      recurrence_label: buildRecurrenceLabel(r),
    })) as TemplateDisplay[]
  } catch (err) {
    throw mapError(err, 'listServiceTemplates')
  }
}

export async function getServiceTemplate(id: string): Promise<TemplateDisplay> {
  try {
    const { data, error } = await supabase
      .from('service_templates')
      .select('*, groups(name)')
      .eq('id', id)
      .single()
    if (error) throw error
    const r = data as any
    return {
      ...r,
      group_name:      r.groups?.name ?? null,
      instance_count:  0,
      recurrence_label: buildRecurrenceLabel(r),
    } as TemplateDisplay
  } catch (err) {
    throw mapError(err, `getServiceTemplate(${id})`)
  }
}

export async function createServiceTemplate(
  payload: CreateServiceTemplatePayload
): Promise<TemplateDisplay> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) throw new RepositoryError('No active assembly.', null, 'NO_ASSEMBLY')
  try {
    const { data: inserted, error } = await supabase
      .from('service_templates')
      .insert({ ...payload, assembly_id: assemblyId } as any)
      .select('id')
      .single()
    if (error) throw error
    const tmpl = await getServiceTemplate(inserted.id)
    emit('serviceTemplate:created', { id: inserted.id })
    return tmpl
  } catch (err) {
    throw mapError(err, 'createServiceTemplate')
  }
}

export async function updateServiceTemplate(
  id: string,
  payload: UpdateServiceTemplatePayload
): Promise<TemplateDisplay> {
  try {
    const { error } = await supabase
      .from('service_templates')
      .update(payload as any)
      .eq('id', id)
    if (error) throw error
    const tmpl = await getServiceTemplate(id)
    emit('serviceTemplate:updated', { id })
    return tmpl
  } catch (err) {
    throw mapError(err, `updateServiceTemplate(${id})`)
  }
}

export async function softDeleteTemplate(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('service_templates')
      .update({ is_active: false, deleted_at: new Date().toISOString() } as any)
      .eq('id', id)
    if (error) throw error
    emit('serviceTemplate:deleted', { id })
  } catch (err) {
    throw mapError(err, `softDeleteTemplate(${id})`)
  }
}

// ── Services ──────────────────────────────────────────────────────────────────

export async function listServicesDisplay(
  filter?: ServiceFilter,
  opts: { limit?: number; offset?: number } = {}
): Promise<ServiceDisplay[]> {
  try {
    const { limit = 100, offset = 0 } = opts
    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) return []

    let q = supabase
      .from('services')
      .select(`
        *,
        service_templates(title),
        groups(name),
        service_attendance(id, status, deleted_at)
      `)
      .eq('assembly_id', assemblyId)
      .is('deleted_at', null)

    if (filter?.status)      q = q.eq('status', filter.status)
    if (filter?.serviceType) q = q.eq('service_type', filter.serviceType)
    if (filter?.groupId)     q = q.eq('group_id', filter.groupId)
    if (filter?.fromDate)    q = q.gte('service_date', filter.fromDate)
    if (filter?.toDate)      q = q.lte('service_date', filter.toDate)
    if (filter?.searchQuery) q = q.ilike('title', `%${filter.searchQuery.trim()}%`)

    const { data, error } = await q
      .order('service_date', { ascending: false })
      .order('start_time',   { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return (data ?? []).map((row: any) => {
      const att          = (row.service_attendance ?? []).filter((a: any) => !a.deleted_at)
      const presentCount = att.filter((a: any) => a.status === 'present').length
      return {
        ...row,
        template_title:   row.service_templates?.title  ?? null,
        group_name:       row.groups?.name              ?? null,
        attendance_count: att.length,
        present_count:    presentCount,
      }
    }) as ServiceDisplay[]
  } catch (err) {
    throw mapError(err, 'listServicesDisplay')
  }
}

export async function getServiceDisplay(id: string): Promise<ServiceDisplay> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select(`
        *,
        service_templates(title),
        groups(name),
        service_attendance(id, status, deleted_at)
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    const row = data as any
    const att = (row.service_attendance ?? []).filter((a: any) => !a.deleted_at)
    return {
      ...row,
      template_title:   row.service_templates?.title ?? null,
      group_name:       row.groups?.name             ?? null,
      attendance_count: att.length,
      present_count:    att.filter((a: any) => a.status === 'present').length,
    } as ServiceDisplay
  } catch (err) {
    throw mapError(err, `getServiceDisplay(${id})`)
  }
}

export async function createService(payload: CreateServicePayload): Promise<ServiceDisplay> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) throw new RepositoryError('No active assembly.', null, 'NO_ASSEMBLY')
  try {
    const { data: inserted, error } = await supabase
      .from('services')
      .insert({ ...payload, assembly_id: assemblyId } as any)
      .select('id')
      .single()
    if (error) throw error
    const svc = await getServiceDisplay(inserted.id)
    emit('service:created', { id: inserted.id })
    return svc
  } catch (err) {
    throw mapError(err, 'createService')
  }
}

export async function updateService(
  id: string,
  payload: UpdateServicePayload
): Promise<ServiceDisplay> {
  try {
    const { error } = await supabase
      .from('services')
      .update(payload as any)
      .eq('id', id)
    if (error) throw error
    const svc = await getServiceDisplay(id)
    emit('service:updated', { id })
    return svc
  } catch (err) {
    throw mapError(err, `updateService(${id})`)
  }
}

export async function softDeleteService(id: string, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('services')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId } as any)
      .eq('id', id)
    if (error) throw error
    emit('service:deleted', { id })
  } catch (err) {
    throw mapError(err, `softDeleteService(${id})`)
  }
}

export async function getServiceStats(assemblyId: string): Promise<ServiceStats> {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const lastDay  = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

  try {
    const base = () => supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('assembly_id', assemblyId)
      .is('deleted_at', null)

    const [totalR, scheduledR, completedR, cancelledR, thisMonthR] = await Promise.all([
      base(),
      base().eq('status', 'scheduled'),
      base().eq('status', 'completed'),
      base().eq('status', 'cancelled'),
      base().gte('service_date', firstDay).lte('service_date', lastDay),
    ])

    return {
      total:     totalR.count     ?? 0,
      scheduled: scheduledR.count ?? 0,
      completed: completedR.count ?? 0,
      cancelled: cancelledR.count ?? 0,
      thisMonth: thisMonthR.count ?? 0,
    }
  } catch (err) {
    console.error('[services/repo] getServiceStats:', err)
    return { total: 0, scheduled: 0, completed: 0, cancelled: 0, thisMonth: 0 }
  }
}

// ── Attendance ────────────────────────────────────────────────────────────────

export async function listAttendanceDisplay(serviceId: string): Promise<AttendanceDisplay[]> {
  try {
    const { data, error } = await supabase
      .from('service_attendance')
      .select(`
        *,
        members(title, first_name, last_name, membership_number, profile_photo_url,
          group_members(groups(name), is_active, deleted_at))
      `)
      .eq('service_id', serviceId)
      .is('deleted_at', null)
    if (error) throw error

    return (data ?? []).map((row: any) => {
      const m = row.members as any
      const nameParts = [m.title, m.first_name, m.last_name].filter(Boolean)
      const activeGm = (m.group_members ?? []).find((gm: any) => gm.is_active && !gm.deleted_at)
      return {
        ...row,
        member_name:      nameParts.join(' '),
        member_number:    m.membership_number ?? null,
        member_photo_url: m.profile_photo_url ?? null,
        group_name:       activeGm?.groups?.name ?? null,
      }
    }) as AttendanceDisplay[]
  } catch (err) {
    throw mapError(err, `listAttendanceDisplay(${serviceId})`)
  }
}

export async function upsertAttendance(payload: UpsertAttendancePayload): Promise<void> {
  try {
    const { error } = await supabase
      .from('service_attendance')
      .upsert(payload as any, { onConflict: 'service_id,member_id' })
    if (error) throw error
  } catch (err) {
    throw mapError(err, 'upsertAttendance')
  }
}

export async function bulkUpsertAttendance(
  records: UpsertAttendancePayload[]
): Promise<void> {
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

// ── Audit log ─────────────────────────────────────────────────────────────────

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
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', actorIds)
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

// ── Generate from template ────────────────────────────────────────────────────

export async function createServiceFromTemplate(
  templateId: string,
  serviceDate: string
): Promise<ServiceDisplay> {
  const tmpl = await getServiceTemplate(templateId)
  if (!tmpl.is_active) {
    throw new RepositoryError('Cannot create from an inactive template.', null, 'INVALID_STATE')
  }
  return createService({
    template_id:  tmpl.id,
    group_id:     tmpl.group_id,
    title:        tmpl.title,
    service_type: tmpl.service_type,
    service_date: serviceDate,
    start_time:   tmpl.start_time,
    venue:        tmpl.venue,
    status:       'scheduled',
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function buildRecurrenceLabel(r: {
  recurrence: string;
  day_of_week?: string | null;
  start_time?: string | null;
}): string {
  const time = r.start_time
    ? ` at ${formatTime(r.start_time)}`
    : ''
  switch (r.recurrence) {
    case 'none':     return 'One-time'
    case 'daily':    return `Daily${time}`
    case 'weekly':   return r.day_of_week ? `Every ${r.day_of_week}${time}` : `Weekly${time}`
    case 'biweekly': return r.day_of_week ? `Every other ${r.day_of_week}${time}` : `Bi-weekly${time}`
    case 'monthly':  return `Monthly${time}`
    default:         return r.recurrence
  }
}

export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h)) return t
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

export function formatDate(d: string): string {
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateShort(d: string): string {
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function isToday(d: string): boolean {
  return d === new Date().toISOString().split('T')[0]
}

export function isFuture(d: string): boolean {
  return d > new Date().toISOString().split('T')[0]
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