import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { InventoryItem, Order, PreOrder, Expense, Product, Customer } from '../types';
import {
  TrendingUp, ShoppingCart, DollarSign, Warehouse,
  AlertTriangle, CheckCircle, ChevronDown, BarChart2,
  ListOrdered, Users, Package, Zap, ArrowUp, ArrowDown,
  MapPin, RefreshCw, FileText, Check, Printer, Activity
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
  onUpdateOrderStatus?: (orderId: string, status: Order['status']) => void;
}

type Period = 'week' | 'month' | 'all';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtNum(n: number) { return Math.round(n).toLocaleString('fr-DZ'); }
function fmtPct(n: number) { return n.toFixed(1) + '%'; }

function getDateMs(o: Order | PreOrder | any): number {
  try { return new Date((o as any).created_at || (o as any).date || 0).getTime(); } catch { return 0; }
}

function isToday(ms: number): boolean {
  const d = new Date(ms), now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isInPeriod(ms: number, period: Period): boolean {
  if (period === 'all') return true;
  const days = period === 'week' ? 7 : 30;
  return ms >= Date.now() - days * 86400000;
}

function isInPrevPeriod(ms: number, period: Period): boolean {
  if (period === 'all') return false;
  const days = period === 'week' ? 7 : 30;
  const now = Date.now();
  return ms >= now - 2 * days * 86400000 && ms < now - days * 86400000;
}

function getLandedCost(sku: string | undefined, inventoryItems: InventoryItem[], eurRate: number): number {
  if (!sku) return 0;
  const inv = inventoryItems.find(i => String(i.id).trim().toLowerCase() === String(sku).trim().toLowerCase());
  if (!inv) return 0;
  const rate = Number(inv.rate) || eurRate || 280;
  return (Number(inv.price_eur) || 0) * rate + (Number(inv.delivery_dzd) || 0);
}

/** Simple linear regression forecast: given data points, predict next point */
function linearForecast(data: number[]): number {
  const n = data.length;
  if (n === 0) return 0;
  if (n === 1) return data[0];
  const xs = data.map((_, i) => i + 1);
  const sumX = xs.reduce((s, x) => s + x, 0);
  const sumY = data.reduce((s, y) => s + y, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * data[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return sumY / n;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return Math.max(0, intercept + slope * (n + 1));
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

/** Animated count-up number */
function AnimatedCounter({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(value * eased);
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value]);
  return <>{decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString('fr-DZ')}</>;
}

/** Period comparison badge: shows ▲/▼ % vs previous period */
function DeltaBadge({ current, previous, inverted = false }: { current: number; previous: number; inverted?: boolean }) {
  if (previous <= 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const isGood = inverted ? pct <= 0 : pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-[9px] font-bold ${isGood ? 'text-emerald-500' : 'text-rose-500'}`}>
      {pct >= 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/** Horizontal bar for channel / wilaya breakdowns */
function HBar({ label, value, total, color, sub }: { label: string; value: number; total: number; color: string; sub?: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="text-slate-500">{fmtNum(value)}{sub || ' DA'} <span className="text-slate-400">({pct.toFixed(0)}%)</span></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

/** Stacked 6-month revenue bar chart */
function RevenueBarChart({ orders, preorders, posOrders }: { orders: Order[]; preorders: PreOrder[]; posOrders: Order[] }) {
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const yr = d.getFullYear(), mo = d.getMonth();
      const match = (ds: string | undefined | null) => { if (!ds) return false; const dd = new Date(ds); return dd.getFullYear() === yr && dd.getMonth() === mo; };
      const online = orders.filter(o => !posOrders.includes(o) && o.status !== 'canceled' && match(o.created_at || o.date)).reduce((s, o) => s + (Number(o.total) || 0), 0);
      const pos = posOrders.filter(o => match(o.created_at || o.date)).reduce((s, o) => s + (Number(o.total) || 0), 0);
      const pre = preorders.filter(p => p.status === 'fulfilled' && match(p.date || p.created_at)).reduce((s, p) => s + (Number(p.total_amount) || 0), 0);
      return { label: d.toLocaleString('en', { month: 'short' }), online, pos, pre, total: online + pos + pre };
    });
  }, [orders, preorders, posOrders]);

  const maxVal = Math.max(...months.map(m => m.total), 1);

  return (
    <div className="flex items-end gap-1.5 h-32 mt-2">
      {months.map((m, i) => {
        const H = (m.total / maxVal) * 112;
        const isLast = i === months.length - 1;
        const frac = (v: number) => m.total > 0 ? (v / m.total) * 100 : 0;
        return (
          <div key={m.label} className="flex-1 flex flex-col items-center gap-1 group relative">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] rounded-lg px-2.5 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 w-32 shadow-xl pointer-events-none">
              <div className="font-bold mb-1 text-center">{m.label}</div>
              {m.online > 0 && <div className="flex justify-between"><span className="text-blue-300">Online</span><span>{fmtNum(m.online)}</span></div>}
              {m.pos > 0 && <div className="flex justify-between"><span className="text-emerald-300">POS</span><span>{fmtNum(m.pos)}</span></div>}
              {m.pre > 0 && <div className="flex justify-between"><span className="text-purple-300">Pre</span><span>{fmtNum(m.pre)}</span></div>}
              <div className="flex justify-between border-t border-slate-700 mt-1 pt-1 font-bold"><span>Total</span><span>{fmtNum(m.total)} DA</span></div>
            </div>

            <div className="flex-1 w-full flex flex-col justify-end" style={{ maxHeight: 112 }}>
              {m.total === 0
                ? <div className="w-full h-1 bg-slate-100 rounded-full" />
                : (
                  <div className={`w-full flex flex-col overflow-hidden rounded-t-md ${isLast ? 'ring-2 ring-red-500 ring-offset-1' : ''}`} style={{ height: H }}>
                    {m.pre > 0 && <div style={{ height: `${frac(m.pre)}%`, minHeight: 3 }} className="w-full bg-purple-400" />}
                    {m.pos > 0 && <div style={{ height: `${frac(m.pos)}%`, minHeight: 3 }} className="w-full bg-emerald-500" />}
                    {m.online > 0 && <div style={{ height: `${frac(m.online)}%`, minHeight: 3 }} className="w-full bg-blue-500" />}
                  </div>
                )
              }
            </div>
            <div className={`text-[9px] font-bold ${isLast ? 'text-red-600' : 'text-slate-400'}`}>{m.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────
export const DashboardPage: React.FC<DashboardPageProps> = ({
  orders, preorders, preorderItems, inventoryItems, products, expenses, eurRate,
  customers = [], onUpdateOrderStatus,
}) => {
  const [period, setPeriod] = useState<Period>('month');
  const [dashTab, setDashTab] = useState<'orders' | 'financial'>('orders');
  const [lowStockAll, setLowStockAll] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => setLoaded(true), 80); return () => clearTimeout(t); }, []);

  // ── All orders sorted by date ──
  const rawAllOrders = useMemo(() => [...orders].sort((a, b) => getDateMs(b) - getDateMs(a)), [orders]);

  // ── Revenue-qualifying orders (delivered orders & POS sales, excluding unpaid/waiting/confirmed/canceled) ──
  const paidOrders = useMemo(() => {
    return orders.filter(o => 
      o.status === 'delivered' || 
      o.source === 'POS' || 
      o.source === 'POS Checkout' || 
      String(o.id || '').startsWith('POS-')
    );
  }, [orders]);
  
  const allOrders = useMemo(() => [...paidOrders].sort((a, b) => getDateMs(b) - getDateMs(a)), [paidOrders]);
  const posOrders = useMemo(() => allOrders.filter(o => o.source === 'POS' || o.source === 'POS Checkout' || String(o.id || '').startsWith('POS-')), [allOrders]);
  const onlineOrders = useMemo(() => allOrders.filter(o => !posOrders.includes(o)), [allOrders, posOrders]);

  // ── Today ──
  const todayOrders = rawAllOrders.filter(o => isToday(getDateMs(o)));
  const todayDeliveredOrders = allOrders.filter(o => isToday(getDateMs(o)));
  const todayRevenue = todayDeliveredOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const todayTopProd = useMemo(() => {
    const qty: Record<string, number> = {};
    todayOrders.forEach(o => (o.items || []).forEach(it => { const n = (it.name || it.product_name || ''); if (n) qty[n] = (qty[n] || 0) + (Number(it.qty) || 1); }));
    const top = Object.entries(qty).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  }, [todayOrders]);

  // ── Week / period ──
  const weekOrders = rawAllOrders.filter(o => isInPeriod(getDateMs(o), 'week'));
  const prevWeekOrders = rawAllOrders.filter(o => isInPrevPeriod(getDateMs(o), 'week'));
  const weekTrend = weekOrders.length - prevWeekOrders.length;

  // ── Status counts (using rawAllOrders) ──
  const statusCounts = useMemo(() => ({
    waiting: rawAllOrders.filter(o => o.status === 'waiting').length,
    confirmed: rawAllOrders.filter(o => o.status === 'confirmed').length,
    delivered: rawAllOrders.filter(o => o.status === 'delivered').length,
    canceled: rawAllOrders.filter(o => o.status === 'canceled').length,
  }), [rawAllOrders]);
  const totalForBar = allOrders.length || 1;

  const deliveryRate = allOrders.length > 0 ? (statusCounts.delivered / allOrders.length) * 100 : 0;
  const cancelRate = allOrders.length > 0 ? (statusCounts.canceled / allOrders.length) * 100 : 0;
  const avgOrderValue = allOrders.filter(o => o.status !== 'canceled').length > 0
    ? allOrders.filter(o => o.status !== 'canceled').reduce((s, o) => s + (Number(o.total) || 0), 0) / allOrders.filter(o => o.status !== 'canceled').length : 0;

  // ── Cancellation trend (this month vs prev month) ──
  const cancelThisMonth = allOrders.filter(o => isInPeriod(getDateMs(o), 'month') && o.status === 'canceled').length;
  const cancelPrevMonth = allOrders.filter(o => isInPrevPeriod(getDateMs(o), 'month') && o.status === 'canceled').length;

  // ── Repeat customer rate ──
  const repeatCustomerRate = useMemo(() => {
    const phoneCounts: Record<string, number> = {};
    allOrders.forEach(o => { const p = o.phone || ''; if (p) phoneCounts[p] = (phoneCounts[p] || 0) + 1; });
    const total = Object.keys(phoneCounts).length;
    if (total === 0) return 0;
    const repeats = Object.values(phoneCounts).filter(c => c > 1).length;
    return (repeats / total) * 100;
  }, [allOrders]);

  // ── Pre-order conversion ──
  const preConversion = preorders.length > 0 ? (preorders.filter(p => p.status === 'fulfilled').length / preorders.length) * 100 : 0;

  // ── Customer stats ──
  const weekAgoMs = Date.now() - 7 * 86400000;
  const monthAgoMs = Date.now() - 30 * 86400000;
  const newCustWeek = customers.filter(c => { try { return new Date(c.created_at || 0).getTime() >= weekAgoMs; } catch { return false; } }).length;
  const newCustMonth = customers.filter(c => { try { return new Date(c.created_at || 0).getTime() >= monthAgoMs; } catch { return false; } }).length;

  const activeProducts = products.filter(p => p.status === 'active' && !p.hidden).length;

  // ── Top products ──
  const topProducts = useMemo(() => {
    const qty: Record<string, number> = {};
    allOrders.forEach(o => (o.items || []).forEach(it => { const n = (it.name || it.product_name || 'Unknown').split(' (')[0].trim(); qty[n] = (qty[n] || 0) + (Number(it.qty) || 1); }));
    return Object.entries(qty).sort((a, b) => b[1] - a[1]).slice(0, 7);
  }, [allOrders]);
  const maxTopQty = topProducts.length ? topProducts[0][1] : 1;

  // ── Wilaya breakdown ──
  const wilayaStats = useMemo(() => {
    const map: Record<string, { orders: number; revenue: number }> = {};
    allOrders.forEach(o => {
      const w = (o.wilaya || 'Unknown').trim();
      if (!map[w]) map[w] = { orders: 0, revenue: 0 };
      map[w].orders++;
      map[w].revenue += Number(o.total) || 0;
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.orders - a.orders).slice(0, 8);
  }, [allOrders]);
  const maxWilayaOrders = wilayaStats.length ? wilayaStats[0].orders : 1;

  // ── Revenue by channel (period-filtered) ──
  const channelRevenue = useMemo(() => {
    const onlineRev = onlineOrders.filter(o => isInPeriod(getDateMs(o), period) && o.status !== 'canceled').reduce((s, o) => s + (Number(o.total) || 0), 0);
    const posRev = posOrders.filter(o => isInPeriod(getDateMs(o), period)).reduce((s, o) => s + (Number(o.total) || 0), 0);
    const preRev = preorders.filter(p => p.status === 'fulfilled' && isInPeriod(getDateMs(p), period)).reduce((s, p) => s + (Number(p.total_amount) || 0), 0);
    const total = onlineRev + posRev + preRev;
    return { online: onlineRev, pos: posRev, preorder: preRev, total };
  }, [allOrders, onlineOrders, posOrders, preorders, period]);

  // ── Financials (period-filtered) with accurate COGS ──
  const { grossRevenue, totalCOGS, profitabilityRows } = useMemo(() => {
    let rev = 0, cogs = 0;
    const map: Record<string, { name: string; qty: number; revenue: number; cogs: number }> = {};
    const track = (name: string, qty: number, r: number, c: number) => {
      if (!map[name]) map[name] = { name, qty: 0, revenue: 0, cogs: 0 };
      map[name].qty += qty; map[name].revenue += r; map[name].cogs += c;
    };
    const getItemCOGS = (it: any, fallback: number) => {
      const pid = it.productId || it.product_id;
      const prod = products.find(p => p.id === pid || p.name === (it.name || it.product_name));
      if (prod) {
        const v = (prod.variants || []).find((v: any) => v.label === it.variant || v.weight === it.variant || !it.variant);
        if (v?.sku) { const lc = getLandedCost(v.sku, inventoryItems, eurRate); if (lc > 0) return lc * (Number(it.qty) || 1); }
        if (v?.cost) return v.cost * (Number(it.qty) || 1);
      }
      return fallback * 0.65;
    };

    [...posOrders, ...onlineOrders].forEach(o => {
      if (!isInPeriod(getDateMs(o), period)) return;
      if (o.status === 'canceled') return;
      const r = Number(o.total) || 0; rev += r;
      const items = o.items || [];
      if (items.length > 0) {
        items.forEach(it => {
          const ir = (Number(it.price) || 0) * (Number(it.qty) || 1) || r / items.length;
          const ic = getItemCOGS(it, ir);
          cogs += ic;
          track(it.name || it.product_name || 'Item', Number(it.qty) || 1, ir, ic);
        });
      } else { const c = r * 0.65; cogs += c; track(posOrders.includes(o) ? 'POS Sale' : 'Online Order', 1, r, c); }
    });

    preorders.filter(p => p.status === 'fulfilled' && isInPeriod(getDateMs(p), period)).forEach(p => {
      const r = Number(p.total_amount) || 0; rev += r;
      const items = preorderItems.filter(x => x.pre_order_id === p.id);
      if (items.length > 0) {
        items.forEach((it: any) => { const ir = r / items.length; const ic = getItemCOGS(it, ir); cogs += ic; track(it.product_name || 'Pre-Order Item', Number(it.qty) || 1, ir, ic); });
      } else { const c = r * 0.65; cogs += c; track('Pre-Order', 1, r, c); }
    });

    return { grossRevenue: rev, totalCOGS: cogs, profitabilityRows: Object.values(map).sort((a, b) => (b.revenue - b.cogs) - (a.revenue - a.cogs)).slice(0, 10) };
  }, [allOrders, posOrders, onlineOrders, preorders, preorderItems, products, inventoryItems, eurRate, period]);

  const grossProfit = grossRevenue - totalCOGS;
  const grossMarginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;
  const totalOpexDzd = useMemo(() => expenses.reduce((s, e) => s + (Number(e.amount) || 0) * (e.currency === 'EUR' ? eurRate : 1), 0), [expenses, eurRate]);
  const netProfit = grossProfit - totalOpexDzd;
  const netMarginPct = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

  // ── Previous period revenue (for comparison) ──
  const prevPeriodRevenue = useMemo(() => {
    if (period === 'all') return 0;
    return [...posOrders, ...onlineOrders]
      .filter(o => isInPrevPeriod(getDateMs(o), period) && o.status !== 'canceled')
      .reduce((s, o) => s + (Number(o.total) || 0), 0);
  }, [posOrders, onlineOrders, period]);

  const prevPeriodOrders = useMemo(() => {
    if (period === 'all') return 0;
    return allOrders.filter(o => isInPrevPeriod(getDateMs(o), period)).length;
  }, [allOrders, period]);

  // ── Revenue Forecast (6 months → predict next) ──
  const monthlyRevenues = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const yr = d.getFullYear(), mo = d.getMonth();
      return allOrders
        .filter(o => { const dd = new Date(getDateMs(o)); return dd.getFullYear() === yr && dd.getMonth() === mo && o.status !== 'canceled'; })
        .reduce((s, o) => s + (Number(o.total) || 0), 0);
    });
  }, [allOrders]);
  const forecastNextMonth = linearForecast(monthlyRevenues);
  const forecastLabel = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleString('en', { month: 'long' });

  // ── Stock valuation ──
  const stockRetailDzd = inventoryItems.reduce((s, i) => s + ((Number(i.stock) || 0) + (Number(i.stock_eu) || 0)) * (Number(i.retail_dzd) || 0), 0);
  const stockCostEur = inventoryItems.reduce((s, i) => s + ((Number(i.stock) || 0) + (Number(i.stock_eu) || 0)) * (Number(i.price_eur) || 0), 0);

  // ── Sales velocity (units/day for last 30d, keyed by product name) ──
  const salesVelocity = useMemo(() => {
    const velocityMap: Record<string, number> = {};
    const cutoff = Date.now() - 30 * 86400000;
    allOrders.forEach(o => {
      if (getDateMs(o) < cutoff) return;
      (o.items || []).forEach(it => {
        const n = (it.name || it.product_name || '').split(' (')[0].trim().toLowerCase();
        if (n) velocityMap[n] = (velocityMap[n] || 0) + (Number(it.qty) || 1);
        const pid = it.productId || it.product_id || '';
        if (pid) velocityMap[pid] = (velocityMap[pid] || 0) + (Number(it.qty) || 1);
      });
    });
    // Convert to daily rate
    return Object.fromEntries(Object.entries(velocityMap).map(([k, v]) => [k, v / 30]));
  }, [allOrders]);

  // ── Low stock alerts (with velocity/days to stockout) ──
  const lowStockAlerts = useMemo(() => {
    const threshold = 2;
    const alerts: { name: string; sku: string; stock: number; daysLeft: number | null }[] = [];
    const seen = new Set<string>();

    const getDays = (name: string, sku: string, stock: number): number | null => {
      const dailyRate = salesVelocity[sku?.toLowerCase()] || salesVelocity[name?.toLowerCase()] || 0;
      return dailyRate > 0 ? Math.floor(stock / dailyRate) : null;
    };

    inventoryItems.forEach(inv => {
      if (inv.type === 'snack') return;
      const stock = Number(inv.stock) || 0;
      if (stock <= threshold && !seen.has(inv.id)) {
        seen.add(inv.id);
        const label = `${inv.brand ? inv.brand + ' – ' : ''}${inv.name}${inv.variant_spec ? ' (' + inv.variant_spec + ')' : ''}`;
        alerts.push({ name: label, sku: inv.id, stock, daysLeft: getDays(inv.name, inv.id, stock) });
      }
    });

    products.forEach(p => {
      if (p.status !== 'active') return;
      (p.variants || []).forEach((v: any, vi: number) => {
        const vLabel = v.weight ? `${v.weight}${v.unit || ''}` : `V${vi + 1}`;
        const baseName = `${p.brand ? p.brand + ' – ' : ''}${p.name}`;
        if (v.flavorStock && Object.keys(v.flavorStock).length > 0) {
          Object.entries(v.flavorStock).forEach(([flavor, stock]) => {
            const s = stock as number;
            if (s <= threshold) {
              const key = `${p.id}-${vi}-${flavor}`;
              if (!seen.has(key)) { seen.add(key); alerts.push({ name: `${baseName} (${vLabel} – ${flavor})`, sku: v.sku || p.id, stock: s, daysLeft: getDays(p.name, v.sku || p.id, s) }); }
            }
          });
        } else {
          const s = Number(v.stock) || 0;
          if (s <= threshold) {
            const key = v.sku || `${p.id}-${vi}`;
            if (!seen.has(key)) { seen.add(key); alerts.push({ name: `${baseName} (${vLabel})`, sku: v.sku || p.id, stock: s, daysLeft: getDays(p.name, v.sku || p.id, s) }); }
          }
        }
      });
    });

    return alerts.sort((a, b) => {
      if (a.daysLeft !== null && b.daysLeft !== null) return a.daysLeft - b.daysLeft;
      if (a.daysLeft !== null) return -1;
      if (b.daysLeft !== null) return 1;
      return a.stock - b.stock;
    });
  }, [inventoryItems, products, salesVelocity]);

  // ── Quick confirm order ──
  const handleQuickConfirm = useCallback(async (orderId: string) => {
    if (!onUpdateOrderStatus) return;
    setConfirmingId(orderId);
    await onUpdateOrderStatus(orderId, 'confirmed');
    setConfirmingId(null);
  }, [onUpdateOrderStatus]);

  // ── PDF Export ──
  const handlePrint = () => { window.print(); };

  const periodLabel = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time';
  const statusColor: Record<string, string> = { waiting: '#f59e0b', confirmed: '#10b981', delivered: '#3b82f6', canceled: '#ef4444' };
  const statusBadge: Record<string, string> = { delivered: 'bg-blue-100 text-blue-700', confirmed: 'bg-emerald-100 text-emerald-700', canceled: 'bg-red-100 text-red-700', waiting: 'bg-amber-100 text-amber-700' };

  // ── Skeleton ──
  if (!loaded) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 rounded-xl w-72 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-2xl animate-pulse" />)}</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-2xl animate-pulse" />)}</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-slate-200 rounded-2xl animate-pulse" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Business Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">Live analytics · inventory · financial intelligence</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* Period filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {(['week', 'month', 'all'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg transition-all ${period === p ? 'bg-white text-red-700 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}>
                {p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All'}
              </button>
            ))}
          </div>
          {/* PDF Export */}
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl hover:shadow-sm transition-all">
            <Printer className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
      </div>

      {/* ── Today's Summary Banner ── */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4 text-white flex flex-wrap items-center gap-4 print:hidden">
        <Activity className="w-5 h-5 text-red-400 shrink-0" />
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-slate-400 text-xs font-medium">Today's Orders</span>
            <div className="font-black text-xl leading-tight">{todayOrders.length}</div>
          </div>
          <div>
            <span className="text-slate-400 text-xs font-medium">Today's Revenue</span>
            <div className="font-black text-xl leading-tight">{fmtNum(todayRevenue)} <span className="text-xs text-slate-400">DA</span></div>
          </div>
          {todayTopProd && (
            <div>
              <span className="text-slate-400 text-xs font-medium">Top Product Today</span>
              <div className="font-bold text-sm leading-tight text-emerald-400 truncate max-w-xs">{todayTopProd}</div>
            </div>
          )}
          <div>
            <span className="text-slate-400 text-xs font-medium">Waiting Now</span>
            <div className="font-black text-xl leading-tight text-amber-400">{statusCounts.waiting}</div>
          </div>
        </div>
      </div>

      {/* ── Order KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Orders', value: allOrders.length, prevValue: prevPeriodOrders, sub: `${weekOrders.length} this week`, gradient: 'from-blue-600 to-blue-700 shadow-blue-200', icon: <ShoppingCart className="w-4 h-4" /> },
          { label: 'Avg. Order Value', value: avgOrderValue, prevValue: 0, sub: 'per order (excl. canceled)', gradient: 'from-emerald-500 to-emerald-600 shadow-emerald-200', icon: <TrendingUp className="w-4 h-4" />, suffix: ' DA' },
          { label: 'Delivery Rate', value: deliveryRate, prevValue: 0, sub: `${statusCounts.delivered} delivered`, gradient: 'from-violet-600 to-violet-700 shadow-violet-200', icon: <CheckCircle className="w-4 h-4" />, decimals: 1, suffix: '%' },
          { label: 'This Week', value: weekOrders.length, prevValue: prevWeekOrders.length, sub: weekTrend !== 0 ? `${weekTrend > 0 ? '↑' : '↓'} ${Math.abs(weekTrend)} vs prev week` : '= same as prev week', gradient: weekTrend >= 0 ? 'from-amber-500 to-orange-500 shadow-amber-200' : 'from-rose-500 to-red-600 shadow-rose-200', icon: weekTrend >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" /> },
        ].map(({ label, value, prevValue, sub, gradient, icon, suffix = '', decimals = 0 }) => (
          <div key={label} className={`relative overflow-hidden bg-gradient-to-br ${gradient} p-4 rounded-2xl text-white shadow-lg`}>
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full" />
            <div className="absolute -right-2 -bottom-6 w-28 h-28 bg-white/5 rounded-full" />
            <div className="flex items-center justify-between mb-2 relative">
              <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">{label}</span>
              <div className="flex items-center gap-1.5">
                {period !== 'all' && prevValue > 0 && <DeltaBadge current={value} previous={prevValue} />}
                <div className="p-1.5 bg-white/20 rounded-lg">{icon}</div>
              </div>
            </div>
            <div className="text-3xl font-black relative leading-tight">
              <AnimatedCounter value={value} decimals={decimals} />{suffix}
            </div>
            <div className="text-[10px] text-white/70 mt-1 font-medium">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Financial KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Revenue</span>
            {period !== 'all' && <DeltaBadge current={grossRevenue} previous={prevPeriodRevenue} />}
          </div>
          <div className="text-xl font-black text-slate-900"><AnimatedCounter value={grossRevenue} /> <span className="text-xs font-semibold text-slate-400">DA</span></div>
          <div className="text-[10px] text-slate-500 mt-1">{periodLabel}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Profit</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${grossProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{fmtPct(grossMarginPct)}</span>
          </div>
          <div className={`text-xl font-black ${grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{grossProfit >= 0 ? '+' : '-'}<AnimatedCounter value={Math.abs(grossProfit)} /> <span className="text-xs font-semibold text-slate-400">DA</span></div>
          <div className="text-[10px] text-slate-500 mt-1">Revenue – landed COGS</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">OPEX</div>
          <div className="text-xl font-black text-rose-600">-<AnimatedCounter value={totalOpexDzd} /> <span className="text-xs font-semibold text-slate-400">DA</span></div>
          <div className="text-[10px] text-slate-500 mt-1">All recorded expenses</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Profit</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${netProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{fmtPct(netMarginPct)}</span>
          </div>
          <div className={`text-xl font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{netProfit >= 0 ? '+' : '-'}<AnimatedCounter value={Math.abs(netProfit)} /> <span className="text-xs font-semibold text-slate-400">DA</span></div>
          <div className="text-[10px] text-slate-500 mt-1">Gross profit – OPEX</div>
        </div>
      </div>

      {/* ── Stats row: Customers, Products, POS, Repeat rate ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Customers', value: customers.length, sub: `+${newCustMonth} mo · +${newCustWeek} wk`, icon: <Users className="w-4 h-4 text-sky-600" />, bg: 'bg-sky-50' },
          { label: 'Active Products', value: activeProducts, sub: `${products.length} total in catalog`, icon: <Package className="w-4 h-4 text-indigo-600" />, bg: 'bg-indigo-50' },
          { label: 'POS Sales', value: posOrders.length, sub: `${fmtNum(posOrders.reduce((s, o) => s + (Number(o.total) || 0), 0))} DA`, icon: <Zap className="w-4 h-4 text-amber-600" />, bg: 'bg-amber-50' },
          { label: 'Repeat Customers', value: repeatCustomerRate, sub: `${fmtPct(cancelRate)} cancel rate`, icon: <RefreshCw className="w-4 h-4 text-rose-600" />, bg: 'bg-rose-50', decimals: 1, suffix: '%' },
        ].map(({ label, value, sub, icon, bg, decimals = 0, suffix = '' }) => (
          <div key={label} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
              <div className={`p-2 ${bg} rounded-xl`}>{icon}</div>
            </div>
            <div className="text-2xl font-black text-slate-900"><AnimatedCounter value={value} decimals={decimals} />{suffix}</div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium leading-tight">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Pre-order conversion + cancellation row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pre-Order Conversion</div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-black text-slate-900"><AnimatedCounter value={preConversion} decimals={1} />%</div>
            <div className="text-xs text-slate-500 mb-1">{preorders.filter(p => p.status === 'fulfilled').length}/{preorders.length} fulfilled</div>
          </div>
          <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-700" style={{ width: `${preConversion}%` }} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Cancellation Rate</div>
          <div className="flex items-end gap-2">
            <div className={`text-3xl font-black ${cancelRate > 15 ? 'text-rose-600' : cancelRate > 8 ? 'text-amber-500' : 'text-emerald-600'}`}>
              <AnimatedCounter value={cancelRate} decimals={1} />%
            </div>
            <div className="text-xs text-slate-500 mb-1">
              <DeltaBadge current={cancelThisMonth} previous={cancelPrevMonth} inverted={true} />
            </div>
          </div>
          <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${cancelRate > 15 ? 'bg-rose-500' : cancelRate > 8 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(cancelRate, 100)}%` }} />
          </div>
          <div className="text-[10px] text-slate-400 mt-1">This month: {cancelThisMonth} · Prev: {cancelPrevMonth}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Revenue Forecast</div>
          <div className="text-[9px] text-slate-400 mb-2">{forecastLabel} projection</div>
          <div className="text-2xl font-black text-slate-900"><AnimatedCounter value={forecastNextMonth} /> <span className="text-xs font-semibold text-slate-400">DA</span></div>
          <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
            <Activity className="w-3 h-3 text-red-500" />
            <span>Based on 6-month linear trend</span>
          </div>
          <div className="mt-2 flex items-end gap-0.5 h-8">
            {monthlyRevenues.map((v, i) => {
              const maxM = Math.max(...monthlyRevenues, forecastNextMonth, 1);
              const isLast = i === monthlyRevenues.length - 1;
              return <div key={i} className={`flex-1 rounded-sm ${isLast ? 'bg-red-300' : 'bg-slate-200'}`} style={{ height: `${Math.max((v / maxM) * 100, 4)}%` }} />;
            })}
            <div className="flex-1 rounded-sm bg-red-500 opacity-60" style={{ height: `${Math.max((forecastNextMonth / Math.max(...monthlyRevenues, forecastNextMonth, 1)) * 100, 4)}%` }} />
          </div>
          <div className="text-[8px] text-slate-400 mt-0.5 text-right">← 6mo + forecast →</div>
        </div>
      </div>

      {/* ── Revenue Trend Chart + Channel Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-red-600" /> Revenue Trend — Last 6 Months</h3>
            <div className="flex items-center gap-3 text-[9px] font-semibold text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />Online</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />POS</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-400 inline-block" />Pre-order</span>
            </div>
          </div>
          <RevenueBarChart orders={allOrders} preorders={preorders} posOrders={posOrders} />
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Revenue by Channel</h3>
            <p className="text-[10px] text-slate-400">{periodLabel}</p>
          </div>
          <div className="space-y-4">
            <HBar label="🌐 Online" value={channelRevenue.online} total={channelRevenue.total} color="bg-blue-500" />
            <HBar label="⚡ POS" value={channelRevenue.pos} total={channelRevenue.total} color="bg-emerald-500" />
            <HBar label="📦 Pre-Orders" value={channelRevenue.preorder} total={channelRevenue.total} color="bg-purple-400" />
          </div>
          <div className="pt-3 border-t border-slate-100 flex justify-between text-xs font-bold">
            <span className="text-slate-700">Total</span>
            <span className="text-slate-900">{fmtNum(channelRevenue.total)} DA</span>
          </div>
        </div>
      </div>

      {/* ── Wilaya Breakdown ── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-red-600" /> Orders by Wilaya — Top 8
        </h3>
        {wilayaStats.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-6">No wilaya data in orders.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {wilayaStats.map(w => (
              <div key={w.name} className="flex items-center gap-3 group">
                <div className="text-xs font-semibold text-slate-700 w-28 shrink-0 truncate">{w.name}</div>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-700" style={{ width: `${(w.orders / maxWilayaOrders) * 100}%` }} />
                </div>
                <div className="text-xs text-slate-500 w-20 shrink-0 text-right">
                  <span className="font-bold text-slate-900">{w.orders}</span> orders
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Order Status Bar ── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Order Status Overview</h3>
        <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden gap-px">
          {Object.entries(statusCounts).map(([s, count]) => count > 0 && (
            <div key={s} title={`${s}: ${count}`} className="h-full" style={{ width: `${(count / totalForBar * 100).toFixed(1)}%`, background: statusColor[s] }} />
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
      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit print:hidden">
        <button onClick={() => setDashTab('orders')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dashTab === 'orders' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>📦 Orders</button>
        <button onClick={() => setDashTab('financial')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dashTab === 'financial' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>💰 Financial</button>
      </div>

      {/* ── ORDERS TAB ── */}
      {dashTab === 'orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-red-600" /> Top Products Sold</h3>
            {topProducts.length === 0 ? <div className="text-center text-xs text-slate-400 py-8">No data yet</div> : (
              <div className="space-y-3">
                {topProducts.map(([name, qty], i) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${i === 0 ? 'bg-amber-50' : i === 1 ? 'bg-slate-100' : i === 2 ? 'bg-orange-50' : 'bg-slate-50'}`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-[11px] text-slate-500">{i + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{name}</div>
                      <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-700" style={{ width: `${Math.round((qty / maxTopQty) * 100)}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-700 shrink-0 bg-slate-100 px-2 py-0.5 rounded-lg">{qty} sold</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Orders with quick-confirm */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2"><ListOrdered className="w-4 h-4 text-red-600" /> Recent Orders</h3>
            {allOrders.length === 0 ? <div className="text-center text-xs text-slate-400 py-8">No orders yet</div> : (
              <div className="divide-y divide-slate-50">
                {allOrders.slice(0, 7).map(o => {
                  const name = `${o.first_name || o.firstName || ''} ${o.last_name || o.lastName || ''}`.trim() || '—';
                  let dateStr = '—';
                  try { if (o.created_at || o.date) dateStr = new Date((o.created_at || o.date)!).toLocaleDateString('en-GB'); } catch { }
                  const isWaiting = o.status === 'waiting';
                  const isConfirming = confirmingId === o.id;
                  return (
                    <div key={o.id} className="py-2 flex items-center gap-2 hover:bg-slate-50/60 -mx-1 px-1 rounded-xl transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">{name}</div>
                        <div className="text-[10px] text-slate-400">{dateStr} · {(o.items || []).length} item(s)</div>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize shrink-0 ${statusBadge[o.status] || 'bg-slate-100 text-slate-600'}`}>{o.status}</span>
                      <div className="text-xs font-black text-slate-900 shrink-0">{fmtNum(Number(o.total) || 0)} DA</div>
                      {isWaiting && onUpdateOrderStatus && (
                        <button onClick={() => handleQuickConfirm(o.id)}
                          disabled={isConfirming}
                          title="Quick confirm"
                          className="shrink-0 p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50">
                          {isConfirming ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                      )}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Stock Valuation */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2"><Warehouse className="w-3.5 h-3.5 text-purple-500" /> Stock Valuation</h3>
              <div className="bg-purple-50 p-3 rounded-xl">
                <div className="text-[10px] text-purple-600 font-semibold mb-0.5">Retail Value (DZD)</div>
                <div className="text-xl font-black text-purple-700">{fmtNum(stockRetailDzd)} DA</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <div className="text-[10px] text-slate-500 font-semibold mb-0.5">Cost Price (EUR)</div>
                <div className="text-xl font-black text-slate-900">{stockCostEur.toFixed(2)} €</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[{ label: 'Supplements', type: 'supplement' }, { label: 'Snacks', type: 'snack' }].map(({ label, type }) => (
                  <div key={type} className="bg-slate-50 p-2.5 rounded-xl text-center">
                    <div className="text-[10px] text-slate-400">{label}</div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">{inventoryItems.filter(i => i.type === type).reduce((s, i) => s + (Number(i.stock) || 0) + (Number(i.stock_eu) || 0), 0)}</div>
                    <div className="text-[9px] text-slate-400">units</div>
                  </div>
                ))}
              </div>
            </div>

            {/* P&L */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> P&amp;L Summary — {periodLabel}</h3>
              <div className="space-y-1.5">
                {[
                  { label: 'Gross Revenue', value: grossRevenue, color: 'text-slate-900', prefix: '' },
                  { label: 'COGS (actual/est.)', value: totalCOGS, color: 'text-rose-600', prefix: '–', note: 'SKU-linked where available' },
                  { label: 'Gross Profit', value: grossProfit, color: grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600', prefix: grossProfit >= 0 ? '+' : '–', bold: true },
                  { label: 'Operating Expenses', value: totalOpexDzd, color: 'text-rose-600', prefix: '–' },
                ].map(({ label, value, color, prefix, bold, note }: any) => (
                  <div key={label} className={`flex justify-between items-start py-2 border-b border-slate-50 ${bold ? 'font-bold border-t border-slate-200 pt-3 mt-1' : ''}`}>
                    <div>
                      <div className={`text-xs ${bold ? 'text-slate-900' : 'text-slate-500'}`}>{label}</div>
                      {note && <div className="text-[9px] text-slate-400">{note}</div>}
                    </div>
                    <span className={`text-xs font-bold ${color} ml-4`}>{prefix}{fmtNum(Math.abs(value))} DA</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-3 font-bold">
                  <span className="text-slate-900">Net Profit (After OPEX)</span>
                  <span className={`text-sm ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {netProfit >= 0 ? '+' : ''}{fmtNum(netProfit)} DA
                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${netProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{fmtPct(netMarginPct)}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Profitability Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-red-600" /> Product Profitability</h3>
              <span className="text-[10px] text-slate-400">Top 10 · {periodLabel}</span>
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
                  {profitabilityRows.length === 0
                    ? <tr><td colSpan={6} className="text-center text-slate-400 py-8">No sales data for this period.</td></tr>
                    : profitabilityRows.map(row => {
                      const profit = row.revenue - row.cogs;
                      const margin = row.revenue > 0 ? (profit / row.revenue) * 100 : 0;
                      return (
                        <tr key={row.name} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-semibold text-slate-800">{row.name}</td>
                          <td className="p-3 text-center"><span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-lg">{row.qty}</span></td>
                          <td className="p-3 text-right text-slate-700">{fmtNum(row.revenue)} DA</td>
                          <td className="p-3 text-right text-rose-500">{fmtNum(row.cogs)} DA</td>
                          <td className={`p-3 text-right font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{profit >= 0 ? '+' : ''}{fmtNum(profit)} DA</td>
                          <td className="p-3 text-center"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${profit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{margin.toFixed(1)}%</span></td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Low Stock Alerts (with velocity) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Low Stock Alerts
            {lowStockAlerts.length > 0 && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{lowStockAlerts.length}</span>}
          </h3>
          {lowStockAlerts.length > 3 && (
            <button onClick={() => setLowStockAll(v => !v)} className="text-xs font-semibold text-red-700 hover:text-red-800 flex items-center gap-1">
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
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>SKU: {a.sku}</span>
                    {a.daysLeft !== null && (
                      <span className={`font-bold ${a.daysLeft <= 3 ? 'text-red-500' : a.daysLeft <= 7 ? 'text-amber-500' : 'text-slate-500'}`}>
                        · ~{a.daysLeft}d until out
                      </span>
                    )}
                    {a.daysLeft === null && <span className="text-slate-400">· velocity unknown</span>}
                  </div>
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
