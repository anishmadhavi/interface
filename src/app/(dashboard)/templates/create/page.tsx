/**
 * =============================================================================
 * FILE: src/app/(dashboard)/templates/create/page.tsx
 * PURPOSE: Create New Message Template
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Provides form to create new WhatsApp message template
 * - Supports all template components (header, body, footer, buttons)
 * - Shows real-time preview in WhatsApp style
 * - Validates template against Meta requirements
 * - Submits template to Meta for approval
 * - Handles variable placeholders {{1}}, {{2}}, etc.
 * 
 * KEY FEATURES:
 * - Category selection (marketing, utility, authentication)
 * - Language selection
 * - Header options (text, image, document, video)
 * - Body with variable placeholders
 * - Footer (optional)
 * - Buttons (quick reply, call to action)
 * - Live preview
 * - Variable sample values
 * 
 * TEMPLATE LIMITS:
 * - Header text: 60 characters
 * - Body: 1024 characters
 * - Footer: 60 characters
 * - Buttons: max 3
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data saving)
 * =============================================================================
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Image,
  FileText,
  Video,
  Type,
  Loader2,
  AlertCircle,
  ExternalLink,
  Phone as PhoneIcon
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type HeaderType = 'NONE' | 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO';
type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

interface TemplateButton {
  type: ButtonType;
  text: string;
  url?: string;
  phoneNumber?: string;
}

interface TemplateForm {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  headerType: HeaderType;
  headerText: string;
  body: string;
  footer: string;
  buttons: TemplateButton[];
  sampleValues: string[];
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'en_US', name: 'English (US)' },
  { code: 'hi', name: 'Hindi' },
  { code: 'mr', name: 'Marathi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'bn', name: 'Bengali' },
  { code: 'gu', name: 'Gujarati' },
];

const HEADER_TYPES = [
  { type: 'NONE', label: 'None', icon: null },
  { type: 'TEXT', label: 'Text', icon: Type },
  { type: 'IMAGE', label: 'Image', icon: Image },
  { type: 'DOCUMENT', label: 'Document', icon: FileText },
  { type: 'VIDEO', label: 'Video', icon: Video },
];

export default function CreateTemplatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<TemplateForm>({
    name: '',
    category: 'MARKETING',
    language: 'en',
    headerType: 'NONE',
    headerText: '',
    body: '',
    footer: '',
    buttons: [],
    sampleValues: [],
  });

  // Extract variables from body text
  const extractVariables = (text: string): number => {
    const matches = text.match(/\{\{\d+\}\}/g);
    return matches ? matches.length : 0;
  };

  const variableCount = extractVariables(form.body);

  // Update sample values array when variables change
  const handleBodyChange = (text: string) => {
    const count = extractVariables(text);
    const newSamples = [...form.sampleValues];
    
    while (newSamples.length < count) {
      newSamples.push('');
    }
    while (newSamples.length > count) {
      newSamples.pop();
    }
    
    setForm({ ...form, body: text, sampleValues: newSamples });
  };

  const addButton = () => {
    if (form.buttons.length >= 3) return;
    setForm({
      ...form,
      buttons: [...form.buttons, { type: 'QUICK_REPLY', text: '' }],
    });
  };

  const updateButton = (index: number, updates: Partial<TemplateButton>) => {
    const newButtons = [...form.buttons];
    newButtons[index] = { ...newButtons[index], ...updates };
    setForm({ ...form, buttons: newButtons });
  };

  const removeButton = (index: number) => {
    setForm({
      ...form,
      buttons: form.buttons.filter((_, i) => i !== index),
    });
  };

  const validateForm = (): boolean => {
    if (!form.name.trim()) {
      setError('Template name is required');
      return false;
    }
    if (!/^[a-z0-9_]+$/.test(form.name)) {
      setError('Template name can only contain lowercase letters, numbers, and underscores');
      return false;
    }
    if (!form.body.trim()) {
      setError('Message body is required');
      return false;
    }
    if (form.body.length > 1024) {
      setError('Message body cannot exceed 1024 characters');
      return false;
    }
    if (form.headerType === 'TEXT' && form.headerText.length > 60) {
      setError('Header text cannot exceed 60 characters');
      return false;
    }
    if (form.footer.length > 60) {
      setError('Footer cannot exceed 60 characters');
      return false;
    }
    
    // Validate sample values
    if (variableCount > 0) {
      for (let i = 0; i < variableCount; i++) {
        if (!form.sampleValues[i]?.trim()) {
          setError(`Sample value for variable {{${i + 1}}} is required`);
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    setError(null);
    if (!validateForm()) return;

    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('Not authenticated');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) {
        setError('Organization not found');
        return;
      }

      // Build template content
      const content: any = {
        body: form.body,
      };

      if (form.headerType !== 'NONE') {
        content.header = {
          type: form.headerType,
          text: form.headerType === 'TEXT' ? form.headerText : undefined,
        };
      }

      if (form.footer) {
        content.footer = form.footer;
      }

      if (form.buttons.length > 0) {
        content.buttons = form.buttons;
      }

      // Save to database
      const { data: template, error: dbError } = await supabase
        .from('templates')
        .insert({
          organization_id: userData.organization_id,
          name: form.name,
          category: form.category,
          language: form.language,
          status: 'PENDING',
          content,
          sample_values: form.sampleValues,
        })
        .select()
        .single();

      if (dbError) {
        setError(dbError.message);
        return;
      }

      // Submit to Meta API
      const response = await fetch('/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          name: form.name,
          category: form.category,
          language: form.language,
          components: buildMetaComponents(),
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        // Template saved locally but not submitted to Meta
        console.warn('Meta submission failed:', result.error);
      }

      router.push('/templates');
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const buildMetaComponents = () => {
    const components: any[] = [];

    if (form.headerType !== 'NONE') {
      components.push({
        type: 'HEADER',
        format: form.headerType,
        text: form.headerType === 'TEXT' ? form.headerText : undefined,
      });
    }

    components.push({
      type: 'BODY',
      text: form.body,
      example: variableCount > 0 ? {
        body_text: [form.sampleValues],
      } : undefined,
    });

    if (form.footer) {
      components.push({
        type: 'FOOTER',
        text: form.footer,
      });
    }

    if (form.buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: form.buttons.map(btn => ({
          type: btn.type,
          text: btn.text,
          url: btn.url,
          phone_number: btn.phoneNumber,
        })),
      });
    }

    return components;
  };

  // Replace variables with sample values for preview
  const getPreviewBody = () => {
    let preview = form.body;
    form.sampleValues.forEach((value, i) => {
      preview = preview.replace(`{{${i + 1}}}`, value || `{{${i + 1}}}`);
    });
    return preview;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/templates">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Template</h1>
          <p className="text-gray-500">Build a new message template for WhatsApp</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., order_confirmation"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lowercase letters, numbers, and underscores only
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category *</Label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as any })}
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="MARKETING">Marketing</option>
                    <option value="UTILITY">Utility</option>
                    <option value="AUTHENTICATION">Authentication</option>
                  </select>
                </div>
                <div>
                  <Label>Language *</Label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Header */}
          <Card>
            <CardHeader>
              <CardTitle>Header (Optional)</CardTitle>
              <CardDescription>Add a header to your message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                {HEADER_TYPES.map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    onClick={() => setForm({ ...form, headerType: type as HeaderType })}
                    className={cn(
                      'flex items-center px-3 py-2 rounded-md text-sm border transition-colors',
                      form.headerType === type
                        ? 'bg-whatsapp text-white border-whatsapp'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4 mr-1" />}
                    {label}
                  </button>
                ))}
              </div>

              {form.headerType === 'TEXT' && (
                <div>
                  <Label>Header Text</Label>
                  <Input
                    value={form.headerText}
                    onChange={(e) => setForm({ ...form, headerText: e.target.value })}
                    maxLength={60}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {form.headerText.length}/60 characters
                  </p>
                </div>
              )}

              {['IMAGE', 'DOCUMENT', 'VIDEO'].includes(form.headerType) && (
                <p className="text-sm text-gray-500">
                  Media will be uploaded when sending the template message.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Body */}
          <Card>
            <CardHeader>
              <CardTitle>Message Body *</CardTitle>
              <CardDescription>
                Use {'{{1}}'}, {'{{2}}'}, etc. for dynamic variables
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Textarea
                  value={form.body}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  placeholder="Hello {{1}}, your order #{{2}} has been confirmed!"
                  rows={4}
                  maxLength={1024}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {form.body.length}/1024 characters
                </p>
              </div>

              {/* Sample Values */}
              {variableCount > 0 && (
                <div className="space-y-2">
                  <Label>Sample Values (Required for approval)</Label>
                  {form.sampleValues.map((value, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500 w-12">{`{{${i + 1}}}`}</span>
                      <Input
                        value={value}
                        onChange={(e) => {
                          const newValues = [...form.sampleValues];
                          newValues[i] = e.target.value;
                          setForm({ ...form, sampleValues: newValues });
                        }}
                        placeholder={`Sample for {{${i + 1}}}`}
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <Card>
            <CardHeader>
              <CardTitle>Footer (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={form.footer}
                onChange={(e) => setForm({ ...form, footer: e.target.value })}
                placeholder="Reply STOP to unsubscribe"
                maxLength={60}
              />
              <p className="text-xs text-gray-500 mt-1">
                {form.footer.length}/60 characters
              </p>
            </CardContent>
          </Card>

          {/* Buttons */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Buttons (Optional)</CardTitle>
                  <CardDescription>Add up to 3 buttons</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addButton}
                  disabled={form.buttons.length >= 3}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Button
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {form.buttons.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No buttons added
                </p>
              ) : (
                <div className="space-y-4">
                  {form.buttons.map((button, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Button {index + 1}</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeButton(index)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <select
                        value={button.type}
                        onChange={(e) => updateButton(index, { type: e.target.value as ButtonType })}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="QUICK_REPLY">Quick Reply</option>
                        <option value="URL">Website URL</option>
                        <option value="PHONE_NUMBER">Phone Number</option>
                      </select>

                      <Input
                        value={button.text}
                        onChange={(e) => updateButton(index, { text: e.target.value })}
                        placeholder="Button text"
                        maxLength={25}
                      />

                      {button.type === 'URL' && (
                        <Input
                          value={button.url || ''}
                          onChange={(e) => updateButton(index, { url: e.target.value })}
                          placeholder="https://example.com"
                        />
                      )}

                      {button.type === 'PHONE_NUMBER' && (
                        <Input
                          value={button.phoneNumber || ''}
                          onChange={(e) => updateButton(index, { phoneNumber: e.target.value })}
                          placeholder="+919876543210"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" asChild>
              <Link href="/templates">Cancel</Link>
            </Button>
            <Button variant="whatsapp" onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit for Approval
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-6 h-fit">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>How your template will look on WhatsApp</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-[#e5ded8] rounded-lg p-4 min-h-[300px]">
                <div className="bg-white rounded-lg p-3 shadow-sm max-w-[90%]">
                  {/* Header */}
                  {form.headerType === 'TEXT' && form.headerText && (
                    <p className="font-bold text-gray-900 mb-2">{form.headerText}</p>
                  )}
                  {form.headerType === 'IMAGE' && (
                    <div className="bg-gray-100 h-32 rounded mb-2 flex items-center justify-center">
                      <Image className="h-8 w-8 text-gray-400" />
                    </div>
                  )}

                  {/* Body */}
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {getPreviewBody() || 'Your message will appear here...'}
                  </p>

                  {/* Footer */}
                  {form.footer && (
                    <p className="text-xs text-gray-500 mt-2">{form.footer}</p>
                  )}

                  {/* Buttons */}
                  {form.buttons.length > 0 && (
                    <div className="border-t mt-3 pt-2 space-y-1">
                      {form.buttons.map((btn, i) => (
                        <button
                          key={i}
                          className="w-full text-center text-blue-500 py-2 text-sm flex items-center justify-center"
                        >
                          {btn.type === 'URL' && <ExternalLink className="h-3 w-3 mr-1" />}
                          {btn.type === 'PHONE_NUMBER' && <PhoneIcon className="h-3 w-3 mr-1" />}
                          {btn.text || `Button ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                <p className="font-medium mb-1">Template Approval</p>
                <p className="text-blue-600">
                  Templates are reviewed by Meta and typically approved within 24 hours. 
                  Marketing templates may take longer.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
