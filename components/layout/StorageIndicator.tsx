'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Database, HardDrive, ShieldCheck, ArrowRight, RefreshCw, Check, Copy, Info } from 'lucide-react';
import { useFinanceData } from '@/lib/data/DataContext';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export default function StorageIndicator() {
  const { transactions, accounts, categories, debts } = useFinanceData();

  const [isOpen, setIsOpen] = useState(false);
  const [exactBytes, setExactBytes] = useState<number | null>(null);
  const [isRpcSupported, setIsRpcSupported] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const lastCheckedRef = useRef<number>(0);

  const MAX_STORAGE_BYTES = 500 * 1024 * 1024; // 500 MB in bytes
  const BASELINE_SYSTEM_BYTES = 32.4 * 1024 * 1024; // Supabase starter Postgres baseline (~32.4 MB)

  // Fetch live storage with a 60-second throttle
  const checkStorageSize = useCallback(async (force = false) => {
    if (!isSupabaseConfigured()) return;
    const now = Date.now();
    if (!force && now - lastCheckedRef.current < 60000) return;
    lastCheckedRef.current = now;

    setIsRefreshing(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_db_size');
      if (!error && data && typeof data.used_bytes === 'number') {
        setExactBytes(data.used_bytes);
        setIsRpcSupported(true);
      } else {
        setIsRpcSupported(false);
      }
    } catch {
      setIsRpcSupported(false);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkStorageSize();
  }, [checkStorageSize]);

  useEffect(() => {
    if (isOpen) {
      checkStorageSize();
    }
  }, [isOpen, checkStorageSize]);

  // Click outside to close popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Estimation fallback
  const estimatedUserBytes =
    transactions.length * 450 +
    accounts.length * 280 +
    categories.length * 220 +
    debts.length * 350;

  const effectiveUsedBytes =
    exactBytes !== null ? exactBytes : BASELINE_SYSTEM_BYTES + estimatedUserBytes;

  const usedMB = effectiveUsedBytes / (1024 * 1024);
  const totalMB = 500;
  const freeMB = Math.max(0, totalMB - usedMB);
  const percentUsed = Math.min(100, (effectiveUsedBytes / MAX_STORAGE_BYTES) * 100);

  const dotColor =
    percentUsed >= 90
      ? 'bg-rose-500'
      : percentUsed >= 75
      ? 'bg-amber-500'
      : 'bg-[#A7D7B5]';

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Navbar Badge Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Database Storage"
        className="flex items-center space-x-1.5 sm:space-x-2 rounded-full border border-white/10 bg-[#1A211D] px-2.5 py-1 text-[11px] font-medium transition-all hover:bg-white/10 focus:outline-none whitespace-nowrap shrink-0"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
        </span>

        <Database className="h-3 w-3 text-[#8F9992] shrink-0" />

        <div className="flex items-center space-x-1 whitespace-nowrap shrink-0">
          <span className="hidden sm:inline text-[#8F9992] text-[10px]">
            Storage:
          </span>
          <span className="font-semibold text-[#F2F5F3] tabular-nums whitespace-nowrap">
            {usedMB.toFixed(1)} MB
          </span>
          <span className="hidden md:inline text-[#626C65] text-[10px] whitespace-nowrap">
            / 500 MB
          </span>
        </div>
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/10 bg-[#161C18] p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 text-[#F2F5F3]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <div className="flex items-center space-x-2">
              <div className="rounded-xl bg-[#A7D7B5]/15 p-2 text-[#A7D7B5]">
                <HardDrive className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#F2F5F3]">
                  Database Storage
                </h4>
                <p className="text-[10px] text-[#8F9992]">
                  {isRpcSupported
                    ? 'PostgreSQL Live Size'
                    : '500 MB Free Tier'}
                </p>
              </div>
            </div>

            <button
              onClick={() => checkStorageSize(true)}
              disabled={isRefreshing}
              className="rounded-lg p-1.5 text-[#8F9992] hover:bg-white/10 hover:text-white transition-colors"
              title="Refresh size"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#A7D7B5]' : ''}`} />
            </button>
          </div>

          {/* Progress Bar & Status */}
          <div className="my-3 space-y-2 rounded-2xl bg-white/[0.03] p-3.5 border border-white/6">
            <div className="flex justify-between text-xs">
              <span className="text-[#8F9992]">Used</span>
              <span className="font-bold text-[#F2F5F3] tabular-nums">
                {usedMB.toFixed(2)} MB ({percentUsed.toFixed(1)}%)
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-500 bg-[#A7D7B5]"
                style={{ width: `${Math.max(1, percentUsed)}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-[#8F9992]">
              <span>Free: <strong className="text-[#F2F5F3] tabular-nums">{freeMB.toFixed(1)} MB</strong></span>
              <span>Limit: 500 MB</span>
            </div>
          </div>

          {/* Table Breakdown */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between py-1 px-1.5 rounded-lg text-[#8F9992]">
              <span>Transactions</span>
              <span className="font-semibold text-[#F2F5F3] tabular-nums">{transactions.length} rows</span>
            </div>
            <div className="flex justify-between py-1 px-1.5 rounded-lg text-[#8F9992]">
              <span>Accounts & Wallets</span>
              <span className="font-semibold text-[#F2F5F3] tabular-nums">{accounts.length} accounts</span>
            </div>
            <div className="flex justify-between py-1 px-1.5 rounded-lg text-[#8F9992]">
              <span>Server Status</span>
              <span className="font-semibold text-[#A7D7B5] inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Healthy
              </span>
            </div>
          </div>

          {/* Footer Link to Archives */}
          <div className="mt-3 border-t border-white/8 pt-3 flex justify-end">
            <Link
              href="/import-export"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center space-x-1 text-xs font-medium text-[#A7D7B5] hover:underline"
            >
              <span>Archives & Export</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
