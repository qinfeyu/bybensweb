import React, { useState, useEffect } from 'react';
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
        flavors: p.flavors || [],
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
    refreshAllData();
  }, []);

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
      flavors: payload.flavors || [],
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
        />

        {/* Content View Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
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
                defaultEurRate={eurRate}
              />
            )}

            {activeTab === 'pos' && (
              <PosPage
                products={products}
                inventoryItems={inventoryItems}
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

            {activeTab === 'settings' && (
              <SettingsPage
                settings={settings}
                onSaveSettings={handleSaveSettings}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
