/**
 * =============================================================================
 * FILE: src/app/api/templates/route.ts
 * PURPOSE: WhatsApp Message Templates Management API
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Lists all templates for an organization
 * - Creates new templates (submits to Meta for approval)
 * - Updates existing templates
 * - Deletes templates
 * - Syncs template status from Meta
 * 
 * TEMPLATE CATEGORIES:
 * - MARKETING: Promotional messages (₹0.82/msg)
 * - UTILITY: Order updates, alerts (₹0.33/conv)
 * - AUTHENTICATION: OTP, verification (₹0.33/conv)
 * 
 * TEMPLATE STATUS:
 * - DRAFT: Not submitted to Meta
 * - PENDING: Submitted, awaiting approval
 * - APPROVED: Ready to use
 * - REJECTED: Rejected by Meta
 * - DISABLED: Disabled by user
 * 
 * TEMPLATE COMPONENTS:
 * - HEADER: Text, Image, Video, or Document
 * - BODY: Main message text with variables {{1}}, {{2}}, etc.
 * - FOOTER: Optional footer text
 * - BUTTONS: Quick Reply, URL, or Phone buttons
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/admin
 * - WhatsApp Business Management API
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

/**
 * GET - List Templates
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sync = searchParams.get('sync'); // If 'true', sync from Meta first

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Sync from Meta if requested
    if (sync === 'true') {
      await syncTemplatesFromMeta(organizationId);
    }

    // Build query
    let query = supabaseAdmin
      .from('templates')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status.toUpperCase());
    }

    if (category) {
      query = query.eq('category', category.toUpperCase());
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Templates] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: data || [] });

  } catch (error: any) {
    console.error('[Templates] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create Template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      organizationId,
      name,
      category,
      language,
      content,
      submitToMeta = false,
    } = body;

    // Validate required fields
    if (!organizationId || !name || !category || !content) {
      return NextResponse.json(
        { error: 'Organization ID, name, category, and content are required' },
        { status: 400 }
      );
    }

    // Validate template name format (lowercase, underscores, numbers only)
    const templateNameRegex = /^[a-z][a-z0-9_]*$/;
    if (!templateNameRegex.test(name)) {
      return NextResponse.json(
        { error: 'Template name must start with a letter and contain only lowercase letters, numbers, and underscores' },
        { status: 400 }
      );
    }

    // Validate name length (1-512 characters)
    if (name.length > 512) {
      return NextResponse.json(
        { error: 'Template name must be 512 characters or less' },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
    if (!validCategories.includes(category.toUpperCase())) {
      return NextResponse.json(
        { error: 'Category must be MARKETING, UTILITY, or AUTHENTICATION' },
        { status: 400 }
      );
    }

    // Validate body exists
    if (!content.body || content.body.trim().length === 0) {
      return NextResponse.json(
        { error: 'Template body is required' },
        { status: 400 }
      );
    }

    // Check for duplicate name in organization
    const { data: existing } = await supabaseAdmin
      .from('templates')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('name', name)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A template with this name already exists' },
        { status: 400 }
      );
    }

    // Create template in database
    const { data: template, error: dbError } = await supabaseAdmin
      .from('templates')
      .insert({
        organization_id: organizationId,
        name,
        category: category.toUpperCase(),
        language: language || 'en',
        content,
        status: submitToMeta ? 'PENDING' : 'DRAFT',
      })
      .select()
      .single();

    if (dbError) {
      console.error('[Templates] Insert error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // Submit to Meta if requested
    if (submitToMeta) {
      const submitResult = await submitTemplateToMeta(organizationId, template);
      
      if (submitResult.error) {
        // Update status to DRAFT if submission failed
        await supabaseAdmin
          .from('templates')
          .update({ 
            status: 'DRAFT',
            rejection_reason: submitResult.error,
          })
          .eq('id', template.id);

        return NextResponse.json({
          template: { ...template, status: 'DRAFT' },
          warning: `Template saved but Meta submission failed: ${submitResult.error}`,
        }, { status: 201 });
      }

      // Update with Meta template ID
      await supabaseAdmin
        .from('templates')
        .update({ meta_template_id: submitResult.templateId })
        .eq('id', template.id);

      template.meta_template_id = submitResult.templateId;
    }

    console.log('[Templates] Created:', template.id);
    return NextResponse.json({ template }, { status: 201 });

  } catch (error: any) {
    console.error('[Templates] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update Template
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, organizationId, content, submitToMeta } = body;

    if (!templateId || !organizationId) {
      return NextResponse.json(
        { error: 'Template ID and organization ID are required' },
        { status: 400 }
      );
    }

    // Get current template
    const { data: template, error: fetchError } = await supabaseAdmin
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Can only edit DRAFT or REJECTED templates
    if (content && !['DRAFT', 'REJECTED'].includes(template.status)) {
      return NextResponse.json(
        { error: 'Cannot edit templates that are pending or approved. Create a new version instead.' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (content) {
      updateData.content = content;
      updateData.rejection_reason = null; // Clear previous rejection
    }

    // Submit to Meta if requested
    if (submitToMeta) {
      updateData.status = 'PENDING';
      
      const submitResult = await submitTemplateToMeta(organizationId, {
        ...template,
        content: content || template.content,
      });

      if (submitResult.error) {
        updateData.status = 'DRAFT';
        updateData.rejection_reason = submitResult.error;
      } else {
        updateData.meta_template_id = submitResult.templateId;
      }
    }

    // Update template
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('templates')
      .update(updateData)
      .eq('id', templateId)
      .select()
      .single();

    if (updateError) {
      console.error('[Templates] Update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log('[Templates] Updated:', templateId);
    return NextResponse.json({ template: updated });

  } catch (error: any) {
    console.error('[Templates] PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete Template
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const templateId = searchParams.get('templateId');
    const organizationId = searchParams.get('organizationId');

    if (!templateId || !organizationId) {
      return NextResponse.json(
        { error: 'Template ID and organization ID are required' },
        { status: 400 }
      );
    }

    // Get template
    const { data: template, error: fetchError } = await supabaseAdmin
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Delete from Meta if it exists there
    if (template.meta_template_id || template.status === 'APPROVED') {
      await deleteTemplateFromMeta(organizationId, template.name);
    }

    // Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from('templates')
      .delete()
      .eq('id', templateId);

    if (deleteError) {
      console.error('[Templates] Delete error:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log('[Templates] Deleted:', templateId);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[Templates] DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    );
  }
}

/**
 * Submit template to Meta for approval
 */
