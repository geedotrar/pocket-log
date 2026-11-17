'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, LogOut, Clock, RefreshCw } from 'lucide-react';
import { logout } from '@/app/(auth)/login/actions';

function parseDurationSeconds(val?: string | number | null): number {
  if (!val) return 86400; // 1 day default (86400 seconds)
  const str = String(val).trim().toLowerCase();
  const num = Number(str);
  if (!isNaN(num) && num > 0) return Math.floor(num);

  const match = str.match(/^(\d+(?:\.\d+)?)\s*(d|day|days|h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)?$/);
  if (match) {
    const amount = parseFloat(match[1]);
    const unit = match[2] || 's';
    if (unit.startsWith('d')) return Math.floor(amount * 86400);
    if (unit.startsWith('h')) return Math.floor(amount * 3600);
    if (unit.startsWith('m')) return Math.floor(amount * 60);
    return Math.floor(amount);
  }
  return 86400;
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days} Day${days > 1 ? 's' : ''}${hours > 0 ? ` ${hours} hr` : ''}`;
  }
  if (hours > 0) {
    return `${hours} Hour${hours > 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} min` : ''}`;
  }
  return `${minutes || 1} Min`;
}

// Read configured session expiration from env (default: 86400s = 1 day)
const configuredSeconds = parseDurationSeconds(
  process.env.NEXT_PUBLIC_SESSION_INACTIVITY_TIMEOUT_SECONDS ||
  process.env.NEXT_PUBLIC_SESSION_EXPIRATION_SECONDS ||
  process.env.NEXT_PUBLIC_SESSION_TIMEOUT_SECONDS
);

const INACTIVITY_TIMEOUT_MS = configuredSeconds * 1000;
const WARNING_BEFORE_LOGOUT_MS = configuredSeconds >= 3600 ? 5 * 60 * 1000 : Math.min(60 * 1000, INACTIVITY_TIMEOUT_MS / 2);
const WARNING_THRESHOLD_MS = Math.max(0, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_LOGOUT_MS);

export default function SessionTimeoutHandler() {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(Math.floor(WARNING_BEFORE_LOGOUT_MS / 1000));
  const lastActivityRef = useRef<number>(Date.now());
  const isLoggingOutRef = useRef<boolean>(false);

  // Reset user activity timestamp & keep session alive
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showWarning) {
      setShowWarning(false);
      // Ping auth endpoint to keep server session refreshed
      fetch('/api/auth/me').catch(() => {});
    }
  }, [showWarning]);

  // Handle immediate logout
  const handleLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    try {
      await logout();
    } catch {
      window.location.href = '/login?reason=timeout';
    }
  }, []);

  // Monitor user events (mouse, keyboard, touch, scroll)
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];

    let throttleTimeout: NodeJS.Timeout | null = null;
    const handleUserInteraction = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          resetActivity();
          throttleTimeout = null;
        }, 1000);
      }
    };

    events.forEach((evt) => {
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserInteraction);
      });
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [resetActivity]);

  // Main inactivity checker interval
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        // Timed out completely! Auto logout
        handleLogout();
      } else if (elapsed >= WARNING_THRESHOLD_MS) {
        // In the warning zone
        const remaining = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - elapsed) / 1000));
        setSecondsRemaining(remaining);
        setShowWarning(true);
      } else {
        if (showWarning) {
          setShowWarning(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [handleLogout, showWarning]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div className="w-full max-w-sm rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl dark:border-amber-900/60 dark:bg-slate-900 animate-in zoom-in-95 duration-200 space-y-4">
        {/* Header with Security Alert Icon */}
        <div className="flex items-center space-x-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Session Expiration Warning
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Session Lifetime: {formatDuration(configuredSeconds)}
            </p>
          </div>
        </div>

        {/* Message and Countdown Display */}
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 dark:border-amber-950/50 dark:bg-amber-950/30 text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 text-amber-700 dark:text-amber-300">
            <Clock className="h-4 w-4 animate-pulse" />
            <span className="text-xs font-semibold">
              Session will expire in
            </span>
          </div>

          <div className="font-mono text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
            {secondsRemaining}s
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Your session is about to expire. Click below to refresh your session and stay logged in.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2 pt-1">
          <button
            type="button"
            onClick={resetActivity}
            className="flex w-full items-center justify-center space-x-2 rounded-2xl bg-blue-600 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-98 transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Stay Logged In</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center space-x-2 rounded-2xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
