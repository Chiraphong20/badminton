import React, { useState, useRef, useEffect } from 'react';
import { Bolt, X, Plus, Trash2, ShoppingCart, Search, Check, RotateCcw, Lock, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Member, Court, Snack, GameRecord, Rank, RANKS, RANK_WEIGHTS, RANK_COLORS, RANK_LEVEL_LABELS, CourtQueueSlot, QueuePlayer } from '../types';
import { format } from 'date-fns';
import { POSModal } from './POSModal';
import { useModalHotkeys } from '../hooks/useModalHotkeys';

let draggingPlayerId: string | null = null;

interface Props {
  members: Member[];
  courts: Court[];
  snacks: Snack[];
  searchQuery: string;
  gameHistory: GameRecord[];
  onAutoMatch: (courtId: string) => void;
  onStartGame: (courtId: string) => void;
  onResetCourt: (courtId: string) => void;
  onRemovePlayer: (courtId: string, slotIndex: number) => void;
  onAddPlayer: (courtId: string, slotIndex: number, playerId: string) => void;
  onDeleteCourt: (courtId: string) => void;
  onAddSnack: (memberId: string, snacks: Snack[]) => void;
  onEditGame: (gameId: string, newShuttles: number) => void;
  onUndoGame: (gameId: string) => void;
  onUpdateCourt: React.Dispatch<React.SetStateAction<Court[]>>;
  minRankFilter: Rank;
  setMinRankFilter: (r: Rank) => void;
  maxRankFilter: Rank;
  setMaxRankFilter: (r: Rank) => void;
  onAddCourt: () => void;
  courtQueues: Record<string, CourtQueueSlot[]>;
  onAddCourtQueue: (courtId: string, slot: CourtQueueSlot) => void;
  onRemoveCourtQueue: (courtId: string, slotId: string) => void;
  onUpdateCourtQueue: (courtId: string, slot: CourtQueueSlot) => void;
  onMoveCourtQueue: (courtId: string, slotId: string, dir: 'up' | 'down') => void;
}

