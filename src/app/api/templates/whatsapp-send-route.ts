/**
 * =============================================================================
 * FILE: src/app/api/whatsapp/send/route.ts
 * PURPOSE: Send Messages via WhatsApp Cloud API
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Sends text messages to WhatsApp users
 * - Sends template messages (pre-approved by Meta)
 * - Sends media messages (image, video, document, audio)
 * - Sends interactive messages (buttons, lists)
 * - Validates TRAI quiet hours (9 PM - 9 AM IST)
 * - Tracks message costs for billing
 * 
 * MESSAGE TYPES:
 * - text: Plain text messages
 * - template: Pre-approved template messages
 * - image: Image with optional caption
 * - video: Video with optional caption
 * - document: Document/file
 * - audio: Audio message
 * - interactive: Buttons or list messages
 * 
 * PRICING (July 2025 - India):
 * - Marketing: ₹0.82 per message
 * - Utility: ₹0.33 per conversation
 * - Authentication: ₹0.33 per conversation
 * - Service: Free (within 24-hour window)
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

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

// Pricing per message type (INR) - July 2025 Meta pricing for India
const PRICING: Record<string, number> = {
  MARKETING: 0.82,
  UTILITY: 0.33,
  AUTHENTICATION: 0.33,
  SERVICE: 0, // Free within 24-hour window
};

/**
 * Request body interface
 */
interface SendMessageRequest {
  organizationId: string;
  conversationId?: string;
  contactId?: string;
  phone?: string;
  type: 'text' | 'template' | 'image' | 'video' | 'document' | 'audio' | 'interactive';
  content: {
    // For text
    body?: string;
    // For template
    templateName?: string;
    templateLanguage?: string;
    templateComponents?: any[];
    // For media
    mediaUrl?: string;
    mediaId?: string;
    caption?: string;
    filename?: string;
    // For interactive
    interactive?: any;
  };
  category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'SERVICE';
  campaignId?: string;
}

/**
 * POST - Send WhatsApp Message
 */
