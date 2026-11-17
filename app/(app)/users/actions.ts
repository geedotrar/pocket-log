'use server';

import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getActiveSession, sha256 } from '@/lib/auth/session';
import { User, UserRole } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

const DEFAULT_DEMO_USERS: User[] = [
  {
    id: 'demo-user-0000-0000-0000-000000000000',
    email: 'demo@pocketlog.app',
    full_name: 'Guest Explorer',
    role: 'superadmin',
    has_pin: true,
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'demo-user-0000-0000-0000-000000000001',
    email: 'admin@pocketlog.app',
    full_name: 'System Admin',
    role: 'superadmin',
    has_pin: true,
    created_at: '2026-09-15T10:30:00.000Z',
    updated_at: '2026-09-15T10:30:00.000Z',
  },
  {
    id: 'demo-user-0000-0000-0000-000000000002',
    email: 'sarah.jenkins@example.com',
    full_name: 'Sarah Jenkins',
    role: 'user',
    has_pin: true,
    created_at: '2026-10-12T14:20:00.000Z',
    updated_at: '2026-10-12T14:20:00.000Z',
  },
  {
    id: 'demo-user-0000-0000-0000-000000000003',
    email: 'alex.rivera@example.com',
    full_name: 'Alex Rivera',
    role: 'user',
    has_pin: false,
    created_at: '2026-10-20T09:15:00.000Z',
    updated_at: '2026-10-20T09:15:00.000Z',
  },
];

async function isDemoSessionActive(): Promise<boolean> {
  const cookieStore = await cookies();
  if (cookieStore.get('pocketlog_demo_mode')?.value === 'true') {
    return true;
  }
  const session = await getActiveSession();
  if (session) return false;

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return !user;
}

async function getDemoUsers(): Promise<User[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('pocketlog_demo_users')?.value;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  return DEFAULT_DEMO_USERS;
}

async function setDemoUsers(users: User[]): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('pocketlog_demo_users', JSON.stringify(users), {
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

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

async function assertSuperadmin(): Promise<{ userId: string; isSuperAdmin: boolean }> {
  if (await isDemoSessionActive()) {
    return { userId: 'demo-user-0000-0000-0000-000000000000', isSuperAdmin: true };
  }

  const session = await getActiveSession();
  if (session && session.role === 'superadmin') {
    return { userId: session.userId, isSuperAdmin: true };
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: userRec } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userRec?.role === 'superadmin') {
      return { userId: user.id, isSuperAdmin: true };
    }
  }

  throw new Error('Access Denied: Superadmin privileges required.');
}

/**
 * Fetch list of all registered users
 */
export async function getUsersList(): Promise<{ success: boolean; users?: User[]; error?: string }> {
  try {
    await assertSuperadmin();

    if (await isDemoSessionActive()) {
      const users = await getDemoUsers();
      return { success: true, users };
    }

    const adminClient = getAdminSupabaseClient();
    const supabase = adminClient || (await createServerSupabase());

    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, pin_hash, pin_failed_attempts, pin_locked_until, created_at, updated_at')
      .order('created_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const formattedUsers: User[] = (data || []).map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: (u.role as UserRole) || 'user',
      has_pin: Boolean(u.pin_hash),
      pin_failed_attempts: u.pin_failed_attempts || 0,
      pin_locked_until: u.pin_locked_until,
      created_at: u.created_at,
      updated_at: u.updated_at,
    }));

    return { success: true, users: formattedUsers };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to retrieve users' };
  }
}

/**
 * Create a new user (including password and optional PIN)
 */
