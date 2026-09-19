-- ============================================================
-- Phase 4: Add order payment metadata columns to the orders table
-- (payment_status, is_unpaid, paid_at).
--
-- Run this once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_unpaid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;