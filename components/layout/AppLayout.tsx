'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import SessionTimeoutHandler from './SessionTimeoutHandler';
import TransactionModal from '../modals/TransactionModal';
import LogoutConfirmModal from '../modals/LogoutConfirmModal';
import DeviceVerificationGate from '../auth/DeviceVerificationGate';
import { DataProvider, useFinanceData } from '@/lib/data/DataContext';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { WifiOff, Lock } from 'lucide-react';
import { User } from '@/lib/types';

function AppLayoutContent({
  children,
  initialIsGated = false,
}: {
  children: React.ReactNode;
  initialIsGated?: boolean;
}) {
  const { currentUser, isDemoMode, isTrustedDevice } = useFinanceData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Monitor offline / online connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Register PWA service worker for push notifications and offline caching
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
          console.warn('Service worker registration failed:', err);
        });
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Zero-gap gating: instantly locked from SSR / initial frame
  const isGated = Boolean(initialIsGated || (currentUser && !isDemoMode && !isTrustedDevice));

  return (
    <>
      <SessionTimeoutHandler />

      {/* Mandatory Device Verification Gate (Un-bypassable Modal) */}
      <DeviceVerificationGate initialIsGated={isGated} />

      {/* Offline Banner Notification */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center space-x-2 bg-amber-500 px-4 py-2 text-xs font-semibold text-black shadow-md">
          <WifiOff className="h-4 w-4" />
          <span>Offline. Showing cached data.</span>
        </div>
      )}

      {/* Main application layout container */}
      <div className="flex h-[100dvh] overflow-hidden bg-[var(--bg-canvas)] text-[var(--foreground)] transition-colors duration-200 p-2 sm:p-4 lg:p-5 gap-3 lg:gap-5">
        {/* Desktop & Tablet Floating Capsule Dock */}
        <Sidebar
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          onOpenLogout={() => setIsLogoutModalOpen(true)}
        />

        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Top Navigation Header (Greeting + Search Pill + Floating Buttons) */}
          <Header
            onOpenMobileMenu={() => setMobileOpen(true)}
            onOpenAddTx={() => setIsAddTxOpen(true)}
          />

          {/* Main Content Area with safe-area padding for mobile capsule dock */}
          <main className="flex-1 overflow-y-auto pr-1 pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] lg:pb-6 custom-scrollbar">
            <div className="mx-auto max-w-[1500px] w-full">
              {isGated ? (
                <div className="flex flex-col items-center justify-center min-h-[55vh] text-center p-8 space-y-4">
                  <div className="p-4 rounded-3xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-8 ring-amber-500/5">
                    <Lock className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#18221B] dark:text-[#F0F4F1]">
                      Modules Locked Behind Security Gate
                    </h3>
                    <p className="text-xs text-[#7A887E] dark:text-[#8E9E94] mt-1.5 max-w-md mx-auto">
                      Please enter your <strong>TRUSTED_DEVICE_TOKEN</strong> in the prompt to authorize this browser and access your account.
                    </p>
                  </div>
                </div>
              ) : (
                children
              )}
            </div>
          </main>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <BottomNav
          onOpenAddTx={() => setIsAddTxOpen(true)}
          onOpenLogout={() => setIsLogoutModalOpen(true)}
        />

        {/* Global Quick Transaction Modal triggered from BottomNav */}
        <TransactionModal
          isOpen={isAddTxOpen}
          onClose={() => setIsAddTxOpen(false)}
        />

        {/* Global Logout Confirmation Modal */}
        <LogoutConfirmModal
          isOpen={isLogoutModalOpen}
          onClose={() => setIsLogoutModalOpen(false)}
        />
      </div>
    </>
  );
}

interface AppLayoutProps {
  children: React.ReactNode;
  initialUser?: User | null;
  initialIsTrusted?: boolean;
  initialIsGated?: boolean;
}

export default function AppLayout({
  children,
  initialUser = null,
  initialIsTrusted = true,
  initialIsGated = false,
}: AppLayoutProps) {
  return (
    <LanguageProvider>
      <DataProvider initialUser={initialUser} initialIsTrusted={initialIsTrusted}>
        <AppLayoutContent initialIsGated={initialIsGated}>{children}</AppLayoutContent>
      </DataProvider>
    </LanguageProvider>
  );
}
