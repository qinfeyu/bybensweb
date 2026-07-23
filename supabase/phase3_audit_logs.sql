-- ============================================================
-- Phase 3: Audit Logging & Operations Tracking Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT,
    action TEXT NOT NULL,       -- e.g. 'INVENTORY_STOCK_UPDATE', 'ORDER_CANCELLED', 'PRODUCT_DELETED'
    target_id TEXT,            -- ID of modified record
    details JSONB,             -- Detailed snapshot of changes
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS and set policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin All Audit Logs" ON public.audit_logs 
FOR ALL TO service_role, authenticated 
USING (true);

-- Index for fast audit history searches
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
