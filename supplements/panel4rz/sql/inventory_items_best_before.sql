-- =====================================================================
-- INVENTORY ITEMS: add `best_before` column (ByBen's Nutrition admin panel)
-- Idempotent: safe to re-run. Run in Supabase SQL Editor BEFORE deploying
-- the panel build that sends this field (Dashboard > SQL > New query).
--
-- WHY: the Inventory Manager now tracks best-before dates per SKU. If the
-- column is missing, PostgREST rejects the ENTIRE inventory upsert with:
--     "Could not find the 'best_before' column of 'inventory_items' in the schema cache"
-- which would make single AND bulk inventory saves silently fail.
--
-- Nullable on purpose: NULL = "date unknown", which is valid. The panel
-- strips this field from upserts automatically if the column is missing.
-- =====================================================================

alter table public.inventory_items
  add column if not exists best_before date;

comment on column public.inventory_items.best_before is
  'Best-before / expiry date for the SKU stock (admin-only, one date per SKU). NULL = unknown.';

-- Useful for the "expiring soon" queries (daily cron + dashboard).
create index if not exists idx_inventory_best_before
  on public.inventory_items (best_before)
  where best_before is not null;
