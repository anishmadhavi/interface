'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Phone, 
  ArrowLeft, 
  ArrowRight, 
  Loader2, 
  Check, 
  Copy, 
  RefreshCw,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

type Step = 'purchase' | 'verify' | 'complete';

export default function VirtualSimPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('purchase');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [virtualNumber, setVirtualNumber] = useState<string | null>(null);
  const [otp, setOtp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkingOtp, setCheckingOtp] = useState(false);

  useEffect(() => {
    const getOrgId = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('organization_id, organizations(virtual_number)')
          .eq('auth_id', user.id)
          .maybeSingle();

        if (userData?.organization_id) {
          setOrganizationId(userData.organization_id);
          
          // Check if already has virtual number
          if (userData.organizations?.virtual_number) {
            setVirtualNumber(userData.organizations.virtual_number);
            setStep('verify');
          }
        }
      }
    };
    getOrgId();
  }, []);

  // Poll for OTP when on verify step
  useEffect(() => {
    if (step !== 'verify' || !organizationId) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/twilio/check-otp?organizationId=${organizationId}`);
        const data = await response.json();
        if (data.otp) {
          setOtp(data.otp);
        }
      } catch (err) {
        console.error('Error checking OTP:', err);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [step, organizationId]);

  const handlePurchaseNumber = async () => {
    if (!organizationId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/twilio/buy-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to purchase number');
        return;
      }

      setVirtualNumber(result.phoneNumber);
      setStep('verify');
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleManualOtpCheck = async () => {
    if (!organizationId) return;

    setCheckingOtp(true);
    try {
      const response = await fetch(`/api/twilio/check-otp?organizationId=${organizationId}`);
      const data = await response.json();
      if (data.otp) {
        setOtp(data.otp);
      }
    } catch (err) {
      console.error('Error checking OTP:', err);
    } finally {
      setCheckingOtp(false);
    }
  };

  const copyOtp = () => {
    if (otp) {
      navigator.clipboard.writeText(otp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyNumber = () => {
    if (virtualNumber) {
      navigator.clipboard.writeText(virtualNumber);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    
    // Update organization
    const supabase = createClient();
    await supabase
      .from('organizations')
      .update({ 
        onboarding_step: 3,
        whatsapp_connected: true 
      })
      .eq('id', organizationId);

    router.push('/embedded-signup?hasNumber=true');
  };

  // Step 1: Purchase
  if (step === 'purchase') {
    return (
      <div className="max-w-xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => router.push('/select-mode')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to options
        </Button>

        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center mb-4">
            <Phone className="h-10 w-10 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Get a Virtual Number</h1>
          <p className="text-gray-600 mt-2">
            Purchase a dedicated US phone number for your WhatsApp Business
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Virtual Number Benefits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Instant Activation</p>
                  <p className="text-sm text-gray-500">Get your number immediately, no waiting</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Auto OTP Capture</p>
                  <p className="text-sm text-gray-500">Verification codes appear in your dashboard automatically</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">No Personal SIM Required</p>
                  <p className="text-sm text-gray-500">Keep your personal number separate</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                {error}
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600">Monthly Cost</span>
                <span className="text-2xl font-bold">₹200<span className="text-sm font-normal text-gray-500">/month</span></span>
              </div>
              
              <Button 
                className="w-full" 
                variant="whatsapp" 
                size="lg"
                onClick={handlePurchaseNumber}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Purchasing number...
                  </>
                ) : (
                  <>
                    Purchase Virtual Number
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-500 text-center mt-3">
                Charged to your wallet balance. You can cancel anytime.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Verify
  if (step === 'verify') {
    return (
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <Check className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Number Purchased!</h1>
          <p className="text-gray-600 mt-2">
            Now connect it to WhatsApp Business API
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your Virtual Number</CardTitle>
            <CardDescription>Use this number in the Meta Business verification</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-2xl font-mono font-bold">{virtualNumber}</span>
              <Button variant="outline" size="sm" onClick={copyNumber}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Verification Code</CardTitle>
            <CardDescription>
              When Meta sends an SMS, the code will appear here automatically
            </CardDescription>
          </CardHeader>
          <CardContent>
            {otp ? (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div>
                  <p className="text-sm text-green-700">Your verification code:</p>
                  <span className="text-3xl font-mono font-bold text-green-800">{otp}</span>
                </div>
                <Button variant="outline" size="sm" onClick={copyOtp}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <div className="text-center p-6">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Waiting for verification SMS...</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleManualOtpCheck}
                  disabled={checkingOtp}
                  className="mt-2"
                >
                  {checkingOtp ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Check manually
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-whatsapp text-white flex items-center justify-center text-sm">1</div>
              <div>
                <p className="font-medium">Open Meta Business Suite</p>
                <a
                  href="https://business.facebook.com/settings/whatsapp-business-accounts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-whatsapp hover:underline inline-flex items-center"
                >
                  Go to WhatsApp Settings
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-whatsapp text-white flex items-center justify-center text-sm">2</div>
              <div>
                <p className="font-medium">Add Phone Number</p>
                <p className="text-sm text-gray-500">Enter your virtual number: {virtualNumber}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-whatsapp text-white flex items-center justify-center text-sm">3</div>
              <div>
                <p className="font-medium">Enter Verification Code</p>
                <p className="text-sm text-gray-500">Copy the code from above when it appears</p>
              </div>
            </div>

            <Button 
              className="w-full mt-4" 
              variant="whatsapp"
              onClick={handleComplete}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <>
                  Continue to Connect WhatsApp
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
