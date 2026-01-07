/**
 * =============================================================================
 * FILE: src/app/(dashboard)/templates/[id]/page.tsx
 * PURPOSE: View/Edit Existing Template
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays existing template details
 * - Shows template approval status from Meta
 * - Allows editing draft/rejected templates
 * - Shows rejection reason if applicable
 * - Provides resubmit option for rejected templates
 * - Read-only view for approved templates (cannot edit)
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Save,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Copy
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  content: {
    header?: { type: string; text?: string };
    body: string;
    footer?: string;
    buttons?: { type: string; text: string }[];
  };
  rejectionReason?: string;
  metaTemplateId?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG = {
  APPROVED: { label: 'Approved', color: 'border-l-green-500 bg-green-50', icon: CheckCircle2, iconColor: 'text-green-500' },
  PENDING: { label: 'Pending Review', color: 'border-l-yellow-500 bg-yellow-50', icon: Clock, iconColor: 'text-yellow-500' },
  REJECTED: { label: 'Rejected', color: 'border-l-red-500 bg-red-50', icon: XCircle, iconColor: 'text-red-500' },
};

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);
  const [editedBody, setEditedBody] = useState('');
  const [editedFooter, setEditedFooter] = useState('');

  useEffect(() => {
    const fetchTemplate = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) return;

      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', templateId)
        .eq('organization_id', userData.organization_id)
        .single();

      if (error || !data) {
        router.push('/templates');
        return;
      }

      setTemplate({
        id: data.id,
        name: data.name,
        category: data.category,
        language: data.language,
        status: data.status,
        content: data.content || {},
        rejectionReason: data.rejection_reason,
        metaTemplateId: data.meta_template_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });
      setEditedBody(data.content?.body || '');
      setEditedFooter(data.content?.footer || '');
      setLoading(false);
    };

    fetchTemplate();
  }, [templateId, router]);

  const handleSave = async () => {
    if (!template || template.status === 'APPROVED') return;
    setSaving(true);

    const supabase = createClient();
    await supabase
      .from('templates')
      .update({
        content: { ...template.content, body: editedBody, footer: editedFooter },
        updated_at: new Date().toISOString(),
      })
      .eq('id', template.id);

    setTemplate({ ...template, content: { ...template.content, body: editedBody, footer: editedFooter } });
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this template?')) return;
    const supabase = createClient();
    await supabase.from('templates').delete().eq('id', templateId);
    router.push('/templates');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  if (!template) return null;

  const StatusIcon = STATUS_CONFIG[template.status].icon;
  const isEditable = template.status !== 'APPROVED';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/templates"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
            <p className="text-gray-500">{template.category} • {template.language.toUpperCase()}</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleDelete} className="text-red-600">
          <Trash2 className="h-4 w-4 mr-2" />Delete
        </Button>
      </div>

      {/* Status */}
      <Card className={cn('border-l-4', STATUS_CONFIG[template.status].color)}>
        <CardContent className="py-4 flex items-center space-x-3">
          <StatusIcon className={cn('h-6 w-6', STATUS_CONFIG[template.status].iconColor)} />
          <div>
            <p className="font-medium">{STATUS_CONFIG[template.status].label}</p>
            {template.rejectionReason && (
              <p className="text-sm text-red-700">Reason: {template.rejectionReason}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Edit Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Message Body</CardTitle>
              {!isEditable && <CardDescription>Approved templates cannot be edited</CardDescription>}
            </CardHeader>
            <CardContent>
              {isEditable ? (
                <Textarea value={editedBody} onChange={(e) => setEditedBody(e.target.value)} rows={4} />
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg whitespace-pre-wrap">{template.content.body}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Footer</CardTitle></CardHeader>
            <CardContent>
              {isEditable ? (
                <Input value={editedFooter} onChange={(e) => setEditedFooter(e.target.value)} maxLength={60} />
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg">{template.content.footer || 'No footer'}</div>
              )}
            </CardContent>
          </Card>

          {isEditable && (
            <Button variant="whatsapp" onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          )}
        </div>

        {/* Preview */}
        <Card>
          <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <CardContent>
            <div className="bg-[#e5ded8] rounded-lg p-4">
              <div className="bg-white rounded-lg p-3 shadow-sm">
                {template.content.header?.text && (
                  <p className="font-bold mb-2">{template.content.header.text}</p>
                )}
                <p className="whitespace-pre-wrap">{editedBody}</p>
                {editedFooter && <p className="text-xs text-gray-500 mt-2">{editedFooter}</p>}
                {template.content.buttons?.map((btn, i) => (
                  <button key={i} className="w-full text-blue-500 py-2 text-sm border-t mt-2">
                    {btn.text}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