// ── Player Picker ─────────────────────────────────────────────────────────────
function PlayerPicker({ members, currentPlayerId, onSelect, onClose, position }: {
  members: Member[];
  currentPlayerId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  position: 'top' | 'bottom';
}) {
  const [q, setQ] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => { ref.current?.focus(); }, []);

  const list = members.filter(m =>
    (m.status === 'waiting' || m.id === currentPlayerId) &&
    m.name.toLowerCase().includes(q.toLowerCase())
  );

  // "นำออกจากสล็อต" counts as nav item 0 when it's shown, so arrow/Enter can reach it too
  const navCount = (currentPlayerId ? 1 : 0) + list.length;
  useEffect(() => { setHighlightedIndex(0); }, [q]);
  // เลื่อนรายการตามไปหาแถวที่ไฮไลต์อยู่เสมอ กันกรณีลูกศรเลื่อนไปแถวที่ยังไม่โผล่ในจอ
  useEffect(() => {
    itemRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);
  const selectHighlighted = () => {
    if (currentPlayerId && highlightedIndex === 0) { onSelect(null); onClose(); return; }
    const m = list[highlightedIndex - (currentPlayerId ? 1 : 0)];
    if (m) { onSelect(m.id); onClose(); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: position === 'top' ? -10 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: position === 'top' ? -10 : 10 }}
      transition={{ duration: 0.12 }}
      onClick={e => e.stopPropagation()}
      className={cn(
        "absolute left-0 right-0 z-50 bg-white rounded-2xl shadow-2xl border border-on-surface/5 overflow-hidden",
        position === 'top' ? "top-full mt-2" : "bottom-full mb-2"
      )}
    >
      <div className="p-3 border-b border-on-surface/5">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface/30" />
          <input ref={ref} value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาชื่อ..."
            onKeyDown={e => {
              if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
              if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setHighlightedIndex(i => Math.min(i + 1, navCount - 1)); return; }
              if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setHighlightedIndex(i => Math.max(i - 1, 0)); return; }
              if (e.key !== 'Enter') return;
              e.preventDefault(); e.stopPropagation();
              selectHighlighted();
            }}
            className="w-full pl-9 pr-3 py-2.5 bg-background rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {currentPlayerId && (
          <button ref={el => { itemRefs.current[0] = el; }} onClick={() => { onSelect(null); onClose(); }}
            onMouseEnter={() => setHighlightedIndex(0)}
            className={cn('w-full flex items-center gap-3 px-4 py-3 hover:bg-error/5 text-error transition-colors', highlightedIndex === 0 && 'bg-error/5 ring-2 ring-inset ring-error/20')}>
            <X size={15} /><span className="text-sm font-black">นำออกจากสล็อต</span>
          </button>
        )}
        {list.length === 0 && <p className="text-center py-6 text-sm text-on-surface/30 font-bold">ไม่พบผู้เล่น</p>}
        {list.map((m, i) => {
          const navIndex = i + (currentPlayerId ? 1 : 0);
          return (
          <button key={m.id} ref={el => { itemRefs.current[navIndex] = el; }} onClick={() => { onSelect(m.id); onClose(); }}
            onMouseEnter={() => setHighlightedIndex(navIndex)}
            className={cn('w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors',
              m.id === currentPlayerId ? 'bg-primary/5' : '',
              navIndex === highlightedIndex && 'bg-primary/5 ring-2 ring-inset ring-primary/20')}>
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0', RANK_COLORS[m.rank])}>{m.rank}</div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-bold truncate">{m.name}</p>
              <p className="text-xs text-on-surface/40">
                {RANK_LEVEL_LABELS[m.rank]}{RANK_LEVEL_LABELS[m.rank] ? ' · ' : ''}{m.gamesPlayed} เกม
              </p>
            </div>
            {m.id === currentPlayerId && <Check size={15} className="text-primary shrink-0" />}
          </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Slot Card ────────────────────────────────────────────────────────────────
function SlotCard({ slotIndex, courtId, playerId, team, members, onSelect, locked, openRequest }: {
  key?: number;
  slotIndex: number;
  courtId: string;
  playerId: string | null;
  team: 'A' | 'B';
  members: Member[];
  onSelect: (id: string | null) => void;
  locked: boolean;
  /** Bumps (any changed value) to force this slot's picker open — used by the "1-4" keyboard shortcut. */
  openRequest?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const player = members.find(m => m.id === playerId) ?? null;

  useEffect(() => {
    if (!locked && openRequest != null) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  const teamAccent = team === 'A' ? 'border-l-primary' : 'border-l-secondary';
  const teamText = team === 'A' ? 'text-primary' : 'text-secondary';

  return (
    <div ref={wrapRef} className="relative">
      <div
        draggable={!locked && !!player}
        onDragStart={e => {
          if (locked || !player) return;
          draggingPlayerId = player.id;
          e.dataTransfer.setData('playerId', player.id);
          e.dataTransfer.setData('sourceCourtId', courtId);
          e.dataTransfer.setData('sourceSlotIndex', slotIndex.toString());
        }}
        onClick={() => { if (!locked) setOpen(v => !v); }}
        onDragOver={e => { if (locked) return; e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          if (locked) return;
          e.preventDefault(); setDragOver(false);
          const pid = draggingPlayerId ?? e.dataTransfer.getData('playerId');
          const srcCourtId = e.dataTransfer.getData('sourceCourtId');
          const srcSlotIndex = e.dataTransfer.getData('sourceSlotIndex');
          
          if (pid) {
            // If dragging from another slot, remove from source first
            if (srcCourtId && srcSlotIndex !== "") {
              // This logic is simplified; in a real app you might want to 
              // handle the move in a single action to avoid state flickers.
              // For now, let's just proceed with the assignment.
            }
            onSelect(pid);
          }
        }}
        className={cn(
          'relative rounded-2xl border-2 transition-all select-none group min-h-[100px] sm:min-h-[130px] flex flex-col justify-center',
          locked ? 'cursor-default' : 'cursor-pointer',
          dragOver
            ? 'border-yellow-300 bg-yellow-50 scale-[1.02] shadow-xl'
            : player
              ? `bg-white shadow-lg border-l-4 border-t-0 border-r-0 border-b-0 ${teamAccent}`
              : locked
                ? 'border-white/10 bg-white/5'
                : 'border-dashed border-white/30 bg-white/10 hover:bg-white/20 hover:border-white/60'
        )}
      >
        {/* Slot number badge — matches the "1-4" keyboard shortcut */}
        {!locked && (
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-on-surface/70 text-white rounded-full flex items-center justify-center z-20 shadow-lg border-2 border-white text-[11px] font-black">
            {slotIndex + 1}
          </div>
        )}
        {/* X remove button — สูง/กว้าง 32px+ กันกดพลาดบนจอสัมผัส */}
        {!locked && player && (
          <button
            onClick={e => { e.stopPropagation(); onSelect(null); }}
            className="absolute -top-2 -right-2 w-8 h-8 bg-error text-white rounded-full flex items-center justify-center z-20 shadow-lg border-2 border-white transition-transform hover:scale-110 active:scale-95"
          >
            <X size={13} />
          </button>
        )}
        {player ? (
          <div className="p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className={cn('w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-sm sm:text-lg shrink-0 shadow-md', RANK_COLORS[player.rank])}>
              {player.rank}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-headline font-black text-sm sm:text-base truncate text-on-surface">{player.name}</p>
              <p className={cn('text-[11px] sm:text-xs font-bold', teamText)}>{RANK_LEVEL_LABELS[player.rank]}</p>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-1 sm:mt-1.5 flex-wrap">
                <span className="text-[10px] sm:text-[11px] font-black text-on-surface/50 bg-on-surface/5 px-1.5 sm:px-2 py-0.5 rounded-full">
                  🏸 {player.gamesPlayed} เกม
                </span>
                {player.balance > 0 && (
                  <span className="text-[10px] sm:text-[11px] font-black text-error bg-error/10 px-1.5 sm:px-2 py-0.5 rounded-full">
                    ฿{player.balance.toFixed(0)}
                  </span>
                )}
              </div>
            </div>
            {locked && <Lock size={14} className="text-white/30 shrink-0" />}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 sm:gap-2 py-4 sm:py-6 text-white/40">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
              <Plus size={18} className="text-white/30" />
            </div>
            <span className="text-xs font-bold text-white/40">แตะเพื่อเลือกผู้เล่น</span>
            {!locked && <span className="text-xs text-white/35 hidden sm:inline">หรือ ลากมาวาง</span>}
          </div>
        )}
        {open && !locked && <div className="absolute inset-0 ring-2 ring-white rounded-2xl pointer-events-none" />}
      </div>

      <AnimatePresence>
        {open && !locked && (
          <PlayerPicker 
            members={members} 
            currentPlayerId={playerId} 
            onSelect={onSelect} 
            onClose={() => setOpen(false)} 
            position={team === 'A' ? 'top' : 'bottom'}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Player Search Picker (for Queue Slot Editor) ─────────────────────────────
function PlayerSearchPicker({ members, selected, onSelect, placeholder, excludeIds = [] }: {
  members: Member[];
  selected: QueuePlayer | null;
  onSelect: (m: Member | null) => void;
  placeholder?: string;
  excludeIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = members
    .filter(m => !excludeIds.includes(m.id))
    .filter(m => !q || m.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      if (a.status === 'waiting' && b.status !== 'waiting') return -1;
      if (b.status === 'waiting' && a.status !== 'waiting') return 1;
      return a.name.localeCompare(b.name, 'th');
    })
    .slice(0, 20);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all text-left',
          selected
            ? 'bg-primary/5 border-primary/20 text-on-surface'
            : 'bg-background border-on-surface/5 text-on-surface/35 hover:border-primary/20'
        )}
      >
        {selected ? (
          <>
            <span className={cn('w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0', RANK_COLORS[selected.rank])}>
              {selected.rank}
            </span>
            <span className="flex-1 truncate">{selected.name}</span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onSelect(null); }}
              className="p-0.5 text-on-surface/20 hover:text-error transition-colors"
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <span className="text-on-surface/35">{placeholder || '+ เลือกผู้เล่น'}</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-2xl shadow-2xl border border-on-surface/5 overflow-hidden">
          <div className="p-2 border-b border-on-surface/5">
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); return; }
                if (e.key !== 'Enter') return;
                e.stopPropagation();
                if (filtered.length === 1) { onSelect(filtered[0]); setOpen(false); setQ(''); }
              }}
              placeholder="ค้นหาชื่อ..."
              className="w-full px-3 py-1.5 bg-background rounded-xl text-sm font-semibold focus:outline-none"
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => { onSelect(m); setOpen(false); setQ(''); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-primary/5 text-left transition-colors"
              >
                <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0', RANK_COLORS[m.rank])}>
                  {m.rank}
                </span>
                <span className="text-sm font-semibold flex-1 truncate">{m.name}</span>
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full',
                  m.status === 'waiting' ? 'bg-secondary/10 text-secondary' :
                  m.status === 'playing' ? 'bg-green-100 text-green-700' :
                  'bg-on-surface/5 text-on-surface/30'
                )}>
                  {m.status === 'waiting' ? 'รอ' : m.status === 'playing' ? 'ตีอยู่' : 'พัก'}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center py-4 text-xs text-on-surface/30 font-semibold">ไม่พบสมาชิก</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Queue Slot Editor Modal ───────────────────────────────────────────────────
function QueueSlotEditor({ members, slot, onSave, onClose }: {
  members: Member[];
  slot?: Partial<CourtQueueSlot>;
  onSave: (slot: CourtQueueSlot) => void;
  onClose: () => void;
}) {
  const [teamA, setTeamA] = useState<(QueuePlayer | null)[]>([
    slot?.teamA?.[0] ?? null,
    slot?.teamA?.[1] ?? null,
  ]);
  const [teamB, setTeamB] = useState<(QueuePlayer | null)[]>([
    slot?.teamB?.[0] ?? null,
    slot?.teamB?.[1] ?? null,
  ]);
  const [note, setNote] = useState(slot?.note ?? '');

  const pick = (team: 'A' | 'B', idx: number, m: Member | null) => {
    const p = m ? { memberId: m.id, name: m.name, rank: m.rank } : null;
    if (team === 'A') setTeamA(prev => prev.map((v, i) => i === idx ? p : v));
    else setTeamB(prev => prev.map((v, i) => i === idx ? p : v));
  };

  const handleSave = () => {
    const ta = teamA.filter(Boolean) as QueuePlayer[];
    const tb = teamB.filter(Boolean) as QueuePlayer[];
    if (ta.length === 0 && tb.length === 0) { alert('กรุณาเลือกผู้เล่นอย่างน้อย 1 คน'); return; }
    onSave({
      id: slot?.id ?? Math.random().toString(36).substr(2, 9),
      teamA: ta,
      teamB: tb,
      note: note.trim() || undefined,
    });
  };

  useModalHotkeys({ onClose, onSubmit: handleSave });

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-on-surface/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl z-10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-headline font-black text-xl">{slot?.id ? 'แก้ไขคิว' : 'เพิ่มคิวใหม่'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-background rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {(() => {
          const allIds = [teamA[0]?.memberId, teamA[1]?.memberId, teamB[0]?.memberId, teamB[1]?.memberId].filter(Boolean) as string[];
          const excl = (own: string | undefined) => allIds.filter(id => id !== own);
          return (
            <div className="space-y-4 mb-5">
              <div className="space-y-2">
                <p className="text-xs font-bold text-primary/60">ทีม A</p>
                <PlayerSearchPicker members={members} selected={teamA[0]} onSelect={m => pick('A', 0, m)} placeholder="ผู้เล่น A1" excludeIds={excl(teamA[0]?.memberId)} />
                <PlayerSearchPicker members={members} selected={teamA[1]} onSelect={m => pick('A', 1, m)} placeholder="ผู้เล่น A2" excludeIds={excl(teamA[1]?.memberId)} />
              </div>

              <div className="text-center text-on-surface/20 font-black">VS</div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-secondary/60">ทีม B</p>
                <PlayerSearchPicker members={members} selected={teamB[0]} onSelect={m => pick('B', 0, m)} placeholder="ผู้เล่น B1" excludeIds={excl(teamB[0]?.memberId)} />
                <PlayerSearchPicker members={members} selected={teamB[1]} onSelect={m => pick('B', 1, m)} placeholder="ผู้เล่น B2" excludeIds={excl(teamB[1]?.memberId)} />
              </div>
            </div>
          );
        })()}

        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="หมายเหตุ (ไม่บังคับ)"
          className="w-full px-4 py-2.5 bg-background rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 mb-4 border-none"
        />

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-sm text-on-surface/50 bg-background hover:bg-on-surface/5 transition-all">
            ยกเลิก
          </button>
          <button onClick={handleSave} className="flex-1 bg-primary text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Game History Row (editable) ──────────────────────────────────────────────
function GameRow({ game, onEditGame, onUndoGame, shuttlePrice }: {
  key?: string;
  game: GameRecord;
  onEditGame: (id: string, n: number) => void;
  onUndoGame: (id: string) => void;
  shuttlePrice: number;
}) {
  const teamA = game.players.slice(0, 2);
  const teamB = game.players.slice(2, 4);
  return (
    <div className="bg-white/8 border border-white/10 rounded-2xl p-4 flex items-center gap-4 flex-wrap">
      {/* Time */}
      <div className="shrink-0 text-center">
        <p className="text-white/40 text-xs font-semibold">เกม</p>
        <p className="text-white font-bold text-sm">{format(game.playedAt, 'HH:mm')}</p>
      </div>

      {/* Players */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {teamA.map(p => (
            <div key={p.id} className={cn('flex items-center gap-1 px-2 py-1 rounded-lg', RANK_COLORS[p.rank])}>
              <span className="text-xs font-bold">{p.rank}</span>
              <span className="text-xs font-bold">{p.name}</span>
            </div>
          ))}
          <span className="text-white/30 text-xs font-black">VS</span>
          {teamB.map(p => (
            <div key={p.id} className={cn('flex items-center gap-1 px-2 py-1 rounded-lg', RANK_COLORS[p.rank])}>
              <span className="text-xs font-bold">{p.rank}</span>
              <span className="text-xs font-bold">{p.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shuttle edit */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-white/40 text-xs font-black">🏸</span>
        <button
          onClick={() => onEditGame(game.id, game.shuttlesUsed - 1)}
          disabled={game.shuttlesUsed <= 1}
          className="w-7 h-7 bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white rounded-lg font-black flex items-center justify-center transition-colors"
        >−</button>
        <span className="text-white font-black text-base w-6 text-center">{game.shuttlesUsed}</span>
        <button
          onClick={() => onEditGame(game.id, game.shuttlesUsed + 1)}
          className="w-7 h-7 bg-white/10 hover:bg-white/20 text-white rounded-lg font-black flex items-center justify-center transition-colors"
        >+</button>
      </div>

      {/* Cost */}
      <div className="text-right shrink-0">
        <p className="text-white/45 text-xs font-semibold">ค่าลูก/คน</p>
        <p className="text-white font-headline font-bold text-base">฿{game.shuttleCostPerPerson.toFixed(0)}</p>
      </div>

      {/* Undo Button */}
      <button
        onClick={() => onUndoGame(game.id)}
        className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
        title="ยกเลิกผลการตี (คืนเงินทุกคน)"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function CourtsTab({
  members, courts, snacks, searchQuery, gameHistory,
  onAutoMatch, onStartGame, onResetCourt, onRemovePlayer, onAddPlayer,
  onDeleteCourt, onAddSnack, onEditGame, onUndoGame, onUpdateCourt,
  minRankFilter, setMinRankFilter, maxRankFilter, setMaxRankFilter,
  onAddCourt,
  courtQueues, onAddCourtQueue, onRemoveCourtQueue, onUpdateCourtQueue, onMoveCourtQueue,
}: Props) {
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(courts[0]?.id ?? null);
  const [posTarget, setPosTarget] = useState<Member | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [editingSlot, setEditingSlot] = useState<{ courtId: string; slot?: CourtQueueSlot } | null>(null);

  const rankOptions = [...RANKS].reverse(); // from lower to higher P+ to VIP1

  useEffect(() => {
    if (!courts.find(c => c.id === selectedCourtId)) setSelectedCourtId(courts[0]?.id ?? null);
  }, [courts, selectedCourtId]);

  const selected = courts.find(c => c.id === selectedCourtId) ?? null;
  const isActive = selected?.status === 'active';
  const filledCount = selected ? selected.players.filter(Boolean).length : 0;

  // Games for this court only
  const courtGames = selected
    ? gameHistory.filter(g => g.courtId === selected.id).slice(0, 10)
    : [];

  const shuttlePrice = 25; // reflect same default; ideally from props

  const waiting = members
    .filter(m => m.status === 'waiting')
    .filter(m => {
      const query = (searchQuery + ' ' + localSearch).toLowerCase().trim();
      if (!query) return true;
      return m.name.toLowerCase().includes(query);
    })
    .filter(m => {
      const minW = RANK_WEIGHTS[minRankFilter] || 0;
      const maxW = RANK_WEIGHTS[maxRankFilter] || 15;
      const lower = Math.min(minW, maxW);
      const upper = Math.max(minW, maxW);
      const w = RANK_WEIGHTS[m.rank] || 0;
      return w >= lower && w <= upper;
    })
    .sort((a, b) => a.gamesPlayed !== b.gamesPlayed ? a.gamesPlayed - b.gamesPlayed : a.checkInTime - b.checkInTime);

  const handleSelect = (slot: number, pid: string | null) => {
    if (!selected) return;
    if (pid === null) onRemovePlayer(selected.id, slot);
    else onAddPlayer(selected.id, slot, pid);
  };

  const handleDoubleClick = (m: Member) => {
    if (!selected) return;
    const empty = selected.players.findIndex(p => p === null);
    if (empty !== -1) onAddPlayer(selected.id, empty, m.id);
    else alert('ไม่มีสล็อตว่างในคอร์ดนี้');
  };

  const addShuttle = (delta: number) => {
    if (!selected) return;
    onUpdateCourt(prev => prev.map(c => c.id === selected.id
      ? { ...c, shuttlecocks: Math.max(0, c.shuttlecocks + delta) } : c));
  };

  const teamA = selected ? [0, 1].map(i => members.find(m => m.id === selected.players[i]) ?? null) : [];
  const teamB = selected ? [2, 3].map(i => members.find(m => m.id === selected.players[i]) ?? null) : [];

  // Keyboard shortcuts: ←/→ switch court tabs, 1-4 open that slot's player picker, Enter starts
  // the game once 4/4 are filled, and (while a game is active) pressing Enter twice quickly ends it.
  const [openSlotRequest, setOpenSlotRequest] = useState<{ slot: number; nonce: number } | null>(null);
  const [endGamePending, setEndGamePending] = useState(false);
  const lastEnterRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selected || posTarget || editingSlot) return;
      const active = document.activeElement as HTMLElement | null;
      const isTyping = !!active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
      if (isTyping) return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const idx = courts.findIndex(c => c.id === selected.id);
        if (idx === -1) return;
        const nextIdx = e.key === 'ArrowRight' ? (idx + 1) % courts.length : (idx - 1 + courts.length) % courts.length;
        setSelectedCourtId(courts[nextIdx].id);
        return;
      }

      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        setOpenSlotRequest({ slot: Number(e.key) - 1, nonce: Date.now() });
        return;
      }

      if (e.key !== 'Enter' || e.repeat) return;
      // e.repeat กัน auto-repeat จากการกด Enter ค้าง — ไม่งั้นแค่ค้าง Enter ครั้งเดียวก็ทำให้
      // เข้าเงื่อนไข "กดติดกัน 2 ครั้ง" ของปุ่มจบเกมด้านล่างได้โดยไม่ตั้งใจ
      e.preventDefault();

      if (isActive) {
        // Require a quick double-tap of Enter to end the game (avoid accidental taps)
        const now = Date.now();
        if (now - lastEnterRef.current < 600) {
          lastEnterRef.current = 0;
          setEndGamePending(false);
          onResetCourt(selected.id);
        } else {
          lastEnterRef.current = now;
          setEndGamePending(true);
          setTimeout(() => setEndGamePending(false), 600);
        }
      } else if (filledCount === 4) {
        onStartGame(selected.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, isActive, filledCount, posTarget, editingSlot, onResetCourt, onStartGame, courts]);

  return (
    <div className="space-y-5">
      {/* Global POS modal */}
      <AnimatePresence>
        {posTarget && (
          <POSModal member={posTarget} snacks={snacks} onAddSnack={onAddSnack} onClose={() => setPosTarget(null)} />
        )}
      </AnimatePresence>

      {/* Queue Slot Editor */}
      {editingSlot && (
        <QueueSlotEditor
          members={members}
          slot={editingSlot.slot}
          onClose={() => setEditingSlot(null)}
          onSave={slot => {
            if (editingSlot.slot?.id) onUpdateCourtQueue(editingSlot.courtId, slot);
            else onAddCourtQueue(editingSlot.courtId, slot);
            setEditingSlot(null);
          }}
        />
      )}

      {/* ── Court selector ── */}
      {/* มือถือ/แท็บเล็ตแนวตั้ง: เลื่อนแนวนอนเป็นแถบแท็บเดียว กันไม่ให้คอร์ดเยอะๆ ดันหน้าจอยาวลงไป */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto lg:flex-wrap lg:overflow-visible no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
        {courts.map(court => {
          const filled = court.players.filter(Boolean).length;
          const isSel = court.id === selectedCourtId;
          const active = court.status === 'active';
          return (
            <button key={court.id} onClick={() => setSelectedCourtId(court.id)}
              className={cn('shrink-0 flex items-center gap-2 sm:gap-2.5 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl font-bold text-sm sm:text-base transition-all border-2',
                isSel
                  ? active
                    ? 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-600/25'
                    : 'bg-primary text-white border-primary shadow-lg shadow-primary/25'
                  : 'bg-white text-on-surface/70 border-on-surface/10 hover:border-primary/30 hover:text-primary')}>
              <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', active ? 'bg-green-300 animate-pulse' : isSel ? 'bg-white/50' : 'bg-on-surface/20')} />
              {court.name}
              {active
                ? <span className="text-xs font-black bg-white/20 px-2 py-0.5 rounded-full whitespace-nowrap">กำลังตี</span>
                : <span className={cn('text-xs font-black px-1.5 py-0.5 rounded-full whitespace-nowrap', isSel ? 'bg-white/20' : 'bg-on-surface/5 text-on-surface/40')}>{filled}/4</span>
              }
            </button>
          );
        })}

        {/* Add Court button */}
        <button onClick={onAddCourt}
          className="shrink-0 flex items-center gap-2 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl font-black text-sm sm:text-base transition-all border-2 border-dashed border-on-surface/10 text-on-surface/40 hover:border-primary/50 hover:text-primary hover:bg-primary/5">
          <Plus size={18} /> เพิ่มคอร์ด
        </button>

        <span className="hidden lg:flex items-center text-xs font-semibold text-on-surface/30 ml-1 shrink-0">
          ←/→ สลับคอร์ด • 1-4 เพิ่มผู้เล่น • Enter เริ่ม/จบเกม
        </span>
      </div>

      {selected ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">

          {/* ── Waiting Queue ── */}
          {/* จอเล็ก/แท็บเล็ตแนวตั้ง: วางไว้ใต้คอร์ด (order-2) เพราะสิ่งที่ต้องทำก่อนคือดูคอร์ด ไม่ใช่ไล่คิว */}
          <section className="order-2 lg:order-1 lg:col-span-3 space-y-4"
            onDragOver={e => { if (isActive) return; e.preventDefault(); }}
            onDrop={e => {
              if (isActive) return;
              e.preventDefault();
              const srcCourtId = e.dataTransfer.getData('sourceCourtId');
              const srcSlotIndex = e.dataTransfer.getData('sourceSlotIndex');
              if (srcCourtId && srcSlotIndex !== "") {
                onRemovePlayer(srcCourtId, parseInt(srcSlotIndex));
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-headline font-black text-xl">คิวรอ</h3>
                <span className="bg-primary/10 text-primary text-sm px-2.5 py-0.5 rounded-full font-black">{waiting.length}</span>
              </div>
              {isActive && (
                <div className="bg-green-50 px-3 py-1 rounded-full border border-green-200">
                  <p className="text-green-700 font-bold text-xs">🏸 กำลังตี</p>
                </div>
              )}
            </div>

            {/* Filter Section */}
            <div className="space-y-3">
              {/* Local Search */}
              <div className="relative group">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface/30 group-focus-within:text-primary transition-colors" />
                <input 
                  value={localSearch}
                  onChange={e => setLocalSearch(e.target.value)}
                  placeholder="ค้นหาในคิว..." 
                  className="w-full pl-9 pr-3 py-2 bg-white border border-on-surface/5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none shadow-sm"
                />
              </div>

              {/* Rank Filter Range dropdowns */}
              <div className="space-y-2 bg-on-surface/2 p-3 rounded-2xl border border-on-surface/5">
                <p className="text-xs font-semibold text-on-surface/45 flex items-center gap-1.5 px-1">
                  <Bolt size={11} className="text-secondary" />
                  ช่วงระดับฝีมือที่ต้องการ
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <select
                      value={minRankFilter}
                      onChange={e => setMinRankFilter(e.target.value as Rank)}
                      className="w-full pl-3 pr-8 py-2 bg-white rounded-xl text-xs font-black appearance-none outline-none border-2 border-transparent focus:border-primary/20 shadow-sm transition-all"
                    >
                      {rankOptions.map(r => (
                        <option key={r} value={r}>{r}{RANK_LEVEL_LABELS[r] ? ` (${RANK_LEVEL_LABELS[r]})` : ''}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface/30 pointer-events-none" />
                  </div>
                  <span className="text-on-surface/20 text-xs font-black">—</span>
                  <div className="flex-1 relative">
                    <select
                      value={maxRankFilter}
                      onChange={e => setMaxRankFilter(e.target.value as Rank)}
                      className="w-full pl-3 pr-8 py-2 bg-white rounded-xl text-xs font-black appearance-none outline-none border-2 border-transparent focus:border-primary/20 shadow-sm transition-all"
                    >
                      {rankOptions.map(r => (
                        <option key={r} value={r}>{r}{RANK_LEVEL_LABELS[r] ? ` (${RANK_LEVEL_LABELS[r]})` : ''}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface/30 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 max-h-[45vh] lg:max-h-[calc(100vh-450px)] overflow-y-auto pr-1 no-scrollbar">
              {waiting.map((m, idx) => (
                <div key={m.id}
                  draggable={!isActive}
                  onDragStart={e => { if (isActive) return; draggingPlayerId = m.id; e.dataTransfer.setData('playerId', m.id); }}
                  onDragEnd={() => { draggingPlayerId = null; }}
                  onDoubleClick={() => handleDoubleClick(m)}
                  className={cn(
                    'bg-white rounded-2xl p-3.5 shadow-sm flex items-center gap-3 border-2 border-transparent transition-all group',
                    isActive ? 'opacity-60 cursor-default' : 'cursor-grab active:cursor-grabbing hover:border-primary/20 hover:shadow-md'
                  )}
                >
                  <span className="text-sm font-black text-on-surface/25 w-5 shrink-0">{idx + 1}</span>
                  <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center font-black text-base shrink-0', RANK_COLORS[m.rank])}>{m.rank}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{m.name}</p>
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      <span className="text-[11px] font-black text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded">{m.gamesPlayed} เกม</span>
                      {m.balance > 0 && <span className="text-[11px] font-black text-error/70 bg-error/5 px-1.5 py-0.5 rounded">฿{m.balance.toFixed(0)}</span>}
                    </div>
                  </div>
                  {/* POS button — always visible for queue members */}
                  <button
                    onClick={e => { e.stopPropagation(); setPosTarget(m); }}
                    className="p-2 rounded-xl text-on-surface/30 hover:text-primary hover:bg-primary/5 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                    title="ซื้อสินค้า"
                  >
                    <ShoppingCart size={16} />
                  </button>
                </div>
              ))}
              {waiting.length === 0 && (
                <div className="text-center py-10 bg-white/50 rounded-2xl border-2 border-dashed border-on-surface/10">
                  <p className="text-sm text-on-surface/30 font-bold">ไม่มีผู้เล่นรอ</p>
                </div>
              )}
            </div>
          </section>

          {/* ── Court Visualization ── */}
          <section className="order-1 lg:order-2 lg:col-span-9 space-y-4">
            <div className="rounded-[1.5rem] sm:rounded-[2rem] shadow-xl relative"
              style={{ background: isActive ? 'linear-gradient(160deg,#0f3020,#082212)' : 'linear-gradient(160deg,#1a3a2a,#0f2218)' }}>

              {/* Header */}
              <div className="flex flex-col gap-3 px-4 sm:px-6 py-4 sm:py-5">
                <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                  <div className={cn('w-3 h-3 rounded-full shrink-0', isActive ? 'bg-green-400 animate-pulse' : 'bg-white/20')} />
                  <h2 className="font-headline font-black text-xl sm:text-2xl text-white">{selected.name}</h2>
                  {isActive
                    ? <span className="text-xs font-black bg-green-400/20 text-green-300 px-3 py-1.5 rounded-full">🏸 กำลังตีอยู่</span>
                    : <span className="text-xs text-white/40 font-bold">{filledCount}/4 คน</span>
                  }
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {/* Shuttle counter - Visible in all states */}
                  <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5">
                    <button onClick={() => addShuttle(-1)} disabled={selected.shuttlecocks <= 0}
                      className="w-9 h-9 bg-white/10 text-white rounded-xl font-black text-lg flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all disabled:opacity-20">-</button>
                    <div className="text-center px-1">
                      <p className="text-white/45 text-xs font-semibold leading-none mb-1">จำนวนลูก</p>
                      <p className="text-white font-headline font-black text-2xl leading-none">{selected.shuttlecocks}</p>
                    </div>
                    <button onClick={() => addShuttle(1)}
                      className="w-9 h-9 bg-green-400 text-green-900 rounded-xl font-black text-lg flex items-center justify-center hover:bg-green-300 active:scale-95 transition-all shadow-md">+</button>
                  </div>

                  {/* Cost preview */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-center">
                    <p className="text-white/45 text-xs font-semibold">ค่าลูก/คน</p>
                    <p className="text-white font-headline font-black text-lg">฿{(selected.shuttlecocks * 25).toFixed(0)}</p>
                  </div>

                  {isActive ? (
                    <button onClick={() => onResetCourt(selected.id)}
                      className={cn('flex-1 sm:flex-none flex items-center justify-center gap-2 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all min-w-[140px]',
                        endGamePending ? 'bg-red-400 scale-105 animate-pulse' : 'bg-red-500 hover:bg-red-400 hover:scale-105 active:scale-95')}>
                      <Check size={16} /> {endGamePending ? 'กด Enter อีกครั้งเพื่อจบเกม' : 'จบเกม'}
                    </button>
                  ) : (
                    <>
                      <button onClick={() => onAutoMatch(selected.id)}
                        className="flex-1 sm:flex-none bg-white/10 border border-white/20 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <Bolt size={14} fill="currentColor" /> จัดอัตโนมัติ
                      </button>
                      <button
                        onClick={() => onStartGame(selected.id)}
                        disabled={filledCount !== 4}
                        className={cn(
                          'flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all',
                          filledCount === 4
                            ? 'bg-green-400 text-green-900 hover:bg-green-300 hover:scale-105 active:scale-95'
                            : 'bg-white/10 text-white/30 cursor-not-allowed border border-white/10'
                        )}>
                        ▶ เริ่มเกม {filledCount === 4 ? '(Enter)' : `(${filledCount}/4)`}
                      </button>
                      <button onClick={() => { if (confirm(`ยืนยันการลบ "${selected.name}"?`)) onDeleteCourt(selected.id); }}
                        className="text-white/30 hover:text-red-400 p-2.5 rounded-xl hover:bg-red-400/10 active:scale-95 transition-all shrink-0">
                        <Trash2 size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Court area */}
              <div className="px-3 sm:px-6 pb-4 sm:pb-6">
                <div className="relative">
                  {/* Background Layer (Clipped) */}
                  <div className={cn(
                    "absolute inset-0 rounded-2xl overflow-hidden transition-colors",
                    isActive ? "bg-[#155c2e]" : "bg-[#1d7a3a]"
                  )}>
                    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100"
                      style={{ opacity: 0.18, fill: 'none', stroke: 'white', strokeWidth: 0.5 }}>
                      <rect x="5" y="3" width="90" height="94" />
                      <line x1="5" y1="50" x2="95" y2="50" strokeWidth="1" />
                      <line x1="5" y1="26" x2="95" y2="26" /><line x1="5" y1="74" x2="95" y2="74" />
                      <line x1="50" y1="3" x2="50" y2="26" /><line x1="50" y1="74" x2="50" y2="97" />
                      <line x1="5" y1="15" x2="95" y2="15" /><line x1="5" y1="85" x2="95" y2="85" />
                      <line x1="12" y1="3" x2="12" y2="97" /><line x1="88" y1="3" x2="88" y2="97" />
                    </svg>
                    
                    {/* Net */}
                    <div className="absolute left-0 right-0" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                      <div className="w-full h-1.5 bg-white/30 relative">
                        <div className="absolute left-1/2 -top-4 -translate-x-1/2 bg-white/90 text-green-900 text-xs font-bold px-3 py-1 rounded-full">NET</div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Layer (Allow Overflows for Search) */}
                  <div className="relative z-10">
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-primary/80 text-white text-xs font-black px-4 py-1 rounded-full z-10 shadow-lg">ทีม A</div>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-secondary/80 text-white text-xs font-black px-4 py-1 rounded-full z-10 shadow-lg">ทีม B</div>

                    <div className="grid grid-rows-2">
                      <div className="grid grid-cols-2 gap-2 sm:gap-4 p-3 sm:p-6 pb-6 sm:pb-10">
                        {[0, 1].map(i => (
                          <SlotCard key={i} slotIndex={i} courtId={selected.id} playerId={selected.players[i]} team="A"
                            members={members} onSelect={id => handleSelect(i, id)} locked={false}
                            openRequest={openSlotRequest?.slot === i ? openSlotRequest.nonce : null} />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:gap-4 p-3 sm:p-6 pt-6 sm:pt-10">
                        {[2, 3].map(i => (
                          <SlotCard key={i} slotIndex={i} courtId={selected.id} playerId={selected.players[i]} team="B"
                            members={members} onSelect={id => handleSelect(i, id)} locked={false}
                            openRequest={openSlotRequest?.slot === i ? openSlotRequest.nonce : null} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* VS bar */}
                <div className="mt-4 flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-3 sm:px-5 py-3">
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-[11px] font-black text-primary/80 uppercase mb-0.5">ทีม A</p>
                    <p className="text-white text-sm font-bold truncate">{teamA.filter(Boolean).map(p => p!.name).join(' & ') || '—'}</p>
                  </div>
                  <span className="text-white/40 font-black text-base shrink-0">VS</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-secondary/80 uppercase mb-0.5">ทีม B</p>
                    <p className="text-white text-sm font-bold truncate">{teamB.filter(Boolean).map(p => p!.name).join(' & ') || '—'}</p>
                  </div>
                </div>
              </div>

              {/* ── Game History for this court ── */}
              {courtGames.length > 0 && (
                <div className="px-3 sm:px-6 pb-4 sm:pb-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-headline font-black text-white text-base">เกมที่ผ่านมา</h3>
                    <span className="text-xs font-black bg-white/10 text-white/60 px-2 py-0.5 rounded-full">{courtGames.length} เกม</span>
                    <span className="text-xs text-white/35 font-semibold">กด +/− เพื่อแก้จำนวนลูก</span>
                  </div>
                  <div className="space-y-2">
                    {courtGames.map(game => (
                      <GameRow key={game.id} game={game} onEditGame={onEditGame} onUndoGame={onUndoGame} shuttlePrice={shuttlePrice} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Court Queue Panel ─────────────────────────────────────────── */}
          {selected && (() => {
            const slots = courtQueues[selected.id] || [];
            return (
              <section className="order-3 lg:col-span-12">
                <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border border-on-surface/5 overflow-hidden">
                  <div className="flex items-center justify-between flex-wrap gap-2 px-4 sm:px-6 py-4 border-b border-on-surface/5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                        <span className="text-lg">⏭</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-on-surface">คิวตีต่อไป</h3>
                        <p className="text-xs text-on-surface/40 font-semibold">{selected.name}</p>
                      </div>
                      {slots.length > 0 && (
                        <span className="bg-primary/10 text-primary text-sm px-2.5 py-0.5 rounded-full font-bold">{slots.length}</span>
                      )}
                    </div>
                    <button
                      onClick={() => setEditingSlot({ courtId: selected.id })}
                      className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm shadow-primary/20 hover:scale-105 active:scale-95 transition-all shrink-0"
                    >
                      <Plus size={15} /> เพิ่มคิว
                    </button>
                  </div>

                  {slots.length === 0 ? (
                    <div className="px-6 py-10 text-center">
                      <p className="text-on-surface/25 font-semibold text-sm">ยังไม่มีคิวตี — กด "เพิ่มคิว" เพื่อจัดล่วงหน้า</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-on-surface/5">
                      {slots.map((slot, idx) => {
                        const allPlayers = [...slot.teamA, ...slot.teamB];
                        return (
                          <div key={slot.id} className="px-4 sm:px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {/* Number */}
                              <div className={cn(
                                'w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0',
                                idx === 0 ? 'bg-primary text-white' : 'bg-on-surface/5 text-on-surface/40'
                              )}>
                                {idx + 1}
                              </div>

                              {/* Players */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {slot.teamA.map((p, i) => (
                                      <div key={i} className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-bold', RANK_COLORS[p.rank])}>
                                        <span className="text-xs font-bold opacity-70">{p.rank}</span>
                                        <span>{p.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {slot.teamA.length > 0 && slot.teamB.length > 0 && (
                                    <span className="text-on-surface/25 font-black text-xs">VS</span>
                                  )}
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {slot.teamB.map((p, i) => (
                                      <div key={i} className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-bold', RANK_COLORS[p.rank])}>
                                        <span className="text-xs font-bold opacity-70">{p.rank}</span>
                                        <span>{p.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {slot.note && (
                                  <p className="text-xs text-on-surface/40 font-semibold mt-1">{slot.note}</p>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                              <button
                                onClick={() => onMoveCourtQueue(selected.id, slot.id, 'up')}
                                disabled={idx === 0}
                                className="p-2 sm:p-1.5 rounded-lg text-on-surface/20 hover:text-primary hover:bg-primary/5 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                title="เลื่อนขึ้น"
                              >
                                <ChevronDown size={16} className="rotate-180" />
                              </button>
                              <button
                                onClick={() => onMoveCourtQueue(selected.id, slot.id, 'down')}
                                disabled={idx === slots.length - 1}
                                className="p-2 sm:p-1.5 rounded-lg text-on-surface/20 hover:text-primary hover:bg-primary/5 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                title="เลื่อนลง"
                              >
                                <ChevronDown size={16} />
                              </button>
                              <button
                                onClick={() => setEditingSlot({ courtId: selected.id, slot })}
                                className="p-2 sm:p-1.5 rounded-lg text-on-surface/20 hover:text-primary hover:bg-primary/5 transition-all"
                                title="แก้ไข"
                              >
                                <RotateCcw size={15} />
                              </button>
                              <button
                                onClick={() => onRemoveCourtQueue(selected.id, slot.id)}
                                className="p-2 sm:p-1.5 rounded-lg text-on-surface/20 hover:text-error hover:bg-error/5 transition-all"
                                title="ลบ"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            );
          })()}
        </div>
      ) : (
        <div className="text-center py-24 bg-white/60 rounded-3xl border-2 border-dashed border-on-surface/10">
          <p className="font-bold text-on-surface/40 text-lg">กด "+ เพิ่มคอร์ด" เพื่อเริ่มต้น</p>
        </div>
      )}
    </div>
  );
}
