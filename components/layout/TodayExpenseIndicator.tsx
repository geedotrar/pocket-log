'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { TrendingDown, CalendarClock, Plus, ArrowRight, X, Receipt } from 'lucide-react';
import { useFinanceData } from '@/lib/data/DataContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { formatRupiah, formatTransactionDescription, getLocalDateString } from '@/lib/calculations';

interface TodayExpenseIndicatorProps {
  onOpenAddTx?: () => void;
}

export default function TodayExpenseIndicator({ onOpenAddTx }: TodayExpenseIndicatorProps) {
  const { transactions, accounts, categories } = useFinanceData();
  const { t, dateLocale } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const todayStr = useMemo(() => getLocalDateString(), []);

  // Today's expense transactions
  const todayExpenseList = useMemo(() => {
    return transactions.filter((t) => {
      const isExpense = t.type === 'expense' || !t.type;
      const dateStr = (t.date || '').slice(0, 10);
      return isExpense && dateStr === todayStr;
    });
  }, [transactions, todayStr]);

  // Total spent today
  const todayExpenseTotal = useMemo(() => {
    return todayExpenseList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [todayExpenseList]);

  // Quick lookup maps
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

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString(dateLocale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }, [dateLocale]);

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger Button Badge */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={`${t('header.todayExpense') || 'Today Spending'}: ${formatRupiah(todayExpenseTotal)}`}
        className={`flex items-center space-x-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all focus:outline-none whitespace-nowrap shrink-0 ${
          todayExpenseTotal > 0
            ? 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
            : 'border-white/10 bg-[#1A211D] text-[#8F9992] hover:bg-white/10 hover:text-[#F2F5F3]'
        }`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {todayExpenseTotal > 0 && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-rose-500" />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              todayExpenseTotal > 0 ? 'bg-rose-500' : 'bg-[#626C65]'
            }`}
          />
        </span>
        <TrendingDown
          className={`h-3 w-3 shrink-0 ${
            todayExpenseTotal > 0 ? 'text-rose-400' : 'text-[#8F9992]'
          }`}
        />
        <div className="flex items-center space-x-1 whitespace-nowrap shrink-0">
          <span className="hidden xs:inline text-[10px] uppercase font-bold tracking-wider opacity-75 whitespace-nowrap">
            Today:
          </span>
          <span className="font-bold tabular-nums whitespace-nowrap">
            {formatRupiah(todayExpenseTotal)}
          </span>
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-white/10 bg-[#161C18] p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 text-[#F2F5F3]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <div className="flex items-center space-x-2">
              <div className="rounded-xl bg-rose-500/15 p-2 text-rose-400">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#F2F5F3]">
                  {t('header.todayExpense') || 'Today Spending'}
                </h4>
                <p className="text-[10px] text-[#8F9992]">
                  {formattedDate}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-[#8F9992] hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* KPI Summary Block */}
          <div className="my-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-rose-300">
                  Total Today Spending
                </span>
                <div className="text-xl font-black text-rose-400 tabular-nums">
                  {formatRupiah(todayExpenseTotal)}
                </div>
              </div>
              <div className="rounded-full bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-300 whitespace-nowrap shrink-0">
                {todayExpenseList.length} Transactions
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
            {todayExpenseList.length === 0 ? (
              <div className="py-6 text-center text-[#8F9992]">
                <Receipt className="mx-auto h-8 w-8 stroke-1 text-[#626C65] mb-1.5" />
                <p className="text-xs font-medium">{t('header.noExpenseToday') || 'No expense recorded today'}</p>
                <p className="text-[10px] text-[#626C65] mt-0.5">Expenses recorded today will appear here</p>
              </div>
            ) : (
              todayExpenseList.map((tx) => {
                const cat = tx.category_id ? categoryMap.get(tx.category_id) : undefined;
                const accName = tx.account_id ? accountMap.get(tx.account_id) : undefined;
                const desc = (tx.description && formatTransactionDescription(tx.description) !== '-')
                  ? formatTransactionDescription(tx.description)
                  : cat?.name || 'Expense';

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-xl bg-white/[0.03] p-2.5 transition-colors hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center space-x-2.5 truncate pr-2">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: cat?.color || '#FB7185' }}
                      />
                      <div className="truncate">
                        <div className="truncate text-xs font-medium text-[#F2F5F3]">
                          {desc}
                        </div>
                        <div className="truncate text-[10px] text-[#8F9992]">
                          {accName || 'Account'} {cat ? `• ${cat.name}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs font-bold text-rose-400 shrink-0 tabular-nums">
                      -{formatRupiah(tx.amount)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3 text-xs">
            {onOpenAddTx && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenAddTx();
                }}
                className="flex items-center space-x-1 rounded-xl bg-[#A7D7B5] px-3 py-1.5 text-xs font-semibold text-[#0C2417] hover:bg-[#95D5B2] transition-colors"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>+ Add</span>
              </button>
            )}

            <Link
              href="/transactions"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center space-x-1 text-xs font-medium text-[#A7D7B5] hover:underline ml-auto"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
