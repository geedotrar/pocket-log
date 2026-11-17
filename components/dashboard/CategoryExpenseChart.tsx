'use client';

import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CategorySpending } from '@/lib/types';
import { formatRupiah } from '@/lib/calculations';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useTheme } from '@/lib/theme/ThemeContext';

export interface AccountSpendingItem {
  accountId: string;
  accountName: string;
  color: string;
  total: number;
  percentage: number;
  count: number;
}

interface CategoryExpenseChartProps {
  data: CategorySpending[];
  accountData?: AccountSpendingItem[];
}

export default function CategoryExpenseChart({ data, accountData = [] }: CategoryExpenseChartProps) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [viewMode, setViewMode] = useState<'category' | 'account'>('category');

  const activeData = viewMode === 'category'
    ? data.slice(0, 6).map((item) => ({
        name: item.categoryName,
        value: item.total,
        color: item.color,
        percentage: item.percentage,
      }))
    : accountData.slice(0, 6).map((item) => ({
        name: item.accountName,
        value: item.total,
        color: item.color,
        percentage: item.percentage,
      }));

  if (activeData.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-3xl border border-white/8 bg-[#161C18] p-6 text-center text-[#8F9992]">
        <p className="text-xs">{t('dashboard.noExpenseData') || 'No expenses recorded in this period.'}</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/8 bg-[#161C18] p-5 sm:p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-[#F2F5F3] tracking-tight">
            {viewMode === 'category'
              ? 'Expense Breakdown by Category'
              : 'Expense Breakdown by Account'}
          </h3>
          <span className="text-xs text-[#8F9992]">
            Cost distribution for the active period
          </span>
        </div>

        {accountData.length > 0 && (
          <div className="flex rounded-2xl bg-[#1A211D] p-1 border border-white/8">
            <button
              type="button"
              onClick={() => setViewMode('category')}
              className={`rounded-xl px-3 py-1 text-xs font-semibold transition-all ${
                viewMode === 'category'
                  ? 'bg-[#A7D7B5] text-[#0C2417] shadow-xs'
                  : 'text-[#8F9992] hover:text-[#F2F5F3]'
              }`}
            >
              Category
            </button>
            <button
              type="button"
              onClick={() => setViewMode('account')}
              className={`rounded-xl px-3 py-1 text-xs font-semibold transition-all ${
                viewMode === 'account'
                  ? 'bg-[#A7D7B5] text-[#0C2417] shadow-xs'
                  : 'text-[#8F9992] hover:text-[#F2F5F3]'
              }`}
            >
              Account
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-12">
        <div className="h-64 w-full md:col-span-5">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={activeData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={4}
                dataKey="value"
              >
                {activeData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke={isDark ? '#161C18' : '#FFFFFF'}
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: unknown, name: unknown) => [formatRupiah(Number(value)), String(name)]}
                contentStyle={{
                  backgroundColor: isDark ? '#161C18' : '#FFFFFF',
                  borderRadius: '16px',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#F2F5F3' : '#141916',
                  fontSize: '12px',
                  padding: '8px 12px',
                  boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Breakdown pill list */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:col-span-7">
          {activeData.map((c) => (
            <div
              key={c.name}
              className="flex flex-col justify-center rounded-2xl border border-white/6 bg-[#1A211D] p-3 transition-colors hover:bg-[#202823]"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 truncate pr-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="truncate font-medium text-[#F2F5F3]">{c.name}</span>
                </div>
                <span className="font-bold text-[#F2F5F3] shrink-0 tabular-nums">
                  {formatRupiah(c.value)}
                </span>
              </div>
              <div className="mt-2 flex items-center space-x-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, c.percentage)}%`, backgroundColor: c.color }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-[#8F9992] shrink-0 min-w-[36px] text-right tabular-nums">
                  {c.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
