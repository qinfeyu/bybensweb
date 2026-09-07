import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (typeof window !== 'undefined' && (window as any).SUPABASE_URL) || "https://uogwlzuiemxwsnpigydg.supabase.co";

let activeKey = "";
if (typeof window !== 'undefined') {
  activeKey = (window as any).SUPABASE_PUBLISHABLE_KEY || (window as any).SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || "";
}

const initialKey = activeKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

const rawSupabase = createClient(SUPABASE_URL, initialKey);

// Non-critical cache keys that can be evicted when storage is full.
// Ordered from largest/least-critical to smallest/more-critical.
const EVICTABLE_CACHE_KEYS = [
  'bb_customers_cache',
  'bb_preorder_items_cache',
  'bb_preorders_cache',
  'bb_products_cache',
  'bb_inventory_stock_eu_map',
  'bb_inventory_items',
];

/** Estimate current localStorage usage in KB for debugging */
function estimateStorageKB(): number {
  let total = 0;
  try {
    for (const k in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, k)) {
        total += (localStorage.getItem(k) || '').length;
      }
    }
  } catch (_) {}
  return Math.round(total / 1024);
}

/**
 * Safe wrapper around localStorage.setItem that gracefully handles QuotaExceededError.
 * On failure it progressively evicts non-critical caches and retries.
 * Auth tokens are never evicted.
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;

  // Fast path — just write and return
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (_) {
    // Quota hit — start eviction
  }

  const usageKB = estimateStorageKB();
  console.warn(
    `[safeSetLocalStorage] QuotaExceededError for key="${key}" (≈${usageKB} KB used). Evicting caches...`
  );

  // Progressively evict caches and retry after each eviction
  for (const cacheKey of EVICTABLE_CACHE_KEYS) {
    if (cacheKey === key) continue; // don't evict the key we're about to write
    localStorage.removeItem(cacheKey);
    try {
      localStorage.setItem(key, value);
      console.info(`[safeSetLocalStorage] Retry succeeded after evicting "${cacheKey}"`);
      return true;
    } catch (_) {
      // Continue evicting
    }
  }

  // Last resort: clear everything except auth credentials
  const PROTECTED_KEYS = ['bb_admin_auth', 'bb_admin_name', 'bb_admin_token', 'supabase_anon_key'];
  try {
    const keysToRemove = [];
    for (const k in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, k) && !PROTECTED_KEYS.includes(k)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    localStorage.setItem(key, value);
    console.info(`[safeSetLocalStorage] Retry succeeded after full cache clear`);
    return true;
  } catch (finalErr) {
    console.error(`[safeSetLocalStorage] Could not write key="${key}" even after full eviction`, finalErr);
    return false;
  }
}

export async function ensureSupabaseKey(): Promise<string> {
  if (typeof window === 'undefined') return initialKey;
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data && data.supabaseKey) {
      safeSetLocalStorage('supabase_anon_key', data.supabaseKey);
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
