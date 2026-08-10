import React, { useState } from 'react';
import { X, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useModalHotkeys } from '../hooks/useModalHotkeys';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string) => void;
}

export function AddCourtModal({ open, onClose, onAdd }: Props) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim());
    setName('');
    onClose();
  };

  // Enter already submits natively via the focused text input; add Esc to close.
  useModalHotkeys({ onClose, enabled: open });

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-on-surface/60 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative z-10 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Trophy size={20} className="text-primary" />
                </div>
                <h2 className="font-headline font-black text-2xl tracking-tighter">เพิ่มคอร์ด</h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-background rounded-full transition-colors"><X size={22} /></button>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface/50 ml-2">ชื่อคอร์ด</label>
                <input
                  autoFocus required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="เช่น คอร์ด 4, คอร์ด A..."
                  className="w-full px-6 py-4 bg-background border-none rounded-2xl focus:ring-2 focus:ring-primary/20 font-bold transition-all"
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={onClose}
                  className="flex-1 py-4 rounded-2xl font-black uppercase text-sm text-on-surface/60 bg-background hover:bg-on-surface/10 transition-all">
                  ยกเลิก
                </button>
                <button type="submit"
                  className="flex-1 bg-primary text-white py-4 rounded-2xl font-headline font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
                  เพิ่มคอร์ด
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
