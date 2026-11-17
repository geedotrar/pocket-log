'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  Plus,
  TrendingDown,
  TrendingUp,
  ArrowRightLeft,
  Clock,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  HandCoins,
  Building2,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowUpRight,
  ArrowDownLeft,
  ReceiptText,
} from 'lucide-react';
import { useFinanceData } from '@/lib/data/DataContext';
import { Account, Transaction, TransactionType } from '@/lib/types';
import {
  formatRupiah,
  formatTransactionDescription,
  isDebtSettlementTransaction,
} from '@/lib/calculations';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface AccountHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onTopUpAccount?: (accountId: string) => void;
  onAddTransaction?: (accountId: string) => void;
  onEditTransaction?: (transaction: Transaction) => void;
}

export default function AccountHistoryModal({
  isOpen,
  onClose,
  account,
  onTopUpAccount,
  onAddTransaction,
  onEditTransaction,
}: AccountHistoryModalProps) {
  const { transactions, accounts, categories, deleteTransaction } = useFinanceData();
  const { t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (deleteTarget) {
          setDeleteTarget(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, deleteTarget, onClose]);

  // Reset filters when opening a new account
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTypeFilter('all');
      setDeleteTarget(null);
    }
  }, [isOpen, account?.id]);

  // Account helper maps
  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; color?: string | null }>();
    categories.forEach((c) => map.set(c.id, { name: c.name, color: c.color }));
    return map;
  }, [categories]);

  // Filter all transactions linked to this account (as source or destination)
  const allAccountTransactions = useMemo(() => {
    if (!account) return [];
    return transactions.filter(
      (tItem) => tItem.account_id === account.id || tItem.to_account_id === account.id
    );
  }, [transactions, account]);

  // Counts by type
  const counts = useMemo(() => {
    let expense = 0;
    let income = 0;
    let transfer = 0;

    allAccountTransactions.forEach((tx) => {
      if (tx.type === 'expense') expense++;
      else if (tx.type === 'income') income++;
      else if (tx.type === 'transfer') transfer++;
    });

    return {
      all: allAccountTransactions.length,
      expense,
      income,
      transfer,
    };
  }, [allAccountTransactions]);

  // Filtered & sorted transactions
  const displayedTransactions = useMemo(() => {
    return allAccountTransactions
      .filter((tx) => {
        // Filter by type
        if (typeFilter !== 'all' && tx.type !== typeFilter) {
          return false;
        }

        // Filter by search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const desc = (tx.description || '').toLowerCase();
          const cat = categoryMap.get(tx.category_id || '')?.name.toLowerCase() || '';
          const date = tx.date || '';
          const sourceAcc = accountMap.get(tx.account_id)?.name.toLowerCase() || '';
          const destAcc = accountMap.get(tx.to_account_id || '')?.name.toLowerCase() || '';

          if (
            !desc.includes(q) &&
            !cat.includes(q) &&
            !date.includes(q) &&
            !sourceAcc.includes(q) &&
            !destAcc.includes(q)
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });
  }, [allAccountTransactions, typeFilter, searchQuery, categoryMap, accountMap]);

  if (!isOpen || !account) return null;

  // Icon mapping
  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'bank':
        return Building2;
      case 'cash':
        return Banknote;
      case 'ewallet':
        return Smartphone;
      case 'investment':
        return TrendingUp;
      default:
        return CreditCard;
    }
  };

  const AccountIcon = getAccountIcon(account.type);

  // Financial metrics from account (with fallback to client calculations)
  const allocated = account.allocated_budget ?? account.initial_balance ?? 0;
  const spent = account.spent_amount ?? 0;
  const transfersIn = account.transfers_in ?? 0;
  const transfersOut = account.transfers_out ?? 0;
  const effectiveBudget = account.effective_budget ?? (allocated + transfersIn - transfersOut);
  const remaining = account.remaining_budget ?? account.current_balance ?? effectiveBudget;
  const budgetBase = effectiveBudget > 0 ? effectiveBudget : allocated;

  const percentRemaining = budgetBase > 0
    ? Math.max(0, Math.min(100, Math.round((remaining / budgetBase) * 100)))
    : (remaining > 0 ? 100 : 0);
  const isOverBudget = remaining < 0;
  const isLowBudget = percentRemaining < 50 || isOverBudget;

  const handleDeleteTransaction = async (tx: Transaction) => {
    try {
      await deleteTransaction(tx.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-5 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full sm:max-w-2xl rounded-t-[32px] sm:rounded-3xl border-t sm:border border-black/[0.08] bg-white shadow-2xl dark:border-white/10 dark:bg-[#141A16] text-[#18221B] dark:text-[#F2F5F3] flex flex-col max-h-[92dvh] sm:max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        {/* Mobile Swipe Drag Handle Indicator */}
        <div className="mx-auto mt-2.5 mb-0.5 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />
        
        {/* Top Header Strip with Account Colors */}
        {account.pocket_name ? (
          <div className="h-2.5 w-full flex shrink-0">
            <div
              className="w-[35%] h-full"
              style={{ backgroundColor: account.color || '#2563eb' }}
            />
            <div
              className="w-[65%] h-full"
              style={{ backgroundColor: account.pocket_color || '#A7D7B5' }}
            />
          </div>
        ) : (
          <div
            className="h-2.5 w-full shrink-0"
            style={{ backgroundColor: account.color || '#A7D7B5' }}
          />
        )}

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-black/[0.06] dark:border-white/8 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3.5 min-w-0">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm shrink-0"
                style={{ backgroundColor: account.color || '#2563eb' }}
              >
                <AccountIcon className="h-6 w-6" />
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-[#F2F5F3] truncate">
                    {account.name}
                  </h2>

                  {/* Connected Pocket Badge */}
                  {account.pocket_name && (
                    <span
                      className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold text-white shadow-2xs whitespace-nowrap"
                      style={{ backgroundColor: account.pocket_color || '#A7D7B5' }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white/90 shrink-0" />
                      <span>{account.pocket_name}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-xs text-slate-400 dark:text-[#8F9992] flex-wrap gap-y-1">
                  <span className="font-mono uppercase font-semibold">{account.type}</span>
                  <span>•</span>
                  <span>{account.pocket_name ? t('accounts.connectedPocket') : t('accounts.standardAccount')}</span>
                  <span>•</span>
                  <span className="inline-flex items-center space-x-1">
                    {account.is_active ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-[#A7D7B5]" />
                        <span className="text-[#A7D7B5] font-medium">{t('common.active')}</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 text-slate-400" />
                        <span>{t('common.inactive')}</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-[#F2F5F3] transition-colors cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Financial Snapshot Banner */}
          <div className="mt-4 rounded-2xl bg-slate-50/80 p-3.5 border border-slate-100 dark:border-white/5 dark:bg-[#1A211D]">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-500 dark:text-[#8F9992]">
                {t('accounts.remainingBudget')}
              </span>
              <span className={`text-xs font-bold ${isLowBudget ? 'text-rose-500 dark:text-rose-400' : 'text-[#A7D7B5]'}`}>
                {t('accounts.remainingFunds', { percent: percentRemaining })}
              </span>
            </div>

            <div className={`text-2xl font-extrabold font-mono tracking-tight tabular-nums ${isOverBudget ? 'text-rose-500 dark:text-rose-400' : 'text-slate-900 dark:text-[#F2F5F3]'}`}>
              {formatRupiah(remaining)}
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/8">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${isOverBudget ? 100 : percentRemaining}%`,
                  backgroundColor: isLowBudget ? '#f43f5e' : '#A7D7B5',
                }}
              />
            </div>

            {/* Breakdown row */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/50 dark:border-white/5 text-[11px]">
              <div>
                <span className="text-slate-400 dark:text-[#8F9992] block">{t('accounts.initialAllocation')}</span>
                <span className="font-semibold font-mono tabular-nums text-slate-800 dark:text-[#F2F5F3]">
                  {formatRupiah(allocated)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-[#8F9992] block">{t('accounts.spent')}</span>
                <span className="font-semibold font-mono tabular-nums text-rose-500 dark:text-rose-400">
                  {formatRupiah(spent)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-[#8F9992] block">{t('accounts.transferIn')}</span>
                <span className="font-semibold font-mono tabular-nums text-[#A7D7B5]">
                  +{formatRupiah(transfersIn)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-[#8F9992] block">{t('accounts.transferOut')}</span>
                <span className="font-semibold font-mono tabular-nums text-sky-400">
                  -{formatRupiah(transfersOut)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons & Search */}
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transactions..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#A7D7B5] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:placeholder-[#8F9992]/60"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 shrink-0">
              {onTopUpAccount && (
                <button
                  type="button"
                  onClick={() => onTopUpAccount(account.id)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 rounded-xl bg-[#A7D7B5]/15 hover:bg-[#A7D7B5]/25 border border-[#A7D7B5]/30 px-3 py-2 text-xs font-bold text-[#A7D7B5] transition-all cursor-pointer whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Top Up</span>
                </button>
              )}

              {onAddTransaction && (
                <button
                  type="button"
                  onClick={() => onAddTransaction(account.id)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 rounded-xl bg-[#5B7966] hover:bg-[#4D6A58] dark:bg-[#A7D7B5] dark:hover:bg-[#8ecba0] text-white dark:text-[#0D110F] px-3.5 py-2 text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Transaction</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="mt-3 flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`rounded-xl px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-[#A7D7B5] dark:text-[#0D110F]'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-[#8F9992] dark:hover:bg-white/10'
              }`}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('expense')}
              className={`rounded-xl px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                typeFilter === 'expense'
                  ? 'bg-rose-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-[#8F9992] dark:hover:bg-white/10'
              }`}
            >
              Expenses ({counts.expense})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('income')}
              className={`rounded-xl px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                typeFilter === 'income'
                  ? 'bg-[#A7D7B5] text-slate-900 font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-[#8F9992] dark:hover:bg-white/10'
              }`}
            >
              Income ({counts.income})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('transfer')}
              className={`rounded-xl px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                typeFilter === 'transfer'
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-[#8F9992] dark:hover:bg-white/10'
              }`}
            >
              Transfers ({counts.transfer})
            </button>
          </div>
        </div>

        {/* Transaction History Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {displayedTransactions.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-[#8F9992]">
                <ReceiptText className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-[#F2F5F3]">
                  {searchQuery || typeFilter !== 'all'
                    ? 'No matching transactions'
                    : 'No transactions yet'}
                </h4>
                <p className="mt-1 text-xs text-slate-400 dark:text-[#8F9992] max-w-xs">
                  {searchQuery || typeFilter !== 'all'
                    ? 'Try adjusting your search query or filter to see more records.'
                    : `No transactions recorded under ${account.name} yet.`}
                </p>
              </div>
              {onAddTransaction && !searchQuery && typeFilter === 'all' && (
                <button
                  type="button"
                  onClick={() => onAddTransaction(account.id)}
                  className="mt-2 inline-flex items-center space-x-1.5 rounded-xl bg-[#5B7966] hover:bg-[#4D6A58] dark:bg-[#A7D7B5] dark:hover:bg-[#8ecba0] text-white dark:text-[#0D110F] px-4 py-2 text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Record First Transaction</span>
                </button>
              )}
            </div>
          ) : (
            displayedTransactions.map((tx) => {
              const isDebt = isDebtSettlementTransaction(tx, categories);
              const isIncome = tx.type === 'income' && !isDebt;
              const isTransfer = tx.type === 'transfer';
              const isTransferIn = isTransfer && tx.to_account_id === account.id;
              const isTransferOut = isTransfer && tx.account_id === account.id;

              const cat = categoryMap.get(tx.category_id || '');
              const sourceAcc = accountMap.get(tx.account_id);
              const destAcc = accountMap.get(tx.to_account_id || '');

              const cleanDesc = formatTransactionDescription(tx.description);
              const displayTitle = cleanDesc !== '-' ? cleanDesc : (cat?.name || (isTransfer ? 'Transfer' : 'Transaction'));

              return (
                <div
                  key={tx.id}
                  className="group relative flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs hover:border-[#A7D7B5]/40 hover:shadow-xs transition-all dark:border-white/6 dark:bg-[#1A211D]"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1 pr-3">
                    {/* Icon indicator */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${
                        isDebt
                          ? 'bg-teal-500'
                          : isIncome || isTransferIn
                          ? 'bg-[#5B7966] dark:bg-[#A7D7B5] dark:text-[#0D110F]'
                          : isTransferOut
                          ? 'bg-sky-500'
                          : 'bg-rose-500'
                      }`}
                    >
                      {isDebt ? (
                        <HandCoins className="h-5 w-5" />
                      ) : isIncome || isTransferIn ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : isTransferOut ? (
                        <ArrowRightLeft className="h-5 w-5" />
                      ) : (
                        <TrendingDown className="h-5 w-5" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-[#F2F5F3] truncate">
                          {displayTitle}
                        </span>
                        {isTransfer && (
                          <span className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-500 whitespace-nowrap">
                            {isTransferIn ? 'Transfer In' : 'Transfer Out'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 text-[11px] text-slate-400 dark:text-[#8F9992] flex-wrap gap-y-0.5">
                        <span>{tx.date}</span>

                        {isTransfer ? (
                          <>
                            <span>•</span>
                            <span className="truncate">
                              {isTransferIn
                                ? `From: ${sourceAcc?.name || 'Unknown'}`
                                : `To: ${destAcc?.name || 'Unknown'}`}
                            </span>
                          </>
                        ) : cat?.name ? (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center space-x-1 truncate">
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color || '#94a3b8' }}
                              />
                              <span className="truncate">{cat.name}</span>
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Amount & Actions */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <div className="text-right">
                      <div
                        className={`text-xs font-bold font-mono tabular-nums ${
                          isDebt || isIncome || isTransferIn
                            ? 'text-[#5B7966] dark:text-[#A7D7B5]'
                            : isTransferOut
                            ? 'text-sky-500 dark:text-sky-400'
                            : 'text-rose-500 dark:text-rose-400'
                        }`}
                      >
                        {isDebt || isIncome || isTransferIn ? '+' : '-'}
                        {formatRupiah(tx.amount)}
                      </div>
                    </div>

                    {/* Quick Edit/Delete on Hover or Mobile */}
                    <div className="flex items-center space-x-1 pl-1">
                      {onEditTransaction && (
                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          title="Edit transaction"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-[#F2F5F3] transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(tx)}
                        title="Delete transaction"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-black/[0.06] dark:border-white/8 bg-slate-50/50 dark:bg-[#1A211D]/40 flex items-center justify-between text-xs text-slate-400 dark:text-[#8F9992] shrink-0">
          <span className="font-medium">
            Showing {displayedTransactions.length} of {allAccountTransactions.length} records
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-3xl border border-black/[0.06] bg-white p-6 shadow-2xl text-[#18221B] dark:border-white/10 dark:bg-[#161D18] dark:text-[#F2F5F3]">
            <h3 className="text-base font-bold text-slate-900 dark:text-[#F2F5F3]">
              Delete Transaction?
            </h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-[#8F9992] leading-relaxed">
              Are you sure you want to delete this transaction worth{' '}
              <span className="font-semibold text-slate-800 dark:text-white">
                {formatRupiah(deleteTarget.amount)}
              </span>
              ?
            </p>
            <div className="mt-5 flex justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-[#1A211D] dark:text-[#8F9992] dark:hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTransaction(deleteTarget)}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-500 transition-all cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
