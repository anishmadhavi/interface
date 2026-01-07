'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  ArrowLeft, 
  ExternalLink,
  CheckCircle2,
  Copy,
  RefreshCw
} from 'lucide-react';
import type { OnboardingData } from '@/app/(onboarding)/onboarding/page';

interface ConnectWhatsAppStepProps {
  data: OnboardingData;
  onComplete: () => void;
  onBack: () => void;
}

export function ConnectWhatsAppStep({
  data,
  onComplete,
  onBack,
}: ConnectWhatsAppStepProps) {
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkingOtp, setCheckingOtp] = useState(false);

  const phoneNumber = data.numberOption === 'own' 
    ? data.ownPhoneNumber 
    : data.virtualNumber;

  const copyToClipboard = () => {
    if (otpCode) {
      navigator.clipboard.writeText(otpCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const checkForOtp = async () => {
    if (data.numberOption !== 'virtual') return;
    
    setCheckingOtp(true);
    try {
      const response = await fetch(`/api/twilio/check-otp?organizationId=${data.organizationId}`);
      const result = await response.json();
      
      if (result.otp) {
        setOtpCode(result.otp);
      }
    } catch (err) {
      console.error('Error checking OTP:', err);
    } finally {
      setCheckingOtp(false);
    }
  };

  const handleComplete = () => {
    setLoading(true);
    // In a real implementation, you would verify the WhatsApp connection here
    setTimeout(() => {
      onComplete();
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Connect WhatsApp Business</h2>
        <p className="text-gray-600 mt-1">Follow the steps to link your WhatsApp Business account</p>
      </div>

      {/* Phone Number Display */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-green-700">Your WhatsApp Business Number</p>
            <p className="text-xl font-mono font-semibold text-green-900">{phoneNumber}</p>
          </div>
          {data.numberOption === 'virtual' && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
              Virtual Number
            </span>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Setup Instructions:</h3>
        
        <div className="space-y-3">
          <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-whatsapp text-white flex items-center justify-center text-sm font-medium">
              1
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Go to Meta Business Suite</p>
              <p className="text-sm text-gray-600 mt-1">
                Open the Meta Business Suite and navigate to WhatsApp Business settings.
              </p>
              <a
                href="https://business.facebook.com/settings/whatsapp-business-accounts"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-whatsapp hover:underline mt-2"
              >
                Open Meta Business Suite
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-whatsapp text-white flex items-center justify-center text-sm font-medium">
              2
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Add Phone Number</p>
              <p className="text-sm text-gray-600 mt-1">
                Click &quot;Add Phone Number&quot; and enter: <strong className="font-mono">{phoneNumber}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-whatsapp text-white flex items-center justify-center text-sm font-medium">
              3
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Verify with SMS Code</p>
              <p className="text-sm text-gray-600 mt-1">
                {data.numberOption === 'own' 
                  ? 'You will receive an SMS with a verification code on your phone.'
                  : 'The verification code will appear below automatically.'}
              </p>
              
              {/* Virtual Number OTP Section */}
              {data.numberOption === 'virtual' && (
                <div className="mt-3 p-3 bg-white border rounded-lg">
                  {otpCode ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Your verification code:</p>
                        <p className="text-2xl font-mono font-bold text-gray-900">{otpCode}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={copyToClipboard}
                      >
                        {copied ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm text-gray-500 mb-2">
                        Waiting for verification SMS...
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={checkForOtp}
                        disabled={checkingOtp}
                      >
                        {checkingOtp ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Check for code
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-whatsapp text-white flex items-center justify-center text-sm font-medium">
              4
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Complete Setup</p>
              <p className="text-sm text-gray-600 mt-1">
                After verification, return here and click &quot;Complete Setup&quot; to finish.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> You can complete the WhatsApp Business setup later from Settings. 
          Click &quot;Complete Setup&quot; to access your dashboard now.
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack} disabled={loading}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          variant="whatsapp"
          onClick={handleComplete}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Completing...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Complete Setup
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
