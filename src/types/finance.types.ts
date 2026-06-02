// src/types/finance.types.ts
// Domain types for the Finance module.
// Mirrors the four finance tables in Supabase: finance_categories,
// finance_transactions, finance_pledges, finance_budgets.

import type { Database } from './database.types'

// ── Enum aliases ──────────────────────────────────────────────────────────────
export type FinanceTransactionType = Database['public']['Enums']['finance_transaction_type']
// 'tithe' | 'offering' | 'special_offering' | 'pledge_payment' | 'donation' | 'expense'

export type FinancePaymentMethod = Database['public']['Enums']['finance_payment_method']
// 'cash' | 'momo' | 'bank_transfer' | 'cheque' | 'other'

export type FinancePledgeStatus = Database['public']['Enums']['finance_pledge_status']
// 'active' | 'completed' | 'defaulted' | 'cancelled'

export type FinanceBudgetPeriod = Database['public']['Enums']['finance_budget_period']
// 'monthly' | 'quarterly' | 'annual'

export type FinanceCategoryType = Database['public']['Enums']['finance_category_type']
// 'income' | 'expense'

// ── Raw DB row types ──────────────────────────────────────────────────────────
export type FinanceCategoryRow    = Database['public']['Tables']['finance_categories']['Row']
export type FinanceTransactionRow = Database['public']['Tables']['finance_transactions']['Row']
export type FinancePledgeRow      = Database['public']['Tables']['finance_pledges']['Row']
export type FinanceBudgetRow      = Database['public']['Tables']['finance_budgets']['Row']

// ── Extended / joined types ───────────────────────────────────────────────────

/** FinanceTransaction with resolved display names for member + category */
export interface FinanceTransaction extends FinanceTransactionRow {
  member_name?:    string | null  // joined from members_view
  category_name?:  string         // joined from finance_categories.name
  category_type?:  FinanceCategoryType
}

/** FinancePledge with computed fulfilment percentage */
export interface FinancePledge extends FinancePledgeRow {
  member_name?:       string | null
  /** amount_paid / total_amount * 100, rounded to 0 dp */
  fulfilment_pct?:    number
}

/** FinanceBudget with resolved category name */
export interface FinanceBudget extends FinanceBudgetRow {
  category_name?:  string
  category_type?:  FinanceCategoryType
}

// ── Payload types for CRUD ────────────────────────────────────────────────────

export interface CreateCategoryPayload {
  name:           string
  category_type:  FinanceCategoryType
  description?:   string | null
}
export type UpdateCategoryPayload = Partial<CreateCategoryPayload>

export interface CreateTransactionPayload {
  category_id:       string
  transaction_type:  FinanceTransactionType
  amount:            number
  payment_method:    FinancePaymentMethod
  transaction_date?:  string           // ISO date, defaults to today
  currency?:         string            // defaults to 'GHS'
  reference_number?: string | null
  description?:      string | null
  member_id?:        string | null
  service_id?:       string | null
  group_id?:         string | null
  pledge_id?:        string | null
}
export type UpdateTransactionPayload = Partial<CreateTransactionPayload>

export interface CreatePledgePayload {
  member_id:     string
  pledge_name:   string
  total_amount:  number
  currency?:     string        // defaults to 'GHS'
  start_date?:   string        // ISO date
  end_date?:     string | null
  notes?:        string | null
}
export type UpdatePledgePayload = Partial<CreatePledgePayload> & {
  status?:       FinancePledgeStatus
  amount_paid?:  number
}

export interface CreateBudgetPayload {
  category_id:      string
  period:           FinanceBudgetPeriod
  year:             number
  month?:           number | null
  quarter?:         number | null
  budgeted_amount:  number
  notes?:           string | null
}
export type UpdateBudgetPayload = Partial<CreateBudgetPayload> & {
  actual_amount?: number
}

// ── Filter types ──────────────────────────────────────────────────────────────

export interface TransactionFilter {
  categoryId?:      string
  memberIdFilter?:  string
  type?:            FinanceTransactionType
  dateFrom?:        string          // ISO date
  dateTo?:          string          // ISO date
  search?:          string          // ilike on description or reference_number
  includeDeleted?:  boolean
}

export interface PledgeFilter {
  memberId?:        string
  status?:          FinancePledgeStatus
  includeDeleted?:  boolean
}
