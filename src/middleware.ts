import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  try {
    // 1. Setup Response
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    // 2. Load Env Vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 3. Safety Check: Missing Variables?
    if (!supabaseUrl || !supabaseKey) {
      console.error('Middleware Error: Missing Supabase Environment Variables');
      // Return plain text error to browser so we can see it
      return new NextResponse(
        JSON.stringify({ 
          error: 'CRITICAL: Supabase Environment Variables are missing in Middleware.',
          details: 'Check Cloudflare Dashboard > Settings > Environment Variables'
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    // 4. Create Client
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options });
            response = NextResponse.next({
              request: { headers: request.headers },
            });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: '', ...options });
            response = NextResponse.next({
              request: { headers: request.headers },
            });
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    // 5. Auth Check
    const { data: { user }, error } = await supabase.auth.getUser();
    
    // Log auth error if it exists (check console logs)
    if (error) console.log("Auth Error in Middleware:", error.message);

    const session = user; 

    // 6. Redirect Logic
    const protectedPaths = [
      '/dashboard', '/inbox', '/contacts', '/onboarding',
      '/templates', '/campaigns', '/analytics', '/integrations', 
      '/team', '/billing', '/settings'
    ];
    const authPaths = ['/login', '/register', '/forgot-password', '/reset-password'];

    const isProtectedPath = protectedPaths.some(path => 
      request.nextUrl.pathname.startsWith(path)
    );
    const isAuthPath = authPaths.some(path => 
      request.nextUrl.pathname.startsWith(path)
    );

    if (isProtectedPath && !session) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (isAuthPath && session) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return response;

  } catch (e: any) {
    // CATCH THE CRASH: Return the actual error message to the browser
    console.error('Middleware CRASH:', e);
    return new NextResponse(
      JSON.stringify({
        message: "Middleware Crashed",
        error: e.message || e.toString(),
        stack: e.stack
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
