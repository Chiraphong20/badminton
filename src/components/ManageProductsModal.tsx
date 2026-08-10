import React, { useState, useRef } from 'react';
import { X, Plus, Trash2, Check, Pencil, Upload, Link, Image } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Snack } from '../types';
import { useModalHotkeys } from '../hooks/useModalHotkeys';

interface Props {
  open: boolean;
  onClose: () => void;
  snacks: Snack[];
  onSave: (snacks: Snack[]) => void;
}

const EMOJI_OPTIONS = ['💧','⚡','🏸','🍪','🥤','🍜','🍱','🍌','🍊','🧃','☕','🍩','🍫','🌮','🥗','🔥','🥛','🍺','🥥','🍃'];

// ── Image input component (upload file OR URL) ────────────────────────────────
function ImageInput({
  value,
  icon,
  onChange,
  onIconChange,
}: {
  value?: string;
  icon: string;
  onChange: (url: string) => void;
  onIconChange: (icon: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'emoji' | 'url' | 'upload'>('emoji');
  const [urlInput, setUrlInput] = useState(value?.startsWith('data:') ? '' : value || '');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  const previewSrc = value;

  return (
    <div className="space-y-2">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-on-surface/5 p-1 rounded-xl">
        {(['emoji', 'url', 'upload'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
              tab === t ? 'bg-white shadow text-primary' : 'text-on-surface/40 hover:text-on-surface/70'
            }`}
          >
            {t === 'emoji' && <span>😊</span>}
            {t === 'url' && <Link size={10} />}
            {t === 'upload' && <Upload size={10} />}
            {t === 'emoji' ? 'Emoji' : t === 'url' ? 'URL' : 'อัปโหลด'}
          </button>
        ))}
      </div>

      {/* Emoji picker */}
      {tab === 'emoji' && (
        <div className="flex flex-wrap gap-1.5">
          {EMOJI_OPTIONS.map(em => (
            <button
              key={em}
              type="button"
              onClick={() => { onIconChange(em); onChange(''); }}
              className={`text-xl p-1.5 rounded-xl transition-all ${icon === em && !value ? 'bg-primary/10 ring-2 ring-primary' : 'hover:bg-on-surface/10'}`}
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* URL input */}
      {tab === 'url' && (
        <div className="flex gap-2 items-center">
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onChange(urlInput.trim()); } }}
            placeholder="https://example.com/image.jpg"
            className="flex-1 px-3 py-2 bg-white rounded-xl border border-on-surface/10 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
          />
          <button
            type="button"
            onClick={() => onChange(urlInput.trim())}
            className="bg-primary text-white px-3 py-2 rounded-xl text-xs font-black hover:scale-105 transition-transform"
          >
            ใช้
          </button>
        </div>
      )}

      {/* Upload from device */}
      {tab === 'upload' && (
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full py-3 border-2 border-dashed border-primary/30 rounded-xl text-primary/60 hover:border-primary hover:text-primary transition-all text-xs font-black flex items-center justify-center gap-2"
          >
            <Upload size={14} />
            เลือกภาพจากเครื่อง
          </button>
        </div>
      )}

      {/* Preview */}
      {previewSrc && (
        <div className="flex items-center gap-2 bg-on-surface/5 rounded-xl p-2">
          <img src={previewSrc} alt="preview" className="w-10 h-10 object-contain rounded-lg bg-white" />
          <span className="text-xs text-on-surface/50 font-medium flex-1 truncate">ภาพสินค้า</span>
          <button type="button" onClick={() => { onChange(''); setUrlInput(''); }} className="text-error/60 hover:text-error">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export function ManageProductsModal({ open, onClose, snacks, onSave }: Props) {
  const [items, setItems] = React.useState<Snack[]>(snacks);

  React.useEffect(() => {
    if (open) setItems(snacks);
  }, [open, snacks]);

  const [editing, setEditing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newIcon, setNewIcon] = useState('💧');
  const [newImage, setNewImage] = useState('');

  const handleSave = () => {
    onSave(items);
    onClose();
  };

  // Esc closes, Enter saves — unless focus is in a sub-field that has its own Enter behavior
  // (those fields call e.stopPropagation() in their own onKeyDown to opt out).
  useModalHotkeys({ onClose, onSubmit: handleSave, enabled: open });

  const updateItem = (id: string, field: keyof Snack, value: string | number) => {
    setItems(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(s => s.id !== id));
  };

  const addItem = () => {
    if (!newName.trim() || !newPrice) return;
    const newSnack: Snack = {
      id: Math.random().toString(36).substr(2, 9),
      name: newName.trim(),
      price: Number(newPrice),
      icon: newIcon,
      image: newImage || undefined,
    };
    setItems(prev => [...prev, newSnack]);
    setNewName('');
    setNewPrice('');
    setNewIcon('💧');
    setNewImage('');
    setShowAdd(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-on-surface/60 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 relative z-10 shadow-2xl max-h-[92vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="font-headline font-black text-2xl tracking-tighter">จัดการสินค้า</h2>
              <button onClick={onClose} className="p-2 hover:bg-background rounded-full transition-colors">
                <X size={22} />
              </button>
            </div>

            {/* Product list */}
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
              <AnimatePresence>
                {items.length === 0 && (
                  <div className="text-center py-8 text-on-surface/30">
                    <Image size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-bold">ยังไม่มีสินค้า</p>
                    <p className="text-xs">กดปุ่ม "เพิ่มสินค้า" ด้านล่างเพื่อเริ่มต้น</p>
                  </div>
                )}
                {items.map(item => (
                  <motion.div key={item.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                    className="bg-background rounded-2xl p-4">
                    {editing === item.id ? (
                      <div className="space-y-3">
                        <ImageInput
                          value={item.image}
                          icon={item.icon}
                          onChange={url => updateItem(item.id, 'image', url)}
                          onIconChange={ic => updateItem(item.id, 'icon', ic)}
                        />
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            value={item.name}
                            onChange={e => updateItem(item.id, 'name', e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setEditing(null); } }}
                            className="flex-1 px-3 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-primary/20 font-bold text-sm"
                            placeholder="ชื่อสินค้า"
                          />
                          <input
                            type="number"
                            value={item.price}
                            onChange={e => updateItem(item.id, 'price', Number(e.target.value))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setEditing(null); } }}
                            className="w-20 px-3 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-primary/20 font-bold text-sm"
                            placeholder="฿"
                          />
                          <button onClick={() => setEditing(null)}
                            className="bg-primary text-white p-2 rounded-xl hover:scale-105 transition-transform">
                            <Check size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-contain p-0.5" />
                          ) : (
                            <span className="text-xl">{item.icon}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm">{item.name}</p>
                          <p className="text-xs text-on-surface/40 font-bold">฿{item.price}</p>
                        </div>
                        <button onClick={() => setEditing(item.id)}
                          className="text-on-surface/30 hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-primary/10">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => deleteItem(item.id)}
                          className="text-on-surface/30 hover:text-error transition-colors p-1.5 rounded-lg hover:bg-error/10">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Add new product form */}
              <AnimatePresence>
                {showAdd && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-primary/5 border-2 border-dashed border-primary/20 rounded-2xl p-4 space-y-3 overflow-hidden"
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">สินค้าใหม่</p>
                    <ImageInput
                      value={newImage}
                      icon={newIcon}
                      onChange={url => setNewImage(url)}
                      onIconChange={ic => setNewIcon(ic)}
                    />
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); addItem(); } }}
                        className="flex-1 px-3 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-primary/20 font-bold text-sm"
                        placeholder="ชื่อสินค้า"
                      />
                      <input
                        type="number"
                        value={newPrice}
                        onChange={e => setNewPrice(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); addItem(); } }}
                        className="w-20 px-3 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-primary/20 font-bold text-sm"
                        placeholder="฿"
                      />
                      <button onClick={addItem}
                        className="bg-primary text-white p-2 rounded-xl hover:scale-105 transition-transform">
                        <Check size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Add button */}
              <button
                onClick={() => setShowAdd(v => !v)}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-on-surface/15 hover:border-primary/40 text-on-surface/40 hover:text-primary font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
              >
                <Plus size={16} />{showAdd ? 'ซ่อน' : 'เพิ่มสินค้า'}
              </button>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              className="w-full bg-primary text-white py-4 rounded-2xl font-headline font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all shrink-0"
            >
              บันทึก ({items.length} รายการ)
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
