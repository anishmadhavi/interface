import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico' || pathname.includes('.')) {
    return NextResponse.next()
  }

  const isProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/inbox')
  if (!isProtectedRoute) return NextResponse.next()

  const requestHeaders = new Headers(request.headers)
  let response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          // 1. Update response cookies for the browser
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))

          // 2. Hardened Request Sync: Update without duplicates or wiping
          let cookieString = requestHeaders.get('cookie') || ''
          
          cookiesToSet.forEach(({ name, value }) => {
            // Remove existing version of this specific cookie to prevent duplicates
            const regex = new RegExp(`(?<=\\b)${name}=[^;]*;?`, 'g')
            cookieString = cookieString.replace(regex, '').trim()
            // Append the new value
            cookieString += `${cookieString ? '; ' : ''}${name}=${value}`
          })

          // Now safely set the entire cleaned/updated string
          requestHeaders.set('cookie', cookieString)

          // 3. Sync response with the new clean headers
          response = NextResponse.next({
            request: { headers: requestHeaders },
          })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
