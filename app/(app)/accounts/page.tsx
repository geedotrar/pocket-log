'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  TrendingUp,
  HelpCircle,
  Search,
  Filter,
  Folder,
  Clock,
  ReceiptText,
} from 'lucide-react';

import { useFinanceData } from '@/lib/data/DataContext';
import { Account, AccountType, Transaction } from '@/lib/types';
import { formatRupiah, calculateAccountBalances, formatInputNumber, parseInputNumber } from '@/lib/calculations';
import { APP_COLOR_PALETTE } from '@/lib/constants';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import TopUpPocketModal from '@/components/modals/TopUpPocketModal';
import SearchableSelect from '@/components/ui/SearchableSelect';
import AccountHistoryModal from '@/components/modals/AccountHistoryModal';
import TransactionModal from '@/components/modals/TransactionModal';

export default function AccountsPage() {
  const { accounts, transactions, debts, cycleStartDate, addAccount, updateAccount, deleteAccount } = useFinanceData();
  const { t, locale } = useLanguage();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpTargetId, setTopUpTargetId] = useState<string | undefined>(undefined);

  // Account History & Transaction modals
  const [viewingAccount, setViewingAccount] = useState<Account | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txDefaultAccountId, setTxDefaultAccountId] = useState<string | undefined>(undefined);

  const openTopUpModal = (accountId?: string) => {
    setTopUpTargetId(accountId);
    setIsTopUpModalOpen(true);
  };

  const openHistoryModal = (acc: Account) => {
    setViewingAccount(acc);
  };

  const handleAddTransactionForAccount = (accId: string) => {
    setTxDefaultAccountId(accId);
    setEditingTx(null);
    setIsTransactionModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTx(tx);
    setIsTransactionModalOpen(true);
  };

  // Close modals on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isTransactionModalOpen) setIsTransactionModalOpen(false);
        else if (viewingAccount) setViewingAccount(null);
        else if (isModalOpen) setIsModalOpen(false);
        else if (deleteTarget) setDeleteTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, deleteTarget, viewingAccount, isTransactionModalOpen]);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [initialBalance, setInitialBalance] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [hasPocket, setHasPocket] = useState(false);
  const [pocketName, setPocketName] = useState('');
  const [pocketColor, setPocketColor] = useState('#8B5CF6');
  const [isActive, setIsActive] = useState(true);
  const [includeInBudget, setIncludeInBudget] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const accountsWithBalance = useMemo(() => {
    return calculateAccountBalances(accounts, transactions, debts, cycleStartDate);
  }, [accounts, transactions, debts, cycleStartDate]);

  const activeViewingAccount = useMemo(() => {
    if (!viewingAccount) return null;
    return accountsWithBalance.find((a) => a.id === viewingAccount.id) || viewingAccount;
  }, [viewingAccount, accountsWithBalance]);

  const txCountMap = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((tx) => {
      map.set(tx.account_id, (map.get(tx.account_id) || 0) + 1);
      if (tx.to_account_id && tx.to_account_id !== tx.account_id) {
        map.set(tx.to_account_id, (map.get(tx.to_account_id) || 0) + 1);
      }
    });
    return map;
  }, [transactions]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filteredAccounts = useMemo(() => {
    return accountsWithBalance.filter((acc) => {
      // 1. Search filter: name, pocket name, account number, or type
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = acc.name.toLowerCase().includes(q);
        const matchesPocket = Boolean(acc.pocket_name && acc.pocket_name.toLowerCase().includes(q));
        const matchesType = acc.type.toLowerCase().includes(q);
        if (!matchesName && !matchesPocket && !matchesType) {
          return false;
        }
      }

      // 2. Type filter
      if (typeFilter !== 'all' && acc.type !== typeFilter) {
        return false;
      }

      // 3. Status filter
      if (statusFilter === 'active' && !acc.is_active) return false;
      if (statusFilter === 'inactive' && acc.is_active) return false;

      return true;
    });
  }, [accountsWithBalance, searchQuery, typeFilter, statusFilter]);

  const totalAssets = useMemo(() => {
    return accountsWithBalance
      .filter((a) => a.is_active)
      .reduce((sum, a) => sum + (a.current_balance ?? 0), 0);
  }, [accountsWithBalance]);


  const openAddModal = () => {
    setEditingAccount(null);
    setName('');
    setType('bank');
    setInitialBalance('');
    setColor('#2563eb');
    setHasPocket(false);
    setPocketName('');
    setPocketColor('#8B5CF6');
    setIsActive(true);
    setIncludeInBudget(true);
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setType(acc.type);
    setInitialBalance(formatInputNumber(acc.initial_balance));
    setColor(acc.color || '#2563eb');
    const isPocket = Boolean(acc.pocket_name);
    setHasPocket(isPocket);
    setPocketName(acc.pocket_name || '');
    setPocketColor(acc.pocket_color || '#8B5CF6');
    setIsActive(acc.is_active);
    setIncludeInBudget(acc.include_in_budget !== false);
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    if (!name.trim()) {
      setError('Account name is required.');
      return;
    }

    const initBal = parseInputNumber(initialBalance);

    const payload = {
      name: name.trim(),
      type,
      initial_balance: initBal,
      color,
      pocket_name: hasPocket && pocketName.trim() ? pocketName.trim() : null,
      pocket_color: hasPocket && pocketName.trim() ? pocketColor : null,
      is_active: isActive,
      include_in_budget: includeInBudget,
    };

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, payload);
      } else {
        await addAccount(payload);
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save account.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteAccount(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const getAccountIcon = (t: AccountType) => {
    switch (t) {
      case 'bank': return CreditCard;
      case 'cash': return Banknote;
      case 'ewallet': return Smartphone;
      case 'investment': return TrendingUp;
      default: return HelpCircle;
    }
  };

  const palette = APP_COLOR_PALETTE;

  // Breakdown metrics
  const inBudgetAssets = useMemo(() => {
    return accountsWithBalance
      .filter((a) => a.is_active && a.include_in_budget !== false)
      .reduce((sum, a) => sum + (a.current_balance ?? 0), 0);
  }, [accountsWithBalance]);

  const offBudgetAssets = useMemo(() => {
    return accountsWithBalance
      .filter((a) => a.is_active && a.include_in_budget === false)
      .reduce((sum, a) => sum + (a.current_balance ?? 0), 0);
  }, [accountsWithBalance]);

  // Funds transferred from off-budget reserve accounts into in-budget pockets
  const offBudgetInflowTotal = useMemo(() => {
    const offBudgetIds = new Set(
      accounts.filter((a) => a.is_active && a.include_in_budget === false).map((a) => a.id)
    );
    const inBudgetIds = new Set(
      accounts.filter((a) => a.is_active && a.include_in_budget !== false).map((a) => a.id)
    );

    return transactions
      .filter((t) => t.type === 'transfer' && offBudgetIds.has(t.account_id) && t.to_account_id && inBudgetIds.has(t.to_account_id))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [accounts, transactions]);

  return (
    <div className="space-y-5 pb-24 lg:pb-12">
      {/* Wallets and budget pockets overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
        {/* Showcase Banner */}
        <div className={`rounded-[28px] bg-white dark:bg-[#161D18] p-5 sm:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] ${offBudgetInflowTotal > 0 ? 'lg:col-span-12 xl:col-span-5' : 'lg:col-span-8'} flex flex-col justify-between`}>
          <div className="space-y-3">
            <div className="inline-flex items-center space-x-1.5 rounded-full bg-[#E5EFE8] dark:bg-[#1E2B22] px-3 py-1 text-xs font-semibold text-[#4D6A58] dark:text-[#A7D7B5]">
              <CreditCard className="h-3.5 w-3.5" />
              <span>Accounts & Wallets</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#18221B] dark:text-[#F0F4F1]">
              Accounts & Wallets
            </h2>
            <p className="text-xs text-[#76847A] dark:text-[#8E9E94] leading-relaxed max-w-md">
              Overview of your bank accounts, cards, and cash balances.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => openTopUpModal()}
                className="inline-flex items-center space-x-2 rounded-2xl bg-[#5B7966] dark:bg-[#A7D7B5] px-4 py-2.5 text-xs font-bold text-white dark:text-[#0C2417] shadow-sm hover:bg-[#4D6A58] dark:hover:bg-[#95D5B2] transition-transform active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Transfer Funds</span>
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center space-x-2 rounded-2xl bg-[#F6F7F5] dark:bg-[#1F2822] hover:bg-[#ECEEEA] dark:hover:bg-[#28362D] px-4 py-2.5 text-xs font-bold text-[#18221B] dark:text-[#F0F4F1] border border-black/[0.04] dark:border-white/[0.06] transition-transform active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>{t('accounts.addNew')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Budget allocation breakdown */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${offBudgetInflowTotal > 0 ? 'lg:grid-cols-3 lg:col-span-12 xl:col-span-7' : 'lg:grid-cols-1 lg:col-span-4'} gap-3 sm:gap-4`}>
          {/* In-budget assets */}
          <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 text-xs text-[#76847A] dark:text-[#8E9E94]">
              <span className="font-semibold whitespace-nowrap truncate">In-Budget Balance</span>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-[#E8F5E9] dark:bg-[#1E2B22] px-2.5 py-0.5 text-[10px] font-bold text-[#2E7D32] dark:text-[#34D399]">
                Active
              </span>
            </div>
            <div className="text-2xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1] tabular-nums mt-1.5 whitespace-nowrap overflow-x-auto no-scrollbar">
              {formatRupiah(inBudgetAssets)}
            </div>
            <span className="text-[11px] text-[#76847A] dark:text-[#8E9E94] mt-1 block truncate">
              {offBudgetInflowTotal > 0
                ? `Includes +${formatRupiah(offBudgetInflowTotal)} from emergency`
                : 'Locked in active budget cycles'}
            </span>
          </div>

          {/* Used Outside Allocation */}
          {offBudgetInflowTotal > 0 && (
            <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-amber-500/20 bg-amber-500/[0.02] dark:border-amber-500/20 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 text-xs text-amber-600 dark:text-amber-400">
                <span className="font-semibold whitespace-nowrap truncate" title="Used from Emergency">
                  Used from Emergency
                </span>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  Off-Budget
                </span>
              </div>
              <div className="text-2xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums mt-1.5 whitespace-nowrap overflow-x-auto no-scrollbar">
                +{formatRupiah(offBudgetInflowTotal)}
              </div>
              <span className="text-[11px] text-[#76847A] dark:text-[#8E9E94] mt-1 block truncate">
                Disbursed to support in-budget pockets
              </span>
            </div>
          )}

          {/* Off-budget reserves */}
          <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 text-xs text-[#76847A] dark:text-[#8E9E94]">
              <span className="font-semibold whitespace-nowrap truncate" title="Emergency Reserve">
                Emergency Reserve
              </span>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-[#FFF8E1] dark:bg-[#2C2317] px-2.5 py-0.5 text-[10px] font-bold text-[#D97706] dark:text-[#FBBF24]">
                Reserve
              </span>
            </div>
            <div className="text-2xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1] tabular-nums mt-1.5 whitespace-nowrap overflow-x-auto no-scrollbar">
              {formatRupiah(offBudgetAssets)}
            </div>
            <span className="text-[11px] text-[#76847A] dark:text-[#8E9E94] mt-1 block truncate">
              Emergency funds, savings, & reserves
            </span>
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-[28px] border border-black/[0.04] bg-white p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] dark:border-white/[0.06] dark:bg-[#161D18]">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#76847A] dark:text-[#8E9E94]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('accounts.searchPlaceholder')}
            className="w-full rounded-2xl border border-black/[0.04] bg-[#F6F7F5] py-2 pl-9.5 pr-9 text-base sm:text-xs text-[#18221B] placeholder-[#8E9B92] focus:outline-none dark:border-white/[0.06] dark:bg-[#1F2822] dark:text-[#F0F4F1] dark:placeholder-[#8E9E94]/60"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#76847A] hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter */}
          <div className="flex items-center space-x-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400 dark:text-[#8F9992] hidden sm:inline" />
            <SearchableSelect
              options={[
                { value: 'all', label: t('accounts.allTypes') },
                { value: 'bank', label: t('accounts.types.bank') },
                { value: 'cash', label: t('accounts.types.cash') },
                { value: 'ewallet', label: t('accounts.types.ewallet') },
                { value: 'investment', label: t('accounts.types.investment') },
                { value: 'other', label: t('accounts.types.other') },
              ]}
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              placeholder={t('accounts.allTypes')}
              searchPlaceholder={t('common.search') || 'Search...'}
              size="sm"
              className="w-36 sm:w-44"
            />
          </div>

          {/* Status Filter */}
          <SearchableSelect
            options={[
              { value: 'all', label: t('accounts.allStatus') },
              { value: 'active', label: t('common.active') },
              { value: 'inactive', label: t('common.inactive') },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val as any)}
            placeholder={t('accounts.allStatus')}
            searchPlaceholder={t('common.search') || 'Search...'}
            size="sm"
            className="w-32 sm:w-40"
          />

          {/* Reset Filters */}
          {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
                setStatusFilter('all');
              }}
              className="rounded-2xl border border-rose-200 bg-rose-50/70 px-3 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 transition-colors"
              title={t('accounts.resetFilter')}
            >
              {t('common.reset')}
            </button>
          )}

          {/* Count Badge */}
          <span className="text-[11px] font-semibold text-slate-400 dark:text-[#8F9992] pl-1">
            {filteredAccounts.length} {t('common.account')}
          </span>
        </div>
      </div>

      {/* Account Cards Grid or Empty Search State */}
      {filteredAccounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-white/8 dark:bg-[#161C18]">
          <Search className="h-10 w-10 text-slate-300 dark:text-[#8F9992]/40 mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-[#F2F5F3]">
            {t('accounts.noAccountsFound')}
          </h3>
          <p className="text-xs text-slate-400 dark:text-[#8F9992] mt-1 max-w-sm">
            {searchQuery
              ? `No accounts matching "${searchQuery}".`
              : t('accounts.noAccountsFound')}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setTypeFilter('all');
              setStatusFilter('all');
            }}
            className="mt-4 rounded-2xl border border-white/10 bg-[#232B25] px-4 py-2 text-xs font-semibold text-[#A7D7B5] hover:bg-[#2C372F]"
          >
            {t('accounts.resetFilter')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAccounts.map((acc) => {
            const Icon = getAccountIcon(acc.type);
            const allocated = acc.allocated_budget ?? acc.initial_balance ?? 0;
            const spent = acc.spent_amount ?? 0;
            const transfersIn = acc.transfers_in ?? 0;
            const transfersOut = acc.transfers_out ?? 0;
            const effectiveBudget = acc.effective_budget ?? (allocated + transfersIn - transfersOut);
            const remaining = acc.remaining_budget ?? acc.current_balance ?? effectiveBudget;
            
            // For off-budget reserve accounts, remaining % is relative to capacity (allocated + transfersIn)
            const maxCapacity = allocated + transfersIn;
            const percentRemaining = maxCapacity > 0
              ? Math.max(0, Math.min(100, Math.round((remaining / maxCapacity) * 100)))
              : (remaining > 0 ? 100 : 0);
            const isOverBudget = remaining < 0;
            const isLowBudget = percentRemaining < 50 || isOverBudget;

            const txCount = txCountMap.get(acc.id) || 0;

            return (
              <div
                key={acc.id}
                onClick={() => openHistoryModal(acc)}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white shadow-xs transition-all hover:border-[#A7D7B5]/60 hover:shadow-md overflow-hidden dark:border-white/8 dark:bg-[#161C18] cursor-pointer"
              >
                {/* Top Accent Strip */}
                {acc.pocket_name ? (
                  <div className="h-2 w-full flex flex-shrink-0">
                    <div
                      className="w-[35%] h-full"
                      style={{ backgroundColor: acc.color || '#2563eb' }}
                      title={`Account: ${acc.name}`}
                    />
                    <div
                      className="w-[65%] h-full"
                      style={{ backgroundColor: acc.pocket_color || '#A7D7B5' }}
                      title={`Pocket: ${acc.pocket_name}`}
                    />
                  </div>
                ) : (
                  <div
                    className="h-2 w-full flex-shrink-0"
                    style={{ backgroundColor: acc.color || '#A7D7B5' }}
                  />
                )}

                <div className="p-5 flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 min-w-0">
                        {/* Icon with bank color and pocket badge indicator */}
                        <div className="relative flex-shrink-0">
                          <div
                            className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm"
                            style={{ backgroundColor: acc.color || '#2563eb' }}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          {acc.pocket_name && (
                            <span
                              className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full ring-2 ring-[#161C18] shadow-xs"
                              style={{ backgroundColor: acc.pocket_color || '#A7D7B5' }}
                              title={`Pocket Color: ${acc.pocket_name}`}
                            />
                          )}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-[#F2F5F3] truncate">
                            {acc.name}
                          </h3>

                          {/* Pocket Badge */}
                          {acc.pocket_name && (
                            <div>
                              <span
                                className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold text-white shadow-2xs whitespace-nowrap shrink-0"
                                style={{ backgroundColor: acc.pocket_color || '#A7D7B5' }}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-white/90 shrink-0" />
                                <span className="truncate whitespace-nowrap">{acc.pocket_name}</span>
                              </span>
                            </div>
                          )}

                          <span className="text-[10px] text-slate-400 dark:text-[#8F9992] font-mono block whitespace-nowrap">
                            {acc.type.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateAccount(acc.id, { include_in_budget: acc.include_in_budget === false ? true : false });
                          }}
                          title={t('accounts.toggleBudgetTooltip')}
                          className={`rounded-xl px-2 py-1 text-[10px] font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            acc.include_in_budget !== false
                              ? 'bg-[#A7D7B5]/15 text-[#A7D7B5] border-[#A7D7B5]/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          <span className="whitespace-nowrap">
                            {acc.include_in_budget !== false ? t('dashboard.inBudgetBadge') : t('dashboard.offBudgetBadge')}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openTopUpModal(acc.id);
                          }}
                          title="Top up this pocket"
                          className="inline-flex items-center space-x-1 rounded-xl bg-[#A7D7B5]/15 hover:bg-[#A7D7B5]/25 px-2 py-1 text-[11px] font-bold text-[#A7D7B5] border border-[#A7D7B5]/25 transition-all cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Plus className="h-3 w-3 shrink-0" />
                          <span className="whitespace-nowrap">Top Up</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openHistoryModal(acc);
                          }}
                          title="View Transaction History"
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-[#A7D7B5]/15 hover:text-[#A7D7B5] dark:hover:bg-white/5 dark:hover:text-[#A7D7B5] transition-colors cursor-pointer"
                        >
                          <ReceiptText className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(acc);
                          }}
                          title={t('common.edit')}
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-[#F2F5F3] transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(acc);
                          }}
                          title={t('common.delete')}
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Remaining budget and allocation */}
                    <div className="mt-5 space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-[#8F9992]">
                          {acc.include_in_budget === false ? 'Reserve Balance' : t('accounts.remainingBudget')}
                        </span>
                        <span className={`text-[11px] font-semibold ${isLowBudget ? 'text-rose-500 dark:text-rose-400' : 'text-[#A7D7B5]'}`}>
                          {t('accounts.remainingFunds', { percent: percentRemaining })}
                        </span>
                      </div>
                      <div className={`text-xl font-bold font-mono tracking-tight tabular-nums whitespace-nowrap overflow-x-auto no-scrollbar ${isOverBudget ? 'text-rose-500 dark:text-rose-400' : 'text-slate-900 dark:text-[#F2F5F3]'}`}>
                        {formatRupiah(remaining)}
                      </div>

                      {/* Progress Bar */}
                      <div className="pt-2">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/8">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${isOverBudget ? 100 : percentRemaining}%`,
                              backgroundColor: isLowBudget ? '#f43f5e' : '#A7D7B5',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Detail Bar */}
                    <div className={`mt-4 grid ${(transfersIn > 0 || transfersOut > 0) ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'} gap-2 rounded-2xl bg-slate-50/80 p-3 border border-slate-100 dark:border-white/5 dark:bg-[#1A211D]`}>
                      <div>
                        <span className="text-[10px] text-slate-400 dark:text-[#8F9992] block font-medium">{t('accounts.initialAllocation')}</span>
                        <span className="text-xs font-semibold font-mono tabular-nums text-slate-800 dark:text-[#F2F5F3]">
                          {formatRupiah(allocated)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 dark:text-[#8F9992] block font-medium">{t('accounts.spent')}</span>
                        <span className="text-xs font-semibold font-mono tabular-nums text-rose-500 dark:text-rose-400">
                          {formatRupiah(spent)}
                        </span>
                      </div>
                      {transfersIn > 0 && (
                        <div>
                          <span className="text-[10px] text-slate-400 dark:text-[#8F9992] block font-medium">{t('accounts.transferIn')}</span>
                          <span className="text-xs font-semibold font-mono tabular-nums text-[#A7D7B5]">
                            +{formatRupiah(transfersIn)}
                          </span>
                        </div>
                      )}
                      {transfersOut > 0 && (
                        <div>
                          <span className="text-[10px] text-slate-400 dark:text-[#8F9992] block font-medium">
                            {acc.include_in_budget === false ? 'Disbursed to Budget:' : t('accounts.transferOut')}
                          </span>
                          <span className="text-xs font-semibold font-mono tabular-nums text-sky-400">
                            -{formatRupiah(transfersOut)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-white/8 pt-3 text-[11px] text-slate-400 dark:text-[#8F9992]">
                    <span className="text-[10px]">
                      {acc.pocket_name ? t('accounts.connectedPocket') : t('accounts.standardAccount')}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openHistoryModal(acc);
                      }}
                      className="inline-flex items-center space-x-1 font-semibold text-[#5B7966] dark:text-[#A7D7B5] hover:underline transition-colors cursor-pointer"
                      title="View transaction history"
                    >
                      <Clock className="h-3 w-3" />
                      <span>{txCount} {txCount === 1 ? 'transaction' : 'transactions'}</span>
                    </button>
                    <span className="flex items-center space-x-1">
                      {acc.is_active ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#A7D7B5]" />
                          <span className="text-[#A7D7B5] font-medium">{t('common.active')}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5 text-slate-400" />
                          <span>{t('common.inactive')}</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-md rounded-t-[32px] sm:rounded-3xl border-t sm:border border-black/[0.06] bg-white p-5 sm:p-6 shadow-2xl text-[#18221B] dark:border-white/10 dark:bg-[#161D18] dark:text-[#F2F5F3] max-h-[92dvh] sm:max-h-[92vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/8">
              <h2 className="text-base font-bold text-[#18221B] dark:text-[#F2F5F3]">
                {editingAccount ? t('accounts.editTitle') : t('accounts.addNewTitle')}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 text-[#76847A] hover:bg-black/5 hover:text-[#18221B] dark:text-[#8F9992] dark:hover:bg-white/5 dark:hover:text-[#F2F5F3] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400 p-2.5 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#76847A] dark:text-[#C5CDC8] mb-1">
                  {t('accounts.accountName')}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('accounts.namePlaceholder')}
                  className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] py-2.5 px-3.5 text-base sm:text-xs text-[#18221B] placeholder-[#8E9B92] focus:border-[#5B7966] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:placeholder-[#8F9992]/60 dark:focus:border-[#A7D7B5]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#76847A] dark:text-[#C5CDC8] mb-1">
                  {t('accounts.accountType')}
                </label>
                <SearchableSelect
                  options={[
                    { value: 'bank', label: t('accounts.types.bank') },
                    { value: 'cash', label: t('accounts.types.cash') },
                    { value: 'ewallet', label: t('accounts.types.ewallet') },
                    { value: 'investment', label: t('accounts.types.investment') },
                    { value: 'other', label: t('accounts.types.other') },
                  ]}
                  value={type}
                  onChange={(val) => setType(val as AccountType)}
                  placeholder={t('accounts.accountType')}
                  searchPlaceholder={t('common.search') || 'Search...'}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#76847A] dark:text-[#C5CDC8] mb-1">
                  {t('accounts.monthlyAllocation')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-xs font-semibold text-[#76847A] dark:text-[#8F9992]">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(formatInputNumber(e.target.value))}
                    placeholder="0"
                    className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] py-2.5 pl-10 pr-3 text-base sm:text-xs font-bold font-mono text-[#18221B] focus:border-[#5B7966] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:focus:border-[#A7D7B5]"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#76847A] dark:text-[#8F9992]">
                  {t('accounts.allocationDesc')}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#76847A] dark:text-[#C5CDC8]">
                    Main Bank Color (20 Options)
                  </label>
                  <span
                    className="h-4 w-4 rounded-full ring-2 ring-black/10 dark:ring-white/20 shadow-xs"
                    style={{ backgroundColor: color }}
                  />
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5 sm:gap-2 p-2.5 rounded-2xl bg-[#F6F7F5] border border-black/[0.06] dark:bg-[#1A211D] dark:border-white/8 justify-items-center">
                  {palette.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-7 w-7 sm:h-6 sm:w-6 rounded-full transition-transform ${
                        color === c
                          ? 'scale-125 ring-2 ring-[#5B7966] dark:ring-[#A7D7B5] ring-offset-2 ring-offset-white dark:ring-offset-[#161D18] shadow-sm z-10'
                          : 'hover:scale-110 opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* Pocket / Sub-Account Option */}
              <div className="rounded-2xl border border-black/[0.06] bg-[#F6F7F5] dark:border-white/8 dark:bg-[#1A211D] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="hasPocket"
                      checked={hasPocket}
                      onChange={(e) => setHasPocket(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 dark:border-white/20 accent-[#5B7966] dark:accent-[#A7D7B5] cursor-pointer"
                    />
                    <label htmlFor="hasPocket" className="text-xs font-semibold text-[#18221B] dark:text-[#F2F5F3] cursor-pointer">
                      {t('accounts.enablePocket')}
                    </label>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg text-white shadow-2xs" style={{
                    backgroundColor: hasPocket ? pocketColor : color,
                  }}>
                    {hasPocket ? '2 Separate Colors' : '1 Solid Color'}
                  </span>
                </div>

                {hasPocket && (
                  <div className="space-y-3 pt-2.5 border-t border-black/[0.06] dark:border-white/8">
                    <div>
                      <label className="block text-xs font-medium text-[#76847A] dark:text-[#C5CDC8] mb-1">
                        {t('accounts.pocketName')}
                      </label>
                      <input
                        type="text"
                        value={pocketName}
                        onChange={(e) => setPocketName(e.target.value)}
                        placeholder={t('accounts.pocketNamePlaceholder')}
                        className="w-full rounded-2xl border border-black/[0.06] bg-white py-2 px-3 text-base sm:text-xs text-[#18221B] focus:border-[#5B7966] focus:outline-none dark:border-white/10 dark:bg-[#161C18] dark:text-[#F2F5F3] dark:focus:border-[#A7D7B5]"
                      />
                      <p className="mt-1 text-[10px] text-[#76847A] dark:text-[#8F9992]">
                        Specific fund allocation slot inside this bank/account.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-[#76847A] dark:text-[#C5CDC8]">
                          Pocket Color (20 Options)
                        </label>
                        <span
                          className="h-4 w-4 rounded-full ring-2 ring-black/10 dark:ring-white/20 shadow-xs"
                          style={{ backgroundColor: pocketColor }}
                        />
                      </div>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5 sm:gap-2 p-2.5 rounded-2xl bg-white border border-black/[0.06] dark:bg-[#161C18] dark:border-white/8 justify-items-center">
                        {palette.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setPocketColor(c)}
                            className={`h-7 w-7 sm:h-6 sm:w-6 rounded-full transition-transform ${
                              pocketColor === c
                                ? 'scale-125 ring-2 ring-[#5B7966] dark:ring-[#A7D7B5] ring-offset-2 ring-offset-white dark:ring-offset-[#161D18] shadow-sm z-10'
                                : 'hover:scale-110 opacity-80 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Preview Card */}
              <div className="rounded-2xl border border-black/[0.06] p-3 bg-[#F6F7F5] dark:border-white/8 dark:bg-[#1A211D] space-y-2">
                <div className="flex items-center justify-between text-[10px] font-semibold text-[#76847A] dark:text-[#8F9992] uppercase tracking-wider">
                  <span>Live Preview Card</span>
                  <span className="text-[10px] font-bold text-[#5B7966] dark:text-[#A7D7B5]">
                    {hasPocket && pocketName.trim() ? '2 Separate Colors' : '1 Solid Color'}
                  </span>
                </div>
                <div className="rounded-2xl border border-black/[0.06] overflow-hidden shadow-xs bg-white dark:border-white/8 dark:bg-[#161C18]">
                  {hasPocket && pocketName.trim() ? (
                    <div className="h-2 w-full flex">
                      <div className="w-[35%] h-full" style={{ backgroundColor: color }} />
                      <div className="w-[65%] h-full" style={{ backgroundColor: pocketColor }} />
                    </div>
                  ) : (
                    <div className="h-2 w-full" style={{ backgroundColor: color }} />
                  )}
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-white text-xs shadow-xs"
                          style={{ backgroundColor: color }}
                        >
                          <CreditCard className="h-4 w-4" />
                        </div>
                        {hasPocket && pocketName.trim() && (
                          <span
                            className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full ring-2 ring-white dark:ring-[#161C18] shadow-2xs"
                            style={{ backgroundColor: pocketColor }}
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#18221B] dark:text-[#F2F5F3] truncate">
                          {name.trim() || 'Account Name'}
                        </div>
                        {hasPocket && pocketName.trim() && (
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-2xs whitespace-nowrap shrink-0"
                              style={{ backgroundColor: pocketColor }}
                            >
                              <Folder className="h-2.5 w-2.5 shrink-0" />
                              <span>Pocket: {pocketName.trim()}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-[#76847A] dark:text-[#8F9992] block">Budget Allocation</span>
                      <span className="text-xs font-bold font-mono text-[#18221B] dark:text-[#F2F5F3]">
                        {initialBalance ? `Rp ${initialBalance}` : 'Rp 0'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="rounded-2xl border border-black/[0.06] bg-[#F6F7F5] dark:border-white/8 dark:bg-[#1A211D] p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="includeInBudget" className="text-xs font-semibold text-[#18221B] dark:text-[#F2F5F3] cursor-pointer">
                      {t('accounts.includeInBudgetLabel')}
                    </label>
                    <input
                      type="checkbox"
                      id="includeInBudget"
                      checked={includeInBudget}
                      onChange={(e) => setIncludeInBudget(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 dark:border-white/20 accent-[#5B7966] dark:accent-[#A7D7B5] cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-[#76847A] dark:text-[#8F9992]">
                    {t('accounts.includeInBudgetDesc')}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-white/20 accent-[#5B7966] dark:accent-[#A7D7B5] cursor-pointer"
                  />
                  <label htmlFor="isActive" className="text-xs text-[#76847A] dark:text-[#C5CDC8] cursor-pointer">
                    {t('accounts.activeAccountCheckbox')}
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-black/[0.06] dark:border-white/8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-[44px] rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-4 py-2.5 text-xs font-semibold text-[#76847A] hover:text-[#18221B] dark:border-white/10 dark:bg-[#1A211D] dark:text-[#8F9992] dark:hover:text-[#F2F5F3] transition-all cursor-pointer flex items-center justify-center"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] rounded-2xl bg-[#5B7966] hover:bg-[#4D6A58] text-white dark:bg-[#A7D7B5] dark:hover:bg-[#8ecba0] dark:text-[#0D110F] px-4 py-2.5 text-xs font-bold shadow-sm disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? t('common.loading') : editingAccount ? t('common.saveChanges') : t('accounts.addNew')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-sm rounded-t-[32px] sm:rounded-3xl border-t sm:border border-black/[0.06] bg-white p-5 sm:p-6 shadow-2xl text-[#18221B] dark:border-white/10 dark:bg-[#161D18] dark:text-[#F2F5F3] pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <h3 className="text-base font-bold text-[#18221B] dark:text-[#F2F5F3]">
              {t('accounts.deleteConfirmTitle')}
            </h3>
            <p className="mt-2 text-xs text-[#76847A] dark:text-[#8E9E94] leading-relaxed">
              {t('accounts.deleteConfirmText', { name: deleteTarget.name })}
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="min-h-[44px] rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-4 py-2.5 text-xs font-semibold text-[#76847A] hover:text-[#18221B] dark:border-white/10 dark:bg-[#1A211D] dark:text-[#8F9992] dark:hover:text-[#F2F5F3] transition-all cursor-pointer flex items-center justify-center"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="min-h-[44px] rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500 transition-all cursor-pointer flex items-center justify-center"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Up Pocket Modal */}
      <TopUpPocketModal
        isOpen={isTopUpModalOpen}
        onClose={() => setIsTopUpModalOpen(false)}
        defaultTargetAccountId={topUpTargetId}
      />

      {/* Account Details & Transaction History Modal */}
      <AccountHistoryModal
        isOpen={Boolean(activeViewingAccount)}
        onClose={() => setViewingAccount(null)}
        account={activeViewingAccount}
        onTopUpAccount={(accId) => openTopUpModal(accId)}
        onAddTransaction={(accId) => handleAddTransactionForAccount(accId)}
        onEditTransaction={(tx) => handleEditTransaction(tx)}
      />

      {/* Transaction Add / Edit Modal */}
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => {
          setIsTransactionModalOpen(false);
          setEditingTx(null);
        }}
        initialData={editingTx}
        defaultAccountId={txDefaultAccountId}
      />
    </div>
  );
}
