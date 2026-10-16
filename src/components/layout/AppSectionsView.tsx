import React, { useState, useMemo } from 'react';
import { 
  Activity, Boxes, Search, Eye, EyeOff, Check, Home, LayoutDashboard, ShoppingCart, Ghost, Megaphone, LogOut, Store,
  Settings as SettingsIcon, DollarSign, Package, Truck, Contact,
  BarChart3, Building, Target, Settings2, ArrowUp, ArrowDown, RefreshCw,
  Navigation, List, LayoutGrid, X, PanelRightClose, PanelLeftClose, PanelRightOpen, Receipt, Wallet, Users, Shield, Headphones,
  Layers, Maximize2, Sparkles, ChevronRight, ChevronUp, ChevronDown,  ChevronLeft, ArrowRightToLine, ArrowLeftToLine,
  Database
} from 'lucide-react';
import { ViewState } from '../../types';
import { useStore } from '../../store';
import toast from 'react-hot-toast';

export interface SectionItem {
  id: ViewState;
  title: string;
  category: string;
  icon: any;
  iconBg: string;
  shortDesc: string;
  adminOnly?: boolean;
}

export const CATEGORY_MAP: Record<string, { label: string; icon: any }> = {
  sales: { label: 'المبيعات والطلبيات', icon: ShoppingCart },
  inventory: { label: 'المخزون والمشتريات', icon: Package },
  shipping: { label: 'الشحن والتوصيل', icon: Truck },
  finance: { label: 'المالية والمصاريف', icon: DollarSign },
  team: { label: 'فريق العمل', icon: Users },
  marketing: { label: 'التسويق', icon: Megaphone },
  settings: { label: 'إعدادات النظام', icon: SettingsIcon },
  overview: { label: 'لوحات التحكم', icon: LayoutDashboard },
};

export const ALL_SECTIONS: SectionItem[] = [
  { id: 'ai_assistant', title: 'المساعد الذكي (AI)', category: 'overview', icon: Sparkles, iconBg: 'bg-gradient-to-tr from-indigo-100 to-purple-100 text-indigo-700', shortDesc: 'شات ذكاء اصطناعي شامل لتحليل المبيعات وتنفيذ العمليات' },
  { id: 'indicators', title: 'مؤشرات الأداء', category: 'overview', icon: Activity, iconBg: 'bg-violet-100 text-violet-600', shortDesc: 'لوحة إحصائية شاملة' },
  { id: 'dashboard', title: 'لوحة التحكم', category: 'overview', icon: LayoutDashboard, iconBg: 'bg-indigo-100 text-indigo-600', shortDesc: 'نظرة عامة على أداء المتجر' },
  { id: 'orders', title: 'الطلبيات', category: 'sales', icon: ShoppingCart, iconBg: 'bg-blue-100 text-blue-600', shortDesc: 'إدارة وتتبع طلبيات العملاء' },
  { id: 'shipped_orders', title: 'الطلبيات المشحونة', category: 'sales', icon: Truck, iconBg: 'bg-emerald-100 text-emerald-600', shortDesc: 'متابعة الشحنات والتوصيل' },
  { id: 'inventory', title: 'إدارة المخزن', category: 'inventory', icon: Package, iconBg: 'bg-amber-100 text-amber-600', shortDesc: 'متابعة المنتجات والكميات' },
  { id: 'purchases', title: 'الموردين والمشتريات', category: 'inventory', icon: Contact, iconBg: 'bg-rose-100 text-rose-600', shortDesc: 'إدارة فواتير الشراء والموردين' },
  { id: 'confirmers', title: 'إدارة المؤكدين والتكليف', category: 'team', icon: Headphones, iconBg: 'bg-purple-100 text-purple-600', shortDesc: 'توزيع وتتبع مهام التأكيد' },
  { id: 'suivi', title: 'داشبورد سويفي', category: 'overview', icon: Navigation, iconBg: 'bg-cyan-100 text-cyan-600', shortDesc: 'لوحة متابعة مخصصة' },
  { id: 'abandoned', title: 'السلات المتروكة', category: 'sales', icon: Ghost, iconBg: 'bg-orange-100 text-orange-600', shortDesc: 'استرجاع الطلبات غير المكتملة' },
  { id: 'shipping', title: 'شركات التوصيل والشحن', category: 'shipping', icon: Truck, iconBg: 'bg-teal-100 text-teal-600', shortDesc: 'إدارة حسابات وشركات التوصيل والشحن المباشرة والتلقائية' },
  { id: 'shipping_invoices', title: 'فواتير التوصيل', category: 'shipping', icon: Receipt, iconBg: 'bg-blue-100 text-blue-600', shortDesc: 'متابعة مستحقات شركات الشحن' },
  { id: 'shipping_bureaus', title: 'مكاتب شركة الشحن', category: 'shipping', icon: Building, iconBg: 'bg-slate-100 text-slate-600', shortDesc: 'فروع ومكاتب الشحن' },
  { id: 'campaigns', title: 'الحملات الإعلانية', category: 'marketing', icon: Megaphone, iconBg: 'bg-fuchsia-100 text-fuchsia-600', shortDesc: 'متابعة أداء الإعلانات' },
  { id: 'profits', title: 'المالية', category: 'finance', icon: DollarSign, iconBg: 'bg-emerald-100 text-emerald-600', shortDesc: 'الأرباح والخسائر والمداخيل', adminOnly: true },
  { id: 'expenses', title: 'المصاريف والشركاء', category: 'finance', icon: Wallet, iconBg: 'bg-rose-100 text-rose-600', shortDesc: 'إدارة النفقات وتوزيع الأرباح', adminOnly: true },
  { id: 'advanced_simulator', title: 'محاكي الأرباح', category: 'finance', icon: Target, iconBg: 'bg-indigo-100 text-indigo-600', shortDesc: 'توقع وحساب الأرباح المستقبلية', adminOnly: true },
  { id: 'channels', title: 'قنوات البيع', category: 'settings', icon: Store, iconBg: 'bg-orange-100 text-orange-600', shortDesc: 'ربط وإدارة المتاجر المتعددة', adminOnly: true },
  { id: 'users', title: 'إدارة المستخدمين', category: 'team', icon: Users, iconBg: 'bg-blue-100 text-blue-600', shortDesc: 'الصلاحيات وفرق العمل', adminOnly: true },
  { id: 'settings', title: 'الإعدادات', category: 'settings', icon: SettingsIcon, iconBg: 'bg-slate-100 text-slate-600', shortDesc: 'إعدادات النظام العامة', adminOnly: true },
  { id: 'backup', title: 'النسخ الاحتياطي والأمان', category: 'settings', icon: Database, iconBg: 'bg-emerald-100 text-emerald-600', shortDesc: 'حفظ واسترجاع قاعدة البيانات والتصميم والنسخ التلقائي', adminOnly: true },
  { id: 'sections', title: 'أقسام وتطبيقات النظام', category: 'overview', icon: LayoutGrid, iconBg: 'bg-indigo-100 text-indigo-600', shortDesc: 'تصفح كافة التطبيقات والشاشات' }
];

