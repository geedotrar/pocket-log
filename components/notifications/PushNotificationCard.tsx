'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  Check,
  AlertCircle,
  Smartphone,
  Info,
  Calendar,
  Clock,
  Send,
  Loader2,
  Share,
} from 'lucide-react';
import {
  isPushNotificationSupported,
  isIOSDevice,
  isPWAStandalone,
  getCurrentPushSubscription,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  PushPreferences,
} from '@/lib/notifications/pushClient';

export default function PushNotificationCard() {
  const [supported, setSupported] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [preferences, setPreferences] = useState<PushPreferences>({
    notify_daily: true,
    notify_weekly: true,
    notify_monthly: true,
  });

  useEffect(() => {
    const isSup = isPushNotificationSupported();
    setSupported(isSup);
    setIsIOS(isIOSDevice());
    setIsStandalone(isPWAStandalone());

    if (isSup) {
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const checkSubscription = async () => {
    setLoading(true);
    try {
      const sub = await getCurrentPushSubscription();
      setIsSubscribed(Boolean(sub));
    } catch (err) {
      console.warn('Could not check subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubscription = async () => {
    setToggling(true);
    setMessage(null);

    if (isSubscribed) {
      const res = await unsubscribeFromPushNotifications();
      if (res.success) {
        setIsSubscribed(false);
        showToast('success', 'Notifications disabled on this device.');
      } else {
        showToast('error', res.error || 'Failed to disable notifications.');
      }
    } else {
      const res = await subscribeToPushNotifications(preferences);
      if (res.success) {
        setIsSubscribed(true);
        showToast('success', 'Notifications enabled! Daily reminders will be sent to this device.');
      } else {
        showToast('error', res.error || 'Failed to enable notifications.');
      }
    }
    setToggling(false);
  };

  const handlePreferenceChange = async (key: keyof PushPreferences, val: boolean) => {
    const updated = { ...preferences, [key]: val };
    setPreferences(updated);

    if (isSubscribed) {
      await subscribeToPushNotifications(updated);
      showToast('success', 'Reminder preferences updated.');
    }
  };

  const handleSendTestPush = async () => {
    setSendingTest(true);
    setMessage(null);

    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast('success', data.message || 'Test notification sent successfully!');
      } else {
        showToast('error', data.error || 'Failed to send test notification.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to connect to server.');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="rounded-3xl border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-6 shadow-xs space-y-5">
      {/* Toast Notification */}
      {message && (
        <div
          className={`flex items-center space-x-2.5 rounded-2xl p-3.5 text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-200 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 border border-emerald-500/20'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300 border border-rose-500/20'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Card Header */}
      <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
        <div className="flex items-center space-x-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E5EFE8] dark:bg-[#1E2B22] text-[#4D6A58] dark:text-[#A7D7B5] shrink-0">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#18221B] dark:text-[#F0F4F1] flex items-center gap-2">
              <span>Push Reminders (PWA)</span>
              {isSubscribed && (
                <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Active</span>
                </span>
              )}
            </h3>
            <p className="text-xs text-[#7A887E] dark:text-[#8E9E94] mt-0.5">
              Receive reminders directly on your lock screen and banner without opening the app.
            </p>
          </div>
        </div>

        {/* Action Toggle Button */}
        {supported && (
          <button
            type="button"
            onClick={handleToggleSubscription}
            disabled={loading || toggling}
            className={`inline-flex items-center space-x-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 shrink-0 ${
              isSubscribed
                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
                : 'bg-[#5B7966] hover:bg-[#4D6A58] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] dark:hover:bg-[#95D5B2]'
            }`}
          >
            {toggling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : isSubscribed ? (
              <>
                <span>Disable Notifications</span>
              </>
            ) : (
              <>
                <BellRing className="h-4 w-4" />
                <span>Enable Notifications</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* iOS Standalone Mode Guidance Warning */}
      {isIOS && !isStandalone && (
        <div className="flex items-start space-x-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-800 dark:text-amber-300">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <span className="font-bold block">iPhone / iPad Setup:</span>
            <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
              Apple requires web apps to be installed to the Home Screen to receive notifications. Tap{' '}
              <strong className="inline-flex items-center gap-1 font-semibold underline">
                <Share className="h-3 w-3 inline" /> Share
              </strong>{' '}
              in Safari, select <strong>&quot;Add to Home Screen&quot;</strong>, then open PocketLog from your Home Screen to enable notifications.
            </p>
          </div>
        </div>
      )}

      {/* Unsupported Browser Alert */}
      {!supported && (
        <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/[0.06] dark:border-white/10 p-4 text-xs text-[#7A887E] dark:text-[#8E9E94]">
          <p>
            This browser does not support Web Push Notifications. Please use Google Chrome on Android or Safari on iOS 16.4+ (installed via Add to Home Screen).
          </p>
        </div>
      )}

      {/* Preferences Section (Visible when subscribed or capable) */}
      <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06] space-y-3">
        <h4 className="text-xs font-bold text-[#18221B] dark:text-[#F0F4F1] uppercase tracking-wider">
          Reminder Preferences
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 1. Daily Expense Reminder */}
          <label className="flex items-start space-x-3 rounded-2xl border border-black/[0.06] dark:border-white/8 bg-[#F6F7F5] dark:bg-[#1A211D] p-3.5 cursor-pointer hover:border-[#5B7966]/40 transition-colors">
            <input
              type="checkbox"
              checked={preferences.notify_daily}
              onChange={(e) => handlePreferenceChange('notify_daily', e.target.checked)}
              className="mt-0.5 rounded text-[#5B7966] focus:ring-[#5B7966]"
            />
            <div className="min-w-0">
              <span className="text-xs font-bold text-[#18221B] dark:text-[#F0F4F1] flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-[#5B7966] dark:text-[#A7D7B5]" />
                <span>Daily Expense Reminder</span>
              </span>
              <p className="text-[11px] text-[#7A887E] dark:text-[#8E9E94] mt-1 leading-snug">
                Alerts you if no expenses have been recorded for the day.
              </p>
            </div>
          </label>

          {/* 2. Debt & Loan Due Date Alerts */}
          <label className="flex items-start space-x-3 rounded-2xl border border-black/[0.06] dark:border-white/8 bg-[#F6F7F5] dark:bg-[#1A211D] p-3.5 cursor-pointer hover:border-[#5B7966]/40 transition-colors">
            <input
              type="checkbox"
              checked={preferences.notify_weekly}
              onChange={(e) => handlePreferenceChange('notify_weekly', e.target.checked)}
              className="mt-0.5 rounded text-[#5B7966] focus:ring-[#5B7966]"
            />
            <div className="min-w-0">
              <span className="text-xs font-bold text-[#18221B] dark:text-[#F0F4F1] flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-[#5B7966] dark:text-[#A7D7B5]" />
                <span>Due Date Alerts</span>
              </span>
              <p className="text-[11px] text-[#7A887E] dark:text-[#8E9E94] mt-1 leading-snug">
                Alerts you when payables or receivables are due today.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Test Notification Action */}
      {isSubscribed && (
        <div className="pt-2 flex items-center justify-between gap-4 flex-col sm:flex-row bg-[#F6F7F5] dark:bg-[#1A211D] p-4 rounded-2xl border border-black/[0.04] dark:border-white/8">
          <div>
            <span className="text-xs font-bold text-[#18221B] dark:text-[#F0F4F1] block">
              Test Notification
            </span>
            <p className="text-[11px] text-[#7A887E] dark:text-[#8E9E94] mt-0.5">
              Send an instant test notification to check your banner and lock screen display.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSendTestPush}
            disabled={sendingTest}
            className="inline-flex items-center space-x-2 rounded-xl bg-white dark:bg-[#202B24] border border-black/[0.08] dark:border-white/10 px-4 py-2 text-xs font-bold text-[#18221B] dark:text-[#F0F4F1] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer shrink-0 disabled:opacity-50"
          >
            {sendingTest ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 text-[#5B7966] dark:text-[#A7D7B5]" />
                <span>Send Test</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

