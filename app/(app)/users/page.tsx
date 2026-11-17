'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  Edit2,
  Trash2,
  Search,
  Check,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Smartphone,
  RefreshCw,
} from 'lucide-react';
import { useFinanceData } from '@/lib/data/DataContext';
import { User, UserRole } from '@/lib/types';
import {
  getUsersList,
  createUserAction,
  updateUserAction,
  setUserPasswordAction,
  setUserPinAction,
  deleteUserAction,
} from './actions';

export default function UserManagementPage() {
  const { currentUser, isDemoMode } = useFinanceData();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'superadmin' | 'user'>('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);
  const [pinModalUser, setPinModalUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  // Notifications
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');

  // Password reset state
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // PIN modal state
  const [pinInput, setPinInput] = useState('');

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadUsers = async () => {
    setLoading(true);
    const res = await getUsersList();
    if (res.success && res.users) {
      setUsers(res.users);
    } else if (res.error) {
      showToast('error', res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const superadmins = users.filter((u) => u.role === 'superadmin').length;
    const standardUsers = users.filter((u) => u.role === 'user').length;
    const pinActive = users.filter((u) => u.has_pin).length;
    return { total, superadmins, standardUsers, pinActive };
  }, [users]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await createUserAction({
      email: newEmail,
      fullName: newFullName,
      role: newRole,
      password: newPassword || undefined,
      pin: newPin || undefined,
    });
    setIsSubmitting(false);

    if (res.success) {
      showToast('success', `User ${newEmail} created successfully.`);
      setIsAddModalOpen(false);
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setNewPin('');
      setNewRole('user');
      loadUsers();
    } else {
      showToast('error', res.error || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmitting(true);
    const res = await updateUserAction({
      userId: editingUser.id,
      fullName: editingUser.full_name || '',
      email: editingUser.email,
      role: editingUser.role,
    });
    setIsSubmitting(false);

    if (res.success) {
      showToast('success', 'User profile updated.');
      setEditingUser(null);
      loadUsers();
    } else {
      showToast('error', res.error || 'Failed to update user');
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    setIsSubmitting(true);
    const res = await setUserPasswordAction(passwordModalUser.id, passwordInput);
    setIsSubmitting(false);

    if (res.success) {
      showToast('success', `Password updated for ${passwordModalUser.email}.`);
      setPasswordModalUser(null);
      setPasswordInput('');
    } else {
      showToast('error', res.error || 'Failed to update password');
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModalUser) return;
    setIsSubmitting(true);
    const res = await setUserPinAction(pinModalUser.id, pinInput || null);
    setIsSubmitting(false);

    if (res.success) {
      showToast('success', pinInput ? `4-digit PIN updated for ${pinModalUser.email}.` : `PIN removed for ${pinModalUser.email}.`);
      setPinModalUser(null);
      setPinInput('');
      loadUsers();
    } else {
      showToast('error', res.error || 'Failed to update PIN');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    setIsSubmitting(true);
    const res = await deleteUserAction(deleteConfirmUser.id);
    setIsSubmitting(false);

    if (res.success) {
      showToast('success', `User ${deleteConfirmUser.email} deleted.`);
      setDeleteConfirmUser(null);
      loadUsers();
    } else {
      showToast('error', res.error || 'Failed to delete user');
    }
  };

  const isSuperAdmin = currentUser?.role === 'superadmin';

  if (!loading && !isSuperAdmin && !isDemoMode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-[#18221B] dark:text-[#F0F4F1]">Access Restricted</h2>
        <p className="text-xs text-[#76847A] dark:text-[#8E9E94] mt-2 max-w-sm">
          User Management is strictly reserved for Superadmin accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 lg:pb-12 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          {toastMessage.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 rounded-full bg-[#E5EFE8] dark:bg-[#1E2B22] px-3 py-1 text-xs font-semibold text-[#4D6A58] dark:text-[#A7D7B5]">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Superadmin</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18221B] dark:text-[#F0F4F1] mt-2">
            User Management
          </h1>
          <p className="text-xs text-[#76847A] dark:text-[#8E9E94] mt-1">
            Manage user accounts, roles, and security PINs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadUsers}
            title="Refresh user list"
            className="p-2.5 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#161D18] text-[#76847A] hover:text-[#18221B] dark:hover:text-[#F0F4F1] transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center space-x-2 rounded-2xl bg-[#5B7966] dark:bg-[#A7D7B5] px-4 py-2.5 text-xs font-bold text-white dark:text-[#0C2417] shadow-sm hover:bg-[#4D6A58] dark:hover:bg-[#95D5B2] transition-transform active:scale-95 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">Total Users</span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1] mt-1 tabular-nums">
              {stats.total}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#E5EFE8] dark:bg-[#1E2B22] text-[#4D6A58] dark:text-[#A7D7B5] flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">Superadmins</span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#5B7966] dark:text-[#A7D7B5] mt-1 tabular-nums">
              {stats.superadmins}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">Standard Users</span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1] mt-1 tabular-nums">
              {stats.standardUsers}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#F6F7F5] dark:bg-[#1F2822] text-[#76847A] dark:text-[#8E9E94] flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-[28px] bg-white dark:bg-[#161D18] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#76847A] dark:text-[#8E9E94] block">PIN Protected</span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#18221B] dark:text-[#F0F4F1] mt-1 tabular-nums">
              {stats.pinActive}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Smartphone className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-[28px] border border-black/[0.04] bg-white p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.035)] dark:border-white/[0.06] dark:bg-[#161D18]">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#76847A] dark:text-[#8E9E94]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email address..."
            className="w-full rounded-2xl border border-black/[0.04] bg-[#F6F7F5] py-2 pl-9.5 pr-4 text-xs text-[#18221B] placeholder-[#8E9B92] focus:outline-none dark:border-white/[0.06] dark:bg-[#1F2822] dark:text-[#F0F4F1]"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="rounded-2xl border border-black/[0.04] bg-[#F6F7F5] px-3.5 py-2 text-xs font-semibold text-[#18221B] focus:outline-none dark:border-white/[0.06] dark:bg-[#1F2822] dark:text-[#F0F4F1]"
          >
            <option value="all">All Roles</option>
            <option value="superadmin">Superadmins</option>
            <option value="user">Standard Users</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-[28px] border border-black/[0.04] bg-white dark:border-white/[0.06] dark:bg-[#161D18] shadow-[0_8px_30px_rgba(0,0,0,0.035)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#76847A] dark:text-[#8E9E94] flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-[#5B7966]" />
            <span>Loading user directory...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#76847A] dark:text-[#8E9E94]">
            No users match your search query or filter.
          </div>
        ) : (
          <>
            {/* Desktop Full Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.04] dark:border-white/[0.06] bg-[#F6F7F5]/50 dark:bg-[#1F2822]/50 text-[11px] font-bold text-[#76847A] dark:text-[#8E9E94] uppercase tracking-wider">
                    <th className="py-3.5 px-5">User</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">4-Digit PIN</th>
                    <th className="py-3.5 px-4">Created Date</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06] text-xs">
                  {filteredUsers.map((u) => {
                    const isCurrent = currentUser?.id === u.id;
                    const initial = (u.full_name || u.email).charAt(0).toUpperCase();

                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-black/[0.01] dark:hover:bg-white/[0.02] transition-colors"
                      >
                        {/* User Info */}
                        <td className="py-4 px-5">
                          <div className="flex items-center space-x-3">
                            <div className="h-9 w-9 rounded-2xl bg-[#E5EFE8] dark:bg-[#202B24] text-[#4D6A58] dark:text-[#A7D7B5] flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                              {initial}
                            </div>
                            <div>
                              <div className="font-bold text-[#18221B] dark:text-[#F0F4F1] flex items-center gap-1.5">
                                <span>{u.full_name || 'No Name'}</span>
                                {isCurrent && (
                                  <span className="rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] px-2 py-0.5 font-bold">
                                    You
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-[#76847A] dark:text-[#8E9E94] block mt-0.5">
                                {u.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                              u.role === 'superadmin'
                                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                                : 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border border-zinc-500/20'
                            }`}
                          >
                            {u.role === 'superadmin' ? (
                              <ShieldCheck className="h-3 w-3" />
                            ) : (
                              <Users className="h-3 w-3" />
                            )}
                            <span>{u.role === 'superadmin' ? 'Superadmin' : 'Standard User'}</span>
                          </span>
                        </td>

                        {/* PIN Status */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {u.has_pin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              <Check className="h-3 w-3" />
                              <span>Active (4-Digit)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
                              <X className="h-3 w-3" />
                              <span>Not Configured</span>
                            </span>
                          )}
                        </td>

                        {/* Created At */}
                        <td className="py-4 px-4 whitespace-nowrap text-[#76847A] dark:text-[#8E9E94] text-[11px]">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Details */}
                            <button
                              type="button"
                              onClick={() => setEditingUser(u)}
                              title="Edit User Information"
                              className="p-1.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06] hover:bg-black/5 dark:hover:bg-white/10 text-[#76847A] hover:text-[#18221B] dark:hover:text-[#F0F4F1] transition-colors cursor-pointer"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>

                            {/* Set/Change Password */}
                            <button
                              type="button"
                              onClick={() => {
                                setPasswordModalUser(u);
                                setPasswordInput('');
                              }}
                              title="Reset / Set Password"
                              className="p-1.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06] hover:bg-black/5 dark:hover:bg-white/10 text-[#76847A] hover:text-[#18221B] dark:hover:text-[#F0F4F1] transition-colors cursor-pointer"
                            >
                              <Lock className="h-3.5 w-3.5" />
                            </button>

                            {/* Set/Change PIN */}
                            <button
                              type="button"
                              onClick={() => {
                                setPinModalUser(u);
                                setPinInput('');
                              }}
                              title="Change / Set 4-Digit PIN"
                              className="p-1.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06] hover:bg-black/5 dark:hover:bg-white/10 text-[#76847A] hover:text-[#18221B] dark:hover:text-[#F0F4F1] transition-colors cursor-pointer"
                            >
                              <Smartphone className="h-3.5 w-3.5" />
                            </button>

                            {/* Delete User */}
                            <button
                              type="button"
                              disabled={isCurrent}
                              onClick={() => setDeleteConfirmUser(u)}
                              title={isCurrent ? 'You cannot delete yourself' : 'Delete User'}
                              className={`p-1.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06] transition-colors cursor-pointer ${
                                isCurrent
                                  ? 'opacity-30 cursor-not-allowed text-zinc-400'
                                  : 'text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/30'
                              }`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Native Card View (< md) */}
            <div className="block md:hidden divide-y divide-black/[0.04] dark:divide-white/[0.06]">
              {filteredUsers.map((u) => {
                const isCurrent = currentUser?.id === u.id;
                const initial = (u.full_name || u.email).charAt(0).toUpperCase();

                return (
                  <div key={u.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="h-10 w-10 rounded-2xl bg-[#E5EFE8] dark:bg-[#202B24] text-[#4D6A58] dark:text-[#A7D7B5] flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-[#18221B] dark:text-[#F0F4F1] flex items-center gap-1.5">
                            <span className="truncate">{u.full_name || 'No Name'}</span>
                            {isCurrent && (
                              <span className="rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] px-2 py-0.5 font-bold shrink-0">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#76847A] dark:text-[#8E9E94] block mt-0.5 truncate">
                            {u.email}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          u.role === 'superadmin'
                            ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                            : 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border border-zinc-500/20'
                        }`}
                      >
                        {u.role === 'superadmin' ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <Users className="h-3 w-3" />
                        )}
                        <span>{u.role === 'superadmin' ? 'Superadmin' : 'Standard'}</span>
                      </span>

                      {u.has_pin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          <Check className="h-3 w-3" />
                          <span>PIN Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
                          <X className="h-3 w-3" />
                          <span>No PIN</span>
                        </span>
                      )}

                      <span className="text-[10px] text-[#76847A] dark:text-[#8E9E94] ml-auto">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                      </span>
                    </div>

                    {/* Mobile Touch Action Buttons with 40px+ Height */}
                    <div className="flex items-center gap-2 pt-1 border-t border-black/[0.03] dark:border-white/[0.04]">
                      <button
                        type="button"
                        onClick={() => setEditingUser(u)}
                        className="flex-1 py-2 px-3 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#F6F7F5] dark:bg-[#1F2822] text-[#18221B] dark:text-[#F0F4F1] text-[11px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform min-h-[38px]"
                      >
                        <Edit2 className="h-3 w-3 text-[#5B7966]" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPasswordModalUser(u);
                          setPasswordInput('');
                        }}
                        className="flex-1 py-2 px-3 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#F6F7F5] dark:bg-[#1F2822] text-[#18221B] dark:text-[#F0F4F1] text-[11px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform min-h-[38px]"
                      >
                        <Lock className="h-3 w-3 text-[#5B7966]" />
                        <span>Password</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPinModalUser(u);
                          setPinInput('');
                        }}
                        className="flex-1 py-2 px-3 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-[#F6F7F5] dark:bg-[#1F2822] text-[#18221B] dark:text-[#F0F4F1] text-[11px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform min-h-[38px]"
                      >
                        <Smartphone className="h-3 w-3 text-[#5B7966]" />
                        <span>PIN</span>
                      </button>

                      <button
                        type="button"
                        disabled={isCurrent}
                        onClick={() => setDeleteConfirmUser(u)}
                        aria-label="Delete User"
                        className={`p-2 rounded-xl border border-black/[0.06] dark:border-white/[0.08] active:scale-95 transition-transform min-h-[38px] min-w-[38px] flex items-center justify-center ${
                          isCurrent
                            ? 'opacity-30 cursor-not-allowed text-zinc-400 bg-black/5 dark:bg-white/5'
                            : 'text-rose-500 bg-rose-500/10 hover:bg-rose-500/20'
                        }`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* MODAL 1: ADD USER */}
      {isAddModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-md rounded-t-[32px] sm:rounded-3xl bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-2xl border-t sm:border border-black/[0.04] dark:border-white/[0.08] max-h-[92dvh] sm:max-h-[88vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.06]">
              <h3 className="font-bold text-base text-[#18221B] dark:text-[#F0F4F1] flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-[#5B7966] dark:text-[#A7D7B5]" />
                <span>Create New User</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-full p-2 text-[#76847A] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-3.5 py-2.5 text-base sm:text-xs text-[#18221B] focus:outline-none dark:border-white/[0.08] dark:bg-[#1F2822] dark:text-[#F0F4F1]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-3.5 py-2.5 text-base sm:text-xs text-[#18221B] focus:outline-none dark:border-white/[0.08] dark:bg-[#1F2822] dark:text-[#F0F4F1]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-3.5 py-2.5 text-base sm:text-xs text-[#18221B] focus:outline-none dark:border-white/[0.08] dark:bg-[#1F2822] dark:text-[#F0F4F1]"
                >
                  <option value="user">Standard User</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]">
                  Initial Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-3.5 py-2.5 text-base sm:text-xs text-[#18221B] focus:outline-none dark:border-white/[0.08] dark:bg-[#1F2822] dark:text-[#F0F4F1]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]">
                  4-Digit Security PIN (Optional)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="e.g. 1234"
                  className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-3.5 py-2.5 text-base sm:text-xs text-[#18221B] focus:outline-none dark:border-white/[0.08] dark:bg-[#1F2822] dark:text-[#F0F4F1]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-semibold text-[#76847A] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#5B7966] text-white hover:bg-[#4D6A58] dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT USER */}
      {editingUser && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingUser(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-md rounded-t-[32px] sm:rounded-3xl bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-2xl border-t sm:border border-black/[0.04] dark:border-white/[0.08] max-h-[92dvh] sm:max-h-[88vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.06]">
              <h3 className="font-bold text-base text-[#18221B] dark:text-[#F0F4F1]">
                Edit User Profile
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-full p-2 text-[#76847A] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4 pt-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editingUser.full_name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-3.5 py-2.5 text-base sm:text-xs text-[#18221B] focus:outline-none dark:border-white/[0.08] dark:bg-[#1F2822] dark:text-[#F0F4F1]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-3.5 py-2.5 text-base sm:text-xs text-[#18221B] focus:outline-none dark:border-white/[0.08] dark:bg-[#1F2822] dark:text-[#F0F4F1]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]">
                  Role
                </label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                  className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-3.5 py-2.5 text-base sm:text-xs text-[#18221B] focus:outline-none dark:border-white/[0.08] dark:bg-[#1F2822] dark:text-[#F0F4F1]"
                >
                  <option value="user">Standard User</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-semibold text-[#76847A] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#5B7966] text-white hover:bg-[#4D6A58] dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CHANGE/RESET PASSWORD */}
      {passwordModalUser && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPasswordModalUser(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-sm rounded-t-[32px] sm:rounded-3xl bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-2xl border-t sm:border border-black/[0.04] dark:border-white/[0.08] max-h-[92dvh] sm:max-h-[88vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.06]">
              <h3 className="font-bold text-base text-[#18221B] dark:text-[#F0F4F1] flex items-center gap-2">
                <Lock className="h-4 w-4 text-[#5B7966]" />
                <span>Reset User Password</span>
              </h3>
              <button
                type="button"
                onClick={() => setPasswordModalUser(null)}
                className="rounded-full p-2 text-[#76847A] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-[#76847A] dark:text-[#8E9E94] mt-3">
              Set a new password for <strong className="text-[#18221B] dark:text-[#F0F4F1]">{passwordModalUser.email}</strong>.
            </p>

            <form onSubmit={handleSetPassword} className="space-y-4 pt-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]">
                    New Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-[#76847A] flex items-center gap-1 cursor-pointer py-1"
                  >
                    {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-3.5 py-2.5 text-base sm:text-xs text-[#18221B] focus:outline-none dark:border-white/[0.08] dark:bg-[#1F2822] dark:text-[#F0F4F1]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-semibold text-[#76847A] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#5B7966] text-white hover:bg-[#4D6A58] dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CHANGE/SET PIN */}
      {pinModalUser && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPinModalUser(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-sm rounded-t-[32px] sm:rounded-3xl bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-2xl border-t sm:border border-black/[0.04] dark:border-white/[0.08] max-h-[92dvh] sm:max-h-[88vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.06]">
              <h3 className="font-bold text-base text-[#18221B] dark:text-[#F0F4F1] flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-[#5B7966]" />
                <span>Configure 4-Digit PIN</span>
              </h3>
              <button
                type="button"
                onClick={() => setPinModalUser(null)}
                className="rounded-full p-2 text-[#76847A] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-[#76847A] dark:text-[#8E9E94] mt-3">
              Set or clear the 4-digit security PIN for <strong className="text-[#18221B] dark:text-[#F0F4F1]">{pinModalUser.email}</strong>.
            </p>

            <form onSubmit={handleSetPin} className="space-y-4 pt-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#18221B] dark:text-[#F0F4F1]">
                  4-Digit Numeric PIN (leave empty to remove PIN)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="e.g. 1234 (empty to clear)"
                  className="w-full rounded-2xl border border-black/[0.06] bg-[#F6F7F5] px-3.5 py-3 text-center text-lg font-bold tracking-widest text-[#18221B] focus:outline-none dark:border-white/[0.08] dark:bg-[#1F2822] dark:text-[#F0F4F1]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setPinModalUser(null)}
                  className="min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-semibold text-[#76847A] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#5B7966] text-white hover:bg-[#4D6A58] dark:bg-[#A7D7B5] dark:text-[#0C2417] shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? 'Saving...' : pinInput ? 'Set PIN' : 'Remove PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: DELETE CONFIRMATION */}
      {deleteConfirmUser && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirmUser(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full sm:max-w-sm rounded-t-[32px] sm:rounded-3xl bg-white dark:bg-[#161D18] p-5 sm:p-6 shadow-2xl border-t sm:border border-black/[0.04] dark:border-white/[0.08] max-h-[92dvh] sm:max-h-[88vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Mobile Swipe Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden shrink-0" />

            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-base text-[#18221B] dark:text-[#F0F4F1]">
              Delete User Account?
            </h3>
            <p className="text-xs text-[#76847A] dark:text-[#8E9E94] mt-2 leading-relaxed">
              Are you sure you want to delete <strong className="text-[#18221B] dark:text-[#F0F4F1]">{deleteConfirmUser.email}</strong>? All associated financial data will be permanently removed.
            </p>

            <div className="flex justify-end gap-2 pt-5">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-semibold text-[#76847A] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteUser}
                className="min-h-[44px] px-5 py-2.5 rounded-2xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center"
              >
                {isSubmitting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
