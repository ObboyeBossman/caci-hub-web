// src/modules/finance/repository.ts
// CRUD + Realtime for the four finance tables.
//
// RULES (mirrors membership/repository.ts conventions):
//   - assembly_id is ALWAYS sourced from getActiveAssemblyId()
//   - All errors are re-thrown as RepositoryError with the raw PostgREST code
//   - Realtime is subscribed once in module init()

import { supabase }            from '@core/supabase'
import { getActiveAssemblyId } from '@core/auth'
import { RepositoryError, DB_ERROR_CODES } from '../../types/common.types'
import type {
  FinanceTransaction,
  FinancePledge,
  FinanceBudget,
  FinanceCategoryRow,
  FinanceCategoryType,
  FinancePledgeStatus,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  CreateTransactionPayload,
  UpdateTransactionPayload,
  CreatePledgePayload,
  UpdatePledgePayload,
  CreateBudgetPayload,
  UpdateBudgetPayload,
  TransactionFilter,
  PledgeFilter,
} from '../../types/finance.types'

// ── Error helper ──────────────────────────────────────────────────────────────

function mapError(err: unknown, context: string): RepositoryError {
  const e    = err as { code?: string; message?: string }
  const code = e.code ?? 'UNKNOWN'

  if (code !== DB_ERROR_CODES.NOT_FOUND && code !== DB_ERROR_CODES.PERMISSION_DENIED) {
    console.error(`[finance.repository] ${context}:`, err)
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

// ── finance_categories ────────────────────────────────────────────────────────

export async function listCategories(type?: FinanceCategoryType): Promise<FinanceCategoryRow[]> {
  try {
    const assemblyId = getActiveAssemblyId()
    let q = supabase
      .from('finance_categories')
      .select('*')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name', { ascending: true })
    if (assemblyId) q = q.eq('assembly_id', assemblyId)
    if (type)       q = q.eq('category_type', type)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as FinanceCategoryRow[]
  } catch (err) {
    throw mapError(err, 'listCategories')
  }
}

export async function createCategory(payload: CreateCategoryPayload): Promise<FinanceCategoryRow> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) throw new RepositoryError('No active assembly.', null, 'NO_ASSEMBLY')
  try {
    const { data, error } = await supabase
      .from('finance_categories')
      .insert({ ...payload, assembly_id: assemblyId } as any)
      .select()
      .single()
    if (error) throw error
    return data as FinanceCategoryRow
  } catch (err) {
    throw mapError(err, 'createCategory')
  }
}

export async function updateCategory(id: string, payload: UpdateCategoryPayload): Promise<FinanceCategoryRow> {
  try {
    const { data, error } = await supabase
      .from('finance_categories')
      .update(payload as any)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as FinanceCategoryRow
  } catch (err) {
    throw mapError(err, `updateCategory(${id})`)
  }
}

export async function softDeleteCategory(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('finance_categories')
      .update({ deleted_at: new Date().toISOString(), is_active: false } as any)
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    throw mapError(err, `softDeleteCategory(${id})`)
  }
}

// ── finance_transactions ──────────────────────────────────────────────────────

export async function listTransactions(filter?: TransactionFilter): Promise<FinanceTransaction[]> {
  try {
    const assemblyId = getActiveAssemblyId()
    let q = supabase
      .from('finance_transactions')
      .select('*, finance_categories(name, category_type)')
      .is('deleted_at', null)
      .order('transaction_date', { ascending: false })
    if (assemblyId) q = q.eq('assembly_id', assemblyId)
    if (filter?.categoryId)     q = q.eq('category_id', filter.categoryId)
    if (filter?.memberIdFilter) q = q.eq('member_id', filter.memberIdFilter)
    if (filter?.type)           q = q.eq('transaction_type', filter.type)
    if (filter?.dateFrom)       q = q.gte('transaction_date', filter.dateFrom)
    if (filter?.dateTo)         q = q.lte('transaction_date', filter.dateTo)
    if (filter?.search) {
      q = q.or(`description.ilike.%${filter.search}%,reference_number.ilike.%${filter.search}%`)
    }
    const { data, error } = await q
    if (error) throw error
    return ((data ?? []) as any[]).map(row => ({
      ...row,
      category_name: row.finance_categories?.name ?? null,
      category_type: row.finance_categories?.category_type ?? null,
      finance_categories: undefined,
    })) as FinanceTransaction[]
  } catch (err) {
    throw mapError(err, 'listTransactions')
  }
}

