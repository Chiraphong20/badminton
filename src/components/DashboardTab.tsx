import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users, TrendingUp, Calendar, Search, LogOut, Check, ChevronUp, ChevronDown,
  Trash2, ShoppingCart, UserPlus, Clock, Trophy, FileText, ChevronLeft, Bolt, Banknote, X, Plus, RefreshCw, Monitor, Cloud, Upload, Download, CheckCircle2, History, Gift
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Member, Court, PaymentRecord, GameRecord, Snack, Rank, RANKS, RANK_COLORS, RANK_LEVEL_LABELS, SessionRecord, RANK_WEIGHTS } from '../types';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { POSModal } from './POSModal';
import { useModalHotkeys } from '../hooks/useModalHotkeys';

interface Props {
  members: Member[];
  courts: Court[];
  snacks: Snack[];
  paymentHistory: PaymentRecord[];
  gameHistory: GameRecord[];
  onAddSnack: (memberId: string, snacks: Snack[]) => void;
  onUpdateRank: (memberId: string, rank: Rank) => void;
  onRemoveSnack: (memberId: string, snackIndex: number) => void;
  viewingSession: SessionRecord | null;
  onCloseSession: () => void;
  sessionHistory: SessionRecord[];
  onViewSession: (s: SessionRecord) => void;
  onProcessPayment: (memberId: string, amount: number, method?: string, otherMemberIds?: string[]) => void;
  onReOpen: (memberId: string) => void;
  onUpdateSnackPrice: (memberId: string, index: number, price: number) => void;
  onPullSession: (date: string) => Promise<any>;
  onAddCourt: () => void;
  isSidebarCollapsed: boolean;
  onCheckIn: (memberId: string) => void;
  onRemove: (memberId: string) => void;
  onResetDay: () => void;
  onClearBoard: () => void;
  onUpdateGame: (id: string, players: string[], shuttles: number) => void;
  isSyncing: boolean;
  onImportLine: () => void;
  sessionStartDate?: number | null;
}



