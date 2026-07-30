import React, { useState } from 'react';
import { PreOrder, InventoryItem, Product } from '../types';
import { calculatePreorderProfit, getProductPricingAndCost } from '../lib/calculations';
import { Clock, Search, Eye, CheckCircle, XCircle, Trash2, X, Printer, FileText, PackageCheck } from 'lucide-react';

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
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const filteredPreorders = preorders.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (p.customer_name || '').toLowerCase().includes(q) || (p.customer_phone || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q);
  });

  // Print Customer Invoice
  const handlePrintCustomerInvoice = (p: PreOrder) => {
    const items = preorderItems.filter(x => x.pre_order_id === p.id);
    let totalVal = 0;

    const rowsHtml = items.map((item, idx) => {
      const invItem = inventoryItems.find(x => x.id === item.product_id);
      const price = invItem ? (Number(invItem.retail_dzd) || 0) : (Number(item.price || item.unit_price) || 0);
      const itemTotal = price * (Number(item.qty) || 1);
      totalVal += itemTotal;

      return `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <div style="font-weight: 600; color: #0f172a;">${item.product_name || 'Supplement'}</div>
            <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">${[item.variant, item.flavor].filter(Boolean).join(" | ")}</div>
          </td>
          <td style="text-align: center; font-weight: 600;">${item.qty}</td>
          <td style="text-align: right;">${price.toLocaleString()} DA</td>
          <td style="text-align: right; font-weight: 600; color: #0f172a;">${itemTotal.toLocaleString()} DA</td>
        </tr>
      `;
    }).join("");

    const grandTotal = totalVal > 0 ? totalVal : (Number(p.total_amount) || 0);

    const printWin = window.open('', '_blank', 'width=800,height=700');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${p.customer_name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 40px; margin: 0; line-height: 1.5; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 25px; }
          .logo { font-size: 24px; font-weight: 900; color: #b91c1c; letter-spacing: -0.5px; }
          .logo span { color: #0f172a; font-weight: 500; }
          .title { font-size: 16px; font-weight: 800; text-align: right; text-transform: uppercase; color: #64748b; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-block h3 { margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 800; }
          .info-block p { margin: 0; font-size: 13.5px; font-weight: 500; color: #334155; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; text-align: left; }
          td { border-bottom: 1px solid #f1f5f9; padding: 12px 10px; font-size: 13px; color: #334155; }
          .summary-table { width: 320px; margin-left: auto; margin-top: 15px; }
          .summary-table tr.total td { font-size: 18px; font-weight: 800; color: #b91c1c; border-top: 2px solid #e2e8f0; padding-top: 12px; }
          .footer { text-align: center; margin-top: 60px; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; font-weight: 500; }
          .btn-print { padding: 10px 20px; background: #b91c1c; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: right;">
          <button class="btn-print" onclick="window.print()">Print / Download PDF</button>
        </div>
        <div class="header">
          <div>
            <div class="logo">ByBens <span>Supplements</span></div>
            <div style="font-size:11.5px; color:#475569; margin-top:4px;">
              📞 +213 662 269 449 | ✉️ contact@bybens.com | 🌐 www.bybens.com
            </div>
          </div>
          <div class="title">Customer Invoice<br><span style="font-size:11px;font-weight:500;color:#94a3b8;">Pre-order #${p.id}</span></div>
        </div>
        <div class="info-grid">
          <div class="info-block">
            <h3>Billed To</h3>
            <p style="font-size: 16px; font-weight: 800; color:#0f172a;">${p.customer_name}</p>
            <p>📞 ${p.customer_phone}</p>
          </div>
          <div class="info-block" style="text-align: right;">
            <h3>Date & Status</h3>
            <p style="font-weight: 700; color: #0f172a;">${new Date(p.date || p.created_at || '').toLocaleDateString()}</p>
            <p style="text-transform: uppercase; font-weight: 800; color: #b91c1c;">${p.status}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>Item Description</th>
              <th style="width: 60px; text-align: center;">Qty</th>
              <th style="width: 120px; text-align: right;">Price</th>
              <th style="width: 120px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colSpan="5" style="text-align:center;">No items recorded</td></tr>'}
          </tbody>
        </table>
        <table class="summary-table">
          <tr class="total">
            <td>Grand Total (DZD):</td>
            <td style="text-align: right;">${grandTotal.toLocaleString()} DA</td>
          </tr>
        </table>
        <div class="footer">
          Thank you for choosing ByBens Supplements! • www.bybens.com
        </div>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  // Print Courier / Delivery Slip
  const handlePrintCourierSlip = (p: PreOrder) => {
    const items = preorderItems.filter(x => x.pre_order_id === p.id);

    const rowsHtml = items.map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td style="font-weight:700;">${item.product_name || 'Supplement'}</td>
        <td style="font-size:11px; color:#64748b;">${[item.variant, item.flavor].filter(Boolean).join(" | ")}</td>
        <td style="text-align:center; font-weight:800;">${item.qty}</td>
      </tr>
    `).join("");

    const printWin = window.open('', '_blank', 'width=800,height=700');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Courier Slip - ${p.customer_name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          body { font-family: 'Inter', sans-serif; color: #0f172a; padding: 30px; margin: 0; background: #fff; }
          .card { border: 2px solid #0f172a; border-radius: 12px; padding: 24px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
          .logo { font-size: 22px; font-weight: 900; color: #b91c1c; }
          .slip-title { font-size: 18px; font-weight: 900; text-transform: uppercase; }
          .dest-box { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f1f5f9; border-bottom: 2px solid #cbd5e1; padding: 8px; font-size: 11px; text-transform: uppercase; text-align: left; }
          td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; font-size: 12.5px; }
          .cod-box { font-size: 20px; font-weight: 900; color: #b91c1c; text-align: right; margin-top: 15px; }
          .btn-print { padding: 10px 20px; background: #0f172a; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: right;">
          <button class="btn-print" onclick="window.print()">Print Courier Slip</button>
        </div>
        <div class="card">
          <div class="header">
            <div class="logo">BYBENS COURIER SLIP</div>
            <div class="slip-title">COD SLIP #${p.id}</div>
          </div>
          <div class="dest-box">
            <div style="font-size:11px; text-transform:uppercase; font-weight:800; color:#64748b; margin-bottom:4px;">RECIPIENT / RECEPTIONNAIRE</div>
            <div style="font-size:18px; font-weight:900; color:#0f172a;">${p.customer_name}</div>
            <div style="font-size:14px; font-weight:700; color:#b91c1c; margin-top:4px;">📞 ${p.customer_phone}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:30px;">#</th>
                <th>Package Contents</th>
                <th>Spec</th>
                <th style="width:50px; text-align:center;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="cod-box">
            AMOUNT TO COLLECT: ${Number(p.total_amount || 0).toLocaleString()} DA
          </div>
        </div>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pre-Orders Manager</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage customer pre-orders, download customer invoices & courier slips.</p>
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
                const isDropdownOpen = openDropdownId === p.id;

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
                    <td className="p-3 text-center relative">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedPreorder(p)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                          title="View Items"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Download / Print Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdownId(isDropdownOpen ? null : p.id)}
                            className="flex items-center gap-1 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs"
                            title="Download & Print Invoices / Slips"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {isDropdownOpen && (
                            <div className="absolute right-0 bottom-full mb-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1 text-left text-xs font-bold animate-in fade-in zoom-in-95">
                              <button
                                onClick={() => {
                                  setOpenDropdownId(null);
                                  handlePrintCustomerInvoice(p);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                <span>Customer Invoice</span>
                              </button>
                              <button
                                onClick={() => {
                                  setOpenDropdownId(null);
                                  handlePrintCourierSlip(p);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg border-t border-slate-100"
                              >
                                <PackageCheck className="w-3.5 h-3.5 text-purple-600" />
                                <span>Courier Slip</span>
                              </button>
                            </div>
                          )}
                        </div>

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

              {filteredPreorders.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No pre-orders recorded.
                  </td>
                </tr>
              )}
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

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => handlePrintCustomerInvoice(selectedPreorder)}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Print Customer Invoice</span>
                </button>
                <button
                  onClick={() => handlePrintCourierSlip(selectedPreorder)}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>Print Courier Slip</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
