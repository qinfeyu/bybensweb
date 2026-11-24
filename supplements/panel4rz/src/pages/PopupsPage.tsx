import React, { useMemo, useRef, useState } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Save, X, Upload, ImageIcon, Eye, EyeOff, Calendar, Globe } from 'lucide-react';
import type { Popup } from '../types';
import { uploadToCloudinary } from '../lib/cloudinary';

interface PopupsPageProps {
  popups: Popup[];
  onSavePopup: (popup: Popup) => Promise<void>;
  onDeletePopup: (id: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type LangTab = 'en' | 'fr' | 'ar';

const PAGE_OPTIONS: { id: string; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'products', label: 'Products' },
  { id: 'product-detail', label: 'Product Detail' },
  { id: 'checkout', label: 'Checkout' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'track', label: 'Track' },
];

function emptyPopup(): Popup {
  return {
    id: Date.now().toString(),
    enabled: false,
    title_en: '',
    title_fr: '',
    title_ar: '',
    body_en: '',
    body_fr: '',
    body_ar: '',
    image_url: '',
    cta_text_en: '',
    cta_text_fr: '',
    cta_text_ar: '',
    cta_url: '',
    display_pages: 'all',
    dismiss_mode: 'session',
    priority: 0,
    start_at: null,
    end_at: null,
  };
}

function toDatetimeLocal(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizePages(pages: string): string[] {
  const raw = String(pages || 'all').trim().toLowerCase();
  if (!raw || raw === 'all') return ['all'];
  const selected = raw.split(',').map(s => s.trim()).filter(Boolean);
  return selected.length ? selected : ['all'];
}

function pagesToString(selected: string[]): string {
  if (selected.includes('all') || selected.length === 0) return 'all';
  const valid = selected.filter(p => PAGE_OPTIONS.some(o => o.id === p));
  return valid.length ? valid.join(',') : 'all';
}

function formatSchedule(popup: Popup): string {
  const fmt = (v?: string | null) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const start = fmt(popup.start_at);
  const end = fmt(popup.end_at);
  if (!start && !end) return 'Always on';
  if (start && end) return `${start} → ${end}`;
  if (start) return `From ${start}`;
  return `Until ${end}`;
}

function dismissLabel(mode: Popup['dismiss_mode']): string {
  if (mode === '7_days') return 'Dismiss 7 days';
  if (mode === 'until_closed') return 'Until closed';
  return 'Session';
}

export default function PopupsPage({ popups, onSavePopup, onDeletePopup, showToast }: PopupsPageProps) {
  const [editing, setEditing] = useState<Popup | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [langTab, setLangTab] = useState<LangTab>('en');
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(() => {
    return [...popups].sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }, [popups]);

  const openNew = () => {
    setEditing(emptyPopup());
    setIsNew(true);
    setLangTab('en');
  };

  const openEdit = (popup: Popup) => {
    setEditing({ ...popup });
    setIsNew(false);
    setLangTab('en');
  };

  const closeEditor = () => {
    if (saving) return;
    setEditing(null);
    setIsNew(false);
  };

  const updateField = <K extends keyof Popup>(key: K, value: Popup[K]) => {
    setEditing(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const selectedPages = normalizePages(editing?.display_pages || 'all');
  const allPagesSelected = selectedPages.includes('all');

  const togglePage = (pageId: string) => {
    if (!editing) return;
    if (pageId === 'all') {
      updateField('display_pages', 'all');
      return;
    }
    let next = selectedPages.filter(p => p !== 'all');
    if (next.includes(pageId)) next = next.filter(p => p !== pageId);
    else next = [...next, pageId];
    updateField('display_pages', pagesToString(next));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editing) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Image is too large (max 10MB).', 'error');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, 'bybens-popups');
      updateField('image_url', url);
      showToast('Image uploaded.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Image upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const validate = (popup: Popup): string | null => {
    const hasContent = [popup.title_en, popup.title_fr, popup.title_ar, popup.body_en, popup.body_fr, popup.body_ar].some(v => String(v || '').trim());
    if (!hasContent && !String(popup.image_url || '').trim()) return 'Add at least a title, body, or image.';
    if (popup.start_at && popup.end_at) {
      const s = Date.parse(popup.start_at);
      const en = Date.parse(popup.end_at);
      if (!Number.isNaN(s) && !Number.isNaN(en) && s > en) return 'Start date must be before end date.';
    }
    const ctaUrl = String(popup.cta_url || '').trim();
    if (ctaUrl) {
      try {
        const parsed = new URL(ctaUrl, window.location.origin);
        if (!['http:', 'https:'].includes(parsed.protocol)) return 'CTA URL must be http(s) or a relative path.';
      } catch {
        if (!ctaUrl.startsWith('/')) return 'CTA URL must be a valid URL or relative path.';
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!editing) return;
    const err = validate(editing);
    if (err) {
      showToast(err, 'error');
      return;
    }
    setSaving(true);
    try {
      await onSavePopup({ ...editing, priority: Number(editing.priority) || 0 });
      setEditing(null);
      setIsNew(false);
    } catch {
      // toast handled in App
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this popup? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await onDeletePopup(id);
      if (editing?.id === id) {
        setEditing(null);
        setIsNew(false);
      }
    } catch {
      // toast handled in App
    } finally {
      setDeletingId(null);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300';
  const labelCls = 'block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1.5';

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Popups & Announcements</h1>
              <p className="text-xs text-slate-500 font-medium">Create storefront modals, target pages, schedule them, and control dismissal.</p>
            </div>
          </div>
          <button type="button" onClick={openNew} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors shadow-sm shadow-red-900/20">
            <Plus className="w-4 h-4" /> New Popup
          </button>
        </div>

        <div className="p-5">
          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
              <Megaphone className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No popups yet</p>
              <p className="text-xs text-slate-500 mt-1">Create your first announcement for the storefront.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {sorted.map((popup) => (
                <div key={popup.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4 min-w-0">
                    {popup.image_url ? (
                      <img src={popup.image_url} alt="" className="w-20 h-20 rounded-xl object-cover border border-slate-100 bg-slate-50 flex-shrink-0" />
                    ) : (
                      <div className="w-20 h-20 rounded-xl border border-slate-100 bg-slate-50 text-slate-300 flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${popup.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {popup.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {popup.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">Priority {Number(popup.priority) || 0}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700">{dismissLabel(popup.dismiss_mode)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-slate-900 truncate">{popup.title_en || popup.title_fr || popup.title_ar || '(Untitled popup)'}</p>
                        <p className="text-xs text-slate-500 line-clamp-2">{popup.body_en || popup.body_fr || popup.body_ar || 'No body text'}</p>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 font-semibold">
                        <span className="inline-flex items-center gap-1"><Globe className="w-3.5 h-3.5" />{popup.display_pages === 'all' ? 'All pages' : popup.display_pages}</span>
                        <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatSchedule(popup)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button type="button" onClick={() => openEdit(popup)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(popup.id)} disabled={deletingId === popup.id} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" /> {deletingId === popup.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[200] bg-black/50 p-4 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && closeEditor()}>
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">{isNew ? 'New Popup' : 'Edit Popup'}</h2>
                <p className="text-xs text-slate-500">Storefront modal announcement. Save to apply changes.</p>
              </div>
              <button type="button" onClick={closeEditor} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex items-center gap-3 px-3 py-3 rounded-xl border border-slate-200 bg-slate-50/50">
                  <input type="checkbox" checked={!!editing.enabled} onChange={(e) => updateField('enabled', e.target.checked)} className="w-4 h-4 accent-red-600" />
                  <span className="text-sm font-bold text-slate-800">Enabled</span>
                </label>
                <div>
                  <label className={labelCls}>Priority</label>
                  <input type="number" className={inputCls} value={editing.priority} onChange={(e) => updateField('priority', Number(e.target.value) || 0)} />
                </div>
                <div>
                  <label className={labelCls}>Dismiss mode</label>
                  <select className={inputCls} value={editing.dismiss_mode} onChange={(e) => updateField('dismiss_mode', e.target.value as Popup['dismiss_mode'])}>
                    <option value="session">Session</option>
                    <option value="7_days">7 days</option>
                    <option value="until_closed">Until closed</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>CTA URL</label>
                  <input type="text" className={inputCls} value={editing.cta_url} onChange={(e) => updateField('cta_url', e.target.value)} placeholder="https://... or /supplements/products" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Start at (optional)</label>
                  <input type="datetime-local" className={inputCls} value={toDatetimeLocal(editing.start_at)} onChange={(e) => updateField('start_at', fromDatetimeLocal(e.target.value))} />
                </div>
                <div>
                  <label className={labelCls}>End at (optional)</label>
                  <input type="datetime-local" className={inputCls} value={toDatetimeLocal(editing.end_at)} onChange={(e) => updateField('end_at', fromDatetimeLocal(e.target.value))} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Display pages</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => togglePage('all')} className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${allPagesSelected ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>All pages</button>
                  {PAGE_OPTIONS.map((p) => {
                    const active = !allPagesSelected && selectedPages.includes(p.id);
                    return (
                      <button key={p.id} type="button" onClick={() => togglePage(p.id)} className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelCls}>Image</label>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {editing.image_url ? (
                    <img src={editing.image_url} alt="" className="w-full sm:w-48 h-32 object-cover rounded-xl border border-slate-200 bg-slate-50" />
                  ) : (
                    <div className="w-full sm:w-48 h-32 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-300 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-50">
                      <Upload className="w-3.5 h-3.5" /> {uploading ? 'Uploading...' : 'Upload Image'}
                    </button>
                    {editing.image_url && (
                      <button type="button" onClick={() => updateField('image_url', '')} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100">
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  {(['en', 'fr', 'ar'] as LangTab[]).map((l) => (
                    <button key={l} type="button" onClick={() => setLangTab(l)} className={`px-3 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wide border transition-colors ${langTab === l ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <div className="grid gap-4">
                  <div>
                    <label className={labelCls}>Title ({langTab.toUpperCase()})</label>
                    <input type="text" className={inputCls} dir={langTab === 'ar' ? 'rtl' : 'ltr'} value={editing[`title_${langTab}`]} onChange={(e) => updateField(`title_${langTab}` as keyof Popup, e.target.value as any)} placeholder={`Popup title in ${langTab.toUpperCase()}`} />
                  </div>
                  <div>
                    <label className={labelCls}>Body ({langTab.toUpperCase()})</label>
                    <textarea className={`${inputCls} min-h-[120px] resize-y`} dir={langTab === 'ar' ? 'rtl' : 'ltr'} value={editing[`body_${langTab}`]} onChange={(e) => updateField(`body_${langTab}` as keyof Popup, e.target.value as any)} placeholder={`Popup message in ${langTab.toUpperCase()}`} />
                  </div>
                  <div>
                    <label className={labelCls}>CTA text ({langTab.toUpperCase()})</label>
                    <input type="text" className={inputCls} dir={langTab === 'ar' ? 'rtl' : 'ltr'} value={editing[`cta_text_${langTab}`]} onChange={(e) => updateField(`cta_text_${langTab}` as keyof Popup, e.target.value as any)} placeholder={langTab === 'ar' ? 'مثال: تسوق الآن' : langTab === 'fr' ? 'Ex: Voir l’offre' : 'e.g. Shop now'} />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                {!isNew && (
                  <button type="button" onClick={() => handleDelete(editing.id)} disabled={deletingId === editing.id || saving} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-rose-200 bg-white text-rose-700 text-xs font-bold hover:bg-rose-50 disabled:opacity-50">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Popup
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={closeEditor} disabled={saving} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="button" onClick={handleSave} disabled={saving || uploading} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50 shadow-sm shadow-red-900/20">
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Popup'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
