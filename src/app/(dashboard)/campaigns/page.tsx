/**
 * =============================================================================
 * FILE: src/app/(dashboard)/campaigns/page.tsx
 * PURPOSE: Campaigns List Page - Broadcast Message Campaigns
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays all broadcast campaigns (sent, scheduled, draft)
 * - Shows campaign stats: sent, delivered, read, failed counts
 * - Allows filtering by status (All, Draft, Scheduled, Sent, Failed)
 * - Shows estimated cost before sending
 * - Links to create new campaign
 * - Supports campaign duplication
 * 
 * KEY FEATURES:
 * - Campaign status badges
 * - Delivery metrics (sent/delivered/read/failed)
 * - Scheduled date display
 * - Cost estimation
 * - Quick actions: view, duplicate, delete
 * 
 * CAMPAIGN TYPES:
 * - Immediate: Send now to selected contacts
 * - Scheduled: Send at specified date/time
 * - Recurring: (Future) Send periodically
 * 
 * PRICING (July 2025 Meta Model):
 * - Marketing: ₹0.82 per message
 * - Utility: ₹0.33 per conversation
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
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  MoreVertical,
  Copy,
  Trash2,
  Eye,
  Loader2,
  Calendar,
  Users,
  TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED';

interface Campaign {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  status: CampaignStatus;
  scheduledAt?: string;
  sentAt?: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  estimatedCost: number;
  createdAt: string;
}

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  SCHEDULED: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700', icon: Clock },
  SENDING: { label: 'Sending', color: 'bg-yellow-100 text-yellow-700', icon: Send },
  SENT: { label: 'Sent', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function CampaignsPage() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'ALL'>('ALL');
  const [showActions, setShowActions] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
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
        .from('campaigns')
        .select(`
          *,
          templates (name)
        `)
        .eq('organization_id', userData.organization_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching campaigns:', error);
        return;
      }

      const mapped: Campaign[] = (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        templateId: c.template_id,
        templateName: c.templates?.name || 'Unknown Template',
        status: c.status,
        scheduledAt: c.scheduled_at,
        sentAt: c.sent_at,
        totalRecipients: c.total_recipients || 0,
        sentCount: c.sent_count || 0,
        deliveredCount: c.delivered_count || 0,
        readCount: c.read_count || 0,
        failedCount: c.failed_count || 0,
        estimatedCost: c.estimated_cost || 0,
        createdAt: c.created_at,
      }));

      setCampaigns(mapped);
      setFilteredCampaigns(mapped);
      setLoading(false);
    };

    fetchCampaigns();
  }, []);

  // Filter campaigns
  useEffect(() => {
    let filtered = [...campaigns];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(query));
    }

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    setFilteredCampaigns(filtered);
  }, [campaigns, searchQuery, statusFilter]);

  const handleDuplicate = async (campaign: Campaign) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_id', user.id)
      .single();

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        organization_id: userData?.organization_id,
        name: `${campaign.name} (Copy)`,
        template_id: campaign.templateId,
        status: 'DRAFT',
      })
      .select()
      .single();

    if (data) {
      setCampaigns(prev => [{ ...campaign, id: data.id, name: data.name, status: 'DRAFT' }, ...prev]);
    }
    setShowActions(null);
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;

    const supabase = createClient();
    await supabase.from('campaigns').delete().eq('id', campaignId);
    setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    setShowActions(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDeliveryRate = (campaign: Campaign) => {
    if (campaign.sentCount === 0) return 0;
    return Math.round((campaign.deliveredCount / campaign.sentCount) * 100);
  };

  const getReadRate = (campaign: Campaign) => {
    if (campaign.deliveredCount === 0) return 0;
    return Math.round((campaign.readCount / campaign.deliveredCount) * 100);
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
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-500">{campaigns.length} total campaigns</p>
        </div>
        <Button variant="whatsapp" asChild>
          <Link href="/campaigns/create">
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </Link>
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Sent</p>
                <p className="text-2xl font-bold">
                  {campaigns.reduce((sum, c) => sum + c.sentCount, 0).toLocaleString()}
                </p>
              </div>
              <Send className="h-8 w-8 text-gray-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg Delivery Rate</p>
                <p className="text-2xl font-bold">
                  {campaigns.length > 0
                    ? Math.round(campaigns.reduce((sum, c) => sum + getDeliveryRate(c), 0) / campaigns.filter(c => c.status === 'SENT').length || 0)
                    : 0}%
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-gray-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg Read Rate</p>
                <p className="text-2xl font-bold">
                  {campaigns.length > 0
                    ? Math.round(campaigns.reduce((sum, c) => sum + getReadRate(c), 0) / campaigns.filter(c => c.status === 'SENT').length || 0)
                    : 0}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-gray-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Scheduled</p>
                <p className="text-2xl font-bold">
                  {campaigns.filter(c => c.status === 'SCHEDULED').length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-gray-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {['ALL', 'DRAFT', 'SCHEDULED', 'SENT', 'FAILED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as any)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                statusFilter === status
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Campaigns List */}
      {filteredCampaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Send className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No campaigns found</p>
            <p className="text-sm text-gray-400">Create your first broadcast campaign</p>
            <Button variant="whatsapp" className="mt-4" asChild>
              <Link href="/campaigns/create">
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map((campaign) => {
            const StatusIcon = STATUS_CONFIG[campaign.status].icon;

            return (
              <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Link 
                            href={`/campaigns/${campaign.id}`}
                            className="font-medium text-gray-900 hover:text-whatsapp"
                          >
                            {campaign.name}
                          </Link>
                          <span className={cn(
                            'inline-flex items-center text-xs px-2 py-0.5 rounded-full',
                            STATUS_CONFIG[campaign.status].color
                          )}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {STATUS_CONFIG[campaign.status].label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          Template: {campaign.templateName}
                        </p>
                      </div>
                    </div>

                    {/* Stats (for sent campaigns) */}
                    {campaign.status === 'SENT' && (
                      <div className="hidden md:flex items-center space-x-6 text-sm">
                        <div className="text-center">
                          <p className="font-medium">{campaign.sentCount.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">Sent</p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-green-600">{getDeliveryRate(campaign)}%</p>
                          <p className="text-xs text-gray-500">Delivered</p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-blue-600">{getReadRate(campaign)}%</p>
                          <p className="text-xs text-gray-500">Read</p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-red-600">{campaign.failedCount}</p>
                          <p className="text-xs text-gray-500">Failed</p>
                        </div>
                      </div>
                    )}

                    {/* Scheduled info */}
                    {campaign.status === 'SCHEDULED' && campaign.scheduledAt && (
                      <div className="text-sm text-gray-500">
                        <Clock className="h-4 w-4 inline mr-1" />
                        {formatDate(campaign.scheduledAt)}
                      </div>
                    )}

                    {/* Draft info */}
                    {campaign.status === 'DRAFT' && (
                      <div className="text-sm text-gray-500">
                        <Users className="h-4 w-4 inline mr-1" />
                        {campaign.totalRecipients} recipients
                        {campaign.estimatedCost > 0 && (
                          <span className="ml-2">• Est. {formatCurrency(campaign.estimatedCost)}</span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowActions(showActions === campaign.id ? null : campaign.id)}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>

                      {showActions === campaign.id && (
                        <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border z-10">
                          <Link
                            href={`/campaigns/${campaign.id}`}
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                          <button
                            onClick={() => handleDuplicate(campaign)}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </button>
                          <button
                            onClick={() => handleDelete(campaign.id)}
                            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
