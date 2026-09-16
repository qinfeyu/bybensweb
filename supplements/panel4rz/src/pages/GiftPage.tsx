import React, { useState, useEffect } from 'react';
import { Gift, Save, Check } from 'lucide-react';
import { Product } from '../types';

interface GiftPageProps {
  products: Product[];
  giftConfig: any | null;
  onSaveGiftConfig: (config: any) => Promise<void>;
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="w-6 h-6 text-emerald-500" />
          Free Gift Configuration
        </h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2"
        >
          {saving ? <Check className="w-4 h-4 animate-pulse" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border p-6 space-y-6">
        <div className="flex items-center justify-between border-b pb-6">
          <div>
            <h2 className="text-lg font-bold">Enable Free Gift</h2>
            <p className="text-gray-500 text-sm">Turn the free gift promotion on or off for the storefront.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer"
              checked={config.enabled}
              onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        <div className="border-b pb-6 space-y-4">
          <h3 className="font-bold">Unlock Conditions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold mb-1">Condition Type</label>
              <select
                value={config.condition_type}
                onChange={e => setConfig(c => ({ ...c, condition_type: e.target.value as any }))}
                className="w-full p-2 border rounded-xl"
              >
                <option value="amount">Amount Threshold Only</option>
                <option value="products">Specific Products Only (Requires ALL selected)</option>
                <option value="both">Amount Threshold OR Specific Products</option>
              </select>
            </div>
            
            {(config.condition_type === 'amount' || config.condition_type === 'both') && (
              <div>
                <label className="block text-sm font-semibold mb-1">Unlock Threshold (DA)</label>
                <input
                  type="number"
                  value={config.threshold}
                  onChange={e => setConfig(c => ({ ...c, threshold: Number(e.target.value) }))}
                  className="w-full p-2 border rounded-xl"
                />
              </div>
            )}
          </div>
          
          {(config.condition_type === 'products' || config.condition_type === 'both') && (
            <div className="mt-4">
              <label className="block text-sm font-semibold mb-2">Required Products (Must buy ALL selected)</label>
              <div className="max-h-48 overflow-y-auto border rounded-xl p-3 space-y-2 bg-gray-50">
                {products.length === 0 ? (
                  <p className="text-sm text-gray-500">No products available.</p>
                ) : (
                  products.map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                      <input 
                        type="checkbox" 
                        checked={config.required_products.includes(String(p.id))}
                        onChange={() => handleRequiredProductToggle(String(p.id))}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm">{p.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold mb-1">Select Gift Product</label>
            <input
              type="number"
              value={config.threshold}
              onChange={e => setConfig(c => ({ ...c, threshold: Number(e.target.value) }))}
              className="w-full p-2 border rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Select Gift Product</label>
            <select
              value={config.product_id}
              onChange={e => setConfig(c => ({ ...c, product_id: e.target.value, variant_index: 0, flavor: '' }))}
              className="w-full p-2 border rounded-xl"
            >
              <option value="">-- Choose a product --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {variants.length > 0 && (
            <div>
              <label className="block text-sm font-semibold mb-1">Select Variant</label>
              <select
                value={config.variant_index}
                onChange={e => setConfig(c => ({ ...c, variant_index: Number(e.target.value), flavor: '' }))}
                className="w-full p-2 border rounded-xl"
              >
                {variants.map((v: any, i: number) => (
                  <option key={i} value={i}>{v.weight}{v.unit} - {v.price} DA</option>
                ))}
              </select>
            </div>
          )}

          {flavors.length > 0 && (
            <div>
              <label className="block text-sm font-semibold mb-1">Select Flavor</label>
              <select
                value={config.flavor}
                onChange={e => setConfig(c => ({ ...c, flavor: e.target.value }))}
                className="w-full p-2 border rounded-xl"
              >
                <option value="">-- Choose a flavor --</option>
                {flavors.map((f: string) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-bold">Unlock Messages</h3>
          <div>
            <label className="block text-sm font-semibold mb-1">English Message</label>
            <input type="text" value={config.message_en} onChange={e => setConfig(c => ({ ...c, message_en: e.target.value }))} className="w-full p-2 border rounded-xl" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">French Message</label>
            <input type="text" value={config.message_fr} onChange={e => setConfig(c => ({ ...c, message_fr: e.target.value }))} className="w-full p-2 border rounded-xl" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-right" dir="rtl">Arabic Message</label>
            <input type="text" value={config.message_ar} dir="rtl" onChange={e => setConfig(c => ({ ...c, message_ar: e.target.value }))} className="w-full p-2 border rounded-xl text-right" />
          </div>
        </div>
      </div>
    </div>
  );
}
