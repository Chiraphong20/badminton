import { motion } from 'motion/react';
import { Banknote, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { tabs, TAB_SHORTCUTS, Tab } from '../../lib/navigation';

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  todayRevenue: number;
  isSyncing: boolean;
  lastAutoSave: Date | null;
  onManageProducts: () => void;
  /** ชื่อก๊วนที่ล็อกอินอยู่ — แอปเดียวรองรับหลายก๊วน จึงต้องโชว์ชื่อก๊วนจริง ไม่ใช่แบรนด์ตายตัว */
  clubName: string;
}

/** Desktop (lg+) fixed left sidebar: logo, tab nav, revenue, sync status, collapse toggle. */
export function Sidebar({
  activeTab, onTabChange, isCollapsed, onToggleCollapse,
  todayRevenue, isSyncing, lastAutoSave, onManageProducts, clubName,
}: SidebarProps) {
  return (
    <aside className={cn(
      "hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-surface-container border-r border-on-surface/8 transition-all duration-300 z-[100]",
      isCollapsed ? "w-20 p-3" : "w-72 p-5"
    )}>
      <div className={cn("mb-8 flex items-center gap-3.5 transition-all", isCollapsed ? "justify-center pt-4" : "px-2 pt-6")}>
        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white font-black italic text-2xl shadow-lg shadow-primary/25 shrink-0">TJ</div>
        {!isCollapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h4 className="font-headline font-black text-xl text-on-surface tracking-tight truncate max-w-[160px]">{clubName}</h4>
            <p className="text-xs font-semibold text-primary/70">SmashPang</p>
          </motion.div>
        )}
      </div>

      <nav className="flex-1 space-y-1">
        {tabs.map(item => (
          <button key={item.id} onClick={() => onTabChange(item.id)}
            title={isCollapsed ? item.label : ""}
            className={cn('w-full flex items-center rounded-xl font-semibold text-[15px] transition-all duration-200',
              isCollapsed ? "justify-center p-3.5" : "gap-3.5 px-4 py-3.5",
              activeTab === item.id ? 'bg-white text-primary shadow-sm translate-x-1' : 'text-on-surface/55 hover:text-on-surface hover:bg-white/60')}>
            <item.icon size={22} className="shrink-0" />
            {!isCollapsed && <span className="flex-1 text-left">{item.label}</span>}
            {!isCollapsed && TAB_SHORTCUTS[item.id] && (
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md border',
                activeTab === item.id ? 'border-primary/25 text-primary/60' : 'border-on-surface/15 text-on-surface/35')}>
                {TAB_SHORTCUTS[item.id]}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t border-on-surface/8 space-y-3">
        {!isCollapsed ? (
          <div className="bg-primary/8 p-4 rounded-2xl">
            <p className="text-xs font-bold text-primary/80 mb-1">รายรับวันนี้</p>
            <p className="text-2xl font-headline font-black text-on-surface">
              ฿{todayRevenue.toLocaleString()}
            </p>
          </div>
        ) : (
          <div className="flex justify-center text-primary" title="รายรับวันนี้">
            <Banknote size={22} />
          </div>
        )}

        <button onClick={onManageProducts}
          title={isCollapsed ? "จัดการสินค้า" : ""}
          className={cn("w-full flex items-center text-primary/75 font-semibold text-[15px] hover:bg-primary/8 rounded-xl transition-colors",
            isCollapsed ? "justify-center p-3.5" : "gap-3.5 px-4 py-3")}>
          <ShoppingCart size={20} className="shrink-0" />
          {!isCollapsed && <span>จัดการสินค้า</span>}
        </button>

        {/* Cloud Status Indicator */}
        <div className="px-4 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center shrink-0">
              <div className={cn("w-3 h-3 rounded-full transition-all duration-500", isSyncing ? "bg-primary animate-pulse scale-110" : "bg-green-500")} />
              {isSyncing && <div className="absolute inset-0 w-3 h-3 rounded-full bg-primary animate-ping opacity-40" />}
            </div>
            {!isCollapsed && (
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
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center p-3 text-on-surface/25 hover:text-on-surface/55 transition-colors rounded-xl hover:bg-white/50"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
    </aside>
  );
}
