import React, { useState } from 'react';
import { Order, InventoryItem, Product } from '../types';
import { calculateOrderProfit } from '../lib/calculations';
import { ShoppingBag, Search, Eye, Trash2, CheckCircle2, Clock, Truck, XCircle, X, Filter } from 'lucide-react';

interface OrdersPageProps {
  orders: Order[];
  inventoryItems: InventoryItem[];
  products: Product[];
  onUpdateStatus: (orderId: string, status: Order['status']) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
  defaultEurRate: number;
}

export function getSourceType(source?: string): 'pos' | 'pre-order' | 'storefront' {
  if (!source) return 'storefront';
  const s = source.toLowerCase().trim();
  if (s === 'pos' || s.includes('pos')) return 'pos';
  if (s.includes('pre')) return 'pre-order';
  return 'storefront';
}

export const OrdersPage: React.FC<OrdersPageProps> = ({
  orders,
  inventoryItems,
  products,
  onUpdateStatus,
  onDeleteOrder,
  defaultEurRate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // 1. Base active sales (excluding unpaid credit sales)
  const baseActiveOrders = orders.filter(o => {
    return o.status !== 'unpaid' && o.payment_status !== 'unpaid' && o.is_unpaid !== true;
  });

  // 2. Orders filtered by Source
  const sourceFilteredOrders = baseActiveOrders.filter(o => {
    if (selectedSource === 'all') return true;
    return getSourceType(o.source) === selectedSource.toLowerCase();
  });

  // 3. Final Orders filtered by Source + Status + Search Query
  const filteredOrders = sourceFilteredOrders.filter(o => {
    if (selectedStatus !== 'all' && o.status !== selectedStatus) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase().trim();
    const id = (o.id || '').toLowerCase();
    const name = `${o.first_name || o.firstName || ''} ${o.last_name || o.lastName || ''}`.toLowerCase();
    const phone = (o.phone || '').toLowerCase();
    const source = (o.source || '').toLowerCase();

    return id.includes(q) || name.includes(q) || phone.includes(q) || source.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Orders Manager</h1>
          <p className="text-xs text-slate-500 mt-0.5">Track POS checkout sales, store orders, status updates, and net benefits.</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto">
            {['all', 'waiting', 'confirmed', 'delivered', 'canceled'].map(st => {
              const count = st === 'all'
                ? sourceFilteredOrders.length
                : sourceFilteredOrders.filter(o => o.status === st).length;

              return (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all ${
                    selectedStatus === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {st} ({count})
                </button>
              );
            })}
          </div>

          {/* Source Filter Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <span className="text-[11px] font-bold text-slate-500 pl-2 pr-1 hidden sm:inline flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>Source:</span>
            </span>
            {[
              { id: 'all', label: 'All', icon: '🌐', count: baseActiveOrders.length },
              { id: 'storefront', label: 'Storefront', icon: '🛒', count: baseActiveOrders.filter(o => getSourceType(o.source) === 'storefront').length },
              { id: 'pos', label: 'POS', icon: '🏪', count: baseActiveOrders.filter(o => getSourceType(o.source) === 'pos').length },
              { id: 'pre-order', label: 'Pre-Order', icon: '📋', count: baseActiveOrders.filter(o => getSourceType(o.source) === 'pre-order').length }
            ].map(src => (
              <button
                key={src.id}
                onClick={() => setSelectedSource(src.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedSource === src.id
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>{src.icon}</span>
                <span>{src.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  selectedSource === src.id ? 'bg-slate-100 text-slate-900' : 'bg-slate-200/80 text-slate-600'
                }`}>
                  {src.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full lg:w-64 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Order ID, name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Order ID</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Source</th>
                <th className="p-3">Total</th>
                <th className="p-3">Est. Benefit</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map(o => {
                const profit = calculateOrderProfit(o, inventoryItems, products, defaultEurRate);
                const custName = `${o.first_name || o.firstName || ''} ${o.last_name || o.lastName || ''}`.trim() || 'POS Customer';
                const sLower = (o.source || '').toLowerCase();

                return (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{o.id}</td>
                    <td className="p-3 font-semibold text-slate-900">{custName}</td>
                    <td className="p-3 text-slate-500">{o.phone || '—'}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1.5 border ${
                        sLower === 'pre-order'
                          ? 'bg-amber-50 text-amber-900 border-amber-200/80'
                          : sLower === 'pos'
                          ? 'bg-indigo-50 text-indigo-900 border-indigo-200/80'
                          : 'bg-emerald-50 text-emerald-900 border-emerald-200/80'
                      }`}>
                        <span>
                          {sLower === 'pre-order' ? '📋' : sLower === 'pos' ? '🏪' : '🛒'}
                        </span>
                        <span>{o.source || 'Storefront'}</span>
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-900">{Number(o.total || 0).toLocaleString()} DA</td>
                    <td className={`p-3 font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {profit >= 0 ? '+' : ''}{Math.round(profit).toLocaleString()} DA
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize inline-flex items-center gap-1 ${
                        o.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                        o.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                        o.status === 'waiting' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedOrder(o)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                          title="View Order Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete order [${o.id}]?`)) onDeleteOrder(o.id);
                          }}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ORDER DETAILS MODAL ── */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Order Details — {selectedOrder.id}</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Customer Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-3">
                <div><span className="text-slate-400 font-medium">Customer:</span> <strong className="text-slate-900">{selectedOrder.first_name || selectedOrder.firstName} {selectedOrder.last_name || selectedOrder.lastName}</strong></div>
                <div><span className="text-slate-400 font-medium">Phone:</span> <strong className="text-slate-900">{selectedOrder.phone || '—'}</strong></div>
                <div><span className="text-slate-400 font-medium">Source:</span> <strong className="text-slate-900">{selectedOrder.source || '—'}</strong></div>
                <div><span className="text-slate-400 font-medium">Delivery:</span> <strong className="text-slate-900">{selectedOrder.delivery_type || selectedOrder.deliveryType || 'Standard'}</strong></div>
              </div>

              {/* Items */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2">Ordered Items</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 font-bold text-slate-600">
                      <tr>
                        <th className="p-2.5">Product</th>
                        <th className="p-2.5">Flavor</th>
                        <th className="p-2.5">Variant</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Unit Price</th>
                        <th className="p-2.5 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedOrder.items || []).map((it, idx) => {
                        const uPrice = Number(it.unitPrice || it.unit_price || it.price || 0);
                        const lTotal = Number(it.lineTotal || it.line_total || (it.qty * uPrice) || 0);
                        return (
                          <tr key={idx}>
                            <td className="p-2.5 font-bold">{it.name || it.product_name || '—'}</td>
                            <td className="p-2.5">{it.flavor || '—'}</td>
                            <td className="p-2.5">{it.variant || '—'}</td>
                            <td className="p-2.5 text-center font-bold">{it.qty || 1}</td>
                            <td className="p-2.5 text-right">{uPrice.toLocaleString()} DA</td>
                            <td className="p-2.5 text-right font-bold">{lTotal.toLocaleString()} DA</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                {(selectedOrder.source || '').toLowerCase().includes('pre order') ? (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal (Items + Delivery)</span>
                      <span className="font-bold">{Number(selectedOrder.total || selectedOrder.subtotal || 0).toLocaleString()} DA</span>
                    </div>
                    {Number(selectedOrder.delivery_cost || selectedOrder.deliveryCost || 0) > 0 && (
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Delivery Fee</span>
                        <span>{Number(selectedOrder.delivery_cost || selectedOrder.deliveryCost || 0).toLocaleString()} DA (Included)</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-bold">{Number(selectedOrder.subtotal || 0).toLocaleString()} DA</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Delivery Fee</span>
                      <span>{Number(selectedOrder.delivery_cost || selectedOrder.deliveryCost || 0).toLocaleString()} DA</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                  <span>Total</span>
                  <span>{Number(selectedOrder.total || 0).toLocaleString()} DA</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-300 font-bold text-xs">
                  <span>Estimated Benefit</span>
                  <span className={calculateOrderProfit(selectedOrder, inventoryItems, products, defaultEurRate) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    +{Math.round(calculateOrderProfit(selectedOrder, inventoryItems, products, defaultEurRate)).toLocaleString()} DA
                  </span>
                </div>
              </div>

              {/* Status Updater Buttons */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700">Update Order Status</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['waiting', 'confirmed', 'delivered', 'canceled'] as const).map(st => (
                    <button
                      key={st}
                      onClick={() => {
                        onUpdateStatus(selectedOrder.id, st);
                        setSelectedOrder({ ...selectedOrder, status: st });
                      }}
                      className={`py-2 rounded-xl font-bold capitalize text-xs transition-all ${
                        selectedOrder.status === st
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
