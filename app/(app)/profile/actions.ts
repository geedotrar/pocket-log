'use server';

import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  getActiveSession,
  setSessionCookie,
  sha256,
  isTrustedDeviceTokenValid,
  setTrustedDeviceCookie,
  clearTrustedDeviceCookie,
  isCurrentDeviceTrusted,
} from '@/lib/auth/session';
import { User } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

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

export interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  role: 'superadmin' | 'user';
  has_pin: boolean;
  created_at: string;
  is_trusted_device: boolean;
}

export interface UpdateProfilePayload {
  fullName: string;
  newPassword?: string;
  confirmPassword?: string;
  pin?: string;
}

/**
 * Fetch profile data for the currently authenticated user
 */
export async function getProfileData(): Promise<{
  success: boolean;
  profile?: ProfileData;
  error?: string;
}> {
  try {
    const isTrusted = await isCurrentDeviceTrusted();
    const session = await getActiveSession();
    const supabase = await createServerSupabase();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const targetUserId = authUser?.id || session?.userId;
    const targetEmail = authUser?.email || session?.email;

    if (!targetUserId && !targetEmail) {
      const cookieStore = await cookies();
      const demoProfileCookie = cookieStore.get('pocketlog_demo_profile')?.value;
      let demoProfile: ProfileData = {
        id: 'demo-user-0000-0000-0000-000000000000',
        email: 'demo@pocketlog.app',
        full_name: 'Guest Explorer',
        role: 'superadmin',
        has_pin: true,
        created_at: '2026-10-01T08:00:00.000Z',
        is_trusted_device: isTrusted,
      };

      if (demoProfileCookie) {
        try {
          const parsed = JSON.parse(demoProfileCookie);
          demoProfile = { ...demoProfile, ...parsed };
        } catch { }
      }

      return {
        success: true,
        profile: demoProfile,
      };
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('id, email, full_name, role, pin_hash, created_at')
      .or(`id.eq.${targetUserId},email.eq.${targetEmail}`)
      .maybeSingle();

    if (dbUser) {
      return {
        success: true,
        profile: {
          id: dbUser.id,
          email: dbUser.email || targetEmail || '',
          full_name: dbUser.full_name || '',
          role: dbUser.role || 'user',
          has_pin: Boolean(dbUser.pin_hash),
          created_at: dbUser.created_at || new Date().toISOString(),
          is_trusted_device: isTrusted,
        },
      };
    }

    return {
      success: true,
      profile: {
        id: targetUserId || 'user',
        email: targetEmail || '',
        full_name: (authUser?.user_metadata?.full_name as string) || session?.fullName || 'User',
        role: session?.role || 'user',
        has_pin: false,
        created_at: new Date().toISOString(),
        is_trusted_device: isTrusted,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch user profile';
    return { success: false, error: msg };
  }
}

/**
 * Unified single-submit action to update user profile, password, and security PIN
 */
export async function updateProfileCombinedAction(
  payload: UpdateProfilePayload
): Promise<{
  success: boolean;
  updatedFields?: string[];
  hasPin?: boolean;
  error?: string;
}> {
  try {
    const trimmed = payload.fullName.trim();
    if (!trimmed) {
      return { success: false, error: 'Name cannot be empty.' };
    }

    if (payload.newPassword || payload.confirmPassword) {
      if (!payload.newPassword || payload.newPassword.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long.' };
      }
      if (payload.newPassword !== payload.confirmPassword) {
        return { success: false, error: 'Passwords do not match.' };
      }
    }

    if (payload.pin && !/^\d{4}$/.test(payload.pin)) {
      return { success: false, error: 'Security PIN must be exactly 4 numeric digits.' };
    }

    const session = await getActiveSession();
    const supabase = await createServerSupabase();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const targetUserId = authUser?.id || session?.userId;
    const targetEmail = authUser?.email || session?.email;

    if (!targetUserId && !targetEmail) {
      const cookieStore = await cookies();
      const updatedFields: string[] = ['Name'];
      let hasPin = true;

      const demoProfileCookie = cookieStore.get('pocketlog_demo_profile')?.value;
      let currentDemoProfile: any = {
        full_name: trimmed,
        has_pin: true,
      };
      if (demoProfileCookie) {
        try {
          currentDemoProfile = { ...currentDemoProfile, ...JSON.parse(demoProfileCookie) };
        } catch { }
      }
      currentDemoProfile.full_name = trimmed;

      if (payload.newPassword) {
        updatedFields.push('Password');
      }

      if (payload.pin) {
        updatedFields.push('PIN');
        currentDemoProfile.has_pin = true;
        hasPin = true;
      }

      cookieStore.set('pocketlog_demo_profile', JSON.stringify(currentDemoProfile), {
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      // Synchronize with pocketlog_demo_users
      try {
        const rawUsers = cookieStore.get('pocketlog_demo_users')?.value;
        if (rawUsers) {
          const parsedUsers = JSON.parse(rawUsers);
          if (Array.isArray(parsedUsers)) {
            const updatedUsers = parsedUsers.map((u: any) => {
              if (u.id === 'demo-user-0000-0000-0000-000000000000') {
                return {
                  ...u,
                  full_name: trimmed,
                  has_pin: payload.pin ? true : u.has_pin,
                };
              }
              return u;
            });
            cookieStore.set('pocketlog_demo_users', JSON.stringify(updatedUsers), {
              path: '/',
              maxAge: 7 * 24 * 60 * 60,
            });
          }
        }
      } catch { }

      revalidatePath('/profile');
      revalidatePath('/');
      revalidatePath('/', 'layout');

      return {
        success: true,
        updatedFields,
        hasPin,
      };
    }

    const admin = getAdminSupabaseClient();
    const client = admin || supabase;
    const updatedFields: string[] = [];

    // 1. Update Full Name in DB
    if (targetUserId) {
      await client.from('users').update({ full_name: trimmed }).eq('id', targetUserId);
    } else if (targetEmail) {
      await client.from('users').update({ full_name: trimmed }).eq('email', targetEmail);
    }
    updatedFields.push('Name');

    if (authUser) {
      try {
        await supabase.auth.updateUser({
          data: { full_name: trimmed },
        });
      } catch { }
    }

    // 2. Synchronize Session Cookie immediately so all pages reflect the new name
    if (session) {
      await setSessionCookie({
        ...session,
        fullName: trimmed,
      });
    }

    // 3. Update Password if provided
    if (payload.newPassword) {
      let passwordUpdated = false;
      if (authUser) {
        const { error: authError } = await supabase.auth.updateUser({
          password: payload.newPassword,
        });
        if (!authError) passwordUpdated = true;
      }
      if (!passwordUpdated && admin && targetUserId) {
        const { error: adminError } = await admin.auth.admin.updateUserById(targetUserId, {
          password: payload.newPassword,
        });
        if (!adminError) passwordUpdated = true;
      }
      const passwordHash = await sha256(payload.newPassword);
      if (targetUserId) {
        await client.from('users').update({ password_hash: passwordHash }).eq('id', targetUserId);
      }
      updatedFields.push('Password');
    }

    // 4. Update PIN if provided
    let hasPin: boolean | undefined = undefined;
    if (payload.pin) {
      const pinHash = await sha256(payload.pin);
      if (targetUserId) {
        await client.from('users').update({ pin_hash: pinHash }).eq('id', targetUserId);
      } else if (targetEmail) {
        await client.from('users').update({ pin_hash: pinHash }).eq('email', targetEmail);
      }
      hasPin = true;
      updatedFields.push('PIN');
    }

    revalidatePath('/profile');
    revalidatePath('/');
    revalidatePath('/', 'layout');

    return {
      success: true,
      updatedFields,
      hasPin,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update profile';
    return { success: false, error: msg };
  }
}

/**
 * Updates full name for current user
 */
export async function updateProfileNameAction(
  fullName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const trimmed = fullName.trim();
    if (!trimmed) {
      return { success: false, error: 'Name cannot be empty.' };
    }

    const session = await getActiveSession();
    const supabase = await createServerSupabase();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const targetUserId = authUser?.id || session?.userId;
    const targetEmail = authUser?.email || session?.email;

    if (!targetUserId && !targetEmail) {
      const cookieStore = await cookies();
      const demoProfileCookie = cookieStore.get('pocketlog_demo_profile')?.value;
      let currentDemoProfile: any = { full_name: trimmed };
      if (demoProfileCookie) {
        try {
          currentDemoProfile = { ...currentDemoProfile, ...JSON.parse(demoProfileCookie) };
        } catch { }
      }
      currentDemoProfile.full_name = trimmed;
      cookieStore.set('pocketlog_demo_profile', JSON.stringify(currentDemoProfile), {
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      // Synchronize with pocketlog_demo_users
      try {
        const rawUsers = cookieStore.get('pocketlog_demo_users')?.value;
        if (rawUsers) {
          const parsedUsers = JSON.parse(rawUsers);
          if (Array.isArray(parsedUsers)) {
            const updatedUsers = parsedUsers.map((u: any) => {
              if (u.id === 'demo-user-0000-0000-0000-000000000000') {
                return { ...u, full_name: trimmed };
              }
              return u;
            });
            cookieStore.set('pocketlog_demo_users', JSON.stringify(updatedUsers), {
              path: '/',
              maxAge: 7 * 24 * 60 * 60,
            });
          }
        }
      } catch { }

      revalidatePath('/profile');
      revalidatePath('/');
      revalidatePath('/', 'layout');
      return { success: true };
    }

    // Update public.users
    const admin = getAdminSupabaseClient();
    const client = admin || supabase;

    if (targetUserId) {
      await client.from('users').update({ full_name: trimmed }).eq('id', targetUserId);
    } else if (targetEmail) {
      await client.from('users').update({ full_name: trimmed }).eq('email', targetEmail);
    }

    // Update Supabase Auth user metadata if logged in with Supabase Auth
    if (authUser) {
      try {
        await supabase.auth.updateUser({
          data: { full_name: trimmed },
        });
      } catch {
        // Non-critical if metadata sync is omitted
      }
    }

    // Synchronize session cookie
    if (session) {
      await setSessionCookie({
        ...session,
        fullName: trimmed,
      });
    }

    revalidatePath('/profile');
    revalidatePath('/');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update profile name',
    };
  }
}

/**
 * Updates password for the current user
 */
export async function changePasswordAction(
  newPassword: string,
  confirmPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }
    if (newPassword !== confirmPassword) {
      return { success: false, error: 'Passwords do not match.' };
    }

    const session = await getActiveSession();
    const supabase = await createServerSupabase();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const targetUserId = authUser?.id || session?.userId;
    const adminClient = getAdminSupabaseClient();

    let passwordUpdated = false;

    // 1. If active Supabase Auth user
    if (authUser) {
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (!authError) {
        passwordUpdated = true;
      }
    }

    // 2. Admin client fallback if needed
    if (!passwordUpdated && adminClient && targetUserId) {
      const { error: adminError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        password: newPassword,
      });
      if (!adminError) {
        passwordUpdated = true;
      }
    }

    // 3. Update public.users password hash for local/custom auth fallback
    const passwordHash = await sha256(newPassword);
    const client = adminClient || supabase;
    if (targetUserId) {
      await client.from('users').update({ password_hash: passwordHash }).eq('id', targetUserId);
    }

    revalidatePath('/profile');
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to change password',
    };
  }
}

/**
 * Changes or clears the user's 4-digit PIN
 */
export async function changePinAction(
  newPin: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getActiveSession();
    const supabase = await createServerSupabase();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const targetUserId = authUser?.id || session?.userId;
    const targetEmail = authUser?.email || session?.email;

    if (!targetUserId && !targetEmail) {
      const cookieStore = await cookies();
      const demoProfileCookie = cookieStore.get('pocketlog_demo_profile')?.value;
      let currentDemoProfile: any = {};
      if (demoProfileCookie) {
        try {
          currentDemoProfile = JSON.parse(demoProfileCookie);
        } catch { }
      }
      currentDemoProfile.has_pin = Boolean(newPin && newPin.trim());
      cookieStore.set('pocketlog_demo_profile', JSON.stringify(currentDemoProfile), {
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      // Synchronize with pocketlog_demo_users
      try {
        const rawUsers = cookieStore.get('pocketlog_demo_users')?.value;
        if (rawUsers) {
          const parsedUsers = JSON.parse(rawUsers);
          if (Array.isArray(parsedUsers)) {
            const updatedUsers = parsedUsers.map((u: any) => {
              if (u.id === 'demo-user-0000-0000-0000-000000000000') {
                return {
                  ...u,
                  has_pin: Boolean(newPin && newPin.trim()),
                };
              }
              return u;
            });
            cookieStore.set('pocketlog_demo_users', JSON.stringify(updatedUsers), {
              path: '/',
              maxAge: 7 * 24 * 60 * 60,
            });
          }
        }
      } catch { }

      revalidatePath('/profile');
      return { success: true };
    }

    let pinHash: string | null = null;
    if (newPin && newPin.trim()) {
      const trimmedPin = newPin.trim();
      if (!/^\d{4}$/.test(trimmedPin)) {
        return { success: false, error: 'PIN must be exactly 4 digits (0-9).' };
      }
      pinHash = await sha256(trimmedPin);
    }

    const adminClient = getAdminSupabaseClient();
    const client = adminClient || supabase;

    if (targetUserId) {
      await client.from('users').update({ pin_hash: pinHash }).eq('id', targetUserId);
    } else if (targetEmail) {
      await client.from('users').update({ pin_hash: pinHash }).eq('email', targetEmail);
    }

    revalidatePath('/profile');
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update PIN',
    };
  }
}

/**
 * Registers this device as trusted using secret token
 */
export async function trustDeviceAction(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!token || !token.trim()) {
      return { success: false, error: 'Please provide a device secret token.' };
    }

    const isValid = isTrustedDeviceTokenValid(token);
    if (!isValid) {
      return {
        success: false,
        error: 'Invalid device secret token. Please check your TRUSTED_DEVICE_TOKEN configuration in .env.',
      };
    }

    await setTrustedDeviceCookie(token);
    revalidatePath('/profile');
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to set trusted device',
    };
  }
}

/**
 * Revokes trusted status from current device
 */
export async function revokeDeviceTrustAction(): Promise<{ success: boolean; error?: string }> {
  try {
    await clearTrustedDeviceCookie();
    revalidatePath('/profile');
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to revoke device trust',
    };
  }
}
