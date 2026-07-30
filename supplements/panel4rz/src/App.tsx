import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from './lib/supabase';
import type { 
  TabType, 
  InventoryItem, 
  Product, 
  Order, 
  PreOrder, 
  PreOrderItem, 
  Expense, 
  Customer, 
  AppSettings,
  Category,
  SubCategory,
  PromoCode
} from './types';
import { Lock, Mail, ShieldCheck, ArrowRight, Bell, Search, X, Package, Users } from 'lucide-react';

// Layout
import { Sidebar } from './components/Sidebar';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductsPage } from './pages/ProductsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { OrdersPage } from './pages/OrdersPage';
import { PreordersPage } from './pages/PreordersPage';
import { PosPage } from './pages/PosPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { CustomersPage } from './pages/CustomersPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // ── Notification bell + global search ──
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut: '/' opens search, Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !searchOpen && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') { setSearchOpen(false); setNotifOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen]);

  // Click outside to close notification dropdown
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => { if (!(e.target as Element).closest('[data-notif]')) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);


  // ── AUTHENTICATION STATE ──
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("bb_admin_auth") === "1";
  });
  const [adminEmail, setAdminEmail] = useState<string>(() => {
    return localStorage.getItem("bb_admin_name") || "admin@bybens.com";
  });
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authErrorMsg, setAuthErrorMsg] = useState('');

  // Check Supabase session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsAuthenticated(true);
        const email = session.user.email || 'admin@bybens.com';
        setAdminEmail(email);
        localStorage.setItem("bb_admin_auth", "1");
        localStorage.setItem("bb_admin_name", email);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        const email = session.user.email || 'admin@bybens.com';
        setAdminEmail(email);
        localStorage.setItem("bb_admin_auth", "1");
        localStorage.setItem("bb_admin_name", email);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmailInput.trim() || !loginPasswordInput.trim()) {
      setAuthErrorMsg("Please enter email and password");
      return;
    }

    setIsAuthSubmitting(true);
    setAuthErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmailInput.trim(),
        password: loginPasswordInput.trim()
      });

      if (!error && data.session) {
        const email = data.user?.email || loginEmailInput.trim();
        setIsAuthenticated(true);
        setAdminEmail(email);
        localStorage.setItem("bb_admin_auth", "1");
        localStorage.setItem("bb_admin_name", email);
        showToast("✓ Welcome back, Admin!");
      } else {
        setAuthErrorMsg(error?.message || "Invalid email or password");
      }
    } catch(err: any) {
      setAuthErrorMsg("Connection error. Please try again.");
    }
    setIsAuthSubmitting(false);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch(e) {}
    localStorage.removeItem("bb_admin_auth");
    localStorage.removeItem("bb_admin_name");
    setIsAuthenticated(false);
    showToast("Signed out successfully", "info");
  };

  // App Data States
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [preorders, setPreorders] = useState<PreOrder[]>([]);
  const [preorderItems, setPreorderItems] = useState<PreOrderItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    budget_dzd: '0',
    budget_eur: '0',
    budget_rate: '280'
  });

  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>>([]);

  const eurRate = parseFloat(settings.budget_rate) || 280;

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = String(Date.now());
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Helper to standardise database payload for InventoryItems
  const toDbInventoryPayload = (item: Partial<InventoryItem>) => ({
    id: String(item.id || '').trim(),
    type: item.type || 'supplement',
    brand: item.brand || '',
    name: item.name || '',
    variant_spec: item.variant_spec || null,
    size: item.size || null,
    price_eur: Number(item.price_eur) || 0,
    rate: Number(item.rate) || 280,
    delivery_dzd: Number(item.delivery_dzd) || 0,
    retail_dzd: Number(item.retail_dzd) || 0,
    stock: Number(item.stock) || 0
  });

  // ── LOAD ALL DATA ──
  const refreshAllData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Inventory Items
      const invRes = await supabase.from('inventory_items').select('*').order('created_at', { ascending: false });
      const cloudInv: InventoryItem[] = invRes.data || [];

      let localInv: InventoryItem[] = [];
      try {
        localInv = JSON.parse(localStorage.getItem('bb_inventory_items') || '[]');
      } catch(e) {}

      const mergedInvMap = new Map<string, InventoryItem>();
      localInv.forEach(item => { if (item.id) mergedInvMap.set(item.id, { ...item }); });

      cloudInv.forEach(cloudItem => {
        if (cloudItem.id) {
          const existingLocal = mergedInvMap.get(cloudItem.id);
          const localStockEu = existingLocal ? (Number(existingLocal.stock_eu) || 0) : 0;
          const cloudStockEu = (cloudItem.stock_eu !== undefined && cloudItem.stock_eu !== null) ? Number(cloudItem.stock_eu) || 0 : 0;
          const finalStockEu = cloudStockEu > 0 ? cloudStockEu : localStockEu;

          const localStock = existingLocal ? Number(existingLocal.stock) || 0 : undefined;
          const cloudStock = (cloudItem.stock !== undefined && cloudItem.stock !== null) ? Number(cloudItem.stock) : 0;

          let finalStock = cloudStock;
          if (existingLocal && existingLocal._lastUpdated) {
            const localTime = new Date(existingLocal._lastUpdated).getTime();
            const cloudTime = cloudItem.created_at ? new Date(cloudItem.created_at).getTime() : 0;
            if ((localTime > cloudTime || (localStock !== undefined && cloudStock !== localStock)) && localStock !== undefined) {
              finalStock = localStock;
            }
          } else if (localStock !== undefined && localStock !== cloudStock) {
            finalStock = localStock;
          }

          mergedInvMap.set(cloudItem.id, {
            ...existingLocal,
            ...cloudItem,
            stock: finalStock,
            stock_eu: finalStockEu
          });
        }
      });

      localInv.forEach(item => {
        if (item.id && !cloudInv.some(c => c.id === item.id)) {
          mergedInvMap.set(item.id, item);
        }
      });

      const finalInv = Array.from(mergedInvMap.values());
      setInventoryItems(finalInv);
      localStorage.setItem('bb_inventory_items', JSON.stringify(finalInv));

      // 2. Fetch Categories & Sub-Categories
      const catRes = await supabase.from('categories').select('*').order('created_at', { ascending: true });
      if (catRes.data) {
        setCategories(catRes.data.map((c: any) => ({ id: String(c.id), name: c.name })));
      }

      const subRes = await supabase.from('sub_categories').select('*');
      if (subRes.data) {
        setSubCategories(subRes.data.map((s: any) => ({
          id: String(s.id),
          name: s.name,
          categoryIds: (s.category_ids || '').split(',').filter(Boolean)
        })));
      }

      // 3. Fetch Products
      const prodRes = await supabase.from('products').select('*');
      const cloudProds: Product[] = (prodRes.data || []).map((p: any) => ({
        id: String(p.id),
        name: p.name,
        brand: p.brand || '',
        categoryIds: (p.category_ids || '').split(',').filter(Boolean),
        subCategoryIds: (p.sub_category_ids || '').split(',').filter(Boolean),
        description: p.description || '',
        nutritionalFacts: p.nutritional_facts || '',
        benefits: p.benefits || '',
        imageUrl: Array.isArray(p.image_url) ? p.image_url : (p.image_url ? [p.image_url] : []),
        variants: p.variants || [],
        // flavors stored as [{name, image}] objects or plain strings
        flavors: (p.flavors || []).map((f: any) => typeof f === 'object' && f !== null ? (f.name || '') : String(f)).filter(Boolean),
        flavorImages: (p.flavors || []).reduce((acc: Record<string, string>, f: any) => {
          if (f && typeof f === 'object' && f.name && f.image) acc[f.name] = f.image;
          return acc;
        }, {}),
        stock: Number(p.stock) || 0,
        discount: Number(p.discount) || 0,
        status: p.status || 'active',
        hidden: p.hidden === true || p.hidden === 'true',
        allowPromo: p.allow_promo === true || p.allow_promo === 'true',
        promoCodeIds: (p.promo_code_ids || '').split(',').filter(Boolean),
        bundleItems: p.bundle_items || []
      }));

      // Merge local products cache
      let localProds: Product[] = [];
      try {
        localProds = JSON.parse(localStorage.getItem('bb_products_cache') || '[]');
      } catch(e) {}

      const mergedProdMap = new Map<string, Product>();
      localProds.forEach(p => { if (p.id) mergedProdMap.set(p.id, p); });
      cloudProds.forEach(p => { if (p.id) mergedProdMap.set(p.id, p); });

      const finalProds = Array.from(mergedProdMap.values());
      setProducts(finalProds);
      localStorage.setItem('bb_products_cache', JSON.stringify(finalProds));

      // 4. Fetch Orders
      const ordersRes = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (ordersRes.data) setOrders(ordersRes.data);

      // 5. Fetch Pre-Orders & Pre-Order Items
      const preRes = await supabase.from('pre_orders').select('*').order('date', { ascending: false });
      if (preRes.data) setPreorders(preRes.data);

      const preItemsRes = await supabase.from('pre_order_items').select('*');
      if (preItemsRes.data) setPreorderItems(preItemsRes.data);

      // 6. Fetch Expenses
      const expRes = await supabase.from('expenses').select('*').order('date', { ascending: false });
      if (expRes.data) setExpenses(expRes.data);

      // 7. Fetch Customers
      const custRes = await supabase.from('customers').select('*');
      const cloudCusts: Customer[] = (custRes.data || []).map((c: any) => ({
        id: String(c.id),
        name: c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Customer',
        phone: c.phone || '',
        wilaya: c.wilaya || '',
        commune: c.commune || '',
        group: c.group_type || c.group || 'public'
      }));

      let localCusts: Customer[] = [];
      try {
        localCusts = JSON.parse(localStorage.getItem('bb_customers_cache') || '[]');
      } catch(e) {}

      const mergedCustMap = new Map<string, Customer>();
      localCusts.forEach(c => { if (c.phone || c.id) mergedCustMap.set(c.phone || c.id, c); });
      cloudCusts.forEach(c => { if (c.phone || c.id) mergedCustMap.set(c.phone || c.id, c); });

      const finalCusts = Array.from(mergedCustMap.values());
      setCustomers(finalCusts);
      localStorage.setItem('bb_customers_cache', JSON.stringify(finalCusts));

      // 7. Fetch Settings
      const setRes = await supabase.from('settings').select('*');
      if (setRes.data) {
        const setMap: any = {};
        setRes.data.forEach((s: any) => setMap[s.key] = s.value);
        setSettings({
          budget_dzd: setMap.budget_dzd || '0',
          budget_eur: setMap.budget_eur || '0',
          budget_rate: setMap.budget_rate || '280'
        });
      }
    } catch (e: any) {
      console.warn("Data refresh notice:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshAllData();
    }
  }, [isAuthenticated]);

  // ── INVENTORY MUTATIONS ──
  const handleSaveInventoryItem = async (item: InventoryItem) => {
    const payload = { ...item, _lastUpdated: new Date().toISOString() };
    const dbPayload = toDbInventoryPayload(payload);

    setInventoryItems(prev => {
      const nextInv = [...prev];
      const idx = nextInv.findIndex(x => x.id === item.id);
      if (idx >= 0) nextInv[idx] = payload;
      else nextInv.push(payload);
      localStorage.setItem('bb_inventory_items', JSON.stringify(nextInv));
      return nextInv;
    });

    try {
      const { error } = await supabase.from('inventory_items').upsert(dbPayload, { onConflict: 'id' });
      if (error) console.warn("Supabase inventory upsert notice:", error.message);
    } catch(e) {}
  };

  const handleSaveBulkInventoryItems = async (items: InventoryItem[]) => {
    const payloads = items.map(i => ({ ...i, _lastUpdated: new Date().toISOString() }));
    const dbPayloads = payloads.map(toDbInventoryPayload);

    setInventoryItems(prev => {
      const nextInv = [...prev];
      payloads.forEach(item => {
        const idx = nextInv.findIndex(x => x.id === item.id);
        if (idx >= 0) nextInv[idx] = { ...nextInv[idx], ...item };
        else nextInv.push(item);
      });
      localStorage.setItem('bb_inventory_items', JSON.stringify(nextInv));
      return nextInv;
    });

    try {
      const { error } = await supabase.from('inventory_items').upsert(dbPayloads, { onConflict: 'id' });
      if (error) console.warn("Supabase bulk inventory upsert notice:", error.message);
    } catch(e) {}
  };

  const handleDeleteInventoryItem = async (id: string) => {
    try {
      await supabase.from('inventory_items').delete().eq('id', id);
    } catch(e) {}

    const nextInv = inventoryItems.filter(x => x.id !== id);
    setInventoryItems(nextInv);
    localStorage.setItem('bb_inventory_items', JSON.stringify(nextInv));
    showToast("✓ Inventory item deleted!");
  };

  // ── CATEGORIES MUTATIONS ──
  const handleSaveCategory = async (cat: Category, subNames: string[]) => {
    const dbCat = { id: cat.id, name: cat.name };

    try {
      await supabase.from('categories').upsert(dbCat, { onConflict: 'id' });

      // Upsert subcategories
      for (const subName of subNames) {
        const existing = subCategories.find(s => s.name.toLowerCase() === subName.toLowerCase() && s.categoryIds.includes(cat.id));
        if (!existing) {
          await supabase.from('sub_categories').insert({
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: subName,
            category_ids: cat.id
          });
        }
      }
    } catch (e) {}

    await refreshAllData();
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await supabase.from('sub_categories').delete().like('category_ids', `%${id}%`);
      await supabase.from('categories').delete().eq('id', id);
    } catch(e) {}

    await refreshAllData();
    showToast("✓ Category deleted!");
  };

  const handleDeleteSubCategory = async (subId: string) => {
    try {
      await supabase.from('sub_categories').delete().eq('id', subId);
    } catch(e) {}

    await refreshAllData();
    showToast("✓ Sub-category deleted!");
  };

  // ── PRODUCTS MUTATIONS ──
  const handleSaveProduct = async (prod: Product) => {
    const payload = { ...prod, status: prod.status || 'active', hidden: prod.hidden || false };
    const dbPayload = {
      id: payload.id,
      name: payload.name,
      brand: payload.brand || '',
      category_ids: (payload.categoryIds || []).join(','),
      sub_category_ids: (payload.subCategoryIds || []).join(','),
      description: payload.description || '',
      nutritional_facts: payload.nutritionalFacts || '',
      benefits: payload.benefits || '',
      image_url: payload.imageUrl,
      variants: payload.variants || [],
      // Embed flavor images inside the flavors JSONB array as {name, image} objects
      flavors: (payload.flavors || []).map((name: any) => ({
        name: String(name),
        image: ((payload.flavorImages || {})[String(name)]) || ''
      })),
      stock: payload.stock,
      discount: payload.discount || 0,
      status: payload.status,
      hidden: payload.hidden,
      allow_promo: payload.allowPromo !== false,
      promo_code_ids: (payload.promoCodeIds || []).join(','),
      bundle_items: payload.bundleItems || []
    };

    setProducts(prev => {
      const nextProds = [...prev];
      const idx = nextProds.findIndex(p => p.id === payload.id);
      if (idx >= 0) nextProds[idx] = payload;
      else nextProds.push(payload);
      localStorage.setItem('bb_products_cache', JSON.stringify(nextProds));
      return nextProds;
    });

    try {
      const { error } = await supabase.from('products').upsert(dbPayload, { onConflict: 'id' });
      if (error) console.warn("Supabase save product notice:", error.message);
    } catch(e) {}
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await supabase.from('products').delete().eq('id', id);
    } catch(e) {}

    const nextProds = products.filter(p => p.id !== id);
    setProducts(nextProds);
    localStorage.setItem('bb_products_cache', JSON.stringify(nextProds));
    showToast("✓ Product deleted!");
  };

  // ── ORDER MUTATIONS ──
  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    } catch(e) {}

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    showToast(`✓ Order #${orderId.slice(-6)} updated to ${newStatus}`);
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await supabase.from('orders').delete().eq('id', orderId);
    } catch(e) {}

    setOrders(prev => prev.filter(o => o.id !== orderId));
    showToast("✓ Order deleted!");
  };

  const handleAddPosOrder = async (orderData: { items: any[]; subtotal: number; total: number; firstName: string; phone: string }) => {
    const id = `POS-${Date.now()}`;
    const newOrder: Order = {
      id,
      source: 'POS',
      firstName: orderData.firstName || 'POS',
      lastName: 'Customer',
      phone: orderData.phone || '0000000000',
      address: 'Store Pickup',
      wilaya: 'Alger',
      commune: 'Alger',
      deliveryType: 'store',
      deliveryCost: 0,
      items: orderData.items || [],
      subtotal: orderData.subtotal || 0,
      total: orderData.total || 0,
      status: 'delivered',
      date: new Date().toISOString()
    };

    try {
      await supabase.from('orders').insert({
        id: newOrder.id,
        source: newOrder.source,
        first_name: newOrder.firstName,
        last_name: newOrder.lastName,
        phone: newOrder.phone,
        address: newOrder.address,
        wilaya: newOrder.wilaya,
        commune: newOrder.commune,
        delivery_type: newOrder.deliveryType,
        delivery_cost: newOrder.deliveryCost,
        items: newOrder.items,
        subtotal: newOrder.subtotal,
        total: newOrder.total,
        status: newOrder.status,
        date: newOrder.date
      });
    } catch(e) {}

    setOrders(prev => [newOrder, ...prev]);
    showToast(`✓ POS Order #${id} recorded successfully!`);
  };

  // ── PREORDER MUTATIONS ──
  const handleSavePreorder = async (preorderData: Partial<PreOrder>, items: any[]) => {
    const preId = preorderData.id || `PRE-${Date.now()}`;
    const newPreorder: PreOrder = {
      id: preId,
      customer_name: preorderData.customer_name || 'Customer',
      customer_phone: preorderData.customer_phone || '',
      notes: preorderData.notes || '',
      status: preorderData.status || 'pending',
      total_amount: Number(preorderData.total_amount) || 0,
      date: preorderData.date || new Date().toISOString()
    };

    const newItems = items.map(itm => ({
      id: `pre_item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      pre_order_id: preId,
      product_id: itm.product_id || '',
      product_name: itm.product_name || '',
      variant: itm.variant || null,
      flavor: itm.flavor || null,
      qty: Number(itm.qty) || 1,
      unit_price: Number(itm.unit_price) || 0
    }));

    setPreorders(prev => {
      const idx = prev.findIndex(p => p.id === preId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = newPreorder;
        return next;
      }
      return [newPreorder, ...prev];
    });

    setPreorderItems(prev => [
      ...prev.filter(i => i.pre_order_id !== preId),
      ...newItems
    ]);

    try {
      await supabase.from('pre_orders').upsert({
        id: newPreorder.id,
        customer_name: newPreorder.customer_name,
        customer_phone: newPreorder.customer_phone,
        notes: newPreorder.notes,
        status: newPreorder.status,
        total_amount: newPreorder.total_amount,
        date: newPreorder.date
      }, { onConflict: 'id' });

      await supabase.from('pre_order_items').delete().eq('pre_order_id', preId);
      if (newItems.length > 0) {
        await supabase.from('pre_order_items').insert(newItems);
      }
    } catch(e) {}

    showToast(`✓ Pre-order #${preId} saved successfully!`);
  };

  const handleTogglePreorderStatus = async (preorderId: string, currentStatus: PreOrder['status']) => {
    const nextStatus = currentStatus === 'fulfilled' ? 'pending' : 'fulfilled';
    try {
      await supabase.from('pre_orders').update({ status: nextStatus }).eq('id', preorderId);
    } catch(e) {}

    setPreorders(prev => prev.map(p => p.id === preorderId ? { ...p, status: nextStatus } : p));
    showToast(`✓ Pre-order status changed to ${nextStatus}`);
  };

  const handleDeletePreorder = async (preorderId: string) => {
    try {
      await supabase.from('pre_order_items').delete().eq('pre_order_id', preorderId);
      await supabase.from('pre_orders').delete().eq('id', preorderId);
    } catch(e) {}

    setPreorders(prev => prev.filter(p => p.id !== preorderId));
    setPreorderItems(prev => prev.filter(i => i.pre_order_id !== preorderId));
    showToast("✓ Pre-order deleted!");
  };

  // ── EXPENSES MUTATIONS ──
  const handleAddExpense = async (exp: Partial<Expense>) => {
    const newExp: Expense = {
      id: `exp_${Date.now()}`,
      category: exp.category || 'General',
      description: exp.description || '',
      amount: Number(exp.amount) || 0,
      currency: exp.currency || 'DZD',
      date: exp.date || new Date().toISOString().split('T')[0]
    };

    try {
      await supabase.from('expenses').insert(newExp);
    } catch(e) {}

    setExpenses(prev => [newExp, ...prev]);
    showToast("✓ Expense recorded!");
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await supabase.from('expenses').delete().eq('id', id);
    } catch(e) {}

    setExpenses(prev => prev.filter(x => x.id !== id));
    showToast("✓ Expense deleted!");
  };

  // ── SETTINGS MUTATIONS ──
  const handleSaveSettings = async (newSet: AppSettings) => {
    setSettings(newSet);
    try {
      await supabase.from('settings').upsert([
        { key: 'budget_dzd', value: newSet.budget_dzd },
        { key: 'budget_eur', value: newSet.budget_eur },
        { key: 'budget_rate', value: newSet.budget_rate }
      ]);
    } catch(e) {}
    showToast("✓ Settings updated successfully!");
  };

  // ── RENDER SUPABASE LOGIN SCREEN IF NOT AUTHENTICATED ──
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans antialiased">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-red-700 rounded-2xl mx-auto flex items-center justify-center font-black text-xl text-white shadow-lg shadow-red-900/30">
              B
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">BYBENS ADMIN</h1>
            <p className="text-xs text-slate-400 font-medium">Sign in to access the management portal</p>
          </div>

          {/* Error Message */}
          {authErrorMsg && (
            <div className="bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-semibold p-3.5 rounded-2xl text-center animate-in fade-in">
              {authErrorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-300 block mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="admin@bybens.com"
                  value={loginEmailInput}
                  onChange={(e) => setLoginEmailInput(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-3 text-white font-medium focus:outline-none focus:ring-2 focus:ring-red-600/50"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPasswordInput}
                  onChange={(e) => setLoginPasswordInput(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-3 text-white font-medium focus:outline-none focus:ring-2 focus:ring-red-600/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthSubmitting}
              className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50"
            >
              {isAuthSubmitting ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center text-[10px] text-slate-500 pt-2 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Supabase Authenticated Access</span>
          </div>
        </div>
      </div>
    );
  }

  const handleSaveCustomer = async (cust: Customer) => {
    setCustomers(prev => {
      const next = [...prev];
      const idx = next.findIndex(c => c.phone === cust.phone || (c.id && c.id === cust.id));
      if (idx >= 0) next[idx] = cust;
      else next.push(cust);
      localStorage.setItem('bb_customers_cache', JSON.stringify(next));
      return next;
    });

    try {
      await supabase.from('customers').upsert({
        id: cust.id,
        name: cust.name,
        phone: cust.phone,
        wilaya: cust.wilaya,
        commune: cust.commune,
        group_type: cust.group
      }, { onConflict: 'id' });
    } catch(e) {}
  };

  const handleDeleteCustomer = async (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    try {
      await supabase.from('customers').delete().eq('id', id);
    } catch(e) {}
  };

  // ── Global search results ──
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const results: { type: string; title: string; sub: string; tab: string }[] = [];

    // Search orders
    orders.filter(o => {
      const name = `${o.first_name || o.firstName || ''} ${o.last_name || o.lastName || ''}`.trim().toLowerCase();
      const phone = (o.phone || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || String(o.id).toLowerCase().includes(q);
    }).slice(0, 5).forEach(o => {
      const name = `${o.first_name || o.firstName || ''} ${o.last_name || o.lastName || ''}`.trim() || '—';
      results.push({ type: 'order', title: name, sub: `${o.status} · ${Number(o.total || 0).toLocaleString('fr-DZ')} DA`, tab: 'orders' });
    });

    // Search products
    products.filter(p => p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q)).slice(0, 4).forEach(p => {
      results.push({ type: 'product', title: `${p.brand ? p.brand + ' ' : ''}${p.name}`, sub: `${p.status} · ${(p.variants || []).length} variants`, tab: 'products' });
    });

    // Search customers
    customers.filter(c => {
      const name = `${c.first_name || ''} ${c.last_name || ''} ${c.name || ''}`.trim().toLowerCase();
      return name.includes(q) || (c.phone || '').includes(q);
    }).slice(0, 4).forEach(c => {
      const name = `${c.first_name || ''} ${c.last_name || ''} ${c.name || ''}`.trim() || '—';
      results.push({ type: 'customer', title: name, sub: `${c.phone || ''} · ${c.wilaya || ''}`, tab: 'customers' });
    });

    return results.slice(0, 10);
  }, [searchQuery, orders, products, customers]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4 sm:px-0">
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => dismissToast(toast.id)}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border text-xs font-bold flex items-center justify-between gap-3 cursor-pointer transition-all animate-in fade-in slide-in-from-top-2 ${
              toast.type === 'error'
                ? 'bg-rose-900 text-white border-rose-800'
                : toast.type === 'info'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-emerald-900 text-white border-emerald-800'
            }`}
          >
            <span>{toast.message}</span>
            <span className="opacity-60 text-[10px]">✕</span>
          </div>
        ))}
      </div>

      {/* Main Layout Grid */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          adminEmail={adminEmail}
          onLogout={handleLogout}
        />

        {/* Content View Container */}
        <main className="flex-1 overflow-y-auto">
          {/* Top bar: notification bell + search */}
          <div className="sticky top-0 z-30 bg-slate-50/80 backdrop-blur-md border-b border-slate-200/60 px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-end gap-2 print:hidden">
            {/* Global Search Trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 text-xs text-slate-400 bg-white border border-slate-200 rounded-xl px-3 py-2 hover:shadow-sm hover:border-slate-300 transition-all w-48 text-left"
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span>Search...</span>
              <kbd className="ml-auto text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-mono">/</kbd>
            </button>
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="relative p-2 rounded-xl bg-white border border-slate-200 hover:shadow-sm transition-all"
              >
                <Bell className="w-4 h-4 text-slate-600" />
                {orders.filter(o => o.status === 'waiting').length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {Math.min(orders.filter(o => o.status === 'waiting').length, 9)}
                  </span>
                )}
              </button>
              {/* Notification Dropdown */}
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">Notifications</span>
                    <button onClick={() => setNotifOpen(false)}><X className="w-4 h-4 text-slate-400" /></button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                    {orders.filter(o => o.status === 'waiting').length === 0 ? (
                      <div className="p-4 text-xs text-slate-400 text-center">No pending orders</div>
                    ) : orders.filter(o => o.status === 'waiting').slice(0, 8).map(o => (
                      <div key={o.id} onClick={() => { setActiveTab('orders'); setNotifOpen(false); }} className="p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center shrink-0"><Package className="w-3.5 h-3.5 text-amber-600" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {`${o.first_name || o.firstName || ''} ${o.last_name || o.lastName || ''}`.trim() || '—'}
                            </div>
                            <div className="text-[10px] text-slate-400">{Number(o.total || 0).toLocaleString('fr-DZ')} DA · Waiting</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {inventoryItems.filter(i => i.type !== 'snack' && (Number(i.stock) || 0) <= 2).slice(0, 5).map(i => (
                      <div key={`stock-${i.id}`} onClick={() => { setActiveTab('inventory'); setNotifOpen(false); }} className="p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center shrink-0"><span className="text-sm">⚠️</span></div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">{i.name}</div>
                            <div className="text-[10px] text-slate-400">Low stock: {i.stock} units</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-slate-100">
                    <button onClick={() => { setActiveTab('dashboard'); setNotifOpen(false); }} className="text-xs font-bold text-red-700 hover:text-red-800 w-full text-center">View all on Dashboard →</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {isLoading && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs font-semibold flex items-center justify-between">
                <span>Syncing live database with Supabase...</span>
                <span className="animate-pulse">● Live</span>
              </div>
            )}

            {activeTab === 'dashboard' && (
              <DashboardPage
                orders={orders}
                preorders={preorders}
                preorderItems={preorderItems}
                inventoryItems={inventoryItems}
                products={products}
                expenses={expenses}
                eurRate={eurRate}
                customers={customers}
                onUpdateOrderStatus={handleUpdateOrderStatus}
              />
            )}

            {activeTab === 'inventory' && (
              <InventoryPage
                inventoryItems={inventoryItems}
                onSaveItem={handleSaveInventoryItem}
                onSaveBulkItems={handleSaveBulkInventoryItems}
                onDeleteItem={handleDeleteInventoryItem}
                defaultEurRate={eurRate}
                showToast={showToast}
              />
            )}

            {activeTab === 'products' && (
              <ProductsPage
                products={products}
                inventoryItems={inventoryItems}
                categories={categories}
                subCategories={subCategories}
                promoCodes={promoCodes}
                onSaveProduct={handleSaveProduct}
                onDeleteProduct={handleDeleteProduct}
                showToast={showToast}
              />
            )}

            {activeTab === 'categories' && (
              <CategoriesPage
                categories={categories}
                subCategories={subCategories}
                onSaveCategory={handleSaveCategory}
                onDeleteCategory={handleDeleteCategory}
                onDeleteSubCategory={handleDeleteSubCategory}
                showToast={showToast}
              />
            )}

            {activeTab === 'orders' && (
              <OrdersPage
                orders={orders}
                inventoryItems={inventoryItems}
                products={products}
                onUpdateStatus={handleUpdateOrderStatus}
                onDeleteOrder={handleDeleteOrder}
                defaultEurRate={eurRate}
              />
            )}

            {activeTab === 'preorders' && (
              <PreordersPage
                preorders={preorders}
                preorderItems={preorderItems}
                inventoryItems={inventoryItems}
                products={products}
                onToggleStatus={handleTogglePreorderStatus}
                onDeletePreorder={handleDeletePreorder}
                onSavePreorder={handleSavePreorder}
                defaultEurRate={eurRate}
              />
            )}

            {activeTab === 'pos' && (
              <PosPage
                products={products}
                inventoryItems={inventoryItems}
                customers={customers}
                showToast={showToast}
                onCompleteSale={async (data) => {
                  await handleAddPosOrder({
                    items: data.cart.map(c => ({ name: c.name, qty: c.qty, price: c.price, variant: c.variant, flavor: c.flavor })),
                    subtotal: data.subtotal,
                    total: data.totalAmount,
                    firstName: data.customerName,
                    phone: data.customerPhone
                  });
                }}
              />
            )}

            {activeTab === 'expenses' && (
              <ExpensesPage
                expenses={expenses}
                onAddExpense={handleAddExpense}
                onDeleteExpense={handleDeleteExpense}
                eurRate={eurRate}
              />
            )}

            {activeTab === 'customers' && (
              <CustomersPage
                customers={customers}
                orders={orders}
                onSaveCustomer={handleSaveCustomer}
                onDeleteCustomer={handleDeleteCustomer}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPage
                settings={settings}
                products={products}
                inventoryItems={inventoryItems}
                categories={categories}
                subCategories={subCategories}
                customers={customers}
                orders={orders}
                preorders={preorders}
                preorderItems={preorderItems}
                expenses={expenses}
                onSaveSettings={handleSaveSettings}
                showToast={showToast}
              />
            )}
          </div>
          </div>
        </main>
      </div>

      {/* ── Global Search Modal ── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4" onClick={() => setSearchOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search orders, products, customers..."
                className="flex-1 text-sm outline-none text-slate-900 placeholder:text-slate-400"
                autoFocus
              />
              <button onClick={() => setSearchOpen(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
              {searchQuery.trim().length < 2 ? (
                <div className="p-6 text-center text-xs text-slate-400">Type at least 2 characters to search</div>
              ) : searchResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No results for &ldquo;{searchQuery}&rdquo;</div>
              ) : searchResults.map((r, i) => (
                <div key={i} onClick={() => { setActiveTab(r.tab as any); setSearchOpen(false); setSearchQuery(''); }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm ${r.type === 'order' ? 'bg-blue-50' : r.type === 'product' ? 'bg-emerald-50' : 'bg-sky-50'}`}>
                    {r.type === 'order' ? '📦' : r.type === 'product' ? '🧴' : '👤'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">{r.title}</div>
                    <div className="text-[10px] text-slate-400">{r.sub}</div>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full capitalize shrink-0">{r.type}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-3">
              <span><kbd className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">Esc</kbd> to close</span>
              <span><kbd className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> to navigate</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
