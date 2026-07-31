import React, { useState, useMemo } from 'react';
import { Order, InventoryItem, Product } from '../types';
import { 
  CreditCard, Search, CheckCircle2, Trash2, Printer, 
  User, Phone, Clock, AlertCircle, DollarSign, Calendar,
  ArrowRight, ShieldAlert, Check
} from 'lucide-react';

interface UnpaidOrdersPageProps {
  orders: Order[];
  inventoryItems: InventoryItem[];
  products: Product[];
  onMarkAsPaid: (orderId: string) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const UnpaidOrdersPage: React.FC<UnpaidOrdersPageProps> = ({
  orders,
  inventoryItems,
  products,
  onMarkAsPaid,
  onDeleteOrder,
  showToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [confirmPaidId, setConfirmPaidId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter orders that are UNPAID / CREDIT
  const unpaidOrders = useMemo(() => {
    return orders.filter(o => o.status === 'unpaid' || o.payment_status === 'unpaid' || o.is_unpaid === true);
  }, [orders]);

  // Search filtered orders
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return unpaidOrders;
    const q = searchQuery.toLowerCase().trim();
    return unpaidOrders.filter(o => {
      const id = (o.id || '').toLowerCase();
      const name = `${o.first_name || o.firstName || ''} ${o.last_name || o.lastName || ''}`.toLowerCase();
      const phone = (o.phone || '').toLowerCase();
      const wilaya = (o.wilaya || '').toLowerCase();
      return id.includes(q) || name.includes(q) || phone.includes(q) || wilaya.includes(q);
    });
  }, [unpaidOrders, searchQuery]);

  // Summary Metrics
  const totalUnpaidAmount = useMemo(() => {
    return unpaidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [unpaidOrders]);

  const uniqueDebtorsCount = useMemo(() => {
    const phones = new Set<string>();
    unpaidOrders.forEach(o => {
      const p = (o.phone || '').trim();
      const name = `${o.first_name || o.firstName || ''} ${o.last_name || o.lastName || ''}`.trim();
      if (p) phones.add(p);
      else if (name) phones.add(name);
    });
    return phones.size;
  }, [unpaidOrders]);

  const handleConfirmMarkAsPaid = async (orderId: string) => {
    setIsProcessing(true);
    try {
      await onMarkAsPaid(orderId);
      setConfirmPaidId(null);
      if (selectedOrder?.id === orderId) setSelectedOrder(null);
    } catch (e) {
      showToast("Error updating order payment status", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintDebtReceipt = (order: Order) => {
    const printWin = window.open('', '_blank', 'width=400,height=600');
    if (!printWin) {
      showToast("Please allow popups to print ticket", "error");
      return;
    }

    const cName = `${order.first_name || order.firstName || ''} ${order.last_name || order.lastName || ''}`.trim() || 'Customer';
    const cPhone = order.phone || 'N/A';
    const items = order.items || [];
    const dateStr = order.date || order.created_at ? new Date(order.date || order.created_at || '').toLocaleString('fr-DZ') : new Date().toLocaleString('fr-DZ');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>DEBT TICKET - #${order.id}</title>
        <style>
          body { font-family: monospace; font-size: 12px; margin: 0; padding: 15px; background: #fff; color: #000; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .border-b { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
          .border-t { border-top: 1px dashed #000; padding-top: 8px; margin-top: 8px; }
          .flex { display: flex; justify-content: space-between; }
          .debt-box { margin: 10px 0; padding: 8px; border: 2px solid #000; background: #fff; text-align: center; font-size: 13px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="center border-b">
          <div style="font-size: 18px; font-weight: bold;">BYBENS NUTRITION</div>
          <div style="font-size: 11px;">SPORTS NUTRITION & SUPPLEMENTS</div>
          <div>Phone: 0550000000</div>
          <div>Date: ${dateStr}</div>
        </div>

        <div class="debt-box">
          ⚠️ PAYMENT STATUS: UNPAID / DEBT<br/>
          BUY NOW, PAY LATER
        </div>

        <div class="border-b">
          <div><b>Ticket #:</b> ${order.id}</div>
          <div><b>Customer:</b> ${cName}</div>
          <div><b>Phone:</b> ${cPhone}</div>
        </div>

        <div class="border-b">
          <div class="flex bold">
            <span>Item</span>
            <span>Total</span>
          </div>
          ${items.map((it: any) => `
            <div style="margin-top: 4px;">
              <div>${it.name || it.product_name}</div>
              <div class="flex" style="font-size: 11px; color: #444;">
                <span>${it.variant || ''} ${it.flavor ? '(' + it.flavor + ')' : ''} x${it.qty}</span>
                <span>${((it.unitPrice || it.price || 0) * it.qty).toLocaleString()} DA</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div>
          <div class="flex">
            <span>Subtotal:</span>
            <span>${(order.subtotal || order.total).toLocaleString()} DA</span>
          </div>
          <div class="flex bold" style="font-size: 15px; margin-top: 6px;">
            <span>AMOUNT DUE:</span>
            <span>${order.total.toLocaleString()} DA</span>
          </div>
        </div>

        <div class="center border-t" style="margin-top: 15px;">
          <div>Please keep this debt statement for your record.</div>
          <div>Thank you for choosing BYBENS!</div>
        </div>
        <script>window.onload = function() { window.print(); };</script>
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
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-500" />
            <span>Unpaid & Credit Sales (Pay Later)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage "Buy Now Pay Later" customer accounts. Inventory stock is deducted immediately, while amounts move to total revenue upon payment.
          </p>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Unpaid Debt */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-5 rounded-2xl text-white shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-xs font-bold text-amber-100 uppercase tracking-wider">Total Outstanding Debt</div>
            <div className="text-2xl font-black mt-1">
              {totalUnpaidAmount.toLocaleString()} <span className="text-sm font-bold">DA</span>
            </div>
            <div className="text-[11px] text-amber-100 font-medium mt-1">
              Pending collection from {uniqueDebtorsCount} customer(s)
            </div>
          </div>
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xs text-white">
            <DollarSign className="w-7 h-7" />
          </div>
        </div>

        {/* Total Debtors */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Debtor Customers</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {uniqueDebtorsCount} <span className="text-xs font-bold text-slate-400">clients</span>
            </div>
            <div className="text-[11px] text-amber-600 font-bold mt-1">
              {unpaidOrders.length} unpaid transaction(s)
            </div>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200">
            <User className="w-6 h-6" />
          </div>
        </div>

        {/* Stock Inventory Status Notice */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock Status</div>
            <div className="text-sm font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Inventory Stock Deducted</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Stock items reserved & deducted upon credit checkout
            </div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search debtor name, phone, or ticket #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div className="text-xs font-bold text-slate-500">
          Showing <span className="text-slate-900">{filteredOrders.length}</span> of {unpaidOrders.length} unpaid record(s)
        </div>
      </div>

      {/* Unpaid Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Ticket #</th>
                <th className="p-3.5">Customer & Contact</th>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Items Summary</th>
                <th className="p-3.5">Amount Due</th>
                <th className="p-3.5">Payment Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <CreditCard className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-500 text-xs">No unpaid credit orders found.</p>
                      <p className="text-[11px] text-slate-400">All customer accounts are settled!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const custName = `${order.first_name || order.firstName || ''} ${order.last_name || order.lastName || ''}`.trim() || 'Walk-in Customer';
                  const phone = order.phone || 'No Phone';
                  const dateStr = order.date || order.created_at ? new Date(order.date || order.created_at || '').toLocaleString('fr-DZ', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  }) : '—';
                  const itemsCount = (order.items || []).reduce((sum, it: any) => sum + (Number(it.qty) || 1), 0);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Ticket # */}
                      <td className="p-3.5">
                        <div className="font-black text-slate-900">{order.id}</div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{order.source || 'POS'}</span>
                      </td>

                      {/* Customer */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-xs">{custName}</div>
                        <div className="flex items-center gap-1 text-[11px] text-amber-700 font-semibold mt-0.5">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{phone}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-slate-500 font-medium whitespace-nowrap">
                        {dateStr}
                      </td>

                      {/* Items Summary */}
                      <td className="p-3.5 max-w-xs">
                        <div className="font-semibold text-slate-900 line-clamp-1">
                          {(order.items || []).map((it: any) => `${it.name || it.product_name}${it.flavor ? ' (' + it.flavor + ')' : ''} x${it.qty}`).join(', ')}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                          {itemsCount} item(s) total
                        </div>
                      </td>

                      {/* Amount Due */}
                      <td className="p-3.5">
                        <div className="font-black text-amber-600 text-sm">
                          {order.total.toLocaleString()} <span className="text-xs font-bold">DA</span>
                        </div>
                      </td>

                      {/* Payment Status Badge */}
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-300 font-black text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                          <Clock className="w-3 h-3" />
                          <span>Unpaid (Credit)</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Mark as Paid CTA */}
                          <button
                            onClick={() => setConfirmPaidId(order.id)}
                            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-all"
                            title="Mark Order as Paid"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Paid</span>
                          </button>

                          {/* Print Debt Ticket */}
                          <button
                            onClick={() => handlePrintDebtReceipt(order)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                            title="Print Debt Ticket"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Delete / Cancel */}
                          <button
                            onClick={() => {
                              if (confirm(`Cancel/Delete unpaid order #${order.id}? This will restore product stock.`)) {
                                onDeleteOrder(order.id);
                              }
                            }}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                            title="Delete Order & Restore Stock"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Confirm Mark as Paid */}
      {confirmPaidId && (() => {
        const orderToPay = unpaidOrders.find(o => o.id === confirmPaidId);
        if (!orderToPay) return null;
        const cName = `${orderToPay.first_name || orderToPay.firstName || ''} ${orderToPay.last_name || orderToPay.lastName || ''}`.trim() || 'Customer';

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Settle & Mark as Paid</h3>
                  <p className="text-xs text-slate-500">Confirm payment collection for Ticket #{orderToPay.id}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Customer:</span>
                  <span className="font-bold text-slate-900">{cName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Phone:</span>
                  <span className="font-bold text-slate-900">{orderToPay.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-200">
                  <span>Total Amount Collected:</span>
                  <span className="font-black text-emerald-600 text-sm">{orderToPay.total.toLocaleString()} DA</span>
                </div>
              </div>

              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 font-medium">
                💡 Marking this order as paid will move it to regular <b>Orders</b> and add <b>{orderToPay.total.toLocaleString()} DA</b> to your Dashboard Total Sales!
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setConfirmPaidId(null)}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmMarkAsPaid(orderToPay.id)}
                  disabled={isProcessing}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isProcessing ? "Processing..." : "Confirm Payment & Move to Sales"}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
