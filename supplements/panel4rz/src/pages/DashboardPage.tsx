import React, { useState, useMemo, useEffect, useRef } from 'react';
import { InventoryItem, Order, PreOrder, Expense, Product, Customer } from '../types';
import {
  TrendingUp, ShoppingCart, DollarSign, Warehouse,
  AlertTriangle, CheckCircle, ChevronDown, BarChart2,
  ListOrdered, Users, Package, Zap, ArrowUp, ArrowDown
} from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface DashboardPageProps {
  orders: Order[];
  preorders: PreOrder[];
  preorderItems: any[];
  inventoryItems: InventoryItem[];
  products: Product[];
  expenses: Expense[];
  eurRate: number;
  customers?: Customer[];
  settings?: any;
}

type Period = 'week' | 'month' | 'all';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtNum(n: number) { return Math.round(n).toLocaleString('fr-DZ'); }

function getDateMs(o: Order): number {
  try { return new Date(o.created_at || o.date || 0).getTime(); } catch { return 0; }
}

function isInPeriod(ms: number, period: Period): boolean {
  if (period === 'all') return true;
  const days = period === 'week' ? 7 : 30;
  return ms >= Date.now() - days * 86400000;
}

/** Compute landed unit cost (DZD) for a SKU from inventory */
function getLandedCost(sku: string | undefined, inventoryItems: InventoryItem[], eurRate: number): number {
  if (!sku) return 0;
  const inv = inventoryItems.find(i => String(i.id).trim().toLowerCase() === String(sku).trim().toLowerCase());
  if (!inv) return 0;
  const rate = Number(inv.rate) || eurRate || 280;
  return (Number(inv.price_eur) || 0) * rate + (Number(inv.delivery_dzd) || 0);
}

