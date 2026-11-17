import ExcelJS from 'exceljs';
import {
  Account,
  Category,
  Transaction,
  Debt,
  Investment,
  InvestmentLog,
  Cycle,
  MonthlyArchive,
} from '../types';
import {
  calculateAccountBalances,
  calculateCategorySpending,
  calculateMonthlyTrend,
  calculateFinancialSummary,
  computeDebtDetails,
  formatTransactionDescription,
  isDebtSettlementTransaction,
} from '../calculations';

export interface ExportOwnerInfo {
  id?: string;
  name?: string | null;
  email?: string | null;
}

// Build Excel workbook containing summary, transactions, and entity sheets
export function buildFinancialWorkbook({
  accounts,
  categories,
  transactions,
  debts,
  investments = [],
  investmentLogs = [],
  cycles = [],
  monthlyArchives = [],
  periodTitle,
  periodSubtitle,
  ownerInfo,
}: {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  debts: Debt[];
  investments?: Investment[];
  investmentLogs?: InvestmentLog[];
  cycles?: Cycle[];
  monthlyArchives?: MonthlyArchive[];
  periodTitle?: string;
  periodSubtitle?: string;
  ownerInfo?: ExportOwnerInfo;
}): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ownerLabel = ownerInfo?.name
    ? `${ownerInfo.name} (${ownerInfo.email || ''})`
    : (ownerInfo?.email || 'PocketLog User');
  wb.creator = `PocketLog - ${ownerLabel}`;
  wb.lastModifiedBy = ownerLabel;
  wb.created = new Date();
  wb.modified = new Date();

  // Helper styles
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' }, // Light slate
  };
  const headerFont = { bold: true, color: { argb: 'FF0F172A' }, size: 11 };
  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };
  const rupiahFormat = '"Rp "#,##0;[Red]-"Rp "#,##0;"Rp "0';

  // Strict ownership isolation: Guarantee only records belonging to the authenticated user are exported
  const targetUserId = ownerInfo?.id;
  const safeAccounts = targetUserId ? accounts.filter((a) => !a.user_id || a.user_id === targetUserId) : accounts;
  const safeCategories = targetUserId ? categories.filter((c) => !c.user_id || c.user_id === targetUserId) : categories;
  const safeTransactions = targetUserId ? transactions.filter((t) => !t.user_id || t.user_id === targetUserId) : transactions;
  const safeDebts = targetUserId ? debts.filter((d) => !d.user_id || d.user_id === targetUserId) : debts;
  const safeInvestments = targetUserId ? investments.filter((i) => !i.user_id || i.user_id === targetUserId) : investments;
  const safeInvestmentLogs = targetUserId ? investmentLogs.filter((l) => !l.user_id || l.user_id === targetUserId) : investmentLogs;
  const safeCycles = targetUserId ? cycles.filter((c) => !c.user_id || c.user_id === targetUserId) : cycles;
  const safeMonthlyArchives = targetUserId ? monthlyArchives.filter((m) => !m.user_id || m.user_id === targetUserId) : monthlyArchives;

  const accountsWithBalance = calculateAccountBalances(safeAccounts, safeTransactions, safeDebts);
  const summary = calculateFinancialSummary(safeAccounts, safeTransactions, safeTransactions, safeDebts, undefined, safeCategories);
  const categorySpending = calculateCategorySpending(safeTransactions, safeCategories);
  const monthlyTrend = calculateMonthlyTrend(safeTransactions, new Date().getFullYear(), 'en', safeCategories);

  const accountMap = new Map<string, Account>();
  accountsWithBalance.forEach((a) => accountMap.set(a.id, a));

  const getAccountLabel = (a?: Account) => {
    if (!a) return '';
    return a.pocket_name ? `${a.name} - ${a.pocket_name}` : a.name;
  };

  const categoryMap = new Map<string, Category>();
  safeCategories.forEach((c) => categoryMap.set(c.id, c));

  // Sheet 1: Financial Summary
  const wsSummary = wb.addWorksheet('Financial Summary');
  wsSummary.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

  // Title Block
  wsSummary.mergeCells('A1:E1');
  const titleCell = wsSummary.getCell('A1');
  titleCell.value = periodTitle ? `POCKETLOG - ${periodTitle.toUpperCase()}` : 'PERSONAL FINANCIAL REPORT (POCKETLOG)';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };

  const ownerSuffix = ownerInfo?.email ? `  |  Owner: ${ownerInfo.email}` : '';
  const exportInfo = periodSubtitle 
    ? `Period: ${periodSubtitle}  |  Export Date: ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}${ownerSuffix}`
    : `Export Date: ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}${ownerSuffix}`;
  wsSummary.getCell('A2').value = exportInfo;
  wsSummary.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF64748B' } };

  // KPI Table Headers
  const kpiHeaders = ['Financial Indicator', 'Amount (IDR)', 'Description'];
  const kpiRow = wsSummary.getRow(4);
  kpiHeaders.forEach((h, idx) => {
    const cell = kpiRow.getCell(idx + 1);
    cell.value = h;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = borderThin;
  });

  const netWorthValue = summary.totalBalance + summary.moneyOthersOweMe - summary.moneyIOwe;

  const kpiData = [
    ['Total Balance Across All Accounts', summary.totalBalance, 'Current total liquid assets'],
    ['Base Budget Allocated', summary.baseBudget, 'Allocated monthly budget for active budget accounts'],
    ...(summary.offBudgetInflow ? [['Emergency / Outside Allocation Inflow', summary.offBudgetInflow, 'Emergency reserves injected into budget accounts']] : []),
    ['Effective Total Budget', summary.effectiveBudget, 'Total spending budget capacity (Base + Outside Inflows)'],
    ['Remaining Budget', summary.remainingBudget, 'Unspent budget capacity'],
    ['Total Pure Income', summary.totalIncome, 'Accumulated earnings (excluding debt repayments)'],
    ...(summary.debtRepayments ? [['Receivables Repaid Received', summary.debtRepayments, 'Cash recovered from loans (asset return, not revenue)']] : []),
    ['Total Expense', summary.totalExpense, 'Accumulated recorded expenses'],
    ['Net Cash Flow', summary.netCashFlow, 'Pure Income minus Expenses'],
    ['Receivables (Money Lent to Others)', summary.moneyOthersOweMe, 'Money others owe to you'],
    ['Debts & Loans (Money I Owe)', summary.moneyIOwe, 'Outstanding payment liabilities'],
    ['Net Worth', netWorthValue, 'Total Balance + Receivables - Debts'],
  ];

  kpiData.forEach((rowVal) => {
    const row = wsSummary.addRow(rowVal);
    row.getCell(2).numFmt = rupiahFormat;
    row.getCell(2).font = { bold: true };
    row.eachCell((cell) => {
      cell.border = borderThin;
    });
  });

  wsSummary.columns = [
    { key: 'indicator', width: 35 },
    { key: 'value', width: 25 },
    { key: 'desc', width: 45 },
  ];

  // Sheet 2: Transactions
  const wsTx = wb.addWorksheet('Transactions');
  wsTx.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  wsTx.columns = [
    { header: 'No', key: 'no', width: 8 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Source Account', key: 'account', width: 25 },
    { header: 'Destination Account', key: 'to_account', width: 25 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Amount (IDR)', key: 'amount', width: 20 },
    { header: 'Description', key: 'description', width: 35 },
    { header: 'Transaction ID', key: 'id', width: 38, hidden: true },
    { header: 'Account ID', key: 'account_id', width: 38, hidden: true },
    { header: 'To Account ID', key: 'to_account_id', width: 38, hidden: true },
    { header: 'Category ID', key: 'category_id', width: 38, hidden: true },
  ];

  const txHeaderRow = wsTx.getRow(1);
  txHeaderRow.height = 24;
  txHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = borderThin;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  safeTransactions.forEach((t, idx) => {
    const acc = getAccountLabel(accountMap.get(t.account_id)) || t.account_id;
    const toAcc = t.to_account_id ? getAccountLabel(accountMap.get(t.to_account_id)) || t.to_account_id : '-';
    const cat = t.category_id ? categoryMap.get(t.category_id)?.name || t.category_id : '-';

    const row = wsTx.addRow({
      no: idx + 1,
      date: t.date,
      type: t.type.toUpperCase(),
      account: acc,
      to_account: toAcc,
      category: cat,
      amount: Number(t.amount),
      description: formatTransactionDescription(t.description),
      id: t.id,
      account_id: t.account_id,
      to_account_id: t.to_account_id || '',
      category_id: t.category_id || '',
    });

    row.getCell('no').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('amount').numFmt = rupiahFormat;
    row.eachCell((cell) => {
      cell.border = borderThin;
    });
  });

  // Sheet 3: Categories
  const wsRawCat = wb.addWorksheet('Categories');
  wsRawCat.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  wsRawCat.columns = [
    { header: 'No', key: 'no', width: 8 },
    { header: 'Category Name', key: 'name', width: 28 },
    { header: 'Type', key: 'type', width: 16 },
    { header: 'Color Hex', key: 'color', width: 16 },
    { header: 'Icon', key: 'icon', width: 20 },
    { header: 'Is Default', key: 'is_default', width: 14 },
    { header: 'Category ID', key: 'id', width: 38, hidden: true },
  ];

  wsRawCat.getRow(1).height = 24;
  wsRawCat.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = borderThin;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  safeCategories.forEach((c, idx) => {
    const row = wsRawCat.addRow({
      no: idx + 1,
      name: c.name,
      type: c.type.toUpperCase(),
      color: c.color || '',
      icon: c.icon || '',
      is_default: c.is_default ? 'TRUE' : 'FALSE',
      id: c.id,
    });
    row.getCell('no').alignment = { vertical: 'middle', horizontal: 'center' };
    row.eachCell((cell) => {
      cell.border = borderThin;
    });
  });

  // Sheet 4: Accounts & Wallets
  const wsAcc = wb.addWorksheet('Accounts');
  wsAcc.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  wsAcc.columns = [
    { header: 'No', key: 'no', width: 8 },
    { header: 'Account Name', key: 'name', width: 25 },
    { header: 'Pocket Name', key: 'pocket', width: 22 },
    { header: 'Type', key: 'type', width: 16 },
    { header: 'Initial Balance', key: 'initial', width: 20 },
    { header: 'Current Balance (IDR)', key: 'current', width: 24 },
    { header: 'Color Hex', key: 'color', width: 16 },
    { header: 'Pocket Color Hex', key: 'pocket_color', width: 18 },
    { header: 'In Budget', key: 'include_in_budget', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Account ID', key: 'id', width: 38, hidden: true },
  ];

  wsAcc.getRow(1).height = 24;
  wsAcc.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = borderThin;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  accountsWithBalance.forEach((a, idx) => {
    const row = wsAcc.addRow({
      no: idx + 1,
      name: a.name,
      pocket: a.pocket_name || '-',
      type: a.type.toUpperCase(),
      initial: Number(a.initial_balance),
      current: a.current_balance ?? Number(a.initial_balance),
      color: a.color || '',
      pocket_color: a.pocket_color || '',
      include_in_budget: a.include_in_budget !== false ? 'TRUE' : 'FALSE',
      status: a.is_active ? 'ACTIVE' : 'INACTIVE',
      id: a.id,
    });
    row.getCell('no').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('initial').numFmt = rupiahFormat;
    row.getCell('current').numFmt = rupiahFormat;
    row.getCell('current').font = { bold: true };
    row.eachCell((cell) => {
      cell.border = borderThin;
    });
  });

  // Sheet 5: Debts & Loans
  const wsDebts = wb.addWorksheet('Debts & Loans');
  wsDebts.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  wsDebts.columns = [
    { header: 'No', key: 'no', width: 8 },
    { header: 'Type', key: 'type', width: 22 },
    { header: 'Contact / Person', key: 'person', width: 24 },
    { header: 'Amount', key: 'amount', width: 20 },
    { header: 'Remaining Balance', key: 'remaining', width: 20 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Due Date', key: 'due_date', width: 14 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Account', key: 'account', width: 25 },
    { header: 'Description', key: 'description', width: 35 },
    { header: 'Debt ID', key: 'id', width: 38, hidden: true },
    { header: 'Account ID', key: 'account_id', width: 38, hidden: true },
  ];

  wsDebts.getRow(1).height = 24;
  wsDebts.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = borderThin;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  safeDebts.forEach((rawDebt, idx) => {
    const d = computeDebtDetails(rawDebt);
    const accLabel = d.account_id ? (getAccountLabel(accountMap.get(d.account_id)) || d.account_id) : '-';
    const row = wsDebts.addRow({
      no: idx + 1,
      type: d.type === 'i_owe' ? 'Debt (I Owe)' : 'Receivable (They Owe)',
      person: d.person,
      amount: Number(d.amount),
      remaining: d.remaining_amount ?? Number(d.amount),
      date: d.date,
      due_date: d.due_date || '-',
      status: d.status.toUpperCase(),
      account: accLabel,
      description: d.description || '-',
      id: d.id,
      account_id: d.account_id || '',
    });

    row.getCell('no').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('amount').numFmt = rupiahFormat;
    row.getCell('remaining').numFmt = rupiahFormat;
    row.getCell('remaining').font = { bold: true };
    row.eachCell((cell) => {
      cell.border = borderThin;
    });
  });

  // Sheet 6: Investments
  if (safeInvestments.length > 0) {
    const wsInv = wb.addWorksheet('Investments');
    wsInv.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    wsInv.columns = [
      { header: 'No', key: 'no', width: 8 },
      { header: 'Asset Name', key: 'name', width: 28 },
      { header: 'Asset Type', key: 'type', width: 18 },
      { header: 'Platform', key: 'platform', width: 20 },
      { header: 'Invested Amount (IDR)', key: 'invested', width: 22 },
      { header: 'Current Value (IDR)', key: 'current', width: 22 },
      { header: 'Total Withdrawn (IDR)', key: 'withdrawn', width: 22 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Start Date', key: 'start_date', width: 14 },
      { header: 'Closed Date', key: 'closed_date', width: 14 },
      { header: 'Notes', key: 'notes', width: 35 },
      { header: 'Investment ID', key: 'id', width: 38, hidden: true },
    ];

    wsInv.getRow(1).height = 24;
    wsInv.getRow(1).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = borderThin;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    safeInvestments.forEach((inv, idx) => {
      const row = wsInv.addRow({
        no: idx + 1,
        name: inv.name,
        type: inv.type,
        platform: inv.platform || '-',
        invested: Number(inv.invested_amount),
        current: Number(inv.current_value),
        withdrawn: Number(inv.total_withdrawn),
        status: inv.status.toUpperCase(),
        start_date: inv.start_date,
        closed_date: inv.closed_date || '-',
        notes: inv.notes || '',
        id: inv.id,
      });
      row.getCell('no').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('invested').numFmt = rupiahFormat;
      row.getCell('current').numFmt = rupiahFormat;
      row.getCell('withdrawn').numFmt = rupiahFormat;
      row.eachCell((cell) => {
        cell.border = borderThin;
      });
    });
  }

  // Sheet 7: Payday & Budget Cycles
  if (safeCycles.length > 0) {
    const wsCycles = wb.addWorksheet('Cycles');
    wsCycles.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    wsCycles.columns = [
      { header: 'No', key: 'no', width: 8 },
      { header: 'Cycle Name', key: 'name', width: 25 },
      { header: 'Start Date', key: 'start_date', width: 16 },
      { header: 'End Date', key: 'end_date', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Cycle ID', key: 'id', width: 38, hidden: true },
    ];

    wsCycles.getRow(1).height = 24;
    wsCycles.getRow(1).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = borderThin;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    safeCycles.forEach((cyc, idx) => {
      const row = wsCycles.addRow({
        no: idx + 1,
        name: cyc.name || '-',
        start_date: cyc.start_date,
        end_date: cyc.end_date || '-',
        status: cyc.is_active ? 'ACTIVE' : 'INACTIVE',
        id: cyc.id,
      });
      row.getCell('no').alignment = { vertical: 'middle', horizontal: 'center' };
      row.eachCell((cell) => {
        cell.border = borderThin;
      });
    });
  }

  // Sheet 8: Investment Logs
  if (safeInvestmentLogs.length > 0) {
    const wsInvLogs = wb.addWorksheet('Investment Logs');
    wsInvLogs.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    wsInvLogs.columns = [
      { header: 'No', key: 'no', width: 8 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Investment', key: 'investment', width: 28 },
      { header: 'Type', key: 'type', width: 18 },
      { header: 'Value (IDR)', key: 'value', width: 20 },
      { header: 'Amount (IDR)', key: 'amount', width: 20 },
      { header: 'Funding Account', key: 'account', width: 25 },
      { header: 'Notes', key: 'notes', width: 35 },
      { header: 'Log ID', key: 'id', width: 38, hidden: true },
      { header: 'Investment ID', key: 'investment_id', width: 38, hidden: true },
      { header: 'Account ID', key: 'account_id', width: 38, hidden: true },
    ];

    wsInvLogs.getRow(1).height = 24;
    wsInvLogs.getRow(1).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = borderThin;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const invMap = new Map<string, Investment>();
    safeInvestments.forEach((i) => invMap.set(i.id, i));

    safeInvestmentLogs.forEach((log, idx) => {
      const invName = invMap.get(log.investment_id)?.name || log.investment_id;
      const accLabel = log.account_id ? (getAccountLabel(accountMap.get(log.account_id)) || log.account_id) : '-';

      const row = wsInvLogs.addRow({
        no: idx + 1,
        date: log.date,
        investment: invName,
        type: log.type.toUpperCase(),
        value: Number(log.value),
        amount: Number(log.amount),
        account: accLabel,
        notes: log.notes || '-',
        id: log.id,
        investment_id: log.investment_id,
        account_id: log.account_id || '',
      });

      row.getCell('no').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('value').numFmt = rupiahFormat;
      row.getCell('amount').numFmt = rupiahFormat;
      row.eachCell((cell) => {
        cell.border = borderThin;
      });
    });
  }

  // Sheet 9: Monthly Archives (Closing Snapshots)
  if (safeMonthlyArchives.length > 0) {
    const wsArchives = wb.addWorksheet('Monthly Archives');
    wsArchives.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    wsArchives.columns = [
      { header: 'No', key: 'no', width: 8 },
      { header: 'Period', key: 'period', width: 14 },
      { header: 'Period Label', key: 'period_label', width: 22 },
      { header: 'Start Date', key: 'start_date', width: 14 },
      { header: 'End Date', key: 'end_date', width: 14 },
      { header: 'Total Income (IDR)', key: 'total_income', width: 20 },
      { header: 'Total Expense (IDR)', key: 'total_expense', width: 20 },
      { header: 'Transactions Count', key: 'transaction_count', width: 18 },
      { header: 'Created At', key: 'created_at', width: 22 },
      { header: 'Archive ID', key: 'id', width: 38, hidden: true },
      { header: 'Snapshot JSON', key: 'data_snapshot', width: 30, hidden: true },
    ];

    wsArchives.getRow(1).height = 24;
    wsArchives.getRow(1).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = borderThin;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    safeMonthlyArchives.forEach((arch, idx) => {
      const row = wsArchives.addRow({
        no: idx + 1,
        period: arch.period,
        period_label: arch.period_label,
        start_date: arch.start_date,
        end_date: arch.end_date,
        total_income: Number(arch.total_income) || 0,
        total_expense: Number(arch.total_expense) || 0,
        transaction_count: arch.transaction_count || (arch.data_snapshot?.length || 0),
        created_at: arch.created_at || new Date().toISOString(),
        id: arch.id,
        data_snapshot: JSON.stringify(arch.data_snapshot || []),
      });

      row.getCell('no').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('total_income').numFmt = rupiahFormat;
      row.getCell('total_expense').numFmt = rupiahFormat;
      row.eachCell((cell) => {
        cell.border = borderThin;
      });
    });
  }

  // Sheet 10: Category Spending Analytics
  const wsCat = wb.addWorksheet('Category Spending');
  wsCat.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  wsCat.columns = [
    { header: 'No', key: 'no', width: 8 },
    { header: 'Category', key: 'category', width: 30 },
    { header: 'Total Spending', key: 'total', width: 22 },
    { header: 'Percentage (%)', key: 'percentage', width: 16 },
    { header: 'Transaction Count', key: 'count', width: 18 },
  ];

  wsCat.getRow(1).height = 24;
  wsCat.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = borderThin;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  categorySpending.forEach((cs, idx) => {
    const row = wsCat.addRow({
      no: idx + 1,
      category: cs.categoryName,
      total: cs.total,
      percentage: `${cs.percentage}%`,
      count: cs.count,
    });
    row.getCell('no').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('total').numFmt = rupiahFormat;
    row.eachCell((cell) => {
      cell.border = borderThin;
    });
  });

  // Sheet 10: Income
  const wsIncome = wb.addWorksheet('Income');
  wsIncome.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  wsIncome.columns = [
    { header: 'No', key: 'no', width: 8 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Category', key: 'category', width: 24 },
    { header: 'Account', key: 'account', width: 25 },
    { header: 'Amount (IDR)', key: 'amount', width: 20 },
    { header: 'Description', key: 'description', width: 35 },
  ];

  wsIncome.getRow(1).height = 24;
  wsIncome.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = borderThin;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const incomeTx = safeTransactions.filter((t) => t.type === 'income' && !isDebtSettlementTransaction(t, safeCategories));
  incomeTx.forEach((t, idx) => {
    const acc = getAccountLabel(accountMap.get(t.account_id)) || t.account_id;
    const cat = t.category_id ? categoryMap.get(t.category_id)?.name || t.category_id : '-';
    const row = wsIncome.addRow({
      no: idx + 1,
      date: t.date,
      category: cat,
      account: acc,
      amount: Number(t.amount),
      description: formatTransactionDescription(t.description),
    });
    row.getCell('no').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('amount').numFmt = rupiahFormat;
    row.eachCell((cell) => {
      cell.border = borderThin;
    });
  });

  // Sheet 11: Monthly Summary
  const wsMonth = wb.addWorksheet('Monthly Summary');
  wsMonth.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  wsMonth.columns = [
    { header: 'No', key: 'no', width: 8 },
    { header: 'Month', key: 'month', width: 18 },
    { header: 'Total Income', key: 'income', width: 22 },
    { header: 'Total Expense', key: 'expense', width: 22 },
    { header: 'Net Cash Flow', key: 'net', width: 22 },
  ];

  wsMonth.getRow(1).height = 24;
  wsMonth.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = borderThin;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  monthlyTrend.forEach((m, idx) => {
    const row = wsMonth.addRow({
      no: idx + 1,
      month: m.monthLabel,
      income: m.income,
      expense: m.expense,
      net: m.net,
    });
    row.getCell('no').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('income').numFmt = rupiahFormat;
    row.getCell('expense').numFmt = rupiahFormat;
    row.getCell('net').numFmt = rupiahFormat;
    row.getCell('net').font = { bold: true };
    row.eachCell((cell) => {
      cell.border = borderThin;
    });
  });

  return wb;
}

/**
 * Trigger download of an existing ExcelJS Workbook instance in browser
 */
export async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Generate a comprehensive, multi-sheet, beautifully styled Excel workbook and trigger browser download
 */
export async function exportFinancialWorkbook({
  accounts,
  categories,
  transactions,
  debts,
  investments = [],
  investmentLogs = [],
  cycles = [],
  monthlyArchives = [],
  filename = 'PocketLog_Financial_Report.xlsx',
  periodTitle,
  periodSubtitle,
  ownerInfo,
}: {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  debts: Debt[];
  investments?: Investment[];
  investmentLogs?: InvestmentLog[];
  cycles?: Cycle[];
  monthlyArchives?: MonthlyArchive[];
  filename?: string;
  periodTitle?: string;
  periodSubtitle?: string;
  ownerInfo?: ExportOwnerInfo;
}): Promise<void> {
  const wb = buildFinancialWorkbook({
    accounts,
    categories,
    transactions,
    debts,
    investments,
    investmentLogs,
    cycles,
    monthlyArchives,
    periodTitle,
    periodSubtitle,
    ownerInfo,
  });

  await downloadWorkbook(wb, filename);
}