export async function POST(request: NextRequest) {
  try {
    const body: SendMessageRequest = await request.json();

    // Validate required fields
    if (!body.organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    if (!body.contactId && !body.phone) {
      return NextResponse.json(
        { error: 'Contact ID or phone number is required' },
        { status: 400 }
      );
    }

    if (!body.type || !body.content) {
      return NextResponse.json(
        { error: 'Message type and content are required' },
        { status: 400 }
      );
    }

    // Get organization's WhatsApp account
    const { data: whatsappAccount, error: waError } = await supabaseAdmin
      .from('whatsapp_accounts')
      .select('*')
      .eq('organization_id', body.organizationId)
      .single();

    if (waError || !whatsappAccount) {
      return NextResponse.json(
        { error: 'WhatsApp account not configured. Please complete onboarding.' },
        { status: 400 }
      );
    }

    // Get recipient phone number
    let recipientPhone = body.phone;
    let contactId = body.contactId;

    if (body.contactId && !body.phone) {
      const { data: contact, error: contactError } = await supabaseAdmin
        .from('contacts')
        .select('id, phone, opted_out')
        .eq('id', body.contactId)
        .eq('organization_id', body.organizationId)
        .single();

      if (contactError || !contact) {
        return NextResponse.json(
          { error: 'Contact not found' },
          { status: 404 }
        );
      }

      if (contact.opted_out) {
        return NextResponse.json(
          { error: 'Contact has opted out of messages' },
          { status: 400 }
        );
      }

      recipientPhone = contact.phone;
      contactId = contact.id;
    }

    // Normalize phone number
    recipientPhone = normalizePhone(recipientPhone!);

    // Validate TRAI quiet hours for marketing messages (9 PM - 9 AM IST)
    if (body.category === 'MARKETING') {
      const quietHoursError = validateQuietHours();
      if (quietHoursError) {
        return NextResponse.json(
          { error: quietHoursError },
          { status: 400 }
        );
      }
    }

    // Build WhatsApp API payload
    const payload = buildMessagePayload(body, recipientPhone);

    // Send via WhatsApp Cloud API
    const response = await fetch(
      `${WHATSAPP_API_URL}/${whatsappAccount.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappAccount.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[Send] WhatsApp API error:', result);
      return NextResponse.json(
        { 
          error: result.error?.message || 'Failed to send message',
          code: result.error?.code,
        },
        { status: response.status }
      );
    }

    const whatsappMessageId = result.messages?.[0]?.id;

    // Get or create conversation
    let conversationId = body.conversationId;
    if (!conversationId && contactId) {
      // Try to find existing open conversation
      const { data: existingConv } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('organization_id', body.organizationId)
        .eq('contact_id', contactId)
        .eq('status', 'OPEN')
        .single();

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        // Create new conversation
        const { data: newConv } = await supabaseAdmin
          .from('conversations')
          .insert({
            organization_id: body.organizationId,
            contact_id: contactId,
            status: 'OPEN',
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        conversationId = newConv?.id;
      }
    }

    // Determine message category and cost
    const category = body.category || 'SERVICE';
    const cost = PRICING[category] || 0;

    // Store message in database
    const messageContent = getMessageContent(body);
    const messagePreview = getMessagePreview(body);

    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        organization_id: body.organizationId,
        conversation_id: conversationId,
        contact_id: contactId,
        whatsapp_message_id: whatsappMessageId,
        direction: 'OUTBOUND',
        type: body.type.toUpperCase(),
        content: messageContent,
        status: 'SENT',
        campaign_id: body.campaignId || null,
        category: category,
        cost: cost,
        sent_at: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (messageError) {
      console.error('[Send] Error storing message:', messageError);
    }

    // Update conversation last message
    if (conversationId) {
      await supabaseAdmin
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: messagePreview,
        })
        .eq('id', conversationId);
    }

    // Track cost for billing (if not free)
    if (cost > 0) {
      await trackMessageCost(body.organizationId, category, cost);
    }

    console.log('[Send] Message sent:', whatsappMessageId);

    return NextResponse.json({
      success: true,
      messageId: message?.id,
      whatsappMessageId,
      conversationId,
    });

  } catch (error: any) {
    console.error('[Send] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}

/**
 * Normalize phone number to WhatsApp format
 */
function normalizePhone(phone: string): string {
  // Remove all non-numeric characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // Remove leading + if present (WhatsApp API doesn't want it)
  if (normalized.startsWith('+')) {
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
  
  return normalized;
}

/**
 * Validate TRAI quiet hours (9 PM - 9 AM IST)
 */
function validateQuietHours(): string | null {
  const now = new Date();
  
  // Convert to IST (UTC + 5:30)
  const istOffset = 5.5 * 60; // minutes
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const istMinutes = (utcMinutes + istOffset) % (24 * 60);
  const istHour = Math.floor(istMinutes / 60);
  
  // Quiet hours: 21:00 (9 PM) to 09:00 (9 AM)
  if (istHour >= 21 || istHour < 9) {
    return 'Cannot send marketing messages during TRAI quiet hours (9 PM - 9 AM IST). Please schedule for later.';
  }
  
  return null;
}

/**
 * Build WhatsApp API message payload
 */
function buildMessagePayload(body: SendMessageRequest, recipientPhone: string): any {
  const basePayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone,
  };

  switch (body.type) {
    case 'text':
      return {
        ...basePayload,
        type: 'text',
        text: {
          body: body.content.body,
          preview_url: true,
        },
      };

    case 'template':
      return {
        ...basePayload,
        type: 'template',
        template: {
          name: body.content.templateName,
          language: {
            code: body.content.templateLanguage || 'en',
          },
          components: body.content.templateComponents || [],
        },
      };

    case 'image':
      return {
        ...basePayload,
        type: 'image',
        image: {
          ...(body.content.mediaId 
            ? { id: body.content.mediaId }
            : { link: body.content.mediaUrl }
          ),
          caption: body.content.caption,
        },
      };

    case 'video':
      return {
        ...basePayload,
        type: 'video',
        video: {
          ...(body.content.mediaId 
            ? { id: body.content.mediaId }
            : { link: body.content.mediaUrl }
          ),
          caption: body.content.caption,
        },
      };

    case 'document':
      return {
        ...basePayload,
        type: 'document',
        document: {
          ...(body.content.mediaId 
            ? { id: body.content.mediaId }
            : { link: body.content.mediaUrl }
          ),
          caption: body.content.caption,
          filename: body.content.filename,
        },
      };

    case 'audio':
      return {
        ...basePayload,
        type: 'audio',
        audio: {
          ...(body.content.mediaId 
            ? { id: body.content.mediaId }
            : { link: body.content.mediaUrl }
          ),
        },
      };

    case 'interactive':
      return {
        ...basePayload,
        type: 'interactive',
        interactive: body.content.interactive,
      };

    default:
      throw new Error(`Unsupported message type: ${body.type}`);
  }
}

/**
 * Get message content for database storage
 */
function getMessageContent(body: SendMessageRequest): any {
  switch (body.type) {
    case 'text':
      return { body: body.content.body };
    case 'template':
      return {
        template_name: body.content.templateName,
        template_language: body.content.templateLanguage,
        components: body.content.templateComponents,
      };
    case 'image':
    case 'video':
    case 'document':
    case 'audio':
      return {
        media_url: body.content.mediaUrl || body.content.mediaId,
        caption: body.content.caption,
        filename: body.content.filename,
      };
    case 'interactive':
      return body.content.interactive;
    default:
      return body.content;
  }
}

/**
 * Get message preview for conversation list
 */
function getMessagePreview(body: SendMessageRequest): string {
  switch (body.type) {
    case 'text':
      return body.content.body?.substring(0, 100) || 'Text message';
    case 'template':
      return `📋 Template: ${body.content.templateName}`;
    case 'image':
      return body.content.caption || '📷 Image';
    case 'video':
      return body.content.caption || '🎥 Video';
    case 'document':
      return `📄 ${body.content.filename || 'Document'}`;
    case 'audio':
      return '🎵 Audio';
    case 'interactive':
      return '📱 Interactive message';
    default:
      return 'Message';
  }
}

/**
 * Track message cost for billing
 */
async function trackMessageCost(
  organizationId: string,
  category: string,
  cost: number
) {
  const today = new Date().toISOString().split('T')[0];

  // Check if usage record exists for today
  const { data: existing } = await supabaseAdmin
    .from('billing_usage')
    .select('id, total_cost')
    .eq('organization_id', organizationId)
    .eq('date', today)
    .single();

  if (existing) {
    // Update existing record
    const updateField = `${category.toLowerCase()}_count`;
    await supabaseAdmin
      .from('billing_usage')
      .update({
        [updateField]: await getFieldCount(existing.id, updateField) + 1,
        total_cost: (existing.total_cost || 0) + cost,
      })
      .eq('id', existing.id);
  } else {
    // Create new record
    const countField = `${category.toLowerCase()}_count`;
    await supabaseAdmin
      .from('billing_usage')
      .insert({
        organization_id: organizationId,
        date: today,
        [countField]: 1,
        total_cost: cost,
      });
  }

  // Deduct from wallet if applicable
  await supabaseAdmin.rpc('deduct_wallet_balance', {
    org_id: organizationId,
    amount: cost,
  }).catch(() => {
    // RPC might not exist, ignore error
  });
}

/**
 * Get current field count
 */
async function getFieldCount(usageId: string, field: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('billing_usage')
    .select(field)
    .eq('id', usageId)
    .single();
  return data?.[field] || 0;
}
