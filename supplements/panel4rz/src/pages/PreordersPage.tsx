import React, { useState } from 'react';
import { PreOrder, InventoryItem, Product } from '../types';
import { calculatePreorderProfit, getProductPricingAndCost } from '../lib/calculations';
import { Clock, Search, Eye, CheckCircle, XCircle, Trash2, X } from 'lucide-react';

interface PreordersPageProps {
  preorders: PreOrder[];
  preorderItems: any[];
  inventoryItems: InventoryItem[];
  products: Product[];
  onToggleStatus: (id: string, currentStatus: PreOrder['status']) => Promise<void>;
  onDeletePreorder: (id: string) => Promise<void>;
  defaultEurRate: number;
}

export const PreordersPage: React.FC<PreordersPageProps> = ({
  preorders,
  preorderItems,
  inventoryItems,
  products,
  onToggleStatus,
  onDeletePreorder,
  defaultEurRate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPreorder, setSelectedPreorder] = useState<PreOrder | null>(null);

  const filteredPreorders = preorders.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (p.customer_name || '').toLowerCase().includes(q) || (p.customer_phone || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pre-Orders Manager</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage customer pre-orders, items breakdown, and fulfillment conversion.</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Pre-Order ID, customer name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
          />
        </div>
      </div>

      {/* Preorders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Customer Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3 text-center">Items Count</th>
                <th className="p-3">Total Amount</th>
                <th className="p-3">Est. Benefit</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPreorders.map(p => {
                const pItems = preorderItems.filter(x => x.pre_order_id === p.id);
                const profit = calculatePreorderProfit(p, preorderItems, inventoryItems, products, defaultEurRate);

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-slate-500">{new Date(p.date || p.created_at || '').toLocaleDateString()}</td>
                    <td className="p-3 font-bold text-slate-900">{p.customer_name}</td>
                    <td className="p-3 text-slate-500">{p.customer_phone}</td>
                    <td className="p-3 text-center font-bold">{pItems.length} item(s)</td>
                    <td className="p-3 font-bold text-slate-900">{Number(p.total_amount || 0).toLocaleString()} DA</td>
                    <td className={`p-3 font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {profit >= 0 ? '+' : ''}{Math.round(profit).toLocaleString()} DA
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${
                        p.status === 'fulfilled' ? 'bg-emerald-100 text-emerald-800' :
                        p.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedPreorder(p)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                          title="View Items"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onToggleStatus(p.id, p.status)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                            p.status === 'pending' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.status === 'pending' ? 'Fulfill' : 'Toggle Status'}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete pre-order for ${p.customer_name}?`)) onDeletePreorder(p.id);
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

      {/* ── PREORDER ITEMS MODAL ── */}
      {selectedPreorder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                Pre-Order Items — {selectedPreorder.customer_name}
              </h3>
              <button onClick={() => setSelectedPreorder(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600">
                Customer Phone: <strong className="text-slate-900">{selectedPreorder.customer_phone}</strong> | Total: <strong className="text-slate-900">{selectedPreorder.total_amount.toLocaleString()} DA</strong>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 font-bold text-slate-600">
                    <tr>
                      <th className="p-2.5">Product</th>
                      <th className="p-2.5">Variant</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Unit Price</th>
                      <th className="p-2.5 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preorderItems.filter(x => x.pre_order_id === selectedPreorder.id).map((itm, idx) => {
                      const qty = Number(itm.qty) || 1;
                      const fallbackPrice = Number(itm.unit_price || itm.price || itm.unitPrice) || 0;
                      const info = getProductPricingAndCost(itm.product_id || itm.product_name, itm.variant, fallbackPrice, inventoryItems, products, defaultEurRate);
                      const price = fallbackPrice || info.retailPrice || 0;
                      const lineTotal = price * qty;

                      return (
                        <tr key={idx}>
                          <td className="p-2.5 font-bold">{itm.product_name || info.productName || '—'}</td>
                          <td className="p-2.5">{itm.variant || '—'}</td>
                          <td className="p-2.5 text-center font-bold">{qty}</td>
                          <td className="p-2.5 text-right">{price ? price.toLocaleString() + ' DA' : '—'}</td>
                          <td className="p-2.5 text-right font-bold">{lineTotal ? lineTotal.toLocaleString() + ' DA' : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