export function AppSectionsView({ onSelectView, currentView }: { onSelectView: (view: ViewState) => void, currentView?: ViewState }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [groupLayout, setGroupLayout] = useState<'categorized' | 'dense' | 'flat'>('categorized');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const { settings, updateSettings, currentUserProfile } = useStore();
  const defaultLanding = settings?.defaultLandingView || 'dashboard';
  const setDefaultLanding = (view: ViewState) => updateSettings({ defaultLandingView: view });
  const currentUser = currentUserProfile;
  const isAdmin = currentUser?.role === 'admin';
  const isConfirmer = currentUser?.role === 'confirmer';

  const handleSetDefaultLanding = (view: ViewState, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDefaultLanding(view);
    toast.success(`تم تعيين ${title} كصفحة رئيسية افتراضية`);
  };

  const collapseAllCategories = (collapse: boolean) => {
    const newState: Record<string, boolean> = {};
    Object.keys(CATEGORY_MAP).forEach(key => {
      newState[key] = collapse;
    });
    setCollapsedCategories(newState);
  };

  const toggleCategoryCollapse = (categoryKey: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  const filteredSections = useMemo(() => {
    return ALL_SECTIONS.filter(s => {
      if (isConfirmer && s.adminOnly) return false;
      if (selectedCategory !== 'all' && s.category !== selectedCategory) return false;
      return s.title.includes(searchQuery) || s.shortDesc.includes(searchQuery);
    });
  }, [searchQuery, selectedCategory, isConfirmer]);

  const groupedSections = useMemo(() => {
    return Object.entries(CATEGORY_MAP)
      .map(([key, cat]) => {
        const items = filteredSections.filter(s => s.category === key);
        return {
          categoryId: key,
          label: cat.label,
          icon: cat.icon,
          items
        };
      })
      .filter(group => group.items.length > 0); // Only show categories that have items matching search
  }, [filteredSections]);

  const getSectionBadge = (id: string) => {
    // Return empty for now to satisfy the JSX
    return null;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#f4f5f7] p-3 sm:p-5 lg:p-6 overflow-y-auto" dir="rtl" id="app-sections-page">
      
      {/* Top Header & Search Bar Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-gray-200 mb-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Section Title & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
              <Boxes className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-gray-900">
                  أقسام وتطبيقات النظام
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {filteredSections.length} قسم متاح
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                تصفح وانتقل إلى جميع شاشات وأدوات المتجر بنقرة واحدة
              </p>
            </div>
          </div>

          {/* Search Input & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن قسم أو أداة..."
                className="w-full pl-3 pr-9 py-2 bg-gray-50 hover:bg-gray-100/80 focus:bg-white text-gray-800 placeholder-gray-400 text-xs rounded-xl border border-gray-200 focus:border-indigo-500 focus:outline-none transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Layout Toggle */}
              <div className="flex items-center p-1 bg-gray-100 rounded-xl border border-gray-200 shrink-0">
                <button
                  onClick={() => setGroupLayout('categorized')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    groupLayout === 'categorized'
                      ? 'bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  مجموعات
                </button>
                <button
                  onClick={() => setGroupLayout('dense')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    groupLayout === 'dense'
                      ? 'bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  مدمج
                </button>
              </div>

              {/* Expand / Collapse All Categories button (in categorized view) */}
              {groupLayout === 'categorized' && selectedCategory === 'all' && !searchQuery.trim() && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => collapseAllCategories(false)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="توسيع كافة فئات الأقسام"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">توسيع الكل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => collapseAllCategories(true)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="طي كافة فئات الأقسام"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">طي الكل</span>
                  </button>
                </div>
              )}

              {/* Quick Set App Sections Grid as Default Home Button */}
              {defaultLanding === 'sections' ? (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-2xs">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>الافتراضية 🏠</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => handleSetDefaultLanding('sections', 'شبكة الأقسام والتطبيقات', e)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition shadow-2xs cursor-pointer"
                  title="اجعل التطبيق يفتح دائماً على شبكة الأقسام تلقائياً عند التشغيل"
                >
                  <Home className="w-3.5 h-3.5 text-indigo-600" />
                  <span>تعيين كبداية</span>
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Category Filters Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-3 mt-3 border-t border-gray-100 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
            }`}
          >
            جميع الأقسام ({ALL_SECTIONS.filter(s => !(isConfirmer && s.adminOnly)).length})
          </button>
          
          {Object.entries(CATEGORY_MAP).map(([key, cat]) => {
            const CatIcon = cat.icon;
            const count = ALL_SECTIONS.filter(s => s.category === key && !(isConfirmer && s.adminOnly)).length;
            const isSelected = selectedCategory === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                <CatIcon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-gray-200/70 text-gray-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Sections Grid Body */}
      {filteredSections.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-800 mb-1">لم يتم العثور على أي قسم</h3>
          <p className="text-xs text-gray-500 mb-3">جرب البحث بكلمات مختلفة أو إزالة الفلاتر</p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
            className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
          >
            إظهار الكل
          </button>
        </div>
      ) : groupLayout === 'categorized' && selectedCategory === 'all' && !searchQuery.trim() ? (
        
        /* 📂 CATEGORIZED VIEW: Clean categories with compact icons */
        <div className="space-y-4">
          {groupedSections.map(group => {
            const GroupIcon = group.icon;
            const isCatCollapsed = Boolean(collapsedCategories[group.categoryId]);

            return (
              <div key={group.categoryId} className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-xs transition-all">
                
                {/* Category Header with Collapse Toggle */}
                <div 
                  onClick={() => toggleCategoryCollapse(group.categoryId)}
                  className="flex items-center gap-2 pb-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50/80 -mx-2 px-2 rounded-xl transition select-none"
                  title={isCatCollapsed ? 'انقر لتوسيع هذا القسم' : 'انقر لطي هذا القسم'}
                >
                  <div className="p-1.5 rounded-lg bg-gray-100 text-gray-700">
                    <GroupIcon className="w-4 h-4" />
                  </div>
                  <h2 className="text-xs sm:text-sm font-black text-gray-900">
                    {group.label}
                  </h2>
                  <span className="text-[11px] font-bold text-gray-400">
                    ({group.items.length})
                  </span>

                  <div className="mr-auto flex items-center gap-1 text-gray-400 hover:text-indigo-600">
                    <span className="text-[11px] font-bold hidden sm:inline">
                      {isCatCollapsed ? 'مغلق (انقر للتوسيع)' : 'مفتوح'}
                    </span>
                    <div className={`p-1 rounded-md transition-transform duration-200 ${isCatCollapsed ? 'rotate-180' : ''}`}>
                      <ChevronUp className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Compact Icons Matrix spanning full width */}
                {!isCatCollapsed && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2.5 sm:gap-3 mt-3.5 animate-in fade-in duration-200">
                    {group.items.map(section => {
                      const Icon = section.icon;
                      const badgeText = getSectionBadge(section.id);
                      const isSelected = currentView === section.id;
                      const isDefaultLanding = defaultLanding === section.id;

                      return (
                        <div
                          key={section.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectView(section.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectView(section.id);
                            }
                          }}
                          id={`section-btn-${section.id}`}
                          className={`group relative flex flex-col items-center justify-center text-center p-3 rounded-xl border transition-all duration-150 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                            isSelected
                              ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-200 shadow-xs'
                              : isDefaultLanding
                              ? 'bg-amber-50/30 border-amber-300 hover:bg-white hover:border-amber-400 hover:shadow-sm'
                              : 'bg-gray-50/60 hover:bg-white hover:border-gray-300 hover:shadow-sm'
                          }`}
                        >
                          {/* Badge if available */}
                          {badgeText && (
                            <span className="absolute top-1.5 left-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-500 text-white shadow-2xs animate-pulse">
                              {badgeText}
                            </span>
                          )}

                          {/* Set as Default Landing Home Page Button on Hover or Active */}
                          <button
                            type="button"
                            onClick={(e) => handleSetDefaultLanding(section.id, section.title, e)}
                            title={isDefaultLanding ? 'الصفحة الرئيسية الافتراضية للتطبيق' : 'تعيين كصفحة رئيسية تفتح تلقائياً عند تشغيل التطبيق'}
                            className={`absolute top-1.5 right-1.5 p-1 rounded-md transition-all cursor-pointer ${
                              isDefaultLanding
                                ? 'bg-amber-500 text-white shadow-2xs opacity-100'
                                : 'bg-white/90 text-gray-400 hover:text-amber-600 hover:bg-amber-50 border border-gray-200 opacity-0 group-hover:opacity-100 shadow-2xs'
                            }`}
                          >
                            <Home className="w-3 h-3" />
                          </button>

                          {/* Small Icon Container */}
                          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-150 border mb-2 ${section.iconBg} ${
                            isSelected ? 'scale-105 shadow-xs' : 'group-hover:scale-105'
                          }`}>
                            <Icon className="w-4 h-4 sm:w-5 sm:h-5 transition-colors" />
                          </div>

                          {/* Title */}
                          <span className={`text-xs font-bold truncate max-w-full leading-tight transition-colors ${
                            isSelected ? 'text-indigo-900' : 'text-gray-800 group-hover:text-indigo-600'
                          }`}>
                            {section.title}
                          </span>

                          {/* Short Description */}
                          <span className="text-[10px] text-gray-400 font-medium truncate max-w-full mt-0.5 group-hover:text-gray-500">
                            {section.shortDesc}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            );
          })}
        </div>

      ) : (

        /* 🔲 DENSE FULL SCREEN GRID: High density compact icon buttons */
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2.5 sm:gap-3">
            {filteredSections.map(section => {
              const Icon = section.icon;
              const badgeText = getSectionBadge(section.id);
              const isSelected = currentView === section.id;
              const isDefaultLanding = defaultLanding === section.id;

              return (
                <div
                  key={section.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectView(section.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectView(section.id);
                    }
                  }}
                  id={`section-btn-${section.id}`}
                  className={`group relative flex flex-col items-center justify-center text-center p-3 rounded-xl border transition-all duration-150 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-200 shadow-xs'
                      : isDefaultLanding
                      ? 'bg-amber-50/30 border-amber-300 hover:bg-white hover:border-amber-400 hover:shadow-sm'
                      : 'bg-gray-50/60 hover:bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  {badgeText && (
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-500 text-white shadow-2xs animate-pulse">
                      {badgeText}
                    </span>
                  )}

                  {/* Set as Default Landing Home Page Button on Hover or Active */}
                  <button
                    type="button"
                    onClick={(e) => handleSetDefaultLanding(section.id, section.title, e)}
                    title={isDefaultLanding ? 'الصفحة الرئيسية الافتراضية للتطبيق' : 'تعيين كصفحة رئيسية تفتح تلقائياً عند تشغيل التطبيق'}
                    className={`absolute top-1.5 right-1.5 p-1 rounded-md transition-all cursor-pointer ${
                      isDefaultLanding
                        ? 'bg-amber-500 text-white shadow-2xs opacity-100'
                        : 'bg-white/90 text-gray-400 hover:text-amber-600 hover:bg-amber-50 border border-gray-200 opacity-0 group-hover:opacity-100 shadow-2xs'
                    }`}
                  >
                    <Home className="w-3 h-3" />
                  </button>

                  {/* Small Icon Container */}
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-150 border mb-2 ${section.iconBg} ${
                    isSelected ? 'scale-105 shadow-xs' : 'group-hover:scale-105'
                  }`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 transition-colors" />
                  </div>

                  {/* Title */}
                  <span className={`text-xs font-bold truncate max-w-full leading-tight transition-colors ${
                    isSelected ? 'text-indigo-900' : 'text-gray-800 group-hover:text-indigo-600'
                  }`}>
                    {section.title}
                  </span>

                  {/* Short Description */}
                  <span className="text-[10px] text-gray-400 font-medium truncate max-w-full mt-0.5 group-hover:text-gray-500">
                    {section.shortDesc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      )}

    </div>
  );
}
