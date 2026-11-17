import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getActiveSession } from '@/lib/auth/session';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  DEMO_ACCOUNTS,
  DEMO_CATEGORIES,
  DEMO_TRANSACTIONS,
  DEMO_DEBTS,
  DEMO_INVESTMENTS,
  DEMO_INVESTMENT_LOGS,
  DEMO_CYCLES,
  DEMO_MONTHLY_ARCHIVES,
} from '@/lib/demo/demo-data';

function getAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceRoleKey && url && !url.includes('your-project')) {
    return createSupabaseClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return null;
}

export async function GET() {
  try {
    const session = await getActiveSession();
    const serverSupabase = await createServerSupabase();
    const { data: { user: authUser } } = await serverSupabase.auth.getUser();

    const targetUserId = authUser?.id || session?.userId;
    if (!targetUserId) {
      const cookieStore = await cookies();
      const isDemoMode = cookieStore.get('pocketlog_demo_mode')?.value === 'true';
      if (isDemoMode) {
        return NextResponse.json({
          success: true,
          userId: 'demo-user-0000-0000-0000-000000000000',
          isDemoMode: true,
          accounts: DEMO_ACCOUNTS,
          categories: DEMO_CATEGORIES,
          transactions: DEMO_TRANSACTIONS,
          debts: DEMO_DEBTS,
          investments: DEMO_INVESTMENTS,
          investmentLogs: DEMO_INVESTMENT_LOGS,
          cycles: DEMO_CYCLES,
          monthlyArchives: DEMO_MONTHLY_ARCHIVES,
        });
      }
      return NextResponse.json({ success: false, error: 'Unauthenticated' }, { status: 401 });
    }

    const adminClient = getAdminSupabaseClient();
    const client = adminClient || serverSupabase;

    const [accsRes, catsRes, txsRes, debtsRes, invsRes, logsRes, cyclesRes, archivesRes] = await Promise.all([
      client.from('accounts').select('*').eq('user_id', targetUserId).order('name'),
      client.from('categories').select('*').eq('user_id', targetUserId).order('name'),
      client.from('transactions').select('*').eq('user_id', targetUserId).order('date', { ascending: false }).order('created_at', { ascending: false }),
      client.from('debts').select('*').eq('user_id', targetUserId).order('date', { ascending: false }),
      client.from('investments').select('*').eq('user_id', targetUserId).order('start_date', { ascending: false }),
      client.from('investment_logs').select('*').eq('user_id', targetUserId).order('date', { ascending: true }).order('created_at', { ascending: true }),
      client.from('cycles').select('*').eq('user_id', targetUserId).order('start_date', { ascending: false }),
      client.from('monthly_archives').select('*').eq('user_id', targetUserId).order('period', { ascending: false }),
    ]);

    return NextResponse.json({
      success: true,
      userId: targetUserId,
      accounts: accsRes.data || [],
      categories: catsRes.data || [],
      transactions: txsRes.data || [],
      debts: debtsRes.data || [],
      investments: invsRes.data || [],
      investmentLogs: logsRes.data || [],
      cycles: cyclesRes.data || [],
      monthlyArchives: archivesRes.data || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch financial data';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
