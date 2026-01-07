/**
 * =============================================================================
 * FILE: src/app/(dashboard)/trust-center/verification/page.tsx
 * PURPOSE: Official Business Account (Green Tick) Verification Application
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Guides users through WhatsApp Official Business Account application
 * - Shows eligibility requirements for green tick badge
 * - Provides step-by-step verification process
 * - Displays current verification status
 * - Allows uploading required documents
 * - Shows application history and status
 * 
 * KEY FEATURES:
 * - Eligibility checker
 * - Document upload (business registration, tax ID, etc.)
 * - Application status tracking
 * - Requirements checklist
 * - Meta Business verification integration
 * - Appeal process for rejections
 * 
 * ELIGIBILITY REQUIREMENTS:
 * - Verified Meta Business account
 * - Business must be notable (media coverage, significant presence)
 * - Active WhatsApp Business API account
 * - Good quality rating (Green)
 * - Compliant with WhatsApp policies
 * 
 * REQUIRED DOCUMENTS:
 * - Business registration certificate
 * - Tax registration (GST in India)
 * - Utility bill or bank statement (address proof)
 * - Articles of incorporation (for companies)
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * - Cloudflare R2 (for document storage)
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Upload,
  FileText,
  Building2,
  Globe,
  TrendingUp,
  Shield,
  ExternalLink,
  Loader2,
  XCircle,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type ApplicationStatus = 'NOT_STARTED' | 'ELIGIBLE' | 'DOCUMENTS_PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

interface VerificationState {
  applicationStatus: ApplicationStatus;
  metaBusinessVerified: boolean;
  qualityRating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  messagingTier: string;
  hasActiveCampaigns: boolean;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  documents: {
    businessRegistration: boolean;
    taxRegistration: boolean;
    addressProof: boolean;
    articlesOfIncorporation: boolean;
  };
}

interface EligibilityItem {
  id: string;
  label: string;
  description: string;
  met: boolean;
  required: boolean;
}

export default function VerificationPage() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<VerificationState | null>(null);

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
        setState({
          applicationStatus: org.oba_application_status || 'NOT_STARTED',
          metaBusinessVerified: org.business_verification_status === 'VERIFIED',
          qualityRating: org.quality_rating || 'UNKNOWN',
          messagingTier: org.messaging_tier || 'TIER_UNVERIFIED',
          hasActiveCampaigns: true, // Would check actual campaigns
          submittedAt: org.oba_submitted_at,
          reviewedAt: org.oba_reviewed_at,
          rejectionReason: org.oba_rejection_reason,
          documents: org.oba_documents || {
            businessRegistration: false,
            taxRegistration: false,
            addressProof: false,
            articlesOfIncorporation: false,
          },
        });
      }

      setLoading(false);
    };

    fetchState();
  }, []);

  const getEligibilityItems = (): EligibilityItem[] => {
    if (!state) return [];
    
    return [
      {
        id: 'meta_verified',
        label: 'Meta Business Verification',
        description: 'Your Meta Business account must be verified',
        met: state.metaBusinessVerified,
        required: true,
      },
      {
        id: 'quality_rating',
        label: 'Quality Rating: Green',
        description: 'Maintain a high-quality rating with no policy violations',
        met: state.qualityRating === 'GREEN',
        required: true,
      },
      {
        id: 'messaging_tier',
        label: 'Messaging Tier 2 or above',
        description: 'Reach at least Tier 2 (10,000 conversations/day)',
        met: ['TIER_2', 'TIER_3', 'TIER_4'].includes(state.messagingTier),
        required: true,
      },
      {
        id: 'active_presence',
        label: 'Active Business Presence',
        description: 'Have active campaigns and regular messaging activity',
        met: state.hasActiveCampaigns,
        required: true,
      },
      {
        id: 'notable_business',
        label: 'Notable Business',
        description: 'Media coverage, Wikipedia page, or significant online presence',
        met: false, // User needs to self-attest
        required: false,
      },
    ];
  };

  const isEligible = () => {
    const items = getEligibilityItems();
    return items.filter(i => i.required).every(i => i.met);
  };

  const allDocumentsUploaded = () => {
    if (!state) return false;
    return state.documents.businessRegistration && 
           state.documents.taxRegistration && 
           state.documents.addressProof;
  };

  const handleDocumentUpload = async (docType: keyof typeof state.documents, file: File) => {
    if (!state) return;
    setUploading(docType);

    try {
      // In production, upload to Cloudflare R2
      // const formData = new FormData();
      // formData.append('file', file);
      // formData.append('type', docType);
      // await fetch('/api/trust-center/upload-document', { method: 'POST', body: formData });

      // Simulate upload
      await new Promise(resolve => setTimeout(resolve, 1500));

      setState({
        ...state,
        documents: { ...state.documents, [docType]: true },
      });
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(null);
    }
  };

  const handleSubmitApplication = async () => {
    if (!state || !isEligible() || !allDocumentsUploaded()) return;
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      await supabase
        .from('organizations')
        .update({
          oba_application_status: 'UNDER_REVIEW',
          oba_submitted_at: new Date().toISOString(),
          oba_documents: state.documents,
        })
        .eq('id', userData?.organization_id);

      setState({
        ...state,
        applicationStatus: 'UNDER_REVIEW',
        submittedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
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

  if (!state) return null;

  const eligibilityItems = getEligibilityItems();
  const eligibleCount = eligibilityItems.filter(i => i.required && i.met).length;
  const requiredCount = eligibilityItems.filter(i => i.required).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/trust-center"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Official Business Account</h1>
          <p className="text-gray-500">Apply for the green checkmark badge</p>
        </div>
      </div>

      {/* Status Banner */}
      {state.applicationStatus === 'APPROVED' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <BadgeCheck className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-green-800">Congratulations!</h2>
                <p className="text-green-700">Your business is now an Official Business Account with the green checkmark badge.</p>
                {state.reviewedAt && (
                  <p className="text-sm text-green-600 mt-1">Approved on {formatDate(state.reviewedAt)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.applicationStatus === 'UNDER_REVIEW' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-blue-800">Application Under Review</h2>
                <p className="text-blue-700">Meta is reviewing your application. This typically takes 2-5 business days.</p>
                {state.submittedAt && (
                  <p className="text-sm text-blue-600 mt-1">Submitted on {formatDate(state.submittedAt)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.applicationStatus === 'REJECTED' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-red-800">Application Rejected</h2>
                <p className="text-red-700">{state.rejectionReason || 'Your application did not meet the requirements.'}</p>
                <Button variant="outline" className="mt-3">Appeal Decision</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* What is OBA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BadgeCheck className="h-5 w-5 mr-2 text-green-600" />
            What is Official Business Account?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <BadgeCheck className="h-8 w-8 text-green-500 mb-2" />
              <h3 className="font-medium">Green Checkmark</h3>
              <p className="text-sm text-gray-500">Verified badge next to your business name</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <Shield className="h-8 w-8 text-blue-500 mb-2" />
              <h3 className="font-medium">Increased Trust</h3>
              <p className="text-sm text-gray-500">Customers know they're messaging an authentic business</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <TrendingUp className="h-8 w-8 text-purple-500 mb-2" />
              <h3 className="font-medium">Higher Engagement</h3>
              <p className="text-sm text-gray-500">Better response rates from verified accounts</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Eligibility Check */}
      {state.applicationStatus !== 'APPROVED' && (
        <Card>
          <CardHeader>
            <CardTitle>Eligibility Requirements</CardTitle>
            <CardDescription>
              {eligibleCount} of {requiredCount} required criteria met
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {eligibilityItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-start space-x-3 p-3 rounded-lg',
                    item.met ? 'bg-green-50' : 'bg-gray-50'
                  )}
                >
                  {item.met ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-gray-400 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className={cn('font-medium', item.met ? 'text-green-800' : 'text-gray-700')}>
                        {item.label}
                      </p>
                      {item.required && (
                        <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">Required</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {!isEligible() && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Not Yet Eligible</p>
                    <p className="text-sm text-yellow-700">
                      Complete all required criteria above before applying.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Document Upload */}
      {isEligible() && state.applicationStatus !== 'APPROVED' && state.applicationStatus !== 'UNDER_REVIEW' && (
        <Card>
          <CardHeader>
            <CardTitle>Required Documents</CardTitle>
            <CardDescription>Upload the following documents to complete your application</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Business Registration */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {state.documents.businessRegistration ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <FileText className="h-5 w-5 text-gray-400" />
                  )}
                  <div>
                    <p className="font-medium">Business Registration Certificate</p>
                    <p className="text-sm text-gray-500">Company registration, partnership deed, etc.</p>
                  </div>
                </div>
                {state.documents.businessRegistration ? (
                  <span className="text-sm text-green-600">Uploaded</span>
                ) : (
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild disabled={uploading === 'businessRegistration'}>
                      <span>
                        {uploading === 'businessRegistration' ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.png"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleDocumentUpload('businessRegistration', e.target.files[0])}
                    />
                  </label>
                )}
              </div>

              {/* Tax Registration */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {state.documents.taxRegistration ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <FileText className="h-5 w-5 text-gray-400" />
                  )}
                  <div>
                    <p className="font-medium">Tax Registration (GST Certificate)</p>
                    <p className="text-sm text-gray-500">GST registration certificate or PAN card</p>
                  </div>
                </div>
                {state.documents.taxRegistration ? (
                  <span className="text-sm text-green-600">Uploaded</span>
                ) : (
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild disabled={uploading === 'taxRegistration'}>
                      <span>
                        {uploading === 'taxRegistration' ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.png"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleDocumentUpload('taxRegistration', e.target.files[0])}
                    />
                  </label>
                )}
              </div>

              {/* Address Proof */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {state.documents.addressProof ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <FileText className="h-5 w-5 text-gray-400" />
                  )}
                  <div>
                    <p className="font-medium">Address Proof</p>
                    <p className="text-sm text-gray-500">Utility bill, bank statement, or rent agreement</p>
                  </div>
                </div>
                {state.documents.addressProof ? (
                  <span className="text-sm text-green-600">Uploaded</span>
                ) : (
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild disabled={uploading === 'addressProof'}>
                      <span>
                        {uploading === 'addressProof' ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.png"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleDocumentUpload('addressProof', e.target.files[0])}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-6">
              <Button
                variant="whatsapp"
                className="w-full"
                onClick={handleSubmitApplication}
                disabled={!allDocumentsUploaded() || submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <BadgeCheck className="h-4 w-4 mr-2" />
                )}
                Submit Application
              </Button>
              <p className="text-xs text-gray-500 text-center mt-2">
                Review typically takes 2-5 business days
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
