'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  User,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  Smartphone,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Users,
  ChevronRight,
  Shield,
  Sparkles,
  RefreshCw,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { useFinanceData } from '@/lib/data/DataContext';
import {
  getProfileData,
  updateProfileCombinedAction,
  changePinAction,
  revokeDeviceTrustAction,
  ProfileData,
} from './actions';
import PushNotificationCard from '@/components/notifications/PushNotificationCard';

export default function ProfilePage() {
  const { currentUser, updateCurrentUser, isDemoMode, refreshData } = useFinanceData();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Form Fields
  const [fullNameInput, setFullNameInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const loadProfile = async () => {
    setLoading(true);
    const res = await getProfileData();
    if (res.success && res.profile) {
      setProfile(res.profile);
      setFullNameInput(res.profile.full_name);
      if (res.profile.full_name) {
        updateCurrentUser({ full_name: res.profile.full_name });
      }
    } else {
      showToast('error', res.error || 'Failed to load profile.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleUnifiedSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullNameInput.trim()) {
      showToast('error', 'Name cannot be empty.');
      return;
    }

    const fullPin = pinDigits.join('');
    if (fullPin.length > 0 && fullPin.length < 4) {
      showToast('error', 'Please enter all 4 digits for your security PIN or leave it empty.');
      return;
    }

    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) {
        showToast('error', 'New password must be at least 6 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast('error', 'Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    const res = await updateProfileCombinedAction({
      fullName: fullNameInput.trim(),
      newPassword: newPassword ? newPassword : undefined,
      confirmPassword: confirmPassword ? confirmPassword : undefined,
      pin: fullPin.length === 4 ? fullPin : undefined,
    });
    setIsSubmitting(false);

    if (res.success) {
      const summaryList = res.updatedFields && res.updatedFields.length > 0
        ? res.updatedFields.join(', ')
        : 'Profile';
      showToast('success', `${summaryList} updated successfully.`);
      if (profile) {
        setProfile({
          ...profile,
          full_name: fullNameInput.trim(),
          has_pin: res.hasPin !== undefined ? res.hasPin : profile.has_pin,
        });
      }
      // Instantly update header greeting live in state without reload:
      updateCurrentUser({ full_name: fullNameInput.trim() });
      setNewPassword('');
      setConfirmPassword('');
      setPinDigits(['', '', '', '']);
      refreshData();
    } else {
      showToast('error', res.error || 'Failed to update profile settings.');
    }
  };

  const handlePinDigitChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const updated = [...pinDigits];
    updated[index] = digit;
    setPinDigits(updated);

    if (digit && index < 3) {
      const nextInput = document.getElementById(`pin-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handlePinDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      const prevInput = document.getElementById(`pin-input-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleRemovePin = async () => {
    if (!confirm('Are you sure you want to disable 4-digit PIN authentication for your account?')) {
      return;
    }

    setIsSubmitting(true);
    const res = await changePinAction(null);
    setIsSubmitting(false);

    if (res.success) {
      showToast('success', 'Security PIN has been removed.');
      setPinDigits(['', '', '', '']);
      if (profile) setProfile({ ...profile, has_pin: false });
      refreshData();
    } else {
      showToast('error', res.error || 'Failed to remove PIN.');
    }
  };


  const handleRevokeTrust = async () => {
    if (!confirm('Are you sure you want to revoke trusted device status on this browser?')) {
      return;
    }

    setIsSubmitting(true);
    const res = await revokeDeviceTrustAction();
    setIsSubmitting(false);

    if (res.success) {
      showToast('success', 'Trusted device status revoked for this browser.');
      await loadProfile();
    } else {
      showToast('error', res.error || 'Failed to revoke trust.');
    }
  };

  const avatarLetter = (fullNameInput || profile?.full_name || currentUser?.full_name || 'S')
    .trim()
    .charAt(0)
    .toUpperCase();

  const isSuperAdmin = profile?.role === 'superadmin' || currentUser?.role === 'superadmin';

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center space-x-2 rounded-2xl px-5 py-3 shadow-2xl transition-all ${toastMessage.type === 'success'
              ? 'bg-[#18221B] text-[#A7D7B5] dark:bg-[#A7D7B5] dark:text-[#0C2417] border border-[#A7D7B5]/30'
              : 'bg-rose-600 text-white'
            }`}
        >
          {toastMessage.type === 'success' ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span className="text-xs font-semibold">{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#18221B] dark:text-[#F0F4F1]">
            Profile & Security
          </h1>
          <p className="text-xs text-[#7A887E] dark:text-[#8E9E94] mt-0.5">
            Manage your credentials, 4-digit PIN authentication, and trusted devices in one place.
          </p>
        </div>

        {isSuperAdmin && (
          <Link
            href="/users"
            className="inline-flex items-center space-x-2 rounded-2xl bg-[#18221B] dark:bg-[#A7D7B5] px-4 py-2.5 text-xs font-semibold text-white dark:text-[#0C2417] shadow-sm hover:opacity-95 transition-opacity shrink-0"
          >
            <Users className="h-4 w-4" />
            <span>User Management</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          </Link>
        )}
      </div>

      {/* Overview Card */}
      <div className="rounded-3xl border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center space-x-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E5EFE8] dark:bg-[#202B24] text-xl font-bold text-[#4D6A58] dark:text-[#A7D7B5] ring-2 ring-black/5 dark:ring-white/10 shrink-0">
              {avatarLetter}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-[#18221B] dark:text-[#F0F4F1]">
                  {loading ? 'Loading...' : fullNameInput || profile?.full_name || 'Personal Account'}
                </h2>
                {isSuperAdmin ? (
                  <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Super Admin</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 rounded-full bg-slate-100 dark:bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                    <User className="h-3 w-3" />
                    <span>Member</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#7A887E] dark:text-[#8E9E94] mt-0.5">
                {profile?.email || (isDemoMode ? 'guest@pocketlog.app' : 'Authenticated User')}
              </p>
            </div>
          </div>

          {/* Quick Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {profile?.has_pin ? (
              <span className="inline-flex items-center space-x-1.5 rounded-xl bg-[#E5EFE8] dark:bg-[#1E2B22] px-3 py-1.5 text-xs font-semibold text-[#4D6A58] dark:text-[#A7D7B5]">
                <KeyRound className="h-3.5 w-3.5" />
                <span>PIN Active</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>No PIN Configured</span>
              </span>
            )}

            {profile?.is_trusted_device ? (
              <span className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <Smartphone className="h-3.5 w-3.5" />
                <span>Trusted Device</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 rounded-xl bg-slate-100 dark:bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <Smartphone className="h-3.5 w-3.5" />
                <span>Standard Device</span>
              </span>
            )}

            {/* Reach Me / Portfolio Badge */}
            <a
              href="https://stevanprb.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 border border-blue-500/20 transition-colors"
              title="Reach Me • stevanprb.com"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Reach Me</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          </div>
        </div>
      </div>

      {/* Push Notification Reminders (Daily, Weekly, Monthly) */}
      <PushNotificationCard />

      {/* Unified User Update Form (Single Submit Button) */}
      <form onSubmit={handleUnifiedSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 1: Personal Details */}
          <div className="rounded-3xl border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2.5 mb-4">
                <div className="p-2 rounded-xl bg-[#F6F7F5] dark:bg-[#1F2822] text-[#4D6A58] dark:text-[#A7D7B5]">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm text-[#18221B] dark:text-[#F0F4F1]">
                  Personal Information
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[#7A887E] dark:text-[#8E9E94] uppercase tracking-wider mb-1.5">
                    Full Name*
                  </label>
                  <input
                    type="text"
                    value={fullNameInput}
                    onChange={(e) => setFullNameInput(e.target.value)}
                    placeholder='Full Name'
                    className="w-full rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-[#F6F7F5] dark:bg-[#1F2822] px-4 py-2.5 text-xs font-medium text-[#18221B] dark:text-[#F0F4F1] focus:outline-none focus:ring-2 focus:ring-[#4D6A58]/30"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#7A887E] dark:text-[#8E9E94] uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    className="w-full rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-[#7A887E] dark:text-[#8E9E94] cursor-not-allowed opacity-80"
                  />
                  <p className="text-[10px] text-[#7A887E] dark:text-[#8E9E94] mt-1">
                    Email address serves as your primary login identifier.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Password Management */}
          <div className="rounded-3xl border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2.5 mb-4">
                <div className="p-2 rounded-xl bg-[#F6F7F5] dark:bg-[#1F2822] text-[#4D6A58] dark:text-[#A7D7B5]">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#18221B] dark:text-[#F0F4F1]">
                    Change Password
                  </h3>
                  <p className="text-[11px] text-[#7A887E] dark:text-[#8E9E94]">
                    Leave blank if you wish to keep your existing password.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[#7A887E] dark:text-[#8E9E94] uppercase tracking-wider mb-1.5">
                    New Password (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-[#F6F7F5] dark:bg-[#1F2822] px-4 py-2.5 pr-10 text-xs font-medium text-[#18221B] dark:text-[#F0F4F1] focus:outline-none focus:ring-2 focus:ring-[#4D6A58]/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#7A887E] dark:text-[#8E9E94] uppercase tracking-wider mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-[#F6F7F5] dark:bg-[#1F2822] px-4 py-2.5 text-xs font-medium text-[#18221B] dark:text-[#F0F4F1] focus:outline-none focus:ring-2 focus:ring-[#4D6A58]/30"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: 4-Digit Security PIN */}
          <div className="rounded-3xl border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-6 shadow-xs flex flex-col justify-between md:col-span-2">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-[#F6F7F5] dark:bg-[#1F2822] text-[#4D6A58] dark:text-[#A7D7B5]">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#18221B] dark:text-[#F0F4F1]">
                      4-Digit Security PIN
                    </h3>
                    <p className="text-[11px] text-[#7A887E] dark:text-[#8E9E94]">
                      Used for quick unlock on verified trusted devices.
                    </p>
                  </div>
                </div>

                {profile?.has_pin && (
                  <button
                    type="button"
                    onClick={handleRemovePin}
                    disabled={isSubmitting}
                    className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    Disable PIN
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[#7A887E] dark:text-[#8E9E94] uppercase tracking-wider mb-2">
                    {profile?.has_pin ? 'Set New 4-Digit PIN (Optional)' : 'Enter 4-Digit PIN (Optional)'}
                  </label>
                  <div className="flex items-center space-x-3">
                    {[0, 1, 2, 3].map((index) => (
                      <input
                        key={index}
                        id={`pin-input-${index}`}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={pinDigits[index]}
                        onChange={(e) => handlePinDigitChange(index, e.target.value)}
                        onKeyDown={(e) => handlePinDigitKeyDown(index, e)}
                        className="h-12 w-12 rounded-2xl border border-black/[0.1] dark:border-white/[0.1] bg-[#F6F7F5] dark:bg-[#1F2822] text-center text-lg font-bold text-[#18221B] dark:text-[#F0F4F1] focus:outline-none focus:ring-2 focus:ring-[#4D6A58]"
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-[#7A887E] dark:text-[#8E9E94] mt-2">
                    Leave boxes empty to keep your existing PIN configuration.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Unified Submit Bar (One Single Button for All Profile Changes) */}
        <div className="rounded-3xl border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-[#18221B] dark:text-[#F0F4F1]">
              Save Profile Changes
            </h4>
            <p className="text-xs text-[#7A887E] dark:text-[#8E9E94] mt-0.5">
              Update your name, password, or security PIN.
            </p>
          </div>
          <div className="flex items-center space-x-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (profile) setFullNameInput(profile.full_name);
                setNewPassword('');
                setConfirmPassword('');
                setPinDigits(['', '', '', '']);
              }}
              disabled={isSubmitting}
              className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-[#F6F7F5] dark:bg-[#1F2822] px-4 py-2.5 text-xs font-semibold text-[#7A887E] dark:text-[#8E9E94] hover:text-[#18221B] dark:hover:text-[#F0F4F1] transition-colors cursor-pointer"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-2 rounded-2xl bg-[#5B7966] hover:bg-[#4D6A58] text-white dark:bg-[#A7D7B5] dark:text-[#0C2417] dark:hover:bg-[#95D5B2] px-6 py-2.5 text-xs font-bold shadow-md active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
