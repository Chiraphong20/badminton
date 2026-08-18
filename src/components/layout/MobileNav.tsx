import { ShoppingCart } from 'lucide-react';
import { cn } from '../../lib/utils';
import { tabs, Tab } from '../../lib/navigation';

interface MobileNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onManageProducts: () => void;
}

/** Bottom tab bar shown below md. */
export function MobileNav({ activeTab, onTabChange, onManageProducts }: MobileNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl flex justify-around items-center px-2 pb-7 pt-2.5 z-50 border-t border-on-surface/8 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      {tabs.map(item => (
        <button key={item.id} onClick={() => onTabChange(item.id)}
          className={cn('flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all',
            activeTab === item.id ? 'text-primary bg-primary/8' : 'text-on-surface/40')}>
          <item.icon size={24} />
          <span className="text-[11px] font-bold">{item.label}</span>
        </button>
      ))}
      <button onClick={onManageProducts}
        className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all text-on-surface/40">
        <ShoppingCart size={24} />
        <span className="text-[11px] font-bold">สินค้า</span>
      </button>
    </nav>
  );
}
