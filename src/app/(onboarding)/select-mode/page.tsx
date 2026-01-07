'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Smartphone, 
  Phone, 
  RefreshCw, 
  ArrowRight, 
  Building2,
  Tag,
  Globe,
  Loader2,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NumberOption = 'own' | 'virtual' | 'migrate';

interface BusinessDetails {
  name: string;
  category: string;
  website: string;
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

export default function SelectModePage() {
  const router = useRouter();
  const [step, setStep] = useState<'business' | 'number'>('business');
  const [selectedOption, setSelectedOption] = useState<NumberOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const [business, setBusiness] = useState<BusinessDetails>({
    name: '',
    category: '',
    website: '',
  });

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email || null);
        setUserName(user.user_metadata?.full_name || null);

        // Check if organization already exists
        const { data: userData } = await supabase
          .from('users')
          .select('organization_id')
          .eq('auth_id', user.id)
          .maybeSingle();

        if (userData?.organization_id) {
          setOrganizationId(userData.organization_id);
          setStep('number');
        }
      }
    };
    getUser();
  }, []);

  const handleBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/create-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: business.name,
          businessCategory: business.category,
          website: business.website,
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

      setOrganizationId(result.organizationId);
      setStep('number');
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (option: NumberOption) => {
    setSelectedOption(option);
  };

  const handleContinue = async () => {
    if (!selectedOption || !organizationId) return;

    setLoading(true);

    // Update organization with selected option
    const supabase = createClient();
    await supabase
      .from('organizations')
      .update({ 
        number_setup_method: selectedOption,
        onboarding_step: 2 
      })
      .eq('id', organizationId);

    // Navigate to appropriate page
    switch (selectedOption) {
      case 'own':
        router.push('/embedded-signup');
        break;
      case 'virtual':
        router.push('/virtual-sim');
        break;
      case 'migrate':
        router.push('/embedded-signup?migrate=true');
        break;
    }
  };

  // Step 1: Business Details
  if (step === 'business') {
    return (
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to Interface</h1>
          <p className="text-gray-600 mt-2">Let&apos;s set up your WhatsApp Business account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Business Details</CardTitle>
            <CardDescription>Tell us about your business</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBusinessSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="businessName" className="flex items-center">
                  <Building2 className="h-4 w-4 mr-2 text-gray-500" />
                  Business Name *
                </Label>
                <Input
                  id="businessName"
                  placeholder="Acme Inc"
                  value={business.name}
                  onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="flex items-center">
                  <Tag className="h-4 w-4 mr-2 text-gray-500" />
                  Business Category *
                </Label>
                <select
                  id="category"
                  value={business.category}
                  onChange={(e) => setBusiness({ ...business, category: e.target.value })}
                  required
                  disabled={loading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select a category</option>
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
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
                  value={business.website}
                  onChange={(e) => setBusiness({ ...business, website: e.target.value })}
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" variant="whatsapp" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Trial info */}
        <p className="text-center text-sm text-gray-500 mt-4">
          🎉 You&apos;ll get a 14-day free trial. No credit card required.
        </p>
      </div>
    );
  }

  // Step 2: Number Selection (3-path)
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Choose Your Setup Method</h1>
        <p className="text-gray-600 mt-2">How would you like to connect WhatsApp Business?</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Option 1: Own Number */}
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-lg",
            selectedOption === 'own' && "ring-2 ring-whatsapp border-whatsapp"
          )}
          onClick={() => handleOptionSelect('own')}
        >
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <Smartphone className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-lg">Connect Existing Number</CardTitle>
            <div className="text-whatsapp font-semibold">Free</div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 text-center mb-4">
              Use your own phone number for WhatsApp Business API
            </p>
            <ul className="text-sm text-gray-500 space-y-2">
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Use your existing SIM
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Receive OTP directly
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-green-500" />
                No additional charges
              </li>
            </ul>
            {selectedOption === 'own' && (
              <div className="mt-4 p-2 bg-green-50 rounded-lg text-center">
                <Check className="h-5 w-5 text-whatsapp mx-auto" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Option 2: Virtual Number */}
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-lg relative",
            selectedOption === 'virtual' && "ring-2 ring-whatsapp border-whatsapp"
          )}
          onClick={() => handleOptionSelect('virtual')}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs px-3 py-1 rounded-full">
            Recommended
          </div>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-4">
              <Phone className="h-8 w-8 text-purple-600" />
            </div>
            <CardTitle className="text-lg">Buy Virtual Number</CardTitle>
            <div className="text-purple-600 font-semibold">₹200/month</div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 text-center mb-4">
              Get a dedicated US number instantly with auto OTP capture
            </p>
            <ul className="text-sm text-gray-500 space-y-2">
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Instant number assignment
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Auto-capture OTP codes
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-green-500" />
                No personal SIM needed
              </li>
            </ul>
            {selectedOption === 'virtual' && (
              <div className="mt-4 p-2 bg-green-50 rounded-lg text-center">
                <Check className="h-5 w-5 text-whatsapp mx-auto" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Option 3: Migrate */}
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-lg",
            selectedOption === 'migrate' && "ring-2 ring-whatsapp border-whatsapp"
          )}
          onClick={() => handleOptionSelect('migrate')}
        >
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
              <RefreshCw className="h-8 w-8 text-orange-600" />
            </div>
            <CardTitle className="text-lg">Migrate from Provider</CardTitle>
            <div className="text-orange-600 font-semibold">Free</div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 text-center mb-4">
              Move from Wati, Interakt, AiSensy, or other providers
            </p>
            <ul className="text-sm text-gray-500 space-y-2">
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Keep your existing number
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Guided migration process
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-green-500" />
                No downtime
              </li>
            </ul>
            {selectedOption === 'migrate' && (
              <div className="mt-4 p-2 bg-green-50 rounded-lg text-center">
                <Check className="h-5 w-5 text-whatsapp mx-auto" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Continue Button */}
      <div className="mt-8 text-center">
        <Button
          size="lg"
          variant="whatsapp"
          disabled={!selectedOption || loading}
          onClick={handleContinue}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Please wait...
            </>
          ) : (
            <>
              Continue with {selectedOption === 'own' ? 'Own Number' : selectedOption === 'virtual' ? 'Virtual Number' : 'Migration'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {/* Help text */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Not sure which option to choose?{' '}
          <a href="https://docs.interface.techsoftwares.in/setup" target="_blank" className="text-whatsapp hover:underline">
            Read our setup guide
          </a>
        </p>
      </div>
    </div>
  );
}