async function submitTemplateToMeta(
  organizationId: string,
  template: any
): Promise<{ templateId?: string; error?: string }> {
  try {
    // Get WhatsApp Business Account
    const { data: whatsappAccount } = await supabaseAdmin
      .from('whatsapp_accounts')
      .select('waba_id, access_token')
      .eq('organization_id', organizationId)
      .single();

    if (!whatsappAccount) {
      return { error: 'WhatsApp account not configured' };
    }

    // Build Meta API components
    const components = buildMetaComponents(template.content);

    // Submit to Meta
    const response = await fetch(
      `${WHATSAPP_API_URL}/${whatsappAccount.waba_id}/message_templates`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappAccount.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: template.name,
          category: template.category,
          language: template.language || 'en',
          components,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[Templates] Meta API error:', result);
      return { error: result.error?.message || 'Meta API error' };
    }

    return { templateId: result.id };

  } catch (error: any) {
    console.error('[Templates] Submit error:', error);
    return { error: error.message };
  }
}

/**
 * Build Meta template components from our format
 */
function buildMetaComponents(content: any): any[] {
  const components: any[] = [];

  // Header component
  if (content.header) {
    const headerComponent: any = {
      type: 'HEADER',
      format: (content.header.type || 'TEXT').toUpperCase(),
    };

    if (content.header.type === 'text' || !content.header.type) {
      headerComponent.text = content.header.text;
    } else if (['image', 'video', 'document'].includes(content.header.type)) {
      // Media headers need example handles during submission
      if (content.header.example) {
        headerComponent.example = {
          header_handle: [content.header.example],
        };
      }
    }

    components.push(headerComponent);
  }

  // Body component (required)
  const bodyComponent: any = {
    type: 'BODY',
    text: content.body,
  };

  // Extract variables and add examples
  const variables = content.body.match(/\{\{\d+\}\}/g) || [];
  if (variables.length > 0) {
    bodyComponent.example = {
      body_text: [variables.map((_: string, i: number) => content.bodyExamples?.[i] || `Sample ${i + 1}`)],
    };
  }

  components.push(bodyComponent);

  // Footer component
  if (content.footer) {
    components.push({
      type: 'FOOTER',
      text: content.footer,
    });
  }

  // Buttons component
  if (content.buttons && content.buttons.length > 0) {
    const buttons = content.buttons.map((btn: any) => {
      switch (btn.type) {
        case 'QUICK_REPLY':
          return {
            type: 'QUICK_REPLY',
            text: btn.text,
          };
        case 'URL':
          return {
            type: 'URL',
            text: btn.text,
            url: btn.url,
            example: btn.urlExample ? [btn.urlExample] : undefined,
          };
        case 'PHONE_NUMBER':
          return {
            type: 'PHONE_NUMBER',
            text: btn.text,
            phone_number: btn.phone,
          };
        case 'COPY_CODE':
          return {
            type: 'COPY_CODE',
            example: btn.example || 'SAMPLE123',
          };
        default:
          return btn;
      }
    });

    components.push({
      type: 'BUTTONS',
      buttons,
    });
  }

  return components;
}

