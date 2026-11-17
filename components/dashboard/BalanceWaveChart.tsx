'use client';

import React from 'react';
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import { formatRupiah } from '@/lib/calculations';
import { useTheme } from '@/lib/theme/ThemeContext';

interface BalanceWavePoint {
  day: string;
  balance: number;
}

interface BalanceWaveChartProps {
  data?: BalanceWavePoint[];
  className?: string;
}

export default function BalanceWaveChart({ data, className = 'h-24 w-full' }: BalanceWaveChartProps) {
  const { isDark } = useTheme();

  // Smooth mock curve if insufficient data points
  const points = data && data.length >= 7 ? data : [
    { day: 'Sen', balance: 48000000 },
    { day: 'Sel', balance: 51200000 },
    { day: 'Rab', balance: 49800000 },
    { day: 'Kam', balance: 53500000 },
    { day: 'Jum', balance: 50400000 },
    { day: 'Sab', balance: 54100000 },
    { day: 'Min', balance: 52422000 },
  ];

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceWaveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5E7A68" stopOpacity={isDark ? 0.35 : 0.22} />
              <stop offset="100%" stopColor="#5E7A68" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <Tooltip
            formatter={(value: unknown) => [formatRupiah(Number(value)), 'Balance']}
            labelFormatter={(label) => `Day: ${label}`}
            contentStyle={{
              backgroundColor: isDark ? '#161D18' : '#FFFFFF',
              borderRadius: '16px',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
              color: isDark ? '#F0F4F1' : '#18221B',
              fontSize: '11px',
              padding: '6px 10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#5E7A68"
            strokeWidth={2.5}
            fill="url(#balanceWaveGrad)"
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
