import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessName, businessCategory, website, userId, userEmail, userName } = body;

    // Validate input
    if (!businessName || !businessCategory || !userId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify the user is authenticated by checking the token
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

    // Verify token and get user
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user || user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use admin client (service role) to bypass RLS
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Generate slug from business name
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + Date.now().toString(36);

    // Create organization
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .insert({
        name: businessName,
        slug,
        business_name: businessName,
        business_category: businessCategory,
        website: website || null,
        subscription_status: 'TRIAL',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        onboarding_step: 1,
      })
      .select()
      .single();

    if (orgError) {
      console.error('Org creation error:', orgError);
      return NextResponse.json(
        { error: 'Failed to create organization: ' + orgError.message },
        { status: 500 }
      );
    }

    // Create default admin role
    const { data: role, error: roleError } = await adminClient
      .from('roles')
      .insert({
        organization_id: org.id,
        name: 'Admin',
        description: 'Full access to all features',
        is_admin: true,
        is_default: true,
        permissions: {
          inbox: { view: true, reply: true, assign: true },
          contacts: { view: true, create: true, edit: true, delete: true, import: true, export: true },
          templates: { view: true, create: true, edit: true, delete: true },
          campaigns: { view: true, create: true, edit: true, delete: true, send: true },
          analytics: { view: true },
          team: { view: true, invite: true, edit: true, remove: true },
          billing: { view: true, manage: true },
          integrations: { view: true, manage: true },
          settings: { view: true, edit: true },
        },
      })
      .select()
      .single();

    if (roleError) {
      console.error('Role creation error:', roleError);
      await adminClient.from('organizations').delete().eq('id', org.id);
      return NextResponse.json(
        { error: 'Failed to create role: ' + roleError.message },
        { status: 500 }
      );
    }

    // Create user record
    const { error: userRecordError } = await adminClient
      .from('users')
      .insert({
        auth_id: userId,
        organization_id: org.id,
        role_id: role.id,
        email: userEmail,
        full_name: userName || userEmail.split('@')[0],
        is_owner: true,
        is_active: true,
      });

    if (userRecordError) {
      console.error('User creation error:', userRecordError);
      await adminClient.from('roles').delete().eq('id', role.id);
      await adminClient.from('organizations').delete().eq('id', org.id);
      return NextResponse.json(
        { error: 'Failed to create user: ' + userRecordError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      organizationId: org.id,
    });

  } catch (error) {
    console.error('Error in create-organization:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
