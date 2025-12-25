import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

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
      
      // Use admin client
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: { autoRefreshToken: false, persistSession: false },
        }
      );
      
      // Find organization by virtual number
      const { data: org } = await adminClient
        .from('organizations')
        .select('id')
        .eq('virtual_number', to)
        .maybeSingle();

      if (org) {
        // Log the webhook
        await adminClient
          .from('webhook_logs')
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

// GET endpoint to check for OTP (alternative method)
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

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    // Get organization's virtual number
    const { data: org } = await adminClient
      .from('organizations')
      .select('virtual_number')
      .eq('id', organizationId)
      .maybeSingle();

    if (!org?.virtual_number) {
      return NextResponse.json(
        { error: 'No virtual number found' },
        { status: 404 }
      );
    }

    // Check database for recent OTP
    const { data: log } = await adminClient
      .from('webhook_logs')
      .select('payload')
      .eq('organization_id', organizationId)
      .eq('source', 'TWILIO')
      .eq('event_type', 'SMS_RECEIVED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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
