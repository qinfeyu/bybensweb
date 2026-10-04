-- Adds partial payment and debt tracking to orders table

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS payment_history jsonb DEFAULT '[]'::jsonb;
