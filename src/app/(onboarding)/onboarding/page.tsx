'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { StepIndicator } from '@/components/onboarding/StepIndicator';
import { BusinessDetailsStep } from '@/components/onboarding/BusinessDetailsStep';
import { PlanSelectionStep } from '@/components/onboarding/PlanSelectionStep';
import { NumberSelectionStep } from '@/components/onboarding/NumberSelectionStep';
import { ConnectWhatsAppStep } from '@/components/onboarding/ConnectWhatsAppStep';
import { Loader2 } from 'lucide-react';

const STEPS = [
  { id: 1, name: 'Business Details', description: 'Tell us about your business' },
  { id: 2, name: 'Select Plan', description: 'Choose the right plan for you' },
  { id: 3, name: 'Phone Number', description: 'Set up your WhatsApp number' },
  { id: 4, name: 'Connect WhatsApp', description: 'Link your WhatsApp Business' },
];

export interface OnboardingData {
  // Business details
  businessName: string;
  businessCategory: string;
  website: string;
  
  // Plan
  selectedPlanId: string;
  
  // Number
  numberOption: 'own' | 'virtual';
  ownPhoneNumber: string;
  virtualNumber: string | null;
  virtualNumberSid: string | null;
  
  // Organization
  organizationId: string | null;
}

const initialData: OnboardingData = {
  businessName: '',
  businessCategory: '',
  website: '',
  selectedPlanId: '',
  numberOption: 'own',
  ownPhoneNumber: '',
  virtualNumber: null,
  virtualNumberSid: null,
  organizationId: null,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email || null);
      setUserName(user.user_metadata?.full_name || null);

// Check if user already has an organization
      const { data: existingUser } = await supabase
        .from('users')
        .select('organization_id, organizations(onboarding_completed, onboarding_step)')
        .eq('auth_id', user.id)
        .single();

      // FIX: Handle organizations being returned as an array
      const orgData = Array.isArray(existingUser?.organizations) 
        ? existingUser.organizations[0] 
        : existingUser?.organizations;

      // Use orgData instead of existingUser.organizations directly
      // @ts-ignore
      if (orgData?.onboarding_completed) {
        router.push('/dashboard');
        return;
      }

      if (existingUser?.organization_id) {
        setData(prev => ({ ...prev, organizationId: existingUser.organization_id }));
        // @ts-ignore
        setCurrentStep(orgData?.onboarding_step || 1);
      }

      setLoading(false);
    };

    checkUser();
  }, [router]);

  const updateData = (newData: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...newData }));
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
      saveProgress(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const saveProgress = async (step: number) => {
    if (!data.organizationId) return;
    
    const supabase = createClient();
    await supabase
      .from('organizations')
      .update({ onboarding_step: step })
      .eq('id', data.organizationId);
  };

  const completeOnboarding = async () => {
    if (!data.organizationId) return;
    
    const supabase = createClient();
    await supabase
      .from('organizations')
      .update({ 
        onboarding_completed: true,
        onboarding_step: 4,
      })
      .eq('id', data.organizationId);

    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <StepIndicator steps={STEPS} currentStep={currentStep} />

      {/* Step Content */}
      <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8">
        {currentStep === 1 && (
          <BusinessDetailsStep
            data={data}
            updateData={updateData}
            onNext={nextStep}
            userId={userId!}
            userEmail={userEmail!}
            userName={userName}
          />
        )}
        
        {currentStep === 2 && (
          <PlanSelectionStep
            data={data}
            updateData={updateData}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}
        
        {currentStep === 3 && (
          <NumberSelectionStep
            data={data}
            updateData={updateData}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}
        
        {currentStep === 4 && (
          <ConnectWhatsAppStep
            data={data}
            onComplete={completeOnboarding}
            onBack={prevStep}
          />
        )}
      </div>
    </div>
  );
}
