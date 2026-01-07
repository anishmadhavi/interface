/**
 * =============================================================================
 * FILE: src/app/(dashboard)/campaigns/[id]/page.tsx
 * PURPOSE: Campaign Detail Page - View Campaign Stats & Recipients
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays campaign details and delivery statistics
 * - Shows real-time progress for sending campaigns
 * - Shows recipient list with individual delivery status
 * - Allows canceling scheduled campaigns
 * - Shows failed recipients with error reasons
 * - Provides export option for campaign report
 * 
 * KEY FEATURES:
 * - Campaign status display
 * - Delivery metrics (sent, delivered, read, failed)
 * - Visual progress bar for sending campaigns
 * - Recipient list with status badges
 * - Error details for failed messages
 * - Cancel scheduled campaign
 * - Export report (CSV)
 * 
 * METRICS DISPLAYED:
 * - Total recipients
 * - Sent count
 * - Delivered count (with %)
 * - Read count (with %)
 * - Failed count (with errors)
 * - Cost incurred
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * - Supabase Realtime (for live updates during sending)
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Users,
  Download,
  StopCircle,
  Loader2,
  RefreshCw,
  Eye,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
type RecipientStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

interface Campaign {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  templateBody: string;
  status: CampaignStatus;
  scheduledAt?: string;
  sentAt?: string;
  completedAt?: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  estimatedCost: number;
  actualCost: number;
  createdAt: string;
}

interface Recipient {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  status: RecipientStatus;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  errorMessage?: string;
}

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  SCHEDULED: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700', icon: Clock },
  SENDING: { label: 'Sending', color: 'bg-yellow-100 text-yellow-700', icon: Send },
  SENT: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: XCircle },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700', icon: StopCircle },
};

const RECIPIENT_STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: 'text-gray-500' },
  SENT: { label: 'Sent', color: 'text-blue-600' },
  DELIVERED: { label: 'Delivered', color: 'text-green-600' },
  READ: { label: 'Read', color: 'text-green-700' },
  FAILED: { label: 'Failed', color: 'text-red-600' },
};

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const fetchCampaign = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) return;

      // Fetch campaign with template
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          templates (name, content)
        `)
        .eq('id', campaignId)
        .eq('organization_id', userData.organization_id)
        .single();

      if (error || !data) {
        router.push('/campaigns');
        return;
      }

      setCampaign({
        id: data.id,
        name: data.name,
        templateId: data.template_id,
        templateName: data.templates?.name || 'Unknown',
        templateBody: data.templates?.content?.body || '',
        status: data.status,
        scheduledAt: data.scheduled_at,
        sentAt: data.sent_at,
        completedAt: data.completed_at,
        totalRecipients: data.total_recipients || 0,
        sentCount: data.sent_count || 0,
        deliveredCount: data.delivered_count || 0,
        readCount: data.read_count || 0,
        failedCount: data.failed_count || 0,
        estimatedCost: data.estimated_cost || 0,
        actualCost: data.actual_cost || 0,
        createdAt: data.created_at,
      });

      // Fetch recipients (sample for now)
      const { data: recipientsData } = await supabase
        .from('campaign_recipients')
        .select(`
          id,
          status,
          sent_at,
          delivered_at,
          read_at,
          error_message,
          contacts (id, name, phone)
        `)
        .eq('campaign_id', campaignId)
        .order('sent_at', { ascending: false })
        .limit(100);

      if (recipientsData) {
        setRecipients(recipientsData.map((r: any) => ({
          id: r.id,
          contactId: r.contacts?.id || '',
          contactName: r.contacts?.name || 'Unknown',
          contactPhone: r.contacts?.phone || '',
          status: r.status,
          sentAt: r.sent_at,
          deliveredAt: r.delivered_at,
          readAt: r.read_at,
          errorMessage: r.error_message,
        })));
      }

      setLoading(false);
    };

    fetchCampaign();
  }, [campaignId, router]);

  // Real-time updates for sending campaigns
  useEffect(() => {
    if (!campaign || campaign.status !== 'SENDING') return;

    const supabase = createClient();
    const channel = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaigns',
          filter: `id=eq.${campaignId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setCampaign(prev => prev ? {
            ...prev,
            status: updated.status,
            sentCount: updated.sent_count,
            deliveredCount: updated.delivered_count,
            readCount: updated.read_count,
            failedCount: updated.failed_count,
          } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaign?.status, campaignId]);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this scheduled campaign?')) return;

    setCancelling(true);
    const supabase = createClient();
    await supabase
      .from('campaigns')
      .update({ status: 'CANCELLED' })
      .eq('id', campaignId);

    setCampaign(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
    setCancelling(false);
  };

  const handleExport = () => {
    // Generate CSV
    const headers = ['Name', 'Phone', 'Status', 'Sent At', 'Delivered At', 'Read At', 'Error'];
    const rows = recipients.map(r => [
      r.contactName,
      r.contactPhone,
      r.status,
      r.sentAt || '',
      r.deliveredAt || '',
      r.readAt || '',
      r.errorMessage || '',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-${campaign?.name}-report.csv`;
    a.click();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getProgress = () => {
    if (!campaign || campaign.totalRecipients === 0) return 0;
    return Math.round((campaign.sentCount / campaign.totalRecipients) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  if (!campaign) return null;

  const StatusIcon = STATUS_CONFIG[campaign.status].icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/campaigns"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
              <span className={cn(
                'inline-flex items-center text-xs px-2 py-1 rounded-full',
                STATUS_CONFIG[campaign.status].color
              )}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {STATUS_CONFIG[campaign.status].label}
              </span>
            </div>
            <p className="text-gray-500">Template: {campaign.templateName}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {campaign.status === 'SCHEDULED' && (
            <Button variant="outline" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <StopCircle className="h-4 w-4 mr-2" />}
              Cancel
            </Button>
          )}
          {campaign.status === 'SENT' && (
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          )}
        </div>
      </div>

      {/* Progress (for sending campaigns) */}
      {campaign.status === 'SENDING' && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-yellow-800">Sending in progress...</span>
              <span className="text-sm text-yellow-700">{getProgress()}%</span>
            </div>
            <div className="w-full bg-yellow-200 rounded-full h-2">
              <div
                className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${getProgress()}%` }}
              />
            </div>
            <p className="text-xs text-yellow-700 mt-2">
              {campaign.sentCount} of {campaign.totalRecipients} messages sent
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <Users className="h-5 w-5 text-gray-400 mb-2" />
            <p className="text-2xl font-bold">{campaign.totalRecipients.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total Recipients</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Send className="h-5 w-5 text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{campaign.sentCount.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <CheckCircle2 className="h-5 w-5 text-green-500 mb-2" />
            <p className="text-2xl font-bold">
              {campaign.sentCount > 0
                ? Math.round((campaign.deliveredCount / campaign.sentCount) * 100)
                : 0}%
            </p>
            <p className="text-sm text-gray-500">Delivered ({campaign.deliveredCount})</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Eye className="h-5 w-5 text-green-700 mb-2" />
            <p className="text-2xl font-bold">
              {campaign.deliveredCount > 0
                ? Math.round((campaign.readCount / campaign.deliveredCount) * 100)
                : 0}%
            </p>
            <p className="text-sm text-gray-500">Read ({campaign.readCount})</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <XCircle className="h-5 w-5 text-red-500 mb-2" />
            <p className="text-2xl font-bold text-red-600">{campaign.failedCount}</p>
            <p className="text-sm text-gray-500">Failed</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign Details */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Created</span>
              <span>{formatDate(campaign.createdAt)}</span>
            </div>
            {campaign.scheduledAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Scheduled For</span>
                <span>{formatDate(campaign.scheduledAt)}</span>
              </div>
            )}
            {campaign.sentAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Started</span>
                <span>{formatDate(campaign.sentAt)}</span>
              </div>
            )}
            {campaign.completedAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Completed</span>
                <span>{formatDate(campaign.completedAt)}</span>
              </div>
            )}
            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Estimated Cost</span>
                <span>{formatCurrency(campaign.estimatedCost)}</span>
              </div>
              {campaign.actualCost > 0 && (
                <div className="flex justify-between font-medium">
                  <span>Actual Cost</span>
                  <span>{formatCurrency(campaign.actualCost)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Message Preview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Message Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-[#e5ded8] rounded-lg p-4">
              <div className="bg-white rounded-lg p-3 shadow-sm max-w-[80%]">
                <p className="whitespace-pre-wrap">{campaign.templateBody}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recipients List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recipients</CardTitle>
              <CardDescription>Message delivery status for each recipient</CardDescription>
            </div>
            {recipients.length > 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllRecipients(!showAllRecipients)}
              >
                {showAllRecipients ? 'Show Less' : `Show All (${recipients.length})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {recipients.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recipients data available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Contact</th>
                    <th className="px-4 py-2 text-left">Phone</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Sent At</th>
                    <th className="px-4 py-2 text-left">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(showAllRecipients ? recipients : recipients.slice(0, 10)).map((recipient) => (
                    <tr key={recipient.id}>
                      <td className="px-4 py-2">{recipient.contactName}</td>
                      <td className="px-4 py-2">{recipient.contactPhone}</td>
                      <td className="px-4 py-2">
                        <span className={RECIPIENT_STATUS_CONFIG[recipient.status].color}>
                          {RECIPIENT_STATUS_CONFIG[recipient.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {recipient.sentAt ? formatDate(recipient.sentAt) : '-'}
                      </td>
                      <td className="px-4 py-2">
                        {recipient.errorMessage ? (
                          <span className="text-red-600 flex items-center">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {recipient.errorMessage}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
