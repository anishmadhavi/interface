/**
 * =============================================================================
 * FILE: src/app/(dashboard)/trust-center/page.tsx
 * PURPOSE: Trust Center - WhatsApp Business Verification & Compliance Hub
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays WhatsApp Business API verification status
 * - Shows Meta Business verification progress
 * - Displays messaging limits and quality rating
 * - Shows compliance status (DPDP Act 2023)
 * - Provides links to complete verification steps
 * - Shows phone number status and display name
 * 
 * KEY FEATURES:
 * - Business verification status (Not Started, Pending, Verified)
 * - Phone number verification status
 * - Display name approval status
 * - Messaging tier and limits
 * - Quality rating (Green, Yellow, Red)
 * - DPDP Act compliance checklist
 * - Two-factor authentication status
 * - Official Business Account (OBA) badge status
 * 
 * WHATSAPP BUSINESS TIERS:
 * - Unverified: 250 conversations/day
 * - Tier 1: 1,000 conversations/day
 * - Tier 2: 10,000 conversations/day
 * - Tier 3: 100,000 conversations/day
 * - Tier 4: Unlimited
 * 
 * QUALITY RATINGS:
 * - Green: High quality, can request tier upgrade
 * - Yellow: Medium quality, monitor closely
 * - Red: Low quality, risk of restrictions
 * 
 * DPDP ACT 2023 COMPLIANCE (INDIA):
 * - Consent collection
 * - Data processing notice
 * - Right to erasure ("Forget Me")
 * - Data retention policy
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * - Meta Business API (for verification status)
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Phone,
  Building2,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  XCircle,
  BadgeCheck,
  Lock,
  FileText,
  UserX,
  RefreshCw,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

type VerificationStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
type QualityRating = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
type MessagingTier = 'TIER_UNVERIFIED' | 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4';

interface TrustStatus {
  // Business Verification
  businessVerification: VerificationStatus;
  businessName: string;
  businessId?: string;
  
  // Phone Number
  phoneNumber: string;
  phoneVerified: boolean;
  displayName: string;
  displayNameStatus: VerificationStatus;
  
  // Messaging
  messagingTier: MessagingTier;
  dailyLimit: number;
  qualityRating: QualityRating;
  
  // Security
  twoFactorEnabled: boolean;
  officialBusinessAccount: boolean;
  
  // Compliance
  dpdpCompliance: {
    consentCollection: boolean;
    dataProcessingNotice: boolean;
    rightToErasure: boolean;
    dataRetentionPolicy: boolean;
  };
}

const TIER_LIMITS: Record<MessagingTier, number> = {
  TIER_UNVERIFIED: 250,
  TIER_1: 1000,
  TIER_2: 10000,
  TIER_3: 100000,
  TIER_4: Infinity,
};

const TIER_LABELS: Record<MessagingTier, string> = {
  TIER_UNVERIFIED: 'Unverified',
  TIER_1: 'Tier 1',
  TIER_2: 'Tier 2',
  TIER_3: 'Tier 3',
  TIER_4: 'Unlimited',
};

export default function TrustCenterPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<TrustStatus | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) return;

      // Fetch organization trust status
      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', userData.organization_id)
        .single();

      if (org) {
        setStatus({
          businessVerification: org.business_verification_status || 'NOT_STARTED',
          businessName: org.business_name || 'Your Business',
          businessId: org.meta_business_id,
          phoneNumber: org.whatsapp_phone_number || '',
          phoneVerified: org.phone_verified || false,
          displayName: org.display_name || '',
          displayNameStatus: org.display_name_status || 'NOT_STARTED',
          messagingTier: org.messaging_tier || 'TIER_UNVERIFIED',
          dailyLimit: TIER_LIMITS[org.messaging_tier as MessagingTier] || 250,
          qualityRating: org.quality_rating || 'UNKNOWN',
          twoFactorEnabled: org.two_factor_enabled || false,
          officialBusinessAccount: org.official_business_account || false,
          dpdpCompliance: org.dpdp_compliance || {
            consentCollection: false,
            dataProcessingNotice: false,
            rightToErasure: false,
            dataRetentionPolicy: false,
          },
        });
      }

      setLoading(false);
    };

    fetchStatus();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      // In production, this would call Meta API to refresh status
      await fetch('/api/trust-center/sync', { method: 'POST' });
      window.location.reload();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  const getStatusIcon = (status: VerificationStatus) => {
    switch (status) {
      case 'VERIFIED':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'PENDING':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'REJECTED':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: VerificationStatus) => {
    switch (status) {
      case 'VERIFIED':
        return 'text-green-600 bg-green-50';
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-50';
      case 'REJECTED':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getQualityColor = (rating: QualityRating) => {
    switch (rating) {
      case 'GREEN':
        return 'text-green-600 bg-green-100';
      case 'YELLOW':
        return 'text-yellow-600 bg-yellow-100';
      case 'RED':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getComplianceScore = () => {
    if (!status) return 0;
    const items = Object.values(status.dpdpCompliance);
    return Math.round((items.filter(Boolean).length / items.length) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trust Center</h1>
          <p className="text-gray-500">WhatsApp Business verification and compliance status</p>
        </div>
        <Button variant="outline" onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sync Status
        </Button>
      </div>

      {/* Overall Status Banner */}
      <Card className={cn(
        'border-l-4',
        status.businessVerification === 'VERIFIED' ? 'border-l-green-500' :
        status.businessVerification === 'PENDING' ? 'border-l-yellow-500' :
        'border-l-gray-300'
      )}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                status.businessVerification === 'VERIFIED' ? 'bg-green-100' : 'bg-gray-100'
              )}>
                <Shield className={cn(
                  'h-6 w-6',
                  status.businessVerification === 'VERIFIED' ? 'text-green-600' : 'text-gray-400'
                )} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{status.businessName}</h2>
                <div className="flex items-center space-x-2 text-sm">
                  {getStatusIcon(status.businessVerification)}
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    getStatusColor(status.businessVerification)
                  )}>
                    {status.businessVerification === 'VERIFIED' ? 'Verified Business' :
                     status.businessVerification === 'PENDING' ? 'Verification Pending' :
                     'Not Verified'}
                  </span>
                  {status.officialBusinessAccount && (
                    <span className="flex items-center text-green-600">
                      <BadgeCheck className="h-4 w-4 mr-1" />
                      Official Business Account
                    </span>
                  )}
                </div>
              </div>
            </div>
            {status.businessVerification !== 'VERIFIED' && (
              <Button variant="whatsapp" asChild>
                <a href="https://business.facebook.com/settings/security" target="_blank" rel="noopener noreferrer">
                  Complete Verification
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Verification Status */}
        <div className="lg:col-span-2 space-y-6">
          {/* Phone & Display Name */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Phone className="h-5 w-5 mr-2 text-whatsapp" />
                Phone Number & Display Name
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">WhatsApp Number</p>
                  <p className="font-medium">{status.phoneNumber || 'Not configured'}</p>
                </div>
                <div className="flex items-center">
                  {status.phoneVerified ? (
                    <span className="flex items-center text-green-600 text-sm">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Verified
                    </span>
                  ) : (
                    <Button variant="outline" size="sm">Verify</Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Display Name</p>
                  <p className="font-medium">{status.displayName || 'Not set'}</p>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(status.displayNameStatus)}
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs',
                    getStatusColor(status.displayNameStatus)
                  )}>
                    {status.displayNameStatus}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Messaging Tier & Quality */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2 text-blue-500" />
                Messaging Limits & Quality
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-blue-700">Current Tier</p>
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-blue-900">
                    {TIER_LABELS[status.messagingTier]}
                  </p>
                  <p className="text-sm text-blue-600">
                    {status.dailyLimit === Infinity ? 'Unlimited' : `${status.dailyLimit.toLocaleString()} conversations/day`}
                  </p>
                </div>

                <div className={cn('p-4 rounded-lg', getQualityColor(status.qualityRating))}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm">Quality Rating</p>
                    {status.qualityRating === 'GREEN' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : status.qualityRating === 'YELLOW' ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : status.qualityRating === 'RED' ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                  </div>
                  <p className="text-2xl font-bold">
                    {status.qualityRating === 'UNKNOWN' ? 'N/A' : status.qualityRating}
                  </p>
                  <p className="text-sm">
                    {status.qualityRating === 'GREEN' ? 'High quality' :
                     status.qualityRating === 'YELLOW' ? 'Medium quality' :
                     status.qualityRating === 'RED' ? 'Low quality' : 'Not rated yet'}
                  </p>
                </div>
              </div>

              {/* Tier Progression */}
              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-2">Tier Progression</p>
                <div className="flex items-center space-x-2">
                  {Object.entries(TIER_LABELS).map(([tier, label], index) => (
                    <div key={tier} className="flex items-center">
                      <div className={cn(
                        'px-3 py-1 rounded text-xs font-medium',
                        status.messagingTier === tier ? 'bg-whatsapp text-white' : 'bg-gray-100 text-gray-500'
                      )}>
                        {label}
                      </div>
                      {index < Object.keys(TIER_LABELS).length - 1 && (
                        <ChevronRight className="h-4 w-4 text-gray-300 mx-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {status.qualityRating === 'GREEN' && status.messagingTier !== 'TIER_4' && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700">
                    ✨ Your quality rating is high! You may be eligible for a tier upgrade.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lock className="h-5 w-5 mr-2 text-purple-500" />
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Lock className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">Two-Factor Authentication</p>
                      <p className="text-sm text-gray-500">Extra security for your WhatsApp Business account</p>
                    </div>
                  </div>
                  {status.twoFactorEnabled ? (
                    <span className="flex items-center text-green-600 text-sm">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Enabled
                    </span>
                  ) : (
                    <Button variant="outline" size="sm">Enable</Button>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <BadgeCheck className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">Official Business Account</p>
                      <p className="text-sm text-gray-500">Green checkmark badge on your profile</p>
                    </div>
                  </div>
                  {status.officialBusinessAccount ? (
                    <span className="flex items-center text-green-600 text-sm">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Active
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">Requires verification</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* DPDP Compliance */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2 text-orange-500" />
                DPDP Act 2023 Compliance
              </CardTitle>
              <CardDescription>India's Digital Personal Data Protection Act</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Compliance Score</span>
                  <span className="font-bold">{getComplianceScore()}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={cn(
                      'h-2 rounded-full transition-all',
                      getComplianceScore() === 100 ? 'bg-green-500' :
                      getComplianceScore() >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    )}
                    style={{ width: `${getComplianceScore()}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                  <div className="flex items-center space-x-2">
                    {status.dpdpCompliance.consentCollection ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-sm">Consent Collection</span>
                  </div>
                  {!status.dpdpCompliance.consentCollection && (
                    <Button variant="ghost" size="sm">Setup</Button>
                  )}
                </div>

                <div className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                  <div className="flex items-center space-x-2">
                    {status.dpdpCompliance.dataProcessingNotice ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-sm">Data Processing Notice</span>
                  </div>
                  {!status.dpdpCompliance.dataProcessingNotice && (
                    <Button variant="ghost" size="sm">Setup</Button>
                  )}
                </div>

                <div className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                  <div className="flex items-center space-x-2">
                    {status.dpdpCompliance.rightToErasure ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-sm">Right to Erasure</span>
                  </div>
                  {!status.dpdpCompliance.rightToErasure && (
                    <Button variant="ghost" size="sm">Setup</Button>
                  )}
                </div>

                <div className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                  <div className="flex items-center space-x-2">
                    {status.dpdpCompliance.dataRetentionPolicy ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-sm">Data Retention Policy</span>
                  </div>
                  {!status.dpdpCompliance.dataRetentionPolicy && (
                    <Button variant="ghost" size="sm">Setup</Button>
                  )}
                </div>
              </div>

              {getComplianceScore() < 100 && (
                <div className="mt-4 p-3 bg-orange-50 rounded-lg">
                  <p className="text-sm text-orange-700">
                    ⚠️ Complete all compliance requirements to avoid penalties under DPDP Act.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <a
                href="https://business.facebook.com/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <span className="text-sm">Meta Business Settings</span>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </a>
              <a
                href="https://developers.facebook.com/docs/whatsapp/overview/business-accounts"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <span className="text-sm">WhatsApp Business Docs</span>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </a>
              <a
                href="https://www.meity.gov.in/data-protection-framework"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <span className="text-sm">DPDP Act Guidelines</span>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
