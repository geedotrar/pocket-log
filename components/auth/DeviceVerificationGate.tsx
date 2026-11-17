'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, ShieldCheck, Lock, Eye, EyeOff, LogOut, ArrowRight, AlertTriangle, KeyRound } from 'lucide-react';
import { trustDeviceWithTokenAction } from '@/app/(auth)/login/actions';
import { useFinanceData } from '@/lib/data/DataContext';
import LogoutConfirmModal from '../modals/LogoutConfirmModal';

interface DeviceVerificationGateProps {
  initialIsGated?: boolean;
}

export default function DeviceVerificationGate({ initialIsGated = false }: DeviceVerificationGateProps) {
  const { currentUser, isDemoMode, isTrustedDevice, setIsTrustedDevice, refreshData } = useFinanceData();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [hasUnlocked, setHasUnlocked] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Gating condition: zero-gap SSR/initial enforcement or dynamic context state
  const isGated = !hasUnlocked && Boolean(initialIsGated || (currentUser && !isDemoMode && !isTrustedDevice));

  // Auto-focus input when gate becomes active
  useEffect(() => {
    if (isGated) {
      inputRef.current?.focus();
    }
  }, [isGated]);

  // Countdown timer when locked out
  useEffect(() => {
    if (lockoutSeconds <= 0) {
      if (isLocked) {
        setIsLocked(false);
        setError(null);
      }
      return;
    }

    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          setIsLocked(false);
          setError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutSeconds, isLocked]);

  if (!isGated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || isSubmitting || isLocked) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await trustDeviceWithTokenAction(token.trim());

      if (res.success) {
        setHasUnlocked(true);
        setIsTrustedDevice(true);
        setToken('');
        await refreshData();
      } else {
        setError(res.error || 'Invalid verification token.');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
        if (res.remainingAttempts !== undefined) {
          setRemainingAttempts(res.remainingAttempts);
        }
        if (res.isLocked) {
          setIsLocked(true);
          setLockoutSeconds(300); // 5 minutes
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify token.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-gate-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto custom-scrollbar"
    >
      <div className="w-full max-w-md mx-auto rounded-3xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#161D18] p-5 sm:p-7 shadow-2xl relative overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[88vh] my-auto">
        {/* Top Decorative Amber/Emerald Gradient Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-emerald-500 to-[#4D6A58]" />

        {/* Header Badge & Title */}
        <div className="flex flex-col items-center text-center space-y-2.5 pt-1 shrink-0">
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 ring-8 ring-amber-500/5">
            <ShieldAlert className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>

          <div>
            <div className="inline-flex items-center space-x-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1.5">
              <AlertTriangle className="h-3 w-3" />
              <span>Unverified Device</span>
            </div>
            <h2 id="device-gate-title" className="text-lg sm:text-xl font-bold tracking-tight text-[#18221B] dark:text-[#F0F4F1]">
              Device Verification
            </h2>
            <p className="text-xs text-[#7A887E] dark:text-[#8E9E94] mt-1 leading-relaxed max-w-sm mx-auto">
              Please enter your device security token to verify this browser and unlock your account.
            </p>
          </div>
        </div>

        {/* Status Callout: Stable polymorphic box preventing layout shift & button displacement */}
        <div
          role={error ? 'alert' : 'status'}
          className={`mt-3.5 rounded-2xl p-3 sm:p-3.5 text-xs transition-colors duration-200 shrink-0 min-h-[58px] flex items-start space-x-2.5 ${
            error
              ? 'border border-rose-500/30 bg-rose-50/90 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
              : 'border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 text-[#7A887E] dark:text-[#8E9E94]'
          }`}
        >
          {error ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5 animate-in fade-in" />
          ) : (
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            {error ? (
              <div className="animate-in fade-in">
                <span className="font-semibold break-words leading-tight block">{error}</span>
                {isLocked && lockoutSeconds > 0 && (
                  <p className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">
                    Locked for: <strong>{Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s</strong>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11px] leading-relaxed">
                Your financial data is protected until this device is verified.
              </p>
            )}
          </div>
        </div>

        {/* Form Body with Padding to Prevent Overflow */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 flex-1 overflow-y-auto px-1 py-1 custom-scrollbar">
          <div className="space-y-1.5">
            {/* Fully Responsive Label Bar */}
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <label
                htmlFor="gate-token"
                className="text-xs font-bold text-[#18221B] dark:text-[#F0F4F1] flex items-center gap-1.5 flex-wrap min-w-0"
              >
                <span>Device Token</span>
                <code className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-[#4D6A58] dark:text-[#A7D7B5] font-semibold">
                  TRUSTED_DEVICE_TOKEN
                </code>
              </label>

              <span className="text-[10px] font-semibold text-[#7A887E] dark:text-[#8E9E94] bg-[#F6F7F5] dark:bg-[#1F2822] px-2 py-0.5 rounded-full border border-black/5 dark:border-white/5 shrink-0">
                Max 5 attempts
              </span>
            </div>

            <div className={`relative ${isShaking ? 'animate-shake' : ''}`}>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#7A887E] dark:text-[#8E9E94]">
                <KeyRound className="h-4 w-4" />
              </div>

              <input
                ref={inputRef}
                id="gate-token"
                name="trusted_device_auth_token"
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isSubmitting || isLocked}
                placeholder="Enter secret device token..."
                required
                autoComplete="one-time-code"
                data-1p-ignore="true"
                data-lpignore="true"
                data-form-type="other"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                className={`w-full rounded-2xl border ${
                  error
                    ? 'border-rose-500/50 focus:ring-rose-500/30'
                    : 'border-black/[0.08] dark:border-white/[0.08] focus:ring-emerald-500/30 dark:focus:ring-[#A7D7B5]/30'
                } bg-[#F6F7F5] dark:bg-[#1F2822] pl-10 pr-10 py-3 text-xs font-mono text-[#18221B] dark:text-[#F0F4F1] placeholder-[#7A887E]/60 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[44px]`}
              />

              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                tabIndex={-1}
                aria-label={showToken ? 'Hide token' : 'Show token'}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#7A887E] hover:text-[#18221B] dark:text-[#8E9E94] dark:hover:text-[#F0F4F1] cursor-pointer"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1 shrink-0">
            <button
              type="submit"
              disabled={isSubmitting || isLocked || !token.trim()}
              className="w-full rounded-2xl bg-[#18221B] dark:bg-[#A7D7B5] text-white dark:text-[#0C2417] py-3 text-xs font-bold shadow-md hover:opacity-95 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center space-x-1.5 min-h-[44px]"
            >
              {isSubmitting ? (
                <span>Verifying...</span>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Verify Device</span>
                  <ArrowRight className="h-4 w-4 ml-0.5" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              disabled={isSubmitting}
              className="w-full rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-[#7A887E] dark:text-[#8E9E94] hover:text-rose-600 dark:hover:text-rose-400 py-2.5 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center space-x-1.5 min-h-[42px]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </form>
      </div>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
      />
    </div>
  );
}
