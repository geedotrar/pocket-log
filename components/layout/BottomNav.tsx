'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  CreditCard,
  Plus,
  BarChart2,
  Menu,
  Building,
  HandCoins,
  TrendingUp,
  Archive,
  Zap,
  X,
  LogOut,
  User,
  Users,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { logout } from '@/app/(auth)/login/actions';
import { useFinanceData } from '@/lib/data/DataContext';
import ThemeToggle from '../ui/ThemeToggle';

interface BottomNavProps {
  onOpenAddTx: () => void;
  onOpenLogout?: () => void;
}

export default function BottomNav({ onOpenAddTx, onOpenLogout }: BottomNavProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { currentUser, isDemoMode } = useFinanceData();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isSuperadmin = mounted && (currentUser?.role === 'superadmin' || isDemoMode);

  const mainItems = [
    { href: '/', label: 'Dashboard', icon: LayoutGrid },
    { href: '/accounts', label: 'Accounts', icon: CreditCard },
    { href: '/transactions', label: 'Transactions', icon: BarChart2 },
  ];

  const moreItems = [
    { href: '/categories', label: 'Categories', icon: Building },
    { href: '/debts', label: 'Debts & Loans', icon: HandCoins },
    { href: '/investments', label: 'Investments', icon: TrendingUp },
    { href: '/import-export', label: 'Backup & Export', icon: Archive },
    ...(isSuperadmin ? [{ href: '/users', label: 'Users', icon: Users }] : []),
    { href: '/profile', label: 'Profile', icon: User },
  ];

  const isMoreActive = moreItems.some((item) => pathname === item.href);

  return (
    <>
      {/* Mobile Floating Capsule Dock (Visible only on < lg screens with safe area inset) */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] left-3 right-3 z-40 lg:hidden">
        <nav
          aria-label="Mobile Navigation"
          className="flex h-16 items-center justify-around rounded-full border border-black/[0.05] dark:border-white/[0.08] bg-white/95 dark:bg-[#161D18]/95 backdrop-blur-xl px-3 shadow-[0_12px_35px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_35px_rgba(0,0,0,0.5)]"
        >
          {/* Dashboard */}
          <Link
            href="/"
            title="Dashboard"
            aria-label="Dashboard"
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${pathname === '/'
                ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm'
                : 'text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B]'
              }`}
          >
            <LayoutGrid className="h-5 w-5" />
          </Link>

          {/* Accounts */}
          <Link
            href="/accounts"
            title="Accounts"
            aria-label="Accounts"
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${pathname === '/accounts'
                ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm'
                : 'text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B]'
              }`}
          >
            <CreditCard className="h-5 w-5" />
          </Link>

          {/* Center Prominent Add Button (Sage Green Floating Pill) */}
          <button
            type="button"
            onClick={onOpenAddTx}
            title={t('header.addTransaction') || 'Add Transaction'}
            aria-label={t('header.addTransaction') || 'Add Transaction'}
            className="flex h-12 w-12 -translate-y-1 items-center justify-center rounded-full bg-[#5B7966] dark:bg-[#A7D7B5] text-white dark:text-[#0C2417] shadow-[0_8px_20px_rgba(91,121,102,0.35)] transition-transform active:scale-90 hover:scale-105"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>

          {/* Transactions */}
          <Link
            href="/transactions"
            title="Transactions"
            aria-label="Transactions"
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${pathname === '/transactions'
                ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm'
                : 'text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B]'
              }`}
          >
            <BarChart2 className="h-5 w-5" />
          </Link>

          {/* More Sheet Trigger */}
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            title="More Features"
            aria-label="More Features"
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${isMoreActive || isMoreOpen
                ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm'
                : 'text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B]'
              }`}
          >
            <Menu className="h-5 w-5" />
          </button>
        </nav>
      </div>

      {/* "More" Bottom Sheet Modal */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMoreOpen(false)}
          />

          {/* Sheet Container */}
          <div className="relative z-10 w-full rounded-t-[32px] border-t border-black/[0.04] dark:border-white/[0.08] bg-white dark:bg-[#161D18] p-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Sheet Handle */}
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-black/10 dark:bg-white/20" />

            <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08] mb-4">
              <span className="font-bold text-base text-[#18221B] dark:text-[#F0F4F1]">
                More Features
              </span>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="rounded-full p-1.5 text-[#76847A] hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className={`flex items-center space-x-3 rounded-2xl p-3.5 transition-colors ${isActive
                        ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] font-semibold'
                        : 'bg-[#F6F7F5] dark:bg-[#1F2822] text-[#18221B] dark:text-[#F0F4F1] hover:bg-[#ECEEEA] dark:hover:bg-[#28362D]'
                      }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Reach Me / Portfolio Row */}
            <a
              href="https://stevanprb.com/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsMoreOpen(false)}
              className="mb-2.5 flex items-center justify-between rounded-2xl border border-black/[0.04] dark:border-white/[0.06] bg-[#F6F7F5] dark:bg-[#1F2822] p-3 text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1] hover:bg-[#ECEEEA] dark:hover:bg-[#28362D] transition-colors group cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <Globe className="h-4 w-4 text-[#4D6A58] dark:text-[#A7D7B5]" />
                <span>stevanprb.com</span>
              </div>
              <div className="flex items-center space-x-1 text-[#7A887E] dark:text-[#8E9E94] text-[11px]">
                <ExternalLink className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </a>

            {/* Theme Toggle row */}
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-black/[0.04] dark:border-white/[0.06] bg-[#F6F7F5] dark:bg-[#1F2822] p-3">
              <span className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]">Appearance Theme</span>
              <ThemeToggle variant="pill" showLabel />
            </div>

            {/* Logout Action */}
            <button
              type="button"
              onClick={() => {
                setIsMoreOpen(false);
                onOpenLogout?.();
              }}
              className="flex w-full items-center justify-center space-x-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 py-3 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>{t('header.signOut') || 'Log Out'}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
