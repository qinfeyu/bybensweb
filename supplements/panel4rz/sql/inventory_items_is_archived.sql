-- =====================================================================
-- INVENTORY ITEMS: add `is_archived` column (ByBen's Nutrition admin panel)
-- Idempotent: safe to re-run. Run in Supabase SQL Editor (Dashboard > SQL > New query).
--
-- WHY: the Inventory Manager's Archive/Restore feature (and every inventory
-- upsert) sends `is_archived`. If the column is missing, PostgREST rejects the
-- ENTIRE upsert with:
--     "Could not find the 'is_archived' column of 'inventory_items' in the schema cache"
-- which made single AND bulk inventory saves silently fail (nothing persisted).
-- =====================================================================

alter table public.inventory_items
  add column if not exists is_archived boolean not null default false;

-- Backfill any existing NULLs (defensive; the default covers new rows).
update public.inventory_items
  set is_archived = false
  where is_archived is null;
