// Edge-compatible Supabase Admin using REST API
// No SDK - direct fetch calls that work on Cloudflare Edge

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface SupabaseResponse<T> {
  data: T | null;
  error: { message: string; code: string } | null;
}

// Generic REST API call
async function supabaseRest<T>(
  table: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  options?: {
    body?: Record<string, unknown>;
    filters?: string;
    select?: string;
    single?: boolean;
  }
): Promise<SupabaseResponse<T>> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  
  if (options?.filters) {
    url.search = options.filters;
  }
  
  if (options?.select) {
    url.searchParams.append('select', options.select);
  }

  const headers: Record<string, string> = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': options?.single ? 'return=representation,count=exact' : 'return=representation',
  };

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        data: null,
        error: { message: errorData.message || 'Request failed', code: errorData.code || 'ERROR' },
      };
    }

    const data = await response.json();
    return {
      data: options?.single ? (Array.isArray(data) ? data[0] : data) : data,
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Unknown error', code: 'FETCH_ERROR' },
    };
  }
}

// Admin client object with chainable methods
export const adminClient = {
  from: (table: string) => ({
    select: (columns = '*') => ({
      eq: (column: string, value: string | number) => ({
        single: async <T>() => supabaseRest<T>(table, 'GET', {
          filters: `${column}=eq.${value}`,
          select: columns,
          single: true,
        }),
        maybeSingle: async <T>() => supabaseRest<T>(table, 'GET', {
          filters: `${column}=eq.${value}`,
          select: columns,
          single: true,
        }),
      }),
      order: (column: string, options?: { ascending?: boolean }) => ({
        limit: (count: number) => ({
          maybeSingle: async <T>() => supabaseRest<T>(table, 'GET', {
            filters: `order=${column}.${options?.ascending ? 'asc' : 'desc'}&limit=${count}`,
            select: columns,
            single: true,
          }),
        }),
      }),
    }),

    insert: (data: Record<string, unknown>) => ({
      select: (columns = '*') => ({
        single: async <T>() => supabaseRest<T>(table, 'POST', {
          body: data,
          select: columns,
          single: true,
        }),
      }),
    }),

    update: (data: Record<string, unknown>) => ({
      eq: (column: string, value: string | number) => ({
        select: (columns = '*') => ({
          single: async <T>() => supabaseRest<T>(table, 'PATCH', {
            body: data,
            filters: `${column}=eq.${value}`,
            select: columns,
            single: true,
          }),
        }),
        then: async <T>(resolve: (value: SupabaseResponse<T>) => void) => {
          const result = await supabaseRest<T>(table, 'PATCH', {
            body: data,
            filters: `${column}=eq.${value}`,
          });
          resolve(result);
        },
      }),
    }),

    delete: () => ({
      eq: async (column: string, value: string | number) => supabaseRest(table, 'DELETE', {
        filters: `${column}=eq.${value}`,
      }),
    }),
  }),
};

// Helper to verify JWT token via Supabase Auth REST API
export async function verifyToken(accessToken: string): Promise<{ user: { id: string; email: string } | null; error: string | null }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return { user: null, error: 'Invalid token' };
    }

    const user = await response.json();
    return { user: { id: user.id, email: user.email }, error: null };
  } catch {
    return { user: null, error: 'Token verification failed' };
  }
}

// Helper to extract token from cookies
export function extractTokenFromCookies(cookieHeader: string): string | null {
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').filter(Boolean).map(c => {
      const [key, ...val] = c.split('=');
      return [key, val.join('=')];
    })
  );

  const authCookieName = Object.keys(cookies).find(name =>
    name.includes('auth-token') || name.includes('supabase')
  );

  if (!authCookieName) return null;

  try {
    const cookieValue = decodeURIComponent(cookies[authCookieName]);
    const parsed = JSON.parse(cookieValue);
    return parsed.access_token || parsed[0]?.access_token || null;
  } catch {
    return null;
  }
}
