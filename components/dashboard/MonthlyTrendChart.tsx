'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { MonthlyComparison } from '@/lib/types';
import { formatRupiah } from '@/lib/calculations';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useTheme } from '@/lib/theme/ThemeContext';

interface MonthlyTrendChartProps {
  data: MonthlyComparison[];
}

export default function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const incomeLabel = t('dashboard.income') || 'Income';
  const expenseLabel = t('dashboard.expense') || 'Expense';

  const formattedData = data.map((d) => ({
    ...d,
    [incomeLabel]: d.income,
    [expenseLabel]: d.expense,
  }));

  return (
    <div className="rounded-3xl border border-white/8 bg-[#161C18] p-5 sm:p-6 shadow-sm flex flex-col justify-between h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-[#F2F5F3] tracking-tight">
            {t('dashboard.monthlyComparisonTrend') || 'Income vs Expense Trend'}
          </h3>
          <span className="text-xs text-[#8F9992]">
            {t('dashboard.last12Months') || 'Last 12 Months'}
          </span>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="monthLabel"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: isDark ? '#8F9992' : '#526056' }}
              interval="preserveStartEnd"
              tickFormatter={(v: string) => v.split(' ')[0]}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: isDark ? '#8F9992' : '#526056' }}
              tickFormatter={(v: number) => {
                if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                return String(v);
              }}
            />
            <Tooltip
              formatter={(val: unknown) => [formatRupiah(Number(val)), '']}
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
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
            />
            <Bar dataKey={incomeLabel} fill="#34D399" radius={[6, 6, 0, 0]} maxBarSize={24} />
            <Bar dataKey={expenseLabel} fill="#FB7185" radius={[6, 6, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
