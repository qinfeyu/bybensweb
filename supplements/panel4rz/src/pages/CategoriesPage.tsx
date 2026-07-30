import React, { useState } from 'react';
import type { Category, SubCategory } from '../types';
import { Layers, Plus, Edit3, Trash2, Search, X, Check, Tag } from 'lucide-react';

interface CategoriesPageProps {
  categories: Category[];
  subCategories: SubCategory[];
  onSaveCategory: (cat: Category, subs: string[]) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onDeleteSubCategory: (subId: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const CategoriesPage: React.FC<CategoriesPageProps> = ({
  categories,
  subCategories,
  onSaveCategory,
  onDeleteCategory,
  onDeleteSubCategory,
  showToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCat, setEditingCat] = useState<Partial<Category> | null>(null);
  const [editingSubs, setEditingSubs] = useState<string[]>([]);
  const [newSubName, setNewSubName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredCategories = categories.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
  });

  const openEditor = (cat?: Category) => {
    if (cat) {
      setEditingCat({ ...cat });
      const subsForCat = subCategories.filter(s => s.categoryIds.includes(cat.id)).map(s => s.name);
      setEditingSubs(subsForCat);
    } else {
      setEditingCat({
        id: `cat_${Date.now()}`,
        name: ''
      });
      setEditingSubs([]);
    }
    setNewSubName('');
    setIsModalOpen(true);
  };

  const handleAddSub = () => {
    if (!newSubName.trim()) return;
    if (editingSubs.includes(newSubName.trim())) {
      showToast("Subcategory already exists", "error");
      return;
    }
    setEditingSubs([...editingSubs, newSubName.trim()]);
    setNewSubName('');
  };

  const handleSave = async () => {
    if (!editingCat?.name?.trim()) {
      showToast("Category name is required", "error");
      return;
    }

    await onSaveCategory(editingCat as Category, editingSubs);
    setIsModalOpen(false);
    showToast("✓ Category and Sub-categories saved successfully!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Categories & Sub-Categories</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage storefront categories and sub-categories catalog structure.</p>
        </div>

        <button
          onClick={() => openEditor()}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
          />
        </div>
      </div>

      {/* Category List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.map(cat => {
          const subs = subCategories.filter(s => s.categoryIds.includes(cat.id));

          return (
            <div key={cat.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-red-50 text-red-700 rounded-xl flex items-center justify-center font-bold">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{cat.name}</h3>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {cat.id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditor(cat)}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete category [${cat.name}] and all its subcategories?`)) onDeleteCategory(cat.id);
                    }}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Sub-categories Chips */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Sub-categories ({subs.length})</span>
                <div className="flex flex-wrap gap-1.5">
                  {subs.map(sub => (
                    <span key={sub.id} className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-400" />
                      <span>{sub.name}</span>
                      <button
                        onClick={() => onDeleteSubCategory(sub.id)}
                        className="text-slate-400 hover:text-rose-600 ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {subs.length === 0 && (
                    <span className="text-slate-400 text-xs italic">No sub-categories linked</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* EDIT / ADD CATEGORY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-base">
                {editingCat?.id ? `Edit Category — ${editingCat.name}` : 'Add Category'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700">Category Name *</label>
                <input
                  type="text"
                  value={editingCat?.name || ''}
                  onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                  placeholder="e.g. Proteins, Creatine, Vitamins..."
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="font-bold text-slate-700 block">Sub-categories List</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add new sub-category..."
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium"
                  />
                  <button
                    onClick={handleAddSub}
                    className="px-3 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800"
                  >
                    + Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-2">
                  {editingSubs.map((subName, i) => (
                    <span key={i} className="bg-purple-50 border border-purple-200 text-purple-900 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                      <span>{subName}</span>
                      <button onClick={() => setEditingSubs(editingSubs.filter((_, idx) => idx !== i))} className="text-purple-400 hover:text-purple-900">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

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
                <span>Save Category</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
