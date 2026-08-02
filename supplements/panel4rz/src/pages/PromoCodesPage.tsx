import React, { useState } from 'react';
import { PromoCode } from '../types';
import { Tag, Plus, Search, Edit2, Trash2, CheckCircle2, XCircle, Copy, Percent, Truck, DollarSign, Calendar, Layers, Check, X } from 'lucide-react';

interface PromoCodesPageProps {
  promoCodes: PromoCode[];
  onSavePromoCode: (promo: Partial<PromoCode>) => Promise<void>;
  onDeletePromoCode: (id: string) => Promise<void>;
  onToggleStatus?: (id: string, newStatus: 'active' | 'inactive') => Promise<void>;
}

export const PromoCodesPage: React.FC<PromoCodesPageProps> = ({
  promoCodes,
  onSavePromoCode,
  onDeletePromoCode,
  onToggleStatus
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Partial<PromoCode> | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'fixed' | 'free_delivery'>('percent');
  const [value, setValue] = useState<number | ''>('');
  const [minOrder, setMinOrder] = useState<number | ''>('');
  const [maxUses, setMaxUses] = useState<number | ''>('');
  const [expiry, setExpiry] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [applyToAll, setApplyToAll] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const filteredPromos = promoCodes.filter(p => {
    if (selectedStatus !== 'all' && p.status !== selectedStatus) return false;
    if (selectedType !== 'all' && p.type !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return p.code.toLowerCase().includes(q);
    }
    return true;
  });

  const activeCount = promoCodes.filter(p => p.status === 'active').length;
  const totalUses = promoCodes.reduce((sum, p) => sum + (p.uses || 0), 0);

  const handleOpenModal = (promo?: PromoCode) => {
    if (promo) {
      setEditingPromo(promo);
      setCode(promo.code);
      setType(promo.type || 'percent');
      setValue(promo.value !== undefined ? promo.value : '');
      setMinOrder(promo.minOrder !== undefined ? promo.minOrder : '');
      setMaxUses(promo.maxUses !== undefined && promo.maxUses !== null ? promo.maxUses : '');
      setExpiry(promo.expiry || '');
      setStatus(promo.status || 'active');
      setApplyToAll(promo.applyToAll !== false);
    } else {
      setEditingPromo(null);
      setCode('');
      setType('percent');
      setValue('');
      setMinOrder('');
      setMaxUses('');
      setExpiry('');
      setStatus('active');
      setApplyToAll(true);
    }
    setIsModalOpen(true);
  };

  const handleCopyCode = (c: string) => {
    navigator.clipboard.writeText(c);
    setCopiedCode(c);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      alert("Coupon code is required");
      return;
    }
    if (type !== 'free_delivery' && (value === '' || Number(value) < 0)) {
      alert("Please enter a valid discount value");
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<PromoCode> = {
        id: editingPromo?.id,
        code: code.trim().toUpperCase(),
        type,
        value: type === 'free_delivery' ? 0 : Number(value || 0),
        minOrder: minOrder !== '' ? Number(minOrder) : 0,
        maxUses: maxUses !== '' ? Number(maxUses) : null,
        expiry: expiry || undefined,
        status,
        applyToAll
      };

      await onSavePromoCode(payload);
      setIsModalOpen(false);
    } catch (err: any) {
      alert("Error saving promo code: " + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Tag className="w-5 h-5 text-red-600" />
            <span>Promo Codes & Coupons</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage promotional discounts, free delivery vouchers, and usage thresholds.</p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Promo Code</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-medium block">Total Promo Codes</span>
            <strong className="text-xl font-black text-slate-900">{promoCodes.length}</strong>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Tag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-medium block">Active Coupons</span>
            <strong className="text-xl font-black text-emerald-600">{activeCount}</strong>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-medium block">Total Customer Redemptions</span>
            <strong className="text-xl font-black text-indigo-600">{totalUses.toLocaleString()}</strong>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-xl gap-0.5">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedStatus === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All ({promoCodes.length})
            </button>
            <button
              onClick={() => setSelectedStatus('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedStatus === 'active' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setSelectedStatus('inactive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedStatus === 'inactive' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Inactive ({promoCodes.length - activeCount})
            </button>
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-100 border-0 rounded-xl text-xs font-bold px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-600/20 cursor-pointer"
          >
            <option value="all">All Discount Types</option>
            <option value="percent">Percentage (%)</option>
            <option value="fixed">Fixed Amount (DA)</option>
            <option value="free_delivery">Free Delivery 🚚</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search coupon code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
          />
        </div>
      </div>

      {/* Promos Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto thin-scrollbar">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Coupon Code</th>
                <th className="p-3">Type</th>
                <th className="p-3">Discount Value</th>
                <th className="p-3">Min. Order</th>
                <th className="p-3">Uses / Max</th>
                <th className="p-3">Expiry Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPromos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                    No promo codes found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredPromos.map(p => {
                  const typeLabel =
                    p.type === 'percent' ? 'Percentage (%)' :
                    p.type === 'fixed' ? 'Fixed (DA)' : 'Free Delivery 🚚';

                  const valueDisplay =
                    p.type === 'free_delivery' ? 'Free Delivery' :
                    p.type === 'percent' ? `${p.value}% OFF` :
                    `${Number(p.value || 0).toLocaleString()} DA OFF`;

                  const isExpired = p.expiry && new Date(p.expiry) < new Date();

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-slate-900 bg-red-50 text-red-700 px-2.5 py-1 rounded-lg border border-red-200/80 tracking-wider">
                            {p.code}
                          </span>
                          <button
                            onClick={() => handleCopyCode(p.code)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                            title="Copy Code"
                          >
                            {copiedCode === p.code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <div className="mt-1">
                          {p.applyToAll ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              Storewide
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              Specific Items
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 font-semibold text-slate-700">
                        <span className="inline-flex items-center gap-1">
                          {p.type === 'percent' ? <Percent className="w-3.5 h-3.5 text-indigo-500" /> :
                           p.type === 'fixed' ? <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> :
                           <Truck className="w-3.5 h-3.5 text-blue-500" />}
                          <span>{typeLabel}</span>
                        </span>
                      </td>

                      <td className="p-3 font-black text-slate-900 text-xs">
                        <span className={p.type === 'free_delivery' ? 'text-blue-600' : 'text-slate-900'}>
                          {valueDisplay}
                        </span>
                      </td>

                      <td className="p-3 font-medium text-slate-700">
                        {p.minOrder ? `${Number(p.minOrder).toLocaleString()} DA` : 'No Min'}
                      </td>

                      <td className="p-3 font-bold text-slate-800">
                        <span>{p.uses || 0}</span>
                        <span className="text-slate-400 font-normal"> / {p.maxUses ? p.maxUses : '∞'}</span>
                      </td>

                      <td className="p-3">
                        {p.expiry ? (
                          <span className={`font-medium ${isExpired ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                            {new Date(p.expiry).toLocaleDateString()} {isExpired ? '(Expired)' : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">No Expiry</span>
                        )}
                      </td>

                      <td className="p-3">
                        <button
                          onClick={() => {
                            if (onToggleStatus) {
                              onToggleStatus(p.id, p.status === 'active' ? 'inactive' : 'active');
                            }
                          }}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center gap-1 border transition-all ${
                            p.status === 'active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          <span>{p.status === 'active' ? '🟢 Active' : '🔴 Inactive'}</span>
                        </button>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenModal(p)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                            title="Edit Promo Code"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete promo code [${p.code}]?`)) {
                                onDeletePromoCode(p.id);
                              }
                            }}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors"
                            title="Delete Promo Code"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* ── CREATE / EDIT PROMO MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Tag className="w-4 h-4 text-red-600" />
                <span>{editingPromo ? 'Edit Promo Code' : 'Create New Promo Code'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              {/* Code Name */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SUMMER20, FREESHIP"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-red-600/20"
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Discount Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (DA)</option>
                    <option value="free_delivery">Free Delivery 🚚</option>
                  </select>
                </div>

                {type !== 'free_delivery' && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {type === 'percent' ? 'Percentage (%) *' : 'Amount (DA) *'}
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      placeholder={type === 'percent' ? '15' : '500'}
                      value={value}
                      onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                    />
                  </div>
                )}
              </div>

              {/* Min Order & Max Uses */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Min. Order Amount (DA)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 (No minimum)"
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Max Redemptions Limit</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  />
                </div>
              </div>

              {/* Expiry Date & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                  >
                    <option value="active">🟢 Active</option>
                    <option value="inactive">🔴 Inactive</option>
                  </select>
                </div>
              </div>

              {/* Scope Checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={applyToAll}
                    onChange={(e) => setApplyToAll(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <span>Apply coupon storewide to all products</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingPromo ? 'Update Promo Code' : 'Create Promo Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
