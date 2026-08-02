export type TabType = 'dashboard' | 'inventory' | 'products' | 'categories' | 'promos' | 'delivery' | 'orders' | 'preorders' | 'pos' | 'unpaid' | 'expenses' | 'customers' | 'settings';

export interface DeliveryPrice {
  id: string | number;
  wilaya: string;
  home_price: number;
  office_price: number;
  is_hidden?: boolean;
  created_at?: string;
}

export interface InventoryItem {
  id: string; // SKU ID (e.g. SUP-8801)
  type: 'supplement' | 'snack';
  brand: string;
  name: string;
  variant_spec?: string | null;
  size?: string | null;
  price_eur: number;
  rate: number;
  delivery_dzd: number;
  retail_dzd: number;
  stock: number;      // DZ Stock (sellable)
  stock_eu: number;   // EU Stock
  created_at?: string;
  _lastUpdated?: string;
}

export interface ProductVariant {
  weight?: string;
  unit?: string;
  label?: string;
  name?: string;
  price: number;
  cost?: number;
  cost_eur?: number;
  stock: number;
  sku?: string;
  imageIndex?: number;
  flavorStock?: Record<string, number>;
  flavorSkus?: Record<string, string>;
}

export interface BundleItem {
  productId: string;
  qty: number;
  variant?: string;
  flavor?: string;
  name?: string;
  brand?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface SubCategory {
  id: string;
  name: string;
  categoryIds: string[];
}

export interface PromoCode {
  id: string;
  code: string;
  type?: 'percent' | 'fixed' | 'free_delivery';
  value?: number;
  minOrder?: number;
  maxUses?: number | null;
  uses?: number;
  expiry?: string;
  status: 'active' | 'inactive';
  applyToAll?: boolean;
  created_at?: string;
}

export interface Product {
  id: string;
  brand?: string;
  name: string;
  description?: string;
  nutritionalFacts?: string;
  benefits?: string;
  categoryIds?: string[];
  subCategoryIds?: string[];
  imageUrl?: string | string[];
  discount?: number;
  stock: number;
  status: 'active' | 'draft' | 'archived';
  hidden?: boolean;
  allowPromo?: boolean;
  promoCodeIds?: string[];
  bundleItems?: BundleItem[];
  variants?: ProductVariant[];
  flavors?: (string | { name: string; image?: string; imageIndex?: number })[];
  flavorImages?: Record<string, string>;
}

export interface OrderItem {
  id?: string;
  productId?: string;
  product_id?: string;
  name?: string;
  product_name?: string;
  flavor?: string;
  variant?: string;
  qty: number;
  price: number;
  unitPrice?: number;
  unit_price?: number;
  lineTotal?: number;
  line_total?: number;
}

export interface Order {
  id: string;
  source?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  wilaya?: string;
  commune?: string;
  delivery_type?: string;
  deliveryType?: string;
  delivery_cost?: number;
  deliveryCost?: number;
  items: OrderItem[];
  subtotal: number;
  total: number;
  status: 'waiting' | 'confirmed' | 'shipping' | 'delivered' | 'canceled' | 'unpaid';
  payment_status?: 'paid' | 'unpaid';
  is_unpaid?: boolean;
  paid_at?: string;
  created_at?: string;
  date?: string;
  promoCode?: string;
  promoDiscount?: number;
}

export interface PreOrderItem {
  id?: string;
  pre_order_id?: string;
  product_id?: string;
  product_name?: string;
  variant?: string;
  variant_spec?: string;
  flavor?: string;
  qty: number;
  unit_price?: number;
  price?: number;
}

export interface PreOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  notes?: string;
  total_amount: number;
  status: 'pending' | 'fulfilled' | 'cancelled';
  date: string;
  created_at?: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency: 'DZD' | 'EUR';
  date: string;
  created_at?: string;
}

export interface Customer {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  wilaya?: string;
  commune?: string;
  address?: string;
  group_type?: 'wholesaler' | 'gym' | 'vip' | 'retail';
  group?: string;
  created_at?: string;
}

export interface AppSettings {
  budget_dzd: string;
  budget_eur: string;
  budget_rate: string;
  admin_username?: string;
  admin_displayname?: string;
  marquee_enabled?: string | boolean;
  marquee_text?: string;
  [key: string]: any;
}
