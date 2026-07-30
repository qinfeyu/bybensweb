import React, { useState } from 'react';
import { PreOrder, InventoryItem, Product } from '../types';
import { calculatePreorderProfit, getProductPricingAndCost } from '../lib/calculations';
import { 
  Clock, 
  Search, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  X, 
  Printer, 
  FileText, 
  PackageCheck,
  Plus,
  Check
} from 'lucide-react';

interface PreorderItemRow {
  product_id: string;
  product_name: string;
  variant: string;
  flavor: string;
  qty: number;
  unit_price: number;
}

interface PreordersPageProps {
  preorders: PreOrder[];
  preorderItems: any[];
  inventoryItems: InventoryItem[];
  products: Product[];
  onToggleStatus: (id: string, currentStatus: PreOrder['status']) => Promise<void>;
  onDeletePreorder: (id: string) => Promise<void>;
  onSavePreorder?: (preorderData: Partial<PreOrder>, items: PreorderItemRow[]) => Promise<void>;
  defaultEurRate: number;
}

export const PreordersPage: React.FC<PreordersPageProps> = ({
  preorders,
  preorderItems,
  inventoryItems,
  products,
  onToggleStatus,
  onDeletePreorder,
  onSavePreorder,
  defaultEurRate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPreorder, setSelectedPreorder] = useState<PreOrder | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // New / Edit Pre-order Modal State
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingPreorderId, setEditingPreorderId] = useState<string | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custNotes, setCustNotes] = useState('');
  const [custStatus, setCustStatus] = useState<PreOrder['status']>('pending');
  const [itemRows, setItemRows] = useState<PreorderItemRow[]>([
    { product_id: '', product_name: '', variant: '', flavor: '', qty: 1, unit_price: 0 }
  ]);

  const filteredPreorders = preorders.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (p.customer_name || '').toLowerCase().includes(q) || (p.customer_phone || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q);
  });

  // Open Modal for New Pre-Order
  const handleOpenAddModal = () => {
    setEditingPreorderId(null);
    setCustName('');
    setCustPhone('');
    setCustNotes('');
    setCustStatus('pending');
    setItemRows([{ product_id: '', product_name: '', variant: '', flavor: '', qty: 1, unit_price: 0 }]);
    setIsAddEditModalOpen(true);
  };

  // Open Modal for Edit Pre-Order
  const handleOpenEditModal = (p: PreOrder) => {
    setEditingPreorderId(p.id);
    setCustName(p.customer_name || '');
    setCustPhone(p.customer_phone || '');
    setCustNotes(p.notes || '');
    setCustStatus(p.status || 'pending');

    const existingItems = preorderItems.filter(x => x.pre_order_id === p.id);
    if (existingItems.length > 0) {
      setItemRows(existingItems.map(i => ({
        product_id: i.product_id || '',
        product_name: i.product_name || '',
        variant: i.variant || '',
        flavor: i.flavor || '',
        qty: Number(i.qty) || 1,
        unit_price: Number(i.unit_price || i.price) || 0
      })));
    } else {
      setItemRows([{ product_id: '', product_name: '', variant: '', flavor: '', qty: 1, unit_price: 0 }]);
    }
    setIsAddEditModalOpen(true);
  };

  // Save Pre-Order Modal
  const handleSavePreorderModal = async () => {
    if (!custName.trim()) return;

    // Filter valid item rows
    const validRows = itemRows.filter(r => r.product_id || r.product_name.trim());
    const totalAmount = validRows.reduce((sum, r) => sum + (r.unit_price * r.qty), 0);

    if (onSavePreorder) {
      await onSavePreorder(
        {
          id: editingPreorderId || undefined,
          customer_name: custName.trim(),
          customer_phone: custPhone.trim(),
          notes: custNotes.trim(),
          status: custStatus,
          total_amount: totalAmount
        },
        validRows
      );
    }

    setIsAddEditModalOpen(false);
  };

  // Resolve inventory item selection in modal row
  const handleSelectInventoryItem = (index: number, skuOrName: string) => {
    const inv = inventoryItems.find(x => x.id.toLowerCase() === skuOrName.toLowerCase() || x.name.toLowerCase() === skuOrName.toLowerCase());
    const prod = products.find(x => x.name.toLowerCase() === skuOrName.toLowerCase() || x.id === skuOrName);

    const nextRows = [...itemRows];
    if (inv) {
      nextRows[index] = {
        ...nextRows[index],
        product_id: inv.id,
        product_name: `${inv.brand ? inv.brand + ' - ' : ''}${inv.name}`,
        variant: inv.variant_spec || inv.size || '',
        unit_price: inv.retail_dzd || 0
      };
    } else if (prod) {
      nextRows[index] = {
        ...nextRows[index],
        product_id: prod.id,
        product_name: prod.name,
        unit_price: prod.variants?.[0]?.price || 0
      };
    } else {
      nextRows[index].product_name = skuOrName;
    }
    setItemRows(nextRows);
  };

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
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
          body { font-family: 'Outfit', sans-serif; color: #1e293b; padding: 40px; margin: 0; line-height: 1.5; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 30px; }
          .logo { font-size: 26px; font-weight: 800; color: #ad0000; letter-spacing: -0.5px; }
          .logo span { color: #0f172a; font-weight: 400; }
          .title { font-size: 18px; font-weight: 700; text-align: right; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-block h3 { margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px; }
          .info-block p { margin: 0; font-size: 14px; font-weight: 500; color: #334155; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 12px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; text-align: left; letter-spacing: 0.5px; }
          td { border-bottom: 1px solid #f1f5f9; padding: 14px 10px; font-size: 13.5px; color: #334155; }
          .summary-table { width: 340px; margin-left: auto; margin-top: 20px; }
          .summary-table tr.total { font-size: 18px; font-weight: 700; color: #ad0000; border-top: 2px solid #f1f5f9; }
          .summary-table tr.total td { color: #ad0000; padding-top: 16px; }
          .footer { text-align: center; margin-top: 80px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; font-weight: 500; }
          .btn-print { padding: 10px 20px; background: #ad0000; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; font-family: 'Outfit', sans-serif; transition: background 0.2s; }
          .btn-print:hover { background: #880000; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 30px; text-align: right;">
          <button class="btn-print" onclick="window.print()">Print / Save PDF</button>
        </div>
        <div class="header">
          <div>
            <div class="logo">ByBens <span>Supplements</span></div>
            <div style="font-size:12px; color:#475569; margin-top:4px; font-weight:500; line-height:1.4;">
              📞 +213 662 269 449 &nbsp;|&nbsp; ✉️ contact@bybens.com<br>
              📸 Instagram: @BENS.SUPPLEMENTS &nbsp;|&nbsp; 🌐 www.bybens.com
            </div>
          </div>
          <div class="title">Customer Invoice<br><span style="font-size:11.5px;font-weight:500;text-transform:none;color:#94a3b8;">Pre-order ID: ${p.id}</span></div>
        </div>
        <div class="info-grid">
          <div class="info-block">
            <h3>Billed To</h3>
            <p style="font-size: 17px; font-weight: 700; color:#0f172a; margin-bottom:4px;">${p.customer_name}</p>
            <p style="font-weight: 500; color: #475569;">📞 ${p.customer_phone}</p>
          </div>
          <div class="info-block" style="text-align: right;">
            <h3>Invoice Date</h3>
            <p style="font-size: 15px; font-weight: 600; color: #0f172a;">${new Date(p.date || p.created_at || '').toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Product Details</th>
              <th style="width: 80px; text-align: center;">Qty</th>
              <th style="width: 130px; text-align: right;">Unit Price</th>
              <th style="width: 130px; text-align: right;">Total</th>
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
          Thank you for shopping with ByBens!<br>
          <span style="font-weight:600; color:#475569;">📞 +213 662 269 449 &nbsp;•&nbsp; ✉️ contact@bybens.com &nbsp;•&nbsp; 📸 @BENS.SUPPLEMENTS &nbsp;•&nbsp; 🌐 www.bybens.com</span>
        </div>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  // Print Legacy Courier Slip
  const handlePrintCourierSlip = (p: PreOrder) => {
    const items = preorderItems.filter(x => x.pre_order_id === p.id);
    let totalDeliveryFee = 0;

    const rowsHtml = items.map((item, idx) => {
      const invItem = inventoryItems.find(x => x.id === item.product_id);
      const deliveryUnit = invItem ? (Number(invItem.delivery_dzd) || 0) : 0;
      const deliveryItemTotal = deliveryUnit * (Number(item.qty) || 1);
      totalDeliveryFee += deliveryItemTotal;

      return `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <div style="font-weight: 600; color: #0f172a;">${item.product_name || 'Supplement'}</div>
            <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">${[item.variant, item.flavor].filter(Boolean).join(" | ")}</div>
          </td>
          <td style="text-align: center; font-weight: 700; color: #0f172a;">${item.qty}</td>
          <td style="text-align: right;">${deliveryUnit.toLocaleString()} DA</td>
          <td style="text-align: right; font-weight: 600; color: #0f172a;">${deliveryItemTotal.toLocaleString()} DA</td>
        </tr>
      `;
    }).join("");

    const deliveryFeeToCollect = totalDeliveryFee > 0 ? totalDeliveryFee : (Number(p.total_amount) || 0);

    const printWin = window.open('', '_blank', 'width=800,height=700');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Delivery Slip - ${p.customer_name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
          body { font-family: 'Outfit', sans-serif; color: #1e293b; padding: 40px; margin: 0; line-height: 1.5; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 30px; }
          .logo { font-size: 26px; font-weight: 800; color: #ad0000; letter-spacing: -0.5px; }
          .logo span { color: #0f172a; font-weight: 400; }
          .title { font-size: 18px; font-weight: 700; text-align: right; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }
          .info-grid { display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 30px; }
          .info-block h3 { margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; font-weight: 700; }
          .info-block p { margin: 0; font-size: 14px; font-weight: 500; color: #334155; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 12px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; text-align: left; letter-spacing: 0.5px; }
          td { border-bottom: 1px solid #f1f5f9; padding: 14px 10px; font-size: 13.5px; color: #334155; }
          .collect-box { padding: 22px; background: #fffbeb; border: 2px dashed #f59e0b; border-radius: 8px; font-size: 18px; font-weight: 800; color: #b45309; display: flex; justify-content: space-between; align-items: center; margin-top: 30px; }
          .collect-box span.val { font-size: 24px; color: #ad0000; font-weight: 800; }
          .footer { margin-top: 80px; display: flex; justify-content: space-between; font-size: 13px; color: #64748b; }
          .btn-print { padding: 10px 20px; background: #ad0000; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; font-family: 'Outfit', sans-serif; transition: background 0.2s; }
          .btn-print:hover { background: #880000; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 30px; text-align: right;">
          <button class="btn-print" onclick="window.print()">Print / Save PDF</button>
        </div>
        <div class="header">
          <div>
            <div class="logo">ByBens <span>Supplements</span></div>
            <div style="font-size:12px; color:#475569; margin-top:4px; font-weight:500; line-height:1.4;">
              📞 +213 662 269 449 &nbsp;|&nbsp; ✉️ contact@bybens.com<br>
              📸 Instagram: @BENS.SUPPLEMENTS &nbsp;|&nbsp; 🌐 www.bybens.com
            </div>
          </div>
          <div class="title">Courier Delivery Slip<br><span style="font-size:11.5px;font-weight:500;text-transform:none;color:#94a3b8;">Pre-order ID: ${p.id}</span></div>
        </div>
        <div class="info-grid">
          ${p.notes ? `
          <div class="info-block" style="background:#f8fafc; padding: 16px; border-radius: 8px; border:1px solid #e2e8f0;">
            <h3>Delivery Notes / Instructions</h3>
            <p style="font-size: 13.5px; font-weight: normal; color: #475569; white-space: pre-wrap; margin: 0;">${p.notes}</p>
          </div>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Product Details</th>
              <th style="width: 80px; text-align: center;">Qty</th>
              <th style="width: 130px; text-align: right;">Delivery Price</th>
              <th style="width: 130px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colSpan="5" style="text-align:center;">No items recorded</td></tr>'}
          </tbody>
        </table>

        <div class="collect-box">
          <span>COURIER: COLLECT DELIVERY FEE</span>
          <span class="val">${deliveryFeeToCollect.toLocaleString()} DA</span>
        </div>
        <div class="footer" style="margin-top: 40px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 15px; font-weight: 500;">
          ByBens Supplements &nbsp;•&nbsp; 📞 +213 662 269 449 &nbsp;•&nbsp; ✉️ contact@bybens.com &nbsp;•&nbsp; 📸 @BENS.SUPPLEMENTS &nbsp;•&nbsp; 🌐 www.bybens.com
        </div>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Datalist for inventory SKU / Product Autocomplete in Modal */}
      <datalist id="preorder-inventory-skus-list">
        {inventoryItems.map(item => (
          <option key={item.id} value={item.id}>{item.brand ? item.brand + ' - ' : ''}{item.name} ({item.variant_spec || item.size || 'Default'})</option>
        ))}
      </datalist>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pre-Orders Manager</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage customer pre-orders, create new orders, and print customer invoices & courier slips.</p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Pre-Order</span>
        </button>
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

                        <button
                          onClick={() => handleOpenEditModal(p)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs"
                        >
                          Edit
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
                    No pre-orders recorded. Click "+ New Pre-Order" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── NEW / EDIT PRE-ORDER MODAL ── */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {editingPreorderId ? `Edit Pre-Order — ${editingPreorderId}` : 'New Pre-Order'}
              </h3>
              <button onClick={() => setIsAddEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mohamed Karim"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Customer Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 0550123456"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Notes / Instructions</label>
                <textarea
                  placeholder="Delivery timeline, batch notes..."
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                />
              </div>

              {/* Items List Builder */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Order Items List</h4>
                  <button
                    type="button"
                    onClick={() => setItemRows([...itemRows, { product_id: '', product_name: '', variant: '', flavor: '', qty: 1, unit_price: 0 }])}
                    className="text-xs font-bold text-red-700 hover:text-red-800 flex items-center gap-1"
                  >
                    + Add Item Row
                  </button>
                </div>

                <div className="space-y-2">
                  {itemRows.map((row, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Product SKU / Name</label>
                        <input
                          type="text"
                          list="preorder-inventory-skus-list"
                          placeholder="Search SKU or Name..."
                          value={row.product_name}
                          onChange={(e) => handleSelectInventoryItem(idx, e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-bold text-xs"
                        />
                      </div>

                      <div className="col-span-3">
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Variant Spec</label>
                        <input
                          type="text"
                          placeholder="2.27kg"
                          value={row.variant}
                          onChange={(e) => {
                            const next = [...itemRows];
                            next[idx].variant = e.target.value;
                            setItemRows(next);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={row.qty}
                          onChange={(e) => {
                            const next = [...itemRows];
                            next[idx].qty = parseInt(e.target.value) || 1;
                            setItemRows(next);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-bold text-xs text-center"
                        />
                      </div>

                      <div className="col-span-2 flex items-center gap-1 justify-end pt-4">
                        <span className="font-bold text-slate-900 text-xs">
                          {((row.unit_price || 0) * row.qty).toLocaleString()} DA
                        </span>
                        {itemRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setItemRows(itemRows.filter((_, i) => i !== idx))}
                            className="text-rose-600 hover:text-rose-800 p-1"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Status</label>
                <select
                  value={custStatus}
                  onChange={(e) => setCustStatus(e.target.value as PreOrder['status'])}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
                >
                  <option value="pending">Pending</option>
                  <option value="fulfilled">Fulfilled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsAddEditModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePreorderModal}
                className="px-6 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save Pre-Order</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
