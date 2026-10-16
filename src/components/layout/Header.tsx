import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  UserCircle, 
  RefreshCw, 
  CheckCheck, 
  AlertTriangle, 
  AlertCircle, 
  X, 
  ExternalLink, 
  Trash2, 
  Eye, 
  EyeOff, 
  Menu, 
  Shield, 
  Headphones, 
  LayoutGrid,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  Layers,
  RotateCcw,
  LayoutTemplate,
  Sparkles,
  Expand,
  Shrink,
  PanelLeftClose,
  PanelRightClose,
  PanelRightOpen,
  Keyboard
} from 'lucide-react';
import { useStore } from '../../store';
import toast from 'react-hot-toast';
import { GlobalOrderSearch } from '../search/GlobalOrderSearch';
import { ViewPresetsManager } from './ViewPresetsManager';
import { SavedLayoutView } from '../../utils/savedLayoutViews';
import { 
  getInventoryNotifications, 
  markNotificationAsRead, 
  markNotificationAsUnread, 
  markAllNotificationsAsRead, 
  clearReadNotifications,
  getReadNotificationIds,
  InventoryNotification 
} from '../../utils/inventoryNotifications';

interface HeaderProps {
  currentView?: any;
  onViewChange?: (view: any) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  sidebarMode?: 'full' | 'mini' | 'hidden';
  onChangeSidebarMode?: (mode: 'full' | 'mini' | 'hidden') => void;
  onOpenAppGrid?: () => void;
  isHeaderCollapsed?: boolean;
  onToggleHeaderCollapse?: () => void;
  isProductBarCollapsed?: boolean;
  onToggleProductBarCollapse?: () => void;
  isSyncBarCollapsed?: boolean;
  onToggleSyncBarCollapse?: () => void;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onResetAllBars?: () => void;
  onApplySavedView?: (view: SavedLayoutView) => void;
}

