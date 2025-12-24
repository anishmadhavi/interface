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
    // FIX 1: Added 'as any' cast
    const { data: org, error: orgError } = await (adminClient
      .from('organizations') as any)
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
    // FIX 2: Added 'as any' cast
    const { data: role, error: roleError } = await (adminClient
      .from('roles') as any)
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
      // Rollback organization
      // FIX 3: Added 'as any' cast
      await (adminClient.from('organizations') as any).delete().eq('id', org.id);
      return NextResponse.json(
        { error: 'Failed to create role: ' + roleError.message },
        { status: 500 }
      );
    }

    // Create user record
    // FIX 4: Added 'as any' cast
    const { error: userError } = await (adminClient
      .from('users') as any)
      .insert({
        auth_id: userId,
        organization_id: org.id,
        role_id: role.id,
        email: userEmail,
        full_name: userName || userEmail.split('@')[0],
        is_owner: true,
        is_active: true,
      });

    if (userError) {
      console.error('User creation error:', userError);
      // Rollback
      // FIX 5: Added 'as any' cast
      await (adminClient.from('roles') as any).delete().eq('id', role.id);
      await (adminClient.from('organizations') as any).delete().eq('id', org.id);
      return NextResponse.json(
        { error: 'Failed to create user: ' + userError.message },
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
