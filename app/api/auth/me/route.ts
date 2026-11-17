import { NextResponse } from 'next/server';
import { getActiveSession, setSessionCookie, isCurrentDeviceTrusted } from '@/lib/auth/session';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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
    const isTrusted = await isCurrentDeviceTrusted();
    const session = await getActiveSession();
    const serverSupabase = await createServerSupabase();

    let sessionTokens: { access_token: string; refresh_token: string } | null = null;

    // 1. Check signed HttpOnly session cookie
    if (session && session.email) {
      const adminClient = getAdminSupabaseClient();
      let liveFullName = session.fullName || session.email?.split('@')[0] || 'User';
      let liveRole = session.role;

      if (adminClient) {
        try {
          const { data: dbUser } = await adminClient
            .from('users')
            .select('full_name, role')
            .or(`id.eq.${session.userId},email.eq.${session.email}`)
            .maybeSingle();

          if (dbUser?.full_name) {
            liveFullName = dbUser.full_name;
          }
          if (dbUser?.role) {
            liveRole = dbUser.role as any;
          }

          // If session cookie has a stale name or role, synchronize it immediately!
          if (session.fullName !== liveFullName || session.role !== liveRole) {
            await setSessionCookie({
              ...session,
              fullName: liveFullName,
              role: liveRole,
            });
          }
        } catch (dbErr) {
          console.warn('Could not query users table in api/auth/me:', dbErr);
        }

        try {
          const { data: linkData } = await adminClient.auth.admin.generateLink({
            type: 'magiclink',
            email: session.email,
          });

          if (linkData?.properties?.hashed_token) {
            const { data: verifyData } = await serverSupabase.auth.verifyOtp({
              token_hash: linkData.properties.hashed_token,
              type: 'email',
            });

            if (verifyData?.session) {
              sessionTokens = {
                access_token: verifyData.session.access_token,
                refresh_token: verifyData.session.refresh_token,
              };
            }
          }
        } catch (syncErr) {
          console.warn('Could not sync Supabase Auth session in api/auth/me:', syncErr);
        }
      }

      return NextResponse.json({
        isAuthenticated: true,
        isDemoMode: false,
        isTrustedDevice: isTrusted,
        sessionTokens,
        user: {
          id: session.userId,
          email: session.email,
          role: liveRole,
          full_name: liveFullName,
          currency: session.currency || 'IDR',
          is_trusted_device: isTrusted,
        },
      });
    }

    // 2. Check Supabase auth session
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (user) {
      let role = 'superadmin';
      let dbFullName = '';
      try {
        const { data: userRec } = await serverSupabase
          .from('users')
          .select('role, full_name')
          .eq('id', user.id)
          .single();
        if (userRec?.role) role = userRec.role;
        if (userRec?.full_name) dbFullName = userRec.full_name;
      } catch {}

      return NextResponse.json({
        isAuthenticated: true,
        isDemoMode: false,
        isTrustedDevice: isTrusted,
        sessionTokens: null,
        user: {
          id: user.id,
          email: user.email,
          role,
          full_name: dbFullName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          currency: 'IDR',
          is_trusted_device: isTrusted,
        },
      });
    }

    // 3. Fallback to Demo Mode
    return NextResponse.json({
      isAuthenticated: false,
      isDemoMode: true,
      isTrustedDevice: isTrusted,
      sessionTokens: null,
      user: {
        id: 'demo-user-0000-0000-0000-000000000000',
        email: 'demo@pocketlog.app',
        role: 'superadmin',
        full_name: 'Guest Explorer',
        currency: 'IDR',
        is_trusted_device: isTrusted,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        isAuthenticated: false,
        isDemoMode: true,
        user: null,
        error: 'Failed to verify session',
      },
      { status: 500 }
    );
  }
}
