import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function middleware(request: NextRequest) {
  // Protected routes - require authentication
  const protectedPaths = [
    '/dashboard',
    '/inbox',
    '/contacts',
    '/templates',
    '/campaigns',
    '/analytics',
    '/integrations',
    '/team',
    '/billing',
    '/settings',
    '/automations',
    '/quick-replies',
    '/onboarding',
  ];

  // Auth routes - redirect to dashboard if already logged in
  const authPaths = ['/login', '/register', '/forgot-password', '/reset-password'];

  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  const isAuthPath = authPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  // If not a protected or auth path, continue
  if (!isProtectedPath && !isAuthPath) {
    return NextResponse.next();
  }

  // Get auth token from cookies
  const cookieHeader = request.headers.get('cookie') || '';
  let accessToken: string | undefined;
  let isAuthenticated = false;

  // Parse cookies
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').filter(Boolean).map(c => {
      const [key, ...val] = c.split('=');
      return [key, val.join('=')];
    })
  );

  // Find Supabase auth cookie
  const authCookieName = Object.keys(cookies).find(name => 
    name.includes('auth-token') || name.includes('supabase')
  );

  if (authCookieName) {
    try {
      const cookieValue = decodeURIComponent(cookies[authCookieName]);
      const parsed = JSON.parse(cookieValue);
      accessToken = parsed.access_token || parsed[0]?.access_token;
    } catch {
      // Cookie parsing failed
    }
  }

  // Verify token with Supabase
  if (accessToken) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      );

      const { data: { user }, error } = await supabase.auth.getUser();
      isAuthenticated = !!user && !error;
    } catch {
      isAuthenticated = false;
    }
  }

  // If trying to access protected route without session, redirect to login
  if (isProtectedPath && !isAuthenticated) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If logged in and trying to access auth pages, redirect to dashboard
  if (isAuthPath && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
