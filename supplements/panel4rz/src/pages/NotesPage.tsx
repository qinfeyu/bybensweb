import React, { useEffect, useRef, useState } from 'react';
import { Bold, Italic, List, ListOrdered, Link2, ImagePlus, Save, StickyNote, Clock, User, Trash2 } from 'lucide-react';
import type { Note } from '../types';
import { uploadToCloudinary } from '../lib/cloudinary';

interface NotesPageProps {
  note: Note;
  onSave: (content: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function formatUpdatedAt(value?: string) {
  if (!value) return 'Never saved';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never saved';
  return date.toLocaleString('fr-DZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotesPage({ note, onSave, showToast }: NotesPageProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedContentRef = useRef(note.content || '');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [selectedImgWidth, setSelectedImgWidth] = useState(100);

  const clearImageSelection = () => {
    const editor = editorRef.current;
    if (editor) {
      editor.querySelectorAll('img.bb-img-selected').forEach((el) => {
        el.classList.remove('bb-img-selected');
      });
    }
    setSelectedImg(null);
  };

  useEffect(() => {
    const nextContent = note.content || '';
    const editor = editorRef.current;
    savedContentRef.current = nextContent;

    if (!editor) return;

    clearImageSelection();
    const current = editor.innerHTML;
    if (current !== nextContent) {
      editor.innerHTML = nextContent;
    }
    setIsDirty(false);
  }, [note.id, note.content, note.updated_at]);

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const getCleanHtml = () => {
    const editor = editorRef.current;
    if (!editor) return '';
    editor.querySelectorAll('img.bb-img-selected').forEach((el) => el.classList.remove('bb-img-selected'));
    const html = editor.innerHTML;
    if (selectedImg && editor.contains(selectedImg)) {
      selectedImg.classList.add('bb-img-selected');
    }
    return html;
  };

  const syncDirty = () => {
    setIsDirty(getCleanHtml() !== savedContentRef.current);
  };

  const getImageWidthPercent = (img: HTMLImageElement) => {
    const width = img.style.width;
    if (width.endsWith('%')) {
      const parsed = parseFloat(width);
      if (!Number.isNaN(parsed)) return Math.max(10, Math.min(100, Math.round(parsed)));
    }
    const editorWidth = editorRef.current?.clientWidth || 1;
    const rectWidth = img.getBoundingClientRect().width;
    if (rectWidth > 0 && editorWidth > 0) {
      return Math.max(10, Math.min(100, Math.round((rectWidth / editorWidth) * 100)));
    }
    return 100;
  };

  const selectImage = (img: HTMLImageElement) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll('img.bb-img-selected').forEach((el) => {
      if (el !== img) el.classList.remove('bb-img-selected');
    });
    img.classList.add('bb-img-selected');
    setSelectedImg(img);
    setSelectedImgWidth(getImageWidthPercent(img));
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target && target.tagName === 'IMG' && editorRef.current?.contains(target)) {
      selectImage(target as HTMLImageElement);
      return;
    }
    clearImageSelection();
  };

  const setImageWidth = (width: number) => {
    if (!selectedImg || !editorRef.current?.contains(selectedImg)) return;
    const clamped = Math.max(10, Math.min(100, Math.round(width)));
    selectedImg.style.width = `${clamped}%`;
    selectedImg.style.height = 'auto';
    selectedImg.style.maxWidth = '100%';
    setSelectedImgWidth(clamped);
    syncDirty();
  };

  const removeSelectedImage = () => {
    if (!selectedImg || !editorRef.current?.contains(selectedImg)) return;
    selectedImg.remove();
    setSelectedImg(null);
    syncDirty();
  };

  const runCommand = (command: string, value?: string) => {
    focusEditor();
    document.execCommand(command, false, value);
    syncDirty();
  };

  const handleLink = () => {
    const url = window.prompt('Enter URL (https://...)');
    if (!url) return;
    const trimmed = url.trim();
    if (!trimmed) return;
    runCommand('createLink', trimmed);
  };

  const insertImageAtCursor = (url: string) => {
    focusEditor();
    const imgHtml = `<img src="${url}" alt="Note image" style="max-width:100%;height:auto;border-radius:12px;margin:8px 0;display:block;" />`;
    const inserted = document.execCommand('insertHTML', false, imgHtml);
    if (!inserted && editorRef.current) {
      editorRef.current.insertAdjacentHTML('beforeend', imgHtml);
    }
    syncDirty();
  };

  const uploadAndInsertImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Image is too large (max 10MB).', 'error');
      return;
    }

