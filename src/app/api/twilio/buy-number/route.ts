import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated and belongs to this organization
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify organization
    // FIX 1: Added explicit type definition
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_id', user.id)
      .single<{ organization_id: string }>();

    if (userData?.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return NextResponse.json(
        { error: 'Twilio not configured' },
        { status: 500 }
      );
    }

    // Search for available US phone numbers
    const searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/AvailablePhoneNumbers/US/Local.json?SmsEnabled=true&VoiceEnabled=true&Limit=1`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
    });

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json();
      console.error('Twilio search error:', errorData);
      return NextResponse.json(
        { error: 'Failed to search for available numbers' },
        { status: 500 }
      );
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.available_phone_numbers || searchData.available_phone_numbers.length === 0) {
      return NextResponse.json(
        { error: 'No phone numbers available' },
        { status: 404 }
      );
    }

    const availableNumber = searchData.available_phone_numbers[0].phone_number;

    // Purchase the phone number
    const purchaseUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`;
    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL + '/api/webhooks/twilio';

    const purchaseResponse = await fetch(purchaseUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        PhoneNumber: availableNumber,
        SmsUrl: webhookUrl,
        SmsMethod: 'POST',
        FriendlyName: `Interface - ${organizationId.substring(0, 8)}`,
      }),
    });

    if (!purchaseResponse.ok) {
      const errorData = await purchaseResponse.json();
      console.error('Twilio purchase error:', errorData);
      return NextResponse.json(
        { error: 'Failed to purchase phone number' },
        { status: 500 }
      );
    }

    const purchaseData = await purchaseResponse.json();

    // Update organization with the virtual number
    // FIX 2: Added 'as any' to bypass strict type checking
    const { error: updateError } = await (supabase.from('organizations') as any)
      .update({
        virtual_number: purchaseData.phone_number,
        virtual_number_provider: 'TWILIO',
        virtual_number_sid: purchaseData.sid,
        virtual_number_monthly_cost: 150,
      })
      .eq('id', organizationId);

    if (updateError) {
      console.error('Database update error:', updateError);
      // Number is purchased but DB failed - still return success
    }

    return NextResponse.json({
      phoneNumber: purchaseData.phone_number,
      sid: purchaseData.sid,
      friendlyName: purchaseData.friendly_name,
    });

  } catch (error) {
    console.error('Error buying Twilio number:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
