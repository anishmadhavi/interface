import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // 1. FAST EXIT: Skip internals and assets to save Edge CPU costs
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

  // 2. Setup the "Sync" mechanism
  const requestHeaders = new Headers(request.headers)
  let response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // FIX: Explicitly typed cookiesToSet to resolve build error
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // A: Update response cookies (browser)
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })

          // B: Hardened Request Sync
          let cookieString = requestHeaders.get('cookie') || ''
          cookiesToSet.forEach(({ name, value }) => {
            const regex = new RegExp(`(?<=\\b)${name}=[^;]*;?`, 'g')
            cookieString = cookieString.replace(regex, '').trim()
            cookieString += `${cookieString ? '; ' : ''}${name}=${value}`
          })

          requestHeaders.set('cookie', cookieString)

          // C: Re-initialize response with updated headers
          response = NextResponse.next({
            request: { headers: requestHeaders },
          })

          // D: Re-apply cookies to new response
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // 3. User check
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
