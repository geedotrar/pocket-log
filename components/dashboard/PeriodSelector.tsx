'use client';

import React from 'react';
import { PeriodType } from '@/lib/types';
import { Calendar } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface PeriodSelectorProps {
  period: PeriodType;
  onChangePeriod: (period: PeriodType) => void;
  startDate?: string;
  endDate?: string;
  onChangeCustomDates?: (start: string, end: string) => void;
}

export default function PeriodSelector({
  period,
  onChangePeriod,
  startDate,
  endDate,
  onChangeCustomDates,
}: PeriodSelectorProps) {
  const { t } = useLanguage();

  const options: { value: PeriodType; label: string }[] = [
    { value: 'current_cycle', label: t('periods.currentCycle') || 'Current Cycle' },
    { value: 'this_week', label: t('periods.thisWeek') || 'This Week' },
    { value: 'this_month', label: t('periods.thisMonth') || 'This Month' },
    { value: 'this_year', label: t('periods.thisYear') || 'This Year' },
    { value: 'custom', label: t('periods.custom') || 'Custom' },
  ];

  return (
    <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
      {/* Segmented control pills */}
      <div className="flex items-center overflow-x-auto max-w-full rounded-2xl bg-[#1A211D] p-1 border border-white/8 shadow-inner no-scrollbar">
        {options.map((opt) => {
          const isActive = period === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChangePeriod(opt.value)}
              className={`whitespace-nowrap shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#A7D7B5] text-[#0C2417] font-semibold shadow-xs'
                  : 'text-[#8F9992] hover:text-[#F2F5F3] hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Custom date range input */}
      {period === 'custom' && (
        <div className="flex items-center space-x-2 rounded-xl border border-white/10 bg-[#161C18] px-3 py-1.5 shadow-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <Calendar className="h-3.5 w-3.5 text-[#A7D7B5] shrink-0" />
          <input
            type="date"
            value={startDate || ''}
            onChange={(e) => onChangeCustomDates?.(e.target.value, endDate || '')}
            className="text-xs bg-transparent text-[#F2F5F3] focus:outline-none cursor-pointer"
          />
          <span className="text-xs font-medium text-[#8F9992]">to</span>
          <input
            type="date"
            value={endDate || ''}
            onChange={(e) => onChangeCustomDates?.(startDate || '', e.target.value)}
            className="text-xs bg-transparent text-[#F2F5F3] focus:outline-none cursor-pointer"
          />
        </div>
      )}
    </div>
  );
}
