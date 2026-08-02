import React, { useState, useMemo } from 'react';
import type { DeliveryPrice } from '../types';
import { 
  Truck, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  FileSpreadsheet, 
  Home, 
  Building2, 
  SlidersHorizontal,
  ArrowUpDown
} from 'lucide-react';

interface DeliveryPricesPageProps {
  deliveryPrices: DeliveryPrice[];
  onSaveDeliveryPrice: (dp: DeliveryPrice) => Promise<void>;
  onSaveBulkDeliveryPrices: (dps: DeliveryPrice[]) => Promise<void>;
  onDeleteDeliveryPrice: (id: string | number) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DeliveryPricesPage: React.FC<DeliveryPricesPageProps> = ({
  deliveryPrices,
  onSaveDeliveryPrice,
  onSaveBulkDeliveryPrices,
  onDeleteDeliveryPrice,
  showToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);

  // Spreadsheet Inline Edit State
  const [isSpreadsheetMode, setIsSpreadsheetMode] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Record<string | number, DeliveryPrice>>({});

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<DeliveryPrice> | null>(null);

  // Bulk Adjust State
  const [isBulkAdjustModalOpen, setIsBulkAdjustModalOpen] = useState(false);
  const [bulkHomeAdjustment, setBulkHomeAdjustment] = useState<number>(0);
  const [bulkOfficeAdjustment, setBulkOfficeAdjustment] = useState<number>(0);

  // Filter & Sort
  const sortedDeliveryPrices = useMemo(() => {
    let list = [...deliveryPrices];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(d => 
        (d.wilaya || '').toLowerCase().includes(q) ||
        String(d.id).toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const aName = a.wilaya || '';
      const bName = b.wilaya || '';
      return sortAsc ? aName.localeCompare(bName, undefined, { numeric: true }) : bName.localeCompare(aName, undefined, { numeric: true });
    });

    return list;
  }, [deliveryPrices, searchQuery, sortAsc]);

