'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  ArrowRight, 
  Loader2, 
  Check, 
  AlertCircle,
  ExternalLink,
  Phone,
  Shield,
  Zap
} from 'lucide-react';

declare global {
  interface Window {
    FB: {
      init: (params: { appId: string; version: string }) => void;
      login: (callback: (response: FBLoginResponse) => void, params: { config_id: string; response_type: string; override_default_response_type: boolean; extras: { setup: object } }) => void;
    };
    fbAsyncInit: () => void;
  }
}

interface FBLoginResponse {
  authResponse?: {
    code: string;
    accessToken: string;
  };
  status: string;
}

export default function EmbeddedSignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMigration = searchParams.get('migrate') === 'true';
  const hasVirtualNumber = searchParams.get('hasNumber') === 'true';

  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sdkLoaded, setSdkLoaded] = useState(false);

  // Load Facebook SDK
  useEffect(() => {
    const loadFacebookSDK = () => {
      if (window.FB) {
        setSdkLoaded(true);
        return;
      }

      window.fbAsyncInit = function() {
        window.FB.init({
          appId: process.env.NEXT_PUBLIC_META_APP_ID || '',
          version: 'v19.0'
        });
        setSdkLoaded(true);
      };

      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    };

    loadFacebookSDK();
  }, []);

  useEffect(() => {
    const getOrgId = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('organization_id')
          .eq('auth_id', user.id)
          .maybeSingle();

        if (userData?.organization_id) {
          setOrganizationId(userData.organization_id);
        }
      }
    };
    getOrgId();
  }, []);

  const launchWhatsAppSignup = useCallback(() => {
    if (!window.FB || !sdkLoaded) {
      setError('Facebook SDK not loaded. Please refresh the page.');
      return;
    }

    setConnecting(true);
    setError(null);

    window.FB.login(
      function(response: FBLoginResponse) {
        if (response.authResponse) {
          const code = response.authResponse.code;
          // Send code to backend to exchange for access token
          handleFacebookCallback(code);
        } else {
          setConnecting(false);
          setError('Facebook login was cancelled or failed');
        }
      },
      {
        config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID || '',
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {}
        }
      }
    );
  }, [sdkLoaded]);

  const handleFacebookCallback = async (code: string) => {
    try {
      const response = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code, 
          organizationId,
          phoneNumber: phoneNumber || undefined
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to connect WhatsApp');
        setConnecting(false);
        return;
      }

      setSuccess(true);
      setConnecting(false);

      // Wait a moment then redirect
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (err) {
      setError('An unexpected error occurred');
      setConnecting(false);
    }
  };

  const handleManualComplete = async () => {
    setLoading(true);
    
    const supabase = createClient();
    await supabase
      .from('organizations')
      .update({ 
        onboarding_completed: true,
        onboarding_step: 4,
        phone_number: phoneNumber || null
      })
      .eq('id', organizationId);

    router.push('/dashboard');
  };

  if (success) {
    return (
      <div className="max-w-xl mx-auto text-center">
        <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <Check className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">WhatsApp Connected!</h1>
        <p className="text-gray-600 mb-6">Your WhatsApp Business account is now connected to Interface.</p>
        <Loader2 className="h-6 w-6 animate-spin text-whatsapp mx-auto" />
        <p className="text-sm text-gray-500 mt-2">Redirecting to dashboard...</p>
      </div>
    );
  }

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
        <h1 className="text-2xl font-bold text-gray-900">
          {isMigration ? 'Migrate Your WhatsApp Number' : 'Connect WhatsApp Business'}
        </h1>
        <p className="text-gray-600 mt-2">
          {isMigration 
            ? 'Transfer your existing WhatsApp Business number from another provider'
            : 'Link your WhatsApp Business account using Facebook Login'
          }
        </p>
      </div>

      {isMigration && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Migration Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-orange-900 space-y-2">
            <p><strong>Before you continue:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Log into your current provider (Wati, Interakt, etc.)</li>
              <li>Disable two-factor authentication on your WhatsApp number</li>
              <li>Delete the number from your current provider</li>
              <li>Wait 5-10 minutes for the number to be released</li>
              <li>Then click &quot;Connect with Facebook&quot; below</li>
            </ol>
          </CardContent>
        </Card>
      )}

      {!hasVirtualNumber && !isMigration && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your Phone Number</CardTitle>
            <CardDescription>Enter the phone number you want to use for WhatsApp Business</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (with country code)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Make sure you have access to this number to receive the verification SMS.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Connect with Facebook</CardTitle>
          <CardDescription>
            Click the button below to open the Meta Business setup wizard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-green-500" />
              <span>Secure OAuth connection</span>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span>Takes about 2-3 minutes</span>
            </div>
            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4 text-blue-500" />
              <span>You&apos;ll verify your phone number with Meta</span>
            </div>
          </div>

          <Button
            className="w-full bg-[#1877F2] hover:bg-[#166FE5]"
            size="lg"
            onClick={launchWhatsAppSignup}
            disabled={connecting || !sdkLoaded}
          >
            {connecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Connect with Facebook
              </>
            )}
          </Button>

          {!sdkLoaded && (
            <p className="text-xs text-gray-500 text-center">
              Loading Facebook SDK...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Manual completion option */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Having trouble?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            If you&apos;re unable to complete the Facebook connection, you can skip this step and configure WhatsApp later from Settings.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleManualComplete}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <>
                Skip for now
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Help link */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <a
          href="https://docs.interface.techsoftwares.in/whatsapp-setup"
          target="_blank"
          rel="noopener noreferrer"
          className="text-whatsapp hover:underline inline-flex items-center"
        >
          Need help? View our setup guide
          <ExternalLink className="h-3 w-3 ml-1" />
        </a>
      </div>
    </div>
  );
}
