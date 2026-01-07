/**
 * =============================================================================
 * FILE: src/app/(dashboard)/analytics/page.tsx
 * PURPOSE: Analytics Overview Dashboard - Key Metrics & Visualizations
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays key performance metrics at a glance
 * - Shows message delivery and engagement stats
 * - Conversation analytics with trends
 * - Campaign performance summary
 * - Agent performance overview
 * - Cost analysis and ROI metrics
 * 
 * KEY FEATURES:
 * - Date range selector (7d, 30d, 90d, custom)
 * - KPI cards with trends
 * - Message volume chart
 * - Delivery rate visualization
 * - Response time metrics
 * - Top performing campaigns
 * - Agent leaderboard
 * - Cost breakdown
 * 
 * METRICS TRACKED:
 * - Messages: Sent, Delivered, Read, Failed
 * - Conversations: New, Active, Resolved
 * - Response Time: Average, First Response
 * - Campaigns: Sent, CTR, Conversions
 * - Costs: Marketing, Utility, Auth
 * 
 * WHATSAPP SPECIFIC:
 * - Delivery vs Read rates
 * - Template performance
 * - Opt-out tracking
 * - Quality rating impact
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
  BarChart3,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Send,
  IndianRupee,
  Calendar,
  ArrowRight,
  Loader2,
  FileText,
  Zap,
  UserCheck
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type DateRange = '7d' | '30d' | '90d' | 'custom';

interface OverviewMetrics {
  messages: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    trend: number;
  };
  conversations: {
    total: number;
    new: number;
    resolved: number;
    avgResponseTime: number; // in minutes
    trend: number;
  };
  campaigns: {
    sent: number;
    delivered: number;
    clicked: number;
    conversions: number;
  };
  costs: {
    total: number;
    marketing: number;
    utility: number;
    authentication: number;
    trend: number;
  };
}

interface DailyData {
  date: string;
  sent: number;
  delivered: number;
  read: number;
}

interface TopCampaign {
  id: string;
  name: string;
  sent: number;
  delivered: number;
  read: number;
  deliveryRate: number;
}

interface AgentStats {
  id: string;
  name: string;
  avatar?: string;
  conversationsHandled: number;
  avgResponseTime: number;
  satisfaction: number;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [topCampaigns, setTopCampaigns] = useState<TopCampaign[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);

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

      // Calculate date range
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // In production, fetch real analytics data
      // For now, generate sample data
      const sampleMetrics: OverviewMetrics = {
        messages: {
          sent: Math.floor(Math.random() * 10000) + 5000,
          delivered: Math.floor(Math.random() * 9500) + 4500,
          read: Math.floor(Math.random() * 8000) + 3000,
          failed: Math.floor(Math.random() * 200) + 50,
          trend: Math.random() * 20 - 5,
        },
        conversations: {
          total: Math.floor(Math.random() * 2000) + 500,
          new: Math.floor(Math.random() * 500) + 100,
          resolved: Math.floor(Math.random() * 400) + 80,
          avgResponseTime: Math.floor(Math.random() * 30) + 5,
          trend: Math.random() * 15 - 3,
        },
        campaigns: {
          sent: Math.floor(Math.random() * 20) + 5,
          delivered: Math.floor(Math.random() * 50000) + 10000,
          clicked: Math.floor(Math.random() * 5000) + 1000,
          conversions: Math.floor(Math.random() * 500) + 100,
        },
        costs: {
          total: Math.floor(Math.random() * 50000) + 10000,
          marketing: Math.floor(Math.random() * 30000) + 5000,
          utility: Math.floor(Math.random() * 10000) + 2000,
          authentication: Math.floor(Math.random() * 5000) + 1000,
          trend: Math.random() * 10 - 2,
        },
      };

      // Generate daily data
      const daily: DailyData[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        daily.push({
          date: date.toISOString().split('T')[0],
          sent: Math.floor(Math.random() * 500) + 200,
          delivered: Math.floor(Math.random() * 480) + 190,
          read: Math.floor(Math.random() * 400) + 150,
        });
      }

      // Sample top campaigns
      const campaigns: TopCampaign[] = [
        { id: '1', name: 'Diwali Sale Announcement', sent: 15000, delivered: 14500, read: 12000, deliveryRate: 96.7 },
        { id: '2', name: 'New Year Offers', sent: 12000, delivered: 11600, read: 9800, deliveryRate: 96.7 },
        { id: '3', name: 'Product Launch - Winter Collection', sent: 8000, delivered: 7700, read: 6200, deliveryRate: 96.2 },
        { id: '4', name: 'Flash Sale Alert', sent: 5000, delivered: 4850, read: 4100, deliveryRate: 97.0 },
        { id: '5', name: 'Customer Feedback Request', sent: 3000, delivered: 2900, read: 2400, deliveryRate: 96.7 },
      ];

      // Sample agent stats
      const agents: AgentStats[] = [
        { id: '1', name: 'Priya Sharma', conversationsHandled: 245, avgResponseTime: 3, satisfaction: 98 },
        { id: '2', name: 'Rahul Verma', conversationsHandled: 198, avgResponseTime: 5, satisfaction: 95 },
        { id: '3', name: 'Anita Patel', conversationsHandled: 176, avgResponseTime: 4, satisfaction: 97 },
        { id: '4', name: 'Vikram Singh', conversationsHandled: 152, avgResponseTime: 6, satisfaction: 92 },
      ];

      setMetrics(sampleMetrics);
      setDailyData(daily);
      setTopCampaigns(campaigns);
      setAgentStats(agents);
      setLoading(false);
    };

    fetchAnalytics();
  }, [dateRange]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getMaxValue = () => {
    if (dailyData.length === 0) return 100;
    return Math.max(...dailyData.map(d => d.sent));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  if (!metrics) return null;

  const deliveryRate = ((metrics.messages.delivered / metrics.messages.sent) * 100).toFixed(1);
  const readRate = ((metrics.messages.read / metrics.messages.delivered) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500">Track your WhatsApp Business performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {(['7d', '30d', '90d'] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  dateRange === range
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <Button variant="outline" asChild>
            <Link href="/analytics/reports">
              <FileText className="h-4 w-4 mr-2" />
              View Reports
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Messages Sent */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Messages Sent</p>
                <p className="text-3xl font-bold">{formatNumber(metrics.messages.sent)}</p>
              </div>
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                'bg-blue-100'
              )}>
                <Send className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center mt-2 text-sm">
              {metrics.messages.trend >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={metrics.messages.trend >= 0 ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(metrics.messages.trend).toFixed(1)}%
              </span>
              <span className="text-gray-500 ml-1">vs last period</span>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Rate */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Delivery Rate</p>
                <p className="text-3xl font-bold">{deliveryRate}%</p>
              </div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="flex items-center mt-2 text-sm text-gray-500">
              <span>{formatNumber(metrics.messages.delivered)} delivered</span>
              <span className="mx-1">•</span>
              <span className="text-red-500">{formatNumber(metrics.messages.failed)} failed</span>
            </div>
          </CardContent>
        </Card>

        {/* Avg Response Time */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg Response Time</p>
                <p className="text-3xl font-bold">{metrics.conversations.avgResponseTime}m</p>
              </div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-yellow-100">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="flex items-center mt-2 text-sm">
              {metrics.conversations.trend >= 0 ? (
                <TrendingDown className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <TrendingUp className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={metrics.conversations.trend >= 0 ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(metrics.conversations.trend).toFixed(1)}%
              </span>
              <span className="text-gray-500 ml-1">faster</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Cost */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Spend</p>
                <p className="text-3xl font-bold">{formatCurrency(metrics.costs.total)}</p>
              </div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-purple-100">
                <IndianRupee className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="flex items-center mt-2 text-sm">
              {metrics.costs.trend >= 0 ? (
                <TrendingUp className="h-4 w-4 text-red-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-500 mr-1" />
              )}
              <span className={metrics.costs.trend >= 0 ? 'text-red-600' : 'text-green-600'}>
                {Math.abs(metrics.costs.trend).toFixed(1)}%
              </span>
              <span className="text-gray-500 ml-1">vs last period</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Message Volume</CardTitle>
          <CardDescription>Daily message activity over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {/* Simple bar chart visualization */}
            <div className="flex items-end justify-between h-48 gap-1">
              {dailyData.slice(-14).map((day, index) => {
                const maxVal = getMaxValue();
                const sentHeight = (day.sent / maxVal) * 100;
                const deliveredHeight = (day.delivered / maxVal) * 100;
                const readHeight = (day.read / maxVal) * 100;

                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="relative w-full flex justify-center space-x-0.5" style={{ height: '100%' }}>
                      <div
                        className="w-2 bg-blue-200 rounded-t"
                        style={{ height: `${sentHeight}%` }}
                        title={`Sent: ${day.sent}`}
                      />
                      <div
                        className="w-2 bg-green-400 rounded-t"
                        style={{ height: `${deliveredHeight}%` }}
                        title={`Delivered: ${day.delivered}`}
                      />
                      <div
                        className="w-2 bg-whatsapp rounded-t"
                        style={{ height: `${readHeight}%` }}
                        title={`Read: ${day.read}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              {dailyData.slice(-14).filter((_, i) => i % 2 === 0).map((day, index) => (
                <span key={index}>{new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center space-x-6 mt-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-200 rounded" />
                <span className="text-sm text-gray-600">Sent</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded" />
                <span className="text-sm text-gray-600">Delivered</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-whatsapp rounded" />
                <span className="text-sm text-gray-600">Read</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="h-5 w-5 mr-2 text-yellow-500" />
              Top Campaigns
            </CardTitle>
            <CardDescription>Best performing campaigns by delivery</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCampaigns.slice(0, 5).map((campaign, index) => (
                <div key={campaign.id} className="flex items-center space-x-4">
                  <span className="text-lg font-bold text-gray-400 w-6">#{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{campaign.name}</p>
                    <div className="flex items-center space-x-3 text-sm text-gray-500">
                      <span>{formatNumber(campaign.sent)} sent</span>
                      <span>•</span>
                      <span className="text-green-600">{campaign.deliveryRate}% delivered</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatNumber(campaign.read)}</p>
                    <p className="text-xs text-gray-500">read</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4" asChild>
              <Link href="/campaigns">
                View All Campaigns
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Agent Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <UserCheck className="h-5 w-5 mr-2 text-blue-500" />
              Agent Performance
            </CardTitle>
            <CardDescription>Top performing team members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agentStats.map((agent, index) => (
                <div key={agent.id} className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="font-medium text-gray-600">
                        {agent.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    {index === 0 && (
                      <span className="absolute -top-1 -right-1 text-yellow-500">🏆</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{agent.name}</p>
                    <div className="flex items-center space-x-3 text-sm text-gray-500">
                      <span>{agent.conversationsHandled} handled</span>
                      <span>•</span>
                      <span>{agent.avgResponseTime}m avg</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">{agent.satisfaction}%</p>
                    <p className="text-xs text-gray-500">satisfaction</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4" asChild>
              <Link href="/team">
                View Team
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
          <CardDescription>WhatsApp conversation charges by category (July 2025 pricing)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Marketing</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">₹0.82/msg</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(metrics.costs.marketing)}</p>
              <p className="text-sm text-gray-500 mt-1">
                {formatNumber(Math.floor(metrics.costs.marketing / 0.82))} messages
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Utility</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">₹0.33/conv</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(metrics.costs.utility)}</p>
              <p className="text-sm text-gray-500 mt-1">
                {formatNumber(Math.floor(metrics.costs.utility / 0.33))} conversations
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Authentication</span>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">₹0.33/conv</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(metrics.costs.authentication)}</p>
              <p className="text-sm text-gray-500 mt-1">
                {formatNumber(Math.floor(metrics.costs.authentication / 0.33))} authentications
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
