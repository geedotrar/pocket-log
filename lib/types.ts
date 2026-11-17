export type AccountType = 'bank' | 'cash' | 'ewallet' | 'investment' | 'other';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type DebtType = 'i_owe' | 'they_owe';
export type DebtStatus = 'outstanding' | 'paid';
export type PeriodType = 'current_cycle' | 'this_week' | 'this_month' | 'this_year' | 'custom';
export type UserRole = 'superadmin' | 'user';

export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  currency?: string;
  role: UserRole;
  pin_hash?: string | null;
  has_pin?: boolean;
  pin_failed_attempts?: number;
  pin_locked_until?: string | null;
  is_trusted_device?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TrustedDevice {
  id: string;
  user_id: string;
  device_token_hash: string;
  device_name?: string | null;
  last_used_at: string;
  expires_at: string;
  is_revoked: boolean;
  created_at: string;
}

export interface Account {
  id: string;
  user_id?: string;
  name: string;
  type: AccountType;
  initial_balance: number; // Stored in DB, represents monthly budget allocation
  monthly_budget?: number;
  is_active: boolean;
  include_in_budget?: boolean; // Whether this account is counted in monthly budget allocation (default true)
  color?: string | null;
  pocket_name?: string | null;
  pocket_color?: string | null;
  created_at?: string;
  updated_at?: string;
  // Computed client-side for budget allocation
  allocated_budget?: number;
  effective_budget?: number;
  spent_amount?: number;
  transfers_in?: number;
  transfers_out?: number;
  remaining_budget?: number;
  current_balance?: number;
}

export interface Category {
  id: string;
  user_id?: string;
  name: string;
  type: 'expense' | 'income';
  icon?: string | null;
  color?: string | null;
  is_default?: boolean;
  created_at?: string;
}

export interface Transaction {
  id: string;
  user_id?: string;
  account_id: string;
  to_account_id?: string | null; // For transfers
  category_id?: string | null;
  type: TransactionType;
  amount: number;
  date: string; // YYYY-MM-DD
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined or referenced objects
  account?: Account;
  to_account?: Account;
  category?: Category;
}

export interface Debt {
  id: string;
  user_id?: string;
  type: DebtType; // 'i_owe' = I need to pay, 'they_owe' = they need to pay me
  person: string;
  amount: number;
  date: string; // YYYY-MM-DD
  due_date?: string | null;
  description?: string | null;
  status: DebtStatus;
  account_id?: string | null; // Funding account if deducting monthly budget
  created_at?: string;
  updated_at?: string;
  // Computed client-side
  remaining_amount?: number;
}


export interface FinancialSummary {
  totalBudget: number; // Base monthly allocation across in-budget accounts
  baseBudget: number; // Base monthly budget allocation
  offBudgetInflow: number; // Emergency / off-budget funds injected into budget accounts
  offBudgetOutflow: number; // Funds transferred from budget accounts into off-budget accounts
  offBudgetExpense: number; // Direct expenses paid from off-budget accounts
  totalOffBudgetUsed: number; // Total emergency funds used (inflow to budget + direct off-budget expenses)
  effectiveBudget: number; // Total effective budget (baseBudget + offBudgetInflow - offBudgetOutflow)
  totalExpense: number; // Total expenses in this period
  remainingBudget: number; // Remaining budget (effectiveBudget - totalExpense)
  budgetUsagePercent: number; // Budget usage percentage
  totalBalance: number;
  totalIncome: number; // Pure income (excluding debt settlements)
  debtRepayments: number; // Total debt repayments received
  totalCashInflow: number; // Total cash inflow (totalIncome + debtRepayments)
  netCashFlow: number; // Net cash flow (totalIncome - totalExpense)
  moneyIOwe: number;
  moneyOthersOweMe: number;
  overdueIOwe: number;
  overdueOthersOwe: number;
  transactionCount: number;
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  color: string;
  icon?: string;
  total: number;
  percentage: number;
  count: number;
}

export interface DailySpending {
  date: string;
  dayName: string;
  expense: number;
  income: number;
}

export interface MonthlyComparison {
  monthKey: string; // '2026-01'
  monthLabel: string; // 'Jan 2026'
  income: number;
  expense: number;
  net: number;
}


export interface MonthlyArchive {
  id: string;
  user_id?: string;
  period: string; // e.g. '2026-01'
  period_label: string; // e.g. 'Januari 2026'
  start_date: string;
  end_date: string;
  total_income: number;
  total_expense: number;
  transaction_count: number;
  data_snapshot: Transaction[];
  created_at: string;
}

export interface Cycle {
  id: string;
  user_id?: string;
  name?: string | null;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type InvestmentType = 'mutual_fund' | 'stock' | 'crypto' | 'gold' | 'bond' | 'deposit' | 'other';
export type InvestmentStatus = 'active' | 'closed';
export type InvestmentLogType = 'initial' | 'update_value' | 'top_up' | 'withdraw' | 'dividend';

export interface Investment {
  id: string;
  user_id?: string;
  name: string;
  type: InvestmentType;
  platform?: string | null;
  invested_amount: number;
  current_value: number;
  total_withdrawn: number;
  status: InvestmentStatus;
  start_date: string; // YYYY-MM-DD
  closed_date?: string | null; // YYYY-MM-DD
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  // Computed client-side
  unrealized_pnl?: number;
  unrealized_pnl_percent?: number;
  realized_pnl?: number;
  realized_pnl_percent?: number;
  logs?: InvestmentLog[];
}

export interface InvestmentLog {
  id: string;
  user_id?: string;
  investment_id: string;
  type: InvestmentLogType;
  value: number;
  amount: number;
  date: string; // YYYY-MM-DD
  account_id?: string | null;
  notes?: string | null;
  created_at?: string;
  account?: Account;
}

export interface InvestmentPortfolioSummary {
  totalCurrentValue: number;
  totalInvested: number;
  totalUnrealizedPnl: number;
  unrealizedPnlPercent: number;
  totalRealizedPnl: number;
  totalWithdrawn: number;
  activeCount: number;
  closedCount: number;
}


