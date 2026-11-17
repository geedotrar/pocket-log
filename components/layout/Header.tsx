'use client';

import React, { useState } from 'react';
import { Plus, Menu, Sparkles, Globe, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import BrandLogo from '../ui/BrandLogo';
import ThemeToggle from '../ui/ThemeToggle';
import TransactionModal from '../modals/TransactionModal';
import StorageIndicator from './StorageIndicator';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useFinanceData } from '@/lib/data/DataContext';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenAddTx?: () => void;
}

export default function Header({ onOpenMobileMenu, onOpenAddTx }: HeaderProps) {
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const { t } = useLanguage();
  const { currentUser, isDemoMode } = useFinanceData();

  const rawName = currentUser?.full_name?.trim();
  const fallbackName = currentUser?.email ? currentUser.email.split('@')[0] : 'User';
  const greetingName = isDemoMode
    ? 'Guest Explorer'
    : (rawName || fallbackName);

  const handleOpenTransaction = () => {
    if (onOpenAddTx) {
      onOpenAddTx();
    } else {
      setIsTxModalOpen(true);
    }
  };

  return (
    <>
      <header className="flex items-center justify-between gap-2.5 sm:gap-4 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] sm:pt-2 pb-3.5 sm:pb-4 px-2 sm:px-0 shrink-0">
        {/* Left Side: Brand Logo + Warm Greeting */}
        <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0 flex-1">
          {/* Mobile drawer trigger */}
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open menu"
            className="rounded-full p-2.5 bg-white dark:bg-[#161D18] shadow-sm border border-black/[0.04] dark:border-white/[0.06] text-[#7A887E] hover:text-[#18221B] lg:hidden shrink-0"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Brand Logo */}
          <div className="hidden sm:flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-[#161D18] shadow-[0_4px_16px_rgba(0,0,0,0.03)] border border-black/[0.04] dark:border-white/[0.06] shrink-0">
            <BrandLogo className="h-6 w-6 text-[#4D6A58] dark:text-[#A7D7B5]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2">
              <h1
                className="text-lg sm:text-2xl font-bold tracking-tight text-[#18221B] dark:text-[#F0F4F1] truncate"
                title={`Hello, ${greetingName}!`}
              >
                <span>Hello, {greetingName}!</span>
              </h1>
              {isDemoMode && (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all shadow-xs whitespace-nowrap shrink-0"
                  title="Click to sign in to your private account"
                >
                  <Sparkles className="h-3 w-3 text-amber-500 animate-pulse shrink-0" />
                  <span className="whitespace-nowrap">Guest Mode</span>
                  <span className="opacity-60">•</span>
                  <span className="underline decoration-amber-500/40 hover:decoration-amber-500 whitespace-nowrap">Sign In</span>
                </Link>
              )}
            </div>
            <p className="text-xs text-[#7A887E] dark:text-[#8E9E94] truncate">
              Track and manage your pockets and finances
            </p>
          </div>
        </div>

        {/* Right Side: Storage Telemetry & Floating Action Icons */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">

          {/* Database Storage Telemetry Pill */}
          <StorageIndicator />

          {/* Floating Round Theme Toggle */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white dark:bg-[#161D18] shadow-[0_4px_16px_rgba(0,0,0,0.03)] border border-black/[0.04] dark:border-white/[0.06]">
            <ThemeToggle />
          </div>

          {/* Reach Me / Portfolio Link */}
          <a
            href="https://stevanprb.com/"
            target="_blank"
            rel="noopener noreferrer"
            title="Portfolio • stevanprb.com"
            aria-label="Portfolio • stevanprb.com"
            className="flex h-10 px-3 sm:px-3.5 shrink-0 items-center gap-1.5 rounded-full bg-white dark:bg-[#161D18] shadow-[0_4px_16px_rgba(0,0,0,0.03)] border border-black/[0.04] dark:border-white/[0.06] text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1] hover:text-[#5B7966] dark:hover:text-[#A7D7B5] hover:border-[#5B7966]/30 dark:hover:border-[#A7D7B5]/30 transition-all cursor-pointer"
          >
            <Globe className="h-3.5 w-3.5 text-[#5B7966] dark:text-[#A7D7B5] shrink-0" />
            <span className="hidden sm:inline">stevanprb.com</span>
            <ExternalLink className="h-3 w-3 opacity-60 hidden sm:inline shrink-0" />
          </a>

          {/* "+ Transaction" Primary Sage Button */}
          <button
            type="button"
            onClick={handleOpenTransaction}
            className="hidden md:inline-flex items-center space-x-2 rounded-full bg-[#5B7966] dark:bg-[#A7D7B5] px-4 py-2.5 text-xs font-bold text-white dark:text-[#0C2417] shadow-[0_4px_16px_rgba(91,121,102,0.25)] hover:bg-[#4D6A58] dark:hover:bg-[#95D5B2] transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{t('header.addTransaction') || '+ Transaction'}</span>
          </button>
        </div>
      </header>

      {/* Quick Transaction Modal fallback */}
      {!onOpenAddTx && (
        <TransactionModal
          isOpen={isTxModalOpen}
          onClose={() => setIsTxModalOpen(false)}
        />
      )}
    </>
  );
}
