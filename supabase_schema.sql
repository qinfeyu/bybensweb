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
    delivery_price NUMERIC NOT NULL DEFAULT 0,
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
    group_type TEXT DEFAULT 'public',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'supplement' or 'snack'
    brand TEXT NOT NULL,
    name TEXT NOT NULL,
    variant_spec TEXT,
    size TEXT,
    price_eur NUMERIC NOT NULL DEFAULT 0,
    rate NUMERIC NOT NULL DEFAULT 250,
    delivery_dzd NUMERIC NOT NULL DEFAULT 0,
    retail_dzd NUMERIC NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Disable RLS to prevent permission errors
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items DISABLE ROW LEVEL SECURITY;

-- Database Performance Indexes (Phase 1)
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer_phone ON public.sales(customer_phone);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_pre_orders_date ON public.pre_orders(date DESC);
CREATE INDEX IF NOT EXISTS idx_pre_orders_status ON public.pre_orders(status);
CREATE INDEX IF NOT EXISTS idx_pre_order_items_pre_id ON public.pre_order_items(pre_order_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_inventory_type ON public.inventory_items(type);
CREATE INDEX IF NOT EXISTS idx_inventory_brand ON public.inventory_items(brand);
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON public.inventory_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);


