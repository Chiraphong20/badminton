import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Delete } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  onLogin: () => void;
  pin: string;
}

export function LoginScreen({ onLogin, pin }: Props) {
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);

  const press = (digit: string) => {
    if (input.length >= pin.length) return;
    const next = input + digit;
    setInput(next);
    if (next.length === pin.length) {
      setTimeout(() => {
        if (next === pin) {
          setSuccess(true);
          setTimeout(onLogin, 600);
        } else {
          setShake(true);
          setTimeout(() => { setInput(''); setShake(false); }, 600);
        }
      }, 80);
    }
  };

  const del = () => setInput(p => p.slice(0, -1));

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

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
            <h1 className="font-headline font-black text-3xl text-white tracking-tight">เตียเจริญ</h1>
            <p className="text-xs font-bold text-white/30 tracking-widest uppercase mt-0.5">by เน็ตน่ารัก</p>
          </div>
        </motion.div>

        {/* PIN dots */}
        <motion.div
          animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-4"
        >
          {Array.from({ length: pin.length }).map((_, i) => (
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

        <p className="text-white/30 text-sm font-semibold -mt-4">
          {success ? '✓ เข้าสู่ระบบสำเร็จ' : shake ? 'PIN ไม่ถูกต้อง' : 'ใส่ PIN เพื่อเข้าสู่ระบบ'}
        </p>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {keys.map((k, i) => {
            if (k === '') return <div key={i} />;
            const isDel = k === '⌫';
            return (
              <motion.button
                key={i}
                whileTap={{ scale: 0.88 }}
                onClick={() => isDel ? del() : press(k)}
                className={cn(
                  'h-16 rounded-2xl font-black text-2xl flex items-center justify-center transition-colors',
                  isDel
                    ? 'bg-white/5 text-white/40 hover:bg-white/10'
                    : 'bg-white/10 text-white hover:bg-white/20 active:bg-primary/40'
                )}
              >
                {isDel ? <Delete size={22} /> : k}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
