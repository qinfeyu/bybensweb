import React, { useState } from 'react';
import { Product, InventoryItem, Order, Customer } from '../types';
import { Store, Search, ShoppingCart, Plus, Minus, Trash2, CheckCircle2, User, Phone, Tag, Boxes, Receipt, Clock, CreditCard } from 'lucide-react';

interface PosCartItem {
  productId: string;
  name: string;
  variantIndex: number;
  variant: string;
  flavor: string;
  price: number;
  qty: number;
}

interface PosPageProps {
  products: Product[];
  inventoryItems: InventoryItem[];
  customers?: Customer[];
  onCompleteSale: (saleData: {
    cart: PosCartItem[];
    customerName: string;
    customerPhone: string;
    discount: number;
    subtotal: number;
    totalAmount: number;
    paymentStatus?: 'paid' | 'unpaid';
  }) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// Helpers for safe type normalization
const getFlavorName = (f: any): string => {
  if (!f) return '';
  if (typeof f === 'string') return f;
  if (typeof f === 'object' && f.name) return String(f.name);
  return String(f);
};

const getVariantLabel = (v: any, index: number): string => {
  if (!v) return `Option ${index + 1}`;
  if (typeof v === 'string') return v;
  if (v.label) return String(v.label);
  if (v.weight) return `${v.weight}${v.unit || ''}`;
  if (v.name) return String(v.name);
  if (v.sku) return String(v.sku);
  return `Option ${index + 1}`;
};

export const PosPage: React.FC<PosPageProps> = ({
  products,
  inventoryItems,
  customers = [],
  onCompleteSale,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'products' | 'inventory'>('products');
  const [mobilePosView, setMobilePosView] = useState<'catalog' | 'cart'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [custSearchQuery, setCustSearchQuery] = useState('');
  const [isCustDropdownOpen, setIsCustDropdownOpen] = useState(false);

  const allCustomersList = customers || [];

  // Modal Selection State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number>(0);
  const [selectedFlavor, setSelectedFlavor] = useState<string>('');

  // Filter Catalog Products
  const filteredProducts = products.filter(p => {
    if (p.status !== 'active') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q);
  });

  // Filter Inventory SKUs
  const filteredInventory = inventoryItems.filter(i => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return i.id.toLowerCase().includes(q) || i.name.toLowerCase().includes(q) || (i.brand || '').toLowerCase().includes(q);
  });

  // Open Modal for Catalog Product
  const handleOpenProductModal = (p: Product) => {
    setSelectedProduct(p);
    setSelectedVariantIdx(0);
    const rawFlavors = p.flavors || [];
    setSelectedFlavor(rawFlavors.length > 0 ? getFlavorName(rawFlavors[0]) : '');
  };

  // Add Item to Cart from Modal
  const handleAddToCartFromModal = () => {
    if (!selectedProduct) return;

    const variants = selectedProduct.variants || [];
    const v = variants[selectedVariantIdx] || {};
    const price = Number(v.price) || Number(selectedProduct.variants?.[0]?.price) || 0;
    const variantLabel = getVariantLabel(v, selectedVariantIdx);

    const existingIdx = cart.findIndex(
      c => c.productId === selectedProduct.id && c.variantIndex === selectedVariantIdx && c.flavor === selectedFlavor
    );

    if (existingIdx >= 0) {
      const nextCart = [...cart];
      nextCart[existingIdx].qty += 1;
      setCart(nextCart);
    } else {
      setCart([
        ...cart,
        {
          productId: selectedProduct.id,
          name: `${selectedProduct.brand ? selectedProduct.brand + ' - ' : ''}${selectedProduct.name}`,
          variantIndex: selectedVariantIdx,
          variant: variantLabel,
          flavor: selectedFlavor,
          price,
          qty: 1
        }
      ]);
    }

    setSelectedProduct(null);
    showToast(`✓ Added ${selectedProduct.name} to cart`);
  };

