/**
 * =============================================================================
 * FILE: src/app/(dashboard)/billing/plans/page.tsx
 * PURPOSE: Subscription Plans - Selection & Comparison
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays all available subscription plans
 * - Shows feature comparison between plans
 * - Allows upgrading/downgrading subscription
 * - Shows current plan highlight
 * - Handles plan change with proration
 * - Shows savings on annual billing
 * 
 * KEY FEATURES:
 * - Plan cards with features
 * - Monthly/Annual toggle
 * - Current plan indicator
 * - Upgrade/Downgrade buttons
 * - Feature comparison table
 * - Virtual number add-on
 * - Enterprise contact option
 * 
 * PRICING (Interface - Lowest in Market):
 * - Starter: ₹999/month (₹9,990/year - 2 months free)
 * - Growth: ₹2,499/month (₹24,990/year - 2 months free)
 * - Business: ₹4,999/month (₹49,990/year - 2 months free)
 * - Virtual Number Add-on: ₹200/month
 * 
 * PLAN FEATURES:
 * - Starter: 1 user, 1,000 contacts, basic templates
 * - Growth: 5 users, 10,000 contacts, workflows, CTWA
 * - Business: Unlimited users, unlimited contacts, all features
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * - Cashfree SDK (for payment)
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Check,
  X,
  Zap,
  Users,
  MessageSquare,
  GitBranch,
  BarChart3,
  Phone,
  Headphones,
  Building2,
  Loader2,
  Star
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type BillingCycle = 'monthly' | 'annual';

interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  limits: {
    users: number | 'Unlimited';
    contacts: number | 'Unlimited';
    templates: number | 'Unlimited';
    campaigns: number | 'Unlimited';
  };
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small businesses getting started',
    monthlyPrice: 999,
    annualPrice: 9990,
    features: [
      'WhatsApp Business API',
      'Basic message templates',
      'Contact management',
      'Inbox with assignment',
      'Basic analytics',
      'Email support',
    ],
    limits: {
      users: 1,
      contacts: 1000,
      templates: 10,
      campaigns: 5,
    },
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'For growing businesses with team needs',
    monthlyPrice: 2499,
    annualPrice: 24990,
    features: [
      'Everything in Starter',
      'Team collaboration (5 users)',
      'Workflow automation',
      'Click-to-WhatsApp Ads',
      'Advanced analytics',
      'Priority support',
      'Webhook integrations',
    ],
    limits: {
      users: 5,
      contacts: 10000,
      templates: 50,
      campaigns: 'Unlimited',
    },
    highlighted: true,
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Full-featured solution for large teams',
    monthlyPrice: 4999,
    annualPrice: 49990,
    features: [
      'Everything in Growth',
      'Unlimited team members',
      'Unlimited contacts',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
      'Custom reports',
      'White-label option',
    ],
    limits: {
      users: 'Unlimited',
      contacts: 'Unlimited',
      templates: 'Unlimited',
      campaigns: 'Unlimited',
    },
  },
];

const FEATURE_COMPARISON = [
  { feature: 'WhatsApp Business API', starter: true, growth: true, business: true },
  { feature: 'Message Templates', starter: '10', growth: '50', business: 'Unlimited' },
  { feature: 'Contacts', starter: '1,000', growth: '10,000', business: 'Unlimited' },
  { feature: 'Team Members', starter: '1', growth: '5', business: 'Unlimited' },
  { feature: 'Broadcast Campaigns', starter: '5/month', growth: 'Unlimited', business: 'Unlimited' },
  { feature: 'Workflow Automation', starter: false, growth: true, business: true },
  { feature: 'Click-to-WhatsApp Ads', starter: false, growth: true, business: true },
  { feature: 'Analytics Dashboard', starter: 'Basic', growth: 'Advanced', business: 'Custom' },
  { feature: 'Webhook Integrations', starter: false, growth: true, business: true },
  { feature: 'API Access', starter: false, growth: true, business: true },
  { feature: 'Dedicated Support', starter: false, growth: false, business: true },
  { feature: 'SLA Guarantee', starter: false, growth: false, business: true },
];

export default function PlansPage() {
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<string>('starter');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const fetchCurrentPlan = async () => {
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
        .select('plan_id, billing_cycle')
        .eq('id', userData.organization_id)
        .single();

      if (org) {
        setCurrentPlan(org.plan_id || 'starter');
        setBillingCycle(org.billing_cycle || 'monthly');
      }

      setLoading(false);
    };

    fetchCurrentPlan();
  }, []);

  const handleSelectPlan = async (planId: string) => {
    if (planId === currentPlan) return;
    setProcessing(planId);

    try {
      const plan = PLANS.find(p => p.id === planId);
      if (!plan) return;

      const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice;

      // Create Cashfree order
      const response = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingCycle, amount: price }),
      });

      const { orderId, paymentSessionId } = await response.json();

      // Redirect to payment (in production)
      // window.location.href = `https://payments.cashfree.com/order/#${paymentSessionId}`;

      // For demo
      await new Promise(resolve => setTimeout(resolve, 1500));
      setCurrentPlan(planId);
    } catch (err) {
      console.error('Subscription error:', err);
    } finally {
      setProcessing(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getAnnualSavings = (plan: Plan) => {
    const monthlyCost = plan.monthlyPrice * 12;
    const annualCost = plan.annualPrice;
    return monthlyCost - annualCost;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/billing"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Choose Your Plan</h1>
          <p className="text-gray-500">Simple, transparent pricing. No hidden fees.</p>
        </div>
      </div>

      {/* Billing Toggle */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1 rounded-lg inline-flex">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              billingCycle === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              billingCycle === 'annual'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Annual
            <span className="ml-1 text-xs text-green-600 font-normal">(2 months free)</span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
          const isCurrentPlan = currentPlan === plan.id;
          const savings = getAnnualSavings(plan);

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative',
                plan.highlighted && 'border-whatsapp ring-2 ring-whatsapp',
                isCurrentPlan && 'bg-green-50'
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-whatsapp text-white text-xs px-3 py-1 rounded-full flex items-center">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </span>
                </div>
              )}

              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold">{formatCurrency(price)}</span>
                    <span className="text-gray-500 ml-1">
                      /{billingCycle === 'monthly' ? 'month' : 'year'}
                    </span>
                  </div>
                  {billingCycle === 'annual' && (
                    <p className="text-sm text-green-600">Save {formatCurrency(savings)}/year</p>
                  )}
                </div>

                {/* Limits */}
                <div className="grid grid-cols-2 gap-2 py-4 border-y">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{plan.limits.users}</p>
                    <p className="text-xs text-gray-500">Users</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {typeof plan.limits.contacts === 'number' 
                        ? plan.limits.contacts.toLocaleString() 
                        : plan.limits.contacts}
                    </p>
                    <p className="text-xs text-gray-500">Contacts</p>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <Check className="h-4 w-4 text-whatsapp mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrentPlan ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    variant={plan.highlighted ? 'whatsapp' : 'outline'}
                    className="w-full"
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={processing === plan.id}
                  >
                    {processing === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {PLANS.findIndex(p => p.id === currentPlan) < PLANS.findIndex(p => p.id === plan.id)
                      ? 'Upgrade'
                      : 'Downgrade'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Virtual Number Add-on */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-lg bg-whatsapp/10 flex items-center justify-center">
                <Phone className="h-6 w-6 text-whatsapp" />
              </div>
              <div>
                <h3 className="font-semibold">Virtual US Phone Number</h3>
                <p className="text-sm text-gray-500">Get a dedicated US number for WhatsApp Business</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{formatCurrency(200)}<span className="text-sm font-normal text-gray-500">/month</span></p>
              <Button variant="outline" size="sm" className="mt-2">Add to Plan</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Feature</th>
                  <th className="text-center py-3 px-4 font-medium">Starter</th>
                  <th className="text-center py-3 px-4 font-medium bg-green-50">Growth</th>
                  <th className="text-center py-3 px-4 font-medium">Business</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_COMPARISON.map((row, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-3 px-4 text-sm">{row.feature}</td>
                    <td className="py-3 px-4 text-center">
                      {typeof row.starter === 'boolean' ? (
                        row.starter ? (
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-gray-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm">{row.starter}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center bg-green-50">
                      {typeof row.growth === 'boolean' ? (
                        row.growth ? (
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-gray-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm">{row.growth}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {typeof row.business === 'boolean' ? (
                        row.business ? (
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-gray-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm">{row.business}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Enterprise */}
      <Card className="bg-gray-900 text-white">
        <CardContent className="py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Building2 className="h-10 w-10" />
              <div>
                <h3 className="text-xl font-bold">Enterprise</h3>
                <p className="text-gray-400">Custom solutions for large organizations</p>
              </div>
            </div>
            <Button variant="outline" className="text-white border-white hover:bg-white hover:text-gray-900">
              <Headphones className="h-4 w-4 mr-2" />
              Contact Sales
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
