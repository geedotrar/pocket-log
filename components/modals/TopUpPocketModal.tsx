'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Wallet, Globe, Info, Check } from 'lucide-react';
import { useFinanceData } from '@/lib/data/DataContext';
import { formatInputNumber, parseInputNumber, formatRupiah, calculateAccountBalances, getLocalDateString } from '@/lib/calculations';
import SearchableSelect from '@/components/ui/SearchableSelect';

interface TopUpPocketModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTargetAccountId?: string;
}

export default function TopUpPocketModal({
  isOpen,
  onClose,
  defaultTargetAccountId,
}: TopUpPocketModalProps) {
  const { accounts, transactions, debts, cycleStartDate, addTransaction } = useFinanceData();

  const [targetAccountId, setTargetAccountId] = useState('');
  const [sourceType, setSourceType] = useState<'pocket' | 'outside'>('pocket');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => getLocalDateString());
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const prevIsOpenRef = useRef(false);

  const accountsWithBalance = useMemo(() => {
    return calculateAccountBalances(accounts, transactions, debts, cycleStartDate);
  }, [accounts, transactions, debts, cycleStartDate]);

  const activeAccounts = useMemo(() => {
    return accountsWithBalance.filter((a) => a.is_active !== false);
  }, [accountsWithBalance]);

  const targetOptions = useMemo(() => {
    return activeAccounts.map((a) => ({
      value: a.id,
      label: a.pocket_name ? `${a.name} - ${a.pocket_name}` : a.name,
      sublabel: `Balance: ${formatRupiah(a.current_balance ?? a.initial_balance ?? 0)}`,
    }));
  }, [activeAccounts]);

  const sourceOptions = useMemo(() => {
    return activeAccounts
      .filter((a) => a.id !== targetAccountId)
      .map((a) => ({
        value: a.id,
        label: a.pocket_name ? `${a.name} - ${a.pocket_name}` : a.name,
        sublabel: `Balance: ${formatRupiah(a.current_balance ?? a.initial_balance ?? 0)}`,
      }));
  }, [activeAccounts, targetAccountId]);

  useEffect(() => {
    const isOpening = !prevIsOpenRef.current && isOpen;
    prevIsOpenRef.current = isOpen;

    if (!isOpen) return;

    if (isOpening) {
      const initialTarget = defaultTargetAccountId || activeAccounts[0]?.id || '';
      setTargetAccountId(initialTarget);
      
      const firstAvailableSource = activeAccounts.find((a) => a.id !== initialTarget)?.id || '';
      setSourceAccountId(firstAvailableSource);
      setSourceType('pocket');
      setAmount('');
      setDate(getLocalDateString());
      setDescription('');
      setError('');
    }
  }, [isOpen, defaultTargetAccountId, activeAccounts]);

  useEffect(() => {
    if (!isOpen) return;
    if (!targetAccountId && activeAccounts.length > 0) {
      const initialTarget = defaultTargetAccountId || activeAccounts[0]?.id || '';
      setTargetAccountId(initialTarget);
      if (!sourceAccountId) {
        const firstAvailableSource = activeAccounts.find((a) => a.id !== initialTarget)?.id || '';
        setSourceAccountId(firstAvailableSource);
      }
    }
  }, [isOpen, targetAccountId, sourceAccountId, activeAccounts, defaultTargetAccountId]);

  useEffect(() => {
    if (sourceType === 'pocket' && sourceAccountId === targetAccountId) {
      const nextSource = activeAccounts.find((a) => a.id !== targetAccountId)?.id || '';
      setSourceAccountId(nextSource);
    }
  }, [targetAccountId, sourceType, sourceAccountId, activeAccounts]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const targetAccount = activeAccounts.find((a) => a.id === targetAccountId);

  const parsedAmount = parseInputNumber(amount);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatInputNumber(e.target.value);
    setAmount(formatted);
  };

  const handleQuickAddAmount = (addValue: number) => {
    const current = parseInputNumber(amount);
    setAmount(formatInputNumber(current + addValue));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    if (!targetAccountId) {
      setError('Please select a destination pocket');
      return;
    }

    if (parsedAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (sourceType === 'pocket') {
      if (!sourceAccountId) {
        setError('Please select a source pocket to deduct');
        return;
      }
      if (sourceAccountId === targetAccountId) {
        setError('Source and destination pockets cannot be the same');
        return;
      }
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError('');

    try {
      const targetLabel = targetAccount
        ? targetAccount.pocket_name ? `${targetAccount.name} (${targetAccount.pocket_name})` : targetAccount.name
        : 'Pocket';

      if (sourceType === 'pocket') {
        await addTransaction({
          type: 'transfer',
          account_id: sourceAccountId,
          to_account_id: targetAccountId,
          amount: parsedAmount,
          date,
          description: description.trim() || `Top Up Pocket: ${targetLabel}`,
          category_id: null,
        });
      } else {
        await addTransaction({
          type: 'income',
          account_id: targetAccountId,
          to_account_id: null,
          amount: parsedAmount,
          date,
          description: description.trim() || `Top Up Pocket: ${targetLabel}`,
          category_id: null,
        });
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to top up pocket:', err);
      setError(err?.message || 'Failed to top up pocket');
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full sm:max-w-lg rounded-t-[32px] sm:rounded-3xl border-t sm:border border-black/[0.06] bg-white shadow-2xl text-[#18221B] dark:border-white/10 dark:bg-[#161D18] dark:text-[#F2F5F3] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden">
        <div className="mx-auto mt-2.5 mb-0.5 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

        <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/8 p-5 sm:p-6 pt-3 sm:pt-6 pb-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#5B7966]/10 text-[#5B7966] dark:bg-[#A7D7B5]/15 dark:text-[#A7D7B5]">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#18221B] dark:text-[#F2F5F3]">
                Top Up Pocket / Account
              </h3>
              <p className="text-xs text-[#76847A] dark:text-[#8F9992]">
                Add funds to your pocket from another account or external source
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full p-2 text-[#76847A] hover:bg-black/5 hover:text-[#18221B] dark:text-[#8F9992] dark:hover:bg-white/5 dark:hover:text-[#F2F5F3] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-6 pt-4 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 p-3 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#76847A] dark:text-[#C5CDC8]">
              Destination Pocket*
            </label>
            <SearchableSelect
              options={targetOptions}
              value={targetAccountId}
              onChange={setTargetAccountId}
              placeholder="Select destination pocket / account..."
              matchTriggerWidth={true}
              showSublabelInTrigger={false}
              maxHeight="max-h-48 sm:max-h-52"
            />
            {targetAccount && (
              <div className="flex items-center justify-between text-[11px] text-[#76847A] dark:text-[#8F9992] px-1">
                <span>Current balance:</span>
                <span className="font-semibold font-mono tabular-nums text-[#18221B] dark:text-[#F2F5F3]">
                  {formatRupiah(targetAccount.current_balance ?? targetAccount.initial_balance ?? 0)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-1">
            <label className="block text-xs font-semibold text-[#76847A] dark:text-[#C5CDC8]">
              Funding Source*
            </label>
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#F6F7F5] border border-black/[0.06] dark:bg-[#1A211D] dark:border-white/8 rounded-2xl">
              <button
                type="button"
                onClick={() => setSourceType('pocket')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  sourceType === 'pocket'
                    ? 'bg-[#5B7966] text-white dark:bg-[#A7D7B5] dark:text-[#0D110F] shadow-sm'
                    : 'text-[#76847A] hover:text-[#18221B] dark:text-[#8F9992] dark:hover:text-[#F2F5F3]'
                }`}
              >
                <Wallet className="h-4 w-4" />
                <span>From Another Pocket</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceType('outside')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  sourceType === 'outside'
                    ? 'bg-[#5B7966] text-white dark:bg-[#A7D7B5] dark:text-[#0D110F] shadow-sm'
                    : 'text-[#76847A] hover:text-[#18221B] dark:text-[#8F9992] dark:hover:text-[#F2F5F3]'
                }`}
              >
                <Globe className="h-4 w-4" />
                <span>Outside Pocket</span>
              </button>
            </div>

            {sourceType === 'pocket' ? (
              <div className="space-y-2 pt-1">
                <SearchableSelect
                  options={sourceOptions}
                  value={sourceAccountId}
                  onChange={setSourceAccountId}
                  placeholder="Select source pocket to deduct..."
                  matchTriggerWidth={true}
                  showSublabelInTrigger={false}
                  maxHeight="max-h-48 sm:max-h-52"
                />
                <div className="flex items-start gap-1.5 rounded-2xl bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20 p-3 text-[11px]">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-sky-500 dark:text-sky-400" />
                  <span>
                    Source pocket balance will be <strong>deducted</strong> and destination pocket will be <strong>added</strong> (internal transfer).
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-1.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-[#A7D7B5]/10 dark:text-[#A7D7B5] dark:border-[#A7D7B5]/20 p-3 text-[11px]">
                <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-[#A7D7B5]" />
                <span>
                  External funds (salary, cash deposit, etc.). Destination pocket balance will be <strong>added directly</strong> without deducting any pocket.
                </span>
              </div>
            )}
          </div>

            <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#76847A] dark:text-[#C5CDC8]">
              Top Up Amount (IDR)*
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#76847A] dark:text-[#8F9992]">
                Rp
              </span>
              <input
                type="text"
                autoComplete="off"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0"
                className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] py-2.5 pl-10 pr-4 text-base font-bold font-mono text-[#18221B] focus:border-[#5B7966] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:focus:border-[#A7D7B5]"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {[50000, 100000, 250000, 500000, 1000000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAddAmount(val)}
                  className="rounded-xl border border-black/[0.06] bg-[#F6F7F5] px-2.5 py-1 text-[11px] font-semibold font-mono text-[#76847A] hover:text-[#18221B] hover:bg-black/5 dark:border-white/8 dark:bg-[#1A211D] dark:text-[#8F9992] dark:hover:text-[#F2F5F3] dark:hover:bg-[#232B25] transition-colors cursor-pointer"
                >
                  +{formatRupiah(val)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#76847A] dark:text-[#C5CDC8]">
              Transaction Date*
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-3.5 py-2.5 text-base sm:text-xs font-medium text-[#18221B] focus:border-[#5B7966] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:focus:border-[#A7D7B5]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#76847A] dark:text-[#C5CDC8]">
              Note / Description (Optional)
            </label>
            <input
              type="text"
              autoComplete="off"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={sourceType === 'pocket' ? 'e.g. Top up from main bank account' : 'e.g. Cash deposit / Salary'}
              className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-3.5 py-2.5 text-base sm:text-xs text-[#18221B] placeholder-[#8E9B92] focus:border-[#5B7966] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:placeholder-[#8F9992]/60 dark:focus:border-[#A7D7B5]"
            />
          </div>

          </div>

          <div className="p-4 sm:px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:pb-4 border-t border-black/[0.06] dark:border-white/8 flex items-center justify-end space-x-3 bg-white dark:bg-[#161D18] shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-5 py-2.5 min-h-[44px] text-xs font-semibold text-[#76847A] hover:text-[#18221B] dark:border-white/10 dark:bg-[#1A211D] dark:text-[#8F9992] dark:hover:text-[#F2F5F3] active:scale-95 transition-all cursor-pointer flex items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || parsedAmount <= 0}
              className="flex items-center space-x-1.5 rounded-2xl bg-[#5B7966] hover:bg-[#4D6A58] text-white dark:bg-[#A7D7B5] dark:hover:bg-[#8ecba0] dark:text-[#0D110F] px-6 py-2.5 min-h-[44px] text-xs font-bold shadow-sm active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer justify-center"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>
                    {parsedAmount > 0 ? `Confirm Top Up (${formatRupiah(parsedAmount)})` : 'Confirm Top Up'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
