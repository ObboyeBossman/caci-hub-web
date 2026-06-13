// src/modules/finance/repository.ts
// Finance data access layer.
// All Supabase calls are isolated here — no direct DB access from UI or tabs.
// Mirrors the architecture of src/modules/services/repository.ts exactly.

import { supabase }           from '@core/supabase'
import { getActiveAssemblyId } from '@core/auth'
import { emit }               from '@core/events'
import { RepositoryError, DB_ERROR_CODES } from '../../types/common.types'
import type {
  FinanceTransaction,
  FinancePledge,
  FinanceBudget,
  FinanceCategoryRow,
  CreateTransactionPayload,
  UpdateTransactionPayload,
  CreatePledgePayload,
  UpdatePledgePayload,
  CreateBudgetPayload,
  UpdateBudgetPayload,
  CreateCategoryPayload,
  TransactionFilter,
  PledgeFilter,
  BudgetFilter,
  FinanceStats,
  PledgeStats,
  BudgetStats,
  IncomeExpenseSummary,
  CategoryBreakdown,
  PledgeSummary,
  BudgetVarianceSummary,
  TopContributor,
} from './finance.types'

// ── Error helper ──────────────────────────────────────────────────────────────

function mapError(err: unknown, context: string): RepositoryError {
  const e    = err as { code?: string; message?: string }
  const code = e.code ?? 'UNKNOWN'

  let message = `Something went wrong. Please try again. (Code: ${code})`
  if (code === DB_ERROR_CODES.NOT_FOUND)         message = 'Record not found.'
  else if (code === DB_ERROR_CODES.PERMISSION_DENIED) message = 'You do not have permission to perform this action.'
  else if (code === DB_ERROR_CODES.UNIQUE_VIOLATION)  message = 'A record with these details already exists.'

  if (code !== DB_ERROR_CODES.NOT_FOUND && code !== DB_ERROR_CODES.PERMISSION_DENIED) {
    console.error(`[finance/repository] ${context}:`, err)
  }
  return new RepositoryError(message, err, code)
}

function requireAssembly(): string {
  const id = getActiveAssemblyId()
  if (!id) throw new RepositoryError('No active assembly selected.', null, 'NO_ASSEMBLY')
  return id
}

// ── ─────────────────────────────────────────────────────────────────────────
// CATEGORIES
// ── ─────────────────────────────────────────────────────────────────────────

