import { useState } from 'react';
import { 
  LayoutDashboard, StickyNote, ShoppingCart, Ghost, Megaphone, LogOut, Store, 
  Settings as SettingsIcon, DollarSign, Package, Truck, Contact, 
  BarChart3, Building, Target, Settings2, ArrowUp, ArrowDown, RefreshCw, Check,
  Navigation, List, LayoutGrid, X, PanelRightClose, PanelLeftClose, PanelRightOpen, Receipt, Wallet, Users, Shield, Headphones,
  Layers, Maximize2, Sparkles, Activity, ChevronRight, ChevronLeft, ArrowRightToLine, ArrowLeftToLine, Database
} from 'lucide-react';
import { ViewState } from '../../types';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { useStore } from '../../store';

interface SidebarProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
  isOpen: boolean;
  onClose: () => void;
  isMini?: boolean;
  onToggleMini?: () => void;
  viewMode: 'list' | 'grid';
  onToggleViewMode: (mode: 'list' | 'grid') => void;
  onOpenAppGrid?: () => void;
}

const itemDefinitions: Record<string, { label: string; icon: any }> = {
  dashboard: { label: 'لوحة التحكم', icon: LayoutDashboard },
  ai_assistant: { label: 'المساعد الذكي (AI)', icon: Sparkles },
  sections: { label: 'أقسام النظام', icon: LayoutGrid },
  indicators: { label: 'مؤشرات الأداء', icon: Activity },
  analytics: { label: 'الإحصائيات المتقدمة', icon: BarChart3 },
  orders: { label: 'الطلبيات', icon: ShoppingCart },
  shipped_orders: { label: 'الطلبيات المشحونة', icon: Truck },
  suivi: { label: 'داشبورد سويفي', icon: Navigation },
  confirmers: { label: 'إدارة المؤكدين والتكليف', icon: Headphones },
  inventory: { label: 'إدارة المخزن', icon: Package },
  purchases: { label: 'الموردين والمشتريات', icon: Contact },
  abandoned: { label: 'السلات المتروكة', icon: Ghost },
  shipping: { label: 'شركات التوصيل والشحن', icon: Truck },
  shipping_invoices: { label: 'فواتير التوصيل', icon: DollarSign },
  shipping_bureaus: { label: 'مكاتب شركة الشحن', icon: Building },
  campaigns: { label: 'الحملات الإعلانية', icon: Megaphone },
  profits: { label: 'المالية', icon: DollarSign },
  expenses: { label: 'المصاريف والشركاء', icon: Wallet },
  advanced_simulator: { label: 'محاكي الأرباح', icon: Target },
  channels: { label: 'قنوات البيع', icon: Store },
  users: { label: 'إدارة المستخدمين', icon: Users },
  backup: { label: 'النسخ الاحتياطي والأمان', icon: Database },
  settings: { label: 'الإعدادات', icon: SettingsIcon },
  notes: { label: 'المذكرة', icon: StickyNote },
};

const defaultOrder = [
  'dashboard',
  'ai_assistant',
  'sections',
  'indicators',
  'analytics',
  'orders',
  'shipped_orders',
  'suivi',
  'confirmers',
  'inventory',
  'purchases',
  'abandoned',
  'shipping',
  'shipping_invoices',
  'shipping_bureaus',
  'campaigns',
  'profits',
  'expenses',
  'advanced_simulator',
  'channels',
  'users',
  'backup',
  'notes',
  'settings'
];

const CONFIRMER_ALLOWED_ITEMS = ['orders', 'shipped_orders', 'suivi', 'abandoned', 'sections'];

