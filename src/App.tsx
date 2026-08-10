import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Users, LayoutDashboard, Trophy, Banknote, UserPlus, Search, ShoppingCart, History, FileText, ChevronLeft, ChevronRight, Menu, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Member, Court, Rank, RANKS, RANK_COLORS, Snack, PaymentRecord, GameRecord, SessionRecord, CourtQueueSlot, QueuePlayer } from './types';
import { format } from 'date-fns';
import confetti from 'canvas-confetti';

import { LoginScreen } from './components/LoginScreen';
import { DashboardTab } from './components/DashboardTab';
import { CourtsTab } from './components/CourtsTab';
import { MembersTab } from './components/MembersTab';
import { SettingsTab } from './components/SettingsTab';
import { AddMemberModal } from './components/AddMemberModal';
import { AddCourtModal } from './components/AddCourtModal';
import { ManageProductsModal } from './components/ManageProductsModal';
import { ImportMembersModal } from './components/ImportMembersModal';
import { LogsTab } from './components/LogsTab';
import { QueueView } from './components/QueueView';
import { RANK_WEIGHTS } from './types';
import { useModalHotkeys } from './hooks/useModalHotkeys';
import { apiFetch, getToken, clearToken, AUTH_EXPIRED_EVENT } from './lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

type Tab = 'dashboard' | 'members' | 'courts' | 'settings' | 'logs';

const TAB_SHORTCUTS: Partial<Record<Tab, string>> = { dashboard: 'F1', courts: 'F2', logs: 'F3', members: 'F4' };
const SHORTCUT_TABS: Record<string, Tab> = { F1: 'dashboard', F2: 'courts', F3: 'logs', F4: 'members' };

const mkMember = (id: string, name: string, rank: Rank, gamesPlayed: number, offset: number): Member => ({
  id, name, rank, gamesPlayed,
  checkInTime: Date.now() - offset,
  status: 'waiting',
  balance: 0, courtBalance: 0, shuttleBalance: 0, shuttleCount: 0, snackBalance: 0,
  snackHistory: [],
  paidCourtFee: false,
  totalCourt: 0, totalShuttle: 0, totalSnack: 0,
});

const INITIAL_MEMBERS: Member[] = [];

const INITIAL_COURTS: Court[] = [
  { id: 'c1', name: 'คอร์ด 1', players: [null, null, null, null], status: 'empty', shuttlecocks: 1 },
  { id: 'c2', name: 'คอร์ด 2', players: [null, null, null, null], status: 'empty', shuttlecocks: 1 },
  { id: 'c3', name: 'คอร์ด 3', players: [null, null, null, null], status: 'empty', shuttlecocks: 1 },
  { id: 'c4', name: 'คอร์ด 4', players: [null, null, null, null], status: 'empty', shuttlecocks: 1 },
  { id: 'c5', name: 'คอร์ด 5', players: [null, null, null, null], status: 'empty', shuttlecocks: 1 },
];

