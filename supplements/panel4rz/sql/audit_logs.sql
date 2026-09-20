-- =====================================================================
-- AUDIT LOG TABLE (ByBen's Nutrition admin panel)
-- Idempotent: safe to re-run any time on a fresh or mismatched schema.
-- Run it in the Supabase SQL Editor (Dashboard > SQL > New query).
--
-- SECURITY: the /api handlers write + delete using the key configured on
-- Vercel. Set SUPABASE_SERVICE_ROLE_KEY there (bypasses RLS), so ONLY the
-- select policy below is needed and the table stays locked to clients.
-- If the server runs with an anon/publishable key only, add the
-- insert/delete policies shown at the bottom, or writes silently fail.
-- =====================================================================

create table if not exists public.audit_logs (
  id        bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_email text,
  action     text not null,
  target_table text,
  target_id    text,
  detail       text
);

-- Heal older/mismatched schemas: add any missing columns.
alter table public.audit_logs add column if not exists actor_email  text;
alter table public.audit_logs add column if not exists target_table text;
alter table public.audit_logs add column if not exists target_id    text;
alter table public.audit_logs add column if not exists detail       text;

-- Fast pruning / reads by time.
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
-- Fast row-cap prune (delete-by-oldest).
create index if not exists audit_logs_id_idx on public.audit_logs (id);

-- RLS: lock the table; /api handlers (service role) manage rows.
alter table public.audit_logs enable row level security;

-- Anyone may read (used by /api/admin-logs and the panel).
drop policy if exists "audit_logs_client_read" on public.audit_logs;
create policy "audit_logs_client_read"
  on public.audit_logs for select
  using (true);

-- Make PostgREST pick up schema/column changes immediately
-- (avoids "Could not find the 'XX' column ... in the schema cache").
notify pgrst, 'reload schema';

-- Only needed if the server runs WITHOUT SUPABASE_SERVICE_ROLE_KEY:
--   drop policy if exists "audit_logs_server_insert" on public.audit_logs;
--   create policy "audit_logs_server_insert"
--     on public.audit_logs for insert
--     with check (true);
--   drop policy if exists "audit_logs_server_delete" on public.audit_logs;
--   create policy "audit_logs_server_delete"
--     on public.audit_logs for delete
--     using (true);