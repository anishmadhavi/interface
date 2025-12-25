import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // 1. FAST EXIT: Skip assets and internal routes
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') || 
    pathname === '/favicon.ico' || 
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const isProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/inbox')
  if (!isProtectedRoute) return NextResponse.next()

  // 2. Locate the Auth Cookie
  // Supabase SSR cookies often start with "sb-" followed by your project ref
  const allCookies = request.cookies.getAll()
  const authCookie = allCookies.find(c => c.name.includes('-auth-token'))?.value

  if (!authCookie) {
    return redirectToLogin(request, pathname)
  }

  try {
    // 3. MANUAL AUTH CHECK (Zero SDK dependencies)
    // We call the Supabase Auth API directly using standard fetch
    const sessionData = JSON.parse(authCookie)
    const accessToken = sessionData.access_token

    const authResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
    })

    if (!authResponse.ok) {
      return redirectToLogin(request, pathname)
    }

    return NextResponse.next()
  } catch (err) {
    // If cookie is malformed or fetch fails, treat as unauthenticated
    return redirectToLogin(request, pathname)
  }
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('redirect', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
