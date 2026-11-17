import ExcelJS from 'exceljs';
import {
  Account,
  Category,
  Transaction,
  TransactionType,
  Debt,
  Investment,
  InvestmentLog,
  Cycle,
  MonthlyArchive,
  AccountType,
} from '../types';

export interface ImportRowResult {
  rowNumber: number;
  data?: Omit<Transaction, 'id' | 'created_at'>;
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
  willAutoCreateAccount?: boolean;
  raw: {
    date: string;
    type: string;
    amount: string | number;
    account: string;
    toAccount?: string;
    category?: string;
    description?: string;
  };
}

export interface ImportValidationResult {
  totalRows: number;
  validRows: ImportRowResult[];
  invalidRows: ImportRowResult[];
  duplicateRows: ImportRowResult[];
  itemsToImport: Omit<Transaction, 'id' | 'created_at'>[];
  autoCreateAccounts: Array<{ name: string; type: AccountType; color: string }>;
  autoCreateCategories: Array<{ name: string; type: 'expense' | 'income'; color: string }>;
}

export interface MasterBackupPayload {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  debts: Debt[];
  investments: Investment[];
  investmentLogs: InvestmentLog[];
  cycles: Cycle[];
  cycleStartDate?: string;
  monthlyArchives: MonthlyArchive[];
}

export interface MasterBackupDetectionResult {
  isMasterBackup: boolean;
  isGlobalBackup?: boolean;
  rawPayload?: any;
  backupPayload?: MasterBackupPayload;
  summary?: {
    usersCount?: number;
    accountsCount: number;
    categoriesCount: number;
    transactionsCount: number;
    debtsCount: number;
    investmentsCount: number;
    cyclesCount: number;
    archivesCount: number;
  };
}

/**
 * Generate a clean Excel import template with sample rows and instructions
 */
