'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  HandCoins,
  Plus,
  AlertCircle,
  CheckCircle,
  Trash2,
  Edit2,
  X,
} from 'lucide-react';
import { useFinanceData } from '@/lib/data/DataContext';
import { Debt, DebtType } from '@/lib/types';
import { formatRupiah, formatInputNumber, parseInputNumber } from '@/lib/calculations';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function DebtsPage() {
  const {
    debts,
    accounts,
    categories,
    transactions,
    addDebt,
    updateDebt,
    deleteDebt,
    addTransaction,
    deleteTransaction,
    addCategory,
  } = useFinanceData();
  const { t, locale } = useLanguage();

  const [activeTab, setActiveTab] = useState<DebtType>('they_owe');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);

  // Close modals on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddModalOpen) setIsAddModalOpen(false);
        if (deleteTarget) setDeleteTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddModalOpen, deleteTarget]);

  // Debt Form State
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState<'outstanding' | 'paid'>('outstanding');
  const [error, setError] = useState('');
  const [processingDebtId, setProcessingDebtId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Handle 1-click status toggle (Mark Paid / Mark Outstanding)
  const handleTogglePaidStatus = async (d: Debt) => {
    if (processingDebtId === d.id) return;
    setProcessingDebtId(d.id);
    try {
      const nextStatus = d.status === 'paid' ? 'outstanding' : 'paid';
      await updateDebt(d.id, { status: nextStatus });

      // If receivable (they_owe) with a funding account:
      // - When marked paid: record an income transaction to return capital to account
      // - When reopened unpaid: remove previously created income transaction
      if (d.type === 'they_owe' && d.account_id) {
        const debtMarker = `[debt:${d.id}]`;
        const legacyMarker = `[PIUTANG_LUNAS:${d.id}]`;
        if (nextStatus === 'paid') {
          // Find debt repayment category (income)
          let debtCat = categories.find(
            (c) =>
              c.type === 'income' &&
              (c.name.toLowerCase().includes('debt') ||
                c.name.toLowerCase().includes('piutang') ||
                c.name.toLowerCase().includes('hutang'))
          );

          let targetCategoryId = debtCat?.id || null;

          if (!targetCategoryId) {
            const catName = 'Debt Repayment';
            try {
              await addCategory({
                name: catName,
                type: 'income',
                icon: 'HandCoins',
                color: '#0d9488',
                is_default: true,
              });
              const newlyAdded = categories.find((c) => c.type === 'income' && c.name === catName);
              targetCategoryId = newlyAdded?.id || null;
            } catch (catErr) {
              console.warn('Could not auto-create debt category:', catErr);
            }
          }

          // Add income transaction to funding account
          await addTransaction({
            type: 'income',
            account_id: d.account_id,
            amount: d.amount,
            date: new Date().toISOString().slice(0, 10),
            description: `Receivable repaid by ${d.person}`,
            category_id: targetCategoryId,
          });
        } else {
          // Remove linked income transactions for this debt
          const linkedList = transactions.filter(
            (t) =>
              t.type === 'income' &&
              t.account_id === d.account_id &&
              (t.description?.includes(debtMarker) ||
                t.description?.includes(legacyMarker) ||
                t.description?.includes(d.id) ||
                (t.description?.includes(d.person) && Number(t.amount) === Number(d.amount)))
          );
          for (const linked of linkedList) {
            await deleteTransaction(linked.id);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to toggle debt status:', err);
    } finally {
      setProcessingDebtId(null);
    }
  };

  // Enrich debts: remaining_amount is purely based on manual status
  const enrichedDebts = useMemo(() => {
    return debts.map((d) => ({
      ...d,
      remaining_amount: d.status === 'paid' ? 0 : d.amount,
    }));
  }, [debts]);

  const filteredDebts = useMemo(() => {
    return enrichedDebts.filter((d) => d.type === activeTab);
  }, [enrichedDebts, activeTab]);

  // Overall statistics
  const stats = useMemo(() => {
    let theyOweTotal = 0;
    let iOweTotal = 0;
    let overdueCount = 0;

    for (const d of enrichedDebts) {
      const rem = d.remaining_amount ?? 0;
      if (rem > 0) {
        if (d.type === 'they_owe') theyOweTotal += rem;
        if (d.type === 'i_owe') iOweTotal += rem;
        if (d.due_date && d.due_date < todayStr) overdueCount++;
      }
    }

    return { theyOweTotal, iOweTotal, overdueCount };
  }, [enrichedDebts, todayStr]);

  const openAddModal = () => {
    setEditingDebt(null);
    setPerson('');
    setAmount('');
    setDate(new Date().toISOString().slice(0, 10));
    setDueDate('');
    setDescription('');
    setAccountId('');
    setStatus('outstanding');
    setError('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (d: Debt) => {
    setEditingDebt(d);
    setPerson(d.person);
    setAmount(formatInputNumber(d.amount));
    setDate(d.date);
    setDueDate(d.due_date || '');
    setDescription(d.description || '');
    setAccountId(d.account_id || '');
    setStatus(d.status === 'paid' ? 'paid' : 'outstanding');
    setError('');
    setIsAddModalOpen(true);
  };

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    if (!person.trim()) {
      setError('Person / contact name is required.');
      return;
    }
    const parsedAmount = parseInputNumber(amount);
    if (parsedAmount <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const payload: Omit<Debt, 'id' | 'created_at'> = {
        type: activeTab,
        person: person.trim(),
        amount: parsedAmount,
        date,
        due_date: dueDate || null,
        description: description.trim() || null,
        status: status,
      };

      // Only attach account_id if an account is explicitly selected for receivables (they_owe)
      if (activeTab === 'they_owe' && accountId) {
        payload.account_id = accountId;
      }

      if (editingDebt) {
        await updateDebt(editingDebt.id, payload);
      } else {
        await addDebt(payload);
      }
      setIsAddModalOpen(false);
      setEditingDebt(null);
      setPerson('');
      setAmount('');
      setDescription('');
      setDueDate('');
      setAccountId('');
      setStatus('outstanding');
    } catch (err: any) {
      console.error('handleCreateDebt error:', err);
      setError(err?.message || 'Failed to save debt/receivable record.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDeleteDebt = async () => {
    if (deleteTarget) {
      await deleteDebt(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-[#F2F5F3]">
            {t('debts.title')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#8F9992] mt-1">
            {t('debts.subtitle')}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center space-x-2 rounded-2xl bg-[#A7D7B5] hover:bg-[#8ecba0] px-4 py-2.5 text-xs font-bold text-[#0D110F] shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>
            {t('debts.addNew', {
              type: activeTab === 'they_owe' ? 'Receivable' : 'Payable'
            })}
          </span>
        </button>
      </div>

      {/* Debt summary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Receivables (They Owe Me) */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between min-w-0">
          <div className="min-w-0 pr-2">
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block whitespace-nowrap truncate" title={t('debts.theyOweKpiTitle') || 'Receivables (They Owe Me)'}>
              {t('debts.theyOweKpiTitle') || 'Receivables (They Owe Me)'}
            </span>
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-[#2E7D32] dark:text-[#34D399] truncate">
              {formatRupiah(stats.theyOweTotal)}
            </div>
            <div className="mt-1 text-[11px] text-[#76847A] dark:text-[#8E9E94] truncate">
              {t('debts.theyOweKpiDesc') || 'Money owed to you'}
            </div>
          </div>
          <div className="w-11 h-11 rounded-full bg-[#E8F5E9] dark:bg-[#1E2B22] text-[#2E7D32] dark:text-[#34D399] flex items-center justify-center shrink-0">
            <HandCoins className="h-5 w-5" />
          </div>
        </div>

        {/* Payables (I Owe Others) */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between min-w-0">
          <div className="min-w-0 pr-2">
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block whitespace-nowrap truncate" title={t('debts.iOweKpiTitle') || 'Payables (I Owe Others)'}>
              {t('debts.iOweKpiTitle') || 'Payables (I Owe Others)'}
            </span>
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-[#C62828] dark:text-[#FB7185] truncate">
              {formatRupiah(stats.iOweTotal)}
            </div>
            <div className="mt-1 text-[11px] text-[#76847A] dark:text-[#8E9E94] truncate">
              {t('debts.iOweKpiDesc') || 'Outstanding debts to settle'}
            </div>
          </div>
          <div className="w-11 h-11 rounded-full bg-[#FFEBEE] dark:bg-[#2C1C1D] text-[#C62828] dark:text-[#FB7185] flex items-center justify-center shrink-0">
            <HandCoins className="h-5 w-5 rotate-180" />
          </div>
        </div>

        {/* Overdue loans */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
              {t('debts.overdueTitle') || 'Overdue'}
            </span>
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-[#18221B] dark:text-[#F0F4F1] flex items-center space-x-2">
              <span>{t('debts.overdueCount', { count: stats.overdueCount })}</span>
              {stats.overdueCount > 0 && <AlertCircle className="h-5 w-5 text-rose-500" />}
            </div>
            <div className="mt-1 text-[11px] text-[#76847A] dark:text-[#8E9E94]">
              {t('debts.overdueDesc') || 'Past due date'}
            </div>
          </div>
          <div className="flex items-end space-x-1.5 h-10 px-2">
            <span className="w-1.5 h-4 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-8 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-6 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
          </div>
        </div>
      </div>

      {/* Tabs Styled as Floating Capsule */}
      <div className="flex items-center rounded-2xl bg-white dark:bg-[#161D18] border border-black/[0.04] dark:border-white/[0.06] p-1.5 w-full sm:w-fit max-w-full overflow-x-auto shadow-xs">
        <button
          onClick={() => setActiveTab('they_owe')}
          className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'they_owe'
              ? 'bg-[#A7D7B5] text-[#0D110F] shadow-sm'
              : 'text-[#8F9992] hover:text-[#F2F5F3]'
          }`}
        >
          <HandCoins className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">{t('debts.theyOweTabShort')}</span>
        </button>
        <button
          onClick={() => setActiveTab('i_owe')}
          className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'i_owe'
              ? 'bg-[#A7D7B5] text-[#0D110F] shadow-sm'
              : 'text-[#8F9992] hover:text-[#F2F5F3]'
          }`}
        >
          <HandCoins className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">{t('debts.iOweTabShort')}</span>
        </button>
      </div>

      {/* Debts List */}
      <div className="space-y-3">
        {filteredDebts.length === 0 ? (
          <div className="rounded-3xl border border-black/[0.04] bg-white dark:border-white/8 dark:bg-[#161D18] p-12 text-center text-xs text-[#76847A] dark:text-[#8F9992]">
            {t('debts.noDebts', { type: activeTab === 'they_owe' ? t('debts.typeReceivable') : t('debts.typePayable') })}
          </div>
        ) : (
          filteredDebts.map((d) => {
            const isPaid = d.status === 'paid';
            const isOverdue = d.due_date && d.due_date < todayStr && !isPaid;

            return (
              <div
                key={d.id}
                className="overflow-hidden rounded-3xl border border-black/[0.04] bg-white dark:border-white/8 dark:bg-[#161D18] p-5 sm:p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] hover:border-[#5B7966]/40 dark:hover:border-[#A7D7B5]/40 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-[#18221B] dark:text-[#F2F5F3]">
                        {d.person}
                      </h3>
                      <span
                        className={`rounded-xl px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap shrink-0 ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-[#A7D7B5]/15 dark:text-[#A7D7B5] dark:border-[#A7D7B5]/25'
                            : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25'
                        }`}
                      >
                        {isPaid ? t('debts.statusPaid') : t('debts.statusUnpaid')}
                      </span>
                      {isOverdue && (
                        <span className="rounded-xl bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/25 px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap shrink-0">
                          {t('debts.overdueBadge')}
                        </span>
                      )}
                      {d.type === 'they_owe' && (
                        d.account_id ? (
                          <span className="rounded-xl bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/25 px-2.5 py-0.5 text-[10px] font-medium whitespace-nowrap shrink-0">
                            {t('debts.deductBudget', { name: accounts.find((a) => a.id === d.account_id)?.name || 'Account' })}
                          </span>
                        ) : (
                          <span className="rounded-xl bg-black/5 text-[#76847A] dark:bg-white/5 dark:text-[#8F9992] px-2.5 py-0.5 text-[10px] font-medium whitespace-nowrap shrink-0">
                            {t('debts.outsidePocket')}
                          </span>
                        )
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-[#76847A] dark:text-[#8F9992]">
                      {d.description || t('debts.noDescription')} • {t('debts.startedOn', { date: d.date })}
                      {d.due_date && ` • ${t('debts.dueOn', { date: d.due_date })}`}
                    </p>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-[#76847A] dark:text-[#8F9992]">{t('common.nominal')}</div>
                      <div className={`text-lg font-bold font-mono tabular-nums whitespace-nowrap ${isPaid ? 'text-[#76847A]/60 dark:text-[#8F9992]/60 line-through' : 'text-[#18221B] dark:text-[#F2F5F3]'}`}>
                        {formatRupiah(d.amount)}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleTogglePaidStatus(d)}
                        disabled={processingDebtId === d.id}
                        className={`inline-flex items-center space-x-1.5 rounded-2xl px-3.5 py-2 min-h-[38px] text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap shrink-0 ${
                          isPaid
                            ? 'bg-[#F6F7F5] text-[#76847A] hover:text-[#18221B] border border-black/[0.04] dark:bg-[#1A211D] dark:text-[#8F9992] dark:hover:text-[#F2F5F3] dark:border-white/8'
                            : 'bg-[#5B7966]/10 text-[#5B7966] hover:bg-[#5B7966]/20 border border-[#5B7966]/20 dark:bg-[#A7D7B5]/15 dark:text-[#A7D7B5] dark:hover:bg-[#A7D7B5]/25 dark:border-[#A7D7B5]/25'
                        }`}
                      >
                        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                        <span className="whitespace-nowrap">
                          {processingDebtId === d.id
                            ? t('common.loading')
                            : isPaid
                            ? t('debts.markAsUnpaid')
                            : t('debts.markAsPaid')}
                        </span>
                      </button>
                      <button
                        onClick={() => openEditModal(d)}
                        title="Edit"
                        className="rounded-xl p-2.5 min-h-[38px] min-w-[38px] flex items-center justify-center text-[#76847A] hover:bg-black/5 hover:text-[#18221B] dark:text-[#8F9992] dark:hover:bg-white/5 dark:hover:text-[#F2F5F3] transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(d)}
                        title="Delete"
                        className="rounded-xl p-2.5 min-h-[38px] min-w-[38px] flex items-center justify-center text-[#76847A] hover:bg-rose-50 hover:text-rose-600 dark:text-[#8F9992] dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Debt Modal */}
      {isAddModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-md rounded-t-[32px] sm:rounded-3xl border-t sm:border border-black/[0.06] bg-white p-5 sm:p-6 shadow-2xl text-[#18221B] dark:border-white/10 dark:bg-[#161D18] dark:text-[#F2F5F3] max-h-[92dvh] sm:max-h-[92vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/8">
              <h2 className="text-base font-bold text-[#18221B] dark:text-[#F2F5F3]">
                {editingDebt
                  ? t('debts.editDebtTitle')
                  : t('debts.addDebtTitle', {
                      type: activeTab === 'they_owe' ? t('debts.newReceivableTitle') : t('debts.newPayableTitle'),
                    })}
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
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

            <form onSubmit={handleCreateDebt} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#76847A] dark:text-[#C5CDC8] mb-1">
                  {t('debts.personName')}
                </label>
                <input
                  type="text"
                  required
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                  placeholder={t('debts.personPlaceholder')}
                  className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] py-2.5 px-3.5 text-base sm:text-xs text-[#18221B] placeholder-[#8E9B92] focus:border-[#5B7966] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:placeholder-[#8F9992]/60 dark:focus:border-[#A7D7B5]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#76847A] dark:text-[#C5CDC8] mb-1">
                  {t('debts.amountLabel')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-xs font-semibold text-[#76847A] dark:text-[#8F9992]">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={amount}
                    onChange={(e) => setAmount(formatInputNumber(e.target.value))}
                    placeholder="1.000.000"
                    className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] py-2.5 pl-10 pr-3.5 text-base sm:text-xs font-bold font-mono text-[#18221B] focus:border-[#5B7966] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:focus:border-[#A7D7B5]"
                  />
                </div>
                {amount && (
                  <div className="mt-1 flex items-center justify-between text-[11px] text-[#76847A] dark:text-[#8F9992]">
                    <span>Format: <strong className="text-[#5B7966] dark:text-[#A7D7B5]">Rp {amount}</strong></span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#76847A] dark:text-[#C5CDC8] mb-1">
                    {t('debts.txDateLabel')}
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] py-2.5 px-3 text-base sm:text-xs text-[#18221B] focus:border-[#5B7966] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:focus:border-[#A7D7B5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#76847A] dark:text-[#C5CDC8] mb-1">
                    {t('debts.dueDateOptional')}
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] py-2.5 px-3 text-base sm:text-xs text-[#18221B] focus:border-[#5B7966] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:focus:border-[#A7D7B5]"
                  />
                </div>
              </div>

              {/* Funding Account if Receivable (they_owe) */}
              {activeTab === 'they_owe' && (
                <div>
                  <label className="block text-xs font-medium text-[#76847A] dark:text-[#C5CDC8] mb-1">
                    {t('debts.sourceAccountOptional')}
                  </label>
                  <SearchableSelect
                    options={accounts.map((acc) => ({
                      value: acc.id,
                      label: acc.pocket_name ? `${acc.name} - ${acc.pocket_name}` : acc.name,
                      sublabel: `Budget: ${formatRupiah(acc.remaining_budget ?? acc.initial_balance)}`,
                      color: acc.pocket_color || acc.color,
                    }))}
                    value={accountId}
                    onChange={(val) => setAccountId(val)}
                    placeholder={t('debts.sourceAccountPlaceholder')}
                    searchPlaceholder={t('transactions.searchAccount')}
                    allOption={{ value: '', label: t('debts.noAccountOption') }}
                  />
                  <p className="mt-1 text-[11px] text-[#76847A] dark:text-[#8F9992]">
                    {accountId
                      ? t('debts.deductNoteYes')
                      : t('debts.deductNoteNo')}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#76847A] dark:text-[#C5CDC8] mb-1">
                  {t('debts.descLabel')}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('debts.descPlaceholder')}
                  className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] py-2.5 px-3.5 text-base sm:text-xs text-[#18221B] placeholder-[#8E9B92] focus:border-[#5B7966] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:placeholder-[#8F9992]/60 dark:focus:border-[#A7D7B5]"
                />
              </div>

              {/* Status (Paid / Outstanding) */}
              <div>
                <label className="block text-xs font-medium text-[#76847A] dark:text-[#C5CDC8] mb-1">
                  {t('common.status')}
                </label>
                <SearchableSelect
                  options={[
                    { value: 'outstanding', label: t('debts.statusUnpaid') },
                    { value: 'paid', label: t('debts.statusPaid') },
                  ]}
                  value={status}
                  onChange={(val) => setStatus(val as 'outstanding' | 'paid')}
                  placeholder={t('common.status')}
                  searchPlaceholder={t('common.search') || 'Search...'}
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-black/[0.06] dark:border-white/8">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="min-h-[44px] rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-4 py-2.5 text-xs font-semibold text-[#76847A] hover:text-[#18221B] dark:border-white/10 dark:bg-[#1A211D] dark:text-[#8F9992] dark:hover:text-[#F2F5F3] transition-all cursor-pointer flex items-center justify-center"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] rounded-2xl bg-[#5B7966] hover:bg-[#4D6A58] text-white dark:bg-[#A7D7B5] dark:hover:bg-[#8ecba0] dark:text-[#0D110F] px-4 py-2.5 text-xs font-bold shadow-sm disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? t('common.loading') : editingDebt ? t('common.saveChanges') : t('debts.saveRecord')}
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
              {t('debts.deleteConfirmTitle')}
            </h3>
            <p className="mt-2 text-xs text-[#76847A] dark:text-[#8E9E94] leading-relaxed">
              {t('debts.deleteConfirmText', { person: deleteTarget.person })}
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="min-h-[44px] rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-4 py-2.5 text-xs font-semibold text-[#76847A] hover:text-[#18221B] dark:border-white/10 dark:bg-[#1A211D] dark:text-[#8F9992] dark:hover:text-[#F2F5F3] transition-all cursor-pointer flex items-center justify-center"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteDebt}
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
