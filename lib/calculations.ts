import {
  Account,
  Transaction,
  Category,
  Debt,
  FinancialSummary,
  CategorySpending,
  DailySpending,
  MonthlyComparison,
  PeriodType,
  Investment,
  InvestmentPortfolioSummary,
} from './types';
import { APP_COLOR_PALETTE } from './constants';

/**
 * Format number to Indonesian Rupiah (e.g., "Rp 1.500.000")
 */
export function formatRupiah(amount: number | null | undefined, withPrefix = true): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return withPrefix ? 'Rp 0' : '0';
  }
  const isNegative = amount < 0;
  const absAmount = Math.abs(Math.round(amount));
  const formatted = absAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = isNegative ? '-' : '';
  return withPrefix ? `${sign}Rp ${formatted}` : `${sign}${formatted}`;
}

/**
 * Format string or number into thousands-separated with dots for inputs (e.g. 50000 -> 50.000)
 */
export function formatInputNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const str = value.toString();
  const isNegative = str.startsWith('-');
  let digits = str.replace(/\D/g, '');
  if (!digits) return isNegative ? '-' : '';
  if (digits.length > 1 && digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '') || '0';
  }
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Parse a dot-formatted string into a numeric value (e.g. "50.000" -> 50000)
 */
export function parseInputNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const clean = value.toString().replace(/\./g, '').replace(/[^0-9-]/g, '');
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Clean internal markers (such as debt settlement markers) from transaction description
 */
export function formatTransactionDescription(desc?: string | null): string {
  if (!desc) return '-';
  const cleaned = desc
    .replace(/\s*\[debt:[^\]]+\]/gi, '')
    .replace(/\s*\[PIUTANG_LUNAS:[^\]]+\]/gi, '')
    .trim();
  return cleaned || '-';
}

/**
 * Detect if a transaction is a debt/receivable settlement.
 * Debt settlements return original capital/assets, so they should not distort earned revenue/income metrics.
 */
