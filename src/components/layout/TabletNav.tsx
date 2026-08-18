import { ShoppingCart, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';
import { tabs, Tab } from '../../lib/navigation';

interface TabletNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  isSyncing: boolean;
  onManageProducts: () => void;
  onImport: () => void;
  clubName: string;
}

/** Top nav bar shown on tablet widths (md to lg), between the mobile bottom nav and the desktop sidebar. */
export function TabletNav({ activeTab, onTabChange, isSyncing, onManageProducts, onImport, clubName }: TabletNavProps) {
  return (
    <nav className="hidden md:flex lg:hidden fixed top-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-xl border-b border-on-surface/8 shadow-sm h-14 items-center px-4 gap-2">
      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0 mr-3">
        <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white font-black italic text-sm shadow-md shadow-primary/25">TJ</div>
        <span className="font-headline font-black text-base text-on-surface truncate max-w-[140px]">{clubName}</span>
      </div>

      {/* Tabs */}
      <div className="flex flex-1 gap-1 overflow-x-auto no-scrollbar">
        {tabs.map(item => (
          <button key={item.id} onClick={() => onTabChange(item.id)}
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
        <button onClick={onManageProducts}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-on-surface/50 hover:text-primary hover:bg-primary/5 transition-all whitespace-nowrap">
          <ShoppingCart size={17} /> สินค้า
        </button>
        <button onClick={onImport}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-on-surface/50 hover:text-secondary hover:bg-secondary/5 transition-all whitespace-nowrap">
          <FileText size={17} /> นำเข้า
        </button>
        <div className="flex items-center gap-1.5 px-3 py-2">
          <div className={cn('w-2 h-2 rounded-full', isSyncing ? 'bg-primary animate-pulse' : 'bg-green-500')} />
        </div>
      </div>
    </nav>
  );
}
