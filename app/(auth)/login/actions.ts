"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  setSessionCookie,
  clearSessionCookie,
  getActiveSession,
  sha256,
  generateSecureToken,
  checkPinLockout,
  recordFailedPinAttempt,
  resetPinAttempts,
  checkPasswordLockout,
  recordFailedPasswordAttempt,
  resetPasswordAttempts,
  checkDeviceTokenLockout,
  recordFailedDeviceTokenAttempt,
  resetDeviceTokenAttempts,
  TRUSTED_DEVICE_COOKIE_NAME,
  isCurrentDeviceTrusted,
  setTrustedDeviceCookie,
  clearTrustedDeviceCookie,
  isTrustedDeviceTokenValid,
  getSessionExpirationSeconds,
} from "@/lib/auth/session";
import { cookies } from "next/headers";
import { UserRole } from "@/lib/types";

function getAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceRoleKey && url && !url.includes("your-project")) {
    return createSupabaseClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return null;
}

export async function checkDeviceTrustAction(): Promise<boolean> {
  return await isCurrentDeviceTrusted();
}

export async function trustDeviceWithTokenAction(token: string): Promise<{
  success: boolean;
  error?: string;
  remainingAttempts?: number;
  isLocked?: boolean;
}> {
  const session = await getActiveSession();
  const identifier = session?.userId || session?.email || "device_verifier";

  // Rate limit: 5 attempts max with 5-minute lockout
  const lockout = checkDeviceTokenLockout(identifier);
  if (lockout.isLocked) {
    const minutes = Math.ceil((lockout.waitSeconds || 300) / 60);
    return {
      success: false,
      isLocked: true,
      error: `Too many failed token attempts. Device verification locked for ${minutes} minute${minutes > 1 ? 's' : ''} (${lockout.waitSeconds}s).`,
    };
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return {
      success: false,
      error: "Please enter your device secret token.",
    };
  }

  if (!isTrustedDeviceTokenValid(token)) {
    const failRecord = recordFailedDeviceTokenAttempt(identifier);
    if (failRecord.isLocked) {
      return {
        success: false,
        isLocked: true,
        error: "Too many failed attempts. Device verification locked for 5 minutes.",
      };
    }
    return {
      success: false,
      remainingAttempts: failRecord.remainingAttempts,
      error: `Invalid device token. ${failRecord.remainingAttempts} attempt${failRecord.remainingAttempts === 1 ? '' : 's'} remaining before 5-minute lockout.`,
    };
  }

  // Reset rate limit upon successful verification
  resetDeviceTokenAttempts(identifier);
  const success = await setTrustedDeviceCookie(token);
  revalidatePath("/", "layout");
  return { success };
}

export async function removeDeviceTrustAction(): Promise<{ success: boolean }> {
  await clearTrustedDeviceCookie();
  revalidatePath("/", "layout");
  return { success: true };
}

export async function loginWithPassword(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  // Check brute force rate limit (5 attempts max)
  const lockout = checkPasswordLockout(email);
  if (lockout.isLocked) {
    const minutes = Math.ceil((lockout.waitSeconds || 300) / 60);
    return {
      error: `Too many failed password attempts. Account locked. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''} (${lockout.waitSeconds}s).`,
    };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    const failRecord = recordFailedPasswordAttempt(email);
    if (failRecord.isLocked) {
      return {
        error: `Too many failed password attempts. Account locked for 5 minutes.`,
      };
    }
    return {
      error: `Invalid email or password. ${failRecord.remainingAttempts} attempt${failRecord.remainingAttempts === 1 ? '' : 's'} remaining before lockout.`,
    };
  }

  // Reset password failure count on successful authentication
  resetPasswordAttempts(email);

  // Fetch or upsert canonical user profile in public.users
  let role: UserRole = 'superadmin';
  let fullName = authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0] || 'User';

  try {
    const { data: userRecord } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', authData.user.id)
      .single();

    if (userRecord) {
      role = userRecord.role === 'superadmin' ? 'superadmin' : 'user';
      fullName = userRecord.full_name || fullName;
    } else {
      // Upsert into public.users
      await supabase.from('users').insert({
        id: authData.user.id,
        email: authData.user.email,
        full_name: fullName,
        role: 'superadmin',
      });
    }
  } catch (err) {
    console.warn('Sync to users table skipped or unneeded:', err);
  }

  // Set signed HttpOnly session cookie
  const sessionDuration = getSessionExpirationSeconds();
  await setSessionCookie({
    userId: authData.user.id,
    email: authData.user.email || email,
    role,
    fullName,
    currency: 'IDR',
    expiresAt: Math.floor(Date.now() / 1000) + sessionDuration,
  });

  revalidatePath("/", "layout");
  redirect("/");
}