  // Add Inventory Item directly to Cart
  const handleAddInventoryToCart = (item: InventoryItem) => {
    const existingIdx = cart.findIndex(c => c.productId === item.id);
    const price = Number(item.retail_dzd) || 0;

    if (existingIdx >= 0) {
      const nextCart = [...cart];
      nextCart[existingIdx].qty += 1;
      setCart(nextCart);
    } else {
      setCart([
        ...cart,
        {
          productId: item.id,
          name: `${item.brand ? item.brand + ' - ' : ''}${item.name}`,
          variantIndex: 0,
          variant: item.variant_spec || item.size || 'Standard',
          flavor: '',
          price,
          qty: 1
        }
      ]);
    }
    showToast(`✓ Added ${item.name} to cart`);
  };

  const updateCartQty = (idx: number, delta: number) => {
    const nextCart = [...cart];
    nextCart[idx].qty += delta;
    if (nextCart[idx].qty <= 0) {
      setCart(nextCart.filter((_, i) => i !== idx));
    } else {
      setCart(nextCart);
    }
  };

  const subtotal = cart.reduce((s, item) => s + (item.price * item.qty), 0);
  const totalAmount = Math.max(0, subtotal - discount);

  // Print POS Receipt Window
  const printPosReceipt = (saleData: {
    cart: PosCartItem[];
    customerName: string;
    customerPhone: string;
    subtotal: number;
    discount: number;
    totalAmount: number;
    orderId: string;
    paymentStatus?: 'paid' | 'unpaid';
  }) => {
    const printWin = window.open('', '_blank', 'width=400,height=600');
    if (!printWin) return;

    const itemsHtml = saleData.cart.map((item, idx) => `
      <tr style="border-bottom: 1px dashed #e2e8f0;">
        <td style="padding: 6px 0;">
          <div style="font-weight: 700; color: #0f172a; font-size: 12px;">${item.name}</div>
          <div style="font-size: 10px; color: #64748b;">${[item.variant, item.flavor].filter(Boolean).join(' | ')}</div>
          <div style="font-size: 11px; color: #475569;">${item.qty} × ${item.price.toLocaleString()} DA</div>
        </td>
        <td style="text-align: right; font-weight: 700; vertical-align: top; padding-top: 6px;">
          ${(item.price * item.qty).toLocaleString()} DA
        </td>
      </tr>
    `).join('');

    const debtBanner = saleData.paymentStatus === 'unpaid' ? `
      <div style="margin: 10px 0; padding: 8px; background: #fef3c7; border: 1.5px dashed #d97706; color: #92400e; text-align: center; font-weight: 800; font-size: 11px; border-radius: 6px;">
        ⚠️ PAYMENT STATUS: UNPAID / DEBT (BUY NOW PAY LATER)
      </div>
    ` : '';

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>POS Receipt - ${saleData.orderId}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
          body { font-family: 'Inter', sans-serif; padding: 20px; margin: 0; background: #fff; font-size: 12px; color: #0f172a; }
          .receipt { max-width: 320px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; }
          .header { text-align: center; border-bottom: 1.5px dashed #cbd5e1; padding-bottom: 12px; margin-bottom: 12px; }
          .brand { font-size: 18px; font-weight: 900; color: #b91c1c; }
          .info { font-size: 10px; color: #64748b; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          .totals { border-top: 1.5px dashed #cbd5e1; padding-top: 8px; font-size: 11px; }
          .totals div { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .grand-total { font-size: 15px; font-weight: 900; color: #b91c1c; border-top: 1px solid #0f172a; padding-top: 6px; margin-top: 4px; }
          .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 16px; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
          .btn-print { width: 100%; padding: 10px; bg: #0f172a; color: white; border: none; border-radius: 8px; font-weight: bold; margin-bottom: 12px; cursor: pointer; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button class="btn-print" style="background:#0f172a; color:white; padding:8px; border-radius:6px; font-weight:bold; width:100%; cursor:pointer;" onclick="window.print()">Print Ticket</button>
        </div>
        <div class="receipt">
          <div class="header">
            <div class="brand">BYBENS NUTRITION</div>
            <div class="info">Sports Nutrition & Supplements</div>
            <div class="info" style="margin-top: 4px;">Ticket: #${saleData.orderId}</div>
            <div class="info">Date: ${new Date().toLocaleString('fr-DZ')}</div>
            <div class="info">Customer: ${saleData.customerName} (${saleData.customerPhone})</div>
          </div>
          ${debtBanner}
          <table>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="totals">
            <div><span>Subtotal:</span><strong>${saleData.subtotal.toLocaleString()} DA</strong></div>
            ${saleData.discount > 0 ? `<div><span>Discount:</span><strong style="color:#b91c1c;">-${saleData.discount.toLocaleString()} DA</strong></div>` : ''}
            <div class="grand-total"><span>TOTAL:</span><span>${saleData.totalAmount.toLocaleString()} DA</span></div>
          </div>
          <div class="footer">
            Thank you for shopping with ByBens!<br>
            www.bybens.com
          </div>
        </div>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('paid');

  const handleCheckout = async () => {
    if (!cart.length) {
      showToast("Cart is empty!", "error");
      return;
    }

    const currentCart = [...cart];
    const cName = customerName.trim() || 'Walk-in Customer';
    const cPhone = customerPhone.trim() || '0000000000';
    const orderId = `POS-${Date.now()}`;

    try {
      await onCompleteSale({
        cart: currentCart,
        customerName: cName,
        customerPhone: cPhone,
        discount,
        subtotal,
        totalAmount,
        paymentStatus
      });

      // Print POS receipt ticket
      printPosReceipt({
        cart: currentCart,
        customerName: cName,
        customerPhone: cPhone,
        subtotal,
        discount,
        totalAmount,
        orderId,
        paymentStatus
      });

      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscount(0);
      setPaymentStatus('paid');
      if (paymentStatus === 'unpaid') {
        showToast(`✓ Unpaid Sale recorded! Added to Unpaid & Credit tab.`, 'info');
      } else {
        showToast(`✓ POS Sale completed! Total: ${totalAmount.toLocaleString()} DA`);
      }
    } catch(e: any) {
      showToast("Error processing sale", "error");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)] min-h-[600px]">
      {/* Left: Product Selector (2 cols) */}
      <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col space-y-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tab Selection: Catalog vs Inventory SKUs */}
          <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'products' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-red-700" />
              <span>Catalog Products</span>
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'inventory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Boxes className="w-3.5 h-3.5 text-blue-700" />
              <span>Inventory SKUs</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={activeTab === 'products' ? 'Search product catalog...' : 'Search inventory SKU...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
            />
          </div>
        </div>

        {/* Catalog Products Grid */}
        {activeTab === 'products' && (
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 pr-1">
            {filteredProducts.map(p => {
              const firstPrice = p.variants?.[0]?.price ? Number(p.variants[0].price) : 0;

              return (
                <div
                  key={p.id}
                  onClick={() => handleOpenProductModal(p)}
                  className="bg-slate-50 hover:bg-red-50/50 border border-slate-200 hover:border-red-300 p-3.5 rounded-xl cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{p.brand || 'No Brand'}</span>
                    <h4 className="font-bold text-slate-900 text-xs line-clamp-2 mt-0.5 group-hover:text-red-700">{p.name}</h4>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">
                      {firstPrice > 0 ? `${firstPrice.toLocaleString()} DA` : 'Select Price'}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Stock: {p.stock}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Inventory SKUs Grid */}
        {activeTab === 'inventory' && (
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 pr-1">
            {filteredInventory.map(item => (
              <div
                key={item.id}
                onClick={() => handleAddInventoryToCart(item)}
                className="bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 p-3.5 rounded-xl cursor-pointer transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-700 uppercase">{item.id}</span>
                    <span className="text-[10px] font-bold text-slate-400">{item.brand}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs line-clamp-2 mt-1 group-hover:text-blue-700">{item.name}</h4>
                  <div className="text-[10px] text-slate-500 mt-0.5">{item.variant_spec || item.size || 'Standard'}</div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900">
                    {item.retail_dzd ? `${item.retail_dzd.toLocaleString()} DA` : '0 DA'}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Stock: {item.stock}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Cart & Checkout (1 col) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              <span>Current Cart</span>
            </h3>
            <span className="text-xs font-bold text-slate-400">{cart.length} item(s)</span>
          </div>

          {/* Cart Items List */}
          <div className="mt-3 max-h-60 overflow-y-auto space-y-2.5 pr-1 divide-y divide-slate-100">
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Cart is empty. Click a product on the left to add items.
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="pt-2 flex items-center justify-between text-xs">
                  <div className="flex-1 pr-2">
                    <div className="font-bold text-slate-900">{item.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {item.variant} {item.flavor ? `(${item.flavor})` : ''} — {item.price.toLocaleString()} DA
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                      <button onClick={() => updateCartQty(idx, -1)} className="p-1 hover:bg-slate-200"><Minus className="w-3 h-3 text-slate-600" /></button>
                      <span className="px-2 font-bold text-slate-900 text-xs">{item.qty}</span>
                      <button onClick={() => updateCartQty(idx, 1)} className="p-1 hover:bg-slate-200"><Plus className="w-3 h-3 text-slate-600" /></button>
                    </div>
                    <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-rose-600 hover:text-rose-800 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Customer & Total Controls */}
        <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
          {/* Select Customer (Public & Private) Real-time Autocomplete */}
          <div className="relative">
            <label className="font-semibold text-slate-600 flex items-center justify-between">
              <span>Select Customer (Public & Private)</span>
              <span className="text-[10px] text-slate-400 font-bold">👥 All Clients ({allCustomersList.length})</span>
            </label>
            <div className="relative mt-1">
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Type customer name or phone..."
                value={custSearchQuery}
                onFocus={() => setIsCustDropdownOpen(true)}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustSearchQuery(val);
                  setCustomerName(val);
                  setIsCustDropdownOpen(true);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
              />
            </div>

            {/* Real-time Floating Dropdown List */}
            {isCustDropdownOpen && custSearchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95">
                {allCustomersList.filter(c => {
                  const q = custSearchQuery.toLowerCase().trim();
                  const fullName = `${c.name || ''} ${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
                  const phone = c.phone || '';
                  return fullName.includes(q) || phone.includes(q);
                }).length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-[11px]">
                    No customer found for "{custSearchQuery}"
                  </div>
                ) : (
                  allCustomersList.filter(c => {
                    const q = custSearchQuery.toLowerCase().trim();
                    const fullName = `${c.name || ''} ${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
                    const phone = c.phone || '';
                    return fullName.includes(q) || phone.includes(q);
                  }).map(c => {
                    const nameStr = c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Customer';
                    const groupStr = (c.group || c.group_type || 'public').toUpperCase();

                    return (
                      <div
                        key={c.id || c.phone}
                        onClick={() => {
                          setCustomerName(nameStr);
                          setCustomerPhone(c.phone || '');
                          setCustSearchQuery(nameStr);
                          setIsCustDropdownOpen(false);
                        }}
                        className="p-2.5 hover:bg-red-50/60 cursor-pointer transition-colors flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{nameStr}</span>
                            <span className="text-[9px] font-extrabold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                              {groupStr}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {c.wilaya ? `${c.wilaya} - ${c.commune || ''}` : 'Registered Customer'}
                          </div>
                        </div>
                        <span className="font-bold text-red-700 text-[11px] bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                          📞 {c.phone || 'No phone'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-slate-600">Customer Name</label>
              <input
                type="text"
                placeholder="Walk-in Customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600">Phone</label>
              <input
                type="text"
                placeholder="0550000000"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs"
              />
            </div>
          </div>

          {/* Payment Status Selector */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600 flex items-center justify-between text-xs">
              <span>Payment Option</span>
              {paymentStatus === 'unpaid' && (
                <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-md border border-amber-200">
                  ⏳ Buy Now, Pay Later
                </span>
              )}
            </label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <button
                type="button"
                onClick={() => setPaymentStatus('paid')}
                className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  paymentStatus === 'paid'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Paid Now</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentStatus('unpaid')}
                className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  paymentStatus === 'unpaid'
                    ? 'bg-amber-50 border-amber-300 text-amber-800 ring-2 ring-amber-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Pay Later (Unpaid)</span>
              </button>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-600">Discount (DA)</label>
            <input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="font-bold">{subtotal.toLocaleString()} DA</span>
            </div>
            <div className="flex justify-between text-slate-900 font-black text-sm pt-1 border-t border-slate-200">
              <span>Total Payable</span>
              <span>{totalAmount.toLocaleString()} DA</span>
            </div>
          </div>

          <button
            disabled={!cart.length}
            onClick={handleCheckout}
            className={`w-full text-white font-bold text-xs py-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 ${
              paymentStatus === 'unpaid'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {paymentStatus === 'unpaid' ? <Clock className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
            <span>{paymentStatus === 'unpaid' ? 'Record Unpaid Sale (Credit)' : 'Complete Sale & Print Ticket'}</span>
          </button>
        </div>
      </div>

      {/* ── VARIANT & FLAVOR SELECTOR MODAL ── */}
      {selectedProduct && (() => {
        const pImgs = Array.isArray(selectedProduct.imageUrl) ? selectedProduct.imageUrl : (selectedProduct.imageUrl ? [selectedProduct.imageUrl] : []);
        const vImgIdx = selectedProduct.variants?.[selectedVariantIdx]?.imageIndex;
        const linkedFlavorImg = selectedProduct.flavorImages?.[selectedFlavor];
        const displayImg = linkedFlavorImg || (vImgIdx !== undefined ? pImgs[vImgIdx] : pImgs[0]);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3">
                {displayImg && (
                  <div className="w-14 h-14 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden shrink-0 shadow-2xs">
                    <img src={displayImg} alt={selectedProduct.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedProduct.name}</h3>
                  {selectedFlavor && (
                    <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                      Picture: {selectedFlavor}
                    </span>
                  )}
                </div>
              </div>

            {/* Variant Selector */}
            {selectedProduct.variants && selectedProduct.variants.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-700">Select Variant</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {selectedProduct.variants.map((v, vIdx) => {
                    const price = Number(v.price) || 0;
                    const label = getVariantLabel(v, vIdx);

                    return (
                      <button
                        key={vIdx}
                        onClick={() => setSelectedVariantIdx(vIdx)}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                          selectedVariantIdx === vIdx ? 'bg-red-50 border-red-300 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div>{label}</div>
                        <div className="text-[11px] text-slate-500 font-normal">{price ? `${price.toLocaleString()} DA` : '—'}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Flavor Selector */}
            {selectedProduct.flavors && selectedProduct.flavors.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-700">Select Flavor</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {selectedProduct.flavors.map((f, fIdx) => {
                    const flavorName = getFlavorName(f);
                    if (!flavorName) return null;

                    return (
                      <button
                        key={fIdx}
                        onClick={() => setSelectedFlavor(flavorName)}
                        className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                          selectedFlavor === flavorName ? 'bg-red-50 border-red-300 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        {flavorName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setSelectedProduct(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl">
                Cancel
              </button>
              <button onClick={handleAddToCartFromModal} className="px-5 py-2 bg-red-700 text-white font-semibold text-xs rounded-xl shadow-sm">
                Add to Cart
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};
