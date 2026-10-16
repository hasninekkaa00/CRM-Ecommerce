import React, { useMemo } from 'react';
import { Package, Layers, X, Filter, Sparkles, Tag, ShoppingBag, Check, ShieldCheck, Box, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { useStore } from '../../store';
import { renderProductFilterOptions, getProductProfileInfo } from '../../utils/productFilters';

interface ProductProfileBarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ProductProfileBar({ isCollapsed = false, onToggleCollapse }: ProductProfileBarProps) {
  const { globalProductFilter, setGlobalProductFilter, inventoryProducts = [], orders = [] } = useStore();

  const filterOptions = useMemo(() => {
    return renderProductFilterOptions(inventoryProducts, orders);
  }, [inventoryProducts, orders]);

  const profile = useMemo(() => {
    return getProductProfileInfo(globalProductFilter, inventoryProducts, orders);
  }, [globalProductFilter, inventoryProducts, orders]);

  // Collapsed compact mini-bar view
  if (isCollapsed) {
    return (
      <div 
        className="bg-white/90 backdrop-blur-xs border-b border-gray-200/70 px-4 py-1 flex items-center justify-between gap-2 shrink-0 z-10 transition-all text-xs"
        dir="rtl"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 ${
            profile.isAll ? 'bg-indigo-600' : 'bg-amber-600'
          }`}>
            {profile.isAll ? <Layers className="w-3 h-3" /> : <Package className="w-3 h-3" />}
          </div>
          <span className="text-[11px] font-bold text-gray-500 truncate">
            {profile.isAll ? 'تصفية المنتجات:' : 'المنتج النشط:'}
          </span>
          <span className="text-xs font-black text-gray-900 truncate">
            {profile.productName} {profile.variationName ? `(${profile.variationName})` : ''}
          </span>
          {!profile.isAll && profile.stockQty !== null && profile.stockQty !== undefined && (
            <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200 hidden sm:inline">
              المخزون: {profile.stockQty}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!profile.isAll && (
            <button
              onClick={() => setGlobalProductFilter('all')}
              className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-2 py-0.5 rounded transition-colors cursor-pointer"
              title="إلغاء التصفية"
            >
              إلغاء التصفية
            </button>
          )}

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-indigo-600 hover:bg-indigo-50 font-bold text-[11px] transition-colors cursor-pointer"
              title="توسيع شريط بروفايل المنتج"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>توسيع الشريط</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-gray-200/80 px-4 py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 shadow-2xs z-10 transition-all" dir="rtl">
      
      {/* Right Side: Product Profile Badge & Info */}
      <div className="flex items-center gap-3 overflow-hidden min-w-0">
        
        {/* Profile Avatar / Thumbnail */}
        <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs overflow-hidden transition-all ${
          profile.isAll 
            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' 
            : 'bg-gradient-to-br from-amber-500 to-orange-600 text-white ring-2 ring-amber-300/60'
        }`}>
          {profile.imageUrl ? (
            <img 
              src={profile.imageUrl} 
              alt={profile.productName} 
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to icon if image fails to load
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            profile.isAll ? <Layers className="w-5 h-5" /> : <Package className="w-5 h-5" />
          )}

          {!profile.isAll && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" title="بروفايل نشط" />
          )}
        </div>

        {/* Text Info */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1">
              {profile.isAll ? <Sparkles className="w-3 h-3 text-indigo-500" /> : <Filter className="w-3 h-3 text-amber-500" />}
              {profile.isAll ? 'النطاق الشامل' : 'بروفايل المنتج النشط'}
            </span>

            {!profile.isAll && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                profile.type === 'variation' 
                  ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                  : 'bg-amber-100 text-amber-900 border border-amber-200'
              }`}>
                {profile.type === 'variation' ? '🎯 نوع / تفرع محدد' : '📦 منتج كامل (كافة الأنواع)'}
              </span>
            )}

            {profile.sku && (
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-mono font-bold border border-gray-200">
                SKU: {profile.sku}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 font-black text-xs text-gray-900 truncate mt-0.5">
            <span className="truncate">{profile.productName}</span>
            {profile.variationName && (
              <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 text-[11px] font-bold">
                ({profile.variationName})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Middle/Left Side: Quick Stats & Selector Dropdown & Collapse Button */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        
        {/* Active Profile Stats Pills */}
        {!profile.isAll && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-bold">
            {profile.matchedOrdersCount !== undefined && (
              <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 flex items-center gap-1 shadow-2xs">
                <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500" />
                الطلبيات: <strong className="font-mono text-indigo-900">{profile.matchedOrdersCount}</strong>
              </span>
            )}

            {profile.stockQty !== null && profile.stockQty !== undefined && (
              <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border flex items-center gap-1 shadow-2xs ${
                profile.stockQty > 5 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                <Box className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                المخزون: <strong className="font-mono">{profile.stockQty} قطعة</strong>
              </span>
            )}

            {profile.price && (
              <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 flex items-center gap-1 shadow-2xs hidden sm:inline-flex">
                السعر: <strong className="font-mono">{profile.price} د.ج</strong>
              </span>
            )}

            <button
              onClick={() => setGlobalProductFilter('all')}
              className="px-2 py-0.5 sm:py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] sm:text-[11px] font-bold border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
              title="إلغاء التصفية وإظهار كافة المنتجات"
            >
              <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>إلغاء التصفية</span>
            </button>
          </div>
        )}

        {/* Selector Box */}
        <div className="relative flex items-center min-w-[200px] sm:min-w-[240px]">
          <select
            value={globalProductFilter || 'all'}
            onChange={(e) => setGlobalProductFilter(e.target.value)}
            className={`w-full text-xs font-black py-2 pr-8 pl-3 rounded-xl border transition-all cursor-pointer outline-none shadow-2xs ${
              profile.isAll 
                ? 'bg-gray-50 border-gray-300 text-gray-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100' 
                : 'bg-amber-50/90 border-amber-300 text-amber-950 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
            }`}
          >
            <option value="all">الكل (جميع المنتجات والعمليات)</option>
            {filterOptions}
          </select>
          
          <Package className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
            profile.isAll ? 'text-gray-400' : 'text-amber-600'
          }`} />
        </div>

        {/* Quick Collapse Button */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer"
            title="طي شريط بروفايل المنتج"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