  // Selection Helpers
  const isAllSelected = sortedDeliveryPrices.length > 0 && sortedDeliveryPrices.every(d => selectedIds.includes(d.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedDeliveryPrices.map(d => d.id));
    }
  };

  const toggleSelect = (id: string | number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Open Modal for Add
  const handleOpenAddModal = () => {
    setEditingItem({
      id: `dp_${Date.now()}`,
      wilaya: '',
      home_price: 600,
      office_price: 400
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (item: DeliveryPrice) => {
    setEditingItem({ ...item });
    setIsModalOpen(true);
  };

  // Save Modal Item
  const handleSaveModalItem = async () => {
    if (!editingItem?.wilaya?.trim()) {
      showToast("Wilaya name is required", "error");
      return;
    }

    const payload: DeliveryPrice = {
      id: editingItem.id || `dp_${Date.now()}`,
      wilaya: editingItem.wilaya.trim(),
      home_price: Number(editingItem.home_price) || 0,
      office_price: Number(editingItem.office_price) || 0
    };

    await onSaveDeliveryPrice(payload);
    setIsModalOpen(false);
    showToast("✓ Wilaya delivery price saved!");
  };

  // Spreadsheet Inline Edit Change Handler
  const handleSpreadsheetChange = (id: string | number, field: 'wilaya' | 'home_price' | 'office_price', val: any) => {
    const existing = pendingEdits[id] || deliveryPrices.find(d => d.id === id);
    if (!existing) return;

    const updated: DeliveryPrice = {
      ...existing,
      [field]: field === 'wilaya' ? val : (Number(val) || 0)
    };

    setPendingEdits(prev => ({
      ...prev,
      [id]: updated
    }));
  };

  // Save All Spreadsheet Edits
  const handleSaveAllSpreadsheetEdits = async () => {
    const itemsToSave = Object.values(pendingEdits);
    if (itemsToSave.length === 0) return;

    await onSaveBulkDeliveryPrices(itemsToSave);
    setPendingEdits({});
    setIsSpreadsheetMode(false);
    showToast(`✓ Saved ${itemsToSave.length} wilaya delivery prices to database!`);
  };

  const handleDiscardSpreadsheetEdits = () => {
    setPendingEdits({});
    setIsSpreadsheetMode(false);
    showToast("Spreadsheet edits discarded", "info");
  };

  // Bulk Adjust Prices Handler
  const handleApplyBulkPriceAdjust = async () => {
    const targetIds = selectedIds.length > 0 ? selectedIds : sortedDeliveryPrices.map(d => d.id);
    if (targetIds.length === 0) return;

    const updatedItems: DeliveryPrice[] = [];
    for (const id of targetIds) {
      const item = deliveryPrices.find(d => d.id === id);
      if (item) {
        const newHome = Math.max(0, (Number(item.home_price) || 0) + bulkHomeAdjustment);
        const newOffice = Math.max(0, (Number(item.office_price) || 0) + bulkOfficeAdjustment);
        updatedItems.push({
          ...item,
          home_price: newHome,
          office_price: newOffice
        });
      }
    }

    if (updatedItems.length > 0) {
      await onSaveBulkDeliveryPrices(updatedItems);
      setSelectedIds([]);
      setIsBulkAdjustModalOpen(false);
      setBulkHomeAdjustment(0);
      setBulkOfficeAdjustment(0);
      showToast(`✓ Updated delivery prices for ${updatedItems.length} Wilaya(s)!`);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    if (!confirm(`Are you sure you want to delete ${count} selected Wilayas?`)) return;

    try {
      for (const id of selectedIds) {
        await onDeleteDeliveryPrice(id);
      }
      setSelectedIds([]);
      showToast(`✓ Deleted ${count} Wilayas`);
    } catch (e) {
      showToast("Error deleting Wilayas", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-600" />
            <span>Wilayas & Delivery Pricing</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Configure Home Delivery & Office / Stop-Desk costs for each of Algeria's 58+ Wilayas.</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsBulkAdjustModalOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-xs px-3 py-2 rounded-xl shadow-sm transition-all"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Bulk Rate Adjuster</span>
          </button>

          <button
            onClick={() => {
              if (isSpreadsheetMode && Object.keys(pendingEdits).length > 0) {
                if (confirm("Save pending spreadsheet changes before exiting?")) {
                  handleSaveAllSpreadsheetEdits();
                }
              }
              setIsSpreadsheetMode(!isSpreadsheetMode);
            }}
            className={`flex items-center gap-1.5 font-semibold text-xs px-3 py-2 rounded-xl border transition-all ${
              isSpreadsheetMode
                ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isSpreadsheetMode ? 'Exit Excel Edit' : 'Excel Edit Mode'}</span>
          </button>

          {isSpreadsheetMode && Object.keys(pendingEdits).length > 0 && (
            <button
              onClick={handleSaveAllSpreadsheetEdits}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-md transition-all animate-pulse"
            >
              <Check className="w-4 h-4" />
              <span>Save ({Object.keys(pendingEdits).length})</span>
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Wilaya</span>
          </button>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Wilaya (e.g. 16 - Alger, Adrar)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
          <span>Total Configured:</span>
          <span className="bg-slate-100 text-slate-900 px-2.5 py-1 rounded-lg border border-slate-200">
            {deliveryPrices.length} Wilaya(s)
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto border border-slate-200/80 rounded-2xl bg-white shadow-xs">
          <table className="w-full text-xs text-left text-slate-700 min-w-[650px]">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="p-3 cursor-pointer hover:bg-slate-100" onClick={() => setSortAsc(!sortAsc)}>
                  <div className="flex items-center gap-1">
                    <span>Wilaya</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3">
                  <div className="flex items-center gap-1 text-slate-700">
                    <Home className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Home Delivery (DA)</span>
                  </div>
                </th>
                <th className="p-3">
                  <div className="flex items-center gap-1 text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Office / Stop-Desk (DA)</span>
                  </div>
                </th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedDeliveryPrices.map((dp) => {
                const displayItem = pendingEdits[dp.id] || dp;
                const isModified = Boolean(pendingEdits[dp.id]);
                const isSelected = selectedIds.includes(dp.id);

                return (
                  <tr
                    key={dp.id}
                    className={
                      isSelected
                        ? 'bg-emerald-50/50 hover:bg-emerald-100/50 transition-colors font-medium'
                        : isModified
                        ? 'bg-amber-50/70 hover:bg-amber-100/70 transition-colors border-l-4 border-l-amber-500 font-medium'
                        : 'hover:bg-slate-50/80 transition-colors'
                    }
                  >
                    {/* Checkbox */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(dp.id)}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Wilaya Name */}
                    <td className="p-3">
                      {isSpreadsheetMode ? (
                        <input
                          type="text"
                          value={displayItem.wilaya || ''}
                          onChange={(e) => handleSpreadsheetChange(dp.id, 'wilaya', e.target.value)}
                          className="w-full bg-amber-50/80 border border-amber-300 rounded px-2 py-1 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20"
                        />
                      ) : (
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{displayItem.wilaya}</span>
                          {isModified && (
                            <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded">
                              EDITED
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Home Price */}
                    <td className="p-3">
                      {isSpreadsheetMode ? (
                        <input
                          type="number"
                          value={displayItem.home_price !== undefined ? displayItem.home_price : ''}
                          onChange={(e) => handleSpreadsheetChange(dp.id, 'home_price', e.target.value)}
                          className="w-28 bg-amber-50/80 border border-amber-300 rounded px-2 py-1 text-xs font-bold text-emerald-950 focus:ring-2 focus:ring-amber-500/20"
                        />
                      ) : (
                        <span className="font-extrabold text-emerald-700 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                          {Number(displayItem.home_price || 0).toLocaleString()} DA
                        </span>
                      )}
                    </td>

                    {/* Office Price */}
                    <td className="p-3">
                      {isSpreadsheetMode ? (
                        <input
                          type="number"
                          value={displayItem.office_price !== undefined ? displayItem.office_price : ''}
                          onChange={(e) => handleSpreadsheetChange(dp.id, 'office_price', e.target.value)}
                          className="w-28 bg-amber-50/80 border border-amber-300 rounded px-2 py-1 text-xs font-bold text-indigo-950 focus:ring-2 focus:ring-amber-500/20"
                        />
                      ) : (
                        <span className="font-extrabold text-indigo-700 bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-200/60">
                          {Number(displayItem.office_price || 0).toLocaleString()} DA
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(dp)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                          title="Edit Wilaya"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete delivery pricing for Wilaya [${dp.wilaya}]?`)) onDeleteDeliveryPrice(dp.id);
                          }}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors"
                          title="Delete Wilaya"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedDeliveryPrices.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Truck className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-500 text-xs">No Wilaya delivery prices found.</p>
                      <p className="text-[11px] text-slate-400">Click "Add Wilaya" to create one.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between gap-3 max-w-md w-[92vw] animate-in slide-in-from-bottom-4">
          <span className="text-xs font-black bg-emerald-600 px-2.5 py-1 rounded-lg shrink-0">
            {selectedIds.length} Selected
          </span>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <button
              onClick={() => setIsBulkAdjustModalOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Adjust Rates</span>
            </button>

            <button
              onClick={handleBulkDelete}
              className="px-3.5 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedIds.length})</span>
            </button>
          </div>

          <button
            onClick={() => setSelectedIds([])}
            className="text-slate-400 hover:text-white p-1 rounded-lg shrink-0"
            title="Clear Selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── ADD / EDIT WILAYA MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-base">
                {editingItem?.id && deliveryPrices.some(d => d.id === editingItem.id) ? `Edit Wilaya — ${editingItem.wilaya}` : 'Add New Wilaya'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Wilaya Name & Number *</label>
                <input
                  type="text"
                  placeholder="e.g. 16 - Alger or 01 - Adrar"
                  value={editingItem?.wilaya || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev, wilaya: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Home Delivery Price (DA) *</label>
                <input
                  type="number"
                  placeholder="e.g. 600"
                  value={editingItem?.home_price !== undefined ? editingItem.home_price : ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev, home_price: Number(e.target.value) || 0 }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Office / Stop-Desk Price (DA) *</label>
                <input
                  type="number"
                  placeholder="e.g. 400"
                  value={editingItem?.office_price !== undefined ? editingItem.office_price : ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev, office_price: Number(e.target.value) || 0 }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalItem}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Wilaya</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK RATE ADJUSTMENT MODAL ── */}
      {isBulkAdjustModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                <span>Bulk Rate Adjuster</span>
              </h3>
              <button onClick={() => setIsBulkAdjustModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-500 font-medium">
                Adjust Home and Office delivery rates for {selectedIds.length > 0 ? `${selectedIds.length} selected Wilaya(s)` : 'ALL Wilayas'}.
                Enter positive numbers to increase or negative numbers to decrease (e.g. 50 or -50).
              </p>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Home Delivery Adjustment (DA)</label>
                <input
                  type="number"
                  placeholder="e.g. 50 or -50"
                  value={bulkHomeAdjustment || ''}
                  onChange={(e) => setBulkHomeAdjustment(Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Office / Stop-Desk Adjustment (DA)</label>
                <input
                  type="number"
                  placeholder="e.g. 50 or -50"
                  value={bulkOfficeAdjustment || ''}
                  onChange={(e) => setBulkOfficeAdjustment(Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBulkAdjustModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkPriceAdjust}
                  className="px-5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Apply Rate Adjustment</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
