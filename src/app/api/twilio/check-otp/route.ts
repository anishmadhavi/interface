import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Get auth token from cookies
    const cookieHeader = request.headers.get('cookie') || '';
    let accessToken: string | undefined;

    const cookies = Object.fromEntries(
      cookieHeader.split('; ').filter(Boolean).map(c => {
        const [key, ...val] = c.split('=');
        return [key, val.join('=')];
      })
    );

    const authCookieName = Object.keys(cookies).find(name => 
      name.includes('auth-token') || name.includes('supabase')
    );

    if (authCookieName) {
      try {
        const cookieValue = decodeURIComponent(cookies[authCookieName]);
        const parsed = JSON.parse(cookieValue);
        accessToken = parsed.access_token || parsed[0]?.access_token;
      } catch {
        // Cookie parsing failed
      }
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user is authenticated
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client to check webhook logs
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    // Check for recent OTP in webhook logs
    const { data: log } = await adminClient
      .from('webhook_logs')
      .select('payload, created_at')
      .eq('organization_id', organizationId)
      .eq('source', 'TWILIO')
      .eq('event_type', 'SMS_RECEIVED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (log?.payload?.extractedOtp) {
      // Check if OTP is less than 10 minutes old
      const createdAt = new Date(log.created_at).getTime();
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

      if (createdAt > tenMinutesAgo) {
        return NextResponse.json({ otp: log.payload.extractedOtp });
      }
    }

    return NextResponse.json({ otp: null });

  } catch (error) {
    console.error('Error checking OTP:', error);
    return NextResponse.json(
      { error: 'Failed to check OTP' },
      { status: 500 }
    );
  }
}
