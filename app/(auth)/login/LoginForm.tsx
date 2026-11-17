'use client';

import React, { useState, useEffect, useRef } from 'react';
import { loginWithPassword, loginWithPin, startDemoSession } from './actions';
import { SubmitButton } from '@/components/submit-button';
import { useActionState } from 'react';
import {
  Lock,
  Smartphone,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  Globe,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import BrandLogo from '@/components/ui/BrandLogo';
import ThemeToggle from '@/components/ui/ThemeToggle';

const initialState = { error: '' };

interface LoginFormProps {
  isTrustedInitial: boolean;
}

export default function LoginForm({ isTrustedInitial }: LoginFormProps) {
  // If device is trusted, start strictly in PIN mode without email
  const [authMode, setAuthMode] = useState<'pin' | 'password'>(
    isTrustedInitial ? 'pin' : 'password'
  );
  const [isTrusted] = useState(isTrustedInitial);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [showPassword, setShowPassword] = useState(false);
  const [showAlternativeLogin, setShowAlternativeLogin] = useState(!isTrustedInitial);
  const [isShaking, setIsShaking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Auto-focus first PIN box on mount when in PIN mode
  useEffect(() => {
    if (authMode === 'pin') {
      const firstInput = document.getElementById('pin-box-0');
      firstInput?.focus();
    }
  }, [authMode]);

  // Form action for Password login
  const [passwordState, passwordFormAction] = useActionState(
    async (prevState: any, formData: FormData) => {
      if (email && !formData.get('email')) {
        formData.set('email', email);
      }
      const result = await loginWithPassword(formData);
      return result || prevState;
    },
    initialState
  );

  // Form action for PIN login
  const [pinState, pinFormAction] = useActionState(
    async (prevState: any, formData: FormData) => {
      const fullPin = pin.join('');
      formData.set('pin', fullPin);
      if (email && !formData.get('email')) {
        formData.set('email', email);
      }
      const result = await loginWithPin(formData);
      if (result?.error) {
        setPin(['', '', '', '']);
        setTimeout(() => {
          document.getElementById('pin-box-0')?.focus();
        }, 20);
      }
      return result || prevState;
    },
    initialState
  );

  // Trigger tactile shake animation and auto-reset PIN digits on error
  useEffect(() => {
    if (pinState?.error || passwordState?.error) {
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 500);
      return () => clearTimeout(timer);
    }
  }, [pinState?.error, passwordState?.error]);

  useEffect(() => {
    if (pinState?.error) {
      setPin(['', '', '', '']);
      setTimeout(() => {
        document.getElementById('pin-box-0')?.focus();
      }, 20);
    }
  }, [pinState?.error]);

  // Handle single digit input in 4-box PIN layout
  const handlePinChange = (idx: number, val: string) => {
    const cleaned = val.replace(/\D/g, '');
    const newPin = [...pin];

    if (cleaned.length > 0) {
      if (cleaned.length === 4) {
        // Multi-digit paste support
        const digits = cleaned.split('');
        setPin(digits);
        document.getElementById('pin-box-3')?.focus();
        return;
      }

      newPin[idx] = cleaned[cleaned.length - 1];
      setPin(newPin);

      // Auto-advance focus to next input box or submit button
      if (idx < 3) {
        document.getElementById(`pin-box-${idx + 1}`)?.focus();
      } else if (idx === 3 && newPin.every((d) => d !== '')) {
        document.getElementById('pin-submit-btn')?.focus();
      }
    } else {
      newPin[idx] = '';
      setPin(newPin);
    }
  };

  const handlePinKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) {
      document.getElementById(`pin-box-${idx - 1}`)?.focus();
    }
  };

  const activeError = authMode === 'password' ? passwordState?.error : pinState?.error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] px-4 py-8 relative overflow-hidden transition-colors duration-200">
      {/* Top right Theme Switcher */}
      <div className="absolute top-5 right-5 z-20">
        <ThemeToggle variant="pill" showLabel />
      </div>

      {/* Ambient background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#5E7A68]/10 dark:bg-[#A7D7B5]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-sm rounded-[32px] border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-7 sm:p-9 shadow-[0_15px_45px_rgba(0,0,0,0.04)] dark:shadow-[0_15px_45px_rgba(0,0,0,0.4)] relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E5EFE8] dark:bg-[#1E2B22] mb-3 shadow-xs">
            <BrandLogo className="h-8 w-8 text-[#4D6A58] dark:text-[#A7D7B5]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#18221B] dark:text-[#F0F4F1]">
            PocketLog
          </h1>

          {/* Subtitle / Status Line - Stable height ensures 0px vertical layout shift */}
          {isTrusted && authMode === 'pin' ? (
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-semibold animate-in fade-in">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Trusted Device</span>
            </div>
          ) : (
            <div className="min-h-[22px] flex items-center justify-center mt-1 text-center px-1">
              {activeError ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400 animate-in fade-in">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{activeError}</span>
                </div>
              ) : (
                <p className="text-xs text-[#76847A] dark:text-[#8E9E94]">
                  Sign in to your PocketLog account
                </p>
              )}
            </div>
          )}
        </div>

        {/* Tab Toggle: Only visible if device is NOT trusted, or if user explicitly requested alternatives */}
        {showAlternativeLogin && (
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F6F7F5] dark:bg-[#1F2822] rounded-2xl mb-6 border border-black/[0.04] dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setAuthMode('password')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${authMode === 'password'
                ? 'bg-white dark:bg-[#161D18] text-[#18221B] dark:text-[#F0F4F1] shadow-xs'
                : 'text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B]'
                }`}
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Password</span>
            </button>

            <button
              type="button"
              onClick={() => setAuthMode('pin')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${authMode === 'pin'
                ? 'bg-white dark:bg-[#161D18] text-[#18221B] dark:text-[#F0F4F1] shadow-xs'
                : 'text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B]'
                }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>4-Digit PIN</span>
            </button>
          </div>
        )}

        {/* 1. TRUSTED PIN MODE: STRICTLY PIN ONLY (NO EMAIL INPUT) */}
        {authMode === 'pin' && isTrusted && (
          <form ref={formRef} action={pinFormAction} className="space-y-5">
            <div className="space-y-3 text-center">
              {/* Stable status line: in-place prompt or error, zero layout shift */}
              <div className="min-h-[24px] flex items-center justify-center text-center px-1">
                {activeError ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400 animate-in fade-in">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{activeError}</span>
                  </div>
                ) : (
                  <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94]">
                    Enter 4-digit PIN to log in
                  </span>
                )}
              </div>

              {/* 4 Discrete Boxes */}
              <div className={`flex justify-center items-center gap-2.5 pt-1 ${isShaking ? 'animate-shake' : ''}`}>
                {[0, 1, 2, 3].map((idx) => (
                  <input
                    key={idx}
                    id={`pin-box-${idx}`}
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={pin[idx]}
                    onChange={(e) => handlePinChange(idx, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(idx, e)}
                    autoComplete="one-time-code"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    className={`w-12 h-14 text-center text-2xl font-bold rounded-2xl border ${activeError
                      ? 'border-rose-500/50 dark:border-rose-500/50 focus:ring-rose-500/30'
                      : 'border-black/[0.08] dark:border-white/[0.1] focus:ring-[#5B7966]'
                      } bg-[#F6F7F5] dark:bg-[#1F2822] text-[#18221B] dark:text-[#F0F4F1] focus:ring-2 focus:border-transparent focus:outline-none transition-all shadow-inner`}
                  />
                ))}
              </div>
            </div>

            <SubmitButton
              id="pin-submit-btn"
              className="w-full mt-2 !rounded-2xl !bg-[#18221B] hover:!bg-black dark:!bg-[#A7D7B5] dark:hover:!bg-[#95D5B2] !text-white dark:!text-[#0C2417] font-bold py-3 text-xs shadow-md active:scale-98 transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              pendingText="Logging in..."
            >
              <span>Log in</span>
              <ArrowRight className="h-4 w-4" />
            </SubmitButton>

            {/* Switch to email/password fallback if user needs */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAlternativeLogin(true);
                  setAuthMode('password');
                }}
                className="text-[11px] text-[#76847A] dark:text-[#8E9E94] hover:text-[#18221B] dark:hover:text-[#F0F4F1] transition-colors underline cursor-pointer"
              >
                Log in with password instead
              </button>
            </div>
          </form>
        )}

        {/* 2. NON-TRUSTED PIN MODE (Requires Email + PIN) */}
        {authMode === 'pin' && !isTrusted && (
          <form ref={formRef} action={pinFormAction} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="pin-email"
                className="block text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]"
              >
                Account Email
              </label>
              <input
                id="pin-email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="Email"
                className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-4 py-2.5 text-xs text-[#18221B] placeholder-[#8E9B92] focus:outline-none focus:ring-2 focus:ring-[#5B7966]/20 dark:border-white/[0.08] dark:bg-[#1F2822] dark:text-[#F0F4F1] dark:placeholder-[#8E9E94]/60 transition-all"
              />
            </div>

            <div className="space-y-2 text-center pt-1">
              <div className="min-h-[20px] flex items-center justify-center text-center">
                {activeError ? (
                  <span className="text-xs font-semibold text-rose-500 dark:text-rose-400 inline-flex items-center gap-1.5 animate-in fade-in">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{activeError}</span>
                  </span>
                ) : (
                  <label className="block text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]">
                    Enter 4-Digit Security PIN
                  </label>
                )}
              </div>

              {/* 4 Discrete Boxes */}
              <div className={`flex justify-center items-center gap-2.5 ${isShaking ? 'animate-shake' : ''}`}>
                {[0, 1, 2, 3].map((idx) => (
                  <input
                    key={idx}
                    id={`pin-box-${idx}`}
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={pin[idx]}
                    onChange={(e) => handlePinChange(idx, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(idx, e)}
                    autoComplete="one-time-code"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    className={`w-12 h-14 text-center text-xl font-bold rounded-2xl border ${activeError
                      ? 'border-rose-500/50 dark:border-rose-500/50 focus:ring-rose-500/30'
                      : 'border-black/[0.08] dark:border-white/[0.1] focus:ring-[#5B7966]'
                      } bg-[#F6F7F5] dark:bg-[#1F2822] text-[#18221B] dark:text-[#F0F4F1] focus:ring-2 focus:border-transparent focus:outline-none transition-all shadow-inner`}
                  />
                ))}
              </div>
            </div>

            <SubmitButton
              id="non-trusted-pin-submit-btn"
              className="w-full mt-3 !rounded-2xl !bg-[#5B7966] hover:!bg-[#4D6A58] dark:!bg-[#A7D7B5] dark:hover:!bg-[#95D5B2] !text-white dark:!text-[#0C2417] font-bold py-2.5 text-xs shadow-md active:scale-98 transition-all cursor-pointer"
              pendingText="Verifying PIN..."
            >
              Sign in
            </SubmitButton>
          </form>
        )}

        {/* 3. PASSWORD MODE */}
        {authMode === 'password' && (
          <form action={passwordFormAction} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]"
              >
                Account Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="Email"
                className={`w-full rounded-2xl border ${activeError
                  ? 'border-rose-500/50 dark:border-rose-500/50'
                  : 'border-black/[0.06] dark:border-white/[0.08]'
                  } bg-[#F6F7F5] px-4 py-2.5 text-xs text-[#18221B] placeholder-[#8E9B92] focus:outline-none focus:ring-2 focus:ring-[#5B7966]/20 dark:bg-[#1F2822] dark:text-[#F0F4F1] dark:placeholder-[#8E9E94]/60 transition-all`}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-[#76847A] hover:text-[#18221B] dark:text-[#8E9E94] flex items-center gap-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={`w-full rounded-2xl border ${activeError
                  ? 'border-rose-500/50 dark:border-rose-500/50 focus:ring-rose-500/30'
                  : 'border-black/[0.06] dark:border-white/[0.08] focus:ring-[#5B7966]/20'
                  } bg-[#F6F7F5] px-4 py-2.5 text-xs text-[#18221B] placeholder-[#8E9B92] focus:outline-none focus:ring-2 dark:bg-[#1F2822] dark:text-[#F0F4F1] dark:placeholder-[#8E9E94]/60 transition-all ${isShaking ? 'animate-shake' : ''
                  }`}
              />
            </div>

            <SubmitButton
              id="password-submit-btn"
              className="w-full mt-2 !rounded-2xl !bg-[#5B7966] hover:!bg-[#4D6A58] dark:!bg-[#A7D7B5] dark:hover:!bg-[#95D5B2] !text-white dark:!text-[#0C2417] font-bold py-2.5 text-xs shadow-md active:scale-98 transition-all cursor-pointer"
              pendingText="Signing in..."
            >
              Log in
            </SubmitButton>

            {isTrusted && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAlternativeLogin(false);
                    setAuthMode('pin');
                  }}
                  className="text-[11px] text-[#5B7966] dark:text-[#A7D7B5] hover:underline font-semibold cursor-pointer"
                >
                  Back to PIN login
                </button>
              </div>
            )}
          </form>
        )}

        {/* DEMO MODE EXPLORATION DIVIDER & ACTION */}
        <div className="mt-6 pt-5 border-t border-black/[0.04] dark:border-white/[0.06] text-center">
          <p className="text-[11px] text-[#76847A] dark:text-[#8E9E94] mb-2.5">
            Visiting without personal credentials?
          </p>
          <form action={startDemoSession}>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-2xl border border-[#5B7966]/20 bg-[#5B7966]/5 dark:bg-[#A7D7B5]/10 text-xs font-bold text-[#5B7966] dark:text-[#A7D7B5] hover:bg-[#5B7966]/10 transition-colors cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Explore Demo Mode</span>
            </button>
          </form>

          {/* Author Portfolio Link */}
          <div className="mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.04]">
            <a
              href="https://stevanprb.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#76847A] hover:text-[#5B7966] dark:text-[#8E9E94] dark:hover:text-[#A7D7B5] transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>stevanprb.com</span>
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