/**
 * Delete template from Meta
 */
async function deleteTemplateFromMeta(
  organizationId: string,
  templateName: string
): Promise<void> {
  try {
    const { data: whatsappAccount } = await supabaseAdmin
      .from('whatsapp_accounts')
      .select('waba_id, access_token')
      .eq('organization_id', organizationId)
      .single();

    if (!whatsappAccount) return;

    await fetch(
      `${WHATSAPP_API_URL}/${whatsappAccount.waba_id}/message_templates?name=${templateName}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${whatsappAccount.access_token}`,
        },
      }
    );

    console.log('[Templates] Deleted from Meta:', templateName);

  } catch (error) {
    console.error('[Templates] Meta delete error:', error);
  }
}

/**
 * Sync templates from Meta
 */
async function syncTemplatesFromMeta(organizationId: string): Promise<void> {
  try {
    // Get WhatsApp Business Account
    const { data: whatsappAccount } = await supabaseAdmin
      .from('whatsapp_accounts')
      .select('waba_id, access_token')
      .eq('organization_id', organizationId)
      .single();

    if (!whatsappAccount) return;

    // Fetch templates from Meta
    const response = await fetch(
      `${WHATSAPP_API_URL}/${whatsappAccount.waba_id}/message_templates?limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${whatsappAccount.access_token}`,
        },
      }
    );

    if (!response.ok) return;

    const result = await response.json();
    const metaTemplates = result.data || [];

    // Get local templates
    const { data: localTemplates } = await supabaseAdmin
      .from('templates')
      .select('id, name, status')
      .eq('organization_id', organizationId);

    const localByName = new Map(
      (localTemplates || []).map(t => [t.name, t])
    );

    // Update local templates with Meta status
    for (const metaTemplate of metaTemplates) {
      const local = localByName.get(metaTemplate.name);
      const metaStatus = mapMetaStatus(metaTemplate.status);

      if (local) {
        // Update existing
        if (local.status !== metaStatus) {
          await supabaseAdmin
            .from('templates')
            .update({
              status: metaStatus,
              meta_template_id: metaTemplate.id,
              quality_score: metaTemplate.quality_score?.score,
              rejection_reason: metaTemplate.rejected_reason,
              updated_at: new Date().toISOString(),
            })
            .eq('id', local.id);
        }
      } else {
        // Create new (template created directly in Meta)
        await supabaseAdmin
          .from('templates')
          .insert({
            organization_id: organizationId,
            name: metaTemplate.name,
            category: metaTemplate.category,
            language: metaTemplate.language,
            content: parseMetaComponents(metaTemplate.components),
            status: metaStatus,
            meta_template_id: metaTemplate.id,
            quality_score: metaTemplate.quality_score?.score,
          });
      }
    }

    console.log('[Templates] Synced from Meta:', metaTemplates.length);

  } catch (error) {
    console.error('[Templates] Sync error:', error);
  }
}

/**
 * Map Meta status to our status
 */
function mapMetaStatus(metaStatus: string): string {
  const statusMap: Record<string, string> = {
    APPROVED: 'APPROVED',
    PENDING: 'PENDING',
    REJECTED: 'REJECTED',
    PENDING_DELETION: 'DISABLED',
    DELETED: 'DISABLED',
    DISABLED: 'DISABLED',
    IN_APPEAL: 'PENDING',
    PAUSED: 'DISABLED',
  };
  return statusMap[metaStatus] || 'PENDING';
}

/**
 * Parse Meta template components into our format
 */
function parseMetaComponents(components: any[]): any {
  const content: any = {};

  for (const component of components || []) {
    switch (component.type) {
      case 'HEADER':
        content.header = {
          type: (component.format || 'TEXT').toLowerCase(),
          text: component.text,
        };
        break;

      case 'BODY':
        content.body = component.text;
        break;

      case 'FOOTER':
        content.footer = component.text;
        break;

      case 'BUTTONS':
        content.buttons = (component.buttons || []).map((btn: any) => ({
          type: btn.type,
          text: btn.text,
          url: btn.url,
          phone: btn.phone_number,
        }));
        break;
    }
  }

  return content;
}
