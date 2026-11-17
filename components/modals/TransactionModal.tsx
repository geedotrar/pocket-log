'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, ArrowRightLeft, TrendingDown, TrendingUp, HandCoins } from 'lucide-react';
import { useFinanceData } from '@/lib/data/DataContext';
import { Transaction, TransactionType } from '@/lib/types';
import {
  formatInputNumber,
  parseInputNumber,
  formatRupiah,
  calculateAccountBalances,
  formatTransactionDescription,
  isDebtSettlementTransaction,
  getLocalDateString,
} from '@/lib/calculations';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Transaction | null;
  defaultAccountId?: string;
}

function TransactionModalContent({
  isOpen,
  onClose,
  initialData,
  defaultAccountId,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Transaction | null;
  defaultAccountId?: string;
}) {
  const { accounts, categories, transactions, debts, cycleStartDate, addTransaction, updateTransaction } =
    useFinanceData();
  const { t } = useLanguage();

  // Initialize form state ONCE from initialData or defaults
  const [type, setType] = useState<TransactionType>(() => initialData?.type || 'expense');
  const [amount, setAmount] = useState(() => (initialData ? formatInputNumber(initialData.amount) : ''));
  const [date, setDate] = useState(() => initialData?.date || getLocalDateString());
  const [accountId, setAccountId] = useState(() => initialData?.account_id || defaultAccountId || accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(
    () => initialData?.to_account_id || accounts.find((a) => a.id !== (defaultAccountId || accounts[0]?.id))?.id || accounts[1]?.id || ''
  );
  const [categoryId, setCategoryId] = useState(() => {
    if (initialData?.category_id) return initialData.category_id;
    const defaultType = initialData?.type || 'expense';
    return categories.find((c) => c.type === defaultType)?.id || '';
  });
  const [description, setDescription] = useState(() => {
    if (!initialData?.description) return '';
    const cleaned = formatTransactionDescription(initialData.description);
    return cleaned === '-' ? '' : cleaned;
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // If accounts/categories were still loading when opened, fill in defaults once available
  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(defaultAccountId || accounts[0]?.id || '');
    }
  }, [accounts, accountId, defaultAccountId]);

  useEffect(() => {
    if (!toAccountId && accounts.length > 1) {
      const dest = accounts.find((a) => a.id !== (defaultAccountId || accounts[0]?.id))?.id || accounts[1]?.id || '';
      setToAccountId(dest);
    }
  }, [accounts, toAccountId, defaultAccountId]);

  useEffect(() => {
    if (!categoryId && categories.length > 0 && type !== 'transfer') {
      const matchCat = categories.find((c) => c.type === type);
      if (matchCat) setCategoryId(matchCat.id);
    }
  }, [categories, categoryId, type]);

  // When the user explicitly clicks a type switcher (Expense / Income / Transfer),
  // update the category to match the new type (only if not a transfer).
  const prevTypeRef = useRef(type);
  useEffect(() => {
    if (prevTypeRef.current !== type) {
      prevTypeRef.current = type;
      if (!initialData && type !== 'transfer') {
        const matchCat = categories.find((c) => c.type === type);
        if (matchCat) setCategoryId(matchCat.id);
      }
    }
  }, [type, categories, initialData]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const accountsWithBalance = useMemo(() => {
    return calculateAccountBalances(accounts, transactions, debts, cycleStartDate);
  }, [accounts, transactions, debts, cycleStartDate]);

  const accountMap = useMemo(() => {
    const map = new Map<string, (typeof accountsWithBalance)[0]>();
    accountsWithBalance.forEach((a) => map.set(a.id, a));
    return map;
  }, [accountsWithBalance]);

  const selectedAccount = accountMap.get(accountId);
  const selectedToAccount = accountMap.get(toAccountId);

  const parsedAmount = parseInputNumber(amount);

  const selectedAccountBalance = useMemo(() => {
    if (!selectedAccount) return 0;
    let bal = selectedAccount.current_balance ?? Number(selectedAccount.initial_balance) ?? 0;
    if (
      initialData &&
      initialData.account_id === selectedAccount.id &&
      (initialData.type === 'expense' || initialData.type === 'transfer')
    ) {
      bal += Number(initialData.amount) || 0;
    }
    return bal;
  }, [selectedAccount, initialData]);

  const isInsufficientBalance = Boolean(
    selectedAccount &&
    (type === 'expense' || type === 'transfer') &&
    parsedAmount > 0 &&
    parsedAmount > selectedAccountBalance
  );

  const sourceAccountOptions = useMemo(() => {
    return accountsWithBalance.map((a) => {
      const bal = a.current_balance ?? Number(a.initial_balance) ?? 0;
      return {
        value: a.id,
        label: a.pocket_name ? `${a.name} - ${a.pocket_name}` : a.name,
        sublabel: formatRupiah(bal),
        color: a.pocket_color || a.color,
      };
    });
  }, [accountsWithBalance]);

  const destAccountOptions = useMemo(() => {
    return accountsWithBalance
      .filter((a) => a.id !== accountId)
      .map((a) => {
        const bal = a.current_balance ?? Number(a.initial_balance) ?? 0;
        return {
          value: a.id,
          label: a.pocket_name ? `${a.name} - ${a.pocket_name}` : a.name,
          sublabel: formatRupiah(bal),
          color: a.pocket_color || a.color,
        };
      });
  }, [accountsWithBalance, accountId]);

  const prevIsOpenRef = useRef(false);
  const prevInitialDataRef = useRef<Transaction | null | undefined>(undefined);

  useEffect(() => {
    const isOpening = !prevIsOpenRef.current && isOpen;
    const isInitialDataChanged = isOpen && initialData !== prevInitialDataRef.current;

    prevIsOpenRef.current = isOpen;
    prevInitialDataRef.current = initialData;

    if (!isOpen) return;

    if (isOpening || isInitialDataChanged) {
      if (initialData) {
        setType(initialData.type);
        setAmount(formatInputNumber(initialData.amount));
        setDate(initialData.date);
        setAccountId(initialData.account_id);
        setToAccountId(initialData.to_account_id || '');
        setCategoryId(initialData.category_id || '');
        const cleanedDesc = formatTransactionDescription(initialData.description);
        setDescription(cleanedDesc === '-' ? '' : cleanedDesc);
      } else {
        setType('expense');
        setAmount('');
        setDate(getLocalDateString());
        const defaultAcc = defaultAccountId || accounts[0]?.id || '';
        setAccountId(defaultAcc);
        setToAccountId(accounts.find((a) => a.id !== defaultAcc)?.id || accounts[1]?.id || '');
        const firstExpCat = categories.find((c) => c.type === 'expense');
        setCategoryId(firstExpCat?.id || '');
        setDescription('');
      }
      setError('');
    }
  }, [isOpen, initialData, defaultAccountId, accounts, categories]);

  useEffect(() => {
    if (!isOpen || initialData) return;

    if (!accountId && accounts.length > 0) {
      const defaultAcc = defaultAccountId || accounts[0]?.id || '';
      setAccountId(defaultAcc);
      if (!toAccountId && accounts.length > 1) {
        setToAccountId(accounts.find((a) => a.id !== defaultAcc)?.id || accounts[1]?.id || '');
      }
    }

    if (!categoryId && categories.length > 0 && type !== 'transfer') {
      const matchCat = categories.find((c) => c.type === type);
      if (matchCat) setCategoryId(matchCat.id);
    }
  }, [isOpen, initialData, accounts, categories, accountId, categoryId, toAccountId, defaultAccountId, type]);

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (!initialData && newType !== 'transfer') {
      const currentCatValid = categories.some((c) => c.id === categoryId && c.type === newType);
      if (!currentCatValid) {
        const matchCat = categories.find((c) => c.type === newType);
        setCategoryId(matchCat?.id || '');
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    setError('');

    const parsed = parseInputNumber(amount);
    if (parsed <= 0) {
      setError(t('transactions.validationAmount') || 'Amount must be greater than 0');
      return;
    }

    if (!accountId) {
      setError(t('transactions.validationAccount') || 'Please select an account');
      return;
    }

    if (type === 'transfer') {
      if (!toAccountId) {
        setError(t('transactions.validationToAccount') || 'Please select a destination account');
        return;
      }
      if (accountId === toAccountId) {
        setError(t('transactions.validationSameAccount') || 'Source and destination accounts must be different');
        return;
      }
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const payload = {
        type,
        amount: parsed,
        date,
        account_id: accountId,
        to_account_id: type === 'transfer' ? toAccountId : null,
        category_id: type === 'transfer' ? null : categoryId || null,
        description: description.trim() || null,
      };

      if (initialData) {
        await updateTransaction(initialData.id, payload);
      } else {
        await addTransaction(payload);
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError(`${t('common.error')}: Failed to save transaction`);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const filteredCategories = categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));
  const isDebtSettlement = Boolean(initialData && isDebtSettlementTransaction(initialData, categories));

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full sm:max-w-lg rounded-t-[32px] sm:rounded-3xl border-t sm:border border-black/[0.06] bg-white shadow-2xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col text-[#18221B] dark:border-white/10 dark:bg-[#161D18] dark:text-[#F2F5F3] overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <div className="mx-auto mt-2.5 mb-0.5 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

        <div className="flex items-center justify-between p-5 sm:p-6 pt-3 sm:pt-6 pb-3.5 border-b border-black/[0.06] dark:border-white/8 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-[#18221B] dark:text-[#F2F5F3] tracking-tight">
            {initialData ? (t('transactions.editTitle') || 'Edit Transaction') : (t('transactions.addNewTitle') || 'New Transaction')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full p-2 text-[#76847A] hover:bg-black/5 hover:text-[#18221B] dark:text-[#8F9992] dark:hover:bg-white/10 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-5 sm:p-6 pt-4 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20">
                {error}
              </div>
            )}

            {isDebtSettlement ? (
              <div className="flex items-center space-x-2.5 rounded-2xl border border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300 p-3 text-xs">
                <div className="rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300 p-2 shrink-0">
                  <HandCoins className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-teal-900 dark:text-teal-200">
                    Debt Repayment
                  </div>
                  <p className="text-[11px] text-teal-700 dark:text-teal-300/80 mt-0.5">
                    Funds returned to account without affecting primary income.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#F6F7F5] border border-black/[0.06] dark:bg-[#1A211D] dark:border-white/8 p-1">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`flex items-center justify-center space-x-1.5 rounded-xl py-2 text-xs font-semibold transition-all cursor-pointer ${type === 'expense'
                    ? 'bg-rose-500 text-white shadow-sm font-bold'
                    : 'text-[#76847A] hover:text-[#18221B] dark:text-[#8F9992] dark:hover:text-[#F2F5F3]'
                    }`}
                >
                  <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                  <span>Expense</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`flex items-center justify-center space-x-1.5 rounded-xl py-2 text-xs font-semibold transition-all cursor-pointer ${type === 'income'
                    ? 'bg-[#2E7D32] dark:bg-[#34D399] text-white dark:text-[#0C2417] shadow-sm font-bold'
                    : 'text-[#76847A] hover:text-[#18221B] dark:text-[#8F9992] dark:hover:text-[#F2F5F3]'
                    }`}
                >
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                  <span>Income</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('transfer')}
                  className={`flex items-center justify-center space-x-1.5 rounded-xl py-2 text-xs font-semibold transition-all cursor-pointer ${type === 'transfer'
                    ? 'bg-[#38BDF8] text-[#0C2417] shadow-sm font-bold'
                    : 'text-[#76847A] hover:text-[#18221B] dark:text-[#8F9992] dark:hover:text-[#F2F5F3]'
                    }`}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
                  <span>Transfer</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-[#76847A] dark:text-[#8F9992] mb-1.5">
                  Amount (IDR)*
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-xs font-bold text-[#76847A] dark:text-[#8F9992]">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={amount}
                    onChange={(e) => setAmount(formatInputNumber(e.target.value))}
                    placeholder="0"
                    className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] py-2 pl-9 pr-3.5 text-base sm:text-xs font-bold text-[#18221B] focus:border-[#5B7966] focus:outline-none tabular-nums dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:focus:border-[#A7D7B5]"
                  />
                </div>
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-[#76847A] dark:text-[#8F9992] mb-1.5">
                  Date*
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] py-2 px-3 text-base sm:text-xs text-[#18221B] focus:border-[#5B7966] focus:outline-none cursor-pointer dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:focus:border-[#A7D7B5]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="min-w-0">
                <div className="flex items-center justify-between mb-1.5 min-h-[20px]">
                  <label className="block text-xs font-semibold text-[#76847A] dark:text-[#8F9992] truncate">
                    {type === 'transfer' ? 'From Account' : 'Account*'}
                  </label>
                  {selectedAccount && (
                    <div className="flex items-center space-x-1 text-[11px] shrink-0 tabular-nums ml-2">
                      <span className={isInsufficientBalance ? 'text-rose-500 font-bold' : 'text-[#76847A] dark:text-[#8F9992]'}>
                        Balance: {formatRupiah(selectedAccountBalance)}
                      </span>
                    </div>
                  )}
                </div>
                <SearchableSelect
                  options={sourceAccountOptions}
                  value={accountId}
                  onChange={setAccountId}
                  placeholder="Select Account..."
                  searchPlaceholder="Search account..."
                  matchTriggerWidth={true}
                  showSublabelInTrigger={false}
                  maxHeight="max-h-48 sm:max-h-52"
                />
              </div>

              {type === 'transfer' ? (
                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-1.5 min-h-[20px]">
                    <label className="block text-xs font-semibold text-[#76847A] dark:text-[#8F9992] truncate">
                      To Account*
                    </label>
                    {selectedToAccount && (
                      <div className="flex items-center space-x-1 text-[11px] shrink-0 tabular-nums ml-2 text-[#76847A] dark:text-[#8F9992]">
                        Balance: {formatRupiah(selectedToAccount.current_balance ?? Number(selectedToAccount.initial_balance) ?? 0)}
                      </div>
                    )}
                  </div>
                  <SearchableSelect
                    options={destAccountOptions}
                    value={toAccountId}
                    onChange={setToAccountId}
                    placeholder="Select Destination Account..."
                    searchPlaceholder="Search destination account..."
                    align="right"
                    matchTriggerWidth={true}
                    showSublabelInTrigger={false}
                    maxHeight="max-h-48 sm:max-h-52"
                  />
                </div>
              ) : (
                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-1.5 min-h-[20px]">
                    <label className="block text-xs font-semibold text-[#76847A] dark:text-[#8F9992]">
                      Category
                    </label>
                  </div>
                  <SearchableSelect
                    options={filteredCategories.map((c) => ({
                      value: c.id,
                      label: c.name,
                      color: c.color,
                    }))}
                    value={categoryId}
                    onChange={setCategoryId}
                    placeholder="Select Category..."
                    searchPlaceholder="Search category..."
                    allOption={{ value: '', label: 'No Category' }}
                    align="right"
                    matchTriggerWidth={true}
                    maxHeight="max-h-48 sm:max-h-52"
                  />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-semibold text-[#76847A] dark:text-[#8F9992] mb-1.5">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  // Prevent accidental submit when pressing Enter in notes field
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                placeholder="e.g. Groceries, Coffee, Subscription"
                className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] py-2 px-3.5 text-base sm:text-xs text-[#18221B] placeholder-[#8E9B92] focus:border-[#5B7966] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:placeholder-[#8F9992] dark:focus:border-[#A7D7B5]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 p-4 sm:px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:pb-4 border-t border-black/[0.06] dark:border-white/8 bg-white dark:bg-[#161D18] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-5 py-2.5 min-h-[44px] text-xs font-semibold text-[#76847A] hover:text-[#18221B] dark:border-white/10 dark:bg-[#1A211D] dark:text-[#8F9992] dark:hover:text-[#F2F5F3] active:scale-95 transition-all cursor-pointer flex items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-[#5B7966] hover:bg-[#4D6A58] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] dark:hover:bg-[#95D5B2] px-6 py-2.5 min-h-[44px] text-xs font-bold shadow-md disabled:opacity-50 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
            >
              {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TransactionModal({
  isOpen,
  onClose,
  initialData,
  defaultAccountId,
}: TransactionModalProps) {
  if (!isOpen) return null;

  return (
    <TransactionModalContent
      key={initialData?.id || 'new'}
      isOpen={isOpen}
      onClose={onClose}
      initialData={initialData}
      defaultAccountId={defaultAccountId}
    />
  );
}
