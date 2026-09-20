-- =====================================================================
-- ONE-SHOT MIGRATION: rebuild this project's audit_logs to the canonical
-- schema. The live table was created from an older migration
-- (uuid id, legacy user_email/details/... columns). This rebuilds it as
-- bigint-identity (recency-ordered ids so the row-cap prune is exact),
-- copies any existing rows, and recreates it WITHOUT the permissive
-- insert/delete policies.
--
-- Prerequisite: set SUPABASE_SERVICE_ROLE_KEY in Vercel first and let it
-- redeploy. The server then writes past RLS, so no insert/delete policies
-- are needed. Run this AFTER that deploy succeeds.
-- =====================================================================

begin;

create table public.audit_logs_new (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  actor_email text,
  action      text not null,
  target_table text,
  target_id   text,
  detail      text
);

-- Copy any existing rows, mapping legacy column names to canonical ones.
insert into public.audit_logs_new (created_at, actor_email, target_table, target_id, detail, action)
select
  coalesce(created_at, now()),
  coalesce(actor_email, user_email),
  target_table,
  target_id,
  coalesce(detail, details),
  action
from public.audit_logs
order by (created_at is null), created_at asc, id::text asc;

-- Swap tables.
alter table public.audit_logs rename to audit_logs_legacy;
alter table public.audit_logs_new rename to audit_logs;

-- Drop the legacy table (rows were copied above).
drop table public.audit_logs_legacy;

-- Give the identity sequence and primary key clean names.
alter sequence public.audit_logs_new_id_seq rename to audit_logs_id_seq;
alter table public.audit_logs rename constraint audit_logs_new_pkey to audit_logs_pkey;

-- Indexes.
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_id_idx on public.audit_logs (id);

-- RLS + read policy (server writes with the service-role key; RLS bypassed).
alter table public.audit_logs enable row level security;
drop policy if exists "audit_logs_client_read" on public.audit_logs;
create policy "audit_logs_client_read"
  on public.audit_logs for select
  using (true);

-- Reload PostgREST schema cache.
notify pgrst, 'reload schema';

-- Sanity output: row count + resulting columns.
select
  (select count(*) from public.audit_logs) as row_count,
  (select string_agg(column_name, ', ' order by ordinal_position)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs') as columns;

commit;