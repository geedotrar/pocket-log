'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Edit2,
  X,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  PiggyBank,
  Landmark,
  Layers,
  Coins,
  Gem,
  CircleDollarSign,
  BarChart2,
  CheckCircle2,
  Clock,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import { useFinanceData } from '@/lib/data/DataContext';
import {
  Investment,
  InvestmentLog,
  InvestmentType,
  InvestmentStatus,
} from '@/lib/types';
import {
  formatRupiah,
  formatInputNumber,
  parseInputNumber,
  calculateInvestmentSummary,
} from '@/lib/calculations';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function InvestmentsPage() {
  const {
    investments,
    investmentLogs,
    accounts,
    addInvestment,
    updateInvestmentValue,
    topUpInvestment,
    withdrawInvestment,
    updateInvestment,
    deleteInvestment,
  } = useFinanceData();
  const { t, dateLocale } = useLanguage();

  // Active Tab: 'active' | 'closed'
  const [activeTab, setActiveTab] = useState<InvestmentStatus>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);

  const [valueUpdateTarget, setValueUpdateTarget] = useState<Investment | null>(null);
  const [topUpTarget, setTopUpTarget] = useState<Investment | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<Investment | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Investment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);

  // Form states - Add / Edit Investment
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<InvestmentType>('mutual_fund');
  const [platform, setPlatform] = useState('');
  const [investedAmount, setInvestedAmount] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state - Update Value
  const [newValueInput, setNewValueInput] = useState('');
  const [valueUpdateDate, setValueUpdateDate] = useState(new Date().toISOString().slice(0, 10));
  const [valueUpdateNotes, setValueUpdateNotes] = useState('');

  // Form state - Top Up
  const [topUpAmountInput, setTopUpAmountInput] = useState('');
  const [topUpSourceAccountId, setTopUpSourceAccountId] = useState('');
  const [topUpDate, setTopUpDate] = useState(new Date().toISOString().slice(0, 10));
  const [topUpNotes, setTopUpNotes] = useState('');

  // Form state - Withdraw
  const [withdrawAmountInput, setWithdrawAmountInput] = useState('');
  const [withdrawDestAccountId, setWithdrawDestAccountId] = useState('');
  const [isFullRedemption, setIsFullRedemption] = useState(false);
  const [withdrawDate, setWithdrawDate] = useState(new Date().toISOString().slice(0, 10));
  const [withdrawNotes, setWithdrawNotes] = useState('');

  // Close modals on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddModalOpen(false);
        setEditingInvestment(null);
        setValueUpdateTarget(null);
        setTopUpTarget(null);
        setWithdrawTarget(null);
        setHistoryTarget(null);
        setDeleteTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute portfolio calculations
  const { summary, activeInvestments, closedInvestments } = useMemo(() => {
    return calculateInvestmentSummary(investments);
  }, [investments]);

  // Filtered lists
  const displayedInvestments = useMemo(() => {
    const list = activeTab === 'active' ? activeInvestments : closedInvestments;
    return list.filter((inv) => {
      const matchSearch =
        inv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.platform && inv.platform.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchType = selectedTypeFilter === 'all' || inv.type === selectedTypeFilter;
      return matchSearch && matchType;
    });
  }, [activeTab, activeInvestments, closedInvestments, searchQuery, selectedTypeFilter]);

  // Asset type icon & styling helper
  const getAssetTypeMeta = (type: InvestmentType) => {
    switch (type) {
      case 'mutual_fund':
        return {
          label: t('investments.types.mutual_fund'),
          icon: Layers,
          colorClass: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400',
        };
      case 'stock':
        return {
          label: t('investments.types.stock'),
          icon: BarChart2,
          colorClass: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400',
        };
      case 'crypto':
        return {
          label: t('investments.types.crypto'),
          icon: Coins,
          colorClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400',
        };
      case 'gold':
        return {
          label: t('investments.types.gold'),
          icon: Gem,
          colorClass: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/40 dark:text-yellow-400',
        };
      case 'bond':
        return {
          label: t('investments.types.bond'),
          icon: Landmark,
          colorClass: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400',
        };
      case 'deposit':
        return {
          label: t('investments.types.deposit'),
          icon: PiggyBank,
          colorClass: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-400',
        };
      default:
        return {
          label: t('investments.types.other'),
          icon: CircleDollarSign,
          colorClass: 'text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-400',
        };
    }
  };

  // Days calculation
  const calculateDaysDuration = (startDateStr: string, endDateStr?: string | null) => {
    try {
      const start = new Date(startDateStr);
      const end = endDateStr ? new Date(endDateStr) : new Date();
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return 0;
    }
  };

  // Open Add Modal
  const openAddModal = () => {
    setName('');
    setAssetType('mutual_fund');
    setPlatform('');
    setInvestedAmount('');
    setCurrentValue('');
    setStartDate(new Date().toISOString().slice(0, 10));
    setSourceAccountId('');
    setNotes('');
    setFormError('');
    setEditingInvestment(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (inv: Investment) => {
    setEditingInvestment(inv);
    setName(inv.name);
    setAssetType(inv.type);
    setPlatform(inv.platform || '');
    setInvestedAmount(formatInputNumber(String(inv.invested_amount)));
    setCurrentValue(formatInputNumber(String(inv.current_value)));
    setStartDate(inv.start_date);
    setSourceAccountId('');
    setNotes(inv.notes || '');
    setFormError('');
    setIsAddModalOpen(true);
  };

  // Handle Save Investment
  const handleSaveInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter the asset name');
      return;
    }

    const capital = parseInputNumber(investedAmount) || 0;
    const current = editingInvestment
      ? (currentValue ? parseInputNumber(currentValue) : capital)
      : capital;

    if (!editingInvestment && capital <= 0) {
      setFormError('Initial capital must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingInvestment) {
        await updateInvestment(editingInvestment.id, {
          name: name.trim(),
          type: assetType,
          platform: platform.trim() || null,
          invested_amount: capital > 0 ? capital : editingInvestment.invested_amount,
          current_value: current >= 0 ? current : editingInvestment.current_value,
          start_date: startDate,
          notes: notes.trim() || null,
        });
      } else {
        await addInvestment(
          {
            name: name.trim(),
            type: assetType,
            platform: platform.trim() || null,
            invested_amount: capital,
            current_value: capital,
            total_withdrawn: 0,
            status: 'active',
            start_date: startDate,
            notes: notes.trim() || null,
          },
          sourceAccountId || undefined
        );
      }
      setIsAddModalOpen(false);
      setEditingInvestment(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save investment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Update Value Modal
  const openUpdateValueModal = (inv: Investment) => {
    setValueUpdateTarget(inv);
    setNewValueInput('');
    setValueUpdateDate(new Date().toISOString().slice(0, 10));
    setValueUpdateNotes('');
  };

  const handleSaveValueUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valueUpdateTarget) return;

    const val = parseInputNumber(newValueInput);
    if (!newValueInput.trim() || isNaN(val) || val < 0) return;

    setIsSubmitting(true);
    try {
      await updateInvestmentValue(
        valueUpdateTarget.id,
        val,
        valueUpdateNotes.trim() || undefined,
        valueUpdateDate
      );
      setValueUpdateTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Top Up Modal
  const openTopUpModal = (inv: Investment) => {
    setTopUpTarget(inv);
    setTopUpAmountInput('');
    setTopUpSourceAccountId('');
    setTopUpDate(new Date().toISOString().slice(0, 10));
    setTopUpNotes('');
  };

  const handleSaveTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topUpTarget) return;

    const amt = parseInputNumber(topUpAmountInput) || 0;
    if (amt <= 0) return;

    setIsSubmitting(true);
    try {
      await topUpInvestment(
        topUpTarget.id,
        amt,
        undefined, // default adds to current_value
        topUpSourceAccountId || undefined,
        topUpNotes.trim() || undefined,
        topUpDate
      );
      setTopUpTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Withdraw Modal
  const openWithdrawModal = (inv: Investment) => {
    setWithdrawTarget(inv);
    setWithdrawAmountInput(formatInputNumber(String(inv.current_value)));
    setWithdrawDestAccountId('');
    setIsFullRedemption(true);
    setWithdrawDate(new Date().toISOString().slice(0, 10));
    setWithdrawNotes('');
  };

  const handleSaveWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawTarget) return;

    const amt = parseInputNumber(withdrawAmountInput) || 0;
    if (amt <= 0) return;

    const isFull = isFullRedemption || amt >= withdrawTarget.current_value;

    setIsSubmitting(true);
    try {
      await withdrawInvestment(
        withdrawTarget.id,
        amt,
        isFull,
        withdrawDestAccountId || undefined,
        withdrawNotes.trim() || undefined,
        withdrawDate
      );
      setWithdrawTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open History Modal
  const openHistoryModal = (inv: Investment) => {
    setHistoryTarget(inv);
  };

  // Delete Investment
  const handleDeleteInvestment = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await deleteInvestment(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Asset Logs for History Target
  const targetLogs = useMemo(() => {
    if (!historyTarget) return [];
    return investmentLogs
      .filter((log) => log.investment_id === historyTarget.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [historyTarget, investmentLogs]);

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-[#F2F5F3] sm:text-2xl">
            {t('investments.title')}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#8F9992]">
            {t('investments.subtitle')}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center space-x-2 rounded-2xl bg-[#A7D7B5] hover:bg-[#8ecba0] px-4 py-2.5 text-xs font-bold text-[#0D110F] shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{t('investments.addInvestment')}</span>
        </button>
      </div>

      {/* Portfolio summary metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Portfolio Value */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
              {t('investments.totalPortfolio') || 'Total Portfolio'}
            </span>
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1] tabular-nums whitespace-nowrap overflow-x-auto no-scrollbar">
              {formatRupiah(summary.totalCurrentValue)}
            </div>
            <div className="mt-1 text-[11px] text-[#76847A] dark:text-[#8E9E94]">
              {summary.activeCount} {t('investments.activeAssets').toLowerCase()}
            </div>
          </div>
          <div className="flex items-end space-x-1.5 h-10 px-2">
            <span className="w-1.5 h-4 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-8 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-10 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-6 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
          </div>
        </div>

        {/* Total Invested Capital */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
              {t('investments.totalInvested') || 'Invested Capital'}
            </span>
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1] tabular-nums whitespace-nowrap overflow-x-auto no-scrollbar">
              {formatRupiah(summary.totalInvested)}
            </div>
            <div className="mt-1 text-[11px] text-[#76847A] dark:text-[#8E9E94]">
              Active capital deployed
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#E5EFE8] dark:bg-[#1E2B22] text-[#4D6A58] dark:text-[#A7D7B5] flex items-center justify-center shrink-0">
            <Landmark className="h-5 w-5" />
          </div>
        </div>

        {/* Floating Return (Unrealized) */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
              {t('investments.unrealizedReturn') || 'Unrealized PnL'}
            </span>
            <div
              className={`mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums whitespace-nowrap overflow-x-auto no-scrollbar ${
                summary.totalUnrealizedPnl >= 0
                  ? 'text-[#2E7D32] dark:text-[#34D399]'
                  : 'text-[#C62828] dark:text-[#FB7185]'
              }`}
            >
              {summary.totalUnrealizedPnl >= 0 ? '+' : ''}
              {formatRupiah(summary.totalUnrealizedPnl)}
            </div>
            <div className="mt-1">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap inline-flex items-center shrink-0 ${
                  summary.totalUnrealizedPnl >= 0
                    ? 'bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1E2B22] dark:text-[#34D399]'
                    : 'bg-[#FFEBEE] text-[#C62828] dark:bg-[#2C1C1D] dark:text-[#FB7185]'
                }`}
              >
                {summary.totalUnrealizedPnl >= 0 ? '+' : ''}
                {summary.unrealizedPnlPercent.toFixed(2)}% ROI
              </span>
            </div>
          </div>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              summary.totalUnrealizedPnl >= 0
                ? 'bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1E2B22] dark:text-[#34D399]'
                : 'bg-[#FFEBEE] text-[#C62828] dark:bg-[#2C1C1D] dark:text-[#FB7185]'
            }`}
          >
            {summary.totalUnrealizedPnl >= 0 ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )}
          </div>
        </div>

        {/* Realized Gains Accent Card */}
        <div className="rounded-[28px] bg-[#5B7966] dark:bg-[#3E5747] text-white p-5 shadow-[0_10px_30px_rgba(91,121,102,0.25)] flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-white/80 block">
              {t('investments.realizedReturn') || 'Realized Profit'}
            </span>
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums whitespace-nowrap overflow-x-auto no-scrollbar">
              {summary.totalRealizedPnl >= 0 ? '+' : ''}
              {formatRupiah(summary.totalRealizedPnl)}
            </div>
            <div className="mt-1 text-[11px] text-white/70">
              {formatRupiah(summary.totalWithdrawn)} withdrawn
            </div>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="rounded-full bg-white text-[#4D6A58] p-2.5 shadow-sm hover:scale-105 active:scale-95 transition-transform shrink-0"
            title="Add Asset"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
          </button>
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Active vs Closed Tabs */}
        <div className="flex items-center rounded-2xl bg-white dark:bg-[#1A211D] border border-black/[0.04] dark:border-white/8 p-1.5 w-full sm:w-fit overflow-x-auto shadow-xs">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'active'
                ? 'bg-[#5B7966] text-white dark:bg-[#A7D7B5] dark:text-[#0D110F] shadow-sm'
                : 'text-[#76847A] hover:text-[#18221B] dark:text-[#8F9992] dark:hover:text-[#F2F5F3]'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>
              {t('investments.activeTab')} ({summary.activeCount})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('closed')}
            className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'closed'
                ? 'bg-[#5B7966] text-white dark:bg-[#A7D7B5] dark:text-[#0D110F] shadow-sm'
                : 'text-[#76847A] hover:text-[#18221B] dark:text-[#8F9992] dark:hover:text-[#F2F5F3]'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>
              {t('investments.closedTab', { count: summary.closedCount })}
            </span>
          </button>
        </div>

        {/* Search & Asset Class Filter */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#76847A] dark:text-[#8F9992]" />
            <input
              type="text"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-black/[0.04] bg-white dark:border-white/10 dark:bg-[#161C18] py-2 pl-9 pr-3 text-base sm:text-xs text-[#18221B] dark:text-[#F2F5F3] placeholder-[#8E9B92] dark:placeholder-[#8F9992]/60 focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none shadow-xs"
            />
          </div>

          <SearchableSelect
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'mutual_fund', label: t('investments.types.mutual_fund') },
              { value: 'stock', label: t('investments.types.stock') },
              { value: 'crypto', label: t('investments.types.crypto') },
              { value: 'gold', label: t('investments.types.gold') },
              { value: 'bond', label: t('investments.types.bond') },
              { value: 'deposit', label: t('investments.types.deposit') },
              { value: 'other', label: t('investments.types.other') },
            ]}
            value={selectedTypeFilter}
            onChange={(val) => setSelectedTypeFilter(val)}
            placeholder="All Types"
            searchPlaceholder={t('common.search') || 'Search type...'}
            size="sm"
            className="w-36 sm:w-44"
          />
        </div>
      </div>

      {/* Asset List Grid */}
      <div className="space-y-3">
        {displayedInvestments.length === 0 ? (
          <div className="rounded-3xl border border-black/[0.04] bg-white dark:border-white/8 dark:bg-[#161D18] p-12 text-center text-xs text-[#76847A] dark:text-[#8F9992]">
            {activeTab === 'active' ? (
              <div>
                <p className="text-sm font-bold text-[#18221B] dark:text-[#F2F5F3]">
                  {t('investments.emptyActiveTitle')}
                </p>
                <p className="mt-1 text-[#76847A] dark:text-[#8F9992]">{t('investments.emptyActiveDesc')}</p>
                <button
                  onClick={openAddModal}
                  className="mt-4 inline-flex items-center space-x-1.5 rounded-2xl bg-[#5B7966] hover:bg-[#4D6A58] text-white dark:bg-[#A7D7B5] dark:hover:bg-[#8ecba0] dark:text-[#0D110F] px-4 py-2 text-xs font-bold shadow-sm transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t('investments.addInvestment')}</span>
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-[#18221B] dark:text-[#F2F5F3]">
                  {t('investments.emptyClosedTitle')}
                </p>
                <p className="mt-1 text-[#76847A] dark:text-[#8F9992]">{t('investments.emptyClosedDesc')}</p>
              </div>
            )}
          </div>
        ) : (
          displayedInvestments.map((inv) => {
            const meta = getAssetTypeMeta(inv.type);
            const Icon = meta.icon;
            const days = calculateDaysDuration(inv.start_date, inv.closed_date);
            const isProfit =
              activeTab === 'active'
                ? (inv.unrealized_pnl || 0) >= 0
                : (inv.realized_pnl || 0) >= 0;
            const pnlNominal =
              activeTab === 'active' ? inv.unrealized_pnl || 0 : inv.realized_pnl || 0;
            const pnlPercent =
              activeTab === 'active'
                ? inv.unrealized_pnl_percent || 0
                : inv.realized_pnl_percent || 0;

            return (
              <div
                key={inv.id}
                className="overflow-hidden rounded-3xl border border-black/[0.04] bg-white dark:border-white/8 dark:bg-[#161D18] p-4.5 sm:p-5.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] hover:border-[#5B7966]/40 dark:hover:border-[#A7D7B5]/40 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left: Asset Info & Badges */}
                  <div className="flex items-start space-x-3.5 min-w-0">
                    <div className={`rounded-2xl p-3 flex-shrink-0 ${meta.colorClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-[#18221B] dark:text-[#F2F5F3] truncate">
                          {inv.name}
                        </h3>
                        {inv.platform && (
                          <span className="rounded-lg bg-black/5 dark:bg-white/5 border border-black/[0.04] dark:border-white/8 px-2 py-0.5 text-[10px] font-semibold text-[#76847A] dark:text-[#8F9992] whitespace-nowrap shrink-0">
                            {inv.platform}
                          </span>
                        )}
                        <span className="rounded-lg bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300 whitespace-nowrap shrink-0">
                          {meta.label}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#76847A] dark:text-[#8F9992]">
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3.5 w-3.5 text-[#76847A] dark:text-[#8F9992]" />
                          <span>
                            {new Date(inv.start_date).toLocaleDateString(dateLocale, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <Clock className="h-3.5 w-3.5 text-[#76847A] dark:text-[#8F9992]" />
                          <span>{t('investments.days', { count: days })}</span>
                        </span>
                        {inv.notes && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-xs italic text-[#76847A]/80 dark:text-[#8F9992]/80">
                              {inv.notes}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle / Right: Capital, Current Value, & PnL */}
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 justify-between lg:justify-end border-t border-black/[0.04] dark:border-white/6 pt-3 lg:border-t-0 lg:pt-0">
                    {/* Capital Invested */}
                    <div>
                      <div className="text-[10px] font-medium text-[#76847A] dark:text-[#8F9992]">
                        {t('investments.initialCapital')}
                      </div>
                      <div className="text-sm font-semibold font-mono tabular-nums text-[#18221B] dark:text-[#C5CDC8]">
                        {formatRupiah(inv.invested_amount)}
                      </div>
                    </div>

                    {/* Current Value or Total Withdrawn */}
                    <div>
                      <div className="text-[10px] font-medium text-[#76847A] dark:text-[#8F9992]">
                        {activeTab === 'active'
                          ? t('investments.currentValue')
                          : t('investments.totalWithdrawn')}
                      </div>
                      <div className="text-base font-bold font-mono tabular-nums text-[#18221B] dark:text-[#F2F5F3]">
                        {formatRupiah(
                          activeTab === 'active' ? inv.current_value : inv.total_withdrawn
                        )}
                      </div>
                    </div>

                    {/* Return / PnL Badge */}
                    <div className="text-right">
                      <div className="text-[10px] font-medium text-[#76847A] dark:text-[#8F9992]">
                        {t('investments.roi')}
                      </div>
                      <div
                        className={`inline-flex items-center space-x-1 text-sm font-bold font-mono tabular-nums whitespace-nowrap shrink-0 ${
                          isProfit
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isProfit ? (
                          <TrendingUp className="h-4 w-4 shrink-0" />
                        ) : (
                          <TrendingDown className="h-4 w-4 shrink-0" />
                        )}
                        <span className="whitespace-nowrap">
                          {isProfit ? '+' : ''}
                          {formatRupiah(pnlNominal)}
                        </span>
                        <span className="text-xs font-semibold whitespace-nowrap">
                          ({isProfit ? '+' : ''}
                          {pnlPercent.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.04] dark:border-white/6 pt-3">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => openHistoryModal(inv)}
                      className="flex items-center space-x-1.5 rounded-xl border border-black/[0.06] bg-[#F6F7F5] dark:border-white/8 dark:bg-[#1A211D] px-3 py-2 min-h-[38px] text-xs font-medium text-[#18221B] dark:text-[#C5CDC8] hover:bg-black/5 dark:hover:bg-[#232B25] transition-colors cursor-pointer"
                    >
                      <History className="h-3.5 w-3.5 text-[#76847A] dark:text-[#8F9992]" />
                      <span>{t('investments.viewHistory')}</span>
                    </button>

                    <button
                      onClick={() => openEditModal(inv)}
                      className="rounded-xl p-2.5 min-h-[38px] min-w-[38px] flex items-center justify-center text-[#76847A] dark:text-[#8F9992] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#18221B] dark:hover:text-[#F2F5F3] transition-colors cursor-pointer"
                      title={t('common.edit')}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => setDeleteTarget(inv)}
                      className="rounded-xl p-2.5 min-h-[38px] min-w-[38px] flex items-center justify-center text-[#76847A] dark:text-[#8F9992] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      title={t('common.delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {activeTab === 'active' && (
                    <div className="flex items-center space-x-2">
                      {/* Update Value */}
                      <button
                        onClick={() => openUpdateValueModal(inv)}
                        className="flex items-center space-x-1.5 rounded-xl border border-black/[0.06] bg-[#F6F7F5] dark:border-white/8 dark:bg-[#1A211D] px-3 py-2 min-h-[38px] text-xs font-semibold text-[#76847A] dark:text-[#8F9992] hover:text-[#18221B] dark:hover:text-[#F2F5F3] hover:bg-black/5 dark:hover:bg-[#232B25] transition-colors cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>{t('investments.updateValue')}</span>
                      </button>

                      {/* Top Up */}
                      <button
                        onClick={() => openTopUpModal(inv)}
                        className="flex items-center space-x-1.5 rounded-xl bg-[#5B7966]/10 text-[#5B7966] hover:bg-[#5B7966]/20 border border-[#5B7966]/20 dark:bg-[#A7D7B5]/15 dark:hover:bg-[#A7D7B5]/25 dark:border-[#A7D7B5]/25 px-3 py-2 min-h-[38px] text-xs font-bold dark:text-[#A7D7B5] transition-colors cursor-pointer"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        <span>{t('investments.topUp')}</span>
                      </button>

                      {/* Withdraw / Tarik Dana */}
                      <button
                        onClick={() => openWithdrawModal(inv)}
                        className="flex items-center space-x-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:border-purple-500/30 px-3 py-2 min-h-[38px] text-xs font-bold dark:text-purple-300 transition-colors cursor-pointer"
                      >
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                        <span>{t('investments.withdraw')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit modal */}
      {isAddModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 dark:bg-black/75 p-0 sm:p-4 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-md rounded-t-[32px] sm:rounded-3xl border-t sm:border border-[#DDE2DE] dark:border-white/10 bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-2xl max-h-[92dvh] sm:max-h-[92vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8E4] dark:border-white/8">
              <h2 className="text-base font-bold text-[#18221B] dark:text-[#F2F5F3]">
                {editingInvestment
                  ? t('investments.editInvestment')
                  : t('investments.addInvestment')}
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-full p-2 text-[#6B7770] dark:text-[#8F9992] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#18221B] dark:hover:text-[#F2F5F3] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 dark:border-rose-500/30 p-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveInvestment} className="mt-4 space-y-4">
              {/* Asset Name */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                  {t('investments.assetName')}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('investments.assetNamePlaceholder')}
                  className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2.5 px-3 text-base sm:text-xs text-[#18221B] dark:text-[#F2F5F3] placeholder-[#8F9992]/60 focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                />
              </div>

              {/* Asset Class & Platform */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                    {t('investments.type')}
                  </label>
                  <SearchableSelect
                    options={[
                      { value: 'mutual_fund', label: t('investments.types.mutual_fund') },
                      { value: 'stock', label: t('investments.types.stock') },
                      { value: 'crypto', label: t('investments.types.crypto') },
                      { value: 'gold', label: t('investments.types.gold') },
                      { value: 'bond', label: t('investments.types.bond') },
                      { value: 'deposit', label: t('investments.types.deposit') },
                      { value: 'other', label: t('investments.types.other') },
                    ]}
                    value={assetType}
                    onChange={(val) => setAssetType(val as InvestmentType)}
                    placeholder={t('investments.type')}
                    searchPlaceholder={t('common.search') || 'Search type...'}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                    {t('investments.platform')}
                  </label>
                  <input
                    type="text"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    placeholder={t('investments.platformPlaceholder')}
                    className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2.5 px-3 text-base sm:text-xs text-[#18221B] dark:text-[#F2F5F3] placeholder-[#8F9992]/60 focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                  />
                </div>
              </div>

              {/* Capital & Current Value */}
              {!editingInvestment ? (
                <div>
                  <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                    {t('investments.initialCapital')}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs font-semibold text-[#6B7770] dark:text-[#8F9992]">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={investedAmount}
                      onChange={(e) => setInvestedAmount(formatInputNumber(e.target.value))}
                      placeholder="500.000"
                      className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2.5 pl-9 pr-3 text-base sm:text-xs font-mono font-bold text-[#18221B] dark:text-[#F2F5F3] placeholder-[#8F9992]/60 focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                      {t('investments.initialCapital')}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs font-semibold text-[#6B7770] dark:text-[#8F9992]">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={investedAmount}
                        onChange={(e) => setInvestedAmount(formatInputNumber(e.target.value))}
                        placeholder="500.000"
                        className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2.5 pl-9 pr-3 text-base sm:text-xs font-mono font-bold text-[#18221B] dark:text-[#F2F5F3] placeholder-[#8F9992]/60 focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                      {t('investments.currentValue')}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs font-semibold text-[#6B7770] dark:text-[#8F9992]">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={currentValue}
                        onChange={(e) => setCurrentValue(formatInputNumber(e.target.value))}
                        placeholder="500.000"
                        className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2.5 pl-9 pr-3 text-base sm:text-xs font-mono font-bold text-[#18221B] dark:text-[#F2F5F3] placeholder-[#8F9992]/60 focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Optional: Deduct from Account */}
              {!editingInvestment && (
                <div>
                  <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                    {t('investments.sourceAccount')}
                  </label>
                  <SearchableSelect
                    options={[
                      { value: '', label: t('investments.noAccountLink') },
                      ...accounts.map((a) => ({
                        value: a.id,
                        label: a.name + (a.pocket_name ? ` (${a.pocket_name})` : ''),
                      })),
                    ]}
                    value={sourceAccountId}
                    onChange={setSourceAccountId}
                    placeholder="Select account..."
                  />
                  <p className="mt-1 text-[11px] text-[#6B7770] dark:text-[#8F9992]">
                    If selected, will automatically record an expense transaction from this account.
                  </p>
                </div>
              )}

              {/* Start Date */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                  {t('investments.startDate')}
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2.5 px-3 text-base sm:text-xs text-[#18221B] dark:text-[#F2F5F3] focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                  {t('investments.notes')}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('investments.notesPlaceholder')}
                  className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2 px-3 text-base sm:text-xs text-[#18221B] dark:text-[#F2F5F3] placeholder-[#8F9992]/60 focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end space-x-2.5 pt-4 border-t border-[#E2E8E4] dark:border-white/8">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="min-h-[44px] rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] px-4 py-2 text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] hover:text-[#18221B] dark:hover:text-[#F2F5F3] hover:border-[#5B7966]/40 dark:hover:border-white/20 transition-all cursor-pointer flex items-center justify-center"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] rounded-2xl bg-[#5B7966] dark:bg-[#A7D7B5] px-5 py-2 text-xs font-bold text-white dark:text-[#0D110F] shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update valuation modal */}
      {valueUpdateTarget && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setValueUpdateTarget(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 dark:bg-black/75 p-0 sm:p-4 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-sm rounded-t-[32px] sm:rounded-3xl border-t sm:border border-[#DDE2DE] dark:border-white/10 bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-2xl pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8E4] dark:border-white/8">
              <div>
                <h2 className="text-base font-bold text-[#18221B] dark:text-[#F2F5F3]">
                  {t('investments.updateValue')}
                </h2>
                <p className="text-xs text-[#6B7770] dark:text-[#8F9992]">{valueUpdateTarget.name}</p>
              </div>
              <button
                onClick={() => setValueUpdateTarget(null)}
                className="rounded-full p-2 text-[#6B7770] dark:text-[#8F9992] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#18221B] dark:hover:text-[#F2F5F3] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveValueUpdate} className="mt-4 space-y-4">
              {/* Previous recorded value */}
              <div className="rounded-2xl bg-[#F6F7F5] dark:bg-[#1A211D] border border-[#E2E8E4] dark:border-white/8 p-3 flex justify-between items-center text-xs">
                <span className="text-[#6B7770] dark:text-[#8F9992]">Current Value:</span>
                <span className="font-bold font-mono tabular-nums text-[#18221B] dark:text-[#F2F5F3]">
                  {formatRupiah(valueUpdateTarget.current_value)}
                </span>
              </div>

              {/* New Nominal Value */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                  {t('investments.newCurrentValue')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs font-semibold text-[#6B7770] dark:text-[#8F9992]">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={newValueInput}
                    onChange={(e) => setNewValueInput(formatInputNumber(e.target.value))}
                    placeholder="1.050.000"
                    className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2.5 pl-9 pr-3 text-base sm:text-xs font-mono font-bold text-[#18221B] dark:text-[#F2F5F3] placeholder-[#8F9992]/60 focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                  />
                </div>
              </div>

              {/* Change Preview */}
              {newValueInput && (
                <div className="text-xs flex items-center justify-between text-[#6B7770] dark:text-[#8F9992]">
                  <span>Delta:</span>
                  <span
                    className={`font-semibold font-mono tabular-nums ${
                      (parseInputNumber(newValueInput) || 0) >= valueUpdateTarget.current_value
                        ? 'text-emerald-500 dark:text-emerald-400'
                        : 'text-rose-500 dark:text-rose-400'
                    }`}
                  >
                    {(parseInputNumber(newValueInput) || 0) >= valueUpdateTarget.current_value ? '+' : ''}
                    {formatRupiah(
                      (parseInputNumber(newValueInput) || 0) - valueUpdateTarget.current_value
                    )}
                  </span>
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                  {t('common.date')}
                </label>
                <input
                  type="date"
                  required
                  value={valueUpdateDate}
                  onChange={(e) => setValueUpdateDate(e.target.value)}
                  className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2.5 px-3 text-base sm:text-xs text-[#18221B] dark:text-[#F2F5F3] focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                />
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                  {t('common.notes')}
                </label>
                <input
                  type="text"
                  value={valueUpdateNotes}
                  onChange={(e) => setValueUpdateNotes(e.target.value)}
                  placeholder="e.g., Weekly NAV update, monthly valuation"
                  className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2.5 px-3 text-base sm:text-xs text-[#18221B] dark:text-[#F2F5F3] placeholder-[#8F9992]/60 focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end space-x-2.5 pt-4 border-t border-[#E2E8E4] dark:border-white/8">
                <button
                  type="button"
                  onClick={() => setValueUpdateTarget(null)}
                  className="min-h-[44px] rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] px-4 py-2 text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] hover:text-[#18221B] dark:hover:text-[#F2F5F3] hover:border-[#5B7966]/40 dark:hover:border-white/20 transition-all cursor-pointer flex items-center justify-center"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] rounded-2xl bg-[#5B7966] dark:bg-[#A7D7B5] px-5 py-2 text-xs font-bold text-white dark:text-[#0D110F] shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top up capital modal */}
      {topUpTarget && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setTopUpTarget(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 dark:bg-black/75 p-0 sm:p-4 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-sm rounded-t-[32px] sm:rounded-3xl border-t sm:border border-[#DDE2DE] dark:border-white/10 bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-2xl pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8E4] dark:border-white/8">
              <div>
                <h2 className="text-base font-bold text-[#18221B] dark:text-[#F2F5F3]">
                  {t('investments.topUp')}
                </h2>
                <p className="text-xs text-[#6B7770] dark:text-[#8F9992]">{topUpTarget.name}</p>
              </div>
              <button
                onClick={() => setTopUpTarget(null)}
                className="rounded-full p-2 text-[#6B7770] dark:text-[#8F9992] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#18221B] dark:hover:text-[#F2F5F3] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTopUp} className="mt-4 space-y-4">
              {/* Top Up Amount */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                  {t('investments.topUpAmount')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs font-semibold text-[#6B7770] dark:text-[#8F9992]">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={topUpAmountInput}
                    onChange={(e) => setTopUpAmountInput(formatInputNumber(e.target.value))}
                    placeholder="500.000"
                    className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2.5 pl-9 pr-3 text-base sm:text-xs font-mono font-bold text-[#18221B] dark:text-[#F2F5F3] placeholder-[#8F9992]/60 focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                  />
                </div>
              </div>

              {/* Deduct from account */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                  {t('investments.sourceAccount')}
                </label>
                <SearchableSelect
                  options={[
                    { value: '', label: t('investments.noAccountLink') },
                    ...accounts.map((a) => ({
                      value: a.id,
                      label: a.name + (a.pocket_name ? ` (${a.pocket_name})` : ''),
                    })),
                  ]}
                  value={topUpSourceAccountId}
                  onChange={setTopUpSourceAccountId}
                  placeholder="Select source wallet..."
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                  {t('common.date')}
                </label>
                <input
                  type="date"
                  required
                  value={topUpDate}
                  onChange={(e) => setTopUpDate(e.target.value)}
                  className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2.5 px-3 text-base sm:text-xs text-[#18221B] dark:text-[#F2F5F3] focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                  {t('common.notes')}
                </label>
                <input
                  type="text"
                  value={topUpNotes}
                  onChange={(e) => setTopUpNotes(e.target.value)}
                  placeholder="e.g., DCA Monthly contribution"
                  className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2.5 px-3 text-base sm:text-xs text-[#18221B] dark:text-[#F2F5F3] placeholder-[#8F9992]/60 focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end space-x-2.5 pt-4 border-t border-[#E2E8E4] dark:border-white/8">
                <button
                  type="button"
                  onClick={() => setTopUpTarget(null)}
                  className="min-h-[44px] rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] px-4 py-2 text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] hover:text-[#18221B] dark:hover:text-[#F2F5F3] hover:border-[#5B7966]/40 dark:hover:border-white/20 transition-all cursor-pointer flex items-center justify-center"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] rounded-2xl bg-[#5B7966] dark:bg-[#A7D7B5] px-5 py-2 text-xs font-bold text-white dark:text-[#0D110F] shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? t('common.loading') : t('investments.topUp')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw capital modal */}
      {withdrawTarget && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setWithdrawTarget(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 dark:bg-black/75 p-0 sm:p-4 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-sm rounded-t-[32px] sm:rounded-3xl border-t sm:border border-[#DDE2DE] dark:border-white/10 bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-2xl pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8E4] dark:border-white/8">
              <div>
                <h2 className="text-base font-bold text-[#18221B] dark:text-[#F2F5F3]">
                  {t('investments.withdraw')}
                </h2>
                <p className="text-xs text-[#6B7770] dark:text-[#8F9992]">{withdrawTarget.name}</p>
              </div>
              <button
                onClick={() => setWithdrawTarget(null)}
                className="rounded-full p-2 text-[#6B7770] dark:text-[#8F9992] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#18221B] dark:hover:text-[#F2F5F3] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWithdraw} className="mt-4 space-y-4">
              {/* Max available */}
              <div className="rounded-2xl bg-[#F6F7F5] dark:bg-[#1A211D] border border-[#E2E8E4] dark:border-white/8 p-3 flex justify-between items-center text-xs">
                <span className="text-[#6B7770] dark:text-[#8F9992]">Available Balance:</span>
                <span className="font-bold font-mono tabular-nums text-purple-600 dark:text-purple-400">
                  {formatRupiah(withdrawTarget.current_value)}
                </span>
              </div>

              {/* Withdraw Amount */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#6B7770] dark:text-[#8F9992]">
                    {t('investments.withdrawAmount')}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawAmountInput(formatInputNumber(String(withdrawTarget.current_value)));
                      setIsFullRedemption(true);
                    }}
                    className="text-[11px] font-bold text-[#5B7966] dark:text-[#A7D7B5] hover:underline cursor-pointer"
                  >
                    Withdraw All
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs font-semibold text-[#6B7770] dark:text-[#8F9992]">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={withdrawAmountInput}
                    onChange={(e) => {
                      const val = formatInputNumber(e.target.value);
                      setWithdrawAmountInput(val);
                      if (parseInputNumber(val) >= withdrawTarget.current_value) {
                        setIsFullRedemption(true);
                      }
                    }}
                    placeholder="1.000.000"
                    className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2.5 pl-9 pr-3 text-base sm:text-xs font-mono font-bold text-[#18221B] dark:text-[#F2F5F3] placeholder-[#8F9992]/60 focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                  />
                </div>
              </div>

              {/* Mark as Closed Checkbox */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="closeAssetCheck"
                  checked={isFullRedemption}
                  onChange={(e) => setIsFullRedemption(e.target.checked)}
                  className="h-4 w-4 rounded border-[#DDE2DE] dark:border-white/20 bg-[#F6F7F5] dark:bg-[#1A211D] text-[#5B7966] dark:text-[#A7D7B5] focus:ring-[#5B7966]"
                />
                <label
                  htmlFor="closeAssetCheck"
                  className="text-xs text-[#6B7770] dark:text-[#8F9992] select-none cursor-pointer"
                >
                  {t('investments.closeAssetCheck')}
                </label>
              </div>

              {/* Deposit Into Account */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                  {t('investments.destinationAccount')}
                </label>
                <SearchableSelect
                  options={[
                    { value: '', label: t('investments.noAccountLink') },
                    ...accounts.map((a) => ({
                      value: a.id,
                      label: a.name + (a.pocket_name ? ` (${a.pocket_name})` : ''),
                    })),
                  ]}
                  value={withdrawDestAccountId}
                  onChange={setWithdrawDestAccountId}
                  placeholder="Select destination wallet..."
                />
                <p className="mt-1 text-[11px] text-[#6B7770] dark:text-[#8F9992]">
                  If selected, an income transaction will be recorded in this account.
                </p>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                  {t('investments.closedDate')}
                </label>
                <input
                  type="date"
                  required
                  value={withdrawDate}
                  onChange={(e) => setWithdrawDate(e.target.value)}
                  className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2.5 px-3 text-base sm:text-xs text-[#18221B] dark:text-[#F2F5F3] focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] mb-1.5">
                  {t('common.notes')}
                </label>
                <input
                  type="text"
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  placeholder="e.g., Profit taking, switched to new fund"
                  className="w-full rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] py-2.5 px-3 text-base sm:text-xs text-[#18221B] dark:text-[#F2F5F3] placeholder-[#8F9992]/60 focus:border-[#5B7966] dark:focus:border-[#A7D7B5] focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end space-x-2.5 pt-4 border-t border-[#E2E8E4] dark:border-white/8">
                <button
                  type="button"
                  onClick={() => setWithdrawTarget(null)}
                  className="min-h-[44px] rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] px-4 py-2 text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] hover:text-[#18221B] dark:hover:text-[#F2F5F3] hover:border-[#5B7966]/40 dark:hover:border-white/20 transition-all cursor-pointer flex items-center justify-center"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] rounded-2xl bg-[#5B7966] dark:bg-[#A7D7B5] px-5 py-2 text-xs font-bold text-white dark:text-[#0D110F] shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? t('common.loading') : t('investments.withdraw')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History and valuation chart modal */}
      {historyTarget && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistoryTarget(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 dark:bg-black/75 p-0 sm:p-4 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-lg rounded-t-[32px] sm:rounded-3xl border-t sm:border border-[#DDE2DE] dark:border-white/10 bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-2xl max-h-[92dvh] sm:max-h-[92vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8E4] dark:border-white/8">
              <div>
                <h2 className="text-base font-bold text-[#18221B] dark:text-[#F2F5F3]">
                  {t('investments.historyModalTitle', { name: historyTarget.name })}
                </h2>
                <p className="text-xs text-[#6B7770] dark:text-[#8F9992]">
                  {t('investments.historyModalSubtitle', {
                    date: new Date(historyTarget.start_date).toLocaleDateString(dateLocale, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    }),
                    capital: formatRupiah(historyTarget.invested_amount),
                  })}
                </p>
              </div>
              <button
                onClick={() => setHistoryTarget(null)}
                className="rounded-full p-2 text-[#6B7770] dark:text-[#8F9992] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#18221B] dark:hover:text-[#F2F5F3] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Trajectory Visual Chart */}
            {targetLogs.length >= 2 ? (
              <div className="mt-4 rounded-2xl border border-[#E2E8E4] dark:border-white/8 bg-[#F6F7F5] dark:bg-[#1A211D] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7770] dark:text-[#8F9992] mb-2">
                  Portfolio Valuation Trajectory
                </div>
                <div className="h-28 w-full flex items-end space-x-2 pt-2">
                  {(() => {
                    const values = targetLogs.map((l) => Number(l.value));
                    const maxVal = Math.max(...values, Number(historyTarget.invested_amount), 1);
                    return targetLogs.map((log, idx) => {
                      const heightPercent = Math.max(12, Math.round((Number(log.value) / maxVal) * 100));
                      const isUp =
                        idx === 0
                          ? true
                          : Number(log.value) >= Number(targetLogs[idx - 1].value);

                      return (
                        <div key={log.id} className="flex-1 flex flex-col items-center group relative">
                          {/* Tooltip on hover */}
                          <div className="absolute -top-10 hidden group-hover:flex flex-col items-center bg-[#18221B] dark:bg-[#0D110F] border border-black/10 dark:border-white/15 text-white dark:text-[#F2F5F3] text-[10px] rounded-lg px-2 py-1 whitespace-nowrap z-10 shadow-sm pointer-events-none">
                            <span className="font-mono tabular-nums font-bold">{formatRupiah(log.value)}</span>
                            <span className="text-[#8F9992] text-[9px]">{log.date}</span>
                          </div>

                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-t-md transition-all ${
                              isUp
                                ? 'bg-emerald-500 hover:bg-emerald-400'
                                : 'bg-rose-500 hover:bg-rose-400'
                            }`}
                          />
                          <span className="text-[9px] text-[#6B7770] dark:text-[#8F9992] mt-1 truncate max-w-full font-mono">
                            {log.date.slice(5)}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : null}

            {/* Chronological Event Log Timeline */}
            <div className="mt-5 space-y-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7770] dark:text-[#8F9992]">
                Activity & Valuation Logs ({targetLogs.length})
              </div>

              {targetLogs.length === 0 ? (
                <p className="text-xs text-[#6B7770] dark:text-[#8F9992] py-4 text-center">
                  No valuation entries recorded yet.
                </p>
              ) : (
                targetLogs.map((log) => {
                  let badge = {
                    label: t('investments.logUpdateValue'),
                    color: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
                  };
                  if (log.type === 'initial') {
                    badge = {
                      label: t('investments.logInitial'),
                      color: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
                    };
                  } else if (log.type === 'top_up') {
                    badge = {
                      label: t('investments.logTopUp'),
                      color: 'bg-[#5B7966]/15 text-[#5B7966] dark:bg-[#A7D7B5]/15 dark:text-[#A7D7B5]',
                    };
                  } else if (log.type === 'withdraw') {
                    badge = {
                      label: t('investments.logWithdraw'),
                      color: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400',
                    };
                  }

                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 rounded-2xl border border-[#E2E8E4] dark:border-white/8 bg-[#F6F7F5] dark:bg-[#1A211D] text-xs"
                    >
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${badge.color}`}>
                          {badge.label}
                        </span>
                        <div>
                          <div className="font-bold font-mono tabular-nums text-[#18221B] dark:text-[#F2F5F3]">
                            {formatRupiah(log.value)}
                          </div>
                          <div className="text-[11px] text-[#6B7770] dark:text-[#8F9992] flex items-center space-x-2">
                            <span>{log.date}</span>
                            {log.notes && <span>• {log.notes}</span>}
                          </div>
                        </div>
                      </div>

                      {log.amount > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] text-[#6B7770] dark:text-[#8F9992] block">Cashflow</span>
                          <span className="font-bold font-mono tabular-nums text-[#18221B] dark:text-[#F2F5F3]">
                            {log.type === 'withdraw' ? '-' : '+'}
                            {formatRupiah(log.amount)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-6 flex justify-end pt-4 border-t border-[#E2E8E4] dark:border-white/8">
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                className="min-h-[44px] rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] px-5 py-2 text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] hover:text-[#18221B] dark:hover:text-[#F2F5F3] hover:border-[#5B7966]/40 dark:hover:border-white/20 transition-all cursor-pointer flex items-center justify-center"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 dark:bg-black/75 p-0 sm:p-4 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-sm rounded-t-[32px] sm:rounded-3xl border-t sm:border border-[#DDE2DE] dark:border-white/10 bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-2xl pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <h3 className="text-base font-bold text-[#18221B] dark:text-[#F2F5F3]">
              {t('investments.confirmDeleteTitle')}
            </h3>
            <p className="mt-2 text-xs text-[#6B7770] dark:text-[#8F9992]">
              {t('investments.confirmDeleteDesc', { name: deleteTarget.name })}
            </p>

            <div className="mt-6 flex justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-[44px] rounded-2xl border border-[#DDE2DE] dark:border-white/10 bg-[#F6F7F5] dark:bg-[#1A211D] px-4 py-2 text-xs font-semibold text-[#6B7770] dark:text-[#8F9992] hover:text-[#18221B] dark:hover:text-[#F2F5F3] hover:border-[#5B7966]/40 dark:hover:border-white/20 transition-all cursor-pointer flex items-center justify-center"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteInvestment}
                className="min-h-[44px] rounded-2xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center"
              >
                {isSubmitting ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
