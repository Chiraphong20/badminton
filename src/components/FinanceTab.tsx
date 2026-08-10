import React, { useState } from 'react';
import { Banknote, History, Share2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Member, PaymentRecord, RANK_COLORS, RANK_LEVEL_LABELS } from '../types';
import { format } from 'date-fns';

interface Props {
  members: Member[];
  paymentHistory: PaymentRecord[];
  onMarkAsPaid: (memberId: string) => void;
}

export function FinanceTab({ members, paymentHistory, onMarkAsPaid }: Props) {
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [copied, setCopied] = useState(false);

  const pendingMembers = members.filter(m => m.balance > 0).sort((a, b) => b.balance - a.balance);
  const totalPending = pendingMembers.reduce((a, m) => a + m.balance, 0);
  const totalPaid = paymentHistory.reduce((a, r) => a + r.amount, 0);

  const handleCopyBill = () => {
    const lines = [
      '🏸 SmashIT — สรุปบิลเซสชัน',
      `📅 ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
      '─────────────────────',
      ...pendingMembers.map(m => `${m.name} (${m.rank}) — ฿${m.balance.toFixed(0)}`),
      '─────────────────────',
      `รวม ฿${totalPending.toFixed(0)}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-error/5 border border-error/10 rounded-3xl p-6">
          <p className="text-xs font-bold text-error mb-2">ค้างชำระ</p>
          <p className="text-4xl font-headline font-black text-error">฿{totalPending.toLocaleString()}</p>
          <p className="text-xs font-bold text-on-surface/40 mt-1">{pendingMembers.length} คน</p>
        </div>
        <div className="bg-tertiary/5 border border-tertiary/10 rounded-3xl p-6">
          <p className="text-xs font-bold text-tertiary mb-2">รับแล้ว</p>
          <p className="text-4xl font-headline font-black text-tertiary">฿{totalPaid.toLocaleString()}</p>
          <p className="text-xs font-bold text-on-surface/40 mt-1">{paymentHistory.length} รายการ</p>
        </div>
        <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6">
          <p className="text-xs font-bold text-primary mb-2">รวมทั้งหมด</p>
          <p className="text-4xl font-headline font-black text-primary">฿{(totalPending + totalPaid).toLocaleString()}</p>
          <p className="text-xs font-bold text-on-surface/40 mt-1">รายรับวันนี้</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        {[{ id: 'pending', label: `ค้างชำระ (${pendingMembers.length})` }, { id: 'history', label: `ประวัติ (${paymentHistory.length})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn('px-5 py-2.5 rounded-full font-bold text-sm transition-all',
              tab === t.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-on-surface/60 hover:bg-white')}>
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'pending' && (
          <motion.div key="pending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {pendingMembers.length === 0 ? (
              <div className="text-center py-20 bg-white/60 rounded-3xl border-2 border-dashed border-on-surface/10">
                <Check size={40} className="mx-auto text-tertiary mb-3" />
                <p className="font-bold text-on-surface/40">ทุกคนชำระแล้ว! 🎉</p>
              </div>
            ) : (
              <>
                {pendingMembers.map(member => (
                  <div key={member.id} className="bg-white rounded-3xl p-5 shadow-sm border border-on-surface/5 flex items-center gap-4">
                    <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0', RANK_COLORS[member.rank])}>
                      {member.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-on-surface">{member.name}</p>
                      <p className="text-xs text-on-surface/50">
                        {RANK_LEVEL_LABELS[member.rank]}{RANK_LEVEL_LABELS[member.rank] ? ' • ' : ''}{member.gamesPlayed} เกม
                      </p>
                    </div>
                    <div className="text-right mr-4">
                      <p className="font-headline font-black text-2xl text-error">฿{member.balance.toFixed(0)}</p>
                    </div>
                    <button onClick={() => onMarkAsPaid(member.id)}
                      className="bg-tertiary text-white px-4 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-tertiary/20 hover:scale-105 active:scale-95 transition-transform whitespace-nowrap flex items-center gap-1.5">
                      <Check size={14} />รับเงิน
                    </button>
                  </div>
                ))}

                {/* Copy to LINE button */}
                <button onClick={handleCopyBill}
                  className="w-full bg-on-surface text-white py-4 rounded-2xl font-headline font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-xl shadow-on-surface/20 active:scale-95 transition-all hover:bg-on-surface/80">
                  {copied ? <><Check size={18} />คัดลอกแล้ว!</> : <><Share2 size={18} />คัดลอกบิล (LINE)</>}
                </button>
              </>
            )}
          </motion.div>
        )}

        {tab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            {paymentHistory.length === 0 ? (
              <div className="text-center py-20 bg-white/60 rounded-3xl border-2 border-dashed border-on-surface/10">
                <History size={40} className="mx-auto text-on-surface/20 mb-3" />
                <p className="font-bold text-on-surface/40">ยังไม่มีประวัติการชำระเงิน</p>
              </div>
            ) : (
              paymentHistory.map(record => (
                <div key={record.id} className="bg-white rounded-2xl p-4 shadow-sm border border-on-surface/5 flex items-center gap-4">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0', RANK_COLORS[record.memberRank])}>
                    {record.memberRank}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm">{record.memberName}</p>
                    <p className="text-xs text-on-surface/45">{record.note} • {format(new Date(record.timestamp), 'HH:mm')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-headline font-black text-tertiary">฿{record.amount.toFixed(0)}</p>
                    <span className="text-xs bg-tertiary/10 text-tertiary px-2 py-1 rounded-full font-bold">ชำระแล้ว</span>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
