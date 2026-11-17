'use client';

import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Archive,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileDown,
  Calendar,
  ShieldCheck,
  Trash2,
  RefreshCw,
  FileJson,
  RotateCcw,
  Eye,
  X,
  Clock,
  Sparkles,
  BookOpen,
  Layers,
  Fingerprint,
  HardDrive,
  Lock,
  Database,
} from 'lucide-react';
import { useFinanceData } from '@/lib/data/DataContext';
import { buildFinancialWorkbook, exportFinancialWorkbook } from '@/lib/excel/export';
import {
  downloadImportTemplate,
  parseAndValidateExcel,
  detectAndParseMasterBackup,
  ImportValidationResult,
  MasterBackupDetectionResult,
} from '@/lib/excel/import';
import {
  convertWorkbookToPreviewData,
  convertExcelFileToPreviewData,
  ExcelWorkbookPreviewData,
} from '@/lib/excel/preview';
import ExcelPreviewModal from '@/components/excel/ExcelPreviewModal';
import { formatRupiah, isDebtSettlementTransaction } from '@/lib/calculations';
import { MonthlyArchive, Transaction } from '@/lib/types';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import SearchableSelect from '@/components/ui/SearchableSelect';

export default function ImportExportPage() {
  const {
    currentUser,
    isDemoMode,
    accounts,
    categories,
    transactions,
    debts,
    investments,
    investmentLogs,
    monthlyArchives,
    cycles,
    cycleStartDate,
    refreshData,
    importTransactions,
    restoreFullBackup,
    createMonthlyArchive,
    restoreMonthlyArchive,
    deleteMonthlyArchive,
  } = useFinanceData();
  const { t, locale, dateLocale } = useLanguage();

  // Superadmin authorization
  const isSuperAdmin = currentUser?.role === 'superadmin' || isDemoMode;

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'closing' | 'export' | 'import'>('closing');

  // Monthly closing and archive state
  const availableMonths = useMemo(() => {
    const monthKeysSet = new Set<string>();

    // 1. Include months with existing transactions
    transactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        monthKeysSet.add(t.date.slice(0, 7));
      }
    });

    // 2. Include dynamic range: 12 months ahead to 36 months back
    const now = new Date();
    for (let i = -12; i <= 36; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      monthKeysSet.add(`${year}-${month}`);
    }

    // 3. Sort descending (newest month first)
    const sortedKeys = Array.from(monthKeysSet).sort((a, b) => b.localeCompare(a));

    return sortedKeys.map((key) => {
      const [yStr, mStr] = key.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = new Date(y, m - 1, 1);
      const label = d.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
      const lastDay = new Date(y, m, 0).getDate();
      return {
        key,
        label,
        start: `${key}-01`,
        end: `${key}-${String(lastDay).padStart(2, '0')}`,
      };
    });
  }, [transactions, dateLocale]);

  const defaultCurrentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isClosingMonth, setIsClosingMonth] = useState(false);
  const [closingSuccess, setClosingSuccess] = useState<string | null>(null);
  const [selectedDetailArchive, setSelectedDetailArchive] = useState<MonthlyArchive | null>(null);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  // Excel Spreadsheet Preview State
  const [previewData, setPreviewData] = useState<ExcelWorkbookPreviewData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const currentSelectedMonthObj =
    availableMonths.find((m) => m.key === selectedMonthKey) ||
    availableMonths.find((m) => m.key === defaultCurrentMonthKey) ||
    availableMonths[0];

  // Month transactions preview
  const monthTransactions = useMemo(() => {
    if (!currentSelectedMonthObj) return [];
    return transactions.filter(
      (t) => t.date >= currentSelectedMonthObj.start && t.date <= currentSelectedMonthObj.end
    );
  }, [transactions, currentSelectedMonthObj]);

  const monthIncome = useMemo(() => {
    return monthTransactions
      .filter((t) => t.type === 'income' && !isDebtSettlementTransaction(t, categories))
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [monthTransactions, categories]);

  const monthExpense = useMemo(() => {
    return monthTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [monthTransactions]);

  const existingArchiveForSelectedMonth = useMemo(() => {
    return monthlyArchives.find((a) => a.period === selectedMonthKey);
  }, [monthlyArchives, selectedMonthKey]);

  // Execute Monthly Closing
  const handleExecuteClosing = async () => {
    if (!currentSelectedMonthObj) return;
    if (monthTransactions.length === 0) {
      alert(`No transactions in ${currentSelectedMonthObj.label} to archive.`);
      return;
    }

    setIsClosingMonth(true);
    setClosingSuccess(null);

    try {
      // 1. Export Excel workbook to user's device (Primary Saver)
      const filename = `PocketLog_Archive_${selectedMonthKey}_${currentSelectedMonthObj.label.replace(/\s+/g, '_')}.xlsx`;
      await exportFinancialWorkbook({
        accounts,
        categories,
        transactions: monthTransactions,
        debts,
        filename,
      });

      // 2. Save compact snapshot into application (Secondary Saver)
      await createMonthlyArchive(
        currentSelectedMonthObj.start,
        currentSelectedMonthObj.end,
        currentSelectedMonthObj.label
      );

      setClosingSuccess(
        `Month closing for ${currentSelectedMonthObj.label} succeeded! Excel file (${filename}) saved to your device and summary archive stored in app.`
      );
    } catch (err: any) {
      console.error('Failed closing month:', err);
      alert(err.message || 'Failed to close month & archive.');
    } finally {
      setIsClosingMonth(false);
    }
  };

  // Re-download Excel from saved archive
  const handleRedownloadExcelFromArchive = async (archive: MonthlyArchive) => {
    try {
      const filename = `PocketLog_Archive_${archive.period}_${archive.period_label.replace(/\s+/g, '_')}.xlsx`;
      await exportFinancialWorkbook({
        accounts,
        categories,
        transactions: archive.data_snapshot || [],
        debts,
        filename,
      });
    } catch (err) {
      console.error(err);
      alert('Failed to re-download Excel file.');
    }
  };

  // Download JSON Snapshot from saved archive
  const handleDownloadJsonSnapshot = (archive: MonthlyArchive) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(archive, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `PocketLog_Snapshot_${archive.period}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Restore transactions back to active database
  const handleRestoreArchive = async (archiveId: string, label: string) => {
    if (!confirm(`Restore all transactions from ${label} into active database?`)) {
      return;
    }

    setIsRestoring(archiveId);
    setRestoreMessage(null);
    try {
      const { restoredCount } = await restoreMonthlyArchive(archiveId);
      setRestoreMessage(
        `Successfully restored ${restoredCount} transactions from ${label} to active database.`
      );
    } catch (err: any) {
      console.error('Restore failed:', err);
      alert(err.message || 'Failed to restore transactions.');
    } finally {
      setIsRestoring(null);
    }
  };

  // Excel Preview Handlers
  const handlePreviewCurrentMonth = () => {
    if (!currentSelectedMonthObj) return;
    if (monthTransactions.length === 0) {
      alert(`No transactions in ${currentSelectedMonthObj.label} to preview.`);
      return;
    }

    try {
      const filename = `PocketLog_Archive_${selectedMonthKey}_${currentSelectedMonthObj.label.replace(/\s+/g, '_')}.xlsx`;
      const wb = buildFinancialWorkbook({
        accounts,
        categories,
        transactions: monthTransactions,
        debts,
      });
      const data = convertWorkbookToPreviewData(wb, filename);
      setPreviewData(data);
      setIsPreviewOpen(true);
    } catch (err) {
      console.error('Failed to preview current month:', err);
      alert('Failed to generate Excel preview.');
    }
  };

  const handlePreviewArchive = (archive: MonthlyArchive) => {
    try {
      const filename = `PocketLog_Archive_${archive.period}_${archive.period_label.replace(/\s+/g, '_')}.xlsx`;
      const wb = buildFinancialWorkbook({
        accounts,
        categories,
        transactions: archive.data_snapshot || [],
        debts,
      });
      const data = convertWorkbookToPreviewData(wb, filename);
      setPreviewData(data);
      setIsPreviewOpen(true);
    } catch (err) {
      console.error('Failed to preview archive:', err);
      alert('Failed to preview Excel archive.');
    }
  };

  const handlePreviewFullWorkbook = () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const filename = `PocketLog_${exportTarget.fileSuffix}_${todayStr}.xlsx`;
      const wb = buildFinancialWorkbook({
        accounts,
        categories,
        transactions: exportTarget.txs,
        debts,
        investments,
        investmentLogs,
        cycles,
        monthlyArchives,
        periodTitle: exportTarget.title,
        periodSubtitle: exportTarget.subtitle,
        ownerInfo: {
          id: isDemoMode ? undefined : currentUser?.id,
          name: currentUser?.full_name,
          email: currentUser?.email,
        },
      });
      const data = convertWorkbookToPreviewData(wb, filename);
      setPreviewData(data);
      setIsPreviewOpen(true);
    } catch (err) {
      console.error('Failed to preview full workbook:', err);
      alert('Failed to preview full Excel report.');
    }
  };

  const handlePreviewUploadedFile = async () => {
    if (!uploadedFile) return;
    try {
      const data = await convertExcelFileToPreviewData(uploadedFile);
      setPreviewData(data);
      setIsPreviewOpen(true);
    } catch (err) {
      console.error('Failed to preview uploaded file:', err);
      alert('Failed to preview uploaded Excel file.');
    }
  };

  // 2. EXPORT WORKBOOK STATE
  const [exportScope, setExportScope] = useState<'all' | 'cycle' | 'month'>('all');
  const [selectedExportCycleId, setSelectedExportCycleId] = useState<string>('active');
  const [selectedExportMonth, setSelectedExportMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Computed data for export
  const exportTarget = useMemo(() => {
    if (exportScope === 'all') {
      return {
        txs: transactions,
        title: 'Full Historical Report',
        subtitle: 'All Transactions',
        fileSuffix: 'All_History',
      };
    }

    if (exportScope === 'cycle') {
      let cycle = cycles.find((c) => c.id === selectedExportCycleId);
      if (!cycle && selectedExportCycleId === 'active') {
        cycle = cycles.find((c) => c.is_active) || {
          id: 'active',
          start_date: cycleStartDate,
          end_date: null,
          is_active: true,
          name: `Cycle ${cycleStartDate}`,
        };
      }

      const start = cycle?.start_date || cycleStartDate;
      const end = cycle?.end_date || new Date().toISOString().slice(0, 10);
      const isOngoing = !cycle?.end_date || cycle.is_active;

      const filtered = transactions.filter((t) => {
        const d = t.date || '';
        return isOngoing ? d >= start : d >= start && d <= end;
      });

      const label = isOngoing
        ? `Active Payday Cycle (From ${start})`
        : `Payday Cycle (${start} to ${end})`;

      return {
        txs: filtered,
        title: label,
        subtitle: `${start} to ${end}`,
        fileSuffix: `Cycle_${start}`,
      };
    }

    // By calendar month
    const mObj = availableMonths.find((m) => m.key === selectedExportMonth) || availableMonths[0];
    const filtered = transactions.filter((t) => t.date >= mObj.start && t.date <= mObj.end);
    return {
      txs: filtered,
      title: `Monthly Report - ${mObj.label}`,
      subtitle: `${mObj.start} to ${mObj.end}`,
      fileSuffix: `Month_${mObj.key}`,
    };
  }, [exportScope, selectedExportCycleId, selectedExportMonth, cycles, cycleStartDate, transactions, availableMonths]);

  const handleExportAll = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      await exportFinancialWorkbook({
        accounts,
        categories,
        transactions: exportTarget.txs,
        debts,
        investments,
        investmentLogs,
        cycles,
        monthlyArchives,
        periodTitle: exportTarget.title,
        periodSubtitle: exportTarget.subtitle,
        ownerInfo: {
          id: isDemoMode ? undefined : currentUser?.id,
          name: currentUser?.full_name,
          email: currentUser?.email,
        },
        filename: `PocketLog_${exportTarget.fileSuffix}_${todayStr}.xlsx`,
      });
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 5000);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export Excel report.');
    } finally {
      setIsExporting(false);
    }
  };

  const [isExportingGlobal, setIsExportingGlobal] = useState<string | null>(null);

  const handleExportGlobal = async (format: 'json' | 'sql' = 'json') => {
    if (!isSuperAdmin) {
      alert('Access Denied: Full database backup is restricted to Superadmin accounts only.');
      return;
    }

    setIsExportingGlobal(format);
    try {
      const res = await fetch(`/api/admin/database-backup?format=${format}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (${res.status})`);
      }

      const disposition = res.headers.get('Content-Disposition');
      let filename = `PocketLog_GLOBAL_FULL_DB_${new Date().toISOString().slice(0, 10)}.${format}`;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      console.error('Global export failed:', err);
      const proceed = confirm(
        `Failed to extract global backup from server: ${err.message}\n\nWould you like to download your current local account backup as an alternative?`
      );
      if (proceed) {
        handleExportFullJson();
      }
    } finally {
      setIsExportingGlobal(null);
    }
  };

  const handleExportFullJson = () => {
    if (!isSuperAdmin) {
      alert('Access Denied: Full database backup is restricted to Superadmin accounts only.');
      return;
    }
    const activeUserId = isDemoMode ? undefined : currentUser?.id;
    const filterByOwner = <T extends { user_id?: string }>(items: T[]): T[] => {
      if (!activeUserId) return items;
      return items.filter((item) => !item.user_id || item.user_id === activeUserId);
    };

    const safeAccounts = filterByOwner(accounts);
    const safeCategories = filterByOwner(categories);
    const safeTransactions = filterByOwner(transactions);
    const safeDebts = filterByOwner(debts);
    const safeInvestments = filterByOwner(investments);
    const safeInvestmentLogs = filterByOwner(investmentLogs);
    const safeCycles = filterByOwner(cycles);
    const safeMonthlyArchives = filterByOwner(monthlyArchives);

    const backupData = {
      version: 2,
      exported_at: new Date().toISOString(),
      app: 'PocketLog',
      owner: {
        id: activeUserId,
        email: currentUser?.email || (isDemoMode ? 'demo@pocketlog.local' : undefined),
        name: currentUser?.full_name || undefined,
      },
      summary: {
        accountsCount: safeAccounts.length,
        categoriesCount: safeCategories.length,
        transactionsCount: safeTransactions.length,
        debtsCount: safeDebts.length,
        investmentsCount: safeInvestments.length,
        investmentLogsCount: safeInvestmentLogs.length,
        cyclesCount: safeCycles.length,
        archivesCount: safeMonthlyArchives.length,
      },
      accounts: safeAccounts,
      categories: safeCategories,
      transactions: safeTransactions,
      debts: safeDebts,
      investments: safeInvestments,
      investmentLogs: safeInvestmentLogs,
      cycles: safeCycles,
      cycleStartDate,
      monthlyArchives: safeMonthlyArchives,
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `PocketLog_Master_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // 3. IMPORT DATA STATE (EXCEL & JSON)
  const [isParsing, setIsParsing] = useState(false);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [masterBackupResult, setMasterBackupResult] = useState<MasterBackupDetectionResult | null>(null);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [restoreBackupSuccess, setRestoreBackupSuccess] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleDownloadTemplate = async () => {
    try {
      await downloadImportTemplate();
    } catch (err) {
      console.error(err);
      alert('Failed to download template.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      setUploadedFile(file);
    } else {
      setUploadedFile(null);
    }

    setIsParsing(true);
    setValidationResult(null);
    setMasterBackupResult(null);
    setImportStatus(null);
    setRestoreBackupSuccess(null);

    try {
      // 1. Detect if this is a master backup (JSON or multi-sheet Excel)
      const masterRes = await detectAndParseMasterBackup(file);
      if (masterRes.isMasterBackup && masterRes.backupPayload) {
        setMasterBackupResult(masterRes);
      }

      // 2. Also run row-level transaction validation
      const res = await parseAndValidateExcel(file, accounts, categories, transactions);
      setValidationResult(res);
    } catch (err: unknown) {
      console.error(err);
      alert((err as Error).message || 'Failed to read file.');
    } finally {
      setIsParsing(false);
      e.target.value = '';
    }
  };

  const handleExecuteMasterRestore = async () => {
    if (!isSuperAdmin) {
      alert('Access Denied: Full database restore is restricted to Superadmin accounts only.');
      return;
    }
    if (!masterBackupResult) return;
    const s = masterBackupResult.summary;
    const isGlobal = masterBackupResult.isGlobalBackup;

    const confirmMsg = isGlobal
      ? `Restore GLOBAL DATABASE BACKUP (All Users & All Tables)?\n\n` +
        `- ${s?.usersCount ?? 0} User Accounts (Users)\n` +
        `- ${s?.accountsCount ?? 0} Accounts & Pockets\n` +
        `- ${s?.categoriesCount ?? 0} Categories & Icons\n` +
        `- ${s?.transactionsCount ?? 0} Historical Transactions\n` +
        `- ${s?.debtsCount ?? 0} Debts & Loans\n` +
        `- ${s?.investmentsCount ?? 0} Investments & Logs\n` +
        `- ${s?.cyclesCount ?? 0} Budget Cycles\n\n` +
        `All user data will be restored 1-to-1 into the database. Proceed?`
      : `Restore full database backup? This will restore:\n` +
        `- ${s?.accountsCount ?? 0} Accounts (with colors & pockets)\n` +
        `- ${s?.categoriesCount ?? 0} Categories (with colors & icons)\n` +
        `- ${s?.transactionsCount ?? 0} Transactions\n` +
        `- ${s?.debtsCount ?? 0} Debts & Loans\n` +
        `- ${s?.investmentsCount ?? 0} Investments\n` +
        `- ${s?.cyclesCount ?? 0} Cycles\n\n` +
        `Even if the database is currently empty, all entities will be restored 1-to-1 without missing anything. Proceed?`;

    if (!confirm(confirmMsg)) return;

    setIsRestoringBackup(true);
    setRestoreBackupSuccess(null);
    try {
      if (isGlobal && masterBackupResult.rawPayload) {
        // Try restoring via Server API /api/admin/database-backup
        const res = await fetch('/api/admin/database-backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(masterBackupResult.rawPayload),
        });

        if (res.ok) {
          const data = await res.json();
          setRestoreBackupSuccess(
            `Global Database Restored Successfully! Restored ${data.summary?.users ?? s?.usersCount ?? 0} users, ${data.summary?.accounts ?? s?.accountsCount ?? 0} accounts, ${data.summary?.categories ?? s?.categoriesCount ?? 0} categories, and ${data.summary?.transactions ?? s?.transactionsCount ?? 0} transactions across all database entities.`
          );
          setMasterBackupResult(null);
          setValidationResult(null);
          await refreshData();
          return;
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('Server global restore failed, falling back to local restoreFullBackup:', errData);
        }
      }

      // Fallback or single-user restore
      if (masterBackupResult.backupPayload) {
        const res = await restoreFullBackup(masterBackupResult.backupPayload);
        const parts = [
          `${res.accountsCount} accounts`,
          `${res.categoriesCount} categories`,
          `${res.transactionsCount} transactions`,
          `${res.debtsCount} debts`,
          `${res.investmentsCount} investments`,
          `${res.cyclesCount} cycles`,
          res.archivesCount ? `${res.archivesCount} monthly archives` : null,
        ].filter(Boolean);
        setRestoreBackupSuccess(
          `Database restored successfully! Restored ${parts.join(', ')}.`
        );
        setMasterBackupResult(null);
        setValidationResult(null);
        await refreshData();
      }
    } catch (err: any) {
      console.error('Master restore failed:', err);
      alert(err.message || 'Failed to restore master backup.');
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!validationResult || validationResult.itemsToImport.length === 0) return;

    setIsImporting(true);
    try {
      const count = await importTransactions(validationResult.itemsToImport, {
        autoAccounts: validationResult.autoCreateAccounts,
        autoCategories: validationResult.autoCreateCategories,
      });
      setImportStatus(
        `Successfully imported ${count} transactions into database.`
      );
      setValidationResult(null);
    } catch (err) {
      console.error(err);
      alert('Failed to import transactions.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-[#F2F5F3] sm:text-2xl">
            Backup & Export
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#8F9992]">
            Export reports to Excel or download and restore system backups.
          </p>
        </div>
      </div>

      {/* Archive metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
        {/* Closing status */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between lg:col-span-3">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
              Month Closing Status
            </span>
            <div className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1]">
              {existingArchiveForSelectedMonth ? 'Closed' : 'Not Closed'}
            </div>
            <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94] mt-1 block">
              Month: {currentSelectedMonthObj?.label || 'This Month'}
            </span>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            existingArchiveForSelectedMonth
              ? 'bg-[#E8F5E9] dark:bg-[#1E2B22] text-[#2E7D32] dark:text-[#34D399]'
              : 'bg-[#FFF8E1] dark:bg-[#2C2417] text-[#B45309] dark:text-[#FBBF24]'
          }`}>
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Saved monthly archives */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between lg:col-span-3">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
              Total Stored Archives
            </span>
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-[#18221B] dark:text-[#F0F4F1]">
              {monthlyArchives.length}
            </div>
            <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94] mt-1 block">
              Secondary Excel workbooks
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#E5EFE8] dark:bg-[#1E2B22] text-[#4D6A58] dark:text-[#A7D7B5] flex items-center justify-center shrink-0">
            <Archive className="h-5 w-5" />
          </div>
        </div>

        {/* Total historical transactions */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between lg:col-span-3">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
              Transaction History
            </span>
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-[#18221B] dark:text-[#F0F4F1]">
              {transactions.length}
            </div>
            <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94] mt-1 block">
              All mutations in database
            </span>
          </div>
          <div className="flex items-end space-x-1.5 h-10 px-2">
            <span className="w-1.5 h-4 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-8 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-10 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
          </div>
        </div>

        {/* Data security indicator */}
        <div className="rounded-[28px] bg-[#5B7966] dark:bg-[#3E5747] text-white p-5.5 shadow-[0_10px_30px_rgba(91,121,102,0.25)] flex items-center justify-between lg:col-span-3">
          <div>
            <span className="text-xs font-semibold text-white/80 block">
              Data Security
            </span>
            <div className="mt-1 text-base font-bold">
              Protected & Portable
            </div>
            <span className="text-[10px] text-white/70 mt-1 block">
              Download or restore anytime
            </span>
          </div>
          <div className="w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center shrink-0">
            <Fingerprint className="h-6 w-6 stroke-[2]" />
          </div>
        </div>
      </div>

      {/* Segmented Navigation Tabs Styled as Floating Capsule */}
      <div className="flex items-center rounded-full bg-white dark:bg-[#161D18] border border-black/[0.04] dark:border-white/[0.06] p-1.5 w-full sm:w-fit overflow-x-auto shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
        <button
          onClick={() => setActiveTab('closing')}
          className={`flex items-center space-x-2 rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'closing'
              ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm'
              : 'text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B] dark:hover:text-[#F0F4F1]'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Monthly Closing</span>
          {monthlyArchives.length > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold font-mono tabular-nums ${
                activeTab === 'closing'
                  ? 'bg-white/20 text-white dark:bg-[#0C2417]/20 dark:text-[#0C2417]'
                  : 'bg-black/5 dark:bg-white/10 text-[#76847A] dark:text-[#8E9E94]'
              }`}
            >
              {monthlyArchives.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('export')}
          className={`flex items-center space-x-2 rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'export'
              ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm'
              : 'text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B] dark:hover:text-[#F0F4F1]'
          }`}
        >
          <Download className="h-4 w-4" />
          <span>Export</span>
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center space-x-2 rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'import'
              ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm'
              : 'text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B] dark:hover:text-[#F0F4F1]'
          }`}
        >
          <Upload className="h-4 w-4" />
          <span>Import</span>
        </button>
      </div>

      {/* Tab: Monthly Closing & Archives */}
      {activeTab === 'closing' && (
        <div className="space-y-6">
          {/* Notifications */}
          {closingSuccess && (
            <div className="flex items-start justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-300">
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <span>{closingSuccess}</span>
              </div>
              <button onClick={() => setClosingSuccess(null)} className="text-emerald-400 hover:text-emerald-200">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {restoreMessage && (
            <div className="flex items-start justify-between rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-xs font-semibold text-blue-300">
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0" />
                <span>{restoreMessage}</span>
              </div>
              <button onClick={() => setRestoreMessage(null)} className="text-blue-400 hover:text-blue-200">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Action Card: Month Selection & Closing Form */}
          <div className="rounded-[28px] border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-5 sm:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.035)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-black/[0.04] dark:border-white/[0.06] pb-5">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-[#18221B] dark:text-[#F0F4F1]">
                  {t('archives.closingFormTitle')}
                </h2>
                <p className="text-xs text-[#76847A] dark:text-[#8E9E94] mt-0.5">
                  {t('archives.closingFormSubtitle')}
                </p>
              </div>

              {/* Month Selector Dropdown */}
              <div className="flex items-center space-x-2">
                <label className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94]">
                  {t('archives.periodMonth')}
                </label>
                <SearchableSelect
                  options={availableMonths.map((m) => ({
                    value: m.key,
                    label: m.label,
                  }))}
                  value={selectedMonthKey}
                  onChange={(val) => setSelectedMonthKey(val)}
                  placeholder={t('archives.periodMonth')}
                  searchPlaceholder={t('common.search') || 'Search month...'}
                  size="sm"
                  className="w-44 sm:w-52"
                />
              </div>
            </div>

            {/* Monthly Preview Metrics */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="rounded-2xl border border-black/[0.02] dark:border-white/[0.04] bg-[#F6F7F5] dark:bg-[#1F2822] p-4">
                <span className="text-[11px] font-semibold text-[#76847A] dark:text-[#8E9E94]">
                  {t('archives.closingStatus')}
                </span>
                <div className="mt-1.5">
                  {existingArchiveForSelectedMonth ? (
                    <span className="inline-flex items-center space-x-1 rounded-full bg-[#E8F5E9] dark:bg-[#1E2B22] px-2.5 py-0.5 text-[11px] font-bold text-[#2E7D32] dark:text-[#34D399]">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{t('archives.alreadyArchived')}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 rounded-full bg-[#FFF8E1] dark:bg-[#2C2417] px-2.5 py-0.5 text-[11px] font-bold text-[#B45309] dark:text-[#FBBF24]">
                      <Clock className="h-3 w-3" />
                      <span>{t('archives.notClosedYet')}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-black/[0.02] dark:border-white/[0.04] bg-[#F6F7F5] dark:bg-[#1F2822] p-4">
                <span className="text-[11px] font-semibold text-[#76847A] dark:text-[#8E9E94]">
                  {t('archives.activeTransactions')}
                </span>
                <p className="mt-1.5 text-base font-bold tabular-nums text-[#18221B] dark:text-[#F0F4F1]">
                  {t('archives.transactionsCount', { count: monthTransactions.length })}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-[#F6F7F5] dark:bg-[#1F2822] p-4">
                <span className="text-[11px] font-semibold text-[#76847A] dark:text-[#8E9E94]">
                  {t('archives.monthIncome')}
                </span>
                <p className="mt-1.5 text-base font-bold tabular-nums text-[#2E7D32] dark:text-[#34D399]">
                  {formatRupiah(monthIncome)}
                </p>
              </div>

              <div className="rounded-2xl border border-rose-500/20 bg-[#F6F7F5] dark:bg-[#1F2822] p-4">
                <span className="text-[11px] font-semibold text-[#76847A] dark:text-[#8E9E94]">
                  {t('archives.monthExpense')}
                </span>
                <p className="mt-1.5 text-base font-bold tabular-nums text-[#C62828] dark:text-[#FB7185]">
                  {formatRupiah(monthExpense)}
                </p>
              </div>
            </div>

            {/* Closing Execution Button */}
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-black/[0.04] dark:border-white/[0.06] pt-4">
              <p className="text-xs text-[#76847A] dark:text-[#8E9E94]">
                {t('archives.closingDisclaimer')}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreviewCurrentMonth}
                  disabled={isClosingMonth || monthTransactions.length === 0}
                  className="flex items-center justify-center space-x-2 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] bg-[#F6F7F5] dark:bg-[#1F2822] px-4 py-2.5 text-xs font-bold text-[#18221B] dark:text-[#F0F4F1] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Eye className="h-4 w-4 text-[#5B7966] dark:text-[#A7D7B5]" />
                  <span>{t('archives.previewExcelBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExecuteClosing}
                  disabled={isClosingMonth || monthTransactions.length === 0}
                  className="flex items-center justify-center space-x-2 rounded-2xl bg-[#5B7966] dark:bg-[#A7D7B5] px-5 py-2.5 text-xs font-bold text-white dark:text-[#0C2417] shadow-sm hover:bg-[#4D6A58] dark:hover:bg-[#95D5B2] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Archive className="h-4 w-4" />
                  <span>
                    {isClosingMonth
                      ? t('archives.processing')
                      : t('archives.closeAndArchiveBtn', { month: currentSelectedMonthObj?.label || '' })}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Table of Saved Monthly Archives (Secondary Saver) */}
          <div className="rounded-[28px] border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-5 sm:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.035)]">
            <div className="flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.06] pb-4">
              <div className="flex items-center space-x-2.5">
                <Archive className="h-5 w-5 text-[#5B7966] dark:text-[#A7D7B5]" />
                <h3 className="text-base font-bold text-[#18221B] dark:text-[#F0F4F1]">
                  {t('archives.archiveHistoryTitle', { count: monthlyArchives.length })}
                </h3>
              </div>
              <span className="text-xs text-[#76847A] dark:text-[#8E9E94]">{t('archives.secondarySaverBadge')}</span>
            </div>

            {monthlyArchives.length === 0 ? (
              <div className="py-12 text-center">
                <Archive className="mx-auto h-10 w-10 text-[#76847A]/40 dark:text-[#8E9E94]/40" />
                <p className="mt-2 text-xs font-medium text-[#76847A] dark:text-[#8E9E94]">
                  {t('archives.noArchivesDesc')}
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.04] dark:border-white/[0.06] bg-[#F6F7F5] dark:bg-[#1F2822] text-[#76847A] dark:text-[#8E9E94]">
                      <th className="py-3 px-3 font-semibold rounded-l-xl">{t('archives.colMonth')}</th>
                      <th className="py-3 px-3 font-semibold">{t('archives.colTransactions')}</th>
                      <th className="py-3 px-3 font-semibold">{t('archives.colIncome')}</th>
                      <th className="py-3 px-3 font-semibold">{t('archives.colExpense')}</th>
                      <th className="py-3 px-3 font-semibold">{t('archives.colArchivedDate')}</th>
                      <th className="py-3 px-3 font-semibold text-right rounded-r-xl">{t('archives.colBackupActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                    {monthlyArchives.map((arch) => (
                      <tr key={arch.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-3 font-bold text-[#18221B] dark:text-[#F0F4F1]">
                          {arch.period_label || arch.period}
                        </td>
                        <td className="py-3.5 px-3 tabular-nums text-[#18221B] dark:text-[#F0F4F1]">
                          {t('archives.rowsCount', { count: arch.transaction_count })}
                        </td>
                        <td className="py-3.5 px-3 font-semibold tabular-nums text-[#2E7D32] dark:text-[#34D399]">
                          {formatRupiah(arch.total_income)}
                        </td>
                        <td className="py-3.5 px-3 font-semibold tabular-nums text-[#C62828] dark:text-[#FB7185]">
                          {formatRupiah(arch.total_expense)}
                        </td>
                        <td className="py-3.5 px-3 text-[#76847A] dark:text-[#8E9E94] text-[11px] tabular-nums">
                          {new Date(arch.created_at).toLocaleDateString(dateLocale, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* Preview Excel in App */}
                            <button
                              type="button"
                              onClick={() => handlePreviewArchive(arch)}
                              title={t('archives.previewExcelTitle')}
                              className="rounded-xl border border-white/10 bg-[#1A211D] p-1.5 text-[#A7D7B5] hover:border-[#A7D7B5]/40 transition-all cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            {/* Redownload Excel */}
                            <button
                              type="button"
                              onClick={() => handleRedownloadExcelFromArchive(arch)}
                              title={t('archives.redownloadExcelTitle')}
                              className="rounded-xl border border-white/10 bg-[#1A211D] p-1.5 text-[#8F9992] hover:text-[#A7D7B5] hover:border-white/20 transition-all cursor-pointer"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                            </button>

                            {/* Download JSON Snapshot */}
                            <button
                              type="button"
                              onClick={() => handleDownloadJsonSnapshot(arch)}
                              title={t('archives.downloadJsonTitle')}
                              className="rounded-xl border border-white/10 bg-[#1A211D] p-1.5 text-[#8F9992] hover:text-blue-400 hover:border-white/20 transition-all cursor-pointer"
                            >
                              <FileJson className="h-3.5 w-3.5" />
                            </button>

                            {/* View Snapshot Details */}
                            <button
                              type="button"
                              onClick={() => setSelectedDetailArchive(arch)}
                              title={t('archives.viewSnapshotTitle')}
                              className="rounded-xl border border-white/10 bg-[#1A211D] p-1.5 text-[#8F9992] hover:text-purple-400 hover:border-white/20 transition-all cursor-pointer"
                            >
                              <Layers className="h-3.5 w-3.5" />
                            </button>

                            {/* Restore to Active Database */}
                            <button
                              type="button"
                              onClick={() => handleRestoreArchive(arch.id, arch.period_label)}
                              disabled={isRestoring === arch.id}
                              title={t('archives.restoreTitle')}
                              className="rounded-xl border border-white/10 bg-[#1A211D] p-1.5 text-blue-400 hover:border-blue-400/40 transition-all cursor-pointer"
                            >
                              <RotateCcw className={`h-3.5 w-3.5 ${isRestoring === arch.id ? 'animate-spin' : ''}`} />
                            </button>

                            {/* Delete Archive Record */}
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(t('archives.deleteArchiveConfirm', { month: arch.period_label || arch.period }))) {
                                  deleteMonthlyArchive(arch.id);
                                }
                              }}
                              title={t('archives.deleteArchiveTitle')}
                              className="rounded-xl border border-white/10 bg-[#1A211D] p-1.5 text-[#8F9992] hover:text-rose-400 hover:border-rose-400/40 transition-all cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Export Workbook */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Global database backup (Admin) */}
          <div className="flex flex-col justify-between rounded-[28px] border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-6 sm:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.035)]">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="rounded-2xl bg-blue-500/15 p-2.5 text-blue-600 dark:text-blue-400">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-500/10 dark:bg-blue-400/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        Option 1
                      </span>
                      <h2 className="text-base font-bold text-[#18221B] dark:text-[#F0F4F1]">
                        Full Database Backup
                      </h2>
                    </div>
                    <p className="text-xs text-[#76847A] dark:text-[#8E9E94] mt-0.5">
                      Complete system backup covering all users and data in the database.
                    </p>
                  </div>
                </div>

                {/* Superadmin RBAC Badge */}
                <div>
                  {isSuperAdmin ? (
                    <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                      <ShieldCheck className="h-3 w-3" />
                      <span>Superadmin</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 rounded-full bg-rose-500/10 dark:bg-rose-400/10 px-2.5 py-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20 whitespace-nowrap">
                      <Lock className="h-3 w-3" />
                      <span>Superadmin Only</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Backup Highlights & Specs */}
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-[#F6F7F5] dark:bg-[#1F2822] p-3.5 text-xs border border-black/[0.02] dark:border-white/[0.04]">
                  <span className="font-semibold text-[#18221B] dark:text-[#F0F4F1] block mb-1">
                    Backup Includes:
                  </span>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#76847A] dark:text-[#8E9E94]">
                    <li>All accounts, categories, and transactions</li>
                    <li>Debts, investments, budget cycles, and archives</li>
                    <li>Available as <strong>JSON</strong> (for app restore) or <strong>SQL</strong> (for database direct)</li>
                  </ul>
                </div>

                {!isSuperAdmin && (
                  <div className="flex items-start space-x-2.5 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 p-3 text-xs text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Database backup is only accessible to Superadmin accounts.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 border-t border-black/[0.04] dark:border-white/[0.06] pt-5">
              {isSuperAdmin ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleExportGlobal('json')}
                    disabled={Boolean(isExportingGlobal)}
                    className="flex items-center justify-center space-x-2 rounded-2xl bg-blue-600 hover:bg-blue-700 py-3 text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <FileJson className="h-4 w-4" />
                    <span>{isExportingGlobal === 'json' ? 'Generating JSON...' : 'Download JSON Master'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportGlobal('sql')}
                    disabled={Boolean(isExportingGlobal)}
                    className="flex items-center justify-center space-x-2 rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-[#F6F7F5] dark:bg-[#1F2822] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] py-3 text-xs font-bold text-[#18221B] dark:text-[#F0F4F1] shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Database className="h-4 w-4 text-blue-500" />
                    <span>{isExportingGlobal === 'sql' ? 'Generating SQL...' : 'Download SQL Dump (.sql)'}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled
                  title="This feature is restricted to Superadmin accounts"
                  className="flex w-full items-center justify-center space-x-2 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] py-3 text-xs font-bold text-slate-400 dark:text-slate-500 border border-black/[0.04] dark:border-white/[0.06] cursor-not-allowed"
                >
                  <Lock className="h-4 w-4" />
                  <span>Locked (Superadmin Only)</span>
                </button>
              )}
            </div>
          </div>

          {/* Financial workbook export (.xlsx) */}
          <div className="flex flex-col justify-between rounded-[28px] border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-6 sm:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.035)]">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="rounded-2xl bg-[#E5EFE8] dark:bg-[#1E2B22] p-2.5 text-[#4D6A58] dark:text-[#A7D7B5]">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#E5EFE8] dark:bg-[#1E2B22] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#4D6A58] dark:text-[#A7D7B5] border border-[#5B7966]/20">
                        Option 2
                      </span>
                      <h2 className="text-base font-bold text-[#18221B] dark:text-[#F0F4F1]">
                        Financial Workbook (.xlsx)
                      </h2>
                    </div>
                    <p className="text-xs text-[#76847A] dark:text-[#8E9E94] mt-0.5">
                      Professional multi-sheet spreadsheet for financial reports & bookkeeping.
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center space-x-1 rounded-full bg-slate-500/10 dark:bg-slate-400/10 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-500/20 whitespace-nowrap">
                  <span>All Users</span>
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#76847A] dark:text-[#8E9E94] mb-1.5">
                    Export Scope
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-[#F6F7F5] dark:bg-[#1F2822] border border-black/[0.04] dark:border-white/[0.06] rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setExportScope('all')}
                      className={`py-2 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        exportScope === 'all'
                          ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm'
                          : 'text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B] dark:hover:text-[#F0F4F1]'
                      }`}
                    >
                      All History (Full DB)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportScope('cycle')}
                      className={`py-2 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        exportScope === 'cycle'
                          ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm'
                          : 'text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B] dark:hover:text-[#F0F4F1]'
                      }`}
                    >
                      By Cycle
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportScope('month')}
                      className={`py-2 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        exportScope === 'month'
                          ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm'
                          : 'text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B] dark:hover:text-[#F0F4F1]'
                      }`}
                    >
                      Calendar Month
                    </button>
                  </div>
                </div>

                {/* Sub-selector for Cycle */}
                {exportScope === 'cycle' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#76847A] dark:text-[#8E9E94] mb-1">
                      Choose Payday Cycle:
                    </label>
                    <SearchableSelect
                      options={[
                        {
                          value: 'active',
                          label: `Active Cycle (Starts ${cycleStartDate})`,
                        },
                        ...cycles
                          .filter((c) => !c.is_active)
                          .map((c) => ({
                            value: c.id,
                            label: c.name || `Cycle ${c.start_date}`,
                            sublabel: `${c.start_date} to ${c.end_date || '...'}`,
                          })),
                      ]}
                      value={selectedExportCycleId}
                      onChange={(val) => setSelectedExportCycleId(val)}
                      placeholder="Choose Payday Cycle"
                      searchPlaceholder="Search cycle..."
                    />
                  </div>
                )}

                {/* Sub-selector for Calendar Month */}
                {exportScope === 'month' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#76847A] dark:text-[#8E9E94] mb-1">
                      Choose Calendar Month:
                    </label>
                    <SearchableSelect
                      options={availableMonths.map((m) => ({
                        value: m.key,
                        label: m.label,
                        sublabel: `${m.start} to ${m.end}`,
                      }))}
                      value={selectedExportMonth}
                      onChange={(val) => setSelectedExportMonth(val)}
                      placeholder="Choose Calendar Month"
                      searchPlaceholder="Search month..."
                    />
                  </div>
                )}

                <div className="rounded-2xl bg-[#F6F7F5] dark:bg-[#1F2822] p-3.5 text-xs text-[#76847A] dark:text-[#8E9E94] border border-black/[0.02] dark:border-white/[0.04] flex items-center justify-between">
                  <span>Transactions Included:</span>
                  <span className="font-bold tabular-nums text-[#4D6A58] dark:text-[#A7D7B5]">
                    {exportTarget.txs.length} transactions
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-black/[0.04] dark:border-white/[0.06] pt-5">
              {exportSuccess && (
                <div className="mb-3 flex items-center space-x-2 rounded-2xl bg-[#E8F5E9] dark:bg-[#1E2B22] p-2.5 text-xs text-[#2E7D32] dark:text-[#34D399]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{t('archives.excelDownloadedSuccess')}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handlePreviewFullWorkbook}
                  className="flex items-center justify-center space-x-2 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] bg-[#F6F7F5] dark:bg-[#1F2822] py-2.5 text-xs font-bold text-[#18221B] dark:text-[#F0F4F1] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all cursor-pointer"
                >
                  <Eye className="h-4 w-4 text-[#5B7966] dark:text-[#A7D7B5]" />
                  <span>{t('archives.previewWorkbook')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportAll}
                  disabled={isExporting}
                  className="flex items-center justify-center space-x-2 rounded-2xl bg-[#5B7966] dark:bg-[#A7D7B5] py-2.5 text-xs font-bold text-white dark:text-[#0C2417] shadow-sm hover:bg-[#4D6A58] dark:hover:bg-[#95D5B2] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>{isExporting ? t('archives.generatingFile') : t('archives.downloadExcelBtn')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Import Data */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-6 sm:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.035)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-black/[0.04] dark:border-white/[0.06] pb-5">
              <div>
                <h2 className="text-base font-bold text-[#18221B] dark:text-[#F0F4F1]">
                  {t('archives.importTitle')}
                </h2>
                <p className="text-xs text-[#76847A] dark:text-[#8E9E94] mt-0.5">
                  {t('archives.importSubtitle')}
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center space-x-1.5 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] bg-[#F6F7F5] dark:bg-[#1F2822] px-3.5 py-2 text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all cursor-pointer"
              >
                <FileDown className="h-4 w-4 text-[#5B7966] dark:text-[#A7D7B5]" />
                <span>{t('archives.downloadTemplateBtn')}</span>
              </button>
            </div>

            {restoreBackupSuccess && (
              <div className="mt-4 flex items-center space-x-2 rounded-2xl bg-[#E8F5E9] dark:bg-[#1E2B22] p-3 text-xs font-semibold text-[#2E7D32] dark:text-[#34D399] border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4 text-[#2E7D32] dark:text-[#34D399] shrink-0" />
                <span>{restoreBackupSuccess}</span>
              </div>
            )}

            {importStatus && (
              <div className="mt-4 flex items-center space-x-2 rounded-2xl bg-[#E8F5E9] dark:bg-[#1E2B22] p-3 text-xs font-semibold text-[#2E7D32] dark:text-[#34D399] border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4 text-[#2E7D32] dark:text-[#34D399] shrink-0" />
                <span>{importStatus}</span>
              </div>
            )}

            {/* Drag & Drop File Upload Area */}
            <div className="mt-5">
              <label
                htmlFor="import-file"
                className={`flex flex-col items-center justify-center rounded-[28px] border-2 border-dashed p-8 transition-all cursor-pointer ${
                  isParsing
                    ? 'border-[#5B7966] dark:border-[#A7D7B5] bg-[#E5EFE8] dark:bg-[#1E2B22]'
                    : 'border-black/10 dark:border-white/15 bg-[#F6F7F5] dark:bg-[#1F2822] hover:border-[#5B7966] dark:hover:border-[#A7D7B5]'
                }`}
              >
                <Upload className="h-8 w-8 text-[#5B7966] dark:text-[#A7D7B5] mb-2" />
                <span className="text-xs font-bold text-[#18221B] dark:text-[#F0F4F1]">
                  {isParsing ? t('archives.readingFile') : t('archives.dragDropText')}
                </span>
                <span className="text-[11px] text-[#76847A] dark:text-[#8E9E94] mt-1">
                  {t('archives.dragDropSubtext')}
                </span>
                <input
                  id="import-file"
                  type="file"
                  accept=".xlsx, .xls, .json"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isParsing}
                />
              </label>
            </div>
          </div>

          {/* Master Backup Banner / Action Card */}
          {masterBackupResult && (
            <div className="rounded-[28px] border-2 border-[#5B7966] dark:border-[#A7D7B5] bg-white dark:bg-[#161D18] p-6 sm:p-7 shadow-[0_12px_40px_rgba(91,121,102,0.12)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start sm:items-center space-x-3">
                  <div className="rounded-2xl bg-[#E5EFE8] dark:bg-[#1E2B22] p-3 text-[#4D6A58] dark:text-[#A7D7B5] shrink-0">
                    <HardDrive className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold text-[#18221B] dark:text-[#F0F4F1]">
                        {masterBackupResult.isGlobalBackup
                          ? 'Database Backup File'
                          : 'Backup File Detected'}
                      </h3>
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {masterBackupResult.isGlobalBackup ? 'Full System Backup' : 'Database Snapshot'}
                      </span>
                      {isSuperAdmin ? (
                        <span className="inline-flex items-center space-x-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          <ShieldCheck className="h-3 w-3" />
                          <span>Superadmin</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <Lock className="h-3 w-3" />
                          <span>Superadmin Only</span>
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#76847A] dark:text-[#8E9E94]">
                      {masterBackupResult.isGlobalBackup
                        ? 'This backup contains complete data across all accounts, categories, and transactions. Restoring will apply these records to your app.'
                        : 'This backup contains accounts, categories, transactions, debts, and investments. Restoring will apply these records to your app.'}
                    </p>
                    {!isSuperAdmin && (
                      <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center space-x-1.5">
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        <span>Restoring a database backup requires Superadmin privileges.</span>
                      </p>
                    )}
                  </div>
                </div>

                {isSuperAdmin ? (
                  <button
                    type="button"
                    onClick={handleExecuteMasterRestore}
                    disabled={isRestoringBackup}
                    className="flex items-center justify-center space-x-2 rounded-2xl bg-[#5B7966] dark:bg-[#A7D7B5] px-5 py-3 text-xs font-bold text-white dark:text-[#0C2417] shadow-md hover:bg-[#4D6A58] dark:hover:bg-[#95D5B2] transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{isRestoringBackup ? 'Restoring Full Database...' : 'Restore Full Database State'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Only Superadmin can restore full database"
                    className="flex items-center justify-center space-x-2 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] px-5 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 border border-black/[0.04] dark:border-white/[0.06] cursor-not-allowed whitespace-nowrap shrink-0"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Locked (Superadmin Only)</span>
                  </button>
                )}
              </div>

              {/* Snapshot Entity Badges */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                {masterBackupResult.isGlobalBackup && (
                  <div className="rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 p-3 border border-blue-500/20 text-center">
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 block">Total Users</span>
                    <span className="text-lg font-extrabold text-blue-700 dark:text-blue-300 tabular-nums">
                      {masterBackupResult.summary?.usersCount ?? 0}
                    </span>
                  </div>
                )}
                <div className="rounded-2xl bg-[#F6F7F5] dark:bg-[#1F2822] p-3 border border-black/[0.03] dark:border-white/[0.04] text-center">
                  <span className="text-[10px] font-semibold text-[#76847A] dark:text-[#8E9E94] block">Accounts & Colors</span>
                  <span className="text-lg font-extrabold text-[#18221B] dark:text-[#F0F4F1] tabular-nums">
                    {masterBackupResult.summary?.accountsCount ?? 0}
                  </span>
                </div>
                <div className="rounded-2xl bg-[#F6F7F5] dark:bg-[#1F2822] p-3 border border-black/[0.03] dark:border-white/[0.04] text-center">
                  <span className="text-[10px] font-semibold text-[#76847A] dark:text-[#8E9E94] block">Categories & Icons</span>
                  <span className="text-lg font-extrabold text-[#18221B] dark:text-[#F0F4F1] tabular-nums">
                    {masterBackupResult.summary?.categoriesCount ?? 0}
                  </span>
                </div>
                <div className="rounded-2xl bg-[#F6F7F5] dark:bg-[#1F2822] p-3 border border-black/[0.03] dark:border-white/[0.04] text-center">
                  <span className="text-[10px] font-semibold text-[#76847A] dark:text-[#8E9E94] block">Transactions</span>
                  <span className="text-lg font-extrabold text-[#18221B] dark:text-[#F0F4F1] tabular-nums">
                    {masterBackupResult.summary?.transactionsCount ?? 0}
                  </span>
                </div>
                <div className="rounded-2xl bg-[#F6F7F5] dark:bg-[#1F2822] p-3 border border-black/[0.03] dark:border-white/[0.04] text-center">
                  <span className="text-[10px] font-semibold text-[#76847A] dark:text-[#8E9E94] block">Debts & Loans</span>
                  <span className="text-lg font-extrabold text-[#18221B] dark:text-[#F0F4F1] tabular-nums">
                    {masterBackupResult.summary?.debtsCount ?? 0}
                  </span>
                </div>
                <div className="rounded-2xl bg-[#F6F7F5] dark:bg-[#1F2822] p-3 border border-black/[0.03] dark:border-white/[0.04] text-center">
                  <span className="text-[10px] font-semibold text-[#76847A] dark:text-[#8E9E94] block">Investments</span>
                  <span className="text-lg font-extrabold text-[#18221B] dark:text-[#F0F4F1] tabular-nums">
                    {masterBackupResult.summary?.investmentsCount ?? 0}
                  </span>
                </div>
                <div className="rounded-2xl bg-[#F6F7F5] dark:bg-[#1F2822] p-3 border border-black/[0.03] dark:border-white/[0.04] text-center">
                  <span className="text-[10px] font-semibold text-[#76847A] dark:text-[#8E9E94] block">Cycles</span>
                  <span className="text-lg font-extrabold text-[#18221B] dark:text-[#F0F4F1] tabular-nums">
                    {masterBackupResult.summary?.cyclesCount ?? 0}
                  </span>
                </div>
                <div className="rounded-2xl bg-[#F6F7F5] dark:bg-[#1F2822] p-3 border border-black/[0.03] dark:border-white/[0.04] text-center">
                  <span className="text-[10px] font-semibold text-[#76847A] dark:text-[#8E9E94] block">Archives</span>
                  <span className="text-lg font-extrabold text-[#18221B] dark:text-[#F0F4F1] tabular-nums">
                    {masterBackupResult.summary?.archivesCount ?? 0}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Validation Diagnostics & Confirmation Preview */}
          {validationResult && (
            <div className="rounded-3xl border border-white/10 bg-[#161C18] p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#F2F5F3]">
                    {t('archives.validationTitle')}
                  </h3>
                  <p className="text-xs text-[#8F9992]">
                    {t('archives.validationTotalChecked', { count: validationResult.totalRows })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setValidationResult(null)}
                  className="text-xs text-[#8F9992] hover:text-[#F2F5F3] cursor-pointer"
                >
                  {t('archives.closePreview')}
                </button>
              </div>

              {/* Status Summary Badges */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-emerald-500/20 bg-[#1A211D] p-3.5">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{t('archives.validRows', { count: validationResult.validRows.length })}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#8F9992]">{t('archives.validRowsDesc')}</p>
                </div>

                <div className="rounded-2xl border border-amber-500/20 bg-[#1A211D] p-3.5">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{t('archives.duplicateRows', { count: validationResult.duplicateRows.length })}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#8F9992]">{t('archives.duplicateRowsDesc')}</p>
                </div>

                <div className="rounded-2xl border border-rose-500/20 bg-[#1A211D] p-3.5">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-rose-400">
                    <XCircle className="h-4 w-4" />
                    <span>{t('archives.invalidRows', { count: validationResult.invalidRows.length })}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#8F9992]">{t('archives.invalidRowsDesc')}</p>
                </div>
              </div>

              {/* Error Rows Display */}
              {validationResult.invalidRows.length > 0 && (
                <div className="mt-4 max-h-40 overflow-y-auto rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs">
                  <div className="font-semibold text-rose-400 mb-1">
                    {t('archives.rowErrorsTitle')}
                  </div>
                  <ul className="space-y-1 list-disc pl-4 text-rose-300 text-[11px]">
                    {validationResult.invalidRows.slice(0, 10).map((r: any) => (
                      <li key={r.rowNumber}>
                        #{r.rowNumber}: {r.errors.join(', ')} ({r.raw.date || t('archives.noDateText')}, {r.raw.type}, {r.raw.account})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                {uploadedFile && (
                  <button
                    type="button"
                    onClick={handlePreviewUploadedFile}
                    className="flex items-center space-x-1.5 rounded-2xl border border-[#5B7966]/30 dark:border-[#A7D7B5]/30 bg-[#5B7966]/10 dark:bg-[#A7D7B5]/10 px-4 py-2 text-xs font-bold text-[#5B7966] dark:text-[#A7D7B5] hover:opacity-80 transition-all cursor-pointer"
                  >
                    <Eye className="h-4 w-4 text-[#5B7966] dark:text-[#A7D7B5]" />
                    <span>{t('archives.previewUploadedSheet')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setValidationResult(null);
                    setUploadedFile(null);
                  }}
                  className="rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] px-4 py-2 text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] hover:text-[#18221B] dark:hover:text-[#F2F5F3] hover:border-[#5B7966]/40 dark:hover:border-white/20 transition-all cursor-pointer"
                >
                  {t('archives.cancelImport')}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={isImporting || validationResult.itemsToImport.length === 0}
                  className="rounded-2xl bg-[#5B7966] dark:bg-[#A7D7B5] px-5 py-2 text-xs font-bold text-white dark:text-[#0D110F] shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isImporting
                    ? t('archives.importingBtn')
                    : t('archives.confirmImportBtn', { count: validationResult.itemsToImport.length })}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Snapshot Detail Modal */}
      {selectedDetailArchive && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedDetailArchive(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 p-4 backdrop-blur-md"
        >
          <div className="w-full max-w-2xl rounded-3xl border border-[#DDE2DE] dark:border-white/10 bg-white dark:bg-[#161D18] p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E2E8E4] dark:border-white/8 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#18221B] dark:text-[#F2F5F3]">
                  {t('archives.snapshotModalTitle', { period: selectedDetailArchive.period_label || selectedDetailArchive.period })}
                </h3>
                <p className="text-xs text-[#6B7770] dark:text-[#8F9992]">
                  {t('archives.snapshotModalSubtitle', { count: selectedDetailArchive.transaction_count })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailArchive(null)}
                className="rounded-xl p-1.5 text-[#6B7770] dark:text-[#8F9992] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#18221B] dark:hover:text-[#F2F5F3] transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8E4] dark:border-white/8 bg-[#F6F7F5] dark:bg-[#1A211D] text-[#6B7770] dark:text-[#8F9992]">
                    <th className="py-2 px-3 font-semibold">{t('common.date')}</th>
                    <th className="py-2 px-3 font-semibold">{t('common.type')}</th>
                    <th className="py-2 px-3 font-semibold">{t('common.amount')}</th>
                    <th className="py-2 px-3 font-semibold">{t('common.description')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {(selectedDetailArchive.data_snapshot || []).map((tItem, idx) => {
                    const isDebt = isDebtSettlementTransaction(tItem);
                    return (
                      <tr key={idx} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[#6B7770] dark:text-[#8F9992]">{tItem.date}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              isDebt
                                ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                                : tItem.type === 'income'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : tItem.type === 'expense'
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            {isDebt ? 'DEBT REPAYMENT' : tItem.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold font-mono tabular-nums text-[#18221B] dark:text-[#F2F5F3]">
                          {formatRupiah(tItem.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-[#6B7770] dark:text-[#8F9992] text-[11px] truncate max-w-xs">
                          {tItem.description || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E2E8E4] dark:border-white/8 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const arch = selectedDetailArchive;
                  setSelectedDetailArchive(null);
                  handlePreviewArchive(arch);
                }}
                className="inline-flex items-center space-x-1.5 rounded-2xl border border-[#5B7966]/30 dark:border-[#A7D7B5]/30 bg-[#5B7966]/10 dark:bg-[#A7D7B5]/10 px-4 py-2 text-xs font-bold text-[#5B7966] dark:text-[#A7D7B5] hover:opacity-80 transition-all cursor-pointer"
              >
                <Eye className="h-4 w-4 text-[#5B7966] dark:text-[#A7D7B5]" />
                <span>{t('archives.previewExcelBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleRedownloadExcelFromArchive(selectedDetailArchive)}
                className="inline-flex items-center space-x-1.5 rounded-2xl bg-[#5B7966] dark:bg-[#A7D7B5] px-4 py-2 text-xs font-bold text-white dark:text-[#0D110F] shadow-sm hover:opacity-90 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>{t('archives.downloadExcel')}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDetailArchive(null)}
                className="rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] px-4 py-2 text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] hover:text-[#18221B] dark:hover:text-[#F2F5F3] hover:border-[#5B7966]/40 dark:hover:border-white/20 transition-all cursor-pointer"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Excel Spreadsheet Preview Modal */}
      <ExcelPreviewModal
        data={previewData}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
}
