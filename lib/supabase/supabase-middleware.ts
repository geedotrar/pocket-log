import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  TRUSTED_DEVICE_COOKIE_NAME,
  verifySessionToken,
  createSessionToken,
  sha256,
  isTrustedDeviceTokenValid,
  createTrustedDeviceCookieValue,
  getSessionExpirationSeconds,
} from "@/lib/auth/session";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

export async function updateSession(request: NextRequest) {
  const url = request.nextUrl.clone();

  // 1. Check for trusted device authorization via query param: ?device=DEVICE_TOKEN
  const deviceParam = url.searchParams.get("device");
  if (deviceParam) {
    url.searchParams.delete("device");

    if (isTrustedDeviceTokenValid(deviceParam)) {
      const deviceCookieValue = await createTrustedDeviceCookieValue(deviceParam);
      url.pathname = "/login";
      const response = NextResponse.redirect(url, { status: 302 });

      response.cookies.set(TRUSTED_DEVICE_COOKIE_NAME, deviceCookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 365 * 24 * 60 * 60, // 1 year
      });

      return response;
    }

    url.pathname = "/login";
    return NextResponse.redirect(url, { status: 302 });
  }

  // 2. Check for initial secret token credential exchange: ?key=SECRET_TOKEN
  const secretKeyParam = url.searchParams.get("key");
  if (secretKeyParam) {
    url.searchParams.delete("key");

    const envOwnerKey = process.env.OWNER_SECRET_KEY;
    const keyHash = await sha256(secretKeyParam.trim());
    const isOwnerKeyValid = envOwnerKey && (
      secretKeyParam === envOwnerKey ||
      keyHash === (await sha256(envOwnerKey))
    );

    if (isOwnerKeyValid) {
      let superadminUser: { id: string; email: string; full_name: string | null } | null = null;

      // Query database for canonical superadmin account
      if (supabaseUrl && supabaseKey && !supabaseUrl.includes("your-project")) {
        try {
          const res = await fetch(
            `${supabaseUrl}/rest/v1/users?role=eq.superadmin&select=id,email,full_name&order=created_at.asc&limit=1`,
            {
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
              },
              cache: "no-store",
            }
          );
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              superadminUser = data[0];
            }
          }
        } catch {
          // Supabase unreachable or offline
        }
      }

      const sessionDuration = getSessionExpirationSeconds();
      const sessionToken = await createSessionToken({
        userId: superadminUser?.id || process.env.OWNER_USER_ID || '00000000-0000-0000-0000-000000000001',
        email: superadminUser?.email || process.env.OWNER_EMAIL || 'admin@pocketlog.app',
        role: 'superadmin',
        fullName: superadminUser?.full_name || process.env.OWNER_NAME || 'Administrator',
        currency: 'IDR',
        expiresAt: Math.floor(Date.now() / 1000) + sessionDuration,
      });

      const response = NextResponse.redirect(url, { status: 302 });
      response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: sessionDuration,
      });
      return response;
    }

    // Invalid key: redirect to clean URL without the parameter
    return NextResponse.redirect(url, { status: 302 });
  }

  // 2. Establish Supabase SSR Client
  let supabaseResponse = NextResponse.next({ request });

  let supabaseUser = null;
  if (supabaseUrl && supabaseKey && !supabaseUrl.includes("your-project")) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      supabaseUser = user;
    } catch {
      // Supabase network unreachable or offline
    }
  }

  // 3. Check custom signed HttpOnly session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const verifiedSession = sessionCookie ? await verifySessionToken(sessionCookie) : null;

  const isAuthenticated = Boolean(supabaseUser || verifiedSession);

  // Never redirect Server Action or POST requests in middleware
  // Next.js handles Server Action responses and action redirects natively
  const isActionRequest = request.method === "POST" || request.headers.has("next-action");

  // 4. Authenticated User Flow: Redirect away from /login to dashboard on GET navigations
  if (!isActionRequest && isAuthenticated && request.nextUrl.pathname === "/login") {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // 5. Unauthenticated User Flow: Always start at /login unless public asset or active demo session
  const pathname = request.nextUrl.pathname;
  const isPublicPath =
    pathname === "/login" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/manifest") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.png" ||
    pathname === "/icon.png" ||
    pathname === "/apple-touch-icon.png";

  const isDemoSession = request.cookies.get("pocketlog_demo_mode")?.value === "true";

  if (!isActionRequest && !isAuthenticated && !isDemoSession && !isPublicPath) {
    url.pathname = "/login";
    return NextResponse.redirect(url, { status: 302 });
  }

  // Set request headers so Server Components and Layout can recognize auth state
  supabaseResponse.headers.set(
    "x-auth-state",
    isAuthenticated ? "authenticated" : isDemoSession ? "demo" : "unauthenticated"
  );

  if (verifiedSession) {
    supabaseResponse.headers.set("x-user-id", verifiedSession.userId);
    supabaseResponse.headers.set("x-user-role", verifiedSession.role);
  } else if (supabaseUser) {
    supabaseResponse.headers.set("x-user-id", supabaseUser.id);
    supabaseResponse.headers.set("x-user-role", "superadmin");
  } else {
    supabaseResponse.headers.set("x-user-role", "demo");
  }

  const deviceCookie = request.cookies.get(TRUSTED_DEVICE_COOKIE_NAME)?.value;
  supabaseResponse.headers.set("x-trusted-device", deviceCookie ? "true" : "false");

  return supabaseResponse;
}