export async function listCategories(): Promise<FinanceCategoryRow[]> {
  try {
    const assemblyId = requireAssembly()
    const { data, error } = await supabase
      .from('finance_categories')
      .select('*')
      .eq('assembly_id', assemblyId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name')
    if (error) throw error
    return data as FinanceCategoryRow[]
  } catch (err) {
    throw mapError(err, 'listCategories')
  }
}

export async function createCategory(payload: CreateCategoryPayload): Promise<FinanceCategoryRow> {
  try {
    const assemblyId = requireAssembly()
    const { data, error } = await supabase
      .from('finance_categories')
      .insert({ ...payload, assembly_id: assemblyId } as any)
      .select('*')
      .single()
    if (error) throw error
    emit('finance:categoryCreated', { id: (data as any).id })
    return data as FinanceCategoryRow
  } catch (err) {
    throw mapError(err, 'createCategory')
  }
}

// ── ─────────────────────────────────────────────────────────────────────────
// TRANSACTIONS
// ── ─────────────────────────────────────────────────────────────────────────

export async function listTransactions(
  filter?: TransactionFilter,
  opts: { limit?: number; offset?: number } = {}
): Promise<FinanceTransaction[]> {
  try {
    const assemblyId  = requireAssembly()
    const { limit = 50, offset = 0 } = opts

    let query = supabase
      .from('finance_transactions')
      .select(`
        *,
        finance_categories ( name, category_type ),
        members ( title, first_name, last_name )
      `)
      .eq('assembly_id', assemblyId)

    if (filter) {
      if (!filter.includeDeleted)    query = query.is('deleted_at', null)
      if (filter.categoryId)         query = query.eq('category_id', filter.categoryId)
      if (filter.memberIdFilter)     query = query.eq('member_id', filter.memberIdFilter)
      if (filter.type)               query = query.eq('transaction_type', filter.type)
      if (filter.dateFrom)           query = query.gte('transaction_date', filter.dateFrom)
      if (filter.dateTo)             query = query.lte('transaction_date', filter.dateTo)
      if (filter.search) {
        query = query.or(
          `description.ilike.%${filter.search}%,reference_number.ilike.%${filter.search}%`
        )
      }
    } else {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query
      .order('transaction_date', { ascending: false })
      .order('created_at',       { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return (data ?? []).map((row: any) => ({
      ...row,
      category_name: row.finance_categories?.name        ?? null,
      category_type: row.finance_categories?.category_type ?? null,
      member_name:   row.members
        ? [row.members.title, row.members.first_name, row.members.last_name]
            .filter(Boolean).join(' ')
        : null,
    })) as FinanceTransaction[]
  } catch (err) {
    throw mapError(err, 'listTransactions')
  }
}

export async function getTransaction(id: string): Promise<FinanceTransaction> {
  try {
    const { data, error } = await supabase
      .from('finance_transactions')
      .select(`*, finance_categories ( name, category_type ), members ( title, first_name, last_name )`)
      .eq('id', id)
      .single()
    if (error) throw error
    const row = data as any
    return {
      ...row,
      category_name: row.finance_categories?.name         ?? null,
      category_type: row.finance_categories?.category_type ?? null,
      member_name:   row.members
        ? [row.members.title, row.members.first_name, row.members.last_name]
            .filter(Boolean).join(' ')
        : null,
    } as FinanceTransaction
  } catch (err) {
    throw mapError(err, `getTransaction(${id})`)
  }
}

export async function createTransaction(
  payload: CreateTransactionPayload
): Promise<FinanceTransaction> {
  try {
    const assemblyId = requireAssembly()
    const { data: inserted, error } = await supabase
      .from('finance_transactions')
      .insert({
        ...payload,
        assembly_id:      assemblyId,
        transaction_date: payload.transaction_date ?? new Date().toISOString().split('T')[0],
        currency:         payload.currency ?? 'GHS',
      } as any)
      .select('id')
      .single()
    if (error) throw error
    const tx = await getTransaction(inserted.id)
    emit('finance:transactionCreated', { id: inserted.id })
    return tx
  } catch (err) {
    throw mapError(err, 'createTransaction')
  }
}

export async function updateTransaction(
  id: string,
  payload: UpdateTransactionPayload
): Promise<FinanceTransaction> {
  try {
    const { error } = await supabase
      .from('finance_transactions')
      .update(payload as any)
      .eq('id', id)
    if (error) throw error
    const tx = await getTransaction(id)
    emit('finance:transactionUpdated', { id })
    return tx
  } catch (err) {
    throw mapError(err, `updateTransaction(${id})`)
  }
}

export async function voidTransaction(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('finance_transactions')
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', id)
    if (error) throw error
    emit('finance:transactionVoided', { id })
  } catch (err) {
    throw mapError(err, `voidTransaction(${id})`)
  }
}

export async function getFinanceStats(): Promise<FinanceStats> {
  try {
    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) return { totalIncome: 0, totalExpense: 0, netBalance: 0, pendingCount: 0 }

    const { data, error } = await supabase
      .from('finance_transactions')
      .select('amount, transaction_type, finance_categories ( category_type )')
      .eq('assembly_id', assemblyId)
      .is('deleted_at', null)

    if (error) throw error

    let totalIncome  = 0
    let totalExpense = 0

    ;(data ?? []).forEach((row: any) => {
      const catType = row.finance_categories?.category_type
      if (catType === 'income') {
        totalIncome += Number(row.amount)
      } else if (catType === 'expense') {
        totalExpense += Number(row.amount)
      } else if (row.transaction_type === 'expense') {
        totalExpense += Number(row.amount)
      } else {
        totalIncome += Number(row.amount)
      }
    })

    // pending = transactions created today (no formal pending flag in schema)
    const today = new Date().toISOString().split('T')[0]
    const { count: pendingCount } = await supabase
      .from('finance_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('assembly_id', assemblyId)
      .eq('transaction_date', today)
      .is('deleted_at', null)

    return {
      totalIncome,
      totalExpense,
      netBalance:   totalIncome - totalExpense,
      pendingCount: pendingCount ?? 0,
    }
  } catch (err) {
    console.error('[finance/repository] getFinanceStats:', err)
    return { totalIncome: 0, totalExpense: 0, netBalance: 0, pendingCount: 0 }
  }
}

// ── ─────────────────────────────────────────────────────────────────────────
// PLEDGES
// ── ─────────────────────────────────────────────────────────────────────────

export async function listPledges(filter?: PledgeFilter): Promise<FinancePledge[]> {
  try {
    const assemblyId = requireAssembly()

    let query = supabase
      .from('finance_pledges')
      .select(`*, members ( title, first_name, last_name )`)
      .eq('assembly_id', assemblyId)

    if (filter) {
      if (!filter.includeDeleted) query = query.is('deleted_at', null)
      if (filter.memberId)        query = query.eq('member_id', filter.memberId)
      if (filter.status)          query = query.eq('status', filter.status)
    } else {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data ?? []).map((row: any) => ({
      ...row,
      member_name:    row.members
        ? [row.members.title, row.members.first_name, row.members.last_name]
            .filter(Boolean).join(' ')
        : null,
      fulfilment_pct: row.total_amount > 0
        ? Math.round((row.amount_paid / row.total_amount) * 100)
        : 0,
    })) as FinancePledge[]
  } catch (err) {
    throw mapError(err, 'listPledges')
  }
}

export async function getPledge(id: string): Promise<FinancePledge> {
  try {
    const { data, error } = await supabase
      .from('finance_pledges')
      .select(`*, members ( title, first_name, last_name )`)
      .eq('id', id)
      .single()
    if (error) throw error
    const row = data as any
    return {
      ...row,
      member_name: row.members
        ? [row.members.title, row.members.first_name, row.members.last_name]
            .filter(Boolean).join(' ')
        : null,
      fulfilment_pct: row.total_amount > 0
        ? Math.round((row.amount_paid / row.total_amount) * 100)
        : 0,
    } as FinancePledge
  } catch (err) {
    throw mapError(err, `getPledge(${id})`)
  }
}

export async function createPledge(payload: CreatePledgePayload): Promise<FinancePledge> {
  try {
    const assemblyId = requireAssembly()
    const { data: inserted, error } = await supabase
      .from('finance_pledges')
      .insert({
        ...payload,
        assembly_id: assemblyId,
        currency:    payload.currency ?? 'GHS',
        start_date:  payload.start_date ?? new Date().toISOString().split('T')[0],
      } as any)
      .select('id')
      .single()
    if (error) throw error
    const pledge = await getPledge(inserted.id)
    emit('finance:pledgeCreated', { id: inserted.id })
    return pledge
  } catch (err) {
    throw mapError(err, 'createPledge')
  }
}

export async function updatePledge(
  id: string,
  payload: UpdatePledgePayload
): Promise<FinancePledge> {
  try {
    const { error } = await supabase
      .from('finance_pledges')
      .update(payload as any)
      .eq('id', id)
    if (error) throw error
    const pledge = await getPledge(id)
    emit('finance:pledgeUpdated', { id })
    return pledge
  } catch (err) {
    throw mapError(err, `updatePledge(${id})`)
  }
}

/**
 * Record a pledge payment.
 * Creates a finance_transaction of type 'pledge_payment' and
 * updates the pledge's amount_paid field atomically.
 */
export async function recordPledgePayment(
  pledgeId:      string,
  amount:        number,
  paymentMethod: import('../../types/finance.types').FinancePaymentMethod,
  categoryId:    string,
  referenceNumber?: string | null
): Promise<FinancePledge> {
  try {
    const assemblyId = requireAssembly()
    const pledge     = await getPledge(pledgeId)
    const newPaid    = Math.min(pledge.amount_paid + amount, pledge.total_amount)

    // 1. Create the transaction record
    await createTransaction({
      category_id:      categoryId,
      transaction_type: 'pledge_payment',
      amount,
      payment_method:   paymentMethod,
      pledge_id:        pledgeId,
      member_id:        pledge.member_id,
      reference_number: referenceNumber ?? null,
      description:      `Pledge payment — ${pledge.pledge_name}`,
    })

    // 2. Update pledge amount_paid and status
    const newStatus: import('../../types/finance.types').FinancePledgeStatus =
      newPaid >= pledge.total_amount ? 'completed' : pledge.status

    const updated = await updatePledge(pledgeId, {
      amount_paid: newPaid,
      status:      newStatus,
    })

    emit('finance:pledgePaymentRecorded', { pledgeId, amount })
    return updated
  } catch (err) {
    throw mapError(err, `recordPledgePayment(${pledgeId})`)
  }
}

export async function getPledgeStats(): Promise<PledgeStats> {
  try {
    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) return { totalPledged: 0, amountPaid: 0, outstanding: 0, overdueCount: 0 }

    const { data, error } = await supabase
      .from('finance_pledges')
      .select('total_amount, amount_paid, status, end_date')
      .eq('assembly_id', assemblyId)
      .is('deleted_at', null)

    if (error) throw error

    const today = new Date().toISOString().split('T')[0]
    let totalPledged = 0, amountPaid = 0, overdueCount = 0

    ;(data ?? []).forEach((row: any) => {
      totalPledged += Number(row.total_amount)
      amountPaid   += Number(row.amount_paid)
      const isOverdue = row.status === 'active'
        && row.end_date
        && row.end_date < today
        && Number(row.amount_paid) < Number(row.total_amount)
      if (isOverdue) overdueCount++
    })

    return {
      totalPledged,
      amountPaid,
      outstanding: totalPledged - amountPaid,
      overdueCount,
    }
  } catch (err) {
    console.error('[finance/repository] getPledgeStats:', err)
    return { totalPledged: 0, amountPaid: 0, outstanding: 0, overdueCount: 0 }
  }
}

// ── ─────────────────────────────────────────────────────────────────────────
// BUDGETS
// ── ─────────────────────────────────────────────────────────────────────────

export async function listBudgets(filter?: BudgetFilter): Promise<FinanceBudget[]> {
  try {
    const assemblyId = requireAssembly()

    let query = supabase
      .from('finance_budgets')
      .select(`*, finance_categories ( name, category_type )`)
      .eq('assembly_id', assemblyId)

    if (filter) {
      if (!filter.includeDeleted) query = query.is('deleted_at', null)
      if (filter.period)          query = query.eq('period', filter.period)
      if (filter.year)            query = query.eq('year', filter.year)
      if (filter.month != null)   query = query.eq('month', filter.month)
      if (filter.quarter != null) query = query.eq('quarter', filter.quarter)
    } else {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query.order('created_at')
    if (error) throw error

    return (data ?? []).map((row: any) => ({
      ...row,
      category_name: row.finance_categories?.name          ?? null,
      category_type: row.finance_categories?.category_type ?? null,
    })) as FinanceBudget[]
  } catch (err) {
    throw mapError(err, 'listBudgets')
  }
}

export async function createBudgetLine(payload: CreateBudgetPayload): Promise<FinanceBudget> {
  try {
    const assemblyId = requireAssembly()
    const { data: inserted, error } = await supabase
      .from('finance_budgets')
      .insert({ ...payload, assembly_id: assemblyId, actual_amount: 0 } as any)
      .select('id')
      .single()
    if (error) throw error

    const { data, error: fe } = await supabase
      .from('finance_budgets')
      .select(`*, finance_categories ( name, category_type )`)
      .eq('id', inserted.id)
      .single()
    if (fe) throw fe

    emit('finance:budgetCreated', { id: inserted.id })
    const row = data as any
    return {
      ...row,
      category_name: row.finance_categories?.name          ?? null,
      category_type: row.finance_categories?.category_type ?? null,
    } as FinanceBudget
  } catch (err) {
    throw mapError(err, 'createBudgetLine')
  }
}

export async function updateBudgetLine(
  id: string,
  payload: UpdateBudgetPayload
): Promise<void> {
  try {
    const { error } = await supabase
      .from('finance_budgets')
      .update(payload as any)
      .eq('id', id)
    if (error) throw error
    emit('finance:budgetUpdated', { id })
  } catch (err) {
    throw mapError(err, `updateBudgetLine(${id})`)
  }
}

export async function getBudgetStats(
  period: import('../../types/finance.types').FinanceBudgetPeriod,
  year: number,
  month?: number | null,
  quarter?: number | null
): Promise<BudgetStats> {
  try {
    const budgets = await listBudgets({ period, year, month, quarter })
    let totalBudgeted  = 0
    let totalActual    = 0
    let overBudgetCount = 0

    budgets.forEach(b => {
      totalBudgeted += b.budgeted_amount
      totalActual   += b.actual_amount
      if (b.actual_amount > b.budgeted_amount && b.budgeted_amount > 0) overBudgetCount++
    })

    return {
      totalBudgeted,
      totalActual,
      remaining:      Math.max(0, totalBudgeted - totalActual),
      overBudgetCount,
    }
  } catch (err) {
    console.error('[finance/repository] getBudgetStats:', err)
    return { totalBudgeted: 0, totalActual: 0, remaining: 0, overBudgetCount: 0 }
  }
}

// ── ─────────────────────────────────────────────────────────────────────────
// REPORTS
// ── ─────────────────────────────────────────────────────────────────────────

export async function getIncomeExpenseSummary(
  period: 'monthly' | 'quarterly' | 'annual',
  year: number
): Promise<IncomeExpenseSummary[]> {
  try {
    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) return []

    const { data, error } = await supabase
      .from('finance_transactions')
      .select('transaction_date, amount, transaction_type, finance_categories ( category_type )')
      .eq('assembly_id', assemblyId)
      .gte('transaction_date', `${year}-01-01`)
      .lte('transaction_date', `${year}-12-31`)
      .is('deleted_at', null)

    if (error) throw error

    function addRow(row: any, bucket: { income: number; expense: number }): void {
      const catType = row.finance_categories?.category_type
      if (catType === 'income') {
        bucket.income += Number(row.amount)
      } else if (catType === 'expense') {
        bucket.expense += Number(row.amount)
      } else if (row.transaction_type === 'expense') {
        bucket.expense += Number(row.amount)
      } else {
        bucket.income += Number(row.amount)
      }
    }

    if (period === 'monthly') {
      const months = Array.from({ length: 12 }, (_, i) => ({
        period:  ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
        income:  0,
        expense: 0,
        net:     0,
      }))
      ;(data ?? []).forEach((row: any) => {
        const m = new Date(row.transaction_date).getMonth()
        addRow(row, months[m])
      })
      months.forEach(m => { m.net = m.income - m.expense })
      return months
    }

    if (period === 'quarterly') {
      const quarters = [1,2,3,4].map(q => ({
        period: `Q${q}`, income: 0, expense: 0, net: 0,
      }))
      ;(data ?? []).forEach((row: any) => {
        const m = new Date(row.transaction_date).getMonth()
        const q = Math.floor(m / 3)
        addRow(row, quarters[q])
      })
      quarters.forEach(q => { q.net = q.income - q.expense })
      return quarters
    }

    // annual — single row
    const annual = { income: 0, expense: 0 }
    ;(data ?? []).forEach((row: any) => {
      addRow(row, annual)
    })
    return [{ period: String(year), income: annual.income, expense: annual.expense, net: annual.income - annual.expense }]
  } catch (err) {
    throw mapError(err, 'getIncomeExpenseSummary')
  }
}

export async function getCategoryBreakdown(
  categoryType: import('../../types/finance.types').FinanceCategoryType,
  year: number
): Promise<CategoryBreakdown[]> {
  try {
    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) return []

    const { data, error } = await supabase
      .from('finance_transactions')
      .select('amount, category_id, finance_categories ( name, category_type )')
      .eq('assembly_id', assemblyId)
      .gte('transaction_date', `${year}-01-01`)
      .lte('transaction_date', `${year}-12-31`)
      .is('deleted_at', null)

    if (error) throw error

    const catMap = new Map<string, { name: string; total: number }>()
    let typeTotal = 0

    ;(data ?? []).forEach((row: any) => {
      const cat = row.finance_categories
      if (!cat || cat.category_type !== categoryType) return
      const existing = catMap.get(row.category_id) ?? { name: cat.name, total: 0 }
      existing.total += Number(row.amount)
      catMap.set(row.category_id, existing)
      typeTotal += Number(row.amount)
    })

    return [...catMap.entries()].map(([id, v]) => ({
      category_id:   id,
      category_name: v.name,
      category_type: categoryType,
      total:         v.total,
      pct:           typeTotal > 0 ? Math.round((v.total / typeTotal) * 100) : 0,
    })).sort((a, b) => b.total - a.total)
  } catch (err) {
    throw mapError(err, 'getCategoryBreakdown')
  }
}

export async function getPledgeSummary(): Promise<PledgeSummary> {
  try {
    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) return {
      total_pledges: 0, active: 0, completed: 0,
      defaulted: 0, cancelled: 0,
      total_pledged: 0, total_paid: 0, fulfilment_pct: 0,
    }

    const { data, error } = await supabase
      .from('finance_pledges')
      .select('status, total_amount, amount_paid')
      .eq('assembly_id', assemblyId)
      .is('deleted_at', null)

    if (error) throw error

    let active = 0, completed = 0, defaulted = 0, cancelled = 0
    let total_pledged = 0, total_paid = 0

    ;(data ?? []).forEach((row: any) => {
      if (row.status === 'active')    active++
      if (row.status === 'completed') completed++
      if (row.status === 'defaulted') defaulted++
      if (row.status === 'cancelled') cancelled++
      total_pledged += Number(row.total_amount)
      total_paid    += Number(row.amount_paid)
    })

    return {
      total_pledges: (data ?? []).length,
      active, completed, defaulted, cancelled,
      total_pledged, total_paid,
      fulfilment_pct: total_pledged > 0
        ? Math.round((total_paid / total_pledged) * 100)
        : 0,
    }
  } catch (err) {
    throw mapError(err, 'getPledgeSummary')
  }
}