    setIsUploadingImage(true);
    try {
      const url = await uploadToCloudinary(file, 'bybens-notes');
      insertImageAtCursor(url);
      showToast('Image inserted. Click Save to persist the note.', 'info');
    } catch (e: any) {
      showToast(e?.message || 'Image upload failed.', 'error');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await uploadAndInsertImage(file);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    e.preventDefault();
    await uploadAndInsertImage(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    const file = Array.from(e.dataTransfer?.files || []).find(f => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    await uploadAndInsertImage(file);
  };

  const handleSave = async () => {
    if (isSaving) return;
    clearImageSelection();
    const content = editorRef.current?.innerHTML || '';
    setIsSaving(true);
    try {
      await onSave(content);
      savedContentRef.current = content;
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  };

  const toolbarButtonClass = "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <StickyNote className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight">Shared Notes</h1>
                <p className="text-xs text-slate-500 font-medium">Single shared notepad for your business. Manual save only.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-semibold pt-1">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Last saved: {formatUpdatedAt(note.updated_at)}
              </span>
              {note.updated_by && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {note.updated_by}
                </span>
              )}
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${isDirty ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isDirty ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                {isDirty ? 'Unsaved changes' : 'Saved'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-red-900/20"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('bold')} title="Bold">
              <Bold className="w-3.5 h-3.5" /> Bold
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('italic')} title="Italic">
              <Italic className="w-3.5 h-3.5" /> Italic
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('insertUnorderedList')} title="Bulleted list">
              <List className="w-3.5 h-3.5" /> Bullets
            </button>
            <button type="button" className={toolbarButtonClass} onClick={() => runCommand('insertOrderedList')} title="Numbered list">
              <ListOrdered className="w-3.5 h-3.5" /> Numbered
            </button>
            <button type="button" className={toolbarButtonClass} onClick={handleLink} title="Insert link">
              <Link2 className="w-3.5 h-3.5" /> Link
            </button>
            <button
              type="button"
              className={toolbarButtonClass}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              title="Insert image"
            >
              <ImagePlus className="w-3.5 h-3.5" /> {isUploadingImage ? 'Uploading...' : 'Image'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImagePick}
            />
          </div>

          {selectedImg && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-amber-800">Image size</span>
              {[25, 50, 75, 100].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setImageWidth(size)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    selectedImgWidth === size
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {size}%
                </button>
              ))}
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 ml-1">
                <span>Custom</span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={selectedImgWidth}
                  onChange={(e) => setImageWidth(Number(e.target.value))}
                  className="w-32 accent-red-600"
                />
                <span className="w-10 text-slate-800">{selectedImgWidth}%</span>
              </label>
              <button
                type="button"
                onClick={removeSelectedImage}
                className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-white text-rose-600 text-xs font-bold hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            </div>
          )}
        </div>

        <div className="p-5">
          <style>{`
            .bb-notes-editor:empty:before {
              content: attr(data-placeholder);
              color: #94a3b8;
              pointer-events: none;
            }
            .bb-notes-editor ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
            .bb-notes-editor ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
            .bb-notes-editor a { color: #dc2626; text-decoration: underline; }
            .bb-notes-editor img { max-width: 100%; height: auto; border-radius: 12px; margin: 8px 0; display: block; cursor: pointer; }
            .bb-notes-editor img.bb-img-selected { outline: 3px solid #f59e0b; outline-offset: 2px; }
            .bb-notes-editor p { margin: 0.5rem 0; }
          `}</style>
          <div
            ref={editorRef}
            className="bb-notes-editor min-h-[420px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-800 leading-7 outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Write your shared business notes here... Use the toolbar to format text, add links, or insert images."
            onInput={syncDirty}
            onBlur={syncDirty}
            onClick={handleEditorClick}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={(e) => {
              if (Array.from(e.dataTransfer?.items || []).some(i => i.type.startsWith('image/'))) {
                e.preventDefault();
              }
            }}
          />
          <p className="mt-3 text-[11px] text-slate-500 font-medium">
            Images are uploaded to Cloudinary when inserted. Changes are saved only when you click <span className="font-bold text-slate-700">Save</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
