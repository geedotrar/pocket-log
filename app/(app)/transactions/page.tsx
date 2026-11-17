'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ArrowUpDown,
  HandCoins,
} from 'lucide-react';
import { useFinanceData } from '@/lib/data/DataContext';
import { Transaction, TransactionType } from '@/lib/types';
import { formatRupiah, formatTransactionDescription, isDebtSettlementTransaction } from '@/lib/calculations';
import TransactionModal from '@/components/modals/TransactionModal';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function TransactionsPage() {
  const { transactions, accounts, categories, deleteTransaction } = useFinanceData();
  const { t } = useLanguage();

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType | 'debt_settlement'>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'created_desc' | 'date_asc' | 'amount_desc'>('date_desc');

  // Pagination (Desktop) & Infinite Scroll (Mobile)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [mobileVisibleCount, setMobileVisibleCount] = useState(15);
  const mobileSentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset pagination & infinite scroll when filters change
  useEffect(() => {
    setCurrentPage(1);
    setMobileVisibleCount(15);
  }, [searchTerm, typeFilter, accountFilter, categoryFilter, startDate, endDate, sortBy]);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  // Filter Active Check
  const isFilterActive = useMemo(() => {
    return (
      searchTerm !== '' ||
      typeFilter !== 'all' ||
      accountFilter !== 'all' ||
      categoryFilter !== 'all' ||
      startDate !== '' ||
      endDate !== '' ||
      sortBy !== 'date_desc'
    );
  }, [searchTerm, typeFilter, accountFilter, categoryFilter, startDate, endDate, sortBy]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setAccountFilter('all');
    setCategoryFilter('all');
    setStartDate('');
    setEndDate('');
    setSortBy('date_desc');
    setCurrentPage(1);
    setMobileVisibleCount(15);
  };

  // Lookups
  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((a) => map.set(a.id, a.pocket_name ? `${a.name} - ${a.pocket_name}` : a.name));
    return map;
  }, [accounts]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; color?: string | null }>();
    categories.forEach((c) => map.set(c.id, { name: c.name, color: c.color }));
    return map;
  }, [categories]);

  // Filtered & Sorted Transactions
  const filteredTransactions = useMemo(() => {
    const result = transactions.filter((tItem) => {
      // Type
      if (typeFilter !== 'all') {
        const isDebt = isDebtSettlementTransaction(tItem, categories);
        if (typeFilter === 'debt_settlement') {
          if (!isDebt) return false;
        } else if (typeFilter === 'income') {
          if (tItem.type !== 'income' || isDebt) return false;
        } else if (tItem.type !== typeFilter) {
          return false;
        }
      }
      // Account
      if (accountFilter !== 'all' && tItem.account_id !== accountFilter && tItem.to_account_id !== accountFilter) return false;
      // Category
      if (categoryFilter !== 'all' && tItem.category_id !== categoryFilter) return false;
      // Date range
      if (startDate && tItem.date < startDate) return false;
      if (endDate && tItem.date > endDate) return false;
      // Search
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const descMatch = tItem.description?.toLowerCase().includes(query);
        const catName = categoryMap.get(tItem.category_id || '')?.name.toLowerCase();
        const catMatch = catName?.includes(query);
        const accMatch = accountMap.get(tItem.account_id)?.toLowerCase().includes(query);
        if (!descMatch && !catMatch && !accMatch) return false;
      }
      return true;
    });

    // Sorting: default date_desc (transaction date desc, then created_at desc)
    return result.sort((a, b) => {
      if (sortBy === 'created_desc') {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'date_asc') {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
      }
      if (sortBy === 'amount_desc') {
        return Number(b.amount) - Number(a.amount);
      }
      // Default: 'date_desc' -> transaction date desc, tie-breaker created_at desc
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [transactions, typeFilter, accountFilter, categoryFilter, startDate, endDate, searchTerm, sortBy, categoryMap, accountMap]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Mobile infinite scroll slice
  const mobileTransactions = useMemo(() => {
    return filteredTransactions.slice(0, mobileVisibleCount);
  }, [filteredTransactions, mobileVisibleCount]);

  // Infinite scroll observer for mobile
  useEffect(() => {
    const sentinel = mobileSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setMobileVisibleCount((prev) => Math.min(prev + 15, filteredTransactions.length));
        }
      },
      { rootMargin: '250px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredTransactions.length]);

  const handleEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      await deleteTransaction(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const totalIncome = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [filteredTransactions]);

  const totalExpense = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'expense' || !t.type)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [filteredTransactions]);

  const netCashflow = totalIncome - totalExpense;

  return (
    <div className="space-y-4 sm:space-y-5 pb-24 lg:pb-12 w-full min-w-0">
      {/* Transaction metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
        {/* Total Transactions Card */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between lg:col-span-3">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
              Total Transactions
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1] tabular-nums mt-1">
              {filteredTransactions.length}
            </div>
            <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94]">
              Filtered transactions
            </span>
          </div>
          <div className="flex items-end space-x-1.5 h-10 px-2">
            <span className="w-1.5 h-4 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-8 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-10 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-6 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
          </div>
        </div>

        {/* Total Expense Card */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between lg:col-span-3">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
              Total Expenses
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#C62828] dark:text-[#FB7185] tabular-nums mt-1 whitespace-nowrap overflow-x-auto no-scrollbar">
              -{formatRupiah(totalExpense)}
            </div>
            <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94]">
              Recorded expenses
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FFEBEE] dark:bg-[#2C1C1D] text-[#C62828] dark:text-[#FB7185] flex items-center justify-center">
            <TrendingDown className="h-5 w-5" />
          </div>
        </div>

        {/* Total Income Card */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between lg:col-span-3">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
              Total Income
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2E7D32] dark:text-[#34D399] tabular-nums mt-1 whitespace-nowrap overflow-x-auto no-scrollbar">
              +{formatRupiah(totalIncome)}
            </div>
            <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94]">
              Recorded income
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#E8F5E9] dark:bg-[#1E2B22] text-[#2E7D32] dark:text-[#34D399] flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {/* Net Cashflow Accent Card */}
        <div className="rounded-[28px] bg-[#5B7966] dark:bg-[#3E5747] text-white p-5 shadow-[0_10px_30px_rgba(91,121,102,0.25)] flex items-center justify-between lg:col-span-3">
          <div>
            <span className="text-xs font-semibold text-white/80 block">
              Net Cashflow
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums mt-1 whitespace-nowrap overflow-x-auto no-scrollbar">
              {formatRupiah(netCashflow)}
            </div>
            <span className="text-[10px] text-white/70">
              {netCashflow >= 0 ? 'Budget surplus' : 'Budget deficit'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingTx(null);
              setIsModalOpen(true);
            }}
            className="rounded-full bg-white text-[#4D6A58] p-2.5 shadow-sm hover:scale-105 active:scale-95 transition-transform"
            title="Add Transaction"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="w-full min-w-0 rounded-3xl border border-slate-200/80 bg-white p-4.5 shadow-xs dark:border-white/8 dark:bg-[#161C18]">
        {/* Main Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search Box (4 cols on lg) */}
          <div className="relative sm:col-span-2 lg:col-span-4 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-[#8F9992]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t('transactions.searchPlaceholder')}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9.5 pr-3 text-base sm:text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#A7D7B5] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:placeholder-[#8F9992]/60"
            />
          </div>

          {/* Type Filter (2 cols on lg) */}
          <div className="lg:col-span-2 min-w-0">
            <SearchableSelect
              options={[
                { value: 'all', label: t('transactions.allTypes') },
                { value: 'expense', label: t('transactions.expense') },
                { value: 'transfer', label: t('transactions.transferInterAccount') },
                { value: 'debt_settlement', label: t('transactions.debtSettlementFilter') },
              ]}
              value={typeFilter}
              onChange={(val) => {
                setTypeFilter(val as 'all' | TransactionType | 'debt_settlement');
                setCurrentPage(1);
              }}
              placeholder={t('transactions.allTypes')}
              searchPlaceholder={t('common.search') || 'Search...'}
            />
          </div>

          {/* Account Filter (Searchable, 3 cols on lg) */}
          <div className="lg:col-span-3 min-w-0">
            <SearchableSelect
              options={accounts.map((acc) => ({
                value: acc.id,
                label: acc.pocket_name ? `${acc.name} - ${acc.pocket_name}` : acc.name,
                color: acc.pocket_color || acc.color,
              }))}
              value={accountFilter}
              onChange={(val) => {
                setAccountFilter(val);
                setCurrentPage(1);
              }}
              placeholder={t('transactions.allAccounts')}
              searchPlaceholder={t('transactions.searchAccount')}
              allOption={{ value: 'all', label: t('transactions.allAccounts') }}
            />
          </div>

          {/* Category Filter (Searchable, 3 cols on lg) */}
          <div className="lg:col-span-3 min-w-0">
            <SearchableSelect
              options={categories
                .filter((cat) => cat.type === 'expense')
                .map((cat) => ({
                  value: cat.id,
                  label: cat.name,
                  color: cat.color,
                }))}
              value={categoryFilter}
              onChange={(val) => {
                setCategoryFilter(val);
                setCurrentPage(1);
              }}
              placeholder={t('transactions.allCategories')}
              searchPlaceholder={t('transactions.searchCategory')}
              allOption={{ value: 'all', label: t('transactions.allCategories') }}
            />
          </div>
        </div>

        {/* Date Filter, Sorting, & Quick Reset Bar */}
        <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-white/8 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Range */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-[#8F9992] shrink-0">
                {t('transactions.dateRange')}:
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white py-1.5 px-2.5 text-base sm:text-xs text-slate-900 focus:border-[#A7D7B5] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3]"
              />
              <span className="text-slate-400 dark:text-[#8F9992] text-xs font-medium">{t('transactions.to')}</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white py-1.5 px-2.5 text-base sm:text-xs text-slate-900 focus:border-[#A7D7B5] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3]"
              />
            </div>

            {/* Sort Selector */}
            <div className="flex items-center space-x-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 dark:text-[#8F9992] shrink-0" />
              <span className="text-[11px] font-medium text-slate-500 dark:text-[#8F9992] shrink-0">
                {t('transactions.sortBy')}:
              </span>
              <SearchableSelect
                options={[
                  { value: 'date_desc', label: t('transactions.sortByTxDateDesc') },
                  { value: 'created_desc', label: t('transactions.sortByCreatedDesc') },
                  { value: 'date_asc', label: t('transactions.sortByTxDateAsc') },
                  { value: 'amount_desc', label: t('transactions.sortByAmountDesc') },
                ]}
                value={sortBy}
                onChange={(val) => {
                  setSortBy(val as 'date_desc' | 'created_desc' | 'date_asc' | 'amount_desc');
                  setCurrentPage(1);
                }}
                placeholder={t('transactions.sortBy')}
                searchPlaceholder={t('common.search') || 'Search...'}
                size="sm"
                className="w-44 sm:w-52"
              />
            </div>
          </div>

          {isFilterActive && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center space-x-1.5 text-xs text-rose-500 hover:text-rose-400 font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t('transactions.resetAllFilters')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Transactions Container: Card layout on mobile, Table layout on sm+ */}
      <div className="w-full min-w-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-white/8 dark:bg-[#161C18]">
        {/* Mobile View (< md) with Infinite Scroll & 44px+ touch targets */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-white/6">
          {mobileTransactions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-[#8F9992] text-xs">
              {t('transactions.noTransactionsFound')}
            </div>
          ) : (
            mobileTransactions.map((tItem) => {
              const isDebt = isDebtSettlementTransaction(tItem, categories);
              const isIncome = tItem.type === 'income' && !isDebt;
              const isTransfer = tItem.type === 'transfer';
              const cat = categoryMap.get(tItem.category_id || '');

              return (
                <div key={tItem.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-white/3 transition-colors">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center ${
                        isDebt
                          ? 'bg-teal-500/15 text-teal-400'
                          : isIncome
                          ? 'bg-[#A7D7B5]/20 text-[#A7D7B5]'
                          : isTransfer
                          ? 'bg-sky-500/15 text-sky-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {isDebt ? (
                        <HandCoins className="h-5 w-5" />
                      ) : isIncome ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : isTransfer ? (
                        <ArrowRightLeft className="h-5 w-5" />
                      ) : (
                        <TrendingDown className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-900 dark:text-[#F2F5F3] truncate">
                          {formatTransactionDescription(tItem.description) || (isTransfer ? t('transactions.transfer') : t('transactions.expense'))}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-[#8F9992]">
                        <span>{tItem.date}</span>
                        <span>•</span>
                        <span className="truncate max-w-[120px]">{accountMap.get(tItem.account_id) || t('dashboard.accountFallback')}</span>
                        {isTransfer && tItem.to_account_id && (
                          <span className="text-sky-400 font-medium">→ {accountMap.get(tItem.to_account_id)}</span>
                        )}
                        {cat && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 truncate">
                              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#94a3b8' }} />
                              {cat.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-bold font-mono tabular-nums ${
                        isDebt
                          ? 'text-teal-500 dark:text-teal-400'
                          : isIncome
                          ? 'text-[#A7D7B5]'
                          : isTransfer
                          ? 'text-sky-500 dark:text-sky-400'
                          : 'text-rose-500 dark:text-rose-400'
                      }`}
                    >
                      {isDebt || isIncome ? '+' : isTransfer ? '' : '-'}
                      {formatRupiah(tItem.amount)}
                    </div>
                    <div className="flex items-center justify-end -mr-2 mt-0.5">
                      <button
                        onClick={() => handleEdit(tItem)}
                        aria-label="Edit transaction"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl p-2 text-slate-400 hover:text-slate-600 dark:hover:text-[#F2F5F3] active:bg-black/5 dark:active:bg-white/5 transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(tItem)}
                        aria-label="Delete transaction"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl p-2 text-slate-400 hover:text-rose-500 active:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {mobileTransactions.length < filteredTransactions.length && (
            <div ref={mobileSentinelRef} className="py-4 text-center text-xs text-slate-400 dark:text-[#8E9E94] flex items-center justify-center gap-2">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-solid border-[#A7D7B5] border-r-transparent" />
              <span>Loading more transactions...</span>
            </div>
          )}
        </div>

        {/* Desktop View (>= md) */}
        <div className="hidden md:block overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-slate-500 dark:border-white/8 dark:bg-[#1A211D]/60 dark:text-[#8F9992] font-semibold">
              <tr>
                <th className="py-3.5 pl-6 pr-3">{t('transactions.tableDate')}</th>
                <th className="px-3 py-3.5">{t('transactions.tableType')}</th>
                <th className="px-3 py-3.5">{t('transactions.tableDesc')}</th>
                <th className="px-3 py-3.5">{t('transactions.tableCat')}</th>
                <th className="px-3 py-3.5">{t('transactions.tableAcc')}</th>
                <th className="px-3 py-3.5 text-right">{t('transactions.tableAmount')}</th>
                <th className="py-3.5 pl-3 pr-6 text-center">{t('transactions.tableAction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/6">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-[#8F9992]">
                    {t('transactions.noTransactionsFound')}
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tItem) => {
                  const isDebt = isDebtSettlementTransaction(tItem, categories);
                  const isIncome = tItem.type === 'income' && !isDebt;
                  const isTransfer = tItem.type === 'transfer';
                  const cat = categoryMap.get(tItem.category_id || '');

                  return (
                    <tr key={tItem.id} className="hover:bg-slate-50/50 dark:hover:bg-white/2 transition-colors">
                      <td className="whitespace-nowrap py-3.5 pl-6 pr-3">
                        <div className="font-medium text-slate-800 dark:text-[#F2F5F3]">
                          {tItem.date}
                        </div>
                        {tItem.created_at && (
                          <div className="text-[10px] text-slate-400 dark:text-[#8F9992]">
                            {new Date(tItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5">
                        <span
                          className={`inline-flex items-center space-x-1 rounded-xl px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                            isDebt
                              ? 'bg-teal-500/15 text-teal-400 border border-teal-500/20'
                              : isIncome
                              ? 'bg-[#A7D7B5]/15 text-[#A7D7B5] border border-[#A7D7B5]/20'
                              : isTransfer
                              ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {isDebt ? (
                            <HandCoins className="h-3 w-3 shrink-0" />
                          ) : isIncome ? (
                            <TrendingUp className="h-3 w-3 shrink-0" />
                          ) : isTransfer ? (
                            <ArrowRightLeft className="h-3 w-3 shrink-0" />
                          ) : (
                            <TrendingDown className="h-3 w-3 shrink-0" />
                          )}
                          <span className="whitespace-nowrap">
                            {isDebt
                              ? t('transactions.debtSettlement')
                              : isIncome
                              ? t('transactions.income')
                              : isTransfer
                              ? t('transactions.transfer')
                              : t('transactions.expense')}
                          </span>
                        </span>
                      </td>

                      <td className="px-3 py-3.5">
                        <div className="font-medium text-slate-800 dark:text-[#F2F5F3]">
                          {formatTransactionDescription(tItem.description)}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-slate-600 dark:text-[#C5CDC8]">
                        {isTransfer ? (
                          <span className="text-slate-400 dark:text-[#8F9992] italic">{t('transactions.transferInterAccount')}</span>
                        ) : cat ? (
                          <span className="flex items-center space-x-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: cat.color || '#94a3b8' }}
                            />
                            <span>{cat.name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-[#8F9992]">-</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-slate-600 dark:text-[#C5CDC8]">
                        <div>{accountMap.get(tItem.account_id) || t('dashboard.accountFallback')}</div>
                        {isTransfer && tItem.to_account_id && (
                          <div className="text-[11px] text-sky-400 font-medium">
                            → {accountMap.get(tItem.to_account_id)}
                          </div>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 text-right font-bold font-mono tabular-nums text-xs">
                        <span
                          className={
                            isDebt
                              ? 'text-teal-500 dark:text-teal-400'
                              : isIncome
                              ? 'text-[#A7D7B5]'
                              : isTransfer
                              ? 'text-sky-500 dark:text-sky-400'
                              : 'text-rose-500 dark:text-rose-400'
                          }
                        >
                          {isDebt || isIncome ? '+' : isTransfer ? '' : '-'}
                          {formatRupiah(tItem.amount)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap py-3.5 pl-3 pr-6 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleEdit(tItem)}
                            title={t('common.edit')}
                            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-[#F2F5F3] transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(tItem)}
                            title={t('common.delete')}
                            className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="hidden md:flex items-center justify-between border-t border-slate-100 px-6 py-3.5 text-xs dark:border-white/8">
            <span className="text-slate-500 dark:text-[#8F9992]">
              {t('transactions.pageOf', { current: currentPage, total: totalPages })}
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30 dark:border-white/10 dark:text-[#F2F5F3] dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-xl border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30 dark:border-white/10 dark:text-[#F2F5F3] dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Modal for Edit/Create */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTx(null);
        }}
        initialData={editingTx}
      />

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-sm rounded-t-[32px] sm:rounded-3xl border-t sm:border border-white/10 bg-[#161C18] p-5 sm:p-6 shadow-2xl text-[#F2F5F3] pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20 sm:hidden shrink-0" />

            <h3 className="text-base font-bold text-[#F2F5F3]">
              {t('transactions.deleteConfirmTitle')}
            </h3>
            <p className="mt-2 text-xs text-[#8F9992] leading-relaxed">
              {t('transactions.deleteConfirmText', { amount: formatRupiah(deleteTarget.amount), date: deleteTarget.date })}
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="min-h-[44px] rounded-2xl border border-white/10 bg-[#1A211D] px-4 py-2.5 text-xs font-semibold text-[#8F9992] hover:text-[#F2F5F3] hover:bg-[#232B25] transition-all cursor-pointer flex items-center justify-center"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="min-h-[44px] rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500 transition-all cursor-pointer flex items-center justify-center"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
