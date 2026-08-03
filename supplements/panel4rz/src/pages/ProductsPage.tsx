import React, { useState, useRef, useEffect } from 'react';
import type { Product, InventoryItem, ProductVariant, BundleItem, Category, SubCategory, PromoCode } from '../types';
import { uploadToCloudinary } from '../lib/cloudinary';
import { 
  Boxes, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  X, 
  Check, 
  Image as ImageIcon, 
  Sparkles,
  Upload,
  Star,
  Loader2,
  Bold,
  Italic,
  Underline,
  List,
  RemoveFormatting,
  Eye,
  EyeOff,
  Filter
} from 'lucide-react';

interface SearchableSkuSelectProps {
  value: string;
  onChange: (sku: string) => void;
  inventoryItems: InventoryItem[];
}

export const SearchableSkuSelect: React.FC<SearchableSkuSelectProps> = ({
  value,
  onChange,
  inventoryItems
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedItem = inventoryItems.find(inv => String(inv.id).trim().toLowerCase() === (value || '').trim().toLowerCase());

  const filtered = inventoryItems.filter(inv => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      String(inv.id).toLowerCase().includes(q) ||
      (inv.name || '').toLowerCase().includes(q) ||
      (inv.brand || '').toLowerCase().includes(q) ||
      (inv.variant_spec || inv.size || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative w-full" ref={containerRef}>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setIsOpen(true);
          }}
          className={`w-full text-center text-[10px] font-mono font-bold border rounded px-1.5 py-1 transition-all flex items-center justify-between gap-1 truncate ${
            value
              ? 'border-blue-300 text-blue-900 bg-blue-50/70 hover:bg-blue-100/80 shadow-2xs'
              : 'border-slate-300 text-slate-500 bg-white hover:border-slate-400'
          }`}
          title={selectedItem ? `${selectedItem.id}: ${selectedItem.name} (${selectedItem.stock} DZ)` : 'Click to search & link SKU'}
        >
          <span className="truncate flex-1 text-center font-extrabold">
            {selectedItem ? `${selectedItem.id}` : (value ? value : '-- Link SKU --')}
          </span>
          <Search className="w-3 h-3 text-slate-400 shrink-0" />
        </button>
      ) : (
        <div className="absolute left-1/2 -translate-x-1/2 top-0 z-50 w-64 sm:w-72 bg-white border border-slate-300 rounded-xl shadow-2xl p-2 space-y-1.5 text-xs animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 px-0.5">
            <span className="font-extrabold text-[11px] text-slate-900 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-red-600" />
              <span>Search Inventory SKU</span>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder="Type SKU code, name, or brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-2.5 pr-2 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/50">
            <div
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="p-1.5 hover:bg-slate-100 cursor-pointer text-[10px] text-slate-500 font-bold text-center"
            >
              🚫 Clear SKU Link
            </div>

            {filtered.length === 0 ? (
              <div className="p-3 text-[11px] text-slate-400 text-center space-y-1">
                <div>No matching inventory SKU found</div>
                {search.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(search.trim().toUpperCase());
                      setIsOpen(false);
                    }}
                    className="text-red-700 hover:text-red-800 underline font-bold block mx-auto text-[10px]"
                  >
                    Use custom SKU: "{search.trim().toUpperCase()}"
                  </button>
                )}
              </div>
            ) : (
              filtered.map(inv => {
                const isSelected = value.toLowerCase() === inv.id.toLowerCase();
                return (
                  <div
                    key={inv.id}
                    onClick={() => {
                      onChange(inv.id);
                      setIsOpen(false);
                    }}
                    className={`p-2 hover:bg-red-50/80 cursor-pointer transition-colors ${
                      isSelected ? 'bg-red-50 font-bold border-l-2 border-red-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-black text-blue-700">{inv.id}</span>
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        Stock: {inv.stock} DZ
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-900 font-bold truncate mt-0.5">{inv.name}</div>
                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-medium mt-0.5">
                      <span>{inv.brand || 'No Brand'}</span>
                      <span>{inv.variant_spec || inv.size || ''}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface ProductsPageProps {
  products: Product[];
  inventoryItems: InventoryItem[];
  categories?: Category[];
  subCategories?: SubCategory[];
  promoCodes?: PromoCode[];
  onSaveProduct: (prod: Product) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ── RICH TEXT EDITOR COMPONENT WITH CLOUDINARY IMAGE INSERTION ──
const RichTextEditor: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isUploadingImg, setIsUploadingImg] = useState(false);

  const format = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const handleInlineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImg(true);
    try {
      const url = await uploadToCloudinary(file);
      format('insertImage', url);
    } catch (err: any) {
      alert("Image upload error: " + err.message);
    } finally {
      setIsUploadingImg(false);
      e.target.value = "";
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 focus-within:ring-2 focus-within:ring-red-600/20">
      <div className="flex items-center gap-1 bg-slate-100 p-1.5 border-b border-slate-200 text-xs flex-wrap">
        <button type="button" onClick={() => format('bold')} className="p-1.5 hover:bg-slate-200 rounded text-slate-700 font-bold" title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => format('italic')} className="p-1.5 hover:bg-slate-200 rounded text-slate-700 italic" title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => format('underline')} className="p-1.5 hover:bg-slate-200 rounded text-slate-700 underline" title="Underline">
          <Underline className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <button type="button" onClick={() => format('insertUnorderedList')} className="p-1.5 hover:bg-slate-200 rounded text-slate-700" title="Bullet List">
          <List className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => format('removeFormat')} className="p-1.5 hover:bg-slate-200 rounded text-slate-500" title="Clear Formatting">
          <RemoveFormatting className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <label className="p-1.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer flex items-center gap-1 font-semibold" title="Upload Image to Cloudinary and Insert">
          {isUploadingImg ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" /> : <Upload className="w-3.5 h-3.5 text-blue-600" />}
          <span>Insert Image</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleInlineImageUpload} disabled={isUploadingImg} />
        </label>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: value || '' }}
        className="p-3 text-xs text-slate-900 min-h-[90px] max-h-[300px] overflow-y-auto focus:outline-none space-y-2 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:shadow-sm [&_img]:my-2"
      />
    </div>
  );
};

export const ProductsPage: React.FC<ProductsPageProps> = ({
  products,
  inventoryItems,
  categories = [],
  subCategories = [],
  promoCodes = [],
  onSaveProduct,
  onDeleteProduct,
  showToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'instock' | 'outstock'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');

  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Form tab state in modal
  const [modalTab, setModalTab] = useState<'basic' | 'images' | 'categories' | 'variants' | 'bundle'>('basic');

  // Images & Cloudinary Upload state
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Categories & Promos state
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([]);
  const [selectedSubCatIds, setSelectedSubCatIds] = useState<string[]>([]);
  const [selectedPromoIds, setSelectedPromoIds] = useState<string[]>([]);

  // Bundle Items state
  const [isBundle, setIsBundle] = useState<boolean>(false);
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [bundleSearchQuery, setBundleSearchQuery] = useState<string>('');
  const [isBundleSearchOpen, setIsBundleSearchOpen] = useState<boolean>(false);
  const [bundleQty, setBundleQty] = useState<number>(1);

  // Variant Matrix Editor States
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [flavors, setFlavors] = useState<string[]>([]);
  const [flavorImages, setFlavorImages] = useState<Record<string, string>>({});
  const [flavorStockMatrix, setFlavorStockMatrix] = useState<Record<string, number>>({});
  const [flavorSkuMatrix, setFlavorSkuMatrix] = useState<Record<string, string>>({});
  const [previewVariantImgIdx, setPreviewVariantImgIdx] = useState<number | null>(null);

  const filteredProducts = products.filter(p => {
    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match = p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    // Availability Filter
    if (availabilityFilter === 'instock' && (Number(p.stock) || 0) <= 0) return false;
    if (availabilityFilter === 'outstock' && (Number(p.stock) || 0) > 0) return false;

    // Visibility Filter
    if (visibilityFilter === 'visible' && p.hidden === true) return false;
    return true;
  });

  // Product Selection Helpers
  const isAllSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.includes(p.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkStatusProducts = async (newStatus: 'active' | 'draft' | 'archived') => {
    if (selectedProductIds.length === 0) return;
    const count = selectedProductIds.length;
    try {
      for (const id of selectedProductIds) {
        const target = products.find(p => p.id === id);
        if (target) {
          await onSaveProduct({ ...target, status: newStatus });
        }
      }
      setSelectedProductIds([]);
      showToast(`✓ Updated ${count} products to ${newStatus}`);
    } catch (e) {
      showToast("Error updating selected products", "error");
    }
  };

  const handleBulkDeleteProducts = async () => {
    if (selectedProductIds.length === 0) return;
    const count = selectedProductIds.length;
    if (!confirm(`Are you sure you want to delete ${count} selected products?`)) return;
    try {
      for (const id of selectedProductIds) {
        await onDeleteProduct(id);
      }
      setSelectedProductIds([]);
      showToast(`✓ Deleted ${count} products`);
    } catch (e) {
      showToast("Error deleting selected products", "error");
    }
  };

  const openEditor = (prod?: Product) => {
    if (prod) {
      setEditingProduct({ ...prod });
      
      const imgs = Array.isArray(prod.imageUrl) ? [...prod.imageUrl] : (prod.imageUrl ? [prod.imageUrl] : []);
      setImageUrls(imgs);
      
      setSelectedCatIds(prod.categoryIds || []);
      setSelectedSubCatIds(prod.subCategoryIds || []);
      setSelectedPromoIds(prod.promoCodeIds || []);

      const isB = !!(prod.bundleItems && prod.bundleItems.length > 0);
      setIsBundle(isB);
      setBundleItems(isB ? JSON.parse(JSON.stringify(prod.bundleItems)) : []);

      const initialVariants = (prod.variants || []).map((v: any) => ({
        weight: v.weight ? String(v.weight) : (v.label || v.name || ''),
        unit: v.unit || 'kg',
        price: Number(v.price) || 0,
        cost: Number(v.cost) || 0,
        stock: Number(v.stock) || 0,
        sku: v.sku || '',
        imageIndex: v.imageIndex !== undefined ? Number(v.imageIndex) : 0,
        flavorStock: v.flavorStock || {},
        flavorSkus: v.flavorSkus || {}
      }));

      const initialFlavors = (prod.flavors || []).map((f: any) => 
        typeof f === 'object' ? (f.name || f.label || String(f)) : String(f)
      );

      setVariants(initialVariants);
      setFlavors(initialFlavors);
      setFlavorImages((() => {
        const fi = (prod as any).flavorImages;
        if (!fi) return {};
        if (typeof fi === 'object' && !Array.isArray(fi)) return fi;
        try { const p2 = JSON.parse(String(fi)); return (p2 && typeof p2 === 'object' && !Array.isArray(p2)) ? p2 : {}; } catch(e) { return {}; }
      })());

      // Reconstruct matrix values from variant flavorStock & flavorSkus (auto-syncing live SKU stock)
      const matrix: Record<string, number> = {};
      const skuMatrix: Record<string, string> = {};
      initialVariants.forEach((v: ProductVariant, vIdx: number) => {
        if (v.flavorSkus) {
          Object.entries(v.flavorSkus).forEach(([flv, sCode]) => {
            const skuVal = String(sCode || '').trim();
            skuMatrix[`${vIdx}_${flv}`] = skuVal;
            if (skuVal) {
              const matchedInv = inventoryItems.find(inv => inv.id.trim().toLowerCase() === skuVal.toLowerCase());
              if (matchedInv) {
                matrix[`${vIdx}_${flv}`] = Number(matchedInv.stock) || 0;
              }
            }
          });
        }
        if (v.flavorStock) {
          Object.entries(v.flavorStock).forEach(([flv, qty]) => {
            if (matrix[`${vIdx}_${flv}`] === undefined) {
              matrix[`${vIdx}_${flv}`] = Number(qty) || 0;
            }
          });
        }
      });
      setFlavorStockMatrix(matrix);
      setFlavorSkuMatrix(skuMatrix);
    } else {
      setEditingProduct({
        id: `prod_${Date.now()}`,
        name: '',
        brand: '',
        description: '',
        nutritionalFacts: '',
        benefits: '',
        discount: 0,
        stock: 0,
        status: 'active',
        hidden: false,
        allowPromo: true
      });
      setImageUrls([]);
      setSelectedCatIds([]);
      setSelectedSubCatIds([]);
      setSelectedPromoIds([]);
      setIsBundle(false);
      setBundleItems([]);
      setVariants([]);
      setFlavors([]);
      setFlavorStockMatrix({});
      setFlavorSkuMatrix({});
    }

    setPreviewVariantImgIdx(null);
    setModalTab('basic');
    setIsModalOpen(true);
  };

  // Toggle Hide / Show Product on storefront
  const handleToggleHideProduct = async (prod: Product) => {
    const updated = { ...prod, hidden: !prod.hidden };
    await onSaveProduct(updated);
    showToast(updated.hidden ? "✓ Product hidden from storefront" : "✓ Product now visible on storefront");
  };

  // Image Gallery & Cloudinary Handlers
  const handleAddImageUrl = () => {
    if (!newImageUrl.trim()) return;
    setImageUrls([...imageUrls, newImageUrl.trim()]);
    setNewImageUrl('');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setImageUrls(prev => [...prev, url]);
      showToast("✓ Image uploaded to Cloudinary!");
    } catch (err: any) {
      showToast("Upload error: " + err.message, "error");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleVariantImageUpload = async (vIdx: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadToCloudinary(file);
      setImageUrls(prev => {
        const nextImgs = [...prev, url];
        const newImgIdx = nextImgs.length - 1;
        setVariants(vPrev => {
          const nextV = [...vPrev];
          nextV[vIdx].imageIndex = newImgIdx;
          return nextV;
        });
        return nextImgs;
      });
      showToast("✓ Variant image uploaded and linked!");
    } catch (err: any) {
      showToast("Upload error: " + err.message, "error");
    } finally {
      event.target.value = "";
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const handleSetPrimaryImage = (index: number) => {
    const next = [...imageUrls];
    const target = next.splice(index, 1)[0];
    next.unshift(target);
    setImageUrls(next);
    showToast("✓ Set as primary image");
  };

  // Category Checkbox Handlers
  const toggleCategory = (catId: string) => {
    if (selectedCatIds.includes(catId)) {
      setSelectedCatIds(selectedCatIds.filter(id => id !== catId));
    } else {
      setSelectedCatIds([...selectedCatIds, catId]);
    }
  };

  const toggleSubCategory = (subCatId: string) => {
    if (selectedSubCatIds.includes(subCatId)) {
      setSelectedSubCatIds(selectedSubCatIds.filter(id => id !== subCatId));
    } else {
      setSelectedSubCatIds([...selectedSubCatIds, subCatId]);
    }
  };

  const togglePromoCode = (promoId: string) => {
    if (selectedPromoIds.includes(promoId)) {
      setSelectedPromoIds(selectedPromoIds.filter(id => id !== promoId));
    } else {
      setSelectedPromoIds([...selectedPromoIds, promoId]);
    }
  };

  // Master candidate aggregator for bundle component selection (Search by SKU / Product Name / Brand)
  const getBundleCandidates = () => {
    const candidates: Array<{
      id: string;
      sku: string;
      name: string;
      brand: string;
      variant?: string;
      flavor?: string;
      price: number;
      cost: number;
      stock: number;
    }> = [];

    // 1. Include Inventory SKUs
    (inventoryItems || []).forEach(inv => {
      const euroRate = 280;
      const retailPrice = Number(inv.retail_dzd || 0);
      const eurCost = Number(inv.price_eur || 0);
      const deliveryCost = Number(inv.delivery_dzd || 0);
      const calcCost = Math.round(eurCost * euroRate + deliveryCost);

      candidates.push({
        id: inv.id,
        sku: inv.id,
        name: inv.name,
        brand: inv.brand || '',
        variant: inv.variant_spec || inv.size || '',
        price: retailPrice,
        cost: calcCost,
        stock: Number(inv.stock || 0)
      });
    });

    // 2. Include Catalog Products & Variants
    (products || []).forEach(p => {
      if (p.id === editingProduct?.id) return; // Exclude self

      const defaultPrice = p.price || (p.variants && p.variants[0] ? p.variants[0].price : 0);
      const defaultCost = p.cost || (p.variants && p.variants[0] ? p.variants[0].cost : 0);

      if (p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          const vLabel = v.weight ? `${v.weight}${v.unit || ''}` : (v.label || v.name || '');
          const vPrice = Number(v.price || defaultPrice);
          const vCost = Number(v.cost || defaultCost);

          if (v.flavorStock && Object.keys(v.flavorStock).length > 0) {
            Object.entries(v.flavorStock).forEach(([fName, fQty]) => {
              const fSku = (v.flavorSkus && v.flavorSkus[fName]) || v.sku || p.id;
              candidates.push({
                id: `${p.id}_${vLabel}_${fName}`,
                sku: fSku,
                name: `${p.name} (${fName})`,
                brand: p.brand || '',
                variant: vLabel,
                flavor: fName,
                price: vPrice,
                cost: vCost,
                stock: Number(fQty) || 0
              });
            });
          } else {
            candidates.push({
              id: `${p.id}_${vLabel}`,
              sku: v.sku || p.id,
              name: `${p.name} (${vLabel})`,
              brand: p.brand || '',
              variant: vLabel,
              price: vPrice,
              cost: vCost,
              stock: Number(v.stock) || 0
            });
          }
        });
      } else {
        candidates.push({
          id: p.id,
          sku: p.sku || p.id,
          name: p.name,
          brand: p.brand || '',
          price: Number(defaultPrice),
          cost: Number(defaultCost),
          stock: Number(p.stock || 0)
        });
      }
    });

    return candidates;
  };

  const handleAddBundleCandidate = (candidate: ReturnType<typeof getBundleCandidates>[0]) => {
    const existingIdx = bundleItems.findIndex(
      b => (b.sku && b.sku === candidate.sku) || (b.productId === candidate.id && b.variant === candidate.variant && b.flavor === candidate.flavor)
    );

    if (existingIdx >= 0) {
      const next = [...bundleItems];
      next[existingIdx].qty += bundleQty;
      setBundleItems(next);
    } else {
      setBundleItems([
        ...bundleItems,
        {
          productId: candidate.id,
          sku: candidate.sku,
          name: candidate.name,
          brand: candidate.brand,
          variant: candidate.variant,
          flavor: candidate.flavor,
          price: candidate.price,
          cost: candidate.cost,
          qty: bundleQty
        }
      ]);
    }

    setBundleSearchQuery('');
    setIsBundleSearchOpen(false);
    setBundleQty(1);
  };

  // Calculate composite bundle stock based on component inventory
  const calculateBundleStock = () => {
    if (!bundleItems || !bundleItems.length) return 0;
    let minStock = Infinity;

    bundleItems.forEach(b => {
      const bQty = Number(b.qty) || 1;
      let componentStock = 0;

      const invMatch = inventoryItems.find(i => 
        String(i.id).trim().toLowerCase() === String(b.sku || b.productId || '').trim().toLowerCase()
      );

      if (invMatch) {
        componentStock = Number(invMatch.stock) || 0;
      } else {
        const prodMatch = products.find(p => p.id === b.productId);
        if (prodMatch) {
          componentStock = Number(prodMatch.stock) || 0;
        }
      }

      minStock = Math.min(minStock, Math.floor(componentStock / bQty));
    });

    return minStock === Infinity ? 0 : Math.max(0, minStock);
  };

  const handleSave = async () => {
    if (!editingProduct?.name?.trim()) {
      showToast("Product name is required", "error");
      return;
    }

    let updatedVariants: ProductVariant[] = [];
    let computedStock = 0;

    if (isBundle) {
      computedStock = calculateBundleStock();
      const bPrice = Number(editingProduct.price || 0);
      const bCost = bundleItems.reduce((s, i) => s + (Number(i.cost || 0) * Number(i.qty || 1)), 0);
      updatedVariants = [{
        weight: '1',
        unit: 'pack',
        label: 'Bundle Pack',
        price: bPrice,
        cost: bCost,
        stock: computedStock,
        sku: editingProduct.id || ''
      }];
    } else {
      updatedVariants = variants.map((v, vIdx) => {
        const fStock: Record<string, number> = {};
        const fSkus: Record<string, string> = {};
        let varTotalStock = 0;

        if (flavors.length > 0) {
          flavors.forEach(f => {
            const fName = typeof f === 'object' ? (f as any).name : String(f);
            const cellKey = `${vIdx}_${fName}`;
            let qty = flavorStockMatrix[cellKey];
            const linkedSku = (flavorSkuMatrix[cellKey] || '').trim();

            if ((qty === undefined || qty === null) && linkedSku) {
              const matchedInv = inventoryItems.find(i => String(i.id).trim().toLowerCase() === linkedSku.toLowerCase());
              if (matchedInv) qty = Number(matchedInv.stock) || 0;
            }
            qty = Number(qty) || 0;

            fStock[fName] = qty;
            if (linkedSku) fSkus[fName] = linkedSku;
            varTotalStock += qty;
          });
        } else {
          varTotalStock = Number(v.stock) || 0;
        }

        return {
          ...v,
          stock: varTotalStock,
          flavorStock: flavors.length > 0 ? fStock : undefined,
          flavorSkus: flavors.length > 0 && Object.keys(fSkus).length > 0 ? fSkus : undefined
        };
      });

      computedStock = updatedVariants.length > 0 
        ? updatedVariants.reduce((s, v) => s + (v.stock || 0), 0)
        : Number(editingProduct.stock) || 0;
    }

    const payload: Product = {
      ...(editingProduct as Product),
      price: isBundle ? Number(editingProduct.price || 0) : editingProduct.price,
      imageUrl: imageUrls,
      categoryIds: selectedCatIds,
      subCategoryIds: selectedSubCatIds,
      promoCodeIds: selectedPromoIds,
      bundleItems: isBundle ? bundleItems : [],
      variants: updatedVariants,
      flavors: isBundle ? [] : flavors,
      flavorImages: isBundle ? {} : flavorImages,
      stock: computedStock,
      status: editingProduct.status || 'active',
      hidden: editingProduct.hidden || false
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
          <p className="text-xs text-slate-500 mt-0.5">Manage storefront products, hide/show items, stock matrices, categories & bundles.</p>
        </div>

        <button
          onClick={() => openEditor()}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search catalog products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto">
          {/* Availability Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value as any)}
              className="bg-transparent font-semibold text-slate-700 text-xs focus:outline-none pr-1"
            >
              <option value="all">All Availability</option>
              <option value="instock">In Stock Only</option>
              <option value="outstock">Out of Stock</option>
            </select>
          </div>

          {/* Visibility Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as any)}
              className="bg-transparent font-semibold text-slate-700 text-xs focus:outline-none px-1"
            >
              <option value="all">All Visibility</option>
              <option value="visible">Visible Only</option>
              <option value="hidden">Hidden Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Select All Bar */}
      {filteredProducts.length > 0 && (
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
            />
            <span>Select All Catalog Products ({filteredProducts.length})</span>
          </label>
          {selectedProductIds.length > 0 && (
            <span className="text-[11px] font-black text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
              {selectedProductIds.length} selected
            </span>
          )}
        </div>
      )}

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map(prod => {
          const mainImg = Array.isArray(prod.imageUrl) ? prod.imageUrl[0] : prod.imageUrl;
          const isSelected = selectedProductIds.includes(prod.id);

          return (
            <div key={prod.id} className={`bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all space-y-3 relative ${
              isSelected
                ? 'border-red-500 bg-red-50/20 ring-2 ring-red-500/20'
                : prod.hidden
                ? 'border-amber-300 bg-amber-50/20'
                : 'border-slate-200/80'
            }`}>
              <div className="flex gap-3">
                <div className="flex flex-col items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectProduct(prod.id)}
                    className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <div className="w-14 h-14 bg-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-slate-200">
                    {mainImg ? (
                      <img src={mainImg} alt={prod.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{prod.brand || 'No Brand'}</span>
                  <h3 className="font-bold text-slate-900 text-sm truncate">{prod.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                      prod.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {prod.status}
                    </span>
                    {prod.hidden && (
                      <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                        <EyeOff className="w-3 h-3" /> Hidden
                      </span>
                    )}
                    {prod.bundleItems && prod.bundleItems.length > 0 && (
                      <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Bundle
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                <div>
                  Variants: <strong className="text-slate-900">{prod.variants?.length || 0}</strong> | Flavors: <strong className="text-slate-900">{prod.flavors?.length || 0}</strong>
                </div>
                <div className={`font-extrabold ${prod.stock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  Stock: {prod.stock}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {/* Hide / Show Storefront Toggle */}
                <button
                  onClick={() => handleToggleHideProduct(prod)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    prod.hidden ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title={prod.hidden ? "Click to show on storefront" : "Click to hide from storefront"}
                >
                  {prod.hidden ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{prod.hidden ? 'Hidden' : 'Visible'}</span>
                </button>

                <div className="flex items-center gap-1.5">
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
            </div>
          );
        })}
      </div>

      {/* Floating Bulk Action Bar for Products */}
      {selectedProductIds.length > 0 && (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between gap-3 max-w-lg w-[92vw] animate-in slide-in-from-bottom-4">
          <span className="text-xs font-black bg-red-600 px-2.5 py-1 rounded-lg shrink-0">
            {selectedProductIds.length} Selected
          </span>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusProducts(e.target.value as 'active' | 'draft' | 'archived');
                  e.target.value = '';
                }
              }}
              className="bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="">Bulk Set Status...</option>
              <option value="active">🟢 Active</option>
              <option value="draft">🟡 Draft</option>
              <option value="archived">⚪ Archived</option>
            </select>

            <button
              onClick={handleBulkDeleteProducts}
              className="px-3.5 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedProductIds.length})</span>
            </button>
          </div>

          <button
            onClick={() => setSelectedProductIds([])}
            className="text-slate-400 hover:text-white p-1 rounded-lg shrink-0"
            title="Clear Selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── EDIT / ADD PRODUCT FULL MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-base">
                {editingProduct?.id ? `Edit Product — ${editingProduct.name}` : 'Add Product'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-100/60 px-5 gap-1 text-xs font-bold overflow-x-auto">
              <button
                onClick={() => setModalTab('basic')}
                className={`py-3 px-4 border-b-2 transition-all whitespace-nowrap ${
                  modalTab === 'basic' ? 'border-red-700 text-red-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                1. Basic Info & Details
              </button>
              <button
                onClick={() => setModalTab('images')}
                className={`py-3 px-4 border-b-2 transition-all whitespace-nowrap ${
                  modalTab === 'images' ? 'border-red-700 text-red-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                2. Image Gallery ({imageUrls.length})
              </button>
              <button
                onClick={() => setModalTab('categories')}
                className={`py-3 px-4 border-b-2 transition-all whitespace-nowrap ${
                  modalTab === 'categories' ? 'border-red-700 text-red-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                3. Categories & Promos
              </button>
              <button
                onClick={() => setModalTab(isBundle ? 'bundle' : 'variants')}
                className={`py-3 px-4 border-b-2 transition-all whitespace-nowrap ${
                  (modalTab === 'variants' || modalTab === 'bundle') ? 'border-red-700 text-red-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                4. {isBundle ? 'Bundle Items Pack' : 'Variants & Stock Matrix'}
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* TAB 1: BASIC INFO */}
              {modalTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700">Product Name *</label>
                      <input
                        type="text"
                        value={editingProduct?.name || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                        placeholder="e.g. 100% Whey Gold Standard"
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700">Brand</label>
                      <input
                        type="text"
                        value={editingProduct?.brand || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                        placeholder="e.g. Optimum Nutrition"
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900"
                      />
                    </div>
                  </div>

                  {/* RICH TEXT EDITOR: DESCRIPTION */}
                  <div>
                    <label className="font-bold text-slate-700 mb-1 block">Description (Rich Text Editor)</label>
                    <RichTextEditor
                      value={editingProduct?.description || ''}
                      onChange={(html) => setEditingProduct({ ...editingProduct, description: html })}
                      placeholder="Enter detailed product description..."
                    />
                  </div>

                  {/* RICH TEXT EDITOR: NUTRITIONAL FACTS */}
                  <div>
                    <label className="font-bold text-slate-700 mb-1 block flex items-center justify-between">
                      <span>Nutritional Facts (Rich Text Editor — Supports Images)</span>
                      <span className="text-[10px] text-slate-400 font-normal">Supports tables, bold labels, & Cloudinary images</span>
                    </label>
                    <RichTextEditor
                      value={editingProduct?.nutritionalFacts || ''}
                      onChange={(html) => setEditingProduct({ ...editingProduct, nutritionalFacts: html })}
                      placeholder="Nutritional Facts table or image..."
                    />
                  </div>

                  {/* RICH TEXT EDITOR: BENEFITS & HIGHLIGHTS (OPTIONAL) */}
                  <div>
                    <label className="font-bold text-slate-700 mb-1 block flex items-center justify-between">
                      <span>Benefits & Highlights (Rich Text Editor — Optional)</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">Optional</span>
                    </label>
                    <RichTextEditor
                      value={editingProduct?.benefits || ''}
                      onChange={(html) => setEditingProduct({ ...editingProduct, benefits: html })}
                      placeholder="Optional product benefits & highlights..."
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="font-bold text-slate-700">Discount (DA)</label>
                      <input
                        type="number"
                        value={editingProduct?.discount || 0}
                        onChange={(e) => setEditingProduct({ ...editingProduct, discount: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700">Status</label>
                      <select
                        value={editingProduct?.status || 'active'}
                        onChange={(e) => setEditingProduct({ ...editingProduct, status: e.target.value as any })}
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
                      >
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700">Storefront Visibility</label>
                      <label className="flex items-center gap-1.5 mt-2.5 cursor-pointer font-bold text-slate-900">
                        <input
                          type="checkbox"
                          checked={editingProduct?.hidden === true}
                          onChange={(e) => setEditingProduct({ ...editingProduct, hidden: e.target.checked })}
                          className="rounded text-amber-600"
                        />
                        <span>Hide from Storefront</span>
                      </label>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700">Product Type</label>
                      <div className="flex items-center gap-2 mt-2 font-bold">
                        <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                          <input
                            type="checkbox"
                            checked={isBundle}
                            onChange={(e) => {
                              setIsBundle(e.target.checked);
                              if (e.target.checked) setModalTab('bundle');
                            }}
                            className="rounded text-red-600"
                          />
                          <span>Composite Bundle Pack</span>
                        </label>
                      </div>
                    </div>

                    {isBundle && (
                      <div>
                        <label className="font-bold text-purple-700">Bundle Selling Price (DA) *</label>
                        <input
                          type="number"
                          value={editingProduct?.price || 0}
                          onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 12500"
                          className="w-full mt-1 bg-purple-50 border border-purple-300 rounded-xl p-2.5 font-black text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-600/30"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: IMAGE GALLERY & CLOUDINARY UPLOADER */}
              {modalTab === 'images' && (
                <div className="space-y-4">
                  {/* Upload Controls */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      {/* Cloudinary File Input Button */}
                      <label className={`flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all text-xs w-full sm:w-auto ${
                        isUploading ? 'opacity-50 pointer-events-none' : ''
                      }`}>
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>{isUploading ? 'Uploading to Cloudinary...' : '☁️ Upload File to Cloudinary'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                        />
                      </label>

                      <span className="text-slate-400 font-semibold text-xs">or paste image link:</span>

                      {/* Image URL Input */}
                      <div className="flex flex-1 gap-2 w-full sm:w-auto">
                        <input
                          type="text"
                          placeholder="Paste image URL (HTTPS / Cloudinary link)..."
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-xl p-2 font-medium text-slate-900"
                        />
                        <button
                          onClick={handleAddImageUrl}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
                        >
                          + Add URL
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Gallery Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {imageUrls.map((url, idx) => (
                      <div key={idx} className="relative bg-slate-100 rounded-xl border border-slate-200 overflow-hidden group">
                        <img src={url} alt={`Gallery ${idx}`} className="w-full h-32 object-cover" />
                        {idx === 0 && (
                          <span className="absolute top-2 left-2 bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" /> Primary
                          </span>
                        )}
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          {idx !== 0 && (
                            <button
                              onClick={() => handleSetPrimaryImage(idx)}
                              className="p-1.5 bg-white text-slate-900 rounded-lg font-bold text-[10px]"
                              title="Make Primary"
                            >
                              Primary
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveImage(idx)}
                            className="p-1.5 bg-rose-600 text-white rounded-lg"
                            title="Delete Image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: CATEGORIES & PROMOS */}
              {modalTab === 'categories' && (
                <div className="space-y-5">
                  <div>
                    <h4 className="font-bold text-slate-900 mb-2 uppercase tracking-wider text-[11px]">Storefront Categories</h4>
                    <div className="flex flex-wrap gap-2">
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => toggleCategory(cat.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                            selectedCatIds.includes(cat.id)
                              ? 'bg-red-50 border-red-300 text-red-800'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 mb-2 uppercase tracking-wider text-[11px]">Sub-Categories</h4>
                    <div className="flex flex-wrap gap-2">
                      {subCategories.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => toggleSubCategory(sub.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                            selectedSubCatIds.includes(sub.id)
                              ? 'bg-purple-50 border-purple-300 text-purple-800 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <h4 className="font-bold text-slate-900 mb-2 uppercase tracking-wider text-[11px]">Promo Code Eligibility</h4>
                    <div className="flex items-center gap-3 mb-3">
                      <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingProduct?.allowPromo !== false}
                          onChange={(e) => setEditingProduct({ ...editingProduct, allowPromo: e.target.checked })}
                          className="rounded text-red-600"
                        />
                        <span>Allow Promo Codes for this Product</span>
                      </label>
                    </div>

                    {editingProduct?.allowPromo !== false && (
                      <div className="flex flex-wrap gap-2">
                        {promoCodes.map(promo => (
                          <button
                            key={promo.id}
                            onClick={() => togglePromoCode(promo.id)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                              selectedPromoIds.includes(promo.id)
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}
                          >
                            {promo.code} {promo.applyToAll ? '(Global)' : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: VARIANTS & STOCK MATRIX */}
              {modalTab === 'variants' && !isBundle && (
                <div className="space-y-5">
                  {/* Datalist for Inventory SKU Autocomplete */}
                  <datalist id="inventory-skus-list">
                    {inventoryItems.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.brand ? inv.brand + ' - ' : ''}{inv.name} (Stock: {inv.stock})
                      </option>
                    ))}
                  </datalist>

                  {/* Variants Row Builder */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Variants & Picture Linkage</h4>
                      <button
                        onClick={() => setVariants([...variants, { weight: '', unit: 'kg', price: 0, stock: 0, imageIndex: 0, sku: '' }])}
                        className="text-xs font-semibold text-red-700 hover:text-red-800 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> + Add Variant
                      </button>
                    </div>

                    {variants.map((v, idx) => {
                      const linkedImgUrl = imageUrls[v.imageIndex || 0] || imageUrls[0];

                      return (
                        <div key={idx} className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex-wrap sm:flex-nowrap">
                          {/* Image Thumbnail & Selector */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div
                              onClick={() => setPreviewVariantImgIdx(v.imageIndex || 0)}
                              className="w-10 h-10 bg-slate-200 rounded-lg overflow-hidden border border-slate-300 cursor-pointer flex items-center justify-center relative group"
                              title="Click to preview linked picture"
                            >
                              {linkedImgUrl ? (
                                <img src={linkedImgUrl} alt="Variant" className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-slate-400" />
                              )}
                            </div>

                            <select
                              value={v.imageIndex || 0}
                              onChange={(e) => {
                                const next = [...variants];
                                next[idx].imageIndex = parseInt(e.target.value) || 0;
                                setVariants(next);
                              }}
                              className="bg-white border border-slate-200 rounded p-1 text-[11px] font-medium max-w-[100px]"
                            >
                              {imageUrls.map((_, i) => (
                                <option key={i} value={i}>Image {i + 1}</option>
                              ))}
                            </select>

                            <label className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-100 cursor-pointer" title="Upload new image for this variant">
                              <Upload className="w-3.5 h-3.5 text-blue-600" />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleVariantImageUpload(idx, e)}
                              />
                            </label>
                          </div>

                          <input
                            type="text"
                            placeholder="Weight/Size"
                            value={typeof v.weight === 'string' ? v.weight : ''}
                            onChange={(e) => {
                              const next = [...variants];
                              next[idx].weight = e.target.value;
                              setVariants(next);
                            }}
                            className="w-24 bg-white border border-slate-200 rounded p-1.5 font-semibold"
                          />
                          <select
                            value={v.unit || 'kg'}
                            onChange={(e) => {
                              const next = [...variants];
                              next[idx].unit = e.target.value;
                              setVariants(next);
                            }}
                            className="bg-white border border-slate-200 rounded p-1.5 text-xs font-semibold"
                          >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="caps">caps</option>
                            <option value="ml">ml</option>
                            <option value="pcs">pcs</option>
                          </select>
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



                          <button onClick={() => setVariants(variants.filter((_, i) => i !== idx))} className="text-rose-600 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Flavors Row Builder with Linked Picture Selection */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Flavors & Linked Pictures</h4>
                      <button
                        onClick={() => setFlavors([...flavors, `Flavor ${flavors.length + 1}`])}
                        className="text-xs font-semibold text-red-700 hover:text-red-800 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> + Add Flavor
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {flavors.map((flv, fIdx) => {
                        const fName = typeof flv === 'object' ? (flv as any).name || String(flv) : String(flv);
                        const currentImg = flavorImages[fName] || imageUrls[0] || '';

                        return (
                          <div key={fIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
                            {/* Flavor Picture Thumbnail */}
                            <div className="w-7 h-7 bg-slate-200 rounded-lg overflow-hidden border border-slate-300 shrink-0">
                              {currentImg ? (
                                <img src={currentImg} alt={fName} className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="w-3.5 h-3.5 text-slate-400 m-auto mt-1.5" />
                              )}
                            </div>

                            <input
                              type="text"
                              value={fName}
                              onChange={(e) => {
                                const newName = e.target.value;
                                const next = [...flavors];
                                next[fIdx] = newName;
                                setFlavors(next);

                                // Migrate flavor image key if renamed
                                if (flavorImages[fName]) {
                                  const nextImgMap = { ...flavorImages };
                                  nextImgMap[newName] = nextImgMap[fName];
                                  delete nextImgMap[fName];
                                  setFlavorImages(nextImgMap);
                                }
                              }}
                              className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-xs flex-1"
                              placeholder="Flavor Name"
                            />

                            {/* Select Linked Picture */}
                            <select
                              value={currentImg}
                              onChange={(e) => {
                                setFlavorImages({
                                  ...flavorImages,
                                  [fName]: e.target.value
                                });
                              }}
                              className="bg-white border border-slate-200 rounded-lg p-1 text-[11px] max-w-[110px]"
                            >
                              <option value="">(No Picture)</option>
                              {imageUrls.map((url, imgIdx) => (
                                <option key={imgIdx} value={url}>Image #{imgIdx + 1}</option>
                              ))}
                            </select>

                            <button onClick={() => setFlavors(flavors.filter((_, i) => i !== fIdx))} className="text-slate-400 hover:text-rose-600 p-1">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stock Matrix Grid & SKU / Picture Linkage Preview */}
                  {variants.length > 0 && flavors.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Stock per Variant & Flavor</h4>
                        <span className="text-[10px] text-slate-500 font-medium">Link Inventory SKUs to auto-sync stock levels</span>
                      </div>
                      <div className="border border-slate-200 rounded-xl overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 font-bold text-slate-600">
                            <tr>
                              <th className="p-2.5">Variant & Picture</th>
                              {flavors.map((f, i) => {
                                const fName = typeof f === 'object' ? (f as any).name : String(f);
                                const fImg = flavorImages[fName] || imageUrls[0] || '';

                                return (
                                  <th key={i} className="p-2.5 text-center min-w-[150px]">
                                    <div className="flex flex-col items-center gap-1">
                                      <div
                                        onClick={() => {
                                          const foundIdx = imageUrls.findIndex(u => u === fImg);
                                          if (foundIdx >= 0) setPreviewVariantImgIdx(foundIdx);
                                        }}
                                        className="w-6 h-6 bg-white rounded border border-slate-300 overflow-hidden cursor-pointer shadow-2xs"
                                        title={`Click to preview image for ${fName}`}
                                      >
                                        {fImg ? (
                                          <img src={fImg} alt={fName} className="w-full h-full object-cover" />
                                        ) : (
                                          <ImageIcon className="w-3 h-3 text-slate-400 m-auto mt-1" />
                                        )}
                                      </div>
                                      <span>{fName}</span>
                                    </div>
                                  </th>
                                );
                              })}
                              <th className="p-2.5 text-center">Row Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {variants.map((v, vIdx) => {
                              const rowTotal = flavors.reduce((s, f) => {
                                const fName = typeof f === 'object' ? (f as any).name : String(f);
                                return s + (flavorStockMatrix[`${vIdx}_${fName}`] || 0);
                              }, 0);

                              const vImgUrl = imageUrls[v.imageIndex || 0] || imageUrls[0];

                              return (
                                <tr key={vIdx} className="hover:bg-slate-50/80">
                                  <td className="p-2.5 font-bold flex items-center gap-2">
                                    <div
                                      onClick={() => setPreviewVariantImgIdx(v.imageIndex || 0)}
                                      className="w-7 h-7 bg-slate-200 rounded overflow-hidden border border-slate-300 cursor-pointer shrink-0"
                                      title="Click to view picture"
                                    >
                                      {vImgUrl ? (
                                        <img src={vImgUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                                      ) : (
                                        <ImageIcon className="w-3.5 h-3.5 text-slate-400 m-auto mt-1.5" />
                                      )}
                                    </div>
                                    <span>{v.weight || `Variant ${vIdx + 1}`}</span>
                                  </td>
                                  {flavors.map((f, fIdx) => {
                                    const fName = typeof f === 'object' ? (f as any).name : String(f);
                                    const cellKey = `${vIdx}_${fName}`;
                                    const currentSku = flavorSkuMatrix[cellKey] || '';
                                    const currentStock = flavorStockMatrix[cellKey] || 0;
                                    const matchedInv = inventoryItems.find(item => String(item.id).trim().toLowerCase() === currentSku.trim().toLowerCase());

                                    return (
                                      <td key={fIdx} className="p-2 text-center align-top">
                                        <div className="flex flex-col items-center gap-1 bg-slate-50/70 p-2 rounded-lg border border-slate-200/60">
                                          {/* Searchable SKU Link Selector */}
                                          <div className="w-full">
                                            <SearchableSkuSelect
                                              value={currentSku}
                                              inventoryItems={inventoryItems}
                                              onChange={(val) => {
                                                const newSkuMat = { ...flavorSkuMatrix, [cellKey]: val };
                                                setFlavorSkuMatrix(newSkuMat);

                                                const found = inventoryItems.find(item => String(item.id).trim().toLowerCase() === val.trim().toLowerCase());
                                                if (found) {
                                                  setFlavorStockMatrix(prev => ({
                                                    ...prev,
                                                    [cellKey]: Number(found.stock) || 0
                                                  }));
                                                }
                                              }}
                                            />
                                          </div>

                                          {/* Stock Quantity Input */}
                                          <div className="flex items-center gap-1 mt-0.5">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase">Qty:</span>
                                            <input
                                              type="number"
                                              min="0"
                                              value={currentStock}
                                              onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0;
                                                setFlavorStockMatrix({
                                                  ...flavorStockMatrix,
                                                  [cellKey]: val
                                                });
                                              }}
                                              className="w-14 text-center bg-white border border-slate-300 rounded p-0.5 text-xs font-black text-slate-900 focus:ring-1 focus:ring-red-500 focus:outline-none"
                                            />
                                          </div>

                                          {/* Inventory Linkage Status Badge */}
                                          {matchedInv ? (
                                            <div className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded font-medium flex items-center justify-between w-full mt-0.5">
                                              <span className="truncate">✓ Inv: {matchedInv.stock}</span>
                                              {matchedInv.stock !== currentStock && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setFlavorStockMatrix({
                                                      ...flavorStockMatrix,
                                                      [cellKey]: Number(matchedInv.stock) || 0
                                                    });
                                                  }}
                                                  className="text-[9px] font-bold text-emerald-800 hover:underline shrink-0 ml-1"
                                                  title="Sync stock from inventory"
                                                >
                                                  Sync
                                                </button>
                                              )}
                                            </div>
                                          ) : currentSku ? (
                                            <div className="text-[9px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded text-center w-full mt-0.5 truncate">
                                              Custom SKU
                                            </div>
                                          ) : null}
                                        </div>
                                      </td>
                                    );
                                  })}
                                  <td className="p-2.5 text-center font-black text-slate-900 align-middle">{rowTotal}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4 (BUNDLE): COMPOSITE BUNDLE PACK */}
              {modalTab === 'bundle' && isBundle && (
                <div className="space-y-5">
                  {/* Banner & Explanation */}
                  <div className="bg-purple-950 text-purple-100 border border-purple-800/80 p-4 rounded-2xl shadow-sm space-y-1">
                    <div className="font-extrabold text-sm text-purple-200 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Composite Bundle Pack Builder (2+ Items)</span>
                    </div>
                    <div className="text-xs text-purple-300">
                      Search SKUs or product names to compose this bundle pack. Total price, cost, and available stock are auto-calculated from component items.
                    </div>
                  </div>

                  {/* Component SKU Search & Selection Bar */}
                  <div className="space-y-2">
                    <label className="font-bold text-slate-700 text-xs flex items-center justify-between">
                      <span>Search Component SKU or Product Name</span>
                      <span className="text-[10px] text-slate-400 font-semibold">🔍 Real-time SKU & Catalog Search</span>
                    </label>

                    <div className="flex gap-2 items-center relative">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          placeholder="Type SKU code (e.g. SUP-8801), Product Name, or Brand..."
                          value={bundleSearchQuery}
                          onFocus={() => setIsBundleSearchOpen(true)}
                          onChange={(e) => {
                            setBundleSearchQuery(e.target.value);
                            setIsBundleSearchOpen(true);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600/20"
                        />

                        {/* Real-time Floating Candidates Dropdown */}
                        {isBundleSearchOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95">
                            {getBundleCandidates().filter(c => {
                              if (!bundleSearchQuery.trim()) return true;
                              const q = bundleSearchQuery.toLowerCase().trim();
                              return (
                                (c.sku || '').toLowerCase().includes(q) ||
                                (c.name || '').toLowerCase().includes(q) ||
                                (c.brand || '').toLowerCase().includes(q) ||
                                (c.variant || '').toLowerCase().includes(q)
                              );
                            }).length === 0 ? (
                              <div className="p-4 text-center text-slate-400 text-xs font-medium">
                                No matching SKU or product found for "{bundleSearchQuery}"
                              </div>
                            ) : (
                              getBundleCandidates().filter(c => {
                                if (!bundleSearchQuery.trim()) return true;
                                const q = bundleSearchQuery.toLowerCase().trim();
                                return (
                                  (c.sku || '').toLowerCase().includes(q) ||
                                  (c.name || '').toLowerCase().includes(q) ||
                                  (c.brand || '').toLowerCase().includes(q) ||
                                  (c.variant || '').toLowerCase().includes(q)
                                );
                              }).slice(0, 15).map(c => (
                                <div
                                  key={c.id}
                                  onClick={() => handleAddBundleCandidate(c)}
                                  className="p-3 hover:bg-purple-50/80 cursor-pointer transition-colors flex items-center justify-between text-xs group"
                                >
                                  <div>
                                    <div className="font-bold text-slate-900 flex items-center gap-2">
                                      <span className="bg-slate-100 text-slate-700 font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-slate-200">
                                        {c.sku}
                                      </span>
                                      <span>{c.brand ? `${c.brand} - ` : ''}{c.name}</span>
                                    </div>
                                    {c.variant && (
                                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                        Spec: {c.variant} {c.flavor ? `| Flavor: ${c.flavor}` : ''}
                                      </div>
                                    )}
                                  </div>

                                  <div className="text-right shrink-0">
                                    <div className="font-black text-slate-900 text-xs">
                                      {c.price ? `${c.price.toLocaleString()} DA` : '0 DA'}
                                    </div>
                                    <div className={`text-[10px] font-bold ${c.stock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      Stock: {c.stock} units
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Quantity Input */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-bold text-slate-500">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          value={bundleQty}
                          onChange={(e) => setBundleQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-black text-center"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pricing & Cost Auto-Calculated Summary Banner */}
                  {bundleItems.length > 0 && (() => {
                    const priceSum = bundleItems.reduce((s, i) => s + (Number(i.price || 0) * Number(i.qty || 1)), 0);
                    const costSum = bundleItems.reduce((s, i) => s + (Number(i.cost || 0) * Number(i.qty || 1)), 0);
                    const profitMargin = priceSum - costSum;

                    return (
                      <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-indigo-950 text-white p-4 rounded-2xl shadow-md space-y-3 border border-purple-800/60">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-black text-xs text-purple-200 uppercase tracking-wider">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <span>Auto-Calculated Pack Valuation</span>
                          </div>
                          <span className="text-[10px] font-black bg-purple-800/80 px-2.5 py-0.5 rounded-full text-purple-200 border border-purple-700/60">
                            {bundleItems.length} Component(s) Included
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10">
                            <div className="text-[10px] font-extrabold text-purple-300 uppercase tracking-wider">Calculated Retail Value</div>
                            <div className="text-lg font-black text-amber-300 mt-0.5">{priceSum.toLocaleString()} DA</div>
                            <div className="text-[10px] text-purple-200/80">Sum of included retail prices</div>
                          </div>

                          <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10">
                            <div className="text-[10px] font-extrabold text-purple-300 uppercase tracking-wider">Calculated Cost Basis</div>
                            <div className="text-lg font-black text-slate-100 mt-0.5">{costSum.toLocaleString()} DA</div>
                            <div className="text-[10px] text-purple-200/80">Cost of component items</div>
                          </div>

                          <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10">
                            <div className="text-[10px] font-extrabold text-purple-300 uppercase tracking-wider">Estimated Profit Margin</div>
                            <div className="text-lg font-black text-emerald-300 mt-0.5">+{profitMargin.toLocaleString()} DA</div>
                            <div className="text-[10px] text-purple-200/80">Net margin per pack</div>
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between gap-3 border-t border-purple-800/80 flex-wrap">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-purple-200 font-bold">Bundle Selling Price (DA):</label>
                            <input
                              type="number"
                              value={editingProduct?.price || 0}
                              onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                              placeholder="0"
                              className="w-32 bg-white text-slate-900 border border-amber-400 rounded-xl px-3 py-1.5 font-black text-xs text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                          </div>
                          {priceSum > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextVars = [...(variants || [])];
                                if (nextVars.length > 0) {
                                  nextVars[0].price = priceSum;
                                  setVariants(nextVars);
                                }
                                setEditingProduct({ ...editingProduct, price: priceSum });
                                showToast(`✓ Bundle price set to calculated sum: ${priceSum.toLocaleString()} DA`);
                              }}
                              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                            >
                              <span>⚡ Auto-Set Sum ({priceSum.toLocaleString()} DA)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Bundle Components Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Included Pack Components</h4>
                      <span className="text-[10px] text-slate-500 font-semibold">Edit quantities or remove items</span>
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 font-extrabold text-slate-600 uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="p-3">SKU & Item Name</th>
                            <th className="p-3 text-right">Unit Price</th>
                            <th className="p-3 text-center">Qty / Pack</th>
                            <th className="p-3 text-right">Subtotal</th>
                            <th className="p-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {bundleItems.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400 text-xs font-medium">
                                No components added yet. Use the SKU search bar above to add items to this bundle pack.
                              </td>
                            </tr>
                          ) : (
                            bundleItems.map((b, idx) => {
                              const lineTotal = (Number(b.price || 0) * Number(b.qty || 1));

                              return (
                                <tr key={idx} className="hover:bg-purple-50/30 transition-colors">
                                  <td className="p-3">
                                    <div className="font-bold text-slate-900 flex items-center gap-2">
                                      <span className="bg-slate-100 text-slate-700 font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-slate-200">
                                        {b.sku || 'SKU-NONE'}
                                      </span>
                                      <span>{b.brand ? `${b.brand} - ` : ''}{b.name}</span>
                                    </div>
                                    {(b.variant || b.flavor) && (
                                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                        {b.variant ? `Spec: ${b.variant}` : ''} {b.flavor ? `| Flavor: ${b.flavor}` : ''}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 text-right font-bold text-slate-700">
                                    {b.price ? `${Number(b.price).toLocaleString()} DA` : '0 DA'}
                                  </td>
                                  <td className="p-3 text-center">
                                    <input
                                      type="number"
                                      min="1"
                                      value={b.qty}
                                      onChange={(e) => {
                                        const newQty = Math.max(1, parseInt(e.target.value) || 1);
                                        const next = [...bundleItems];
                                        next[idx].qty = newQty;
                                        setBundleItems(next);
                                      }}
                                      className="w-14 text-center bg-slate-50 border border-slate-300 rounded-lg p-1 font-extrabold text-slate-900 text-xs focus:ring-2 focus:ring-purple-600/20"
                                    />
                                  </td>
                                  <td className="p-3 text-right font-black text-purple-900">
                                    {lineTotal.toLocaleString()} DA
                                  </td>
                                  <td className="p-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => setBundleItems(bundleItems.filter((_, i) => i !== idx))}
                                      className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition-colors"
                                      title="Remove from pack"
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
                  </div>

                  {/* Calculated Composite Pack Stock */}
                  <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold">
                      <Boxes className="w-4 h-4 text-purple-400" />
                      <span>Calculated Pack Available Stock (from Inventory):</span>
                    </div>
                    <span className="text-sm font-black text-amber-300 bg-purple-950 border border-purple-800 px-3 py-1 rounded-lg">
                      📦 {calculateBundleStock()} Pack(s) Sellable
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2.5 bg-red-700 hover:bg-red-800 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save Product</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VARIANT IMAGE PREVIEW MODAL ── */}
      {previewVariantImgIdx !== null && imageUrls[previewVariantImgIdx] && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPreviewVariantImgIdx(null)}>
          <div className="bg-white p-3 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewVariantImgIdx(null)} className="absolute top-4 right-4 bg-slate-900/60 text-white p-1.5 rounded-full hover:bg-slate-900">
              <X className="w-5 h-5" />
            </button>
            <img src={imageUrls[previewVariantImgIdx]} alt="Variant Preview" className="w-full h-auto rounded-xl max-h-[70vh] object-contain" />
            <div className="p-3 text-center text-xs font-bold text-slate-700">
              Linked Variant Picture (Image #{previewVariantImgIdx + 1})
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
