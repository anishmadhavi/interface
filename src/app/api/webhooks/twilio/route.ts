import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'edge';

// Store recent OTPs in memory (in production, use Redis or database)
// Key: phone number, Value: { otp: string, timestamp: number }
const otpStore = new Map<string, { otp: string; timestamp: number }>();

export async function POST(request: Request) {
  try {
    // Parse form data from Twilio webhook
    const formData = await request.formData();
    
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;

    console.log('Twilio webhook received:', { from, to, body: body?.substring(0, 50), messageSid });

    if (!to || !body) {
      return new Response('OK', { status: 200 });
    }

    // Extract OTP from message body
    // Meta usually sends messages like: "Your Facebook code is 123-456" or "123456 is your verification code"
    const otpMatch = body.match(/(\d{3}[-\s]?\d{3}|\d{6})/);
    
    if (otpMatch) {
      const otp = otpMatch[1].replace(/[-\s]/g, ''); // Remove dashes and spaces
      
      // Store OTP with timestamp (valid for 10 minutes)
      otpStore.set(to, { otp, timestamp: Date.now() });
      
      // Also store in database for persistence
      const supabase = createAdminClient();
      
      // Find organization by virtual number
      // FIX 1: Added explicit type definition
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('virtual_number', to)
        .single<{ id: string }>();

      if (org) {
        // Log the webhook
        // FIX 2: Added 'as any' to bypass insert restriction
        await (supabase.from('webhook_logs') as any)
          .insert({
            organization_id: org.id,
            source: 'TWILIO',
            event_type: 'SMS_RECEIVED',
            payload: {
              from,
              to,
              body,
              messageSid,
              extractedOtp: otp,
            },
            status: 'PROCESSED',
            processed_at: new Date().toISOString(),
          });
      }

      console.log('OTP extracted and stored:', { to, otp });
    }

    // Return empty TwiML response
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      }
    );

  } catch (error) {
    console.error('Error processing Twilio webhook:', error);
    return new Response('OK', { status: 200 });
  }
}

// GET endpoint to check for OTP
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

    const supabase = createAdminClient();

    // Get organization's virtual number
    // FIX 3: Added explicit type definition
    const { data: org } = await supabase
      .from('organizations')
      .select('virtual_number')
      .eq('id', organizationId)
      .single<{ virtual_number: string }>();

    if (!org?.virtual_number) {
      return NextResponse.json(
        { error: 'No virtual number found' },
        { status: 404 }
      );
    }

    // Check memory store first
    const stored = otpStore.get(org.virtual_number);
    
    if (stored && Date.now() - stored.timestamp < 10 * 60 * 1000) {
      return NextResponse.json({ otp: stored.otp });
    }

    // Check database for recent OTP
    // FIX 4: Added explicit type definition for payload
    const { data: log } = await supabase
      .from('webhook_logs')
      .select('payload')
      .eq('organization_id', organizationId)
      .eq('source', 'TWILIO')
      .eq('event_type', 'SMS_RECEIVED')
      .order('created_at', { ascending: false })
      .limit(1)
      .single<{ payload: { extractedOtp?: string } }>();

    if (log?.payload?.extractedOtp) {
      return NextResponse.json({ otp: log.payload.extractedOtp });
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
