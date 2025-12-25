import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

// ⚠️ CHECK: The word 'async' MUST NOT be here
export function createClient() {
  console.log('Server Client: Initializing...');

  // ⚠️ CHECK: The word 'await' MUST NOT be here
  const cookieStore = cookies();
  console.log('Server Client: Cookies loaded');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('CRITICAL ERROR: Supabase Env vars are missing!');
    console.error('URL:', url);
    console.error('Key:', key ? 'Exists' : 'Missing');
    throw new Error('Supabase Env vars missing in server.ts');
  }

  return createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle cookies in Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Handle cookies in Server Components
          }
        },
      },
    }
  );
}
