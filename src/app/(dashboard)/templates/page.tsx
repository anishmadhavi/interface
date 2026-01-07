/**
 * =============================================================================
 * FILE: src/app/(dashboard)/templates/page.tsx
 * PURPOSE: Message Templates List Page
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays all WhatsApp message templates
 * - Shows template status (APPROVED, PENDING, REJECTED)
 * - Allows filtering by category and status
 * - Shows template preview on hover/click
 * - Links to create new template
 * - Shows sync status with Meta
 * 
 * KEY FEATURES:
 * - Status badges (approved, pending, rejected)
 * - Category filter (marketing, utility, authentication)
 * - Template preview
 * - Sync with Meta button
 * - Create template button
 * - Delete template option
 * 
 * TEMPLATE TYPES:
 * - Marketing: Promotional messages (per-message pricing)
 * - Utility: Order updates, confirmations (conversation pricing)
 * - Authentication: OTP, verification codes (conversation pricing)
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Search,
  Plus,
  RefreshCw,
  FileText,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED';
type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  status: TemplateStatus;
  content: {
    header?: { type: string; text?: string };
    body: string;
    footer?: string;
    buttons?: { type: string; text: string }[];
  };
  metaTemplateId?: string;
  lastSyncedAt?: string;
  createdAt: string;
}

const STATUS_CONFIG = {
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const CATEGORY_CONFIG = {
  MARKETING: { label: 'Marketing', color: 'bg-purple-100 text-purple-800' },
  UTILITY: { label: 'Utility', color: 'bg-blue-100 text-blue-800' },
  AUTHENTICATION: { label: 'Authentication', color: 'bg-gray-100 text-gray-800' },
};

export default function TemplatesPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TemplateStatus | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'ALL'>('ALL');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
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
        .eq('organization_id', userData.organization_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching templates:', error);
        return;
      }

      const mapped: Template[] = (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        language: t.language || 'en',
        status: t.status,
        content: t.content || {},
        metaTemplateId: t.meta_template_id,
        lastSyncedAt: t.last_synced_at,
        createdAt: t.created_at,
      }));

      setTemplates(mapped);
      setFilteredTemplates(mapped);
      setLoading(false);
    };

    fetchTemplates();
  }, []);

  // Filter templates
  useEffect(() => {
    let filtered = [...templates];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.name.toLowerCase().includes(query));
    }

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    if (categoryFilter !== 'ALL') {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }

    setFilteredTemplates(filtered);
  }, [templates, searchQuery, statusFilter, categoryFilter]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/whatsapp/templates/sync', {
        method: 'POST',
      });
      
      if (response.ok) {
        // Refetch templates
        window.location.reload();
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', templateId);

    if (!error) {
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Message Templates</h1>
          <p className="text-gray-500">{templates.length} templates</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync with Meta
          </Button>
          <Button variant="whatsapp" asChild>
            <Link href="/templates/create">
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="ALL">All Statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as any)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="ALL">All Categories</option>
          <option value="MARKETING">Marketing</option>
          <option value="UTILITY">Utility</option>
          <option value="AUTHENTICATION">Authentication</option>
        </select>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No templates found</p>
            <p className="text-sm text-gray-400">
              {searchQuery ? 'Try a different search term' : 'Create your first template to get started'}
            </p>
            <Button variant="whatsapp" className="mt-4" asChild>
              <Link href="/templates/create">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const StatusIcon = STATUS_CONFIG[template.status].icon;
            
            return (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">{template.name}</h3>
                      <p className="text-xs text-gray-500">{template.language.toUpperCase()}</p>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className={cn('text-xs px-2 py-1 rounded-full', STATUS_CONFIG[template.status].color)}>
                        <StatusIcon className="h-3 w-3 inline mr-1" />
                        {STATUS_CONFIG[template.status].label}
                      </span>
                    </div>
                  </div>

                  <span className={cn('text-xs px-2 py-0.5 rounded', CATEGORY_CONFIG[template.category].color)}>
                    {CATEGORY_CONFIG[template.category].label}
                  </span>

                  {/* Template Preview */}
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 line-clamp-3">
                    {template.content.body || 'No content'}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t">
                    <span className="text-xs text-gray-400">
                      Created {formatDate(template.createdAt)}
                    </span>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewTemplate(template)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/templates/${template.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Template Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">{previewTemplate.name}</h3>
                <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(null)}>
                  <XCircle className="h-5 w-5" />
                </Button>
              </div>

              {/* WhatsApp-style preview */}
              <div className="bg-[#e5ded8] rounded-lg p-4">
                <div className="bg-white rounded-lg p-3 shadow-sm max-w-[80%]">
                  {previewTemplate.content.header && (
                    <p className="font-bold text-gray-900 mb-1">
                      {previewTemplate.content.header.text}
                    </p>
                  )}
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {previewTemplate.content.body}
                  </p>
                  {previewTemplate.content.footer && (
                    <p className="text-xs text-gray-500 mt-2">
                      {previewTemplate.content.footer}
                    </p>
                  )}
                  {previewTemplate.content.buttons && previewTemplate.content.buttons.length > 0 && (
                    <div className="border-t mt-2 pt-2 space-y-1">
                      {previewTemplate.content.buttons.map((btn, i) => (
                        <button
                          key={i}
                          className="w-full text-center text-blue-500 py-1 text-sm"
                        >
                          {btn.text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
                  Close
                </Button>
                <Button variant="whatsapp" asChild>
                  <Link href={`/templates/${previewTemplate.id}`}>
                    Edit Template
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
