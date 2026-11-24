-- Single shared business notepad for the admin panel.
-- Run once in the Supabase SQL editor, then: notify pgrst, 'reload schema';

create table if not exists public.notes (
  id         text primary key default 'main',
  content    text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into public.notes (id, content)
values ('main', '')
on conflict (id) do nothing;

alter table public.notes enable row level security;

drop policy if exists "Allow public read notes" on public.notes;
create policy "Allow public read notes"
  on public.notes for select
  using (true);

-- Writes go through /api/admin-mutate with service_role, so anon insert/update/delete
-- policies are not required. Add them only if you ever write from a non-service-role client.

notify pgrst, 'reload schema';
