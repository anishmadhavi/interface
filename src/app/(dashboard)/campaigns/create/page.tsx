/**
 * =============================================================================
 * FILE: src/app/(dashboard)/campaigns/create/page.tsx
 * PURPOSE: Create New Broadcast Campaign
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Multi-step wizard to create broadcast campaign
 * - Step 1: Select template (only approved templates)
 * - Step 2: Select recipients (contacts, tags, or CSV upload)
 * - Step 3: Preview and fill template variables
 * - Step 4: Schedule (send now or schedule for later)
 * - Shows cost estimation before sending
 * - Validates against TRAI quiet hours (9PM-9AM)
 * 
 * KEY FEATURES:
 * - Template selection with preview
 * - Contact selection (by tag, segment, or all)
 * - Variable value mapping (CSV column or static)
 * - Cost calculator (₹0.82/marketing, ₹0.33/utility)
 * - Schedule picker with timezone
 * - TRAI quiet hours validation
 * - Confirmation before sending
 * 
 * RECIPIENT SELECTION:
 * - All contacts
 * - By tags
 * - By segment/filter
 * - Upload CSV
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Users,
  Eye,
  Send,
  Clock,
  Calendar,
  AlertCircle,
  Loader2,
  Search
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3 | 4;

interface Template {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  content: { body: string; header?: { text?: string }; footer?: string };
  language: string;
}

interface Tag {
  name: string;
  count: number;
}

interface CampaignForm {
  name: string;
  templateId: string;
  recipientType: 'all' | 'tags' | 'segment';
  selectedTags: string[];
  scheduleType: 'now' | 'scheduled';
  scheduledAt: string;
  variableValues: Record<string, string>;
}

const STEPS = [
  { number: 1, title: 'Template', icon: FileText },
  { number: 2, title: 'Recipients', icon: Users },
  { number: 3, title: 'Preview', icon: Eye },
  { number: 4, title: 'Schedule', icon: Calendar },
];

// Pricing (July 2025 Meta model)
const PRICING = {
  MARKETING: 0.82,    // per message
  UTILITY: 0.33,      // per conversation
  AUTHENTICATION: 0.33,
};

export default function CreateCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [recipientCount, setRecipientCount] = useState(0);

  const [form, setForm] = useState<CampaignForm>({
    name: '',
    templateId: '',
    recipientType: 'all',
    selectedTags: [],
    scheduleType: 'now',
    scheduledAt: '',
    variableValues: {},
  });

  // Fetch templates and tags
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) return;

      // Fetch approved templates only
      const { data: templatesData } = await supabase
        .from('templates')
        .select('id, name, category, content, language')
        .eq('organization_id', userData.organization_id)
        .eq('status', 'APPROVED');

      if (templatesData) {
        setTemplates(templatesData);
      }

      // Fetch contact count
      const { count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', userData.organization_id);

      setTotalContacts(count || 0);
      setRecipientCount(count || 0);

      // Extract unique tags
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('tags')
        .eq('organization_id', userData.organization_id);

      if (contactsData) {
        const tagCounts: Record<string, number> = {};
        contactsData.forEach((c: any) => {
          (c.tags || []).forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        });
        setTags(Object.entries(tagCounts).map(([name, count]) => ({ name, count })));
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  // Update recipient count when selection changes
  useEffect(() => {
    const updateRecipientCount = async () => {
      if (form.recipientType === 'all') {
        setRecipientCount(totalContacts);
      } else if (form.recipientType === 'tags' && form.selectedTags.length > 0) {
        // Count contacts with selected tags
        const count = tags
          .filter(t => form.selectedTags.includes(t.name))
          .reduce((sum, t) => sum + t.count, 0);
        setRecipientCount(count);
      } else {
        setRecipientCount(0);
      }
    };

    updateRecipientCount();
  }, [form.recipientType, form.selectedTags, totalContacts, tags]);

  // Extract variables from template body
  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{\d+\}\}/g);
    return matches ? [...new Set(matches)] : [];
  };

  const variables = selectedTemplate ? extractVariables(selectedTemplate.content.body) : [];

  // Calculate estimated cost
  const calculateCost = (): number => {
    if (!selectedTemplate) return 0;
    const rate = PRICING[selectedTemplate.category];
    return recipientCount * rate;
  };

  // Validate TRAI quiet hours (9 PM - 9 AM)
  const isQuietHours = (date: Date): boolean => {
    const hours = date.getHours();
    return hours >= 21 || hours < 9;
  };

  const validateSchedule = (): boolean => {
    if (form.scheduleType === 'now') {
      if (isQuietHours(new Date())) {
        setError('Cannot send messages during TRAI quiet hours (9 PM - 9 AM). Please schedule for later.');
        return false;
      }
    } else {
      const scheduledDate = new Date(form.scheduledAt);
      if (isQuietHours(scheduledDate)) {
        setError('Scheduled time falls within TRAI quiet hours (9 PM - 9 AM). Please choose a different time.');
        return false;
      }
    }
    return true;
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setForm({ ...form, templateId: template.id });
  };

  const handleTagToggle = (tagName: string) => {
    const newTags = form.selectedTags.includes(tagName)
      ? form.selectedTags.filter(t => t !== tagName)
      : [...form.selectedTags, tagName];
    setForm({ ...form, selectedTags: newTags });
  };

  const handleNext = () => {
    setError(null);

    if (step === 1 && !form.templateId) {
      setError('Please select a template');
      return;
    }
    if (step === 2 && recipientCount === 0) {
      setError('Please select at least one recipient');
      return;
    }
    if (step === 3 && variables.length > 0) {
      const missingVars = variables.filter(v => !form.variableValues[v]);
      if (missingVars.length > 0) {
        setError('Please fill in all variable values');
        return;
      }
    }
    if (step === 4) {
      if (!form.name.trim()) {
        setError('Please enter a campaign name');
        return;
      }
      if (form.scheduleType === 'scheduled' && !form.scheduledAt) {
        setError('Please select a schedule date and time');
        return;
      }
      if (!validateSchedule()) return;
    }

    if (step < 4) {
      setStep((step + 1) as Step);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setSending(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) throw new Error('No organization');

      // Create campaign
      const { data: campaign, error: dbError } = await supabase
        .from('campaigns')
        .insert({
          organization_id: userData.organization_id,
          name: form.name,
          template_id: form.templateId,
          status: form.scheduleType === 'now' ? 'SENDING' : 'SCHEDULED',
          scheduled_at: form.scheduleType === 'scheduled' ? form.scheduledAt : null,
          total_recipients: recipientCount,
          estimated_cost: calculateCost(),
          recipient_filter: {
            type: form.recipientType,
            tags: form.selectedTags,
          },
          variable_values: form.variableValues,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // If sending now, trigger the send API
      if (form.scheduleType === 'now') {
        await fetch('/api/campaigns/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId: campaign.id }),
        });
      }

      router.push(`/campaigns/${campaign.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create campaign');
      setSending(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/campaigns"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Campaign</h1>
          <p className="text-gray-500">Send broadcast messages to your contacts</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s.number} className="flex items-center">
            <div className={cn(
              'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors',
              step >= s.number
                ? 'bg-whatsapp border-whatsapp text-white'
                : 'bg-white border-gray-300 text-gray-400'
            )}>
              {step > s.number ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
            </div>
            <span className={cn(
              'ml-2 text-sm font-medium',
              step >= s.number ? 'text-gray-900' : 'text-gray-400'
            )}>
              {s.title}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'w-12 h-0.5 mx-4',
                step > s.number ? 'bg-whatsapp' : 'bg-gray-300'
              )} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {/* Step 1: Select Template */}
          {step === 1 && (
            <div className="space-y-4">
              <CardTitle>Select Template</CardTitle>
              <CardDescription>Choose an approved template for your campaign</CardDescription>

              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No approved templates available</p>
                  <Button variant="outline" className="mt-4" asChild>
                    <Link href="/templates/create">Create Template</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={cn(
                        'p-4 border rounded-lg cursor-pointer transition-all',
                        form.templateId === template.id
                          ? 'border-whatsapp bg-green-50 ring-2 ring-whatsapp'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{template.name}</span>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded',
                          template.category === 'MARKETING' ? 'bg-purple-100 text-purple-700' :
                          template.category === 'UTILITY' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        )}>
                          {template.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{template.content.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Recipients */}
          {step === 2 && (
            <div className="space-y-4">
              <CardTitle>Select Recipients</CardTitle>
              <CardDescription>Choose who should receive this campaign</CardDescription>

              <div className="space-y-3">
                <label className={cn(
                  'flex items-center p-4 border rounded-lg cursor-pointer',
                  form.recipientType === 'all' ? 'border-whatsapp bg-green-50' : 'border-gray-200'
                )}>
                  <input
                    type="radio"
                    checked={form.recipientType === 'all'}
                    onChange={() => setForm({ ...form, recipientType: 'all', selectedTags: [] })}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-medium">All Contacts</p>
                    <p className="text-sm text-gray-500">{totalContacts} contacts</p>
                  </div>
                </label>

                <label className={cn(
                  'flex items-start p-4 border rounded-lg cursor-pointer',
                  form.recipientType === 'tags' ? 'border-whatsapp bg-green-50' : 'border-gray-200'
                )}>
                  <input
                    type="radio"
                    checked={form.recipientType === 'tags'}
                    onChange={() => setForm({ ...form, recipientType: 'tags' })}
                    className="mr-3 mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium">By Tags</p>
                    <p className="text-sm text-gray-500 mb-2">Select specific tags</p>
                    
                    {form.recipientType === 'tags' && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {tags.map((tag) => (
                          <button
                            key={tag.name}
                            onClick={(e) => { e.preventDefault(); handleTagToggle(tag.name); }}
                            className={cn(
                              'px-3 py-1 text-sm rounded-full border transition-colors',
                              form.selectedTags.includes(tag.name)
                                ? 'bg-whatsapp text-white border-whatsapp'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                            )}
                          >
                            {tag.name} ({tag.count})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>{recipientCount.toLocaleString()}</strong> contacts will receive this campaign
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Preview & Variables */}
          {step === 3 && selectedTemplate && (
            <div className="space-y-4">
              <CardTitle>Preview Message</CardTitle>
              <CardDescription>Review your message and fill in variable values</CardDescription>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Variables */}
                {variables.length > 0 && (
                  <div className="space-y-3">
                    <Label>Variable Values</Label>
                    {variables.map((v) => (
                      <div key={v}>
                        <Label className="text-sm text-gray-500">{v}</Label>
                        <Input
                          value={form.variableValues[v] || ''}
                          onChange={(e) => setForm({
                            ...form,
                            variableValues: { ...form.variableValues, [v]: e.target.value }
                          })}
                          placeholder={`Value for ${v}`}
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Preview */}
                <div>
                  <Label>Message Preview</Label>
                  <div className="mt-2 bg-[#e5ded8] rounded-lg p-4">
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      {selectedTemplate.content.header?.text && (
                        <p className="font-bold mb-2">{selectedTemplate.content.header.text}</p>
                      )}
                      <p className="whitespace-pre-wrap">
                        {variables.reduce(
                          (text, v) => text.replace(v, form.variableValues[v] || v),
                          selectedTemplate.content.body
                        )}
                      </p>
                      {selectedTemplate.content.footer && (
                        <p className="text-xs text-gray-500 mt-2">{selectedTemplate.content.footer}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Schedule */}
          {step === 4 && (
            <div className="space-y-4">
              <CardTitle>Schedule Campaign</CardTitle>
              <CardDescription>Choose when to send your campaign</CardDescription>

              <div>
                <Label>Campaign Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Diwali Sale Announcement"
                  className="mt-1"
                />
              </div>

              <div className="space-y-3">
                <label className={cn(
                  'flex items-center p-4 border rounded-lg cursor-pointer',
                  form.scheduleType === 'now' ? 'border-whatsapp bg-green-50' : 'border-gray-200'
                )}>
                  <input
                    type="radio"
                    checked={form.scheduleType === 'now'}
                    onChange={() => setForm({ ...form, scheduleType: 'now' })}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-medium flex items-center"><Send className="h-4 w-4 mr-2" />Send Now</p>
                    <p className="text-sm text-gray-500">Campaign will start immediately</p>
                  </div>
                </label>

                <label className={cn(
                  'flex items-start p-4 border rounded-lg cursor-pointer',
                  form.scheduleType === 'scheduled' ? 'border-whatsapp bg-green-50' : 'border-gray-200'
                )}>
                  <input
                    type="radio"
                    checked={form.scheduleType === 'scheduled'}
                    onChange={() => setForm({ ...form, scheduleType: 'scheduled' })}
                    className="mr-3 mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium flex items-center"><Clock className="h-4 w-4 mr-2" />Schedule for Later</p>
                    <p className="text-sm text-gray-500 mb-2">Choose date and time</p>
                    
                    {form.scheduleType === 'scheduled' && (
                      <Input
                        type="datetime-local"
                        value={form.scheduledAt}
                        onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                        min={new Date().toISOString().slice(0, 16)}
                        className="mt-2"
                      />
                    )}
                  </div>
                </label>
              </div>

              {/* Cost Summary */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Cost Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Recipients</span>
                    <span>{recipientCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rate ({selectedTemplate?.category})</span>
                    <span>{formatCurrency(PRICING[selectedTemplate?.category || 'MARKETING'])}/msg</span>
                  </div>
                  <div className="flex justify-between font-medium text-blue-900 pt-2 border-t border-blue-200">
                    <span>Estimated Cost</span>
                    <span>{formatCurrency(calculateCost())}</span>
                  </div>
                </div>
              </div>

              {/* TRAI Warning */}
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                Messages cannot be sent during TRAI quiet hours (9 PM - 9 AM IST)
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((step - 1) as Step)}
          disabled={step === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button variant="whatsapp" onClick={handleNext} disabled={sending}>
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : step === 4 ? (
            <Send className="h-4 w-4 mr-2" />
          ) : (
            <ArrowRight className="h-4 w-4 mr-2" />
          )}
          {step === 4 ? (form.scheduleType === 'now' ? 'Send Campaign' : 'Schedule Campaign') : 'Next'}
        </Button>
      </div>
    </div>
  );
}
