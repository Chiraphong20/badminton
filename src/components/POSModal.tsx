import React, { useState, useMemo, useEffect } from 'react';
import { X, Plus, Minus, Search, ShoppingCart, User, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Member, Snack, RANK_COLORS } from '../types';

interface Props {
  member: Member;
  snacks: Snack[];
  onAddSnack: (memberId: string, snacks: Snack[]) => void;
  onClose: () => void;
  /** ถ้าตั้งไว้ = โหมด "เสียน้ำให้เพื่อน" — member (คนจ่าย) จะรับผิดชอบค่าใช้จ่าย
   *  แต่ชื่อสินค้าที่ซื้อจะติดข้อความว่าให้ใครไปด้วย */
  treatFor?: Member | null;
  /** ยกเลิกโหมด "เสียน้ำให้เพื่อน" โดยไม่ปิด modal (กลับไปซื้อให้ตัวเองตามปกติ) */
  onClearTreat?: () => void;
}

interface CartItem {
  snack: Snack;
  quantity: number;
}

export function POSModal({ member, snacks, onAddSnack, onClose, treatFor, onClearTreat }: Props) {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customPrice, setCustomPrice] = useState('');
  const [customName, setCustomName] = useState('อื่นๆ');

  const filteredSnacks = useMemo(() => {
    return snacks.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  }, [snacks, search]);

  const addToCart = (snack: Snack) => {
    setCart(prev => {
      const existing = prev.find(item => item.snack.id === snack.id);
      if (existing) {
        return prev.map(item => item.snack.id === snack.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
        );
      }
      return [...prev, { snack, quantity: 1 }];
    });
  };

  const removeFromCart = (snackId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.snack.id === snackId);
      if (existing && existing.quantity > 1) {
        return prev.map(item => item.snack.id === snackId 
          ? { ...item, quantity: item.quantity - 1 } 
          : item
        );
      }
      return prev.filter(item => item.snack.id !== snackId);
    });
  };

  const addCustomToCart = () => {
    const price = parseFloat(customPrice);
    if (isNaN(price) || price === 0) return;
    
    const snack: Snack = {
      id: `custom-${Date.now()}`,
      name: customName || 'อื่นๆ',
      price: price,
      icon: price < 0 ? '🔄' : '🛍️'
    };
    addToCart(snack);
    setCustomPrice('');
    setCustomName('อื่นๆ');
  };

  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.snack.price * item.quantity), 0);
  }, [cart]);

  const handleFinish = () => {
    const flatSnacks: Snack[] = [];
    cart.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        // โหมด "เสียน้ำให้เพื่อน": คนจ่าย (member) ยังเป็นคนรับผิดชอบยอดเหมือนเดิม
        // แค่ติดข้อความต่อท้ายชื่อสินค้าไว้ว่าซื้อให้ใคร เพื่อให้เห็นในประวัติ
        const snackEntry = treatFor ? { ...item.snack, name: `${item.snack.name} (ให้ ${treatFor.name})` } : item.snack;
        flatSnacks.push(snackEntry);
      }
    });
    onAddSnack(member.id, flatSnacks);
    onClose();
  };

  // Esc closes, Enter ยืนยัน "เรียบร้อย" ทันที (กด 2 ครั้งใช้เฉพาะปุ่ม "จบเกม" ในหน้าคอร์ด) — ใช้
  // window listener เพราะ modal นี้ไม่มี autoFocus ตอนเปิด (เปิดผ่านคลิก/คีย์ลัดจากนอก modal)
  // โฟกัสเลยอาจยังค้างอยู่นอก modal ทำให้ onKeyDown ที่ผูกกับตัว modal โดยตรงไม่ได้รับ event เลย
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Enter' || e.repeat || cart.length === 0) return;
      // e.repeat กัน Enter ค้างยิงซ้ำ (จะได้ไม่เผลอกด "เรียบร้อย" ซ้ำสองจากการกดค้างครั้งเดียว)
      // หมายเหตุ: ช่องค้นหาสินค้า/คีย์ราคาเอง/ชื่อ มี e.stopPropagation() ของตัวเองอยู่แล้วตอนกด Enter
      // (ดูช่อง input ด้านล่าง) event ที่มาถึงตรงนี้จึงไม่ใช่จากช่องพวกนั้น
      e.preventDefault();
      handleFinish();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-0 md:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-on-surface/60 backdrop-blur-md" />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-background w-full max-w-6xl h-full md:h-[85vh] rounded-none md:rounded-[2.5rem] shadow-2xl relative z-10 flex flex-col md:flex-row overflow-hidden border border-white/20 outline-none">
        
        {/* Floating Close Button for Desktop */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-[60] p-2.5 bg-background/50 backdrop-blur-md hover:bg-on-surface/10 rounded-full text-on-surface/40 hover:text-on-surface transition-all flex items-center justify-center shadow-sm border border-white/20"
        >
          <X size={20} />
        </button>

        {/* Left Section: Product Selection */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/50 backdrop-blur-sm">
          {/* Header */}
          <div className="p-6 border-b border-on-surface/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <ShoppingCart size={24} className="text-primary" />
              </div>
              <div>
                <h2 className="font-headline font-black text-2xl text-on-surface">เลือกสินค้า</h2>
                <p className="text-xs font-semibold text-on-surface/45">เลือกรายการสินค้า</p>
              </div>
            </div>
            
            <div className="relative w-64 group hidden sm:block">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/20 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="ค้นหาชื่อสินค้า..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return;
                  e.stopPropagation();
                  // Enter while searching adds the (single) matching product instead of finishing checkout
                  if (filteredSnacks.length === 1) addToCart(filteredSnacks[0]);
                }}
                className="w-full pl-12 pr-4 py-3 bg-on-surface/5 border-none rounded-2xl font-bold text-sm focus:ring-4 focus:ring-primary/10 transition-all outline-none"
              />
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 scrollbar-hide">
            {filteredSnacks.map(s => (
              <button 
                key={s.id} 
                onClick={() => addToCart(s)}
                className="group relative bg-white rounded-[2.5rem] p-5 flex flex-col items-center justify-center gap-4 transition-all border-2 border-transparent hover:border-primary/20 hover:shadow-xl hover:-translate-y-1 active:scale-95"
              >
                <div className="w-24 h-24 flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300 drop-shadow-md overflow-hidden rounded-2xl bg-white/50">
                  {s.image ? (
                    <img 
                      src={s.image} 
                      alt={s.name} 
                      className="w-full h-full object-contain p-2"
                      onError={(e) => {
                        // Fallback if image fails to load
                        (e.currentTarget as HTMLImageElement).src = ''; 
                        (e.currentTarget as HTMLImageElement).parentElement!.innerHTML = `<span class="text-6xl">${s.icon}</span>`;
                      }}
                    />
                  ) : (
                    <span className="text-6xl">{s.icon}</span>
                  )}
                </div>
                <div className="text-center">
                  <p className="font-black text-sm text-on-surface line-clamp-1">{s.name}</p>
                  <p className="text-base font-headline font-black text-primary">฿{s.price}</p>
                </div>
                <div className="absolute top-4 right-4 w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus size={16} className="text-primary" strokeWidth={3} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Section: Cart / Summary */}
        <div className="w-full md:w-[380px] bg-white border-l border-on-surface/5 flex flex-col shadow-2xl">
          {/* Customer Info */}
          <div className="p-6 bg-on-surface/2 border-b border-on-surface/5">
            <div className="flex items-center gap-4">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-lg", RANK_COLORS[member.rank])}>
                {member.rank}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black uppercase text-on-surface/30 tracking-widest">คุณลูกค้า</p>
                <h3 className="font-headline font-black text-2xl text-on-surface truncate leading-tight">{member.name}</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <CreditCard size={14} className="text-green-500" />
                  <span className="text-[11px] font-black text-green-600 uppercase">Balance: ฿{member.balance.toFixed(0)}</span>
                </div>
              </div>
            </div>
            {treatFor && (
              <div className="mt-3 flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-2xl px-3 py-2">
                <span className="text-lg shrink-0">🎁</span>
                <p className="flex-1 text-xs font-bold text-orange-600 leading-tight">
                  กำลังเสียน้ำให้ <span className="font-black">{treatFor.name}</span> — {member.name} จ่ายให้
                </p>
                {onClearTreat && (
                  <button onClick={onClearTreat} className="text-orange-500/60 hover:text-orange-600 shrink-0" title="ยกเลิก เปลี่ยนเป็นซื้อให้ตัวเอง">
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-black uppercase text-on-surface/30 tracking-widest flex items-center gap-2">
                <ShoppingCart size={12} /> ตะกร้าสินค้า ({cart.reduce((a, b) => a + b.quantity, 0)})
              </h4>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-[10px] font-black text-error uppercase hover:underline">ล้างทั้งหมด</button>
              )}
            </div>

            <AnimatePresence mode="popLayout">
              {cart.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center space-y-3">
                  <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto text-on-surface/10">
                    <ShoppingCart size={32} />
                  </div>
                  <p className="text-xs font-bold text-on-surface/20">ยังไม่มีสินค้าในตะกร้า</p>
                </motion.div>
              ) : (
                cart.map(item => (
                  <motion.div 
                    layout key={item.snack.id} 
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    className="flex items-center gap-4 bg-background p-4 rounded-2xl group border border-transparent hover:border-primary/10 transition-all shadow-sm"
                  >
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                      {item.snack.image ? (
                        <img src={item.snack.image} alt={item.snack.name} className="w-full h-full object-contain p-1" />
                      ) : (
                        <span className="text-2xl">{item.snack.icon}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-on-surface truncate">{item.snack.name}</p>
                      <p className="text-[11px] font-black text-primary">฿{item.snack.price}</p>
                    </div>
                    <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl shadow-sm">
                      <button onClick={() => removeFromCart(item.snack.id)} className="w-6 h-6 flex items-center justify-center text-on-surface/30 hover:text-error transition-colors">
                        <Minus size={16} strokeWidth={3} />
                      </button>
                      <span className="text-sm font-black min-w-[20px] text-center">{item.quantity}</span>
                      <button onClick={() => addToCart(item.snack)} className="w-6 h-6 flex items-center justify-center text-on-surface/30 hover:text-primary transition-colors">
                        <Plus size={16} strokeWidth={3} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Custom Quick Add Section */}
          <div className="p-4 bg-primary/5 mx-4 mb-2 rounded-3xl border-2 border-primary/10 space-y-3">
             <p className="text-[9px] font-black uppercase text-primary tracking-[0.2em] px-1">คีย์ราคาเอง / ส่วนลด</p>
             <div className="flex gap-2">
                <input
                  type="text" value={customName} onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); addCustomToCart(); } }}
                  placeholder="ชื่อรายการ..."
                  className="flex-1 px-3 py-2.5 bg-white rounded-xl text-[11px] font-bold outline-none shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <div className="w-24 relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface/20 font-black text-[11px]">฿</span>
                  <input
                    type="number" value={customPrice} onChange={e => setCustomPrice(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); addCustomToCart(); } }}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-2.5 bg-white rounded-xl text-sm font-black outline-none shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <button 
                  onClick={addCustomToCart}
                  disabled={!customPrice}
                  className="bg-primary text-white p-2.5 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100"
                >
                  <Plus size={18} strokeWidth={3} />
                </button>
             </div>
          </div>

          {/* Summary and Action */}
          <div className="p-6 bg-on-surface/[0.03] border-t border-on-surface/5 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-on-surface/40 font-black text-[11px] uppercase tracking-[0.2em] px-1">
                <span>ยอดรวมสินค้า</span>
                <span>฿{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-on-surface/5 pt-5">
                <p className="text-base font-black text-on-surface uppercase tracking-[0.2em]">รวมสุทธิ</p>
                <p className="text-5xl font-headline font-black text-primary">฿{total.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 pt-3">
               <button onClick={onClose} className="p-5 bg-background hover:bg-on-surface/5 text-on-surface/40 rounded-3xl transition-all flex items-center justify-center">
                 <X size={24} />
               </button>
               <button
                onClick={handleFinish}
                disabled={cart.length === 0}
                className="col-span-3 bg-primary text-white py-5 rounded-3xl font-headline font-black text-2xl uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 flex items-center justify-center gap-4">
                 <CheckCircle2 size={32} /> เรียบร้อย
               </button>
            </div>
          </div>
        </div>

      </motion.div>
    </div>
  );
}

const CheckCircle2 = ({ size, className }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
