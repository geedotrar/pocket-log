'use client';

import React, { useState, useEffect } from 'react';
import { LogOut, X } from 'lucide-react';
import { logout } from '@/app/(auth)/login/actions';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LogoutConfirmModal({ isOpen, onClose }: LogoutConfirmModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-full max-w-sm rounded-[28px] bg-white dark:bg-[#161D18] p-6 shadow-2xl border border-black/[0.06] dark:border-white/[0.08] relative overflow-hidden animate-in zoom-in-95 duration-200 text-center flex flex-col items-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close modal"
          className="absolute top-4 right-4 text-[#76847A] hover:text-[#18221B] dark:text-[#8E9E94] dark:hover:text-[#F0F4F1] p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Floating Icon Badge */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-8 ring-rose-500/5 mb-3.5 mt-1">
          <LogOut className="h-6 w-6 stroke-[2.2]" />
        </div>

        {/* Title & Description */}
        <h3
          id="logout-confirm-title"
          className="text-lg font-bold tracking-tight text-[#18221B] dark:text-[#F0F4F1]"
        >
          Log Out of PocketLog?
        </h3>
        <p className="text-xs text-[#76847A] dark:text-[#8E9E94] mt-1.5 leading-relaxed max-w-xs">
          Are you sure you want to end your current session? You will need to log in again to access your account.
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 w-full mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-[#F6F7F5] dark:bg-[#1F2822] text-xs font-bold text-[#18221B] dark:text-[#F0F4F1] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <form action={logout} onSubmit={() => setIsSubmitting(true)} className="w-full">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Logging Out...' : 'Log Out'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
