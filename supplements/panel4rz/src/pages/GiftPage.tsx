import React, { useState, useEffect } from 'react';
import { Gift, Save, Check, Power, Tag, Package, MessageCircle, Search } from 'lucide-react';
import { Product } from '../types';

interface GiftPageProps {
  products: Product[];
  giftConfig: any | null;
  onSaveGiftConfig: (config: any) => Promise<void>;
}

const inputCls =
  'w-full p-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-colors';
const selectCls = inputCls + ' cursor-pointer';

function SectionCard({ icon: Icon, title, desc, children }: { icon: any; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
          <Icon className="w-4 h-4" />
        </span>
        <div>
          <h2 className="font-bold text-gray-800 leading-tight">{title}</h2>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function GiftPage({ products, giftConfig, onSaveGiftConfig }: GiftPageProps) {
  const [config, setConfig] = useState({
    enabled: false,
    condition_type: 'amount',
    required_products: [] as string[],
    threshold: 20000,
    product_id: '',
    variant_index: 0,
    flavor: '',
    message_en: 'Free gift unlocked!',
    message_fr: 'Cadeau gratuit débloqué!',
    message_ar: 'تم فتح الهدية المجانية!',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (giftConfig) {
      setConfig({
        enabled: giftConfig.enabled === true || String(giftConfig.enabled) === 'true',
        condition_type: giftConfig.condition_type || 'amount',
        required_products: Array.isArray(giftConfig.required_products) ? giftConfig.required_products : [],
        threshold: Number(giftConfig.threshold) || 20000,
        product_id: giftConfig.product_id || '',
        variant_index: Number(giftConfig.variant_index) || 0,
        flavor: giftConfig.flavor || '',
        message_en: giftConfig.message_en || 'Free gift unlocked!',
        message_fr: giftConfig.message_fr || 'Cadeau gratuit débloqué!',
        message_ar: giftConfig.message_ar || 'تم فتح الهدية المجانية!',
      });
    }
  }, [giftConfig]);

  const handleSave = async () => {
    setSaving(true);
    await onSaveGiftConfig(config);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const selectedProduct = products.find(p => p.id === config.product_id);
  const variants = selectedProduct?.variants || [];
  const selectedVariant = variants[config.variant_index] || variants[0];
  const flavors = selectedVariant?.flavorStock ? Object.keys(selectedVariant.flavorStock) : [];

  const handleRequiredProductToggle = (productId: string) => {
    setConfig(c => {
      const isSelected = c.required_products.includes(productId);
      return {
        ...c,
        required_products: isSelected
          ? c.required_products.filter(id => id !== productId)
          : [...c.required_products, productId]
      };
    });
  };

  const conditionOptions = [
    { value: 'amount', title: 'Amount Threshold', desc: 'Gift unlocks when the cart subtotal reaches the threshold.' },
    { value: 'products', title: 'Specific Products', desc: 'Gift unlocks when ALL selected products are in the cart.' },
    { value: 'both', title: 'Amount OR Products', desc: 'Gift unlocks when either the threshold or all selected products are satisfied.' },
  ];

  const filteredProducts = products.filter(p => (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20">
              <Gift className="w-5 h-5" />
            </span>
            Free Gift Configuration
          </h1>
          <p className="text-sm text-gray-500 mt-1 ml-11">Give customers a free product when they unlock a promotion.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-emerald-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saved ? <Check className="w-4 h-4" /> : saving ? <Check className="w-4 h-4 animate-pulse" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      <SectionCard icon={Power} title="Enable Free Gift" desc="Turn the free gift promotion on or off for the storefront.">
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <div>
            <p className={`font-semibold text-sm ${config.enabled ? 'text-emerald-700' : 'text-gray-600'}`}>
              {config.enabled ? 'Promotion is Active' : 'Promotion is Disabled'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Storefront visitors will{config.enabled ? '' : ' not'} see the free-gift promotion.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={config.enabled}
              onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))}
            />
            <div className={`relative w-12 h-6 rounded-full transition-colors peer-checked:bg-emerald-500 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-200 ${config.enabled ? 'bg-emerald-500' : ''}`}>
              <span className={`absolute top-[2px] left-[2px] w-5 h-5 rounded-full bg-white shadow transition-transform ${config.enabled ? 'translate-x-6' : ''}`}></span>
            </div>
          </label>
        </div>
      </SectionCard>

      <SectionCard icon={Tag} title="Unlock Conditions" desc="Choose how customers unlock the free gift.">
        <div className="grid grid-cols-1 gap-3">
          {conditionOptions.map(opt => {
            const active = config.condition_type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setConfig(c => ({ ...c, condition_type: opt.value as any }))}
                className={`text-left rounded-xl border-2 px-4 py-3 transition-all ${active ? 'border-emerald-500 bg-emerald-50/60 shadow-sm' : 'border-gray-200 bg-white hover:border-emerald-200'}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${active ? 'border-emerald-500' : 'border-gray-300'}`}>
                    {active && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                  </span>
                  <span>
                    <span className={`block text-sm font-semibold ${active ? 'text-emerald-800' : 'text-gray-700'}`}>{opt.title}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">{opt.desc}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {(config.condition_type === 'amount' || config.condition_type === 'both') && (
          <div className="pt-2">
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">Unlock Threshold (DA)</label>
            <div className="relative">
              <input
                type="number"
                min={0}
                value={config.threshold}
                onChange={e => setConfig(c => ({ ...c, threshold: Number(e.target.value) }))}
                className={inputCls + ' pr-12'}
              />
              <span className="absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-gray-400">DA</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Cart subtotal (excluding gifts) must reach this amount.</p>
          </div>
        )}

        {(config.condition_type === 'products' || config.condition_type === 'both') && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2.5">
              <label className="block text-sm font-semibold text-gray-700">Required Products</label>
              <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-0.5">
                {config.required_products.length} selected
              </span>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={inputCls + ' pl-9'}
              />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100 bg-white">
              {products.length === 0 ? (
                <p className="text-sm text-gray-500 p-3">No products available.</p>
              ) : filteredProducts.length === 0 ? (
                <p className="text-sm text-gray-500 p-3">No products match your search.</p>
              ) : (
                filteredProducts.map(p => {
                  const checked = config.required_products.includes(String(p.id));
                  return (
                    <label key={p.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${checked ? 'bg-emerald-50/70' : 'hover:bg-gray-50'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleRequiredProductToggle(String(p.id))}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 accent-emerald-600"
                      />
                      <span className={`text-sm flex-1 truncate ${checked ? 'font-medium text-emerald-900' : 'text-gray-700'}`}>{p.name}</span>
                      {checked && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Customers must buy all the selected products to unlock the gift.</p>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={Package} title="Gift Product" desc="The free product customers receive when unlocked.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">Select Gift Product</label>
            <select
              value={config.product_id}
              onChange={e => setConfig(c => ({ ...c, product_id: e.target.value, variant_index: 0, flavor: '' }))}
              className={selectCls}
            >
              <option value="">-- Choose a product --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {variants.length > 0 ? (
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">Select Variant</label>
              <select
                value={config.variant_index}
                onChange={e => setConfig(c => ({ ...c, variant_index: Number(e.target.value), flavor: '' }))}
                className={selectCls}
              >
                {variants.map((v: any, i: number) => (
                  <option key={i} value={i}>{v.weight}{v.unit} - {v.price} DA</option>
                ))}
              </select>
            </div>
          ) : null}

          {flavors.length > 0 && (
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">Select Flavor</label>
              <select
                value={config.flavor}
                onChange={e => setConfig(c => ({ ...c, flavor: e.target.value }))}
                className={selectCls}
              >
                <option value="">-- Choose a flavor --</option>
                {flavors.map((f: string) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard icon={MessageCircle} title="Unlock Messages" desc="The message shown to customers once they unlock the gift.">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">English Message</label>
            <input type="text" value={config.message_en} onChange={e => setConfig(c => ({ ...c, message_en: e.target.value }))} className={inputCls} placeholder="Free gift unlocked!" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">French Message</label>
            <input type="text" value={config.message_fr} onChange={e => setConfig(c => ({ ...c, message_fr: e.target.value }))} className={inputCls} placeholder="Cadeau gratuit débloqué!" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700 text-right" dir="rtl">Arabic Message</label>
            <input type="text" value={config.message_ar} dir="rtl" onChange={e => setConfig(c => ({ ...c, message_ar: e.target.value }))} className={inputCls + ' text-right'} placeholder="تم فتح الهدية المجانية!" />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}