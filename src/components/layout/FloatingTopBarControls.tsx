import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Maximize2, 
  Minimize2, 
  Eye, 
  EyeOff, 
  Layers, 
  RefreshCw, 
  Search, 
  Menu, 
  SlidersHorizontal,
  LayoutTemplate,
  RotateCcw,
  Sparkles,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  Expand,
  Shrink,
  Package,
  Keyboard
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../../store';
import { getProductProfileInfo } from '../../utils/productFilters';
import { ViewPresetsManager } from './ViewPresetsManager';
import { SavedLayoutView } from '../../utils/savedLayoutViews';

interface FloatingTopBarControlsProps {
  isHeaderCollapsed: boolean;
  onToggleHeaderCollapse: () => void;
  isProductBarCollapsed: boolean;
  onToggleProductBarCollapse: () => void;
  isSyncBarCollapsed: boolean;
  onToggleSyncBarCollapse: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  sidebarMode: 'full' | 'mini' | 'hidden';
  onChangeSidebarMode: (mode: 'full' | 'mini' | 'hidden') => void;
  onResetAllBars: () => void;
  onOpenSearch?: () => void;
  onApplySavedView?: (view: SavedLayoutView) => void;
}

export function FloatingTopBarControls({
  isHeaderCollapsed,
  onToggleHeaderCollapse,
  isProductBarCollapsed,
  onToggleProductBarCollapse,
  isSyncBarCollapsed,
  onToggleSyncBarCollapse,
  isFocusMode,
  onToggleFocusMode,
  isFullscreen,
  onToggleFullscreen,
  sidebarMode,
  onChangeSidebarMode,
  onResetAllBars,
  onOpenSearch,
  onApplySavedView
}: FloatingTopBarControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { globalProductFilter, inventoryProducts = [], orders = [], syncProgress } = useStore();

  const productProfile = React.useMemo(() => {
    return getProductProfileInfo(globalProductFilter, inventoryProducts, orders);
  }, [globalProductFilter, inventoryProducts, orders]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const anyBarCollapsed = isHeaderCollapsed || isProductBarCollapsed || isSyncBarCollapsed || isFocusMode || isFullscreen || sidebarMode !== 'full';

  // If everything is completely expanded, not in focus mode and not in fullscreen, the normal top header is visible
  if (!isHeaderCollapsed && !isFocusMode && !isFullscreen) {
    return null;
  }

  return (
    <div 
      ref={menuRef} 
      className="fixed top-2 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 animate-in fade-in slide-in-from-top-4 select-none"
      dir="rtl"
    >
      {/* Floating Pill Trigger */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 hover:bg-slate-900 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 transition-all">
        
        {/* Quick Expand Header Button */}
        {isHeaderCollapsed && (
          <button
            type="button"
            onClick={() => {
              onToggleHeaderCollapse();
              toast.success('تم إظهار الشريط العلوي');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            title="إظهار الشريط العلوي (Alt + H)"
            id="floating-expand-header-btn"
          >
            <ChevronDown className="w-4 h-4 animate-bounce" />
            <span className="text-[11px] hidden sm:inline">إظهار الشريط العلوي</span>
          </button>
        )}

        {/* Fullscreen / Fill Mode Quick Toggle */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            isFullscreen 
              ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40' 
              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
          }`}
          title={isFullscreen ? 'إنهاء وضع ملء الشاشة (F11 / Esc)' : 'تفعيل وضع ملء الشاشة (Alt + M)'}
        >
          {isFullscreen ? <Shrink className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
          <span className="text-[11px] hidden md:inline">
            {isFullscreen ? 'إنهاء الملء' : 'وضع الملء'}
          </span>
        </button>

        {/* Sidebar Mini / Full Quick Toggle */}
        <button
          type="button"
          onClick={() => {
            if (sidebarMode === 'hidden') onChangeSidebarMode('mini');
            else if (sidebarMode === 'mini') onChangeSidebarMode('full');
            else onChangeSidebarMode('hidden');
          }}
          className="p-1.5 rounded-xl hover:bg-white/15 text-slate-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
          title={`القائمة الجانبية: ${sidebarMode === 'full' ? 'كاملة' : sidebarMode === 'mini' ? 'مصغرة' : 'مخفية'}`}
        >
          {sidebarMode === 'hidden' ? (
            <PanelRightOpen className="w-4 h-4 text-emerald-400" />
          ) : sidebarMode === 'mini' ? (
            <PanelLeftClose className="w-4 h-4 text-amber-300" />
          ) : (
            <PanelRightClose className="w-4 h-4 text-slate-300" />
          )}
        </button>

        {/* Active Product Mini Pill badge */}
        {!productProfile.isAll && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
            <Package className="w-3 h-3" />
            <span className="max-w-[120px] truncate">{productProfile.productName}</span>
          </div>
        )}

        {/* Menu Options Pill Toggle */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`p-1.5 rounded-xl transition-all cursor-pointer ${
            isOpen ? 'bg-white/25 text-white' : 'hover:bg-white/15 text-slate-300 hover:text-white'
          }`}
          title="خيارات وتخصيص كافة الأشرطة"
          id="floating-bars-menu-trigger"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Dropdown Options */}
      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-80 bg-white text-slate-900 rounded-2xl shadow-2xl border border-gray-200 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
            <div className="flex items-center gap-1.5 text-xs font-black text-gray-800">
              <LayoutTemplate className="w-4 h-4 text-indigo-600" />
              <span>التحكم في الأشرطة ووضع الملء</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onResetAllBars();
                setIsOpen(false);
                toast.success('تمت استعادة إظهار كافة الأشرطة الافتراضية');
              }}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors cursor-pointer"
              title="استعادة إظهار كل الأشرطة"
            >
              <RotateCcw className="w-3 h-3" />
              استعادة الكل
            </button>
          </div>

          {/* Quick Saved Views in Floating Menu */}
          {onApplySavedView && (
            <div className="mb-2 pb-2 border-b border-gray-100">
              <div className="text-[11px] font-bold text-gray-500 mb-1.5">
                الفيوهات والمظاهر المحفوظة:
              </div>
              <ViewPresetsManager
                currentSidebarMode={sidebarMode}
                currentSidebarViewMode="list"
                isHeaderCollapsed={isHeaderCollapsed}
                isProductBarCollapsed={isProductBarCollapsed}
                isSyncBarCollapsed={isSyncBarCollapsed}
                isFocusMode={isFocusMode}
                onApplyView={(v) => {
                  onApplySavedView(v);
                  setIsOpen(false);
                }}
              />
            </div>
          )}

          <div className="space-y-1.5">
            {/* Fullscreen / Fill Mode */}
            <button
              type="button"
              onClick={() => {
                onToggleFullscreen();
              }}
              className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                isFullscreen ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                {isFullscreen ? <Shrink className="w-4 h-4 text-emerald-600" /> : <Expand className="w-4 h-4 text-indigo-600" />}
                <span>وضع ملء الشاشة الكامل (Fill Mode)</span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                isFullscreen ? 'bg-emerald-200 text-emerald-900' : 'bg-gray-100 text-gray-500'
              }`}>
                {isFullscreen ? 'مفعل' : 'معطل'}
              </span>
            </button>

            {/* Toggle Header */}
            <button
              type="button"
              onClick={() => {
                onToggleHeaderCollapse();
              }}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 text-xs font-bold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 text-gray-700">
                <LayoutTemplate className="w-4 h-4 text-indigo-500" />
                <span>الشريط العلوي الرئيسي</span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                !isHeaderCollapsed ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
              }`}>
                {!isHeaderCollapsed ? 'ظاهر' : 'مخفي'}
              </span>
            </button>

            {/* Toggle Product Bar */}
            <button
              type="button"
              onClick={() => {
                onToggleProductBarCollapse();
              }}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 text-xs font-bold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 text-gray-700">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>شريط بروفايل وتصفية المنتج</span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                !isProductBarCollapsed ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
              }`}>
                {!isProductBarCollapsed ? 'ظاهر' : 'مخفي'}
              </span>
            </button>

            {/* Toggle Sync Bar */}
            <button
              type="button"
              onClick={() => {
                onToggleSyncBarCollapse();
              }}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 text-xs font-bold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 text-gray-700">
                <RefreshCw className="w-4 h-4 text-indigo-500" />
                <span>شريط حالة المزامنة التلقائية</span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                !isSyncBarCollapsed ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
              }`}>
                {!isSyncBarCollapsed ? 'ظاهر' : 'مخفي'}
              </span>
            </button>

            {/* Sidebar Modes 3-way selector */}
            <div className="pt-2 border-t border-gray-100">
              <div className="text-[11px] font-bold text-gray-500 mb-1.5 flex items-center justify-between">
                <span>وضع القائمة الجانبية (Sidebar)</span>
                <span className="font-mono text-[10px] text-gray-400">Alt+S</span>
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => onChangeSidebarMode('full')}
                  className={`py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sidebarMode === 'full' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  كاملة
                </button>
                <button
                  type="button"
                  onClick={() => onChangeSidebarMode('mini')}
                  className={`py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sidebarMode === 'mini' ? 'bg-white text-amber-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  أيقونات
                </button>
                <button
                  type="button"
                  onClick={() => onChangeSidebarMode('hidden')}
                  className={`py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sidebarMode === 'hidden' ? 'bg-white text-rose-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  مخفية
                </button>
              </div>
            </div>

            {/* Toggle Focus Mode */}
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  onToggleFocusMode();
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  isFocusMode 
                    ? 'bg-amber-50 text-amber-900 border border-amber-200' 
                    : 'bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border border-indigo-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isFocusMode ? <Minimize2 className="w-4 h-4 text-amber-600" /> : <Maximize2 className="w-4 h-4 text-indigo-600" />}
                  <div className="flex flex-col text-right">
                    <span>{isFocusMode ? 'إنهاء وضع التركيز' : 'وضع التركيز (الشاشة الموسعة)'}</span>
                    <span className="text-[10px] text-gray-500 font-normal">
                      {isFocusMode ? 'استعادة الأشرطة والوضع العادي' : 'إخفاء الأشرطة لتوسيع مساحة العمل'}
                    </span>
                  </div>
                </div>
              </button>
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-400 flex items-center justify-between px-1">
              <span className="flex items-center gap-1"><Keyboard className="w-3 h-3" /> الاختصارات:</span>
              <span className="font-mono">Alt+M (ملء) | Alt+H (علوي) | Alt+S (سايدبار)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