export async function createUserAction(payload: {
  email: string;
  fullName: string;
  role: UserRole;
  password?: string;
  pin?: string;
}): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    await assertSuperadmin();
    const email = payload.email.trim().toLowerCase();
    const fullName = payload.fullName.trim();
    const role = payload.role === 'superadmin' ? 'superadmin' : 'user';
    const pin = payload.pin?.trim();

    if (!email) {
      return { success: false, error: 'Email is required' };
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      return { success: false, error: 'PIN must be exactly 4 digits' };
    }

    if (await isDemoSessionActive()) {
      const users = await getDemoUsers();
      if (users.some((u) => u.email.toLowerCase() === email)) {
        return { success: false, error: 'A user with this email already exists.' };
      }
      const newUser: User = {
        id: `demo-user-${crypto.randomUUID()}`,
        email,
        full_name: fullName,
        role,
        has_pin: Boolean(pin),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await setDemoUsers([newUser, ...users]);
      revalidatePath('/users');
      return { success: true, user: newUser };
    }

    const pinHash = pin ? await sha256(pin) : null;
    const adminClient = getAdminSupabaseClient();
    const supabase = adminClient || (await createServerSupabase());

    let newUserId: string;

    if (adminClient && payload.password) {
      // 1. Create in Supabase Auth via admin api
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password: payload.password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (authError || !authUser.user) {
        return { success: false, error: authError?.message || 'Failed to create auth user' };
      }

      newUserId = authUser.user.id;
    } else {
      newUserId = crypto.randomUUID();
    }

    // 2. Insert into public.users
    const { data: userRec, error: dbError } = await supabase
      .from('users')
      .upsert({
        id: newUserId,
        email,
        full_name: fullName,
        role,
        pin_hash: pinHash,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      return { success: false, error: dbError.message };
    }

    revalidatePath('/users');
    revalidatePath('/profile');
    return {
      success: true,
      user: {
        id: userRec.id,
        email: userRec.email,
        full_name: userRec.full_name,
        role: userRec.role,
        has_pin: Boolean(userRec.pin_hash),
        created_at: userRec.created_at,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create user' };
  }
}

/**
 * Update user details (Name, Email, Role)
 */
export async function updateUserAction(payload: {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertSuperadmin();

    if (await isDemoSessionActive()) {
      const users = await getDemoUsers();
      const idx = users.findIndex((u) => u.id === payload.userId);
      if (idx === -1) {
        return { success: false, error: 'User not found in demo directory.' };
      }
      users[idx] = {
        ...users[idx],
        full_name: payload.fullName.trim(),
        email: payload.email.trim().toLowerCase(),
        role: payload.role,
        updated_at: new Date().toISOString(),
      };
      await setDemoUsers([...users]);
      revalidatePath('/users');
      return { success: true };
    }

    const adminClient = getAdminSupabaseClient();
    const supabase = adminClient || (await createServerSupabase());

    const { error: dbError } = await supabase
      .from('users')
      .update({
        full_name: payload.fullName.trim(),
        email: payload.email.trim().toLowerCase(),
        role: payload.role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.userId);

    if (dbError) {
      return { success: false, error: dbError.message };
    }

    // Also sync to Supabase Auth if admin client available
    if (adminClient) {
      try {
        await adminClient.auth.admin.updateUserById(payload.userId, {
          email: payload.email.trim().toLowerCase(),
          user_metadata: { full_name: payload.fullName.trim() },
        });
      } catch (authErr) {
        console.warn('Auth admin sync skipped:', authErr);
      }
    }

    revalidatePath('/users');
    revalidatePath('/profile');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update user' };
  }
}

/**
 * Set or reset user password directly (Superadmin)
 */
export async function setUserPasswordAction(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertSuperadmin();

    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    if (await isDemoSessionActive()) {
      return { success: true };
    }

    const adminClient = getAdminSupabaseClient();
    if (!adminClient) {
      return {
        success: false,
        error:
          'SUPABASE_SERVICE_ROLE_KEY is required in .env to update user passwords directly from the server.',
      };
    }

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update password' };
  }
}

/**
 * Set or clear user PIN (Superadmin)
 */
export async function setUserPinAction(
  userId: string,
  newPin: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertSuperadmin();
    const cleanPin = newPin?.trim();

    if (cleanPin && !/^\d{4}$/.test(cleanPin)) {
      return { success: false, error: 'PIN must be exactly 4 digits' };
    }

    if (await isDemoSessionActive()) {
      const users = await getDemoUsers();
      const idx = users.findIndex((u) => u.id === userId);
      if (idx !== -1) {
        users[idx] = {
          ...users[idx],
          has_pin: Boolean(cleanPin),
          updated_at: new Date().toISOString(),
        };
        await setDemoUsers([...users]);
      }
      revalidatePath('/users');
      return { success: true };
    }

    const pinHash = cleanPin ? await sha256(cleanPin) : null;
    const adminClient = getAdminSupabaseClient();
    const supabase = adminClient || (await createServerSupabase());

    const { error } = await supabase
      .from('users')
      .update({
        pin_hash: pinHash,
        pin_failed_attempts: 0,
        pin_locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/users');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update user PIN' };
  }
}

/**
 * Delete a user
 */
export async function deleteUserAction(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId: currentUserId } = await assertSuperadmin();

    if (userId === currentUserId || userId === 'demo-user-0000-0000-0000-000000000000') {
      return { success: false, error: 'You cannot delete your own active administrator account.' };
    }

    if (await isDemoSessionActive()) {
      const users = await getDemoUsers();
      const updated = users.filter((u) => u.id !== userId);
      await setDemoUsers(updated);
      revalidatePath('/users');
      return { success: true };
    }

    const adminClient = getAdminSupabaseClient();
    const supabase = adminClient || (await createServerSupabase());

    // 1. Delete from public.users (cascades to all user records)
    const { error: dbError } = await supabase.from('users').delete().eq('id', userId);
    if (dbError) {
      return { success: false, error: dbError.message };
    }

    // 2. Delete from Supabase Auth if admin client available
    if (adminClient) {
      try {
        await adminClient.auth.admin.deleteUser(userId);
      } catch (authErr) {
        console.warn('Auth user delete skipped:', authErr);
      }
    }

    revalidatePath('/users');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete user' };
  }
}