// ─────────────────────────────────────────────
// Animated Counter
// ─────────────────────────────────────────────
function AnimatedCounter({ value, duration = 800, prefix = '', suffix = '', decimals = 0 }: {
  value: number; duration?: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number>(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = value;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    }
    startRef.current = start;
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString('fr-DZ');

  return <span>{prefix}{formatted}{suffix}</span>;
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />;
}

// ─────────────────────────────────────────────
// SVG Revenue Bar Chart (last 6 months)
// ─────────────────────────────────────────────
function RevenueBarChart({ orders, preorders, posOrders }: {
  orders: Order[];
  preorders: PreOrder[];
  posOrders: Order[];
}) {
  const months = useMemo(() => {
    const now = new Date();
    const result: { label: string; online: number; pos: number; preorder: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en', { month: 'short' });
      const year = d.getFullYear();
      const month = d.getMonth();

      const matchMonth = (dateStr: string | undefined | null) => {
        if (!dateStr) return false;
        const dd = new Date(dateStr);
        return dd.getFullYear() === year && dd.getMonth() === month;
      };

      const online = orders
        .filter(o => !posOrders.includes(o) && o.status !== 'canceled' && matchMonth(o.created_at || o.date))
        .reduce((s, o) => s + (Number(o.total) || 0), 0);

      const pos = posOrders
        .filter(o => matchMonth(o.created_at || o.date))
        .reduce((s, o) => s + (Number(o.total) || 0), 0);

      const preorder = preorders
        .filter(p => p.status === 'fulfilled' && matchMonth(p.date || p.created_at))
        .reduce((s, p) => s + (Number(p.total_amount) || 0), 0);

      result.push({ label, online, pos, preorder });
    }
    return result;
  }, [orders, preorders, posOrders]);

  const maxVal = Math.max(...months.map(m => m.online + m.pos + m.preorder), 1);
  const H = 120;
  const W = 100;

  return (
    <div className="flex items-end gap-1.5 h-36 pt-2" style={{ width: '100%' }}>
      {months.map((m, i) => {
        const total = m.online + m.pos + m.preorder;
        const pctOnline = m.online / maxVal;
        const pctPos = m.pos / maxVal;
        const pctPre = m.preorder / maxVal;
        const totalH = (total / maxVal) * H;
        const isLast = i === months.length - 1;
        return (
          <div key={m.label} className="flex-1 flex flex-col items-center gap-1 group relative">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] rounded-lg px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-28 text-center shadow-xl">
              <div className="font-bold mb-0.5">{m.label}</div>
              {m.online > 0 && <div className="text-blue-300">Online: {fmtNum(m.online)} DA</div>}
              {m.pos > 0 && <div className="text-emerald-300">POS: {fmtNum(m.pos)} DA</div>}
              {m.preorder > 0 && <div className="text-purple-300">Pre-order: {fmtNum(m.preorder)} DA</div>}
              <div className="text-white font-bold border-t border-slate-700 mt-0.5 pt-0.5">Total: {fmtNum(total)} DA</div>
            </div>

            {/* Stacked bar */}
            <div className="flex-1 w-full flex flex-col justify-end rounded-t-lg overflow-hidden"
              style={{ maxHeight: H }}>
              {total === 0 ? (
                <div className="w-full h-1 bg-slate-100 rounded-full" />
              ) : (
                <div className={`w-full flex flex-col justify-end rounded-t-lg overflow-hidden transition-all ${isLast ? 'ring-2 ring-red-400 ring-offset-1' : ''}`}
                  style={{ height: `${totalH}px` }}>
                  {m.preorder > 0 && (
                    <div style={{ height: `${(pctPre / (pctOnline + pctPos + pctPre)) * 100}%`, minHeight: 4 }}
                      className="w-full bg-purple-400" />
                  )}
                  {m.pos > 0 && (
                    <div style={{ height: `${(pctPos / (pctOnline + pctPos + pctPre)) * 100}%`, minHeight: 4 }}
                      className="w-full bg-emerald-500" />
                  )}
                  {m.online > 0 && (
                    <div style={{ height: `${(pctOnline / (pctOnline + pctPos + pctPre)) * 100}%`, minHeight: 4 }}
                      className="w-full bg-blue-500 rounded-t-sm" />
                  )}
                </div>
              )}
            </div>
            <div className={`text-[9px] font-bold mt-1 ${isLast ? 'text-red-600' : 'text-slate-400'}`}>{m.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Channel Pill
// ─────────────────────────────────────────────
function ChannelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="text-slate-500">{fmtNum(value)} DA <span className="text-slate-400">({pct.toFixed(0)}%)</span></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export const DashboardPage: React.FC<DashboardPageProps> = ({
  orders,
  preorders,
  preorderItems,
  inventoryItems,
  products,
  expenses,
  eurRate,
  customers = [],
}) => {
  const [period, setPeriod] = useState<Period>('month');
  const [dashTab, setDashTab] = useState<'orders' | 'financial'>('orders');
  const [lowStockAll, setLowStockAll] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  // ── Sort orders newest first ──
  const allOrders = useMemo(() =>
    [...orders].sort((a, b) => getDateMs(b) - getDateMs(a)), [orders]);

  const posOrders = useMemo(() =>
    allOrders.filter(o =>
      o.source === 'POS' || o.source === 'POS Checkout' || String(o.id || '').startsWith('POS-')
    ), [allOrders]);

  const onlineOrders = useMemo(() =>
    allOrders.filter(o => !posOrders.includes(o)), [allOrders, posOrders]);

  // ── Week stats ──
  const weekOrders = allOrders.filter(o => isInPeriod(getDateMs(o), 'week'));
  const prevWeekMs = Date.now() - 14 * 86400000;
  const prevWeekOrders = allOrders.filter(o => {
    const ms = getDateMs(o);
    return ms >= prevWeekMs && ms < Date.now() - 7 * 86400000;
  });
  const weekTrend = weekOrders.length - prevWeekOrders.length;

  // ── Status counts ──
  const statusCounts = useMemo(() => ({
    waiting:   allOrders.filter(o => o.status === 'waiting').length,
    confirmed: allOrders.filter(o => o.status === 'confirmed').length,
    delivered: allOrders.filter(o => o.status === 'delivered').length,
    canceled:  allOrders.filter(o => o.status === 'canceled').length,
  }), [allOrders]);

  const totalForBar = allOrders.length || 1;
  const deliveryRate = allOrders.length > 0
    ? (statusCounts.delivered / allOrders.length) * 100 : 0;
  const avgOrderValue = allOrders.length > 0
    ? allOrders.reduce((s, o) => s + (Number(o.total) || 0), 0) / allOrders.length : 0;

  // ── Customer stats ──
  const weekAgoMs = Date.now() - 7 * 86400000;
  const monthAgoMs = Date.now() - 30 * 86400000;
  const newCustomersWeek = customers.filter(c => {
    try { return new Date(c.created_at || 0).getTime() >= weekAgoMs; } catch { return false; }
  }).length;
  const newCustomersMonth = customers.filter(c => {
    try { return new Date(c.created_at || 0).getTime() >= monthAgoMs; } catch { return false; }
  }).length;

  // ── Active products ──
  const activeProducts = products.filter(p => p.status === 'active' && !p.hidden).length;

  // ── Top products sold ──
  const topProducts = useMemo(() => {
    const qty: Record<string, number> = {};
    allOrders.forEach(o =>
      (o.items || []).forEach(it => {
        const name = (it.name || it.product_name || 'Unknown').split(' (')[0].trim();
        qty[name] = (qty[name] || 0) + (Number(it.qty) || 1);
      })
    );
    return Object.entries(qty).sort((a, b) => b[1] - a[1]).slice(0, 7);
  }, [allOrders]);
  const maxTopQty = topProducts.length ? topProducts[0][1] : 1;

  // ── Revenue by channel ──
  const channelRevenue = useMemo(() => {
    const periodOrders = allOrders.filter(o =>
      isInPeriod(getDateMs(o), period) && o.status !== 'canceled'
    );
    const pos = periodOrders.filter(o => posOrders.includes(o)).reduce((s, o) => s + (Number(o.total) || 0), 0);
    const online = periodOrders.filter(o => !posOrders.includes(o)).reduce((s, o) => s + (Number(o.total) || 0), 0);
    const preorder = preorders
      .filter(p => p.status === 'fulfilled' && isInPeriod(new Date(p.date || p.created_at || 0).getTime(), period))
      .reduce((s, p) => s + (Number(p.total_amount) || 0), 0);
    return { pos, online, preorder, total: pos + online + preorder };
  }, [allOrders, posOrders, preorders, period]);

  // ── Accurate COGS + financials ──
  const { grossRevenue, totalCOGS, profitabilityRows } = useMemo(() => {
    let rev = 0, cogs = 0;
    const map: Record<string, { name: string; qty: number; revenue: number; cogs: number }> = {};

    const track = (name: string, qty: number, r: number, c: number) => {
      if (!map[name]) map[name] = { name, qty: 0, revenue: 0, cogs: 0 };
      map[name].qty += qty; map[name].revenue += r; map[name].cogs += c;
    };

    // Helper: estimate landed cost for an order item
    const getItemCOGS = (it: any, fallbackRevShare: number): number => {
      const productId = it.productId || it.product_id;
      const prod = products.find(p => p.id === productId || p.name === it.name || p.name === it.product_name);
      if (prod) {
        const variant = (prod.variants || []).find((v: any) =>
          v.label === it.variant || v.weight === it.variant || (!it.variant)
        );
        if (variant?.sku) {
          const landed = getLandedCost(variant.sku, inventoryItems, eurRate);
          if (landed > 0) return landed * (Number(it.qty) || 1);
        }
        if (variant?.cost) return variant.cost * (Number(it.qty) || 1);
      }
      return fallbackRevShare * 0.65; // fallback: 65%
    };

    // POS orders
    posOrders.forEach(o => {
      if (!isInPeriod(getDateMs(o), period)) return;
      const r = Number(o.total) || 0;
      rev += r;
      const items = o.items || [];
      if (items.length > 0) {
        items.forEach(it => {
          const itemRev = (Number(it.price) || 0) * (Number(it.qty) || 1) || r / items.length;
          const itemCogs = getItemCOGS(it, itemRev);
          cogs += itemCogs;
          track(it.name || it.product_name || 'POS Item', Number(it.qty) || 1, itemRev, itemCogs);
        });
      } else {
        const c = r * 0.65;
        cogs += c;
        track('POS Sale', 1, r, c);
      }
    });

    // Online orders
    onlineOrders.forEach(o => {
      if (!isInPeriod(getDateMs(o), period)) return;
      if (o.status === 'canceled') return;
      const r = Number(o.total) || 0;
      rev += r;
      const items = o.items || [];
      if (items.length > 0) {
        items.forEach(it => {
          const itemRev = (Number(it.price) || 0) * (Number(it.qty) || 1) || r / items.length;
          const itemCogs = getItemCOGS(it, itemRev);
          cogs += itemCogs;
          track(it.name || it.product_name || 'Online Item', Number(it.qty) || 1, itemRev, itemCogs);
        });
      } else {
        const c = r * 0.65;
        cogs += c;
        track('Online Order', 1, r, c);
      }
    });

    // Fulfilled pre-orders
    preorders.filter(p => p.status === 'fulfilled').forEach(p => {
      if (!isInPeriod(new Date(p.date || p.created_at || 0).getTime(), period)) return;
      const r = Number(p.total_amount) || 0;
      rev += r;
      const items = preorderItems.filter(x => x.pre_order_id === p.id);
      if (items.length > 0) {
        items.forEach((it: any) => {
          const itemRev = r / items.length;
          const itemCogs = getItemCOGS(it, itemRev);
          cogs += itemCogs;
          track(it.product_name || 'Pre-Order Item', Number(it.qty) || 1, itemRev, itemCogs);
        });
      } else {
        const c = r * 0.65;
        cogs += c;
        track('Pre-Order', 1, r, c);
      }
    });

    const rows = Object.values(map)
      .sort((a, b) => (b.revenue - b.cogs) - (a.revenue - a.cogs))
      .slice(0, 10);

    return { grossRevenue: rev, totalCOGS: cogs, profitabilityRows: rows };
  }, [allOrders, posOrders, onlineOrders, preorders, preorderItems, products, inventoryItems, eurRate, period]);

  const grossProfit = grossRevenue - totalCOGS;
  const grossMarginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

  const totalOpexDzd = useMemo(() =>
    expenses.reduce((s, e) => {
      const amt = Number(e.amount) || 0;
      return s + (e.currency === 'EUR' ? amt * eurRate : amt);
    }, 0), [expenses, eurRate]);

  const netProfit = grossProfit - totalOpexDzd;
  const netMarginPct = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

  // ── Stock valuation ──
  const stockRetailDzd = inventoryItems.reduce((s, i) =>
    s + ((Number(i.stock) || 0) + (Number(i.stock_eu) || 0)) * (Number(i.retail_dzd) || 0), 0);
  const stockCostEur = inventoryItems.reduce((s, i) =>
    s + ((Number(i.stock) || 0) + (Number(i.stock_eu) || 0)) * (Number(i.price_eur) || 0), 0);

  // ── Low stock alerts ──
  const lowStockAlerts = useMemo(() => {
    const threshold = 2;
    const alertMap = new Map<string, { name: string; sku: string; stock: number }>();

    inventoryItems.forEach(inv => {
      if (inv.type === 'snack') return;
      const stock = Number(inv.stock) || 0;
      if (stock <= threshold) {
        const label = `${inv.brand ? inv.brand + ' – ' : ''}${inv.name}${inv.variant_spec ? ' (' + inv.variant_spec + ')' : ''}`;
        alertMap.set(inv.id, { name: label, sku: inv.id, stock });
      }
    });

    products.forEach(p => {
      if (p.status !== 'active') return;
      (p.variants || []).forEach((v: any, vi: number) => {
        const vLabel = v.weight ? `${v.weight}${v.unit || ''}` : `V${vi + 1}`;
        if (v.flavorStock && Object.keys(v.flavorStock).length > 0) {
          Object.entries(v.flavorStock).forEach(([flavor, stock]) => {
            if ((stock as number) <= threshold) {
              alertMap.set(`${p.id}-${vi}-${flavor}`, {
                name: `${p.brand ? p.brand + ' – ' : ''}${p.name} (${vLabel} – ${flavor})`,
                sku: v.sku || p.id, stock: stock as number,
              });
            }
          });
        } else {
          const s = Number(v.stock) || 0;
          if (s <= threshold) {
            const key = v.sku || `${p.id}-${vi}`;
            if (!alertMap.has(key))
              alertMap.set(key, { name: `${p.brand ? p.brand + ' – ' : ''}${p.name} (${vLabel})`, sku: v.sku || p.id, stock: s });
          }
        }
      });
    });

    return Array.from(alertMap.values()).sort((a, b) => a.stock - b.stock);
  }, [inventoryItems, products]);

  const periodLabel = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time';

  const statusColor: Record<string, string> = {
    waiting: '#f59e0b', confirmed: '#10b981', delivered: '#3b82f6', canceled: '#ef4444',
  };
  const statusBadge: Record<string, string> = {
    delivered: 'bg-blue-100 text-blue-700', confirmed: 'bg-emerald-100 text-emerald-700',
    canceled: 'bg-red-100 text-red-700', waiting: 'bg-amber-100 text-amber-700',
  };

  if (!loaded) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded-xl w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-2xl" />)}
        </div>
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Business Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">Live analytics · inventory · financial intelligence</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
          {(['week', 'month', 'all'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg transition-all ${period === p ? 'bg-white text-red-700 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}>
              {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Order KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Orders — gradient card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-700 p-4 rounded-2xl text-white shadow-lg shadow-blue-200">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full" />
          <div className="absolute -right-2 -bottom-6 w-28 h-28 bg-white/5 rounded-full" />
          <div className="flex items-center justify-between mb-3 relative">
            <span className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">Total Orders</span>
            <div className="p-2 bg-white/20 rounded-xl"><ShoppingCart className="w-4 h-4" /></div>
          </div>
          <div className="text-3xl font-black relative">
            <AnimatedCounter value={allOrders.length} />
          </div>
          <div className="text-[10px] text-blue-100 mt-1 font-medium">{weekOrders.length} this week</div>
        </div>

        {/* Avg Order Value */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 rounded-2xl text-white shadow-lg shadow-emerald-200">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full" />
          <div className="absolute -right-2 -bottom-6 w-28 h-28 bg-white/5 rounded-full" />
          <div className="flex items-center justify-between mb-3 relative">
            <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider">Avg. Order Value</span>
            <div className="p-2 bg-white/20 rounded-xl"><TrendingUp className="w-4 h-4" /></div>
          </div>
          <div className="text-2xl font-black relative">
            <AnimatedCounter value={avgOrderValue} />
            <span className="text-sm font-semibold text-emerald-100 ml-1">DA</span>
          </div>
          <div className="text-[10px] text-emerald-100 mt-1 font-medium">per order</div>
        </div>

        {/* Delivery Rate */}
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 to-violet-700 p-4 rounded-2xl text-white shadow-lg shadow-violet-200">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full" />
          <div className="absolute -right-2 -bottom-6 w-28 h-28 bg-white/5 rounded-full" />
          <div className="flex items-center justify-between mb-3 relative">
            <span className="text-[10px] font-bold text-violet-100 uppercase tracking-wider">Delivery Rate</span>
            <div className="p-2 bg-white/20 rounded-xl"><CheckCircle className="w-4 h-4" /></div>
          </div>
          <div className="text-3xl font-black relative">
            <AnimatedCounter value={deliveryRate} decimals={1} suffix="%" />
          </div>
          <div className="text-[10px] text-violet-100 mt-1 font-medium">{statusCounts.delivered} delivered</div>
        </div>

        {/* This Week Trend */}
        <div className={`relative overflow-hidden p-4 rounded-2xl text-white shadow-lg ${weekTrend >= 0 ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-200' : 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-200'}`}>
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full" />
          <div className="absolute -right-2 -bottom-6 w-28 h-28 bg-white/5 rounded-full" />
          <div className="flex items-center justify-between mb-3 relative">
            <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">This Week</span>
            <div className="p-2 bg-white/20 rounded-xl">
              {weekTrend >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            </div>
          </div>
          <div className="text-3xl font-black relative">
            <AnimatedCounter value={weekOrders.length} />
          </div>
          <div className="text-[10px] text-white/80 mt-1 font-medium">
            {weekTrend !== 0 ? `${weekTrend > 0 ? '↑' : '↓'} ${Math.abs(weekTrend)} vs prev week` : '= same as prev week'}
          </div>
        </div>
      </div>

      {/* ── Financial KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Gross Revenue</div>
          <div className="text-xl font-black text-slate-900">
            <AnimatedCounter value={grossRevenue} /> <span className="text-xs font-semibold text-slate-400">DA</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{periodLabel}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Gross Profit</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${grossProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{grossMarginPct.toFixed(1)}%</span>
          </div>
          <div className={`text-xl font-black ${grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {grossProfit >= 0 ? '+' : '-'}<AnimatedCounter value={Math.abs(grossProfit)} /> <span className="text-xs font-semibold text-slate-400">DA</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Revenue – landed COGS</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Operating Expenses</div>
          <div className="text-xl font-black text-rose-600">
            -<AnimatedCounter value={totalOpexDzd} /> <span className="text-xs font-semibold text-slate-400">DA</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">All recorded expenses</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Net Profit</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${netProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{netMarginPct.toFixed(1)}%</span>
          </div>
          <div className={`text-xl font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {netProfit >= 0 ? '+' : '-'}<AnimatedCounter value={Math.abs(netProfit)} /> <span className="text-xs font-semibold text-slate-400">DA</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Gross profit – OPEX</div>
        </div>
      </div>

      {/* ── Metric row: Customers, Products, POS, Waiting ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Customers',
            value: customers.length,
            sub: `+${newCustomersMonth} this month · +${newCustomersWeek} this week`,
            icon: <Users className="w-4 h-4 text-sky-600" />,
            iconBg: 'bg-sky-50',
          },
          {
            label: 'Active Products',
            value: activeProducts,
            sub: `${products.length} total in catalog`,
            icon: <Package className="w-4 h-4 text-indigo-600" />,
            iconBg: 'bg-indigo-50',
          },
          {
            label: 'POS Sales',
            value: posOrders.length,
            sub: `${fmtNum(posOrders.reduce((s, o) => s + (Number(o.total) || 0), 0))} DA total`,
            icon: <Zap className="w-4 h-4 text-amber-600" />,
            iconBg: 'bg-amber-50',
          },
          {
            label: 'Waiting Orders',
            value: statusCounts.waiting,
            sub: `${statusCounts.confirmed} confirmed · ${statusCounts.canceled} canceled`,
            icon: <BarChart2 className="w-4 h-4 text-rose-600" />,
            iconBg: 'bg-rose-50',
          },
        ].map(({ label, value, sub, icon, iconBg }) => (
          <div key={label} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
              <div className={`p-2 ${iconBg} rounded-xl`}>{icon}</div>
            </div>
            <div className="text-2xl font-black text-slate-900"><AnimatedCounter value={value} /></div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium leading-tight">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Revenue Trend Chart + Channel Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-red-600" /> Revenue Trend — Last 6 Months
            </h3>
            <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />Online</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />POS</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-400 inline-block" />Pre-order</span>
            </div>
          </div>
          <RevenueBarChart orders={allOrders} preorders={preorders} posOrders={posOrders} />
        </div>

        {/* Channel Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Revenue by Channel</h3>
          <p className="text-[10px] text-slate-400 -mt-2">{periodLabel}</p>
          <div className="space-y-4">
            <ChannelBar label="🌐 Online Orders" value={channelRevenue.online} total={channelRevenue.total} color="bg-blue-500" />
            <ChannelBar label="⚡ POS Sales" value={channelRevenue.pos} total={channelRevenue.total} color="bg-emerald-500" />
            <ChannelBar label="📦 Pre-Orders" value={channelRevenue.preorder} total={channelRevenue.total} color="bg-purple-400" />
          </div>
          <div className="pt-3 border-t border-slate-100">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-700">Total</span>
              <span className="text-slate-900">{fmtNum(channelRevenue.total)} DA</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Order Status Bar ── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Order Status Overview</h3>
        <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden gap-px">
          {Object.entries(statusCounts).map(([s, count]) => count > 0 && (
            <div key={s} title={`${s}: ${count}`} className="h-full transition-all"
              style={{ width: `${(count / totalForBar * 100).toFixed(1)}%`, background: statusColor[s] || '#94a3b8' }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {Object.entries(statusCounts).map(([s, count]) => (
            <div key={s} className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: statusColor[s] }} />
              <span className="text-slate-500 capitalize">{s}</span>
              <strong className="text-slate-900">{count}</strong>
              <span className="text-slate-400">({((count / totalForBar) * 100).toFixed(0)}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Dashboard Tabs ── */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
        <button onClick={() => setDashTab('orders')}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dashTab === 'orders' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>
          📦 Orders Intelligence
        </button>
        <button onClick={() => setDashTab('financial')}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dashTab === 'financial' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>
          💰 Financial Analysis
        </button>
      </div>

      {/* ── ORDERS TAB ── */}
      {dashTab === 'orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-red-600" /> Top Products Sold
            </h3>
            {topProducts.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-8">No order data yet</div>
            ) : (
              <div className="space-y-3">
                {topProducts.map(([name, qty], i) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{name}</div>
                      <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-700"
                          style={{ width: `${Math.round((qty / maxTopQty) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="text-xs font-bold text-slate-700 shrink-0 bg-slate-100 px-2 py-0.5 rounded-lg">{qty} sold</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-red-600" /> Recent Orders
            </h3>
            {allOrders.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-8">No orders yet</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {allOrders.slice(0, 6).map(o => {
                  const name = `${o.first_name || o.firstName || ''} ${o.last_name || o.lastName || ''}`.trim() || '—';
                  let dateStr = '—';
                  try { if (o.created_at || o.date) dateStr = new Date((o.created_at || o.date)!).toLocaleDateString('en-GB'); } catch { }
                  return (
                    <div key={o.id} className="py-2.5 flex items-center gap-3 hover:bg-slate-50/60 -mx-1 px-1 rounded-xl transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">{name}</div>
                        <div className="text-[10px] text-slate-400">{dateStr} · {(o.items || []).length} item(s)</div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${statusBadge[o.status] || 'bg-slate-100 text-slate-600'}`}>{o.status}</span>
                      <div className="text-xs font-black text-slate-900 shrink-0">{fmtNum(Number(o.total) || 0)} DA</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FINANCIAL TAB ── */}
      {dashTab === 'financial' && (
        <div className="space-y-6">
          {/* Stock + P&L */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Stock Valuation */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Warehouse className="w-3.5 h-3.5 text-purple-500" /> Stock Valuation
              </h3>
              <div className="space-y-3">
                <div className="bg-purple-50 p-3 rounded-xl">
                  <div className="text-[10px] text-purple-600 font-semibold mb-0.5">Retail Value (DZD)</div>
                  <div className="text-xl font-black text-purple-700">{fmtNum(stockRetailDzd)} DA</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <div className="text-[10px] text-slate-500 font-semibold mb-0.5">Cost Price (EUR)</div>
                  <div className="text-xl font-black text-slate-900">{stockCostEur.toFixed(2)} €</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[{ label: 'Supplements', type: 'supplement' }, { label: 'Snacks', type: 'snack' }].map(({ label, type }) => (
                  <div key={type} className="bg-slate-50 p-2.5 rounded-xl text-center">
                    <div className="text-[10px] text-slate-400 font-medium">{label}</div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">
                      {inventoryItems.filter(i => i.type === type).reduce((s, i) => s + (Number(i.stock) || 0) + (Number(i.stock_eu) || 0), 0)}
                    </div>
                    <div className="text-[9px] text-slate-400">units</div>
                  </div>
                ))}
              </div>
            </div>

            {/* P&L */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> P&amp;L Summary — {periodLabel}
              </h3>
              <div className="space-y-1.5">
                {[
                  { label: 'Gross Revenue', value: grossRevenue, color: 'text-slate-900', prefix: '' },
                  { label: 'Cost of Goods Sold (Actual/Est.)', value: totalCOGS, color: 'text-rose-600', prefix: '–', sub: 'linked inventory cost where available' },
                  { label: 'Gross Profit', value: grossProfit, color: grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600', prefix: grossProfit >= 0 ? '+' : '–', bold: true },
                  { label: 'Operating Expenses (OPEX)', value: totalOpexDzd, color: 'text-rose-600', prefix: '–' },
                ].map(({ label, value, color, prefix, bold, sub }: any) => (
                  <div key={label} className={`flex justify-between items-start py-2 border-b border-slate-50 ${bold ? 'font-bold border-t border-slate-200 mt-1 pt-3' : ''}`}>
                    <div>
                      <span className={`text-xs ${bold ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
                      {sub && <div className="text-[9px] text-slate-400">{sub}</div>}
                    </div>
                    <span className={`text-xs font-bold ${color} shrink-0 ml-4`}>{prefix}{fmtNum(Math.abs(value))} DA</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-3 font-bold">
                  <span className="text-slate-900 text-sm">Net Profit (After OPEX)</span>
                  <span className={`text-sm ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {netProfit >= 0 ? '+' : ''}{fmtNum(netProfit)} DA
                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${netProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{netMarginPct.toFixed(1)}%</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Profitability Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-red-600" /> Product Profitability
              </h3>
              <span className="text-[10px] font-semibold text-slate-400">Top 10 · {periodLabel} · COGS linked where SKU available</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3 text-left">Product</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Revenue</th>
                    <th className="p-3 text-right">COGS</th>
                    <th className="p-3 text-right">Profit</th>
                    <th className="p-3 text-center">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {profitabilityRows.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-slate-400 py-8">No sales data for this period.</td></tr>
                  ) : profitabilityRows.map(row => {
                    const profit = row.revenue - row.cogs;
                    const margin = row.revenue > 0 ? (profit / row.revenue) * 100 : 0;
                    return (
                      <tr key={row.name} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-semibold text-slate-800">{row.name}</td>
                        <td className="p-3 text-center">
                          <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-lg">{row.qty}</span>
                        </td>
                        <td className="p-3 text-right text-slate-700 font-medium">{fmtNum(row.revenue)} DA</td>
                        <td className="p-3 text-right text-rose-500">{fmtNum(row.cogs)} DA</td>
                        <td className={`p-3 text-right font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {profit >= 0 ? '+' : ''}{fmtNum(profit)} DA
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${profit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Low Stock Alerts ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Low Stock Alerts
            {lowStockAlerts.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{lowStockAlerts.length}</span>
            )}
          </h3>
          {lowStockAlerts.length > 3 && (
            <button onClick={() => setLowStockAll(v => !v)}
              className="text-xs font-semibold text-red-700 hover:text-red-800 flex items-center gap-1 transition-colors">
              {lowStockAll ? 'Show Less' : `View All (${lowStockAlerts.length})`}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${lowStockAll ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        {lowStockAlerts.length === 0 ? (
          <div className="p-6 text-center text-xs text-emerald-600 font-semibold flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" /> All products &amp; inventory items are sufficiently stocked!
          </div>
        ) : (
          <div className={lowStockAll ? 'max-h-96 overflow-y-auto' : ''}>
            {(lowStockAll ? lowStockAlerts : lowStockAlerts.slice(0, 3)).map(a => (
              <div key={`${a.sku}-${a.name}`} className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                <div className="min-w-0 flex-1 pr-4">
                  <div className="text-xs font-semibold text-slate-800 truncate">{a.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">SKU: {a.sku}</div>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${a.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {a.stock === 0 ? '⛔ Out of Stock' : `⚠️ Low (${a.stock})`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
