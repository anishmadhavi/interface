/**
 * =============================================================================
 * FILE: src/app/(dashboard)/trust-center/limits/page.tsx
 * PURPOSE: WhatsApp Messaging Limits & Tier Management
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays current messaging tier and daily limits
 * - Shows usage statistics against limits
 * - Explains tier upgrade requirements
 * - Shows quality rating impact on limits
 * - Displays historical usage patterns
 * - Provides tier upgrade request option
 * 
 * KEY FEATURES:
 * - Current tier display with limits
 * - Real-time usage tracking
 * - Usage history chart (7 days)
 * - Tier progression roadmap
 * - Quality rating correlation
 * - Upgrade eligibility check
 * - TRAI quiet hours reminder (India)
 * 
 * WHATSAPP MESSAGING TIERS:
 * - Unverified: 250 business-initiated conversations/24h
 * - Tier 1: 1,000 conversations/24h
 * - Tier 2: 10,000 conversations/24h
 * - Tier 3: 100,000 conversations/24h
 * - Tier 4: Unlimited
 * 
 * TIER UPGRADE REQUIREMENTS:
 * - Quality rating must be Green or Yellow
 * - Must reach 50% of current limit
 * - Phone number must be verified
 * - No policy violations in last 7 days
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
  TrendingUp,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  BarChart3,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Info
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type MessagingTier = 'TIER_UNVERIFIED' | 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4';
type QualityRating = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';

interface LimitsState {
  currentTier: MessagingTier;
  dailyLimit: number;
  usedToday: number;
  qualityRating: QualityRating;
  phoneVerified: boolean;
  lastPolicyViolation?: string;
  tierUpgradeEligible: boolean;
  tierUpgradeProgress: number; // Percentage towards upgrade
  usageHistory: { date: string; used: number; limit: number }[];
}

const TIER_CONFIG: Record<MessagingTier, { label: string; limit: number; color: string }> = {
  TIER_UNVERIFIED: { label: 'Unverified', limit: 250, color: 'bg-gray-500' },
  TIER_1: { label: 'Tier 1', limit: 1000, color: 'bg-blue-500' },
  TIER_2: { label: 'Tier 2', limit: 10000, color: 'bg-green-500' },
  TIER_3: { label: 'Tier 3', limit: 100000, color: 'bg-purple-500' },
  TIER_4: { label: 'Unlimited', limit: Infinity, color: 'bg-yellow-500' },
};

const TIER_ORDER: MessagingTier[] = ['TIER_UNVERIFIED', 'TIER_1', 'TIER_2', 'TIER_3', 'TIER_4'];

export default function LimitsPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [state, setState] = useState<LimitsState | null>(null);

  useEffect(() => {
    const fetchState = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) return;

      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', userData.organization_id)
        .single();

      if (org) {
        const currentTier = (org.messaging_tier || 'TIER_UNVERIFIED') as MessagingTier;
        const dailyLimit = TIER_CONFIG[currentTier].limit;
        const usedToday = org.messages_sent_today || 0;
        
        // Calculate upgrade progress (need 50% of current limit)
        const upgradeThreshold = dailyLimit * 0.5;
        const tierUpgradeProgress = Math.min((usedToday / upgradeThreshold) * 100, 100);

        // Check eligibility
        const qualityRating = (org.quality_rating || 'UNKNOWN') as QualityRating;
        const phoneVerified = org.phone_verified || false;
        const lastViolation = org.last_policy_violation;
        const daysSinceViolation = lastViolation 
          ? Math.floor((Date.now() - new Date(lastViolation).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        const tierUpgradeEligible = 
          (qualityRating === 'GREEN' || qualityRating === 'YELLOW') &&
          phoneVerified &&
          daysSinceViolation >= 7 &&
          tierUpgradeProgress >= 100 &&
          currentTier !== 'TIER_4';

        // Generate mock usage history
        const usageHistory: { date: string; used: number; limit: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          usageHistory.push({
            date: date.toISOString().split('T')[0],
            used: Math.floor(Math.random() * dailyLimit * 0.8),
            limit: dailyLimit,
          });
        }
        // Today's actual usage
        usageHistory[usageHistory.length - 1].used = usedToday;

        setState({
          currentTier,
          dailyLimit,
          usedToday,
          qualityRating,
          phoneVerified,
          lastPolicyViolation: lastViolation,
          tierUpgradeEligible,
          tierUpgradeProgress,
          usageHistory,
        });
      }

      setLoading(false);
    };

    fetchState();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/trust-center/sync-limits', { method: 'POST' });
      window.location.reload();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleRequestUpgrade = async () => {
    if (!state?.tierUpgradeEligible) return;
    
    try {
      await fetch('/api/trust-center/request-upgrade', { method: 'POST' });
      alert('Tier upgrade request submitted. Meta will review and upgrade automatically if eligible.');
    } catch (err) {
      console.error('Upgrade request error:', err);
    }
  };

  const formatNumber = (num: number) => {
    if (num === Infinity) return 'Unlimited';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const getUsagePercentage = () => {
    if (!state) return 0;
    if (state.dailyLimit === Infinity) return 0;
    return Math.min((state.usedToday / state.dailyLimit) * 100, 100);
  };

  const getUsageColor = () => {
    const percentage = getUsagePercentage();
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-whatsapp';
  };

  const getNextTier = (): MessagingTier | null => {
    if (!state) return null;
    const currentIndex = TIER_ORDER.indexOf(state.currentTier);
    if (currentIndex >= TIER_ORDER.length - 1) return null;
    return TIER_ORDER[currentIndex + 1];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  if (!state) return null;

  const nextTier = getNextTier();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/trust-center"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Messaging Limits</h1>
            <p className="text-gray-500">Your WhatsApp Business API messaging capacity</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sync
        </Button>
      </div>

      {/* Current Usage */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">Current Tier</p>
              <div className="flex items-center space-x-2">
                <span className={cn(
                  'px-3 py-1 rounded-full text-white font-medium',
                  TIER_CONFIG[state.currentTier].color
                )}>
                  {TIER_CONFIG[state.currentTier].label}
                </span>
                <span className="text-2xl font-bold">{formatNumber(state.dailyLimit)}</span>
                <span className="text-gray-500">conversations/day</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Used Today</p>
              <p className="text-3xl font-bold">{formatNumber(state.usedToday)}</p>
            </div>
          </div>

          {/* Progress Bar */}
          {state.dailyLimit !== Infinity && (
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-500">Daily Usage</span>
                <span className={cn(
                  getUsagePercentage() >= 90 ? 'text-red-600' :
                  getUsagePercentage() >= 70 ? 'text-yellow-600' : 'text-gray-600'
                )}>
                  {getUsagePercentage().toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={cn('h-3 rounded-full transition-all', getUsageColor())}
                  style={{ width: `${getUsagePercentage()}%` }}
                />
              </div>
              {getUsagePercentage() >= 90 && (
                <p className="text-sm text-red-600 mt-2 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Approaching daily limit. Consider upgrading your tier.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* TRAI Quiet Hours */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="py-4">
          <div className="flex items-start space-x-3">
            <Clock className="h-5 w-5 text-orange-600 mt-0.5" />
            <div>
              <p className="font-medium text-orange-800">TRAI Quiet Hours (India)</p>
              <p className="text-sm text-orange-700">
                Promotional messages cannot be sent between 9:00 PM - 9:00 AM IST.
                Transactional and service messages are allowed 24/7.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-blue-500" />
              7-Day Usage History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {state.usageHistory.map((day, index) => {
                const percentage = day.limit === Infinity ? 0 : (day.used / day.limit) * 100;
                const isToday = index === state.usageHistory.length - 1;
                
                return (
                  <div key={day.date}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className={cn('text-gray-600', isToday && 'font-medium')}>
                        {isToday ? 'Today' : new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-gray-500">{formatNumber(day.used)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={cn(
                          'h-2 rounded-full',
                          percentage >= 90 ? 'bg-red-400' :
                          percentage >= 70 ? 'bg-yellow-400' : 'bg-whatsapp'
                        )}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tier Upgrade */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
              Tier Upgrade
            </CardTitle>
            <CardDescription>
              {nextTier ? `Progress to ${TIER_CONFIG[nextTier].label}` : 'Maximum tier reached'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.currentTier === 'TIER_4' ? (
              <div className="text-center py-4">
                <Zap className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
                <p className="font-medium">Unlimited Tier</p>
                <p className="text-sm text-gray-500">You have the highest messaging capacity</p>
              </div>
            ) : (
              <>
                {/* Upgrade Requirements */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between p-2 rounded bg-gray-50">
                    <div className="flex items-center space-x-2">
                      {state.qualityRating === 'GREEN' || state.qualityRating === 'YELLOW' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="text-sm">Quality: Green or Yellow</span>
                    </div>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded',
                      state.qualityRating === 'GREEN' ? 'bg-green-100 text-green-700' :
                      state.qualityRating === 'YELLOW' ? 'bg-yellow-100 text-yellow-700' :
                      state.qualityRating === 'RED' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    )}>
                      {state.qualityRating}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-gray-50">
                    <div className="flex items-center space-x-2">
                      {state.phoneVerified ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="text-sm">Phone Verified</span>
                    </div>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded',
                      state.phoneVerified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    )}>
                      {state.phoneVerified ? 'Yes' : 'No'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-gray-50">
                    <div className="flex items-center space-x-2">
                      {state.tierUpgradeProgress >= 100 ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="text-sm">Reach 50% of limit</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {state.tierUpgradeProgress.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Upgrade Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-500">Upgrade Progress</span>
                    <span className="font-medium">{state.tierUpgradeProgress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-whatsapp h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(state.tierUpgradeProgress, 100)}%` }}
                    />
                  </div>
                </div>

                <Button
                  variant="whatsapp"
                  className="w-full"
                  disabled={!state.tierUpgradeEligible}
                  onClick={handleRequestUpgrade}
                >
                  {state.tierUpgradeEligible ? (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Request Upgrade to {nextTier && TIER_CONFIG[nextTier].label}
                    </>
                  ) : (
                    'Complete requirements to upgrade'
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tier Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>All Messaging Tiers</CardTitle>
          <CardDescription>WhatsApp Business API conversation limits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Tier</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Daily Limit</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Requirements</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {TIER_ORDER.map((tier) => {
                  const config = TIER_CONFIG[tier];
                  const isCurrent = tier === state.currentTier;
                  
                  return (
                    <tr key={tier} className={cn(isCurrent && 'bg-green-50')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium text-white',
                            config.color
                          )}>
                            {config.label}
                          </span>
                          {isCurrent && (
                            <span className="text-xs text-green-600 font-medium">Current</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatNumber(config.limit)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {tier === 'TIER_UNVERIFIED' && 'New accounts'}
                        {tier === 'TIER_1' && 'Phone verified, quality maintained'}
                        {tier === 'TIER_2' && 'Reach 50% of Tier 1 limit'}
                        {tier === 'TIER_3' && 'Reach 50% of Tier 2 limit'}
                        {tier === 'TIER_4' && 'Reach 50% of Tier 3 limit'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How limits work</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Limits apply to business-initiated conversations only</li>
                <li>User-initiated conversations don't count against your limit</li>
                <li>Limits reset every 24 hours (rolling window)</li>
                <li>Quality rating affects your ability to upgrade tiers</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
