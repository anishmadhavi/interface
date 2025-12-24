'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  ArrowLeft, 
  Smartphone, 
  Phone, 
  Check, 
  ShoppingCart,
  AlertCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OnboardingData } from '@/app/(onboarding)/onboarding/page';

interface NumberSelectionStepProps {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function NumberSelectionStep({
  data,
  updateData,
  onNext,
  onBack,
}: NumberSelectionStepProps) {
  const [loading, setLoading] = useState(false);
  const [buyingNumber, setBuyingNumber] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuyVirtualNumber = async () => {
    setBuyingNumber(true);
    setError(null);

    try {
      const response = await fetch('/api/twilio/buy-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: data.organizationId }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to purchase number');
        return;
      }

      updateData({
        numberOption: 'virtual',
        virtualNumber: result.phoneNumber,
        virtualNumberSid: result.sid,
      });
    } catch (err) {
      setError('Failed to purchase virtual number. Please try again.');
    } finally {
      setBuyingNumber(false);
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    setError(null);

    // Validation
    if (data.numberOption === 'own' && !data.ownPhoneNumber) {
      setError('Please enter your WhatsApp Business number');
      setLoading(false);
      return;
    }

    if (data.numberOption === 'virtual' && !data.virtualNumber) {
      setError('Please purchase a virtual number first');
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      
      const updatePayload: Record<string, any> = {
        onboarding_step: 3,
      };

      if (data.numberOption === 'own') {
        updatePayload.phone_number = data.ownPhoneNumber;
      } else {
        updatePayload.virtual_number = data.virtualNumber;
        updatePayload.virtual_number_provider = 'TWILIO';
        updatePayload.virtual_number_sid = data.virtualNumberSid;
        updatePayload.virtual_number_monthly_cost = 150;
      }

      // FIX: Cast query builder to 'any' to bypass missing table types
      const { error: updateError } = await (supabase
        .from('organizations') as any)
        .update(updatePayload)
        .eq('id', data.organizationId);

      if (updateError) {
        setError('Failed to save number selection');
        return;
      }

      onNext();
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Set up your phone number</h2>
        <p className="text-gray-600 mt-1">Choose how you want to connect to WhatsApp Business</p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Option 1: Own Number */}
        <div
          onClick={() => updateData({ numberOption: 'own' })}
          className={cn(
            'relative rounded-xl border-2 p-6 cursor-pointer transition-all',
            data.numberOption === 'own'
              ? 'border-whatsapp bg-green-50'
              : 'border-gray-200 hover:border-gray-300'
          )}
        >
          {data.numberOption === 'own' && (
            <div className="absolute -top-3 -right-3 w-6 h-6 bg-whatsapp rounded-full flex items-center justify-center">
              <Check className="h-4 w-4 text-white" />
            </div>
          )}

          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Smartphone className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Use My Own Number</h3>
              <p className="text-sm text-whatsapp font-medium">Free</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Use your existing phone number for WhatsApp Business. You&apos;ll need to verify it with Meta.
          </p>

          <ul className="text-sm text-gray-500 space-y-1">
            <li className="flex items-center">
              <Check className="h-3 w-3 mr-2 text-gray-400" />
              Use your own SIM card
            </li>
            <li className="flex items-center">
              <Check className="h-3 w-3 mr-2 text-gray-400" />
              Receive verification SMS directly
            </li>
            <li className="flex items-center">
              <Check className="h-3 w-3 mr-2 text-gray-400" />
              No additional charges
            </li>
          </ul>
        </div>

        {/* Option 2: Virtual Number */}
        <div
          onClick={() => updateData({ numberOption: 'virtual' })}
          className={cn(
            'relative rounded-xl border-2 p-6 cursor-pointer transition-all',
            data.numberOption === 'virtual'
              ? 'border-whatsapp bg-green-50'
              : 'border-gray-200 hover:border-gray-300'
          )}
        >
          {data.numberOption === 'virtual' && (
            <div className="absolute -top-3 -right-3 w-6 h-6 bg-whatsapp rounded-full flex items-center justify-center">
              <Check className="h-4 w-4 text-white" />
            </div>
          )}

          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Phone className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Buy a Virtual Number</h3>
              <p className="text-sm text-purple-600 font-medium">₹150/month</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            We&apos;ll provide you with a dedicated US phone number. Verification codes will appear automatically in your dashboard.
          </p>

          <ul className="text-sm text-gray-500 space-y-1">
            <li className="flex items-center">
              <Check className="h-3 w-3 mr-2 text-gray-400" />
              Instant number assignment
            </li>
            <li className="flex items-center">
              <Check className="h-3 w-3 mr-2 text-gray-400" />
              Auto-capture OTP codes
            </li>
            <li className="flex items-center">
              <Check className="h-3 w-3 mr-2 text-gray-400" />
              No personal SIM required
            </li>
          </ul>
        </div>
      </div>

      {/* Own Number Input */}
      {data.numberOption === 'own' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <Label htmlFor="ownNumber">Your WhatsApp Business Number</Label>
          <Input
            id="ownNumber"
            type="tel"
            placeholder="+91 98765 43210"
            value={data.ownPhoneNumber}
            onChange={(e) => updateData({ ownPhoneNumber: e.target.value })}
            disabled={loading}
          />
          <p className="text-xs text-gray-500">
            Enter the phone number you want to use for WhatsApp Business API. 
            Include country code (e.g., +91 for India).
          </p>
        </div>
      )}

      {/* Virtual Number Section */}
      {data.numberOption === 'virtual' && (
        <div className="bg-gray-50 rounded-lg p-4">
          {data.virtualNumber ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Your Virtual Number</Label>
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                  Purchased ✓
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex-1 bg-white border rounded-lg p-3">
                  <p className="text-lg font-mono font-semibold text-gray-900">
                    {data.virtualNumber}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                This number is ready to use. When Meta sends verification SMS, the code will appear automatically in your dashboard.
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 mb-4">
                Click below to purchase a dedicated US phone number for ₹150/month
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleBuyVirtualNumber}
                disabled={buyingNumber}
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                {buyingNumber ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Purchasing number...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Buy Virtual Number - ₹150/month
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack} disabled={loading}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          variant="whatsapp"
          onClick={handleContinue}
          disabled={loading || (data.numberOption === 'virtual' && !data.virtualNumber)}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </div>
    </div>
  );
}
