/**
 * =============================================================================
 * FILE: src/app/api/contacts/import/route.ts
 * PURPOSE: Bulk Import Contacts from CSV
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Accepts CSV file upload
 * - Parses CSV with header detection
 * - Validates and normalizes phone numbers
 * - Creates contacts in bulk
 * - Handles duplicates (skip or update)
 * - Returns detailed import summary
 * 
 * CSV FORMAT:
 * phone,name,email,tags
 * +919876543210,John Doe,john@example.com,"customer,vip"
 * 9876543211,Jane Smith,jane@example.com,lead
 * 
 * REQUIRED COLUMNS:
 * - phone (required) - Can be named: phone, mobile, number, contact
 * 
 * OPTIONAL COLUMNS:
 * - name (or: full_name, contact_name)
 * - email (or: email_address, mail)
 * - tags (comma-separated within quotes)
 * - Any other column becomes custom_fields
 * 
 * DUPLICATE HANDLING:
 * - skip: Skip existing contacts (default)
 * - update: Update existing contacts with new data
 * 
 * LIMITS:
 * - Max file size: 5MB
 * - Max contacts per import: 10,000
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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_CONTACTS = 10000;
const BATCH_SIZE = 100; // Insert in batches

// Column name mappings
const PHONE_COLUMNS = ['phone', 'mobile', 'number', 'contact', 'phone_number', 'mobile_number', 'whatsapp'];
const NAME_COLUMNS = ['name', 'full_name', 'contact_name', 'customer_name', 'fullname'];
const EMAIL_COLUMNS = ['email', 'email_address', 'mail', 'e-mail'];
const TAG_COLUMNS = ['tags', 'tag', 'labels', 'label', 'groups', 'group'];

interface ImportRow {
  phone: string;
  name?: string;
  email?: string;
  tags?: string;
  [key: string]: string | undefined;
}

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; phone: string; error: string }>;
}

/**
 * POST - Import Contacts from CSV
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const organizationId = formData.get('organizationId') as string;
    const duplicateAction = (formData.get('duplicateAction') as string) || 'skip';
    const defaultTags = formData.get('tags') as string;

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { error: 'CSV file is required' },
        { status: 400 }
      );
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json(
        { error: 'Only CSV files are accepted' },
        { status: 400 }
      );
    }

    // Read file content
    const content = await file.text();

    // Parse CSV
    let rows: ImportRow[];
    try {
      rows = parseCSV(content);
    } catch (parseError: any) {
      return NextResponse.json(
        { error: `CSV parsing error: ${parseError.message}` },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found in CSV. Ensure the file has a header row and at least one data row.' },
        { status: 400 }
      );
    }

    if (rows.length > MAX_CONTACTS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_CONTACTS.toLocaleString()} contacts per import. Your file has ${rows.length.toLocaleString()} rows.` },
        { status: 400 }
      );
    }

    // Parse default tags
    const parsedDefaultTags = defaultTags
      ? defaultTags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    // Get existing contacts for duplicate detection
    const phonesToCheck = rows
      .map(r => normalizePhone(r.phone))
      .filter(Boolean);

    const { data: existingContacts } = await supabaseAdmin
      .from('contacts')
      .select('id, phone')
      .eq('organization_id', organizationId)
      .in('phone', phonesToCheck);

    const existingByPhone = new Map(
      (existingContacts || []).map(c => [c.phone, c.id])
    );

    // Process rows
    const result: ImportResult = {
      total: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    const contactsToCreate: any[] = [];
    const contactsToUpdate: Array<{ id: string; data: any }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 for header and 0-index

      // Validate phone
      if (!row.phone || row.phone.trim() === '') {
        result.errors.push({
          row: rowNumber,
          phone: '',
          error: 'Missing phone number',
        });
        result.failed++;
        continue;
      }

      const normalizedPhone = normalizePhone(row.phone);
      if (!normalizedPhone) {
        result.errors.push({
          row: rowNumber,
          phone: row.phone,
          error: 'Invalid phone number format',
        });
        result.failed++;
        continue;
      }

      // Validate email if provided
      if (row.email && !isValidEmail(row.email)) {
        result.errors.push({
          row: rowNumber,
          phone: row.phone,
          error: 'Invalid email format',
        });
        result.failed++;
        continue;
      }

      // Parse tags
      let tags = [...parsedDefaultTags];
      if (row.tags) {
        const rowTags = row.tags
          .replace(/"/g, '') // Remove quotes
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);
        tags = [...new Set([...tags, ...rowTags])];
      }

      // Build custom fields from extra columns
      const standardFields = ['phone', 'name', 'email', 'tags'];
      const customFields: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        if (!standardFields.includes(key.toLowerCase()) && value && value.trim()) {
          customFields[key] = value.trim();
        }
      }

      // Check for duplicate
      const existingId = existingByPhone.get(normalizedPhone);

      if (existingId) {
        if (duplicateAction === 'update') {
          contactsToUpdate.push({
            id: existingId,
            data: {
              name: row.name?.trim() || undefined,
              email: row.email?.trim().toLowerCase() || undefined,
              tags: tags.length > 0 ? tags : undefined,
              custom_fields: Object.keys(customFields).length > 0 ? customFields : undefined,
              updated_at: new Date().toISOString(),
            },
          });
        } else {
          result.skipped++;
        }
      } else {
        contactsToCreate.push({
          organization_id: organizationId,
          phone: normalizedPhone,
          name: row.name?.trim() || normalizedPhone,
          email: row.email?.trim().toLowerCase() || null,
          tags,
          custom_fields: Object.keys(customFields).length > 0 ? customFields : {},
          source: 'IMPORT',
          opted_out: false,
        });
      }
    }

    // Batch insert new contacts
    if (contactsToCreate.length > 0) {
      for (let i = 0; i < contactsToCreate.length; i += BATCH_SIZE) {
        const batch = contactsToCreate.slice(i, i + BATCH_SIZE);
        const { error } = await supabaseAdmin
          .from('contacts')
          .insert(batch);

        if (error) {
          console.error('[Import] Batch insert error:', error);
          // Count these as failed
          result.failed += batch.length;
        } else {
          result.created += batch.length;
        }
      }
    }

    // Update existing contacts
    for (const update of contactsToUpdate) {
      // Remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(update.data).filter(([_, v]) => v !== undefined)
      );

      if (Object.keys(cleanData).length > 1) { // More than just updated_at
        const { error } = await supabaseAdmin
          .from('contacts')
          .update(cleanData)
          .eq('id', update.id);

        if (error) {
          console.error('[Import] Update error:', error);
          result.failed++;
        } else {
          result.updated++;
        }
      } else {
        result.skipped++;
      }
    }

    // Limit errors in response
    if (result.errors.length > 50) {
      result.errors = result.errors.slice(0, 50);
    }

    console.log('[Import] Completed:', result);

    return NextResponse.json({
      success: true,
      result,
    });

  } catch (error: any) {
    console.error('[Import] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import contacts' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get Import Template
 */
