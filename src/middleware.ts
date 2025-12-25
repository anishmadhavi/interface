import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // 1. FAST EXIT: Skip assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico' || pathname.includes('.')) {
    return NextResponse.next()
  }

  const isProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/inbox')
  if (!isProtectedRoute) return NextResponse.next()

  // 2. Identify the Supabase Auth Cookie 
  // Supabase SSR cookies usually start with "sb-"
  const authCookie = request.cookies.getAll().find(c => c.name.startsWith('sb-'))?.value
  
  if (!authCookie) {
    return redirectToLogin(request, pathname)
  }

  try {
    // 3. MANUAL AUTH CHECK (Zero SDK dependencies) 
    // We call the Supabase Auth "/user" endpoint directly using standard fetch
    const authResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${JSON.parse(authCookie).access_token}`,
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
    })

    if (!authResponse.ok) {
      return redirectToLogin(request, pathname)
    }

    // User is valid, proceed to the dashboard/inbox
    return NextResponse.next()
  } catch (err) {
    // If the fetch fails or cookie is malformed, redirect to login
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
