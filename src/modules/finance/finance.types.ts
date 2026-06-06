// src/modules/finance/finance.types.ts
// Re-exports from the shared types file + UI-layer additions.

export type {
  FinanceTransactionType,
  FinancePaymentMethod,
  FinancePledgeStatus,
  FinanceBudgetPeriod,
  FinanceCategoryType,
  FinanceCategoryRow,
  FinanceTransactionRow,
  FinancePledgeRow,
  FinanceBudgetRow,
  FinanceTransaction,
  FinancePledge,
  FinanceBudget,
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

// ── UI-layer stats shapes ─────────────────────────────────────────────────────

export interface FinanceStats {
  totalIncome:   number
  totalExpense:  number
  netBalance:    number
  pendingCount:  number
}

export interface PledgeStats {
  totalPledged:    number
  amountPaid:      number
  outstanding:     number
  overdueCount:    number
}

export interface BudgetStats {
  totalBudgeted:  number
  totalActual:    number
  remaining:      number
  overBudgetCount: number
}

export interface ReportStats {
  ytdIncome:   number
  ytdExpense:  number
  netSurplus:  number
  avgPerMember: number
}

// ── Budget filter (UI layer) ───────────────────────────────────────────────────
export interface BudgetFilter {
  period?:          import('../../types/finance.types').FinanceBudgetPeriod
  year?:            number
  month?:           number | null
  quarter?:         number | null
  categoryType?:    import('../../types/finance.types').FinanceCategoryType
  includeDeleted?:  boolean
}

// ── Joined shapes used in reporting ──────────────────────────────────────────

export interface IncomeExpenseSummary {
  period:   string         // e.g. 'Jan', 'Q1', '2025'
  income:   number
  expense:  number
  net:      number
}

export interface CategoryBreakdown {
  category_id:   string
  category_name: string
  category_type: import('../../types/finance.types').FinanceCategoryType
  total:         number
  pct:           number   // percentage of type total
}

export interface PledgeSummary {
  total_pledges:     number
  active:            number
  completed:         number
  defaulted:         number
  cancelled:         number
  total_pledged:     number
  total_paid:        number
  fulfilment_pct:    number
}

export interface BudgetVarianceSummary {
  category_id:    string
  category_name:  string
  category_type:  import('../../types/finance.types').FinanceCategoryType
  budgeted:       number
  actual:         number
  variance:       number      // actual − budgeted (positive = over)
  variance_pct:   number
}

export interface TopContributor {
  member_id:    string
  member_name:  string
  total:        number
  rank:         number
}