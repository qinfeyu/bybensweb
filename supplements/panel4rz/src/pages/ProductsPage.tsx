import React, { useState } from 'react';
import { Product, InventoryItem, ProductVariant } from '../types';
import { Boxes, Plus, Edit3, Trash2, Search, X, Check, Link as LinkIcon, AlertTriangle } from 'lucide-react';

interface ProductsPageProps {
  products: Product[];
  inventoryItems: InventoryItem[];
  onSaveProduct: (prod: Product) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({
  products,
  inventoryItems,
  onSaveProduct,
  onDeleteProduct,
  showToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Variant Matrix Editor States
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [flavors, setFlavors] = useState<string[]>([]);
  const [flavorStockMatrix, setFlavorStockMatrix] = useState<Record<string, number>>({});

  const filteredProducts = products.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q);
  });

  const openEditor = (prod?: Product) => {
    if (prod) {
      setEditingProduct({ ...prod });
      const initialVariants = prod.variants ? JSON.parse(JSON.stringify(prod.variants)) : [];
      const initialFlavors = prod.flavors ? [...prod.flavors] : [];
      setVariants(initialVariants);
      setFlavors(initialFlavors);

      // Reconstruct matrix values from variant flavorStock
      const matrix: Record<string, number> = {};
      initialVariants.forEach((v: ProductVariant, vIdx: number) => {
        if (v.flavorStock) {
          Object.entries(v.flavorStock).forEach(([flv, qty]) => {
            matrix[`${vIdx}_${flv}`] = qty;
          });
        }
      });
      setFlavorStockMatrix(matrix);
    } else {
      setEditingProduct({
        id: `prod_${Date.now()}`,
        name: '',
        brand: '',
        stock: 0,
        status: 'active',
        allowPromo: true
      });
      setVariants([]);
      setFlavors([]);
      setFlavorStockMatrix({});
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingProduct?.name?.trim()) {
      showToast("Product name is required", "error");
      return;
    }

    // Build updated variants with flavorStock & total stock validation
    const updatedVariants: ProductVariant[] = variants.map((v, vIdx) => {
      const fStock: Record<string, number> = {};
      let varTotalStock = 0;

      if (flavors.length > 0) {
        flavors.forEach(f => {
          const qty = flavorStockMatrix[`${vIdx}_${f}`] || 0;
          fStock[f] = qty;
          varTotalStock += qty;
        });
      } else {
        varTotalStock = Number(v.stock) || 0;
      }

      // Check linked SKU stock match
      if (v.sku) {
        const inv = inventoryItems.find(x => x.id === v.sku);
        if (inv && Number(inv.stock) !== varTotalStock) {
          showToast(`Warning: SKU [${v.sku}] inventory stock (${inv.stock}) does not match variant stock (${varTotalStock})`, "error");
        }
      }

      return {
        ...v,
        stock: varTotalStock,
        flavorStock: flavors.length > 0 ? fStock : undefined
      };
    });

    const totalProductStock = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);

    const payload: Product = {
      ...(editingProduct as Product),
      variants: updatedVariants,
      flavors: flavors,
      stock: updatedVariants.length > 0 ? totalProductStock : Number(editingProduct.stock) || 0
    };

    await onSaveProduct(payload);
    setIsModalOpen(false);
    showToast("✓ Product saved successfully!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Products Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage storefront products, flavors, variant pricing & SKU linkages.</p>
        </div>

        <button
          onClick={() => openEditor()}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search catalog products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
          />
        </div>
      </div>

      {/* Product List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map(prod => (
          <div key={prod.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase">{prod.brand || 'No Brand'}</span>
                <h3 className="font-bold text-slate-900 text-base">{prod.name}</h3>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                prod.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {prod.status}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <div>
                Variants: <strong className="text-slate-900">{prod.variants?.length || 0}</strong> | Flavors: <strong className="text-slate-900">{prod.flavors?.length || 0}</strong>
              </div>
              <div className="font-extrabold text-emerald-600">
                Stock: {prod.stock}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => openEditor(prod)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete product [${prod.name}]?`)) onDeleteProduct(prod.id);
                }}
                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── EDIT / ADD PRODUCT MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingProduct?.id ? `Edit Product — ${editingProduct.name}` : 'Add Product'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Product Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700">Product Name *</label>
                  <input
                    type="text"
                    value={editingProduct?.name || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Brand</label>
                  <input
                    type="text"
                    value={editingProduct?.brand || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Variants Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">Variants</h4>
                  <button
                    onClick={() => setVariants([...variants, { weight: '', unit: 'kg', price: 0, stock: 0 }])}
                    className="text-xs font-semibold text-red-700 hover:text-red-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Add Variant
                  </button>
                </div>

                {variants.map((v, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <input
                      type="text"
                      placeholder="Weight/Label"
                      value={v.weight || v.label || ''}
                      onChange={(e) => {
                        const next = [...variants];
                        next[idx].weight = e.target.value;
                        setVariants(next);
                      }}
                      className="w-28 bg-white border border-slate-200 rounded p-1.5"
                    />
                    <input
                      type="number"
                      placeholder="Price DA"
                      value={v.price}
                      onChange={(e) => {
                        const next = [...variants];
                        next[idx].price = parseFloat(e.target.value) || 0;
                        setVariants(next);
                      }}
                      className="w-24 bg-white border border-slate-200 rounded p-1.5 font-bold"
                    />
                    {/* SKU Link Dropdown */}
                    <select
                      value={v.sku || ''}
                      onChange={(e) => {
                        const next = [...variants];
                        next[idx].sku = e.target.value;
                        setVariants(next);
                      }}
                      className="bg-white border border-slate-200 rounded p-1.5 text-xs font-semibold text-emerald-700 flex-1"
                    >
                      <option value="">-- Link to Inventory SKU --</option>
                      {inventoryItems.map(inv => (
                        <option key={inv.id} value={inv.id}>
                          [{inv.id}] {inv.brand ? inv.brand + ' - ' : ''}{inv.name} (SKU Stock: {inv.stock})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setVariants(variants.filter((_, i) => i !== idx))}
                      className="text-rose-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Flavors Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">Flavors</h4>
                  <button
                    onClick={() => setFlavors([...flavors, `Flavor ${flavors.length + 1}`])}
                    className="text-xs font-semibold text-red-700 hover:text-red-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Add Flavor
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {flavors.map((flv, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
                      <input
                        type="text"
                        value={flv}
                        onChange={(e) => {
                          const next = [...flavors];
                          next[fIdx] = e.target.value;
                          setFlavors(next);
                        }}
                        className="bg-transparent border-none font-medium focus:outline-none w-24"
                      />
                      <button onClick={() => setFlavors(flavors.filter((_, i) => i !== fIdx))} className="text-slate-400 hover:text-rose-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stock Matrix Grid */}
              {variants.length > 0 && flavors.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">Stock per Variant & Flavor</h4>
                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 font-bold text-slate-600">
                        <tr>
                          <th className="p-2.5">Variant</th>
                          {flavors.map((f, i) => (
                            <th key={i} className="p-2.5 text-center">{f}</th>
                          ))}
                          <th className="p-2.5 text-center">Row Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {variants.map((v, vIdx) => {
                          const rowTotal = flavors.reduce((s, f) => s + (flavorStockMatrix[`${vIdx}_${f}`] || 0), 0);
                          const linkedInv = v.sku ? inventoryItems.find(x => x.id === v.sku) : null;

                          return (
                            <tr key={vIdx}>
                              <td className="p-2.5 font-bold">
                                {v.weight || `Variant ${vIdx + 1}`}
                                {linkedInv && (
                                  <div className="text-[10px] text-emerald-600 font-semibold">SKU Stock: {linkedInv.stock}</div>
                                )}
                              </td>
                              {flavors.map((f, fIdx) => (
                                <td key={fIdx} className="p-2 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={flavorStockMatrix[`${vIdx}_${f}`] || 0}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 0;
                                      setFlavorStockMatrix({
                                        ...flavorStockMatrix,
                                        [`${vIdx}_${f}`]: val
                                      });
                                    }}
                                    className="w-14 text-center bg-slate-50 border border-slate-200 rounded p-1 text-xs font-bold"
                                  />
                                </td>
                              ))}
                              <td className="p-2.5 text-center font-black text-slate-900">{rowTotal}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white font-semibold text-xs rounded-xl shadow-sm"
                >
                  Save Product
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
