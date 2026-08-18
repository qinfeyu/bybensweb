import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (typeof window !== 'undefined' && (window as any).SUPABASE_URL) || "https://uogwlzuiemxwsnpigydg.supabase.co";

let activeKey = "";
if (typeof window !== 'undefined') {
  activeKey = (window as any).SUPABASE_PUBLISHABLE_KEY || (window as any).SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || "";
}

const initialKey = activeKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

export const supabase = createClient(SUPABASE_URL, initialKey);

export async function ensureSupabaseKey(): Promise<string> {
  if (typeof window === 'undefined') return initialKey;
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data && data.supabaseKey) {
      localStorage.setItem('supabase_anon_key', data.supabaseKey);
      (window as any).SUPABASE_ANON_KEY = data.supabaseKey;
      (supabase as any).rest.headers['apikey'] = data.supabaseKey;
      (supabase as any).rest.headers['Authorization'] = `Bearer ${data.supabaseKey}`;
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