export default function App() {
  const [members, setMembers] = useState<Member[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('courts');
  const [courtFeePerPerson, setCourtFeePerPerson] = useState(40);
  const [shuttlePrice, setShuttlePrice] = useState(25);
  const [minRankFilter, setMinRankFilter] = useState<Rank>('P+');
  const [maxRankFilter, setMaxRankFilter] = useState<Rank>('VIP1');
  const [sessionHistory, setSessionHistory] = useState<SessionRecord[]>([]);
  const [viewingSession, setViewingSession] = useState<SessionRecord | null>(null);
  const [rankMemory, setRankMemory] = useState<Record<string, Rank>>({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // PIN ไม่ได้เก็บ/เช็คฝั่ง client อีกต่อไป — เซิร์ฟเวอร์เป็นคนตรวจสอบและออก token ให้
  // (ดู src/lib/api.ts + backend /api/login) isAuthenticated แค่สะท้อนว่ามี token อยู่ไหม
  // เท่านั้น ถ้า token หมดอายุ/ใช้ไม่ได้ apiFetch จะ broadcast AUTH_EXPIRED_EVENT ให้เด้งกลับ
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());
  // เก็บวันที่เริ่มต้นก๊วน (fix ปัญหาเลยเที่ยงคืน)
  const [sessionStartDate, setSessionStartDate] = useState<number | null>(null);

  // Modal states
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddCourt, setShowAddCourt] = useState(false);
  const [showManageProducts, setShowManageProducts] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importIsSession, setImportIsSession] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [courtQueues, setCourtQueues] = useState<Record<string, CourtQueueSlot[]>>({});
  const [nextQueuePrompt, setNextQueuePrompt] = useState<{
    courtId: string; courtName: string; slot: CourtQueueSlot; emptyCourts: Court[];
  } | null>(null);

  const isQueueView = useMemo(() => new URLSearchParams(window.location.search).has('queue'), []);

  // ถ้า token หมดอายุ/ใช้ไม่ได้ระหว่างใช้งาน (apiFetch เจอ 401) เด้งกลับไปหน้า login
  useEffect(() => {
    const handler = () => setIsAuthenticated(false);
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, []);

  // Sync to API on startup — ทำหลัง login เสร็จเท่านั้น (ข้อมูลสมาชิก/ยอดเงินต้อง
  // ยืนยันตัวตนก่อนถึงจะดึงได้ ไม่งั้นข้อมูลจะโหลดเข้า memory ก่อนเช็ค PIN เสร็จ)
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        setIsSyncing(true);
        const [stateRes, masterRes] = await Promise.all([
          apiFetch(`${API_BASE}/api/state`).catch(() => null),
          apiFetch(`${API_BASE}/api/master`).catch(() => null)
        ]);

        let loadedState: any = null;
        if (stateRes && stateRes.ok) loadedState = await stateRes.json();

        let loadedMaster: any = null;
        if (masterRes && masterRes.ok) loadedMaster = await masterRes.json();

        // 1) Load basic states
        if (loadedState?.courts && loadedState.courts.length > 0) {
          setCourts(loadedState.courts);
        } else {
          setCourts(INITIAL_COURTS);
        }

        if (loadedState?.gameHistory) setGameHistory(loadedState.gameHistory);
        if (loadedState?.paymentHistory) setPaymentHistory(loadedState.paymentHistory);
        if (loadedState?.sessionHistory) setSessionHistory(loadedState.sessionHistory);
        if (loadedState?.courtFeePerPerson) setCourtFeePerPerson(loadedState.courtFeePerPerson);
        if (loadedState?.shuttlePrice) setShuttlePrice(loadedState.shuttlePrice);
        if (loadedState?.sessionStartDate) setSessionStartDate(loadedState.sessionStartDate);
        if (loadedState?.courtQueues) setCourtQueues(loadedState.courtQueues);
        if (loadedState?.snacks) {
          setSnacks(loadedState.snacks);
        }

        // 2) Load and Merge Master <-> State
        let activeMembers: Member[] = loadedState?.members || [...INITIAL_MEMBERS];
        let combinedRankMemory = loadedState?.rankMemory || {};

        if (loadedMaster?.rankMemory) {
          combinedRankMemory = { ...combinedRankMemory, ...loadedMaster.rankMemory };
        }

        if (loadedMaster?.members) {
          loadedMaster.members.forEach((masterMem: Member) => {
            combinedRankMemory[masterMem.name] = masterMem.rank;
            const existing = activeMembers.find(m => m.name.toLowerCase() === masterMem.name.toLowerCase());
            if (!existing) {
              activeMembers.push({ ...masterMem, status: 'resting' });
            }
          });
        }

        setMembers(activeMembers);
        setRankMemory(combinedRankMemory);

      } catch (err) {
        console.error('Failed to load initial data from DB:', err);
      } finally {
        setIsSyncing(false);
        // Add a slight artificial delay for the premium feel
        setTimeout(() => setIsInitialLoading(false), 1200);
      }
    })();
  }, [isAuthenticated]);

  // Keep a ref with latest state for the auto-save interval
  const autoSaveStateRef = useRef<object>({});
  useEffect(() => {
    autoSaveStateRef.current = {
      members, courts, gameHistory, paymentHistory, sessionHistory,
      rankMemory, courtFeePerPerson, shuttlePrice, snacks, sessionStartDate, courtQueues
    };
  }, [members, courts, gameHistory, paymentHistory, sessionHistory, rankMemory, courtFeePerPerson, shuttlePrice, snacks, sessionStartDate, courtQueues]);

  // Auto-save every 2 minutes regardless of state changes
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await apiFetch(`${API_BASE}/api/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(autoSaveStateRef.current)
        });
        setLastAutoSave(new Date());
      } catch (err) {
        console.warn('Auto-save failed:', err);
      }
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Debounced save EVERYTHING to Database
  useEffect(() => {
    const handler = setTimeout(async () => {
      // Don't save empty states over initial real DB states before API finishes pulling
      // if (members.length === 0 && isSyncing) return;

      try {
        await apiFetch(`${API_BASE}/api/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            members,
            courts,
            gameHistory,
            paymentHistory,
            sessionHistory,
            rankMemory,
            courtFeePerPerson,
            shuttlePrice,
            snacks,
            sessionStartDate,
            courtQueues
          })
        });
      } catch (err) {
        console.warn('Failed to save state to DB:', err);
      }
    }, 2000);
    return () => clearTimeout(handler);
  }, [members, courts, gameHistory, paymentHistory, sessionHistory, courtFeePerPerson, shuttlePrice, rankMemory, snacks, sessionStartDate, courtQueues]);

  // Live-sync: push games/payments straight into the permanent DB tables as they happen —
  // no need to wait for "เริ่มวันใหม่" (Reset Day) before a game/payment becomes durable.
  // Skipped while no ก๊วน/session is open (sessionStartDate null) so it never creates junk
  // session rows before anyone has checked in.
  useEffect(() => {
    if (!sessionStartDate) return;
    const handler = setTimeout(async () => {
      try {
        await apiFetch(`${API_BASE}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timestamp: sessionStartDate,
            members,
            games: gameHistory,
            payments: paymentHistory,
            final: false
          })
        });
      } catch (err) {
        console.warn('Live-sync to DB failed (will retry on next change):', err);
      }
    }, 3000);
    return () => clearTimeout(handler);
  }, [members, gameHistory, paymentHistory, sessionStartDate]);

  // Debounced save MASTER DATA (Permanent members & Settings) to MySQL
  useEffect(() => {
    const handler = setTimeout(async () => {
      try {
        await apiFetch(`${API_BASE}/api/master`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            members: members,
            settings: { courtFeePerPerson, shuttlePrice }
          })
        });
      } catch (err) {
        console.warn('Failed to save master data to DB:', err);
      }
    }, 5000); // Save master data less frequently
    return () => clearTimeout(handler);
  }, [members, courtFeePerPerson, shuttlePrice]);

  // Keyboard shortcuts: F1 ภาพรวม, F2 คอร์ด, F3 บันทึก, F4 สมาชิก
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tab = SHORTCUT_TABS[e.key];
      if (tab) {
        e.preventDefault();
        setActiveTab(tab);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const resetDay = async () => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการเริ่มวันใหม่? (ล้างประวัติการตีและรีเซ็ตคอร์ด)')) return;
    // ใช้ timestamp เดิมของ session (ไม่ใช่เวลาที่กดปุ่ม) เพื่อให้ archive ตรงกับ session ที่
    // live-sync เขียนไว้ระหว่างวันตัว sessionId เดียวกัน ไม่สร้างแถวใหม่ซ้ำ
    const finalTimestamp = sessionStartDate || Date.now();
    saveSession();
    setSessionStartDate(null);

    // Final sync: ปิด session เป็น completed (ข้อมูลจริงถูก live-sync เข้า DB ไปตลอดวันแล้ว)
    setIsSyncing(true);
    try {
      await apiFetch(`${API_BASE}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: finalTimestamp,
          members: members,
          games: gameHistory,
          payments: paymentHistory,
          final: true
        })
      });
    } catch (err) {
      console.error('Failed to archive session to DB:', err);
    } finally {
      setIsSyncing(false);
    }

    setGameHistory([]);
    setPaymentHistory([]);
    setCourts(INITIAL_COURTS);
    setMembers(prev => prev.map(m => ({
      ...m,
      gamesPlayed: 0,
      balance: 0,
      courtBalance: 0,
      shuttleBalance: 0,
      shuttleCount: 0,
      snackBalance: 0,
      snackHistory: [],
      paidCourtFee: false,
      status: 'resting',
      checkInTime: Date.now(),
      totalCourt: 0,
      totalShuttle: 0,
      totalSnack: 0
    })));

  };

  const clearBoard = () => {
    if (!confirm('ยืนยัน "ล้างกระดาน" หรือไม่? \n(ลบรายการทั้งหมดของวันนี้ทิ้งโดยไม่บันทึกประวัติ)')) return;
    // Live-sync อาจเขียนเกม/บิลของวันนี้ลง DB ไปแล้วก่อนหน้านี้ — เพราะ "ล้างกระดาน" แปลว่า
    // ไม่บันทึกประวัติ จึงต้องสั่งลบของที่เพิ่ง sync ไปออกจาก DB ด้วย ไม่ใช่แค่ล้างหน้าจอ
    const staleTimestamp = sessionStartDate;
    if (staleTimestamp) {
      apiFetch(`${API_BASE}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp: staleTimestamp, members, games: [], payments: [], final: true })
      }).catch(err => console.warn('Failed to purge cleared board from DB:', err));
    }
    setGameHistory([]);
    setPaymentHistory([]);
    setCourts(INITIAL_COURTS);
    setSessionStartDate(null);
    setMembers(prev => prev.map(m => ({
      ...m,
      gamesPlayed: 0,
      balance: 0,
      courtBalance: 0,
      shuttleBalance: 0,
      shuttleCount: 0,
      snackBalance: 0,
      snackHistory: [],
      paidCourtFee: false,
      status: 'resting',
      checkInTime: Date.now(),
      totalCourt: 0,
      totalShuttle: 0,
      totalSnack: 0
    })));
  };

  const updateGame = (gameId: string, newPlayerIds: string[], newShuttles: number) => {
    const game = gameHistory.find(g => g.id === gameId);
    if (!game) return;

    const oldPlayerIds = game.players.map(p => p.id);
    const oldShuttles = game.shuttlesUsed;
    const oldShuttleCost = game.shuttleCostPerPerson;
    const oldCourtFee = game.courtFeePerPerson || 0;

    const newShuttleCost = newShuttles * shuttlePrice;
    
    setMembers(prev => prev.map(m => {
      let updated = { ...m };
      
      // 1. Refund old players
      if (oldPlayerIds.includes(m.id)) {
        updated.balance -= (oldShuttleCost + oldCourtFee);
        updated.shuttleBalance -= oldShuttleCost;
        updated.courtBalance -= oldCourtFee;
        updated.shuttleCount = Math.max(0, updated.shuttleCount - oldShuttles);
        updated.gamesPlayed = Math.max(0, updated.gamesPlayed - 1);
        updated.totalCourt = Math.max(0, (updated.totalCourt || 0) - oldCourtFee);
        updated.totalShuttle = Math.max(0, (updated.totalShuttle || 0) - oldShuttleCost);
        // Important: if they no longer have any games, reset paidCourtFee
        if (updated.gamesPlayed === 0) updated.paidCourtFee = false;
      }

      // 2. Charge new players
      if (newPlayerIds.includes(m.id)) {
        const chargeField = updated.paidCourtFee ? 0 : courtFeePerPerson;
        updated.balance += (newShuttleCost + chargeField);
        updated.shuttleBalance += newShuttleCost;
        updated.courtBalance += chargeField;
        updated.shuttleCount += newShuttles;
        updated.gamesPlayed += 1;
        updated.paidCourtFee = true;
        updated.totalCourt = (updated.totalCourt || 0) + chargeField;
        updated.totalShuttle = (updated.totalShuttle || 0) + newShuttleCost;
      }

      return updated;
    }));

    setGameHistory(prev => prev.map(g => {
      if (g.id !== gameId) return g;
      const newPlayers = newPlayerIds.map(pid => {
        const p = members.find(px => px.id === pid)!;
        return { id: pid, name: p.name, rank: p.rank };
      });
      return { 
        ...g, 
        players: newPlayers, 
        shuttlesUsed: newShuttles, 
        shuttleCostPerPerson: newShuttleCost,
        courtFeePerPerson: oldCourtFee // Keep old charge status or update? safest to keep logic consistent
      };
    }));
  };

  const addMember = (name: string, rank: Rank) => {
    const existing = members.find(m => m.name.toLowerCase() === name.toLowerCase());

    // Auto-update rank memory when a member is added manually
    setRankMemory(prev => ({ ...prev, [name]: rank }));
    // บันทึกวันเริ่มต้นก๊วนถ้ายังไม่มี
    setSessionStartDate(prev => prev ?? Date.now());

    if (existing) {
      if (existing.status === 'waiting') {
        alert('ผู้เล่นนี้อยู่ในคิวแล้ว!');
        return;
      }
      setMembers(prev => prev.map(m => m.name.toLowerCase() === name.toLowerCase()
        ? { 
            ...m, 
            status: 'waiting', 
            checkInTime: Date.now(), 
            rank,
            balance: 0,
            courtBalance: 0,
            shuttleBalance: 0,
            snackBalance: 0,
            shuttleCount: 0,
            gamesPlayed: 0,
            snackHistory: [],
            paidCourtFee: false,
            totalCourt: 0,
            totalShuttle: 0,
            totalSnack: 0
          }
        : m
      ));
    } else {
      setMembers(prev => [...prev, mkMember(`m-${Date.now()}`, name, rank, 0, prev.length * 1000)]);
    }
    setShowAddMember(false);
  };

  const checkInMember = (memberId: string) => {
    setMembers(prev => prev.map(m => m.id === memberId
      ? { ...m, status: 'waiting', checkInTime: Date.now() }
      : m));
  };

  const removeFromSession = (memberId: string) => {
    if (!confirm('ยืนยันการลบรายชื่อออกจากเซสชันวันนี้?')) return;
    setCourts(prev => prev.map(c => ({ ...c, players: c.players.map(p => p === memberId ? null : p) })));
    setMembers(prev => prev.map(m => m.id === memberId ? {
      ...m,
      status: 'resting',
      gamesPlayed: 0,
      balance: 0,
      courtBalance: 0,
      shuttleBalance: 0,
      shuttleCount: 0,
      snackBalance: 0,
      snackHistory: [],
      paidCourtFee: false
    } : m));
  };

  const pullSessionData = async (date: string) => {
    setIsSyncing(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/session?date=${date}`);
      if (!res.ok) throw new Error('API return error');
      const data = await res.json();
      if (data && data.date) {
        const session: SessionRecord = {
          id: data.id,
          date: data.date,
          membersSnapshot: data.membersSnapshot || [],
          gameHistory: data.gameHistory || [],
          paymentHistory: data.paymentHistory || []
        };
        setSessionHistory(prev => {
          const filtered = prev.filter(s => format(s.date, 'yyyy-MM-dd') !== date);
          return [session, ...filtered];
        });
        setViewingSession(session);
        return session;
      }
    } catch (err) {
      console.error('Pull Session Error:', err);
      alert('ไม่สามารถดึงข้อมูลประวัติจากฐานข้อมูลได้');
    } finally {
      setIsSyncing(false);
    }
  };

  const changePin = async (currentPin: string, newPin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiFetch(`${API_BASE}/api/change-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return { success: true };
      return { success: false, error: data.error || 'เปลี่ยน PIN ไม่สำเร็จ' };
    } catch {
      return { success: false, error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' };
    }
  };

  const logout = () => {
    clearToken();
    setIsAuthenticated(false);
  };

  const seedMockHistory = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(19, 0, 0, 0);

    const mockMembers: Member[] = [
      { id: 'mock-1', name: 'คุณสมชาย (ทดสอบ)', rank: 'S1', gamesPlayed: 4, checkInTime: yesterday.getTime(), status: 'resting', balance: 0, courtBalance: 160, shuttleBalance: 75, snackBalance: 20, shuttleCount: 3, snackHistory: [{ id: 's1', name: 'น้ำเปล่า', price: 20, time: yesterday.getTime() + 100000 }], paidCourtFee: true },
      { id: 'mock-2', name: 'คุณสมศรี (ทดสอบ)', rank: 'P', gamesPlayed: 2, checkInTime: yesterday.getTime(), status: 'resting', balance: 140, courtBalance: 80, shuttleBalance: 50, snackBalance: 10, shuttleCount: 2, snackHistory: [{ id: 's2', name: 'กล้วยทอด', price: 10, time: yesterday.getTime() + 200000 }], paidCourtFee: false }
    ];

    const mockGames: GameRecord[] = [
      { id: 'g-mock-1', courtId: 'c1', courtName: 'คอร์ด 1', playedAt: yesterday.getTime() + 3600000, players: [{ id: 'mock-1', name: 'คุณสมชาย (ทดสอบ)', rank: 'S1' }, { id: 'mock-2', name: 'คุณสมศรี (ทดสอบ)', rank: 'P' }], shuttlesUsed: 2, shuttleCostPerPerson: 25, courtFeePerPerson: 40 }
    ];

    const mockPayments: PaymentRecord[] = [
      { id: 'p-mock-1', memberId: 'mock-1', memberName: 'คุณสมชาย (ทดสอบ)', memberRank: 'S1', amount: 255, timestamp: yesterday.getTime() + 7200000, method: 'Cash', note: '4 เกม' }
    ];

    const newSession: SessionRecord = {
      id: `session-mock-${yesterday.getTime()}`,
      date: yesterday.getTime(),
      membersSnapshot: mockMembers,
      gameHistory: mockGames,
      paymentHistory: mockPayments
    };

    setSessionHistory(prev => [newSession, ...prev]);
    alert('สร้างข้อมูลจำลองของ "เมื่อวาน" เรียบร้อยแล้ว! \nตอนนี้คุณสามารถเลือกวันที่จากเมนูด้านบนเพื่อทดสอบปุ่ม "Sync Now" หรือดูข้อมูลย้อนหลังได้เลยครับ');
  };

  const saveSession = () => {
    if (gameHistory.length === 0 && paymentHistory.length === 0) return;
    // ใช้ sessionStartDate แทน Date.now() เพื่อแก้ปัญหาเลยเที่ยงคืน
    const session: SessionRecord = {
      id: Math.random().toString(36).substr(2, 9),
      date: sessionStartDate || Date.now(),
      gameHistory: [...gameHistory],
      paymentHistory: [...paymentHistory],
      membersSnapshot: [...members]
    };
    setSessionHistory(prev => [session, ...prev]);
  };

  const factoryReset = () => {
    if (!confirm('!!! คำเตือน !!! คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลทั้งหมด? ข้อมูลสมาชิกและประวัติทั้งหมดจะหายไป')) return;
    localStorage.clear();
    location.reload();
  };

  const getWaitingList = useMemo(() => {
    const minW = RANK_WEIGHTS[minRankFilter] || 0;
    const maxW = RANK_WEIGHTS[maxRankFilter] || 15;
    const lower = Math.min(minW, maxW);
    const upper = Math.max(minW, maxW);

    return members
      .filter(m => m.status === 'waiting')
      .filter(m => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return m.name.toLowerCase().includes(query);
      })
      .filter(m => {
        const w = RANK_WEIGHTS[m.rank] || 0;
        return w >= lower && w <= upper;
      })
      .sort((a, b) => a.gamesPlayed !== b.gamesPlayed ? a.gamesPlayed - b.gamesPlayed : a.checkInTime - b.checkInTime);
  }, [members, searchQuery, minRankFilter, maxRankFilter]);
  // ── AUTO MATCH ──────────────────────────────────────────────────────────────
  // กฎ: คนเล่นน้อยลงก่อน | มือเดียวกันได้ ต่างกันได้ไม่เกิน 2 ระดับ | จัดทีมสมดุล
  const autoMatch = (courtId: string) => {
    const court = courts.find(c => c.id === courtId);
    if (!court) return;

    const emptySlotIndices = court.players.map((p, i) => p === null ? i : -1).filter(i => i !== -1);
    if (emptySlotIndices.length === 0) { alert('คอร์ดเต็มแล้ว!'); return; }

    const needed = emptySlotIndices.length;
    const waiting = getWaitingList.filter(m => !court.players.includes(m.id));
    // getWaitingList เรียงตาม gamesPlayed น้อย→มาก อยู่แล้ว

    if (waiting.length < needed) {
      alert(`คนในคิวไม่พอ (ต้องการ ${needed} คน มีแค่ ${waiting.length} คน)`);
      return;
    }

    const getW = (pid: string | null) => {
      if (!pid) return 0;
      const m = members.find(x => x.id === pid);
      return m ? (RANK_WEIGHTS[m.rank] || 0) : 0;
    };

    // ── ถ้าเติมแค่ 1-2 คน: เอาต้นคิวตรงๆ ──────────────────────────────────
    if (needed < 4) {
      const candidates = waiting.slice(0, needed);
      const newPlayers = [...court.players];
      emptySlotIndices.forEach((idx, i) => { newPlayers[idx] = candidates[i].id; });
      setCourts(prev => prev.map(c => c.id === courtId ? { ...c, players: newPlayers } : c));
      setMembers(prev => prev.map(m => candidates.some(c => c.id === m.id) ? { ...m, status: 'playing' } : m));
      return;
    }

    // ── ต้องการ 4 คน: หาชุดที่ดีที่สุดจาก pool ──────────────────────────────
    // pool = 8 คนต้นคิว (เล่นน้อยสุด) เพื่อให้คนเล่นน้อยมีโอกาสสูงได้ลง
    const POOL_SIZE = Math.min(8, waiting.length);
    const pool = waiting.slice(0, POOL_SIZE);

    // combinations C(pool, 4)
    const getCombinations = (arr: typeof pool, k: number): (typeof pool)[] => {
      if (k === 0) return [[]];
      if (arr.length < k) return [];
      const [first, ...rest] = arr;
      return [
        ...getCombinations(rest, k - 1).map(c => [first, ...c]),
        ...getCombinations(rest, k),
      ];
    };
    const combos = getCombinations(pool, 4);

    // ── Scoring (ต่ำ = ดี) ────────────────────────────────────────────────────
    const scoreCombination = (group: typeof pool): number => {
      const weights = group.map(m => getW(m.id));

      // หา team split ที่สมดุลที่สุดใน 3 วิธี
      const splits = [
        Math.abs(weights[0]+weights[1] - weights[2]-weights[3]),
        Math.abs(weights[0]+weights[2] - weights[1]-weights[3]),
        Math.abs(weights[0]+weights[3] - weights[1]-weights[2]),
      ];
      const teamDiff = Math.min(...splits);              // ผลต่างทีม (0=ดี)

      // range ระดับทั้ง 4 คน
      const maxW = Math.max(...weights);
      const minW = Math.min(...weights);
      const rankRange = maxW - minW;
      // ยอมต่างกันได้ 2 ระดับ เกิน 2 โทษหนัก
      const rangePenalty = Math.max(0, rankRange - 2) * 6;

      // โบนัสถ้าใช้ 2 คนต้นคิวจริงๆ (ประกันว่าคนรอนานได้ลง)
      const hasTop2 = group.some(m => m.id === pool[0].id) && group.some(m => m.id === pool[1].id);
      const top2Bonus = hasTop2 ? 0 : 4;

      // penalize คนที่เล่นเยอะเกินกว่าค่าเฉลี่ยใน pool
      const avgGames = pool.reduce((a, m) => a + m.gamesPlayed, 0) / pool.length;
      const gamesPenalty = group.reduce((sum, m) => sum + Math.max(0, m.gamesPlayed - avgGames), 0) * 0.4;

      return teamDiff + rangePenalty + top2Bonus + gamesPenalty;
    };

    let bestCombo = combos[0];
    let bestScore = Infinity;
    for (const combo of combos) {
      const score = scoreCombination(combo);
      if (score < bestScore) { bestScore = score; bestCombo = combo; }
    }

    // จัด team split ที่สมดุลที่สุดสำหรับ bestCombo
    const bw = bestCombo.map(m => ({ id: m.id, w: getW(m.id) }));
    const allSplits = [
      { order: [bw[0].id, bw[1].id, bw[2].id, bw[3].id], diff: Math.abs(bw[0].w+bw[1].w - bw[2].w-bw[3].w) },
      { order: [bw[0].id, bw[2].id, bw[1].id, bw[3].id], diff: Math.abs(bw[0].w+bw[2].w - bw[1].w-bw[3].w) },
      { order: [bw[0].id, bw[3].id, bw[1].id, bw[2].id], diff: Math.abs(bw[0].w+bw[3].w - bw[1].w-bw[2].w) },
    ];
    const finalIds = allSplits.reduce((best, s) => s.diff < best.diff ? s : best).order;

    const newPlayers = [...court.players];
    emptySlotIndices.forEach((idx, i) => { newPlayers[idx] = finalIds[i]; });
    setCourts(prev => prev.map(c => c.id === courtId ? { ...c, players: newPlayers } : c));
    setMembers(prev => prev.map(m => finalIds.includes(m.id) ? { ...m, status: 'playing' } : m));
  };

  // ── START GAME: commit 4 players, auto-count 1 shuttle ────────────────────
  const startGame = (courtId: string) => {
    const court = courts.find(c => c.id === courtId);
    if (!court) return;
    const playerIds = court.players.filter(Boolean) as string[];
    if (playerIds.length !== 4) { alert('ต้องมีผู้เล่นครบ 4 คนพอดี'); return; }
    setCourts(prev => prev.map(c =>
      c.id === courtId ? { ...c, status: 'active' } : c
    ));
  };

  // ── RESET COURT: record game, charge costs, clear ─────────────────────────
  const resetCourt = (courtId: string) => {
    const court = courts.find(c => c.id === courtId);
    if (!court) return;
    const playerIds = court.players.filter(Boolean) as string[];
    // ค่าลูก = ลูก × shuttlePrice ต่อคน (ไม่หาร 4 เพราะ shuttlePrice คือราคาต่อคนอยู่แล้ว)
    const shuttleCostPerPerson = court.shuttlecocks * shuttlePrice;

    const playerSnapshots = playerIds.map(pid => {
      const m = members.find(m => m.id === pid)!;
      return { id: pid, name: m.name, rank: m.rank };
    });
    const gameRec: GameRecord = {
      id: Math.random().toString(36).substr(2, 9),
      courtId, courtName: court.name,
      playedAt: Date.now(),
      players: playerSnapshots,
      shuttlesUsed: court.shuttlecocks,
      shuttleCostPerPerson,
      courtFeePerPerson: 0,
    };

    setMembers(prev => prev.map(m => {
      if (!playerIds.includes(m.id)) return m;
      const courtCharge = m.paidCourtFee ? 0 : courtFeePerPerson;
      return {
        ...m,
        status: 'waiting',
        gamesPlayed: m.gamesPlayed + 1,
        balance: m.balance + shuttleCostPerPerson + courtCharge,
        courtBalance: m.courtBalance + courtCharge,
        shuttleBalance: m.shuttleBalance + shuttleCostPerPerson,
        shuttleCount: m.shuttleCount + court.shuttlecocks,
        paidCourtFee: true,
        checkInTime: Date.now(),
        totalCourt: (m.totalCourt || 0) + courtCharge,
        totalShuttle: (m.totalShuttle || 0) + shuttleCostPerPerson,
      };
    }));

    const clearedCourts = courts.map(c =>
      c.id === courtId ? { ...c, players: [null, null, null, null], status: 'empty' as const, shuttlecocks: 1 } : c
    );
    setCourts(clearedCourts);
    setGameHistory(prev => [gameRec, ...prev]);
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });

    // ตรวจสอบ next queue slot
    const nextSlot = courtQueues[courtId]?.[0];
    if (nextSlot) {
      const emptyCourts = clearedCourts.filter(c => c.status === 'empty');
      setTimeout(() => setNextQueuePrompt({
        courtId,
        courtName: court.name,
        slot: nextSlot,
        emptyCourts,
      }), 400);
    }
  };

  // ── COURT QUEUE MANAGEMENT ──────────────────────────────────────────────────
  const addToCourtQueue = (courtId: string, slot: CourtQueueSlot) => {
    setCourtQueues(prev => ({ ...prev, [courtId]: [...(prev[courtId] || []), slot] }));
  };

  const removeFromCourtQueue = (courtId: string, slotId: string) => {
    setCourtQueues(prev => ({ ...prev, [courtId]: (prev[courtId] || []).filter(s => s.id !== slotId) }));
  };

  const updateCourtQueueSlot = (courtId: string, slot: CourtQueueSlot) => {
    setCourtQueues(prev => ({
      ...prev,
      [courtId]: (prev[courtId] || []).map(s => s.id === slot.id ? slot : s),
    }));
  };

  const moveCourtQueueSlot = (courtId: string, slotId: string, dir: 'up' | 'down') => {
    setCourtQueues(prev => {
      const slots = [...(prev[courtId] || [])];
      const idx = slots.findIndex(s => s.id === slotId);
      if (idx === -1) return prev;
      const next = dir === 'up' ? idx - 1 : idx + 1;
      if (next < 0 || next >= slots.length) return prev;
      [slots[idx], slots[next]] = [slots[next], slots[idx]];
      return { ...prev, [courtId]: slots };
    });
  };

  const confirmNextQueue = (targetCourtId: string, slot: CourtQueueSlot, sourceCourtId: string) => {
    const court = courts.find(c => c.id === targetCourtId);
    if (!court) return;
    const allPlayers = [...slot.teamA, ...slot.teamB];
    const playerIds = allPlayers.map(p => p.memberId).filter(Boolean) as string[];
    const newPlayers: (string | null)[] = [
      slot.teamA[0]?.memberId || null,
      slot.teamA[1]?.memberId || null,
      slot.teamB[0]?.memberId || null,
      slot.teamB[1]?.memberId || null,
    ];
    setCourts(prev => prev.map(c =>
      c.id === targetCourtId ? { ...c, players: newPlayers, status: 'active' } : c
    ));
    setMembers(prev => prev.map(m =>
      playerIds.includes(m.id) ? { ...m, status: 'playing' } : m
    ));
    setCourtQueues(prev => ({
      ...prev,
      [sourceCourtId]: (prev[sourceCourtId] || []).filter(s => s.id !== slot.id),
    }));
    setNextQueuePrompt(null);
  };

  // Next-queue prompt: Esc dismisses, Enter starts at the suggested court (the default action)
  useModalHotkeys({
    onClose: () => setNextQueuePrompt(null),
    onSubmit: () => { if (nextQueuePrompt) confirmNextQueue(nextQueuePrompt.courtId, nextQueuePrompt.slot, nextQueuePrompt.courtId); },
    enabled: !!nextQueuePrompt,
  });

  // ── PLAYER MANAGEMENT ─────────────────────────────────────────────────────
  const removePlayerFromCourt = (courtId: string, slotIndex: number) => {
    const court = courts.find(c => c.id === courtId);
    if (!court) return;
    const pid = court.players[slotIndex];
    if (!pid) return;
    setCourts(prev => prev.map(c => c.id === courtId
      ? { ...c, players: c.players.map((p, i) => i === slotIndex ? null : p) } : c));
    setMembers(prev => prev.map(m => m.id === pid ? { ...m, status: 'waiting' } : m));
  };

  const addPlayerToCourt = (courtId: string, slotIndex: number, playerId: string) => {
    const court = courts.find(c => c.id === courtId);
    if (!court) return;

    // Get the player currently in that slot (if any)
    const oldPlayerId = court.players[slotIndex];

    setCourts(prev => prev.map(c => ({
      ...c,
      players: c.id === courtId
        ? c.players.map((p, i) => i === slotIndex ? playerId : p)
        : c.players.map(p => p === playerId ? null : p),
    })));

    setMembers(prev => prev.map(m => {
      // New player going in
      if (m.id === playerId) return { ...m, status: 'playing' };
      // Old player being kicked out of THIS slot
      if (m.id === oldPlayerId) return { ...m, status: 'waiting' };
      return m;
    }));
  };

  const addSnacksToMember = (memberId: string, addedSnacks: Snack[]) => {
    if (addedSnacks.length === 0) return;
    const totalExtraBalance = addedSnacks.reduce((sum, s) => sum + s.price, 0);
    const historyEntries = addedSnacks.map(s => ({ ...s, time: Date.now() }));

    setMembers(prev => prev.map(m => m.id === memberId ? {
      ...m,
      balance: m.balance + totalExtraBalance,
      snackBalance: m.snackBalance + totalExtraBalance,
      snackHistory: [...(m.snackHistory || []), ...historyEntries],
      totalSnack: (m.totalSnack || 0) + totalExtraBalance
    } : m));
  };

  const addSnackToMember = (memberId: string, snack: Snack) => {
    setMembers(prev => prev.map(m => m.id === memberId
      ? {
        ...m,
        balance: m.balance + snack.price,
        snackBalance: m.snackBalance + snack.price,
        snackHistory: [...m.snackHistory, { ...snack, time: Date.now() }],
        totalSnack: (m.totalSnack || 0) + snack.price
      }
      : m));
  };

  const removeSnackFromMember = (memberId: string, snackItemIndex: number) => {
    setMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      const snackToRemove = m.snackHistory[snackItemIndex];
      if (!snackToRemove) return m;
      const newHistory = [...m.snackHistory];
      newHistory.splice(snackItemIndex, 1);
      return {
        ...m,
        balance: m.balance - snackToRemove.price,
        snackBalance: m.snackBalance - snackToRemove.price,
        snackHistory: newHistory,
        totalSnack: Math.max(0, (m.totalSnack || 0) - snackToRemove.price)
      };
    }));
  };

  const updateSnackPrice = (memberId: string, itemIndex: number, newPrice: number) => {
    setMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      const snack = m.snackHistory[itemIndex];
      if (!snack) return m;
      const diff = newPrice - snack.price;
      const newHistory = [...m.snackHistory];
      newHistory[itemIndex] = { ...snack, price: newPrice };
      return {
        ...m,
        balance: m.balance + diff,
        snackBalance: m.snackBalance + diff,
        snackHistory: newHistory,
        totalSnack: (m.totalSnack || 0) + diff
      };
    }));
  };

  // ── EDIT GAME: ปรับลูกย้อนหลัง (คืนเงินส่วนต่าง/เรียกเก็บเพิ่ม) ──────────────
  const editGame = (gameId: string, newShuttles: number) => {
    const game = gameHistory.find(g => g.id === gameId);
    if (!game || newShuttles < 1) return;
    const oldShuttles = game.shuttlesUsed;
    const shuttleDiff = newShuttles - oldShuttles;
    const delta = shuttleDiff * shuttlePrice;
    const playerIds = game.players.map(p => p.id);
    setMembers(prev => prev.map(m =>
      playerIds.includes(m.id)
        ? {
          ...m,
          balance: m.balance + delta,
          shuttleBalance: m.shuttleBalance + delta,
          shuttleCount: m.shuttleCount + shuttleDiff,
          totalShuttle: (m.totalShuttle || 0) + delta
        }
        : m
    ));
    setGameHistory(prev => prev.map(g =>
      g.id === gameId
        ? { ...g, shuttlesUsed: newShuttles, shuttleCostPerPerson: newShuttles * shuttlePrice }
        : g
    ));
  };

  const updateMemberShuttles = (memberId: string, delta: number) => {
    setMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      const newCount = Math.max(0, m.shuttleCount + delta);
      const actualDelta = newCount - m.shuttleCount;
      const costChange = actualDelta * shuttlePrice;
      return {
        ...m,
        shuttleCount: newCount,
        shuttleBalance: m.shuttleBalance + costChange,
        balance: m.balance + costChange,
        totalShuttle: (m.totalShuttle || 0) + costChange
      };
    }));
  };

  const undoGame = (gameId: string) => {
    const game = gameHistory.find(g => g.id === gameId);
    if (!game) return;
    if (!confirm(`ต้องการยกเลิกเกม "${game.courtName}" เมื่อเวลา ${format(game.playedAt, 'HH:mm')} ใช่หรือไม่?\n(ระบบจะคืนค่าลูกและค่าสนามให้ผู้เล่นทุกคน)`)) return;

    const playerIds = game.players.map(p => p.id);
    const numPlayers = game.players.length;
    const shuttleCost = game.shuttleCostPerPerson;
    const shuttlesPerPerson = game.shuttlesUsed / numPlayers;

    setMembers(prev => prev.map(m => {
      if (!playerIds.includes(m.id)) return m;

      const courtRefund = game.courtFeePerPerson || 0;

      return {
        ...m,
        gamesPlayed: Math.max(0, m.gamesPlayed - 1),
        balance: m.balance - shuttleCost - courtRefund,
        shuttleBalance: m.shuttleBalance - shuttleCost,
        shuttleCount: Math.max(0, m.shuttleCount - shuttlesPerPerson),
        courtBalance: m.courtBalance - courtRefund,
        paidCourtFee: (m.courtBalance - courtRefund) > 0,
        totalShuttle: Math.max(0, (m.totalShuttle || 0) - shuttleCost),
        totalCourt: Math.max(0, (m.totalCourt || 0) - courtRefund)
      };
    }));

    setGameHistory(prev => prev.filter(g => g.id !== gameId));

    // ถ้าคอร์ดว่าง เราอาจจะคืนผู้เล่นลงคอร์ด? 
    // แต่เพื่อความง่าย เราแค่คืนเงินและลบประวัติพอ
  };

  const updateMemberRank = (memberId: string, rank: Rank) => {
    setMembers(prev => prev.map(m => {
      if (m.id === memberId) {
        setRankMemory(prevMem => ({ ...prevMem, [m.name]: rank }));
        return { ...m, rank };
      }
      return m;
    }));
  };

  const updateMemberName = (memberId: string, name: string) => {
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, name } : m));
  };


  const processPayment = (memberId: string, amount: number, method: string = 'Cash', otherMemberIds: string[] = []) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const allMemberIds = [memberId, ...otherMemberIds];
    const otherMembers = members.filter(m => otherMemberIds.includes(m.id));
    const otherNames = otherMembers.map(m => m.name).join(', ');

    // Check if partial
    const totalDebt = member.balance + otherMembers.reduce((sum, m) => sum + m.balance, 0);
    const isFullPayment = amount >= totalDebt;

    const note = otherMemberIds.length > 0
      ? `จ่ายรวม${isFullPayment ? '' : ' (บางส่วน)'}: ${otherNames}`
      : `${member.gamesPlayed} เกม${isFullPayment ? '' : ' (จ่ายบางส่วน)'}`;

    const recordDetails = {
      courtBalance: member.courtBalance + otherMembers.reduce((sum, m) => sum + m.courtBalance, 0),
      shuttleBalance: member.shuttleBalance + otherMembers.reduce((sum, m) => sum + m.shuttleBalance, 0),
      snackHistory: [
        ...member.snackHistory,
        ...otherMembers.flatMap(m => m.snackHistory)
      ]
    };

    const record: PaymentRecord = {
      id: Math.random().toString(36).substr(2, 9),
      memberId,
      memberName: member.name,
      memberRank: member.rank,
      amount,
      timestamp: Date.now(),
      method,
      note,
      details: recordDetails
    };

    setPaymentHistory(prev => [record, ...prev]);

    setMembers(prev => {
      let remainingPayment = amount;
      const next = [...prev];

      for (const id of allMemberIds) {
        const idx = next.findIndex(m => m.id === id);
        if (idx === -1) continue;
        const m = { ...next[idx] };

        if (remainingPayment <= 0) break;

        const debtToClear = Math.min(m.balance, remainingPayment);
        m.balance -= debtToClear;
        remainingPayment -= debtToClear;

        // Track who paid for whom
        if (id !== memberId && debtToClear > 0) {
          m.paidBy = memberId;
          m.paidByName = member.name;
        }

        if (m.balance <= 0) {
          m.balance = 0;
          m.courtBalance = 0;
          m.shuttleBalance = 0;
          m.snackBalance = 0;
          m.snackHistory = [];
          m.shuttleCount = 0;
          m.paidCourtFee = true;
          m.status = 'paid';
        } else {
          // Adjust granular balances down
          let leftToClear = debtToClear;

          const snackClear = Math.min(m.snackBalance, leftToClear);
          m.snackBalance -= snackClear;
          leftToClear -= snackClear;

          const courtClear = Math.min(m.courtBalance, leftToClear);
          m.courtBalance -= courtClear;
          leftToClear -= courtClear;

          const shuttleClear = Math.min(m.shuttleBalance, leftToClear);
          m.shuttleBalance -= shuttleClear;
          leftToClear -= shuttleClear;
        }

        next[idx] = m;
      }
      return next;
    });
  };

  const reOpenSession = (memberId: string) => {
    setMembers(prev => prev.map(m => m.id === memberId
      ? { ...m, status: 'waiting', checkInTime: Date.now() }
      : m));
  };

  const addCourt = (name: string) => {
    setCourts(prev => [...prev, { id: `c${Date.now()}`, name, players: [null, null, null, null], status: 'empty', shuttlecocks: 0 }]);
  };

  const deleteCourt = (courtId: string) => {
    const court = courts.find(c => c.id === courtId);
    const playerIds = (court?.players.filter(Boolean) as string[]) || [];
    if (playerIds.length > 0) setMembers(prev => prev.map(m => playerIds.includes(m.id) ? { ...m, status: 'waiting' } : m));
    setCourts(prev => prev.filter(c => c.id !== courtId));
  };



  const importMembers = (list: { name: string; rank: Rank }[], isSessionImport = false) => {
    // บันทึกวันเริ่มต้นก๊วนถ้ายังไม่มีและเป็น session import
    if (isSessionImport) setSessionStartDate(prev => prev ?? Date.now());
    const status: Member['status'] = isSessionImport ? 'waiting' : 'resting';

    setRankMemory(prev => {
      const next = { ...prev };
      list.forEach(item => { next[item.name] = item.rank; });
      return next;
    });

    setMembers(prev => {
      const now = Date.now();
      const current = [...prev];

      list.forEach((item, i) => {
        const existingIndex = current.findIndex(m => m.name.trim().toLowerCase() === item.name.trim().toLowerCase());
        if (existingIndex !== -1) {
          // Update details and check-in if it's a session import
          current[existingIndex] = {
            ...current[existingIndex],
            rank: item.rank,
            status: isSessionImport ? 'waiting' : current[existingIndex].status,
            checkInTime: isSessionImport ? (now + i) : current[existingIndex].checkInTime,
            ...(isSessionImport ? {
              balance: 0,
              courtBalance: 0,
              shuttleBalance: 0,
              snackBalance: 0,
              shuttleCount: 0,
              gamesPlayed: 0,
              snackHistory: [],
              paidCourtFee: false,
              totalCourt: 0,
              totalShuttle: 0,
              totalSnack: 0
            } : {})
          };
        } else {
          // New member
          current.push({
            id: Math.random().toString(36).substr(2, 9),
            name: item.name,
            rank: item.rank,
            gamesPlayed: 0,
            checkInTime: now + i,
            status: status,
            balance: 0, courtBalance: 0, shuttleBalance: 0, snackBalance: 0,
            shuttleCount: 0,
            snackHistory: [],
            paidCourtFee: false,
            totalCourt: 0, totalShuttle: 0, totalSnack: 0,
          });
        }
      });
      // Sync to cloud removed
      return current;
    });
  };

  const removeMember = (memberId: string) => {
    if (!confirm('ยืนยันการลบสมาชิกออกจากฐานข้อมูลถาวร? (จะหายไปจาก Cloud ด้วย)')) return;
    setCourts(prev => prev.map(c => ({ ...c, players: c.players.map(p => p === memberId ? null : p) })));
    setMembers(prev => {
      const next = prev.filter(m => m.id !== memberId);
      return next;
    });
  };

  const bulkCheckIn = (memberIds: string[]) => {
    setMembers(prev => prev.map(m => memberIds.includes(m.id) ? { ...m, status: 'waiting', checkInTime: Date.now() } : m));
  };

  const bulkRemove = (memberIds: string[]) => {
    if (!confirm(`ยืนยันการลบสมาชิก ${memberIds.length} คนออกจากฐานข้อมูลถาวร? (จะหายไปจาก Cloud ด้วย)`)) return;
    setCourts(prev => prev.map(c => ({ ...c, players: c.players.map(p => memberIds.includes(p as string) ? null : p) })));
    setMembers(prev => {
      const next = prev.filter(m => !memberIds.includes(m.id));
      return next;
    });
  };

  const bulkUpdateRank = (memberIds: string[], rank: Rank) => {
    setMembers(prev => {
      const next = prev.map(m => memberIds.includes(m.id) ? { ...m, rank } : m);
      return next;
    });
    const names = members.filter(m => memberIds.includes(m.id)).map(m => m.name);
    setRankMemory(prev => {
      const next = { ...prev };
      names.forEach(n => next[n] = rank);
      return next;
    });
  };

  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'ภาพรวม' },
    { id: 'courts', icon: Trophy, label: 'คอร์ด' },
    { id: 'logs', icon: History, label: 'บันทึก' },
    { id: 'members', icon: Users, label: 'สมาชิก' },
    { id: 'settings', icon: Settings, label: 'ตั้งค่าระบบ' },
  ];

  if (isQueueView) return <QueueView />;

  if (!isAuthenticated) return (
    <AnimatePresence>
      <LoginScreen
        onLogin={() => setIsAuthenticated(true)}
      />
    </AnimatePresence>
  );

  return (
    <>
      <AnimatePresence>
        {isInitialLoading && <SplashScreen key="splash" />}
      </AnimatePresence>

      {/* Next Queue Prompt Overlay */}
      <AnimatePresence>
        {nextQueuePrompt && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4"
          >
            <motion.div className="absolute inset-0 bg-on-surface/50 backdrop-blur-sm" onClick={() => setNextQueuePrompt(null)} />
            <motion.div
              initial={{ y: 60, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-[2rem] p-6 w-full max-w-md shadow-2xl z-10"
            >
              <div className="text-center mb-5">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl">⏭</span>
                </div>
                <h3 className="font-headline font-black text-2xl">มีคิวถัดไป!</h3>
                <p className="text-sm text-on-surface/50 mt-1">{nextQueuePrompt.courtName}</p>
              </div>

              {/* Players preview */}
              <div className="bg-background rounded-2xl p-4 mb-5">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                  <div className="space-y-1.5">
                    {nextQueuePrompt.slot.teamA.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0', RANK_COLORS[p.rank])}>{p.rank}</span>
                        <span className="font-bold text-sm truncate">{p.name}</span>
                      </div>
                    ))}
                  </div>
                  <span className="text-on-surface/20 font-black text-xs text-center">VS</span>
                  <div className="space-y-1.5">
                    {nextQueuePrompt.slot.teamB.map((p, i) => (
                      <div key={i} className="flex items-center justify-end gap-2">
                        <span className="font-bold text-sm truncate">{p.name}</span>
                        <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0', RANK_COLORS[p.rank])}>{p.rank}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {nextQueuePrompt.slot.note && (
                  <p className="text-xs text-on-surface/40 text-center mt-2 border-t border-on-surface/5 pt-2">{nextQueuePrompt.slot.note}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => confirmNextQueue(nextQueuePrompt.courtId, nextQueuePrompt.slot, nextQueuePrompt.courtId)}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-base shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  เริ่มตีที่{nextQueuePrompt.courtName}เลย
                </button>
                {nextQueuePrompt.emptyCourts.filter(c => c.id !== nextQueuePrompt.courtId).map(c => (
                  <button key={c.id}
                    onClick={() => confirmNextQueue(c.id, nextQueuePrompt.slot, nextQueuePrompt.courtId)}
                    className="w-full bg-secondary/10 text-secondary py-3 rounded-2xl font-bold text-sm hover:bg-secondary/20 transition-all"
                  >
                    ย้ายไปตีที่ {c.name} แทน
                  </button>
                ))}
                <button
                  onClick={() => setNextQueuePrompt(null)}
                  className="w-full py-3 rounded-2xl font-bold text-sm text-on-surface/40 hover:bg-on-surface/5 transition-all"
                >
                  ข้ามไปก่อน
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-background flex flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className={cn(
          "hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-surface-container border-r border-on-surface/8 transition-all duration-300 z-[100]",
          isSidebarCollapsed ? "w-20 p-3" : "w-72 p-5"
        )}>
          <div className={cn("mb-8 flex items-center gap-3.5 transition-all", isSidebarCollapsed ? "justify-center pt-4" : "px-2 pt-6")}>
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white font-black italic text-2xl shadow-lg shadow-primary/25 shrink-0">TJ</div>
            {!isSidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h4 className="font-headline font-black text-xl text-on-surface tracking-tight">เตียเจริญ</h4>
                <p className="text-xs font-semibold text-primary/70">by เน็ตน่ารัก</p>
              </motion.div>
            )}
          </div>

          <nav className="flex-1 space-y-1">
            {tabs.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id as Tab)}
                title={isSidebarCollapsed ? item.label : ""}
                className={cn('w-full flex items-center rounded-xl font-semibold text-[15px] transition-all duration-200',
                  isSidebarCollapsed ? "justify-center p-3.5" : "gap-3.5 px-4 py-3.5",
                  activeTab === item.id ? 'bg-white text-primary shadow-sm translate-x-1' : 'text-on-surface/55 hover:text-on-surface hover:bg-white/60')}>
                <item.icon size={22} className="shrink-0" />
                {!isSidebarCollapsed && <span className="flex-1 text-left">{item.label}</span>}
                {!isSidebarCollapsed && TAB_SHORTCUTS[item.id as Tab] && (
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md border',
                    activeTab === item.id ? 'border-primary/25 text-primary/60' : 'border-on-surface/15 text-on-surface/35')}>
                    {TAB_SHORTCUTS[item.id as Tab]}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-4 border-t border-on-surface/8 space-y-3">
            {!isSidebarCollapsed ? (
              <div className="bg-primary/8 p-4 rounded-2xl">
                <p className="text-xs font-bold text-primary/80 mb-1">รายรับวันนี้</p>
                <p className="text-2xl font-headline font-black text-on-surface">
                  ฿{(members.reduce((a, m) => a + m.balance, 0) + paymentHistory.reduce((a, r) => a + r.amount, 0)).toLocaleString()}
                </p>
              </div>
            ) : (
              <div className="flex justify-center text-primary" title="รายรับวันนี้">
                <Banknote size={22} />
              </div>
            )}

            <button onClick={() => setShowManageProducts(true)}
              title={isSidebarCollapsed ? "จัดการสินค้า" : ""}
              className={cn("w-full flex items-center text-primary/75 font-semibold text-[15px] hover:bg-primary/8 rounded-xl transition-colors",
                isSidebarCollapsed ? "justify-center p-3.5" : "gap-3.5 px-4 py-3")}>
              <ShoppingCart size={20} className="shrink-0" />
              {!isSidebarCollapsed && <span>จัดการสินค้า</span>}
            </button>


            {/* Cloud Status Indicator */}
            <div className="px-4 pb-5">
              <div className="flex items-center gap-2.5">
                <div className="relative flex items-center justify-center shrink-0">
                  <div className={cn("w-3 h-3 rounded-full transition-all duration-500", isSyncing ? "bg-primary animate-pulse scale-110" : "bg-green-500")} />
                  {isSyncing && <div className="absolute inset-0 w-3 h-3 rounded-full bg-primary animate-ping opacity-40" />}
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex flex-col">
                    <span className={cn("text-[11px] font-semibold transition-colors duration-300", isSyncing ? "text-primary" : "text-on-surface/35")}>
                      {isSyncing ? "กำลังซิงค์ข้อมูล..." : "เชื่อมต่อแล้ว"}
                    </span>
                    {lastAutoSave && !isSyncing && (
                      <span className="text-[10px] text-on-surface/25">
                        บันทึกล่าสุด {lastAutoSave.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="w-full flex items-center justify-center p-3 text-on-surface/25 hover:text-on-surface/55 transition-colors rounded-xl hover:bg-white/50"
            >
              {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>
        </aside>

        {/* Main Container */}
        <div className={cn(
          "flex-1 transition-all duration-300",
          isSidebarCollapsed ? "lg:ml-20" : "lg:ml-72"
        )}>
          {/* Modals */}
          <AddMemberModal
            open={showAddMember}
            onClose={() => setShowAddMember(false)}
            onAdd={addMember}
            existingNames={members.map(m => m.name)}
            rankMemory={rankMemory}
          />
          <AddCourtModal open={showAddCourt} onClose={() => setShowAddCourt(false)} onAdd={addCourt} />
          <ManageProductsModal open={showManageProducts} onClose={() => setShowManageProducts(false)} snacks={snacks} onSave={setSnacks} />
          <ImportMembersModal
            open={showImport}
            onClose={() => setShowImport(false)}
            onImport={importMembers}
            rankMemory={rankMemory}
            existingNames={members.map(m => m.name)}
            isSessionMode={importIsSession}
          />

          {/* Main Content Area */}
          <main className="p-4 md:p-6 court-texture pb-24 md:pb-6 md:pt-[4.5rem] lg:pt-6 min-h-screen">
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {activeTab === 'dashboard' && (
                  <DashboardTab 
                    members={members} courts={courts} snacks={snacks} 
                    paymentHistory={paymentHistory} gameHistory={gameHistory}
                    onUpdateRank={updateMemberRank}
                    onRemoveSnack={removeSnackFromMember}
                    onUpdateSnackPrice={updateSnackPrice}
                    viewingSession={viewingSession}
                    onCloseSession={() => setViewingSession(null)}
                    sessionHistory={sessionHistory}
                    onViewSession={(s) => setViewingSession(s)}
                    onProcessPayment={processPayment}
                    onReOpen={reOpenSession}
                    onPullSession={pullSessionData}
                    isSyncing={isSyncing}
                    onAddCourt={() => setShowAddCourt(true)}
                    isSidebarCollapsed={isSidebarCollapsed}
                    onCheckIn={checkInMember}
                    onRemove={removeFromSession}
                    onResetDay={resetDay}
                    onClearBoard={clearBoard}
                    onUpdateGame={updateGame}
                    onAddSnack={addSnacksToMember}
                    onImportLine={() => { setImportIsSession(true); setShowImport(true); }}
                    sessionStartDate={sessionStartDate}
                  />
                )}
                {activeTab === 'logs' && (
                  <LogsTab
                    gameHistory={gameHistory}
                    sessionHistory={sessionHistory}
                    members={members}
                    paymentHistory={paymentHistory}
                    onViewSession={setViewingSession}
                    onActiveTab={setActiveTab}
                    onUpdateGame={updateGame}
                    onPullSession={pullSessionData}
                  />
                )}
                {activeTab === 'members' && (
                  <MembersTab
                    members={members}
                    searchQuery={searchQuery}
                    onSearch={setSearchQuery}
                    onRemove={removeMember}
                    onAddMember={() => { setImportIsSession(false); setShowAddMember(true); }}
                    onImportLine={() => { setImportIsSession(false); setShowImport(true); }}
                    onUpdateRank={updateMemberRank}
                    onUpdateName={updateMemberName}
                    onAddCourt={() => setShowAddCourt(true)}
                    onCheckIn={checkInMember}
                    onBulkCheckIn={bulkCheckIn}
                    onBulkRemove={bulkRemove}
                    onBulkUpdateRank={bulkUpdateRank}
                  />
                )}
                {activeTab === 'courts' && (
                  <CourtsTab
                    members={members} courts={courts} snacks={snacks}
                    searchQuery={searchQuery} gameHistory={gameHistory}
                    onAutoMatch={autoMatch} onStartGame={startGame} onResetCourt={resetCourt}
                    onRemovePlayer={removePlayerFromCourt} onAddPlayer={addPlayerToCourt}
                    onDeleteCourt={deleteCourt} onAddSnack={addSnacksToMember}
                    onEditGame={editGame} onUndoGame={undoGame} onUpdateCourt={setCourts}
                    minRankFilter={minRankFilter} setMinRankFilter={setMinRankFilter}
                    maxRankFilter={maxRankFilter} setMaxRankFilter={setMaxRankFilter}
                    onAddCourt={() => setShowAddCourt(true)}
                    courtQueues={courtQueues}
                    onAddCourtQueue={addToCourtQueue}
                    onRemoveCourtQueue={removeFromCourtQueue}
                    onUpdateCourtQueue={updateCourtQueueSlot}
                    onMoveCourtQueue={moveCourtQueueSlot}
                  />
                )}
                {activeTab === 'settings' && (
                  <SettingsTab
                    courtFeePerPerson={courtFeePerPerson}
                    setCourtFeePerPerson={setCourtFeePerPerson}
                    shuttlePrice={shuttlePrice}
                    setShuttlePrice={setShuttlePrice}
                    onSeedMockHistory={seedMockHistory}
                    onResetDay={resetDay}
                    onFactoryReset={factoryReset}
                    rankMemory={rankMemory}
                    onChangePin={changePin}
                    onLogout={logout}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Tablet Nav — md to lg */}
        <nav className="hidden md:flex lg:hidden fixed top-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-xl border-b border-on-surface/8 shadow-sm h-14 items-center px-4 gap-2">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0 mr-3">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white font-black italic text-sm shadow-md shadow-primary/25">TJ</div>
            <span className="font-headline font-black text-base text-on-surface">เตียเจริญ</span>
          </div>

          {/* Tabs */}
          <div className="flex flex-1 gap-1 overflow-x-auto no-scrollbar">
            {tabs.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id as Tab)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all whitespace-nowrap shrink-0',
                  activeTab === item.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-on-surface/50 hover:text-on-surface hover:bg-on-surface/5'
                )}>
                <item.icon size={17} className="shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button onClick={() => setShowManageProducts(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-on-surface/50 hover:text-primary hover:bg-primary/5 transition-all whitespace-nowrap">
              <ShoppingCart size={17} /> สินค้า
            </button>
            <button onClick={() => { setImportIsSession(false); setShowImport(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-on-surface/50 hover:text-secondary hover:bg-secondary/5 transition-all whitespace-nowrap">
              <FileText size={17} /> นำเข้า
            </button>
            <div className="flex items-center gap-1.5 px-3 py-2">
              <div className={cn('w-2 h-2 rounded-full', isSyncing ? 'bg-primary animate-pulse' : 'bg-green-500')} />
            </div>
          </div>
        </nav>

        {/* Mobile Nav — below md */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl flex justify-around items-center px-2 pb-7 pt-2.5 z-50 border-t border-on-surface/8 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          {tabs.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as Tab)}
              className={cn('flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all',
                activeTab === item.id ? 'text-primary bg-primary/8' : 'text-on-surface/40')}>
              <item.icon size={24} />
              <span className="text-[11px] font-bold">{item.label}</span>
            </button>
          ))}
          <button onClick={() => setShowManageProducts(true)}
            className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all text-on-surface/40">
            <ShoppingCart size={24} />
            <span className="text-[11px] font-bold">สินค้า</span>
          </button>
        </nav>
      </div>
    </>
  );
}

// ── SplashScreen Component ───────────────────────────────────────────────────
function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[1000] bg-on-surface flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background Orbs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-secondary/10 rounded-full blur-[120px]" />

      <div className="relative flex flex-col items-center">
        {/* Animated Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
          className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-white italic text-5xl font-black shadow-[0_0_50px_rgba(var(--primary-rgb),0.4)] mb-8"
        >
          TJ
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center"
        >
          <h1 className="font-headline font-black text-4xl text-white tracking-tighter mb-2">เตียเจริญ</h1>
          <p className="text-xs font-black text-primary uppercase tracking-[0.4em] ml-1">by เน็ตน่ารัก</p>
        </motion.div>

        {/* High-end loading bar */}
        <div className="mt-12 w-48 h-1 bg-white/10 rounded-full overflow-hidden relative">
          <motion.div
            initial={{ left: "-100%" }}
            animate={{ left: "100%" }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-primary to-transparent"
          />
        </div>

        <p className="mt-6 text-xs font-semibold text-white/30 animate-pulse">กำลังเชื่อมต่อระบบ...</p>
      </div>

      {/* Shuttlecock animation */}
      <motion.div
        animate={{
          y: [0, -20, 0],
          rotate: [0, 15, -15, 0]
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-12 text-3xl opacity-10"
      >
        🏸
      </motion.div>
    </motion.div>
  );
}
