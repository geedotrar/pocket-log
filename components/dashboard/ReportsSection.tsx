'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  Award,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { useFinanceData } from '@/lib/data/DataContext';
import {
  formatRupiah,
  calculateCategorySpending,
  calculateAccountSpending,
  calculateDailySpending,
  calculateMonthlyTrend,
  isDebtSettlementTransaction,
} from '@/lib/calculations';
import CategoryExpenseChart from '@/components/dashboard/CategoryExpenseChart';
import { useLanguage } from '@/lib/i18n/LanguageContext';

type ReportMode = 'weekly' | 'monthly' | 'yearly';

export default function ReportsSection() {
  const { transactions, categories, accounts } = useFinanceData();
  const { t, locale, dateLocale } = useLanguage();

  const [mode, setMode] = useState<ReportMode>('monthly');

  // Month navigation state: offset in months relative to today
  const [monthOffset, setMonthOffset] = useState(0);
  // Week navigation state: offset in weeks relative to today
  const [weekOffset, setWeekOffset] = useState(0);
  // Year navigation state: offset in years relative to today
  const [yearOffset, setYearOffset] = useState(0);

  // Pad helper
  const pad = (n: number) => n.toString().padStart(2, '0');

  // 1. Target Month calculations
  const targetMonthDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const monthInfo = useMemo(() => {
    const year = targetMonthDate.getFullYear();
    const month = targetMonthDate.getMonth();
    const firstDay = `${year}-${pad(month + 1)}-01`;
    const lastDay = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;
    const label = targetMonthDate.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
    return {
      label,
      startDate: firstDay,
      endDate: lastDay,
      year,
    };
  }, [targetMonthDate, dateLocale]);

  // 2. Target Week calculations
  const weekInfo = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() + weekOffset * 7);

    // Monday
    const day = today.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // Previous week dates for comparison
    const prevMonday = new Date(monday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevSunday = new Date(sunday);
    prevSunday.setDate(prevSunday.getDate() - 7);

    return {
      startDate: formatD(monday),
      endDate: formatD(sunday),
      prevStartDate: formatD(prevMonday),
      prevEndDate: formatD(prevSunday),
      label: `${monday.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}`,
    };
  }, [weekOffset, dateLocale]);

  // 3. Target Year calculations
  const targetYear = useMemo(() => {
    return new Date().getFullYear() + yearOffset;
  }, [yearOffset]);

  // Data for Monthly mode
  const monthlyTransactions = useMemo(() => {
    return transactions.filter((t) => t.date >= monthInfo.startDate && t.date <= monthInfo.endDate);
  }, [transactions, monthInfo]);

  const monthlySummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let highestExpense = 0;
    let highestExpenseTx: typeof transactions[0] | null = null;

    for (const t of monthlyTransactions) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        if (!isDebtSettlementTransaction(t, categories)) {
          income += amt;
        }
      }
      if (t.type === 'expense') {
        expense += amt;
        if (amt > highestExpense) {
          highestExpense = amt;
          highestExpenseTx = t;
        }
      }
    }

    return {
      income,
      expense,
      net: income - expense,
      txCount: monthlyTransactions.length,
      highestExpense,
      highestExpenseTx,
    };
  }, [monthlyTransactions, categories]);

  const monthlyCategorySpending = useMemo(() => {
    return calculateCategorySpending(monthlyTransactions, categories);
  }, [monthlyTransactions, categories]);

  const monthlyAccountSpending = useMemo(() => {
    return calculateAccountSpending(monthlyTransactions, accounts);
  }, [monthlyTransactions, accounts]);

  // Data for Weekly mode
  const weeklyTransactions = useMemo(() => {
    return transactions.filter((t) => t.date >= weekInfo.startDate && t.date <= weekInfo.endDate);
  }, [transactions, weekInfo]);

  const prevWeeklyTransactions = useMemo(() => {
    return transactions.filter((t) => t.date >= weekInfo.prevStartDate && t.date <= weekInfo.prevEndDate);
  }, [transactions, weekInfo]);

  const weeklySummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of weeklyTransactions) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        if (!isDebtSettlementTransaction(t, categories)) {
          income += amt;
        }
      }
      if (t.type === 'expense') expense += amt;
    }

    let prevExpense = 0;
    for (const t of prevWeeklyTransactions) {
      if (t.type === 'expense') prevExpense += Number(t.amount) || 0;
    }

    const diffPct = prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : 0;

    return {
      income,
      expense,
      net: income - expense,
      prevExpense,
      diffPct: Number(diffPct.toFixed(1)),
    };
  }, [weeklyTransactions, prevWeeklyTransactions, categories]);

  const dailySpending = useMemo(() => {
    return calculateDailySpending(transactions, weekInfo.startDate, weekInfo.endDate, locale);
  }, [transactions, weekInfo, locale]);

  // Data for Yearly mode
  const yearlyTrend = useMemo(() => {
    return calculateMonthlyTrend(transactions, targetYear, locale, categories);
  }, [transactions, targetYear, locale, categories]);

  const yearlySummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const m of yearlyTrend) {
      income += m.income;
      expense += m.expense;
    }
    return {
      income,
      expense,
      net: income - expense,
    };
  }, [yearlyTrend]);

  return (
    <section id="reports" className="space-y-6 pt-4">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-[#F2F5F3] sm:text-2xl">
            {t('reports.title')}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#8F9992]">
            {t('reports.subtitle')}
          </p>
        </div>

        {/* Segmented Mode Selector as Floating Capsule */}
        <div className="flex items-center rounded-full bg-white dark:bg-[#161D18] border border-black/[0.04] dark:border-white/[0.06] p-1.5 w-full sm:w-fit justify-center shadow-[0_4px_16px_rgba(0,0,0,0.03)] shrink-0">
          <button
            type="button"
            onClick={() => setMode('weekly')}
            className={`flex-1 sm:flex-initial rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              mode === 'weekly'
                ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm'
                : 'text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B] dark:hover:text-[#F0F4F1]'
            }`}
          >
            {t('reports.modeWeekly')}
          </button>
          <button
            type="button"
            onClick={() => setMode('monthly')}
            className={`flex-1 sm:flex-initial rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              mode === 'monthly'
                ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm'
                : 'text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B] dark:hover:text-[#F0F4F1]'
            }`}
          >
            {t('reports.modeMonthly')}
          </button>
          <button
            type="button"
            onClick={() => setMode('yearly')}
            className={`flex-1 sm:flex-initial rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              mode === 'yearly'
                ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm'
                : 'text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B] dark:hover:text-[#F0F4F1]'
            }`}
          >
            {t('reports.modeYearly')}
          </button>
        </div>
      </div>

      {/* Monthly view */}
      {mode === 'monthly' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Navigation Bar as Floating Capsule */}
          <div className="flex items-center justify-between rounded-full border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-2 sm:p-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <button
              type="button"
              onClick={() => setMonthOffset((m) => m - 1)}
              className="flex items-center space-x-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] bg-[#F6F7F5] dark:bg-[#1F2822] px-3.5 py-2 text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t('reports.prevMonth')}</span>
            </button>

            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-[#4D6A58] dark:text-[#A7D7B5]" />
              <span className="text-sm font-bold text-[#18221B] dark:text-[#F0F4F1]">
                {monthInfo.label}
              </span>
              {monthOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => setMonthOffset(0)}
                  className="rounded-full bg-[#E5EFE8] dark:bg-[#1E2B22] px-2.5 py-0.5 text-[10px] font-bold text-[#4D6A58] dark:text-[#A7D7B5] hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span className="hidden sm:inline">{t('reports.backToThisMonth')}</span>
                  <span className="sm:hidden">Current</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMonthOffset((m) => m + 1)}
              className="flex items-center space-x-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] bg-[#F6F7F5] dark:bg-[#1F2822] px-3.5 py-2 text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <span className="hidden sm:inline">{t('reports.nextMonth')}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Monthly summary cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Monthly income */}
            <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">{t('reports.monthIncome')}</span>
                <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-[#2E7D32] dark:text-[#34D399]">
                  +{formatRupiah(monthlySummary.income)}
                </div>
                <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94] mt-1 block">Total monthly income</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#E8F5E9] dark:bg-[#1E2B22] text-[#2E7D32] dark:text-[#34D399] flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            {/* Monthly expense */}
            <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">{t('reports.monthExpense')}</span>
                <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-[#C62828] dark:text-[#FB7185]">
                  -{formatRupiah(monthlySummary.expense)}
                </div>
                <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94] mt-1 block">Total recorded expenses</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#FFEBEE] dark:bg-[#2C1C1D] text-[#C62828] dark:text-[#FB7185] flex items-center justify-center shrink-0">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>

            {/* Net cashflow */}
            <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">{t('reports.netCashFlow')}</span>
                <div
                  className={`mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${
                    monthlySummary.net >= 0 ? 'text-[#2E7D32] dark:text-[#34D399]' : 'text-[#C62828] dark:text-[#FB7185]'
                  }`}
                >
                  {monthlySummary.net >= 0 ? '+' : ''}
                  {formatRupiah(monthlySummary.net)}
                </div>
                <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94] mt-1 block">
                  {monthlySummary.net >= 0 ? 'Net cash surplus' : 'Net cash deficit'}
                </span>
              </div>
              <div className="flex items-end space-x-1.5 h-10 px-2">
                <span className="w-1.5 h-4 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
                <span className="w-1.5 h-8 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
                <span className="w-1.5 h-10 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
              </div>
            </div>

            {/* Transaction count */}
            <div className="rounded-[28px] bg-[#5B7966] dark:bg-[#3E5747] text-white p-5.5 shadow-[0_10px_30px_rgba(91,121,102,0.25)] flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white/80 block">{t('reports.txCount')}</span>
                <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums">
                  {monthlySummary.txCount}
                </div>
                <span className="text-[10px] text-white/70 mt-1 block">Monthly transaction activity</span>
              </div>
              <div className="w-14 h-8 shrink-0">
                <svg viewBox="0 0 50 30" fill="none" className="w-full h-full text-white">
                  <path
                    d="M 2 24 C 12 18, 20 28, 30 14 C 38 4, 44 12, 48 8"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Highlights: Highest category & highest single expense */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="flex items-center space-x-3.5 rounded-[28px] border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)]">
              <div className="rounded-2xl bg-purple-500/15 p-3 text-purple-600 dark:text-purple-400 shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94]">{t('reports.largestCategory')}</span>
                <div className="text-sm font-bold text-[#18221B] dark:text-[#F0F4F1] truncate mt-0.5">
                  {monthlyCategorySpending[0]?.categoryName || '-'}
                </div>
                <div className="text-[11px] text-[#76847A] dark:text-[#8E9E94] tabular-nums mt-0.5">
                  {monthlyCategorySpending[0]
                    ? `${formatRupiah(monthlyCategorySpending[0].total)} (${monthlyCategorySpending[0].percentage}%)`
                    : t('reports.noDataYet')}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3.5 rounded-[28px] border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)]">
              <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-600 dark:text-amber-400 shrink-0">
                <Award className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94]">{t('reports.highestSingleExpense')}</span>
                <div className="text-sm font-bold tabular-nums text-[#C62828] dark:text-[#FB7185] whitespace-nowrap overflow-x-auto no-scrollbar mt-0.5">
                  {monthlySummary.highestExpenseTx ? formatRupiah(monthlySummary.highestExpense) : '-'}
                </div>
                <div className="text-[11px] text-[#76847A] dark:text-[#8E9E94] truncate max-w-xs mt-0.5">
                  {monthlySummary.highestExpenseTx?.description || t('reports.noTransactionsYet')}
                </div>
              </div>
            </div>
          </div>

          {/* Category Distribution Chart */}
          <CategoryExpenseChart data={monthlyCategorySpending} accountData={monthlyAccountSpending} />
        </div>
      )}

      {/* Weekly view */}
      {mode === 'weekly' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Navigation Bar as Floating Capsule */}
          <div className="flex items-center justify-between rounded-full border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-2 sm:p-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="flex items-center space-x-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] bg-[#F6F7F5] dark:bg-[#1F2822] px-3.5 py-2 text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t('reports.prevWeek')}</span>
            </button>

            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-[#4D6A58] dark:text-[#A7D7B5]" />
              <span className="text-sm font-bold text-[#18221B] dark:text-[#F0F4F1]">
                {weekInfo.label}
              </span>
              {weekOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="rounded-full bg-[#E5EFE8] dark:bg-[#1E2B22] px-2.5 py-0.5 text-[10px] font-bold text-[#4D6A58] dark:text-[#A7D7B5] hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span className="hidden sm:inline">{t('reports.backToThisWeek')}</span>
                  <span className="sm:hidden">Current</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="flex items-center space-x-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] bg-[#F6F7F5] dark:bg-[#1F2822] px-3.5 py-2 text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <span className="hidden sm:inline">{t('reports.nextWeek')}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekly summary cards */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">{t('reports.weekExpense')}</span>
                <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-[#C62828] dark:text-[#FB7185]">
                  -{formatRupiah(weeklySummary.expense)}
                </div>
                <div className="mt-1 text-[11px] text-[#76847A] dark:text-[#8E9E94]">
                  {weeklySummary.diffPct === 0 ? (
                    t('reports.sameAsLastWeek')
                  ) : weeklySummary.diffPct > 0 ? (
                    <span className="text-[#C62828] dark:text-[#FB7185] font-semibold tabular-nums">
                      +{weeklySummary.diffPct}% vs last week
                    </span>
                  ) : (
                    <span className="text-[#2E7D32] dark:text-[#34D399] font-semibold tabular-nums">
                      {weeklySummary.diffPct}% vs last week
                    </span>
                  )}
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#FFEBEE] dark:bg-[#2C1C1D] text-[#C62828] dark:text-[#FB7185] flex items-center justify-center shrink-0">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">{t('reports.weekIncome')}</span>
                <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-[#2E7D32] dark:text-[#34D399]">
                  +{formatRupiah(weeklySummary.income)}
                </div>
                <div className="mt-1 text-[11px] text-[#76847A] dark:text-[#8E9E94]">{t('reports.sevenDaysIncome')}</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#E8F5E9] dark:bg-[#1E2B22] text-[#2E7D32] dark:text-[#34D399] flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">{t('reports.weeklyNet')}</span>
                <div
                  className={`mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${
                    weeklySummary.net >= 0 ? 'text-[#2E7D32] dark:text-[#34D399]' : 'text-[#C62828] dark:text-[#FB7185]'
                  }`}
                >
                  {weeklySummary.net >= 0 ? '+' : ''}
                  {formatRupiah(weeklySummary.net)}
                </div>
                <div className="mt-1 text-[11px] text-[#76847A] dark:text-[#8E9E94]">{t('reports.weeklySurplusDeficit')}</div>
              </div>
              <div className="flex items-end space-x-1.5 h-10 px-2">
                <span className="w-1.5 h-4 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
                <span className="w-1.5 h-8 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
                <span className="w-1.5 h-10 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
              </div>
            </div>
          </div>

          {/* Daily spending breakdown chart (Monday -> Sunday) */}
          <div className="rounded-[28px] border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.035)]">
            <h3 className="text-base font-bold text-[#18221B] dark:text-[#F0F4F1] mb-4">
              {t('reports.dailySpendingTitle')}
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySpending} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="dayName"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#76847A' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#76847A' }}
                    tickFormatter={(v: number) => {
                      if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                      if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                      return String(v);
                    }}
                  />
                  <Tooltip
                    formatter={(val: unknown) => [formatRupiah(Number(val)), t('reports.dailyExpenseLabel')]}
                    contentStyle={{
                      backgroundColor: '#18221B',
                      borderRadius: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#F0F4F1',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="expense" fill="#5B7966" radius={[8, 8, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Yearly view */}
      {mode === 'yearly' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Navigation Bar as Floating Capsule */}
          <div className="flex items-center justify-between rounded-full border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-2 sm:p-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <button
              type="button"
              onClick={() => setYearOffset((y) => y - 1)}
              className="flex items-center space-x-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] bg-[#F6F7F5] dark:bg-[#1F2822] px-3.5 py-2 text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t('reports.prevYear')}</span>
            </button>

            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-[#4D6A58] dark:text-[#A7D7B5]" />
              <span className="text-sm font-bold text-[#18221B] dark:text-[#F0F4F1]">
                {t('reports.yearLabel', { year: targetYear })}
              </span>
              {yearOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => setYearOffset(0)}
                  className="rounded-full bg-[#E5EFE8] dark:bg-[#1E2B22] px-2.5 py-0.5 text-[10px] font-bold text-[#4D6A58] dark:text-[#A7D7B5] hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span className="hidden sm:inline">{t('reports.backToThisYear')}</span>
                  <span className="sm:hidden">Current</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setYearOffset((y) => y + 1)}
              className="flex items-center space-x-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] bg-[#F6F7F5] dark:bg-[#1F2822] px-3.5 py-2 text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <span className="hidden sm:inline">{t('reports.nextYear')}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Yearly summary cards */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">{t('reports.totalAnnualIncome')}</span>
                <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-[#2E7D32] dark:text-[#34D399]">
                  +{formatRupiah(yearlySummary.income)}
                </div>
                <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94] mt-1 block">12-month accumulated income</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#E8F5E9] dark:bg-[#1E2B22] text-[#2E7D32] dark:text-[#34D399] flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">{t('reports.totalAnnualExpense')}</span>
                <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-[#C62828] dark:text-[#FB7185]">
                  -{formatRupiah(yearlySummary.expense)}
                </div>
                <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94] mt-1 block">Year-to-date accumulated expenses</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#FFEBEE] dark:bg-[#2C1C1D] text-[#C62828] dark:text-[#FB7185] flex items-center justify-center shrink-0">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">{t('reports.cumulativeNetCashFlow')}</span>
                <div
                  className={`mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${
                    yearlySummary.net >= 0 ? 'text-[#2E7D32] dark:text-[#34D399]' : 'text-[#C62828] dark:text-[#FB7185]'
                  }`}
                >
                  {yearlySummary.net >= 0 ? '+' : ''}
                  {formatRupiah(yearlySummary.net)}
                </div>
                <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94] mt-1 block">
                  {yearlySummary.net >= 0 ? 'Net annual surplus' : 'Net annual deficit'}
                </span>
              </div>
              <div className="flex items-end space-x-1.5 h-10 px-2">
                <span className="w-1.5 h-4 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
                <span className="w-1.5 h-8 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
                <span className="w-1.5 h-10 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
              </div>
            </div>
          </div>

          {/* 12-Month Area Chart */}
          <div className="rounded-[28px] border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.035)]">
            <h3 className="text-base font-bold text-[#18221B] dark:text-[#F0F4F1] mb-4">
              {t('reports.twelveMonthGrowth', { year: targetYear })}
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={yearlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5B7966" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#5B7966" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FB7185" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#FB7185" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="monthLabel"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#76847A' }}
                    tickFormatter={(v: string) => v.split(' ')[0]}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#76847A' }}
                    tickFormatter={(v: number) => {
                      if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                      if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                      return String(v);
                    }}
                  />
                  <Tooltip
                    formatter={(val: unknown) => [formatRupiah(Number(val)), '']}
                    contentStyle={{
                      backgroundColor: '#18221B',
                      borderRadius: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#F0F4F1',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '11px', color: '#76847A' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name={t('reports.incomeLegend')}
                    stroke="#5B7966"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#incomeGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    name={t('reports.expenseLegend')}
                    stroke="#FB7185"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#expenseGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
