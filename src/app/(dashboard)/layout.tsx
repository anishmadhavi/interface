'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { Loader2 } from 'lucide-react';

// Define the shape of the user data we expect
interface UserData {
  organization_id: string | null;
}

// Define the shape of the organization data we expect
interface OrgData {
  onboarding_completed: boolean;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      // 1. Fetch User Data with explicit typing
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', session.user.id)
        .maybeSingle<UserData>(); // <--- FIX: Added <UserData> generic

      // 2. Fix the check
      if (userError || !userData || !userData.organization_id) {
        router.push('/onboarding');
        return;
      }

      // 3. Fetch Organization Data with explicit typing
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('onboarding_completed')
        .eq('id', userData.organization_id)
        .maybeSingle<OrgData>(); // <--- FIX: Added <OrgData> generic

      if (orgError || !orgData || !orgData.onboarding_completed) {
        router.push('/onboarding');
        return;
      }

      setLoading(false);
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64 transition-all duration-300">
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
