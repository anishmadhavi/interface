import { NextResponse } from 'next/server';
import { adminClient, verifyToken, extractTokenFromCookies } from '@/lib/supabase/admin';

export const runtime = 'edge';

// 1. Define interfaces for the data we expect
interface Organization {
  id: string;
}

interface Role {
  id: string;
}

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

    // Verify user is authenticated
    const cookieHeader = request.headers.get('cookie') || '';
    const accessToken = extractTokenFromCookies(cookieHeader);

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user, error: authError } = await verifyToken(accessToken);
    if (authError || !user || user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate slug from business name
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + Date.now().toString(36);

    // Create organization using REST API
    // 2. FIX: Add <Organization> generic to single()
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
      .select('*')
      .single<Organization>(); // <--- EXPLICIT TYPE

    if (orgError || !org) {
      console.error('Org creation error:', orgError);
      return NextResponse.json(
        { error: 'Failed to create organization: ' + (orgError?.message || 'Unknown error') },
        { status: 500 }
      );
    }

    // Create default admin role
    // 3. FIX: Add <Role> generic to single()
    const { data: role, error: roleError } = await adminClient
      .from('roles')
      .insert({
        organization_id: org.id, // Now TypeScript knows 'id' exists
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
      .select('*')
      .single<Role>(); // <--- EXPLICIT TYPE

    if (roleError || !role) {
      console.error('Role creation error:', roleError);
      // Cleanup organization if role creation fails
      await adminClient.from('organizations').delete().eq('id', org.id);
      return NextResponse.json(
        { error: 'Failed to create role: ' + (roleError?.message || 'Unknown error') },
        { status: 500 }
      );
    }

    // Create user record
    const { error: userRecordError } = await adminClient
      .from('users')
      .insert({
        auth_id: userId,
        organization_id: org.id,
        role_id: role.id, // Now TypeScript knows 'id' exists
        email: userEmail,
        full_name: userName || userEmail.split('@')[0],
        is_owner: true,
        is_active: true,
      })
      .select('*')
      .single();

    if (userRecordError) {
      console.error('User creation error:', userRecordError);
      // Cleanup if user creation fails
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