export async function downloadImportTemplate(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Transactions Template');

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0284C7' }, // Clean brand blue
  };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

  ws.columns = [
    { header: 'Date (YYYY-MM-DD)*', key: 'date', width: 22 },
    { header: 'Type (INCOME/EXPENSE/TRANSFER)*', key: 'type', width: 30 },
    { header: 'Amount (IDR)*', key: 'amount', width: 18 },
    { header: 'Source Account*', key: 'account', width: 24 },
    { header: 'Destination Account (For Transfer)', key: 'to_account', width: 34 },
    { header: 'Category', key: 'category', width: 24 },
    { header: 'Description', key: 'description', width: 35 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Add sample demonstration rows
  ws.addRow({
    date: '2026-09-01',
    type: 'INCOME',
    amount: 10000000,
    account: 'Bank BCA',
    to_account: '',
    category: 'Monthly Salary',
    description: 'September Monthly Salary',
  });

  ws.addRow({
    date: '2026-09-02',
    type: 'EXPENSE',
    amount: 75000,
    account: 'Cash Wallet',
    to_account: '',
    category: 'Food & Drinks',
    description: 'Team lunch',
  });

  ws.addRow({
    date: '2026-09-03',
    type: 'TRANSFER',
    amount: 500000,
    account: 'Bank BCA',
    to_account: 'Cash Wallet',
    category: '',
    description: 'ATM Cash Withdrawal',
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pocketlog_transactions_template.xlsx';
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Helper to test if a string is a valid UUID
 */
export function isValidUuid(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim());
}

/**
 * Inspect uploaded file to detect if it contains a Master Backup (JSON or multi-sheet Excel)
 */
export async function detectAndParseMasterBackup(file: File): Promise<MasterBackupDetectionResult> {
  const fileName = file.name.toLowerCase();

  // 1. Check JSON format
  if (fileName.endsWith('.json')) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const tbls = parsed.tables || {};
      const isGlobal = Boolean(
        parsed.type === 'POCKETLOG_GLOBAL_DATABASE_BACKUP' ||
        parsed.scope === 'ALL_USERS_AND_ALL_TABLES' ||
        (tbls && Array.isArray(tbls.users))
      );

      const accounts: Account[] = Array.isArray(parsed.accounts)
        ? parsed.accounts
        : Array.isArray(tbls.accounts)
        ? tbls.accounts
        : [];
      const categories: Category[] = Array.isArray(parsed.categories)
        ? parsed.categories
        : Array.isArray(tbls.categories)
        ? tbls.categories
        : [];
      const transactions: Transaction[] = Array.isArray(parsed.transactions)
        ? parsed.transactions
        : Array.isArray(tbls.transactions)
        ? tbls.transactions
        : [];
      const debts: Debt[] = Array.isArray(parsed.debts)
        ? parsed.debts
        : Array.isArray(tbls.debts)
        ? tbls.debts
        : [];
      const investments: Investment[] = Array.isArray(parsed.investments)
        ? parsed.investments
        : Array.isArray(tbls.investments)
        ? tbls.investments
        : [];
      const investmentLogs: InvestmentLog[] = Array.isArray(parsed.investmentLogs)
        ? parsed.investmentLogs
        : Array.isArray(tbls.investment_logs)
        ? tbls.investment_logs
        : [];
      const cycles: Cycle[] = Array.isArray(parsed.cycles)
        ? parsed.cycles
        : Array.isArray(tbls.cycles)
        ? tbls.cycles
        : [];
      const monthlyArchives: MonthlyArchive[] = Array.isArray(parsed.monthlyArchives)
        ? parsed.monthlyArchives
        : Array.isArray(tbls.monthly_archives)
        ? tbls.monthly_archives
        : [];
      const cycleStartDate: string | undefined = typeof parsed.cycleStartDate === 'string' ? parsed.cycleStartDate : undefined;
      const usersCount = Array.isArray(tbls.users) ? tbls.users.length : parsed.owner ? 1 : 0;

      const hasContent =
        accounts.length > 0 ||
        categories.length > 0 ||
        transactions.length > 0 ||
        debts.length > 0 ||
        investments.length > 0 ||
        isGlobal;

      if (hasContent) {
        return {
          isMasterBackup: true,
          isGlobalBackup: isGlobal,
          rawPayload: parsed,
          backupPayload: {
            accounts,
            categories,
            transactions,
            debts,
            investments,
            investmentLogs,
            cycles,
            cycleStartDate,
            monthlyArchives,
          },
          summary: {
            usersCount,
            accountsCount: accounts.length,
            categoriesCount: categories.length,
            transactionsCount: transactions.length,
            debtsCount: debts.length,
            investmentsCount: investments.length,
            cyclesCount: cycles.length,
            archivesCount: monthlyArchives.length,
          },
        };
      }
    } catch {
      // Not a valid master JSON, proceed to standard handlers
    }
  }

  // 2. Check Excel format (.xlsx / .xls)
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    try {
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);

      const wsAcc = wb.worksheets.find((w) => w.name.toLowerCase() === 'accounts' || w.name.toLowerCase() === 'rekening');
      const wsCat = wb.worksheets.find((w) => w.name.toLowerCase() === 'categories' || w.name.toLowerCase() === 'kategori');
      const wsTx = wb.worksheets.find((w) => w.name.toLowerCase().includes('transaction') || w.name.toLowerCase().includes('transaksi'));
      const wsDebts = wb.worksheets.find((w) => w.name.toLowerCase().includes('debt') || w.name.toLowerCase().includes('hutang'));
      const wsInv = wb.worksheets.find((w) => w.name.toLowerCase().includes('invest') && !w.name.toLowerCase().includes('log'));
      const wsInvLogs = wb.worksheets.find((w) => w.name.toLowerCase().includes('investment log') || w.name.toLowerCase().includes('log investasi'));
      const wsCycles = wb.worksheets.find((w) => w.name.toLowerCase().includes('cycle') || w.name.toLowerCase().includes('siklus'));
      const wsArchives = wb.worksheets.find((w) => w.name.toLowerCase().includes('archive') || w.name.toLowerCase().includes('arsip'));

      // If both accounts and transactions/categories sheets exist, it's a full workbook backup!
      if (wsAcc || (wsCat && wsTx)) {
        const accounts: Account[] = [];
        const categories: Category[] = [];
        const transactions: Transaction[] = [];
        const debts: Debt[] = [];
        const investments: Investment[] = [];
        const investmentLogs: InvestmentLog[] = [];
        const cycles: Cycle[] = [];
        const monthlyArchives: MonthlyArchive[] = [];

        // Parse Accounts sheet
        if (wsAcc) {
          const accHeaderRow = wsAcc.getRow(1);
          const colIdx: Record<string, number> = {};
          accHeaderRow.eachCell((c, i) => {
            const val = c.text?.toLowerCase().trim() || '';
            if (val.includes('account id') || val === 'id') colIdx.id = i;
            else if (val === 'no' || val === 'no.') colIdx.no = i;
            else if (val.includes('account name') || val === 'name') colIdx.name = i;
            else if (val.includes('pocket name') || val === 'pocket') colIdx.pocket = i;
            else if (val.includes('type') || val === 'tipe') colIdx.type = i;
            else if (val.includes('initial') || val.includes('saldo awal')) colIdx.initial = i;
            else if (val.includes('pocket color') || val.includes('warna pocket')) colIdx.pocketColor = i;
            else if (val.includes('color hex') || val.includes('color') || val.includes('warna')) colIdx.color = i;
            else if (val.includes('budget') || val.includes('in budget')) colIdx.inBudget = i;
            else if (val.includes('status')) colIdx.status = i;
          });

          wsAcc.eachRow((row, rNum) => {
            if (rNum === 1) return;
            const name = (row.getCell(colIdx.name || 2).text || '').trim();
            if (!name) return;

            const rawId = (row.getCell(colIdx.id || 1).text || '').trim();
            const pocketName = (row.getCell(colIdx.pocket || 3).text || '').trim();
            const rawType = (row.getCell(colIdx.type || 4).text || 'bank').toLowerCase().trim();
            const rawInitial = row.getCell(colIdx.initial || 5).value;
            const color = (row.getCell(colIdx.color || 7).text || '').trim();
            const pocketColor = (row.getCell(colIdx.pocketColor || 8).text || '').trim();
            const rawInBudget = (row.getCell(colIdx.inBudget || 9).text || 'TRUE').toUpperCase().trim();
            const rawStatus = (row.getCell(colIdx.status || 10).text || 'ACTIVE').toUpperCase().trim();

            let cleanType: AccountType = 'bank';
            if (rawType.includes('cash') || rawType.includes('tunai')) cleanType = 'cash';
            else if (rawType.includes('ewallet') || rawType.includes('dompet digital')) cleanType = 'ewallet';
            else if (rawType.includes('invest')) cleanType = 'investment';
            else if (rawType.includes('other') || rawType.includes('lain')) cleanType = 'other';

            let numInitial = 0;
            if (typeof rawInitial === 'number') numInitial = rawInitial;
            else if (typeof rawInitial === 'string') numInitial = parseFloat(rawInitial.replace(/[^0-9.-]+/g, '')) || 0;

            accounts.push({
              id: isValidUuid(rawId) ? rawId : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `acc_${Date.now()}_${rNum}`),
              name,
              type: cleanType,
              initial_balance: numInitial,
              color: color || null,
              pocket_name: pocketName && pocketName !== '-' ? pocketName : null,
              pocket_color: pocketColor && pocketColor !== '-' ? pocketColor : null,
              include_in_budget: rawInBudget !== 'FALSE',
              is_active: rawStatus !== 'INACTIVE',
            });
          });
        }

        // Parse Categories sheet
        if (wsCat) {
          const catHeaderRow = wsCat.getRow(1);
          const colIdx: Record<string, number> = {};
          catHeaderRow.eachCell((c, i) => {
            const val = c.text?.toLowerCase().trim() || '';
            if (val.includes('category id') || val === 'id') colIdx.id = i;
            else if (val === 'no' || val === 'no.') colIdx.no = i;
            else if (val.includes('category name') || val === 'name') colIdx.name = i;
            else if (val.includes('type') || val === 'tipe') colIdx.type = i;
            else if (val.includes('color') || val.includes('warna')) colIdx.color = i;
            else if (val.includes('icon') || val === 'ikon') colIdx.icon = i;
            else if (val.includes('default')) colIdx.isDefault = i;
          });

          wsCat.eachRow((row, rNum) => {
            if (rNum === 1) return;
            const name = (row.getCell(colIdx.name || 2).text || '').trim();
            if (!name) return;

            const rawId = (row.getCell(colIdx.id || 1).text || '').trim();
            const rawType = (row.getCell(colIdx.type || 3).text || 'EXPENSE').toLowerCase().trim();
            const color = (row.getCell(colIdx.color || 4).text || '').trim();
            const icon = (row.getCell(colIdx.icon || 5).text || '').trim();
            const rawDef = (row.getCell(colIdx.isDefault || 6).text || 'FALSE').toUpperCase().trim();

            categories.push({
              id: isValidUuid(rawId) ? rawId : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cat_${Date.now()}_${rNum}`),
              name,
              type: rawType.includes('income') || rawType.includes('pemasukan') ? 'income' : 'expense',
              color: color || null,
              icon: icon || null,
              is_default: rawDef === 'TRUE',
            });
          });
        }

        // Parse Investments sheet
        if (wsInv) {
          const invHeaderRow = wsInv.getRow(1);
          const colIdx: Record<string, number> = {};
          invHeaderRow.eachCell((c, i) => {
            const val = c.text?.toLowerCase().trim() || '';
            if (val.includes('investment id') || val === 'id') colIdx.id = i;
            else if (val.includes('asset name') || val === 'name') colIdx.name = i;
            else if (val.includes('type') || val === 'tipe') colIdx.type = i;
            else if (val.includes('platform')) colIdx.platform = i;
            else if (val.includes('invested')) colIdx.invested = i;
            else if (val.includes('current')) colIdx.current = i;
            else if (val.includes('withdrawn')) colIdx.withdrawn = i;
            else if (val.includes('status')) colIdx.status = i;
            else if (val.includes('start date')) colIdx.startDate = i;
            else if (val.includes('closed date')) colIdx.closedDate = i;
            else if (val.includes('notes')) colIdx.notes = i;
          });

          wsInv.eachRow((row, rNum) => {
            if (rNum === 1) return;
            const name = (row.getCell(colIdx.name || 2).text || '').trim();
            if (!name) return;

            const rawId = (row.getCell(colIdx.id || 1).text || '').trim();
            const type = (row.getCell(colIdx.type || 3).text || 'mutual_fund').toLowerCase().trim() as any;
            const platform = (row.getCell(colIdx.platform || 4).text || '').trim();
            const rawInvested = row.getCell(colIdx.invested || 5).value;
            const rawCurrent = row.getCell(colIdx.current || 6).value;
            const rawWithdrawn = row.getCell(colIdx.withdrawn || 7).value;
            const rawStatus = (row.getCell(colIdx.status || 8).text || 'ACTIVE').toLowerCase().trim();
            const startDate = (row.getCell(colIdx.startDate || 9).text || '').trim() || new Date().toISOString().slice(0, 10);
            const closedDate = (row.getCell(colIdx.closedDate || 10).text || '').trim();
            const notes = (row.getCell(colIdx.notes || 11).text || '').trim();

            const numClean = (val: any) => {
              if (typeof val === 'number') return val;
              if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.-]+/g, '')) || 0;
              return 0;
            };

            investments.push({
              id: isValidUuid(rawId) ? rawId : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `inv_${Date.now()}_${rNum}`),
              name,
              type,
              platform: platform && platform !== '-' ? platform : null,
              invested_amount: numClean(rawInvested),
              current_value: numClean(rawCurrent),
              total_withdrawn: numClean(rawWithdrawn),
              status: rawStatus.includes('closed') ? 'closed' : 'active',
              start_date: startDate,
              closed_date: closedDate && closedDate !== '-' ? closedDate : null,
              notes: notes || null,
            });
          });
        }

        // Parse Debts sheet
        if (wsDebts) {
          const debtHeaderRow = wsDebts.getRow(1);
          const colIdx: Record<string, number> = {};
          debtHeaderRow.eachCell((c, i) => {
            const val = c.text?.toLowerCase().trim() || '';
            if (val.includes('debt id') || val === 'id') colIdx.id = i;
            else if (val.includes('type') || val === 'tipe') colIdx.type = i;
            else if (val.includes('contact') || val.includes('person')) colIdx.person = i;
            else if (val.includes('amount') || val.includes('nominal')) colIdx.amount = i;
            else if (val.includes('remaining') || val.includes('sisa')) colIdx.remaining = i;
            else if (val.includes('due date')) colIdx.dueDate = i;
            else if (val.includes('date') || val.includes('tanggal')) colIdx.date = i;
            else if (val.includes('status')) colIdx.status = i;
            else if (val.includes('account id')) colIdx.accountId = i;
            else if (val.includes('account')) colIdx.account = i;
            else if (val.includes('description') || val.includes('keterangan')) colIdx.desc = i;
          });

          wsDebts.eachRow((row, rNum) => {
            if (rNum === 1) return;
            const person = (row.getCell(colIdx.person || 3).text || '').trim();
            if (!person) return;

            const rawId = colIdx.id ? (row.getCell(colIdx.id).text || '').trim() : '';
            const rawType = (row.getCell(colIdx.type || 2).text || '').toLowerCase().trim();
            const rawAmount = row.getCell(colIdx.amount || 4).value;
            const rawRemaining = row.getCell(colIdx.remaining || 5).value;
            const date = (row.getCell(colIdx.date || 6).text || '').trim() || new Date().toISOString().slice(0, 10);
            const dueDate = (row.getCell(colIdx.dueDate || 7).text || '').trim();
            const rawStatus = (row.getCell(colIdx.status || 8).text || 'OUTSTANDING').toLowerCase().trim();
            const rawAccId = colIdx.accountId ? (row.getCell(colIdx.accountId).text || '').trim() : '';
            const rawAccName = colIdx.account ? (row.getCell(colIdx.account).text || '').toLowerCase().trim() : '';
            const desc = (row.getCell(colIdx.desc || 11).text || '').trim();

            const numClean = (val: any) => {
              if (typeof val === 'number') return val;
              if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.-]+/g, '')) || 0;
              return 0;
            };

            const matchedAccId = isValidUuid(rawAccId)
              ? rawAccId
              : (accounts.find((a) => a.name.toLowerCase().trim() === rawAccName || (a.pocket_name && `${a.name} - ${a.pocket_name}`.toLowerCase().trim() === rawAccName))?.id || null);

            debts.push({
              id: isValidUuid(rawId) ? rawId : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `debt_${Date.now()}_${rNum}`),
              person,
              type: rawType.includes('owe') && !rawType.includes('they') ? 'i_owe' : 'they_owe',
              amount: numClean(rawAmount),
              remaining_amount: numClean(rawRemaining),
              date,
              due_date: dueDate && dueDate !== '-' ? dueDate : null,
              status: rawStatus.includes('paid') || rawStatus.includes('lunas') ? 'paid' : 'outstanding',
              account_id: matchedAccId,
              description: desc && desc !== '-' ? desc : null,
            });
          });
        }

        // Parse Cycles sheet
        if (wsCycles) {
          const cycHeaderRow = wsCycles.getRow(1);
          const colIdx: Record<string, number> = {};
          cycHeaderRow.eachCell((c, i) => {
            const val = c.text?.toLowerCase().trim() || '';
            if (val.includes('cycle id') || val === 'id') colIdx.id = i;
            else if (val.includes('cycle name') || val === 'name') colIdx.name = i;
            else if (val.includes('start date')) colIdx.startDate = i;
            else if (val.includes('end date')) colIdx.endDate = i;
            else if (val.includes('status')) colIdx.status = i;
          });

          wsCycles.eachRow((row, rNum) => {
            if (rNum === 1) return;
            const startDate = (row.getCell(colIdx.startDate || 3).text || '').trim();
            if (!startDate) return;

            const rawId = (row.getCell(colIdx.id || 1).text || '').trim();
            const name = (row.getCell(colIdx.name || 2).text || '').trim();
            const endDate = (row.getCell(colIdx.endDate || 4).text || '').trim();
            const rawStatus = (row.getCell(colIdx.status || 5).text || 'ACTIVE').toUpperCase().trim();

            cycles.push({
              id: isValidUuid(rawId) ? rawId : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cyc_${Date.now()}_${rNum}`),
              name: name && name !== '-' ? name : null,
              start_date: startDate,
              end_date: endDate && endDate !== '-' ? endDate : null,
              is_active: rawStatus !== 'INACTIVE',
            });
          });
        }

        // Parse Investment Logs sheet
        if (wsInvLogs) {
          const logHeaderRow = wsInvLogs.getRow(1);
          const colIdx: Record<string, number> = {};
          logHeaderRow.eachCell((c, i) => {
            const val = c.text?.toLowerCase().trim() || '';
            if (val.includes('log id') || (val.includes('id') && !val.includes('investment') && !val.includes('account'))) colIdx.id = i;
            else if (val.includes('investment id')) colIdx.invId = i;
            else if (val.includes('investment') || val.includes('asset')) colIdx.invName = i;
            else if (val.includes('account id')) colIdx.accId = i;
            else if (val.includes('account') || val.includes('rekening')) colIdx.accName = i;
            else if (val.includes('tanggal') || val.includes('date')) colIdx.date = i;
            else if (val.includes('tipe') || val.includes('type')) colIdx.type = i;
            else if (val.includes('value') || val.includes('nilai')) colIdx.value = i;
            else if (val.includes('amount') || val.includes('nominal')) colIdx.amount = i;
            else if (val.includes('notes') || val.includes('catatan')) colIdx.notes = i;
          });

          const invByName = new Map<string, string>();
          investments.forEach((inv) => invByName.set(inv.name.toLowerCase().trim(), inv.id));

          const accByName = new Map<string, string>();
          accounts.forEach((a) => {
            accByName.set(a.name.toLowerCase().trim(), a.id);
            if (a.pocket_name) accByName.set(`${a.name} - ${a.pocket_name}`.toLowerCase().trim(), a.id);
          });

          wsInvLogs.eachRow((row, rNum) => {
            if (rNum === 1) return;
            const date = (row.getCell(colIdx.date || 2).text || '').trim();
            if (!date) return;

            const rawId = (row.getCell(colIdx.id || 1).text || '').trim();
            const rawInvId = colIdx.invId ? (row.getCell(colIdx.invId).text || '').trim() : '';
            const rawInvName = colIdx.invName ? (row.getCell(colIdx.invName).text || '').toLowerCase().trim() : '';
            const rawAccId = colIdx.accId ? (row.getCell(colIdx.accId).text || '').trim() : '';
            const rawAccName = colIdx.accName ? (row.getCell(colIdx.accName).text || '').toLowerCase().trim() : '';
            const rawType = (row.getCell(colIdx.type || 4).text || 'initial').toLowerCase().trim() as any;
            const rawVal = row.getCell(colIdx.value || 5).value;
            const rawAmt = row.getCell(colIdx.amount || 6).value;
            const notes = (row.getCell(colIdx.notes || 8).text || '').trim();

            const numClean = (val: any) => {
              if (typeof val === 'number') return val;
              if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.-]+/g, '')) || 0;
              return 0;
            };

            const investmentId = isValidUuid(rawInvId) ? rawInvId : (invByName.get(rawInvName) || '');
            if (!investmentId) return;

            const accountId = isValidUuid(rawAccId) ? rawAccId : (accByName.get(rawAccName) || null);

            investmentLogs.push({
              id: isValidUuid(rawId) ? rawId : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}_${rNum}`),
              investment_id: investmentId,
              date,
              type: rawType,
              value: numClean(rawVal),
              amount: numClean(rawAmt),
              account_id: accountId,
              notes: notes && notes !== '-' ? notes : null,
            });
          });
        }

        // Parse Transactions sheet
        if (wsTx) {
          const txHeaderRow = wsTx.getRow(1);
          const colIdx: Record<string, number> = {};
          txHeaderRow.eachCell((c, i) => {
            const val = c.text?.toLowerCase().trim() || '';
            if (val.includes('transaction id') || (val.includes('id') && !val.includes('account') && !val.includes('category'))) colIdx.id = i;
            else if (val === 'no' || val === 'no.') colIdx.no = i;
            else if (val.includes('tanggal') || val.includes('date')) colIdx.date = i;
            else if (val.includes('tipe') || val.includes('type')) colIdx.type = i;
            else if (val.includes('account id') || val.includes('rekening id')) colIdx.accountId = i;
            else if (val.includes('source account') || val.includes('rekening asal') || val === 'account') colIdx.account = i;
            else if (val.includes('to account id') || val.includes('destination account id')) colIdx.toAccountId = i;
            else if (val.includes('destination account') || val.includes('rekening tujuan') || val.includes('to_account')) colIdx.toAccount = i;
            else if (val.includes('category id') || val.includes('kategori id')) colIdx.categoryId = i;
            else if (val.includes('kategori') || val.includes('category')) colIdx.category = i;
            else if (val.includes('jumlah') || val.includes('amount') || val.includes('nominal')) colIdx.amount = i;
            else if (val.includes('deskripsi') || val.includes('description') || val.includes('keterangan')) colIdx.desc = i;
          });

          // Account name & category name lookup from parsed sheets
          const accByName = new Map<string, string>();
          const accByNo = new Map<string, string>();
          accounts.forEach((a, idx) => {
            accByName.set(a.name.toLowerCase().trim(), a.id);
            accByNo.set(String(idx + 1), a.id);
            if (a.pocket_name) {
              accByName.set(`${a.name} - ${a.pocket_name}`.toLowerCase().trim(), a.id);
            }
          });

          const catByName = new Map<string, string>();
          const catByNo = new Map<string, string>();
          categories.forEach((c, idx) => {
            catByName.set(c.name.toLowerCase().trim(), c.id);
            catByNo.set(String(idx + 1), c.id);
          });

          wsTx.eachRow((row, rNum) => {
            if (rNum === 1) return;
            const rawDate = (row.getCell(colIdx.date || 2).text || '').trim();
            const rawAmount = row.getCell(colIdx.amount || 10).value;
            if (!rawDate && (!rawAmount || rawAmount === 0)) return;

            const rawId = colIdx.id ? (row.getCell(colIdx.id).text || '').trim() : '';
            const rawType = (row.getCell(colIdx.type || 3).text || 'EXPENSE').toLowerCase().trim();
            const rawAccId = colIdx.accountId ? (row.getCell(colIdx.accountId).text || '').trim() : '';
            const rawAccName = colIdx.account ? (row.getCell(colIdx.account).text || '').toLowerCase().trim() : '';
            const rawToAccId = colIdx.toAccountId ? (row.getCell(colIdx.toAccountId).text || '').trim() : '';
            const rawToAccName = colIdx.toAccount ? (row.getCell(colIdx.toAccount).text || '').toLowerCase().trim() : '';
            const rawCatId = colIdx.categoryId ? (row.getCell(colIdx.categoryId).text || '').trim() : '';
            const rawCatName = colIdx.category ? (row.getCell(colIdx.category).text || '').toLowerCase().trim() : '';
            const desc = (row.getCell(colIdx.desc || 11).text || '').trim();

            let accountId = isValidUuid(rawAccId) ? rawAccId : (accByName.get(rawAccName) || accByNo.get(rawAccName) || accByNo.get(rawAccId) || '');
            let toAccountId = isValidUuid(rawToAccId) ? rawToAccId : (accByName.get(rawToAccName) || accByNo.get(rawToAccName) || accByNo.get(rawToAccId) || null);
            let categoryId = isValidUuid(rawCatId) ? rawCatId : (catByName.get(rawCatName) || catByNo.get(rawCatName) || catByNo.get(rawCatId) || null);

            let parsedType: TransactionType = 'expense';
            if (rawType.includes('income') || rawType.includes('pemasukan')) parsedType = 'income';
            else if (rawType.includes('transfer') || rawType.includes('pindah')) parsedType = 'transfer';

            let numAmount = 0;
            if (typeof rawAmount === 'number') numAmount = rawAmount;
            else if (typeof rawAmount === 'string') numAmount = parseFloat(rawAmount.replace(/[^0-9.-]+/g, '')) || 0;

            if (numAmount > 0 && accountId) {
              transactions.push({
                id: isValidUuid(rawId) ? rawId : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tx_${Date.now()}_${rNum}`),
                date: rawDate,
                type: parsedType,
                amount: numAmount,
                account_id: accountId,
                to_account_id: toAccountId,
                category_id: categoryId,
                description: desc && desc !== '-' ? desc : null,
              });
            }
          });
        }

        // Parse Monthly Archives sheet
        if (wsArchives) {
          const archHeaderRow = wsArchives.getRow(1);
          const colIdx: Record<string, number> = {};
          archHeaderRow.eachCell((c, i) => {
            const val = c.text?.toLowerCase().trim() || '';
            if (val.includes('archive id') || (val.includes('id') && !val.includes('snapshot') && !val.includes('period'))) colIdx.id = i;
            else if (val === 'period' || val === 'periode') colIdx.period = i;
            else if (val.includes('period label') || val.includes('label')) colIdx.periodLabel = i;
            else if (val.includes('start date') || val.includes('tanggal mulai')) colIdx.startDate = i;
            else if (val.includes('end date') || val.includes('tanggal selesai')) colIdx.endDate = i;
            else if (val.includes('income') || val.includes('pemasukan')) colIdx.totalIncome = i;
            else if (val.includes('expense') || val.includes('pengeluaran')) colIdx.totalExpense = i;
            else if (val.includes('count') || val.includes('jumlah transaksi')) colIdx.txCount = i;
            else if (val.includes('created') || val.includes('dibuat')) colIdx.createdAt = i;
            else if (val.includes('snapshot') || val.includes('json')) colIdx.snapshot = i;
          });

          const numClean = (val: any) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.-]+/g, '')) || 0;
            return 0;
          };

          wsArchives.eachRow((row, rNum) => {
            if (rNum === 1) return;
            const period = (row.getCell(colIdx.period || 2).text || '').trim();
            if (!period) return;

            const rawId = colIdx.id ? (row.getCell(colIdx.id).text || '').trim() : '';
            const periodLabel = (row.getCell(colIdx.periodLabel || 3).text || period).trim();
            const startDate = (row.getCell(colIdx.startDate || 4).text || `${period}-01`).trim();
            const endDate = (row.getCell(colIdx.endDate || 5).text || '').trim();
            const rawIncome = row.getCell(colIdx.totalIncome || 6).value;
            const rawExpense = row.getCell(colIdx.totalExpense || 7).value;
            const rawTxCount = row.getCell(colIdx.txCount || 8).value;
            const rawCreatedAt = colIdx.createdAt ? (row.getCell(colIdx.createdAt).text || '').trim() : '';
            const rawSnapshot = colIdx.snapshot ? (row.getCell(colIdx.snapshot).text || '').trim() : '';

            let snapshot: Transaction[] = [];
            if (rawSnapshot) {
              try {
                const parsed = JSON.parse(rawSnapshot);
                if (Array.isArray(parsed)) snapshot = parsed;
              } catch {
                snapshot = [];
              }
            }

            monthlyArchives.push({
              id: isValidUuid(rawId) ? rawId : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `arch_${Date.now()}_${rNum}`),
              period,
              period_label: periodLabel,
              start_date: startDate,
              end_date: endDate,
              total_income: numClean(rawIncome),
              total_expense: numClean(rawExpense),
              transaction_count: Math.round(numClean(rawTxCount)) || snapshot.length,
              data_snapshot: snapshot,
              created_at: rawCreatedAt || new Date().toISOString(),
            });
          });
        }

        return {
          isMasterBackup: true,
          backupPayload: {
            accounts,
            categories,
            transactions,
            debts,
            investments,
            investmentLogs,
            cycles,
            monthlyArchives,
          },
          summary: {
            accountsCount: accounts.length,
            categoriesCount: categories.length,
            transactionsCount: transactions.length,
            debtsCount: debts.length,
            investmentsCount: investments.length,
            cyclesCount: cycles.length,
            archivesCount: monthlyArchives.length,
          },
        };
      }
    } catch {
      // Not a master Excel workbook, fall back to standard transactions parser
    }
  }

  return { isMasterBackup: false };
}

