'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Building2, Globe, Tag } from 'lucide-react';
import type { OnboardingData } from '@/app/(onboarding)/onboarding/page';

interface BusinessDetailsStepProps {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  userId: string;
  userEmail: string;
  userName: string | null;
}

const BUSINESS_CATEGORIES = [
  'E-commerce / Retail',
  'Healthcare',
  'Education',
  'Real Estate',
  'Travel & Hospitality',
  'Financial Services',
  'Food & Beverage',
  'Technology',
  'Marketing Agency',
  'Professional Services',
  'Other',
];

export function BusinessDetailsStep({
  data,
  updateData,
  onNext,
  userId,
  userEmail,
  userName,
}: BusinessDetailsStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      
      // Generate slug from business name
      const slug = data.businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        + '-' + Date.now().toString(36);

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: data.businessName,
          slug,
          business_name: data.businessName,
          business_category: data.businessCategory,
          website: data.website || null,
          subscription_status: 'TRIAL',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
          onboarding_step: 1,
        })
        .select()
        .single();

      if (orgError) {
        console.error('Org error:', orgError);
        setError('Failed to create organization');
        return;
      }

      // Create default admin role
      const { data: role, error: roleError } = await supabase
        .from('roles')
        .insert({
          organization_id: org.id,
          name: 'Admin',
          description: 'Full access to all features',
          is_admin: true,
          is_default: true,
          permissions: {
            inbox: { view: true, reply: true, assign: true },
            contacts: { view: true, create: true, edit: true, delete: true, import: true, export: true },
            templates: { view: true, create: true, edit: true, delete: true },
            campaigns: { view: true, create: true, edit: true, delete: true, send: true },
            analytics: { view: true },
            team: { view: true, invite: true, edit: true, remove: true },
            billing: { view: true, manage: true },
            integrations: { view: true, manage: true },
            settings: { view: true, edit: true },
          },
        })
        .select()
        .single();

      if (roleError) {
        console.error('Role error:', roleError);
        setError('Failed to create role');
        return;
      }

      // Create user record
      const { error: userError } = await supabase
        .from('users')
        .insert({
          auth_id: userId,
          organization_id: org.id,
          role_id: role.id,
          email: userEmail,
          full_name: userName || userEmail.split('@')[0],
          is_owner: true,
          is_active: true,
        });

      if (userError) {
        console.error('User error:', userError);
        setError('Failed to create user');
        return;
      }

      updateData({ organizationId: org.id });
      onNext();
    } catch (err) {
      console.error('Error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Tell us about your business</h2>
        <p className="text-gray-600 mt-1">This helps us personalize your experience</p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="businessName" className="flex items-center">
            <Building2 className="h-4 w-4 mr-2 text-gray-500" />
            Business Name *
          </Label>
          <Input
            id="businessName"
            placeholder="Acme Inc"
            value={data.businessName}
            onChange={(e) => updateData({ businessName: e.target.value })}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="businessCategory" className="flex items-center">
            <Tag className="h-4 w-4 mr-2 text-gray-500" />
            Business Category *
          </Label>
          <select
            id="businessCategory"
            value={data.businessCategory}
            onChange={(e) => updateData({ businessCategory: e.target.value })}
            required
            disabled={loading}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select a category</option>
            {BUSINESS_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="website" className="flex items-center">
            <Globe className="h-4 w-4 mr-2 text-gray-500" />
            Website (optional)
          </Label>
          <Input
            id="website"
            type="url"
            placeholder="https://yourcompany.com"
            value={data.website}
            onChange={(e) => updateData({ website: e.target.value })}
            disabled={loading}
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" variant="whatsapp" disabled={loading}>
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
    </form>
  );
}
