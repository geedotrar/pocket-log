'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  CreditCard,
  BarChart2,
  Building,
  LogOut,
  X,
  TrendingUp,
  Archive,
  HandCoins,
  Users,
  User,
  Globe,
  ExternalLink,
} from 'lucide-react';
import BrandLogo from '../ui/BrandLogo';
import ThemeToggle from '../ui/ThemeToggle';
import { logout } from '@/app/(auth)/login/actions';
import { useFinanceData } from '@/lib/data/DataContext';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenLogout?: () => void;
}

export default function Sidebar({ mobileOpen = false, onCloseMobile, onOpenLogout }: SidebarProps) {
  const pathname = usePathname();
  const { currentUser, isDemoMode } = useFinanceData();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isSuperadmin = mounted && (currentUser?.role === 'superadmin' || isDemoMode);

  const avatarLetter = currentUser?.full_name
    ? currentUser.full_name.trim().charAt(0).toUpperCase()
    : isDemoMode
    ? 'G'
    : 'S';

  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutGrid },
    { label: 'Accounts', href: '/accounts', icon: CreditCard },
    { label: 'Transactions', href: '/transactions', icon: BarChart2 },
    { label: 'Categories', href: '/categories', icon: Building },
    { label: 'Debts & Loans', href: '/debts', icon: HandCoins },
    { label: 'Investments', href: '/investments', icon: TrendingUp },
    { label: 'Backup & Export', href: '/import-export', icon: Archive },
    ...(isSuperadmin ? [{ label: 'Users', href: '/users', icon: Users }] : []),
    { label: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <>
      {/* Desktop navigation dock */}
      <aside className="hidden lg:flex flex-col h-full max-h-[100dvh] shrink-0">
        <div className="flex h-full w-[72px] flex-col items-center justify-between rounded-[32px] bg-white dark:bg-[#161D18] py-4 shadow-[0_10px_35px_rgba(0,0,0,0.04)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.4)] border border-black/[0.04] dark:border-white/[0.06] overflow-hidden">
          {/* Top Brand Mark */}
          <div className="flex flex-col items-center justify-center w-full shrink-0">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-2xl transition-transform active:scale-95"
              title="PocketLog"
            >
              <BrandLogo className="h-7 w-7 text-[#4D6A58] dark:text-[#A7D7B5]" />
            </Link>
          </div>

          {/* Navigation Icon List */}
          <nav className="flex flex-1 flex-col items-center space-y-1.5 py-2 overflow-y-auto no-scrollbar w-full min-h-0">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <div key={item.href} className="relative group shrink-0 w-full flex items-center justify-center">
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 ${
                      isActive
                        ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-md scale-105'
                        : 'text-[#8E9B92] hover:text-[#18221B] dark:hover:text-[#F0F4F1] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2.3 : 1.8} />
                  </Link>

                  {/* Tooltip Label on Hover */}
                  <div className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50">
                    <div className="rounded-xl bg-[#18221B] text-white dark:bg-[#F0F4F1] dark:text-[#18221B] text-xs font-semibold px-3 py-1.5 shadow-xl whitespace-nowrap">
                      {item.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Bottom Dock Actions: Logout and User Avatar */}
          <div className="flex flex-col items-center space-y-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08] w-10 shrink-0">
            {/* Optional Author / Portfolio Link */}
            {/* Reach Me / Portfolio Link */}
            <a
              href="https://stevanprb.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Portfolio • stevanprb.com"
              className="group relative flex h-8 w-8 items-center justify-center rounded-full text-[#8E9B92] hover:text-[#5B7966] dark:hover:text-[#A7D7B5] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              <Globe className="h-4 w-4" />
              <div className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50">
                <div className="rounded-xl bg-[#18221B] text-white dark:bg-[#F0F4F1] dark:text-[#18221B] text-xs font-semibold px-3 py-1.5 shadow-xl whitespace-nowrap flex items-center gap-1.5">
                  <span>stevanprb.com</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </div>
              </div>
            </a>

            {/* Logout button */}
            <button
              type="button"
              onClick={onOpenLogout}
              title="Log Out"
              className="text-[#8E9B92] hover:text-rose-500 p-1.5 rounded-full hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>

            {/* User Avatar Circle */}
            <Link
              href="/profile"
              className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#E5EFE8] dark:bg-[#202B24] ring-2 ring-black/5 dark:ring-white/10 overflow-hidden shrink-0 hover:ring-[#4D6A58]/40 transition-all"
              title={currentUser?.full_name || 'Profile & Security'}
            >
              <span className="text-xs font-bold text-[#4D6A58] dark:text-[#A7D7B5]">
                {avatarLetter}
              </span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile drawer navigation */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col py-3 px-3 transition-transform duration-200 ease-in-out lg:hidden h-full max-h-[100dvh] shrink-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full w-72 max-w-[85vw] flex-col justify-between rounded-3xl bg-white dark:bg-[#161D18] py-4 px-4 shadow-2xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
            <Link href="/" onClick={onCloseMobile} className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E5EFE8] dark:bg-[#1E2B22] shrink-0">
                <BrandLogo className="h-6 w-6 text-[#4D6A58] dark:text-[#A7D7B5]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-base tracking-tight text-[#18221B] dark:text-[#F0F4F1] leading-tight">
                  PocketLog
                </span>
                <span className="text-[10px] text-[#7A887E] dark:text-[#8E9E94]">
                  Personal Finance
                </span>
              </div>
            </Link>
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close menu"
              className="rounded-xl p-2 text-stone-400 hover:text-stone-700 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-1 flex-col space-y-1.5 py-3 overflow-y-auto no-scrollbar w-full min-h-0">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={`flex items-center space-x-3 w-full rounded-2xl px-3.5 py-2.5 transition-colors ${
                    isActive
                      ? 'bg-[#18221B] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] font-semibold shadow-xs'
                      : 'text-[#8E9B92] hover:text-[#18221B] dark:hover:text-[#F0F4F1] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.3 : 1.8} />
                  <span className="text-xs font-medium truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Mobile Theme Toggle Row */}
          <div className="flex items-center justify-between py-2.5 px-1 border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
            <span className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]">Appearance Theme</span>
            <ThemeToggle variant="pill" showLabel />
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center justify-between pt-3 border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
            <Link
              href="/profile"
              onClick={onCloseMobile}
              className="flex items-center space-x-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity"
            >
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#E5EFE8] dark:bg-[#202B24] ring-2 ring-black/5 dark:ring-white/10 overflow-hidden shrink-0">
                <span className="text-xs font-bold text-[#4D6A58] dark:text-[#A7D7B5]">
                  {avatarLetter}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1] truncate">
                  {currentUser?.full_name || (isDemoMode ? 'Guest Explorer' : 'User')}
                </span>
                <span className="text-[10px] text-[#7A887E] dark:text-[#8E9E94] truncate">
                  {currentUser?.email || (isDemoMode ? 'guest@pocketlog.app' : '')}
                </span>
              </div>
            </Link>

            {/* Reach Me / Portfolio Mobile Link */}
            <a
              href="https://stevanprb.com/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onCloseMobile}
              className="flex items-center justify-center text-[#7A887E] dark:text-[#8E9E94] hover:text-[#4D6A58] dark:hover:text-[#A7D7B5] p-2 rounded-xl text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Portfolio • stevanprb.com"
            >
              <Globe className="h-4 w-4" />
            </a>

            <button
              type="button"
              onClick={() => {
                onCloseMobile?.();
                onOpenLogout?.();
              }}
              className="flex items-center space-x-1.5 text-rose-500 hover:bg-rose-500/10 p-2 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              title="Log Out"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