export async function GET(request: NextRequest) {
  const template = `phone,name,email,tags
+919876543210,John Doe,john@example.com,"customer,vip"
+919876543211,Jane Smith,jane@example.com,lead
+919876543212,Bob Wilson,bob@example.com,"prospect,mumbai"`;

  return new NextResponse(template, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="contacts_template.csv"',
    },
  });
}

/**
 * Parse CSV content into rows
 */
function parseCSV(content: string): ImportRow[] {
  // Split into lines and filter empty
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim());

  // Find phone column
  const phoneIndex = headers.findIndex(h => PHONE_COLUMNS.includes(h));
  if (phoneIndex === -1) {
    throw new Error(`CSV must have a phone column. Accepted names: ${PHONE_COLUMNS.join(', ')}`);
  }

  // Find other standard columns
  const nameIndex = headers.findIndex(h => NAME_COLUMNS.includes(h));
  const emailIndex = headers.findIndex(h => EMAIL_COLUMNS.includes(h));
  const tagsIndex = headers.findIndex(h => TAG_COLUMNS.includes(h));

  // Parse data rows
  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    // Skip empty rows
    if (values.every(v => !v || !v.trim())) continue;

    const row: ImportRow = {
      phone: values[phoneIndex]?.trim() || '',
    };

    if (nameIndex !== -1) row.name = values[nameIndex]?.trim();
    if (emailIndex !== -1) row.email = values[emailIndex]?.trim();
    if (tagsIndex !== -1) row.tags = values[tagsIndex]?.trim();

    // Add custom fields
    headers.forEach((header, index) => {
      if (
        index !== phoneIndex &&
        index !== nameIndex &&
        index !== emailIndex &&
        index !== tagsIndex &&
        values[index]?.trim()
      ) {
        row[header] = values[index].trim();
      }
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line (handles quoted fields with commas)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Don't forget the last field
  result.push(current.trim());

  return result;
}

/**
 * Normalize phone number
 */
function normalizePhone(phone: string): string {
  if (!phone) return '';

  // Remove all non-numeric characters except +
  let normalized = phone.replace(/[^\d+]/g, '');

  // Remove leading +
  const hasPlus = normalized.startsWith('+');
  if (hasPlus) {
    normalized = normalized.substring(1);
  }

  // If starts with 0, assume Indian - replace with 91
  if (normalized.startsWith('0')) {
    normalized = '91' + normalized.substring(1);
  }

  // If 10 digits, assume Indian - add 91
  if (normalized.length === 10) {
    normalized = '91' + normalized;
  }

  // Validate minimum length
  if (normalized.length < 10) {
    return '';
  }

  return '+' + normalized;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  if (!email) return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}
