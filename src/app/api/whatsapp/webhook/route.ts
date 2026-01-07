/**
 * =============================================================================
 * FILE: src/app/api/whatsapp/webhook/route.ts
 * PURPOSE: WhatsApp Cloud API Webhook Handler
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Handles webhook verification (GET request from Meta)
 * - Receives incoming messages from WhatsApp users
 * - Receives message status updates (sent, delivered, read)
 * - Processes webhook events and stores in database
 * 
 * WEBHOOK EVENTS HANDLED:
 * - messages: Incoming text, image, document, audio, video, location, contacts
 * - statuses: sent, delivered, read, failed
 * 
 * META WEBHOOK SETUP:
 * 1. Go to Meta App Dashboard > WhatsApp > Configuration
 * 2. Set Webhook URL: https://interface.techsoftwares.in/api/whatsapp/webhook
 * 3. Set Verify Token: Your WHATSAPP_WEBHOOK_VERIFY_TOKEN
 * 4. Subscribe to: messages, message_status
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/admin
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase Admin Client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Environment variables
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.META_APP_SECRET;

/**
 * GET - Webhook Verification
 * Meta sends this to verify the webhook URL
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Check if mode and token are correct
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] Verified successfully');
    return new NextResponse(challenge, { status: 200 });
  }

  console.error('[Webhook] Verification failed');
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST - Webhook Events
 * Receives all WhatsApp events (messages, status updates)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    // Verify signature (recommended for production)
    if (APP_SECRET) {
      const signature = request.headers.get('x-hub-signature-256');
      if (!verifySignature(body, signature)) {
        console.error('[Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const data = JSON.parse(body);

    // Process webhook payload
    if (data.object === 'whatsapp_business_account') {
      for (const entry of data.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            await processMessagesWebhook(change.value);
          }
        }
      }
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    // Still return 200 to prevent retries
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

/**
 * Verify webhook signature
 */
function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature || !APP_SECRET) return true; // Skip if no secret configured
  
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', APP_SECRET)
    .update(payload)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Process messages webhook payload
 */
async function processMessagesWebhook(value: any) {
  const { metadata, contacts, messages, statuses } = value;
  const phoneNumberId = metadata?.phone_number_id;

  // Find organization by phone number ID
  const { data: whatsappAccount } = await supabaseAdmin
    .from('whatsapp_accounts')
    .select('organization_id')
    .eq('phone_number_id', phoneNumberId)
    .single();

  if (!whatsappAccount) {
    console.error('[Webhook] Unknown phone number ID:', phoneNumberId);
    return;
  }

  const organizationId = whatsappAccount.organization_id;

  // Process incoming messages
  if (messages && messages.length > 0) {
    for (const message of messages) {
      await processIncomingMessage(organizationId, message, contacts);
    }
  }

  // Process status updates
  if (statuses && statuses.length > 0) {
    for (const status of statuses) {
      await processStatusUpdate(status);
    }
  }
}

/**
 * Process incoming message
 */
