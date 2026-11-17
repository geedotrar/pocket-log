'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  HandCoins,
  ArrowRight,
  ArrowRightLeft,
  Building2,
  Sparkles,
  X,
  Search,
  CalendarClock,
  Settings2,
  Plus,
  Layers,
  ChevronRight,
  CheckCircle2,
  CreditCard,
  Check,
  User,
  Smartphone,
  Banknote,
} from 'lucide-react';

import { useFinanceData } from '@/lib/data/DataContext';
import { PeriodType } from '@/lib/types';
import {
  formatRupiah,
  formatInputNumber,
  parseInputNumber,
  getDateRangeForPeriod,
  filterTransactionsByDate,
  calculateFinancialSummary,
  calculateAccountBalances,
  calculateCategorySpending,
  calculateAccountSpending,
  calculateMonthlyTrend,
  isDebtSettlementTransaction,
  formatTransactionDescription,
  getLocalDateString,
} from '@/lib/calculations';
import PeriodSelector from '@/components/dashboard/PeriodSelector';
import ReportsSection from '@/components/dashboard/ReportsSection';
import TransactionModal from '@/components/modals/TransactionModal';
import BudgetGauge from '@/components/dashboard/BudgetGauge';
import BalanceWaveChart from '@/components/dashboard/BalanceWaveChart';
import { useLanguage } from '@/lib/i18n/LanguageContext';

function getAccountTypeIcon(type?: string) {
  switch (type) {
    case 'cash':
      return Banknote;
    case 'ewallet':
      return Smartphone;
    case 'credit_card':
      return CreditCard;
    case 'investment':
      return TrendingUp;
    default:
      return Building2;
  }
}

