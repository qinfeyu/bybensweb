import React, { useState, useEffect } from 'react';
import { Product, InventoryItem, BundleConfig, BundleItem } from '../types';
import { Package, Search, Plus, Minus, Trash2, Check, Save, X, Globe, Sparkles, AlertCircle, Tag, Calculator, Layers, Boxes } from 'lucide-react';

interface BundlePageProps {
  products: Product[];
  inventoryItems: InventoryItem[];
  bundleConfig: BundleConfig | null;
  onSaveBundle: (bundle: BundleConfig, bundleProductData?: Partial<Product>) => Promise<void>;
  onSaveProduct?: (product: Partial<Product>) => Promise<void>;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const BundlePage: React.FC<BundlePageProps> = ({
  products,
  inventoryItems,
  bundleConfig,
  onSaveBundle,
  onSaveProduct,
  showToast
}) => {
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const [bundleName, setBundleName] = useState('Featured Supplement Pack');
  const [bundleBrand, setBundleBrand] = useState('BYBENS Pack');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Included SKUs inside this Bundle
  const [bundleItemsList, setBundleItemsList] = useState<BundleItem[]>([]);
  const [overridePrice, setOverridePrice] = useState<number | ''>('');
  const [bundleDiscount, setBundleDiscount] = useState<number>(0);

  // Multilingual Content
  const [titleEn, setTitleEn] = useState('');
  const [titleFr, setTitleFr] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionFr, setDescriptionFr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');

  const [activeLangTab, setActiveLangTab] = useState<'en' | 'fr' | 'ar'>('en');
  const [isSaving, setIsSaving] = useState(false);

  // Build searchable SKU list combining Inventory Items & Product Variants
  const availableSkus = React.useMemo(() => {
    const list: Array<{
      sku: string;
      productId: string;
      name: string;
      brand: string;
      variantLabel: string;
      flavor: string;
      price: number;
      stock: number;
      imageUrl?: string;
    }> = [];

    // 1. SKUs from Inventory Items
    inventoryItems.forEach(item => {
      list.push({
        sku: item.id,
        productId: item.id,
        name: item.name,
        brand: item.brand || 'BYBENS',
        variantLabel: item.variant_spec || item.size || 'Standard',
        flavor: '',
        price: Number(item.retail_dzd) || 0,
        stock: Number(item.stock) || 0,
      });
    });

    // 2. SKUs from Product Catalog Variants
    products.forEach(p => {
      const pName = p.name;
      const pBrand = p.brand || '';
      const pImg = Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl;

      if (p.variants && p.variants.length > 0) {
        p.variants.forEach((v: any, vIdx: number) => {
          const vLabel = v.label || v.weight || `Option ${vIdx + 1}`;
          const vPrice = Number(v.price) || 0;
          const vSku = v.sku || `SKU-${p.id}-${vIdx}`;

          // Check if variant has flavor stock / flavor SKUs
          if (v.flavorStock && Object.keys(v.flavorStock).length > 0) {
            Object.entries(v.flavorStock).forEach(([flName, flStock]) => {
              const flSku = v.flavorSkus && v.flavorSkus[flName] ? v.flavorSkus[flName] : vSku;
              list.push({
                sku: flSku,
                productId: p.id,
                name: pName,
                brand: pBrand,
                variantLabel: vLabel,
                flavor: flName,
                price: vPrice,
                stock: Number(flStock) || 0,
                imageUrl: pImg
              });
            });
          } else {
            list.push({
              sku: vSku,
              productId: p.id,
              name: pName,
              brand: pBrand,
              variantLabel: vLabel,
              flavor: '',
              price: vPrice,
              stock: Number(v.stock) || 0,
              imageUrl: pImg
            });
          }
        });
      }
    });

    // Deduplicate by SKU ID
    const uniqueMap = new Map();
    list.forEach(i => {
      if (i.sku && !uniqueMap.has(i.sku.toLowerCase())) {
        uniqueMap.set(i.sku.toLowerCase(), i);
      }
    });

    return Array.from(uniqueMap.values());
  }, [inventoryItems, products]);

  // Load existing bundle config
  useEffect(() => {
    if (bundleConfig) {
      setSelectedProductId(bundleConfig.bundleId || '');
      setTitleEn(bundleConfig.titleEn || '');
      setTitleFr(bundleConfig.titleFr || '');
      setTitleAr(bundleConfig.titleAr || '');
      setDescriptionEn(bundleConfig.descriptionEn || '');
      setDescriptionFr(bundleConfig.descriptionFr || '');
      setDescriptionAr(bundleConfig.descriptionAr || '');

      // Load existing product if linked
      if (bundleConfig.bundleId) {
        const existingProd = products.find(p => p.id === bundleConfig.bundleId);
        if (existingProd) {
          setBundleName(existingProd.name);
          setBundleBrand(existingProd.brand || 'BYBENS Pack');
          if (existingProd.bundleItems && existingProd.bundleItems.length > 0) {
            setBundleItemsList(existingProd.bundleItems);
          }
          if (existingProd.variants && existingProd.variants.length > 0) {
            setOverridePrice(existingProd.variants[0].price);
          }
        }
      }
    }
  }, [bundleConfig, products]);

  // Filter available SKUs by search query
  const filteredSkus = availableSkus.filter(item => {
    if (!skuSearchQuery.trim()) return true;
    const q = skuSearchQuery.toLowerCase().trim();
    return (
      item.sku.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q) ||
      item.variantLabel.toLowerCase().includes(q) ||
      item.flavor.toLowerCase().includes(q)
    );
  });

