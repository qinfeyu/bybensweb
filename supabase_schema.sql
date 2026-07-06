-- Supabase Schema for Stock Management Tables

CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    amount NUMERIC NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    total_amount NUMERIC NOT NULL,
    discount NUMERIC NOT NULL DEFAULT 0,
    customer_name TEXT,
    customer_phone TEXT,
    operator TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    flavor TEXT,
    variant TEXT,
    qty INTEGER NOT NULL,
    price NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pre_orders (
    id TEXT PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    total_amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pre_order_items (
    id TEXT PRIMARY KEY,
    pre_order_id TEXT NOT NULL REFERENCES public.pre_orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    flavor TEXT,
    variant TEXT,
    qty INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (Row Level Security) if needed or grant access
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Simple permissive policies for authenticated users
CREATE POLICY "Allow authenticated users full access to expenses" ON public.expenses FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access to sales" ON public.sales FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access to sale_items" ON public.sale_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access to pre_orders" ON public.pre_orders FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access to pre_order_items" ON public.pre_order_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access to customers" ON public.customers FOR ALL TO authenticated USING (true);
