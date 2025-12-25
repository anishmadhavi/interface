import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'edge';

export function middleware(request: NextRequest) {
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
    '/marketing-ads',
    '/workflows',
    '/trust-center',
  ];

  // Auth routes - redirect to dashboard if already logged in
  const authPaths = ['/login', '/register', '/forgot-password', '/reset-password'];

  const isProtectedPath = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  );

  const isAuthPath = authPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Check for auth cookie presence (not validity - that's done client-side)
  const cookieHeader = request.headers.get('cookie') || '';
  const hasAuthCookie = cookieHeader.includes('auth-token') || 
                        cookieHeader.includes('supabase') ||
                        cookieHeader.includes('sb-');

  // If trying to access protected route without cookie, redirect to login
  if (isProtectedPath && !hasAuthCookie) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If has cookie and trying to access auth pages, redirect to dashboard
  if (isAuthPath && hasAuthCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
