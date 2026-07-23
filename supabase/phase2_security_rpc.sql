-- ============================================================
-- Phase 2: Inventory Concurrency, RPC & Row-Level Security (RLS)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Atomic Stock Deduction RPC (Transaction-Safe Row Locking)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.deduct_inventory_stock(p_item_id TEXT, p_qty INT)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_stock INT;
BEGIN
    -- Acquire exclusive row lock with FOR UPDATE to prevent race conditions
    SELECT stock INTO v_current_stock 
    FROM public.inventory_items 
    WHERE id = p_item_id 
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_current_stock >= p_qty THEN
        UPDATE public.inventory_items 
        SET stock = stock - p_qty 
        WHERE id = p_item_id;
        RETURN TRUE;
    ELSE
        RETURN FALSE; -- Insufficient inventory stock
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic Storefront Product Stock Deduction
CREATE OR REPLACE FUNCTION public.deduct_product_stock(p_product_id TEXT, p_qty INT)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_stock INT;
BEGIN
    SELECT stock INTO v_current_stock 
    FROM public.products 
    WHERE id = p_product_id 
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_current_stock >= p_qty THEN
        UPDATE public.products 
        SET stock = stock - p_qty 
        WHERE id = p_product_id;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 2. Row-Level Security (RLS) Activation & Access Control
-- ------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Storefront Public Read Policies (Catalog)
-- ------------------------------------------------------------

CREATE POLICY "Public Read Products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Public Read Categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public Read SubCategories" ON public.sub_categories FOR SELECT USING (true);
CREATE POLICY "Public Read PromoCodes" ON public.promo_codes FOR SELECT USING (true);
CREATE POLICY "Public Read DeliveryPrices" ON public.delivery_prices FOR SELECT USING (true);
CREATE POLICY "Public Read Bundle" ON public.bundle FOR SELECT USING (true);

-- ------------------------------------------------------------
-- Storefront Order Placement Policy (Public Insert)
-- ------------------------------------------------------------

CREATE POLICY "Public Submit Orders" ON public.orders FOR INSERT WITH CHECK (true);

-- ------------------------------------------------------------
-- Admin / Service Role Full Access Policies
-- ------------------------------------------------------------

CREATE POLICY "Admin All Products" ON public.products FOR ALL TO service_role, authenticated USING (true);
CREATE POLICY "Admin All Categories" ON public.categories FOR ALL TO service_role, authenticated USING (true);
CREATE POLICY "Admin All SubCategories" ON public.sub_categories FOR ALL TO service_role, authenticated USING (true);
CREATE POLICY "Admin All PromoCodes" ON public.promo_codes FOR ALL TO service_role, authenticated USING (true);
CREATE POLICY "Admin All DeliveryPrices" ON public.delivery_prices FOR ALL TO service_role, authenticated USING (true);
CREATE POLICY "Admin All Bundle" ON public.bundle FOR ALL TO service_role, authenticated USING (true);
CREATE POLICY "Admin All Orders" ON public.orders FOR ALL TO service_role, authenticated USING (true);
CREATE POLICY "Admin All Sales" ON public.sales FOR ALL TO service_role, authenticated USING (true);
CREATE POLICY "Admin All SaleItems" ON public.sale_items FOR ALL TO service_role, authenticated USING (true);
CREATE POLICY "Admin All PreOrders" ON public.pre_orders FOR ALL TO service_role, authenticated USING (true);
CREATE POLICY "Admin All PreOrderItems" ON public.pre_order_items FOR ALL TO service_role, authenticated USING (true);
CREATE POLICY "Admin All Customers" ON public.customers FOR ALL TO service_role, authenticated USING (true);
CREATE POLICY "Admin All Inventory" ON public.inventory_items FOR ALL TO service_role, authenticated USING (true);
CREATE POLICY "Admin All Expenses" ON public.expenses FOR ALL TO service_role, authenticated USING (true);
