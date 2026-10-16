import React, { useState, useEffect } from 'react';
import { 
  Bookmark, 
  BookmarkCheck, 
  Plus, 
  Trash2, 
  Check, 
  Sparkles, 
  SlidersHorizontal, 
  Layers, 
  Eye, 
  EyeOff, 
  ChevronDown, 
  ChevronUp, 
  X,
  Palette,
  RotateCcw,
  LayoutTemplate
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  SavedLayoutView, 
  getSavedLayoutViews, 
  saveLayoutViews, 
  getActiveLayoutViewId, 
  setActiveLayoutViewId 
} from '../../utils/savedLayoutViews';
import { useStore } from '../../store';
import { ViewState } from '../../types';

interface ViewPresetsManagerProps {
  currentSidebarMode: 'full' | 'mini' | 'hidden';
  currentSidebarViewMode: 'list' | 'grid';
  isHeaderCollapsed: boolean;
  isProductBarCollapsed: boolean;
  isSyncBarCollapsed: boolean;
  isSectionsCardCollapsed?: boolean;
  isFocusMode: boolean;
  
  onApplyView: (view: SavedLayoutView) => void;
  onToggleSectionsCardCollapse?: () => void;
}

export function ViewPresetsManager({
  currentSidebarMode,
  currentSidebarViewMode,
  isHeaderCollapsed,
  isProductBarCollapsed,
  isSyncBarCollapsed,
  isSectionsCardCollapsed = false,
  isFocusMode,
  onApplyView,
  onToggleSectionsCardCollapse
}: ViewPresetsManagerProps) {
  const [views, setViews] = useState<SavedLayoutView[]>(() => getSavedLayoutViews());
  const [activeViewId, setActiveViewId] = useState<string | null>(() => getActiveLayoutViewId());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [includeProductFilter, setIncludeProductFilter] = useState(true);
  const [includeThemePalette, setIncludeThemePalette] = useState(true);

  const { globalProductFilter, settings } = useStore();

  const handleSelectView = (view: SavedLayoutView) => {
    setActiveViewId(view.id);
    setActiveLayoutViewId(view.id);
    onApplyView(view);
    toast.success(`تم تفعيل مظهر: "${view.name}" ✨`);
  };

  const handleSaveCurrentAsNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newViewName.trim()) {
      toast.error('يرجى إدخال اسم للفيو / المظهر');
      return;
    }

    const newView: SavedLayoutView = {
      id: 'view_' + Date.now(),
      name: newViewName.trim(),
      createdAt: new Date().toISOString(),
      sidebarMode: currentSidebarMode,
      sidebarViewMode: currentSidebarViewMode,
      isHeaderCollapsed,
      isProductBarCollapsed,
      isSyncBarCollapsed,
      isSectionsCardCollapsed,
      isFocusMode,
      globalProductFilter: includeProductFilter ? globalProductFilter : undefined,
      themePalette: includeThemePalette ? settings?.themePalette : undefined,
      defaultLandingView: settings?.defaultLandingView
    };

    const updated = [...views, newView];
    setViews(updated);
    saveLayoutViews(updated);
    setActiveViewId(newView.id);
    setActiveLayoutViewId(newView.id);

    setNewViewName('');
    setIsModalOpen(false);
    toast.success(`تم حفظ المظهر الجديد "${newView.name}" بنجاح! 💾`);
  };

  const handleDeleteView = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`هل أنت متأكد من حذف الفيو "${name}"؟`)) {
      const updated = views.filter(v => v.id !== id);
      setViews(updated);
      saveLayoutViews(updated);
      if (activeViewId === id) {
        setActiveViewId(null);
        setActiveLayoutViewId(null);
      }
      toast.success('تم حذف الفيو بنجاح');
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap" dir="rtl">
      {/* Views Pill Select Dropdown / Buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        

        {views.slice(0, 4).map(v => {
          const isActive = activeViewId === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => handleSelectView(v)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isActive 
                  ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200 ring-1 ring-indigo-200' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-transparent'
              }`}
              title={`تفعيل مظهر: ${v.name}`}
            >
              <span>{v.name}</span>
              {isActive && <Check className="w-3 h-3 text-indigo-600" />}
            </button>
          );
        })}

        {/* Save Current View Button */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all cursor-pointer mr-1"
          title="حفظ إعدادات المظهر الحالية كـ View جديد وتسميته"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>حفظ مظهر جديد</span>
        </button>
      </div>

      {/* Save View Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-5 text-right relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <BookmarkCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900">حفظ إعدادات الواجهة (Save View)</h3>
                <p className="text-xs text-gray-500">احفظ التكوين الحالي للأشرطة والمظهر للتبديل إليه بضغطة زر</p>
              </div>
            </div>

            <form onSubmit={handleSaveCurrentAsNew} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  اسم المظهر / الفيو (View Name):
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="مثال: مظهر العمل السريع، شاشة الجرد، المظهر الليلي المدمج..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 focus:bg-white text-gray-800 text-xs rounded-xl border border-gray-300 focus:border-indigo-500 focus:outline-none transition shadow-2xs font-bold"
                />
              </div>

              {/* What will be saved preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                <div className="font-bold text-gray-800 flex items-center justify-between border-b border-gray-200 pb-1.5">
                  <span>الإعدادات التي سيتم حفظها في هذا المظهر:</span>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                  <div>القائمة الجانبية: <span className="font-bold text-indigo-700">{currentSidebarMode === 'full' ? 'كاملة' : currentSidebarMode === 'mini' ? 'أيقونات مصغرة' : 'مخفية'}</span></div>
                  <div>الشريط العلوي: <span className="font-bold text-indigo-700">{isHeaderCollapsed ? 'منطبق / مخفي' : 'ظاهر'}</span></div>
                  <div>شريط المنتج: <span className="font-bold text-indigo-700">{isProductBarCollapsed ? 'مخفي' : 'ظاهر'}</span></div>
                  <div>شريط المزامنة: <span className="font-bold text-indigo-700">{isSyncBarCollapsed ? 'مخفي' : 'ظاهر'}</span></div>
                  <div>بطاقة الأقسام: <span className="font-bold text-indigo-700">{isSectionsCardCollapsed ? 'منطبقة' : 'موسعة'}</span></div>
                  <div>وضع التركيز: <span className="font-bold text-indigo-700">{isFocusMode ? 'مفعل' : 'معطل'}</span></div>
                </div>

                <div className="pt-2 border-t border-gray-200 space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700">
                    <input
                      type="checkbox"
                      checked={includeProductFilter}
                      onChange={(e) => setIncludeProductFilter(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>تضمين تصفية المنتج الحالية ({globalProductFilter === 'all' ? 'جميع المنتجات' : globalProductFilter})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700">
                    <input
                      type="checkbox"
                      checked={includeThemePalette}
                      onChange={(e) => setIncludeThemePalette(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>تضمين الثيم اللوني النشط ({settings?.themePalette || 'midnight'})</span>
                  </label>
                </div>
              </div>

              {/* Existing Custom Views list with delete option */}
              {views.length > 0 && (
                <div className="pt-1">
                  <div className="text-[11px] font-bold text-gray-500 mb-1.5">الفيوهات المسجلة حالياً:</div>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                    {views.map(v => (
                      <div key={v.id} className="flex items-center justify-between p-1.5 rounded-lg bg-gray-100/70 text-xs">
                        <span className="font-bold text-gray-800">{v.name}</span>
                        <div className="flex items-center gap-1">
                          {activeViewId === v.id && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded">النشط</span>
                          )}
                          {!v.id.startsWith('preset-') && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteView(v.id, v.name, e)}
                              className="text-gray-400 hover:text-rose-600 p-1 transition-colors"
                              title="حذف هذا الفيو"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
                >
                  <BookmarkCheck className="w-4 h-4" />
                  <span>حفظ وتفعيل الآن</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
