import React, { useState, useMemo } from 'react';
import { 
  X, AlertTriangle, Search, FileSpreadsheet, Eye, 
  MapPin, Phone, CheckCircle2, ArrowRight, TrendingDown,
  MinusCircle, RotateCcw, AlertOctagon, HelpCircle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { exportFinanceOrdersToExcel } from '../../utils/excelExport';

const formatCurrency = (val: number) => {
  return Math.round(Number(val) || 0).toLocaleString('fr-FR');
};

export interface ZeroOrNegativeOrderItem {
  order: any;
  realStatus: string;
  statusType: string;
  rev: number;
  customerShp: number;
  realShp: number;
  totalCogs: number;
  extCost: number;
  returnCostToUse: number;
  netProfit: number;
  lossReason: string;
  isZero: boolean;
  isNegative: boolean;
}

interface ZeroOrNegativeProfitModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ZeroOrNegativeOrderItem[];
  onSelectOrder: (order: any) => void;
  onGoToOrderInTable?: (order: any) => void;
  settings: any;
  isMonthlySub: boolean;
}

export function ZeroOrNegativeProfitModal({
  isOpen,
  onClose,
  items,
  onSelectOrder,
  onGoToOrderInTable,
  settings,
  isMonthlySub
}: ZeroOrNegativeProfitModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'negative' | 'zero' | 'returned' | 'delivered' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'loss_desc' | 'date_desc' | 'date_asc' | 'cogs_desc'>('loss_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  if (!isOpen) return null;

  // KPI Calculations
  const totalCount = items.length;
  const negativeCount = items.filter(it => it.isNegative).length;
  const zeroCount = items.filter(it => it.isZero).length;
  const returnedCount = items.filter(it => it.realStatus === 'مرتجع').length;
  const totalLoss = items.reduce((sum, it) => it.netProfit < 0 ? sum + Math.abs(it.netProfit) : sum, 0);

  // Filtered Items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(it => {
        const o = it.order;
        const orderId = String(o.orderId || o.id || '').toLowerCase();
        const tracking = String(o.shippingTrackingId || '').toLowerCase();
        const name = String(o.fullName || '').toLowerCase();
        const phone = String(o.phone || '').toLowerCase();
        const prod = String(o.productName || '').toLowerCase();
        const variation = String(o.variation || o.variationName || '').toLowerCase();
        const wilaya = String(o.region || o.city || '').toLowerCase();

        return orderId.includes(q) || tracking.includes(q) || name.includes(q) || 
               phone.includes(q) || prod.includes(q) || variation.includes(q) || wilaya.includes(q);
      });
    }

    // Filter Type
    if (filterType === 'negative') {
      result = result.filter(it => it.isNegative);
    } else if (filterType === 'zero') {
      result = result.filter(it => it.isZero);
    } else if (filterType === 'returned') {
      result = result.filter(it => it.realStatus === 'مرتجع');
    } else if (filterType === 'delivered') {
      result = result.filter(it => it.realStatus === 'مستلم');
    } else if (filterType === 'pending') {
      result = result.filter(it => it.realStatus !== 'مستلم' && it.realStatus !== 'مرتجع');
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'loss_desc') {
        return a.netProfit - b.netProfit; // Most negative first
      }
      if (sortBy === 'cogs_desc') {
        return b.totalCogs - a.totalCogs;
      }
      if (sortBy === 'date_desc') {
        const da = a.order.orderDate ? parseISO(a.order.orderDate).getTime() : 0;
        const db = b.order.orderDate ? parseISO(b.order.orderDate).getTime() : 0;
        return db - da;
      }
      if (sortBy === 'date_asc') {
        const da = a.order.orderDate ? parseISO(a.order.orderDate).getTime() : 0;
        const db = b.order.orderDate ? parseISO(b.order.orderDate).getTime() : 0;
        return da - db;
      }
      return 0;
    });

    return result;
  }, [items, searchQuery, filterType, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExport = () => {
    const rawOrders = filteredItems.map(it => it.order);
    exportFinanceOrdersToExcel({
      orders: rawOrders,
      filterLabel: `طلبيات فائدتها 0 أو أقل (${filteredItems.length} طلبية)`,
      fileNamePrefix: 'طلبيات_بدون_ربح_أو_خاسرة',
      settings
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl h-full max-h-[94vh] flex flex-col min-h-0 overflow-hidden text-right select-text"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-l from-rose-50/70 via-slate-50/50 to-white border-b border-rose-100/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-rose-600/10 border border-rose-200 flex items-center justify-center text-rose-600 shadow-xs shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-normal">
                  الطلبيات ذات الفائدة 0 أو أقل (خاسرة أو بدون ربح)
                </h2>
                <span className="bg-rose-100 text-rose-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-rose-200 shrink-0">
                  {items.length} طلبية
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>فحص وتحليل الطلبيات التي لم تحقق أرباحاً صافية أو سببت خسائر مالية.</span>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                  💡 اضغط على رقم الطلبية أو زر «الذهاب للجدول» للانتقال المباشر وتعديل الأسعار
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExport}
              disabled={filteredItems.length === 0}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="تصدير هذه الطلبيات إلى Excel"
            >
              <FileSpreadsheet size={15} />
              <span className="hidden sm:inline">تصدير Excel ({filteredItems.length})</span>
              <span className="sm:hidden">Excel</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 transition-colors cursor-pointer"
              title="إغلاق النافذة"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-50/80 border-b border-slate-200/80 text-center shrink-0">
          <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 truncate">إجمالي الطلبيات المعنية</div>
            <div className="text-base sm:text-lg font-black text-slate-900 mt-0.5">{totalCount}</div>
          </div>

          <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-rose-200 shadow-2xs bg-rose-50/30">
            <div className="text-[11px] font-bold text-rose-700 truncate flex items-center justify-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              <span>طلبيات خاسرة</span>
            </div>
            <div className="text-base sm:text-lg font-black text-rose-600 mt-0.5">{negativeCount}</div>
          </div>

          <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-amber-200 shadow-2xs bg-amber-50/30">
            <div className="text-[11px] font-bold text-amber-800 truncate flex items-center justify-center gap-1">
              <MinusCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>بدون ربح (0 د.ج)</span>
            </div>
            <div className="text-base sm:text-lg font-black text-amber-700 mt-0.5">{zeroCount}</div>
          </div>

          <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-rose-200/80 shadow-2xs">
            <div className="text-[11px] font-bold text-rose-600 truncate">إجمالي الخسارة المالية</div>
            <div className="text-base sm:text-lg font-black text-rose-700 mt-0.5">
              -{formatCurrency(totalLoss)} <span className="text-xs font-bold">د.ج</span>
            </div>
          </div>

          <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-indigo-200/70 shadow-2xs col-span-2 sm:col-span-1">
            <div className="text-[11px] font-bold text-indigo-700 truncate flex items-center justify-center gap-1">
              <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
              <span>المرتجع (روتور)</span>
            </div>
            <div className="text-base sm:text-lg font-black text-indigo-900 mt-0.5">
              {returnedCount} {isMonthlySub && <span className="text-[10px] text-indigo-500 font-normal">(اشتراك)</span>}
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white shrink-0">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="بحث برقم الطلبية، التتبع، العميل، الهاتف، المنتج..."
              className="w-full pl-8 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-rose-400 focus:bg-white transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                مسح
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Type Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-bold">
              <button
                onClick={() => { setFilterType('all'); setCurrentPage(1); }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
              >
                الكل ({items.length})
              </button>
              <button
                onClick={() => { setFilterType('negative'); setCurrentPage(1); }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${filterType === 'negative' ? 'bg-rose-600 text-white shadow-2xs font-black' : 'text-rose-700 hover:text-rose-900'}`}
              >
                خاسرة ({negativeCount})
              </button>
              <button
                onClick={() => { setFilterType('zero'); setCurrentPage(1); }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${filterType === 'zero' ? 'bg-amber-500 text-white shadow-2xs font-black' : 'text-amber-800 hover:text-amber-900'}`}
              >
                ربح صفر ({zeroCount})
              </button>
              <button
                onClick={() => { setFilterType('returned'); setCurrentPage(1); }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${filterType === 'returned' ? 'bg-indigo-600 text-white shadow-2xs font-black' : 'text-indigo-700 hover:text-indigo-900'}`}
              >
                مرتجعة ({returnedCount})
              </button>
            </div>

            {/* Sorting */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-rose-400 cursor-pointer"
            >
              <option value="loss_desc">الأعلى خسارة أولاً</option>
              <option value="cogs_desc">الأعلى في تكلفة البضاعة</option>
              <option value="date_desc">الأحدث تاريخاً</option>
              <option value="date_asc">الأقدم تاريخاً</option>
            </select>
          </div>
        </div>

        {/* Content Table Container (Ensuring min-h-0 and flex-1 so it scrolls properly) */}
        <div className="flex-1 min-h-0 overflow-auto bg-slate-50/20">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-700 font-black shadow-2xs">
              <tr>
                <th className="p-3.5 min-w-[170px]">الطلبية / التتبع</th>
                <th className="p-3.5 min-w-[160px]">العميل والولاية</th>
                <th className="p-3.5 min-w-[180px]">المنتج والنوع (المخزن)</th>
                <th className="p-3.5 text-center min-w-[95px]">الحالة</th>
                <th className="p-3.5 text-center min-w-[85px]">التحصيل</th>
                <th className="p-3.5 text-center min-w-[85px]">التوصيل</th>
                <th className="p-3.5 text-center min-w-[95px]">تكلفة السلعة</th>
                <th className="p-3.5 text-center min-w-[95px]">إضافية/مرتجع</th>
                <th className="p-3.5 text-center min-w-[105px]">صافي الفائدة</th>
                <th className="p-3.5 min-w-[170px]">سبب انعدام الربح / الخسارة</th>
                <th className="p-3.5 text-center min-w-[110px]">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium bg-white">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-20 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 size={40} className="text-emerald-500 opacity-70" />
                      <span className="font-bold text-sm text-slate-700">لا توجد طلبيات مطابقة للفلتر الحالي</span>
                      <span className="text-xs text-slate-400">جميع طلبياتك تحقق أرباحاً أو تمت تصفيتها بنجاح!</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((it) => {
                  const o = it.order;
                  const isReturned = it.realStatus === 'مرتجع';
                  const isDelivered = it.realStatus === 'مستلم';

                  return (
                    <tr 
                      key={o.id || o.orderId} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        it.isNegative ? 'bg-rose-50/20' : 'bg-amber-50/10'
                      }`}
                    >
                      {/* Order & Tracking */}
                      <td className="p-3.5 align-top">
                        <div 
                          onClick={() => onGoToOrderInTable ? onGoToOrderInTable(o) : onSelectOrder(o)}
                          className="font-black text-slate-900 hover:text-indigo-600 cursor-pointer flex items-center gap-1.5 group transition-colors"
                          title="اضغط للانتقال مباشرة إلى هذه الطلبية في جدول المالية"
                        >
                          <span className="group-hover:underline">#{o.orderId || o.id}</span>
                          <ArrowRight size={13} className="text-indigo-600 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block border border-slate-200/60">
                          {o.shippingTrackingId || 'بدون تتبع'}
                        </div>
                        {o.orderDate && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            {format(parseISO(o.orderDate), 'yyyy-MM-dd')}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="p-3.5 align-top">
                        <div className="font-bold text-slate-900">{o.fullName || 'بدون اسم'}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                          <Phone size={11} className="text-slate-400 shrink-0" />
                          <span>{o.phone || '-'}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-1">
                          <MapPin size={10} className="text-slate-400 shrink-0" />
                          <span>{o.region || o.city || 'الولاية غير محددة'}</span>
                        </div>
                      </td>

                      {/* Product & Variation */}
                      <td className="p-3.5 align-top">
                        <div className="font-bold text-indigo-950 truncate max-w-[190px]" title={o.productName}>
                          {o.productName || 'منتج غير محدد'}
                        </div>
                        {o.variation && (
                          <div className="text-[11px] text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded mt-1 inline-block font-semibold">
                            {o.variation}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          الكمية: <strong className="text-slate-700 font-bold">{o.qnts || 1}</strong>
                          {o.sku && <span className="mr-2">SKU: {o.sku}</span>}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 align-top text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-xl text-[11px] font-black border ${
                          isDelivered
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isReturned
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {it.realStatus}
                        </span>
                      </td>

                      {/* Revenue */}
                      <td className="p-3.5 align-top text-center font-bold text-slate-900">
                        {formatCurrency(it.rev)} <span className="text-[10px] text-slate-400 font-normal">د.ج</span>
                      </td>

                      {/* Shipping */}
                      <td className="p-3.5 align-top text-center font-bold text-amber-700">
                        {formatCurrency(it.realShp)} <span className="text-[10px] text-slate-400 font-normal">د.ج</span>
                      </td>

                      {/* Goods Cost from Inventory */}
                      <td className="p-3.5 align-top text-center">
                        <div className="font-black text-slate-800">
                          {formatCurrency(it.totalCogs)} <span className="text-[10px] text-slate-400 font-normal">د.ج</span>
                        </div>
                        <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-100 font-bold">
                          المخزن
                        </span>
                      </td>

                      {/* Extra / Return Cost */}
                      <td className="p-3.5 align-top text-center">
                        {isReturned ? (
                          isMonthlySub ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title="مشمول بالاشتراك الشهري الثابت">
                              اشتراك (0 د.ج)
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100">
                              {formatCurrency(it.returnCostToUse)} د.ج
                            </span>
                          )
                        ) : (
                          <span className="text-slate-500 font-bold">
                            {it.extCost > 0 ? `${formatCurrency(it.extCost)} د.ج` : '-'}
                          </span>
                        )}
                      </td>

                      {/* Net Profit */}
                      <td className="p-3.5 align-top text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-xl text-xs font-black border shadow-2xs ${
                          it.netProfit < 0
                            ? 'bg-rose-100 text-rose-700 border-rose-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}>
                          {it.netProfit < 0 ? '' : '+'}{formatCurrency(it.netProfit)} د.ج
                        </span>
                      </td>

                      {/* Loss Reason Analysis */}
                      <td className="p-3.5 align-top">
                        <div className="text-[11px] leading-tight font-medium text-slate-700 flex items-start gap-1">
                          <span className="text-rose-500 text-sm leading-none shrink-0">•</span>
                          <span>{it.lossReason}</span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="p-3.5 align-top text-center">
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => onGoToOrderInTable ? onGoToOrderInTable(o) : onSelectOrder(o)}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer w-full group/btn"
                            title="الانتقال الفوري إلى هذه الطلبية في جدول المالية لتعديل أسعارها وتكاليفها"
                          >
                            <span>الذهاب للجدول</span>
                            <ArrowRight size={13} className="rotate-180 group-hover/btn:-translate-x-0.5 transition-transform" />
                          </button>
                          <button
                            onClick={() => onSelectOrder(o)}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-all flex items-center justify-center gap-1 cursor-pointer w-full"
                            title="فتح نافذة فحص كامل بيانات الطلبية"
                          >
                            <Eye size={12} className="text-slate-500" />
                            <span>معاينة التفاصيل</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer & Pagination */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="text-slate-600 font-bold">
            عرض {paginatedItems.length} من أصل {filteredItems.length} طلبية مطابقة (إجمالي الطلبيات غير الرابحة: {items.length})
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:bg-slate-50"
            >
              السابق
            </button>
            <span className="font-bold text-slate-800">
              صفحة {currentPage} من {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:bg-slate-50"
            >
              التالي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