/**
 * Parse and strictly validate uploaded Excel or JSON file for standard transaction imports.
 * Gracefully auto-detects and suggests creating missing accounts when database is empty!
 */
export async function parseAndValidateExcel(
  file: File,
  accounts: Account[],
  categories: Category[],
  existingTransactions: Transaction[]
): Promise<ImportValidationResult> {
  // Create lookups
  const accountByName = new Map<string, Account>();
  const accountById = new Map<string, Account>();
  accounts.forEach((a) => {
    accountByName.set(a.name.toLowerCase().trim(), a);
    accountById.set(a.id, a);
    if (a.pocket_name) {
      accountByName.set(`${a.name} - ${a.pocket_name}`.toLowerCase().trim(), a);
    }
  });

  const categoryByName = new Map<string, Category>();
  const categoryById = new Map<string, Category>();
  categories.forEach((c) => {
    categoryByName.set(c.name.toLowerCase().trim(), c);
    categoryById.set(c.id, c);
  });

  const autoCreateAccountsMap = new Map<string, { name: string; type: AccountType; color: string }>();
  const autoCreateCategoriesMap = new Map<string, { name: string; type: 'expense' | 'income'; color: string }>();

  const validRows: ImportRowResult[] = [];
  const invalidRows: ImportRowResult[] = [];
  const duplicateRows: ImportRowResult[] = [];
  const itemsToImport: Omit<Transaction, 'id' | 'created_at'>[] = [];

  // Existing transactions duplicate index
  const existingKeys = new Set(
    existingTransactions.map((t) => `${t.date}_${t.type}_${Number(t.amount)}_${t.account_id}`)
  );

  // Helper to resolve or auto-register an account
  const resolveOrRegisterAccount = (accIdentifier: string): { accountId: string; willAutoCreate: boolean } => {
    const clean = accIdentifier.trim();
    if (!clean) return { accountId: '', willAutoCreate: false };

    if (isValidUuid(clean) && accountById.has(clean)) {
      return { accountId: clean, willAutoCreate: false };
    }

    const lower = clean.toLowerCase();
    if (accountByName.has(lower)) {
      return { accountId: accountByName.get(lower)!.id, willAutoCreate: false };
    }

    // Auto-register missing account for empty-DB convenience
    if (!autoCreateAccountsMap.has(lower)) {
      const isCash = lower.includes('cash') || lower.includes('tunai');
      const isWallet = lower.includes('gopay') || lower.includes('ovo') || lower.includes('dana') || lower.includes('wallet');
      const newAccId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `acc_${Date.now()}_${autoCreateAccountsMap.size}`;
      const newAcc: Account = {
        id: newAccId,
        name: clean,
        type: isCash ? 'cash' : isWallet ? 'ewallet' : 'bank',
        initial_balance: 0,
        is_active: true,
        include_in_budget: true,
        color: isCash ? '#10B981' : isWallet ? '#06B6D4' : '#2563EB',
      };
      accountByName.set(lower, newAcc);
      accountById.set(newAccId, newAcc);
      autoCreateAccountsMap.set(lower, {
        name: clean,
        type: newAcc.type,
        color: newAcc.color || '#2563EB',
      });
      return { accountId: newAccId, willAutoCreate: true };
    }

    const existingNewAcc = accountByName.get(lower);
    return { accountId: existingNewAcc ? existingNewAcc.id : '', willAutoCreate: true };
  };

  // Helper to resolve or auto-register a category
  const resolveOrRegisterCategory = (catName: string, type: 'expense' | 'income'): string | null => {
    const clean = catName.trim();
    if (!clean) return null;

    if (isValidUuid(clean) && categoryById.has(clean)) {
      return clean;
    }

    const lower = clean.toLowerCase();
    if (categoryByName.has(lower)) {
      return categoryByName.get(lower)!.id;
    }

    if (!autoCreateCategoriesMap.has(lower)) {
      const newCatId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cat_${Date.now()}_${autoCreateCategoriesMap.size}`;
      const newCat: Category = {
        id: newCatId,
        name: clean,
        type,
        color: type === 'income' ? '#10B981' : '#EF4444',
        is_default: false,
      };
      categoryByName.set(lower, newCat);
      categoryById.set(newCatId, newCat);
      autoCreateCategoriesMap.set(lower, {
        name: clean,
        type,
        color: newCat.color || '#EF4444',
      });
      return newCatId;
    }

    return categoryByName.get(lower)?.id || null;
  };

  // Check if file is JSON
  if (file.name.toLowerCase().endsWith('.json')) {
    const text = await file.text();
    let jsonArray: any[] = [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        jsonArray = parsed;
      } else if (parsed && Array.isArray(parsed.transactions)) {
        jsonArray = parsed.transactions;
      } else if (parsed && Array.isArray(parsed.data_snapshot)) {
        jsonArray = parsed.data_snapshot;
      } else {
        throw new Error('JSON format does not contain a transaction list.');
      }
    } catch (err: any) {
      throw new Error(`Invalid JSON file: ${err.message}`);
    }

    jsonArray.forEach((item, index) => {
      const rowNumber = index + 1;
      const rawDate = item.date ? String(item.date).trim() : '';
      const rawType = item.type ? String(item.type).trim() : '';
      const rawAmount = item.amount;
      const errors: string[] = [];

      // Type resolution
      const typeLower = rawType.toLowerCase();
      let parsedType: TransactionType = 'expense';
      if (typeLower === 'income' || typeLower === 'pemasukan') parsedType = 'income';
      else if (typeLower === 'expense' || typeLower === 'pengeluaran') parsedType = 'expense';
      else if (typeLower === 'transfer' || typeLower === 'pindah saldo') parsedType = 'transfer';
      else errors.push(`Type "${rawType}" is invalid`);

      // Account resolution (supports auto-creating missing accounts)
      const rawAccount = item.account_name || (item.account && item.account.name) || item.account_id || '';
      const { accountId, willAutoCreate } = resolveOrRegisterAccount(rawAccount);
      if (!accountId) {
        errors.push(`Account "${rawAccount}" not found.`);
      }

      // To-Account resolution for transfer
      let toAccountId: string | null = null;
      let rawToAccount = item.to_account_name || (item.to_account && item.to_account.name) || item.to_account_id || '';
      if (parsedType === 'transfer') {
        if (rawToAccount) {
          const resTo = resolveOrRegisterAccount(rawToAccount);
          toAccountId = resTo.accountId || null;
          if (!toAccountId) {
            errors.push(`Transfer destination account not found.`);
          }
        } else {
          errors.push('Transfer requires destination account.');
        }
      }

      // Category resolution
      const rawCategory = item.category_name || (item.category && item.category.name) || item.category_id || '';
      const categoryId = resolveOrRegisterCategory(rawCategory, parsedType === 'income' ? 'income' : 'expense');

      // Validate Date
      const parsedDate = rawDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) {
        errors.push('Date format must be YYYY-MM-DD');
      }

      // Validate Amount
      const parsedAmount = Number(rawAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        errors.push('Amount must be a positive number.');
      }

      const rowObj: ImportRowResult = {
        rowNumber,
        isValid: errors.length === 0,
        isDuplicate: false,
        errors,
        willAutoCreateAccount: willAutoCreate,
        raw: {
          date: rawDate,
          type: rawType,
          amount: String(rawAmount),
          account: rawAccount,
          toAccount: rawToAccount,
          category: rawCategory,
          description: item.description || '',
        },
      };

      if (errors.length > 0) {
        invalidRows.push(rowObj);
        return;
      }

      const dupKey = `${parsedDate}_${parsedType}_${parsedAmount}_${accountId}`;
      if (existingKeys.has(dupKey)) {
        rowObj.isDuplicate = true;
        rowObj.errors.push('Duplicate transaction detected.');
        duplicateRows.push(rowObj);
        return;
      }

      rowObj.data = {
        date: parsedDate,
        type: parsedType,
        amount: parsedAmount,
        account_id: accountId,
        to_account_id: toAccountId,
        category_id: categoryId,
        description: item.description || null,
      };

      validRows.push(rowObj);
      itemsToImport.push(rowObj.data);
      existingKeys.add(dupKey);
    });

    return {
      totalRows: validRows.length + invalidRows.length + duplicateRows.length,
      validRows,
      invalidRows,
      duplicateRows,
      itemsToImport,
      autoCreateAccounts: Array.from(autoCreateAccountsMap.values()),
      autoCreateCategories: Array.from(autoCreateCategoriesMap.values()),
    };
  }

  // Handle Excel (.xlsx / .xls)
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // Smart worksheet selection: prioritize sheet containing 'transaksi', else first worksheet
  const ws =
    wb.worksheets.find((w) => w.name.toLowerCase().includes('transaksi') || w.name.toLowerCase().includes('transaction')) ||
    wb.worksheets[0];

  if (!ws) {
    throw new Error('Excel file contains no worksheets.');
  }

  // Dynamic header column detection
  const colMap: Record<string, number> = {};
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const val = (cell.text || '').toLowerCase().trim();
    if (val.includes('tanggal') || val.includes('date')) colMap['date'] = colNumber;
    else if (val.includes('tipe') || val.includes('type')) colMap['type'] = colNumber;
    else if (val.includes('jumlah') || val.includes('amount') || val.includes('nominal')) colMap['amount'] = colNumber;
    else if (val.includes('account id') && !val.includes('to')) colMap['accountId'] = colNumber;
    else if (val.includes('rekening asal') || val.includes('nama rekening asal') || val === 'rekening' || val === 'account' || val.includes('source account')) colMap['account'] = colNumber;
    else if (val.includes('to account id') || val.includes('destination account id')) colMap['toAccountId'] = colNumber;
    else if (val.includes('rekening tujuan') || val.includes('nama rekening tujuan') || val.includes('to_account') || val.includes('destination account')) colMap['to_account'] = colNumber;
    else if (val.includes('category id')) colMap['categoryId'] = colNumber;
    else if (val.includes('kategori') || val.includes('category')) colMap['category'] = colNumber;
    else if (val.includes('deskripsi') || val.includes('description') || val.includes('keterangan')) colMap['desc'] = colNumber;
  });

  // Default fallbacks if standard header not recognized
  const dateCol = colMap['date'] || 1;
  const typeCol = colMap['type'] || 2;
  const amountCol = colMap['amount'] || 3;
  const accountCol = colMap['account'] || (colMap['accountId'] ? colMap['accountId'] : 4);
  const toAccountCol = colMap['to_account'] || colMap['toAccountId'] || 5;
  const categoryCol = colMap['category'] || colMap['categoryId'] || 6;
  const descCol = colMap['desc'] || 7;

  // Read starting from row 2 (skipping header)
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip headers

    const rawDate = row.getCell(dateCol).text?.trim() || '';
    const rawType = row.getCell(typeCol).text?.trim() || '';
    const rawAmount = row.getCell(amountCol).value;
    const rawAccount = row.getCell(accountCol).text?.trim() || '';
    const rawToAccount = toAccountCol ? row.getCell(toAccountCol).text?.trim() || '' : '';
    const rawCategory = categoryCol ? row.getCell(categoryCol).text?.trim() || '' : '';
    const rawDesc = descCol ? row.getCell(descCol).text?.trim() || '' : '';

    // Ignore completely empty rows
    if (!rawDate && !rawType && !rawAccount && (!rawAmount || rawAmount === 0)) {
      return;
    }

    const errors: string[] = [];

    // 1. Validate Date (YYYY-MM-DD or date object)
    let parsedDate = '';
    const cellDateVal = row.getCell(dateCol).value;
    if (cellDateVal instanceof Date) {
      parsedDate = cellDateVal.toISOString().slice(0, 10);
    } else if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      parsedDate = rawDate;
    } else if (typeof rawDate === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
      const parts = rawDate.split('/');
      parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    } else {
      errors.push('Date format must be YYYY-MM-DD (e.g. 2026-09-17)');
    }

    // 2. Validate Type
    const typeUpper = rawType.toUpperCase();
    let parsedType: TransactionType = 'expense';
    if (typeUpper === 'INCOME' || typeUpper === 'PEMASUKAN') {
      parsedType = 'income';
    } else if (typeUpper === 'EXPENSE' || typeUpper === 'PENGELUARAN') {
      parsedType = 'expense';
    } else if (typeUpper === 'TRANSFER' || typeUpper === 'PINDAH SALDO') {
      parsedType = 'transfer';
    } else {
      errors.push(`Transaction type "${rawType}" is invalid. Use INCOME, EXPENSE, or TRANSFER.`);
    }

    // 3. Validate Amount
    let parsedAmount = 0;
    if (typeof rawAmount === 'number') {
      parsedAmount = rawAmount;
    } else if (typeof rawAmount === 'string') {
      const cleanNum = rawAmount.replace(/[^0-9.-]+/g, '');
      parsedAmount = parseFloat(cleanNum);
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.push('Amount must be a positive number greater than 0.');
    }

    // 4. Validate Account (Supports auto-creating missing accounts)
    const { accountId, willAutoCreate } = resolveOrRegisterAccount(rawAccount);
    if (!accountId) {
      errors.push(`Account "${rawAccount}" not found in active accounts.`);
    }

    // 5. Validate To-Account for transfers
    let toAccountId: string | null = null;
    if (parsedType === 'transfer') {
      if (!rawToAccount) {
        errors.push('For transfers, Destination Account Name is required.');
      } else {
        const resTo = resolveOrRegisterAccount(rawToAccount);
        if (!resTo.accountId) {
          errors.push(`Destination account "${rawToAccount}" not found.`);
        } else if (resTo.accountId === accountId) {
          errors.push('Source and destination accounts cannot be the same.');
        } else {
          toAccountId = resTo.accountId;
        }
      }
    }

    // 6. Validate Category
    const categoryId = resolveOrRegisterCategory(rawCategory, parsedType === 'income' ? 'income' : 'expense');

    const rowObj: ImportRowResult = {
      rowNumber,
      isValid: errors.length === 0,
      isDuplicate: false,
      errors,
      willAutoCreateAccount: willAutoCreate,
      raw: {
        date: rawDate,
        type: rawType,
        amount: rawAmount ? String(rawAmount) : '0',
        account: rawAccount,
        toAccount: rawToAccount,
        category: rawCategory,
        description: rawDesc,
      },
    };

    if (errors.length > 0) {
      invalidRows.push(rowObj);
      return;
    }

    // Duplicate detection
    const dupKey = `${parsedDate}_${parsedType}_${parsedAmount}_${accountId}`;
    if (existingKeys.has(dupKey)) {
      rowObj.isDuplicate = true;
      rowObj.errors.push('Possible duplicate detected (same date, type, amount, and account)');
      duplicateRows.push(rowObj);
      return;
    }

    // Valid item
    rowObj.data = {
      date: parsedDate,
      type: parsedType,
      amount: parsedAmount,
      account_id: accountId,
      to_account_id: toAccountId,
      category_id: categoryId,
      description: rawDesc || null,
    };

    validRows.push(rowObj);
    itemsToImport.push(rowObj.data);
    existingKeys.add(dupKey);
  });

  return {
    totalRows: validRows.length + invalidRows.length + duplicateRows.length,
    validRows,
    invalidRows,
    duplicateRows,
    itemsToImport,
    autoCreateAccounts: Array.from(autoCreateAccountsMap.values()),
    autoCreateCategories: Array.from(autoCreateCategoriesMap.values()),
  };
}
