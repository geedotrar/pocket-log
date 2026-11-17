import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getActiveSession } from '@/lib/auth/session';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getPushSubscriptionsForUser, deletePushSubscription } from '@/lib/notifications/storage';
import { webpush } from '@/lib/notifications/webPush';

async function getAuthUserId(): Promise<string | null> {
  const session = await getActiveSession();
  if (session && session.userId) return session.userId;

  try {
    const serverSupabase = await createServerSupabase();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (user?.id) return user.id;
  } catch {
    // ignore
  }

  // Demo mode mirroring: allow guests testing demo mode to trigger test push notifications
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

export async function POST(req: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const subscriptions = await getPushSubscriptionsForUser(userId);
    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No devices are registered for push notifications on this account. Please enable notifications first.',
        },
        { status: 400 }
      );
    }

    const payload = JSON.stringify({
      title: 'Notifications Connected 🎉',
      body: 'Push reminders are active. You will receive daily reminders directly on this device.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'test-notification',
      data: { url: '/profile' },
    });

    let sent = 0;
    const errors: any[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          );
          sent++;
        } catch (pushErr: any) {
          console.error('Test push error for endpoint:', sub.endpoint, pushErr);
          // If subscription has expired or unsubscribed, remove it
          if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
            await deletePushSubscription(sub.endpoint);
          }
          errors.push(pushErr?.message || 'Failed to send to device');
        }
      })
    );

    if (sent > 0) {
      return NextResponse.json({
        success: true,
        message: `Test notification sent to ${sent} device(s) successfully!`,
        sentCount: sent,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: `Failed to send notification: ${errors[0] || 'Unknown error'}`,
      },
      { status: 500 }
    );
  } catch (err: any) {
    console.error('Error in POST /api/notifications/test:', err);
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

