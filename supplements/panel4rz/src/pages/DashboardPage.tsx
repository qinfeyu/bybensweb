import React, { useState, useMemo } from 'react';
import { InventoryItem, Order, PreOrder, Expense, Product } from '../types';
import {
  TrendingUp, ShoppingCart, DollarSign, Layers, Warehouse,
  AlertTriangle, CheckCircle, ChevronDown, BarChart2, ListOrdered
} from 'lucide-react';

interface DashboardPageProps {
  orders: Order[];
  preorders: PreOrder[];
  preorderItems: any[];
  inventoryItems: InventoryItem[];
  products: Product[];
  expenses: Expense[];
  eurRate: number;
  settings?: any;
  categories?: any[];
}

type Period = 'week' | 'month' | 'all';

function isInPeriod(dateStr: string | undefined | null, period: Period): boolean {
  if (period === 'all' || !dateStr) return true;
  try {
    const d = new Date(dateStr);
    const days = period === 'week' ? 7 : 30;
    return d >= new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  } catch { return false; }
}

function fmtNum(n: number) { return Math.round(n).toLocaleString('fr-DZ'); }

export const DashboardPage: React.FC<DashboardPageProps> = ({
  orders,
  preorders,
  preorderItems,
  inventoryItems,
  products,
  expenses,
  eurRate,
}) => {
  const [period, setPeriod] = useState<Period>('month');
  const [dashTab, setDashTab] = useState<'orders' | 'financial'>('orders');
  const [lowStockAll, setLowStockAll] = useState(false);

  // ── Sort orders newest first ──
  const allOrders = useMemo(() =>
    [...orders].sort((a, b) => {
      const da = new Date(a.created_at || a.date || 0).getTime();
      const db = new Date(b.created_at || b.date || 0).getTime();
      return db - da;
    }), [orders]);

  // ── Week / prev-week ──
  const now = Date.now();
  const weekAgo  = new Date(now - 7  * 86400000);
  const prevWeekAgo = new Date(now - 14 * 86400000);

  const weekOrders = allOrders.filter(o => {
    try { return new Date(o.created_at || o.date || 0) >= weekAgo; } catch { return false; }
  });
  const prevWeekOrders = allOrders.filter(o => {
    try {
      const d = new Date(o.created_at || o.date || 0);
      return d >= prevWeekAgo && d < weekAgo;
    } catch { return false; }
  });
  const weekTrend = weekOrders.length - prevWeekOrders.length;

  const waitingOrders = allOrders.filter(o => o.status === 'waiting');
  const posOrders = allOrders.filter(o =>
    o.source === 'POS' || o.source === 'POS Checkout' || String(o.id || '').startsWith('POS-')
  );
  const posRevenue = posOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);

  // ── Status counts ──
  const statusCounts = useMemo(() => ({
    waiting:   allOrders.filter(o => o.status === 'waiting').length,
    confirmed: allOrders.filter(o => o.status === 'confirmed').length,
    delivered: allOrders.filter(o => o.status === 'delivered').length,
    canceled:  allOrders.filter(o => o.status === 'canceled').length,
  }), [allOrders]);

  const totalForBar = allOrders.length || 1;
  const statusColor: Record<string, string> = {
    waiting:   '#f59e0b',
    confirmed: '#10b981',
    delivered: '#3b82f6',
    canceled:  '#ef4444',
  };

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

  // ── Financial — period-filtered ──
  const { grossRevenue, totalCOGS, profitabilityRows } = useMemo(() => {
    let rev = 0, cogs = 0;
    const map: Record<string, { name: string; qty: number; revenue: number; cogs: number }> = {};

    const track = (name: string, qty: number, r: number, c: number) => {
      if (!map[name]) map[name] = { name, qty: 0, revenue: 0, cogs: 0 };
      map[name].qty += qty; map[name].revenue += r; map[name].cogs += c;
    };

    // POS orders
    posOrders.forEach(o => {
      if (!isInPeriod(o.created_at || o.date, period)) return;
      const r = Number(o.total) || 0;
      const c = r * 0.65;
      rev += r; cogs += c;
      track('POS Sale', 1, r, c);
    });

    // Online / regular orders (non-POS)
    allOrders.forEach(o => {
      if (posOrders.includes(o)) return;
      if (!isInPeriod(o.created_at || o.date, period)) return;
      if (o.status === 'canceled') return;
      const r = Number(o.total) || 0;
      const c = r * 0.65;
      rev += r; cogs += c;
      const items = o.items || [];
      if (items.length > 0) {
        items.forEach(it => {
          const name = (it.name || it.product_name || 'Order Item').split(' (')[0];
          const qty = Number(it.qty) || 1;
          const itemRev = (Number(it.price) || 0) * qty || r / items.length;
          track(name, qty, itemRev, itemRev * 0.65);
        });
      } else {
        track('Online Order', 1, r, c);
      }
    });

    // Fulfilled pre-orders
    preorders.filter(p => p.status === 'fulfilled').forEach(p => {
      if (!isInPeriod(p.date, period)) return;
      const r = Number(p.total_amount) || 0;
      const c = r * 0.65;
      rev += r; cogs += c;
      const items = preorderItems.filter(x => x.pre_order_id === p.id);
      if (items.length > 0) {
        items.forEach((it: any) => {
          track(it.product_name || 'Pre-Order Item', Number(it.qty) || 1, r / items.length, c / items.length);
        });
      } else {
        track('Pre-Order', 1, r, c);
      }
    });

    const rows = Object.values(map)
      .sort((a, b) => (b.revenue - b.cogs) - (a.revenue - a.cogs))
      .slice(0, 10);

    return { grossRevenue: rev, totalCOGS: cogs, profitabilityRows: rows };
  }, [allOrders, posOrders, preorders, preorderItems, period]);

  const grossProfit = grossRevenue - totalCOGS;
  const grossMarginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

  const totalOpexDzd = useMemo(() =>
    expenses.reduce((s, e) => {
      const amt = Number(e.amount) || 0;
      return s + (e.currency === 'EUR' ? amt * eurRate : amt);
    }, 0),
    [expenses, eurRate]
  );

  const netProfit = grossProfit - totalOpexDzd;
  const netMarginPct = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

  // ── Stock valuation ──
  const stockRetailDzd = inventoryItems.reduce((s, i) => {
    const qty = (Number(i.stock) || 0) + (Number(i.stock_eu) || 0);
    return s + qty * (Number(i.retail_dzd) || 0);
  }, 0);
  const stockCostEur = inventoryItems.reduce((s, i) => {
    const qty = (Number(i.stock) || 0) + (Number(i.stock_eu) || 0);
    return s + qty * (Number(i.price_eur) || 0);
  }, 0);

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

  // ── Status badge style ──
  const statusBadge: Record<string, string> = {
    delivered: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-emerald-100 text-emerald-700',
    canceled:  'bg-red-100 text-red-700',
    waiting:   'bg-amber-100 text-amber-700',
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Business Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">Live analytics, KPIs, inventory valuation &amp; sales intelligence.</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {(['week', 'month', 'all'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg transition-all capitalize ${period === p ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Order KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Orders',
            value: allOrders.length,
            sub: `${weekOrders.length} this week`,
            icon: <ShoppingCart className="w-4 h-4" />,
            bg: 'bg-emerald-50', fg: 'text-emerald-600',
          },
          {
            label: 'Waiting',
            value: waitingOrders.length,
            sub: 'Awaiting confirmation',
            icon: <span className="text-base">⏳</span>,
            bg: 'bg-amber-50', fg: 'text-amber-600',
          },
          {
            label: 'POS Sales',
            value: posOrders.length,
            sub: `${fmtNum(posRevenue)} DA`,
            icon: <BarChart2 className="w-4 h-4" />,
            bg: 'bg-blue-50', fg: 'text-blue-600',
          },
          {
            label: 'This Week',
            value: weekOrders.length,
            sub: weekTrend !== 0 ? `${weekTrend > 0 ? '↑' : '↓'} ${Math.abs(weekTrend)} vs prev week` : '= same as prev week',
            icon: <TrendingUp className="w-4 h-4" />,
            bg: weekTrend >= 0 ? 'bg-emerald-50' : 'bg-rose-50',
            fg: weekTrend >= 0 ? 'text-emerald-600' : 'text-rose-600',
          },
        ].map(({ label, value, sub, icon, bg, fg }) => (
          <div key={label} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
              <div className={`p-2 ${bg} ${fg} rounded-xl`}>{icon}</div>
            </div>
            <div className="text-2xl font-black text-slate-900">{value}</div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Financial KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Gross Revenue</div>
          <div className="text-xl font-black text-slate-900">{fmtNum(grossRevenue)} <span className="text-xs font-semibold text-slate-400">DA</span></div>
          <div className="text-[10px] text-slate-500 mt-1">{periodLabel}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Gross Profit</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${grossProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{grossMarginPct.toFixed(1)}%</span>
          </div>
          <div className={`text-xl font-black ${grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {grossProfit >= 0 ? '+' : ''}{fmtNum(grossProfit)} <span className="text-xs font-semibold text-slate-400">DA</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Revenue minus COGS</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Operating Expenses</div>
          <div className="text-xl font-black text-rose-600">-{fmtNum(totalOpexDzd)} <span className="text-xs font-semibold text-slate-400">DA</span></div>
          <div className="text-[10px] text-slate-500 mt-1">All recorded expenses</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Net Profit</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${netProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{netMarginPct.toFixed(1)}%</span>
          </div>
          <div className={`text-xl font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {netProfit >= 0 ? '+' : ''}{fmtNum(netProfit)} <span className="text-xs font-semibold text-slate-400">DA</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Gross profit minus OPEX</div>
        </div>
      </div>

      {/* ── Order Status Overview Bar ── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Order Status Overview</h3>
        <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden gap-px">
          {Object.entries(statusCounts).map(([s, count]) => count > 0 && (
            <div key={s} title={`${s}: ${count}`}
              className="h-full transition-all"
              style={{ width: `${(count / totalForBar * 100).toFixed(1)}%`, background: statusColor[s] || '#94a3b8' }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {Object.entries(statusCounts).map(([s, count]) => (
            <div key={s} className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: statusColor[s] || '#94a3b8' }} />
              <span className="text-slate-500 capitalize">{s}</span>
              <strong className="text-slate-900">{count}</strong>
              <span className="text-slate-400">({totalForBar > 0 ? ((count / totalForBar) * 100).toFixed(0) : 0}%)</span>
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
              <div className="space-y-2.5">
                {topProducts.map(([name, qty], i) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{name}</div>
                      <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400 transition-all"
                          style={{ width: `${Math.round((qty / maxTopQty) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="text-xs font-bold text-slate-700 shrink-0">{qty} sold</div>
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
              <div className="divide-y divide-slate-100">
                {allOrders.slice(0, 6).map(o => {
                  const name = `${o.first_name || o.firstName || ''} ${o.last_name || o.lastName || ''}`.trim() || '—';
                  let dateStr = '—';
                  try { if (o.created_at || o.date) dateStr = new Date((o.created_at || o.date)!).toLocaleDateString('en-GB'); } catch { }
                  return (
                    <div key={o.id} className="py-2.5 flex items-center gap-3">
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
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Warehouse className="w-3.5 h-3.5 text-purple-500" /> Stock Valuation
              </h3>
              <div>
                <div className="text-[10px] text-slate-400 mb-0.5">Retail Value (DZD)</div>
                <div className="text-xl font-black text-purple-700">{fmtNum(stockRetailDzd)} DA</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 mb-0.5">Cost Price (EUR)</div>
                <div className="text-lg font-black text-slate-900">{stockCostEur.toFixed(2)} €</div>
              </div>
              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                {[
                  { label: 'Supplements', type: 'supplement' },
                  { label: 'Snacks', type: 'snack' },
                ].map(({ label, type }) => (
                  <div key={type} className="bg-slate-50 p-2.5 rounded-lg">
                    <div className="text-[10px] text-slate-400">{label}</div>
                    <div className="text-sm font-bold text-slate-900">
                      {inventoryItems.filter(i => i.type === type).reduce((s, i) => s + (Number(i.stock) || 0) + (Number(i.stock_eu) || 0), 0)} units
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* P&L */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> P&amp;L Summary — {periodLabel}
              </h3>
              <div className="space-y-1">
                {[
                  { label: 'Gross Revenue', value: grossRevenue, color: 'text-slate-900', prefix: '' },
                  { label: 'Cost of Goods Sold (COGS est.)', value: totalCOGS, color: 'text-rose-600', prefix: '–' },
                  { label: 'Gross Profit', value: grossProfit, color: grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600', prefix: grossProfit >= 0 ? '+' : '', bold: true },
                  { label: 'Operating Expenses', value: totalOpexDzd, color: 'text-rose-600', prefix: '–' },
                ].map(({ label, value, color, prefix, bold }) => (
                  <div key={label} className={`flex justify-between items-center py-2 border-b border-slate-50 ${bold ? 'font-bold' : ''}`}>
                    <span className={`text-xs ${bold ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
                    <span className={`text-xs font-bold ${color}`}>{prefix}{fmtNum(Math.abs(value))} DA</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-3 font-bold">
                  <span className="text-slate-900 text-sm">Net Profit</span>
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
              <span className="text-[10px] font-semibold text-slate-400">Top 10 • {periodLabel}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3 text-left">Product</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Revenue</th>
                    <th className="p-3 text-right text-slate-400">COGS</th>
                    <th className="p-3 text-right">Profit</th>
                    <th className="p-3 text-center">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {profitabilityRows.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-slate-400 py-8 text-xs">No sales data for this period.</td></tr>
                  ) : profitabilityRows.map(row => {
                    const profit = row.revenue - row.cogs;
                    const margin = row.revenue > 0 ? (profit / row.revenue) * 100 : 0;
                    return (
                      <tr key={row.name} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-semibold text-slate-800">{row.name}</td>
                        <td className="p-3 text-center font-bold text-slate-600">{row.qty}</td>
                        <td className="p-3 text-right text-slate-700">{fmtNum(row.revenue)} DA</td>
                        <td className="p-3 text-right text-slate-400">{fmtNum(row.cogs)} DA</td>
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
              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {lowStockAlerts.length}
              </span>
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
              <div key={`${a.sku}-${a.name}`} className="flex items-center justify-between px-5 py-3 border-b border-slate-50 last:border-0">
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
