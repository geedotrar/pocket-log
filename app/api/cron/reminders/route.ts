import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllActivePushSubscriptions, deletePushSubscription } from '@/lib/notifications/storage';
import { webpush } from '@/lib/notifications/webPush';
import { getActiveSession } from '@/lib/auth/session';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function verifyCronAuth(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Only allow unauthenticated local testing in development
    return process.env.NODE_ENV === 'development';
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.replace(/^Bearer\s+/i, '') === cronSecret) {
    return true;
  }

  const tokenParam = req.nextUrl.searchParams.get('token') || req.nextUrl.searchParams.get('key');
  if (tokenParam === cronSecret) {
    return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  return handleReminders(req);
}

export async function POST(req: NextRequest) {
  return handleReminders(req);
}

async function handleReminders(req: NextRequest) {
  const isAuthorized = verifyCronAuth(req);
  if (!isAuthorized) {
    const session = await getActiveSession();
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Unauthorized cron request.' }, { status: 401 });
    }
  }

  const forced = req.nextUrl.searchParams.get('force') === 'true';

  try {
    const subscriptions = await getAllActivePushSubscriptions();
    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active push subscriptions found.',
        sentReminders: 0,
      });
    }

    const supabase = getAdminClient();
    // Format current date in Asia/Jakarta (WIB / UTC+7)
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

    // Group subscriptions by user_id to prevent redundant DB calls
    const userMap = new Map<string, typeof subscriptions>();
    for (const sub of subscriptions) {
      if (!userMap.has(sub.user_id)) {
        userMap.set(sub.user_id, []);
      }
      userMap.get(sub.user_id)!.push(sub);
    }

    let sentCount = 0;
    const summaryDetails: Array<{ userId: string; reminderType: string; status: string }> = [];

    for (const [userId, userSubs] of userMap.entries()) {
      // 1. DAILY EXPENSE REMINDER:
      // Remind user if they haven't recorded any expense transactions for the current day
      const targetDailySubs = userSubs.filter((s) => s.notify_daily);
      if (targetDailySubs.length > 0) {
        let hasExpenseToday = false;
        try {
          const { count } = await supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('type', 'expense')
            .eq('date', todayStr);

          hasExpenseToday = (count || 0) > 0;
        } catch (dbErr) {
          console.warn('Could not query transactions for daily expense reminder:', dbErr);
        }

        if (!hasExpenseToday || forced) {
          const payload = JSON.stringify({
            title: "Log Today's Expenses 📝",
            body: 'No expenses recorded today. Log them now to keep your budget on track.',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `daily-expense-${todayStr}`,
            data: { url: '/transactions' },
          });

          for (const sub of targetDailySubs) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                payload
              );
              sentCount++;
              summaryDetails.push({ userId, reminderType: 'daily_expense', status: 'sent' });
            } catch (pushErr: any) {
              if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
                await deletePushSubscription(sub.endpoint);
              }
            }
          }
        }
      }

      // 2. DUE DATE ALERTS (DEBTS & RECEIVABLES):
      // Alert user if there are debts they owe or receivables due today (or overdue)
      const targetDueSubs = userSubs.filter((s) => s.notify_daily || s.notify_weekly);
      if (targetDueSubs.length > 0) {
        let dueDebts: Array<{ id: string; type: string; person: string; amount: number; due_date: string | null }> = [];
        try {
          const { data } = await supabase
            .from('debts')
            .select('id, type, person, amount, due_date')
            .eq('user_id', userId)
            .eq('status', 'outstanding')
            .lte('due_date', todayStr);

          if (data) dueDebts = data;
        } catch (dbErr) {
          console.warn('Could not query debts for due date alerts:', dbErr);
        }

        const debtsIOwe = dueDebts.filter((d) => d.type === 'i_owe');
        const debtsTheyOwe = dueDebts.filter((d) => d.type === 'they_owe');

        // 2a. Debt I owe (Payable due today)
        if (debtsIOwe.length > 0 || (forced && dueDebts.length === 0)) {
          const firstPerson = debtsIOwe[0]?.person;
          const bodyText =
            debtsIOwe.length === 1 && firstPerson
              ? `You have a debt payment due to ${firstPerson}. Please review and settle it.`
              : `You have ${debtsIOwe.length} debt payment(s) due today. Please review and settle them.`;

          const payload = JSON.stringify({
            title: 'Debt Payment Due 💳',
            body: bodyText,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `debt-due-${todayStr}`,
            data: { url: '/debts' },
          });

          for (const sub of targetDueSubs) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                payload
              );
              sentCount++;
              summaryDetails.push({ userId, reminderType: 'debt_due', status: 'sent' });
            } catch (pushErr: any) {
              if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
                await deletePushSubscription(sub.endpoint);
              }
            }
          }
        }

        // 2b. Money owed to me (Receivable due today)
        if (debtsTheyOwe.length > 0) {
          const firstPerson = debtsTheyOwe[0]?.person;
          const bodyText =
            debtsTheyOwe.length === 1 && firstPerson
              ? `Payment from ${firstPerson} is due today.`
              : `You have ${debtsTheyOwe.length} receivable payment(s) due today.`;

          const payload = JSON.stringify({
            title: 'Receivable Due Today 💰',
            body: `${bodyText} Check your outstanding list for details.`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `receivable-due-${todayStr}`,
            data: { url: '/debts' },
          });

          for (const sub of targetDueSubs) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                payload
              );
              sentCount++;
              summaryDetails.push({ userId, reminderType: 'receivable_due', status: 'sent' });
            } catch (pushErr: any) {
              if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
                await deletePushSubscription(sub.endpoint);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      sentCount,
      summaryDetails,
    });
  } catch (err: any) {
    console.error('Error handling cron reminders:', err);
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
