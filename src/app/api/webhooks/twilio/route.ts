import { NextResponse } from 'next/server';

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
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Extract OTP from message body
    // Meta formats: "123-456 is your Facebook code" or "Your code is 123456"
    const otpMatch = body.match(/(\d{3}[-\s]?\d{3}|\d{6})/);

    if (otpMatch) {
      const code = otpMatch[1].replace(/[-\s]/g, ''); // Remove dashes and spaces

      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

      // Store OTP in otp_logs table
      await fetch(`${SUPABASE_URL}/rest/v1/otp_logs`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          phone: to,
          code: code,
          raw_message: body,
          from_number: from,
          message_sid: messageSid,
        }),
      });

      // Also log in webhook_logs for audit
      // First find the organization
      const orgResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/organizations?virtual_number=eq.${encodeURIComponent(to)}&select=id`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }
      );

      const orgData = await orgResponse.json();

      if (orgData && orgData.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/webhook_logs`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            organization_id: orgData[0].id,
            source: 'TWILIO',
            event_type: 'SMS_RECEIVED',
            payload: {
              from,
              to,
              body,
              messageSid,
              extractedOtp: code,
            },
            status: 'PROCESSED',
            processed_at: new Date().toISOString(),
          }),
        });
      }

      console.log('OTP extracted and stored:', { to, code });
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
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

// GET endpoint to manually check for OTP (fallback)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');

  if (!phone) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/otp_logs?phone=eq.${encodeURIComponent(phone)}&created_at=gte.${tenMinutesAgo}&order=created_at.desc&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );

  const data = await response.json();

  if (data && data.length > 0) {
    return NextResponse.json({ otp: data[0].code });
  }

  return NextResponse.json({ otp: null });
}
