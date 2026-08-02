import React, { useState, useEffect } from 'react';
import { Product, BundleConfig } from '../types';
import { Package, Search, Check, Save, X, Globe, Sparkles, AlertCircle } from 'lucide-react';

interface BundlePageProps {
  products: Product[];
  bundleConfig: BundleConfig | null;
  onSaveBundle: (bundle: BundleConfig) => Promise<void>;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const BundlePage: React.FC<BundlePageProps> = ({
  products,
  bundleConfig,
  onSaveBundle,
  showToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  const getProductPrice = (p: Product) => {
    if (p.variants && p.variants.length > 0 && p.variants[0].price) {
      return p.variants[0].price;
    }
    return 0;
  };
  
  // Multilingual Fields
  const [titleEn, setTitleEn] = useState('');
  const [titleFr, setTitleFr] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionFr, setDescriptionFr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');

  const [activeLangTab, setActiveLangTab] = useState<'en' | 'fr' | 'ar'>('en');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (bundleConfig) {
      setSelectedProductId(bundleConfig.bundleId || '');
      setTitleEn(bundleConfig.titleEn || '');
      setTitleFr(bundleConfig.titleFr || '');
      setTitleAr(bundleConfig.titleAr || '');
      setDescriptionEn(bundleConfig.descriptionEn || '');
      setDescriptionFr(bundleConfig.descriptionFr || '');
      setDescriptionAr(bundleConfig.descriptionAr || '');
    }
  }, [bundleConfig]);

  const filteredProducts = products.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q)
    );
  });

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const handleClearSelection = () => {
    setSelectedProductId('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveBundle({
        id: bundleConfig?.id || 1,
        bundleId: selectedProductId,
        titleEn: titleEn.trim(),
        titleFr: titleFr.trim(),
        titleAr: titleAr.trim(),
        descriptionEn: descriptionEn.trim(),
        descriptionFr: descriptionFr.trim(),
        descriptionAr: descriptionAr.trim(),
      });
      if (showToast) showToast('✓ Featured Bundle offer updated successfully!');
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
            <Package className="w-5 h-5 text-red-600" />
            <span>Featured Bundle & Pack Offer</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Select a featured product pack to highlight on your storefront homepage and product pages.</p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50 shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving Bundle...' : 'Save Featured Bundle'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Picker (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Select Featured Product</span>
              </h2>
              {selectedProductId && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear Selection</span>
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search catalog products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
              />
            </div>

            {/* Products Selection List */}
            <div className="max-h-[420px] overflow-y-auto thin-scrollbar divide-y divide-slate-100 pr-1">
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No products found matching "{searchQuery}".
                </div>
              ) : (
                filteredProducts.map(p => {
                  const isSelected = selectedProductId === p.id;
                  const firstImg = Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl;
                  const price = getProductPrice(p);

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProductId(p.id)}
                      className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-red-50/80 border-2 border-red-500 shadow-sm'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200/80 overflow-hidden flex items-center justify-center shrink-0">
                          {firstImg ? (
                            <img src={firstImg} alt={p.name} className="w-full h-full object-contain p-1" />
                          ) : (
                            <Package className="w-5 h-5 text-slate-400" />
                          )}
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{p.name}</h4>
                          <span className="text-[11px] font-medium text-slate-500 block">{p.brand || 'No brand'}</span>
                          <span className="text-[11px] font-black text-red-600 mt-0.5 block">{Number(price).toLocaleString()} DA</span>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected ? 'bg-red-600 border-red-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Multilingual Content & Active Card Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Product Preview Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">Currently Featured Pack</h3>
            {selectedProduct ? (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="w-14 h-14 bg-white rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {selectedProduct.imageUrl ? (
                    <img src={Array.isArray(selectedProduct.imageUrl) ? selectedProduct.imageUrl[0] : selectedProduct.imageUrl} alt="" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Package className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{selectedProduct.name}</h4>
                  <span className="text-[11px] text-slate-500 font-medium">{selectedProduct.brand || 'No brand'}</span>
                  <span className="text-xs font-black text-emerald-600 block mt-1">
                    {Number(getProductPrice(selectedProduct)).toLocaleString()} DA
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs flex flex-col items-center gap-2">
                <AlertCircle className="w-6 h-6 text-amber-500" />
                <span>No product selected for this bundle offer. Pick a product from the list.</span>
              </div>
            )}
          </div>

          {/* Multilingual Title & Description Editor */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-indigo-500" />
                <span>Pack Title & Description</span>
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
                    rows={4}
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
                    rows={4}
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
                    rows={4}
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
