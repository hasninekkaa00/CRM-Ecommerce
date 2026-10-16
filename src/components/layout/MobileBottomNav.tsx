import React from 'react';
import { 
   LayoutDashboard, 
   ShoppingCart, 
   Navigation, 
   Package, 
   Layers,
   RotateCcw
 } from 'lucide-react';
import { ViewState } from '../../types';
import { useStore } from '../../store';
import { getDeletedHistory } from '../../utils/undoManager';

interface MobileBottomNavProps {
  currentView: ViewState;
  onViewChange?: (view: ViewState) => void;
  onSelectView?: (view: ViewState) => void;
  onOpenRecovery?: () => void;
  onOpenRecoveryCenter?: () => void;
}

export function MobileBottomNav({
  currentView,
  onViewChange,
  onSelectView,
  onOpenRecovery,
  onOpenRecoveryCenter
}: MobileBottomNavProps) {
  const handleSelect = (view: ViewState) => {
    if (onViewChange) onViewChange(view);
    else if (onSelectView) onSelectView(view);
  };

  const handleOpenRecovery = () => {
    if (onOpenRecovery) onOpenRecovery();
    else if (onOpenRecoveryCenter) onOpenRecoveryCenter();
  };

  const { orders } = useStore();
  const deletedHistory = getDeletedHistory();

  // Pending / Action required orders count
  const pendingOrdersCount = orders.filter(o => !o.status1 || o.status1 === 'جديد' || o.status1 === 'قيد المعالجة').length;
  // Suivi active count (في الطريق)
  const suiviCount = orders.filter(o => o.status1 === 'تم الإرسال' || o.status2 === 'في الطريق').length;

  const navItems: Array<{
    id: ViewState;
    label: string;
    icon: React.ElementType;
    badge?: number;
    badgeColor?: string;
  }> = [
    {
      id: 'dashboard',
      label: 'الرئيسية',
      icon: LayoutDashboard
    },
    {
      id: 'orders',
      label: 'الطلبيات',
      icon: ShoppingCart,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
      badgeColor: 'bg-amber-500 text-white'
    },
    {
      id: 'suivi',
      label: 'السويفي',
      icon: Navigation,
      badge: suiviCount > 0 ? suiviCount : undefined,
      badgeColor: 'bg-indigo-600 text-white'
    },
    {
      id: 'inventory',
      label: 'المخزن',
      icon: Package
    },
    {
      id: 'sections',
      label: 'الأقسام',
      icon: Layers
    }
  ];

  return (
    <nav 
      aria-label="شريط التنقل السفلي للهواتف" 
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-safe-bottom px-2"
      dir="rtl"
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 min-w-[56px] transition-all cursor-pointer select-none active:scale-95 ${
                isActive ? 'text-amber-600 font-black' : 'text-slate-500 font-bold hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <div className={`p-1 rounded-xl transition-all ${
                  isActive ? 'bg-amber-50 shadow-2xs scale-110' : ''
                }`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-amber-600 stroke-[2.5]' : 'text-slate-500 stroke-[1.75]'}`} />
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`absolute -top-1 -left-2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center shadow-xs border border-white ${item.badgeColor || 'bg-rose-500 text-white'}`}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>

              <span className={`text-[10px] tracking-tight mt-0.5 ${isActive ? 'text-amber-700 font-black scale-105' : 'text-slate-500'}`}>
                {item.label}
              </span>

              {isActive && (
                <div className="absolute bottom-1 w-6 h-0.5 bg-amber-500 rounded-full"></div>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
