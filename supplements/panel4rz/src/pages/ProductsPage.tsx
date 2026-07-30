import React, { useState, useRef } from 'react';
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
  const [selectedBundleProdId, setSelectedBundleProdId] = useState<string>('');
  const [selectedBundleVariant, setSelectedBundleVariant] = useState<string>('');
  const [selectedBundleFlavor, setSelectedBundleFlavor] = useState<string>('');
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
    if (visibilityFilter === 'hidden' && p.hidden !== true) return false;

    return true;
  });

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

      // Reconstruct matrix values from variant flavorStock & flavorSkus
      const matrix: Record<string, number> = {};
      const skuMatrix: Record<string, string> = {};
      initialVariants.forEach((v: ProductVariant, vIdx: number) => {
        if (v.flavorStock) {
          Object.entries(v.flavorStock).forEach(([flv, qty]) => {
            matrix[`${vIdx}_${flv}`] = Number(qty) || 0;
          });
        }
        if (v.flavorSkus) {
          Object.entries(v.flavorSkus).forEach(([flv, sCode]) => {
            skuMatrix[`${vIdx}_${flv}`] = String(sCode || '');
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

  // Bundle Items Handlers
  const handleAddBundleItem = () => {
    if (!selectedBundleProdId) return;
    const targetProd = products.find(p => p.id === selectedBundleProdId);
    if (!targetProd) return;

    const existingIdx = bundleItems.findIndex(
      b => b.productId === selectedBundleProdId && b.variant === selectedBundleVariant && b.flavor === selectedBundleFlavor
    );

    if (existingIdx >= 0) {
      const next = [...bundleItems];
      next[existingIdx].qty += bundleQty;
      setBundleItems(next);
    } else {
      setBundleItems([
        ...bundleItems,
        {
          productId: selectedBundleProdId,
          qty: bundleQty,
          variant: selectedBundleVariant,
          flavor: selectedBundleFlavor,
          name: targetProd.name,
          brand: targetProd.brand || ''
        }
      ]);
    }

    setSelectedBundleProdId('');
    setSelectedBundleVariant('');
    setSelectedBundleFlavor('');
    setBundleQty(1);
  };

  // Calculate composite bundle stock
  const calculateBundleStock = () => {
    if (!bundleItems.length) return 0;
    let minStock = Infinity;

    bundleItems.forEach(b => {
      const p = products.find(prod => prod.id === b.productId);
      if (p) {
        let pStock = Number(p.stock) || 0;
        if (b.variant && p.variants) {
          const v = p.variants.find(x => (x.weight ? `${x.weight}${x.unit || ''}` : (x.label || x.name)) === b.variant);
          if (v) pStock = Number(v.stock) || 0;
        }
        minStock = Math.min(minStock, Math.floor(pStock / b.qty));
      }
    });

    return minStock === Infinity ? 0 : minStock;
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
      imageUrl: imageUrls,
      categoryIds: selectedCatIds,
      subCategoryIds: selectedSubCatIds,
      promoCodeIds: selectedPromoIds,
      bundleItems: isBundle ? bundleItems : [],
      variants: isBundle ? [] : updatedVariants,
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

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map(prod => {
          const mainImg = Array.isArray(prod.imageUrl) ? prod.imageUrl[0] : prod.imageUrl;

          return (
            <div key={prod.id} className={`bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-shadow space-y-3 relative ${
              prod.hidden ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200/80'
            }`}>
              <div className="flex gap-3">
                <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-slate-200">
                  {mainImg ? (
                    <img src={mainImg} alt={prod.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-300" />
                  )}
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

                          {/* INTERACTIVE SKU SEARCH / AUTOCOMPLETE INPUT */}
                          <div className="flex-1 min-w-[160px]">
                            <input
                              type="text"
                              list="inventory-skus-list"
                              placeholder="Search SKU or Name..."
                              value={v.sku || ''}
                              onChange={(e) => {
                                const next = [...variants];
                                next[idx].sku = e.target.value;
                                setVariants(next);
                              }}
                              className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-bold text-emerald-800"
                            />
                          </div>

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
                                          {/* SKU Link Selector */}
                                          <div className="w-full">
                                            <input
                                              type="text"
                                              list={`sku-list-${vIdx}-${fIdx}`}
                                              value={currentSku}
                                              placeholder="Link SKU..."
                                              onChange={(e) => {
                                                const newSku = e.target.value;
                                                setFlavorSkuMatrix({
                                                  ...flavorSkuMatrix,
                                                  [cellKey]: newSku
                                                });
                                                const found = inventoryItems.find(item => String(item.id).trim().toLowerCase() === newSku.trim().toLowerCase());
                                                if (found) {
                                                  setFlavorStockMatrix({
                                                    ...flavorStockMatrix,
                                                    [cellKey]: Number(found.stock) || 0
                                                  });
                                                }
                                              }}
                                              className="w-full text-center text-[10px] font-mono font-bold bg-white border border-slate-300 rounded px-1 py-0.5 text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-red-500 focus:outline-none"
                                            />
                                            <datalist id={`sku-list-${vIdx}-${fIdx}`}>
                                              {inventoryItems.map(inv => (
                                                <option key={inv.id} value={inv.id}>
                                                  {inv.id} - {inv.name} ({inv.stock} DZ)
                                                </option>
                                              ))}
                                            </datalist>
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
                <div className="space-y-4">
                  <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl text-xs text-purple-900 space-y-1">
                    <div className="font-bold">Composite Bundle Pack Builder</div>
                    <div>Select existing items to include in this bundle pack. Total pack stock is calculated automatically.</div>
                  </div>

                  <div className="flex gap-2 items-center">
                    <select
                      value={selectedBundleProdId}
                      onChange={(e) => setSelectedBundleProdId(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold flex-1"
                    >
                      <option value="">-- Select Product to Include --</option>
                      {products.filter(p => p.id !== editingProduct?.id).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.brand ? p.brand + ' - ' : ''}{p.name} (Stock: {p.stock})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={bundleQty}
                      onChange={(e) => setBundleQty(parseInt(e.target.value) || 1)}
                      className="w-16 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-center"
                    />
                    <button
                      onClick={handleAddBundleItem}
                      className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl"
                    >
                      + Add to Pack
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 font-bold text-slate-600">
                        <tr>
                          <th className="p-2.5">Component Product</th>
                          <th className="p-2.5 text-center">Quantity Per Pack</th>
                          <th className="p-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bundleItems.map((b, idx) => (
                          <tr key={idx}>
                            <td className="p-2.5 font-bold">{b.brand ? b.brand + ' - ' : ''}{b.name}</td>
                            <td className="p-2.5 text-center font-bold">{b.qty}</td>
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() => setBundleItems(bundleItems.filter((_, i) => i !== idx))}
                                className="text-rose-600 hover:text-rose-800 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-bold text-slate-900">
                    Calculated Composite Stock: <span className="text-purple-700 font-extrabold">{calculateBundleStock()} packs</span>
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
