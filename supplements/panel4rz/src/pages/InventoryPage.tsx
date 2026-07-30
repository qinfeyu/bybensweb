import React, { useState, useEffect, useRef } from 'react';
import type { InventoryItem } from '../types';
import { calculateLandedCost, calculateMargin, calculateMarginPct, calculateWeightedAverageEurPrice } from '../lib/calculations';
import { 
  Euro, 
  Upload, 
  Download, 
  Plus, 
  Edit3, 
  Trash2, 
  ArrowRightLeft, 
  Check, 
  X, 
  Search,
  FileSpreadsheet
} from 'lucide-react';

interface InventoryPageProps {
  inventoryItems: InventoryItem[];
  onSaveItem: (item: InventoryItem) => Promise<void>;
  onSaveBulkItems: (items: InventoryItem[]) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  defaultEurRate: number;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface CsvDiffItem {
  item: InventoryItem;
  status: 'NEW' | 'MODIFIED';
  changesText: string;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({
  inventoryItems,
  onSaveItem,
  onSaveBulkItems,
  onDeleteItem,
  defaultEurRate,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'supplement' | 'snack'>('supplement');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSpreadsheetMode, setIsSpreadsheetMode] = useState(false);
  const [sortField, setSortField] = useState<keyof InventoryItem | 'landed' | 'margin'>('id');
  const [sortAsc, setSortAsc] = useState(true);

  // Modal States
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);

  // Bulk Restock Modal State
  const [isBulkRestockOpen, setIsBulkRestockOpen] = useState(false);
  const [bulkSearchQuery, setBulkSearchQuery] = useState('');
  const [bulkRestockRows, setBulkRestockRows] = useState<Array<{
    sku: string;
    item: InventoryItem;
    addedQty: number;
    newPriceEur: number;
  }>>([]);

  // Stock Transfer Modal State
  const [transferModalItem, setTransferModalItem] = useState<InventoryItem | null>(null);
  const [transferQty, setTransferQty] = useState<number>(0);

  // CSV Import Confirm Modal State
  const [isCsvConfirmOpen, setIsCsvConfirmOpen] = useState(false);
  const [csvDiffs, setCsvDiffs] = useState<CsvDiffItem[]>([]);
  const [pendingCsvItems, setPendingCsvItems] = useState<InventoryItem[]>([]);

  // Spreadsheet Auto-save ref
  const pendingSpreadsheetEdits = useRef<Map<string, InventoryItem>>(new Map());
  const spreadsheetTimerRef = useRef<any>(null);

  // Save pending spreadsheet edits before unmount or window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingSpreadsheetEdits.current.size > 0) {
        const itemsToSave = Array.from(pendingSpreadsheetEdits.current.values());
        onSaveBulkItems(itemsToSave);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [onSaveBulkItems]);

