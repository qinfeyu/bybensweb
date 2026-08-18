import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (typeof window !== 'undefined' && (window as any).SUPABASE_URL) || "https://uogwlzuiemxwsnpigydg.supabase.co";
const SUPABASE_ANON_KEY = (typeof window !== 'undefined' && ((window as any).SUPABASE_PUBLISHABLE_KEY || (window as any).SUPABASE_ANON_KEY)) || "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
