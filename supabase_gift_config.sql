-- Supabase SQL to create the gift_config table

CREATE TABLE IF NOT EXISTS public.gift_config (
    id integer PRIMARY KEY DEFAULT 1,
    enabled boolean DEFAULT false,
    threshold numeric DEFAULT 20000,
    product_id text,
    variant_index integer DEFAULT 0,
    flavor text DEFAULT '',
    message_en text DEFAULT 'Free gift unlocked!',
    message_fr text DEFAULT 'Cadeau gratuit débloqué!',
    message_ar text DEFAULT 'تم فتح الهدية المجانية!',
    created_at timestamp with time zone DEFAULT now()
);

-- Insert the default row if it doesn't exist
INSERT INTO public.gift_config (id, enabled, threshold)
VALUES (1, false, 20000)
ON CONFLICT (id) DO NOTHING;
