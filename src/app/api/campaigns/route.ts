/**
 * =============================================================================
 * FILE: src/app/api/campaigns/route.ts
 * PURPOSE: Broadcast Campaigns Management API
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Lists all campaigns for an organization
 * - Creates new broadcast campaigns
 * - Updates campaign details
 * - Deletes draft/cancelled campaigns
 * - Cancels scheduled campaigns
 * 
 * CAMPAIGN LIFECYCLE:
 * 1. DRAFT - Created but not scheduled/sent
 * 2. SCHEDULED - Set to send at specific time
 * 3. SENDING - Currently being sent
 * 4. SENT - Completed successfully
 * 5. PARTIALLY_SENT - Completed with some failures
 * 6. FAILED - All messages failed
 * 7. CANCELLED - Cancelled by user
 * 
 * RECIPIENT FILTERS:
 * - all: All contacts (excluding opted out)
 * - tags: Contacts with specific tags
 * - segment: Custom segment query
 * 
 * PRICING (July 2025 - India):
 * - Marketing: ₹0.82 per message
 * - Utility: ₹0.33 per conversation
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

// Pricing per category (INR) - July 2025
const PRICING: Record<string, number> = {
  MARKETING: 0.82,
  UTILITY: 0.33,
  AUTHENTICATION: 0.33,
};

/**
 * GET - List Campaigns
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabaseAdmin
      .from('campaigns')
      .select(`
        *,
        templates (
          id,
          name,
          category,
          language
        )
      `, { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status.toUpperCase());
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[Campaigns] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate stats
    const stats = await getCampaignStats(organizationId);

    return NextResponse.json({
      campaigns: data || [],
      total: count || 0,
      stats,
    });

  } catch (error: any) {
    console.error('[Campaigns] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create Campaign
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      organizationId,
      name,
      templateId,
      recipientFilter,
      variableValues,
      scheduledAt,
      sendNow = false,
    } = body;

    // Validate required fields
    if (!organizationId || !name || !templateId) {
      return NextResponse.json(
        { error: 'Organization ID, name, and template ID are required' },
        { status: 400 }
      );
    }

    // Validate template exists and is approved
    const { data: template, error: templateError } = await supabaseAdmin
      .from('templates')
      .select('id, name, category, status')
      .eq('id', templateId)
      .eq('organization_id', organizationId)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    if (template.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Template must be approved by Meta before use in campaigns' },
        { status: 400 }
      );
    }

    // Calculate recipient count
    const recipientCount = await calculateRecipientCount(organizationId, recipientFilter);

    if (recipientCount === 0) {
      return NextResponse.json(
        { error: 'No recipients match the selected filter' },
        { status: 400 }
      );
    }

    // Calculate estimated cost
    const rate = PRICING[template.category] || 0;
    const estimatedCost = recipientCount * rate;

    // Determine initial status
    let status = 'DRAFT';
    let scheduledAtValue = null;

    if (sendNow) {
      // Validate TRAI quiet hours for marketing
      if (template.category === 'MARKETING') {
        const quietHoursError = validateQuietHours();
        if (quietHoursError) {
          return NextResponse.json({ error: quietHoursError }, { status: 400 });
        }
      }
      status = 'SENDING';
    } else if (scheduledAt) {
      // Validate scheduled time
      const scheduledDate = new Date(scheduledAt);
      
      if (scheduledDate <= new Date()) {
        return NextResponse.json(
          { error: 'Scheduled time must be in the future' },
          { status: 400 }
        );
      }

      // Validate TRAI quiet hours for scheduled marketing campaigns
      if (template.category === 'MARKETING') {
        const quietHoursError = validateQuietHoursForDate(scheduledDate);
        if (quietHoursError) {
          return NextResponse.json({ error: quietHoursError }, { status: 400 });
        }
      }

      status = 'SCHEDULED';
      scheduledAtValue = scheduledAt;
    }

    // Create campaign
    const { data: campaign, error: createError } = await supabaseAdmin
      .from('campaigns')
      .insert({
        organization_id: organizationId,
        name,
        template_id: templateId,
        status,
        scheduled_at: scheduledAtValue,
        total_recipients: recipientCount,
        estimated_cost: estimatedCost,
        recipient_filter: recipientFilter || { type: 'all' },
        variable_values: variableValues || {},
      })
      .select(`
        *,
        templates (
          id,
          name,
          category
        )
      `)
      .single();

    if (createError) {
      console.error('[Campaigns] Create error:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    console.log('[Campaigns] Created:', campaign.id);

    // If sendNow, trigger the send process
    if (sendNow) {
      // Call send endpoint asynchronously
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/campaigns/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id }),
      }).catch(err => console.error('[Campaigns] Send trigger error:', err));
    }

    return NextResponse.json({ campaign }, { status: 201 });

  } catch (error: any) {
    console.error('[Campaigns] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create campaign' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update Campaign
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { campaignId, organizationId, action, ...updates } = body;

    if (!campaignId || !organizationId) {
      return NextResponse.json(
        { error: 'Campaign ID and organization ID are required' },
        { status: 400 }
      );
    }

    // Get current campaign
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Handle specific actions
    if (action === 'cancel') {
      if (!['SCHEDULED', 'DRAFT'].includes(campaign.status)) {
        return NextResponse.json(
          { error: 'Can only cancel scheduled or draft campaigns' },
          { status: 400 }
        );
      }

      const { data: updated, error } = await supabaseAdmin
        .from('campaigns')
        .update({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', campaignId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('[Campaigns] Cancelled:', campaignId);
      return NextResponse.json({ campaign: updated });
    }

    if (action === 'duplicate') {
      const { data: newCampaign, error } = await supabaseAdmin
        .from('campaigns')
        .insert({
          organization_id: organizationId,
          name: `${campaign.name} (Copy)`,
          template_id: campaign.template_id,
          status: 'DRAFT',
          total_recipients: campaign.total_recipients,
          estimated_cost: campaign.estimated_cost,
          recipient_filter: campaign.recipient_filter,
          variable_values: campaign.variable_values,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('[Campaigns] Duplicated:', campaignId, '->', newCampaign.id);
      return NextResponse.json({ campaign: newCampaign }, { status: 201 });
    }

    // Regular update - only allowed for DRAFT campaigns
    if (campaign.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Can only edit draft campaigns' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name) updateData.name = updates.name;
    if (updates.templateId) updateData.template_id = updates.templateId;
    if (updates.recipientFilter) {
      updateData.recipient_filter = updates.recipientFilter;
      // Recalculate recipient count
      updateData.total_recipients = await calculateRecipientCount(
        organizationId,
        updates.recipientFilter
      );
    }
    if (updates.variableValues) updateData.variable_values = updates.variableValues;
    if (updates.scheduledAt) {
      updateData.scheduled_at = updates.scheduledAt;
      updateData.status = 'SCHEDULED';
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('campaigns')
      .update(updateData)
      .eq('id', campaignId)
      .select()
      .single();

    if (updateError) {
      console.error('[Campaigns] Update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log('[Campaigns] Updated:', campaignId);
    return NextResponse.json({ campaign: updated });

  } catch (error: any) {
    console.error('[Campaigns] PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update campaign' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete Campaign
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const campaignId = searchParams.get('campaignId');
    const organizationId = searchParams.get('organizationId');

    if (!campaignId || !organizationId) {
      return NextResponse.json(
        { error: 'Campaign ID and organization ID are required' },
        { status: 400 }
      );
    }

    // Get campaign
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Can only delete DRAFT or CANCELLED campaigns
    if (!['DRAFT', 'CANCELLED'].includes(campaign.status)) {
      return NextResponse.json(
        { error: 'Can only delete draft or cancelled campaigns' },
        { status: 400 }
      );
    }

    // Delete campaign recipients first (if any)
    await supabaseAdmin
      .from('campaign_recipients')
      .delete()
      .eq('campaign_id', campaignId);

    // Delete campaign
    const { error: deleteError } = await supabaseAdmin
      .from('campaigns')
      .delete()
      .eq('id', campaignId);

    if (deleteError) {
      console.error('[Campaigns] Delete error:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log('[Campaigns] Deleted:', campaignId);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[Campaigns] DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete campaign' },
      { status: 500 }
    );
  }
}

/**
 * Calculate recipient count based on filter
 */
