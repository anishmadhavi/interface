import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check for recent OTP in webhook logs
    // FIX APPLIED HERE: Added explicit type definition for the log data
    const { data: log } = await supabase
      .from('webhook_logs')
      .select('payload, created_at')
      .eq('organization_id', organizationId)
      .eq('source', 'TWILIO')
      .eq('event_type', 'SMS_RECEIVED')
      .order('created_at', { ascending: false })
      .limit(1)
      .single<{ 
        payload: { extractedOtp?: string }; 
        created_at: string; 
      }>();

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
