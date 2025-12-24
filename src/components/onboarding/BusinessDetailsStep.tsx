'use client';

import { useState } from 'react';
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
      // Call API route to create organization (uses service role)
      const response = await fetch('/api/onboarding/create-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: data.businessName,
          businessCategory: data.businessCategory,
          website: data.website,
          userId,
          userEmail,
          userName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to create organization');
        return;
      }

      updateData({ organizationId: result.organizationId });
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
