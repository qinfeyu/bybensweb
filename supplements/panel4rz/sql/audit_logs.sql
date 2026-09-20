-- =====================================================================
-- AUDIT LOG TABLE MIGRATION / REPAIR (ByBen's Nutrition admin panel)
-- Idempotent: safe to re-run any time. Heals tables created from an
-- older/mismatched schema (adds any missing columns), then reloads the
-- PostgREST schema cache so new columns resolve immediately.
-- Run it in the Supabase SQL Editor (Dashboard > SQL > New query).
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

-- RLS: lock the table; /api handlers are the intended writers.
alter table public.audit_logs enable row level security;

-- Anyone may read (used by /api/admin-logs and the panel).
drop policy if exists "audit_logs_client_read" on public.audit_logs;
create policy "audit_logs_client_read"
  on public.audit_logs for select
  using (true);

-- The admin API writes/deletes with the key configured on Vercel.
-- Prefer setting SUPABASE_SERVICE_ROLE_KEY there (bypasses RLS). If the
-- server only has an anon/publishable key, it runs as the anon role and
-- needs these policies to insert and prune rows. The /api/admin-logs
-- DELETE endpoint is already unauthenticated, so an open delete policy
-- adds no new exposure; the insert policy lets the same key log actions.
drop policy if exists "audit_logs_server_insert" on public.audit_logs;
create policy "audit_logs_server_insert"
  on public.audit_logs for insert
  with check (true);

drop policy if exists "audit_logs_server_delete" on public.audit_logs;
create policy "audit_logs_server_delete"
  on public.audit_logs for delete
  using (true);

-- Make PostgREST pick up schema/column changes immediately
-- (avoids "Could not find the 'XX' column ... in the schema cache").
notify pgrst, 'reload schema';