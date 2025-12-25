import { NextResponse } from 'next/server';
import { adminClient, verifyToken, extractTokenFromCookies } from '@/lib/supabase/admin';

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

    // Verify user is authenticated
    const cookieHeader = request.headers.get('cookie') || '';
    const accessToken = extractTokenFromCookies(cookieHeader);

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user, error: authError } = await verifyToken(accessToken);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for recent OTP in otp_logs table
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // First get the organization's virtual number
    const orgResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/organizations?id=eq.${organizationId}&select=virtual_number`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    const orgData = await orgResponse.json();
    const virtualNumber = orgData?.[0]?.virtual_number;

    if (!virtualNumber) {
      return NextResponse.json({ otp: null });
    }

    // Check otp_logs for recent OTP
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const otpResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/otp_logs?phone=eq.${encodeURIComponent(virtualNumber)}&created_at=gte.${tenMinutesAgo}&order=created_at.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    const otpData = await otpResponse.json();

    if (otpData && otpData.length > 0 && otpData[0].code) {
      return NextResponse.json({ otp: otpData[0].code });
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
