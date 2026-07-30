import React, { useState, useEffect } from 'react';
import { 
  TabType, 
  InventoryItem, 
  Product, 
  Order, 
  PreOrder, 
  Expense, 
  Customer, 
  AppSettings 
} from './types';
import { supabase } from './lib/supabase';
import { getProductPricingAndCost } from './lib/calculations';
import { Navbar } from './components/layout/Navbar';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { BudgetModal } from './components/common/BudgetModal';

import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductsPage } from './pages/ProductsPage';
import { OrdersPage } from './pages/OrdersPage';
import { PreordersPage } from './pages/PreordersPage';
import { PosPage } from './pages/PosPage';
import { ExpensesPage } from './pages/ExpensesPage';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  // Core Data Collections
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [preorders, setPreorders] = useState<PreOrder[]>([]);
  const [preorderItems, setPreorderItems] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    budget_dzd: '0',
    budget_eur: '0',
    budget_rate: '280'
  });

  // UI Modals & Toasts
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = String(Date.now()) + Math.random().toString(36).substr(2, 4);
    setToasts(prev => [...prev, { id, type, message }]);
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

      // Local storage merge
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

      // Preserving local-only items not present in cloudInv yet
      localInv.forEach(item => {
        if (item.id && !cloudInv.some(c => c.id === item.id)) {
          mergedInvMap.set(item.id, item);
        }
      });

      const finalInv = Array.from(mergedInvMap.values());
      setInventoryItems(finalInv);
      localStorage.setItem('bb_inventory_items', JSON.stringify(finalInv));

      // 2. Fetch Products
      const prodRes = await supabase.from('products').select('*');
      if (prodRes.data) {
        setProducts(prodRes.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          brand: p.brand || '',
          categoryIds: (p.category_ids || '').split(',').filter(Boolean),
          subCategoryIds: (p.sub_category_ids || '').split(',').filter(Boolean),
          description: p.description || '',
          imageUrl: Array.isArray(p.image_url) ? p.image_url : (p.image_url ? [p.image_url] : []),
          variants: p.variants || [],
          flavors: p.flavors || [],
          stock: Number(p.stock) || 0,
          discount: Number(p.discount) || 0,
          status: p.status || 'active',
          allowPromo: p.allow_promo === true || p.allow_promo === 'true',
          promoCodeIds: (p.promo_code_ids || '').split(',').filter(Boolean),
          bundleItems: p.bundle_items || []
        })));
      }

      // 3. Fetch Orders
      const ordersRes = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (ordersRes.data) setOrders(ordersRes.data);

      // 4. Fetch Pre-Orders & Pre-Order Items
      const preRes = await supabase.from('pre_orders').select('*').order('date', { ascending: false });
      if (preRes.data) setPreorders(preRes.data);

      const preItemsRes = await supabase.from('pre_order_items').select('*');
      if (preItemsRes.data) setPreorderItems(preItemsRes.data);

      // 5. Fetch Expenses
      const expRes = await supabase.from('expenses').select('*').order('date', { ascending: false });
      if (expRes.data) setExpenses(expRes.data);

      // 6. Fetch Settings
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

  // ── PRODUCTS MUTATIONS ──
  const handleSaveProduct = async (prod: Product) => {
    const payload = { ...prod, status: prod.status || 'active' };
    const dbPayload = {
      id: payload.id,
      name: payload.name,
      brand: payload.brand || '',
      category_ids: (payload.categoryIds || []).join(','),
      sub_category_ids: (payload.subCategoryIds || []).join(','),
      description: payload.description || '',
      image_url: payload.imageUrl,
      variants: payload.variants || [],
      flavors: payload.flavors || [],
      stock: payload.stock,
      discount: payload.discount || 0,
      status: payload.status,
      allow_promo: payload.allowPromo !== false,
      promo_code_ids: (payload.promoCodeIds || []).join(','),
      bundle_items: payload.bundleItems || []
    };

    setProducts(prev => {
      const nextProds = [...prev];
      const idx = nextProds.findIndex(p => p.id === payload.id);
      if (idx >= 0) nextProds[idx] = payload;
      else nextProds.push(payload);
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

    setProducts(products.filter(p => p.id !== id));
    showToast("✓ Product deleted!");
  };

  // ── ORDERS & PRE-ORDERS MUTATIONS ──
  const handleUpdateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      await supabase.from('orders').update({ status }).eq('id', orderId);
    } catch(e) {}

    setOrders(orders.map(o => o.id === orderId ? { ...o, status } : o));
    showToast(`✓ Order status updated to ${status}!`);
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await supabase.from('orders').delete().eq('id', orderId);
    } catch(e) {}

    setOrders(orders.filter(o => o.id !== orderId));
    showToast("✓ Order deleted!");
  };

  const handleTogglePreorderStatus = async (preId: string, currentStatus: PreOrder['status']) => {
    const nextStatus: PreOrder['status'] = currentStatus === 'pending' ? 'fulfilled' : (currentStatus === 'fulfilled' ? 'cancelled' : 'pending');
    
    try {
      await supabase.from('pre_orders').update({ status: nextStatus }).eq('id', preId);
    } catch(e) {}

    setPreorders(preorders.map(p => p.id === preId ? { ...p, status: nextStatus } : p));

    // If marked as fulfilled, execute conversion to orders table
    if (nextStatus === 'fulfilled') {
      const pre = preorders.find(x => x.id === preId);
      const items = preorderItems.filter(x => x.pre_order_id === preId);
      if (pre && items.length > 0) {
        const orderId = `pre-${preId}`;
        const nameParts = (pre.customer_name || '').trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const orderItems: any[] = [];
        let subtotalVal = 0;

        items.forEach(itm => {
          const fallbackPrice = Number(itm.unit_price || itm.price || itm.unitPrice) || 0;
          const pricing = getProductPricingAndCost(itm.product_id || itm.product_name, itm.variant, fallbackPrice, inventoryItems, products, parseFloat(settings.budget_rate) || 280);
          const price = fallbackPrice || pricing.retailPrice || 0;
          const qty = Number(itm.qty) || 1;
          const lineTotal = price * qty;

          orderItems.push({
            id: itm.product_id || ("item_" + Date.now()),
            productId: itm.product_id || "",
            name: itm.product_name || pricing.productName || "Pre-Order Item",
            flavor: itm.flavor || "",
            variant: itm.variant || "",
            qty: qty,
            price: price,
            unitPrice: price,
            unit_price: price,
            lineTotal: lineTotal,
            line_total: lineTotal
          });
          subtotalVal += lineTotal;
        });

        const totalVal = Number(pre.total_amount) > 0 ? Number(pre.total_amount) : subtotalVal;

        const newOrder: Order = {
          id: orderId,
          source: 'pre order',
          first_name: firstName,
          last_name: lastName,
          phone: pre.customer_phone,
          address: pre.notes || '',
          delivery_type: 'Home',
          delivery_cost: 0,
          items: orderItems,
          subtotal: subtotalVal,
          total: totalVal,
          status: 'delivered',
          created_at: new Date().toISOString()
        };

        try {
          await supabase.from('orders').upsert(newOrder, { onConflict: 'id' });
        } catch(e) {}

        setOrders(prev => [newOrder, ...prev.filter(o => o.id !== orderId)]);
      }
    }

    showToast(`✓ Pre-order status updated to ${nextStatus}!`);
  };

  const handleDeletePreorder = async (id: string) => {
    try {
      await supabase.from('pre_orders').delete().eq('id', id);
    } catch(e) {}

    setPreorders(preorders.filter(p => p.id !== id));
    showToast("✓ Pre-order deleted!");
  };

  // ── POS CHECKOUT MUTATION ──
  const handleCompletePosSale = async (saleData: {
    cart: any[];
    customerName: string;
    customerPhone: string;
    discount: number;
    subtotal: number;
    totalAmount: number;
  }) => {
    const saleId = String(Date.now());
    const nameParts = (saleData.customerName || "POS Customer").trim().split(" ");
    const firstName = nameParts[0] || "POS";
    const lastName = nameParts.slice(1).join(" ") || "Customer";

    // 1. Log Sales in Supabase (with RLS catch)
    try {
      await supabase.from('sales').insert({
        id: saleId,
        date: new Date().toISOString(),
        total_amount: saleData.totalAmount,
        discount: saleData.discount,
        customer_name: saleData.customerName || null,
        customer_phone: saleData.customerPhone || null,
        operator: 'Admin'
      });
    } catch(e) {}

    // 2. Insert into orders table for dashboard reporting & metrics
    const orderId = `pos-${saleId}`;
    const orderItems = saleData.cart.map(item => ({
      id: item.productId,
      productId: item.productId,
      name: item.name,
      flavor: item.flavor || "",
      variant: item.variant || "",
      qty: Number(item.qty) || 1,
      price: Number(item.price) || 0,
      unitPrice: Number(item.price) || 0,
      lineTotal: (Number(item.price) || 0) * (Number(item.qty) || 1)
    }));

    const posOrder: Order = {
      id: orderId,
      source: 'POS Checkout',
      first_name: firstName,
      last_name: lastName,
      phone: saleData.customerPhone || '0000000000',
      address: 'In-Store POS Purchase',
      delivery_type: 'In-Store',
      delivery_cost: 0,
      items: orderItems,
      subtotal: saleData.subtotal,
      total: saleData.totalAmount,
      status: 'delivered',
      created_at: new Date().toISOString()
    };

    try {
      await supabase.from('orders').upsert(posOrder, { onConflict: 'id' });
    } catch(e) {}

    setOrders(prev => [posOrder, ...prev]);

    // 3. Update budget
    const curDzd = parseFloat(settings.budget_dzd) || 0;
    const newDzd = String(curDzd + saleData.totalAmount);
    await handleSaveSettings({ ...settings, budget_dzd: newDzd });

    showToast("✓ Sale recorded successfully!");
  };

  // ── EXPENSES & SETTINGS MUTATIONS ──
  const handleAddExpense = async (exp: Partial<Expense>) => {
    const newExp: Expense = {
      id: String(Date.now()),
      category: exp.category || 'Other',
      description: exp.description || '',
      amount: Number(exp.amount) || 0,
      currency: exp.currency || 'DZD',
      date: exp.date || new Date().toISOString()
    };

    try {
      await supabase.from('expenses').insert(newExp);
    } catch(e) {}

    setExpenses([newExp, ...expenses]);
    showToast("✓ Expense added!");
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await supabase.from('expenses').delete().eq('id', id);
    } catch(e) {}

    setExpenses(expenses.filter(e => e.id !== id));
    showToast("✓ Expense deleted!");
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    try {
      await supabase.from('settings').upsert([
        { key: 'budget_dzd', value: newSettings.budget_dzd },
        { key: 'budget_eur', value: newSettings.budget_eur },
        { key: 'budget_rate', value: newSettings.budget_rate }
      ], { onConflict: 'key' });
    } catch(e) {}

    setSettings(newSettings);
  };

  const eurRate = parseFloat(settings.budget_rate) || 280;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        onOpenBudgetModal={() => setIsBudgetModalOpen(true)}
        onLogout={() => {
          if (confirm("Log out of management portal?")) {
            window.location.reload();
          }
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3 text-slate-400 text-xs font-semibold animate-pulse">
              <div className="w-8 h-8 border-3 border-red-700 border-t-transparent rounded-full animate-spin" />
              <span>Loading management data from cloud...</span>
            </div>
          </div>
        ) : (
          <>
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
                onSaveProduct={handleSaveProduct}
                onDeleteProduct={handleDeleteProduct}
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
                onCompleteSale={handleCompletePosSale}
                showToast={showToast}
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
          </>
        )}
      </main>

      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        showToast={showToast}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