  // Calculate sum total price of included items
  const autoCalculatedPrice = bundleItemsList.reduce((sum, item) => sum + (Number(item.price || 0) * (Number(item.qty) || 1)), 0);

  // Final Price (either override price or auto-calculated sum with discount)
  const finalBundlePrice = overridePrice !== '' ? Number(overridePrice) : Math.max(0, autoCalculatedPrice * (1 - (bundleDiscount / 100)));

  // Calculate available bundle stock (minimum across all included SKUs)
  const calculatedBundleStock = bundleItemsList.length > 0
    ? Math.min(
        ...bundleItemsList.map(bItem => {
          const match = availableSkus.find(s => s.sku.toLowerCase() === (bItem.sku || bItem.productId || '').toLowerCase());
          const availStock = match ? match.stock : 0;
          return Math.floor(availStock / (bItem.qty || 1));
        })
      )
    : 0;

  // Add SKU to Bundle Items list
  const handleAddSkuToBundle = (skuItem: typeof availableSkus[0]) => {
    setBundleItemsList(prev => {
      const existingIdx = prev.findIndex(i => (i.sku || i.productId)?.toLowerCase() === skuItem.sku.toLowerCase());
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          qty: (next[existingIdx].qty || 1) + 1
        };
        return next;
      }
      return [
        ...prev,
        {
          sku: skuItem.sku,
          productId: skuItem.productId,
          name: skuItem.name,
          brand: skuItem.brand,
          variant: skuItem.variantLabel,
          flavor: skuItem.flavor,
          price: skuItem.price,
          qty: 1
        }
      ];
    });
  };

  const handleUpdateItemQty = (idx: number, delta: number) => {
    setBundleItemsList(prev => {
      const next = [...prev];
      const newQty = (next[idx].qty || 1) + delta;
      if (newQty <= 0) {
        return next.filter((_, i) => i !== idx);
      }
      next[idx] = { ...next[idx], qty: newQty };
      return next;
    });
  };

  const handleRemoveBundleItem = (idx: number) => {
    setBundleItemsList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bundleItemsList.length < 2) {
      if (!confirm("A bundle usually consists of 2 or more products. Do you want to proceed saving with current items?")) {
        return;
      }
    }

    setIsSaving(true);
    try {
      const bProdId = selectedProductId || `bundle_${Date.now()}`;
      
      // Save or update the Bundle Product in the Catalog
      const bundleProductPayload: Partial<Product> = {
        id: bProdId,
        name: bundleName.trim() || 'Featured Bundle Pack',
        brand: bundleBrand.trim() || 'BYBENS Pack',
        description: descriptionEn || titleEn || 'Special Bundle Offer',
        status: 'active',
        stock: calculatedBundleStock > 0 ? calculatedBundleStock : 10,
        bundleItems: bundleItemsList,
        variants: [
          {
            name: 'Standard Pack',
            label: `${bundleItemsList.length} Items Pack`,
            price: finalBundlePrice,
            stock: calculatedBundleStock > 0 ? calculatedBundleStock : 10,
            sku: `BDL-${bProdId}`
          }
        ]
      };

      if (onSaveProduct) {
        await onSaveProduct(bundleProductPayload);
      }

      // Save Bundle Config for Featured Section
      await onSaveBundle(
        {
          id: bundleConfig?.id || 1,
          bundleId: bProdId,
          titleEn: titleEn.trim() || bundleName.trim(),
          titleFr: titleFr.trim(),
          titleAr: titleAr.trim(),
          descriptionEn: descriptionEn.trim(),
          descriptionFr: descriptionFr.trim(),
          descriptionAr: descriptionAr.trim(),
        },
        bundleProductPayload
      );

      setSelectedProductId(bProdId);
      if (showToast) showToast('✓ Bundle Pack saved successfully with auto-calculated prices and stock tracking!');
    } catch (err: any) {
      if (showToast) showToast('Error saving bundle: ' + (err.message || err), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-500" />
            <span>Bundle & Pack Builder</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Build multi-product bundles (2+ SKUs). Auto-calculate total price, set included quantities, and automatically deduct SKU stock on orders.</p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50 shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving Bundle...' : 'Save Bundle & Update Storefront'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: SKU Search & Pick Items (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Search className="w-4 h-4 text-red-600" />
                <span>Search & Add SKUs / Products</span>
              </h2>
              <span className="text-[11px] font-bold text-slate-400">
                {availableSkus.length} SKUs Available
              </span>
            </div>

            {/* SKU Search Box */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by SKU ID (e.g. SUP-8801), Product Name, or Brand..."
                value={skuSearchQuery}
                onChange={(e) => setSkuSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
              />
            </div>

            {/* Available SKUs List */}
            <div className="max-h-[480px] overflow-y-auto thin-scrollbar divide-y divide-slate-100 pr-1">
              {filteredSkus.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No SKUs or products found matching "{skuSearchQuery}".
                </div>
              ) : (
                filteredSkus.map((item, idx) => {
                  const isAdded = bundleItemsList.some(b => (b.sku || b.productId)?.toLowerCase() === item.sku.toLowerCase());

                  return (
                    <div
                      key={idx}
                      className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="" className="w-full h-full object-contain p-1" />
                          ) : (
                            <Boxes className="w-5 h-5 text-slate-400" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-[11px] text-red-700 bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
                              {item.sku}
                            </span>
                            <span className="font-bold text-slate-900 truncate">{item.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                            {item.brand} {item.variantLabel ? `· ${item.variantLabel}` : ''} {item.flavor ? `· (${item.flavor})` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="font-black text-slate-900 block">{item.price.toLocaleString()} DA</span>
                          <span className={`text-[10px] font-bold ${item.stock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            Stock: {item.stock}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddSkuToBundle(item)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                            isAdded
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-red-600 text-white hover:bg-red-700 shadow-xs'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isAdded ? 'Add More' : 'Add to Pack'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Included Items + Price & Multilingual Editor (6 Cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Bundle Items Composition Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" />
                <span>Bundle Composition ({bundleItemsList.length} SKUs Included)</span>
              </h3>
              <span className="text-[11px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Bundle Stock: {calculatedBundleStock} Available
              </span>
            </div>

            {/* Bundle Items Table */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto thin-scrollbar pr-1 divide-y divide-slate-100">
              {bundleItemsList.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  No SKUs added yet. Search and click "Add to Pack" on the left to combine 2 or more products into this bundle.
                </div>
              ) : (
                bundleItemsList.map((item, idx) => {
                  const itemSubtotal = (Number(item.price) || 0) * (Number(item.qty) || 1);

                  return (
                    <div key={idx} className="pt-2 flex items-center justify-between text-xs">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-[10px] text-red-700 bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
                            {item.sku || item.productId}
                          </span>
                          <span className="font-bold text-slate-900 truncate">{item.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {item.variant ? item.variant : ''} {item.flavor ? `(${item.flavor})` : ''} · {Number(item.price || 0).toLocaleString()} DA each
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Qty Counter */}
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(idx, -1)}
                            className="p-1 hover:bg-slate-200 text-slate-600"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 font-black text-slate-900 text-xs">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(idx, 1)}
                            className="p-1 hover:bg-slate-200 text-slate-600"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Item Subtotal */}
                        <span className="font-extrabold text-slate-900 w-20 text-right">
                          {itemSubtotal.toLocaleString()} DA
                        </span>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => handleRemoveBundleItem(idx)}
                          className="p-1 text-rose-600 hover:text-rose-800 rounded transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Price Calculations Summary */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Calculated Sum (Individual SKUs Total):</span>
                <strong className="font-bold text-slate-900">{autoCalculatedPrice.toLocaleString()} DA</strong>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200/60">
                <label className="font-bold text-slate-700 flex items-center gap-1">
                  <Calculator className="w-3.5 h-3.5 text-amber-500" />
                  <span>Final Bundle Price (DA):</span>
                </label>
                <div className="w-36">
                  <input
                    type="number"
                    min="0"
                    placeholder={`${autoCalculatedPrice} DA`}
                    value={overridePrice}
                    onChange={(e) => setOverridePrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-black text-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20 text-right"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>Effective Savings / Discount:</span>
                <span className="font-bold text-emerald-600">
                  {autoCalculatedPrice > finalBundlePrice
                    ? `Save ${(autoCalculatedPrice - finalBundlePrice).toLocaleString()} DA (${Math.round(((autoCalculatedPrice - finalBundlePrice) / autoCalculatedPrice) * 100)}% OFF)`
                    : 'Standard Price'}
                </span>
              </div>
            </div>
          </div>

          {/* Multilingual Title & Description Editor */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-indigo-500" />
                <span>Featured Pack Storefront Content</span>
              </h3>

              {/* Language Tabs */}
              <div className="flex p-0.5 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveLangTab('en')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    activeLangTab === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  EN 🇬🇧
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLangTab('fr')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    activeLangTab === 'fr' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  FR 🇫🇷
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLangTab('ar')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    activeLangTab === 'ar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  AR 🇩🇿
                </button>
              </div>
            </div>

            {/* Language Content Inputs */}
            {activeLangTab === 'en' && (
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">Title (English)</label>
                  <input
                    type="text"
                    placeholder="e.g. Ultimate Mass Gain Bundle"
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">Description (English)</label>
                  <textarea
                    rows={3}
                    placeholder="Describe what's included in this featured pack..."
                    value={descriptionEn}
                    onChange={(e) => setDescriptionEn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  />
                </div>
              </div>
            )}

            {activeLangTab === 'fr' && (
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">Titre (Français)</label>
                  <input
                    type="text"
                    placeholder="ex. Pack Prise de Masse Ultime"
                    value={titleFr}
                    onChange={(e) => setTitleFr(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">Description (Français)</label>
                  <textarea
                    rows={3}
                    placeholder="Décrivez le contenu de ce pack promo..."
                    value={descriptionFr}
                    onChange={(e) => setDescriptionFr(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  />
                </div>
              </div>
            )}

            {activeLangTab === 'ar' && (
              <div className="space-y-3" dir="rtl">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">العنوان (بالعربية)</label>
                  <input
                    type="text"
                    placeholder="مثال: باقة التضخيم العضلي الشاملة"
                    value={titleAr}
                    onChange={(e) => setTitleAr(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">الوصف (بالعربية)</label>
                  <textarea
                    rows={3}
                    placeholder="صف محتويات وفوائد هذه الباقة المميزة..."
                    value={descriptionAr}
                    onChange={(e) => setDescriptionAr(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
