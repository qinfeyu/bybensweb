import React, { useState } from 'react';
import { Product, InventoryItem, Order } from '../types';
import { Store, Search, ShoppingCart, Plus, Minus, Trash2, CheckCircle2, User, Phone, Tag } from 'lucide-react';

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
  onCompleteSale: (saleData: {
    cart: PosCartItem[];
    customerName: string;
    customerPhone: string;
    discount: number;
    subtotal: number;
    totalAmount: number;
  }) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PosPage: React.FC<PosPageProps> = ({
  products,
  inventoryItems,
  onCompleteSale,
  showToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState<number>(0);

  // Variant Selection State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number>(0);
  const [selectedFlavor, setSelectedFlavor] = useState<string>('');

  const filteredProducts = products.filter(p => {
    if (p.status !== 'active') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q);
  });

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const variants = selectedProduct.variants || [];
    const v = variants[selectedVariantIdx] || { weight: 'Standard', price: 0 };
    const price = Number(v.price) || 0;

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
          variant: v.weight ? `${v.weight}${v.unit || ''}` : (v.label || v.name || 'Standard'),
          flavor: selectedFlavor,
          price,
          qty: 1
        }
      ]);
    }

    setSelectedProduct(null);
    showToast(`✓ Added ${selectedProduct.name} to cart`);
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

  const handleCheckout = async () => {
    if (!cart.length) {
      showToast("Cart is empty!", "error");
      return;
    }

    await onCompleteSale({
      cart,
      customerName,
      customerPhone,
      discount,
      subtotal,
      totalAmount
    });

    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscount(0);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)] min-h-[600px]">
      {/* Left: Product Selector (2 cols) */}
      <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col space-y-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Store className="w-5 h-5 text-red-700" />
            <span>POS Product Grid</span>
          </h2>

          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
            />
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 pr-1">
          {filteredProducts.map(p => (
            <div
              key={p.id}
              onClick={() => {
                setSelectedProduct(p);
                setSelectedVariantIdx(0);
                setSelectedFlavor(p.flavors?.[0] || '');
              }}
              className="bg-slate-50 hover:bg-red-50/50 border border-slate-200 hover:border-red-300 p-3.5 rounded-xl cursor-pointer transition-all flex flex-col justify-between group"
            >
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{p.brand || 'No Brand'}</span>
                <h4 className="font-bold text-slate-900 text-xs line-clamp-2 mt-0.5 group-hover:text-red-700">{p.name}</h4>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-black text-slate-900">
                  {p.variants?.[0]?.price ? `${p.variants[0].price.toLocaleString()} DA` : 'Set Variant'}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Stock: {p.stock}
                </span>
              </div>
            </div>
          ))}
        </div>
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
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl shadow-sm transition-all"
          >
            ✅ Complete Sale & Print Receipt
          </button>
        </div>
      </div>

      {/* ── VARIANT & FLAVOR SELECTOR MODAL ── */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">{selectedProduct.name}</h3>

            {/* Variant Selector */}
            {selectedProduct.variants && selectedProduct.variants.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-700">Select Variant</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {selectedProduct.variants.map((v, vIdx) => (
                    <button
                      key={vIdx}
                      onClick={() => setSelectedVariantIdx(vIdx)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                        selectedVariantIdx === vIdx ? 'bg-red-50 border-red-300 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div>{v.weight ? `${v.weight}${v.unit || ''}` : (v.label || `Option ${vIdx + 1}`)}</div>
                      <div className="text-[11px] text-slate-500 font-normal">{v.price.toLocaleString()} DA</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Flavor Selector */}
            {selectedProduct.flavors && selectedProduct.flavors.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-700">Select Flavor</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {selectedProduct.flavors.map((f, fIdx) => (
                    <button
                      key={fIdx}
                      onClick={() => setSelectedFlavor(f)}
                      className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                        selectedFlavor === f ? 'bg-red-50 border-red-300 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setSelectedProduct(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl">
                Cancel
              </button>
              <button onClick={handleAddToCart} className="px-5 py-2 bg-red-700 text-white font-semibold text-xs rounded-xl shadow-sm">
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
