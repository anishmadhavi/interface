/**
 * =============================================================================
 * FILE: src/app/api/contacts/route.ts
 * PURPOSE: Contacts Management API
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Lists contacts with pagination, filtering, and search
 * - Creates new contacts
 * - Updates contact information
 * - Deletes contacts
 * - Manages tags and custom fields
 * - Handles opt-out status
 * 
 * CONTACT FIELDS:
 * - phone: WhatsApp phone number (required, unique per org)
 * - name: Display name
 * - email: Email address
 * - tags: Array of tags for segmentation
 * - custom_fields: JSON object for custom data
 * - opted_out: Whether contact has opted out
 * - source: Where contact came from (MANUAL, IMPORT, WHATSAPP, CTWA_AD)
 * 
 * FILTERING OPTIONS:
 * - Search by name or phone
 * - Filter by tags
 * - Filter by opted_out status
 * - Filter by source
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/admin
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET - List Contacts
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const optedOut = searchParams.get('optedOut');
    const source = searchParams.get('source');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Calculate offset
    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply tags filter
    if (tags && tags.length > 0) {
      query = query.overlaps('tags', tags);
    }

    // Apply opted_out filter
    if (optedOut !== null && optedOut !== undefined && optedOut !== '') {
      query = query.eq('opted_out', optedOut === 'true');
    }

    // Apply source filter
    if (source) {
      query = query.eq('source', source.toUpperCase());
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[Contacts] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get all unique tags for filter options
    const { data: allContacts } = await supabaseAdmin
      .from('contacts')
      .select('tags')
      .eq('organization_id', organizationId);

    const allTags = new Set<string>();
    allContacts?.forEach(c => {
      (c.tags || []).forEach((tag: string) => allTags.add(tag));
    });

    return NextResponse.json({
      contacts: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      filters: {
        availableTags: Array.from(allTags).sort(),
      },
    });

  } catch (error: any) {
    console.error('[Contacts] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create Contact
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      organizationId,
      phone,
      name,
      email,
      tags,
      customFields,
      source = 'MANUAL',
    } = body;

    // Validate required fields
    if (!organizationId || !phone) {
      return NextResponse.json(
        { error: 'Organization ID and phone number are required' },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Check for duplicate phone in organization
    const { data: existing } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('phone', normalizedPhone)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A contact with this phone number already exists' },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Create contact
    const { data: contact, error } = await supabaseAdmin
      .from('contacts')
      .insert({
        organization_id: organizationId,
        phone: normalizedPhone,
        name: name?.trim() || normalizedPhone,
        email: email?.trim().toLowerCase() || null,
        tags: tags || [],
        custom_fields: customFields || {},
        source: source.toUpperCase(),
        opted_out: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[Contacts] Create error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Contacts] Created:', contact.id);
    return NextResponse.json({ contact }, { status: 201 });

  } catch (error: any) {
    console.error('[Contacts] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create contact' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update Contact
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactId, organizationId, ...updates } = body;

    if (!contactId || !organizationId) {
      return NextResponse.json(
        { error: 'Contact ID and organization ID are required' },
        { status: 400 }
      );
    }

    // Verify contact exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('contacts')
      .select('id, phone')
      .eq('id', contactId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Handle phone update
    if (updates.phone) {
      const normalizedPhone = normalizePhone(updates.phone);
      if (!normalizedPhone) {
        return NextResponse.json(
          { error: 'Invalid phone number format' },
          { status: 400 }
        );
      }

      // Check for duplicate
      const { data: duplicate } = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('phone', normalizedPhone)
        .neq('id', contactId)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: 'Another contact with this phone number exists' },
          { status: 400 }
        );
      }

      updateData.phone = normalizedPhone;
    }

    // Handle other fields
    if (updates.name !== undefined) updateData.name = updates.name?.trim();
    if (updates.email !== undefined) {
      if (updates.email && !isValidEmail(updates.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
      updateData.email = updates.email?.trim().toLowerCase() || null;
    }
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.customFields !== undefined) updateData.custom_fields = updates.customFields;
    if (updates.optedOut !== undefined) {
      updateData.opted_out = updates.optedOut;
      if (updates.optedOut) {
        updateData.opted_out_at = new Date().toISOString();
      }
    }

    // Update contact
    const { data: contact, error: updateError } = await supabaseAdmin
      .from('contacts')
      .update(updateData)
      .eq('id', contactId)
      .select()
      .single();

    if (updateError) {
      console.error('[Contacts] Update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log('[Contacts] Updated:', contactId);
    return NextResponse.json({ contact });

  } catch (error: any) {
    console.error('[Contacts] PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update contact' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete Contact(s)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const contactId = searchParams.get('contactId');
    const contactIds = searchParams.get('contactIds'); // For bulk delete
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    if (!contactId && !contactIds) {
      return NextResponse.json(
        { error: 'Contact ID or Contact IDs are required' },
        { status: 400 }
      );
    }

    // Handle bulk delete
    if (contactIds) {
      const ids = contactIds.split(',').filter(Boolean);
      
      if (ids.length > 100) {
        return NextResponse.json(
          { error: 'Maximum 100 contacts can be deleted at once' },
          { status: 400 }
        );
      }

      const { error } = await supabaseAdmin
        .from('contacts')
        .delete()
        .eq('organization_id', organizationId)
        .in('id', ids);

      if (error) {
        console.error('[Contacts] Bulk delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('[Contacts] Bulk deleted:', ids.length);
      return NextResponse.json({ success: true, deleted: ids.length });
    }

    // Single delete
    const { error } = await supabaseAdmin
      .from('contacts')
      .delete()
      .eq('id', contactId)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('[Contacts] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Contacts] Deleted:', contactId);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[Contacts] DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete contact' },
      { status: 500 }
    );
  }
}

/**
 * Normalize phone number to standard format
 */
function normalizePhone(phone: string): string {
  if (!phone) return '';

  // Remove all non-numeric characters except +
  let normalized = phone.replace(/[^\d+]/g, '');

  // Remove leading + for processing
  const hasPlus = normalized.startsWith('+');
  if (hasPlus) {
    normalized = normalized.substring(1);
  }

  // If starts with 0, assume Indian number - replace with 91
  if (normalized.startsWith('0')) {
    normalized = '91' + normalized.substring(1);
  }

  // If 10 digits, assume Indian number - add 91
  if (normalized.length === 10) {
    normalized = '91' + normalized;
  }

  // Validate minimum length (country code + number)
  if (normalized.length < 10) {
    return '';
  }

  // Add + back
  return '+' + normalized;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
