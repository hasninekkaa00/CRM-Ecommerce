import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  ArrowRight, 
  Home, 
  Layers, 
  Eye, 
  EyeOff,
  Sparkles,
  LayoutGrid
} from 'lucide-react';
import { ViewState } from '../../types';
import { useStore } from '../../store';
import { ALL_SECTIONS, SectionItem } from './AppSectionsView';
import toast from 'react-hot-toast';

interface AppSectionsCardProps {
  onSelectView: (view: ViewState) => void;
  currentView?: ViewState;
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

export function AppSectionsCard({
  onSelectView,
  currentView,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse: externalOnToggleCollapse
}: AppSectionsCardProps) {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('app_sections_card_collapsed');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;

  const handleToggleCollapse = () => {
    const nextState = !isCollapsed;
    setInternalIsCollapsed(nextState);
    localStorage.setItem('app_sections_card_collapsed', JSON.stringify(nextState));
    if (externalOnToggleCollapse) {
      externalOnToggleCollapse(nextState);
    }
  };

  const { orders = [], currentUserProfile, settings, updateSettings } = useStore();
  const isConfirmer = currentUserProfile?.role === 'confirmer';
  const defaultLanding = settings?.defaultLandingView || 'dashboard';

  // Visible sections filter
  const visibleSections = ALL_SECTIONS.filter(s => !(isConfirmer && s.adminOnly));

  const handleSetDefaultLanding = (viewId: ViewState, sectionName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateSettings({ defaultLandingView: viewId });
    localStorage.setItem('app_default_landing_view', viewId);
    toast.success(`تم تعيين "${sectionName}" كصفحة رئيسية يفتح عليها التطبيق تلقائياً 🏠`);
  };

  return (
    <div 
      className="bg-white rounded-2xl border border-gray-200 shadow-xs mb-4 overflow-hidden transition-all duration-200" 
      dir="rtl"
      id="app-sections-widget-card"
    >
      {/* Header Bar with Toggle Collapse */}
      <div 
        onClick={handleToggleCollapse}
        className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 select-none transition-colors border-b border-gray-100"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-2xs shrink-0">
            <Boxes className="w-4 h-4 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                <span>أقسام وتطبيقات النظام</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {visibleSections.length} قسم
                </span>
              </h2>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {isCollapsed 
                ? 'البطاقة منطبقة — انقر هنا للتوسيع والانتقال السريع' 
                : 'الوصول المباشر والتنقل السريع لجميع أدوات المتجر'}
            </p>
          </div>
        </div>

        {/* Right Controls: Expand All View Button + Collapse Chevron */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectView('sections');
            }}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition"
            title="فتح الشاشة الكاملة للأقسام"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>عرض الشبكة الموسعة</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleCollapse();
            }}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition flex items-center gap-1"
            title={isCollapsed ? 'توسيع البطاقة' : 'طي البطاقة'}
          >
            <span className="text-xs font-bold px-1 hidden md:inline">
              {isCollapsed ? 'توسيع' : 'طي'}
            </span>
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Quick Grid */}
      {!isCollapsed && (
        <div className="p-4 bg-slate-50/50 animate-in slide-in-from-top-2 duration-150">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
            {visibleSections.map(section => {
              const Icon = section.icon;
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
                  id={`card-section-btn-${section.id}`}
                  className={`group relative flex flex-col items-center justify-center text-center p-2.5 rounded-xl border transition-all duration-150 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                    isSelected
                      ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-200 shadow-xs'
                      : isDefaultLanding
                      ? 'bg-amber-50/40 border-amber-300 hover:bg-white hover:border-amber-400 hover:shadow-xs'
                      : 'bg-white hover:bg-white hover:border-gray-300 hover:shadow-xs'
                  }`}
                >
                  {/* Default landing badge/pin */}
                  {isDefaultLanding && (
                    <span className="absolute top-1.5 left-1.5 p-0.5 rounded text-amber-600" title="الصفحة الرئيسية الافتراضية">
                      <Home className="w-3 h-3 fill-amber-500 text-amber-500" />
                    </span>
                  )}

                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 border mb-1.5 ${section.iconBg} ${
                    isSelected ? 'scale-105 shadow-xs' : 'group-hover:scale-105'
                  }`}>
                    <Icon className="w-4 h-4 transition-colors" />
                  </div>

                  {/* Title */}
                  <span className={`text-[11px] font-bold truncate max-w-full leading-tight transition-colors ${
                    isSelected ? 'text-indigo-900 font-black' : 'text-gray-800 group-hover:text-indigo-600'
                  }`}>
                    {section.title}
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
