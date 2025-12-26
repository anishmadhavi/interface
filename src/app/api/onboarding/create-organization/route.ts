import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

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

    // Verify the user is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminClient();

    // Generate slug from business name
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + Date.now().toString(36);

    // Create organization
    // FIX 1: Cast insert object to 'any'
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
      } as any)
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
        // FIX 2: Cast org to 'any' to access .id
        organization_id: (org as any).id,
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
      } as any)
      .select()
      .single();

    if (roleError) {
      console.error('Role creation error:', roleError);
      // Rollback organization (FIX 3: Cast org to any)
      await adminClient.from('organizations').delete().eq('id', (org as any).id);
      return NextResponse.json(
        { error: 'Failed to create role: ' + roleError.message },
        { status: 500 }
      );
    }

    // Create user record
    const { error: userError } = await adminClient
      .from('users')
      .insert({
        auth_id: userId,
        // FIX 4: Cast org and role to any
        organization_id: (org as any).id,
        role_id: (role as any).id,
        email: userEmail,
        full_name: userName || userEmail.split('@')[0],
        is_owner: true,
        is_active: true,
      } as any);

    if (userError) {
      console.error('User creation error:', userError);
      // Rollback (FIX 5: Cast role and org to any)
      await adminClient.from('roles').delete().eq('id', (role as any).id);
      await adminClient.from('organizations').delete().eq('id', (org as any).id);
      return NextResponse.json(
        { error: 'Failed to create user: ' + userError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      // FIX 6: Cast org to any
      organizationId: (org as any).id,
    });
  } catch (error) {
    console.error('Error in create-organization:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
