/**
 * =============================================================================
 * FILE: src/app/api/conversations/route.ts
 * PURPOSE: Inbox/Conversations Management API
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Lists conversations with contact details
 * - Gets single conversation with messages
 * - Updates conversation status (open, resolved, spam)
 * - Assigns conversations to team members
 * - Marks conversations as read
 * - Archives/deletes conversations
 * 
 * CONVERSATION STATUS:
 * - OPEN: Active conversation
 * - RESOLVED: Completed/closed
 * - SPAM: Marked as spam
 * - ARCHIVED: Archived for reference
 * 
 * FEATURES:
 * - Real-time unread counts
 * - Team member assignment
 * - Labels/tags for organization
 * - Search within messages
 * - Pagination for messages
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
 * GET - List Conversations or Get Single Conversation
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const conversationId = searchParams.get('conversationId');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // If conversationId provided, return single conversation with messages
    if (conversationId) {
      return await getConversationWithMessages(organizationId, conversationId, searchParams);
    }

    // Build query for conversation list
    let query = supabaseAdmin
      .from('conversations')
      .select(`
        *,
        contacts (
          id,
          phone,
          name,
          email,
          tags,
          custom_fields
        ),
        assigned_user:users!conversations_assigned_to_fkey (
          id,
          name,
          email
        )
      `, { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status.toUpperCase());
    } else {
      // By default, exclude archived
      query = query.neq('status', 'ARCHIVED');
    }

    if (assignedTo) {
      if (assignedTo === 'unassigned') {
        query = query.is('assigned_to', null);
      } else {
        query = query.eq('assigned_to', assignedTo);
      }
    }

    // Search in contact name/phone
    if (search) {
      // First get matching contact IDs
      const { data: matchingContacts } = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('organization_id', organizationId)
        .or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

      if (matchingContacts && matchingContacts.length > 0) {
        const contactIds = matchingContacts.map(c => c.id);
        query = query.in('contact_id', contactIds);
      } else {
        // No matching contacts
        return NextResponse.json({
          conversations: [],
          total: 0,
          unreadCount: 0,
        });
      }
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[Conversations] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get unread count
    const { count: unreadCount } = await supabaseAdmin
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'OPEN')
      .gt('unread_count', 0);

    // Get status counts
    const statusCounts = await getStatusCounts(organizationId);

    return NextResponse.json({
      conversations: data || [],
      total: count || 0,
      unreadCount: unreadCount || 0,
      statusCounts,
    });

  } catch (error: any) {
    console.error('[Conversations] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

/**
 * Get single conversation with messages
 */
async function getConversationWithMessages(
  organizationId: string,
  conversationId: string,
  searchParams: URLSearchParams
) {
  const messagesLimit = parseInt(searchParams.get('messagesLimit') || '50');
  const messagesBefore = searchParams.get('messagesBefore'); // For pagination

  // Get conversation with contact
  const { data: conversation, error: convError } = await supabaseAdmin
    .from('conversations')
    .select(`
      *,
      contacts (
        id,
        phone,
        name,
        email,
        tags,
        custom_fields,
        opted_out,
        created_at
      ),
      assigned_user:users!conversations_assigned_to_fkey (
        id,
        name,
        email
      )
    `)
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
    .single();

  if (convError || !conversation) {
    return NextResponse.json(
      { error: 'Conversation not found' },
      { status: 404 }
    );
  }

  // Build messages query
  let messagesQuery = supabaseAdmin
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: false })
    .limit(messagesLimit);

  if (messagesBefore) {
    messagesQuery = messagesQuery.lt('timestamp', messagesBefore);
  }

  const { data: messages, error: msgError } = await messagesQuery;

  if (msgError) {
    console.error('[Conversations] Messages query error:', msgError);
  }

  // Mark conversation as read
  if (conversation.unread_count > 0) {
    await supabaseAdmin
      .from('conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);
  }

  return NextResponse.json({
    conversation,
    messages: (messages || []).reverse(), // Oldest first for display
    hasMore: (messages?.length || 0) === messagesLimit,
  });
}

