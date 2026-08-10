import React, { useState } from 'react';
import { UserPlus, Trash2, ChevronRight, FileText, X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Member, Rank, RANKS, RANK_COLORS, RANK_LEVEL_LABELS } from '../types';

interface Props {
  members: Member[];
  searchQuery: string;
  onSearch: (query: string) => void;
  onRemove: (id: string) => void;
  onAddMember: () => void;
  onImportLine: () => void;
  onUpdateRank: (memberId: string, rank: Rank) => void;
  onUpdateName: (memberId: string, name: string) => void;
  onAddCourt: () => void;
  onCheckIn: (memberId: string) => void;
  onBulkCheckIn: (ids: string[]) => void;
  onBulkRemove: (ids: string[]) => void;
  onBulkUpdateRank: (ids: string[], rank: Rank) => void;
}



type Filter = 'all' | 'waiting' | 'playing' | 'resting';

export function MembersTab({ 
  members, searchQuery, onSearch, onRemove, onAddMember, onImportLine, 
  onUpdateRank, onUpdateName, onAddCourt, onCheckIn,
  onBulkCheckIn, onBulkRemove, onBulkUpdateRank
}: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkRank, setShowBulkRank] = useState(false);

  const filtered = members.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = filter === 'all' || m.status === filter;
    return matchSearch && matchFilter;
  }).sort((a, b) => a.checkInTime - b.checkInTime);

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: `ทั้งหมด (${members.length})` },
    { id: 'waiting', label: `รอ (${members.filter(m => m.status === 'waiting').length})` },
    { id: 'playing', label: `เล่น (${members.filter(m => m.status === 'playing').length})` },
    { id: 'resting', label: `พัก (${members.filter(m => m.status === 'resting').length})` },
  ];

  return (
    <div className="space-y-6 pb-32">
      {/* Search and Main Actions */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-on-surface/5 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="ค้นหาชื่อสมาชิก..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full bg-background border-none rounded-2xl py-3 pl-12 pr-4 font-bold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all outline-none"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/30">
            <Search size={20} />
          </div>
          {searchQuery && (
            <button onClick={() => onSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface/30 hover:text-on-surface">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onImportLine}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-secondary/10 text-secondary px-5 py-3 rounded-2xl font-bold text-sm hover:bg-secondary/20 transition-all">
            <FileText size={16} /> นำเข้าไลน์
          </button>
          <button onClick={onAddMember}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary text-white px-5 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
            <UserPlus size={16} /> เพิ่มสมาชิกใหม่
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          {filters.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={cn('px-4 py-2 rounded-full font-semibold text-sm transition-all',
                filter === f.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-on-surface/60 hover:bg-white/80')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Select All / Deselect All */}
        {filtered.length > 0 && (
          <div className="col-span-full flex items-center gap-4 px-2">
             <button
               onClick={() => setSelectedIds(prev => prev.length === filtered.length ? [] : filtered.map(m => m.id))}
               className="text-xs font-bold text-primary hover:underline"
             >
               {selectedIds.length === filtered.length ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกทั้งหมดในหน้านี้'}
             </button>
             {selectedIds.length > 0 && (
               <span className="text-xs font-semibold text-on-surface/50">เลือกอยู่ {selectedIds.length} คน</span>
             )}
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {filtered.map(member => {
            const isSelected = selectedIds.includes(member.id);
            return (
              <motion.div key={member.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setSelectedIds(prev => isSelected ? prev.filter(id => id !== member.id) : [...prev, member.id])}
                className={cn(
                  "bg-white rounded-3xl p-5 shadow-sm border transition-all relative group cursor-pointer",
                  isSelected ? "border-primary ring-2 ring-primary/10 bg-primary/5" : "border-on-surface/5"
                )}>
                
                {/* Selection Overlay/Checkbox */}
                <div className={cn(
                  "absolute top-4 right-4 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all z-10",
                  isSelected ? "bg-primary border-primary text-white" : "border-on-surface/10 bg-white"
                )}>
                  {isSelected && <ChevronRight size={14} strokeWidth={4} className="rotate-90" />}
                </div>

                <div className="flex items-start gap-4">
                <div className="relative group/rank cursor-pointer shrink-0">
                  <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center font-black text-base transition-transform group-hover/rank:scale-105', RANK_COLORS[member.rank])}>
                    {member.rank}
                  </div>
                  <select
                    value={member.rank}
                    onChange={(e) => onUpdateRank(member.id, e.target.value as Rank)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  >
                    {RANKS.map(r => (
                      <option key={r} value={r}>{r}{RANK_LEVEL_LABELS[r] ? ` (${RANK_LEVEL_LABELS[r]})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="group/name relative">
                    <h3 className="font-bold text-base text-on-surface truncate group-hover/name:opacity-0 transition-opacity">{member.name}</h3>
                    <input
                      className="absolute inset-0 w-full bg-background border-none p-0 font-bold text-base text-primary opacity-0 focus:opacity-100 group-hover/name:opacity-100 transition-opacity focus:ring-0 rounded-lg"
                      value={member.name}
                      autoFocus={false}
                      onChange={(e) => onUpdateName(member.id, e.target.value)}
                    />
                  </div>
                  {RANK_LEVEL_LABELS[member.rank] && <p className="text-xs font-bold text-primary">{RANK_LEVEL_LABELS[member.rank]}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs font-semibold text-on-surface/45">{member.gamesPlayed} เกม</span>
                    <span className="text-xs text-on-surface/20">•</span>
                    <span className="text-xs font-semibold text-on-surface/40">
                      รอ: {Math.floor((Date.now() - member.checkInTime) / 60000)} นาที
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-on-surface/5">
                <div className="flex items-center gap-2">
                  <div className={cn('text-xs font-semibold px-3 py-1 rounded-full',
                    member.status === 'playing' ? 'bg-tertiary/10 text-tertiary' :
                    member.status === 'waiting' ? 'bg-secondary/10 text-secondary' :
                    'bg-on-surface/5 text-on-surface/40')}>
                    {member.status === 'playing' ? '🏸 เล่นอยู่' : member.status === 'waiting' ? '⏳ รอในคิว' : '💤 พักผ่อน'}
                  </div>
                  {member.status === 'resting' && (
                    <button
                      onClick={() => onCheckIn(member.id)}
                      className="text-xs font-bold bg-primary text-white px-3 py-1 rounded-full hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm shadow-primary/20"
                    >
                      <UserPlus size={12} strokeWidth={2.5} /> เช็คอิน
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {member.balance > 0 && (
                    <span className="text-xs font-black text-error">฿{member.balance.toFixed(0)}</span>
                  )}
                  {confirmDelete === member.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => { onRemove(member.id); setConfirmDelete(null); }}
                        className="text-xs bg-error text-white px-2.5 py-1 rounded-lg font-bold">ลบ</button>
                      <button onClick={() => setConfirmDelete(null)}
                        className="text-xs bg-on-surface/10 px-2.5 py-1 rounded-lg font-bold">ยกเลิก</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(member.id)}
                      className="opacity-0 group-hover:opacity-100 text-on-surface/20 hover:text-error transition-all">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>

      {/* Bulk Action Toolbar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-2xl bg-on-surface text-white rounded-[2rem] p-4 shadow-2xl flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4 px-2">
              <div className="flex -space-x-2">
                {selectedIds.slice(0, 3).map(id => {
                  const m = members.find(x => x.id === id);
                  return (
                    <div key={id} className={cn("w-8 h-8 rounded-full border-2 border-on-surface flex items-center justify-center text-xs font-bold", RANK_COLORS[m?.rank || 'P'])}>
                      {m?.name.charAt(0)}
                    </div>
                  );
                })}
                {selectedIds.length > 3 && (
                  <div className="w-8 h-8 rounded-full border-2 border-on-surface bg-on-surface-variant flex items-center justify-center text-xs font-bold">
                    +{selectedIds.length - 3}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-black">เลือก {selectedIds.length} รายชื่อ</p>
                <p className="text-xs text-white/40 font-semibold">จัดการแบบกลุ่ม</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-1 justify-end">
              <div className="relative">
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowBulkRank(!showBulkRank); }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold flex items-center gap-2"
                >
                  เปลี่ยนระดับมือ <ChevronRight size={12} className={cn("transition-transform", showBulkRank ? "-rotate-90" : "rotate-90")} />
                </button>
                {showBulkRank && (
                  <div className="absolute bottom-full left-0 mb-2 p-2 bg-on-surface border border-white/10 rounded-2xl shadow-xl flex gap-1 animate-in fade-in slide-in-from-bottom-2">
                    {RANKS.map(r => (
                      <button key={r} onClick={() => { onBulkUpdateRank(selectedIds, r); setSelectedIds([]); setShowBulkRank(false); }}
                        className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold hover:scale-110 transition-transform", RANK_COLORS[r])}>
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button 
                onClick={() => { onBulkCheckIn(selectedIds); setSelectedIds([]); }}
                className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <UserPlus size={14} /> เช็คอิน
              </button>
              <button 
                onClick={() => { if(confirm(`ลบ ${selectedIds.length} รายชื่อที่เลือกใช่หรือไม่?`)) { onBulkRemove(selectedIds); setSelectedIds([]); } }}
                className="p-2 text-white/40 hover:text-error transition-colors"
                title="ลบที่เลือก"
              >
                <Trash2 size={18} />
              </button>
              <button 
                onClick={() => setSelectedIds([])}
                className="p-2 text-white/20 hover:text-white transition-colors"
                title="ยกเลิก"
              >
                 <X size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-on-surface/30">
          <p className="font-bold">ไม่พบผู้เล่น</p>
        </div>
      )}
    </div>
  );
}
