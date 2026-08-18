import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (typeof window !== 'undefined' && (window as any).SUPABASE_URL) || "https://uogwlzuiemxwsnpigydg.supabase.co";

let activeKey = "";
if (typeof window !== 'undefined') {
  activeKey = (window as any).SUPABASE_PUBLISHABLE_KEY || (window as any).SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || "";
}

const initialKey = activeKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

const rawSupabase = createClient(SUPABASE_URL, initialKey);

export async function ensureSupabaseKey(): Promise<string> {
  if (typeof window === 'undefined') return initialKey;
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data && data.supabaseKey) {
      localStorage.setItem('supabase_anon_key', data.supabaseKey);
      (window as any).SUPABASE_ANON_KEY = data.supabaseKey;
      (rawSupabase as any).rest.headers['apikey'] = data.supabaseKey;
      (rawSupabase as any).rest.headers['Authorization'] = `Bearer ${data.supabaseKey}`;
      return data.supabaseKey;
    }
  } catch (e) {
    console.warn("Failed to fetch /api/config:", e);
  }
  return initialKey;
}

if (typeof window !== 'undefined') {
  ensureSupabaseKey();
}

export async function adminMutate(
  action: 'upsert' | 'insert' | 'update' | 'delete',
  table: string,
  data?: any,
  match?: Record<string, any>
) {
  try {
    const res = await fetch('/api/admin-mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, table, data, match }),
    });
    return await res.json();
  } catch (e: any) {
    console.error(`adminMutate error [${action} ${table}]:`, e);
    return { error: e.message };
  }
}

export const supabase = {
  ...rawSupabase,
  auth: rawSupabase.auth,
  channel: (...args: any[]) => (rawSupabase.channel as any)(...args),
  removeChannel: (...args: any[]) => (rawSupabase.removeChannel as any)(...args),
  from: (table: string) => {
    const query = rawSupabase.from(table);
    return {
      ...query,
      select: (...args: any[]) => (query.select as any)(...args),
      upsert: async (data: any, options?: any) => {
        const proxyRes = await adminMutate('upsert', table, data);
        if (proxyRes && proxyRes.success) {
          return { data: proxyRes.data, error: null };
        }
        return await Promise.resolve(query.upsert(data, options)).catch((err: any) => ({ data: null, error: err }));
      },
      insert: async (data: any, options?: any) => {
        const proxyRes = await adminMutate('insert', table, data);
        if (proxyRes && proxyRes.success) {
          return { data: proxyRes.data, error: null };
        }
        return await Promise.resolve(query.insert(data, options)).catch((err: any) => ({ data: null, error: err }));
      },
      update: (data: any) => {
        const origUpdate = query.update(data);
        return {
          ...origUpdate,
          eq: async (column: string, value: any) => {
            const proxyRes = await adminMutate('update', table, data, { [column]: value });
            if (proxyRes && proxyRes.success) {
              return { data: proxyRes.data, error: null };
            }
            return await Promise.resolve(origUpdate.eq(column, value)).catch((err: any) => ({ data: null, error: err }));
          }
        };
      },
      delete: () => {
        const origDelete = query.delete();
        return {
          ...origDelete,
          eq: async (column: string, value: any) => {
            const proxyRes = await adminMutate('delete', table, undefined, { [column]: value });
            if (proxyRes && proxyRes.success) {
              return { data: proxyRes.data, error: null };
            }
            return await Promise.resolve(origDelete.eq(column, value)).catch((err: any) => ({ data: null, error: err }));
          },
          like: async (column: string, pattern: string) => {
            const proxyRes = await adminMutate('delete', table, undefined, { [column]: `like:${pattern}` });
            if (proxyRes && proxyRes.success) {
              return { data: proxyRes.data, error: null };
            }
            return await Promise.resolve(origDelete.like(column, pattern)).catch((err: any) => ({ data: null, error: err }));
          }
        };
      }
    };
  }
};