export function Header({ 
  currentView, 
  onViewChange, 
  isSidebarOpen, 
  onToggleSidebar, 
  sidebarMode = 'full',
  onChangeSidebarMode,
  onOpenAppGrid,
  isHeaderCollapsed = false,
  onToggleHeaderCollapse,
  isProductBarCollapsed = false,
  onToggleProductBarCollapse,
  isSyncBarCollapsed = false,
  onToggleSyncBarCollapse,
  isFocusMode = false,
  onToggleFocusMode,
  isFullscreen = false,
  onToggleFullscreen,
  onResetAllBars,
  onApplySavedView
}: HeaderProps) {
  const { forceSync, syncProgress, salesChannels, inventoryProducts, orders, purchaseInvoices, settings, currentUserProfile } = useStore();
  const isAdmin = currentUserProfile?.role === 'admin';
  const hasWooCommerce = salesChannels.some(c => c.type === 'woocommerce' && c.isActive);

  const [isOpen, setIsOpen] = useState(false);
  const [isBarsMenuOpen, setIsBarsMenuOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'unread' | 'all'>('unread');
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadNotificationIds());

  const popoverRef = useRef<HTMLDivElement>(null);
  const barsMenuRef = useRef<HTMLDivElement>(null);

  // Sync readIds state when popover opens
  useEffect(() => {
    if (isOpen) {
      setReadIds(getReadNotificationIds());
    }
  }, [isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (barsMenuRef.current && !barsMenuRef.current.contains(event.target as Node)) {
        setIsBarsMenuOpen(false);
      }
    };
    if (isOpen || isBarsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isBarsMenuOpen]);

  // Compute current inventory notifications
  const rawNotifications = getInventoryNotifications(inventoryProducts, orders, purchaseInvoices, settings);
  
  const notifications: InventoryNotification[] = rawNotifications.map(n => ({
    ...n,
    isRead: readIds.has(n.id)
  }));

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = markNotificationAsRead(id);
    setReadIds(new Set(updated));
    toast.success('تم تحديد التنبيه كمقروء');
  };

  const handleToggleRead = (id: string, isCurrentlyRead: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isCurrentlyRead) {
      const updated = markNotificationAsUnread(id);
      setReadIds(new Set(updated));
      toast.success('تمت إعادة التنبيه كغير مقروء');
    } else {
      const updated = markNotificationAsRead(id);
      setReadIds(new Set(updated));
      toast.success('تم تحديد التنبيه كمقروء');
    }
  };

  const handleMarkAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    const updated = markAllNotificationsAsRead(allIds);
    setReadIds(new Set(updated));
    toast.success('تم تحديد جميع التنبيهات كمقروءة');
  };

  const handleClearReadHistory = () => {
    const updated = clearReadNotifications();
    setReadIds(new Set(updated));
    toast.success('تمت إعادة إظهار جميع التنبيهات');
  };

  const handleNotificationClick = (notif: InventoryNotification) => {
    if (!notif.isRead) {
      const updated = markNotificationAsRead(notif.id);
      setReadIds(new Set(updated));
    }
    setIsOpen(false);
    if (onViewChange) {
      onViewChange('inventory');
    }
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('filter-inventory', { 
        detail: { searchTerm: notif.productName } 
      }));
    }, 100);
  };

  const handleManualSync = async () => {
    if (!hasWooCommerce) {
      toast.error('لا يوجد قنوات للربط مع WooCommerce مفعلة');
      return;
    }
    if (syncProgress?.isSyncing) {
      toast.error('التحديث جاري بالفعل');
      return;
    }
    try {
      await forceSync();
      toast.success('تم التحديث اليدوي بنجاح');
    } catch (e) {
      toast.error('فشل التحديث اليدوي');
    }
  };

  const displayedNotifications = filterTab === 'unread' 
    ? notifications.filter(n => !n.isRead) 
    : notifications;

  return (
    <header className="h-16 sm:h-[72px] bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-3 sm:px-6 shrink-0 z-20 relative gap-2 sm:gap-4 shadow-sm" dir="rtl">
      
      {/* Sidebar Toggle Button + App Grid Button + Search Bar */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 sm:p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition-all shrink-0 border border-gray-200 hover:border-gray-300 shadow-2xs cursor-pointer"
            title={isSidebarOpen ? "إخفاء القائمة الجانبية" : "إظهار القائمة الجانبية"}
            id="toggle-sidebar-btn"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-gray-800" />
          </button>
        )}

        <button
          onClick={() => {
            if (onOpenAppGrid) {
              onOpenAppGrid();
            } else if (onViewChange) {
              onViewChange('sections');
            }
          }}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs shrink-0 cursor-pointer border ${
            currentView === 'sections'
              ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-300'
              : 'bg-gradient-to-r from-slate-900 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-white border-indigo-900/50'
          }`}
          title="عرض قسم شبكة الأقسام والتطبيقات"
          id="open-app-grid-header-btn"
        >
          <LayoutGrid className="w-4 h-4 text-indigo-300 shrink-0" />
          <span className="hidden md:inline font-bold">أقسام النظام</span>
        </button>

        {/* AI Assistant Quick Header Button */}
        <button
          type="button"
          onClick={() => onViewChange?.('ai_assistant')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs shrink-0 cursor-pointer border ${
            currentView === 'ai_assistant'
              ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white border-indigo-700 ring-2 ring-indigo-300'
              : 'bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 border-indigo-200/80 hover:border-indigo-300'
          }`}
          title="فتح المساعد الذكي (AI)"
          id="open-ai-chat-header-btn"
        >
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 animate-pulse" />
          <span className="hidden md:inline font-bold">المساعد الذكي</span>
        </button>

        <GlobalOrderSearch onViewChange={onViewChange} />
      </div>
      
      {/* Right Header Actions */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {hasWooCommerce && (
          <button 
            onClick={handleManualSync}
            disabled={syncProgress?.isSyncing}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold transition-colors border ${
              syncProgress?.isSyncing ? 'bg-indigo-50 text-indigo-400 border-indigo-100 cursor-not-allowed' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100 cursor-pointer'
            }`}
            title="تحديث المزامنة يدوياً"
          >
            <RefreshCw className={`w-4 h-4 ${syncProgress?.isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">تحديث الطلبيات</span>
          </button>
        )}
        
        <div className="h-6 sm:h-8 w-px bg-gray-200 mx-1 hidden sm:block"></div>
        
        {/* Notifications Bell Dropdown */}
        <div className="relative" ref={popoverRef}>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`relative p-2 rounded-xl transition-all border ${isOpen ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 border-transparent'}`}
            title="الإشعارات والتنبيهات"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-pulse">
                {unreadCount > 9 ? '+9' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Popover Dropdown */}
          {isOpen && (
            <div className="absolute left-0 mt-3 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Dropdown Header */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                    <Bell className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm">الإشعارات والتنبيهات</h3>
                    <p className="text-[11px] text-indigo-200 font-medium">تنبيهات المخزون والعجز</p>
                  </div>
                </div>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllAsRead}
                    className="flex items-center gap-1 text-[11px] font-bold bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-lg text-indigo-100 transition-all border border-white/10"
                    title="تحديد كافة التنبيهات كمقروءة"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />
                    تحديد الكل كمقروء
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2 bg-gray-50/80">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterTab('unread')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                      filterTab === 'unread'
                        ? 'bg-white text-indigo-700 shadow-xs border border-gray-200'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    غير مقروء ({unreadCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                      filterTab === 'all'
                        ? 'bg-white text-indigo-700 shadow-xs border border-gray-200'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    الكل ({notifications.length})
                  </button>
                </div>

                {readIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleClearReadHistory}
                    className="text-[11px] text-gray-400 hover:text-rose-600 font-bold flex items-center gap-1 transition-colors"
                    title="إعادة إظهار التنبيهات المخفية"
                  >
                    <Trash2 className="w-3 h-3" />
                    مسح السجل
                  </button>
                )}
              </div>

              {/* Notifications List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                {displayedNotifications.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-3 border border-emerald-100">
                      <CheckCheck className="w-6 h-6" />
                    </div>
                    <p className="font-black text-sm text-gray-800">لا توجد تنبيهات {filterTab === 'unread' ? 'غير مقروءة' : ''}</p>
                    <p className="text-xs text-gray-400 font-medium mt-1">جميع مستويات المخزون في المدى الطبيعي 🎉</p>
                  </div>
                ) : (
                  displayedNotifications.map((notif) => {
                    const isDeficit = notif.isDeficit;
                    return (
                      <div 
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors relative group ${
                          notif.isRead ? 'bg-white opacity-70 hover:opacity-100' : 'bg-indigo-50/40 hover:bg-indigo-50/80'
                        }`}
                      >
                        {/* Icon */}
                        <div className={`p-2 rounded-2xl shrink-0 mt-0.5 ${
                          isDeficit ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {isDeficit ? <AlertCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                              isDeficit ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {notif.title}
                            </span>
                            {!notif.isRead && (
                              <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                            )}
                          </div>

                          <h4 className="font-black text-xs text-gray-900 mt-1 truncate">
                            {notif.productName}
                          </h4>

                          {notif.lowVariationNames.length > 0 ? (
                            <div className="mt-1.5 space-y-1">
                              {notif.lowVariationNames.map((varName, i) => (
                                <div key={i} className="text-[11px] bg-white/80 border border-gray-200/80 px-2 py-0.5 rounded-lg text-gray-700 font-bold">
                                  {varName}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[11px] font-bold ${isDeficit ? 'text-rose-600' : 'text-amber-700'}`}>
                                المتبقي بالمخزن: {notif.lowestQty}
                              </span>
                              {notif.totalParentReturned > 0 && (
                                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">
                                  الروتور: {notif.totalParentReturned}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="shrink-0 flex items-center gap-1 self-center">
                          <button
                            type="button"
                            onClick={(e) => handleToggleRead(notif.id, notif.isRead, e)}
                            className={`p-1.5 rounded-xl transition-colors ${
                              notif.isRead 
                                ? 'bg-gray-100 hover:bg-indigo-100 text-gray-500 hover:text-indigo-700' 
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700'
                            }`}
                            title={notif.isRead ? "إعادة كغير مقروء" : "تحديد كمقروء"}
                          >
                            <CheckCheck className={`w-4 h-4 ${notif.isRead ? 'opacity-40' : 'opacity-100'}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              {isAdmin && (
                <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      if (onViewChange) onViewChange('inventory');
                    }}
                    className="font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    إدارة المنتجات والمخزون
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] text-gray-400 font-medium">تحديث تلقائي مفعّل</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-gray-200 mx-2"></div>

        {/* Workspace & Display Customization Dropdown */}
        <div className="relative" ref={barsMenuRef}>
          <button
            type="button"
            onClick={() => setIsBarsMenuOpen(!isBarsMenuOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer text-xs font-bold ${
              isBarsMenuOpen || isFocusMode || isFullscreen
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title="تخصيص العرض ومساحة العمل والشاشات"
            id="layout-bars-controls-btn"
          >
            <SlidersHorizontal className={`w-3.5 h-3.5 ${isBarsMenuOpen || isFocusMode || isFullscreen ? 'text-white' : 'text-slate-600'}`} />
            <span className="hidden lg:inline">تخصيص العرض</span>
            {(isFocusMode || isFullscreen) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            )}
          </button>

          {/* Clean Unified Display Controls Dropdown */}
          {isBarsMenuOpen && (
            <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <LayoutTemplate className="w-3.5 h-3.5" />
                  </div>
                  <span>تخصيص مساحة العمل</span>
                </div>
                {onResetAllBars && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetAllBars();
                      setIsBarsMenuOpen(false);
                      toast.success('تمت استعادة إظهار كافة الأشرطة الافتراضية');
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    title="استعادة إظهار كل الأشرطة"
                  >
                    <RotateCcw className="w-3 h-3" />
                    استعادة الافتراضي
                  </button>
                )}
              </div>

              {onApplySavedView && (
                <div className="mb-3 pb-3 border-b border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 mb-2">المظاهر المحفوظة:</div>
                  <ViewPresetsManager
                    currentSidebarMode={sidebarMode}
                    currentSidebarViewMode="list"
                    isHeaderCollapsed={isHeaderCollapsed}
                    isProductBarCollapsed={isProductBarCollapsed}
                    isSyncBarCollapsed={isSyncBarCollapsed}
                    isFocusMode={isFocusMode}
                    onApplyView={(v) => {
                      onApplySavedView(v);
                      setIsBarsMenuOpen(false);
                    }}
                  />
                </div>
              )}

              <div className="space-y-1">
                {/* Fullscreen Toggle in Menu */}
                {onToggleFullscreen && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleFullscreen();
                      setIsBarsMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-slate-700">
                      {isFullscreen ? <Shrink className="w-4 h-4 text-rose-500" /> : <Expand className="w-4 h-4 text-indigo-500" />}
                      <span>{isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة الكامل'}</span>
                    </div>
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                      Alt+M
                    </span>
                  </button>
                )}

                {/* Focus Mode */}
                {onToggleFocusMode && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleFocusMode();
                      setIsBarsMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      isFocusMode ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isFocusMode ? <Minimize2 className="w-4 h-4 text-amber-600" /> : <Maximize2 className="w-4 h-4 text-indigo-500" />}
                      <span>{isFocusMode ? 'إنهاء وضع التركيز' : 'وضع التركيز (توسيع الجدول)'}</span>
                    </div>
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                      Alt+F
                    </span>
                  </button>
                )}

                {/* Collapse Header */}
                {onToggleHeaderCollapse && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleHeaderCollapse();
                      setIsBarsMenuOpen(false);
                      toast.success('تم طي الشريط العلوي - يمكنك إعادته من الزر العائم بالأعلى');
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-slate-700">
                      <LayoutTemplate className="w-4 h-4 text-slate-500" />
                      <span>طي الشريط العلوي</span>
                    </div>
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                      Alt+H
                    </span>
                  </button>
                )}

                {/* Toggle Product Bar */}
                {onToggleProductBarCollapse && (
                  <button
                    type="button"
                    onClick={onToggleProductBarCollapse}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-slate-700">
                      <Layers className="w-4 h-4 text-amber-500" />
                      <span>شريط تصفية المنتجات</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      !isProductBarCollapsed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {!isProductBarCollapsed ? 'ظاهر' : 'مخفي'}
                    </span>
                  </button>
                )}

                {/* Toggle Sync Bar */}
                {onToggleSyncBarCollapse && (
                  <button
                    type="button"
                    onClick={onToggleSyncBarCollapse}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-slate-700">
                      <RefreshCw className="w-4 h-4 text-indigo-500" />
                      <span>شريط حالة المزامنة التلقائية</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      !isSyncBarCollapsed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {!isSyncBarCollapsed ? 'ظاهر' : 'مخفي'}
                    </span>
                  </button>
                )}

                {/* Sidebar Modes Selector */}
                {onChangeSidebarMode && (
                  <div className="pt-2.5 mt-1 border-t border-slate-100">
                    <div className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center justify-between">
                      <span>القائمة الجانبية (Sidebar)</span>
                      <span className="font-mono text-[10px] text-slate-400">Alt+S</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => onChangeSidebarMode('full')}
                        className={`py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          sidebarMode === 'full' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        كاملة
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeSidebarMode('mini')}
                        className={`py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          sidebarMode === 'mini' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        أيقونات
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeSidebarMode('hidden')}
                        className={`py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          sidebarMode === 'hidden' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        مخفية
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div 
          onClick={() => {
            if (isAdmin && onViewChange) onViewChange('users');
          }}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-100 bg-gray-50/80 transition ${
            isAdmin ? 'cursor-pointer hover:bg-purple-50/50 hover:border-purple-200' : ''
          }`}
          title={isAdmin ? 'إدارة المستخدمين والصلاحيات' : 'حساب مؤكد الطلبيات'}
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
            isAdmin 
              ? 'bg-purple-100 text-purple-700' 
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            {(currentUserProfile?.displayName || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="hidden md:flex flex-col text-right">
            <span className="font-extrabold text-[12px] text-gray-800 leading-tight">
              {currentUserProfile?.displayName || 'المستخدم'}
            </span>
            <span className={`text-[10px] font-bold flex items-center gap-0.5 ${
              isAdmin ? 'text-purple-600' : 'text-emerald-600'
            }`}>
              {isAdmin ? (
                <>
                  <Shield className="w-2.5 h-2.5" />
                  مدير النظام
                </>
              ) : (
                <>
                  <Headphones className="w-2.5 h-2.5" />
                  مؤكد طلبات
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

