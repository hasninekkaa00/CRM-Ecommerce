import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bookmark, 
  BookmarkCheck, 
  Plus, 
  Trash2, 
  Check, 
  SlidersHorizontal, 
  Eye, 
  EyeOff, 
  ChevronDown, 
  X, 
  RotateCcw, 
  Star, 
  Edit3, 
  Sparkles,
  Layers,
  Radio,
  Save
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  SavedOrderView, 
  SavedOrderViewFilters, 
  getSavedOrderViews, 
  saveOrderViews, 
  getActiveOrderViewId, 
  setActiveOrderViewId 
} from '../../utils/savedOrderViews';

interface SavedViewsSelectorProps {
  currentFilters: SavedOrderViewFilters;
  onApplyView: (view: SavedOrderView) => void;
  ordersCount?: number;
}

export function SavedViewsSelector({
  currentFilters,
  onApplyView,
  ordersCount
}: SavedViewsSelectorProps) {
  const [views, setViews] = useState<SavedOrderView[]>(() => getSavedOrderViews());
  const [activeViewId, setActiveViewId] = useState<string | null>(() => getActiveOrderViewId());
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [setAsDefaultOnSave, setSetAsDefaultOnSave] = useState(false);

  // Sync state if active view id is changed
  const activeView = useMemo(() => {
    return views.find(v => v.id === activeViewId) || views[0];
  }, [views, activeViewId]);

  // Check if current filters differ from active view filters
  const isModifiedFromActive = useMemo(() => {
    if (!activeView) return false;
    const f = activeView.filters;
    const c = currentFilters;

    const areArraysEqual = (a: string[] = [], b: string[] = []) => {
      if (a.length !== b.length) return false;
      const sortedA = [...a].sort();
      const sortedB = [...b].sort();
      return sortedA.every((val, idx) => val === sortedB[idx]);
    };

    if (f.statusFilter !== c.statusFilter) return true;
    if (f.status2Filter !== c.status2Filter) return true;
    if (f.tagFilter !== c.tagFilter) return true;
    if (f.channelFilter !== c.channelFilter) return true;
    if (f.productFilter !== c.productFilter) return true;
    if (f.dateFilter !== c.dateFilter) return true;
    if (f.confirmedByFilter !== c.confirmedByFilter) return true;
    if (f.deliveryCompanyFilter !== c.deliveryCompanyFilter) return true;
    if (f.deliveryMethodFilter !== c.deliveryMethodFilter) return true;
    if (f.activeFilterTab !== c.activeFilterTab) return true;
    if (f.collapseAllFilters !== c.collapseAllFilters) return true;

    if (!areArraysEqual(f.hiddenStatuses, c.hiddenStatuses)) return true;
    if (!areArraysEqual(f.hiddenStatuses2, c.hiddenStatuses2)) return true;
    if (!areArraysEqual(f.hiddenTags, c.hiddenTags)) return true;
    if (!areArraysEqual(f.hiddenChannels, c.hiddenChannels)) return true;

    return false;
  }, [activeView, currentFilters]);

  const handleSelectView = (view: SavedOrderView) => {
    setActiveViewId(view.id);
    setActiveOrderViewId(view.id);
    onApplyView(view);
    setIsDropdownOpen(false);
    toast.success(`تم تفعيل فيو: "${view.name}" بنجاح ✨`);
  };

  const handleSaveCurrentAsNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newViewName.trim()) {
      toast.error('يرجى كتابة اسم للفيو الجديد');
      return;
    }

    const newId = 'view-custom-' + Date.now();
    const newView: SavedOrderView = {
      id: newId,
      name: newViewName.trim(),
      isBuiltIn: false,
      isDefault: setAsDefaultOnSave,
      createdAt: new Date().toISOString(),
      filters: { ...currentFilters }
    };

    let updatedViews = [...views];
    if (setAsDefaultOnSave) {
      updatedViews = updatedViews.map(v => ({ ...v, isDefault: false }));
    }
    updatedViews.push(newView);

    setViews(updatedViews);
    saveOrderViews(updatedViews);
    setActiveViewId(newId);
    setActiveOrderViewId(newId);

    setNewViewName('');
    setSetAsDefaultOnSave(false);
    setIsSaveModalOpen(false);
    toast.success(`تم حفظ الفيو "${newView.name}" وتفعيله بنجاح! 💾`);
  };

  const handleUpdateCurrentView = () => {
    if (!activeView || activeView.isBuiltIn) {
      setIsSaveModalOpen(true);
      return;
    }

    const updatedViews = views.map(v => {
      if (v.id === activeView.id) {
        return {
          ...v,
          updatedAt: new Date().toISOString(),
          filters: { ...currentFilters }
        };
      }
      return v;
    });

    setViews(updatedViews);
    saveOrderViews(updatedViews);
    toast.success(`تم تحديث الفيو "${activeView.name}" بالفلاتر الحالية! ✅`);
  };

  const handleDeleteView = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`هل أنت متأكد من حذف الفيو "${name}"؟`)) {
      const updatedViews = views.filter(v => v.id !== id);
      setViews(updatedViews);
      saveOrderViews(updatedViews);
      if (activeViewId === id) {
        const fallback = views.find(v => v.id === 'view-all') || updatedViews[0];
        if (fallback) {
          setActiveViewId(fallback.id);
          setActiveOrderViewId(fallback.id);
          onApplyView(fallback);
        }
      }
      toast.success(`تم حذف الفيو "${name}" بنجاح`);
    }
  };

  const handleSetDefaultView = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedViews = views.map(v => ({
      ...v,
      isDefault: v.id === id
    }));
    setViews(updatedViews);
    saveOrderViews(updatedViews);
    toast.success('تم تعيين هذا الفيو كالفيو الافتراضي للصفحة ⭐');
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#saved-views-dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div id="saved-views-dropdown-container" className="relative flex items-center gap-1.5 flex-wrap" dir="rtl">
      {/* Label and Quick View Chips */}
      <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shadow-2xs">
        <span className="text-[10px] font-black text-slate-500 px-1.5 flex items-center gap-1 shrink-0">
          <Bookmark className="w-3 h-3 text-indigo-600" />
          <span>الفيو:</span>
        </span>

        {/* Top 3-4 Quick Views Pills */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none max-w-[280px] sm:max-w-[420px]">
          {views.slice(0, 3).map((v) => {
            const isActive = activeViewId === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSelectView(v)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs font-black'
                    : 'bg-white hover:bg-slate-200/70 text-slate-700 border border-slate-200/80'
                }`}
                title={`تفعيل فيو: ${v.name}`}
              >
                <span>{v.name}</span>
                {isActive && <Check className="w-2.5 h-2.5" />}
              </button>
            );
          })}
        </div>

        {/* Dropdown for More Views */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer whitespace-nowrap ${
              isDropdownOpen || (activeView && !views.slice(0, 3).some(v => v.id === activeView.id))
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="عرض جميع الفيوهات المحفوظة وإدارتها"
          >
            {activeView && !views.slice(0, 3).some(v => v.id === activeView.id) ? (
              <span className="font-black text-indigo-800 max-w-[90px] truncate">{activeView.name}</span>
            ) : (
              <span>المزيد ({views.length})</span>
            )}
            <ChevronDown className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180 text-indigo-600' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-right animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 border-b border-slate-100 flex items-center justify-between text-[11px] font-black text-slate-700">
                <span>الفيوهات المحفوظة ({views.length})</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setIsManageModalOpen(true);
                  }}
                  className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold"
                >
                  إدارة الفيوهات
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
                {views.map((v) => {
                  const isActive = activeViewId === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => handleSelectView(v)}
                      className={`px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isActive ? 'bg-indigo-50/80 text-indigo-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {isActive ? (
                          <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate">{v.name}</span>
                        {v.isDefault && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold">افتراضي</span>
                        )}
                      </div>

                      {!v.isBuiltIn && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteView(v.id, v.name, e)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors shrink-0"
                          title="حذف الفيو"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-1 border-t border-slate-100 px-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setIsSaveModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>حفظ الفيو الحالي كجديد</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save Current View Action Button */}
        <button
          type="button"
          onClick={() => setIsSaveModalOpen(true)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all cursor-pointer mr-0.5"
          title="حفظ الفلاتر الحالية المغلقة والمفتوحة والقنوات كفيو جديد"
        >
          <Plus className="w-3 h-3" />
          <span>حفظ الفيو</span>
        </button>

        {/* Update Current View Button (if modified from active custom view) */}
        {isModifiedFromActive && activeView && !activeView.isBuiltIn && (
          <button
            type="button"
            onClick={handleUpdateCurrentView}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition-all cursor-pointer animate-pulse"
            title="تحديث وحفظ الفلاتر الحالية على هذا الفيو"
          >
            <Save className="w-3 h-3" />
            <span>تحديث الفيو الحالي</span>
          </button>
        )}
      </div>

      {/* Save View Modal Dialog */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 text-right relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsSaveModalOpen(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <BookmarkCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">حفظ فيو الفلاتر (Save Filter View)</h3>
                <p className="text-xs text-slate-500">احفظ كل حالات الفلاتر المفتوحة والمغلقة، القنوات والتاغات لتطبيقها بضغطة واحدة</p>
              </div>
            </div>

            <form onSubmit={handleSaveCurrentAsNew} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم الفيو / التخصيص:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="مثال: طلبيات فيسبوك المؤكدة، متابعة التأكيد، شحن ياليدين..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-slate-800 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-none transition shadow-2xs font-bold"
                />
              </div>

              {/* Real-time Visual Summary of Active Filters to be Saved */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs">
                <div className="font-bold text-slate-800 flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                    <span>الفلاتر التي سيتم حفظها في هذا الفيو بدقة:</span>
                  </span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                    شامل ومطابق 100%
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                  {/* Status 1 */}
                  <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                    <div className="font-bold text-slate-800 mb-1">حالة التأكيد (1):</div>
                    <div>المختارة: <strong className="text-indigo-700">{currentFilters.statusFilter === 'all' ? 'الكل' : currentFilters.statusFilter}</strong></div>
                    <div>المغلقة / المخفية: <strong className="text-rose-600">{currentFilters.hiddenStatuses.length > 0 ? currentFilters.hiddenStatuses.join('، ') : 'لا يوجد'}</strong></div>
                  </div>

                  {/* Status 2 */}
                  <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                    <div className="font-bold text-slate-800 mb-1">حالة الشحن والتجهيز (2):</div>
                    <div>المختارة: <strong className="text-indigo-700">{currentFilters.status2Filter === 'all' ? 'الكل' : currentFilters.status2Filter}</strong></div>
                    <div>المغلقة / المخفية: <strong className="text-rose-600">{currentFilters.hiddenStatuses2.length > 0 ? currentFilters.hiddenStatuses2.join('، ') : 'لا يوجد'}</strong></div>
                  </div>

                  {/* Channels */}
                  <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                    <div className="font-bold text-slate-800 mb-1">قنوات البيع:</div>
                    <div>المختارة: <strong className="text-emerald-700">{currentFilters.channelFilter === 'all' ? 'كل القنوات' : currentFilters.channelFilter}</strong></div>
                    <div>المغلقة / المخفية: <strong className="text-rose-600">{currentFilters.hiddenChannels.length > 0 ? currentFilters.hiddenChannels.join('، ') : 'لا يوجد'}</strong></div>
                  </div>

                  {/* Tags */}
                  <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                    <div className="font-bold text-slate-800 mb-1">الوسوم والتاغات:</div>
                    <div>المختارة: <strong className="text-indigo-700">{currentFilters.tagFilter === 'all' ? 'كل التاغات' : currentFilters.tagFilter === 'none' ? 'بدون تاغ' : currentFilters.tagFilter}</strong></div>
                    <div>المغلقة / المخفية: <strong className="text-rose-600">{currentFilters.hiddenTags.length > 0 ? currentFilters.hiddenTags.join('، ') : 'لا يوجد'}</strong></div>
                  </div>
                </div>

                {/* Additional criteria */}
                <div className="bg-white p-2 rounded-lg border border-slate-200/80 text-[10px] text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                  <div>المنتج: <strong className="text-slate-800">{currentFilters.productFilter === 'all' ? 'كل المنتجات' : currentFilters.productFilter}</strong></div>
                  <div>التاريخ: <strong className="text-slate-800">{currentFilters.dateFilter === 'all' ? 'كل الأوقات' : currentFilters.dateFilter}</strong></div>
                  <div>المؤكد: <strong className="text-slate-800">{currentFilters.confirmedByFilter || 'الكل'}</strong></div>
                  <div>شركة الشحن: <strong className="text-slate-800">{currentFilters.deliveryCompanyFilter || 'الكل'}</strong></div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 pt-1">
                  <input
                    type="checkbox"
                    checked={setAsDefaultOnSave}
                    onChange={(e) => setSetAsDefaultOnSave(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span>تعيين هذا الفيو كالفيو الافتراضي تلقائياً عند فتح الطلبيات ⭐</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
                >
                  <BookmarkCheck className="w-4 h-4" />
                  <span>حفظ واعتماد الفيو الآن</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Views Modal */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 text-right relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsManageModalOpen(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Bookmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">إدارة الفيوهات المحفوظة</h3>
                <p className="text-xs text-slate-500">اختر الفيو الافتراضي أو قم بحذف أو إعادة تسمية الفيوهات</p>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 my-4">
              {views.map((v) => {
                const isActive = activeViewId === v.id;
                return (
                  <div
                    key={v.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${
                      isActive ? 'bg-indigo-50/70 border-indigo-200' : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <button
                        type="button"
                        onClick={(e) => handleSetDefaultView(v.id, e)}
                        className={`p-1 rounded transition-colors ${
                          v.isDefault ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-amber-500'
                        }`}
                        title={v.isDefault ? "الفيو الافتراضي الحالي" : "تعيين كالفيو الافتراضي"}
                      >
                        <Star className={`w-4 h-4 ${v.isDefault ? 'fill-amber-400' : ''}`} />
                      </button>

                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{v.name}</span>
                          {isActive && (
                            <span className="text-[9px] bg-indigo-600 text-white font-bold px-1.5 py-0.2 rounded">النشط</span>
                          )}
                          {v.isBuiltIn && (
                            <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded">أساسي</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {v.filters.statusFilter !== 'all' ? `حالة: ${v.filters.statusFilter}` : 'كل الحالات'}
                          {v.filters.hiddenStatuses.length > 0 && ` • استبعاد: ${v.filters.hiddenStatuses.length}`}
                          {v.filters.channelFilter !== 'all' && ` • قناة: ${v.filters.channelFilter}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectView(v);
                          setIsManageModalOpen(false);
                        }}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 cursor-pointer shadow-2xs"
                      >
                        تطبيق
                      </button>

                      {!v.isBuiltIn && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteView(v.id, v.name, e)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                          title="حذف هذا الفيو"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsManageModalOpen(false);
                  setIsSaveModalOpen(true);
                }}
                className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>حفظ فيو جديد من الفلاتر الحالية</span>
              </button>

              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
