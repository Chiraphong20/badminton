import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Delete, Check, Loader2, ChevronLeft, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { setToken, setClub, Club } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '';
const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 8;

interface Props {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: Props) {
  // ── Step 1: เลือกก๊วน ──────────────────────────────────────────────────────
  // แอปเดียวรองรับหลายก๊วน (multi-club) แยกข้อมูลกันด้วย club_id ฝั่งเซิร์ฟเวอร์ — ต้องเลือกก๊วน
  // ก่อนถึงจะใส่ PIN ได้ เพราะ PIN ผูกอยู่กับก๊วนนั้นๆ ไม่ใช่ PIN กลางแบบเดิม
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [clubsError, setClubsError] = useState('');
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/clubs`)
      .then(res => res.json())
      .then((data: Club[]) => setClubs(Array.isArray(data) ? data : []))
      .catch(() => setClubsError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));
  }, []);

  // ── Step 2: PIN numpad (เหมือนเดิมทุกอย่าง แค่ผูกกับก๊วนที่เลือกไว้) ──────────
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const press = (digit: string) => {
    if (checking || input.length >= MAX_PIN_LENGTH) return;
    setError('');
    setInput(prev => prev + digit);
  };

  const del = () => { if (!checking) { setError(''); setInput(p => p.slice(0, -1)); } };

  const submit = async () => {
    if (checking || input.length < MIN_PIN_LENGTH || !selectedClub) return;
    setChecking(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubSlug: selectedClub.slug, pin: input })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        setToken(data.token);
        if (data.club) setClub(data.club);
        setSuccess(true);
        setTimeout(onLogin, 500);
      } else {
        setError(data.error || 'PIN ไม่ถูกต้อง');
        setShake(true);
        setTimeout(() => { setInput(''); setShake(false); setChecking(false); }, 500);
        return;
      }
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
      setShake(true);
      setTimeout(() => { setShake(false); setChecking(false); }, 500);
      return;
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'submit', '0', 'del'];

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      className="fixed inset-0 z-[500] bg-on-surface flex flex-col items-center justify-center overflow-hidden select-none"
    >
      {/* Background orbs */}
      <div className="absolute top-1/4 -left-24 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-secondary/10 rounded-full blur-[120px]" />

      <div className="relative flex flex-col items-center gap-8 w-full max-w-xs px-6">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center text-white italic text-4xl font-black shadow-[0_0_40px_rgba(167,51,0,0.4)]">
            TJ
          </div>
          <div className="text-center">
            <h1 className="font-headline font-black text-3xl text-white tracking-tight">SmashPang</h1>
            <p className="text-xs font-bold text-white/30 tracking-widest uppercase mt-0.5">
              {selectedClub ? selectedClub.name : 'เลือกก๊วนของคุณ'}
            </p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {!selectedClub ? (
            // ── Club picker ──────────────────────────────────────────────────
            <motion.div key="clubs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full space-y-2">
              {clubsError && <p className="text-sm font-semibold text-red-400 text-center">{clubsError}</p>}
              {!clubsError && clubs === null && (
                <div className="flex items-center justify-center gap-2 text-white/40 py-6">
                  <Loader2 size={18} className="animate-spin" /> <span className="text-sm font-semibold">กำลังโหลดรายชื่อก๊วน...</span>
                </div>
              )}
              {clubs !== null && clubs.length === 0 && !clubsError && (
                <p className="text-sm font-semibold text-white/40 text-center py-6">ยังไม่มีก๊วนในระบบนี้</p>
              )}
              {clubs?.map(c => (
                <motion.button
                  key={c.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedClub(c)}
                  className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-left transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                    <Users size={16} className="text-primary" />
                  </div>
                  <span className="font-bold text-white flex-1 truncate">{c.name}</span>
                </motion.button>
              ))}
            </motion.div>
          ) : (
            // ── PIN numpad ───────────────────────────────────────────────────
            <motion.div key="pin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full flex flex-col items-center gap-8">
              <button
                onClick={() => { setSelectedClub(null); setInput(''); setError(''); }}
                className="self-start -mt-2 flex items-center gap-1 text-xs font-bold text-white/30 hover:text-white/60 transition-colors"
              >
                <ChevronLeft size={14} /> เปลี่ยนก๊วน
              </button>

              {/* PIN dots */}
              <motion.div
                animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}}
                transition={{ duration: 0.4 }}
                className="flex items-center gap-4 flex-wrap justify-center max-w-[220px]"
              >
                {Array.from({ length: Math.max(input.length, MIN_PIN_LENGTH) }).map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: i === input.length - 1 ? [1, 1.3, 1] : 1,
                    }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      'w-4 h-4 rounded-full border-2 transition-all duration-150',
                      success
                        ? 'bg-green-400 border-green-400'
                        : shake
                        ? 'bg-red-400 border-red-400'
                        : i < input.length
                        ? 'bg-primary border-primary'
                        : 'bg-transparent border-white/20'
                    )}
                  />
                ))}
              </motion.div>

              <p className={cn('text-sm font-semibold -mt-4', error ? 'text-red-400' : 'text-white/30')}>
                {success ? '✓ เข้าสู่ระบบสำเร็จ' : error || (checking ? 'กำลังตรวจสอบ...' : 'ใส่ PIN แล้วกด ✓ เพื่อเข้าสู่ระบบ')}
              </p>

              {/* Numpad */}
              <div className={cn('grid grid-cols-3 gap-3 w-full transition-opacity', checking && 'opacity-50 pointer-events-none')}>
                {keys.map((k, i) => {
                  if (k === 'del') {
                    return (
                      <motion.button
                        key={i}
                        whileTap={{ scale: 0.88 }}
                        onClick={del}
                        className="h-16 rounded-2xl font-black text-2xl flex items-center justify-center transition-colors bg-white/5 text-white/40 hover:bg-white/10"
                      >
                        <Delete size={22} />
                      </motion.button>
                    );
                  }
                  if (k === 'submit') {
                    const ready = input.length >= MIN_PIN_LENGTH;
                    return (
                      <motion.button
                        key={i}
                        whileTap={ready ? { scale: 0.88 } : undefined}
                        onClick={submit}
                        disabled={!ready}
                        className={cn(
                          'h-16 rounded-2xl font-black text-2xl flex items-center justify-center transition-colors',
                          ready ? 'bg-primary text-white hover:bg-primary/90' : 'bg-white/5 text-white/20'
                        )}
                      >
                        {checking ? <Loader2 size={22} className="animate-spin" /> : <Check size={22} />}
                      </motion.button>
                    );
                  }
                  return (
                    <motion.button
                      key={i}
                      whileTap={{ scale: 0.88 }}
                      onClick={() => press(k)}
                      className="h-16 rounded-2xl font-black text-2xl flex items-center justify-center transition-colors bg-white/10 text-white hover:bg-white/20 active:bg-primary/40"
                    >
                      {k}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
