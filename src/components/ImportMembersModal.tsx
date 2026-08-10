import React, { useState, useEffect } from 'react';
import { X, FileText, UserPlus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Rank, RANKS, RANK_COLORS, RANK_LEVEL_LABELS } from '../types';

interface ParsedMember {
  id: string;
  name: string;
  rank: Rank;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (members: { name: string; rank: Rank }[], isSession: boolean) => void;
  rankMemory: Record<string, Rank>;
  existingNames: string[];
  isSessionMode?: boolean;
}

// Parse LINE signup text → names & optional ranks
function parseLine(text: string): { name: string; rank?: Rank }[] {
  const lines = text.split('\n');
  const results: { name: string; rank?: Rank }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match "1 ชื่อ", "1. ชื่อ", "1ชื่อ", "- ชื่อ" patterns
    const match = trimmed.match(/^(\d+[\.\):\s-]*)\s*(.+)$/) || trimmed.match(/^([-•*]\s+)(.+)$/);
    
    // If no numbered match, try matching directly as name if it doesn't look like a header
    let content = match ? match[2].trim() : trimmed;
    
    // Skip headers like "รายชื่อตีวันนี้" or "สนามแบด"
    if (!match && (content.includes(':') || content.length > 50)) continue;

    // Look for rank in parentheses or brackets like (S1), [P], (VIP)
    let detectedRank: Rank | undefined;
    const rankMatch = content.match(/\((VIP\d?|BG\d?|S-?\d?|P[+-]?)\)/i) || 
                      content.match(/\[(VIP\d?|BG\d?|S-?\d?|P[+-]??)\]/i) ||
                      content.match(/\s+(VIP\d?|BG\d?|S-?\d?|P[+-]?)$/i);
    
    if (rankMatch) {
      detectedRank = rankMatch[1].toUpperCase().trim() as Rank;
      // Clean rank from name
      content = content.replace(rankMatch[0], '').trim();
    }

    // Remove trailing time patterns like 17:30, 18.00, 19.30, 19:00, (19:00), 17.30น.
    content = content.replace(/\s*\(?\d{1,2}[:\.](?:\d{2}|00)\s*(น\.|น|นับ)?\)?.*$/g, '');
    
    // Remove parenthesized notes at the end (if not already handled by rank)
    content = content.replace(/\s*\(.*?\).*$/, '');

    // Remove common Thai suffixes/particles
    content = content.replace(/\s*(ค่ะ|ครับ|คะ่|นะ|เจ้า).*$/g, '');
    
    const finalName = content.trim();
    if (finalName && isNaN(Number(finalName))) {
      results.push({ name: finalName, rank: detectedRank });
    }
  }
  return results;
}

// Parse Master List text → {name, rank}
function parseMasterList(text: string): { name: string; rank: Rank }[] {
  const lines = text.split('\n');
  const results: { name: string; rank: Rank }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern: "Name Rank" or "Name, Rank" or "Name\tRank"
    const parts = trimmed.split(/[\s,\t]+/).filter(Boolean);
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1].toUpperCase();
      const rankMatch = lastPart.match(/^(VIP\d?|BG\d?|S-?\d?|P[+-]?)$/);
      
      if (rankMatch) {
        const rank = rankMatch[1];
        const name = parts.slice(0, parts.length - 1).join(' ');
        results.push({ name, rank: rank as Rank });
      }
    }
  }
  return results;
}

