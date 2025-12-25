import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ✅ Hard skip internals & APIs (Cloudflare-safe)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const protectedPaths = [
    '/dashboard', '/inbox', '/contacts', '/templates', '/campaigns',
    '/analytics', '/integrations', '/team', '/billing', '/settings',
    '/automations', '/quick-replies', '/onboarding', '/marketing-ads',
    '/workflows', '/trust-center',
  ];

  const isProtectedPath = protectedPaths.some(path =>
    pathname.startsWith(path)
  );

  // ✅ Edge-safe cookie presence check
  const hasSessionCookie =
    request.cookies.has('auth-token') ||
    request.cookies.getAll().some(c => c.name.startsWith('sb-'));

  if (isProtectedPath && !hasSessionCookie) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
