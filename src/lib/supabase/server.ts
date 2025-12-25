import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const runtime = 'edge';

// Edge-compatible server client
// Uses request/response for cookie handling instead of Next.js cookies()
export function createClient(request?: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Get auth token from request cookies if available
  let accessToken: string | undefined;
  
  if (request) {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').filter(Boolean).map(c => {
        const [key, ...val] = c.split('=');
        return [key, val.join('=')];
      })
    );
    
    // Supabase stores auth in sb-<project-ref>-auth-token cookie
    const authCookieName = Object.keys(cookies).find(name => 
      name.includes('auth-token') || name.includes('supabase')
    );
    
    if (authCookieName) {
      try {
        const cookieValue = decodeURIComponent(cookies[authCookieName]);
        const parsed = JSON.parse(cookieValue);
        accessToken = parsed.access_token || parsed[0]?.access_token;
      } catch {
        // Cookie parsing failed, continue without token
      }
    }
  }

  const client = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: accessToken ? {
        Authorization: `Bearer ${accessToken}`,
      } : {},
    },
  });

  return client;
}

// Helper to get session from request
export async function getSession(request: Request) {
  const client = createClient(request);
  const { data: { user }, error } = await client.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  return { user };
}
