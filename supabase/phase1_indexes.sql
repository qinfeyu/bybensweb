-- ============================================================
-- Phase 1 Database Indexing Migration for ByBen's Database
-- ============================================================

-- 1. Sales & POS Queries
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer_phone ON public.sales(customer_phone);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);

-- 2. Storefront Orders Queries
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- 3. Pre-Orders Pipeline Queries
CREATE INDEX IF NOT EXISTS idx_pre_orders_date ON public.pre_orders(date DESC);
CREATE INDEX IF NOT EXISTS idx_pre_orders_status ON public.pre_orders(status);
CREATE INDEX IF NOT EXISTS idx_pre_order_items_pre_id ON public.pre_order_items(pre_order_id);

-- 4. Customer Ledger Queries
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);

-- 5. Inventory Manager Queries
CREATE INDEX IF NOT EXISTS idx_inventory_type ON public.inventory_items(type);
CREATE INDEX IF NOT EXISTS idx_inventory_brand ON public.inventory_items(brand);
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON public.inventory_items(created_at DESC);

-- 6. Expenses Queries
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
