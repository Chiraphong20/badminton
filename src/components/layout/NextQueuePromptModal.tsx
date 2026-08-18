import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { RANK_COLORS, CourtQueueSlot, Court } from '../../types';

interface NextQueuePrompt {
  courtId: string;
  courtName: string;
  slot: CourtQueueSlot;
  emptyCourts: Court[];
}

interface NextQueuePromptModalProps {
  prompt: NextQueuePrompt | null;
  onConfirm: (targetCourtId: string, slot: CourtQueueSlot, sourceCourtId: string) => void;
  onClose: () => void;
}

/** "มีคิวถัดไป!" overlay shown right after a court is cleared, when that court has a queue. */
export function NextQueuePromptModal({ prompt, onConfirm, onClose }: NextQueuePromptModalProps) {
  return (
    <AnimatePresence>
      {prompt && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4"
        >
          <motion.div className="absolute inset-0 bg-on-surface/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-[2rem] p-6 w-full max-w-md shadow-2xl z-10"
          >
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">⏭</span>
              </div>
              <h3 className="font-headline font-black text-2xl">มีคิวถัดไป!</h3>
              <p className="text-sm text-on-surface/50 mt-1">{prompt.courtName}</p>
            </div>

            {/* Players preview */}
            <div className="bg-background rounded-2xl p-4 mb-5">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                <div className="space-y-1.5">
                  {prompt.slot.teamA.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0', RANK_COLORS[p.rank])}>{p.rank}</span>
                      <span className="font-bold text-sm truncate">{p.name}</span>
                    </div>
                  ))}
                </div>
                <span className="text-on-surface/20 font-black text-xs text-center">VS</span>
                <div className="space-y-1.5">
                  {prompt.slot.teamB.map((p, i) => (
                    <div key={i} className="flex items-center justify-end gap-2">
                      <span className="font-bold text-sm truncate">{p.name}</span>
                      <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0', RANK_COLORS[p.rank])}>{p.rank}</span>
                    </div>
                  ))}
                </div>
              </div>
              {prompt.slot.note && (
                <p className="text-xs text-on-surface/40 text-center mt-2 border-t border-on-surface/5 pt-2">{prompt.slot.note}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <button
                onClick={() => onConfirm(prompt.courtId, prompt.slot, prompt.courtId)}
                className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-base shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                เริ่มตีที่{prompt.courtName}เลย
              </button>
              {prompt.emptyCourts.filter(c => c.id !== prompt.courtId).map(c => (
                <button key={c.id}
                  onClick={() => onConfirm(c.id, prompt.slot, prompt.courtId)}
                  className="w-full bg-secondary/10 text-secondary py-3 rounded-2xl font-bold text-sm hover:bg-secondary/20 transition-all"
                >
                  ย้ายไปตีที่ {c.name} แทน
                </button>
              ))}
              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl font-bold text-sm text-on-surface/40 hover:bg-on-surface/5 transition-all"
              >
                ข้ามไปก่อน
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