export function ImportMembersModal({ open, onClose, onImport, rankMemory, existingNames, isSessionMode }: Props) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedMember[]>([]);
  const [step, setStep] = useState<'paste' | 'confirm'>('paste');
  const [mode] = useState<'line' | 'master'>('line');
  // เวลาที่เพิ่งเข้าสู่หน้ายืนยัน — ใช้กัน Enter ที่กด "ติดกันไวเกินไป" (ไม่ว่าจะกดค้างหรือกดซ้ำสองที
  // จริงๆ ก็ตาม) ไม่ให้ไปโดนเงื่อนไข "นำเข้า" ทันทีก่อนจะได้เห็นหน้าจอเปลี่ยนเป็นหน้ายืนยันเลือกมือ
  const confirmEnteredAtRef = React.useRef(0);

  const handleParse = () => {
    if (mode === 'line') {
      const results = parseLine(text);
      if (results.length === 0) { alert('ไม่พบรายชื่อ — ลองวางข้อความในรูปแบบ "1 ชื่อ" หรือ "- ชื่อ"'); return; }
      setParsed(results.map((res, i) => ({
        id: `import-${i}`,
        name: res.name,
        rank: res.rank || rankMemory[res.name] || ('P' as Rank)
      })));
      setStep('confirm');
      confirmEnteredAtRef.current = Date.now();
    } else {
      const results = parseMasterList(text);
      if (results.length === 0) { alert('ไม่พบข้อมูลรูปเเบบ "ชื่อ ระดับมือ" (ตัวอย่าง: บู S1)'); return; }
      setParsed(results.map((res, i) => ({
        id: `master-${i}`,
        name: res.name,
        rank: res.rank
      })));
      setStep('confirm');
      confirmEnteredAtRef.current = Date.now();
    }
  };

  const updateRank = (id: string, rank: Rank) => {
    setParsed(prev => prev.map(p => p.id === id ? { ...p, rank } : p));
  };
  const updateName = (id: string, name: string) => {
    setParsed(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };
  const removeParsed = (id: string) => {
    setParsed(prev => prev.filter(p => p.id !== id));
  };

  const handleImport = () => {
    const valid = parsed.filter(p => p.name.trim().length > 0);
    
    // Check for internal duplicates (clones in the pasted text)
    const seen = new Set<string>();
    const internalDuplicates = new Set<string>();
    valid.forEach(p => {
      const n = p.name.trim().toLowerCase();
      if (seen.has(n)) {
        internalDuplicates.add(p.name.trim());
      }
      seen.add(n);
    });

    if (internalDuplicates.size > 0) {
      alert(`ตรวจพบชื่อซ้ำในรายการนำเข้า: ${Array.from(internalDuplicates).join(', ')}\nกรุณาแก้ไขชื่อให้ต่างกันก่อนนำเข้าครับ`);
      return;
    }

    if (valid.length > 0) {
      onImport(valid.map(p => ({ name: p.name.trim(), rank: p.rank })), isSessionMode || false);
    } else {
       alert('ไม่พบรายชื่อให้นำเข้า');
       return;
    }

    setText('');
    setParsed([]);
    setStep('paste');
    onClose();
  };

  const handleClose = () => {
    setText(''); setParsed([]); setStep('paste');
    onClose();
  };

  // Esc closes, Enter imports (once on the confirm step) — a window listener so this still
  // works after the textarea unmounts and focus falls back to <body> (a plain onKeyDown on the
  // modal div would miss that Enter press, since body isn't a descendant of the modal container).
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }
      if (e.key === 'Enter' && step === 'confirm' && parsed.length > 0) {
        e.preventDefault();
        // ต้องรอสักครู่หลังเข้าหน้ายืนยัน (กันกด Enter ติดกันเร็วเกินไป — ไม่ว่าจะกดค้างหรือกดซ้ำเอง
        // ก็ตาม — ไปโดนนำเข้าทันทีก่อนได้เห็น/แก้ระดับมือของแต่ละคนเลย)
        if (Date.now() - confirmEnteredAtRef.current < 500) return;
        handleImport();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, parsed]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-on-surface/50 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl relative z-10 flex flex-col max-h-[90vh] outline-none">

        {/* Header */}
        <div className="flex items-center gap-4 p-6 border-b border-on-surface/5 shrink-0">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", isSessionMode ? "bg-primary/10" : "bg-secondary/10")}>
            <FileText size={22} className={isSessionMode ? "text-primary" : "text-secondary"} />
          </div>
          <div className="flex-1">
            <h2 className="font-headline font-black text-xl">
              {isSessionMode ? 'ลงชื่อร่วมเซสชัน (รายวัน)' : 'เพิ่มสมาชิกเข้าฐานข้อมูล'}
            </h2>
            <div className="flex gap-4 mt-1">
              <span className="text-xs font-semibold text-primary italic">
                จากคิวไลน์ (LINE Queue)
              </span>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-full hover:bg-background"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
          {step === 'paste' ? (
            <>
              {/* Example */}
              <div className="bg-primary/5 rounded-2xl p-4 text-xs space-y-1">
                <p className="font-bold text-primary text-xs mb-2">
                  {mode === 'line' ? 'ตัวอย่างรายชื่อที่ระบบรองรับ' : 'ตัวอย่างรูปแบบฐานข้อมูล'}
                </p>
                {mode === 'line' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-on-surface/60 font-mono">1. บิ๊ก 17:30</p>
                      <p className="text-on-surface/60 font-mono">2. โรส ค่ะ (พัก)</p>
                      <p className="text-on-surface/60 font-mono">3. โย S1</p>
                    </div>
                    <div className="text-on-surface/40 italic">
                      <p>✨ ระบบจะคลีน "ค่ะ", "เวลา", และ "หมายเหตุ" ออกให้อัตโนมัติ</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-on-surface/60 font-mono">เน็ต S1</p>
                    <p className="text-on-surface/60 font-mono">น้ำ P</p>
                    <p className="text-on-surface/60 font-mono">พี่โย VIP2</p>
                  </>
                )}
              </div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                  // Enter วิเคราะห์รายชื่อทันที, Shift+Enter ขึ้นบรรทัดใหม่ (สำหรับแก้ไข/พิมพ์เพิ่มเอง)
                  // e.repeat กัน auto-repeat จากการกด Enter ค้าง (ดูคอมเมนต์ที่ window listener ด้านบน)
                  if (e.key === 'Enter' && !e.shiftKey && !e.repeat) {
                    e.preventDefault();
                    if (text.trim()) handleParse();
                  }
                }}
                placeholder={mode === 'line' ? 'ก๊อปปี้รายชื่อจากไลน์มาวางที่นี่...' : 'วางชื่อและระดับมือ...'}
                className="w-full h-72 px-4 py-3 bg-background rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                autoFocus
              />
              <p className="text-[11px] text-on-surface/30 font-semibold px-1">
                กด Enter เพื่อวิเคราะห์รายชื่อ • Shift+Enter เพื่อขึ้นบรรทัดใหม่
              </p>
            </>
          ) : (
            <div className="space-y-2">
              {parsed.map((p, idx) => {
                const isExisting = existingNames.some(n => n.trim().toLowerCase() === p.name.trim().toLowerCase());
                return (
                  <div key={p.id} className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors", isExisting ? "bg-primary/5" : "bg-background")}>
                    <span className="text-xs font-black text-on-surface/30 w-6 text-center shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <input
                        value={p.name}
                        onChange={e => updateName(p.id, e.target.value)}
                        className={cn("w-full bg-transparent font-bold text-sm focus:outline-none truncate", isExisting ? "text-primary" : "text-on-surface")}
                      />
                      {isExisting && (
                        <p className="text-xs font-semibold text-primary/60 leading-none">สมาชิกเดิมในระบบ ✓</p>
                      )}
                      {!isExisting && mode === 'line' && (
                        <p className="text-xs font-semibold text-secondary leading-none">สมาชิกใหม่ (เกสต์) 👤</p>
                      )}
                    </div>
                    {/* Rank selector */}
                    <div className="grid grid-cols-5 gap-1 shrink-0">
                      {RANKS.map(r => (
                        <button key={r} onClick={() => updateRank(p.id, r)}
                          title={RANK_LEVEL_LABELS[r]}
                          className={cn(
                            'w-7 h-7 rounded-lg text-xs font-bold transition-all border-2 border-transparent',
                            p.rank === r
                              ? RANK_COLORS[r] + ' border-primary shadow-sm scale-110'
                              : 'bg-on-surface/5 text-on-surface/40 hover:bg-on-surface/10'
                          )}>
                          {r}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => removeParsed(p.id)}
                      className="text-on-surface/20 hover:text-error p-1 shrink-0 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-on-surface/5 flex items-center gap-3 shrink-0">
          {step === 'confirm' && (
            <button onClick={() => setStep('paste')}
              className="px-5 py-3 rounded-2xl font-bold text-sm text-on-surface/60 hover:bg-background transition-colors">
              ← แก้ข้อความ
            </button>
          )}
          <div className="flex-1" />
          <button onClick={handleClose}
            className="px-5 py-3 rounded-2xl font-bold text-sm text-on-surface/60 hover:bg-background transition-colors">
            ยกเลิก
          </button>
          {step === 'paste' ? (
            <button onClick={handleParse} disabled={!text.trim()}
              className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm disabled:opacity-40 hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-primary/20">
              วิเคราะห์รายชื่อ →
            </button>
          ) : (
            <button onClick={handleImport} disabled={parsed.length === 0}
              className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm disabled:opacity-40 hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-primary/20">
              <UserPlus size={16} />
              นำเข้า {parsed.length} คน
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
