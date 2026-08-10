import React, { useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Rank, RANKS, RANK_COLORS, RANK_LEVEL_LABELS } from '../types';
import { useModalHotkeys } from '../hooks/useModalHotkeys';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, rank: Rank) => void;
  existingNames: string[];
  rankMemory?: Record<string, Rank>;
}

export function AddMemberModal({ open, onClose, onAdd, existingNames, rankMemory = {} }: Props) {
  const [name, setName] = useState('');
  const [rank, setRank] = useState<Rank>('P');

  // Enter already submits natively via the focused text input; add Esc to close.
  useModalHotkeys({ onClose, enabled: open });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    if (existingNames.some(n => n.toLowerCase() === name.trim().toLowerCase())) {
      alert(`ชื่อ "${name.trim()}" มีอยู่ในรายการแล้วครับ!`);
      return;
    }

    onAdd(name.trim(), rank);
    setName('');
    setRank('P');
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-on-surface/50 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] p-8 relative z-10 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-headline font-black text-3xl tracking-tighter">ผู้เล่นใหม่</h2>
              <button onClick={onClose} className="p-2 hover:bg-background rounded-full transition-colors"><X size={24} /></button>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface/50 ml-2">ชื่อผู้เล่น</label>
                <input
                  autoFocus required
                  value={name}
                  onChange={e => {
                    const val = e.target.value;
                    setName(val);
                    if (rankMemory[val]) {
                      setRank(rankMemory[val]);
                    }
                  }}
                  list="member-suggestions"
                  placeholder="ใส่ชื่อ..."
                  className="w-full px-6 py-4 bg-background border-none rounded-2xl focus:ring-2 focus:ring-primary/20 font-bold transition-all"
                />
                <datalist id="member-suggestions">
                  {Object.keys(rankMemory).map(n => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-on-surface/50 ml-2">ระดับมือ</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {RANKS.map(r => (
                    <label key={r} className="relative cursor-pointer">
                      <input type="radio" name="rank" value={r} checked={rank === r} onChange={() => setRank(r)} className="peer sr-only" />
                      <div className={cn(
                        'py-3 rounded-xl text-center font-black text-xs transition-all border-2 border-transparent peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary/20',
                        RANK_COLORS[r]
                      )}>
                        {r}
                      </div>
                    </label>
                  ))}
                </div>

              </div>

              <button type="submit"
                className="w-full bg-primary text-white py-5 rounded-2xl font-headline font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all mt-2">
                เช็คอินผู้เล่น
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
