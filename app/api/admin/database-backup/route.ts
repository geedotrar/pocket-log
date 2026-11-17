import { NextRequest, NextResponse } from 'next/server';
import { getActiveSession } from '@/lib/auth/session';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Helper to escape SQL single quotes
function escapeSqlString(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

// Convert JSON database snapshot to a full PostgreSQL restore script (.sql)
function generateSqlDump(backupData: any): string {
  const tables = backupData.tables || {};
  const dateStr = backupData.exported_at || new Date().toISOString();

  let sql = `-- PocketLog Database Backup (${dateStr})\n\n`;
  sql += `BEGIN;\n\n`;

  // 1. Users
  if (tables.users && tables.users.length > 0) {
    sql += `-- 1. USERS (${tables.users.length} rows)\n`;
    for (const u of tables.users) {
      sql += `INSERT INTO public.users (id, email, full_name, role, pin_hash, pin_failed_attempts, pin_locked_until, created_at, updated_at) VALUES (\n`;
      sql += `  ${escapeSqlString(u.id)}, ${escapeSqlString(u.email)}, ${escapeSqlString(u.full_name)}, ${escapeSqlString(u.role || 'user')},\n`;
      sql += `  ${escapeSqlString(u.pin_hash)}, ${u.pin_failed_attempts || 0}, ${escapeSqlString(u.pin_locked_until)}, ${escapeSqlString(u.created_at)}, ${escapeSqlString(u.updated_at)}\n`;
      sql += `) ON CONFLICT (id) DO UPDATE SET\n`;
      sql += `  email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = EXCLUDED.role, pin_hash = COALESCE(EXCLUDED.pin_hash, public.users.pin_hash);\n\n`;
    }
  }

  // 2. Accounts
  if (tables.accounts && tables.accounts.length > 0) {
    sql += `-- 2. ACCOUNTS (${tables.accounts.length} rows)\n`;
    for (const a of tables.accounts) {
      sql += `INSERT INTO public.accounts (id, user_id, name, type, initial_balance, is_active, include_in_budget, color, pocket_name, pocket_color, created_at, updated_at) VALUES (\n`;
      sql += `  ${escapeSqlString(a.id)}, ${escapeSqlString(a.user_id)}, ${escapeSqlString(a.name)}, ${escapeSqlString(a.type)},\n`;
      sql += `  ${a.initial_balance || 0}, ${a.is_active !== false ? 'TRUE' : 'FALSE'}, ${a.include_in_budget !== false ? 'TRUE' : 'FALSE'},\n`;
      sql += `  ${escapeSqlString(a.color)}, ${escapeSqlString(a.pocket_name)}, ${escapeSqlString(a.pocket_color)}, ${escapeSqlString(a.created_at)}, ${escapeSqlString(a.updated_at)}\n`;
      sql += `) ON CONFLICT (id) DO UPDATE SET\n`;
      sql += `  name = EXCLUDED.name, type = EXCLUDED.type, initial_balance = EXCLUDED.initial_balance, is_active = EXCLUDED.is_active,\n`;
      sql += `  include_in_budget = EXCLUDED.include_in_budget, color = EXCLUDED.color, pocket_name = EXCLUDED.pocket_name, pocket_color = EXCLUDED.pocket_color;\n\n`;
    }
  }

  // 3. Categories
  if (tables.categories && tables.categories.length > 0) {
    sql += `-- 3. CATEGORIES (${tables.categories.length} rows)\n`;
    for (const c of tables.categories) {
      sql += `INSERT INTO public.categories (id, user_id, name, type, icon, color, is_default, created_at) VALUES (\n`;
      sql += `  ${escapeSqlString(c.id)}, ${escapeSqlString(c.user_id)}, ${escapeSqlString(c.name)}, ${escapeSqlString(c.type)},\n`;
      sql += `  ${escapeSqlString(c.icon)}, ${escapeSqlString(c.color)}, ${c.is_default ? 'TRUE' : 'FALSE'}, ${escapeSqlString(c.created_at)}\n`;
      sql += `) ON CONFLICT (id) DO UPDATE SET\n`;
      sql += `  name = EXCLUDED.name, type = EXCLUDED.type, icon = EXCLUDED.icon, color = EXCLUDED.color, is_default = EXCLUDED.is_default;\n\n`;
    }
  }

  // 4. Transactions
  if (tables.transactions && tables.transactions.length > 0) {
    sql += `-- 4. TRANSACTIONS (${tables.transactions.length} rows)\n`;
    for (const t of tables.transactions) {
      sql += `INSERT INTO public.transactions (id, user_id, account_id, to_account_id, category_id, type, amount, date, description, created_at) VALUES (\n`;
      sql += `  ${escapeSqlString(t.id)}, ${escapeSqlString(t.user_id)}, ${escapeSqlString(t.account_id)}, ${escapeSqlString(t.to_account_id)},\n`;
      sql += `  ${escapeSqlString(t.category_id)}, ${escapeSqlString(t.type)}, ${t.amount || 0}, ${escapeSqlString(t.date)},\n`;
      sql += `  ${escapeSqlString(t.description)}, ${escapeSqlString(t.created_at)}\n`;
      sql += `) ON CONFLICT (id) DO UPDATE SET\n`;
      sql += `  account_id = EXCLUDED.account_id, to_account_id = EXCLUDED.to_account_id, category_id = EXCLUDED.category_id,\n`;
      sql += `  type = EXCLUDED.type, amount = EXCLUDED.amount, date = EXCLUDED.date, description = EXCLUDED.description;\n\n`;
    }
  }

  // 5. Debts
  if (tables.debts && tables.debts.length > 0) {
    sql += `-- 5. DEBTS (${tables.debts.length} rows)\n`;
    for (const d of tables.debts) {
      sql += `INSERT INTO public.debts (id, user_id, account_id, type, person, amount, remaining_amount, status, due_date, date, description, created_at, updated_at) VALUES (\n`;
      sql += `  ${escapeSqlString(d.id)}, ${escapeSqlString(d.user_id)}, ${escapeSqlString(d.account_id)}, ${escapeSqlString(d.type)},\n`;
      sql += `  ${escapeSqlString(d.person || d.person_name)}, ${d.amount || 0}, ${escapeSqlString(d.remaining_amount)}, ${escapeSqlString(d.status)},\n`;
      sql += `  ${escapeSqlString(d.due_date)}, ${escapeSqlString(d.date)}, ${escapeSqlString(d.description || d.notes)}, ${escapeSqlString(d.created_at)},\n`;
      sql += `  ${escapeSqlString(d.updated_at || d.created_at)}\n`;
      sql += `) ON CONFLICT (id) DO UPDATE SET\n`;
      sql += `  account_id = EXCLUDED.account_id, type = EXCLUDED.type, person = EXCLUDED.person, amount = EXCLUDED.amount,\n`;
      sql += `  remaining_amount = EXCLUDED.remaining_amount, status = EXCLUDED.status, due_date = EXCLUDED.due_date, description = EXCLUDED.description;\n\n`;
    }
  }

  // 6. Investments & Logs
  if (tables.investments && tables.investments.length > 0) {
    sql += `-- 6. INVESTMENTS (${tables.investments.length} rows)\n`;
    for (const i of tables.investments) {
      sql += `INSERT INTO public.investments (id, user_id, name, type, platform, invested_amount, current_value, total_withdrawn, status, start_date, closed_date, notes, created_at, updated_at) VALUES (\n`;
      sql += `  ${escapeSqlString(i.id)}, ${escapeSqlString(i.user_id)}, ${escapeSqlString(i.name)}, ${escapeSqlString(i.type || 'mutual_fund')},\n`;
      sql += `  ${escapeSqlString(i.platform)}, ${i.invested_amount ?? i.initial_amount ?? 0}, ${i.current_value || 0}, ${i.total_withdrawn || 0},\n`;
      sql += `  ${escapeSqlString(i.status || 'active')}, ${escapeSqlString(i.start_date)}, ${escapeSqlString(i.closed_date)}, ${escapeSqlString(i.notes)},\n`;
      sql += `  ${escapeSqlString(i.created_at)}, ${escapeSqlString(i.updated_at || i.created_at)}\n`;
      sql += `) ON CONFLICT (id) DO UPDATE SET\n`;
      sql += `  name = EXCLUDED.name, type = EXCLUDED.type, platform = EXCLUDED.platform, invested_amount = EXCLUDED.invested_amount,\n`;
      sql += `  current_value = EXCLUDED.current_value, total_withdrawn = EXCLUDED.total_withdrawn, status = EXCLUDED.status,\n`;
      sql += `  start_date = EXCLUDED.start_date, closed_date = EXCLUDED.closed_date, notes = EXCLUDED.notes;\n\n`;
    }
  }

  if (tables.investment_logs && tables.investment_logs.length > 0) {
    sql += `-- 7. INVESTMENT LOGS (${tables.investment_logs.length} rows)\n`;
    for (const l of tables.investment_logs) {
      sql += `INSERT INTO public.investment_logs (id, user_id, investment_id, account_id, type, amount, value, notes, date, created_at) VALUES (\n`;
      sql += `  ${escapeSqlString(l.id)}, ${escapeSqlString(l.user_id)}, ${escapeSqlString(l.investment_id)}, ${escapeSqlString(l.account_id)},\n`;
      sql += `  ${escapeSqlString(l.type)}, ${l.amount || 0}, ${l.value ?? l.current_value ?? 0}, ${escapeSqlString(l.notes)}, ${escapeSqlString(l.date)},\n`;
      sql += `  ${escapeSqlString(l.created_at)}\n`;
      sql += `) ON CONFLICT (id) DO UPDATE SET\n`;
      sql += `  investment_id = EXCLUDED.investment_id, account_id = EXCLUDED.account_id, type = EXCLUDED.type, amount = EXCLUDED.amount,\n`;
      sql += `  value = EXCLUDED.value, notes = EXCLUDED.notes, date = EXCLUDED.date;\n\n`;
    }
  }

  // 8. Cycles
  if (tables.cycles && tables.cycles.length > 0) {
    sql += `-- 8. PAYDAY CYCLES (${tables.cycles.length} rows)\n`;
    for (const cy of tables.cycles) {
      sql += `INSERT INTO public.cycles (id, user_id, name, start_date, end_date, is_active, created_at, updated_at) VALUES (\n`;
      sql += `  ${escapeSqlString(cy.id)}, ${escapeSqlString(cy.user_id)}, ${escapeSqlString(cy.name)}, ${escapeSqlString(cy.start_date)},\n`;
      sql += `  ${escapeSqlString(cy.end_date)}, ${cy.is_active ? 'TRUE' : 'FALSE'}, ${escapeSqlString(cy.created_at)},\n`;
      sql += `  ${escapeSqlString(cy.updated_at || cy.created_at)}\n`;
      sql += `) ON CONFLICT (id) DO UPDATE SET\n`;
      sql += `  name = EXCLUDED.name, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, is_active = EXCLUDED.is_active;\n\n`;
    }
  }

  // 9. Monthly Archives
  if (tables.monthly_archives && tables.monthly_archives.length > 0) {
    sql += `-- 9. MONTHLY ARCHIVES (${tables.monthly_archives.length} rows)\n`;
    for (const m of tables.monthly_archives) {
      sql += `INSERT INTO public.monthly_archives (id, user_id, period, period_label, start_date, end_date, total_income, total_expense, transaction_count, data_snapshot, created_at) VALUES (\n`;
      sql += `  ${escapeSqlString(m.id)}, ${escapeSqlString(m.user_id)}, ${escapeSqlString(m.period)}, ${escapeSqlString(m.period_label)},\n`;
      sql += `  ${escapeSqlString(m.start_date)}, ${escapeSqlString(m.end_date)}, ${m.total_income || 0}, ${m.total_expense || 0},\n`;
      sql += `  ${m.transaction_count || 0}, ${escapeSqlString(m.data_snapshot || [])}, ${escapeSqlString(m.created_at)}\n`;
      sql += `) ON CONFLICT (id) DO UPDATE SET\n`;
      sql += `  period_label = EXCLUDED.period_label, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,\n`;
      sql += `  total_income = EXCLUDED.total_income, total_expense = EXCLUDED.total_expense, transaction_count = EXCLUDED.transaction_count,\n`;
      sql += `  data_snapshot = EXCLUDED.data_snapshot;\n\n`;
    }
  }

  sql += `COMMIT;\n`;
  return sql;
}

/**
 * GET: Export 100% of the database across ALL users (Superadmin Only)
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authorize: Must be superadmin
    let isSuperAdmin = false;
    let adminUserId: string | null = null;

    const session = await getActiveSession();
    const isDemoCookie = req.cookies.get('pocketlog_demo_mode')?.value === 'true';

    if (session) {
      adminUserId = session.userId;
      isSuperAdmin = session.role === 'superadmin';
    } else {
      const serverSupabase = await createServerClient();
      const { data: { user } } = await serverSupabase.auth.getUser();
      if (user) {
        adminUserId = user.id;
        // Verify role in public.users
        const { data: userRec } = await serverSupabase.from('users').select('role').eq('id', user.id).single();
        isSuperAdmin = Boolean(userRec?.role === 'superadmin');
      } else if (isDemoCookie || !user) {
        // Fallback to Demo Mode Sandbox
        isSuperAdmin = true;
        adminUserId = 'demo-user-0000-0000-0000-000000000000';
      }
    }

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Access Denied: Only Superadmin can download full global database backups.' }, { status: 403 });
    }

    const isDemoMode = adminUserId === 'demo-user-0000-0000-0000-000000000000';
    let backupData: any = null;

    if (isDemoMode) {
      const users = [
        { id: 'demo-user-0000-0000-0000-000000000000', email: 'demo@pocketlog.app', full_name: 'Guest Explorer', role: 'superadmin', pin_hash: 'demo_pin_hash', pin_failed_attempts: 0, pin_locked_until: null, created_at: '2026-10-01T08:00:00Z', updated_at: '2026-10-01T08:00:00Z' },
        { id: 'demo-user-0000-0000-0000-000000000001', email: 'admin@pocketlog.app', full_name: 'System Admin', role: 'superadmin', pin_hash: 'demo_pin_hash', pin_failed_attempts: 0, pin_locked_until: null, created_at: '2026-09-15T10:30:00Z', updated_at: '2026-09-15T10:30:00Z' },
        { id: 'demo-user-0000-0000-0000-000000000002', email: 'sarah.jenkins@example.com', full_name: 'Sarah Jenkins', role: 'user', pin_hash: 'demo_pin_hash', pin_failed_attempts: 0, pin_locked_until: null, created_at: '2026-10-12T14:20:00Z', updated_at: '2026-10-12T14:20:00Z' },
        { id: 'demo-user-0000-0000-0000-000000000003', email: 'alex.rivera@example.com', full_name: 'Alex Rivera', role: 'user', pin_hash: null, pin_failed_attempts: 0, pin_locked_until: null, created_at: '2026-10-20T09:15:00Z', updated_at: '2026-10-20T09:15:00Z' },
      ];

      const accounts = [
        { id: 'acc-demo-1', user_id: 'demo-user-0000-0000-0000-000000000000', name: 'Main Checking', type: 'bank', initial_balance: 15000000, is_active: true, include_in_budget: true, color: '#005E5D', pocket_name: 'Daily Expenses', pocket_color: '#4D6A58', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' },
        { id: 'acc-demo-2', user_id: 'demo-user-0000-0000-0000-000000000000', name: 'Savings Account', type: 'bank', initial_balance: 35000000, is_active: true, include_in_budget: false, color: '#003366', pocket_name: 'Emergency Fund', pocket_color: '#3B82F6', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' },
        { id: 'acc-demo-3', user_id: 'demo-user-0000-0000-0000-000000000000', name: 'Digital Wallet', type: 'ewallet', initial_balance: 850000, is_active: true, include_in_budget: true, color: '#00AA13', pocket_name: 'Digital Wallet', pocket_color: '#10B981', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' },
      ];

      const categories = [
        { id: 'cat-demo-1', user_id: 'demo-user-0000-0000-0000-000000000000', name: 'Salary & Income', type: 'income', icon: 'Wallet', color: '#10B981', is_default: true, created_at: '2026-10-01T00:00:00Z' },
        { id: 'cat-demo-2', user_id: 'demo-user-0000-0000-0000-000000000000', name: 'Food & Dining', type: 'expense', icon: 'Utensils', color: '#EF4444', is_default: true, created_at: '2026-10-01T00:00:00Z' },
        { id: 'cat-demo-3', user_id: 'demo-user-0000-0000-0000-000000000000', name: 'Transportation', type: 'expense', icon: 'Car', color: '#F59E0B', is_default: true, created_at: '2026-10-01T00:00:00Z' },
        { id: 'cat-demo-4', user_id: 'demo-user-0000-0000-0000-000000000000', name: 'Bills & Utilities', type: 'expense', icon: 'Zap', color: '#8B5CF6', is_default: true, created_at: '2026-10-01T00:00:00Z' },
      ];

      const transactions = [
        { id: 'tx-demo-1', user_id: 'demo-user-0000-0000-0000-000000000000', account_id: 'acc-demo-1', category_id: 'cat-demo-1', type: 'income', amount: 25000000, date: '2026-11-01', description: 'Monthly Salary', created_at: '2026-11-01T08:00:00Z' },
        { id: 'tx-demo-2', user_id: 'demo-user-0000-0000-0000-000000000000', account_id: 'acc-demo-1', category_id: 'cat-demo-2', type: 'expense', amount: 150000, date: '2026-11-02', description: 'Restaurant Lunch', created_at: '2026-11-02T12:30:00Z' },
        { id: 'tx-demo-3', user_id: 'demo-user-0000-0000-0000-000000000000', account_id: 'acc-demo-3', category_id: 'cat-demo-3', type: 'expense', amount: 45000, date: '2026-11-03', description: 'Online Ride', created_at: '2026-11-03T09:15:00Z' },
      ];

      backupData = {
        success: true,
        app: 'PocketLog',
        type: 'POCKETLOG_GLOBAL_DATABASE_BACKUP',
        version: 3,
        scope: 'ALL_USERS_AND_ALL_TABLES',
        exported_at: new Date().toISOString(),
        exported_by: adminUserId,
        summary: {
          totalUsers: users.length,
          totalAccounts: accounts.length,
          totalCategories: categories.length,
          totalTransactions: transactions.length,
          totalDebts: 0,
          totalInvestments: 0,
          totalInvestmentLogs: 0,
          totalCycles: 0,
          totalMonthlyArchives: 0,
        },
        tables: {
          users,
          accounts,
          categories,
          transactions,
          debts: [],
          investments: [],
          investment_logs: [],
          cycles: [],
          monthly_archives: [],
          trusted_devices: [],
        },
      };
    } else {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

    // 2. Extract all tables
    // Method A: If SUPABASE_SERVICE_ROLE_KEY is set, use it to query all tables directly (bypasses RLS)
    if (serviceRoleKey) {
      const adminClient = createSupabaseClient(url, serviceRoleKey, { auth: { persistSession: false } });

      const [
        usersRes,
        accountsRes,
        categoriesRes,
        txsRes,
        debtsRes,
        invsRes,
        invLogsRes,
        cyclesRes,
        archivesRes,
        devicesRes,
      ] = await Promise.all([
        adminClient.from('users').select('*').order('created_at', { ascending: true }),
        adminClient.from('accounts').select('*').order('created_at', { ascending: true }),
        adminClient.from('categories').select('*').order('created_at', { ascending: true }),
        adminClient.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
        adminClient.from('debts').select('*').order('date', { ascending: false }),
        adminClient.from('investments').select('*').order('start_date', { ascending: false }),
        adminClient.from('investment_logs').select('*').order('date', { ascending: true }).order('created_at', { ascending: true }),
        adminClient.from('cycles').select('*').order('start_date', { ascending: false }),
        adminClient.from('monthly_archives').select('*').order('period', { ascending: false }),
        adminClient.from('trusted_devices').select('*'),
      ]);

      const users = usersRes.data || [];
      const accounts = accountsRes.data || [];
      const categories = categoriesRes.data || [];
      const transactions = txsRes.data || [];
      const debts = debtsRes.data || [];
      const investments = invsRes.data || [];
      const investment_logs = invLogsRes.data || [];
      const cycles = cyclesRes.data || [];
      const monthly_archives = archivesRes.data || [];
      const trusted_devices = devicesRes.data || [];

      backupData = {
        success: true,
        app: 'PocketLog',
        type: 'POCKETLOG_GLOBAL_DATABASE_BACKUP',
        version: 3,
        scope: 'ALL_USERS_AND_ALL_TABLES',
        exported_at: new Date().toISOString(),
        exported_by: adminUserId,
        summary: {
          totalUsers: users.length,
          totalAccounts: accounts.length,
          totalCategories: categories.length,
          totalTransactions: transactions.length,
          totalDebts: debts.length,
          totalInvestments: investments.length,
          totalInvestmentLogs: investment_logs.length,
          totalCycles: cycles.length,
          totalMonthlyArchives: monthly_archives.length,
        },
        tables: {
          users,
          accounts,
          categories,
          transactions,
          debts,
          investments,
          investment_logs,
          cycles,
          monthly_archives,
          trusted_devices,
        },
      };
    } else {
      // Method B: Try calling RPC admin_export_full_database
      const normalClient = createSupabaseClient(url, anonKey);
      const { data: rpcData, error: rpcError } = await normalClient.rpc('admin_export_full_database', {
        p_admin_user_id: adminUserId,
      });

      if (!rpcError && rpcData && rpcData.success) {
        backupData = rpcData;
      } else {
        return NextResponse.json(
          {
            error:
              'SUPABASE_SERVICE_ROLE_KEY is required in .env to export all users and bypass RLS.',
            details: rpcError?.message,
            needs_config: true,
          },
          { status: 500 }
        );
      }
    }
  }

    // 3. Output formats: SQL dump or JSON
    const searchParams = req.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json';
    const todayStr = new Date().toISOString().slice(0, 10);

    if (format === 'sql') {
      const sqlContent = generateSqlDump(backupData);
      return new NextResponse(sqlContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/sql; charset=utf-8',
          'Content-Disposition': `attachment; filename="PocketLog_GLOBAL_DB_DUMP_${todayStr}.sql"`,
        },
      });
    }

    // Default: Structured JSON
    return new NextResponse(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="PocketLog_GLOBAL_FULL_DB_${todayStr}.json"`,
      },
    });
  } catch (err: any) {
    console.error('Global database backup failed:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate global database backup.' }, { status: 500 });
  }
}

/**
 * POST: Restore 100% of the database across ALL users (Superadmin Only)
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authorize: Must be superadmin
    let isSuperAdmin = false;
    let adminUserId: string | null = null;

    const session = await getActiveSession();
    const isDemoCookie = req.cookies.get('pocketlog_demo_mode')?.value === 'true';

    if (session) {
      adminUserId = session.userId;
      isSuperAdmin = session.role === 'superadmin';
    } else {
      const serverSupabase = await createServerClient();
      const { data: { user } } = await serverSupabase.auth.getUser();
      if (user) {
        adminUserId = user.id;
        const { data: userRec } = await serverSupabase.from('users').select('role').eq('id', user.id).single();
        isSuperAdmin = Boolean(userRec?.role === 'superadmin');
      } else if (isDemoCookie || !user) {
        isSuperAdmin = true;
        adminUserId = 'demo-user-0000-0000-0000-000000000000';
      }
    }

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Access Denied: Only Superadmin can restore global database backups.' }, { status: 403 });
    }

    const payload = await req.json();
    const tables = payload.tables;
    if (!tables) {
      return NextResponse.json({ error: 'Invalid backup format: missing "tables" object.' }, { status: 400 });
    }

    if (adminUserId === 'demo-user-0000-0000-0000-000000000000') {
      return NextResponse.json({
        success: true,
        message: 'Global database restored successfully (Demo Mode Sandbox).',
        summary: {
          users: tables.users?.length || 4,
          accounts: tables.accounts?.length || 5,
          categories: tables.categories?.length || 10,
          transactions: tables.transactions?.length || 25,
          debts: tables.debts?.length || 2,
          investments: tables.investments?.length || 3,
          investment_logs: tables.investment_logs?.length || 3,
          cycles: tables.cycles?.length || 1,
          monthly_archives: tables.monthly_archives?.length || 2,
        },
      });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

    // Method A: Restore via Service Role Key (direct batch upserts across all users)
    if (serviceRoleKey) {
      const adminClient = createSupabaseClient(url, serviceRoleKey, { auth: { persistSession: false } });

      // 1. Users
      if (tables.users?.length) {
        await adminClient.from('users').upsert(tables.users, { onConflict: 'id' });
      }

      // 2. Accounts
      if (tables.accounts?.length) {
        await adminClient.from('accounts').upsert(tables.accounts, { onConflict: 'id' });
      }

      // 3. Categories
      if (tables.categories?.length) {
        await adminClient.from('categories').upsert(tables.categories, { onConflict: 'id' });
      }

      // 4. Transactions (Chunked to 200 rows per batch)
      if (tables.transactions?.length) {
        const txs = tables.transactions;
        for (let i = 0; i < txs.length; i += 200) {
          const chunk = txs.slice(i, i + 200);
          await adminClient.from('transactions').upsert(chunk, { onConflict: 'id' });
        }
      }

      // 5. Debts
      if (tables.debts?.length) {
        await adminClient.from('debts').upsert(tables.debts, { onConflict: 'id' });
      }

      // 6. Investments
      if (tables.investments?.length) {
        await adminClient.from('investments').upsert(tables.investments, { onConflict: 'id' });
      }

      // 7. Investment Logs
      if (tables.investment_logs?.length) {
        await adminClient.from('investment_logs').upsert(tables.investment_logs, { onConflict: 'id' });
      }

      // 8. Cycles
      if (tables.cycles?.length) {
        await adminClient.from('cycles').upsert(tables.cycles, { onConflict: 'id' });
      }

      // 9. Monthly Archives
      if (tables.monthly_archives?.length) {
        await adminClient.from('monthly_archives').upsert(tables.monthly_archives, { onConflict: 'id' });
      }

      return NextResponse.json({
        success: true,
        message: 'Global database restored successfully via Service Role.',
        summary: {
          users: tables.users?.length || 0,
          accounts: tables.accounts?.length || 0,
          categories: tables.categories?.length || 0,
          transactions: tables.transactions?.length || 0,
          debts: tables.debts?.length || 0,
          investments: tables.investments?.length || 0,
          investment_logs: tables.investment_logs?.length || 0,
          cycles: tables.cycles?.length || 0,
          monthly_archives: tables.monthly_archives?.length || 0,
        },
      });
    }

    // Method B: Restore via RPC admin_restore_full_database
    const normalClient = createSupabaseClient(url, anonKey);
    const { data: rpcData, error: rpcError } = await normalClient.rpc('admin_restore_full_database', {
      p_admin_user_id: adminUserId,
      p_payload: payload,
    });

    if (!rpcError && rpcData && rpcData.success) {
      return NextResponse.json(rpcData);
    }

    return NextResponse.json(
      {
        error:
          'SUPABASE_SERVICE_ROLE_KEY is required in .env for global database restore.',
        details: rpcError?.message,
      },
      { status: 500 }
    );
  } catch (err: any) {
    console.error('Global database restore failed:', err);
    return NextResponse.json({ error: err.message || 'Failed to restore global database.' }, { status: 500 });
  }
}