export async function loginWithPin(formData: FormData) {
  const rawEmail = (formData.get("email") as string)?.trim().toLowerCase() || "";
  const pin = (formData.get("pin") as string)?.trim();

  if (!pin) {
    return { error: "Please enter your 4-digit PIN." };
  }

  // Strict 4-digit format check
  if (!/^\d{4}$/.test(pin)) {
    return { error: "PIN must be exactly 4 numeric digits." };
  }

  const isTrusted = await isCurrentDeviceTrusted();
  const lockoutKey = rawEmail || (isTrusted ? "trusted_device_pin" : "anonymous_pin");
  const lockoutStatus = checkPinLockout(lockoutKey);
  if (lockoutStatus.isLocked) {
    return {
      error: `Too many failed attempts. PIN login locked for ${lockoutStatus.waitSeconds} seconds.`,
    };
  }

  const supabase = await createClient();
  const adminClient = getAdminSupabaseClient();
  const client = adminClient || supabase;

  let redirectDestination: string | null = null;

  // Helper to establish Supabase Auth SSR session so browser client passes RLS
  const syncSupabaseAuthSession = async (userEmail: string) => {
    if (adminClient && userEmail) {
      try {
        const { data: linkData } = await adminClient.auth.admin.generateLink({
          type: "magiclink",
          email: userEmail,
        });
        if (linkData?.properties?.hashed_token) {
          await supabase.auth.verifyOtp({
            token_hash: linkData.properties.hashed_token,
            type: "email",
          });
        }
      } catch (authErr) {
        console.warn("Could not sync Supabase Auth session:", authErr);
      }
    }
  };

  // Case 1: Email is explicitly provided
  if (rawEmail) {
    try {
      // Find user by exact email, or if alias like admin@pocketlog.app is submitted, resolve to superadmin
      let { data: userRec } = await client
        .from("users")
        .select("id, email, full_name, role, pin_hash, pin_failed_attempts, pin_locked_until")
        .eq("email", rawEmail)
        .maybeSingle();

      if (!userRec && (rawEmail === "admin@pocketlog.app" || (process.env.OWNER_EMAIL && rawEmail === process.env.OWNER_EMAIL))) {
        const { data: adminUser } = await client
          .from("users")
          .select("id, email, full_name, role, pin_hash, pin_failed_attempts, pin_locked_until")
          .eq("role", "superadmin")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (adminUser) {
          userRec = adminUser;
        }
      }

      if (!userRec) {
        const failRecord = recordFailedPinAttempt(lockoutKey);
        return { error: "Invalid email or PIN." };
      }

      // Check if user is locked out in database
      if (userRec.pin_locked_until && new Date(userRec.pin_locked_until).getTime() > Date.now()) {
        const remainingMs = new Date(userRec.pin_locked_until).getTime() - Date.now();
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        return {
          error: `Account temporarily locked due to too many failed PIN attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
        };
      }

      if (!userRec.pin_hash) {
        return { error: "No PIN configured for this account. Please Log in with password." };
      }

      const pinHash = await sha256(pin);
      const isMatch = userRec.pin_hash === pin || userRec.pin_hash === pinHash;

      if (isMatch) {
        // Reset DB failed attempts and lockout upon valid PIN
        await client
          .from("users")
          .update({
            pin_failed_attempts: 0,
            pin_locked_until: null,
            pin_hash: pinHash, // ensure canonical SHA-256 hash format
          })
          .eq("id", userRec.id);

        resetPinAttempts(lockoutKey);
        await syncSupabaseAuthSession(userRec.email);

        const sessionDuration = getSessionExpirationSeconds();
        await setSessionCookie({
          userId: userRec.id,
          email: userRec.email,
          role: (userRec.role as UserRole) || "user",
          fullName: userRec.full_name || "User",
          currency: "IDR",
          expiresAt: Math.floor(Date.now() / 1000) + sessionDuration,
        });

        revalidatePath("/", "layout");
        redirectDestination = "/";
      } else {
        // Incorrect PIN - increment DB failed attempts
        const failedCount = (userRec.pin_failed_attempts || 0) + 1;
        const isNowLocked = failedCount >= 5;
        const lockedUntil = isNowLocked ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null;

        await client
          .from("users")
          .update({
            pin_failed_attempts: failedCount,
            pin_locked_until: lockedUntil,
          })
          .eq("id", userRec.id);

        const attempt = recordFailedPinAttempt(lockoutKey);

        if (isNowLocked || attempt.isLocked) {
          return {
            error: "Account temporarily locked due to too many failed PIN attempts. Try again later.",
          };
        }

        const remaining = Math.max(0, 5 - failedCount);
        return {
          error: `Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`,
        };
      }
    } catch (err) {
      console.error("Error during email PIN login:", err);
      return { error: "Authentication service temporarily unavailable. Please try again." };
    }
  } else {
    // Case 2: No email provided (Trusted device PIN-only unlock)
    if (!isTrusted) {
      return { error: "Please enter your account email or authorize this trusted device." };
    }

    try {
      const { data: users, error: usersErr } = await client
        .from("users")
        .select("id, email, full_name, role, pin_hash, pin_failed_attempts, pin_locked_until")
        .not("pin_hash", "is", null);

      if (!usersErr && users && users.length > 0) {
        const pinHash = await sha256(pin);
        const now = Date.now();
        const unlockedUsers = users.filter(
          (u) => !u.pin_locked_until || new Date(u.pin_locked_until).getTime() <= now
        );

        const matched = unlockedUsers.find((u) => u.pin_hash === pin || u.pin_hash === pinHash);

        if (matched) {
          await client
            .from("users")
            .update({
              pin_failed_attempts: 0,
              pin_locked_until: null,
              pin_hash: pinHash,
            })
            .eq("id", matched.id);

          resetPinAttempts(lockoutKey);
          await syncSupabaseAuthSession(matched.email);

          const sessionDuration = getSessionExpirationSeconds();
          await setSessionCookie({
            userId: matched.id,
            email: matched.email,
            role: (matched.role as UserRole) || "user",
            fullName: matched.full_name || "User",
            currency: "IDR",
            expiresAt: Math.floor(Date.now() / 1000) + sessionDuration,
          });

          revalidatePath("/", "layout");
          redirectDestination = "/";
        } else {
          const attempt = recordFailedPinAttempt(lockoutKey);
          if (attempt.isLocked) {
            return { error: "Too many failed attempts. PIN login locked for 5 minutes." };
          }
          return { error: `Incorrect PIN. ${attempt.remainingAttempts} attempt(s) remaining.` };
        }
      }
    } catch (err) {
      console.error("Error during trusted device PIN-only verification:", err);
    }
  }

  // If successfully authenticated, trigger redirect cleanly outside try-catch
  if (redirectDestination) {
    redirect(redirectDestination);
  }

  const attempt = recordFailedPinAttempt(lockoutKey);
  if (attempt.isLocked) {
    return { error: "Too many failed attempts. PIN login locked for 5 minutes." };
  }
  return { error: `Incorrect PIN. ${attempt.remainingAttempts} attempt(s) remaining.` };
}

export async function exchangeAccessKey(secretKey: string) {
  if (!secretKey) {
    return { success: false, error: "Access key is required." };
  }

  const keyHash = await sha256(secretKey.trim());

  // Check against environment variable fallback (e.g. OWNER_SECRET_KEY)
  const envOwnerKey = process.env.OWNER_SECRET_KEY;
  if (envOwnerKey && (secretKey === envOwnerKey || keyHash === (await sha256(envOwnerKey)))) {
    const supabase = await createClient();
    let superadminUser: { id: string; email: string; full_name: string | null; role: string } | null = null;
    try {
      const { data } = await supabase
        .from('users')
        .select('id, email, full_name, role')
        .eq('role', 'superadmin')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) superadminUser = data;
    } catch {
      // ignore
    }

    if (!superadminUser) {
      try {
        const { data } = await supabase
          .from('users')
          .select('id, email, full_name, role')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (data) superadminUser = data;
      } catch {
        // ignore
      }
    }

    const sessionDuration = getSessionExpirationSeconds();
    await setSessionCookie({
      userId: superadminUser?.id || process.env.OWNER_USER_ID || '00000000-0000-0000-0000-000000000001',
      email: superadminUser?.email || process.env.OWNER_EMAIL || 'admin@pocketlog.app',
      role: 'superadmin',
      fullName: superadminUser?.full_name || process.env.OWNER_NAME || 'Administrator',
      currency: 'IDR',
      expiresAt: Math.floor(Date.now() / 1000) + sessionDuration,
    });
    return { success: true };
  }

  return { success: false, error: "Invalid or expired secret key." };
}

export async function startDemoSession() {
  const cookieStore = await cookies();
  cookieStore.set('pocketlog_demo_mode', 'true', {
    httpOnly: false,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateUserPinAction(pin: string | null) {
  const cleanPin = pin ? pin.trim() : null;
  if (cleanPin && !/^\d{4}$/.test(cleanPin)) {
    return { success: false, error: "PIN must be exactly 4 numeric digits." };
  }

  const session = await getActiveSession();
  let userId = session?.userId;

  const supabase = await createClient();
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id;
  }

  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  const pinHash = cleanPin ? await sha256(cleanPin) : null;

  try {
    const { error: rpcErr } = await supabase.rpc('set_user_pin', {
      p_user_id: userId,
      p_pin: cleanPin,
    });
    if (!rpcErr) {
      return { success: true };
    }
  } catch { }

  try {
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
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update PIN" };
  }
}

export async function logout() {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut();
  } catch { }

  await clearSessionCookie();

  const cookieStore = await cookies();
  cookieStore.delete('pocketlog_demo_mode');

  revalidatePath("/", "layout");
  redirect("/login");
}

