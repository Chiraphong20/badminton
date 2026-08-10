import React, { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { Court, RANK_COLORS, CourtQueueSlot, Member } from '../types';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface AppState {
  members: Member[];
  courts: Court[];
  courtQueues?: Record<string, CourtQueueSlot[]>;
}

export function QueueView() {
  const [state, setState] = useState<AppState | null>(null);
  const [now, setNow] = useState(new Date());
  const [lastSync, setLastSync] = useState(new Date());

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/state`);
      if (res.ok) {
        setState(await res.json());
        setLastSync(new Date());
      }
    } catch {}
  };

  useEffect(() => {
    load();
    const syncIv = setInterval(load, 20000);
    const clockIv = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(syncIv); clearInterval(clockIv); };
  }, []);

  if (!state) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
            <span className="text-4xl">🏸</span>
          </div>
          <p className="font-bold text-on-surface/40">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  const allCourts = state.courts || [];
  const activeCourts = allCourts.filter(c => c.status === 'active');

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="bg-primary text-white sticky top-0 z-10 shadow-xl shadow-primary/20">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏸</span>
            <div>
              <h1 className="font-headline font-black text-xl leading-none">คิวแบดมินตัน</h1>
              <p className="text-xs text-white/50 mt-0.5">Live Queue Board</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-headline font-black text-2xl tabular-nums leading-none">{format(now, 'HH:mm')}</p>
            <p className="text-xs text-white/50">{format(now, 'น. d MMM', { locale: th })}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">

        {/* Active Courts */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <h2 className="font-bold text-base text-on-surface">
              สนามที่กำลังตีอยู่
              <span className="ml-2 text-on-surface/40 font-semibold text-sm">({activeCourts.length}/{allCourts.length} สนาม)</span>
            </h2>
          </div>

          {activeCourts.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-on-surface/5">
              <p className="text-3xl mb-2">😴</p>
              <p className="font-bold text-on-surface/30">ยังไม่มีสนามที่เปิดอยู่</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCourts.map(court => {
                const pids = court.players.filter(Boolean) as string[];
                const players = pids.map(id => (state.members || []).find(m => m.id === id)).filter(Boolean) as Member[];
                const teamA = players.slice(0, 2);
                const teamB = players.slice(2);
                const nextSlots = state.courtQueues?.[court.id] || [];
                const nextSlot = nextSlots[0];

                return (
                  <div key={court.id} className="bg-white rounded-3xl p-5 shadow-sm border border-on-surface/5">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-bold text-on-surface/60">{court.name}</span>
                      <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">🏸 กำลังตี</span>
                    </div>

                    <div className="grid grid-cols-[1fr_32px_1fr] gap-2 items-center">
                      <div className="space-y-2">
                        {teamA.map(p => (
                          <div key={p.id} className="flex items-center gap-2">
                            <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0', RANK_COLORS[p.rank])}>{p.rank}</span>
                            <span className="font-bold text-base truncate">{p.name}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-center text-on-surface/20 font-black text-xs">VS</div>
                      <div className="space-y-2">
                        {teamB.map(p => (
                          <div key={p.id} className="flex items-center gap-2 justify-end">
                            <span className="font-bold text-base truncate">{p.name}</span>
                            <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0', RANK_COLORS[p.rank])}>{p.rank}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {nextSlot && (
                      <div className="mt-4 pt-3 border-t border-on-surface/5">
                        <p className="text-xs font-bold text-primary mb-1">⏭ คิวถัดไป</p>
                        <p className="text-sm text-on-surface/60 font-semibold">
                          {[...nextSlot.teamA, ...nextSlot.teamB].map(p => p.name).join('  ·  ')}
                        </p>
                        {nextSlots.length > 1 && (
                          <p className="text-xs text-on-surface/30 mt-0.5">และอีก {nextSlots.length - 1} คิว</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-center text-xs text-on-surface/20 pb-6">
          อัปเดตทุก 20 วินาที · ล่าสุด {format(lastSync, 'HH:mm:ss')} น.
        </p>
      </div>
    </div>
  );
}