/**
 * PATCH - Update Conversation
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, organizationId, action, ...updates } = body;

    if (!conversationId || !organizationId) {
      return NextResponse.json(
        { error: 'Conversation ID and organization ID are required' },
        { status: 400 }
      );
    }

    // Verify conversation exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('conversations')
      .select('id, status')
      .eq('id', conversationId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Handle specific actions
    if (action) {
      return await handleConversationAction(conversationId, organizationId, action, body);
    }

    // Build update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.status) {
      const validStatuses = ['OPEN', 'RESOLVED', 'SPAM', 'ARCHIVED'];
      if (!validStatuses.includes(updates.status.toUpperCase())) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }
      updateData.status = updates.status.toUpperCase();
      
      if (updates.status.toUpperCase() === 'RESOLVED') {
        updateData.resolved_at = new Date().toISOString();
      }
    }

    if (updates.assignedTo !== undefined) {
      updateData.assigned_to = updates.assignedTo || null;
      updateData.assigned_at = updates.assignedTo ? new Date().toISOString() : null;
    }

    if (updates.labels !== undefined) {
      updateData.labels = updates.labels;
    }

    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }

    // Update conversation
    const { data: conversation, error: updateError } = await supabaseAdmin
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId)
      .select(`
        *,
        contacts (id, phone, name)
      `)
      .single();

    if (updateError) {
      console.error('[Conversations] Update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log('[Conversations] Updated:', conversationId);
    return NextResponse.json({ conversation });

  } catch (error: any) {
    console.error('[Conversations] PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

/**
 * Handle specific conversation actions
 */
async function handleConversationAction(
  conversationId: string,
  organizationId: string,
  action: string,
  body: any
) {
  switch (action) {
    case 'markRead': {
      await supabaseAdmin
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

      return NextResponse.json({ success: true });
    }

    case 'markUnread': {
      await supabaseAdmin
        .from('conversations')
        .update({ unread_count: 1 })
        .eq('id', conversationId);

      return NextResponse.json({ success: true });
    }

    case 'resolve': {
      await supabaseAdmin
        .from('conversations')
        .update({
          status: 'RESOLVED',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      return NextResponse.json({ success: true });
    }

    case 'reopen': {
      await supabaseAdmin
        .from('conversations')
        .update({
          status: 'OPEN',
          resolved_at: null,
        })
        .eq('id', conversationId);

      return NextResponse.json({ success: true });
    }

    case 'archive': {
      await supabaseAdmin
        .from('conversations')
        .update({
          status: 'ARCHIVED',
          archived_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      return NextResponse.json({ success: true });
    }

    case 'spam': {
      await supabaseAdmin
        .from('conversations')
        .update({ status: 'SPAM' })
        .eq('id', conversationId);

      return NextResponse.json({ success: true });
    }

    case 'assign': {
      const { userId } = body;
      
      await supabaseAdmin
        .from('conversations')
        .update({
          assigned_to: userId || null,
          assigned_at: userId ? new Date().toISOString() : null,
        })
        .eq('id', conversationId);

      return NextResponse.json({ success: true });
    }

    case 'bulkUpdate': {
      const { conversationIds, status, assignedTo } = body;

      if (!conversationIds || !Array.isArray(conversationIds)) {
        return NextResponse.json(
          { error: 'Conversation IDs array required' },
          { status: 400 }
        );
      }

      const updateData: any = { updated_at: new Date().toISOString() };
      if (status) updateData.status = status.toUpperCase();
      if (assignedTo !== undefined) updateData.assigned_to = assignedTo || null;

      await supabaseAdmin
        .from('conversations')
        .update(updateData)
        .eq('organization_id', organizationId)
        .in('id', conversationIds);

      return NextResponse.json({ success: true, updated: conversationIds.length });
    }

    default:
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
  }
}

/**
 * DELETE - Delete/Archive Conversation
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('conversationId');
    const organizationId = searchParams.get('organizationId');
    const permanent = searchParams.get('permanent') === 'true';

    if (!conversationId || !organizationId) {
      return NextResponse.json(
        { error: 'Conversation ID and organization ID are required' },
        { status: 400 }
      );
    }

    if (permanent) {
      // Permanently delete conversation and messages
      await supabaseAdmin
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      await supabaseAdmin
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('organization_id', organizationId);

      console.log('[Conversations] Permanently deleted:', conversationId);
    } else {
      // Soft delete (archive)
      await supabaseAdmin
        .from('conversations')
        .update({
          status: 'ARCHIVED',
          archived_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
        .eq('organization_id', organizationId);

      console.log('[Conversations] Archived:', conversationId);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[Conversations] DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}

/**
 * Get status counts for sidebar
 */
async function getStatusCounts(organizationId: string) {
  const statuses = ['OPEN', 'RESOLVED', 'SPAM', 'ARCHIVED'];
  const counts: Record<string, number> = {};

  for (const status of statuses) {
    const { count } = await supabaseAdmin
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', status);

    counts[status.toLowerCase()] = count || 0;
  }

  // Unassigned count
  const { count: unassigned } = await supabaseAdmin
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'OPEN')
    .is('assigned_to', null);

  counts.unassigned = unassigned || 0;

  return counts;
}