async function calculateRecipientCount(
  organizationId: string,
  filter: any
): Promise<number> {
  let query = supabaseAdmin
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('opted_out', false);

  if (!filter || filter.type === 'all') {
    // All contacts
  } else if (filter.type === 'tags' && filter.tags?.length > 0) {
    query = query.overlaps('tags', filter.tags);
  } else if (filter.type === 'segment' && filter.segmentId) {
    // Get segment query and apply
    const { data: segment } = await supabaseAdmin
      .from('segments')
      .select('query')
      .eq('id', filter.segmentId)
      .single();
    
    if (segment?.query) {
      // Apply segment filters (simplified - would need proper implementation)
      // For now, just return all contacts
    }
  }

  const { count } = await query;
  return count || 0;
}

/**
 * Get campaign stats for dashboard
 */
async function getCampaignStats(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('status, sent_count, delivered_count, read_count')
    .eq('organization_id', organizationId);

  const stats = {
    total: data?.length || 0,
    draft: 0,
    scheduled: 0,
    sent: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalRead: 0,
    avgDeliveryRate: 0,
    avgReadRate: 0,
  };

  if (data) {
    for (const campaign of data) {
      if (campaign.status === 'DRAFT') stats.draft++;
      if (campaign.status === 'SCHEDULED') stats.scheduled++;
      if (['SENT', 'PARTIALLY_SENT'].includes(campaign.status)) stats.sent++;
      
      stats.totalSent += campaign.sent_count || 0;
      stats.totalDelivered += campaign.delivered_count || 0;
      stats.totalRead += campaign.read_count || 0;
    }

    if (stats.totalSent > 0) {
      stats.avgDeliveryRate = (stats.totalDelivered / stats.totalSent) * 100;
      stats.avgReadRate = (stats.totalRead / stats.totalSent) * 100;
    }
  }

  return stats;
}

/**
 * Validate TRAI quiet hours (9 PM - 9 AM IST) for current time
 */
function validateQuietHours(): string | null {
  return validateQuietHoursForDate(new Date());
}

/**
 * Validate TRAI quiet hours for specific date
 */
function validateQuietHoursForDate(date: Date): string | null {
  // Convert to IST
  const istOffset = 5.5 * 60; // minutes
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const istMinutes = (utcMinutes + istOffset) % (24 * 60);
  const istHour = Math.floor(istMinutes / 60);

  if (istHour >= 21 || istHour < 9) {
    return 'Cannot send marketing messages during TRAI quiet hours (9 PM - 9 AM IST)';
  }

  return null;
}
