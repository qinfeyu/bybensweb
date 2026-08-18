import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, ensureSupabaseKey } from './lib/supabase';
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
  PromoCode,
  DeliveryPrice,
  BundleConfig
} from './types';
import { Lock, Mail, ShieldCheck, ArrowRight, Bell, Search, X, Package, Users, RefreshCw, Wallet, Menu, LayoutDashboard, Boxes, ShoppingBag, ShoppingCart, Calculator, MoreHorizontal, LogOut, Globe, ExternalLink } from 'lucide-react';

// Layout
import { Sidebar } from './components/Sidebar';
import { BudgetModal } from './components/BudgetModal';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductsPage } from './pages/ProductsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { PromoCodesPage } from './pages/PromoCodesPage';
import { BundlePage } from './pages/BundlePage';
import { DeliveryPricesPage } from './pages/DeliveryPricesPage';
import { OrdersPage } from './pages/OrdersPage';
import { PreordersPage } from './pages/PreordersPage';
import { PosPage } from './pages/PosPage';
import { UnpaidOrdersPage } from './pages/UnpaidOrdersPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { CustomersPage } from './pages/CustomersPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ── Notification bell + global search + Budget modal ──
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isSessionChecking, setIsSessionChecking] = useState<boolean>(true);
  const [adminEmail, setAdminEmail] = useState<string>('admin@bybens.com');
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authErrorMsg, setAuthErrorMsg] = useState('');

  // On mount: check for a live Supabase session (async only, no sync callbacks)
  useEffect(() => {
    if (localStorage.getItem('bb_admin_auth') === '1') {
      setIsAuthenticated(true);
      setAdminEmail(localStorage.getItem('bb_admin_name') || 'admin@bybens.com');
      setIsSessionChecking(false);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setIsAuthenticated(true);
          setAdminEmail(session.user.email || 'admin@bybens.com');
        }
        setIsSessionChecking(false);
      }).catch(() => {
        setIsSessionChecking(false);
      });
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmailInput.trim() || !loginPasswordInput.trim()) {
      setAuthErrorMsg('Please enter email and password');
      return;
    }
    setIsAuthSubmitting(true);
    setAuthErrorMsg('');
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmailInput.trim(), password: loginPasswordInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        localStorage.setItem('bb_admin_auth', '1');
        localStorage.setItem('bb_admin_name', data.user?.email || loginEmailInput.trim());
        if (data.access_token) {
          localStorage.setItem('bb_admin_token', data.access_token);
        }
        setAdminEmail(data.user?.email || loginEmailInput.trim());
        showToast('✓ Welcome back, Admin!');
      } else {
        const msg = data.error || 'Invalid email or password';
        setAuthErrorMsg(msg);
      }
    } catch {
      setAuthErrorMsg('Connection error. Please try again.');
    }
    setIsAuthSubmitting(false);
  };

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch {}
    setIsAuthenticated(false);
    setAdminEmail('admin@bybens.com');
    showToast('Signed out successfully', 'info');
  };

  // App Data States
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [deliveryPrices, setDeliveryPrices] = useState<DeliveryPrice[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [bundleConfig, setBundleConfig] = useState<BundleConfig | null>(null);
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

  const knownOrderIdsRef = useRef<Set<string>>(new Set());

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
    stock: Number(item.stock) || 0,
    stock_eu: Number(item.stock_eu) || 0
  });

  // ── LOAD ALL DATA ──
  const refreshAllData = async () => {
    setIsLoading(true);
    try {
      await ensureSupabaseKey();

      let adminData: any = null;
      try {
        const adRes = await fetch('/api/admin-data');
        if (adRes.ok) {
          const parsed = await adRes.json();
          if (parsed && parsed.success) adminData = parsed;
        }
      } catch (e) {}

      // 1. Fetch Inventory Items
      let cloudInv: InventoryItem[] = [];
      if (adminData && Array.isArray(adminData.inventoryItems)) {
        cloudInv = adminData.inventoryItems;
      } else {
        const invRes = await supabase.from('inventory_items').select('*').order('created_at', { ascending: false });
        cloudInv = invRes.data || [];
      }

      let localInv: InventoryItem[] = [];
      try {
        localInv = JSON.parse(localStorage.getItem('bb_inventory_items') || '[]');
      } catch(e) {}

      let localEuMap: Record<string, number> = {};
      try {
        localEuMap = JSON.parse(localStorage.getItem('bb_inventory_stock_eu_map') || '{}');
      } catch(e) {}

      localInv.forEach(item => {
        if (item.id && item.stock_eu !== undefined && item.stock_eu !== null) {
          localEuMap[item.id] = Number(item.stock_eu) || 0;
        }
      });

      const mergedInvMap = new Map<string, InventoryItem>();

      cloudInv.forEach(cloudItem => {
        if (cloudItem.id) {
          const cloudStock = Number(cloudItem.stock) || 0;
          const hasCloudEu = cloudItem.stock_eu !== undefined && cloudItem.stock_eu !== null;
          const cloudStockEu = hasCloudEu ? (Number(cloudItem.stock_eu) || 0) : (localEuMap[cloudItem.id] ?? 0);

          mergedInvMap.set(cloudItem.id, {
            ...cloudItem,
            stock: cloudStock,
            stock_eu: cloudStockEu
          });
        }
      });

      localInv.forEach(item => {
        if (item.id && !mergedInvMap.has(item.id)) {
          mergedInvMap.set(item.id, item);
        }
      });

      const finalInv = Array.from(mergedInvMap.values());
      setInventoryItems(finalInv);
      localStorage.setItem('bb_inventory_items', JSON.stringify(finalInv));
      localStorage.setItem('bb_inventory_stock_eu_map', JSON.stringify(localEuMap));

      // 2. Fetch Categories & Sub-Categories
      let catData: any[] = [];
      if (adminData && Array.isArray(adminData.categories)) {
        catData = adminData.categories;
      } else {
        const catRes = await supabase.from('categories').select('*').order('created_at', { ascending: true });
        catData = catRes.data || [];
      }
      setCategories(catData.map((c: any) => ({ id: String(c.id), name: c.name })));

      let subData: any[] = [];
      if (adminData && Array.isArray(adminData.subCategories)) {
        subData = adminData.subCategories;
      } else {
        const subRes = await supabase.from('sub_categories').select('*');
        subData = subRes.data || [];
      }
      setSubCategories(subData.map((s: any) => ({
        id: String(s.id),
        name: s.name,
        categoryIds: (s.category_ids || '').split(',').filter(Boolean)
      })));

      // 3. Fetch Products
      let prodData: any[] = [];
      if (adminData && Array.isArray(adminData.products)) {
        prodData = adminData.products;
      } else {
        const prodRes = await supabase.from('products').select('*');
        prodData = prodRes.data || [];
      }

      const cloudProds: Product[] = prodData.map((p: any) => ({
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
      let rawOrders: any[] = [];
      if (adminData && Array.isArray(adminData.orders)) {
        rawOrders = adminData.orders;
      } else {
        const ordersRes = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        rawOrders = ordersRes.data || [];
      }

      setOrders(rawOrders);
      rawOrders.forEach((o: any) => {
        if (knownOrderIdsRef && knownOrderIdsRef.current) {
          knownOrderIdsRef.current.add(o.id);
        }
      });

      // 5. Fetch Pre-Orders & Pre-Order Items
      let rawPreorders: any[] = [];
      if (adminData && Array.isArray(adminData.preOrders)) {
        rawPreorders = adminData.preOrders;
      } else {
        const preRes = await supabase.from('pre_orders').select('*').order('date', { ascending: false });
        rawPreorders = preRes.data || [];
      }
      setPreorders(rawPreorders);

      let rawPreItems: any[] = [];
      if (adminData && Array.isArray(adminData.preOrderItems)) {
        rawPreItems = adminData.preOrderItems;
      } else {
        const preItemsRes = await supabase.from('pre_order_items').select('*');
        rawPreItems = preItemsRes.data || [];
      }
      setPreorderItems(rawPreItems);

      // 6. Fetch Expenses
      let rawExpenses: any[] = [];
      if (adminData && Array.isArray(adminData.expenses)) {
        rawExpenses = adminData.expenses;
      } else {
        const expRes = await supabase.from('expenses').select('*').order('date', { ascending: false });
        rawExpenses = expRes.data || [];
      }
      setExpenses(rawExpenses);

      // 7. Fetch Customers & Extract Profiles
      let rawCusts: any[] = [];
      if (adminData && Array.isArray(adminData.customers)) {
        rawCusts = adminData.customers;
      } else {
        const custRes = await supabase.from('customers').select('*');
        rawCusts = custRes.data || [];
      }

      const cloudCusts: Customer[] = rawCusts.map((c: any) => ({
        id: String(c.id),
        name: c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Customer',
        phone: c.phone || '',
        wilaya: c.wilaya || '',
        commune: c.commune || '',
        group: c.group_type || c.group || 'public'
      }));

      const orderCusts: Customer[] = rawOrders.filter((o: any) => o.phone || o.first_name || o.firstName).map((o: any) => {
        const p = o.phone || '';
        const name = `${o.first_name || o.firstName || ''} ${o.last_name || o.lastName || ''}`.trim() || 'Customer';
        return {
          id: p ? `cust_${p}` : String(o.id),
          name,
          phone: p,
          wilaya: o.wilaya || '',
          commune: o.commune || '',
          group: o.group_type || o.group || 'public'
        };
      });

      const preCusts: Customer[] = rawPreorders.filter((po: any) => po.phone || po.customer_name).map((po: any) => {
        const p = po.phone || '';
        return {
          id: p ? `cust_${p}` : String(po.id),
          name: po.customer_name || 'Pre-Order Customer',
          phone: p,
          wilaya: po.wilaya || '',
          commune: '',
          group: po.group_type || po.group || 'private'
        };
      });

      let localCusts: Customer[] = [];
      try {
        localCusts = JSON.parse(localStorage.getItem('bb_customers_cache') || '[]');
      } catch(e) {}

      const mergeCustomer = (existing: Customer, incoming: Customer): Customer => {
        return {
          ...existing,
          ...incoming,
          id: incoming.id || existing.id,
          name: incoming.name && incoming.name !== 'Customer' ? incoming.name : existing.name,
          phone: incoming.phone || existing.phone,
          wilaya: incoming.wilaya || existing.wilaya,
          commune: incoming.commune || existing.commune,
          group: incoming.group || existing.group
        };
      };

      const mergedCustList: Customer[] = [];
      
      const processCustomer = (c: Customer) => {
        const n = (c.name || '').toLowerCase().trim();
        const hasValidName = n && n !== 'customer' && n !== 'client' && n !== 'unknown';
        const phone = c.phone?.trim();

        const existingIdx = mergedCustList.findIndex(existing => {
          if (phone && existing.phone?.trim() === phone) return true;
          if (hasValidName && (existing.name || '').toLowerCase().trim() === n) return true;
          if (existing.id === c.id) return true;
          return false;
        });

        if (existingIdx >= 0) {
          mergedCustList[existingIdx] = mergeCustomer(mergedCustList[existingIdx], c);
        } else {
          mergedCustList.push(c);
        }
      };

      orderCusts.forEach(processCustomer);
      preCusts.forEach(processCustomer);
      localCusts.forEach(processCustomer);
      cloudCusts.forEach(processCustomer);

      setCustomers(mergedCustList);
      localStorage.setItem('bb_customers_cache', JSON.stringify(mergedCustList));

      // 8. Fetch Settings & Hidden Wilayas
      let rawSettings: any[] = [];
      if (adminData && Array.isArray(adminData.settings)) {
        rawSettings = adminData.settings;
      } else {
        const setRes = await supabase.from('settings').select('*');
        rawSettings = setRes.data || [];
      }

      let hiddenWilayasList: string[] = [];
      if (rawSettings.length > 0) {
        const setMap: any = {};
        rawSettings.forEach((s: any) => setMap[s.key] = s.value);
        setSettings({
          budget_dzd: setMap.budget_dzd || '0',
          budget_eur: setMap.budget_eur || '0',
          budget_rate: setMap.budget_rate || '280'
        });

        try {
          if (setMap.hidden_wilayas) {
            hiddenWilayasList = JSON.parse(setMap.hidden_wilayas);
          }
        } catch(e) {}
      }

      // 9. Fetch Delivery Prices & Merge Master 69 Wilayas
      let rawCloudDps: any[] = [];
      if (adminData && Array.isArray(adminData.deliveryPrices)) {
        rawCloudDps = adminData.deliveryPrices;
      } else {
        const dpRes = await supabase.from('delivery_prices').select('*').order('wilaya', { ascending: true });
        rawCloudDps = dpRes.data || [];
      }

      const dpMap = new Map<string, DeliveryPrice>();

      rawCloudDps.forEach((d: any) => {
        const wName = d.wilaya || '';
        const isHidden = Boolean(d.is_hidden) || hiddenWilayasList.includes(wName) || hiddenWilayasList.includes(String(d.id));
        dpMap.set(wName.toLowerCase(), {
          id: d.id,
          wilaya: wName,
          home_price: Number(d.home_price !== undefined ? d.home_price : (d.homePrice || 0)),
          office_price: Number(d.office_price !== undefined ? d.office_price : (d.officePrice || 0)),
          is_hidden: isHidden
        });
      });

      const MASTER_WILAYAS: Record<string, string> = {
        "01": "Adrar", "02": "Chlef", "03": "Laghouat", "04": "Oum El Bouaghi", "05": "Batna",
        "06": "Béjaïa", "07": "Biskra", "08": "Béchar", "09": "Blida", "10": "Bouira",
        "11": "Tamanrasset", "12": "Tébessa", "13": "Tlemcen", "14": "Tiaret", "15": "Tizi Ouzou",
        "16": "Alger", "17": "Djelfa", "18": "Jijel", "19": "Sétif", "20": "Saïda",
        "21": "Skikda", "22": "Sidi Bel Abbès", "23": "Annaba", "24": "Guelma", "25": "Constantine",
        "26": "Médéa", "27": "Mostaganem", "28": "M'Sila", "29": "Mascara", "30": "Ouargla",
        "31": "Oran", "32": "El Bayadh", "33": "Illizi", "34": "Bordj Bou Arréridj", "35": "Boumerdès",
        "36": "El Tarf", "37": "Tindouf", "38": "Tissemsilt", "39": "El Oued", "40": "Khenchela",
        "41": "Souk Ahras", "42": "Tipaza", "43": "Mila", "44": "Aïn Defla", "45": "Naâma",
        "46": "Aïn Témouchent", "47": "Ghardaïa", "48": "Relizane", "49": "Timimoun", "50": "Bordj Badji Mokhtar",
        "51": "Ouled Djellal", "52": "Béni Abbès", "53": "In Salah", "54": "In Guezzam", "55": "Touggourt",
        "56": "Djanet", "57": "El M'Ghair", "58": "El Meniaa", "59": "Aflou", "60": "El Abiodh Sidi Cheikh",
        "61": "El Aricha", "62": "El Kantara", "63": "Barika", "64": "Bou Saada", "65": "Bir El Ater",
        "66": "Ksar El Boukhari", "67": "Ksar Chellala", "68": "Ain Oussara", "69": "Messaad"
      };

      Object.entries(MASTER_WILAYAS).forEach(([code, name]) => {
        const fullWilayaLabel = `${code} - ${name}`;
        const key = fullWilayaLabel.toLowerCase();
        const hasCodeMatch = Array.from(dpMap.keys()).some(k => k.startsWith(code.toLowerCase() + " ") || k.startsWith(code.toLowerCase() + "-"));
        if (!hasCodeMatch && !dpMap.has(key)) {
          const isHidden = hiddenWilayasList.includes(fullWilayaLabel) || hiddenWilayasList.includes(code) || hiddenWilayasList.includes(name);
          dpMap.set(key, {
            id: `dp_${code}`,
            wilaya: fullWilayaLabel,
            home_price: 600,
            office_price: 400,
            is_hidden: isHidden
          });
        }
      });

      setDeliveryPrices(Array.from(dpMap.values()));

      // 10. Fetch Promo Codes
      let rawPromos: any[] = [];
      if (adminData && Array.isArray(adminData.promoCodes)) {
        rawPromos = adminData.promoCodes;
      } else {
        const promoRes = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
        rawPromos = promoRes.data || [];
      }

      setPromoCodes(rawPromos.map((p: any) => ({
        id: String(p.id),
        code: p.code || '',
        type: p.type || 'percent',
        value: Number(p.value !== undefined ? p.value : 0),
        minOrder: Number(p.min_order !== undefined ? p.min_order : (p.minOrder || 0)),
        maxUses: p.max_uses !== undefined && p.max_uses !== null ? Number(p.max_uses) : (p.maxUses || null),
        uses: Number(p.uses || 0),
        expiry: p.expiry || '',
        status: p.status || 'active',
        applyToAll: p.apply_to_all === true || p.applyToAll === true
      })));

      // 11. Fetch Bundle Configuration
      let rawBundle: any = null;
      if (adminData && adminData.bundle) {
        rawBundle = Array.isArray(adminData.bundle) ? adminData.bundle[0] : adminData.bundle;
      } else {
        const bundleRes = await supabase.from('bundle').select('*').limit(1);
        if (bundleRes.data && bundleRes.data.length > 0) rawBundle = bundleRes.data[0];
      }

      if (rawBundle) {
        setBundleConfig({
          id: rawBundle.id,
          bundleId: rawBundle.bundle_id || '',
          titleEn: rawBundle.title_en || '',
          titleFr: rawBundle.title_fr || '',
          titleAr: rawBundle.title_ar || '',
          descriptionEn: rawBundle.description_en || '',
          descriptionFr: rawBundle.description_fr || '',
          descriptionAr: rawBundle.description_ar || ''
        });
      }
    } catch (e: any) {
      console.warn("Data refresh notice:", e);
    }
    setIsLoading(false);
  };

  const playNewOrderSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch(e) {}
  }, []);

  const syncNewOrders = useCallback(async () => {
    try {
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (data && data.length > 0) {
        let hasNew = false;
        let newestOrderName = '';

        data.forEach((o: any) => {
          if (!knownOrderIdsRef.current.has(o.id)) {
            hasNew = true;
            knownOrderIdsRef.current.add(o.id);
            if (!newestOrderName) {
              newestOrderName = `${o.first_name || o.firstName || ''} ${o.last_name || o.lastName || ''}`.trim() || `#${o.id.slice(-6)}`;
            }
          }
        });

        if (hasNew) {
          setOrders(data);
          playNewOrderSound();
          showToast(`🔔 New Order Received from ${newestOrderName}!`);
        }
      }
    } catch(e) {}
  }, [playNewOrderSound]);

  useEffect(() => {
    if (!isAuthenticated) return;

    refreshAllData();

    // 1. Polling timer every 5 seconds for background sync
    const interval = setInterval(syncNewOrders, 5000);

    // 2. Real-time Supabase Subscription for instant order updates
    const channel = supabase
      .channel('orders-realtime-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: any) => {
        const newOrder = payload.new as Order;
        if (newOrder && !knownOrderIdsRef.current.has(newOrder.id)) {
          knownOrderIdsRef.current.add(newOrder.id);
          setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
          playNewOrderSound();
          const custName = `${newOrder.first_name || newOrder.firstName || ''} ${newOrder.last_name || newOrder.lastName || ''}`.trim() || `#${newOrder.id.slice(-6)}`;
          showToast(`🔔 New Order Received from ${custName}!`);
        }
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, syncNewOrders, playNewOrderSound]);

  // ── AUTOMATIC CATALOG PRODUCT STOCK SYNC WITH INVENTORY ITEMS ──
  const syncProductsWithInventory = (currentProds: Product[], currentInv: InventoryItem[]) => {
    const prodUpdates: { id: string; variants: any[]; stock: number }[] = [];

    const updatedProds = currentProds.map(p => {
      let pChanged = false;
      let bItems = p.bundleItems || (p as any).bundle_items || [];
      if (typeof bItems === 'string') { try { bItems = JSON.parse(bItems); } catch(e) { bItems = []; } }

      // 1. Composite Bundle Pack stock recalculation
      if (Array.isArray(bItems) && bItems.length > 0) {
        let minStock = Infinity;
        bItems.forEach(b => {
          const bQty = Number(b.qty) || 1;
          const targetSku = String(b.sku || b.productId || '').trim().toLowerCase();
          const invMatch = currentInv.find(i => 
            String(i.id || '').trim().toLowerCase() === targetSku || 
            String(i.sku || '').trim().toLowerCase() === targetSku
          );
          const cStock = invMatch ? (Number(invMatch.stock) || 0) : 0;
          minStock = Math.min(minStock, Math.floor(cStock / bQty));
        });
        const computedBStock = minStock === Infinity ? 0 : Math.max(0, minStock);
        if (p.stock !== computedBStock) {
          pChanged = true;
          p.stock = computedBStock;
          if (p.variants && p.variants.length > 0) p.variants[0].stock = computedBStock;
        }
      } 
      // 2. Product with Variants
      else if (p.variants && p.variants.length > 0) {
        const variants = JSON.parse(JSON.stringify(p.variants));
        variants.forEach((v: any) => {
          // If variant uses flavorSkus + flavorStock
          if (v.flavorSkus && typeof v.flavorSkus === 'object') {
            if (!v.flavorStock) v.flavorStock = {};
            Object.keys(v.flavorSkus).forEach(fKey => {
              const sku = String(v.flavorSkus[fKey] || '').trim().toLowerCase();
              if (sku) {
                const invMatch = currentInv.find(i => 
                  String(i.id || '').trim().toLowerCase() === sku || 
                  String(i.sku || '').trim().toLowerCase() === sku
                );
                if (invMatch && Number(v.flavorStock[fKey]) !== Number(invMatch.stock)) {
                  v.flavorStock[fKey] = Number(invMatch.stock) || 0;
                  pChanged = true;
                }
              }
            });
            const sumFStock = Object.values(v.flavorStock).reduce((s: number, q: any) => s + (Number(q) || 0), 0);
            if (v.stock !== sumFStock) {
              v.stock = sumFStock;
              pChanged = true;
            }
          } 
          // If variant uses single v.sku
          else if (v.sku) {
            const vSku = String(v.sku).trim().toLowerCase();
            const invMatch = currentInv.find(i => 
              String(i.id || '').trim().toLowerCase() === vSku || 
              String(i.sku || '').trim().toLowerCase() === vSku
            );
            if (invMatch && Number(v.stock) !== Number(invMatch.stock)) {
              v.stock = Number(invMatch.stock) || 0;
              pChanged = true;
            }
          }
        });

        const newTotStock = variants.reduce((s: number, vv: any) => s + (Number(vv.stock) || 0), 0);
        if (pChanged || p.stock !== newTotStock) {
          p.variants = variants;
          p.stock = newTotStock;
          prodUpdates.push({ id: p.id, variants, stock: newTotStock });
        }
      } 
      // 3. Simple Product without variants
      else {
        const pSku = String((p as any).sku || p.id || '').trim().toLowerCase();
        const invMatch = currentInv.find(i => 
          String(i.id || '').trim().toLowerCase() === pSku || 
          String(i.sku || '').trim().toLowerCase() === pSku ||
          (p.name && String(i.name || '').trim().toLowerCase() === p.name.trim().toLowerCase())
        );
        if (invMatch && Number(p.stock) !== Number(invMatch.stock)) {
          p.stock = Number(invMatch.stock) || 0;
          prodUpdates.push({ id: p.id, variants: [], stock: p.stock });
        }
      }

      return p;
    });

    if (prodUpdates.length > 0) {
      setProducts(updatedProds);
      localStorage.setItem('bb_products_cache', JSON.stringify(updatedProds));
      prodUpdates.forEach(async (u) => {
        try {
          await supabase.from('products').update({ variants: u.variants, stock: u.stock }).eq('id', u.id);
        } catch(e) {}
      });
    }

    return updatedProds;
  };

  // ── INVENTORY MUTATIONS ──
  const handleSaveInventoryItem = async (item: InventoryItem) => {
    const payload = { ...item, _lastUpdated: new Date().toISOString() };
    const dbPayload = toDbInventoryPayload(payload);

    try {
      const euMap = JSON.parse(localStorage.getItem('bb_inventory_stock_eu_map') || '{}');
      euMap[item.id] = Number(item.stock_eu) || 0;
      localStorage.setItem('bb_inventory_stock_eu_map', JSON.stringify(euMap));
    } catch(e) {}

    let nextInv: InventoryItem[] = [];
    setInventoryItems(prev => {
      nextInv = [...prev];
      const idx = nextInv.findIndex(x => x.id === item.id);
      if (idx >= 0) nextInv[idx] = payload;
      else nextInv.push(payload);
      localStorage.setItem('bb_inventory_items', JSON.stringify(nextInv));
      return nextInv;
    });

    syncProductsWithInventory(products, nextInv);

    try {
      const { error } = await supabase.from('inventory_items').upsert(dbPayload, { onConflict: 'id' });
      if (error) console.warn("Supabase inventory upsert notice:", error.message);
    } catch(e) {}
  };

  const handleSaveBulkInventoryItems = async (items: InventoryItem[]) => {
    const payloads = items.map(i => ({ ...i, _lastUpdated: new Date().toISOString() }));
    const dbPayloads = payloads.map(toDbInventoryPayload);

    try {
      const euMap = JSON.parse(localStorage.getItem('bb_inventory_stock_eu_map') || '{}');
      items.forEach(i => {
        euMap[i.id] = Number(i.stock_eu) || 0;
      });
      localStorage.setItem('bb_inventory_stock_eu_map', JSON.stringify(euMap));
    } catch(e) {}

    let nextInv: InventoryItem[] = [];
    setInventoryItems(prev => {
      nextInv = [...prev];
      payloads.forEach(item => {
        const idx = nextInv.findIndex(x => x.id === item.id);
        if (idx >= 0) nextInv[idx] = { ...nextInv[idx], ...item };
        else nextInv.push(item);
      });
      localStorage.setItem('bb_inventory_items', JSON.stringify(nextInv));
      return nextInv;
    });

    syncProductsWithInventory(products, nextInv);

    try {
      const { error } = await supabase.from('inventory_items').upsert(dbPayloads, { onConflict: 'id' });
      if (error) console.warn("Supabase bulk inventory upsert notice:", error.message);
    } catch(e) {}
  };

  // ── DELIVERY PRICE MUTATIONS ──
  const syncHiddenWilayasToDb = async (allDps: DeliveryPrice[]) => {
    const hiddenWilayaNames = allDps.filter(d => d.is_hidden).map(d => d.wilaya);
    try {
      await supabase.from('settings').upsert([
        { key: 'hidden_wilayas', value: JSON.stringify(hiddenWilayaNames) }
      ], { onConflict: 'key' });
    } catch(e) {}
  };

  const handleSaveDeliveryPrice = async (dp: DeliveryPrice) => {
    const dbPayload = {
      id: dp.id,
      wilaya: dp.wilaya,
      home_price: Number(dp.home_price) || 0,
      office_price: Number(dp.office_price) || 0
    };

    let updatedList: DeliveryPrice[] = [];
    setDeliveryPrices(prev => {
      const idx = prev.findIndex(x => String(x.id) === String(dp.id));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = dp;
        updatedList = next;
        return next;
      }
      updatedList = [...prev, dp];
      return updatedList;
    });

    try {
      await supabase.from('delivery_prices').upsert([dbPayload], { onConflict: 'id' });
      await syncHiddenWilayasToDb(updatedList);
    } catch(e) {}
  };

  const handleSaveBulkDeliveryPrices = async (dps: DeliveryPrice[]) => {
    const dbPayloads = dps.map(dp => ({
      id: dp.id,
      wilaya: dp.wilaya,
      home_price: Number(dp.home_price) || 0,
      office_price: Number(dp.office_price) || 0
    }));

    let updatedList: DeliveryPrice[] = [];
    setDeliveryPrices(prev => {
      const map = new Map(prev.map(x => [String(x.id), x]));
      dps.forEach(dp => map.set(String(dp.id), dp));
      updatedList = Array.from(map.values());
      return updatedList;
    });

    try {
      await supabase.from('delivery_prices').upsert(dbPayloads, { onConflict: 'id' });
      await syncHiddenWilayasToDb(updatedList);
      showToast(`Updated rates for ${dps.length} Wilayas!`);
    } catch(e) {}
  };

  // ── PROMO CODE MUTATIONS ──
  const handleSavePromoCode = async (promo: Partial<PromoCode>) => {
    const promoId = promo.id || `promo_${Date.now()}`;
    const dbPayload = {
      id: promoId,
      code: promo.code?.toUpperCase().trim(),
      type: promo.type || 'percent',
      value: Number(promo.value) || 0,
      min_order: Number(promo.minOrder) || 0,
      max_uses: promo.maxUses !== undefined && promo.maxUses !== null ? Number(promo.maxUses) : null,
      expiry: promo.expiry || null,
      status: promo.status || 'active',
      apply_to_all: promo.applyToAll !== false
    };

    const newObj: PromoCode = {
      id: promoId,
      code: promo.code?.toUpperCase().trim() || '',
      type: promo.type || 'percent',
      value: Number(promo.value) || 0,
      minOrder: Number(promo.minOrder) || 0,
      maxUses: promo.maxUses !== undefined && promo.maxUses !== null ? Number(promo.maxUses) : null,
      uses: promo.uses || 0,
      expiry: promo.expiry || '',
      status: promo.status || 'active',
      applyToAll: promo.applyToAll !== false
    };

    setPromoCodes(prev => {
      const idx = prev.findIndex(p => p.id === promoId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...newObj };
        return next;
      }
      return [newObj, ...prev];
    });

    try {
      const { error } = await supabase.from('promo_codes').upsert([dbPayload], { onConflict: 'id' });
      if (error) throw error;
      showToast(promo.id ? '✓ Promo code updated!' : '✓ Promo code created!');
    } catch(e: any) {
      console.error("Error saving promo code:", e.message);
      showToast('Saved locally', 'info');
    }
  };

  const handleDeletePromoCode = async (id: string) => {
    setPromoCodes(prev => prev.filter(p => p.id !== id));
    try {
      await supabase.from('promo_codes').delete().eq('id', id);
      showToast('Promo code deleted', 'info');
    } catch(e) {}
  };

  const handleTogglePromoStatus = async (id: string, newStatus: 'active' | 'inactive') => {
    setPromoCodes(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    try {
      await supabase.from('promo_codes').update({ status: newStatus }).eq('id', id);
      showToast(`Promo status set to ${newStatus}`);
    } catch(e) {}
  };

  // ── BUNDLE MUTATIONS ──
  const handleSaveBundle = async (bundle: BundleConfig) => {
    const dbPayload = {
      id: 1,
      bundle_id: bundle.bundleId || '',
      title_en: bundle.titleEn || null,
      title_fr: bundle.titleFr || null,
      title_ar: bundle.titleAr || null,
      description_en: bundle.descriptionEn || null,
      description_fr: bundle.descriptionFr || null,
      description_ar: bundle.descriptionAr || null
    };

    setBundleConfig(bundle);

    try {
      const { error } = await supabase.from('bundle').upsert([dbPayload], { onConflict: 'id' });
      if (error) throw error;
      showToast('✓ Featured Bundle offer saved successfully!');
    } catch(e: any) {
      console.error("Error saving bundle:", e.message);
      showToast('Saved locally', 'info');
    }
  };

  const handleDeleteDeliveryPrice = async (id: string | number) => {
    let updatedList: DeliveryPrice[] = [];
    setDeliveryPrices(prev => {
      updatedList = prev.filter(x => String(x.id) !== String(id));
      return updatedList;
    });
    try {
      await supabase.from('delivery_prices').delete().eq('id', id);
      await syncHiddenWilayasToDb(updatedList);
    } catch(e) {}
  };

  const handleDeleteInventoryItem = async (id: string) => {
    try {
      await supabase.from('inventory_items').delete().eq('id', id);
    } catch(e) {}

    try {
      const euMap = JSON.parse(localStorage.getItem('bb_inventory_stock_eu_map') || '{}');
      delete euMap[id];
      localStorage.setItem('bb_inventory_stock_eu_map', JSON.stringify(euMap));
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

  // ── STOCK ADJUSTMENT HELPER FOR ORDERS ──
  const adjustInventoryAndProductStock = async (items: any[], direction: number) => {
    // direction: -1 = deduct stock (order placed/active), +1 = restore stock (order canceled/deleted)
    if (!items || items.length === 0) return;

    let updatedInventory = [...inventoryItems];
    let updatedProducts = [...products];
    const invUpdates: { id: string; stock: number; fullItem?: InventoryItem }[] = [];
    const prodUpdates: { id: string; variants: any[]; stock: number }[] = [];

    for (const item of items) {
      const qty = Number(item.qty) || 1;
      const rawProdId = String(item.productId || item.product_id || '').trim();
      const rawItemName = String(item.name || item.product_name || '').trim().toLowerCase();
      const itemVariantLabel = String(item.variant || '').trim().toLowerCase();
      const itemFlavor = String(item.flavor || '').trim().toLowerCase();
      const cleanVar = itemVariantLabel.split('/')[0].replace(/\s+/g, '');

      // 1. Try finding matching product in Catalog Products
      let prod = updatedProducts.find(p => {
        if (rawProdId && p.id === rawProdId) return true;
        const pName = p.name.toLowerCase().trim();
        if (pName === rawItemName || rawItemName.includes(pName) || pName.includes(rawItemName)) return true;
        // Check if rawProdId matches any SKU inside product variants
        if (rawProdId && p.variants && Array.isArray(p.variants)) {
          return p.variants.some((v: any) => {
            if (v.sku && String(v.sku).toLowerCase() === rawProdId.toLowerCase()) return true;
            if (v.flavorSkus) {
              return Object.values(v.flavorSkus).some((s: any) => String(s).toLowerCase() === rawProdId.toLowerCase());
            }
            return false;
          });
        }
        return false;
      });

      if (prod) {
        // 1a. If Product is a Composite Bundle Pack, unpack and deduct stock for each included SKU / product component
        let bItems = prod.bundleItems || (prod as any).bundle_items || [];
        if (typeof bItems === 'string') { try { bItems = JSON.parse(bItems); } catch(e) { bItems = []; } }

        if (Array.isArray(bItems) && bItems.length > 0) {
          for (const bItem of bItems) {
            const componentQty = (Number(bItem.qty) || 1) * qty;
            const compTargetId = String(bItem.productId || bItem.sku || '').trim().toLowerCase();

            // Deduct / restore stock for component SKU in Inventory
            if (compTargetId) {
              const invIdx = updatedInventory.findIndex(i => 
                String(i.id || '').trim().toLowerCase() === compTargetId || 
                String(i.sku || (i as any).sku_id || '').trim().toLowerCase() === compTargetId ||
                (bItem.sku && (String(i.id || '').trim().toLowerCase() === String(bItem.sku).trim().toLowerCase() || String(i.sku || '').trim().toLowerCase() === String(bItem.sku).trim().toLowerCase()))
              );
              if (invIdx >= 0) {
                const invItem = { ...updatedInventory[invIdx] };
                const newInvStock = Math.max(0, (Number(invItem.stock) || 0) + direction * componentQty);
                invItem.stock = newInvStock;
                updatedInventory[invIdx] = invItem;
                invUpdates.push({ id: invItem.id, stock: newInvStock });
              }
            }

            // Deduct / restore stock for component in Catalog Products
            const compProd = updatedProducts.find(p => 
              String(p.id).trim().toLowerCase() === compTargetId || 
              (bItem.sku && (String(p.id).trim().toLowerCase() === String(bItem.sku).trim().toLowerCase() || (p.variants && p.variants.some((v: any) => String(v.sku || '').trim().toLowerCase() === String(bItem.sku).trim().toLowerCase())))) ||
              (p.variants && p.variants.some((v: any) => String(v.sku || '').trim().toLowerCase() === compTargetId))
            );

            if (compProd && compProd.variants && compProd.variants.length > 0) {
              const cVariants = JSON.parse(JSON.stringify(compProd.variants));
              let cIdx = cVariants.findIndex((v: any) => 
                String(v.sku || '').trim().toLowerCase() === compTargetId || 
                (bItem.sku && String(v.sku || '').trim().toLowerCase() === String(bItem.sku).trim().toLowerCase()) ||
                String(v.weight || v.label || '').toLowerCase().includes(String(bItem.variant || '').toLowerCase())
              );
              if (cIdx < 0) cIdx = 0;
              if (cVariants[cIdx]) {
                const v = cVariants[cIdx];
                if (v.flavorStock && Object.keys(v.flavorStock).length > 0) {
                  const targetFlavor = bItem.flavor || Object.keys(v.flavorStock)[0];
                  if (v.flavorStock[targetFlavor] !== undefined) {
                    const curF = Number(v.flavorStock[targetFlavor]) || 0;
                    v.flavorStock[targetFlavor] = Math.max(0, curF + direction * componentQty);
                  }
                  v.stock = Object.values(v.flavorStock).reduce((s: number, q: any) => s + Number(q), 0);
                } else {
                  v.stock = Math.max(0, (Number(v.stock) || 0) + direction * componentQty);
                }
                cVariants[cIdx] = v;
                const cStock = cVariants.reduce((s: number, vv: any) => s + (Number(vv.stock) || 0), 0);
                compProd.variants = cVariants;
                compProd.stock = cStock;
                prodUpdates.push({ id: compProd.id, variants: cVariants, stock: cStock });
              }
            }
          }

          // Recalculate bundle stock for this bundle product itself based on component inventory
          let minBStock = Infinity;
          for (const bItem of bItems) {
            const bQty = Number(bItem.qty) || 1;
            const targetSku = String(bItem.sku || bItem.productId || '').trim().toLowerCase();
            const invMatch = updatedInventory.find(i => String(i.id).trim().toLowerCase() === targetSku);
            const cStock = invMatch ? (Number(invMatch.stock) || 0) : 0;
            minBStock = Math.min(minBStock, Math.floor(cStock / bQty));
          }
          const finalBStock = minBStock === Infinity ? Math.max(0, (Number(prod.stock) || 0) + direction * qty) : Math.max(0, minBStock);
          prod.stock = finalBStock;
          if (prod.variants && prod.variants.length > 0) prod.variants[0].stock = finalBStock;
          prodUpdates.push({ id: prod.id, variants: prod.variants || [], stock: finalBStock });

          continue;
        }

        const variants = JSON.parse(JSON.stringify(prod.variants || []));

        // 1b. If Product has NO variants (e.g. Egg White / Simple Products)
        if (variants.length === 0) {
          const curStock = Number(prod.stock) || 0;
          const newGlobalStock = Math.max(0, curStock + direction * qty);
          prod.stock = newGlobalStock;

          // Deduct from prod.flavors if present
          if (prod.flavors && Array.isArray(prod.flavors)) {
            const flavors = JSON.parse(JSON.stringify(prod.flavors));
            const fIdx = flavors.findIndex((f: any) => {
              const fName = typeof f === 'object' ? String(f.name || '').trim().toLowerCase() : String(f).trim().toLowerCase();
              return fName === itemFlavor;
            });
            if (fIdx >= 0 && typeof flavors[fIdx] === 'object') {
              const curFQ = Number(flavors[fIdx].qty) || 0;
              flavors[fIdx].qty = Math.max(0, curFQ + direction * qty);
              prod.flavors = flavors;
            }
          }

          prodUpdates.push({ id: prod.id, variants: [], stock: newGlobalStock });

          // Also sync linked SKU or Name in Inventory Items
          const targetSku = String((prod as any).sku || prod.id || '').trim().toLowerCase();
          const invIdx = updatedInventory.findIndex(i => 
            String(i.id || '').trim().toLowerCase() === targetSku ||
            String(i.sku || (i as any).sku_id || '').trim().toLowerCase() === targetSku ||
            (rawItemName.length > 2 && String(i.name || '').trim().toLowerCase() === rawItemName)
          );
          if (invIdx >= 0) {
            const invItem = { ...updatedInventory[invIdx] };
            const newInvStock = Math.max(0, (Number(invItem.stock) || 0) + direction * qty);
            invItem.stock = newInvStock;
            updatedInventory[invIdx] = invItem;
            invUpdates.push({ id: invItem.id, stock: newInvStock });
          }

          continue;
        }

        // 1c. Product HAS variants
        let matchedIdx = -1;

        if (cleanVar) {
          matchedIdx = variants.findIndex((v: any) => {
            if (typeof v !== 'object') return String(v).toLowerCase().replace(/\s+/g, '') === cleanVar;
            const vWeight = String(v.weight || '').toLowerCase().replace(/\s+/g, '');
            const vUnit = String(v.unit || '').toLowerCase().replace(/\s+/g, '');
            const vCombo = (vWeight + vUnit);
            const vLabel = String(v.label || v.name || '').toLowerCase().replace(/\s+/g, '');
            const vSku = String(v.sku || '').toLowerCase().replace(/\s+/g, '');
            return vCombo === cleanVar || vWeight === cleanVar || vLabel === cleanVar || vSku === cleanVar || cleanVar.includes(vWeight) || (v.sku && String(v.sku).toLowerCase() === rawProdId.toLowerCase());
          });
        }
        if (matchedIdx < 0 && rawProdId) {
          matchedIdx = variants.findIndex((v: any) => {
            if (v.sku && String(v.sku).toLowerCase() === rawProdId.toLowerCase()) return true;
            if (v.flavorSkus) {
              return Object.values(v.flavorSkus).some((s: any) => String(s).toLowerCase() === rawProdId.toLowerCase());
            }
            return false;
          });
        }
        // Fallback: If no specific variant matched, default to first variant so stock is ALWAYS deducted!
        if (matchedIdx < 0) matchedIdx = 0;

        if (matchedIdx >= 0 && variants[matchedIdx]) {
          const v = variants[matchedIdx];
          let matchedFlavorKey = '';

          if (itemFlavor && v.flavorStock) {
            matchedFlavorKey = Object.keys(v.flavorStock).find(k => k.trim().toLowerCase() === itemFlavor) || '';
          }
          if (!matchedFlavorKey && v.flavorStock && Object.keys(v.flavorStock).length === 1) {
            matchedFlavorKey = Object.keys(v.flavorStock)[0];
          }

          let linkedSku = '';
          if (matchedFlavorKey && v.flavorSkus) {
            linkedSku = v.flavorSkus[matchedFlavorKey] || '';
          }
          if (!linkedSku && v.sku) linkedSku = v.sku;

          if (matchedFlavorKey && v.flavorStock) {
            const curFStock = Number(v.flavorStock[matchedFlavorKey]) || 0;
            v.flavorStock[matchedFlavorKey] = Math.max(0, curFStock + direction * qty);
            v.stock = Object.values(v.flavorStock).reduce((s: number, q: any) => s + Number(q), 0);
          } else {
            v.stock = Math.max(0, (Number(v.stock) || 0) + direction * qty);
          }

          variants[matchedIdx] = v;
          const newGlobalStock = variants.reduce((s: number, vv: any) => s + (Number(vv.stock) || 0), 0);
          prod.variants = variants;
          prod.stock = newGlobalStock;
          prodUpdates.push({ id: prod.id, variants, stock: newGlobalStock });

          // Also update linked SKU in Inventory
          const skuSearch = (linkedSku || rawProdId).trim().toLowerCase();
          if (skuSearch) {
            const invIdx = updatedInventory.findIndex(i => 
              String(i.id || '').trim().toLowerCase() === skuSearch ||
              String(i.sku || (i as any).sku_id || '').trim().toLowerCase() === skuSearch ||
              (rawItemName.length > 2 && String(i.name || '').trim().toLowerCase() === rawItemName)
            );
            if (invIdx >= 0) {
              const invItem = { ...updatedInventory[invIdx] };
              const newInvStock = Math.max(0, (Number(invItem.stock) || 0) + direction * qty);
              invItem.stock = newInvStock;
              updatedInventory[invIdx] = invItem;
              invUpdates.push({ id: invItem.id, stock: newInvStock });
            }
          }
          continue;
        }
      }

      // 2. Fallback: Direct SKU or Name deduction in Inventory Items if item was added directly from Inventory SKUs tab
      const targetClean = (rawProdId || rawItemName).toLowerCase();
      if (targetClean) {
        const invIdx = updatedInventory.findIndex(i => 
          String(i.id || '').trim().toLowerCase() === targetClean ||
          String(i.sku || (i as any).sku_id || '').trim().toLowerCase() === targetClean ||
          (rawItemName.length > 2 && String(i.name || '').trim().toLowerCase() === rawItemName)
        );
        if (invIdx >= 0) {
          const invItem = { ...updatedInventory[invIdx] };
          const newInvStock = Math.max(0, (Number(invItem.stock) || 0) + direction * qty);
          invItem.stock = newInvStock;
          updatedInventory[invIdx] = invItem;
          invUpdates.push({ id: invItem.id, stock: newInvStock });
        }
      }
    }

    if (invUpdates.length > 0) {
      setInventoryItems([...updatedInventory]);
      localStorage.setItem('bb_inventory_items', JSON.stringify(updatedInventory));
    }
    if (prodUpdates.length > 0) {
      setProducts([...updatedProducts]);
      localStorage.setItem('bb_products_cache', JSON.stringify(updatedProducts));
    }

    // Always run automatic catalog product sync to ensure all variant & flavor stocks stay 100% refreshed
    syncProductsWithInventory(updatedProducts, updatedInventory);

    try {
      for (const u of invUpdates) {
        if ((u as any).fullItem) {
          const { stock_eu, _lastUpdated, ...cleanObj } = (u as any).fullItem;
          await supabase.from('inventory_items').upsert(cleanObj, { onConflict: 'id' });
        } else {
          await supabase.from('inventory_items').update({ stock: u.stock }).eq('id', u.id);
        }
      }
      for (const u of prodUpdates) {
        await supabase.from('products').update({ variants: u.variants, stock: u.stock }).eq('id', u.id);
      }
    } catch (e) {
      console.warn("Stock sync notice:", e);
    }
  };

  // ── BUDGET ADJUSTMENT HELPER (DZD & EUR) ──
  const adjustBudget = async (currency: 'DZD' | 'EUR', amount: number) => {
    if (!amount || amount === 0) return;

    if (currency === 'EUR') {
      const currentEur = parseFloat(settings.budget_eur) || 0;
      const newEur = parseFloat((currentEur + amount).toFixed(2)).toString();
      setSettings(prev => ({ ...prev, budget_eur: newEur }));
      try {
        await supabase.from('settings').upsert([{ key: 'budget_eur', value: newEur }]);
      } catch(e) {}
    } else {
      const currentDzd = parseFloat(settings.budget_dzd) || 0;
      const newDzd = Math.round(currentDzd + amount).toString();
      setSettings(prev => ({ ...prev, budget_dzd: newDzd }));
      try {
        await supabase.from('settings').upsert([{ key: 'budget_dzd', value: newDzd }]);
      } catch(e) {}
    }
  };

  const adjustDzdBudget = (amount: number) => adjustBudget('DZD', amount);

  const getOrderSubtotal = (o: Order) => {
    if (!o) return 0;
    if (o.subtotal !== undefined && o.subtotal !== null && Number(o.subtotal) > 0) {
      return Number(o.subtotal);
    }
    const delCost = Number(o.delivery_cost !== undefined ? o.delivery_cost : (o.deliveryCost || 0));
    const tot = Number(o.total || 0);
    return Math.max(0, tot - delCost);
  };

  // ── ORDER MUTATIONS ──
  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    const existing = orders.find(o => o.id === orderId);
    if (existing && existing.status !== newStatus) {
      // Stock management: restore stock if canceled, deduct stock if un-canceled
      if (newStatus === 'canceled' && existing.status !== 'canceled') {
        await adjustInventoryAndProductStock(existing.items || [], +1);
      } else if (existing.status === 'canceled' && newStatus !== 'canceled') {
        await adjustInventoryAndProductStock(existing.items || [], -1);
      }

      // DZD Budget management: ONLY Subtotal (excluding delivery costs) is added to DZD Budget when order is in 'delivered' status
      const existingSubtotal = getOrderSubtotal(existing);
      if (existing.status === 'delivered' && newStatus !== 'delivered') {
        await adjustDzdBudget(-existingSubtotal);
      } else if (existing.status !== 'delivered' && newStatus === 'delivered') {
        await adjustDzdBudget(+existingSubtotal);
      }
    }

    try {
      await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    } catch(e) {}

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    showToast(`✓ Order #${orderId.slice(-6)} updated to ${newStatus}`);
  };

  const handleDeleteOrder = async (orderId: string) => {
    const existing = orders.find(o => o.id === orderId);
    if (existing) {
      if (existing.status !== 'canceled') {
        await adjustInventoryAndProductStock(existing.items || [], +1);
      }
      // If order was in 'delivered' status when deleted, subtract its subtotal (excluding delivery) from DZD Budget
      if (existing.status === 'delivered') {
        const existingSubtotal = getOrderSubtotal(existing);
        await adjustDzdBudget(-existingSubtotal);
      }
    }

    try {
      await supabase.from('orders').delete().eq('id', orderId);
    } catch(e) {}

    setOrders(prev => prev.filter(o => o.id !== orderId));
    showToast("✓ Order deleted, stock restored & DZD budget adjusted!");
  };

  const handleAddPosOrder = async (orderData: { items: any[]; subtotal: number; total: number; firstName: string; phone: string; paymentStatus?: 'paid' | 'unpaid' }) => {
    const id = `POS-${Date.now()}`;
    const isUnpaid = orderData.paymentStatus === 'unpaid';

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
      status: isUnpaid ? 'unpaid' : 'delivered',
      payment_status: isUnpaid ? 'unpaid' : 'paid',
      is_unpaid: isUnpaid,
      date: new Date().toISOString()
    };

    // Deduct stock for POS order (runs for both paid and unpaid credit sales)
    await adjustInventoryAndProductStock(newOrder.items || [], -1);

    // Add paid order subtotal (products only) to DZD Budget
    const newOrderSubtotal = getOrderSubtotal(newOrder);
    if (!isUnpaid && newOrderSubtotal > 0) {
      await adjustDzdBudget(+newOrderSubtotal);
    }

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
        created_at: newOrder.date
      });
    } catch(e) {}

    setOrders(prev => [newOrder, ...prev]);
    if (isUnpaid) {
      showToast(`✓ Unpaid Sale recorded! Added to Unpaid & Credit tab.`, 'info');
    } else {
      showToast(`✓ POS Order #${id} recorded! ${newOrderSubtotal.toLocaleString()} DA added to DZD Budget.`);
    }
  };

  const handleMarkOrderAsPaid = async (orderId: string) => {
    const target = orders.find(o => o.id === orderId);
    if (target) {
      const subtotal = getOrderSubtotal(target);
      if (subtotal > 0) {
        await adjustDzdBudget(+subtotal);
      }
    }

    try {
      await supabase.from('orders').update({
        status: 'delivered'
      }).eq('id', orderId);
    } catch(e) {}

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: 'delivered',
          payment_status: 'paid',
          is_unpaid: false,
          paid_at: new Date().toISOString()
        };
      }
      return o;
    }));

    showToast(`✓ Order #${orderId} marked as Paid! Moved to Sales & added to DZD Budget.`);
  };

  // ── PREORDER MUTATIONS ──
  const createOrSyncOrderFromPreorder = async (pre: PreOrder, items: any[]) => {
    const orderId = `ORD-PRE-${pre.id}`;
    let totalAmt = pre.total_amount || 0;
    const itemsForPre = items.filter(i => i.pre_order_id === pre.id);

    if (!totalAmt && itemsForPre.length > 0) {
      totalAmt = itemsForPre.reduce((sum, i) => sum + (Number(i.unit_price || i.price || 0) * (Number(i.qty) || 1)), 0);
    }

    const orderFromPre: Order = {
      id: orderId,
      source: 'Pre-Order',
      firstName: pre.customer_name || 'Pre-Order Customer',
      lastName: '',
      phone: pre.customer_phone || '',
      address: pre.notes || 'Fulfilled Pre-Order',
      wilaya: 'Alger',
      commune: 'Alger',
      deliveryType: 'store',
      deliveryCost: 0,
      items: itemsForPre.map(i => ({
        productId: i.product_id,
        name: i.product_name,
        variant: i.variant,
        flavor: i.flavor,
        qty: Number(i.qty) || 1,
        price: Number(i.unit_price || i.price) || 0
      })),
      subtotal: totalAmt,
      total: totalAmt,
      status: 'delivered',
      payment_status: 'paid',
      is_unpaid: false,
      date: pre.date || new Date().toISOString()
    };

    try {
      await supabase.from('orders').upsert({
        id: orderFromPre.id,
        source: orderFromPre.source,
        first_name: orderFromPre.firstName,
        last_name: orderFromPre.lastName,
        phone: orderFromPre.phone,
        address: orderFromPre.address,
        wilaya: orderFromPre.wilaya,
        commune: orderFromPre.commune,
        delivery_type: orderFromPre.deliveryType,
        delivery_cost: orderFromPre.deliveryCost,
        items: orderFromPre.items,
        subtotal: orderFromPre.subtotal,
        total: orderFromPre.total,
        status: orderFromPre.status,
        created_at: orderFromPre.date
      }, { onConflict: 'id' });
    } catch(e) {}

    setOrders(prev => {
      const idx = prev.findIndex(o => o.id === orderId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = orderFromPre;
        return next;
      }
      return [orderFromPre, ...prev];
    });
  };

  const removeOrderForPreorder = async (preorderId: string) => {
    const orderId = `ORD-PRE-${preorderId}`;
    try {
      await supabase.from('orders').delete().eq('id', orderId);
    } catch(e) {}
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const handleSavePreorder = async (preorderData: Partial<PreOrder>, items: any[]) => {
    const preId = preorderData.id || `PRE-${Date.now()}`;
    const existing = preorders.find(p => p.id === preId);

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

    // Deduct stock for new preorders, or adjust for edits
    if (!existing) {
      await adjustInventoryAndProductStock(newItems, -1);
    } else {
      const oldItems = preorderItems.filter(i => i.pre_order_id === preId);
      await adjustInventoryAndProductStock(oldItems, +1);
      await adjustInventoryAndProductStock(newItems, -1);
    }

    // Sync budget & orders table if fulfilled
    if (newPreorder.total_amount > 0 || newItems.length > 0) {
      if (newPreorder.status === 'fulfilled' && (!existing || existing.status !== 'fulfilled')) {
        await adjustDzdBudget(+newPreorder.total_amount);
        await createOrSyncOrderFromPreorder(newPreorder, newItems);
      } else if (existing && existing.status === 'fulfilled' && newPreorder.status !== 'fulfilled') {
        await adjustDzdBudget(-existing.total_amount);
        await removeOrderForPreorder(newPreorder.id);
      } else if (newPreorder.status === 'fulfilled') {
        await createOrSyncOrderFromPreorder(newPreorder, newItems);
      }
    }

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
    const nextStatus: PreOrder['status'] = currentStatus === 'fulfilled' ? 'pending' : 'fulfilled';
    const targetPre = preorders.find(p => p.id === preorderId);
    let totalAmt = targetPre?.total_amount || 0;

    if (!totalAmt) {
      const itemsForPre = preorderItems.filter(i => i.pre_order_id === preorderId);
      totalAmt = itemsForPre.reduce((sum, i) => sum + (Number(i.unit_price || i.price || 0) * (Number(i.qty) || 1)), 0);
    }

    if (totalAmt > 0) {
      if (currentStatus !== 'fulfilled') {
        await adjustDzdBudget(+totalAmt);
      } else {
        await adjustDzdBudget(-totalAmt);
      }
    }

    if (nextStatus === 'fulfilled' && targetPre) {
      await createOrSyncOrderFromPreorder({ ...targetPre, status: 'fulfilled' }, preorderItems);
    } else {
      await removeOrderForPreorder(preorderId);
    }

    try {
      await supabase.from('pre_orders').update({ status: nextStatus }).eq('id', preorderId);
    } catch(e) {}

    setPreorders(prev => prev.map(p => p.id === preorderId ? { ...p, status: nextStatus } : p));
    showToast(`✓ Pre-order status changed to ${nextStatus}${nextStatus === 'fulfilled' ? ` (${totalAmt.toLocaleString()} DA added to Orders & Budget)` : ''}`);
  };

  const handleDeletePreorder = async (preorderId: string) => {
    const targetPre = preorders.find(p => p.id === preorderId);
    if (targetPre && targetPre.status === 'fulfilled') {
      let totalAmt = targetPre.total_amount || 0;
      if (!totalAmt) {
        const itemsForPre = preorderItems.filter(i => i.pre_order_id === preorderId);
        totalAmt = itemsForPre.reduce((sum, i) => sum + (Number(i.unit_price || i.price || 0) * (Number(i.qty) || 1)), 0);
      }
      if (totalAmt > 0) {
        await adjustDzdBudget(-totalAmt);
      }
      await removeOrderForPreorder(preorderId);
    }

    // Restore reserved stock
    const itemsForPre = preorderItems.filter(i => i.pre_order_id === preorderId);
    if (itemsForPre.length > 0) {
      await adjustInventoryAndProductStock(itemsForPre, +1);
    }

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

    // Deduct expense amount from the corresponding budget (DZD or EUR)
    if (newExp.amount > 0) {
      await adjustBudget(newExp.currency, -newExp.amount);
    }

    try {
      await supabase.from('expenses').insert(newExp);
    } catch(e) {}

    setExpenses(prev => [newExp, ...prev]);
    showToast(`✓ Expense of ${newExp.currency === 'EUR' ? '€ ' : ''}${newExp.amount.toLocaleString()} ${newExp.currency === 'DZD' ? 'DA' : ''} recorded & deducted from ${newExp.currency} Budget!`);
  };

  const handleDeleteExpense = async (id: string) => {
    const existing = expenses.find(x => x.id === id);
    if (existing && existing.amount > 0) {
      // Refund expense amount back to the corresponding budget (DZD or EUR)
      await adjustBudget(existing.currency, +existing.amount);
    }

    try {
      await supabase.from('expenses').delete().eq('id', id);
    } catch(e) {}

    setExpenses(prev => prev.filter(x => x.id !== id));
    showToast("✓ Expense deleted & budget restored!");
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

  const unpaidCount = useMemo(() => {
    return orders.filter(o => o.status === 'unpaid' || o.payment_status === 'unpaid' || o.is_unpaid === true).length;
  }, [orders]);

  // ── RENDER: session check loading screen ──
  if (isSessionChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-red-700 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-lg">
            B
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
            <span>Checking session...</span>
          </div>
        </div>
      </div>
    );
  }

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
            <p className="text-[11px] text-slate-500">Use <span className="text-slate-300 font-mono">admin@bybens.com</span> or your registered email</p>
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

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900 overflow-hidden">
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
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          adminEmail={adminEmail}
          onLogout={handleLogout}
          unpaidCount={unpaidCount}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Content View Container */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-8">
          {/* Top bar: notification bell + search */}
          <div className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur-md border-b border-slate-200/60 px-3 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-2 print:hidden">
            {/* Mobile Hamburger Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 md:hidden flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0"
              title="Open Navigation Menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 ml-auto">
              {/* Budget Counter Pill (EUR & DZD) */}
              <button
                onClick={() => setIsBudgetModalOpen(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-900 text-white rounded-xl border border-slate-700/80 hover:border-emerald-500/80 shadow-xs hover:shadow-md transition-all cursor-pointer group text-xs shrink-0"
                title="Click to view/manage budget balances or convert DZD to EUR"
              >
                <div className="flex items-center gap-1 font-black">
                  <span className="text-emerald-400">€</span>
                  <span className="font-extrabold text-white tracking-tight">
                    {Number(settings.budget_eur || 0).toLocaleString('fr-DZ')}
                  </span>
                </div>
                <div className="h-3 w-px bg-slate-700 mx-0.5" />
                <div className="flex items-center gap-1 font-black">
                  <span className="text-amber-400">DA</span>
                  <span className="font-extrabold text-slate-200 tracking-tight">
                    {Number(settings.budget_dzd || 0).toLocaleString('fr-DZ')}
                  </span>
                </div>
                <RefreshCw className="w-3 h-3 text-slate-400 group-hover:text-emerald-400 group-hover:rotate-180 transition-all duration-500 ml-0.5 shrink-0 hidden sm:block" />
              </button>

              {/* Quick Link to Storefront */}
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 hover:border-emerald-300 rounded-xl font-bold text-xs transition-all shrink-0 active:scale-95 shadow-2xs group"
                title="Open live customer storefront website"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-600 group-hover:rotate-12 transition-transform" />
                <span className="hidden sm:inline">Storefront</span>
                <ExternalLink className="w-3 h-3 text-emerald-600/70" />
              </a>

              {/* Global Search Trigger */}
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 text-xs text-slate-400 bg-white border border-slate-200 rounded-xl p-2 sm:px-3 sm:py-2 hover:shadow-sm hover:border-slate-300 transition-all w-9 sm:w-48 text-left justify-center sm:justify-start shrink-0"
                title="Search..."
              >
                <Search className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span className="hidden sm:inline">Search...</span>
                <kbd className="ml-auto text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-mono hidden sm:inline">/</kbd>
              </button>

              {/* Notification Bell */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setNotifOpen(v => !v)}
                  className="relative p-2 rounded-xl bg-white border border-slate-200 hover:shadow-sm transition-all flex items-center justify-center"
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

              {/* Sign Out Button (Top Right Near Bell) */}
              <button
                onClick={handleLogout}
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 hover:border-rose-300 transition-all flex items-center gap-1.5 font-bold text-xs shrink-0 active:scale-95 shadow-2xs ml-1"
                title="Sign Out of Admin Panel"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
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

            {activeTab === 'promos' && (
              <PromoCodesPage
                promoCodes={promoCodes}
                onSavePromoCode={handleSavePromoCode}
                onDeletePromoCode={handleDeletePromoCode}
                onToggleStatus={handleTogglePromoStatus}
              />
            )}

            {activeTab === 'bundle' && (
              <BundlePage
                products={products}
                bundleConfig={bundleConfig}
                onSaveBundle={handleSaveBundle}
                showToast={showToast}
              />
            )}

            {activeTab === 'delivery' && (
              <DeliveryPricesPage
                deliveryPrices={deliveryPrices}
                onSaveDeliveryPrice={handleSaveDeliveryPrice}
                onSaveBulkDeliveryPrices={handleSaveBulkDeliveryPrices}
                onDeleteDeliveryPrice={handleDeleteDeliveryPrice}
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
                customers={customers}
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
                    items: data.cart.map(c => ({ productId: c.productId, name: c.name, qty: c.qty, price: c.price, variant: c.variant, flavor: c.flavor })),
                    subtotal: data.subtotal,
                    total: data.totalAmount,
                    firstName: data.customerName,
                    phone: data.customerPhone,
                    paymentStatus: data.paymentStatus
                  });
                }}
              />
            )}

            {activeTab === 'unpaid' && (
              <UnpaidOrdersPage
                orders={orders}
                inventoryItems={inventoryItems}
                products={products}
                onMarkAsPaid={handleMarkOrderAsPaid}
                onDeleteOrder={handleDeleteOrder}
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

      {/* ── Mobile Bottom Quick-Navigation Bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around text-white shadow-2xl">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold transition-all ${
            activeTab === 'dashboard' ? 'text-red-500 bg-slate-800' : 'text-slate-400 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Home</span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold transition-all ${
            activeTab === 'inventory' ? 'text-red-500 bg-slate-800' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Stock</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold transition-all ${
            activeTab === 'products' ? 'text-red-500 bg-slate-800' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Products</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold transition-all relative ${
            activeTab === 'orders' ? 'text-red-500 bg-slate-800' : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="relative">
            <ShoppingCart className="w-4 h-4" />
            {unpaidCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-black text-[8px] w-3 h-3 rounded-full flex items-center justify-center">
                {unpaidCount}
              </span>
            )}
          </span>
          <span>Orders</span>
        </button>

        <button
          onClick={() => setActiveTab('pos')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold transition-all ${
            activeTab === 'pos' ? 'text-red-500 bg-slate-800' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>POS</span>
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold text-slate-400 hover:text-white transition-all"
        >
          <Menu className="w-4 h-4" />
          <span>More</span>
        </button>
      </nav>

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

      {/* ── Budget & Currency Exchange Modal ── */}
      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        showToast={showToast}
      />
    </div>
  );
}
