import React, { useState, useMemo } from 'react';
import { 
  X, FileSpreadsheet, Download, CheckSquare, Square, 
  Layers, Package, Calendar, Filter, CheckCircle2, 
  TrendingUp, TrendingDown, DollarSign, RefreshCw, Sliders,
  HelpCircle, Eye, ArrowUpDown, ChevronDown
} from 'lucide-react';
import { 
  ALL_FINANCE_EXPORT_COLUMNS, 
  exportAdvancedFinanceExcel 
} from '../../utils/excelExport';
import { safeParseDate, safeIsWithinInterval } from '../../utils/financeCalculations';
import toast from 'react-hot-toast';

interface AdvancedFinanceExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allOrders: any[];
  currentFilteredOrders: any[];
  inventoryProducts?: any[];
  settings?: any;
  currentDateFilterLabel?: string;
  mapStatusFn?: (statusText: string, order?: any) => string;
  getOrderCostsFn?: (order: any) => { totalCogs: number; extCost: number };
  getEffectiveShippingCostFn?: (order: any) => number;
  getDeliveryDateFn?: (order: any) => Date | null;
}

export const AdvancedFinanceExportModal: React.FC<AdvancedFinanceExportModalProps> = ({
  isOpen,
  onClose,
  allOrders,
  currentFilteredOrders,
  inventoryProducts = [],
  settings = {},
  currentDateFilterLabel = 'الفترة الحالية',
  mapStatusFn,
  getOrderCostsFn,
  getEffectiveShippingCostFn,
  getDeliveryDateFn
}) => {
  // 1. Export Mode: detailed orders, grouped by models/products, or both
  const [exportMode, setExportMode] = useState<'detailed' | 'grouped' | 'both'>('both');

  // 2. Target Orders source / Date scope
  const [dateScope, setDateScope] = useState<'current' | 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom'>('current');
  const [dateFieldBasis, setDateFieldBasis] = useState<'orderDate' | 'deliveryDate'>('orderDate');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // 3. Product & Variation / Model filters
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [selectedVariation, setSelectedVariation] = useState<string>('all');

  // 4. Status filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'returned' | 'pending'>('all');

  // 5. Profitability filter
  const [profitFilter, setProfitFilter] = useState<'all' | 'profitable' | 'loss' | 'zero_or_loss'>('all');

  // 6. Selected Columns for Detailed sheet
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>(() => 
    ALL_FINANCE_EXPORT_COLUMNS.filter(c => c.defaultSelected).map(c => c.id)
  );

  const [isExporting, setIsExporting] = useState(false);

  // Extract unique products list from all orders
  const uniqueProducts = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach(o => {
      const name = o.productName?.trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [allOrders]);

  // Extract unique variations based on selected product
  const availableVariations = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach(o => {
      if (selectedProduct === 'all' || o.productName?.trim() === selectedProduct) {
        const v = o.variation?.trim();
        if (v) set.add(v);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [allOrders, selectedProduct]);

  // Reset variation when product changes if not in new list
  const handleProductChange = (prod: string) => {
    setSelectedProduct(prod);
    setSelectedVariation('all');
  };

  // Filter orders according to all criteria
  const matchingOrders = useMemo(() => {
    let list: any[] = [];

    // Step A: Determine base list by Date Scope
    if (dateScope === 'current') {
      list = [...currentFilteredOrders];
    } else {
      list = [...allOrders];

      if (dateScope !== 'all') {
        const now = new Date();
        let start: Date | null = null;
        let end: Date | null = null;

        if (dateScope === 'today') {
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
          end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        } else if (dateScope === 'yesterday') {
          const y = new Date(now);
          y.setDate(y.getDate() - 1);
          start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
          end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
        } else if (dateScope === 'week') {
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
          end = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59);
        } else if (dateScope === 'month') {
          start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        } else if (dateScope === 'last_month') {
          start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
          end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        } else if (dateScope === 'custom' && customStartDate && customEndDate) {
          start = new Date(`${customStartDate}T00:00:00`);
          end = new Date(`${customEndDate}T23:59:59`);
        }

        if (start && end) {
          list = list.filter(o => {
            let targetDate: Date | null = null;
            if (dateFieldBasis === 'deliveryDate') {
              if (getDeliveryDateFn) {
                targetDate = getDeliveryDateFn(o);
              } else if (o.deliveryDate) {
                targetDate = safeParseDate(o.deliveryDate);
              }
            } else {
              targetDate = safeParseDate(o.orderDate);
            }

            if (!targetDate) return false;
            return safeIsWithinInterval(targetDate, { start, end });
          });
        }
      }
    }

    // Step B: Filter by Product & Variation
    if (selectedProduct !== 'all') {
      list = list.filter(o => o.productName?.trim() === selectedProduct);
    }
    if (selectedVariation !== 'all') {
      list = list.filter(o => o.variation?.trim() === selectedVariation);
    }

    // Step C: Filter by Delivery Status
    if (statusFilter !== 'all') {
      list = list.filter(o => {
        let realStatus = o.status2 || '';
        if (mapStatusFn) {
          realStatus = o.isExchangedReturn ? 'مستلم' : mapStatusFn(o.status2 || '', o);
        }
        if (statusFilter === 'delivered') return realStatus === 'مستلم';
        if (statusFilter === 'returned') return realStatus === 'مرتجع';
        if (statusFilter === 'pending') return realStatus !== 'مستلم' && realStatus !== 'مرتجع';
        return true;
      });
    }

    // Step D: Filter by Profitability
    if (profitFilter !== 'all') {
      const defaultReturnCost = Number(settings?.returnCost) || 400;
      const isMonthlySub = settings?.returnCostMode === 'monthly_subscription';

      list = list.filter(o => {
        const { totalCogs = 0, extCost = 0 } = getOrderCostsFn ? getOrderCostsFn(o) : { totalCogs: 0, extCost: 0 };
        const realShp = getEffectiveShippingCostFn ? getEffectiveShippingCostFn(o) : 0;
        const rev = Number(o.totalCharge) || 0;

        let realStatus = o.status2 || '';
        if (mapStatusFn) {
          realStatus = o.isExchangedReturn ? 'مستلم' : mapStatusFn(o.status2 || '', o);
        }

        const isDelivered = realStatus === 'مستلم';
        const isReturned = realStatus === 'مرتجع';
        const returnCostToUse = isReturned ? (isMonthlySub ? 0 : (o.customReturnCost !== undefined ? Number(o.customReturnCost) : defaultReturnCost)) : 0;

        let profit = 0;
        if (isDelivered) {
          profit = rev - realShp - totalCogs - extCost;
        } else if (isReturned) {
          profit = isMonthlySub ? 0 : (-returnCostToUse - extCost);
        } else {
          profit = rev - realShp - totalCogs - extCost;
        }

        if (profitFilter === 'profitable') return profit > 0;
        if (profitFilter === 'loss') return profit < 0;
        if (profitFilter === 'zero_or_loss') return profit <= 0;
        return true;
      });
    }

    return list;
  }, [
    allOrders, currentFilteredOrders, dateScope, dateFieldBasis,
    customStartDate, customEndDate, selectedProduct, selectedVariation,
    statusFilter, profitFilter, mapStatusFn, getDeliveryDateFn,
    getOrderCostsFn, getEffectiveShippingCostFn, settings
  ]);

  // Count distinct groups in matching orders
  const matchingGroupCount = useMemo(() => {
    const set = new Set<string>();
    matchingOrders.forEach(o => {
      const prod = (o.productName || 'غير محدد').trim();
      const vari = (o.variation || 'عام').trim();
      set.add(`${prod}___${vari}`);
    });
    return set.size;
  }, [matchingOrders]);

  // Quick Column Selectors
  const handleSelectAllColumns = () => {
    setSelectedColumnIds(ALL_FINANCE_EXPORT_COLUMNS.map(c => c.id));
  };

  const handleDeselectAllColumns = () => {
    setSelectedColumnIds(['orderId']);
  };

  const handleSelectFinancialOnly = () => {
    setSelectedColumnIds([
      'orderId', 'orderDate', 'productName', 'variation', 'quantity',
      'status2', 'profitType', 'revenue', 'realShipping', 'cogs', 'returnCost', 'netProfit'
    ]);
  };

  const handleSelectShippingOnly = () => {
    setSelectedColumnIds([
      'orderId', 'tracking', 'orderDate', 'customerName', 'phone', 'wilaya',
      'commune', 'productName', 'variation', 'quantity', 'deliveryCompany', 'status2'
    ]);
  };

  const toggleColumn = (id: string) => {
    if (selectedColumnIds.includes(id)) {
      if (selectedColumnIds.length === 1) {
        toast.error('يجب الإبقاء على عمود واحد على الأقل للتصدير');
        return;
      }
      setSelectedColumnIds(selectedColumnIds.filter(c => c !== id));
    } else {
      setSelectedColumnIds([...selectedColumnIds, id]);
    }
  };

  // Perform Export
  const handleExecuteExport = () => {
    if (matchingOrders.length === 0) {
      toast.error('لا توجد أي طلبيات مطابقة للفلاتر المحددة');
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading('جاري تجهيز وتصدير ملف Excel...');

    try {
      let label = `تصدير_${exportMode}`;
      if (selectedProduct !== 'all') label += `_${selectedProduct}`;
      if (selectedVariation !== 'all') label += `_${selectedVariation}`;

      exportAdvancedFinanceExcel({
        orders: matchingOrders,
        inventoryProducts,
        settings,
        exportMode,
        selectedColumnIds,
        filterLabel: `المنتج: ${selectedProduct} | الموديل: ${selectedVariation} | النطاق: ${dateScope}`,
        fileNamePrefix: label,
        mapStatusFn,
        getOrderCostsFn,
        getEffectiveShippingCostFn,
        getDeliveryDateFn
      });

      toast.success(
        `تم تصدير ${matchingOrders.length} طلبية (${exportMode === 'grouped' ? 'مجمعة حسب الموديلات' : exportMode === 'both' ? 'ورقتين تفصيلي ومجمّع' : 'تفصيلي'}) بنجاح!`, 
        { id: toastId }
      );
      onClose();
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error(`خطأ أثناء التصدير: ${err.message || err}`, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl h-full max-h-[94vh] flex flex-col min-h-0 overflow-hidden text-right select-text"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-l from-emerald-50/80 via-slate-50 to-white border-b border-emerald-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600/10 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-normal">
                  تصدير متقدم لجدول المالية (Excel)
                </h2>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-emerald-200">
                  .xlsx مخصص
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                تصفية دقيقة بالمنتجات، الموديلات، التواريخ، واختيار التصدير المجمّع أو التفصيلي مع التحكم الكامل في الأعمدة.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 transition-colors cursor-pointer shrink-0"
            title="إغلاق النافذة"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Section 1: Export Mode Selection (تفصيلي / تجميع الموديلات / شامل) */}
          <div className="space-y-2.5">
            <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>1. اختر نوع وهيئة ملف التصدير (Aggregation & Mode):</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option A: Grouped by Models */}
              <div
                onClick={() => setExportMode('grouped')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  exportMode === 'grouped'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">تصدير مجمّع بالموديلات والأنواع</span>
                    <input
                      type="radio"
                      name="exportMode"
                      checked={exportMode === 'grouped'}
                      onChange={() => setExportMode('grouped')}
                      className="accent-emerald-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    ملف تجميعي يحسب لكل موديل ونوع: إجمالي الطلبيات، كم عدد المستلم، نسبة التوصيل، المداخيل وصافي الربح.
                  </p>
                </div>
                <div className="mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md inline-block w-fit">
                  يوصى به لجرد المبيعات والموديلات
                </div>
              </div>

              {/* Option B: Detailed Orders */}
              <div
                onClick={() => setExportMode('detailed')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  exportMode === 'detailed'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">تصدير تفصيلي بالطلبيات</span>
                    <input
                      type="radio"
                      name="exportMode"
                      checked={exportMode === 'detailed'}
                      onChange={() => setExportMode('detailed')}
                      className="accent-indigo-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    كل طلبية كسطر منفصل يحتوي على كافة بياناتها وتفاصيل الأرباح وتكاليف الشحن مع إمكانية تحديد الأعمدة.
                  </p>
                </div>
                <div className="mt-2 text-[10px] font-bold text-indigo-700 bg-indigo-100/60 px-2 py-0.5 rounded-md inline-block w-fit">
                  تتبع محاسبي مفصل لكل طلبية
                </div>
              </div>

              {/* Option C: Both Sheets in One File */}
              <div
                onClick={() => setExportMode('both')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  exportMode === 'both'
                    ? 'border-purple-600 bg-purple-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">تصدير شامل (ورقتان Excel في ملف واحد)</span>
                    <input
                      type="radio"
                      name="exportMode"
                      checked={exportMode === 'both'}
                      onChange={() => setExportMode('both')}
                      className="accent-purple-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    ورقة أولى تحتوي على الطلبيات المفصلة، وورقة ثانية تحتوي على تجميع الموديلات والأنواع.
                  </p>
                </div>
                <div className="mt-2 text-[10px] font-bold text-purple-700 bg-purple-100/60 px-2 py-0.5 rounded-md inline-block w-fit">
                  التقرير الأكثر شمولاً وتكاملاً
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Filters (Products & Variations & Status) */}
          <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-4">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-indigo-600" />
              <span>2. تصفية المنتجات والموديلات والحالات:</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Product Select */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  المنتج المراد تصديره:
                </label>
                <select
                  value={selectedProduct}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">كل المنتجات ({uniqueProducts.length})</option>
                  {uniqueProducts.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Variation / Model Select */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  النوع / الموديل:
                </label>
                <select
                  value={selectedVariation}
                  onChange={(e) => setSelectedVariation(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">كل الأنواع والموديلات</option>
                  {availableVariations.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  حالة التوصيل:
                </label>
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">كل الحالات</option>
                  <option value="delivered">الطلبيات المستلمة فقط (Livré)</option>
                  <option value="returned">الطلبيات المرتجعة فقط (Retour)</option>
                  <option value="pending">قيد التوصيل / أخرى</option>
                </select>
              </div>

              {/* Profitability Filter */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  نوع الربحية:
                </label>
                <select
                  value={profitFilter}
                  onChange={(e: any) => setProfitFilter(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">كل الطلبيات (رابحة وخاسرة)</option>
                  <option value="profitable">الطلبيات الرابحة فقط (ربح &gt; 0)</option>
                  <option value="zero_or_loss">بدون ربح أو خاسرة (فائدة &lt;= 0)</option>
                  <option value="loss">الطلبيات الخاسرة فقط (ربح &lt; 0)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Date Range Controls */}
          <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>3. التحكم في تاريخ وفترة الطلبيات المصدرة:</span>
              </h3>

              {/* Basis: Order Date vs Delivery Date */}
              <div className="flex items-center gap-3 text-xs font-bold bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px]">الفلترة مبنية على:</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                  <input
                    type="radio"
                    name="dateBasis"
                    value="orderDate"
                    checked={dateFieldBasis === 'orderDate'}
                    onChange={() => setDateFieldBasis('orderDate')}
                    className="accent-emerald-600"
                  />
                  <span>تاريخ الطلب</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                  <input
                    type="radio"
                    name="dateBasis"
                    value="deliveryDate"
                    checked={dateFieldBasis === 'deliveryDate'}
                    onChange={() => setDateFieldBasis('deliveryDate')}
                    className="accent-emerald-600"
                  />
                  <span>تاريخ التوصيل / المعالجة</span>
                </label>
              </div>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {[
                { id: 'current', label: 'الفترة المعروضة' },
                { id: 'all', label: 'جميع الفترات' },
                { id: 'today', label: 'اليوم' },
                { id: 'yesterday', label: 'الأمس' },
                { id: 'week', label: 'هذا الأسبوع' },
                { id: 'month', label: 'هذا الشهر' },
                { id: 'last_month', label: 'الشهر الماضي' },
                { id: 'custom', label: 'فترة مخصصة...' }
              ].map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setDateScope(preset.id as any)}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center border ${
                    dateScope === preset.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-black'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Inputs if custom is active */}
            {dateScope === 'custom' && (
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">من تاريخ:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">إلى تاريخ:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Column Customization (Shows when Detailed or Both is selected) */}
          {(exportMode === 'detailed' || exportMode === 'both') && (
            <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-purple-600" />
                    <span>4. التحكم في أعمدة جدول الطلبيات المصدرة ({selectedColumnIds.length} من {ALL_FINANCE_EXPORT_COLUMNS.length} عمود):</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    اختر الأعمدة التي ترغب بظهورها في ملف الـ Excel أو استخدم التحديد السريع أدناه.
                  </p>
                </div>

                {/* Preset shortcuts */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSelectAllColumns}
                    className="text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer"
                  >
                    تحديد الكل
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectFinancialOnly}
                    className="text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200 cursor-pointer"
                  >
                    المالية والربحية
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectShippingOnly}
                    className="text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-200 cursor-pointer"
                  >
                    الشحن والتوصيل
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllColumns}
                    className="text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer"
                  >
                    تفريغ
                  </button>
                </div>
              </div>

              {/* Columns Checkbox Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
                {ALL_FINANCE_EXPORT_COLUMNS.map(col => {
                  const isChecked = selectedColumnIds.includes(col.id);
                  return (
                    <label
                      key={col.id}
                      onClick={(e) => {
                        e.preventDefault();
                        toggleColumn(col.id);
                      }}
                      className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-white border-emerald-400/80 text-slate-900 shadow-2xs' 
                          : 'bg-slate-100/60 border-slate-200/70 text-slate-400 hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="accent-emerald-600 rounded"
                      />
                      <span className="text-xs font-bold truncate">{col.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Live Counters & Summary Banner */}
        <div className="p-3 sm:p-4 bg-emerald-950 text-emerald-50 border-t border-emerald-900/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 text-xs flex-wrap">
            <div className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>الطلبيات المطابقة:</span>
              <strong className="text-white font-black text-sm">{matchingOrders.length.toLocaleString('fr-FR')}</strong>
            </div>

            <div className="flex items-center gap-1.5 font-bold">
              <Package className="w-4 h-4 text-indigo-400" />
              <span>الموديلات والأنواع:</span>
              <strong className="text-white font-black text-sm">{matchingGroupCount} موديل</strong>
            </div>

            <div className="flex items-center gap-1.5 font-bold">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <span>نوع الملف المجهز:</span>
              <span className="bg-emerald-900/80 text-emerald-300 px-2 py-0.5 rounded text-[11px] font-bold">
                {exportMode === 'grouped' ? 'تجميع الموديلات' : exportMode === 'both' ? 'ورقتين (مفصل + مجمّع)' : 'تفصيلي بالطلبيات'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-emerald-900/60 rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleExecuteExport}
              disabled={isExporting || matchingOrders.length === 0}
              className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-950/40 flex items-center gap-2 text-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'جاري التصدير...' : `تصدير ملف Excel (${matchingOrders.length})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