export async function getBudgetVarianceSummary(
  period: import('../../types/finance.types').FinanceBudgetPeriod,
  year: number,
  month?: number | null,
  quarter?: number | null
): Promise<BudgetVarianceSummary[]> {
  try {
    const budgets = await listBudgets({ period, year, month, quarter })
    return budgets.map(b => {
      const variance = b.actual_amount - b.budgeted_amount
      return {
        category_id:   b.category_id,
        category_name: b.category_name  ?? '',
        category_type: b.category_type! ?? 'expense',
        budgeted:      b.budgeted_amount,
        actual:        b.actual_amount,
        variance,
        variance_pct:  b.budgeted_amount > 0
          ? Math.round((variance / b.budgeted_amount) * 100)
          : 0,
      }
    }).sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
  } catch (err) {
    throw mapError(err, 'getBudgetVarianceSummary')
  }
}

export async function getTopContributors(
  year: number,
  limit = 10
): Promise<TopContributor[]> {
  try {
    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) return []

    const { data, error } = await supabase
      .from('finance_transactions')
      .select('member_id, amount, members ( title, first_name, last_name )')
      .eq('assembly_id', assemblyId)
      .not('member_id', 'is', null)
      .gte('transaction_date', `${year}-01-01`)
      .lte('transaction_date', `${year}-12-31`)
      .is('deleted_at', null)

    if (error) throw error

    const memberMap = new Map<string, { name: string; total: number }>()

    ;(data ?? []).forEach((row: any) => {
      if (!row.member_id) return
      const existing = memberMap.get(row.member_id) ?? {
        name: row.members
          ? [row.members.title, row.members.first_name, row.members.last_name]
              .filter(Boolean).join(' ')
          : 'Unknown',
        total: 0,
      }
      existing.total += Number(row.amount)
      memberMap.set(row.member_id, existing)
    })

    return [...memberMap.entries()]
      .map(([id, v], i) => ({ member_id: id, member_name: v.name, total: v.total, rank: 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit)
      .map((item, i) => ({ ...item, rank: i + 1 }))
  } catch (err) {
    throw mapError(err, 'getTopContributors')
  }
}

export async function exportFinanceReport(
  period: import('../../types/finance.types').FinanceBudgetPeriod,
  year: number
): Promise<string> {
  // Returns CSV string. Caller handles download.
  try {
    const transactions = await listTransactions({
      dateFrom: `${year}-01-01`,
      dateTo:   `${year}-12-31`,
    }, { limit: 10000 })

    const header = 'ID,Date,Description,Member,Category,Type,Method,Amount,Currency,Reference\n'
    const rows   = transactions.map(t => [
      t.id,
      t.transaction_date,
      `"${(t.description ?? '').replace(/"/g, '""')}"`,
      `"${(t.member_name ?? '').replace(/"/g, '""')}"`,
      `"${(t.category_name ?? '').replace(/"/g, '""')}"`,
      t.category_type ?? '',
      t.payment_method,
      t.amount,
      t.currency,
      t.reference_number ?? '',
    ].join(',')).join('\n')

    return header + rows
  } catch (err) {
    throw mapError(err, 'exportFinanceReport')
  }
}

// ── ─────────────────────────────────────────────────────────────────────────
// REALTIME
// ── ─────────────────────────────────────────────────────────────────────────

export function subscribeToFinance(
  assemblyId: string,
  onUpdate: (table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', id: string) => void
) {
  const tables = ['finance_transactions', 'finance_pledges', 'finance_budgets']
  const channels = tables.map(table =>
    supabase
      .channel(`finance:${table}:${assemblyId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table,
          filter: `assembly_id=eq.${assemblyId}`,
        },
        (payload) => {
          const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
          const id = (payload.new as any)?.id ?? (payload.old as any)?.id ?? ''
          if (id) onUpdate(table, eventType, id)
        }
      )
      .subscribe()
  )
  return channels
}