'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Account,
  Category,
  Transaction,
  Debt,
  MonthlyArchive,
  Cycle,
  Investment,
  InvestmentLog,
  User,
} from '../types';
import { isSupabaseConfigured, createClient } from '../supabase/client';
import {
  DEMO_ACCOUNTS,
  DEMO_CATEGORIES,
  DEMO_TRANSACTIONS,
  DEMO_DEBTS,
  DEMO_CYCLES,
  DEMO_INVESTMENTS,
  DEMO_INVESTMENT_LOGS,
  DEMO_MONTHLY_ARCHIVES,
  DEMO_USER_ID,
} from '../demo/demo-data';
import { MasterBackupPayload, isValidUuid } from '../excel/import';
import { AccountType } from '../types';

interface DataContextType {
  currentUser: User | null;
  updateCurrentUser: (userData: Partial<User>) => void;
  isDemoMode: boolean;
  isTrustedDevice: boolean;
  setIsTrustedDevice: (trusted: boolean) => void;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  debts: Debt[];
  monthlyArchives: MonthlyArchive[];
  investments: Investment[];
  investmentLogs: InvestmentLog[];
  isLoading: boolean;
  hasSupabaseConfig: boolean;
  refreshData: () => Promise<void>;
  addTransaction: (tx: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
  updateTransaction: (id: string, tx: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addAccount: (acc: Omit<Account, 'id' | 'created_at'>) => Promise<void>;
  updateAccount: (id: string, acc: Partial<Account>) => Promise<void>;
  updateAccountBudgetInclusions: (inclusions: { [accountId: string]: boolean }) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addCategory: (cat: Omit<Category, 'id' | 'created_at'>) => Promise<void>;
  updateCategory: (id: string, cat: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addDebt: (debt: Omit<Debt, 'id' | 'created_at'>) => Promise<void>;
  updateDebt: (id: string, debt: Partial<Debt>) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
  addInvestment: (inv: Omit<Investment, 'id' | 'created_at' | 'updated_at'>, sourceAccountId?: string) => Promise<void>;
  updateInvestmentValue: (id: string, newValue: number, notes?: string, date?: string) => Promise<void>;
  topUpInvestment: (id: string, amount: number, newValue?: number, sourceAccountId?: string, notes?: string, date?: string) => Promise<void>;
  withdrawInvestment: (id: string, amount: number, isFullRedemption: boolean, destAccountId?: string, notes?: string, date?: string) => Promise<void>;
  updateInvestment: (id: string, inv: Partial<Investment>) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
  importTransactions: (
    newTxList: Omit<Transaction, 'id' | 'created_at'>[],
    options?: {
      autoAccounts?: Array<{ name: string; type: AccountType; color: string }>;
      autoCategories?: Array<{ name: string; type: 'expense' | 'income'; color: string }>;
    }
  ) => Promise<number>;
  restoreFullBackup: (payload: MasterBackupPayload) => Promise<{
    accountsCount: number;
    categoriesCount: number;
    transactionsCount: number;
    debtsCount: number;
    investmentsCount: number;
    cyclesCount: number;
    archivesCount?: number;
    investmentLogsCount?: number;
  }>;
  cycleStartDate: string;
  cycles: Cycle[];
  startNewCycle: (startDate: string, accountAllocations: { id: string; budget: number; include_in_budget?: boolean }[]) => Promise<void>;
  createMonthlyArchive: (startDate: string, endDate: string, periodLabel: string) => Promise<{ archive: MonthlyArchive }>;
  restoreMonthlyArchive: (archiveId: string) => Promise<{ restoredCount: number }>;
  deleteMonthlyArchive: (archiveId: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

const DEFAULT_CATEGORIES = [
  { name: 'Food & Drinks', type: 'expense' as const, icon: 'Utensils', color: '#EF4444', is_default: true },
  { name: 'Transportation & Fuel', type: 'expense' as const, icon: 'Car', color: '#F97316', is_default: true },
  { name: 'Bills & Utilities', type: 'expense' as const, icon: 'Zap', color: '#F59E0B', is_default: true },
  { name: 'Groceries & Shopping', type: 'expense' as const, icon: 'ShoppingBag', color: '#10B981', is_default: true },
  { name: 'Entertainment & Leisure', type: 'expense' as const, icon: 'Film', color: '#06B6D4', is_default: true },
  { name: 'Healthcare & Medical', type: 'expense' as const, icon: 'HeartPulse', color: '#3B82F6', is_default: true },
  { name: 'Education & Books', type: 'expense' as const, icon: 'GraduationCap', color: '#6366F1', is_default: true },
  { name: 'Housing & Rent', type: 'expense' as const, icon: 'Home', color: '#8B5CF6', is_default: true },
  { name: 'Subscriptions', type: 'expense' as const, icon: 'CreditCard', color: '#EC4899', is_default: true },
  { name: 'Other Expenses', type: 'expense' as const, icon: 'Tag', color: '#64748B', is_default: true },
  { name: 'Debt Repayment', type: 'expense' as const, icon: 'Handshake', color: '#6366F1', is_default: true },
  { name: 'Monthly Salary', type: 'income' as const, icon: 'Briefcase', color: '#10B981', is_default: true },
  { name: 'Freelance & Bonus', type: 'income' as const, icon: 'Award', color: '#06B6D4', is_default: true },
  { name: 'Dividends & Investments', type: 'income' as const, icon: 'TrendingUp', color: '#3B82F6', is_default: true },
  { name: 'Gifts & Allowance', type: 'income' as const, icon: 'Gift', color: '#8B5CF6', is_default: true },
  { name: 'Debt Settlement', type: 'income' as const, icon: 'HandCoins', color: '#0d9488', is_default: true },
  { name: 'Other Income', type: 'income' as const, icon: 'Coins', color: '#64748B', is_default: true },
];

const DEFAULT_ACCOUNTS = [
  { name: 'Cash Wallet', type: 'cash' as const, initial_balance: 0, is_active: true, color: '#10B981' },
  { name: 'Bank BCA', type: 'bank' as const, initial_balance: 0, is_active: true, color: '#2563EB' },
];

// Helper to persist account budget inclusion flags locally (fallback if DB column not migrated yet)
const saveBudgetFlagsToLocal = (userId: string, flags: { [accId: string]: boolean }) => {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const existing = JSON.parse(localStorage.getItem(`pocketlog_budget_flags_${userId}`) || '{}');
    const updated = { ...existing, ...flags };
    localStorage.setItem(`pocketlog_budget_flags_${userId}`, JSON.stringify(updated));
  } catch {}
};



// Helper to detect browser fetch failures, network dropouts, offline state, or empty network error responses
const isNetworkOrFetchError = (error: any): boolean => {
  if (!error) return true;
  if (error instanceof TypeError) return true;
  const msg = String(error.message || error.details || error.hint || error.description || error || '').toLowerCase();
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('fetch failed') ||
    msg.includes('load failed') ||
    msg.includes('network request failed') ||
    msg.includes('timeout') ||
    msg.includes('abort') ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  ) {
    return true;
  }
  if (error.name === 'TypeError' || (error.constructor && error.constructor.name === 'TypeError')) {
    return true;
  }
  // Supabase/Postgrest empty object error: {} with no code, status, or message
  if (typeof error === 'object' && !error.code && !error.status && !error.message) {
    return true;
  }
  return false;
};

interface DataProviderProps {
  children: React.ReactNode;
  initialUser?: User | null;
  initialIsTrusted?: boolean;
}

export function DataProvider({
  children,
  initialUser = null,
  initialIsTrusted = true,
}: DataProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isTrustedDevice, setIsTrustedDevice] = useState<boolean>(initialIsTrusted);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [monthlyArchives, setMonthlyArchives] = useState<MonthlyArchive[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [investmentLogs, setInvestmentLogs] = useState<InvestmentLog[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleStartDate, setCycleStartDate] = useState<string>(() => {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
  });
  const [isLoading, setIsLoading] = useState(true);
  const recentSubmissionsRef = useRef<Map<string, number>>(new Map());

  const hasSupabaseConfig = useMemo(() => isSupabaseConfigured(), []);
  const supabase = useMemo(() => createClient(), []);
  // Cache authenticated user id — refreshed by loadData on every auth state change.
  // Avoids a getUser() network round-trip on every CRUD operation.
  const userIdRef = useRef<string | null>(null);

  // Helper to persist demo state to sessionStorage
  const persistDemoState = useCallback(
    (partial: {
      accounts?: Account[];
      categories?: Category[];
      transactions?: Transaction[];
      debts?: Debt[];
      cycles?: Cycle[];
      investments?: Investment[];
      investmentLogs?: InvestmentLog[];
      monthlyArchives?: MonthlyArchive[];
      cycleStartDate?: string;
    }) => {
      if (typeof window === 'undefined') return;
      try {
        const stored = sessionStorage.getItem('pocketlog_demo_state');
        const existing = stored ? JSON.parse(stored) : {};
        const updated = {
          ...existing,
          accounts,
          categories,
          transactions,
          debts,
          cycles,
          investments,
          investmentLogs,
          monthlyArchives,
          cycleStartDate,
          ...partial,
        };
        sessionStorage.setItem('pocketlog_demo_state', JSON.stringify(updated));
      } catch {}
    },
    [accounts, categories, transactions, debts, cycles, investments, investmentLogs, monthlyArchives, cycleStartDate]
  );

  // Returns cached user id (instant, no network) or fetches once if cache is cold.
  const getAuthUserId = useCallback(async (): Promise<string | null> => {
    if (userIdRef.current) return userIdRef.current;
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) userIdRef.current = user.id;
    return user?.id ?? null;
  }, [supabase]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Verify session state via /api/auth/me
      let sessionUser: User | null = null;
      let inDemo = false;

      let isDevTrusted = true;
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok) {
          const authData = await res.json();
          if (authData && typeof authData.isTrustedDevice === 'boolean') {
            isDevTrusted = authData.isTrustedDevice;
          }

          if (authData.isAuthenticated && authData.user) {
            sessionUser = authData.user;
            inDemo = false;

            // Synchronize browser Supabase client session if tokens are returned
            if (authData.sessionTokens && supabase) {
              try {
                await supabase.auth.setSession(authData.sessionTokens);
              } catch (syncErr) {
                console.warn('Could not set browser Supabase session:', syncErr);
              }
            }
          } else {
            inDemo = true;
            sessionUser = authData.user || {
              id: DEMO_USER_ID,
              email: 'demo@pocketlog.app',
              role: 'superadmin',
              full_name: 'Guest Explorer',
              currency: 'IDR',
            };
          }
        } else {
          inDemo = true;
        }
      } catch {
        inDemo = true;
      }

      setIsDemoMode(inDemo);
      setIsTrustedDevice(isDevTrusted);
      setCurrentUser(sessionUser);

      // Handle Demo Mode Isolation
      if (inDemo) {
        userIdRef.current = DEMO_USER_ID;
        let demoState: any = null;
        if (typeof window !== 'undefined') {
          try {
            const stored = sessionStorage.getItem('pocketlog_demo_state');
            if (stored) demoState = JSON.parse(stored);
          } catch {}
        }

        setAccounts(demoState?.accounts || DEMO_ACCOUNTS);
        setCategories(demoState?.categories || DEMO_CATEGORIES);
        setTransactions(demoState?.transactions || DEMO_TRANSACTIONS);
        setDebts(demoState?.debts || DEMO_DEBTS);
        setCycles(demoState?.cycles || DEMO_CYCLES);
        setInvestments(demoState?.investments || DEMO_INVESTMENTS);
        setInvestmentLogs(demoState?.investmentLogs || DEMO_INVESTMENT_LOGS);
        setMonthlyArchives(demoState?.monthlyArchives || DEMO_MONTHLY_ARCHIVES);
        setCycleStartDate(demoState?.cycleStartDate || '2026-10-01');
        setIsLoading(false);
        return;
      }

      // Handle Untrusted Authenticated Device Isolation (Security Gate)
      // When logged in on an untrusted device, strictly withhold sensitive financial data
      if (!isDevTrusted) {
        setIsLoading(false);
        setAccounts([]);
        setCategories([]);
        setTransactions([]);
        setDebts([]);
        setInvestments([]);
        setInvestmentLogs([]);
        return;
      }

      // Authenticated Mode:
      if (!hasSupabaseConfig || !supabase) {
        setIsLoading(false);
        return;
      }

      const userId = sessionUser?.id;
      if (!userId) {
        setIsLoading(false);
        return;
      }
      userIdRef.current = userId;

      // Clean up legacy unpartitioned storage
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('pocketlog_cached_categories');
          localStorage.removeItem('pocketlog_cached_accounts');
          localStorage.removeItem('pocketlog_cached_investments');
          localStorage.removeItem('pocketlog_cached_investment_logs');
        } catch {}
      }

      // Fetch all tables in parallel from Supabase scoped to userId
      let accsData: Account[] = [];
      let catsData: Category[] = [];
      let txsData: Transaction[] = [];
      let debtsData: Debt[] = [];
      let invsData: Investment[] = [];
      let logsData: InvestmentLog[] = [];

      try {
        const [accsRes, catsRes, txsRes, debtsRes, invsRes, logsRes] = await Promise.all([
          supabase.from('accounts').select('*').eq('user_id', userId).order('name'),
          supabase.from('categories').select('*').eq('user_id', userId).order('name'),
          supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).order('created_at', { ascending: false }),
          supabase.from('debts').select('*').eq('user_id', userId).order('date', { ascending: false }),
          supabase.from('investments').select('*').eq('user_id', userId).order('start_date', { ascending: false }),
          supabase.from('investment_logs').select('*').eq('user_id', userId).order('date', { ascending: true }).order('created_at', { ascending: true }),
        ]);

        accsData = accsRes.data || [];
        catsData = catsRes.data || [];
        txsData = (txsRes.data || []).map((t) => {
          if (
            t.description &&
            (t.description.includes('[PIUTANG_LUNAS:') || t.description.includes('[debt:'))
          ) {
            const cleanedDesc = t.description
              .replace(/\s*\[debt:[^\]]+\]/gi, '')
              .replace(/\s*\[PIUTANG_LUNAS:[^\]]+\]/gi, '')
              .trim();
            if (supabase) {
              supabase.from('transactions').update({ description: cleanedDesc }).eq('id', t.id).eq('user_id', userId).then();
            }
            return { ...t, description: cleanedDesc };
          }
          return t;
        });
        debtsData = debtsRes.data || [];
        if (invsRes && invsRes.data) invsData = invsRes.data;
        if (logsRes && logsRes.data) logsData = logsRes.data;
      } catch (netErr) {
        console.warn('Network hiccup loading from Supabase, checking user cache:', netErr);
      }

      // Infallible fallback: If client query returned 0 transactions and accounts, sync via /api/data/sync
      if (txsData.length === 0 && accsData.length === 0) {
        try {
          const syncRes = await fetch('/api/data/sync', { cache: 'no-store' });
          if (syncRes.ok) {
            const syncPayload = await syncRes.json();
            if (syncPayload.success) {
              if (syncPayload.transactions?.length > 0) txsData = syncPayload.transactions;
              if (syncPayload.accounts?.length > 0) accsData = syncPayload.accounts;
              if (syncPayload.categories?.length > 0) catsData = syncPayload.categories;
              if (syncPayload.debts?.length > 0) debtsData = syncPayload.debts;
              if (syncPayload.investments?.length > 0) invsData = syncPayload.investments;
              if (syncPayload.investmentLogs?.length > 0) logsData = syncPayload.investmentLogs;
              if (syncPayload.cycles?.length > 0) setCycles(syncPayload.cycles);
              if (syncPayload.monthlyArchives?.length > 0) setMonthlyArchives(syncPayload.monthlyArchives);
            }
          }
        } catch (syncErr) {
          console.warn('Server sync fallback error:', syncErr);
        }
      }

      // Local storage fallback for categories if Supabase returned empty/offline
      if (catsData.length === 0 && typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(`pocketlog_cache_${userId}_categories`);
          if (cached) catsData = JSON.parse(cached);
        } catch {}
      }

      // Local storage fallback for accounts if Supabase returned empty/offline
      if (accsData.length === 0 && typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(`pocketlog_cache_${userId}_accounts`);
          if (cached) accsData = JSON.parse(cached);
        } catch {}
      }

      // Auto-seed default categories in DB if empty for this user and no cache
      if (catsData.length === 0) {
        const toInsert = DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: userId }));
        try {
          const { data: seededCats } = await supabase.from('categories').insert(toInsert).select();
          if (seededCats) catsData = seededCats;
        } catch (seedErr) {
          console.warn('Could not auto-seed categories on Supabase:', seedErr);
        }
      }

      // Auto-seed default starter accounts in DB if empty for this user and no cache
      if (accsData.length === 0) {
        const toInsert = DEFAULT_ACCOUNTS.map((a) => ({ ...a, user_id: userId }));
        try {
          const { data: seededAccs } = await supabase.from('accounts').insert(toInsert).select();
          if (seededAccs) accsData = seededAccs;
        } catch (seedErr) {
          console.warn('Could not auto-seed accounts on Supabase:', seedErr);
        }
      }

      // Ensure debt repayment category exists
      let debtCat = catsData.find(
        (c) =>
          c.type === 'income' &&
          (c.name.toLowerCase().includes('debt') ||
           c.name.toLowerCase().includes('piutang') ||
           c.name.toLowerCase().includes('hutang'))
      );

      if (!debtCat && supabase) {
        const catName = 'Debt Repayment';
        try {
          const { data: createdCat } = await supabase
            .from('categories')
            .insert([{
              user_id: userId,
              name: catName,
              type: 'income',
              icon: 'HandCoins',
              color: '#0d9488',
              is_default: true,
            }])
            .select()
            .single();

          if (createdCat) {
            catsData = [...catsData, createdCat];
            debtCat = createdCat;
          }
        } catch (catErr) {
          console.warn('Could not auto-seed debt category:', catErr);
        }
      }

      // Auto-assign debt category to any un-categorized debt settlement transactions
      if (debtCat) {
        txsData = txsData.map((t) => {
          const isDebtSettlement =
            t.type === 'income' &&
            !t.category_id &&
            (t.description?.toLowerCase().includes('piutang lunas') ||
             t.description?.toLowerCase().includes('receivable repaid') ||
             t.description?.toLowerCase().includes('pelunasan piutang') ||
             t.description?.toLowerCase().includes('debt repayment'));

          if (isDebtSettlement) {
            if (supabase) {
              supabase.from('transactions').update({ category_id: debtCat.id }).eq('id', t.id).eq('user_id', userId).then();
            }
            return { ...t, category_id: debtCat.id };
          }
          return t;
        });
      }

      // Merge account budget inclusion flags from local cache if not provided by DB column
      if (typeof window !== 'undefined') {
        try {
          const savedFlags = JSON.parse(localStorage.getItem(`pocketlog_budget_flags_${userId}`) || '{}');
          accsData = accsData.map((a) => ({
            ...a,
            include_in_budget:
              a.include_in_budget !== undefined
                ? a.include_in_budget
                : savedFlags[a.id] !== undefined
                ? savedFlags[a.id]
                : true,
          }));
        } catch {}
      }

      setAccounts(accsData);
      setCategories(catsData);
      setTransactions(txsData);
      setDebts(debtsData);
      setInvestments(invsData);
      setInvestmentLogs(logsData);

      // Persist user-partitioned cache
      if (typeof window !== 'undefined') {
        try {
          if (catsData.length > 0) {
            localStorage.setItem(`pocketlog_cache_${userId}_categories`, JSON.stringify(catsData));
          }
          if (accsData.length > 0) {
            localStorage.setItem(`pocketlog_cache_${userId}_accounts`, JSON.stringify(accsData));
          }
          if (invsData.length > 0) {
            localStorage.setItem(`pocketlog_cache_${userId}_investments`, JSON.stringify(invsData));
          }
          if (logsData.length > 0) {
            localStorage.setItem(`pocketlog_cache_${userId}_investment_logs`, JSON.stringify(logsData));
          }
        } catch {}
      }

      // Fetch monthly archives with fallback to user-partitioned localStorage
      try {
        const { data: archData, error: archError } = await supabase
          .from('monthly_archives')
          .select('*')
          .eq('user_id', userId)
          .order('period', { ascending: false });

        if (!archError && archData) {
          setMonthlyArchives(archData);
        } else {
          const localArch = localStorage.getItem(`pocketlog_cache_${userId}_monthly_archives`);
          if (localArch) setMonthlyArchives(JSON.parse(localArch));
        }
      } catch {
        const localArch = localStorage.getItem(`pocketlog_cache_${userId}_monthly_archives`);
        if (localArch) setMonthlyArchives(JSON.parse(localArch));
      }

      // Fetch cycles from Supabase scoped to userId
      try {
        const { data: cyclesData, error: cyclesError } = await supabase
          .from('cycles')
          .select('*')
          .eq('user_id', userId)
          .order('start_date', { ascending: false });

        if (!cyclesError && cyclesData && cyclesData.length > 0) {
          setCycles(cyclesData);
          const active = cyclesData.find((c: Cycle) => c.is_active);
          if (active) {
            setCycleStartDate(active.start_date);
            if (typeof window !== 'undefined') {
              localStorage.setItem(`pocketlog_cycle_start_${userId}`, active.start_date);
            }
          }
        } else {
          const storedCycleStart = localStorage.getItem(`pocketlog_cycle_start_${userId}`);
          if (storedCycleStart) {
            setCycleStartDate(storedCycleStart);
          }
        }
      } catch (cyclesErr) {
        console.warn('Failed to load cycles from Supabase, checking local storage:', cyclesErr);
        try {
          const storedCycleStart = localStorage.getItem(`pocketlog_cycle_start_${userId}`);
          if (storedCycleStart) {
            setCycleStartDate(storedCycleStart);
          }
        } catch {}
      }
    } catch (err) {
      console.error('Error loading data from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  }, [hasSupabaseConfig, supabase]);

  useEffect(() => {
    // Clean up any legacy demo items from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jft_accounts');
      localStorage.removeItem('jft_categories');
      localStorage.removeItem('jft_transactions');
      localStorage.removeItem('jft_debts');
      localStorage.removeItem('jft_debt_payments');
      localStorage.removeItem('jft_demo_mode');
    }

    loadData();

    // Re-fetch when browser regains internet connectivity
    const handleOnline = () => {
      loadData();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    let subscription: any = null;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange(() => {
        loadData();
      });
      subscription = data?.subscription;
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [loadData, supabase]);

  // Sync category changes to user-partitioned localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && !isDemoMode && currentUser?.id && categories.length > 0) {
      try {
        localStorage.setItem(`pocketlog_cache_${currentUser.id}_categories`, JSON.stringify(categories));
      } catch {}
    }
  }, [categories, isDemoMode, currentUser?.id]);

  // Sync account changes to user-partitioned localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && !isDemoMode && currentUser?.id && accounts.length > 0) {
      try {
        localStorage.setItem(`pocketlog_cache_${currentUser.id}_accounts`, JSON.stringify(accounts));
      } catch {}
    }
  }, [accounts, isDemoMode, currentUser?.id]);

  // Sync investment changes to user-partitioned localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && !isDemoMode && currentUser?.id && investments.length > 0) {
      try {
        localStorage.setItem(`pocketlog_cache_${currentUser.id}_investments`, JSON.stringify(investments));
      } catch {}
    }
  }, [investments, isDemoMode, currentUser?.id]);

  // Sync investment logs changes to user-partitioned localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && !isDemoMode && currentUser?.id && investmentLogs.length > 0) {
      try {
        localStorage.setItem(`pocketlog_cache_${currentUser.id}_investment_logs`, JSON.stringify(investmentLogs));
      } catch {}
    }
  }, [investmentLogs, isDemoMode, currentUser?.id]);

  const addTransaction = async (tx: Omit<Transaction, 'id' | 'created_at'>) => {
    // Prevent double submission of identical transactions within 1.5s
    const txSignature = `${tx.account_id}_${tx.type}_${tx.amount}_${tx.date}_${tx.to_account_id || ''}_${tx.category_id || ''}_${tx.description || ''}`;
    const now = Date.now();
    const lastSubmitted = recentSubmissionsRef.current.get(txSignature);
    if (lastSubmitted && now - lastSubmitted < 1500) {
      console.warn('Blocked rapid duplicate transaction submission:', txSignature);
      return;
    }
    recentSubmissionsRef.current.set(txSignature, now);
    if (recentSubmissionsRef.current.size > 20) {
      for (const [key, timestamp] of recentSubmissionsRef.current.entries()) {
        if (now - timestamp > 5000) recentSubmissionsRef.current.delete(key);
      }
    }

    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tx_${Date.now()}`;
    const optimisticTx: Transaction = {
      id: tempId,
      created_at: new Date().toISOString(),
      ...tx,
    };

    if (isDemoMode) {
      const next = [optimisticTx, ...transactions];
      setTransactions(next);
      persistDemoState({ transactions: next });
      return;
    }

    setTransactions((prev) => [optimisticTx, ...prev]);

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const { data, error } = await supabase
        .from('transactions')
        .insert([{ ...tx, user_id: userId }])
        .select()
        .single();

      if (error) {
        if (isNetworkOrFetchError(error)) {
          console.warn('Network slow/offline while adding transaction, saved locally:', error.message);
          return;
        }
        setTransactions((prev) => prev.filter((t) => t.id !== tempId));
        console.error('Failed to add transaction:', error.message || error.code || error, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Failed to add transaction');
      }

      if (data) {
        setTransactions((prev) => prev.map((t) => (t.id === tempId ? data : t)));
      }
    } catch (err: any) {
      if (isNetworkOrFetchError(err)) {
        console.warn('Connection lost while adding transaction, saved locally:', err.message);
        return;
      }
      setTransactions((prev) => prev.filter((t) => t.id !== tempId));
      throw err;
    }
  };

  const updateTransaction = async (id: string, updatedFields: Partial<Transaction>) => {
    if (isDemoMode) {
      const next = transactions.map((t) => (t.id === id ? { ...t, ...updatedFields } : t));
      setTransactions(next);
      persistDemoState({ transactions: next });
      return;
    }

    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...updatedFields } : t)));

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const { data, error } = await supabase
        .from('transactions')
        .update(updatedFields)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (isNetworkOrFetchError(error)) {
          console.warn('Network slow/offline while updating transaction, saved locally:', error.message);
          return;
        }
        console.error('Failed to update transaction:', error.message || error.code || error, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Failed to update transaction');
      }

      if (data) {
        setTransactions((prev) => prev.map((t) => (t.id === id ? data : t)));
      }
    } catch (err: any) {
      if (isNetworkOrFetchError(err)) {
        console.warn('Connection lost while updating transaction, saved locally:', err.message);
        return;
      }
      throw err;
    }
  };

  const deleteTransaction = async (id: string) => {
    if (isDemoMode) {
      const next = transactions.filter((t) => t.id !== id);
      setTransactions(next);
      persistDemoState({ transactions: next });
      return;
    }

    const previous = [...transactions];
    setTransactions((prev) => prev.filter((t) => t.id !== id));

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        if (isNetworkOrFetchError(error)) {
          console.warn('Network slow/offline while deleting transaction, deleted locally:', error.message);
          return;
        }
        setTransactions(previous);
        console.error('Failed to delete transaction:', error.message || error.code || error, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Failed to delete transaction');
      }
    } catch (err: any) {
      if (isNetworkOrFetchError(err)) {
        console.warn('Connection lost while deleting transaction, deleted locally:', err.message);
        return;
      }
      setTransactions(previous);
      throw err;
    }
  };

  const addAccount = async (acc: Omit<Account, 'id' | 'created_at'>) => {
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `acc_${Date.now()}`;
    const optimisticAcc: Account = {
      id: tempId,
      created_at: new Date().toISOString(),
      ...acc,
    };

    if (isDemoMode) {
      const next = [...accounts, optimisticAcc];
      setAccounts(next);
      persistDemoState({ accounts: next });
      return;
    }

    setAccounts((prev) => [...prev, optimisticAcc]);

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const cleanAcc: any = { ...acc };
      delete cleanAcc.current_balance;
      delete cleanAcc.allocated_budget;
      delete cleanAcc.effective_budget;
      delete cleanAcc.spent_amount;
      delete cleanAcc.transfers_in;
      delete cleanAcc.transfers_out;
      delete cleanAcc.remaining_budget;

      if (cleanAcc.include_in_budget !== undefined && userId) {
        saveBudgetFlagsToLocal(userId, { [tempId]: cleanAcc.include_in_budget });
      }

      let { data, error } = await supabase
        .from('accounts')
        .insert([{ ...cleanAcc, user_id: userId }])
        .select()
        .single();

      // Fallback if pocket_name / pocket_color / include_in_budget column does not exist yet on remote Supabase accounts table
      if (error && (error.code === '42703' || error.message?.includes('pocket_') || error.message?.includes('include_in_budget'))) {
        console.warn('Columns accounts.pocket_name/pocket_color/include_in_budget not yet on Supabase. Saving base account.');
        const fallbackAcc = { ...cleanAcc };
        delete fallbackAcc.pocket_name;
        delete fallbackAcc.pocket_color;
        delete fallbackAcc.include_in_budget;
        const retry = await supabase
          .from('accounts')
          .insert([{ ...fallbackAcc, user_id: userId }])
          .select()
          .single();
        data = retry.data ? { ...retry.data, pocket_name: acc.pocket_name, pocket_color: acc.pocket_color, include_in_budget: acc.include_in_budget ?? true } : null;
        error = retry.error;
      }

      if (error) {
        if (isNetworkOrFetchError(error)) {
          console.warn('Network slow/offline while adding account, saved locally:', error.message);
          return;
        }
        setAccounts((prev) => prev.filter((a) => a.id !== tempId));
        console.error('Failed to add account:', error.message || error.code || error, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Failed to add account');
      }

      if (data) {
        if (userId && data.id) {
          saveBudgetFlagsToLocal(userId, { [data.id]: acc.include_in_budget ?? true });
        }
        const savedAcc: Account = {
          ...data,
          include_in_budget: data.include_in_budget !== undefined ? data.include_in_budget : (acc.include_in_budget ?? true),
          pocket_name: data.pocket_name !== undefined ? data.pocket_name : (acc.pocket_name || null),
          pocket_color: data.pocket_color !== undefined ? data.pocket_color : (acc.pocket_color || null),
        };
        setAccounts((prev) => prev.map((a) => (a.id === tempId ? savedAcc : a)));
      }
    } catch (err: unknown) {
      if (isNetworkOrFetchError(err)) {
        console.warn('Connection lost while adding account, saved locally:', err);
        return;
      }
      setAccounts((prev) => prev.filter((a) => a.id !== tempId));
      throw err;
    }
  };

  const updateAccount = async (id: string, updatedFields: Partial<Account>) => {
    if (isDemoMode) {
      const next = accounts.map((a) => (a.id === id ? { ...a, ...updatedFields } : a));
      setAccounts(next);
      persistDemoState({ accounts: next });
      return;
    }

    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updatedFields } : a)));

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      if (updatedFields.include_in_budget !== undefined) {
        saveBudgetFlagsToLocal(userId, { [id]: updatedFields.include_in_budget });
      }

      const cleanFields: any = { ...updatedFields };
      delete cleanFields.current_balance;
      delete cleanFields.allocated_budget;
      delete cleanFields.effective_budget;
      delete cleanFields.spent_amount;
      delete cleanFields.transfers_in;
      delete cleanFields.transfers_out;
      delete cleanFields.remaining_budget;

      let { data, error } = await supabase
        .from('accounts')
        .update(cleanFields)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      // Fallback if pocket_name / pocket_color / include_in_budget column does not exist yet on remote Supabase accounts table
      if (error && (error.code === '42703' || error.message?.includes('pocket_') || error.message?.includes('include_in_budget'))) {
        console.warn('Columns accounts.pocket_name/pocket_color/include_in_budget not yet on Supabase. Saving base account update.');
        const fallbackFields = { ...cleanFields };
        delete fallbackFields.pocket_name;
        delete fallbackFields.pocket_color;
        delete fallbackFields.include_in_budget;
        const retry = await supabase
          .from('accounts')
          .update(fallbackFields)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();
        data = retry.data ? { ...retry.data, ...updatedFields } : null;
        error = retry.error;
      }

      if (error) {
        if (isNetworkOrFetchError(error)) {
          console.warn('Network slow/offline while updating account, saved locally:', error.message);
          return;
        }
        console.error('Failed to update account:', error.message || error.code || error, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Failed to update account');
      }

      if (data) {
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  ...data,
                  include_in_budget:
                    data?.include_in_budget !== undefined
                      ? data.include_in_budget
                      : updatedFields.include_in_budget !== undefined
                      ? updatedFields.include_in_budget
                      : a.include_in_budget,
                  pocket_name:
                    data?.pocket_name !== undefined
                      ? data.pocket_name
                      : updatedFields.pocket_name !== undefined
                      ? updatedFields.pocket_name
                      : a.pocket_name,
                  pocket_color:
                    data?.pocket_color !== undefined
                      ? data.pocket_color
                      : updatedFields.pocket_color !== undefined
                      ? updatedFields.pocket_color
                      : a.pocket_color,
                }
              : a
          )
        );
      }
    } catch (err: unknown) {
      if (isNetworkOrFetchError(err)) {
        console.warn('Connection lost while updating account, saved locally:', err);
        return;
      }
      throw err;
    }
  };

  const updateAccountBudgetInclusions = async (inclusions: { [accountId: string]: boolean }) => {
    if (isDemoMode) {
      const next = accounts.map((a) =>
        inclusions[a.id] !== undefined ? { ...a, include_in_budget: inclusions[a.id] } : a
      );
      setAccounts(next);
      persistDemoState({ accounts: next });
      return;
    }

    setAccounts((prev) =>
      prev.map((a) => (inclusions[a.id] !== undefined ? { ...a, include_in_budget: inclusions[a.id] } : a))
    );

    const userId = await getAuthUserId();
    if (userId) {
      saveBudgetFlagsToLocal(userId, inclusions);
    }

    if (!supabase || !userId) return;

    for (const [id, include] of Object.entries(inclusions)) {
      try {
        let { error } = await supabase
          .from('accounts')
          .update({ include_in_budget: include })
          .eq('id', id)
          .eq('user_id', userId);

        if (error && error.code !== '42703') {
          console.warn('Could not update include_in_budget for account:', id, error);
        }
      } catch (err) {
        console.warn('Error updating include_in_budget for account:', id, err);
      }
    }
  };

  const deleteAccount = async (id: string) => {
    if (isDemoMode) {
      const next = accounts.filter((a) => a.id !== id);
      setAccounts(next);
      persistDemoState({ accounts: next });
      return;
    }

    const previous = [...accounts];
    setAccounts((prev) => prev.filter((a) => a.id !== id));

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        if (isNetworkOrFetchError(error)) {
          console.warn('Network slow/offline while deleting account, deleted locally:', error.message);
          return;
        }
        setAccounts(previous);
        console.error('Failed to delete account:', error.message || error.code || error, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Failed to delete account');
      }
    } catch (err: any) {
      if (isNetworkOrFetchError(err)) {
        console.warn('Connection lost while deleting account, deleted locally:', err.message);
        return;
      }
      setAccounts(previous);
      throw err;
    }
  };

  const addCategory = async (cat: Omit<Category, 'id' | 'created_at'>) => {
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cat_${Date.now()}`;
    const optimisticCat: Category = {
      id: tempId,
      created_at: new Date().toISOString(),
      ...cat,
    };

    if (isDemoMode) {
      const next = [...categories, optimisticCat];
      setCategories(next);
      persistDemoState({ categories: next });
      return;
    }

    setCategories((prev) => [...prev, optimisticCat]);

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const { data, error } = await supabase
        .from('categories')
        .insert([{ ...cat, user_id: userId }])
        .select()
        .single();

      if (error) {
        if (isNetworkOrFetchError(error)) {
          console.warn('Network slow/offline while adding category, saved locally:', error.message);
          return;
        }
        setCategories((prev) => prev.filter((c) => c.id !== tempId));
        console.error('Failed to add category:', error.message || error.code || error, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Failed to add category');
      }

      if (data) {
        setCategories((prev) => prev.map((c) => (c.id === tempId ? data : c)));
      }
    } catch (err: any) {
      if (isNetworkOrFetchError(err)) {
        console.warn('Connection lost while adding category, saved locally:', err.message);
        return;
      }
      setCategories((prev) => prev.filter((c) => c.id !== tempId));
      throw err;
    }
  };

  const updateCategory = async (id: string, updatedFields: Partial<Category>) => {
    if (isDemoMode) {
      const next = categories.map((c) => (c.id === id ? { ...c, ...updatedFields } : c));
      setCategories(next);
      persistDemoState({ categories: next });
      return;
    }

    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updatedFields } : c))
    );

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const { data, error } = await supabase
        .from('categories')
        .update(updatedFields)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (isNetworkOrFetchError(error)) {
          console.warn('Network slow/offline while updating category, saved locally:', error.message);
          return;
        }
        console.error('Failed to update category:', error.message || error.code || error, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Failed to update category');
      }

      if (data) {
        setCategories((prev) => prev.map((c) => (c.id === id ? data : c)));
      }
    } catch (err: any) {
      if (isNetworkOrFetchError(err)) {
        console.warn('Connection lost while updating category, saved locally:', err.message);
        return;
      }
      throw err;
    }
  };

  const deleteCategory = async (id: string) => {
    if (isDemoMode) {
      const next = categories.filter((c) => c.id !== id);
      setCategories(next);
      persistDemoState({ categories: next });
      return;
    }

    const previous = [...categories];
    setCategories((prev) => prev.filter((c) => c.id !== id));

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        if (isNetworkOrFetchError(error)) {
          console.warn('Network slow/offline while deleting category, deleted locally:', error.message);
          return;
        }
        setCategories(previous);
        console.error('Failed to delete category:', error.message || error.code || error, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Failed to delete category');
      }
    } catch (err: any) {
      if (isNetworkOrFetchError(err)) {
        console.warn('Connection lost while deleting category, deleted locally:', err.message);
        return;
      }
      setCategories(previous);
      throw err;
    }
  };

  const addDebt = async (debt: Omit<Debt, 'id' | 'created_at'>) => {
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `debt_${Date.now()}`;
    const optimisticDebt: Debt = {
      id: tempId,
      created_at: new Date().toISOString(),
      ...debt,
      account_id: debt.account_id || null,
      due_date: debt.due_date || null,
      description: debt.description || null,
    };

    if (isDemoMode) {
      const next = [optimisticDebt, ...debts];
      setDebts(next);
      persistDemoState({ debts: next });
      return;
    }

    setDebts((prev) => [optimisticDebt, ...prev]);

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const cleanDebt: any = {
        ...debt,
        due_date: debt.due_date || null,
        description: debt.description || null,
      };

      if (!cleanDebt.account_id) {
        delete cleanDebt.account_id;
      }

      let { data, error } = await supabase
        .from('debts')
        .insert([{ ...cleanDebt, user_id: userId }])
        .select()
        .single();

      // Fallback if account_id column does not exist yet on remote Supabase debts table
      if (error && (error.code === '42703' || error.message?.includes('account_id'))) {
        console.warn('Column debts.account_id not yet on Supabase. Saving debt without account relation.');
        const fallbackDebt = { ...cleanDebt };
        delete fallbackDebt.account_id;
        const retry = await supabase
          .from('debts')
          .insert([{ ...fallbackDebt, user_id: userId }])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        if (isNetworkOrFetchError(error)) {
          console.warn('Network slow/offline while adding debt/receivable, saved locally:', error.message);
          return;
        }
        setDebts((prev) => prev.filter((d) => d.id !== tempId));
        console.error('Failed to add debt:', error.message || error.code || error, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Failed to add debt/receivable');
      }

      if (data) {
        const savedDebt: Debt = {
          ...data,
          account_id: data.account_id !== undefined ? data.account_id : (debt.account_id || null),
        };
        setDebts((prev) => prev.map((d) => (d.id === tempId ? savedDebt : d)));
      }
    } catch (err: any) {
      if (isNetworkOrFetchError(err)) {
        console.warn('Connection lost while adding debt/receivable, saved locally:', err.message);
        return;
      }
      setDebts((prev) => prev.filter((d) => d.id !== tempId));
      throw err;
    }
  };

  const updateDebt = async (id: string, updatedFields: Partial<Debt>) => {
    if (isDemoMode) {
      const next = debts.map((d) =>
        d.id === id
          ? {
              ...d,
              ...updatedFields,
              account_id: updatedFields.account_id !== undefined ? updatedFields.account_id : d.account_id,
            }
          : d
      );
      setDebts(next);
      persistDemoState({ debts: next });
      return;
    }

    setDebts((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              ...updatedFields,
              account_id: updatedFields.account_id !== undefined ? updatedFields.account_id : d.account_id,
            }
          : d
      )
    );

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const cleanFields: any = { ...updatedFields };

      if ('account_id' in cleanFields && !cleanFields.account_id) {
        delete cleanFields.account_id;
      }

      let { data, error } = await supabase
        .from('debts')
        .update(cleanFields)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      // Fallback if account_id column does not exist yet on remote Supabase debts table
      if (error && (error.code === '42703' || error.message?.includes('account_id'))) {
        console.warn('Column debts.account_id not yet on Supabase. Saving update without account relation.');
        const fallbackFields = { ...cleanFields };
        delete fallbackFields.account_id;
        const retry = await supabase
          .from('debts')
          .update(fallbackFields)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        if (isNetworkOrFetchError(error)) {
          console.warn('Network slow/offline while updating debt/receivable, saved locally:', error.message);
          return;
        }
        console.error('Failed to update debt:', error.message || error.code || error, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Failed to update debt/receivable');
      }

      if (data) {
        setDebts((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  ...data,
                  account_id:
                    data?.account_id !== undefined
                      ? data.account_id
                      : updatedFields.account_id !== undefined
                      ? updatedFields.account_id
                      : d.account_id,
                }
              : d
          )
        );
      }
    } catch (err: any) {
      if (isNetworkOrFetchError(err)) {
        console.warn('Connection lost while updating debt/receivable, saved locally:', err.message);
        return;
      }
      throw err;
    }
  };

  const deleteDebt = async (id: string) => {
    if (isDemoMode) {
      const next = debts.filter((d) => d.id !== id);
      setDebts(next);
      persistDemoState({ debts: next });
      return;
    }

    const prevDebts = [...debts];
    setDebts((prev) => prev.filter((d) => d.id !== id));

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const { error } = await supabase
        .from('debts')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        if (isNetworkOrFetchError(error)) {
          console.warn('Network slow/offline while deleting debt/receivable, deleted locally:', error.message);
          return;
        }
        setDebts(prevDebts);
        console.error('Failed to delete debt:', error.message || error.code || error, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(error.message || 'Failed to delete debt/receivable');
      }
    } catch (err: any) {
      if (isNetworkOrFetchError(err)) {
        console.warn('Connection lost while deleting debt/receivable, deleted locally:', err.message);
        return;
      }
      setDebts(prevDebts);
      throw err;
    }
  };

  const addInvestment = async (
    inv: Omit<Investment, 'id' | 'created_at' | 'updated_at'>,
    sourceAccountId?: string
  ) => {
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `inv_${Date.now()}`;
    const optimisticInv: Investment = {
      ...inv,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const tempLogId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}`;
    const optimisticLog: InvestmentLog = {
      id: tempLogId,
      investment_id: tempId,
      type: 'initial',
      value: inv.current_value,
      amount: inv.invested_amount,
      date: inv.start_date,
      account_id: sourceAccountId || null,
      notes: inv.notes || 'Initial Investment',
      created_at: new Date().toISOString(),
    };

    if (isDemoMode) {
      const nextInvs = [optimisticInv, ...investments];
      const nextLogs = [...investmentLogs, optimisticLog];
      setInvestments(nextInvs);
      setInvestmentLogs(nextLogs);
      if (sourceAccountId && inv.invested_amount > 0) {
        await addTransaction({
          account_id: sourceAccountId,
          amount: inv.invested_amount,
          type: 'expense',
          date: inv.start_date,
          description: `Investment: ${inv.name}`,
          category_id: null,
        });
      }
      persistDemoState({ investments: nextInvs, investmentLogs: nextLogs });
      return;
    }

    setInvestments((prev) => [optimisticInv, ...prev]);
    setInvestmentLogs((prev) => [...prev, optimisticLog]);

    if (sourceAccountId && inv.invested_amount > 0) {
      await addTransaction({
        account_id: sourceAccountId,
        amount: inv.invested_amount,
        type: 'expense',
        date: inv.start_date,
        description: `Investment: ${inv.name}`,
        category_id: null,
      });
    }

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const { data: createdInv, error: invError } = await supabase
        .from('investments')
        .insert([{ ...inv, user_id: userId }])
        .select()
        .single();

      if (invError) {
        if (isNetworkOrFetchError(invError)) return;
        setInvestments((prev) => prev.filter((i) => i.id !== tempId));
        setInvestmentLogs((prev) => prev.filter((l) => l.id !== tempLogId));
        console.error('Failed to create investment:', invError);
        throw new Error(invError.message || 'Failed to create investment');
      }

      if (createdInv) {
        setInvestments((prev) => prev.map((i) => (i.id === tempId ? createdInv : i)));

        const { data: createdLog } = await supabase
          .from('investment_logs')
          .insert([{
            user_id: userId,
            investment_id: createdInv.id,
            type: 'initial',
            value: inv.current_value,
            amount: inv.invested_amount,
            date: inv.start_date,
            account_id: sourceAccountId || null,
            notes: inv.notes || 'Initial Investment',
          }])
          .select()
          .single();

        if (createdLog) {
          setInvestmentLogs((prev) => prev.map((l) => (l.id === tempLogId ? createdLog : l)));
        }
      }
    } catch (err: any) {
      if (isNetworkOrFetchError(err)) return;
      setInvestments((prev) => prev.filter((i) => i.id !== tempId));
      setInvestmentLogs((prev) => prev.filter((l) => l.id !== tempLogId));
      throw err;
    }
  };

  const updateInvestmentValue = async (id: string, newValue: number, notes?: string, date?: string) => {
    const logDate = date || new Date().toISOString().split('T')[0];
    const target = investments.find((i) => i.id === id);
    if (!target) return;

    const tempLogId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}`;
    const newLog: InvestmentLog = {
      id: tempLogId,
      investment_id: id,
      type: 'update_value',
      value: newValue,
      amount: 0,
      date: logDate,
      notes: notes || null,
      created_at: new Date().toISOString(),
    };

    if (isDemoMode) {
      const nextInvs = investments.map((i) =>
        i.id === id ? { ...i, current_value: newValue, updated_at: new Date().toISOString() } : i
      );
      const nextLogs = [...investmentLogs, newLog];
      setInvestments(nextInvs);
      setInvestmentLogs(nextLogs);
      persistDemoState({ investments: nextInvs, investmentLogs: nextLogs });
      return;
    }

    const prevInvs = [...investments];
    setInvestments((prev) =>
      prev.map((i) => (i.id === id ? { ...i, current_value: newValue, updated_at: new Date().toISOString() } : i))
    );
    setInvestmentLogs((prev) => [...prev, newLog]);

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const [, logRes] = await Promise.all([
        supabase
          .from('investments')
          .update({ current_value: newValue, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single(),
        supabase
          .from('investment_logs')
          .insert([{
            user_id: userId,
            investment_id: id,
            type: 'update_value',
            value: newValue,
            amount: 0,
            date: logDate,
            notes: notes || null,
          }])
          .select()
          .single(),
      ]);

      if (logRes.data) {
        setInvestmentLogs((prev) => prev.map((l) => (l.id === tempLogId ? logRes.data : l)));
      }
    } catch (err: any) {
      if (isNetworkOrFetchError(err)) return;
      setInvestments(prevInvs);
      setInvestmentLogs((prev) => prev.filter((l) => l.id !== tempLogId));
      throw err;
    }
  };

  const topUpInvestment = async (
    id: string,
    amount: number,
    newValue?: number,
    sourceAccountId?: string,
    notes?: string,
    date?: string
  ) => {
    const target = investments.find((i) => i.id === id);
    if (!target) return;

    const opDate = date || new Date().toISOString().split('T')[0];
    const updatedInvested = Number(target.invested_amount) + Number(amount);
    const updatedValue = newValue !== undefined ? Number(newValue) : Number(target.current_value) + Number(amount);

    const tempLogId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}`;
    const newLog: InvestmentLog = {
      id: tempLogId,
      investment_id: id,
      type: 'top_up',
      value: updatedValue,
      amount: amount,
      date: opDate,
      account_id: sourceAccountId || null,
      notes: notes || null,
      created_at: new Date().toISOString(),
    };

    if (isDemoMode) {
      const nextInvs = investments.map((i) =>
        i.id === id
          ? { ...i, invested_amount: updatedInvested, current_value: updatedValue, updated_at: new Date().toISOString() }
          : i
      );
      const nextLogs = [...investmentLogs, newLog];
      setInvestments(nextInvs);
      setInvestmentLogs(nextLogs);
      if (sourceAccountId && amount > 0) {
        await addTransaction({
          account_id: sourceAccountId,
          amount: amount,
          type: 'expense',
          date: opDate,
          description: `Top Up Investment: ${target.name}`,
          category_id: null,
        });
      }
      persistDemoState({ investments: nextInvs, investmentLogs: nextLogs });
      return;
    }

    setInvestments((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, invested_amount: updatedInvested, current_value: updatedValue, updated_at: new Date().toISOString() }
          : i
      )
    );
    setInvestmentLogs((prev) => [...prev, newLog]);

    if (sourceAccountId && amount > 0) {
      await addTransaction({
        account_id: sourceAccountId,
        amount: amount,
        type: 'expense',
        date: opDate,
        description: `Top Up Investment: ${target.name}`,
        category_id: null,
      });
    }

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const [, logRes] = await Promise.all([
        supabase
          .from('investments')
          .update({
            invested_amount: updatedInvested,
            current_value: updatedValue,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single(),
        supabase
          .from('investment_logs')
          .insert([{
            user_id: userId,
            investment_id: id,
            type: 'top_up',
            value: updatedValue,
            amount: amount,
            date: opDate,
            account_id: sourceAccountId || null,
            notes: notes || null,
          }])
          .select()
          .single(),
      ]);

      if (logRes.data) {
        setInvestmentLogs((prev) => prev.map((l) => (l.id === tempLogId ? logRes.data : l)));
      }
    } catch (err: any) {
      if (isNetworkOrFetchError(err)) return;
      console.error('Failed to top up investment:', err);
    }
  };

  const withdrawInvestment = async (
    id: string,
    amount: number,
    isFullRedemption: boolean,
    destAccountId?: string,
    notes?: string,
    date?: string
  ) => {
    const target = investments.find((i) => i.id === id);
    if (!target) return;

    const opDate = date || new Date().toISOString().split('T')[0];
    const updatedWithdrawn = Number(target.total_withdrawn || 0) + Number(amount);
    const updatedValue = isFullRedemption ? 0 : Math.max(0, Number(target.current_value) - Number(amount));
    const newStatus = isFullRedemption ? ('closed' as const) : target.status;
    const closedDate = isFullRedemption ? opDate : target.closed_date;

    const tempLogId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}`;
    const newLog: InvestmentLog = {
      id: tempLogId,
      investment_id: id,
      type: 'withdraw',
      value: updatedValue,
      amount: amount,
      date: opDate,
      account_id: destAccountId || null,
      notes: notes || (isFullRedemption ? 'Full Redemption' : 'Partial Withdrawal'),
      created_at: new Date().toISOString(),
    };

    if (isDemoMode) {
      const nextInvs = investments.map((i) =>
        i.id === id
          ? {
              ...i,
              current_value: updatedValue,
              total_withdrawn: updatedWithdrawn,
              status: newStatus,
              closed_date: closedDate,
              updated_at: new Date().toISOString(),
            }
          : i
      );
      const nextLogs = [...investmentLogs, newLog];
      setInvestments(nextInvs);
      setInvestmentLogs(nextLogs);
      if (destAccountId && amount > 0) {
        await addTransaction({
          account_id: destAccountId,
          amount: amount,
          type: 'income',
          date: opDate,
          description: `Redemption: ${target.name}`,
          category_id: null,
        });
      }
      persistDemoState({ investments: nextInvs, investmentLogs: nextLogs });
      return;
    }

    setInvestments((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              current_value: updatedValue,
              total_withdrawn: updatedWithdrawn,
              status: newStatus,
              closed_date: closedDate,
              updated_at: new Date().toISOString(),
            }
          : i
      )
    );
    setInvestmentLogs((prev) => [...prev, newLog]);

    if (destAccountId && amount > 0) {
      await addTransaction({
        account_id: destAccountId,
        amount: amount,
        type: 'income',
        date: opDate,
        description: `Redemption: ${target.name}`,
        category_id: null,
      });
    }

    if (!supabase) return;

    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const [, logRes] = await Promise.all([
        supabase
          .from('investments')
          .update({
            current_value: updatedValue,
            total_withdrawn: updatedWithdrawn,
            status: newStatus,
            closed_date: closedDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single(),
        supabase
          .from('investment_logs')
          .insert([{
            user_id: userId,
            investment_id: id,
            type: 'withdraw',
            value: updatedValue,
            amount: amount,
            date: opDate,
            account_id: destAccountId || null,
            notes: notes || (isFullRedemption ? 'Full Redemption' : 'Partial Withdrawal'),
          }])
          .select()
          .single(),
      ]);

      if (logRes.data) {
        setInvestmentLogs((prev) => prev.map((l) => (l.id === tempLogId ? logRes.data : l)));
      }
    } catch (err: any) {
      if (isNetworkOrFetchError(err)) return;
      console.error('Failed to withdraw investment:', err);
    }
  };

  const updateInvestment = async (id: string, updatedFields: Partial<Investment>) => {
    if (isDemoMode) {
      const nextInvs = investments.map((i) => (i.id === id ? { ...i, ...updatedFields, updated_at: new Date().toISOString() } : i));
      setInvestments(nextInvs);
      persistDemoState({ investments: nextInvs });
      return;
    }

    setInvestments((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...updatedFields, updated_at: new Date().toISOString() } : i))
    );

    if (!supabase) return;
    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      await supabase
        .from('investments')
        .update({ ...updatedFields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);
    } catch (err) {
      console.error('Failed to update investment:', err);
    }
  };

  const deleteInvestment = async (id: string) => {
    if (isDemoMode) {
      const nextInvs = investments.filter((i) => i.id !== id);
      const nextLogs = investmentLogs.filter((l) => l.investment_id !== id);
      setInvestments(nextInvs);
      setInvestmentLogs(nextLogs);
      persistDemoState({ investments: nextInvs, investmentLogs: nextLogs });
      return;
    }

    const prevInvs = [...investments];
    const prevLogs = [...investmentLogs];
    setInvestments((prev) => prev.filter((i) => i.id !== id));
    setInvestmentLogs((prev) => prev.filter((l) => l.investment_id !== id));

    if (!supabase) return;
    try {
      const userId = await getAuthUserId();
      if (!userId) return;

      const { error } = await supabase
        .from('investments')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) {
        setInvestments(prevInvs);
        setInvestmentLogs(prevLogs);
        throw error;
      }
    } catch (err) {
      setInvestments(prevInvs);
      setInvestmentLogs(prevLogs);
      throw err;
    }
  };


  const importTransactions = async (
    newTxList: Omit<Transaction, 'id' | 'created_at'>[],
    options?: {
      autoAccounts?: Array<{ name: string; type: AccountType; color: string }>;
      autoCategories?: Array<{ name: string; type: 'expense' | 'income'; color: string }>;
    }
  ): Promise<number> => {
    // 1. If any accounts need to be auto-created (e.g. empty database or missing account), create them first
    if (options?.autoAccounts && options.autoAccounts.length > 0) {
      for (const autoAcc of options.autoAccounts) {
        const exists = accounts.some((a) => a.name.toLowerCase() === autoAcc.name.toLowerCase());
        if (!exists) {
          await addAccount({
            name: autoAcc.name,
            type: autoAcc.type,
            initial_balance: 0,
            is_active: true,
            include_in_budget: true,
            color: autoAcc.color,
          });
        }
      }
    }

    // 2. If any categories need to be auto-created, create them
    if (options?.autoCategories && options.autoCategories.length > 0) {
      for (const autoCat of options.autoCategories) {
        const exists = categories.some((c) => c.name.toLowerCase() === autoCat.name.toLowerCase());
        if (!exists) {
          await addCategory({
            name: autoCat.name,
            type: autoCat.type,
            color: autoCat.color,
            is_default: false,
          });
        }
      }
    }

    if (isDemoMode) {
      const imported: Transaction[] = newTxList.map((tx) => ({
        id: `tx_demo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        created_at: new Date().toISOString(),
        ...tx,
      }));
      const nextTxs = [...imported, ...transactions];
      setTransactions(nextTxs);
      persistDemoState({ transactions: nextTxs });
      return imported.length;
    }

    if (!supabase) throw new Error('Database client not ready');
    const userId = await getAuthUserId();
    if (!userId) throw new Error('Not authenticated');

    const toInsert = newTxList.map((tx) => ({
      ...tx,
      user_id: userId,
    }));

    const { data, error } = await supabase.from('transactions').insert(toInsert).select();
    if (error) {
      console.error('Failed to import transactions:', error);
      throw error;
    }

    if (data) {
      setTransactions((prev) => [...data, ...prev]);
      return data.length;
    }
    return 0;
  };

  // Restore all entities from backup payload
  const restoreFullBackup = async (payload: MasterBackupPayload) => {
    const {
      accounts: backupAccounts = [],
      categories: backupCategories = [],
      transactions: backupTransactions = [],
      debts: backupDebts = [],
      investments: backupInvestments = [],
      investmentLogs: backupInvestmentLogs = [],
      cycles: backupCycles = [],
      monthlyArchives: backupArchives = [],
      cycleStartDate: backupStartDate,
    } = payload;

    if (isDemoMode) {
      setAccounts(backupAccounts);
      setCategories(backupCategories);
      setTransactions(backupTransactions);
      setDebts(backupDebts);
      setInvestments(backupInvestments);
      setInvestmentLogs(backupInvestmentLogs);
      setCycles(backupCycles);
      setMonthlyArchives(backupArchives);
      if (backupStartDate) setCycleStartDate(backupStartDate);

      persistDemoState({
        accounts: backupAccounts,
        categories: backupCategories,
        transactions: backupTransactions,
        debts: backupDebts,
        investments: backupInvestments,
        investmentLogs: backupInvestmentLogs,
        cycles: backupCycles,
        monthlyArchives: backupArchives,
      });

      return {
        accountsCount: backupAccounts.length,
        categoriesCount: backupCategories.length,
        transactionsCount: backupTransactions.length,
        debtsCount: backupDebts.length,
        investmentsCount: backupInvestments.length,
        cyclesCount: backupCycles.length,
        archivesCount: backupArchives.length,
        investmentLogsCount: backupInvestmentLogs.length,
      };
    }

    if (!supabase) throw new Error('Database client not ready');
    const userId = await getAuthUserId();
    if (!userId) throw new Error('Not authenticated');

    // Authorization check: Only superadmin can restore full database backup
    if (currentUser && currentUser.role !== 'superadmin' && !isDemoMode) {
      throw new Error('Access Denied: Full database restore requires superadmin privileges.');
    }

    // ID Remapping map to guarantee valid UUIDs for all foreign keys
    const idMap = new Map<string, string>();
    const getMappedId = (id?: string | null): string => {
      if (!id) return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '';
      if (isValidUuid(id)) return id;
      if (idMap.has(id)) return idMap.get(id)!;
      const newUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '';
      idMap.set(id, newUuid);
      return newUuid;
    };

    // Step 0: If restoring into a clean/fresh or post-cleanup database (no transactions recorded yet),
    // clean up auto-seeded default starter accounts and categories so they don't produce duplicate items!
    if (transactions.length === 0) {
      try {
        const { data: existingTxs } = await supabase.from('transactions').select('id').eq('user_id', userId).limit(1);
        if (!existingTxs || existingTxs.length === 0) {
          if (backupAccounts.length > 0) {
            await supabase.from('accounts').delete().eq('user_id', userId);
          }
          if (backupCategories.length > 0) {
            await supabase.from('categories').delete().eq('user_id', userId);
          }
        }
      } catch (cleanErr) {
        console.warn('Could not clean starter entities before restore:', cleanErr);
      }
    }

    // Step A: Restore Accounts (preserve exact colors, pocket colors, names, initial balance, budget inclusion)
    if (backupAccounts.length > 0) {
      const accRows = backupAccounts.map((a) => {
        const mappedId = getMappedId(a.id);
        return {
          id: mappedId,
          user_id: userId,
          name: a.name,
          type: a.type,
          initial_balance: Number(a.initial_balance) || 0,
          is_active: a.is_active !== false,
          include_in_budget: a.include_in_budget !== false,
          color: a.color || null,
          pocket_name: a.pocket_name || null,
          pocket_color: a.pocket_color || null,
        };
      });

      let { error: accErr } = await supabase.from('accounts').upsert(accRows, { onConflict: 'id' });
      if (accErr && (accErr.code === '42703' || accErr.message?.includes('pocket_') || accErr.message?.includes('include_in_budget'))) {
        const fallbackAccs = accRows.map((a) => {
          const copy: any = { ...a };
          delete copy.pocket_name;
          delete copy.pocket_color;
          delete copy.include_in_budget;
          return copy;
        });
        await supabase.from('accounts').upsert(fallbackAccs, { onConflict: 'id' });
      } else if (accErr) {
        console.error('Failed to upsert accounts in restoreFullBackup:', accErr);
        throw accErr;
      }
    }

    // Step B: Restore Categories (preserve exact names, types, colors, icons, default flags)
    if (backupCategories.length > 0) {
      const catRows = backupCategories.map((c) => {
        const mappedId = getMappedId(c.id);
        return {
          id: mappedId,
          user_id: userId,
          name: c.name,
          type: c.type,
          icon: c.icon || null,
          color: c.color || null,
          is_default: Boolean(c.is_default),
        };
      });
      const { error: catErr } = await supabase.from('categories').upsert(catRows, { onConflict: 'id' });
      if (catErr) {
        console.error('Failed to upsert categories in restoreFullBackup:', catErr);
        throw catErr;
      }
    }

    // Step C: Restore Investments
    if (backupInvestments.length > 0) {
      const invRows = backupInvestments.map((inv) => {
        const mappedId = getMappedId(inv.id);
        return {
          id: mappedId,
          user_id: userId,
          name: inv.name,
          type: inv.type,
          platform: inv.platform || null,
          invested_amount: Number(inv.invested_amount) || 0,
          current_value: Number(inv.current_value) || 0,
          total_withdrawn: Number(inv.total_withdrawn) || 0,
          status: inv.status,
          start_date: inv.start_date,
          closed_date: inv.closed_date || null,
          notes: inv.notes || null,
        };
      });
      const { error: invErr } = await supabase.from('investments').upsert(invRows, { onConflict: 'id' });
      if (invErr) {
        console.warn('Could not upsert investments:', invErr);
      }
    }

    // Step D: Restore Debts
    if (backupDebts.length > 0) {
      const debtRows = backupDebts.map((d) => {
        const mappedId = getMappedId(d.id);
        const accId = d.account_id ? (idMap.get(d.account_id) || d.account_id) : null;
        return {
          id: mappedId,
          user_id: userId,
          type: d.type,
          person: d.person,
          amount: Number(d.amount) || 0,
          remaining_amount: d.remaining_amount !== undefined ? Number(d.remaining_amount) : Number(d.amount),
          date: d.date,
          due_date: d.due_date || null,
          description: d.description || null,
          status: d.status,
          account_id: isValidUuid(accId) ? accId : null,
        };
      });
      const { error: debtErr } = await supabase.from('debts').upsert(debtRows, { onConflict: 'id' });
      if (debtErr) {
        console.warn('Could not upsert debts:', debtErr);
      }
    }

    // Step E: Restore Cycles
    if (backupCycles.length > 0) {
      const cycRows = backupCycles.map((c) => {
        const mappedId = getMappedId(c.id);
        return {
          id: mappedId,
          user_id: userId,
          name: c.name || null,
          start_date: c.start_date,
          end_date: c.end_date || null,
          is_active: Boolean(c.is_active),
        };
      });
      const { error: cycErr } = await supabase.from('cycles').upsert(cycRows, { onConflict: 'id' });
      if (cycErr) {
        console.warn('Could not upsert cycles:', cycErr);
      }
    }

    // Step F: Restore Transactions
    if (backupTransactions.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < backupTransactions.length; i += chunkSize) {
        const chunk = backupTransactions.slice(i, i + chunkSize);
        const txRows = chunk.map((t) => {
          const mappedId = getMappedId(t.id);
          const mappedAccId = idMap.get(t.account_id) || t.account_id;
          const mappedToAccId = t.to_account_id ? (idMap.get(t.to_account_id) || t.to_account_id) : null;
          const mappedCatId = t.category_id ? (idMap.get(t.category_id) || t.category_id) : null;

          return {
            id: mappedId,
            user_id: userId,
            account_id: mappedAccId,
            to_account_id: isValidUuid(mappedToAccId) ? mappedToAccId : null,
            category_id: isValidUuid(mappedCatId) ? mappedCatId : null,
            type: t.type,
            amount: Number(t.amount),
            date: t.date,
            description: t.description || null,
          };
        });

        const { error: txErr } = await supabase.from('transactions').upsert(txRows, { onConflict: 'id' });
        if (txErr) {
          console.error('Failed to upsert transactions chunk:', txErr);
          throw txErr;
        }
      }
    }

    // Step G: Restore Investment Logs
    if (backupInvestmentLogs.length > 0) {
      const logRows = backupInvestmentLogs.map((l) => {
        const mappedId = getMappedId(l.id);
        const mappedInvId = idMap.get(l.investment_id) || l.investment_id;
        const mappedAccId = l.account_id ? (idMap.get(l.account_id) || l.account_id) : null;
        return {
          id: mappedId,
          user_id: userId,
          investment_id: mappedInvId,
          type: l.type,
          value: Number(l.value) || 0,
          amount: Number(l.amount) || 0,
          date: l.date,
          account_id: isValidUuid(mappedAccId) ? mappedAccId : null,
          notes: l.notes || null,
        };
      });
      const { error: logErr } = await supabase.from('investment_logs').upsert(logRows, { onConflict: 'id' });
      if (logErr) {
        console.warn('Could not upsert investment logs:', logErr);
      }
    }

    // Step H: Restore Monthly Archives
    if (backupArchives.length > 0) {
      const archRows = backupArchives.map((a) => {
        const mappedId = getMappedId(a.id);
        return {
          id: mappedId,
          user_id: userId,
          period: a.period,
          period_label: a.period_label,
          start_date: a.start_date,
          end_date: a.end_date,
          total_income: Number(a.total_income) || 0,
          total_expense: Number(a.total_expense) || 0,
          transaction_count: a.transaction_count || 0,
          data_snapshot: a.data_snapshot || [],
        };
      });
      const { error: archErr } = await supabase.from('monthly_archives').upsert(archRows, { onConflict: 'id' });
      if (archErr) {
        console.warn('Could not upsert monthly archives:', archErr);
      }
    }

    // Step I: Persist cycleStartDate if provided
    if (backupStartDate) {
      setCycleStartDate(backupStartDate);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`pocketlog_cycle_start_${userId}`, backupStartDate);
      }
    }

    // Step J: Refresh UI state
    await loadData();

    return {
      accountsCount: backupAccounts.length,
      categoriesCount: backupCategories.length,
      transactionsCount: backupTransactions.length,
      debtsCount: backupDebts.length,
      investmentsCount: backupInvestments.length,
      cyclesCount: backupCycles.length,
      archivesCount: backupArchives.length,
      investmentLogsCount: backupInvestmentLogs.length,
    };
  };

  const startNewCycle = async (
    startDate: string,
    accountAllocations: { id: string; budget: number; include_in_budget?: boolean }[]
  ) => {
    if (isDemoMode) {
      const newCycle: Cycle = {
        id: `cycle_demo_${Date.now()}`,
        user_id: DEMO_USER_ID,
        start_date: startDate,
        name: `Cycle ${startDate}`,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      const nextCycles = [newCycle, ...cycles.map((c) => ({ ...c, is_active: false }))];
      setCycles(nextCycles);
      setCycleStartDate(startDate);

      const nextAccs = accounts.map((acc) => {
        const found = accountAllocations.find((a) => a.id === acc.id);
        if (!found) return acc;
        return {
          ...acc,
          initial_balance: found.budget,
          monthly_budget: found.budget,
          include_in_budget: found.include_in_budget !== undefined ? found.include_in_budget : acc.include_in_budget,
        };
      });
      setAccounts(nextAccs);
      persistDemoState({ cycles: nextCycles, cycleStartDate: startDate, accounts: nextAccs });
      return;
    }

    if (!supabase) throw new Error('Database client not ready');

    const userId = await getAuthUserId();
    if (!userId) throw new Error('Not authenticated');

    // 1. Update each account's initial_balance (monthly budget allocation) and budget inclusion flag
    const budgetFlags: { [id: string]: boolean } = {};
    for (const alloc of accountAllocations) {
      const updateData: any = { initial_balance: alloc.budget };
      if (alloc.include_in_budget !== undefined) {
        updateData.include_in_budget = alloc.include_in_budget;
        budgetFlags[alloc.id] = alloc.include_in_budget;
      }

      let { error } = await supabase
        .from('accounts')
        .update(updateData)
        .eq('id', alloc.id)
        .eq('user_id', userId);

      if (error && (error.code === '42703' || error.message?.includes('include_in_budget'))) {
        delete updateData.include_in_budget;
        const retry = await supabase.from('accounts').update(updateData).eq('id', alloc.id).eq('user_id', userId);
        error = retry.error;
      }

      if (error) {
        console.error('Failed to update account allocation for cycle:', error);
      }
    }

    if (userId && Object.keys(budgetFlags).length > 0) {
      saveBudgetFlagsToLocal(userId, budgetFlags);
    }

    // 2. Compute yesterday as end_date for previous cycle
    const previousEndDate = new Date(new Date(startDate).getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    // 3. Mark previous active cycles as inactive in Supabase
    try {
      await supabase
        .from('cycles')
        .update({ is_active: false, end_date: previousEndDate })
        .eq('user_id', userId)
        .eq('is_active', true);

      // 4. Insert new active cycle
      const { data: newCycleData, error: insertCycleErr } = await supabase
        .from('cycles')
        .insert({
          user_id: userId,
          start_date: startDate,
          name: `Cycle ${startDate}`,
          is_active: true,
        })
        .select()
        .single();

      if (!insertCycleErr && newCycleData) {
        setCycles((prev) => [newCycleData, ...prev.map((c) => ({ ...c, is_active: false }))]);
      }
    } catch (cycleSaveErr) {
      console.warn('Could not save cycle to Supabase cycles table:', cycleSaveErr);
    }

    // 5. Persist to user-partitioned localStorage for fallback
    if (typeof window !== 'undefined') {
      localStorage.setItem(`pocketlog_cycle_start_${userId}`, startDate);
    }
    setCycleStartDate(startDate);

    // 6. Update accounts state in-memory
    setAccounts((prev) =>
      prev.map((acc) => {
        const found = accountAllocations.find((a) => a.id === acc.id);
        if (!found) return acc;
        return {
          ...acc,
          initial_balance: found.budget,
          monthly_budget: found.budget,
          include_in_budget: found.include_in_budget !== undefined ? found.include_in_budget : acc.include_in_budget,
        };
      })
    );
  };

  const createMonthlyArchive = async (startDate: string, endDate: string, periodLabel: string) => {
    if (isDemoMode) {
      const txsInPeriod = transactions.filter((t) => t.date >= startDate && t.date <= endDate);
      if (txsInPeriod.length === 0) {
        throw new Error('No transactions in this period to archive.');
      }
      const totalIncome = txsInPeriod
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const totalExpense = txsInPeriod
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const periodKey = startDate.slice(0, 7);

      const newArchive: MonthlyArchive = {
        id: `arch_demo_${Date.now()}`,
        user_id: DEMO_USER_ID,
        period: periodKey,
        period_label: periodLabel,
        start_date: startDate,
        end_date: endDate,
        total_income: totalIncome,
        total_expense: totalExpense,
        transaction_count: txsInPeriod.length,
        data_snapshot: txsInPeriod,
        created_at: new Date().toISOString(),
      };
      const nextArchs = [newArchive, ...monthlyArchives.filter((a) => a.period !== periodKey)];
      setMonthlyArchives(nextArchs);
      persistDemoState({ monthlyArchives: nextArchs });
      return { archive: newArchive };
    }

    if (!supabase) throw new Error('Database client not ready');
    const userId = await getAuthUserId();
    if (!userId) throw new Error('Not authenticated');

    const txsInPeriod = transactions.filter((t) => t.date >= startDate && t.date <= endDate);
    if (txsInPeriod.length === 0) {
      throw new Error('No transactions in this period to archive.');
    }

    const totalIncome = txsInPeriod
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpense = txsInPeriod
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const periodKey = startDate.slice(0, 7);

    const newArchive: MonthlyArchive = {
      id: crypto.randomUUID(),
      user_id: userId,
      period: periodKey,
      period_label: periodLabel,
      start_date: startDate,
      end_date: endDate,
      total_income: totalIncome,
      total_expense: totalExpense,
      transaction_count: txsInPeriod.length,
      data_snapshot: txsInPeriod,
      created_at: new Date().toISOString(),
    };

    // Try saving to Supabase table
    try {
      const { data, error } = await supabase
        .from('monthly_archives')
        .insert({
          id: newArchive.id,
          user_id: userId,
          period: newArchive.period,
          period_label: newArchive.period_label,
          start_date: newArchive.start_date,
          end_date: newArchive.end_date,
          total_income: newArchive.total_income,
          total_expense: newArchive.total_expense,
          transaction_count: newArchive.transaction_count,
          data_snapshot: newArchive.data_snapshot,
        })
        .select()
        .single();

      if (!error && data) {
        newArchive.id = data.id;
      }
    } catch (e) {
      console.warn('Could not save archive to Supabase table, saving to localStorage:', e);
    }

    // Mirror to user-partitioned localStorage
    const updated = [newArchive, ...monthlyArchives.filter((a) => a.period !== periodKey)];
    setMonthlyArchives(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`pocketlog_cache_${userId}_monthly_archives`, JSON.stringify(updated));
    }

    return { archive: newArchive };
  };

  const restoreMonthlyArchive = async (archiveId: string) => {
    if (isDemoMode) {
      const archive = monthlyArchives.find((a) => a.id === archiveId);
      if (!archive) throw new Error('Archive not found');
      const existingIds = new Set(transactions.map((t) => t.id));
      const toRestore = (archive.data_snapshot || []).filter((t) => !existingIds.has(t.id));
      const nextTxs = [...toRestore, ...transactions];
      setTransactions(nextTxs);
      persistDemoState({ transactions: nextTxs });
      return { restoredCount: toRestore.length };
    }

    if (!supabase) throw new Error('Database client not ready');
    const userId = await getAuthUserId();
    if (!userId) throw new Error('Not authenticated');

    const archive = monthlyArchives.find((a) => a.id === archiveId);
    if (!archive) throw new Error('Archive not found.');

    const existingIds = new Set(transactions.map((t) => t.id));
    const existingKeys = new Set(
      transactions.map((t) => `${t.date}_${t.type}_${Number(t.amount)}_${t.account_id}_${(t.description || '').trim()}`)
    );

    const toRestore = (archive.data_snapshot || []).filter(
      (t) =>
        !existingIds.has(t.id) &&
        !existingKeys.has(`${t.date}_${t.type}_${Number(t.amount)}_${t.account_id}_${(t.description || '').trim()}`)
    );

    if (toRestore.length === 0) {
      return { restoredCount: 0 };
    }

    const payload = toRestore.map((t) => ({
      user_id: userId,
      account_id: t.account_id,
      to_account_id: t.to_account_id || null,
      category_id: t.category_id || null,
      type: t.type,
      amount: Number(t.amount),
      date: t.date,
      description: t.description || null,
    }));

    const { data, error } = await supabase.from('transactions').insert(payload).select();
    if (error) throw error;

    if (data) {
      setTransactions((prev) => [...data, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
    }

    return { restoredCount: toRestore.length };
  };

  const deleteMonthlyArchive = async (archiveId: string) => {
    if (isDemoMode) {
      const nextArchs = monthlyArchives.filter((a) => a.id !== archiveId);
      setMonthlyArchives(nextArchs);
      persistDemoState({ monthlyArchives: nextArchs });
      return;
    }

    if (!supabase) throw new Error('Database client not ready');
    const userId = await getAuthUserId();

    if (userId) {
      try {
        await supabase
          .from('monthly_archives')
          .delete()
          .eq('id', archiveId)
          .eq('user_id', userId);
      } catch (e) {
        console.warn('Could not delete archive from Supabase table:', e);
      }
    }

    const updated = monthlyArchives.filter((a) => a.id !== archiveId);
    setMonthlyArchives(updated);
    if (userId && typeof window !== 'undefined') {
      localStorage.setItem(`pocketlog_cache_${userId}_monthly_archives`, JSON.stringify(updated));
    }
  };

  const updateCurrentUser = useCallback((userData: Partial<User>) => {
    setCurrentUser((prev) => (prev ? { ...prev, ...userData } : (userData as User)));
  }, []);

  return (
    <DataContext.Provider
      value={{
        currentUser,
        updateCurrentUser,
        isDemoMode,
        isTrustedDevice,
        setIsTrustedDevice,
        accounts,
        categories,
        transactions,
        debts,
        monthlyArchives,
        investments,
        investmentLogs,
        isLoading,
        hasSupabaseConfig,
        refreshData: loadData,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addAccount,
        updateAccount,
        updateAccountBudgetInclusions,
        deleteAccount,
        addCategory,
        updateCategory,
        deleteCategory,
        addDebt,
        updateDebt,
        deleteDebt,
        addInvestment,
        updateInvestmentValue,
        topUpInvestment,
        withdrawInvestment,
        updateInvestment,
        deleteInvestment,
        importTransactions,
        restoreFullBackup,
        cycleStartDate,
        cycles,
        startNewCycle,
        createMonthlyArchive,
        restoreMonthlyArchive,
        deleteMonthlyArchive,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useFinanceData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useFinanceData must be used within a DataProvider');
  }
  return context;
}