export async function getTransaction(id: string): Promise<FinanceTransaction> {
  try {
    const { data, error } = await supabase
      .from('finance_transactions')
      .select('*, finance_categories(name, category_type)')
      .eq('id', id)
      .single()
    if (error) throw error
    const row = data as any
    return {
      ...row,
      category_name: row.finance_categories?.name ?? null,
      category_type: row.finance_categories?.category_type ?? null,
      finance_categories: undefined,
    } as FinanceTransaction
  } catch (err) {
    throw mapError(err, `getTransaction(${id})`)
  }
}

export async function createTransaction(payload: CreateTransactionPayload): Promise<FinanceTransaction> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) throw new RepositoryError('No active assembly.', null, 'NO_ASSEMBLY')
  try {
    const { data, error } = await supabase
      .from('finance_transactions')
      .insert({
        ...payload,
        assembly_id:      assemblyId,
        transaction_date: payload.transaction_date ?? new Date().toISOString().split('T')[0],
        currency:         payload.currency ?? 'GHS',
      } as any)
      .select()
      .single()
    if (error) throw error
    return getTransaction((data as any).id)
  } catch (err) {
    throw mapError(err, 'createTransaction')
  }
}

export async function updateTransaction(id: string, payload: UpdateTransactionPayload): Promise<FinanceTransaction> {
  try {
    const { error } = await supabase
      .from('finance_transactions')
      .update(payload as any)
      .eq('id', id)
    if (error) throw error
    return getTransaction(id)
  } catch (err) {
    throw mapError(err, `updateTransaction(${id})`)
  }
}

export async function softDeleteTransaction(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('finance_transactions')
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    throw mapError(err, `softDeleteTransaction(${id})`)
  }
}

// ── finance_pledges ───────────────────────────────────────────────────────────

export async function listPledges(filter?: PledgeFilter): Promise<FinancePledge[]> {
  try {
    const assemblyId = getActiveAssemblyId()
    let q = supabase
      .from('finance_pledges')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (assemblyId)       q = q.eq('assembly_id', assemblyId)
    if (filter?.memberId) q = q.eq('member_id', filter.memberId)
    if (filter?.status)   q = q.eq('status', filter.status)
    const { data, error } = await q
    if (error) throw error
    return ((data ?? []) as any[]).map(row => ({
      ...row,
      fulfilment_pct: row.total_amount > 0
        ? Math.round((row.amount_paid / row.total_amount) * 100)
        : 0,
    })) as FinancePledge[]
  } catch (err) {
    throw mapError(err, 'listPledges')
  }
}

export async function createPledge(payload: CreatePledgePayload): Promise<FinancePledge> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) throw new RepositoryError('No active assembly.', null, 'NO_ASSEMBLY')
  try {
    const { data, error } = await supabase
      .from('finance_pledges')
      .insert({
        ...payload,
        assembly_id: assemblyId,
        currency:    payload.currency ?? 'GHS',
        start_date:  payload.start_date ?? new Date().toISOString().split('T')[0],
      } as any)
      .select()
      .single()
    if (error) throw error
    const row = data as any
    return { ...row, fulfilment_pct: 0 } as FinancePledge
  } catch (err) {
    throw mapError(err, 'createPledge')
  }
}

