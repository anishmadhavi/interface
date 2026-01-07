/**
 * =============================================================================
 * FILE: src/app/(dashboard)/marketing-ads/page.tsx
 * PURPOSE: CTWA (Click-to-WhatsApp) Ads List Page
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays all Click-to-WhatsApp ad campaigns
 * - Shows ad performance metrics (impressions, clicks, conversations)
 * - Allows filtering by status (Active, Paused, Completed)
 * - Shows cost per conversation and ROI metrics
 * - Links to Facebook Ads Manager for detailed management
 * - Provides quick actions (pause, resume, view analytics)
 * 
 * KEY FEATURES:
 * - Ad status badges (Active, Paused, Draft, Completed)
 * - Performance metrics (CTR, CPC, conversations started)
 * - Budget tracking (spent vs total)
 * - Quick pause/resume toggle
 * - Link to create new ad
 * - Analytics overview
 * 
 * CTWA ADS EXPLAINED:
 * - Ads that appear on Facebook/Instagram
 * - When clicked, opens WhatsApp chat with your business
 * - Great for lead generation and customer acquisition
 * - Synced from Facebook Ads Manager via API
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * - Facebook Marketing API (for ad management)
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
  ExternalLink,
  Play,
  Pause,
  BarChart3,
  MousePointer,
  MessageSquare,
  Eye,
  Wallet,
  TrendingUp,
  Loader2,
  Facebook
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type AdStatus = 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'COMPLETED' | 'ERROR';

interface MarketingAd {
  id: string;
  name: string;
  facebookAdId?: string;
  status: AdStatus;
  objective: string;
  budget: number;
  budgetType: 'DAILY' | 'LIFETIME';
  spent: number;
  impressions: number;
  clicks: number;
  conversations: number;
  ctr: number; // Click-through rate
  cpc: number; // Cost per click
  cpcv: number; // Cost per conversation
  startDate: string;
  endDate?: string;
  createdAt: string;
}

const STATUS_CONFIG = {
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-700', icon: Play },
  PAUSED: { label: 'Paused', color: 'bg-yellow-100 text-yellow-700', icon: Pause },
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: null },
  COMPLETED: { label: 'Completed', color: 'bg-blue-100 text-blue-700', icon: null },
  ERROR: { label: 'Error', color: 'bg-red-100 text-red-700', icon: null },
};

export default function MarketingAdsPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [ads, setAds] = useState<MarketingAd[]>([]);
  const [filteredAds, setFilteredAds] = useState<MarketingAd[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdStatus | 'ALL'>('ALL');

  useEffect(() => {
    const fetchAds = async () => {
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
        .from('marketing_ads')
        .select('*')
        .eq('organization_id', userData.organization_id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAds(data.map((ad: any) => ({
          id: ad.id,
          name: ad.name,
          facebookAdId: ad.facebook_ad_id,
          status: ad.status,
          objective: ad.objective || 'MESSAGES',
          budget: ad.budget || 0,
          budgetType: ad.budget_type || 'DAILY',
          spent: ad.spent || 0,
          impressions: ad.impressions || 0,
          clicks: ad.clicks || 0,
          conversations: ad.conversations || 0,
          ctr: ad.clicks > 0 ? (ad.clicks / ad.impressions) * 100 : 0,
          cpc: ad.clicks > 0 ? ad.spent / ad.clicks : 0,
          cpcv: ad.conversations > 0 ? ad.spent / ad.conversations : 0,
          startDate: ad.start_date,
          endDate: ad.end_date,
          createdAt: ad.created_at,
        })));
      }

      setLoading(false);
    };

    fetchAds();
  }, []);

  // Filter ads
  useEffect(() => {
    let filtered = [...ads];

    if (searchQuery) {
      filtered = filtered.filter(ad => 
        ad.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(ad => ad.status === statusFilter);
    }

    setFilteredAds(filtered);
  }, [ads, searchQuery, statusFilter]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/marketing-ads/sync', { method: 'POST' });
      window.location.reload();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleStatus = async (adId: string, currentStatus: AdStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    
    const supabase = createClient();
    await supabase
      .from('marketing_ads')
      .update({ status: newStatus })
      .eq('id', adId);

    // Also update on Facebook
    await fetch('/api/marketing-ads/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId, status: newStatus }),
    });

    setAds(prev => prev.map(ad => 
      ad.id === adId ? { ...ad, status: newStatus } : ad
    ));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // Calculate totals
  const totals = {
    spent: ads.reduce((sum, ad) => sum + ad.spent, 0),
    impressions: ads.reduce((sum, ad) => sum + ad.impressions, 0),
    clicks: ads.reduce((sum, ad) => sum + ad.clicks, 0),
    conversations: ads.reduce((sum, ad) => sum + ad.conversations, 0),
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Click-to-WhatsApp Ads</h1>
          <p className="text-gray-500">Manage your Facebook & Instagram ads that drive WhatsApp conversations</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync from Facebook
          </Button>
          <Button variant="whatsapp" asChild>
            <Link href="/marketing-ads/create">
              <Plus className="h-4 w-4 mr-2" />
              Create Ad
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Spent</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.spent)}</p>
              </div>
              <Wallet className="h-8 w-8 text-gray-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Impressions</p>
                <p className="text-2xl font-bold">{formatNumber(totals.impressions)}</p>
              </div>
              <Eye className="h-8 w-8 text-gray-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Clicks</p>
                <p className="text-2xl font-bold">{formatNumber(totals.clicks)}</p>
              </div>
              <MousePointer className="h-8 w-8 text-gray-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Conversations</p>
                <p className="text-2xl font-bold text-whatsapp">{formatNumber(totals.conversations)}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-whatsapp" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search ads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {['ALL', 'ACTIVE', 'PAUSED', 'COMPLETED'].map((status) => (
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

        <Button variant="outline" asChild>
          <Link href="/marketing-ads/analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Link>
        </Button>
      </div>

      {/* Ads List */}
      {filteredAds.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Facebook className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No ads found</p>
            <p className="text-sm text-gray-400">Create your first Click-to-WhatsApp ad</p>
            <Button variant="whatsapp" className="mt-4" asChild>
              <Link href="/marketing-ads/create">
                <Plus className="h-4 w-4 mr-2" />
                Create Ad
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAds.map((ad) => (
            <Card key={ad.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <Link 
                        href={`/marketing-ads/${ad.id}`}
                        className="font-medium text-gray-900 hover:text-whatsapp"
                      >
                        {ad.name}
                      </Link>
                      <span className={cn(
                        'inline-flex items-center text-xs px-2 py-0.5 rounded-full',
                        STATUS_CONFIG[ad.status].color
                      )}>
                        {STATUS_CONFIG[ad.status].label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {ad.budgetType === 'DAILY' ? 'Daily' : 'Lifetime'} budget: {formatCurrency(ad.budget)}
                      {' • '}Spent: {formatCurrency(ad.spent)}
                    </p>
                  </div>

                  {/* Metrics */}
                  <div className="hidden md:flex items-center space-x-8 text-sm">
                    <div className="text-center">
                      <p className="font-medium">{formatNumber(ad.impressions)}</p>
                      <p className="text-xs text-gray-500">Impressions</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{formatNumber(ad.clicks)}</p>
                      <p className="text-xs text-gray-500">Clicks</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{ad.ctr.toFixed(2)}%</p>
                      <p className="text-xs text-gray-500">CTR</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-whatsapp">{ad.conversations}</p>
                      <p className="text-xs text-gray-500">Conversations</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{formatCurrency(ad.cpcv)}</p>
                      <p className="text-xs text-gray-500">Cost/Conv</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    {(ad.status === 'ACTIVE' || ad.status === 'PAUSED') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(ad.id, ad.status)}
                      >
                        {ad.status === 'ACTIVE' ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/marketing-ads/${ad.id}`}>
                        <BarChart3 className="h-4 w-4" />
                      </Link>
                    </Button>
                    {ad.facebookAdId && (
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={`https://www.facebook.com/adsmanager/manage/ads?act=${ad.facebookAdId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
