import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (typeof window !== 'undefined' && (window as any).SUPABASE_URL) || "https://uogwlzuiemxwsnpigydg.supabase.co";
const SUPABASE_ANON_KEY = (typeof window !== 'undefined' && (window as any).SUPABASE_ANON_KEY) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ3dsenVpZW14d3NucGlneWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTA3MDMsImV4cCI6MjA5ODgyNjcwM30.3IrYmHPKPUwki-hmkysLw3EAEcr_h8wLHZmRphDiOpI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