export default function DashboardPage() {
  const {
    accounts,
    categories,
    transactions,
    debts,
    cycleStartDate,
    currentUser,
    startNewCycle,
    updateAccountBudgetInclusions,
    isLoading,
  } = useFinanceData();
  const { t, locale } = useLanguage();

  const [period, setPeriod] = useState<PeriodType>('current_cycle');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Modals
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [newCycleDate, setNewCycleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [allocations, setAllocations] = useState<{ [id: string]: string }>({});
  const [cycleInclusions, setCycleInclusions] = useState<{ [id: string]: boolean }>({});
  const [isSavingCycle, setIsSavingCycle] = useState(false);
  const [cycleAccountSearch, setCycleAccountSearch] = useState('');

  const [isSelectBudgetModalOpen, setIsSelectBudgetModalOpen] = useState(false);
  const [budgetModalInclusions, setBudgetModalInclusions] = useState<{ [id: string]: boolean }>({});
  const [budgetModalSearch, setBudgetModalSearch] = useState('');
  const [isSavingBudgetModal, setIsSavingBudgetModal] = useState(false);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);

  // Close modals on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCycleModalOpen) setIsCycleModalOpen(false);
        if (isSelectBudgetModalOpen) setIsSelectBudgetModalOpen(false);
        if (isTxModalOpen) setIsTxModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCycleModalOpen, isSelectBudgetModalOpen, isTxModalOpen]);

  // Calculate current date range
  const dateRange = useMemo(() => {
    return getDateRangeForPeriod(period, customStart, customEnd, new Date(), cycleStartDate);
  }, [period, customStart, customEnd, cycleStartDate]);

  // Filter transactions within period
  const periodTransactions = useMemo(() => {
    return filterTransactionsByDate(transactions, dateRange.startDate, dateRange.endDate);
  }, [transactions, dateRange]);

  // Calculate summary metrics
  const summary = useMemo(() => {
    return calculateFinancialSummary(
      accounts,
      transactions,
      periodTransactions,
      debts,
      period === 'current_cycle' ? cycleStartDate : undefined,
      categories
    );
  }, [accounts, transactions, periodTransactions, debts, period, cycleStartDate, categories]);

  // Today's expenses & transaction count
  const todayStr = useMemo(() => getLocalDateString(), []);
  const { todayExpenses, todayExpenseCount } = useMemo(() => {
    const list = transactions.filter(
      (t) => (t.type === 'expense' || !t.type) && (t.date || '').slice(0, 10) === todayStr
    );
    const sum = list.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    return {
      todayExpenses: sum,
      todayExpenseCount: list.length,
    };
  }, [transactions, todayStr]);

  // Accounts with computed balance
  const accountsWithBalance = useMemo(() => {
    return calculateAccountBalances(
      accounts,
      transactions,
      debts,
      period === 'current_cycle' ? cycleStartDate : undefined
    );
  }, [accounts, transactions, debts, period, cycleStartDate]);

  // Top 4 active accounts for dashboard preview card
  const topAccounts = useMemo(() => {
    return [...accountsWithBalance]
      .filter((a) => a.is_active !== false)
      .slice(0, 4);
  }, [accountsWithBalance]);

  // Recent 4 transfers / transactions
  const recentTransfers = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 4);
  }, [transactions]);

  // Category breakdown
  const categorySpending = useMemo(() => {
    return calculateCategorySpending(periodTransactions, categories);
  }, [periodTransactions, categories]);

  // Account / Pocket breakdown
  const accountSpending = useMemo(() => {
    return calculateAccountSpending(periodTransactions, accounts);
  }, [periodTransactions, accounts]);

  // Monthly comparison
  const monthlyTrend = useMemo(() => {
    return calculateMonthlyTrend(transactions, new Date().getFullYear(), locale, categories);
  }, [transactions, locale, categories]);

  // Active budget accounts
  const activeBudgetAccounts = useMemo(() => {
    return accounts.filter((a) => a.include_in_budget !== false);
  }, [accounts]);

  // Helper maps for Cycle Modal
  const accountBalanceMap = useMemo(() => {
    const map = new Map<string, number>();
    accountsWithBalance.forEach((a) => {
      map.set(a.id, a.current_balance ?? Number(a.initial_balance) ?? 0);
    });
    return map;
  }, [accountsWithBalance]);

  const accountPastSpendingMap = useMemo(() => {
    const map = new Map<string, number>();
    accountSpending.forEach((item) => {
      map.set(item.accountId, item.total);
    });
    return map;
  }, [accountSpending]);

  const openStartCycleModal = () => {
    setNewCycleDate(new Date().toISOString().slice(0, 10));
    const initAlloc: { [id: string]: string } = {};
    const initInc: { [id: string]: boolean } = {};
    accounts.forEach((a) => {
      initAlloc[a.id] = formatInputNumber(a.monthly_budget ?? a.initial_balance ?? 0);
      initInc[a.id] = a.include_in_budget !== false;
    });
    setAllocations(initAlloc);
    setCycleInclusions(initInc);
    setCycleAccountSearch('');
    setIsCycleModalOpen(true);
  };

  const handleSaveCycle = async () => {
    if (isSavingCycle) return;
    setIsSavingCycle(true);
    try {
      const budgetList = Object.entries(allocations).map(([id, val]) => ({
        id,
        budget: parseInputNumber(val),
        include_in_budget: cycleInclusions[id] ?? true,
      }));
      await startNewCycle(newCycleDate, budgetList);
      setIsCycleModalOpen(false);
    } catch (err) {
      console.error('Failed to start new cycle:', err);
    } finally {
      setIsSavingCycle(false);
    }
  };

  const openSelectBudgetAccountsModal = () => {
    const map: { [id: string]: boolean } = {};
    accounts.forEach((a) => {
      map[a.id] = a.include_in_budget !== false;
    });
    setBudgetModalInclusions(map);
    setBudgetModalSearch('');
    setIsSelectBudgetModalOpen(true);
  };

  const handleSaveBudgetInclusions = async () => {
    if (isSavingBudgetModal) return;
    setIsSavingBudgetModal(true);
    try {
      await updateAccountBudgetInclusions(budgetModalInclusions);
      setIsSelectBudgetModalOpen(false);
    } catch (err) {
      console.error('Failed to update budget inclusions:', err);
    } finally {
      setIsSavingBudgetModal(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
        {/* Spent this month */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between lg:col-span-3 transition-transform hover:-translate-y-0.5 duration-200">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
              Spent this month
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1] tabular-nums mt-1 whitespace-nowrap overflow-x-auto no-scrollbar">
              {formatRupiah(summary.totalExpense)}
            </div>
          </div>

          {/* 5 Vertical mini equalizer bars in sage green */}
          <div className="flex items-end space-x-1.5 h-10 px-2">
            <span className="w-1.5 h-4 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-8 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-10 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-6 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-9 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
          </div>
        </div>

        {/* Remaining budget */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between lg:col-span-3 transition-transform hover:-translate-y-0.5 duration-200">
          <div className="flex items-center space-x-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E5EFE8] dark:bg-[#1E2B22] text-[#4D6A58] dark:text-[#A7D7B5]">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
                Remaining Budget
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1] tabular-nums mt-0.5 whitespace-nowrap overflow-x-auto no-scrollbar">
                {formatRupiah(summary.remainingBudget)}
              </div>
              {summary.offBudgetInflow > 0 && (
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 block mt-0.5 whitespace-nowrap">
                  incl. +{formatRupiah(summary.offBudgetInflow)} emergency
                </span>
              )}
            </div>
          </div>

          {/* Mini Sparkline Curve */}
          <div className="w-14 h-8 shrink-0">
            <svg viewBox="0 0 50 30" fill="none" className="w-full h-full text-[#5E7A68] dark:text-[#A7D7B5]">
              <path
                d="M 2 24 C 12 18, 20 28, 30 14 C 38 4, 44 12, 48 8"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Total cycle income */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between lg:col-span-3 transition-transform hover:-translate-y-0.5 duration-200">
          <div className="flex items-center space-x-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FDF2E7] dark:bg-[#2C2317] text-[#B4783E] dark:text-[#FBBF24]">
              <HandCoins className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
                Total Income
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1] tabular-nums mt-0.5 whitespace-nowrap overflow-x-auto no-scrollbar">
                {formatRupiah(summary.totalIncome)}
              </div>
            </div>
          </div>
        </div>

        {/* Today's spending activity */}
        <div
          onClick={() => setIsTxModalOpen(true)}
          className="rounded-[28px] bg-[#5B7966] dark:bg-[#3E5747] text-white p-5 sm:p-6 shadow-[0_10px_30px_rgba(91,121,102,0.3)] flex items-center justify-between lg:col-span-3 cursor-pointer transition-transform hover:-translate-y-1 active:scale-98 duration-200"
          title="Click to add transaction today"
        >
          <div>
            <span className="text-xs font-semibold text-white/80 block">
              Activity • Today
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums mt-0.5 whitespace-nowrap overflow-x-auto no-scrollbar">
              {formatRupiah(todayExpenses)}
            </div>
            <span className="text-[11px] text-white/70 mt-1 block">
              {todayExpenseCount} expenses recorded
            </span>
          </div>

          {/* Smooth white wavy curve */}
          <div className="w-16 h-10 shrink-0">
            <svg viewBox="0 0 60 30" fill="none" className="w-full h-full text-white">
              <path
                d="M 2 16 C 15 4, 25 28, 40 10 C 48 -2, 54 18, 58 12"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Balance wave and budget overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
        {/* Middle Left: Balance • On track Large Card with Wave Chart (Col-span 6) */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 sm:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] lg:col-span-6 flex flex-col justify-between min-h-[300px]">
          <div>
            {/* Top row: Balance title + On track badge + Period Dropdown */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <h3 className="text-lg font-bold text-[#18221B] dark:text-[#F0F4F1] tracking-tight">
                  Balance
                </h3>
                <span className="inline-flex items-center space-x-1 rounded-full bg-[#E8F5E9] dark:bg-[#1E2B22] px-2.5 py-0.5 text-xs font-semibold text-[#2E7D32] dark:text-[#34D399]">
                  <Check className="h-3 w-3 stroke-[3]" />
                  <span>{summary.budgetUsagePercent <= 100 ? 'On track' : 'Over budget'}</span>
                </span>
              </div>

              {/* Period dropdown */}
              <PeriodSelector
                period={period}
                onChangePeriod={setPeriod}
                startDate={customStart}
                endDate={customEnd}
                onChangeCustomDates={(start, end) => {
                  setCustomStart(start);
                  setCustomEnd(end);
                }}
              />
            </div>

            {/* Allocation and total balance pills */}
            <div className={`grid ${summary.offBudgetInflow > 0 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'} gap-2.5 sm:gap-3 mt-6`}>
              {/* Remaining Allocation */}
              <div className="rounded-2xl bg-[#F6F7F5] dark:bg-[#1F2822] p-3.5 sm:p-4 flex flex-col justify-between border border-black/[0.02] dark:border-white/[0.04]">
                <div className="flex items-center justify-between text-xs text-[#76847A] dark:text-[#8E9E94]">
                  <span className="truncate">Remaining</span>
                  <span className="rounded-full bg-[#E8F5E9] dark:bg-[#1E2B22] px-2 py-0.5 text-[10px] font-bold text-[#2E7D32] dark:text-[#34D399]">
                    +{Math.max(0, 100 - summary.budgetUsagePercent)}%
                  </span>
                </div>
                <div className="text-lg sm:text-2xl font-bold tracking-tight text-[#18221B] dark:text-[#F0F4F1] tabular-nums mt-1 whitespace-nowrap overflow-x-auto no-scrollbar">
                  {Math.max(0, 100 - summary.budgetUsagePercent)}%
                </div>
              </div>

              {/* Outside Allocation / Emergency Inflow */}
              {summary.offBudgetInflow > 0 && (
                <div className="rounded-2xl bg-amber-500/10 dark:bg-amber-950/20 p-3.5 sm:p-4 flex flex-col justify-between border border-amber-500/20">
                  <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
                    <span className="truncate font-semibold">Outside Budget</span>
                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      Emergency
                    </span>
                  </div>
                  <div className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-amber-700 dark:text-amber-300 tabular-nums mt-1 whitespace-nowrap overflow-x-auto no-scrollbar">
                    +{formatRupiah(summary.offBudgetInflow)}
                  </div>
                </div>
              )}

              {/* Total Balance */}
              <div className="rounded-2xl bg-[#F6F7F5] dark:bg-[#1F2822] p-3.5 sm:p-4 flex flex-col justify-between border border-black/[0.02] dark:border-white/[0.04]">
                <div className="flex items-center justify-between text-xs text-[#76847A] dark:text-[#8E9E94]">
                  <span className="truncate">Total Balance</span>
                  <span className="rounded-full bg-[#FFEBEE] dark:bg-[#2C1C1D] px-2 py-0.5 text-[10px] font-bold text-[#C62828] dark:text-[#FB7185]">
                    {summary.budgetUsagePercent > 0 ? `-${summary.budgetUsagePercent}%` : '0%'}
                  </span>
                </div>
                <div className="text-lg sm:text-2xl font-bold tracking-tight text-[#18221B] dark:text-[#F0F4F1] tabular-nums mt-1 whitespace-nowrap overflow-x-auto no-scrollbar">
                  {formatRupiah(summary.totalBalance)}
                </div>
              </div>
            </div>
          </div>

          {/* Smooth organic wave area line chart along the bottom */}
          <div className="mt-4 pt-2">
            <BalanceWaveChart className="h-28 w-full" />
          </div>
        </div>

        {/* Middle Center: Earnings / Budget Terpakai Radial Gauge (Col-span 3) */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 sm:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] lg:col-span-3 flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#18221B] dark:text-[#F0F4F1] tracking-tight">
                Budget Used
              </h3>
              <button
                type="button"
                onClick={openStartCycleModal}
                className="text-xs font-semibold text-[#5B7966] dark:text-[#A7D7B5] hover:underline"
              >
                New Cycle
              </button>
            </div>
            <span className="text-xs text-[#76847A] dark:text-[#8E9E94] mt-0.5 block">
              Total Expense
            </span>

            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1] tabular-nums mt-2 whitespace-nowrap overflow-x-auto no-scrollbar">
              {formatRupiah(summary.totalExpense)}
            </div>

            <p className="text-xs text-[#76847A] dark:text-[#8E9E94] mt-2">
              {summary.budgetUsagePercent}% of {formatRupiah(summary.effectiveBudget)} total budget used.
            </p>

            {summary.offBudgetInflow > 0 && (
              <div className="mt-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-400 flex items-center justify-between gap-1">
                <span className="font-medium truncate whitespace-nowrap">Outside Allocation:</span>
                <span className="font-bold font-mono shrink-0 whitespace-nowrap">+{formatRupiah(summary.offBudgetInflow)}</span>
              </div>
            )}
          </div>

          {/* Semi-circle radial gauge */}
          <div className="mt-4 flex justify-center pb-2">
            <BudgetGauge percentage={summary.budgetUsagePercent} size={150} strokeWidth={16} />
          </div>
        </div>

        {/* Middle Right: Profile / Pocket Summary Card (Col-span 3) */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 sm:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] lg:col-span-3 flex flex-col items-center justify-between text-center min-h-[300px]">
          <div className="flex flex-col items-center mt-2">
            {/* Centered Avatar with Ring */}
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#E5EFE8] dark:bg-[#202B24] ring-4 ring-black/5 dark:ring-white/10 shadow-md">
              <span className="text-xl font-bold text-[#4D6A58] dark:text-[#A7D7B5]">
                {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'P'}
              </span>
            </div>

            <h4 className="text-base font-bold text-[#18221B] dark:text-[#F0F4F1] mt-3">
              {currentUser?.full_name || 'PocketLog User'}
            </h4>
            <span className="text-xs text-[#76847A] dark:text-[#8E9E94]">
              Finance & Pocket Manager
            </span>
          </div>

          {/* Metric columns */}
          <div className="grid grid-cols-3 gap-2 w-full pt-4 border-t border-black/[0.06] dark:border-white/[0.08] mt-4">
            <div>
              <span className="text-[10px] uppercase font-semibold text-[#76847A] dark:text-[#8E9E94] block">
                Pockets
              </span>
              <span className="text-lg font-bold text-[#18221B] dark:text-[#F0F4F1] tabular-nums">
                {accounts.length}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-[#76847A] dark:text-[#8E9E94] block">
                Transactions
              </span>
              <span className="text-lg font-bold text-[#18221B] dark:text-[#F0F4F1] tabular-nums">
                {periodTransactions.length}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-[#76847A] dark:text-[#8E9E94] block">
                Categories
              </span>
              <span className="text-lg font-bold text-[#18221B] dark:text-[#F0F4F1] tabular-nums">
                {categories.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Accounts & Wallets and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Left: Accounts & Wallets */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#18221B] dark:text-[#F0F4F1] tracking-tight">
                  Accounts & Wallets
                </h3>
                <span className="text-xs text-[#76847A] dark:text-[#8E9E94]">
                  Active balances and cash
                </span>
              </div>
              <Link
                href="/accounts"
                className="text-xs font-semibold text-[#5B7966] dark:text-[#A7D7B5] hover:underline"
              >
                All →
              </Link>
            </div>

            <div className="space-y-3">
              {topAccounts.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-[#76847A] dark:text-[#8E9E94] mb-3">
                    No accounts recorded yet.
                  </p>
                  <Link
                    href="/accounts"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5B7966]/10 text-[#5B7966] dark:bg-[#A7D7B5]/10 dark:text-[#A7D7B5] text-xs font-semibold hover:bg-[#5B7966]/20 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create an Account</span>
                  </Link>
                </div>
              ) : (
                topAccounts.map((acc) => {
                  const Icon = getAccountTypeIcon(acc.type);
                  return (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between py-1 border-b border-black/[0.04] dark:border-white/[0.04] last:border-none"
                    >
                      <div className="flex items-center space-x-2.5 truncate pr-2">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-2xs"
                          style={{ backgroundColor: acc.color || '#5B7966' }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="truncate">
                          <span className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1] block truncate">
                            {acc.name}
                          </span>
                          <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94] capitalize">
                            {acc.type ? acc.type.replace('_', ' ') : 'Wallet'}
                          </span>
                        </div>
                      </div>

                      <span className="text-xs font-bold text-[#18221B] dark:text-[#F0F4F1] tabular-nums shrink-0">
                        {formatRupiah(acc.current_balance ?? acc.initial_balance ?? 0)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
            <Link
              href="/accounts"
              className="text-xs font-semibold text-[#5B7966] dark:text-[#A7D7B5] flex items-center justify-between hover:underline"
            >
              <span>Manage Accounts</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Right: Recent Activity */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#18221B] dark:text-[#F0F4F1] tracking-tight">
                  Recent Activity
                </h3>
                <span className="text-xs text-[#76847A] dark:text-[#8E9E94]">
                  Latest cycle transactions
                </span>
              </div>
              <Link
                href="/transactions"
                className="text-xs font-semibold text-[#5B7966] dark:text-[#A7D7B5] hover:underline"
              >
                All →
              </Link>
            </div>

            <div className="space-y-3">
              {recentTransfers.length === 0 ? (
                <p className="text-xs text-[#76847A] dark:text-[#8E9E94] py-8 text-center">
                  No recorded transactions.
                </p>
              ) : (
                recentTransfers.map((tx) => {
                  const isExpense = tx.type === 'expense' || !tx.type;
                  const isIncome = tx.type === 'income';
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-1 border-b border-black/[0.04] dark:border-white/[0.04] last:border-none"
                    >
                      <div className="truncate pr-2">
                        <span className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1] block truncate">
                          {tx.description ? formatTransactionDescription(tx.description) : 'Transaction'}
                        </span>
                        <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94]">
                          {tx.date ? new Date(tx.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : 'Today'}
                        </span>
                      </div>

                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums shrink-0 ${
                          isIncome
                            ? 'bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1E2B22] dark:text-[#34D399]'
                            : 'bg-[#FFEBEE] text-[#C62828] dark:bg-[#2C1C1D] dark:text-[#FB7185]'
                        }`}
                      >
                        {isIncome ? '+' : '-'}{formatRupiah(tx.amount)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
            <Link
              href="/transactions"
              className="text-xs font-semibold text-[#5B7966] dark:text-[#A7D7B5] flex items-center justify-between hover:underline"
            >
              <span>View All Transactions</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Financial reports section */}
      <ReportsSection />

      {/* New budget cycle modal */}
      {isCycleModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCycleModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-xl rounded-t-[32px] sm:rounded-3xl bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-2xl border-t sm:border border-black/[0.04] dark:border-white/[0.08] max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <h3 className="text-lg font-bold text-[#18221B] dark:text-[#F0F4F1]">
                  Start New Budget Cycle
                </h3>
                <p className="text-xs text-[#76847A] dark:text-[#8E9E94]">
                  Set budget allocations for your active pockets
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCycleModalOpen(false)}
                className="rounded-full p-2 text-[#76847A] hover:bg-black/5 dark:hover:bg-white/5 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1] block mb-1.5">
                  Cycle Start Date
                </label>
                <input
                  type="date"
                  value={newCycleDate}
                  onChange={(e) => setNewCycleDate(e.target.value)}
                  className="w-full rounded-2xl bg-[#F6F7F5] dark:bg-[#1F2822] px-4 py-2.5 text-base sm:text-xs text-[#18221B] dark:text-[#F0F4F1] border border-black/[0.04] dark:border-white/[0.06] focus:outline-none"
                />
              </div>

              {/* List of allocations */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#F6F7F5] dark:bg-[#1F2822]"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1] block truncate">
                        {acc.pocket_name ? `${acc.name} - ${acc.pocket_name}` : acc.name}
                      </span>
                      <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94] whitespace-nowrap block">
                        Balance: {formatRupiah(accountBalanceMap.get(acc.id) || 0)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-xs font-medium text-[#76847A]">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={allocations[acc.id] || '0'}
                        onChange={(e) => setAllocations({ ...allocations, [acc.id]: e.target.value })}
                        className="w-28 rounded-xl bg-white dark:bg-[#161D18] px-2.5 py-2 text-base sm:text-xs text-right font-mono font-semibold text-[#18221B] dark:text-[#F0F4F1] border border-black/[0.06] dark:border-white/[0.08]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsCycleModalOpen(false)}
                  className="min-h-[44px] rounded-2xl px-4 py-2.5 text-xs font-semibold text-[#76847A] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCycle}
                  disabled={isSavingCycle}
                  className="min-h-[44px] rounded-2xl bg-[#5B7966] dark:bg-[#A7D7B5] px-5 py-2.5 text-xs font-bold text-white dark:text-[#0C2417] shadow-sm hover:bg-[#4D6A58] dark:hover:bg-[#95D5B2] cursor-pointer flex items-center justify-center"
                >
                  {isSavingCycle ? 'Saving...' : 'Apply Cycle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Transaction Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
      />
    </div>
  );
}
