'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Check, Loader2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OnboardingData } from '@/app/(onboarding)/onboarding/page';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthly_price: number;
  max_contacts: number;
  max_team_members: number;
  max_templates: number;
  features: Record<string, boolean>;
}

interface PlanSelectionStepProps {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const FEATURE_LABELS: Record<string, string> = {
  inbox: 'Team Inbox',
  templates: 'Message Templates',
  campaigns: 'Broadcast Campaigns',
  basic_analytics: 'Basic Analytics',
  analytics: 'Advanced Analytics',
  advanced_analytics: 'Advanced Analytics',
  integrations: 'Integrations',
  api_access: 'API Access',
  priority_support: 'Priority Support',
  dedicated_manager: 'Dedicated Manager',
  custom_features: 'Custom Features',
};

export function PlanSelectionStep({
  data,
  updateData,
  onNext,
  onBack,
}: PlanSelectionStepProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      const supabase = createClient();
      const { data: plansData, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        setError('Failed to load plans');
      } else {
        setPlans(plansData || []);
        // Auto-select first plan if none selected
        if (!data.selectedPlanId && plansData && plansData.length > 0) {
          updateData({ selectedPlanId: plansData[0].id });
        }
      }
      setLoading(false);
    };

    fetchPlans();
  }, []);

  const handleContinue = async () => {
    if (!data.selectedPlanId || !data.organizationId) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          subscription_plan_id: data.selectedPlanId,
          onboarding_step: 2,
        })
        .eq('id', data.organizationId);

      if (updateError) {
        setError('Failed to save plan selection');
        return;
      }

      onNext();
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return '1M+';
    if (num >= 1000) return `${num / 1000}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Choose your plan</h2>
        <p className="text-gray-600 mt-1">Start with a 14-day free trial. No credit card required.</p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            onClick={() => updateData({ selectedPlanId: plan.id })}
            className={cn(
              'relative rounded-xl border-2 p-5 cursor-pointer transition-all',
              data.selectedPlanId === plan.id
                ? 'border-whatsapp bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            {/* Selected indicator */}
            {data.selectedPlanId === plan.id && (
              <div className="absolute -top-3 -right-3 w-6 h-6 bg-whatsapp rounded-full flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}

            {/* Plan name & price */}
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-2xl font-bold text-gray-900">
                  {formatPrice(plan.monthly_price)}
                </span>
                <span className="text-gray-500">/month</span>
              </div>
            </div>

            {/* Limits */}
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Contacts</span>
                <span className="font-medium">{formatNumber(plan.max_contacts)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Team members</span>
                <span className="font-medium">{plan.max_team_members}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Templates</span>
                <span className="font-medium">{plan.max_templates}</span>
              </div>
            </div>

            {/* Features */}
            <div className="border-t pt-4 space-y-2">
              {Object.entries(plan.features || {}).map(([key, enabled]) => (
                enabled && FEATURE_LABELS[key] && (
                  <div key={key} className="flex items-center text-sm">
                    <Check className="h-4 w-4 text-whatsapp mr-2" />
                    <span className="text-gray-600">{FEATURE_LABELS[key]}</span>
                  </div>
                )
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Trial notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <p className="text-blue-800">
          🎉 All plans include a <strong>14-day free trial</strong>. You won&apos;t be charged until your trial ends.
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack} disabled={saving}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          type="button" 
          variant="whatsapp" 
          onClick={handleContinue} 
          disabled={saving || !data.selectedPlanId}
        >
          {saving ? (
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
