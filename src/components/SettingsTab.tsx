import React, { useState, useEffect } from 'react';
import {
  Settings,
  RefreshCw,
  TrendingUp,
  Plus,
  Trash2,
  QrCode,
  Copy,
  Check,
  Download,
  Lock,
  LogOut,
} from 'lucide-react';
import { Rank } from '../types';

interface Props {
  courtFeePerPerson: number;
  setCourtFeePerPerson: (val: number) => void;
  shuttlePrice: number;
  setShuttlePrice: (val: number) => void;
  promptPayId: string;
  setPromptPayId: (val: string) => void;
  clubSlug: string;
  onSeedMockHistory: () => void;
  onResetDay: () => void;
  onFactoryReset: () => void;
  rankMemory: Record<string, Rank>;
  onChangePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  onLogout: () => void;
}

export function SettingsTab({
  courtFeePerPerson, setCourtFeePerPerson,
  shuttlePrice, setShuttlePrice,
  promptPayId, setPromptPayId,
  clubSlug,
  onSeedMockHistory, onResetDay, onFactoryReset,
  rankMemory, onChangePin, onLogout
}: Props) {
  const [promptPayInput, setPromptPayInput] = useState(promptPayId);
  const [promptPaySaved, setPromptPaySaved] = useState(false);
  // sync ค่าจาก props ถ้ามีการโหลดข้อมูลใหม่มาทับ (เช่นตอนเปิดหน้าครั้งแรก data ยังไม่มา)
  useEffect(() => { setPromptPayInput(promptPayId); }, [promptPayId]);

  const savePromptPay = () => {
    setPromptPayId(promptPayInput.trim());
    setPromptPaySaved(true);
    setTimeout(() => setPromptPaySaved(false), 2000);
  };
  const [copied, setCopied] = useState(false);
  // ตัว PIN ปัจจุบันเก็บแค่ hash ไว้ที่เซิร์ฟเวอร์ ฝั่งนี้จึงพรีฟิลค่าเดิมไม่ได้แล้ว —
  // ต้องพิมพ์ PIN ปัจจุบันมายืนยันทุกครั้งที่จะเปลี่ยน (กันกรณีเครื่องเปิดค้างไว้)
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [pinSaved, setPinSaved] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  const savePin = async () => {
    setPinError('');
    if (!currentPinInput) { setPinError('กรอก PIN ปัจจุบันก่อน'); return; }
    if (newPinInput.length < 4) { setPinError('PIN ใหม่ต้องมีอย่างน้อย 4 หลัก'); return; }
    if (!/^\d+$/.test(newPinInput)) { setPinError('PIN ต้องเป็นตัวเลขเท่านั้น'); return; }
    setPinSaving(true);
    const result = await onChangePin(currentPinInput, newPinInput);
    setPinSaving(false);
    if (!result.success) { setPinError(result.error || 'เปลี่ยน PIN ไม่สำเร็จ'); return; }
    setCurrentPinInput('');
    setNewPinInput('');
    setPinSaved(true);
    setTimeout(() => setPinSaved(false), 2000);
  };
  // แอปเดียวรองรับหลายก๊วน — หน้าคิว (public, ไม่ล็อกอิน) ต้องระบุว่าเป็นก๊วนไหนผ่าน ?club=
  const queueUrl = `${window.location.origin}${window.location.pathname}?queue&club=${encodeURIComponent(clubSlug)}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(queueUrl)}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(queueUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQr = async () => {
    const res = await fetch(qrSrc);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'queue-qrcode.png';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
          <Settings size={24} className="text-primary" />
        </div>
        <div>
          <h2 className="font-headline font-black text-2xl text-on-surface">ตั้งค่าระบบ</h2>
          <p className="text-xs text-on-surface/40 font-bold uppercase tracking-widest">System Configuration & Maintenance</p>
        </div>
      </div>



      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* PIN Section */}
        <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-on-surface/5 space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-on-surface/40 flex items-center gap-2">
            <Lock size={18} className="text-primary" />
            PIN เข้าสู่ระบบ
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-on-surface/40 ml-2">PIN ปัจจุบัน</label>
              <input
                type="password"
                inputMode="numeric"
                value={currentPinInput}
                onChange={e => { setPinError(''); setCurrentPinInput(e.target.value.replace(/\D/g, '').slice(0, 8)); }}
                className="w-full mt-1 px-6 py-4 bg-background rounded-2xl font-headline font-black text-2xl tracking-[0.4em] focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all border-none"
                placeholder="••••"
              />
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs font-bold text-on-surface/40 ml-2">PIN ใหม่ ({newPinInput.length} หลัก)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={newPinInput}
                  onChange={e => { setPinError(''); setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 8)); }}
                  className="w-full mt-1 px-6 py-4 bg-background rounded-2xl font-headline font-black text-2xl tracking-[0.4em] focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all border-none"
                  placeholder="••••"
                />
              </div>
              <button
                onClick={savePin}
                disabled={pinSaving}
                className="px-5 py-4 bg-primary text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all shrink-0 disabled:opacity-50"
              >
                {pinSaved ? <Check size={20} /> : pinSaving ? '...' : 'บันทึก'}
              </button>
            </div>
            {pinError && <p className="text-xs text-red-500 font-bold ml-2">{pinError}</p>}
            <p className="text-xs text-on-surface/30 ml-2">ตัวเลข 4–8 หลัก · เปลี่ยนที่นี่จะมีผลกับทุกเครื่องที่ล็อกอินอยู่</p>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 text-xs font-bold text-on-surface/40 hover:text-red-500 transition-colors ml-2 pt-2"
            >
              <LogOut size={14} /> ออกจากระบบ
            </button>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-on-surface/5 space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-on-surface/40 flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" />
            ราคาและค่าบริการ
          </h3>
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-bold text-on-surface/40 ml-2">ค่าสนามต่อคน (฿)</label>
              <input 
                type="number" 
                value={courtFeePerPerson} 
                onChange={e => setCourtFeePerPerson(Number(e.target.value))}
                className="w-full px-6 py-4 bg-background rounded-2xl font-headline font-black text-3xl focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all border-none" 
              />
            </div>
            <div className="space-y-3">
              <label className="text-xs font-bold text-on-surface/40 ml-2">ราคาลูกแบด (฿)</label>
              <input
                type="number"
                value={shuttlePrice}
                onChange={e => setShuttlePrice(Number(e.target.value))}
                className="w-full px-6 py-4 bg-background rounded-2xl font-headline font-black text-3xl focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all border-none"
              />
            </div>
          </div>
        </section>

        {/* PromptPay Section */}
        <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-on-surface/5 space-y-6 md:col-span-2">
          <h3 className="text-sm font-black uppercase tracking-widest text-on-surface/40 flex items-center gap-2">
            <QrCode size={18} className="text-primary" />
            PromptPay
          </h3>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-on-surface/40 ml-2">เบอร์พร้อมเพย์ / เลขบัตรประชาชน</label>
              <input
                type="text"
                inputMode="numeric"
                value={promptPayInput}
                onChange={e => setPromptPayInput(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') savePromptPay(); }}
                placeholder="เช่น 0812345678 หรือเลขบัตร 13 หลัก"
                className="w-full mt-1 px-6 py-4 bg-background rounded-2xl font-headline font-black text-2xl tracking-tight focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all border-none"
              />
            </div>
            <button
              onClick={savePromptPay}
              className="px-5 py-4 bg-primary text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all shrink-0 w-full sm:w-auto"
            >
              {promptPaySaved ? <Check size={20} className="mx-auto" /> : 'บันทึก'}
            </button>
          </div>
          <p className="text-xs text-on-surface/30 ml-2">
            {promptPayId
              ? 'ตั้งไว้แล้ว — ตอนกด "รับเงิน & ปิดยอด" ในหน้ารายชื่อ จะมีตัวเลือกสร้าง QR พร้อมเพย์ให้ลูกค้าสแกนจ่ายยอดที่ค้าง (รวมยอดของหลายคนพร้อมกันได้)'
              : 'ยังไม่ได้ตั้งเบอร์พร้อมเพย์ — ตั้งไว้เพื่อเปิดใช้ QR รับเงินตอนเช็คบิลลูกค้า'}
          </p>
        </section>
      </div>

      {/* System Maintenance Section */}
      <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-on-surface/5 space-y-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-on-surface/40">การจัดการระบบ</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button onClick={onSeedMockHistory} 
            className="flex items-center justify-between p-6 bg-secondary/5 hover:bg-secondary/10 rounded-3xl transition-all group border-none">
            <div className="text-left">
              <p className="text-sm font-black text-secondary uppercase leading-tight">Mock Data</p>
              <p className="text-xs text-on-surface/45 font-semibold">สร้างข้อมูลจำลอง</p>
            </div>
            <Plus size={20} className="text-secondary group-hover:scale-125 transition-all" />
          </button>
          <button onClick={onResetDay} 
            className="flex items-center justify-between p-6 bg-error/5 hover:bg-error/10 rounded-3xl transition-all group border-none">
            <div className="text-left">
              <p className="text-sm font-black text-error uppercase leading-tight">Reset Day</p>
              <p className="text-xs text-on-surface/45 font-semibold">เริ่มวันใหม่/ล้างกระดาน</p>
            </div>
            <RefreshCw size={20} className="text-error group-hover:rotate-180 transition-all duration-500" />
          </button>
          <button onClick={onFactoryReset} 
            className="flex items-center justify-between p-6 bg-error/5 hover:bg-error/10 rounded-3xl transition-all group border-none">
            <div className="text-left">
              <p className="text-sm font-black text-error uppercase leading-tight">Factory Reset</p>
              <p className="text-xs text-on-surface/45 font-semibold">ลบข้อมูลทั้งหมดถาวร</p>
            </div>
            <Trash2 size={20} className="text-error group-hover:scale-125 transition-all" />
          </button>
        </div>
      </section>

      {/* QR Code Section */}
      <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-on-surface/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-secondary/10 rounded-2xl flex items-center justify-center">
            <QrCode size={20} className="text-secondary" />
          </div>
          <div>
            <h3 className="font-bold text-base text-on-surface">QR Code — หน้าคิวสำหรับลูกค้า</h3>
            <p className="text-xs text-on-surface/45 font-semibold">ลูกค้าสแกนเพื่อดูคิวรอและสนามที่กำลังตีอยู่</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="flex flex-col items-center gap-3 shrink-0">
            <div className="bg-white p-3 rounded-2xl border-2 border-on-surface/5 shadow-sm">
              <img
                src={qrSrc}
                alt="Queue QR Code"
                width={180}
                height={180}
                className="rounded-xl"
              />
            </div>
            <button
              onClick={downloadQr}
              className="flex items-center gap-2 bg-on-surface/5 hover:bg-on-surface/10 text-on-surface/60 px-5 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95 w-full justify-center"
            >
              <Download size={15} /> ดาวน์โหลด QR
            </button>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <p className="text-xs font-bold text-on-surface/40 mb-2">URL หน้าคิว</p>
              <div className="flex items-center gap-2 bg-background rounded-2xl px-4 py-3">
                <p className="text-sm font-semibold text-on-surface/70 flex-1 truncate">{queueUrl}</p>
                <button
                  onClick={copyUrl}
                  className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 hover:scale-105 active:scale-95 transition-all"
                >
                  {copied ? <><Check size={12} /> คัดลอกแล้ว</> : <><Copy size={12} /> คัดลอก</>}
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-on-surface/50">
              <p className="flex items-center gap-2 font-semibold">✅ แสดงสนามที่กำลังตีอยู่</p>
              <p className="flex items-center gap-2 font-semibold">✅ แสดงคิวรอตามลำดับ</p>
              <p className="flex items-center gap-2 font-semibold">✅ อัปเดตอัตโนมัติทุก 20 วินาที</p>
              <p className="flex items-center gap-2 font-semibold">✅ ไม่ต้องล็อกอิน — ดูได้ทุกคน</p>
            </div>

            <a
              href={queueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-secondary/10 text-secondary px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-secondary/20 transition-all"
            >
              <QrCode size={16} /> ดูตัวอย่างหน้าคิว →
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
