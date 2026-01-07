/**
 * =============================================================================
 * FILE: src/app/(dashboard)/marketing-ads/analytics/page.tsx
 * PURPOSE: CTWA Ads Analytics Dashboard
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Provides comprehensive analytics for all CTWA ad campaigns
 * - Shows aggregated performance metrics across all ads
 * - Displays ROI calculations and cost analysis
 * - Shows top performing ads
 * - Allows date range selection
 * - Export analytics report
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Download,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer,
  MessageSquare,
  Wallet,
  Target,
  Award,
  Loader2,
  Calendar
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type DateRange = '7d' | '30d' | '90d' | 'all';

interface AnalyticsData {
  totalSpent: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversations: number;
  avgCTR: number;
  avgCPC: number;
  avgCPCV: number;
  activeAds: number;
  totalAds: number;
  spentTrend: number;
  conversationsTrend: number;
}

interface TopAd {
  id: string;
  name: string;
  conversations: number;
  spent: number;
  cpcv: number;
}

interface DailyData {
  date: string;
  impressions: number;
  clicks: number;
  conversations: number;
  spent: number;
}

export default function MarketingAdsAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [topAds, setTopAds] = useState<TopAd[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) return;

      // Fetch all ads
      const { data: adsData } = await supabase
        .from('marketing_ads')
        .select('*')
        .eq('organization_id', userData.organization_id);

      if (adsData) {
        const totalSpent = adsData.reduce((sum, ad) => sum + (ad.spent || 0), 0);
        const totalImpressions = adsData.reduce((sum, ad) => sum + (ad.impressions || 0), 0);
        const totalClicks = adsData.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
        const totalConversations = adsData.reduce((sum, ad) => sum + (ad.conversations || 0), 0);

        setAnalytics({
          totalSpent,
          totalImpressions,
          totalClicks,
          totalConversations,
          avgCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          avgCPC: totalClicks > 0 ? totalSpent / totalClicks : 0,
          avgCPCV: totalConversations > 0 ? totalSpent / totalConversations : 0,
          activeAds: adsData.filter(ad => ad.status === 'ACTIVE').length,
          totalAds: adsData.length,
          spentTrend: 12,
          conversationsTrend: 15,
        });

        // Top ads
        const sorted = [...adsData]
          .filter(ad => ad.conversations > 0)
          .sort((a, b) => b.conversations - a.conversations)
          .slice(0, 5);

        setTopAds(sorted.map(ad => ({
          id: ad.id,
          name: ad.name,
          conversations: ad.conversations || 0,
          spent: ad.spent || 0,
          cpcv: ad.conversations > 0 ? (ad.spent || 0) / ad.conversations : 0,
        })));

        // Mock daily data
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const daily: DailyData[] = [];
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          daily.push({
            date: date.toISOString().split('T')[0],
            impressions: Math.floor(Math.random() * 10000) + 2000,
            clicks: Math.floor(Math.random() * 500) + 100,
            conversations: Math.floor(Math.random() * 50) + 10,
            spent: Math.floor(Math.random() * 1000) + 200,
          });
        }
        setDailyData(daily);
      }

      setLoading(false);
    };

    fetchAnalytics();
  }, [dateRange]);

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

  const handleExport = () => {
    const headers = ['Date', 'Impressions', 'Clicks', 'Conversations', 'Spent'];
    const rows = dailyData.map(d => [d.date, d.impressions, d.clicks, d.conversations, d.spent]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ctwa-analytics-${dateRange}.csv`;
    a.click();
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
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/marketing-ads"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CTWA Analytics</h1>
            <p className="text-gray-500">Performance overview for all ads</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {(['7d', '30d', '90d'] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  dateRange === range ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                )}
              >
                {range.replace('d', ' Days')}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <Wallet className="h-6 w-6 text-orange-400 mb-2" />
            <p className="text-2xl font-bold">{formatCurrency(analytics?.totalSpent || 0)}</p>
            <p className="text-sm text-gray-500">Total Spent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Eye className="h-6 w-6 text-blue-400 mb-2" />
            <p className="text-2xl font-bold">{formatNumber(analytics?.totalImpressions || 0)}</p>
            <p className="text-sm text-gray-500">Impressions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <MousePointer className="h-6 w-6 text-purple-400 mb-2" />
            <p className="text-2xl font-bold">{formatNumber(analytics?.totalClicks || 0)}</p>
            <p className="text-sm text-gray-500">Clicks ({analytics?.avgCTR.toFixed(2)}% CTR)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <MessageSquare className="h-6 w-6 text-whatsapp mb-2" />
            <p className="text-2xl font-bold text-whatsapp">{analytics?.totalConversations || 0}</p>
            <p className="text-sm text-gray-500">Conversations</p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">Cost per Click</p>
            <p className="text-2xl font-bold">{formatCurrency(analytics?.avgCPC || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">Cost per Conversation</p>
            <p className="text-2xl font-bold text-whatsapp">{formatCurrency(analytics?.avgCPCV || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">Active Ads</p>
            <p className="text-2xl font-bold">{analytics?.activeAds} / {analytics?.totalAds}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Ads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Award className="h-5 w-5 mr-2 text-yellow-500" />
              Top Performing Ads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topAds.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No ads with conversions yet</p>
            ) : (
              <div className="space-y-3">
                {topAds.map((ad, i) => (
                  <Link key={ad.id} href={`/marketing-ads/${ad.id}`} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <span className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold',
                        i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                      )}>{i + 1}</span>
                      <div>
                        <p className="font-medium">{ad.name}</p>
                        <p className="text-sm text-gray-500">{ad.conversations} conv • {formatCurrency(ad.cpcv)}/conv</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-blue-500" />
              Daily Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-right">Impr.</th>
                    <th className="px-2 py-2 text-right">Clicks</th>
                    <th className="px-2 py-2 text-right">Conv.</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dailyData.slice(-7).reverse().map((day) => (
                    <tr key={day.date}>
                      <td className="px-2 py-2">{new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                      <td className="px-2 py-2 text-right">{formatNumber(day.impressions)}</td>
                      <td className="px-2 py-2 text-right">{day.clicks}</td>
                      <td className="px-2 py-2 text-right text-whatsapp">{day.conversations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