export async function updatePledge(id: string, payload: UpdatePledgePayload): Promise<FinancePledge> {
  try {
    const { data, error } = await supabase
      .from('finance_pledges')
      .update(payload as any)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const row = data as any
    return {
      ...row,
      fulfilment_pct: row.total_amount > 0
        ? Math.round((row.amount_paid / row.total_amount) * 100)
        : 0,
    } as FinancePledge
  } catch (err) {
    throw mapError(err, `updatePledge(${id})`)
  }
}

export async function updatePledgeStatus(id: string, status: FinancePledgeStatus): Promise<void> {
  try {
    const { error } = await supabase
      .from('finance_pledges')
      .update({ status } as any)
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    throw mapError(err, `updatePledgeStatus(${id})`)
  }
}

export async function softDeletePledge(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('finance_pledges')
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    throw mapError(err, `softDeletePledge(${id})`)
  }
}

// ── finance_budgets ───────────────────────────────────────────────────────────

export async function listBudgets(year?: number): Promise<FinanceBudget[]> {
  try {
    const assemblyId = getActiveAssemblyId()
    let q = supabase
      .from('finance_budgets')
      .select('*, finance_categories(name, category_type)')
      .is('deleted_at', null)
      .order('year', { ascending: false })
    if (assemblyId) q = q.eq('assembly_id', assemblyId)
    if (year)       q = q.eq('year', year)
    const { data, error } = await q
    if (error) throw error
    return ((data ?? []) as any[]).map(row => ({
      ...row,
      category_name: row.finance_categories?.name ?? null,
      category_type: row.finance_categories?.category_type ?? null,
      finance_categories: undefined,
    })) as FinanceBudget[]
  } catch (err) {
    throw mapError(err, 'listBudgets')
  }
}

export async function createBudget(payload: CreateBudgetPayload): Promise<FinanceBudget> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) throw new RepositoryError('No active assembly.', null, 'NO_ASSEMBLY')
  try {
    const { data, error } = await supabase
      .from('finance_budgets')
      .insert({ ...payload, assembly_id: assemblyId } as any)
      .select('*, finance_categories(name, category_type)')
      .single()
    if (error) throw error
    const row = data as any
    return {
      ...row,
      category_name: row.finance_categories?.name ?? null,
      category_type: row.finance_categories?.category_type ?? null,
      finance_categories: undefined,
    } as FinanceBudget
  } catch (err) {
    throw mapError(err, 'createBudget')
  }
}

export async function updateBudget(id: string, payload: UpdateBudgetPayload): Promise<FinanceBudget> {
  try {
    const { data, error } = await supabase
      .from('finance_budgets')
      .update(payload as any)
      .eq('id', id)
      .select('*, finance_categories(name, category_type)')
      .single()
    if (error) throw error
    const row = data as any
    return {
      ...row,
      category_name: row.finance_categories?.name ?? null,
      category_type: row.finance_categories?.category_type ?? null,
      finance_categories: undefined,
    } as FinanceBudget
  } catch (err) {
    throw mapError(err, `updateBudget(${id})`)
  }
}

export async function softDeleteBudget(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('finance_budgets')
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', id)
    if (error) throw error
  } catch (err) {
    throw mapError(err, `softDeleteBudget(${id})`)
  }
}

// ── Realtime ──────────────────────────────────────────────────────────────────

/**
 * Subscribe to changes on the finance_transactions table for the active assembly.
 * Returns a RealtimeChannel — call .unsubscribe() in module dispose().
 */
export function subscribeToTransactions(
  assemblyId: string,
  onUpdate: (type: 'INSERT' | 'UPDATE' | 'DELETE', id: string) => void
) {
  return supabase
    .channel(`finance_transactions:${assemblyId}`)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'finance_transactions',
        filter: `assembly_id=eq.${assemblyId}`,
      },
      payload => {
        const event = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
        const id =
          (payload.new as { id?: string })?.id ??
          (payload.old as { id?: string })?.id ?? ''
        if (id) onUpdate(event, id)
      }
    )
    .subscribe()
}