  // Filter & Sort Inventory Items
  const filteredItems = inventoryItems
    .filter(i => (i.type || 'supplement') === activeTab)
    .filter(i => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const sku = (i.id || '').toLowerCase();
      const brand = (i.brand || '').toLowerCase();
      const name = (i.name || '').toLowerCase();
      const spec = (i.variant_spec || '').toLowerCase();
      return sku.includes(q) || brand.includes(q) || name.includes(q) || spec.includes(q);
    })
    .sort((a, b) => {
      let valA: any = a[sortField as keyof InventoryItem];
      let valB: any = b[sortField as keyof InventoryItem];

      if (sortField === 'landed') {
        valA = calculateLandedCost(a.price_eur, a.rate, a.delivery_dzd);
        valB = calculateLandedCost(b.price_eur, b.rate, b.delivery_dzd);
      } else if (sortField === 'margin') {
        valA = calculateMargin(a.retail_dzd, calculateLandedCost(a.price_eur, a.rate, a.delivery_dzd));
        valB = calculateMargin(b.retail_dzd, calculateLandedCost(b.price_eur, b.rate, b.delivery_dzd));
      }

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB || '') : (valB || '').localeCompare(valA);
      }
      return sortAsc ? (Number(valA) || 0) - (Number(valB) || 0) : (Number(valB) || 0) - (Number(valA) || 0);
    });

  const toggleSort = (field: keyof InventoryItem | 'landed' | 'margin') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // ── SpreadSheet Mode Live Edit ──
  const handleSpreadsheetChange = (itemId: string, field: keyof InventoryItem, value: any) => {
    const item = inventoryItems.find(x => x.id === itemId);
    if (!item) return;

    const updatedItem = { ...item, [field]: value, _lastUpdated: new Date().toISOString() };
    pendingSpreadsheetEdits.current.set(itemId, updatedItem);

    if (spreadsheetTimerRef.current) clearTimeout(spreadsheetTimerRef.current);
    spreadsheetTimerRef.current = setTimeout(async () => {
      const itemsToSave = Array.from(pendingSpreadsheetEdits.current.values());
      pendingSpreadsheetEdits.current.clear();
      await onSaveBulkItems(itemsToSave);
    }, 300);
  };

  // ── Bulk EU Restock Handlers ──
  const addBulkRestockRow = (item: InventoryItem) => {
    if (bulkRestockRows.some(r => r.sku === item.id)) return;
    setBulkRestockRows([
      ...bulkRestockRows,
      { sku: item.id, item, addedQty: 1, newPriceEur: item.price_eur || 0 }
    ]);
  };

  const handleConfirmBulkRestock = async () => {
    if (!bulkRestockRows.length) return;
    const updatedItems: InventoryItem[] = bulkRestockRows.map(row => {
      const currentTotalStock = (Number(row.item.stock_eu) || 0) + (Number(row.item.stock) || 0);
      const newTotalStockEu = (Number(row.item.stock_eu) || 0) + row.addedQty;
      const newWeightedPrice = calculateWeightedAverageEurPrice(currentTotalStock, row.item.price_eur, row.addedQty, row.newPriceEur);

      return {
        ...row.item,
        stock_eu: newTotalStockEu,
        price_eur: newWeightedPrice,
        _lastUpdated: new Date().toISOString()
      };
    });

    await onSaveBulkItems(updatedItems);
    setIsBulkRestockOpen(false);
    setBulkRestockRows([]);
    showToast(`✓ Restocked ${updatedItems.length} products with updated weighted average prices!`);
  };

  // ── Save Add/Edit Inventory Item Modal ──
  const handleSaveModalItem = async () => {
    if (!editingItem?.id || !editingItem?.name) {
      showToast("SKU and Product Name are required", "error");
      return;
    }

    const payload: InventoryItem = {
      id: editingItem.id.trim(),
      type: (editingItem.type || activeTab) as 'supplement' | 'snack',
      brand: editingItem.brand || '',
      name: editingItem.name.trim(),
      variant_spec: editingItem.variant_spec || null,
      size: editingItem.size || null,
      price_eur: Number(editingItem.price_eur) || 0,
      rate: Number(editingItem.rate) || defaultEurRate,
      delivery_dzd: Number(editingItem.delivery_dzd) || 0,
      retail_dzd: Number(editingItem.retail_dzd) || 0,
      stock: Number(editingItem.stock) || 0,
      stock_eu: Number(editingItem.stock_eu) || 0,
      _lastUpdated: new Date().toISOString()
    };

    await onSaveItem(payload);
    setIsAddEditModalOpen(false);
    setEditingItem(null);
    showToast(`✓ Inventory item [${payload.id}] saved!`);
  };

  // ── Stock Transfer Europe → Algeria ──
  const handleConfirmStockTransfer = async () => {
    if (!transferModalItem || transferQty <= 0) return;
    const currentEu = Number(transferModalItem.stock_eu) || 0;
    const currentDz = Number(transferModalItem.stock) || 0;

    const updated: InventoryItem = {
      ...transferModalItem,
      stock_eu: Math.max(0, currentEu - transferQty),
      stock: currentDz + transferQty,
      _lastUpdated: new Date().toISOString()
    };

    await onSaveItem(updated);
    setTransferModalItem(null);
    showToast(`✓ Transferred ${transferQty} unit(s) of [${updated.id}] to Algeria sellable stock!`);
  };

  // ── CSV Export ──
  const handleExportCSV = () => {
    const itemsToExport = inventoryItems.filter(i => (i.type || 'supplement') === activeTab);
    if (!itemsToExport.length) {
      showToast("No data to export", "error");
      return;
    }

    const headers = [
      "SKU", "Brand", "Product Name", "Variant Spec", "Size",
      "Price EUR", "Rate", "Delivery DZD", "Landed Cost DZD", "Retail DZD",
      "Margin DZD", "Margin Pct", "Stock EU", "Stock DZ", "Type"
    ];

    const lines = [headers.join(",")];
    itemsToExport.forEach(item => {
      const landed = calculateLandedCost(item.price_eur, item.rate, item.delivery_dzd);
      const margin = calculateMargin(item.retail_dzd, landed);
      const marginPct = calculateMarginPct(item.retail_dzd, margin).toFixed(1);

      const row = [
        `"${(item.id || "").replace(/"/g, '""')}"`,
        `"${(item.brand || "").replace(/"/g, '""')}"`,
        `"${(item.name || "").replace(/"/g, '""')}"`,
        `"${(item.variant_spec || "").replace(/"/g, '""')}"`,
        `"${(item.size || "").replace(/"/g, '""')}"`,
        item.price_eur || 0,
        item.rate || defaultEurRate,
        item.delivery_dzd || 0,
        Math.round(landed),
        item.retail_dzd || 0,
        Math.round(margin),
        `${marginPct}%`,
        item.stock_eu || 0,
        item.stock || 0,
        `"${(item.type || activeTab).replace(/"/g, '""')}"`
      ];
      lines.push(row.join(","));
    });

    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bybens-inventory-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✓ CSV Exported!");
  };

  // ── CSV Import with Visual Diff Confirmation ──
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        showToast("CSV file is empty or invalid", "error");
        return;
      }

      const parseLine = (line: string) => {
        const res: string[] = [];
        let cur = "";
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (c === '"') inQ = !inQ;
          else if (c === ',' && !inQ) {
            res.push(cur.trim().replace(/^"|"$/g, ''));
            cur = "";
          } else cur += c;
        }
        res.push(cur.trim().replace(/^"|"$/g, ''));
        return res;
      };

      const headerCols = parseLine(lines[0]).map(h => h.toLowerCase());
      const findCol = (terms: string[], def: number) => {
        const idx = headerCols.findIndex(h => terms.some(t => h.includes(t)));
        return idx !== -1 ? idx : def;
      };

      const skuIdx = findCol(["sku", "id"], 0);
      const brandIdx = findCol(["brand"], 1);
      const nameIdx = findCol(["product name", "name"], 2);
      const varIdx = findCol(["variant", "spec"], 3);
      const sizeIdx = findCol(["size"], 4);
      const eurIdx = findCol(["price eur", "price_eur", "eur"], 5);
      const rateIdx = findCol(["rate"], 6);
      const delIdx = findCol(["delivery"], 7);
      const retailIdx = findCol(["retail"], 9);
      const stockEuIdx = findCol(["stock eu", "eu stock", "stock_eu"], 12);
      const stockDzIdx = findCol(["stock dz", "dz stock", "stock_dz", "stock"], 13);
      const typeIdx = findCol(["type", "category"], 14);

      const parsedItems: InventoryItem[] = [];
      const diffs: CsvDiffItem[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]);
        if (cols.length < 3) continue;

        const id = (cols[skuIdx] || "").trim();
        const name = (cols[nameIdx] || "").trim();
        if (!id || !name) continue;

        const itemPayload: InventoryItem = {
          id,
          brand: (cols[brandIdx] || "").trim(),
          name,
          variant_spec: (cols[varIdx] || "").trim() || null,
          size: (cols[sizeIdx] || "").trim() || null,
          price_eur: parseFloat(cols[eurIdx]) || 0,
          rate: parseFloat(cols[rateIdx]) || defaultEurRate,
          delivery_dzd: parseFloat(cols[delIdx]) || 0,
          retail_dzd: parseFloat(cols[retailIdx]) || 0,
          stock_eu: parseInt(cols[stockEuIdx]) || 0,
          stock: parseInt(cols[stockDzIdx]) || 0,
          type: (cols[typeIdx] || activeTab) as 'supplement' | 'snack',
          _lastUpdated: new Date().toISOString()
        };

        parsedItems.push(itemPayload);

        const existing = inventoryItems.find(x => x.id.toLowerCase() === id.toLowerCase());
        if (!existing) {
          diffs.push({
            item: itemPayload,
            status: 'NEW',
            changesText: `➕ New SKU [${id}]: ${itemPayload.brand ? itemPayload.brand + ' - ' : ''}${name} — Stock EU: ${itemPayload.stock_eu}, Stock DZ: ${itemPayload.stock}`
          });
        } else {
          const fieldChanges: string[] = [];
          if (existing.brand !== itemPayload.brand) fieldChanges.push(`Brand: "${existing.brand}" → "${itemPayload.brand}"`);
          if (existing.name !== itemPayload.name) fieldChanges.push(`Name: "${existing.name}" → "${itemPayload.name}"`);
          if (existing.price_eur !== itemPayload.price_eur) fieldChanges.push(`Price €: ${existing.price_eur} → ${itemPayload.price_eur}`);
          if (existing.retail_dzd !== itemPayload.retail_dzd) fieldChanges.push(`Retail: ${existing.retail_dzd} → ${itemPayload.retail_dzd} DA`);
          if (existing.stock_eu !== itemPayload.stock_eu) fieldChanges.push(`Stock EU: ${existing.stock_eu} → ${itemPayload.stock_eu}`);
          if (existing.stock !== itemPayload.stock) fieldChanges.push(`Stock DZ: ${existing.stock} → ${itemPayload.stock}`);

          if (fieldChanges.length > 0) {
            diffs.push({
              item: itemPayload,
              status: 'MODIFIED',
              changesText: fieldChanges.join(" | ")
            });
          }
        }
      }

      if (diffs.length === 0) {
        showToast("No new items or changes detected in CSV", "info");
        return;
      }

      setPendingCsvItems(parsedItems);
      setCsvDiffs(diffs);
      setIsCsvConfirmOpen(true);
    };

    reader.readAsText(file);
    event.target.value = "";
  };

  const handleConfirmSaveCsv = async () => {
    if (!pendingCsvItems.length) return;
    await onSaveBulkItems(pendingCsvItems);
    setIsCsvConfirmOpen(false);
    setPendingCsvItems([]);
    setCsvDiffs([]);
    showToast(`✓ Successfully imported & updated ${pendingCsvItems.length} inventory items!`);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Inventory Manager</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage sellable DZ stock, Europe pool stock, and landed costs.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsBulkRestockOpen(true)}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-all"
          >
            <Euro className="w-4 h-4" />
            <span>💶 Bulk EU Restock</span>
          </button>

          <button
            onClick={() => setIsSpreadsheetMode(!isSpreadsheetMode)}
            className={`flex items-center gap-2 font-semibold text-xs px-3.5 py-2 rounded-xl border transition-all ${
              isSpreadsheetMode
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isSpreadsheetMode ? 'Close Spreadsheet Mode' : '📊 Spreadsheet Mode'}</span>
          </button>

          <label className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs px-3.5 py-2 rounded-xl cursor-pointer shadow-sm transition-all">
            <Upload className="w-4 h-4 text-blue-600" />
            <span>Import CSV</span>
            <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
          </label>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              setEditingItem({ type: activeTab, rate: defaultEurRate });
              setIsAddEditModalOpen(true);
            }}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Sub-tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('supplement')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'supplement' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            💪 Supplements ({inventoryItems.filter(i => i.type === 'supplement').length})
          </button>
          <button
            onClick={() => setActiveTab('snack')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'snack' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            🍪 Snacks ({inventoryItems.filter(i => i.type === 'snack').length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search SKU, brand, or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 transition-all"
          />
        </div>
      </div>

      {/* Inventory Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th onClick={() => toggleSort('id')} className="p-3 cursor-pointer select-none hover:bg-slate-100">SKU ⇅</th>
                <th onClick={() => toggleSort('brand')} className="p-3 cursor-pointer select-none hover:bg-slate-100">Brand ⇅</th>
                <th onClick={() => toggleSort('name')} className="p-3 cursor-pointer select-none hover:bg-slate-100">Product Name ⇅</th>
                <th className="p-3">Variant / Spec</th>
                <th className="p-3">Size</th>
                <th onClick={() => toggleSort('price_eur')} className="p-3 cursor-pointer select-none hover:bg-slate-100">Price (€) ⇅</th>
                <th className="p-3">Rate</th>
                <th className="p-3">Delivery</th>
                <th onClick={() => toggleSort('landed')} className="p-3 cursor-pointer select-none hover:bg-slate-100">Landed (DA) ⇅</th>
                <th onClick={() => toggleSort('retail_dzd')} className="p-3 cursor-pointer select-none hover:bg-slate-100">Retail (DA) ⇅</th>
                <th onClick={() => toggleSort('margin')} className="p-3 cursor-pointer select-none hover:bg-slate-100">Margin ⇅</th>
                <th onClick={() => toggleSort('stock_eu')} className="p-3 text-center cursor-pointer select-none hover:bg-slate-100 text-blue-600">EU ⇅</th>
                <th onClick={() => toggleSort('stock')} className="p-3 text-center cursor-pointer select-none hover:bg-slate-100 text-emerald-600">DZ ⇅</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const landed = calculateLandedCost(item.price_eur, item.rate, item.delivery_dzd);
                const margin = calculateMargin(item.retail_dzd, landed);
                const marginPct = calculateMarginPct(item.retail_dzd, margin).toFixed(1);

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* SKU */}
                    <td className="p-3 font-bold text-slate-900">{item.id}</td>

                    {/* Brand */}
                    <td className="p-3">
                      {isSpreadsheetMode ? (
                        <input
                          type="text"
                          defaultValue={item.brand}
                          onBlur={(e) => handleSpreadsheetChange(item.id, 'brand', e.target.value)}
                          className="w-full bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-xs"
                        />
                      ) : (
                        item.brand || '—'
                      )}
                    </td>

                    {/* Name */}
                    <td className="p-3 font-semibold text-slate-900">
                      {isSpreadsheetMode ? (
                        <input
                          type="text"
                          defaultValue={item.name}
                          onBlur={(e) => handleSpreadsheetChange(item.id, 'name', e.target.value)}
                          className="w-full bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-semibold"
                        />
                      ) : (
                        item.name
                      )}
                    </td>

                    {/* Variant Spec */}
                    <td className="p-3">
                      {isSpreadsheetMode ? (
                        <input
                          type="text"
                          defaultValue={item.variant_spec || ''}
                          onBlur={(e) => handleSpreadsheetChange(item.id, 'variant_spec', e.target.value)}
                          className="w-full bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-xs"
                        />
                      ) : (
                        item.variant_spec || '—'
                      )}
                    </td>

                    {/* Size */}
                    <td className="p-3">
                      {isSpreadsheetMode ? (
                        <input
                          type="text"
                          defaultValue={item.size || ''}
                          onBlur={(e) => handleSpreadsheetChange(item.id, 'size', e.target.value)}
                          className="w-20 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-xs"
                        />
                      ) : (
                        item.size || '—'
                      )}
                    </td>

                    {/* Price EUR */}
                    <td className="p-3 font-semibold">
                      {isSpreadsheetMode ? (
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={item.price_eur}
                          onBlur={(e) => handleSpreadsheetChange(item.id, 'price_eur', parseFloat(e.target.value) || 0)}
                          className="w-16 bg-slate-100 border border-slate-200 rounded px-1 py-0.5 text-xs"
                        />
                      ) : (
                        `${item.price_eur} €`
                      )}
                    </td>

                    {/* Rate */}
                    <td className="p-3 text-slate-500">
                      {isSpreadsheetMode ? (
                        <input
                          type="number"
                          defaultValue={item.rate}
                          onBlur={(e) => handleSpreadsheetChange(item.id, 'rate', parseFloat(e.target.value) || defaultEurRate)}
                          className="w-16 bg-slate-100 border border-slate-200 rounded px-1 py-0.5 text-xs"
                        />
                      ) : (
                        item.rate
                      )}
                    </td>

                    {/* Delivery */}
                    <td className="p-3 text-slate-500">
                      {isSpreadsheetMode ? (
                        <input
                          type="number"
                          defaultValue={item.delivery_dzd}
                          onBlur={(e) => handleSpreadsheetChange(item.id, 'delivery_dzd', parseFloat(e.target.value) || 0)}
                          className="w-16 bg-slate-100 border border-slate-200 rounded px-1 py-0.5 text-xs"
                        />
                      ) : (
                        `${item.delivery_dzd} DA`
                      )}
                    </td>

                    {/* Landed DZD */}
                    <td className="p-3 font-semibold text-slate-700">{Math.round(landed).toLocaleString()} DA</td>

                    {/* Retail DZD */}
                    <td className="p-3 font-bold text-slate-900">
                      {isSpreadsheetMode ? (
                        <input
                          type="number"
                          defaultValue={item.retail_dzd}
                          onBlur={(e) => handleSpreadsheetChange(item.id, 'retail_dzd', parseFloat(e.target.value) || 0)}
                          className="w-20 bg-slate-100 border border-slate-200 rounded px-1 py-0.5 text-xs font-bold"
                        />
                      ) : (
                        `${item.retail_dzd.toLocaleString()} DA`
                      )}
                    </td>

                    {/* Margin */}
                    <td className="p-3 font-bold">
                      <span className={margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {Math.round(margin).toLocaleString()} DA ({marginPct}%)
                      </span>
                    </td>

                    {/* Stock EU */}
                    <td className="p-3 text-center font-bold text-blue-600 bg-blue-50/40">
                      {isSpreadsheetMode ? (
                        <input
                          type="number"
                          defaultValue={item.stock_eu || 0}
                          onBlur={(e) => handleSpreadsheetChange(item.id, 'stock_eu', parseInt(e.target.value) || 0)}
                          className="w-14 text-center bg-blue-100 border border-blue-300 rounded px-1 py-0.5 text-xs font-bold text-blue-700"
                        />
                      ) : (
                        item.stock_eu || 0
                      )}
                    </td>

                    {/* Stock DZ (Sellable) */}
                    <td className="p-3 text-center font-extrabold text-emerald-600 bg-emerald-50/40">
                      {isSpreadsheetMode ? (
                        <input
                          type="number"
                          defaultValue={item.stock || 0}
                          onBlur={(e) => handleSpreadsheetChange(item.id, 'stock', parseInt(e.target.value) || 0)}
                          className="w-14 text-center bg-emerald-100 border border-emerald-300 rounded px-1 py-0.5 text-xs font-extrabold text-emerald-700"
                        />
                      ) : (
                        item.stock || 0
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {item.stock_eu > 0 && (
                          <button
                            onClick={() => {
                              setTransferModalItem(item);
                              setTransferQty(item.stock_eu);
                            }}
                            title="Move Europe stock to Algeria"
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setEditingItem({ ...item });
                            setIsAddEditModalOpen(true);
                          }}
                          title="Edit Item"
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`Delete inventory item [${item.id}]?`)) {
                              onDeleteItem(item.id);
                            }
                          }}
                          title="Delete Item"
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ADD / EDIT INVENTORY ITEM MODAL ── */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingItem?.id ? `Edit Item [${editingItem.id}]` : 'Add Inventory Item'}
              </h3>
              <button onClick={() => setIsAddEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">SKU *</label>
                  <input
                    type="text"
                    disabled={!!editingItem?.id && inventoryItems.some(x => x.id === editingItem.id)}
                    value={editingItem?.id || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, id: e.target.value })}
                    placeholder="SUP-8801"
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Brand</label>
                  <input
                    type="text"
                    value={editingItem?.brand || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, brand: e.target.value })}
                    placeholder="Brand Name"
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Product Name *</label>
                <input
                  type="text"
                  value={editingItem?.name || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  placeholder="Whey Protein Isolate"
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Variant / Spec</label>
                  <input
                    type="text"
                    value={editingItem?.variant_spec || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, variant_spec: e.target.value })}
                    placeholder="Chocolate 2kg"
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Size</label>
                  <input
                    type="text"
                    value={editingItem?.size || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, size: e.target.value })}
                    placeholder="2kg"
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700">Price EUR (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem?.price_eur || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, price_eur: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-900 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Exchange Rate</label>
                  <input
                    type="number"
                    value={editingItem?.rate || defaultEurRate}
                    onChange={(e) => setEditingItem({ ...editingItem, rate: parseFloat(e.target.value) || defaultEurRate })}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Delivery (DA)</label>
                  <input
                    type="number"
                    value={editingItem?.delivery_dzd || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, delivery_dzd: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700">Retail DZD (DA)</label>
                  <input
                    type="number"
                    value={editingItem?.retail_dzd || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, retail_dzd: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-900 font-extrabold"
                  />
                </div>
                <div>
                  <label className="font-bold text-blue-700">EU Stock</label>
                  <input
                    type="number"
                    value={editingItem?.stock_eu || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, stock_eu: parseInt(e.target.value) || 0 })}
                    className="w-full mt-1 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-2 font-black"
                  />
                </div>
                <div>
                  <label className="font-bold text-emerald-700">DZ Stock (Sellable)</label>
                  <input
                    type="number"
                    value={editingItem?.stock || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, stock: parseInt(e.target.value) || 0 })}
                    className="w-full mt-1 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-2 font-black"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={() => setIsAddEditModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl">
                Cancel
              </button>
              <button onClick={handleSaveModalItem} className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white font-semibold text-xs rounded-xl shadow-sm">
                Save Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CSV IMPORT CONFIRMATION MODAL WITH VISUAL DIFF PREVIEW ── */}
      {isCsvConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <span>📥 Confirm CSV Import Changes</span>
              </h3>
              <button onClick={() => setIsCsvConfirmOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs flex items-center justify-between flex-wrap gap-2">
                <div className="text-slate-600 font-medium">
                  Review the detected changes before committing to Supabase database.
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-md">
                    {csvDiffs.filter(d => d.status === 'NEW').length} New
                  </span>
                  <span className="bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-md">
                    {csvDiffs.filter(d => d.status === 'MODIFIED').length} Modified
                  </span>
                </div>
              </div>

              {/* Diff Table */}
              <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 font-bold text-slate-600 sticky top-0">
                    <tr>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Detected Changes (Original → Imported)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvDiffs.map((diff, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{diff.item.id}</td>
                        <td className="p-3 font-medium text-slate-800">
                          {diff.item.brand ? diff.item.brand + ' - ' : ''}{diff.item.name}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            diff.status === 'NEW' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {diff.status}
                          </span>
                        </td>
                        <td className={`p-3 font-medium text-[11.5px] ${diff.status === 'NEW' ? 'text-emerald-700' : 'text-blue-700'}`}>
                          {diff.changesText}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsCsvConfirmOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSaveCsv}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>✅ Save Changes to Inventory</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK EU RESTOCK MODAL ── */}
      {isBulkRestockOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Euro className="w-5 h-5 text-emerald-600" />
                <span>💶 Bulk EU Restock & Weighted Average Calculator</span>
              </h3>
              <button onClick={() => setIsBulkRestockOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Product Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search item to add to restock list..."
                  value={bulkSearchQuery}
                  onChange={(e) => setBulkSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
                {bulkSearchQuery.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-10 divide-y divide-slate-100">
                    {inventoryItems
                      .filter(i => {
                        const q = bulkSearchQuery.toLowerCase();
                        return i.id.toLowerCase().includes(q) || i.name.toLowerCase().includes(q) || (i.brand || '').toLowerCase().includes(q);
                      })
                      .map(item => (
                        <div
                          key={item.id}
                          onClick={() => {
                            addBulkRestockRow(item);
                            setBulkSearchQuery('');
                          }}
                          className="p-3 hover:bg-emerald-50 cursor-pointer text-xs flex justify-between items-center"
                        >
                          <div>
                            <span className="font-bold text-slate-900">[{item.id}]</span> {item.brand ? item.brand + ' - ' : ''}{item.name}
                          </div>
                          <span className="font-semibold text-blue-600">Stock EU: {item.stock_eu} | DZ: {item.stock}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Table of selected items */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-center">Current Total Stock (EU+DZ)</th>
                      <th className="p-3 text-center">+ New EU Qty</th>
                      <th className="p-3 text-center">Purchase € Price</th>
                      <th className="p-3 text-center">New Weighted Avg (€)</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bulkRestockRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          Search above to add items for EU restock.
                        </td>
                      </tr>
                    ) : (
                      bulkRestockRows.map((row, idx) => {
                        const currentTotal = (Number(row.item.stock_eu) || 0) + (Number(row.item.stock) || 0);
                        const weightedAvg = calculateWeightedAverageEurPrice(currentTotal, row.item.price_eur, row.addedQty, row.newPriceEur);

                        return (
                          <tr key={row.sku} className="hover:bg-slate-50">
                            <td className="p-3 font-semibold">[{row.sku}] {row.item.name}</td>
                            <td className="p-3 text-center font-bold text-slate-700">{currentTotal}</td>
                            <td className="p-3 text-center">
                              <input
                                type="number"
                                min="1"
                                value={row.addedQty}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  const next = [...bulkRestockRows];
                                  next[idx].addedQty = val;
                                  setBulkRestockRows(next);
                                }}
                                className="w-16 bg-slate-50 border border-slate-200 rounded p-1 text-center font-bold"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <input
                                type="number"
                                step="0.01"
                                value={row.newPriceEur}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const next = [...bulkRestockRows];
                                  next[idx].newPriceEur = val;
                                  setBulkRestockRows(next);
                                }}
                                className="w-20 bg-slate-50 border border-slate-200 rounded p-1 text-center font-bold"
                              />
                            </td>
                            <td className="p-3 text-center font-black text-emerald-600">{weightedAvg} €</td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => setBulkRestockRows(bulkRestockRows.filter(r => r.sku !== row.sku))}
                                className="text-rose-600 hover:text-rose-800 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Action */}
              <button
                disabled={!bulkRestockRows.length}
                onClick={handleConfirmBulkRestock}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl shadow-sm transition-all"
              >
                Confirm Restocks & Update Weighted Prices
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STOCK TRANSFER MODAL (EU → ALGERIA) ── */}
      {transferModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              <span>Transfer Stock to Algeria</span>
            </h3>
            <p className="text-xs text-slate-500">
              Move units from Europe pool stock to Algeria sellable stock pool for <strong>[{transferModalItem.id}] {transferModalItem.name}</strong>.
            </p>

            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-xs space-y-1">
              <div className="text-blue-900 font-semibold">Available in Europe: {transferModalItem.stock_eu} units</div>
              <div className="text-blue-700">Current Algeria Sellable Stock: {transferModalItem.stock} units</div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">Units Transferred to Algeria</label>
              <input
                type="number"
                min="1"
                max={transferModalItem.stock_eu}
                value={transferQty}
                onChange={(e) => setTransferQty(Math.min(transferModalItem.stock_eu, parseInt(e.target.value) || 0))}
                className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setTransferModalItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStockTransfer}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm"
              >
                Transfer Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
