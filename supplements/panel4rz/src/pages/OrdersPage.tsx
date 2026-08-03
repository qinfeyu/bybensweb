import React, { useState } from 'react';
import { Order, InventoryItem, Product } from '../types';
import { calculateOrderProfit } from '../lib/calculations';
import { ShoppingBag, Search, Eye, Trash2, CheckCircle2, Clock, Truck, XCircle, X, Filter, Printer, MapPin, User, Calendar } from 'lucide-react';
import { PhoneContactAction } from '../components/PhoneContactAction';
import { WhatsAppTemplates } from '../lib/whatsapp';

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

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const handlePrintInvoice = (o: Order) => {
    const printWindow = window.open('', '_blank', 'width=800,height=700');
    if (!printWindow) {
      alert("Pop-up blocked! Please allow pop-ups to print receipts.");
      return;
    }

    const custName = `${o.first_name || o.firstName || ''} ${o.last_name || o.lastName || ''}`.trim() || 'Valued Customer';
    const dateStr = o.date || o.created_at ? new Date(o.date || o.created_at || '').toLocaleString('fr-FR') : new Date().toLocaleDateString();

    const itemsHtml = (o.items || []).map(it => {
      const uPrice = Number(it.unitPrice || it.unit_price || it.price || 0);
      const lTotal = Number(it.lineTotal || it.line_total || ((it.qty || 1) * uPrice) || 0);
      return `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;"><strong>${it.name || it.product_name || '—'}</strong></td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">${it.flavor || '—'}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">${it.variant || '—'}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">${it.qty || 1}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${uPrice.toLocaleString()} DA</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold;">${lTotal.toLocaleString()} DA</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${o.id}</title>
        <style>
          body { font-family: 'Inter', system-ui, sans-serif; padding: 30px; color: #0f172a; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 15px; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: 900; color: #dc2626; letter-spacing: -0.5px; }
          .sub { font-size: 12px; color: #64748b; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 16px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
          .grid-item { font-size: 13px; }
          .label { color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
          th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 800; border-bottom: 1px solid #cbd5e1; }
          .summary { float: right; width: 300px; font-size: 13px; margin-top: 10px; background: #f8fafc; padding: 16px; border-radius: 10px; border: 1px solid #e2e8f0; }
          .summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
          .total-row { border-top: 2px solid #0f172a; padding-top: 8px; font-weight: 900; font-size: 16px; color: #0f172a; margin-top: 4px; }
          .no-print { margin-bottom: 20px; text-align: right; }
          .btn-print { padding: 10px 20px; background: #dc2626; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; shadow: 0 2px 4px rgba(0,0,0,0.1); }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button class="btn-print" onclick="window.print()">🖨️ Print Invoice / Save PDF</button>
        </div>
        <div class="header">
          <div>
            <div class="logo">BYBENS NUTRITION</div>
            <div class="sub">Premium Storefront & Distribution</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 900; font-size: 18px; color: #0f172a;">INVOICE #${o.id}</div>
            <div class="sub">Date: ${dateStr}</div>
          </div>
        </div>

        <div class="grid">
          <div class="grid-item">
            <span class="label">Customer Name</span>
            <strong>${custName}</strong>
          </div>
          <div class="grid-item">
            <span class="label">Phone Contact</span>
            <strong>${o.phone || '—'}</strong>
          </div>
          <div class="grid-item">
            <span class="label">Wilaya & Commune</span>
            <strong>${o.wilaya || '—'} ${o.commune ? `(${o.commune})` : ''}</strong>
          </div>
          <div class="grid-item">
            <span class="label">Delivery Address</span>
            <strong>${o.address || '—'}</strong>
          </div>
          <div class="grid-item">
            <span class="label">Delivery Option</span>
            <strong>${o.delivery_type === 'home' || o.deliveryType === 'home' ? '🏠 Home Delivery' : '📦 Office Pickup'}</strong>
          </div>
          <div class="grid-item">
            <span class="label">Order Source</span>
            <strong>${o.source || 'Storefront'}</strong>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Flavor</th>
              <th>Variant</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:right">Unit Price</th>
              <th style="text-align:right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-row">
            <span>Subtotal:</span>
            <span>${Number(o.subtotal || o.total || 0).toLocaleString()} DA</span>
          </div>
          ${Number(o.delivery_cost || o.deliveryCost || 0) > 0 ? `
            <div class="summary-row">
              <span>Delivery Fee:</span>
              <span>${Number(o.delivery_cost || o.deliveryCost || 0).toLocaleString()} DA</span>
            </div>
          ` : ''}
          ${Number(o.promoDiscount || (o as any).promo_discount || 0) > 0 ? `
            <div class="summary-row" style="color:#16a34a;">
              <span>Discount (${o.promoCode || (o as any).promo_code || 'PROMO'}):</span>
              <span>-${Number(o.promoDiscount || (o as any).promo_discount || 0).toLocaleString()} DA</span>
            </div>
          ` : ''}
          <div class="summary-row total-row">
            <span>Total:</span>
            <span>${Number(o.total || 0).toLocaleString()} DA</span>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // 1. Base active sales (excluding unpaid credit sales)
  const baseActiveOrders = orders.filter(o => {
    if (o.status === 'unpaid' && (o.source || '').toLowerCase().includes('pos')) return false;
    if (o.is_unpaid === true && o.status === 'unpaid') return false;
    return true;
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

  // Checkbox Selection Helpers
  const isAllSelected = filteredOrders.length > 0 && filteredOrders.every(o => selectedOrderIds.includes(o.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.id));
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Bulk Operations
  const handleBulkStatusChange = async (newStatus: Order['status']) => {
    if (selectedOrderIds.length === 0) return;
    try {
      for (const id of selectedOrderIds) {
        await onUpdateStatus(id, newStatus);
      }
      setSelectedOrderIds([]);
    } catch (e) {
      console.error("Bulk status error", e);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOrderIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedOrderIds.length} selected orders?`)) return;
    try {
      for (const id of selectedOrderIds) {
        await onDeleteOrder(id);
      }
      setSelectedOrderIds([]);
    } catch (e) {
      console.error("Bulk delete error", e);
    }
  };

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
      <div className="flex flex-col gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Top Filter Row: Status Pills + Search Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center p-1 bg-slate-100/90 rounded-xl gap-1 thin-scrollbar overflow-x-auto">
            {['all', 'waiting', 'confirmed', 'shipping', 'delivered', 'canceled'].map(st => {
              const count = st === 'all'
                ? baseActiveOrders.length
                : baseActiveOrders.filter(o => o.status === st).length;

              return (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all ${
                    selectedStatus === st 
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  {st} ({count})
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:w-72 shrink-0">
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

        {/* Bottom Filter Row: Source Filter Selector */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3 text-slate-400" />
            <span>Order Source:</span>
          </span>
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
            {[
              { id: 'all', label: 'All Sources', icon: '🌐', count: baseActiveOrders.length },
              { id: 'storefront', label: 'Storefront', icon: '🛒', count: baseActiveOrders.filter(o => getSourceType(o.source) === 'storefront').length },
              { id: 'pos', label: 'POS Checkout', icon: '🏪', count: baseActiveOrders.filter(o => getSourceType(o.source) === 'pos').length },
              { id: 'pre-order', label: 'Pre-Orders', icon: '📋', count: baseActiveOrders.filter(o => getSourceType(o.source) === 'pre-order').length }
            ].map(src => (
              <button
                key={src.id}
                onClick={() => setSelectedSource(src.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  selectedSource === src.id
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
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
      </div>

      {/* Orders View: Desktop Table + Mobile Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden relative">
        {/* Mobile Cards View (shown on screens < md) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {/* Mobile Select All Bar */}
          {filteredOrders.length > 0 && (
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span>Select All Orders ({filteredOrders.length})</span>
              </label>
              {selectedOrderIds.length > 0 && (
                <span className="text-[11px] font-black text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  {selectedOrderIds.length} selected
                </span>
              )}
            </div>
          )}

          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No orders found matching your filters.
            </div>
          ) : (
            filteredOrders.map(o => {
              const profit = calculateOrderProfit(o, inventoryItems, products, defaultEurRate);
              const custName = `${o.first_name || o.firstName || ''} ${o.last_name || o.lastName || ''}`.trim() || 'POS Customer';
              const sLower = (o.source || '').toLowerCase();
              const isSelected = selectedOrderIds.includes(o.id);

              return (
                <div key={o.id} className={`p-4 space-y-3 transition-colors ${isSelected ? 'bg-red-50/40' : 'hover:bg-slate-50/60'}`}>
                  {/* Top row: Checkbox, Order ID, Source badge & Date */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOrder(o.id)}
                        className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="font-black text-slate-900 text-sm">{o.id}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold inline-flex items-center gap-1 border ${
                        sLower === 'pre-order'
                          ? 'bg-amber-50 text-amber-900 border-amber-200'
                          : sLower === 'pos'
                          ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                          : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      }`}>
                        <span>{sLower === 'pre-order' ? '📋' : sLower === 'pos' ? '🏪' : '🛒'}</span>
                        <span>{o.source || 'Storefront'}</span>
                      </span>
                    </div>

                    <span className="text-[10px] font-bold text-slate-400">
                      {o.date || o.created_at ? new Date(o.date || o.created_at || '').toLocaleDateString() : '—'}
                    </span>
                  </div>

                  {/* Customer Info & Financials */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <div>
                      <div className="font-bold text-slate-900">{custName}</div>
                      <PhoneContactAction
                        phone={o.phone}
                        customerName={custName}
                        message={WhatsAppTemplates.orderStatus(custName, o.id, o.status, Number(o.total || 0))}
                        className="mt-1"
                      />
                    </div>

                    <div className="text-right">
                      <div className="font-black text-sm text-slate-900">{Number(o.total || 0).toLocaleString()} DA</div>
                      <div className={`text-[10px] font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        Net: {profit >= 0 ? '+' : ''}{Math.round(profit).toLocaleString()} DA
                      </div>
                    </div>
                  </div>

                  {/* Status & Actions Row */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                    <select
                      value={o.status || 'waiting'}
                      onChange={(e) => onUpdateStatus(o.id, e.target.value as Order['status'])}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border focus:outline-none transition-all ${
                        o.status === 'delivered' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        o.status === 'confirmed' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                        o.status === 'shipping' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                        o.status === 'waiting' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      <option value="waiting">⏳ Waiting</option>
                      <option value="confirmed">✓ Confirmed</option>
                      <option value="shipping">🚚 Shipping</option>
                      <option value="delivered">✅ Delivered</option>
                      <option value="canceled">❌ Canceled</option>
                    </select>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedOrder(o)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-xl flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete order [${o.id}]?`)) onDeleteOrder(o.id);
                        }}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (shown on screens >= md) */}
        <div className="hidden md:block overflow-hidden no-scrollbar">
          <table className="w-full text-xs text-left text-slate-700 table-auto">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-1.5 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-2">Order ID</th>
                <th className="py-2.5 px-2">Customer</th>
                <th className="py-2.5 px-2">Phone</th>
                <th className="py-2.5 px-2">Wilaya</th>
                <th className="py-2.5 px-2">Address</th>
                <th className="py-2.5 px-1.5 text-center">Items</th>
                <th className="py-2.5 px-2">Total</th>
                <th className="py-2.5 px-2">Est. Net</th>
                <th className="py-2.5 px-2">Source</th>
                <th className="py-2.5 px-2">Date</th>
                <th className="py-2.5 px-2">Status</th>
                <th className="py-2.5 px-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map(o => {
                const profit = calculateOrderProfit(o, inventoryItems, products, defaultEurRate);
                const custName = `${o.first_name || o.firstName || ''} ${o.last_name || o.lastName || ''}`.trim() || 'POS Customer';
                const sLower = (o.source || '').toLowerCase();
                const isSelected = selectedOrderIds.includes(o.id);
                const itemCount = Array.isArray(o.items) ? o.items.length : 0;
                const formattedDate = o.date || o.created_at ? new Date(o.date || o.created_at || '').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—';
                const displayId = o.id.length > 14 ? `${o.id.slice(0, 12)}…` : o.id;

                return (
                  <tr key={o.id} className={`transition-colors ${isSelected ? 'bg-red-50/50' : 'hover:bg-slate-50/80'}`}>
                    <td className="py-2.5 px-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOrder(o.id)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-2 font-bold text-slate-900 font-mono text-[11px] whitespace-nowrap" title={o.id}>
                      {displayId}
                    </td>
                    <td className="py-2.5 px-2 font-semibold text-slate-900 max-w-[110px] truncate" title={custName}>
                      {custName}
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <PhoneContactAction
                        phone={o.phone}
                        customerName={custName}
                        message={WhatsAppTemplates.orderStatus(custName, o.id, o.status, Number(o.total || 0))}
                      />
                    </td>
                    <td className="py-2.5 px-2 font-medium text-slate-800 max-w-[90px] truncate" title={o.wilaya || ''}>
                      {o.wilaya || '—'}
                    </td>
                    <td className="py-2.5 px-2 max-w-[100px] truncate text-slate-600" title={o.address || o.commune || ''}>
                      {o.address || o.commune || '—'}
                    </td>
                    <td className="py-2.5 px-1.5 text-center font-bold text-slate-700">{itemCount}</td>
                    <td className="py-2.5 px-2 font-bold text-slate-900 whitespace-nowrap">{Number(o.total || 0).toLocaleString()} DA</td>
                    <td className={`py-2.5 px-2 font-bold whitespace-nowrap ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {profit >= 0 ? '+' : ''}{Math.round(profit).toLocaleString()} DA
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold inline-flex items-center gap-1 border ${
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
                    <td className="py-2.5 px-2 text-slate-500 font-medium whitespace-nowrap">{formattedDate}</td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <select
                        value={o.status || 'waiting'}
                        onChange={(e) => onUpdateStatus(o.id, e.target.value as Order['status'])}
                        className={`text-[11px] font-bold px-2 py-1 rounded-lg border focus:outline-none ${
                          o.status === 'delivered' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          o.status === 'confirmed' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                          o.status === 'shipping' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                          o.status === 'waiting' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        <option value="waiting">Waiting</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="shipping">Shipping</option>
                        <option value="delivered">Delivered</option>
                        <option value="canceled">Canceled</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedOrder(o)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                          title="View Full Order Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete order [${o.id}]?`)) onDeleteOrder(o.id);
                          }}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors"
                          title="Delete Order"
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

      {/* Floating Bulk Action Bar for Orders */}
      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between gap-3 max-w-lg w-[92vw] animate-in slide-in-from-bottom-4">
          <span className="text-xs font-black bg-red-600 px-2.5 py-1 rounded-lg shrink-0">
            {selectedOrderIds.length} Selected
          </span>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusChange(e.target.value as Order['status']);
                  e.target.value = '';
                }
              }}
              className="bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="">Bulk Set Status...</option>
              <option value="waiting">⏳ Waiting</option>
              <option value="confirmed">✓ Confirmed</option>
              <option value="shipping">🚚 Shipping</option>
              <option value="delivered">✅ Delivered</option>
              <option value="canceled">❌ Canceled</option>
            </select>

            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>

          <button
            onClick={() => setSelectedOrderIds([])}
            className="text-slate-400 hover:text-white p-1 rounded-lg shrink-0"
            title="Clear Selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <span className="text-slate-400 font-medium text-[11px] block">Customer Name</span>
                  <strong className="text-slate-900 text-xs">{selectedOrder.first_name || selectedOrder.firstName} {selectedOrder.last_name || selectedOrder.lastName}</strong>
                </div>

                <div>
                  <span className="text-slate-400 font-medium text-[11px] block mb-1">Phone / WhatsApp Contact</span>
                  <PhoneContactAction
                    phone={selectedOrder.phone}
                    customerName={`${selectedOrder.first_name || selectedOrder.firstName || ''} ${selectedOrder.last_name || selectedOrder.lastName || ''}`}
                    message={WhatsAppTemplates.orderStatus(
                      `${selectedOrder.first_name || selectedOrder.firstName || ''}`,
                      selectedOrder.id,
                      selectedOrder.status,
                      Number(selectedOrder.total || 0)
                    )}
                  />
                </div>

                <div>
                  <span className="text-slate-400 font-medium text-[11px] block">Wilaya</span>
                  <strong className="text-slate-900 text-xs">{selectedOrder.wilaya || '—'}</strong>
                </div>

                <div>
                  <span className="text-slate-400 font-medium text-[11px] block">Commune</span>
                  <strong className="text-slate-900 text-xs">{selectedOrder.commune || '—'}</strong>
                </div>

                <div className="sm:col-span-2">
                  <span className="text-slate-400 font-medium text-[11px] block">Delivery Address</span>
                  <strong className="text-slate-900 text-xs">{selectedOrder.address || '—'}</strong>
                </div>

                <div>
                  <span className="text-slate-400 font-medium text-[11px] block">Delivery Option</span>
                  <strong className="text-slate-900 text-xs">
                    {selectedOrder.delivery_type === 'home' || selectedOrder.deliveryType === 'home' 
                      ? '🏠 Home Delivery' 
                      : '📦 Office Pickup / Stop-Desk'}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-400 font-medium text-[11px] block">Order Source</span>
                  <strong className="text-slate-900 text-xs">{selectedOrder.source || 'Storefront'}</strong>
                </div>

                <div>
                  <span className="text-slate-400 font-medium text-[11px] block">Order Date</span>
                  <strong className="text-slate-900 text-xs">
                    {selectedOrder.date || selectedOrder.created_at ? new Date(selectedOrder.date || selectedOrder.created_at || '').toLocaleString('fr-FR') : '—'}
                  </strong>
                </div>
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
                        const lTotal = Number(it.lineTotal || it.line_total || ((it.qty || 1) * uPrice) || 0);
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
                    {Number(selectedOrder.delivery_cost || selectedOrder.deliveryCost || 0) > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Delivery Fee ({selectedOrder.delivery_type === 'home' || selectedOrder.deliveryType === 'home' ? 'Home' : 'Office'})</span>
                        <span>{Number(selectedOrder.delivery_cost || selectedOrder.deliveryCost || 0).toLocaleString()} DA</span>
                      </div>
                    )}
                  </>
                )}

                {(Number(selectedOrder.promoDiscount || (selectedOrder as any).promo_discount || 0) > 0 || selectedOrder.promoCode || (selectedOrder as any).promo_code) && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Promo Discount ({selectedOrder.promoCode || (selectedOrder as any).promo_code || 'PROMO'})</span>
                    <span>-{Number(selectedOrder.promoDiscount || (selectedOrder as any).promo_discount || 0).toLocaleString()} DA</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                  <span>Total</span>
                  <span>{Number(selectedOrder.total || 0).toLocaleString()} DA</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-300 font-bold text-xs">
                  <span>Estimated Benefit</span>
                  <span className={calculateOrderProfit(selectedOrder, inventoryItems, products, defaultEurRate) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {calculateOrderProfit(selectedOrder, inventoryItems, products, defaultEurRate) >= 0 ? '+' : ''}
                    {Math.round(calculateOrderProfit(selectedOrder, inventoryItems, products, defaultEurRate)).toLocaleString()} DA
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

              {/* Bottom Action Bar: Print Invoice & Delete Order */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => handlePrintInvoice(selectedOrder)}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-sm"
                >
                  <Printer className="w-4 h-4 text-red-500" />
                  <span>Print Customer Invoice / Receipt</span>
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete order #${selectedOrder.id}?`)) {
                      onDeleteOrder(selectedOrder.id);
                      setSelectedOrder(null);
                    }
                  }}
                  className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors border border-rose-200"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Order</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
