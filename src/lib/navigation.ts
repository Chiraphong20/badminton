import { LayoutDashboard, Trophy, History, Users, Settings } from 'lucide-react';

export type Tab = 'dashboard' | 'members' | 'courts' | 'settings' | 'logs';

export const tabs: { id: Tab; icon: typeof LayoutDashboard; label: string }[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'ภาพรวม' },
  { id: 'courts', icon: Trophy, label: 'คอร์ด' },
  { id: 'logs', icon: History, label: 'บันทึก' },
  { id: 'members', icon: Users, label: 'สมาชิก' },
  { id: 'settings', icon: Settings, label: 'ตั้งค่าระบบ' },
];

export const TAB_SHORTCUTS: Partial<Record<Tab, string>> = { dashboard: 'F1', courts: 'F2', logs: 'F3', members: 'F4' };
export const SHORTCUT_TABS: Record<string, Tab> = { F1: 'dashboard', F2: 'courts', F3: 'logs', F4: 'members' };
