-- Storefront popups / announcements managed from the admin panel.
-- Run once in the Supabase SQL editor, then: notify pgrst, 'reload schema';

create table if not exists public.popups (
  id            text primary key,
  enabled       boolean not null default false,
  title_en      text not null default '',
  title_fr      text not null default '',
  title_ar      text not null default '',
  body_en       text not null default '',
  body_fr       text not null default '',
  body_ar       text not null default '',
  image_url     text not null default '',
  cta_text_en   text not null default '',
  cta_text_fr   text not null default '',
  cta_text_ar   text not null default '',
  cta_url       text not null default '',
  display_pages text not null default 'all',      -- 'all' or csv: home,products,product-detail,checkout,privacy,track
  dismiss_mode  text not null default 'session',  -- session | 7_days | until_closed
  priority      integer not null default 0,
  start_at      timestamptz null,
  end_at        timestamptz null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.popups enable row level security;

drop policy if exists "Allow public read popups" on public.popups;
create policy "Allow public read popups"
  on public.popups for select
  using (true);

-- Writes go through /api/admin-mutate with service_role, so anon insert/update/delete
-- policies are not required.

notify pgrst, 'reload schema';