// Modal showing a player's checkout details (snacks, games, and payment)
function CheckoutModal({ member, gameHistory, otherMembers, paymentHistory = [], initialOthers = [], onUpdateRank, onRemoveSnack, onUpdateSnackPrice, onPay, onReOpen, isReadOnly, onClose }: {
  member: Member;
  gameHistory: GameRecord[];
  otherMembers: Member[];
  paymentHistory?: PaymentRecord[];
  initialOthers?: string[];
  onUpdateRank: (memberId: string, rank: Rank) => void;
  onRemoveSnack: (memberId: string, snackIndex: number) => void;
  onUpdateSnackPrice: (memberId: string, index: number, price: number) => void;
  onPay: (amount: number, otherMemberIds: string[]) => void;
  onReOpen: (memberId: string) => void;
  isReadOnly: boolean;
  onClose: () => void;
}) {
  const [selectedOthers] = useState<string[]>(initialOthers);
  const myGames = gameHistory.filter(g => g.players.some(p => p.id === member.id));

  const othersNames = otherMembers.filter(m => selectedOthers.includes(m.id)).map(m => m.name).join(', ');
  const totalBalance = member.balance + otherMembers.filter(m => selectedOthers.includes(m.id)).reduce((a, b) => a + b.balance, 0);

  const [manualAmount, setManualAmount] = useState<number | null>(null);
  const displayAmount = manualAmount !== null ? manualAmount : totalBalance;

  const [editingSnackIndex, setEditingSnackIndex] = useState<number | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');

  // ดึง snack history จาก PaymentRecord สำหรับคนที่จ่ายแล้ว (snackHistory จะถูกล้างหลังจ่าย)
  const isPaid = member.status === 'paid';
  const paidSnackHistory = isPaid
    ? paymentHistory
        .filter(p => p.memberId === member.id)
        .flatMap(p => p.details?.snackHistory || [])
    : [];
  // ถ้าคนยังไม่จ่าย ใช้ snackHistory ปกติ ถ้าจ่ายแล้วใช้จาก payment records
  const displaySnackHistory = isPaid ? paidSnackHistory : (member.snackHistory || []);

  useModalHotkeys({
    onClose,
    onSubmit: () => {
      if (!isReadOnly && member.status !== 'paid' && displayAmount >= 0) onPay(displayAmount, selectedOthers);
    },
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-on-surface/50 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl relative z-10 max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-5 mb-6">
          <div className="relative group/rank">
            <div className={cn('w-16 h-16 rounded-[1.5rem] flex items-center justify-center font-black text-xl shrink-0 shadow-lg', RANK_COLORS[member.rank])}>
              {member.rank}
            </div>
            {!isReadOnly && (
              <select
                value={member.rank}
                onChange={(e) => onUpdateRank(member.id, e.target.value as Rank)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              >
                {[...RANKS].map(r => (
                  <option key={r} value={r}>{r}{RANK_LEVEL_LABELS[r] ? ` (${RANK_LEVEL_LABELS[r]})` : ''}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-headline font-black text-3xl tracking-tight leading-none mb-2">{member.name}</h2>
            <div className="flex items-center gap-2">
              {RANK_LEVEL_LABELS[member.rank] && (
                <>
                  <span className="text-xs font-semibold text-primary px-2 py-0.5 bg-primary/5 rounded-full">{RANK_LEVEL_LABELS[member.rank]}</span>
                  <span className="text-on-surface/20">•</span>
                </>
              )}
              <span className="text-xs font-semibold text-on-surface/45">{member.gamesPlayed} เกมส์</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-full hover:bg-background shrink-0 text-on-surface/20 hover:text-on-surface transition-colors"><X size={24} /></button>
        </div>

        {/* Cost summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-primary/5 rounded-[1.5rem] p-4 text-center border border-primary/5">
            <p className="text-xs font-semibold text-primary/50 mb-1">ยอดรวม (ค่ากิจกรรม / ค่าลูก)</p>
            <p className="font-headline font-black text-2xl text-primary">฿{((member.totalCourt ?? member.courtBalance) + (member.totalShuttle ?? member.shuttleBalance)).toFixed(0)}</p>
          </div>
          <div className="bg-tertiary/5 rounded-[1.5rem] p-4 text-center border border-tertiary/5 shadow-inner">
            <p className="text-xs font-semibold text-tertiary/50 mb-1">สินค้า</p>
            <p className="font-headline font-black text-2xl text-tertiary">฿{(member.totalSnack || member.snackBalance || paidSnackHistory.reduce((a,s)=>a+s.price,0)).toFixed(0)}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 min-h-0 pr-1 custom-scrollbar">
          {/* Detailed Snack List — แสดงจาก payment record ถ้าจ่ายแล้ว */}
          {displaySnackHistory.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold text-xs text-on-surface/40 flex items-center gap-2">
                <ShoppingCart size={13} /> รายละเอียดน้ำ/ขนม
                {isPaid && <span className="text-green-600 normal-case font-semibold text-xs bg-green-500/10 px-2 py-0.5 rounded-full">บันทึกจากการชำระเงิน</span>}
              </h3>
              <div className="bg-background rounded-3xl p-4 space-y-2.5">
                {displaySnackHistory.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 group/snk">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-tertiary/20" />
                      <p className="text-sm font-bold truncate text-on-surface/70">{s.name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {editingSnackIndex === idx ? (
                        <input
                          type="number"
                          autoFocus
                          value={tempPrice}
                          onChange={e => setTempPrice(e.target.value)}
                          onBlur={() => {
                            const p = parseFloat(tempPrice);
                            if (!isNaN(p)) onUpdateSnackPrice(member.id, idx, p);
                            setEditingSnackIndex(null);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              const p = parseFloat(tempPrice);
                              if (!isNaN(p)) onUpdateSnackPrice(member.id, idx, p);
                              setEditingSnackIndex(null);
                            }
                          }}
                          className="w-16 px-1.5 py-0.5 bg-white border border-primary/20 rounded text-xs font-black text-on-surface focus:ring-1 focus:ring-primary/20 outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            if (!isReadOnly && !isPaid) {
                              setEditingSnackIndex(idx);
                              setTempPrice(s.price.toString());
                            }
                          }}
                          className="text-xs font-black text-on-surface/80 hover:text-primary transition-colors decoration-dotted hover:underline"
                        >
                          ฿{s.price}
                        </button>
                      )}
                      {!isReadOnly && !isPaid && (
                        <button
                          onClick={() => onRemoveSnack(member.id, idx)}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                          title="ลบรายการน้ำ"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Game History with Partners */}
          <div className="space-y-3">
            <h3 className="font-bold text-xs text-on-surface/40 flex items-center gap-2">
              <Trophy size={13} /> รายละเอียดการตี
            </h3>
            {myGames.length === 0 ? (
              <p className="text-center py-6 text-on-surface/20 text-xs font-bold italic">ไม่มีประวัติการตีในรอบนี้</p>
            ) : (
              <div className="space-y-3">
                {myGames.map((g, idx) => {
                  const partners = g.players.filter(p => p.id !== member.id);
                  return (
                    <div key={g.id} className="bg-background rounded-3xl p-5 border border-on-surface/5 hover:border-primary/20 transition-all group/game">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {myGames.length - idx}
                          </div>
                          <div>
                            <p className="text-sm font-black text-on-surface/80">{g.courtName}</p>
                            <p className="text-xs text-on-surface/45 font-semibold">{format(g.playedAt, 'HH:mm น.')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-on-surface/45 font-semibold mb-0.5">ใช้ {g.shuttlesUsed} ลูก</p>
                          <p className="text-sm font-black text-primary">฿{(g.shuttleCostPerPerson + (g.courtFeePerPerson || 0)).toFixed(0)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {partners.map(p => (
                          <span key={p.id} className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-on-surface/5 rounded-lg text-xs font-semibold text-on-surface/60">
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", RANK_COLORS[p.rank])} />
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bulk Payment Details label */}
        {!isReadOnly && selectedOthers.length > 0 && (
          <div className="mt-4 px-5 py-4 bg-primary/5 rounded-3xl border border-primary/10">
            <h4 className="text-xs font-bold text-primary/60 mb-3">รายชื่อคนอื่นๆ ที่จ่ายร่วมกัน</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {otherMembers.filter(m => selectedOthers.includes(m.id)).map(m => (
                <div key={m.id} className="flex items-center justify-between text-xs font-bold">
                  <span className="text-on-surface/60">{m.name}</span>
                  <span className="text-tertiary">฿{m.balance.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Checkout */}
        <div className="mt-8 pt-6 border-t border-on-surface/5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <p className="text-xs font-bold text-on-surface/40 mb-1">ยอดเงินที่รับมาจริง</p>
              <div className="flex items-baseline gap-1 group">
                <span className="font-black text-2xl text-error/40 group-focus-within:text-error transition-colors">฿</span>
                <input
                  type="number"
                  value={displayAmount}
                  onChange={(e) => setManualAmount(Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isReadOnly && member.status !== 'paid' && displayAmount >= 0) {
                      e.stopPropagation();
                      onPay(displayAmount, selectedOthers);
                    }
                  }}
                  className="bg-transparent border-none p-0 font-headline font-black text-4xl text-error tracking-tight focus:ring-0 w-full"
                />
              </div>
              {manualAmount !== null && manualAmount !== totalBalance && manualAmount >= 0 && (
                <p className="text-xs font-semibold text-primary mt-1 italic">* ปรับยอดจากเดิม ฿{totalBalance.toFixed(0)}</p>
              )}
            </div>
            {!isReadOnly && member.status !== 'paid' && displayAmount >= 0 && (
              <button
                onClick={() => onPay(displayAmount, selectedOthers)}
                className="flex-1 max-w-[200px] flex items-center justify-center gap-3 bg-primary text-white py-4 rounded-[1.5rem] font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <Banknote size={24} />
                รับเงิน & ปิดยอด
              </button>
            )}
            {member.status === 'paid' && (
              <div className="flex flex-col gap-2 flex-1 max-w-[200px]">
                <div className="flex items-center justify-center gap-2 text-green-500 font-black text-sm px-5 py-3 bg-green-500/10 rounded-2xl">
                  <CheckCircle2 size={20} />
                  จ่ายเรียบร้อย
                </div>
                {!isReadOnly && (
                  <button
                    onClick={() => {
                      if (confirm('ยืนยันยกเลิกสถานะการจ่ายเงิน เพื่อเปิดยอดใหม่?')) {
                        onReOpen(member.id);
                        onClose();
                      }
                    }}
                    className="text-xs font-bold text-on-surface/40 hover:text-error transition-colors text-center"
                  >
                    เปิดยอดใหม่ / ยกเลิกการจ่าย
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Warning for negative amounts */}
          {!isReadOnly && displayAmount < 0 && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3">
              <X className="text-red-500 shrink-0" size={18} />
              <p className="text-xs font-semibold text-red-600 leading-relaxed">
                หากต้องการลดค่าน้ำ ให้กดไอคอนถังขยะ <Trash2 size={10} className="inline mx-0.5" /> ด้านบนแทนการใส่เลขติดลบที่นี่ครับ
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Search+select popup used by the "เสียน้ำให้เพื่อน" flow — reused for both steps
// (pick the payer, then pick who they're treating).
function TreatMemberPicker({ title, subtitle, members, excludeId, onSelect, onClose }: {
  title: string;
  subtitle: string;
  members: Member[];
  excludeId?: string;
  onSelect: (member: Member) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setHighlightedIndex(0); }, [q]);
  useEffect(() => { itemRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' }); }, [highlightedIndex]);

  const list = members
    .filter(m => m.id !== excludeId && m.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));

  useModalHotkeys({
    onClose,
    onSubmit: () => { if (list[highlightedIndex]) onSelect(list[highlightedIndex]); },
  });

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-on-surface/50 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl relative z-10 flex flex-col max-h-[80vh]">
        <div className="flex items-center gap-3 p-6 pb-4 shrink-0">
          <div className="w-11 h-11 bg-tertiary/10 rounded-2xl flex items-center justify-center shrink-0">
            <Gift size={20} className="text-tertiary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-headline font-black text-lg leading-tight">{title}</h2>
            <p className="text-xs font-semibold text-on-surface/45">{subtitle}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-background text-on-surface/30 shrink-0"><X size={18} /></button>
        </div>

        <div className="px-6 pb-3 shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface/30" />
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(i => Math.min(i + 1, list.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(i => Math.max(i - 1, 0)); }
              }}
              placeholder="ค้นหาชื่อเพื่อน..."
              className="w-full pl-9 pr-3 py-2.5 bg-background rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
          {list.length === 0 && <p className="text-center py-6 text-sm text-on-surface/30 font-bold">ไม่พบเพื่อน</p>}
          {list.map((m, idx) => (
            <button key={m.id}
              ref={el => { itemRefs.current[idx] = el; }}
              onClick={() => onSelect(m)}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={cn('w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors text-left',
                idx === highlightedIndex ? 'bg-tertiary/10 ring-2 ring-inset ring-tertiary/30' : 'hover:bg-background')}>
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0', RANK_COLORS[m.rank])}>{m.rank}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{m.name}</p>
                <p className="text-xs text-on-surface/40">{m.gamesPlayed} เกม</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export function DashboardTab({
  members, courts, snacks, paymentHistory, gameHistory,
  onAddSnack, onUpdateRank, onRemoveSnack, onUpdateSnackPrice, viewingSession, onCloseSession,
  sessionHistory, onViewSession,
  onProcessPayment, onReOpen, onPullSession,
  onAddCourt, isSidebarCollapsed, onCheckIn, onRemove, onResetDay,
  onClearBoard, onUpdateGame,
  isSyncing, onImportLine,
  sessionStartDate
}: Props) {
  // เก็บแค่ id ไม่เก็บ snapshot ของ Member ทั้งก้อน — เดี๋ยว modal จะได้อ่านข้อมูลสดจาก currentMembers
  // เสมอ (ไม่งั้นพอลบสินค้า/แก้ไขอะไรระหว่างเปิด modal อยู่ จะไม่เห็นการเปลี่ยนแปลงจนกว่าจะปิดเปิดใหม่)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [posTarget, setPosTarget] = useState<Member | null>(null);
  // "เสียน้ำให้เพื่อน": เลือกคนจ่าย (A) ก่อน แล้วค่อยเลือกคนรับ (B)
  const [treatStep, setTreatStep] = useState<'payer' | 'recipient' | null>(null);
  const [treatPayer, setTreatPayer] = useState<Member | null>(null);
  const [treatRecipient, setTreatRecipient] = useState<Member | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dbSearch, setDbSearch] = useState('');
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [bulkCheckoutInfo, setBulkCheckoutInfo] = useState<{ memberId: string, others: string[] } | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: 'default' | 'name' | 'shuttles' | 'balance' | 'games', direction: 'asc' | 'desc' }>({ key: 'default', direction: 'desc' });
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const isReadOnly = !!viewingSession;
  const currentMembers = viewingSession ? viewingSession.membersSnapshot : members;
  const currentPayments = viewingSession ? viewingSession.paymentHistory : paymentHistory;
  const currentGames = viewingSession ? viewingSession.gameHistory : gameHistory;

  // คนที่ "มาตีวันนี้จริงๆ" (ไม่ใช่สมาชิกทั้งหมดในฐานข้อมูล) — ใช้เป็นตัวเลือกใน "เสียน้ำให้เพื่อน"
  const todayPlayers = useMemo(
    () => currentMembers.filter(m => m.status !== 'resting' || m.balance > 0 || m.gamesPlayed > 0),
    [currentMembers]
  );

  // ข้อมูลสดของคนที่กำลังเปิด CheckoutModal อยู่ (bulk เอาก่อน ถ้าไม่มีค่อยใช้ selectedMemberId)
  // คำนวณใหม่ทุกครั้งที่ currentMembers เปลี่ยน จึงเห็นผลการลบ/แก้ไขสินค้าในตัวทันทีไม่ต้องปิดเปิด modal ใหม่
  const activeCheckoutMemberId = bulkCheckoutInfo?.memberId ?? selectedMemberId;
  const activeCheckoutMember = activeCheckoutMemberId
    ? currentMembers.find(m => m.id === activeCheckoutMemberId) ?? null
    : null;
  const activeCheckoutOthers = bulkCheckoutInfo?.others ?? [];

  const filteredMembers = useMemo(() => {
    const query = dbSearch.toLowerCase().trim();
    let list = [...currentMembers];

    if (!isReadOnly) {
      if (!query) {
        // Default view: ACTIVE (waiting, playing, or balance > 0, or has played games)
        list = list.filter(m => m.status !== 'resting' || m.balance > 0 || m.gamesPlayed > 0);
      } else {
        // Search view: Only active members matching query
        list = list.filter(m => 
          m.name.toLowerCase().includes(query) && 
          (m.status !== 'resting' || m.balance > 0 || m.gamesPlayed > 0)
        );
      }
    } else {
      // History view: Only show members who actually participated in this session
      list = list.filter(m => 
        m.name.toLowerCase().includes(query) && 
        (m.gamesPlayed > 0 || m.balance > 0 || (m.snackHistory && m.snackHistory.length > 0))
      );
    }

    // Apply Status Filter
    if (statusFilter === 'pending') {
      list = list.filter(m => m.balance > 0);
    } else if (statusFilter === 'paid') {
      list = list.filter(m => m.balance === 0 && (m.gamesPlayed > 0 || m.snackHistory.length > 0));
    }

    return list;
  }, [currentMembers, dbSearch, isReadOnly, statusFilter]);

  const sortedMembers = useMemo(() => {
    const list = [...filteredMembers];
    if (sortConfig.key === 'name') {
      list.sort((a, b) => {
        const res = sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        if (res !== 0) return res;
        return (RANK_WEIGHTS[b.rank] || 0) - (RANK_WEIGHTS[a.rank] || 0); // fallback to rank
      });
    } else if (sortConfig.key === 'games') {
      list.sort((a, b) => sortConfig.direction === 'asc' ? a.gamesPlayed - b.gamesPlayed : b.gamesPlayed - a.gamesPlayed);
    } else if (sortConfig.key === 'shuttles') {
      list.sort((a, b) => sortConfig.direction === 'asc' ? a.shuttleCount - b.shuttleCount : b.shuttleCount - a.shuttleCount);
    } else if (sortConfig.key === 'balance') {
      list.sort((a, b) => sortConfig.direction === 'asc' ? a.balance - b.balance : b.balance - a.balance);
    } else {
      // Default sort: Status (playing first), then Rank weight, then Games Played, then Balance
      list.sort((a, b) => {
        if (a.status === 'playing' && b.status !== 'playing') return -1;
        if (a.status !== 'playing' && b.status === 'playing') return 1;
        const rw = (RANK_WEIGHTS[b.rank] || 0) - (RANK_WEIGHTS[a.rank] || 0);
        if (rw !== 0) return rw;
        return b.gamesPlayed - a.gamesPlayed || b.balance - a.balance;
      });
    }
    return list;
  }, [filteredMembers, sortConfig]);

  // Keyboard shortcut: Press Enter to checkout selected/highlighted members
  // ต้องใช้ 'keydown' (ไม่ใช่ 'keyup') ให้เฟสเดียวกับตัวดักคีย์ของ modal อื่นๆ (Checkout/POS ใช้
  // 'keydown' ปิดตัวเองทั้งคู่) — ถ้าใช้คนละเฟสกัน พอกด Enter ปิด modal ตอน keydown จะทำให้ state
  // (selectedMember/posTarget) กลายเป็น null ไปแล้วตอน keyup มาถึง เงื่อนไขกันซ้ำด้านล่างเลยหลุด
  // แล้วเปิด modal ของคนที่ไฮไลต์อยู่ซ้อนขึ้นมาอีกอันจากการกด Enter ครั้งเดียวกัน
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat || bulkCheckoutInfo || selectedMemberId || posTarget || treatStep || settingsOpen) return;

      const active = document.activeElement as HTMLElement;
      // If user is focused on a text input, don't trigger (unless it's the search box or a checkbox)
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && active !== searchInputRef.current) {
        if ((active as HTMLInputElement).type !== 'checkbox') return;
      }

      if (checkedIds.length > 0) {
        const mainMember = currentMembers.find(m => m.id === checkedIds[0]);
        if (mainMember) { e.preventDefault(); setBulkCheckoutInfo({ memberId: mainMember.id, others: checkedIds.slice(1) }); }
      } else if (highlightedIndex >= 0 && sortedMembers[highlightedIndex]) {
        e.preventDefault();
        setSelectedMemberId(sortedMembers[highlightedIndex].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [checkedIds, bulkCheckoutInfo, selectedMemberId, posTarget, treatStep, settingsOpen, currentMembers, highlightedIndex, sortedMembers]);

  // Keyboard shortcuts: Space -> focus search, + -> ลงชื่อวันนี้, ↑/↓ -> เลื่อนเลือกชื่อในตาราง
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (bulkCheckoutInfo || selectedMemberId || posTarget || treatStep || settingsOpen) return;

      const active = document.activeElement as HTMLElement;
      const isSearchFocused = active === searchInputRef.current;
      const isOtherInputFocused = !!active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT') && !isSearchFocused
        && (active as HTMLInputElement).type !== 'checkbox';
      if (isOtherInputFocused) return;

      if (e.key === ' ' && !isSearchFocused) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '+') {
        e.preventDefault();
        onImportLine();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => sortedMembers.length === 0 ? -1 : Math.min(prev + 1, sortedMembers.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => sortedMembers.length === 0 ? -1 : Math.max(prev - 1, 0));
      } else if (e.key === '/' || e.code === 'Slash') {
        // "/" = เปิด modal ขายของ (สินค้า) ให้คนที่ไฮไลต์อยู่
        // เช็คทั้ง e.key และ e.code เผื่อกรณีใดกรณีหนึ่งไม่ตรง แล้ว preventDefault เสมอ
        // กันไม่ให้ "/" หลุดไปพิมพ์ในช่องค้นหา ไม่ว่าจะมีคนไฮไลต์อยู่จริงหรือเปล่าก็ตาม
        e.preventDefault();
        if (highlightedIndex >= 0 && sortedMembers[highlightedIndex]) {
          const m = sortedMembers[highlightedIndex];
          if (!isReadOnly && m.status !== 'paid') setPosTarget(m);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bulkCheckoutInfo, selectedMemberId, posTarget, treatStep, settingsOpen, sortedMembers, onImportLine, highlightedIndex, isReadOnly]);

  // Reset the highlighted row whenever the visible list changes (new search/filter)
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [dbSearch, statusFilter]);

  // Keep the highlighted row scrolled into view
  useEffect(() => {
    if (highlightedIndex >= 0) rowRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  const handleSort = (key: 'name' | 'shuttles' | 'balance' | 'games') => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'desc') return { key, direction: 'asc' };
        return { key: 'default', direction: 'desc' }; // Toggle off
      }
      return { key, direction: 'desc' };
    });
  };

  const activePlayers = currentMembers.filter(m => m.status === 'playing').length;
  const waitingPlayers = currentMembers.filter(m => m.status === 'waiting').length;
  const activeCourts = courts.filter(c => c.players.some(Boolean)).length;
  const totalPending = currentMembers.reduce((a, m) => a + m.balance, 0);
  const totalPaid = currentPayments.reduce((a, r) => a + r.amount, 0);
  
  // Total Revenue: Sum of pending debts and already received payments
  const totalRevenue = totalPending + totalPaid;
  
  // Total Snacks: Sum of pending snacks and snacks from payment history
  const paidSnacks = currentPayments.reduce((total, p) => {
    const itemTotal = (p.details?.snackHistory || []).reduce((sum, s) => sum + s.price, 0);
    return total + itemTotal;
  }, 0);
  const totalSnacks = currentMembers.reduce((a, m) => a + (m.snackBalance || 0), 0) + paidSnacks;
  
  // Calculate total shuttles from game history for 100% accuracy based on matches
  const totalShuttles = (viewingSession?.gameHistory || gameHistory).reduce((a, g) => a + (g.shuttlesUsed || 0), 0);
  const totalGames = (viewingSession?.gameHistory || gameHistory).length;

  return (
    <div className="space-y-4">
      {/* Dashboard Header with Session Selector (Compact) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white px-6 py-4 rounded-3xl shadow-sm border border-on-surface/5">
        <div className="flex items-center gap-4">
          <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center shadow-inner transition-colors", isReadOnly ? "bg-primary/10 text-primary" : "bg-green-500/10 text-green-500")}>
            <Monitor size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-headline font-black text-xl tracking-tight leading-none mb-1">
                {isReadOnly ? "ประวัติย้อนหลัง" : "Live Monitor"}
              </h2>
            </div>
            <p className="text-xs font-semibold text-on-surface/50 flex items-center gap-2 mt-0.5">
              <span className={cn("w-2 h-2 rounded-full animate-pulse shrink-0", isReadOnly ? "bg-primary" : "bg-green-500")} />
              {isReadOnly
                ? `ข้อมูลสรุปของ ${format(viewingSession!.date, 'd MMMM yyyy', { locale: th })}`
                : sessionStartDate
                  ? `ก๊วนวันนี้ เริ่มตั้งแต่ ${format(sessionStartDate, 'd MMMM yyyy เวลา HH:mm น.', { locale: th })}`
                  : 'กระดานสรุปผลสด (เรียลไทม์)'}
            </p>
          </div>
        </div>

        <div className="flex bg-background p-1.5 rounded-3xl gap-1.5 shadow-inner">
          <div className="relative group">
            <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/30 group-focus-within:text-primary transition-colors z-10" />
            <input
              type="date"
              value={isReadOnly ? format(viewingSession!.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => {
                const selected = e.target.value;
                const today = format(new Date(), 'yyyy-MM-dd');

                if (selected === today) {
                  onCloseSession();
                } else {
                  const s = sessionHistory.find(sh => format(sh.date, 'yyyy-MM-dd') === selected);
                  if (s) {
                    onViewSession(s);
                  } else {
                    // Start with an empty view so it's responsive
                    onViewSession({
                      id: `empty-${selected}`,
                      date: new Date(selected).getTime(),
                      membersSnapshot: [],
                      gameHistory: [],
                      paymentHistory: []
                    });

                    // Pull from API
                    onPullSession(selected);
                  }
                }
              }}
              className="bg-white pl-10 pr-4 py-2.5 rounded-2xl font-semibold text-sm text-on-surface/60 outline-none border border-on-surface/5 focus:border-primary/20 appearance-none transition-all cursor-pointer min-w-[200px]"
            />
          </div>

          {isReadOnly ? (
            <button
              onClick={onCloseSession}
              className="px-5 py-2.5 bg-primary text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Monitor size={15} /> ดูวันนี้
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onClearBoard}
                className="px-5 py-2.5 bg-background text-on-surface/50 rounded-2xl font-bold text-sm border border-on-surface/10 hover:bg-on-surface/5 active:scale-95 transition-all flex items-center gap-2"
              >
                <Trash2 size={15} /> ล้างกระดาน
              </button>
              <button
                onClick={onResetDay}
                className="px-5 py-2.5 bg-error text-white rounded-2xl font-bold text-sm shadow-lg shadow-error/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <RefreshCw size={15} /> จบวันและสรุปยอด
              </button>
            </div>
          )}
        </div>
      </div>

      {/* POS modal for manual charging from dashboard */}
      <AnimatePresence>
        {posTarget && (
          <POSModal
            member={posTarget}
            snacks={snacks}
            onAddSnack={onAddSnack}
            treatFor={treatRecipient}
            onClearTreat={() => setTreatRecipient(null)}
            onClose={() => { setPosTarget(null); setTreatRecipient(null); }}
          />
        )}
      </AnimatePresence>

      {/* "เสียน้ำให้เพื่อน" — เลือกคนจ่าย (A) ก่อน แล้วเลือกคนรับ (B) แล้วเปิด POS ให้ A ตามปกติ */}
      <AnimatePresence>
        {treatStep === 'payer' && (
          <TreatMemberPicker
            title="เสียน้ำให้เพื่อน"
            subtitle="ใครจะเป็นคนจ่าย?"
            members={todayPlayers}
            onClose={() => setTreatStep(null)}
            onSelect={(payer) => { setTreatPayer(payer); setTreatStep('recipient'); }}
          />
        )}
        {treatStep === 'recipient' && treatPayer && (
          <TreatMemberPicker
            title="เสียน้ำให้เพื่อน"
            subtitle={`${treatPayer.name} จะเลี้ยงใคร?`}
            members={todayPlayers}
            excludeId={treatPayer.id}
            onClose={() => { setTreatStep(null); setTreatPayer(null); }}
            onSelect={(recipient) => {
              setTreatRecipient(recipient);
              setPosTarget(treatPayer);
              setTreatStep(null);
              setTreatPayer(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'จำนวนเกมวันนี้', value: totalGames + ' เกม', icon: Trophy, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'จำนวนลูกวันนี้', value: totalShuttles.toFixed(0) + ' ลูก', icon: Bolt, color: 'text-secondary', bg: 'bg-secondary/10' },
          { label: 'จำนวนลูกค้า', value: currentMembers.filter(m => m.gamesPlayed > 0 || m.status !== 'resting' || (m.balance ?? 0) > 0).length, icon: Users, color: 'text-tertiary', bg: 'bg-tertiary/10' },
          { label: 'ยอดรวมลูกค้า (ทั้งหมด)', value: '฿' + totalRevenue.toLocaleString(), icon: TrendingUp, color: 'text-error', bg: 'bg-error/10' },
          { label: 'ยอดขายสินค้า', value: '฿' + totalSnacks.toLocaleString(), icon: ShoppingCart, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-3xl p-5 shadow-sm border border-on-surface/5">
            <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center mb-3', s.bg)}>
              <s.icon size={22} className={s.color} />
            </div>
            <p className="text-3xl font-headline font-black">{s.value}</p>
            <p className="text-xs font-semibold text-on-surface/50 mt-1 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Main Player Table ── */}
      <div className="bg-white rounded-3xl shadow-sm border border-on-surface/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-on-surface/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="font-headline font-black text-xl">ลูกค้าที่เล่นวันนี้</h2>
            <span className="hidden lg:inline text-[11px] font-semibold text-on-surface/30">
              ↑↓ เลื่อน • Enter ดูข้อมูล • / ขายของ
            </span>
            <div className="h-5 w-[2px] bg-on-surface/5 hidden md:block" />
            {isSyncing && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/5 rounded-lg">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
                <span className="text-xs font-semibold text-primary">กำลังบันทึก...</span>
              </div>
            )}
            <button
              onClick={onImportLine}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              <FileText size={14} /> ลงชื่อวันนี้ (ก๊อปรายชื่อไลน์)
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-white/30 text-white/80">+</span>
            </button>
            {!isReadOnly && (
              <button
                onClick={() => setTreatStep('payer')}
                disabled={todayPlayers.length < 2}
                className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed"
                title={todayPlayers.length < 2 ? "ต้องมีคนมาตีอย่างน้อย 2 คนก่อน" : "เลือกคนจ่ายแล้วเลือกคนรับ"}
              >
                <Gift size={14} /> เสียน้ำให้เพื่อน
              </button>
            )}
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
            <div className="relative group flex-1 w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface/30 group-focus-within:text-primary transition-colors" size={14} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="ค้นหา... (spacebar)"
                value={dbSearch}
                onChange={e => setDbSearch(e.target.value)}
                onKeyDown={e => { if (e.key === ' ') e.stopPropagation(); }}
                className="w-full pl-9 pr-4 py-2 bg-background border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 outline-none shadow-sm transition-all"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: 'ทั้งหมด' },
                { id: 'pending', label: 'ค้างชำระ' },
                { id: 'paid', label: 'ชำระแล้ว' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap",
                    statusFilter === tab.id
                      ? "bg-primary text-white shadow-sm"
                      : "bg-background text-on-surface/40 hover:bg-on-surface/5"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-background text-xs font-bold uppercase tracking-wider text-on-surface/45 border-b border-on-surface/5">
          <div className="col-span-3 flex items-center gap-3">
            {!isReadOnly && (
              <input
                type="checkbox"
                checked={checkedIds.length === sortedMembers.filter(m => m.balance > 0).length && checkedIds.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setCheckedIds(sortedMembers.filter(m => m.balance > 0).map(m => m.id));
                  else setCheckedIds([]);
                }}
                className="w-4 h-4 rounded border-on-surface/10 text-primary focus:ring-primary/20"
              />
            )}
            <span className="cursor-pointer hover:text-primary transition-colors flex items-center gap-1 group/h" onClick={() => handleSort('name')}>
              ชื่อ / ระดับ
              {sortConfig.key === 'name' ? (
                sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-primary" /> : <ChevronDown size={12} className="text-primary" />
              ) : (
                <ChevronDown size={10} className="opacity-0 group-hover/h:opacity-50" />
              )}
            </span>
          </div>
          <div
            className="col-span-1 text-center cursor-pointer hover:text-primary transition-colors flex items-center justify-center gap-1 group/h"
            onClick={() => handleSort('games')}
          >
            {sortConfig.key === 'games' ? (
              sortConfig.direction === 'asc'
                ? <ChevronUp size={12} className="text-primary shrink-0" />
                : <ChevronDown size={12} className="text-primary shrink-0" />
            ) : (
              <ChevronDown size={10} className="opacity-0 group-hover/h:opacity-50 shrink-0" />
            )}
            <span className={sortConfig.key === 'games' ? 'text-primary' : ''}>เกม</span>
          </div>
          <div className="col-span-2 text-right">ค่าสนาม</div>
          <div className="col-span-2 text-right cursor-pointer hover:text-primary transition-colors flex justify-end items-center gap-1 group/h" onClick={() => handleSort('shuttles')}>
            {sortConfig.key === 'shuttles' ? (
              sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-primary" /> : <ChevronDown size={12} className="text-primary" />
            ) : (
              <ChevronDown size={10} className="opacity-0 group-hover/h:opacity-50" />
            )}
            ค่าลูก
          </div>
          <div className="col-span-2 text-right">สินค้า</div>
          <div className="col-span-2 text-right text-error font-black cursor-pointer hover:text-error/80 transition-colors flex justify-end items-center gap-1 group/h" onClick={() => handleSort('balance')}>
            {sortConfig.key === 'balance' ? (
              sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-error" /> : <ChevronDown size={12} className="text-error" />
            ) : (
              <ChevronDown size={10} className="opacity-0 group-hover/h:opacity-50" />
            )}
            ยอดรวม
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-on-surface/5 overflow-y-auto max-h-[60vh] custom-scrollbar">
          {sortedMembers.length === 0 ? (
            <div className="px-6 py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-on-surface/5 rounded-full flex items-center justify-center mx-auto text-on-surface/20">
                <Calendar size={32} />
              </div>
              <div>
                <p className="text-lg font-black text-on-surface/40">วันนี้ไม่ได้มีตีเกม</p>
                <p className="text-xs text-on-surface/20 font-bold uppercase tracking-widest mt-1 mb-6">
                  {isReadOnly ? "ไม่พบประวัติการจองและชำระเงินในห้วงเวลานี้จากเครื่องนี้" : "ยังไม่มีข้อมูลผู้เล่นในวันนี้"}
                </p>
                {isReadOnly && (
                  <button
                    onClick={() => onPullSession(format(viewingSession!.date, 'yyyy-MM-dd'))}
                    disabled={isSyncing}
                    className="mx-auto flex items-center gap-2 px-6 py-3 bg-secondary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-secondary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Cloud size={16} className={isSyncing ? "animate-pulse" : ""} />
                    {isSyncing ? "กำลังเชื่อมต่อฐานข้อมูล..." : "ดึงประวัติจากฐานข้อมูล"}
                  </button>
                )}
              </div>
            </div>
          ) : sortedMembers.map((m, idx) => {
            const isSettled = m.status === 'paid';
            // isHighlighted = คนที่เลือกด้วยคีย์บอร์ด (ลูกศร) เท่านั้น ไม่ผูกกับเมาส์ hover อีกต่อไป
            // ส่วน hover:/group-hover: ด้านล่างคือ feedback ปกติของเมาส์ แยกกันคนละเรื่อง ไม่ทับกัน
            const isHighlighted = idx === highlightedIndex;
            return (
              <div
                key={m.id}
                ref={el => { rowRefs.current[idx] = el; }}
                onClick={() => setSelectedMemberId(m.id)}
                className={cn(
                  "w-full grid grid-cols-12 gap-3 md:gap-4 px-6 py-5 md:py-6 transition-all text-left group items-center cursor-pointer",
                  isHighlighted ? "border-2 border-primary/40" : "border-2 border-transparent",
                  isSettled
                    ? cn("hover:bg-green-100/50", isHighlighted ? "bg-green-100/50" : "bg-green-100/30")
                    : cn("hover:bg-primary/5", isHighlighted ? "bg-primary/5" : "bg-white")
                )}
              >
                {/* Name + rank */}
                <div className="col-span-3 flex items-center gap-3 min-w-0">
                  {!isReadOnly && m.balance > 0 && (
                    <input
                      type="checkbox"
                      checked={checkedIds.includes(m.id)}
                      onClick={e => e.stopPropagation()}
                      onChange={(e) => {
                        setCheckedIds(prev => e.target.checked ? [...prev, m.id] : prev.filter(id => id !== m.id));
                      }}
                      className="w-4 h-4 rounded border-on-surface/10 text-primary focus:ring-primary/20"
                    />
                  )}
                  <div className="relative group/rank shrink-0">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm transition-transform group-hover:scale-105', isHighlighted && 'scale-105', RANK_COLORS[m.rank])}>
                      {m.rank}
                    </div>
                    {!isReadOnly && (
                      <select
                        value={m.rank}
                        onChange={(e) => {
                          e.stopPropagation();
                          onUpdateRank(m.id, e.target.value as Rank);
                        }}
                        onClick={e => e.stopPropagation()}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        title="เปลี่ยนระดับมือ"
                      >
                        {RANKS.map(r => <option key={r} value={r}>{r} ({RANK_LEVEL_LABELS[r]})</option>)}
                      </select>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-0.5">
                      <p className={cn("font-bold text-sm truncate transition-colors", isSettled ? "text-green-700" : cn("group-hover:text-primary", isHighlighted && "text-primary"))}>
                        {m.name}
                      </p>
                      {m.paidByName && (
                        <p className="text-xs font-semibold text-green-600 flex items-center gap-1">
                          <Check size={9} /> จ่ายโดย {m.paidByName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full transition-all',
                        isSettled ? 'bg-green-500 text-white' :
                          m.status === 'playing' ? 'bg-green-100 text-green-700' :
                            m.status === 'waiting' ? 'bg-secondary/10 text-secondary' : 'bg-on-surface/5 text-on-surface/30')}>
                        {isSettled ? '✓ จ่ายแล้ว' : m.status === 'playing' ? '🏸 เล่น' : m.status === 'waiting' ? '⌛ รอ' : '😴 พักค้าง'}
                      </span>
                      {(m.status === 'resting' || isSettled) && !isReadOnly && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onCheckIn(m.id); }}
                          className="text-[11px] font-bold bg-primary text-white px-2.5 py-0.5 rounded-full hover:scale-105 active:scale-95 transition-transform flex items-center gap-1"
                        >
                          <UserPlus size={10} strokeWidth={3} /> {isSettled ? 'กลับมาตีใหม่' : 'เช็คอิน'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Games */}
                <div className="col-span-1 text-center font-black text-sm text-on-surface/70">
                  {m.gamesPlayed}
                </div>

                {/* Court fee */}
                <div className="col-span-2 text-right font-bold text-sm">
                  <span className={(m.totalCourt || m.courtBalance) > 0 ? 'text-primary' : 'text-on-surface/20'}>
                    {(m.totalCourt || m.courtBalance) > 0 ? `฿${(m.totalCourt || m.courtBalance).toFixed(0)}` : '—'}
                  </span>
                </div>

                {/* Shuttle */}
                <div className="col-span-2 text-right">
                  <div className="flex items-center justify-end gap-2 group/shuttle">
                    <div className="text-right">
                      <p className={cn('font-bold text-sm leading-tight', (m.totalShuttle || m.shuttleBalance) > 0 ? 'text-secondary' : 'text-on-surface/20')}>
                        {(m.totalShuttle || m.shuttleBalance) > 0 ? `฿${(m.totalShuttle || m.shuttleBalance).toFixed(0)}` : '—'}
                      </p>

                    </div>
                  </div>
                </div>

                {/* Snacks */}
                <div 
                  className={cn(
                    "col-span-2 text-right font-bold text-sm h-full flex items-center justify-end transition-colors",
                    (!isReadOnly && !isSettled) ? "hover:bg-tertiary/5 cursor-pointer" : ""
                  )}
                  onClick={(e) => {
                    if (!isReadOnly && !isSettled) {
                      e.stopPropagation();
                      setPosTarget(m);
                    }
                  }}
                >
                  <div className="flex items-center justify-end gap-2 px-2 group/snack">
                    <span className={(m.totalSnack || m.snackBalance) > 0 ? 'text-tertiary' : 'text-on-surface/20'}>
                      {(m.totalSnack || m.snackBalance) > 0 ? `฿${(m.totalSnack || m.snackBalance).toFixed(0)}` : '—'}
                    </span>
                    {!isReadOnly && !isSettled && (
                      <button
                        className="p-2.5 rounded-2xl text-tertiary bg-tertiary/10 transition-all shadow-sm shadow-tertiary/10 active:scale-90"
                      >
                        <ShoppingCart size={20} strokeWidth={3} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Total */}
                <div className="col-span-2 text-right font-headline font-black text-xl pr-2 relative group-item">
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2">
                      {!isReadOnly && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemove(m.id); }}
                          className={cn("p-1.5 text-on-surface/20 hover:text-error hover:bg-error/10 rounded-lg transition-all opacity-0 group-hover:opacity-100", isHighlighted && "opacity-100")}
                          title="ลบออกจากเซสชัน"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <span className={cn(
                        isSettled ? "text-green-500" : (m.balance > 0 ? "text-error" : "text-on-surface/20")
                      )}>
                        ฿{((m.totalCourt || m.courtBalance) + (m.totalShuttle || m.shuttleBalance) + (m.totalSnack || m.snackBalance)).toFixed(0)}
                      </span>
                    </div>
                    {isSettled && (
                      <span className="text-[11px] font-bold text-green-500 flex items-center gap-1">
                        <CheckCircle2 size={11} strokeWidth={3} /> ชำระแล้ว
                      </span>
                    )}
                    {!isSettled && m.balance > 0 && (
                      <span className="text-[11px] font-bold text-error">
                        ค้างชำระ
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Table footer totals */}
        <div className="relative">
          {checkedIds.length > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className="absolute inset-x-0 -top-20 z-10 px-6 flex justify-end"
            >
              <button
                onClick={() => {
                  const mainMember = filteredMembers.find(m => m.id === checkedIds[0]);
                  if (mainMember) {
                    setBulkCheckoutInfo({ memberId: mainMember.id, others: checkedIds.slice(1) });
                  }
                }}
                className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-sm shadow-2xl shadow-primary/40 flex items-center gap-3 hover:scale-105 active:scale-95 transition-all"
              >
                <Banknote size={20} /> ชำระเงินที่เลือก ({checkedIds.length} คน)
              </button>
            </motion.div>
          )}
          <div className="grid grid-cols-12 gap-2 px-6 py-5 border-t-2 border-on-surface/5 bg-on-surface/2 font-black text-sm">
            <div className="col-span-4 text-on-surface/40 uppercase tracking-widest text-xs">สรุปยอดรวมวันนี้</div>
            <div className="col-span-2 text-right text-primary">฿{filteredMembers.reduce((a, m) => a + (m.totalCourt || m.courtBalance), 0).toFixed(0)}</div>
            <div className="col-span-2 text-right text-secondary">฿{filteredMembers.reduce((a, m) => a + (m.totalShuttle || m.shuttleBalance), 0).toFixed(0)}</div>
            <div className="col-span-2 text-right text-tertiary">฿{filteredMembers.reduce((a, m) => a + (m.totalSnack || m.snackBalance), 0).toFixed(0)}</div>
            <div className="col-span-2 text-right text-error text-2xl font-headline">฿{filteredMembers.reduce((a, m) => a + ((m.totalCourt || m.courtBalance) + (m.totalShuttle || m.shuttleBalance) + (m.totalSnack || m.snackBalance)), 0).toFixed(0)}</div>
          </div>
        </div>
      </div>

      {/* ── Checkout Modal ── */}
      <AnimatePresence>
        {activeCheckoutMember && (
          <CheckoutModal
            member={activeCheckoutMember}
            initialOthers={activeCheckoutOthers}
            gameHistory={currentGames}
            otherMembers={currentMembers}
            paymentHistory={currentPayments}
            onUpdateRank={onUpdateRank}
            onRemoveSnack={onRemoveSnack}
            onUpdateSnackPrice={onUpdateSnackPrice}
            isReadOnly={isReadOnly}
            onPay={(amount, otherIds) => {
              onProcessPayment(activeCheckoutMember.id, amount, 'Cash', otherIds);
              setSelectedMemberId(null);
              setBulkCheckoutInfo(null);
              setCheckedIds([]);
            }}
            onReOpen={onReOpen}
            onClose={() => {
              setSelectedMemberId(null);
              setBulkCheckoutInfo(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
