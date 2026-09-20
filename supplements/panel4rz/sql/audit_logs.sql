-- =====================================================================
-- AUDIT LOG TABLE MIGRATION (ByBen's Nutrition admin panel)
-- Apply ONCE in the Supabase SQL Editor (Dashboard > SQL > New query).
-- UX: the API writes are fire-and-forget and degrade silently, so the
-- feature is harmless until you apply this. Apply it to start capturing.
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

-- Fast pruning / reads by time.
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
-- Fast row-cap prune (delete-by-oldest).
create index if not exists audit_logs_id_idx on public.audit_logs (id);

-- RLS: the API writes/removes via a widely-scoped key, so keep the table
-- locked down and let the /api handlers manage rows.
alter table public.audit_logs enable row level security;

-- Block client-side anonymous inserts; only the API (service/anon-from-server)
-- or authed admin writes via the admin-logs endpoint.
drop policy if exists "audit_logs_client_read" on public.audit_logs;
create policy "audit_logs_client_read"
  on public.audit_logs for select
  using (true);
