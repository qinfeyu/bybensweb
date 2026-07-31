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
  FileSpreadsheet,
  RotateCcw,
  Copy,
  Sparkles,
  ListPlus,
  Layers
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

export function getNextSequentialSkuId(baseSku: string, existingItems: InventoryItem[], offset: number = 0): string {
  const cleanBase = baseSku.trim() || 'SUP-1001';
  const match = cleanBase.match(/^(.*?)(\d+)$/);

  if (match) {
    const prefix = match[1];
    const numStr = match[2];
    let num = parseInt(numStr, 10) + offset;
    let candidate = `${prefix}${String(num).padStart(numStr.length, '0')}`;

    while (existingItems.some(i => i.id.toLowerCase() === candidate.toLowerCase())) {
      num += 1;
      candidate = `${prefix}${String(num).padStart(numStr.length, '0')}`;
    }
    return candidate;
  }

  return offset === 0 ? cleanBase : `${cleanBase}-${offset + 1}`;
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

  // Default Sample Data Seeder
  const handleSeedSampleData = async () => {
    const sampleItems: InventoryItem[] = [
      {
        id: 'SUP-8801',
        type: 'supplement',
        brand: 'Optimum Nutrition',
        name: '100% Whey Gold Standard 2.27kg',
        variant_spec: '2.27kg',
        size: '2.27kg',
        price_eur: 55,
        rate: defaultEurRate,
        delivery_dzd: 1200,
        retail_dzd: 19500,
        stock: 12,
        stock_eu: 5
      },
      {
        id: 'SUP-8802',
        type: 'supplement',
        brand: 'Myprotein',
        name: 'Impact Whey Isolate 1kg',
        variant_spec: '1kg',
        size: '1kg',
        price_eur: 32,
        rate: defaultEurRate,
        delivery_dzd: 800,
        retail_dzd: 11500,
        stock: 8,
        stock_eu: 10
      },
      {
        id: 'SUP-8803',
        type: 'supplement',
        brand: 'Creapure',
        name: 'Creatine Monohydrate 250g',
        variant_spec: '250g',
        size: '250g',
        price_eur: 18,
        rate: defaultEurRate,
        delivery_dzd: 500,
        retail_dzd: 6500,
        stock: 20,
        stock_eu: 15
      },
      {
        id: 'SNK-9901',
        type: 'snack',
        brand: 'Barebells',
        name: 'Protein Bar Cookies & Cream 55g',
        variant_spec: '55g',
        size: '55g',
        price_eur: 2.2,
        rate: defaultEurRate,
        delivery_dzd: 100,
        retail_dzd: 850,
        stock: 48,
        stock_eu: 24
      }
    ];

    await onSaveBulkItems(sampleItems);
    showToast("✓ Default inventory items restored!");
  };

  // Bulk Restock Modal State
  const [isBulkRestockOpen, setIsBulkRestockOpen] = useState(false);
  const [bulkRestockTarget, setBulkRestockTarget] = useState<'dz' | 'eu'>('dz');
  const [bulkRestockQtys, setBulkRestockQtys] = useState<Record<string, number>>({});

  // Add / Edit Single Item Modal State
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);

  // CSV Import Confirmation Modal State
  const [isCsvConfirmOpen, setIsCsvConfirmOpen] = useState(false);
  const [csvDiffs, setCsvDiffs] = useState<CsvDiffItem[]>([]);
  const [pendingCsvItems, setPendingCsvItems] = useState<InventoryItem[]>([]);

  // Filter Items by activeTab & searchQuery
  const tabItems = inventoryItems.filter(item => (item.type || 'supplement') === activeTab);

  const filteredItems = tabItems.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.id.toLowerCase().includes(q) ||
      (item.brand || '').toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      (item.variant_spec || '').toLowerCase().includes(q)
    );
  });

  // Sort Items
  const sortedItems = [...filteredItems].sort((a, b) => {
    let aVal: any = a[sortField as keyof InventoryItem];
    let bVal: any = b[sortField as keyof InventoryItem];

    if (sortField === 'landed') {
      aVal = calculateLandedCost(a.price_eur, a.rate, a.delivery_dzd);
      bVal = calculateLandedCost(b.price_eur, b.rate, b.delivery_dzd);
    } else if (sortField === 'margin') {
      const aLanded = calculateLandedCost(a.price_eur, a.rate, a.delivery_dzd);
      const bLanded = calculateLandedCost(b.price_eur, b.rate, b.delivery_dzd);
      aVal = calculateMargin(a.retail_dzd, aLanded);
      bVal = calculateMargin(b.retail_dzd, bLanded);
    }

    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    if (typeof aVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  // Multi-Variant Batch Mode State
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchVariantsText, setBatchVariantsText] = useState('');
  const variantInputRef = useRef<HTMLInputElement>(null);

  // Compute live list of variants entered in Batch mode
  const batchVariantsList = batchVariantsText
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const toggleSort = (field: keyof InventoryItem | 'landed' | 'margin') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Open Modal for Add
  const handleOpenAddModal = () => {
    const nextSku = getNextSequentialSkuId('SUP-1001', inventoryItems, 0);
    setEditingItem({
      id: nextSku,
      type: activeTab,
      brand: '',
      name: '',
      variant_spec: '',
      size: '',
      price_eur: 0,
      rate: defaultEurRate,
      delivery_dzd: 0,
      retail_dzd: 0,
      stock: 0,
      stock_eu: 0
    });
    setIsBatchMode(false);
    setBatchVariantsText('');
    setIsAddEditModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItem({ ...item });
    setIsBatchMode(false);
    setBatchVariantsText('');
    setIsAddEditModalOpen(true);
  };

  // Quick Duplicate / Clone Item
  const handleDuplicateItem = (item: InventoryItem) => {
    const nextSku = getNextSequentialSkuId(item.id, inventoryItems, 1);
    setEditingItem({
      ...item,
      id: nextSku,
      variant_spec: '',
      stock: 0,
      stock_eu: 0
    });
    setIsBatchMode(false);
    setBatchVariantsText('');
    setIsAddEditModalOpen(true);
    showToast(`✓ Cloned ${item.name} into ${nextSku}. Type new variant/flavor.`);
  };

  // Save Modal Item (Single)
  const handleSaveModalItem = async () => {
    if (!editingItem?.id?.trim() || !editingItem?.name?.trim()) {
      showToast("SKU ID and Name are required", "error");
      return;
    }

    const payload: InventoryItem = {
      id: editingItem.id.trim(),
      type: editingItem.type || activeTab,
      brand: editingItem.brand?.trim() || '',
      name: editingItem.name.trim(),
      variant_spec: editingItem.variant_spec?.trim() || null,
      size: editingItem.size?.trim() || null,
      price_eur: Number(editingItem.price_eur) || 0,
      rate: Number(editingItem.rate) || defaultEurRate,
      delivery_dzd: Number(editingItem.delivery_dzd) || 0,
      retail_dzd: Number(editingItem.retail_dzd) || 0,
      stock: Number(editingItem.stock) || 0,
      stock_eu: Number(editingItem.stock_eu) || 0
    };

    await onSaveItem(payload);
    setIsAddEditModalOpen(false);
    showToast("✓ Inventory item saved!");
  };

  // Save & Add Next Variant (Sequential Workflow)
  const handleSaveAndAddNext = async () => {
    if (!editingItem?.id?.trim() || !editingItem?.name?.trim()) {
      showToast("SKU ID and Name are required", "error");
      return;
    }

    const payload: InventoryItem = {
      id: editingItem.id.trim(),
      type: editingItem.type || activeTab,
      brand: editingItem.brand?.trim() || '',
      name: editingItem.name.trim(),
      variant_spec: editingItem.variant_spec?.trim() || null,
      size: editingItem.size?.trim() || null,
      price_eur: Number(editingItem.price_eur) || 0,
      rate: Number(editingItem.rate) || defaultEurRate,
      delivery_dzd: Number(editingItem.delivery_dzd) || 0,
      retail_dzd: Number(editingItem.retail_dzd) || 0,
      stock: Number(editingItem.stock) || 0,
      stock_eu: Number(editingItem.stock_eu) || 0
    };

    await onSaveItem(payload);
    const nextSku = getNextSequentialSkuId(payload.id, [...inventoryItems, payload], 1);

    setEditingItem({
      ...payload,
      id: nextSku,
      variant_spec: '',
      stock: 0,
      stock_eu: 0
    });

    showToast(`✓ Saved ${payload.id}! Ready for next variant/flavor (${nextSku}).`);
    setTimeout(() => {
      if (variantInputRef.current) variantInputRef.current.focus();
    }, 100);
  };

  // Save Batch Variants at Once
  const handleSaveBatchModal = async () => {
    if (!editingItem?.name?.trim()) {
      showToast("Product Name is required for Batch mode", "error");
      return;
    }

    if (batchVariantsList.length === 0) {
      showToast("Please enter at least one variant/flavor name", "error");
      return;
    }

    const baseSku = editingItem.id?.trim() || `SUP-1001`;
    const batchItems: InventoryItem[] = [];
    const tempInv = [...inventoryItems];

    for (let i = 0; i < batchVariantsList.length; i++) {
      const vName = batchVariantsList[i];
      const skuId = getNextSequentialSkuId(baseSku, tempInv, i);
      const newItem: InventoryItem = {
        id: skuId,
        type: editingItem.type || activeTab,
        brand: editingItem.brand?.trim() || '',
        name: editingItem.name.trim(),
        variant_spec: vName,
        size: editingItem.size?.trim() || null,
        price_eur: Number(editingItem.price_eur) || 0,
        rate: Number(editingItem.rate) || defaultEurRate,
        delivery_dzd: Number(editingItem.delivery_dzd) || 0,
        retail_dzd: Number(editingItem.retail_dzd) || 0,
        stock: Number(editingItem.stock) || 0,
        stock_eu: Number(editingItem.stock_eu) || 0
      };

      batchItems.push(newItem);
      tempInv.push(newItem);
    }

    await onSaveBulkItems(batchItems);
    setIsAddEditModalOpen(false);
    setIsBatchMode(false);
    setBatchVariantsText('');
    showToast(`✓ Batch created ${batchItems.length} variant SKUs successfully!`);
  };

  // Spreadsheet Inline Edit Handler
  const handleSpreadsheetChange = async (id: string, field: keyof InventoryItem, value: any) => {
    const existing = inventoryItems.find(x => x.id === id);
    if (!existing) return;

    let parsedVal: any = value;
    if (['price_eur', 'rate', 'delivery_dzd', 'retail_dzd', 'stock', 'stock_eu'].includes(field)) {
      parsedVal = parseFloat(value) || 0;
    }

    const updated: InventoryItem = {
      ...existing,
      [field]: parsedVal
    };

    await onSaveItem(updated);
  };

  // CSV Export Function
  const handleExportCsv = () => {
    const headers = [
      "SKU",
      "Brand",
      "Name",
      "Variant Spec",
      "Size",
      "Price EUR",
      "Rate",
      "Delivery DZD",
      "Retail DZD",
      "Stock EU",
      "Stock DZ",
      "Type"
    ];

    const rows = filteredItems.map(item => [
      `"${item.id}"`,
      `"${(item.brand || '').replace(/"/g, '""')}"`,
      `"${(item.name || '').replace(/"/g, '""')}"`,
      `"${(item.variant_spec || '').replace(/"/g, '""')}"`,
      `"${(item.size || '').replace(/"/g, '""')}"`,
      item.price_eur,
      item.rate,
      item.delivery_dzd,
      item.retail_dzd,
      item.stock_eu || 0,
      item.stock || 0,
      item.type || 'supplement'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventory_export_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("✓ CSV Export downloaded!");
  };

  // CSV Import Parser & Diff Detector
  const handleImportCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      const lines = content.split(/\r\n|\n/).filter(line => line.trim().length > 0);
      if (lines.length <= 1) {
        showToast("CSV file is empty or invalid", "error");
        return;
      }

      // Parse Header
      const headerCols = lines[0].split(",").map(c => c.replace(/^"|"$/g, '').trim().toLowerCase());

      const findIdx = (possibleNames: string[]) => {
        return headerCols.findIndex(c => possibleNames.includes(c));
      };

      const skuIdx = findIdx(["sku", "id"]);
      const brandIdx = findIdx(["brand"]);
      const nameIdx = findIdx(["name", "product name", "product_name"]);
      const varIdx = findIdx(["variant spec", "variant_spec", "variant"]);
      const sizeIdx = findIdx(["size"]);
      const eurIdx = findIdx(["price eur", "price_eur", "price (€)", "price_euro"]);
      const rateIdx = findIdx(["rate"]);
      const delIdx = findIdx(["delivery dzd", "delivery_dzd", "delivery"]);
      const retailIdx = findIdx(["retail dzd", "retail_dzd", "retail (da)", "retail"]);
      const stockEuIdx = findIdx(["stock eu", "stock_eu", "eu"]);
      const stockDzIdx = findIdx(["stock dz", "stock_dz", "stock", "dz"]);
      const typeIdx = findIdx(["type"]);

      if (skuIdx === -1 || nameIdx === -1) {
        showToast("CSV must contain SKU and Name columns", "error");
        return;
      }

      const parseLine = (lineStr: string) => {
        const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
        const matches: string[] = [];
        let m;
        while ((m = regex.exec(lineStr)) !== null) {
          let val = m[1];
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1).replace(/""/g, '"');
          }
          matches.push(val.trim());
        }
        return matches;
      };

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
    showToast(`✓ ${pendingCsvItems.length} CSV inventory items imported and saved!`);
  };

  // Bulk Restock Execution
  const handleConfirmBulkRestock = async () => {
    const itemsToUpdate: InventoryItem[] = [];

    Object.entries(bulkRestockQtys).forEach(([id, addQty]) => {
      if (addQty && addQty !== 0) {
        const item = inventoryItems.find(x => x.id === id);
        if (item) {
          const updated: InventoryItem = {
            ...item,
            stock: bulkRestockTarget === 'dz' ? (item.stock + addQty) : item.stock,
            stock_eu: bulkRestockTarget === 'eu' ? ((item.stock_eu || 0) + addQty) : (item.stock_eu || 0),
            _lastUpdated: new Date().toISOString()
          };
          itemsToUpdate.push(updated);
        }
      }
    });

    if (itemsToUpdate.length > 0) {
      await onSaveBulkItems(itemsToUpdate);
      showToast(`✓ Bulk restock updated ${itemsToUpdate.length} SKUs!`);
    }

    setIsBulkRestockOpen(false);
    setBulkRestockQtys({});
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Inventory Manager</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage SKU pricing, landed costs, EU/DZ stock levels & margin calculations.</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSeedSampleData}
            className="flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-all"
            title="Restore default supplement SKUs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Default SKUs</span>
          </button>

          <button
            onClick={() => setIsBulkRestockOpen(true)}
            className="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs px-3 py-2 rounded-xl shadow-sm transition-all"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Bulk Restock</span>
          </button>

          <button
            onClick={() => setIsSpreadsheetMode(!isSpreadsheetMode)}
            className={`flex items-center gap-1.5 font-semibold text-xs px-3 py-2 rounded-xl border transition-all ${
              isSpreadsheetMode
                ? 'bg-amber-100 border-amber-300 text-amber-900'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isSpreadsheetMode ? 'Exit Excel Edit' : 'Excel Edit Mode'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs px-3 py-2 rounded-xl shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <label className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-3 py-2 rounded-xl shadow-sm cursor-pointer transition-all">
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
            <input type="file" accept=".csv" className="hidden" onChange={handleImportCsv} />
          </label>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 bg-red-700 hover:bg-red-800 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add SKU</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Category Segment Tabs */}
        <div className="flex p-1 bg-slate-100 rounded-xl gap-1 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('supplement')}
            className={`flex-1 sm:flex-none px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'supplement' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Supplements ({inventoryItems.filter(i => (i.type || 'supplement') === 'supplement').length})
          </button>
          <button
            onClick={() => setActiveTab('snack')}
            className={`flex-1 sm:flex-none px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'snack' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Snacks & Bars ({inventoryItems.filter(i => i.type === 'snack').length})
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search SKU, brand, or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
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
              {sortedItems.map((item) => {
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
                          className="w-full bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-bold"
                        />
                      ) : (
                        item.name
                      )}
                    </td>

                    {/* Variant Spec */}
                    <td className="p-3 text-slate-500">{item.variant_spec || '—'}</td>
                    {/* Size */}
                    <td className="p-3 text-slate-500">{item.size || '—'}</td>

                    {/* Price EUR */}
                    <td className="p-3 font-semibold text-slate-900">
                      {isSpreadsheetMode ? (
                        <input
                          type="number"
                          step="0.1"
                          defaultValue={item.price_eur}
                          onBlur={(e) => handleSpreadsheetChange(item.id, 'price_eur', e.target.value)}
                          className="w-16 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-bold"
                        />
                      ) : (
                        `€${item.price_eur.toFixed(2)}`
                      )}
                    </td>

                    {/* Rate */}
                    <td className="p-3 text-slate-500">{item.rate}</td>
                    {/* Delivery */}
                    <td className="p-3 text-slate-500">{item.delivery_dzd} DA</td>

                    {/* Landed DA */}
                    <td className="p-3 font-bold text-slate-900">{landed.toLocaleString()} DA</td>

                    {/* Retail DA */}
                    <td className="p-3 font-extrabold text-slate-900">
                      {isSpreadsheetMode ? (
                        <input
                          type="number"
                          defaultValue={item.retail_dzd}
                          onBlur={(e) => handleSpreadsheetChange(item.id, 'retail_dzd', e.target.value)}
                          className="w-20 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-bold"
                        />
                      ) : (
                        `${item.retail_dzd.toLocaleString()} DA`
                      )}
                    </td>

                    {/* Margin */}
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        margin >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {margin.toLocaleString()} DA ({marginPct}%)
                      </span>
                    </td>

                    {/* EU Stock */}
                    <td className="p-3 text-center">
                      {isSpreadsheetMode ? (
                        <input
                          type="number"
                          defaultValue={item.stock_eu || 0}
                          onBlur={(e) => handleSpreadsheetChange(item.id, 'stock_eu', e.target.value)}
                          className="w-12 text-center bg-blue-50 border border-blue-200 rounded px-1 py-0.5 text-xs font-bold"
                        />
                      ) : (
                        <span className="font-bold text-blue-700">{item.stock_eu || 0}</span>
                      )}
                    </td>

                    {/* DZ Stock */}
                    <td className="p-3 text-center">
                      {isSpreadsheetMode ? (
                        <input
                          type="number"
                          defaultValue={item.stock || 0}
                          onBlur={(e) => handleSpreadsheetChange(item.id, 'stock', e.target.value)}
                          className="w-12 text-center bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 text-xs font-bold"
                        />
                      ) : (
                        <span className="font-bold text-emerald-700">{item.stock || 0}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleDuplicateItem(item)}
                          className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded transition-colors"
                          title="Duplicate / Clone SKU (Add next variant/flavor)"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                          title="Edit SKU"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete SKU [${item.id}]?`)) onDeleteItem(item.id);
                          }}
                          className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded transition-colors"
                          title="Delete SKU"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedItems.length === 0 && (
                <tr>
                  <td colSpan={14} className="p-12 text-center space-y-4">
                    <div className="text-slate-400 font-medium text-sm">
                      No inventory items found for {activeTab}s.
                    </div>
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      <button
                        onClick={handleSeedSampleData}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-sm flex items-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Restore Default Inventory SKUs</span>
                      </button>
                      <label className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        <span>Import Inventory CSV File</span>
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportCsv} />
                      </label>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CSV CONFIRMATION & DIFF PREVIEW MODAL ── */}
      {isCsvConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Confirm CSV Import & Changes</h3>
                <p className="text-xs text-slate-500 mt-0.5">Review detected updates before committing changes to inventory.</p>
              </div>
              <button onClick={() => setIsCsvConfirmOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
              {csvDiffs.map((diff, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border ${
                    diff.status === 'NEW'
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50/60 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="font-bold mb-1 flex items-center justify-between">
                    <span>{diff.item.brand ? diff.item.brand + ' - ' : ''}{diff.item.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      diff.status === 'NEW' ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
                    }`}>
                      {diff.status}
                    </span>
                  </div>
                  <div className="font-medium text-xs opacity-90">{diff.changesText}</div>
                </div>
              ))}
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button
                onClick={() => setIsCsvConfirmOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSaveCsv}
                className="px-6 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save All Changes ({pendingCsvItems.length} SKUs)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK RESTOCK MODAL ── */}
      {isBulkRestockOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Bulk Restock Inventory</h3>
                <p className="text-xs text-slate-500 mt-0.5">Quickly add quantities to EU or DZ stock across multiple SKUs.</p>
              </div>
              <button onClick={() => setIsBulkRestockOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-700">Target Warehouse Stock:</span>
                <button
                  onClick={() => setBulkRestockTarget('dz')}
                  className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${
                    bulkRestockTarget === 'dz' ? 'bg-emerald-100 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  DZ Stock (Sellable)
                </button>
                <button
                  onClick={() => setBulkRestockTarget('eu')}
                  className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${
                    bulkRestockTarget === 'eu' ? 'bg-blue-100 border-blue-300 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  EU Stock
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 font-bold text-slate-600">
                    <tr>
                      <th className="p-2.5">SKU</th>
                      <th className="p-2.5">Product</th>
                      <th className="p-2.5 text-center">Current Stock</th>
                      <th className="p-2.5 text-center">Add Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tabItems.map(item => (
                      <tr key={item.id}>
                        <td className="p-2.5 font-bold">{item.id}</td>
                        <td className="p-2.5">{item.brand ? item.brand + ' - ' : ''}{item.name}</td>
                        <td className="p-2.5 text-center font-bold">
                          {bulkRestockTarget === 'dz' ? item.stock : (item.stock_eu || 0)}
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            placeholder="+0"
                            value={bulkRestockQtys[item.id] || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setBulkRestockQtys({ ...bulkRestockQtys, [item.id]: val });
                            }}
                            className="w-16 text-center bg-slate-50 border border-slate-200 rounded p-1 text-xs font-bold"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button
                onClick={() => setIsBulkRestockOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBulkRestock}
                className="px-6 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Bulk Restock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT ITEM MODAL ── */}
      {isAddEditModalOpen && editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingItem.id ? `Edit SKU — ${editingItem.id}` : 'Add Inventory SKU'}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">Configure product specs, landed cost, and stock quantities</p>
              </div>

              <div className="flex items-center gap-2">
                {/* Batch Add Mode Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsBatchMode(!isBatchMode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isBatchMode
                      ? 'bg-purple-700 text-white shadow-sm'
                      : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                  }`}
                  title="Add multiple flavors or variants at once with shared pricing"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isBatchMode ? 'Batch Mode ON' : 'Multi-Variant Mode'}</span>
                </button>

                <button onClick={() => setIsAddEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">SKU Code (Base ID) *</label>
                  <input
                    type="text"
                    value={editingItem.id || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, id: e.target.value })}
                    placeholder="e.g. SUP-8801"
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Brand</label>
                  <input
                    type="text"
                    value={editingItem.brand || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, brand: e.target.value })}
                    placeholder="e.g. Optimum Nutrition"
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Product Name *</label>
                <input
                  type="text"
                  value={editingItem.name || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  placeholder="e.g. 100% Whey Gold Standard"
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
                />
              </div>

              {/* Variant / Spec Input: Single Mode vs Multi-Variant Batch Mode */}
              {isBatchMode ? (
                <div className="p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-purple-950 flex items-center gap-1.5 text-xs">
                      <ListPlus className="w-4 h-4 text-purple-700" />
                      <span>Variants / Flavors List (comma-separated or line by line) *</span>
                    </label>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                      Auto-Generates Sequential SKUs
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="e.g. Chocolate, Vanilla, Cookies & Cream&#10;or type one per line"
                    value={batchVariantsText}
                    onChange={(e) => setBatchVariantsText(e.target.value)}
                    className="w-full bg-white border border-purple-300 rounded-xl p-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600/20"
                  />

                  {/* Batch Live Preview */}
                  {batchVariantsList.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="font-bold text-[11px] text-purple-900 block">
                        Preview: Creating {batchVariantsList.length} SKUs automatically:
                      </span>
                      <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                        {batchVariantsList.map((vName, idx) => {
                          const skuId = getNextSequentialSkuId(editingItem.id || 'SUP-1001', inventoryItems, idx);
                          return (
                            <div key={idx} className="flex items-center justify-between bg-white border border-purple-200 px-3 py-1.5 rounded-xl text-[11px]">
                              <span className="font-extrabold text-purple-900">{skuId}</span>
                              <span className="font-semibold text-slate-700">
                                {editingItem.brand ? editingItem.brand + ' - ' : ''}{editingItem.name || 'Product'} <span className="font-bold text-purple-800">({vName})</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700">Variant / Spec (Flavor / Weight)</label>
                    <input
                      ref={variantInputRef}
                      type="text"
                      value={editingItem.variant_spec || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, variant_spec: e.target.value })}
                      placeholder="e.g. Chocolate / 2.27kg"
                      className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700">Container Size</label>
                    <input
                      type="text"
                      value={editingItem.size || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, size: e.target.value })}
                      placeholder="e.g. 2.27kg"
                      className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Price (€)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingItem.price_eur || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, price_eur: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Rate</label>
                  <input
                    type="number"
                    value={editingItem.rate || defaultEurRate}
                    onChange={(e) => setEditingItem({ ...editingItem, rate: parseFloat(e.target.value) || defaultEurRate })}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Delivery (DA)</label>
                  <input
                    type="number"
                    value={editingItem.delivery_dzd || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, delivery_dzd: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Retail Price (DA)</label>
                  <input
                    type="number"
                    value={editingItem.retail_dzd || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, retail_dzd: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-extrabold text-emerald-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 text-blue-700">EU Stock</label>
                  <input
                    type="number"
                    value={editingItem.stock_eu || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, stock_eu: parseInt(e.target.value) || 0 })}
                    className="w-full mt-1 bg-blue-50 border border-blue-200 rounded-xl p-2.5 font-bold text-blue-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 text-emerald-700">DZ Stock</label>
                  <input
                    type="number"
                    value={editingItem.stock || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, stock: parseInt(e.target.value) || 0 })}
                    className="w-full mt-1 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 font-bold text-emerald-900"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsAddEditModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                {isBatchMode ? (
                  <button
                    type="button"
                    onClick={handleSaveBatchModal}
                    className="px-6 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Batch Save ({batchVariantsList.length} SKUs)</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveAndAddNext}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
                      title="Save this SKU and keep modal open with pre-filled details to quickly add the next variant/flavor"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Save & Next Variant</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveModalItem}
                      className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Save SKU</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
