import React from 'react';

interface BudgetGaugeProps {
  percentage: number;
  className?: string;
  size?: number;
  strokeWidth?: number;
}

export default function BudgetGauge({
  percentage,
  className = '',
  size = 140,
  strokeWidth = 14,
}: BudgetGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  
  // Calculate SVG arc parameters for a 180-degree semi-circle
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // Half-circle perimeter
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size / 2 + strokeWidth}
        viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}
        className="overflow-visible"
      >
        {/* Background track arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-black/5 dark:text-white/10"
        />

        {/* Active progress arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke={clamped > 90 ? '#FB7185' : clamped > 75 ? '#FBBF24' : '#5E7A68'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>

      {/* Centered percentage readout */}
      <div className="absolute bottom-0 flex flex-col items-center">
        <span className="text-xl font-extrabold tracking-tight tabular-nums text-[#18221B] dark:text-[#F0F4F1]">
          {clamped}%
        </span>
      </div>
    </div>
  );
}
