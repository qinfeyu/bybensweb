import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (typeof window !== 'undefined' && (window as any).SUPABASE_URL) || "https://uogwlzuiemxwsnpigydg.supabase.co";

let rawKey = "";
if (typeof window !== 'undefined') {
  rawKey = (window as any).SUPABASE_PUBLISHABLE_KEY || (window as any).SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || "";
}

// Safe fallback string to prevent createClient from throwing "supabaseKey is required" during script import
const SUPABASE_ANON_KEY = rawKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ3dsenVpZW14d3NucGlneWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTA3MDMsImV4cCI6MjA5ODgyNjcwM30.placeholder";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
