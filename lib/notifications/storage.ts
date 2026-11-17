import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export interface PushSubscriptionPreferences {
  notify_daily: boolean;
  notify_weekly: boolean;
  notify_monthly: boolean;
}

export interface PushSubscriptionRecord {
  id?: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  notify_daily: boolean;
  notify_weekly: boolean;
  notify_monthly: boolean;
  user_agent?: string;
  created_at?: string;
  updated_at?: string;
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function hashEndpoint(endpoint: string): string {
  return 'push_' + crypto.createHash('sha256').update(endpoint).digest('hex');
}

export async function savePushSubscription(
  record: PushSubscriptionRecord
): Promise<{ success: boolean; error?: string }> {
  const supabase = getAdminClient();

  try {
    // 1. Try dedicated push_subscriptions table
    const { error: dedicatedErr } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: record.user_id,
        endpoint: record.endpoint,
        p256dh: record.p256dh,
        auth: record.auth,
        notify_daily: record.notify_daily,
        notify_weekly: record.notify_weekly,
        notify_monthly: record.notify_monthly,
        user_agent: record.user_agent || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

    if (!dedicatedErr) {
      return { success: true };
    }

    // If table not found (PGRST205), seamlessly fall back to trusted_devices table
    if (dedicatedErr.code === 'PGRST205' || dedicatedErr.message?.includes('not find the table')) {
      const endpointHash = hashEndpoint(record.endpoint);
      const payload = {
        is_push_sub: true,
        user_id: record.user_id,
        endpoint: record.endpoint,
        p256dh: record.p256dh,
        auth: record.auth,
        notify_daily: record.notify_daily,
        notify_weekly: record.notify_weekly,
        notify_monthly: record.notify_monthly,
        user_agent: record.user_agent || null,
        updated_at: new Date().toISOString(),
      };

      // Check if existing record exists in trusted_devices
      const { data: existing } = await supabase
        .from('trusted_devices')
        .select('id')
        .eq('device_token_hash', endpointHash)
        .maybeSingle();

      if (existing) {
        const { error: updateErr } = await supabase
          .from('trusted_devices')
          .update({
            device_name: JSON.stringify(payload),
            last_used_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            is_revoked: false,
          })
          .eq('id', existing.id);

        if (updateErr) return { success: false, error: updateErr.message };
        return { success: true };
      }

      const { error: insertErr } = await supabase.from('trusted_devices').insert({
        user_id: record.user_id,
        device_token_hash: endpointHash,
        device_name: JSON.stringify(payload),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        is_revoked: false,
      });

      if (insertErr) return { success: false, error: insertErr.message };
      return { success: true };
    }

    return { success: false, error: dedicatedErr.message };
  } catch (err: any) {
    console.error('savePushSubscription error:', err);
    return { success: false, error: err?.message || 'Failed to save push subscription' };
  }
}

/**
 * Retrieve all active push subscriptions for a specific user.
 */
export async function getPushSubscriptionsForUser(
  userId: string
): Promise<PushSubscriptionRecord[]> {
  const supabase = getAdminClient();
  const results: PushSubscriptionRecord[] = [];

  try {
    // 1. Try dedicated table
    const { data: dedicatedData, error: dedicatedErr } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (!dedicatedErr && dedicatedData) {
      results.push(...(dedicatedData as PushSubscriptionRecord[]));
    }

    // 2. Also check fallback in trusted_devices
    const { data: fallbackData } = await supabase
      .from('trusted_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('is_revoked', false)
      .like('device_token_hash', 'push_%');

    if (fallbackData) {
      for (const row of fallbackData) {
        try {
          const parsed = JSON.parse(row.device_name || '{}');
          if (parsed && parsed.is_push_sub && parsed.endpoint) {
            // Avoid duplicate endpoints
            if (!results.some((r) => r.endpoint === parsed.endpoint)) {
              results.push({
                id: row.id,
                user_id: row.user_id,
                endpoint: parsed.endpoint,
                p256dh: parsed.p256dh,
                auth: parsed.auth,
                notify_daily: parsed.notify_daily !== false,
                notify_weekly: parsed.notify_weekly !== false,
                notify_monthly: parsed.notify_monthly !== false,
                user_agent: parsed.user_agent,
                created_at: row.created_at,
                updated_at: parsed.updated_at || row.created_at,
              });
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error('getPushSubscriptionsForUser error:', err);
  }

  return results;
}

/**
 * Retrieve all active push subscriptions across all users (for cron job execution).
 */
export async function getAllActivePushSubscriptions(): Promise<PushSubscriptionRecord[]> {
  const supabase = getAdminClient();
  const results: PushSubscriptionRecord[] = [];

  try {
    // 1. Try dedicated table
    const { data: dedicatedData, error: dedicatedErr } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (!dedicatedErr && dedicatedData) {
      results.push(...(dedicatedData as PushSubscriptionRecord[]));
    }

    // 2. Check fallback in trusted_devices
    const { data: fallbackData } = await supabase
      .from('trusted_devices')
      .select('*')
      .eq('is_revoked', false)
      .like('device_token_hash', 'push_%');

    if (fallbackData) {
      for (const row of fallbackData) {
        try {
          const parsed = JSON.parse(row.device_name || '{}');
          if (parsed && parsed.is_push_sub && parsed.endpoint) {
            if (!results.some((r) => r.endpoint === parsed.endpoint)) {
              results.push({
                id: row.id,
                user_id: row.user_id,
                endpoint: parsed.endpoint,
                p256dh: parsed.p256dh,
                auth: parsed.auth,
                notify_daily: parsed.notify_daily !== false,
                notify_weekly: parsed.notify_weekly !== false,
                notify_monthly: parsed.notify_monthly !== false,
                user_agent: parsed.user_agent,
                created_at: row.created_at,
                updated_at: parsed.updated_at || row.created_at,
              });
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error('getAllActivePushSubscriptions error:', err);
  }

  return results;
}

/**
 * Delete a subscription by endpoint (e.g. user toggles off or browser unsubscribed).
 */
export async function deletePushSubscription(endpoint: string): Promise<{ success: boolean }> {
  const supabase = getAdminClient();
  const endpointHash = hashEndpoint(endpoint);

  try {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  } catch {}

  try {
    await supabase.from('trusted_devices').delete().eq('device_token_hash', endpointHash);
  } catch {}

  return { success: true };
}