async function processIncomingMessage(
  organizationId: string,
  message: any,
  contacts: any[]
) {
  const senderPhone = message.from;
  const contactInfo = contacts?.find((c: any) => c.wa_id === senderPhone);
  const contactName = contactInfo?.profile?.name || senderPhone;

  // Find or create contact
  let { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('phone', senderPhone)
    .single();

  if (!contact) {
    const { data: newContact } = await supabaseAdmin
      .from('contacts')
      .insert({
        organization_id: organizationId,
        phone: senderPhone,
        name: contactName,
        source: 'WHATSAPP',
      })
      .select('id')
      .single();
    contact = newContact;
  } else if (contactName !== senderPhone) {
    // Update name if we got it from WhatsApp
    await supabaseAdmin
      .from('contacts')
      .update({ name: contactName })
      .eq('id', contact.id);
  }

  if (!contact) {
    console.error('[Webhook] Failed to find/create contact');
    return;
  }

  // Find or create conversation
  let { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('contact_id', contact.id)
    .eq('status', 'OPEN')
    .single();

  if (!conversation) {
    const { data: newConversation } = await supabaseAdmin
      .from('conversations')
      .insert({
        organization_id: organizationId,
        contact_id: contact.id,
        status: 'OPEN',
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    conversation = newConversation;
  }

  if (!conversation) {
    console.error('[Webhook] Failed to find/create conversation');
    return;
  }

  // Parse message content based on type
  const messageData = parseMessageContent(message);

  // Store message
  await supabaseAdmin.from('messages').insert({
    organization_id: organizationId,
    conversation_id: conversation.id,
    contact_id: contact.id,
    whatsapp_message_id: message.id,
    direction: 'INBOUND',
    type: messageData.type,
    content: messageData.content,
    media_url: messageData.mediaUrl,
    status: 'RECEIVED',
    timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
  });

  // Update conversation last message
  await supabaseAdmin
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: messageData.preview,
      unread_count: await getUnreadCount(conversation.id) + 1,
    })
    .eq('id', conversation.id);

  console.log('[Webhook] Message stored:', message.id);
}

/**
 * Parse message content based on type
 */
function parseMessageContent(message: any): {
  type: string;
  content: any;
  mediaUrl?: string;
  preview: string;
} {
  const type = message.type;

  switch (type) {
    case 'text':
      return {
        type: 'TEXT',
        content: { body: message.text.body },
        preview: message.text.body.substring(0, 100),
      };

    case 'image':
      return {
        type: 'IMAGE',
        content: { 
          caption: message.image.caption,
          mime_type: message.image.mime_type,
        },
        mediaUrl: message.image.id,
        preview: message.image.caption || '📷 Image',
      };

    case 'video':
      return {
        type: 'VIDEO',
        content: { 
          caption: message.video.caption,
          mime_type: message.video.mime_type,
        },
        mediaUrl: message.video.id,
        preview: message.video.caption || '🎥 Video',
      };

    case 'audio':
      return {
        type: 'AUDIO',
        content: { mime_type: message.audio.mime_type },
        mediaUrl: message.audio.id,
        preview: '🎵 Audio',
      };

    case 'document':
      return {
        type: 'DOCUMENT',
        content: { 
          filename: message.document.filename,
          mime_type: message.document.mime_type,
        },
        mediaUrl: message.document.id,
        preview: `📄 ${message.document.filename}`,
      };

    case 'location':
      return {
        type: 'LOCATION',
        content: {
          latitude: message.location.latitude,
          longitude: message.location.longitude,
          name: message.location.name,
          address: message.location.address,
        },
        preview: `📍 ${message.location.name || 'Location'}`,
      };

    case 'contacts':
      return {
        type: 'CONTACTS',
        content: { contacts: message.contacts },
        preview: '👤 Contact shared',
      };

    case 'button':
      return {
        type: 'BUTTON_REPLY',
        content: { 
          button_id: message.button.payload,
          button_text: message.button.text,
        },
        preview: message.button.text,
      };

    case 'interactive':
      if (message.interactive.type === 'button_reply') {
        return {
          type: 'BUTTON_REPLY',
          content: {
            button_id: message.interactive.button_reply.id,
            button_text: message.interactive.button_reply.title,
          },
          preview: message.interactive.button_reply.title,
        };
      } else if (message.interactive.type === 'list_reply') {
        return {
          type: 'LIST_REPLY',
          content: {
            list_id: message.interactive.list_reply.id,
            list_title: message.interactive.list_reply.title,
          },
          preview: message.interactive.list_reply.title,
        };
      }
      return {
        type: 'INTERACTIVE',
        content: message.interactive,
        preview: 'Interactive message',
      };

    default:
      return {
        type: 'UNKNOWN',
        content: message,
        preview: 'Unknown message type',
      };
  }
}

/**
 * Process status update
 */
async function processStatusUpdate(status: any) {
  const { id: messageId, status: messageStatus, timestamp, errors } = status;

  // Map WhatsApp status to our status
  const statusMap: Record<string, string> = {
    sent: 'SENT',
    delivered: 'DELIVERED',
    read: 'READ',
    failed: 'FAILED',
  };

  const mappedStatus = statusMap[messageStatus];
  if (!mappedStatus) return;

  // Build update data
  const updateData: any = { status: mappedStatus };

  if (messageStatus === 'sent') {
    updateData.sent_at = new Date(parseInt(timestamp) * 1000).toISOString();
  } else if (messageStatus === 'delivered') {
    updateData.delivered_at = new Date(parseInt(timestamp) * 1000).toISOString();
  } else if (messageStatus === 'read') {
    updateData.read_at = new Date(parseInt(timestamp) * 1000).toISOString();
  } else if (messageStatus === 'failed' && errors) {
    updateData.error_message = errors[0]?.title || 'Message failed';
    updateData.error_code = errors[0]?.code;
  }

  // Update message status
  const { error } = await supabaseAdmin
    .from('messages')
    .update(updateData)
    .eq('whatsapp_message_id', messageId);

  if (!error) {
    console.log('[Webhook] Status updated:', messageId, mappedStatus);
  }

  // If campaign message, update campaign stats
  const { data: message } = await supabaseAdmin
    .from('messages')
    .select('campaign_id')
    .eq('whatsapp_message_id', messageId)
    .single();

  if (message?.campaign_id) {
    await updateCampaignStats(message.campaign_id, messageStatus);
  }
}

/**
 * Update campaign statistics
 */
async function updateCampaignStats(campaignId: string, status: string) {
  const fieldMap: Record<string, string> = {
    delivered: 'delivered_count',
    read: 'read_count',
    failed: 'failed_count',
  };

  const field = fieldMap[status];
  if (!field) return;

  // Get current count and increment
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select(field)
    .eq('id', campaignId)
    .single();

  if (campaign) {
    await supabaseAdmin
      .from('campaigns')
      .update({ [field]: (campaign[field] || 0) + 1 })
      .eq('id', campaignId);
  }
}

/**
 * Get unread count for conversation
 */
async function getUnreadCount(conversationId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('conversations')
    .select('unread_count')
    .eq('id', conversationId)
    .single();
  return data?.unread_count || 0;
}
