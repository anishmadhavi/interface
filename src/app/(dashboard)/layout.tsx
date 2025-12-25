import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server'; // Using your async server client
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';

interface UserData {
  organization_id: string | null;
}

interface OrgData {
  onboarding_completed: boolean;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient(); //

  // 1. Secure user check - verifies token with Supabase Auth
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  // 2. Fetch user's organization link
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('auth_id', user.id)
    .maybeSingle<UserData>(); //

  if (!userData?.organization_id) {
    redirect('/onboarding');
  }

  // 3. Fetch organization's onboarding status
  const { data: orgData } = await supabase
    .from('organizations')
    .select('onboarding_completed')
    .eq('id', userData.organization_id)
    .maybeSingle<OrgData>(); //

  if (!orgData?.onboarding_completed) {
    redirect('/onboarding');
  }

  // 4. Render the shared inbox UI shell
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