export function isDebtSettlementTransaction(t: Transaction, categories?: Category[]): boolean {
  const descLower = (t.description || '').toLowerCase();
  if (
    descLower.includes('[piutang_lunas:') ||
    descLower.includes('piutang lunas') ||
    descLower.includes('receivable repaid') ||
    descLower.includes('pelunasan piutang') ||
    descLower.includes('debt repayment')
  ) {
    return true;
  }
  if (categories && t.category_id) {
    const cat = categories.find((c) => c.id === t.category_id);
    if (cat) {
      const cName = cat.name.toLowerCase();
      if (
        cName.includes('pelunasan piutang') ||
        cName.includes('debt settlement') ||
        cName.includes('debt repayment') ||
        cName.includes('piutang lunas') ||
        cName.includes('pembayaran piutang')
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Calculate accurate current balance for all accounts:
 * Current Balance = Initial Balance + Income - Expense + Transfers In - Transfers Out
 */
export function calculateAccountBalances(
  accounts: Account[],
  transactions: Transaction[],
  debts?: Debt[],
  cycleStartDate?: string
): Account[] {
  const balanceMap = new Map<string, number>();
  const spentMap = new Map<string, number>();
  const transferInMap = new Map<string, number>();
  const transferOutMap = new Map<string, number>();

  // Initialize with initial balances (budget allocation)
  for (const acc of accounts) {
    balanceMap.set(acc.id, Number(acc.initial_balance) || 0);
    spentMap.set(acc.id, 0);
    transferInMap.set(acc.id, 0);
    transferOutMap.set(acc.id, 0);
  }

  // Filter transactions by cycleStartDate if provided (normalized YYYY-MM-DD comparison)
  const normalizedCycleStart = cycleStartDate ? cycleStartDate.slice(0, 10) : undefined;
  const relevantTransactions = normalizedCycleStart
    ? transactions.filter((t) => (t.date || '').slice(0, 10) >= normalizedCycleStart)
    : transactions;

  // Iterate over transactions
  for (const t of relevantTransactions) {
    const amount = Number(t.amount) || 0;
    if (t.type === 'income') {
      const current = balanceMap.get(t.account_id) ?? 0;
      balanceMap.set(t.account_id, current + amount);
    } else if (t.type === 'expense') {
      const current = balanceMap.get(t.account_id) ?? 0;
      balanceMap.set(t.account_id, current - amount);
      const spent = spentMap.get(t.account_id) ?? 0;
      spentMap.set(t.account_id, spent + amount);
    } else if (t.type === 'transfer') {
      // Deduct from source account balance
      const sourceCurrent = balanceMap.get(t.account_id) ?? 0;
      balanceMap.set(t.account_id, sourceCurrent - amount);
      const curOut = transferOutMap.get(t.account_id) ?? 0;
      transferOutMap.set(t.account_id, curOut + amount);

      // Add to target account balance
      if (t.to_account_id) {
        const targetCurrent = balanceMap.get(t.to_account_id) ?? 0;
        balanceMap.set(t.to_account_id, targetCurrent + amount);
        const curIn = transferInMap.get(t.to_account_id) ?? 0;
        transferInMap.set(t.to_account_id, curIn + amount);
      }
    }
  }

  // Factor in debts (receivables funded from budgeted accounts in this cycle)
  if (debts && debts.length > 0) {
    const relevantDebts = normalizedCycleStart
      ? debts.filter((d) => (d.date || '').slice(0, 10) >= normalizedCycleStart)
      : debts;

    for (const d of relevantDebts) {
      if (d.type === 'they_owe' && d.account_id) {
        const amt = Number(d.amount) || 0;
        const cur = balanceMap.get(d.account_id) ?? 0;
        balanceMap.set(d.account_id, cur - amt);
        // Only count as spent while the receivable is still outstanding
        if (d.status !== 'paid') {
          const sp = spentMap.get(d.account_id) ?? 0;
          spentMap.set(d.account_id, sp + amt);
        }
      }
    }
  }


  return accounts.map((acc) => {
    const allocated = Number(acc.initial_balance) || 0;
    const spent = spentMap.get(acc.id) ?? 0;
    const transfersIn = transferInMap.get(acc.id) ?? 0;
    const transfersOut = transferOutMap.get(acc.id) ?? 0;
    const remaining = balanceMap.get(acc.id) ?? allocated;
    const effectiveBudget = allocated + transfersIn - transfersOut;

    return {
      ...acc,
      monthly_budget: allocated,
      allocated_budget: allocated,
      effective_budget: effectiveBudget,
      spent_amount: spent,
      transfers_in: transfersIn,
      transfers_out: transfersOut,
      remaining_budget: remaining,
      current_balance: remaining,
    };
  });
}

/**
 * Compute debt status and remaining balance (status is manual, no payments)
 */
export function computeDebtDetails(debt: Debt): Debt {
  const isPaid = debt.status === 'paid';
  return {
    ...debt,
    remaining_amount: isPaid ? 0 : (Number(debt.amount) || 0),
  };
}

/**
 * Determine date ranges for given period preset
 */
/**
 * Get current date string formatted as YYYY-MM-DD in local time
 */
export function getLocalDateString(d: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Filter and calculate today's expenses
 */
export function calculateTodayExpenses<T extends { type?: string; date?: string; amount?: number }>(
  transactions: T[],
  referenceDate: Date = new Date()
): {
  total: number;
  count: number;
  transactions: T[];
} {
  const todayStr = getLocalDateString(referenceDate);
  const todayTxs = transactions.filter((t) => {
    const isExpense = t.type === 'expense' || !t.type;
    const dateStr = (t.date || '').slice(0, 10);
    return isExpense && dateStr === todayStr;
  });

  const total = todayTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  return {
    total,
    count: todayTxs.length,
    transactions: todayTxs,
  };
}

export function getDateRangeForPeriod(
  period: PeriodType,
  customStart?: string,
  customEnd?: string,
  referenceDate = new Date(),
  cycleStartDate?: string
): { startDate: string; endDate: string; label: string } {
  const formatDate = (d: Date) => getLocalDateString(d);

  if (period === 'custom' && customStart && customEnd) {
    return {
      startDate: customStart,
      endDate: customEnd,
      label: `${customStart} to ${customEnd}`,
    };
  }

  const today = new Date(referenceDate);
  const todayStr = formatDate(today);

  if (period === 'current_cycle') {
    const start = cycleStartDate || todayStr;
    return {
      startDate: start,
      endDate: '2099-12-31', // Active cycle until next cycle starts
      label: `Active Cycle (Starts ${start})`,
    };
  }

  if (period === 'this_week') {
    // Start of week: Monday
    const day = today.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      startDate: formatDate(monday),
      endDate: formatDate(sunday),
      label: 'This Week',
    };
  }

  if (period === 'this_year') {
    const year = today.getFullYear();
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      label: `Year ${year}`,
    };
  }

  // Default: 'this_month'
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return {
    startDate: formatDate(firstDay),
    endDate: formatDate(lastDay),
    label: `${monthNamesEn[month]} ${year}`,
  };
}

/**
 * Filter transactions by date range
 */
export function filterTransactionsByDate(
  transactions: Transaction[],
  startDate: string,
  endDate: string
): Transaction[] {
  return transactions.filter((t) => t.date >= startDate && t.date <= endDate);
}

/**
 * Calculate overall financial summary
 */
export function calculateFinancialSummary(
  accounts: Account[],
  allTransactions: Transaction[],
  periodTransactions: Transaction[],
  debts: Debt[],
  cycleStartDate?: string,
  categories?: Category[]
): FinancialSummary {
  // 1. In-budget vs Off-budget accounts
  const budgetAccounts = accounts.filter((a) => a.is_active !== false && a.include_in_budget !== false);
  const budgetAccountIds = new Set(budgetAccounts.map((a) => a.id));

  const offBudgetAccounts = accounts.filter((a) => a.is_active !== false && a.include_in_budget === false);
  const offBudgetAccountIds = new Set(offBudgetAccounts.map((a) => a.id));

  // Base allocated budget from monthly in-budget accounts
  const baseBudget = budgetAccounts
    .reduce((sum, a) => sum + (Number(a.initial_balance) || 0), 0);
  const totalBudget = baseBudget;

  const accountsWithBalance = calculateAccountBalances(accounts, allTransactions, debts, cycleStartDate);
  const totalBalance = accountsWithBalance
    .filter((a) => a.is_active !== false)
    .reduce((sum, a) => sum + (a.current_balance ?? 0), 0);

  // 2. Track off-budget movements (emergency funds injected into budget or spent directly)
  let offBudgetInflow = 0;   // Transferred from off-budget accounts into in-budget accounts
  let offBudgetOutflow = 0;  // Transferred from in-budget accounts into off-budget accounts
  let offBudgetExpense = 0;  // Direct expenses paid from off-budget accounts

  // 3. Expense & Income within period (Option B: Pure income excludes debt repayments)
  let totalIncome = 0;
  let debtRepayments = 0;
  let totalExpense = 0;
  for (const t of periodTransactions) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') {
      if (isDebtSettlementTransaction(t, categories)) {
        debtRepayments += amt;
      } else {
        totalIncome += amt;
      }
    } else if (t.type === 'expense') {
      // Only count expense against budget realization if from a budgeted account
      if (!t.account_id || budgetAccountIds.has(t.account_id)) {
        totalExpense += amt;
      } else if (offBudgetAccountIds.has(t.account_id)) {
        offBudgetExpense += amt;
      }
    } else if (t.type === 'transfer') {
      const fromOff = offBudgetAccountIds.has(t.account_id);
      const toIn = t.to_account_id ? budgetAccountIds.has(t.to_account_id) : false;
      const fromIn = budgetAccountIds.has(t.account_id);
      const toOff = t.to_account_id ? offBudgetAccountIds.has(t.to_account_id) : false;

      if (fromOff && toIn) {
        offBudgetInflow += amt;
      } else if (fromIn && toOff) {
        offBudgetOutflow += amt;
      }
    }
  }

  // Also include outstanding receivables funded from budgeted accounts as realized spending in this cycle
  for (const d of debts) {
    if (d.type === 'they_owe' && d.account_id && d.status !== 'paid') {
      if (budgetAccountIds.has(d.account_id)) {
        if (!cycleStartDate || d.date >= cycleStartDate) {
          totalExpense += Number(d.amount) || 0;
        }
      }
    }
  }

  // Effective budget expands when emergency/off-budget funds are injected to in-budget accounts
  const effectiveBudget = Math.max(0, baseBudget + offBudgetInflow - offBudgetOutflow);
  const totalOffBudgetUsed = offBudgetInflow + offBudgetExpense;

  const remainingBudget = effectiveBudget - totalExpense;
  const budgetUsagePercent = effectiveBudget > 0
    ? Math.min(100, Math.round((totalExpense / effectiveBudget) * 100))
    : (totalExpense > 0 ? 100 : 0);
  const netCashFlow = totalIncome - totalExpense;
  const totalCashInflow = totalIncome + debtRepayments;

  // 4. Debts & Receivables
  const todayStr = new Date().toISOString().slice(0, 10);
  let moneyIOwe = 0;
  let moneyOthersOweMe = 0;
  let overdueIOwe = 0;
  let overdueOthersOwe = 0;

  for (const rawDebt of debts) {
    const d = computeDebtDetails(rawDebt);
    const rem = d.remaining_amount ?? 0;
    if (rem > 0) {
      if (d.type === 'i_owe') {
        moneyIOwe += rem;
        if (d.due_date && d.due_date < todayStr) {
          overdueIOwe += rem;
        }
      } else {
        moneyOthersOweMe += rem;
        if (d.due_date && d.due_date < todayStr) {
          overdueOthersOwe += rem;
        }
      }
    }
  }

  return {
    totalBudget,
    baseBudget,
    offBudgetInflow,
    offBudgetOutflow,
    offBudgetExpense,
    totalOffBudgetUsed,
    effectiveBudget,
    totalExpense,
    remainingBudget,
    budgetUsagePercent,
    totalBalance,
    totalIncome,
    debtRepayments,
    totalCashInflow,
    netCashFlow,
    moneyIOwe,
    moneyOthersOweMe,
    overdueIOwe,
    overdueOthersOwe,
    transactionCount: periodTransactions.length,
  };
}

/**
 * Calculate category breakdown for expenses
 */
export function calculateCategorySpending(
  transactions: Transaction[],
  categories: Category[]
): CategorySpending[] {
  const expenseTransactions = transactions.filter((t) => t.type === 'expense');
  const totalExpense = expenseTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const categoryMap = new Map<string, Category>();
  categories.forEach((c) => categoryMap.set(c.id, c));

  const aggregation = new Map<string, { total: number; count: number }>();

  for (const t of expenseTransactions) {
    const catId = t.category_id || 'uncategorized';
    const amt = Number(t.amount) || 0;
    const current = aggregation.get(catId) || { total: 0, count: 0 };
    aggregation.set(catId, {
      total: current.total + amt,
      count: current.count + 1,
    });
  }

  const palette = APP_COLOR_PALETTE;

  const results: CategorySpending[] = [];
  let colorIdx = 0;

  aggregation.forEach((data, catId) => {
    const cat = categoryMap.get(catId);
    const name = cat?.name || (catId === 'uncategorized' ? 'Other / Uncategorized' : 'Deleted Category');
    const color = cat?.color || palette[colorIdx % palette.length];
    colorIdx++;

    const pct = totalExpense > 0 ? (data.total / totalExpense) * 100 : 0;

    results.push({
      categoryId: catId,
      categoryName: name,
      color,
      icon: cat?.icon || undefined,
      total: data.total,
      percentage: Number(pct.toFixed(1)),
      count: data.count,
    });
  });

  return results.sort((a, b) => b.total - a.total);
}

/**
 * Calculate account / pocket breakdown for expenses
 */
export function calculateAccountSpending(
  transactions: Transaction[],
  accounts: Account[]
): {
  accountId: string;
  accountName: string;
  color: string;
  total: number;
  percentage: number;
  count: number;
}[] {
  const expenseTransactions = transactions.filter((t) => t.type === 'expense');
  const totalExpense = expenseTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const accountMap = new Map<string, Account>();
  accounts.forEach((a) => accountMap.set(a.id, a));

  const aggregation = new Map<string, { total: number; count: number }>();

  for (const t of expenseTransactions) {
    const accId = t.account_id || 'unknown';
    const amt = Number(t.amount) || 0;
    const current = aggregation.get(accId) || { total: 0, count: 0 };
    aggregation.set(accId, {
      total: current.total + amt,
      count: current.count + 1,
    });
  }

  const palette = APP_COLOR_PALETTE;
  const results: {
    accountId: string;
    accountName: string;
    color: string;
    total: number;
    percentage: number;
    count: number;
  }[] = [];
  let colorIdx = 0;

  aggregation.forEach((data, accId) => {
    const acc = accountMap.get(accId);
    const name = acc
      ? (acc.pocket_name ? `${acc.name} - ${acc.pocket_name}` : acc.name)
      : (accId === 'unknown' ? 'No Account' : 'Deleted Account');
    // Prioritize pocket_color if account has a pocket, then acc.color, then palette
    const color = (acc?.pocket_name && acc?.pocket_color) || acc?.color || palette[colorIdx % palette.length];
    colorIdx++;

    const pct = totalExpense > 0 ? (data.total / totalExpense) * 100 : 0;

    results.push({
      accountId: accId,
      accountName: name,
      color,
      total: data.total,
      percentage: Number(pct.toFixed(1)),
      count: data.count,
    });
  });

  return results.sort((a, b) => b.total - a.total);
}

/**
 * Calculate 12-month trend for a specific year
 */
export function calculateMonthlyTrend(
  transactions: Transaction[],
  year = new Date().getFullYear(),
  _locale: 'en' | 'id' = 'en',
  categories?: Category[]
): MonthlyComparison[] {
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const results: MonthlyComparison[] = [];

  for (let m = 0; m < 12; m++) {
    const padMonth = (m + 1).toString().padStart(2, '0');
    const monthKey = `${year}-${padMonth}`;
    const monthLabel = `${monthNames[m]} ${year}`;

    let income = 0;
    let expense = 0;

    for (const t of transactions) {
      if (t.date.startsWith(monthKey)) {
        const amt = Number(t.amount) || 0;
        if (t.type === 'income') {
          // Option B: Exclude debt settlement from pure revenue
          if (!isDebtSettlementTransaction(t, categories)) {
            income += amt;
          }
        }
        if (t.type === 'expense') expense += amt;
      }
    }

    results.push({
      monthKey,
      monthLabel,
      income,
      expense,
      net: income - expense,
    });
  }

  return results;
}

/**
 * Calculate daily breakdown for a given date range
 */
export function calculateDailySpending(
  transactions: Transaction[],
  startDate: string,
  endDate: string,
  _locale: 'en' | 'id' = 'en'
): DailySpending[] {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const start = new Date(startDate);
  const end = new Date(endDate);

  const dateMap = new Map<string, { income: number; expense: number; dayName: string }>();

  // Initialize all days in range
  const cur = new Date(start);
  while (cur <= end) {
    const dStr = cur.toISOString().slice(0, 10);
    const dayName = dayLabels[cur.getDay()];
    dateMap.set(dStr, { income: 0, expense: 0, dayName });
    cur.setDate(cur.getDate() + 1);
  }

  for (const t of transactions) {
    if (dateMap.has(t.date)) {
      const entry = dateMap.get(t.date)!;
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') entry.income += amt;
      if (t.type === 'expense') entry.expense += amt;
    }
  }

  const results: DailySpending[] = [];
  dateMap.forEach((val, date) => {
    results.push({
      date,
      dayName: val.dayName,
      income: val.income,
      expense: val.expense,
    });
  });

  return results;
}

/**
 * Calculate investment portfolio summary and enrich active/closed investments with PnL
 */
export function calculateInvestmentSummary(investments: Investment[]): {
  summary: InvestmentPortfolioSummary;
  activeInvestments: Investment[];
  closedInvestments: Investment[];
} {
  let totalCurrentValue = 0;
  let totalInvested = 0;
  let totalUnrealizedPnl = 0;
  let totalRealizedPnl = 0;
  let totalWithdrawn = 0;

  const activeInvestments: Investment[] = [];
  const closedInvestments: Investment[] = [];

  for (const inv of investments) {
    const invested = Number(inv.invested_amount) || 0;
    const currentVal = Number(inv.current_value) || 0;
    const withdrawn = Number(inv.total_withdrawn) || 0;

    if (inv.status === 'active') {
      const pnl = currentVal - invested;
      const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

      totalCurrentValue += currentVal;
      totalInvested += invested;
      totalUnrealizedPnl += pnl;

      activeInvestments.push({
        ...inv,
        unrealized_pnl: pnl,
        unrealized_pnl_percent: pnlPercent,
      });
    } else {
      const pnl = withdrawn - invested;
      const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

      totalWithdrawn += withdrawn;
      totalRealizedPnl += pnl;

      closedInvestments.push({
        ...inv,
        realized_pnl: pnl,
        realized_pnl_percent: pnlPercent,
      });
    }
  }

  const unrealizedPnlPercent = totalInvested > 0 ? (totalUnrealizedPnl / totalInvested) * 100 : 0;

  return {
    summary: {
      totalCurrentValue,
      totalInvested,
      totalUnrealizedPnl,
      unrealizedPnlPercent,
      totalRealizedPnl,
      totalWithdrawn,
      activeCount: activeInvestments.length,
      closedCount: closedInvestments.length,
    },
    activeInvestments,
    closedInvestments,
  };
}

