/**
 * =============================================================================
 * FILE: src/app/(dashboard)/layout.tsx
 * PURPOSE: Dashboard Layout Wrapper
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Wraps all dashboard pages with consistent layout (sidebar + header)
 * - Checks if user is authenticated before showing dashboard
 * - Checks if user has completed onboarding
 * - Redirects to /login if not authenticated
 * - Redirects to /onboarding if setup not complete
 * - Shows loading spinner while checking auth status
 * 
 * USED BY:
 * - All pages under /dashboard, /inbox, /contacts, /templates, etc.
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for auth check)
 * - @/components/common/Sidebar
 * - @/components/common/Header
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/common/Sidebar';
import { Header } from '@/components/common/Header';
import { Loader2 } from 'lucide-react';

interface UserContext {
  id: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: string;
  isOwner: boolean;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserContext | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      // Get user with organization details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          is_owner,
          organization_id,
          organizations (
            id,
            name,
            onboarding_completed
          ),
          roles (
            name
          )
        `)
        .eq('auth_id', session.user.id)
        .maybeSingle();

      if (userError || !userData || !userData.organization_id) {
        router.push('/onboarding');
        return;
      }

      if (!userData.organizations?.onboarding_completed) {
        router.push('/onboarding');
        return;
      }

      setUser({
        id: userData.id,
        email: userData.email,
        organizationId: userData.organization_id,
        organizationName: userData.organizations?.name || '',
        role: userData.roles?.name || 'Member',
        isOwner: userData.is_owner,
      });

      setLoading(false);
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-whatsapp mx-auto" />
          <p className="mt-2 text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      
      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'pl-16' : 'pl-64'}`}>
        <Header user={user} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
