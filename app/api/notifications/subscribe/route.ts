import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getActiveSession } from '@/lib/auth/session';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  savePushSubscription,
  deletePushSubscription,
  getPushSubscriptionsForUser,
} from '@/lib/notifications/storage';

async function getAuthUserId(): Promise<string | null> {
  const session = await getActiveSession();
  if (session && session.userId) {
    return session.userId;
  }

  try {
    const serverSupabase = await createServerSupabase();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (user?.id) return user.id;
  } catch {
    // ignore
  }

  // Demo mode mirroring: allow guests testing demo mode to register push notifications
  try {
    const cookieStore = await cookies();
    const isDemoCookie = cookieStore.get('pocketlog_demo_mode')?.value === 'true';
    if (isDemoCookie) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (url && key) {
        const adminClient = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: defaultUser } = await adminClient
          .from('users')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (defaultUser?.id) return defaultUser.id;
      }
      return 'demo-user-0000-0000-0000-000000000000';
    }
  } catch {
    // ignore
  }

  return null;
}

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ isAuthenticated: false, subscriptions: [] }, { status: 401 });
    }

    const subs = await getPushSubscriptionsForUser(userId);
    return NextResponse.json({
      success: true,
      subscriptionsCount: subs.length,
      isSubscribed: subs.length > 0,
      subscriptions: subs,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = await req.json();
    const { subscription, preferences } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { success: false, error: 'Invalid push subscription payload.' },
        { status: 400 }
      );
    }

    const userAgent = req.headers.get('user-agent') || undefined;

    const res = await savePushSubscription({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      notify_daily: preferences?.notify_daily !== false,
      notify_weekly: preferences?.notify_weekly !== false,
      notify_monthly: preferences?.notify_monthly !== false,
      user_agent: userAgent,
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Push subscription saved successfully.' });
  } catch (err: any) {
    console.error('Error in POST /api/notifications/subscribe:', err);
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ success: false, error: 'Endpoint is required.' }, { status: 400 });
    }

    await deletePushSubscription(endpoint);
    return NextResponse.json({ success: true, message: 'Subscription removed.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