export function Sidebar({ 
  currentView, 
  onViewChange, 
  isOpen, 
  onClose, 
  isMini = false,
  onToggleMini,
  viewMode, 
  onToggleViewMode,
  onOpenAppGrid 
}: SidebarProps) {
  const { currentUserProfile } = useStore();
  const isConfirmer = currentUserProfile?.role === 'confirmer';

  const [navOrder, setNavOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('sidebar_order');
    let orderList = [...defaultOrder];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter(id => id in itemDefinitions);
          const missing = defaultOrder.filter(id => !filtered.includes(id));
          orderList = [...filtered, ...missing];
        }
      } catch (e) {
        console.error('Failed to parse saved sidebar order:', e);
      }
    }
    return orderList;
  });

  const [isEditingOrder, setIsEditingOrder] = useState(false);

  // Filter items according to role
  const activeNavItems = navOrder.filter(id => {
    if (isConfirmer) {
      return CONFIRMER_ALLOWED_ITEMS.includes(id);
    }
    return true;
  });

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleMove = (index: number, direction: number) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= navOrder.length) return;
    
    const updated = [...navOrder];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    
    setNavOrder(updated);
    localStorage.setItem('sidebar_order', JSON.stringify(updated));
  };

  const handleReset = () => {
    if (window.confirm('هل أنت متأكد من إعادة تعيين ترتيب القائمة إلى الوضع الافتراضي؟')) {
      setNavOrder(defaultOrder);
      localStorage.setItem('sidebar_order', JSON.stringify(defaultOrder));
    }
  };

  const handleItemClick = (id: string) => {
    onViewChange(id as ViewState);
    // Auto-close drawer on small screens
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  // 🔹 Mini Rail Sidebar View (Compact 64px width)
  if (isMini) {
    return (
      <aside 
        className="fixed lg:static top-0 right-0 h-full text-white flex flex-col items-center shrink-0 z-50 transition-all duration-300 shadow-xl w-16 select-none"
        style={{ backgroundColor: 'var(--sidebar-bg)' }}
        dir="rtl"
      >
        {/* Mini Header & Expand Toggle */}
        <div className="p-3 border-b border-white/10 w-full flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onToggleMini}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer shadow-xs group relative"
            title="توسيع القائمة الجانبية (Alt + S)"
          >
            <PanelRightOpen className="w-5 h-5 text-indigo-300 group-hover:text-white" />
            <div className="absolute right-full mr-2 px-2.5 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xl border border-white/20 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              توسيع القائمة الجانبية (Alt+S)
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onOpenAppGrid) onOpenAppGrid();
              else onViewChange('sections');
            }}
            className={`p-2 rounded-xl transition-all cursor-pointer group relative ${
              currentView === 'sections' ? 'bg-indigo-600 text-white' : 'hover:bg-white/10 text-indigo-300'
            }`}
            title="أقسام النظام"
          >
            <LayoutGrid className="w-4 h-4" />
            <div className="absolute right-full mr-2 px-2.5 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xl border border-white/20 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              أقسام وتطبيقات المتجر
            </div>
          </button>
        </div>

        {/* Mini Navigation Items List */}
        <nav className="flex-1 py-3 px-1.5 overflow-y-auto custom-scrollbar space-y-1.5 w-full flex flex-col items-center">
          {activeNavItems.map((id) => {
            const item = itemDefinitions[id];
            if (!item) return null;
            const Icon = item.icon;
            const isActive = currentView === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => handleItemClick(id)}
                className={`p-2.5 rounded-xl transition-all cursor-pointer group relative flex items-center justify-center ${
                  isActive 
                    ? 'bg-white/25 text-white shadow-md scale-105 border border-white/30' 
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
                style={isActive ? { backgroundColor: 'var(--sidebar-active-bg)' } : {}}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {/* Floating Tooltip Label */}
                <div className="absolute right-full mr-3 px-3 py-1.5 bg-slate-900/95 backdrop-blur-md text-white text-xs font-black rounded-xl shadow-2xl border border-white/20 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 whitespace-nowrap z-50 flex items-center gap-2">
                  <span>{item.label}</span>
                  {isActive && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Mini Footer Controls */}
        <div className="p-2.5 border-t border-white/10 w-full flex flex-col items-center gap-2">
          {currentUserProfile && (
            <div 
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer group relative ${
                currentUserProfile.role === 'admin' 
                  ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40' 
                  : 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
              }`}
              title={currentUserProfile.displayName}
            >
              {currentUserProfile.displayName.charAt(0).toUpperCase()}
              <div className="absolute right-full mr-3 px-3 py-1.5 bg-slate-900/95 backdrop-blur-md text-white text-xs font-bold rounded-xl shadow-2xl border border-white/20 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {currentUserProfile.displayName} ({currentUserProfile.role === 'admin' ? 'مدير' : 'مؤكد'})
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-rose-300 hover:bg-white/10 transition-colors cursor-pointer group relative"
            title="إخفاء السايدبار بالكامل"
          >
            <PanelRightClose className="w-4 h-4" />
            <div className="absolute right-full mr-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xl border border-white/20 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              إخفاء القائمة
            </div>
          </button>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
        aria-hidden="true"
      />

      {/* Sidebar Main Drawer Container */}
      <aside 
        className={`fixed lg:static top-0 right-0 h-full text-white flex flex-col shrink-0 z-50 transition-all duration-300 shadow-2xl lg:shadow-none ${
          viewMode === 'grid' ? 'w-72 sm:w-80' : 'w-64 sm:w-60'
        }`}
        style={{ backgroundColor: 'var(--sidebar-bg)' }}
        dir="rtl"
      >
        {/* Sidebar Header & View Mode Selector */}
        <div className="p-3.5 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-black tracking-tight uppercase truncate">E-COM COD Pro</h1>
            <p className="text-[10px] text-gray-400 truncate">نظام إدارة الطلبيات المتكامل</p>
          </div>

          <div className="flex items-center gap-1 shrink-0 bg-white/10 p-1 rounded-xl border border-white/10">
            {/* Mini Rail Toggle */}
            {onToggleMini && (
              <button
                type="button"
                onClick={onToggleMini}
                className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                title="طي إلى شريط أيقونات مصغر (Alt + S)"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}

            {/* View Mode Switches */}
            <button
              onClick={() => onToggleViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'list' 
                  ? 'bg-white text-gray-900 shadow-xs font-bold' 
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
              title="عرض القائمة العمودية"
            >
              <List className="w-4 h-4" />
            </button>

            <button
              onClick={() => onToggleViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid' 
                  ? 'bg-white text-gray-900 shadow-xs font-bold' 
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
              title="عرض الشبكة داخل السايدبار"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                if (onOpenAppGrid) onOpenAppGrid();
                else onViewChange('sections');
                if (window.innerWidth < 1024) onClose();
              }}
              className="p-1.5 rounded-lg transition-all text-indigo-200 hover:text-white hover:bg-indigo-600/50"
              title="عرض قسم أقسام وتطبيقات النظام"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Hide/Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-rose-300 hover:bg-white/10 rounded-lg transition-colors ml-1"
              title="إخفاء القائمة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Full-width Grid Launcher Banner Button */}
        <div className="px-2 pt-2 pb-1">
          <button
            onClick={() => {
              if (onOpenAppGrid) onOpenAppGrid();
              else onViewChange('sections');
              if (window.innerWidth < 1024) onClose();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-xs font-bold shadow-xs group cursor-pointer ${
              currentView === 'sections'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`p-1 rounded-lg transition-colors ${
                currentView === 'sections' ? 'bg-white/20 text-white' : 'bg-indigo-500/40 text-indigo-200 group-hover:bg-indigo-500 group-hover:text-white'
              }`}>
                <LayoutGrid className="w-3.5 h-3.5" />
              </div>
              <span>أقسام وتطبيقات المتجر</span>
            </div>
            <Sparkles className="w-3.5 h-3.5 text-amber-300 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 py-2 px-2 overflow-y-auto custom-scrollbar">
          {viewMode === 'grid' ? (
            /* 🔲 GRID VIEW MODE */
            <div className="grid grid-cols-2 gap-2">
              {activeNavItems.map((id, index) => {
                const item = itemDefinitions[id];
                if (!item) return null;
                const Icon = item.icon;
                const isActive = currentView === id;

                if (isEditingOrder) {
                  return (
                    <div
                      key={id}
                      className="p-2 bg-white/5 border border-white/10 rounded-xl flex flex-col justify-between select-none relative"
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-[10px] font-bold text-gray-200 truncate">{item.label}</span>
                      </div>
                      <div className="flex items-center justify-end gap-1" dir="ltr">
                        <button
                          onClick={() => handleMove(index, -1)}
                          disabled={index === 0}
                          className="p-1 bg-white/10 hover:bg-white/20 rounded disabled:opacity-20 text-white"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMove(index, 1)}
                          disabled={index === activeNavItems.length - 1}
                          className="p-1 bg-white/10 hover:bg-white/20 rounded disabled:opacity-20 text-white"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={id}
                    onClick={() => handleItemClick(id)}
                    className={`p-3 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer relative group ${
                      isActive 
                        ? 'bg-white/20 text-white border-2 border-white/40 shadow-lg scale-102' 
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5'
                    }`}
                    style={isActive ? { backgroundColor: 'var(--sidebar-active-bg)', borderColor: 'var(--primary-light-border)' } : {}}
                  >
                    <div className={`p-2 rounded-xl transition-transform group-hover:scale-110 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-indigo-200'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold leading-snug line-clamp-2">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* 📜 LIST VIEW MODE */
            <div className="space-y-1">
              {activeNavItems.map((id, index) => {
                const item = itemDefinitions[id];
                if (!item) return null;
                const Icon = item.icon;
                const isActive = currentView === id;
                
                if (isEditingOrder) {
                  return (
                    <div
                      key={id}
                      className="w-full flex items-center justify-between px-3 py-1.5 bg-white/5 border-y border-white/5 select-none rounded-lg"
                    >
                      <div className="flex items-center min-w-0">
                        <Icon className="w-4 h-4 ml-2.5 opacity-80 text-amber-400 shrink-0" />
                        <span className="text-[11px] font-bold truncate text-gray-200">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" dir="ltr">
                        <button
                          onClick={() => handleMove(index, -1)}
                          disabled={index === 0}
                          className="p-1 hover:bg-white/10 rounded disabled:opacity-30 text-gray-300 hover:text-white"
                          title="تحريك لأعلى"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMove(index, 1)}
                          disabled={index === activeNavItems.length - 1}
                          className="p-1 hover:bg-white/10 rounded disabled:opacity-30 text-gray-300 hover:text-white"
                          title="تحريك لأسفل"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={id}
                    onClick={() => handleItemClick(id)}
                    className={`w-full flex items-center px-3.5 py-2.5 rounded-xl transition-all text-right cursor-pointer ${
                      isActive 
                        ? 'font-black text-white shadow-md' 
                        : 'hover:bg-white/10 text-gray-300 hover:text-white font-semibold'
                    }`}
                    style={isActive ? { backgroundColor: 'var(--sidebar-active-bg)' } : {}}
                  >
                    <Icon className="w-5 h-5 ml-3 shrink-0" />
                    <span className="text-xs sm:text-sm truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </nav>
        
        {/* Sidebar Footer Controls */}
        <div className="p-3 mt-auto border-t border-white/10 space-y-2.5">
          {/* User Profile Card */}
          {currentUserProfile && (
            <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  currentUserProfile.role === 'admin' 
                    ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40' 
                    : 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                }`}>
                  {currentUserProfile.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {currentUserProfile.displayName}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono truncate" dir="ltr">
                    {currentUserProfile.email}
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                {currentUserProfile.role === 'admin' ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-400/30 text-[10px] font-bold">
                    <Shield className="w-2.5 h-2.5" />
                    مدير
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">
                    <Headphones className="w-2.5 h-2.5" />
                    مؤكد
                  </span>
                )}
              </div>
            </div>
          )}

          {isEditingOrder ? (
            <div className="flex gap-2">
              <button 
                onClick={() => setIsEditingOrder(false)}
                className="flex-1 flex items-center justify-center py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors text-xs font-bold gap-1.5 shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>حفظ الترتيب</span>
              </button>
              <button 
                onClick={handleReset}
                className="flex items-center justify-center p-2 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 rounded-xl transition-colors text-xs font-medium cursor-pointer"
                title="إعادة التعيين للوضع الافتراضي"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsEditingOrder(true)}
              className="w-full flex items-center justify-center py-1.5 px-3 bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 rounded-xl transition-colors text-xs font-bold gap-2 cursor-pointer"
            >
              <Settings2 className="w-4 h-4 text-amber-400" />
              <span>تعديل ترتيب القائمة</span>
            </button>
          )}

          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center py-1.5 px-3 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 rounded-xl transition-colors text-xs font-bold gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
          <div className="flex items-center justify-between pt-1 px-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-[10px] text-gray-400 font-bold">قاعدة البيانات متصلة</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
