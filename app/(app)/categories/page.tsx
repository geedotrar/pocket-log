'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Tags,
  Plus,
  Edit2,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Search,
} from 'lucide-react';
import { useFinanceData } from '@/lib/data/DataContext';
import { Category } from '@/lib/types';
import { formatRupiah } from '@/lib/calculations';

import { APP_COLOR_PALETTE } from '@/lib/constants';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function CategoriesPage() {
  const { categories, transactions, addCategory, updateCategory, deleteCategory } = useFinanceData();
  const { t, locale } = useLanguage();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(APP_COLOR_PALETTE[11]); // Emerald / Red
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  const expenseCategories = useMemo(() => {
    return categories.filter((c) => c.type === 'expense');
  }, [categories]);

  // Transaction count & spending map per category
  const { txCountMap, totalSpentMap } = useMemo(() => {
    const countMap = new Map<string, number>();
    const spentMap = new Map<string, number>();
    for (const t of transactions) {
      if (t.category_id) {
        countMap.set(t.category_id, (countMap.get(t.category_id) ?? 0) + 1);
        if (t.type === 'expense') {
          spentMap.set(t.category_id, (spentMap.get(t.category_id) ?? 0) + t.amount);
        }
      }
    }
    return { txCountMap: countMap, totalSpentMap: spentMap };
  }, [transactions]);

  // Filtered categories by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return expenseCategories;
    const q = searchQuery.toLowerCase().trim();
    return expenseCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [expenseCategories, searchQuery]);

  // Close modals on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) setIsModalOpen(false);
        if (deleteTarget) setDeleteTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, deleteTarget]);

  const openAddModal = () => {
    setEditingCategory(null);
    setName('');
    setColor('#EF4444');
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setColor(cat.color || '#3b82f6');
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    if (!name.trim()) {
      setError('Category name cannot be empty.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: name.trim(),
          color,
        });
      } else {
        await addCategory({
          name: name.trim(),
          type: 'expense',
          color,
          is_default: false,
        });
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save category.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteCategory(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  // Top spending category
  const topCategory = useMemo<{ name: string; amount: number } | null>(() => {
    let topCat: { name: string; amount: number } | null = null;
    totalSpentMap.forEach((amount, catId) => {
      if (!topCat || amount > topCat.amount) {
        const cat = categories.find((c) => c.id === catId);
        if (cat) topCat = { name: cat.name, amount };
      }
    });
    return topCat;
  }, [totalSpentMap, categories]);

  const totalAllSpent = useMemo(() => {
    let sum = 0;
    totalSpentMap.forEach((amt) => { sum += amt; });
    return sum;
  }, [totalSpentMap]);

  return (
    <div className="space-y-4 sm:space-y-5 pb-24 lg:pb-12">
      {/* Category metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
        {/* Total categories */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between lg:col-span-3">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
              Total Categories
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1] tabular-nums mt-1">
              {expenseCategories.length}
            </div>
            <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94]">
              Active expense categories
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#E5EFE8] dark:bg-[#1E2B22] text-[#4D6A58] dark:text-[#A7D7B5] flex items-center justify-center">
            <Tags className="h-5 w-5" />
          </div>
        </div>

        {/* Highest expense category */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between lg:col-span-3">
          <div className="min-w-0 pr-2">
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
              Highest Expense
            </span>
            <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1] truncate mt-1">
              {topCategory ? topCategory.name : '-'}
            </div>
            <span className="text-[10px] font-bold text-[#C62828] dark:text-[#FB7185] tabular-nums whitespace-nowrap block">
              {topCategory ? formatRupiah(topCategory.amount) : 'Rp 0'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FFEBEE] dark:bg-[#2C1C1D] text-[#C62828] dark:text-[#FB7185] flex items-center justify-center shrink-0">
            <TrendingDown className="h-5 w-5" />
          </div>
        </div>

        {/* Total category spending */}
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between lg:col-span-3">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">
              Total Category Spending
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1] tabular-nums mt-1 whitespace-nowrap overflow-x-auto no-scrollbar">
              {formatRupiah(totalAllSpent)}
            </div>
            <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94]">
              All-time accumulated spending
            </span>
          </div>
          <div className="flex items-end space-x-1.5 h-10 px-2">
            <span className="w-1.5 h-5 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-8 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
            <span className="w-1.5 h-10 rounded-full bg-[#5E7A68] dark:bg-[#A7D7B5]" />
          </div>
        </div>

        {/* Action card */}
        <div className="rounded-[28px] bg-[#5B7966] dark:bg-[#3E5747] text-white p-5 shadow-[0_10px_30px_rgba(91,121,102,0.25)] flex items-center justify-between lg:col-span-3">
          <div>
            <span className="text-xs font-semibold text-white/80 block">
              Budget Categories
            </span>
            <div className="text-base font-bold mt-1">
              Add New Category
            </div>
            <span className="text-[10px] text-white/70">
              Create spending category
            </span>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="rounded-full bg-white text-[#4D6A58] p-2.5 shadow-sm hover:scale-105 active:scale-95 transition-transform"
            title="Add Category"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-[28px] border border-black/[0.04] bg-white p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] dark:border-white/[0.06] dark:bg-[#161D18]">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#76847A] dark:text-[#8E9E94]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('categories.searchPlaceholder')}
            className="w-full rounded-2xl border border-black/[0.04] bg-[#F6F7F5] py-2 pl-9.5 pr-9 text-base sm:text-xs text-[#18221B] placeholder-[#8E9B92] focus:outline-none dark:border-white/[0.06] dark:bg-[#1F2822] dark:text-[#F0F4F1] dark:placeholder-[#8E9E94]/60 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#76847A] hover:bg-black/5 dark:hover:bg-white/10 rounded-full"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="rounded-2xl border border-rose-200 bg-rose-50/70 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 transition-colors"
              title="Reset search filter"
            >
              {t('common.reset')}
            </button>
          )}
          <span className="text-[11px] font-semibold text-[#76847A] dark:text-[#8E9E94] px-1">
            {searchQuery
              ? `${filteredCategories.length} of ${expenseCategories.length} Categories`
              : `${expenseCategories.length} Categories`}
          </span>
        </div>
      </div>

      {/* Categories Grid or Empty State */}
      {filteredCategories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-white/8 dark:bg-[#161C18]">
          <Search className="h-10 w-10 text-slate-300 dark:text-[#8F9992]/40 mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-[#F2F5F3]">
            {t('categories.noCategoriesFound')}
          </h3>
          <p className="text-xs text-slate-400 dark:text-[#8F9992] mt-1 max-w-sm">
            {searchQuery
              ? t('categories.noMatchDesc', { query: searchQuery })
              : t('categories.noCatDesc')}
          </p>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-4 rounded-2xl border border-white/10 bg-[#232B25] px-4 py-2 text-xs font-semibold text-[#A7D7B5] hover:bg-[#2C372F] transition-colors"
            >
              {t('categories.clearSearch')}
            </button>
          ) : (
            <button
              type="button"
              onClick={openAddModal}
              className="mt-4 rounded-2xl bg-[#5B7966] hover:bg-[#4D6A58] dark:bg-[#A7D7B5] dark:hover:bg-[#95D5B2] px-4 py-2.5 text-xs font-bold text-white dark:text-[#0C2417] shadow-sm transition-all"
            >
              {t('categories.addNew')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCategories.map((cat) => {
            const count = txCountMap.get(cat.id) ?? 0;
            const spent = totalSpentMap.get(cat.id) ?? 0;

            return (
              <div
                key={cat.id}
                className="group flex flex-col justify-between rounded-[28px] border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 truncate">
                    <span
                      className="h-4 w-4 rounded-full flex-shrink-0 shadow-xs"
                      style={{ backgroundColor: cat.color || '#5B7966' }}
                    />
                    <span className="font-bold text-xs text-[#18221B] dark:text-[#F0F4F1] truncate">
                      {cat.name}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEditModal(cat)}
                      className="rounded-xl p-1.5 text-[#76847A] hover:bg-black/5 hover:text-[#18221B] dark:hover:bg-white/5 dark:hover:text-[#F0F4F1] transition-colors"
                      title="Edit category name/color"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(cat)}
                      className="rounded-xl p-1.5 text-[#76847A] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors"
                      title="Delete category"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-[11px] text-[#76847A] dark:text-[#8E9E94]">
                  <span>{count > 0 ? t('categories.txCount', { count }) : t('categories.noTx')}</span>
                  {spent > 0 && (
                    <span className="font-bold tabular-nums text-[#C62828] dark:text-[#FB7185]">
                      {formatRupiah(spent)}
                    </span>
                  )}
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
          <div className="w-full sm:max-w-sm rounded-t-[32px] sm:rounded-3xl border-t sm:border border-black/[0.06] bg-white p-5 sm:p-6 shadow-2xl text-[#18221B] dark:border-white/10 dark:bg-[#161D18] dark:text-[#F2F5F3] max-h-[92dvh] sm:max-h-[92vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/8">
              <h2 className="text-base font-bold text-[#18221B] dark:text-[#F2F5F3]">
                {editingCategory ? t('categories.editTitle') : t('categories.addNewTitle')}
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
                  {t('categories.categoryName')}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('categories.namePlaceholder')}
                  className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] py-2.5 px-3.5 text-base sm:text-xs text-[#18221B] placeholder-[#8E9B92] focus:border-[#5B7966] focus:outline-none dark:border-white/10 dark:bg-[#1A211D] dark:text-[#F2F5F3] dark:placeholder-[#8F9992]/60 dark:focus:border-[#A7D7B5]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#76847A] dark:text-[#C5CDC8]">
                    {t('categories.colorChoices')}
                  </label>
                  <span
                    className="h-4 w-4 rounded-full ring-2 ring-black/10 dark:ring-white/20 shadow-xs"
                    style={{ backgroundColor: color }}
                  />
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5 sm:gap-2 p-2.5 rounded-2xl bg-[#F6F7F5] border border-black/[0.06] dark:bg-[#1A211D] dark:border-white/8 justify-items-center">
                  {APP_COLOR_PALETTE.map((c) => (
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
                  {isSubmitting ? t('common.loading') : editingCategory ? t('common.saveChanges') : t('categories.saveBtn')}
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
              {t('categories.deleteConfirmTitle')}
            </h3>
            <p className="mt-2 text-xs text-[#76847A] dark:text-[#8F9992] leading-relaxed">
              {t('categories.deleteConfirmText', { name: deleteTarget.name })}
              {(txCountMap.get(deleteTarget.id) ?? 0) > 0 && (
                <span className="block mt-1.5 text-amber-500 dark:text-amber-400 font-medium">
                  {t('categories.catInUseWarning', { count: txCountMap.get(deleteTarget.id) || 0 })}
                </span>
              )}
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
    </div>
  );
}
