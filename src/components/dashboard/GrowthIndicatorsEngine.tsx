import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus, 
  Calendar, DollarSign, Package, Truck, Ban, CheckCircle2, 
  HelpCircle, Activity, Sparkles, Layers, Target, Percent, 
  ChevronDown, ChevronUp, Info, ArrowLeftRight, Clock, Award, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { 
  subDays, subWeeks, subMonths, startOfDay, endOfDay, 
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  parseISO, isWithinInterval, format 
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { useStore } from '../../store';
import { createFinanceCalculator, safeParseDate, safeIsWithinInterval } from '../../utils/financeCalculations';
import { checkProductMatch, renderProductFilterOptions } from '../../utils/productFilters';

interface GrowthIndicatorsEngineProps {
  initialProductFilter?: string;
  onCloseToOverview?: () => void;
}

export type GrowthPreset = 'today_vs_yesterday' | 'week_vs_last_week' | 'month_vs_last_month' | 'last30_vs_prior30' | 'custom';

export function GrowthIndicatorsEngine({ 
  initialProductFilter = 'all',
  onCloseToOverview
}: GrowthIndicatorsEngineProps) {
  const { 
    orders, campaigns, campaignRecords, expenses, 
    settings, inventoryProducts, globalProductFilter, setGlobalProductFilter 
  } = useStore();

  const [productFilter, setProductFilter] = useState<string>(() => initialProductFilter || globalProductFilter || 'all');
  const [preset, setPreset] = useState<GrowthPreset>('month_vs_last_month');
  
  // Custom date ranges
  const [currentStartCustom, setCurrentStartCustom] = useState<string>('');
  const [currentEndCustom, setCurrentEndCustom] = useState<string>('');
  const [compareStartCustom, setCompareStartCustom] = useState<string>('');
  const [compareEndCustom, setCompareEndCustom] = useState<string>('');
  const [customCompareMode, setCustomCompareMode] = useState<'auto_prior' | 'manual'>('auto_prior');

  // Educational guide modal/toggle
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [productSearch, setProductSearch] = useState<string>('');
  const [productSortBy, setProductSortBy] = useState<'growthValue' | 'growthPercent' | 'currentProfit' | 'currentDelivered'>('growthValue');
  const [productSortOrder, setProductSortOrder] = useState<'desc' | 'asc'>('desc');

  // Calculate Date Intervals for Current & Previous (Comparison) Stage
  const { currentInterval, previousInterval, currentLabel, previousLabel } = useMemo(() => {
    const now = new Date();
    let curStart: Date;
    let curEnd: Date = endOfDay(now);
    let prevStart: Date;
    let prevEnd: Date;
    let curTxt = '';
    let prevTxt = '';

    switch (preset) {
      case 'today_vs_yesterday':
        curStart = startOfDay(now);
        curEnd = endOfDay(now);
        prevStart = startOfDay(subDays(now, 1));
        prevEnd = endOfDay(subDays(now, 1));
        curTxt = `اليوم (${format(now, 'dd MMMM', { locale: ar })})`;
        prevTxt = `الأمس (${format(prevStart, 'dd MMMM', { locale: ar })})`;
        break;

      case 'week_vs_last_week':
        curStart = startOfWeek(now, { weekStartsOn: 6 });
        curEnd = endOfWeek(now, { weekStartsOn: 6 });
        prevStart = startOfWeek(subWeeks(curStart, 1), { weekStartsOn: 6 });
        prevEnd = endOfWeek(subWeeks(curEnd, 1), { weekStartsOn: 6 });
        curTxt = `هذا الأسبوع (${format(curStart, 'dd/MM')} - ${format(curEnd, 'dd/MM')})`;
        prevTxt = `الأسبوع الماضي (${format(prevStart, 'dd/MM')} - ${format(prevEnd, 'dd/MM')})`;
        break;

      case 'month_vs_last_month':
        curStart = startOfMonth(now);
        curEnd = endOfMonth(now);
        prevStart = startOfMonth(subMonths(now, 1));
        prevEnd = endOfMonth(subMonths(now, 1));
        curTxt = `هذا الشهر (${format(now, 'MMMM yyyy', { locale: ar })})`;
        prevTxt = `الشهر الماضي (${format(prevStart, 'MMMM yyyy', { locale: ar })})`;
        break;

      case 'last30_vs_prior30':
        curEnd = endOfDay(now);
        curStart = startOfDay(subDays(now, 29));
        prevEnd = endOfDay(subDays(curStart, 1));
        prevStart = startOfDay(subDays(prevEnd, 29));
        curTxt = `آخر 30 يوماً`;
        prevTxt = `الـ 30 يوماً السابقة لها`;
        break;

      case 'custom':
      default:
        curStart = currentStartCustom ? startOfDay(parseISO(currentStartCustom)) : startOfMonth(now);
        curEnd = currentEndCustom ? endOfDay(parseISO(currentEndCustom)) : endOfDay(now);
        
        if (customCompareMode === 'manual' && compareStartCustom && compareEndCustom) {
          prevStart = startOfDay(parseISO(compareStartCustom));
          prevEnd = endOfDay(parseISO(compareEndCustom));
        } else {
          // Automatic sequential prior period of exact same length
          const diffMs = curEnd.getTime() - curStart.getTime();
          prevEnd = new Date(curStart.getTime() - 1);
          prevStart = new Date(prevEnd.getTime() - diffMs);
        }
        curTxt = `${format(curStart, 'yyyy/MM/dd')} إلى ${format(curEnd, 'yyyy/MM/dd')}`;
        prevTxt = `${format(prevStart, 'yyyy/MM/dd')} إلى ${format(prevEnd, 'yyyy/MM/dd')}`;
        break;
    }

    return {
      currentInterval: { start: curStart, end: curEnd },
      previousInterval: { start: prevStart, end: prevEnd },
      currentLabel: curTxt,
      previousLabel: prevTxt,
    };
  }, [preset, currentStartCustom, currentEndCustom, compareStartCustom, compareEndCustom, customCompareMode]);

  // Orders Filtering
  const { currentOrders, previousOrders } = useMemo(() => {
    const cur: typeof orders = [];
    const prev: typeof orders = [];

    orders.forEach(o => {
      if (!checkProductMatch(o, productFilter, inventoryProducts)) return;
      if (!o.orderDate) return;
      const d = safeParseDate(o.orderDate);
      if (!d) return;

      if (safeIsWithinInterval(d, currentInterval)) {
        cur.push(o);
      } else if (safeIsWithinInterval(d, previousInterval)) {
        prev.push(o);
      }
    });

    return { currentOrders: cur, previousOrders: prev };
  }, [orders, productFilter, inventoryProducts, currentInterval, previousInterval]);

  // Finance Calculations for Current & Previous Period
  const currentFinance = useMemo(() => {
    return createFinanceCalculator(
      orders,
      expenses || [],
      campaigns,
      campaignRecords,
      settings,
      inventoryProducts,
      'custom',
      currentInterval.start,
      currentInterval.end,
      productFilter || 'all'
    );
  }, [orders, expenses, campaigns, campaignRecords, settings, inventoryProducts, currentInterval, productFilter]);

  const previousFinance = useMemo(() => {
    return createFinanceCalculator(
      orders,
      expenses || [],
      campaigns,
      campaignRecords,
      settings,
      inventoryProducts,
      'custom',
      previousInterval.start,
      previousInterval.end,
      productFilter || 'all'
    );
  }, [orders, expenses, campaigns, campaignRecords, settings, inventoryProducts, previousInterval, productFilter]);

  // Growth Math Helper Function
  const calculateGrowth = (
    currentVal: number, 
    previousVal: number, 
    type: 'currency' | 'count' | 'percent_points' = 'currency',
    lowerIsBetter: boolean = false
  ) => {
    const delta = currentVal - previousVal;
    let percent = 0;

    if (previousVal === 0) {
      percent = currentVal > 0 ? 100 : (currentVal < 0 ? -100 : 0);
    } else {
      percent = (delta / Math.abs(previousVal)) * 100;
    }

    // Determine if growth is positive (healthy for business)
    // If lowerIsBetter is true (like return rate or ad CPA), a negative delta is a positive/good change!
    const isPositive = lowerIsBetter ? delta <= 0 : delta >= 0;
    const isNeutral = Math.abs(delta) < 0.0001;

    let deltaFormatted = '';
    if (type === 'currency') {
      const sign = delta > 0 ? '+' : '';
      deltaFormatted = `${sign}${Math.round(delta).toLocaleString()} د.ج`;
    } else if (type === 'percent_points') {
      const sign = delta > 0 ? '+' : '';
      deltaFormatted = `${sign}${delta.toFixed(1)}% نقطة`;
    } else {
      const sign = delta > 0 ? '+' : '';
      deltaFormatted = `${sign}${Math.round(delta).toLocaleString()}`;
    }

    const percentFormatted = `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`;

    return {
      currentVal,
      previousVal,
      delta,
      deltaFormatted,
      percent,
      percentFormatted,
      isPositive,
      isNeutral,
      lowerIsBetter
    };
  };

  // Compile Comprehensive Growth Metrics
  const metrics = useMemo(() => {
    // 1. Total Orders Entered
    const curTotalOrders = currentOrders.length;
    const prevTotalOrders = previousOrders.length;
    const totalOrdersGrowth = calculateGrowth(curTotalOrders, prevTotalOrders, 'count', false);

    // 2. Confirmed Orders
    const curConfirmed = currentOrders.filter(o => o.status1 === 'مؤكد').length;
    const prevConfirmed = previousOrders.filter(o => o.status1 === 'مؤكد').length;
    const confirmedGrowth = calculateGrowth(curConfirmed, prevConfirmed, 'count', false);

    // 3. Delivered Orders (Real count from delivery date / delivered status)
    const curDelivered = currentFinance.realCount;
    const prevDelivered = previousFinance.realCount;
    const deliveredGrowth = calculateGrowth(curDelivered, prevDelivered, 'count', false);

    // 4. Returned Orders
    const curReturned = currentFinance.returnedCount;
    const prevReturned = previousFinance.returnedCount;
    const returnedGrowth = calculateGrowth(curReturned, prevReturned, 'count', true);

    // 5. Total Delivered Revenue (المبيعات المحصلة)
    const curRevenue = currentFinance.realRev;
    const prevRevenue = previousFinance.realRev;
    const revenueGrowth = calculateGrowth(curRevenue, prevRevenue, 'currency', false);

    // 6. Real Net Profit (صافي الأرباح الحقيقية)
    const curProfit = currentFinance.realNetProfit;
    const prevProfit = previousFinance.realNetProfit;
    const profitGrowth = calculateGrowth(curProfit, prevProfit, 'currency', false);

    // 7. Delivery Rate %
    const curDelivRate = curConfirmed > 0 ? (curDelivered / curConfirmed) * 100 : 0;
    const prevDelivRate = prevConfirmed > 0 ? (prevDelivered / prevConfirmed) * 100 : 0;
    const deliveryRateGrowth = calculateGrowth(curDelivRate, prevDelivRate, 'percent_points', false);

    // 8. Return Rate % (الروتورن)
    const curRetRate = curConfirmed > 0 ? (curReturned / curConfirmed) * 100 : 0;
    const prevRetRate = prevConfirmed > 0 ? (prevReturned / prevConfirmed) * 100 : 0;
    const returnRateGrowth = calculateGrowth(curRetRate, prevRetRate, 'percent_points', true);

    // 9. Confirmation Rate %
    const curConfRate = curTotalOrders > 0 ? (curConfirmed / curTotalOrders) * 100 : 0;
    const prevConfRate = prevTotalOrders > 0 ? (prevConfirmed / prevTotalOrders) * 100 : 0;
    const confirmationRateGrowth = calculateGrowth(curConfRate, prevConfRate, 'percent_points', false);

    // 10. Ad Spend in DZD
    const curAdSpend = currentFinance.adSpendDZD;
    const prevAdSpend = previousFinance.adSpendDZD;
    const adSpendGrowth = calculateGrowth(curAdSpend, prevAdSpend, 'currency', false);

    // 11. Cost Per Acquisition (CPA per delivered order)
    const curCpa = curDelivered > 0 ? (curAdSpend / curDelivered) : 0;
    const prevCpa = prevDelivered > 0 ? (prevAdSpend / prevDelivered) : 0;
    const cpaGrowth = calculateGrowth(curCpa, prevCpa, 'currency', true);

    // 12. Average Order Value (AOV)
    const curAov = curDelivered > 0 ? (curRevenue / curDelivered) : 0;
    const prevAov = prevDelivered > 0 ? (prevRevenue / prevDelivered) : 0;
    const aovGrowth = calculateGrowth(curAov, prevAov, 'currency', false);

    return {
      profitGrowth,
      revenueGrowth,
      deliveredGrowth,
      totalOrdersGrowth,
      confirmedGrowth,
      deliveryRateGrowth,
      returnRateGrowth,
      confirmationRateGrowth,
      adSpendGrowth,
      cpaGrowth,
      aovGrowth,
      curDelivered,
      prevDelivered,
      curReturned,
      prevReturned
    };
  }, [currentOrders, previousOrders, currentFinance, previousFinance]);

  // High-Level Diagnostic Summary
  const diagnostic = useMemo(() => {
    const isProfitUp = metrics.profitGrowth.delta > 0;
    const isRevenueUp = metrics.revenueGrowth.delta > 0;
    const isReturnDown = metrics.returnRateGrowth.delta <= 0;
    const isDeliveryUp = metrics.deliveryRateGrowth.delta >= 0;

    let status: 'great' | 'good' | 'warning' | 'danger';
    let title = '';
    let badgeClass = '';

    if (isProfitUp && isDeliveryUp && isReturnDown) {
      status = 'great';
      title = '🚀 نمو إيجابي استثنائي ومتكامل';
      badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    } else if (isProfitUp || (isRevenueUp && isDeliveryUp)) {
      status = 'good';
      title = '📈 نمو إيجابي مشجع ومستقر';
      badgeClass = 'bg-teal-50 text-teal-800 border-teal-300';
    } else if (!isProfitUp && isRevenueUp) {
      status = 'warning';
      title = '⚠️ نمو في المبيعات مع ضغط على الأرباح والتكاليف';
      badgeClass = 'bg-amber-50 text-amber-800 border-amber-300';
    } else {
      status = 'danger';
      title = '📉 تراجع في الأداء يتطلب تدخلاً';
      badgeClass = 'bg-rose-50 text-rose-800 border-rose-300';
    }

    return { status, title, badgeClass };
  }, [metrics]);

  // Product-by-Product Growth Matrix
  const productGrowthList = useMemo(() => {
    const map = new Map<string, {
      name: string;
      sku: string;
      curDelivered: number;
      prevDelivered: number;
      curRevenue: number;
      prevRevenue: number;
      curProfit: number;
      prevProfit: number;
    }>();

    // Scan inventory products
    inventoryProducts.forEach(p => {
      map.set(p.name, {
        name: p.name,
        sku: p.sku || '',
        curDelivered: 0,
        prevDelivered: 0,
        curRevenue: 0,
        prevRevenue: 0,
        curProfit: 0,
        prevProfit: 0,
      });
    });

    // Process current orders
    currentOrders.forEach(o => {
      const pName = o.productName || 'منتج غير محدد';
      if (!map.has(pName)) {
        map.set(pName, {
          name: pName,
          sku: o.sku || '',
          curDelivered: 0,
          prevDelivered: 0,
          curRevenue: 0,
          prevRevenue: 0,
          curProfit: 0,
          prevProfit: 0,
        });
      }
      const item = map.get(pName)!;
      if (o.status2 === 'مستلم') {
        const qty = Number(o.qnts) || 1;
        item.curDelivered += qty;
        item.curRevenue += Number(o.totalCharge) || 0;
        // Approximation of profit contribution
        const cogs = (o.customProductCost || 0) * qty;
        const ship = o.deliveryPrice || 600;
        item.curProfit += (Number(o.totalCharge) || 0) - cogs - ship;
      }
    });

    // Process previous orders
    previousOrders.forEach(o => {
      const pName = o.productName || 'منتج غير محدد';
      if (!map.has(pName)) {
        map.set(pName, {
          name: pName,
          sku: o.sku || '',
          curDelivered: 0,
          prevDelivered: 0,
          curRevenue: 0,
          prevRevenue: 0,
          curProfit: 0,
          prevProfit: 0,
        });
      }
      const item = map.get(pName)!;
      if (o.status2 === 'مستلم') {
        const qty = Number(o.qnts) || 1;
        item.prevDelivered += qty;
        item.prevRevenue += Number(o.totalCharge) || 0;
        const cogs = (o.customProductCost || 0) * qty;
        const ship = o.deliveryPrice || 600;
        item.prevProfit += (Number(o.totalCharge) || 0) - cogs - ship;
      }
    });

    // Calculate deltas and percentages
    const result = Array.from(map.values())
      .filter(p => p.curDelivered > 0 || p.prevDelivered > 0 || p.curRevenue > 0 || p.prevRevenue > 0)
      .map(p => {
        const profitDelta = p.curProfit - p.prevProfit;
        let profitPercent = 0;
        if (p.prevProfit === 0) {
          profitPercent = p.curProfit > 0 ? 100 : (p.curProfit < 0 ? -100 : 0);
        } else {
          profitPercent = (profitDelta / Math.abs(p.prevProfit)) * 100;
        }

        const deliveredDelta = p.curDelivered - p.prevDelivered;

        return {
          ...p,
          profitDelta,
          profitPercent,
          deliveredDelta,
          isPositive: profitDelta >= 0,
        };
      });

    // Search filter
    const filtered = result.filter(p => 
      !productSearch || 
      p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
    );

    // Sorting
    filtered.sort((a, b) => {
      let vA = 0;
      let vB = 0;
      if (productSortBy === 'growthValue') {
        vA = a.profitDelta;
        vB = b.profitDelta;
      } else if (productSortBy === 'growthPercent') {
        vA = a.profitPercent;
        vB = b.profitPercent;
      } else if (productSortBy === 'currentProfit') {
        vA = a.curProfit;
        vB = b.curProfit;
      } else {
        vA = a.curDelivered;
        vB = b.curDelivered;
      }
      return productSortOrder === 'desc' ? vB - vA : vA - vB;
    });

    return filtered;
  }, [inventoryProducts, currentOrders, previousOrders, productSearch, productSortBy, productSortOrder]);

  const productFilterOptionsJSX = useMemo(() => {
    return renderProductFilterOptions(inventoryProducts, orders);
  }, [inventoryProducts, orders]);

  return (
    <div className="space-y-6 animate-fadeIn" dir="rtl">
      {/* Top Banner & Navigation */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-500/20 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                محرك مقارنة وتحليل النمو (Growth Engine)
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-black border ${diagnostic.badgeClass}`}>
                {diagnostic.title}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              مؤشرات النمو والمقارنة بين المراحل
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm font-medium max-w-2xl leading-relaxed">
              تتبع دقيق لنسبة النمو (إيجابية أم سلبية) وقيمتها المالية والعددية عبر مقارنة المرحلة الحالية بالمرحلة السابقة لكافة مؤشرات الأرباح، المبيعات، ومعدلات التوصيل.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-amber-300" />
              <span>كيف يُحسب النمو؟ (دليل توضيحي)</span>
              {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {onCloseToOverview && (
              <button
                onClick={onCloseToOverview}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Activity className="w-4 h-4" />
                <span>العودة للمؤشرات الشاملة</span>
              </button>
            )}
          </div>
        </div>

        {/* Comparison Stages Breadcrumb */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-bold text-slate-300">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>المرحلة الحالية: <strong>{currentLabel}</strong></span>
            </div>

            <ArrowLeftRight className="w-4 h-4 text-indigo-300 hidden sm:block" />

            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span>مرحلة المقارنة السابقة: <strong>{previousLabel}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">المنتج الخاضع للتحليل:</span>
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/30 text-indigo-200 border border-indigo-400/20 font-black">
              {productFilter === 'all' ? 'جميع المنتجات (الكل)' : productFilter}
            </span>
          </div>
        </div>
      </div>

      {/* Educational Guide Box (Collapsible) */}
      {showGuide && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-indigo-100 shadow-md animate-fadeIn space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Info className="w-5 h-5 text-indigo-600" />
              دليل فهم مؤشرات النمو: كيف تعمل المقارنة وماذا تعني الأرقام؟
            </h3>
            <button
              onClick={() => setShowGuide(false)}
              className="text-xs font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              إغلاق الدليل
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-gray-700 leading-relaxed">
            {/* Concept 1 */}
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-2">
              <div className="flex items-center gap-2 text-indigo-900 font-black text-sm">
                <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
                1. ما هو النمو؟ (مبدأ المقارنة)
              </div>
              <p>
                النمو في التجارة الإلكترونية لا يمكن معرفته كرقم منفرد، بل هو دائماً <strong>مقارنة دقيقة بين فترتين</strong>:
                الفترة الحالية (اليوم، الأسبوع، الشهر) مقابل الفترة السابقة لها لتحديد هل أداؤك يتوسع ويزدهر أم يتباطأ.
              </p>
            </div>

            {/* Concept 2 */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-black text-sm">
                <Percent className="w-4 h-4 text-emerald-600" />
                2. حساب القيمة والنسبة المئوية
              </div>
              <p>
                • <strong>فارق القيمة (Delta):</strong> = (القيمة الحالية - القيمة السابقة)، يوضح مقدار الزيادة أو النقص المالي أو العددي الحقيقي (مثل: +150,000 د.ج).
              </p>
              <p>
                • <strong>نسبة النمو (%):</strong> = <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200">((الحالي - السابق) ÷ السابق) × 100</span>
              </p>
            </div>

            {/* Concept 3 */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                <Award className="w-4 h-4 text-amber-600" />
                3. هل النمو إيجابي أم سلبي؟
              </div>
              <p>
                • <strong>المبيعات والأرباح والتسليم:</strong> الصعود (+) إيجابي 🟢، والهبوط (-) سلبي 🔴.
              </p>
              <p>
                • <strong>نسبة الروتورن (الإرجاع) والـ CPA:</strong> انخفاضها (-) يُعتبر <strong>تحسناً إيجابياً 🟢 للمتجر</strong>، وارتفاعها (+) يُعد تنبيهاً سلبياً 🔴.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar: Presets & Product Filter */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-gray-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-black text-gray-700 ml-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            اختر مرحلة المقارنة:
          </span>

          {[
            { id: 'today_vs_yesterday', label: 'اليوم 🆚 الأمس' },
            { id: 'week_vs_last_week', label: 'هذا الأسبوع 🆚 الأسبوع الماضي' },
            { id: 'month_vs_last_month', label: 'هذا الشهر 🆚 الشهر الماضي' },
            { id: 'last30_vs_prior30', label: 'آخر 30 يوماً 🆚 الـ 30 يوماً السابقة' },
            { id: 'custom', label: 'تحديد فترة مخصصة' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPreset(id as GrowthPreset)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                preset === id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Product Filter Integration */}
        <div className="flex items-center gap-2">
          {/* Quick "الجميع" Button */}
          <button
            onClick={() => {
              setProductFilter('all');
              if (setGlobalProductFilter) setGlobalProductFilter('all');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
              !productFilter || productFilter === 'all'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-indigo-50'
            }`}
            title="حساب النمو لجميع المنتجات دون استثناء"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>الجميع</span>
          </button>

          <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl border border-gray-200 px-3 py-1.5">
            <Package className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <select
              value={productFilter || 'all'}
              onChange={(e) => {
                const val = e.target.value;
                setProductFilter(val);
                if (setGlobalProductFilter) setGlobalProductFilter(val);
              }}
              className="bg-transparent border-0 text-xs font-bold text-gray-700 focus:ring-0 cursor-pointer max-w-[190px] truncate"
            >
              <option value="all">الجميع (كافة المنتجات)</option>
              {productFilterOptionsJSX}
            </select>
          </div>
        </div>
      </div>

      {/* Custom Date Pickers (if preset === 'custom') */}
      {preset === 'custom' && (
        <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-bold">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-indigo-900 font-black">الفترة الحالية:</span>
            <input
              type="date"
              value={currentStartCustom}
              onChange={(e) => setCurrentStartCustom(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-700"
            />
            <span>إلى</span>
            <input
              type="date"
              value={currentEndCustom}
              onChange={(e) => setCurrentEndCustom(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-700"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-gray-700">نوع المقارنة:</label>
              <select
                value={customCompareMode}
                onChange={(e) => setCustomCompareMode(e.target.value as any)}
                className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-bold"
              >
                <option value="auto_prior">تلقائي: نفس عدد الأيام السابقة مباشرة</option>
                <option value="manual">تحديد تواريخ فترة المقارنة يدوياً</option>
              </select>
            </div>

            {customCompareMode === 'manual' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={compareStartCustom}
                  onChange={(e) => setCompareStartCustom(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs font-bold"
                />
                <span>إلى</span>
                <input
                  type="date"
                  value={compareEndCustom}
                  onChange={(e) => setCompareEndCustom(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs font-bold"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Executive Growth Diagnostic Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl shrink-0 ${
            metrics.profitGrowth.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}>
            {metrics.profitGrowth.isPositive ? (
              <TrendingUp className="w-8 h-8" />
            ) : (
              <TrendingDown className="w-8 h-8" />
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-gray-900">
                تشخيص النمو العام للمتجر:
              </h2>
              <span className={`px-3 py-0.5 rounded-full text-xs font-extrabold border ${
                metrics.profitGrowth.isPositive ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                {metrics.profitGrowth.isPositive ? '🟢 نمو إيجابي في الأرباح' : '🔴 تراجع سلبي في الأرباح'}
              </span>
            </div>

            <p className="text-gray-600 text-xs sm:text-sm font-medium leading-relaxed max-w-3xl">
              حقق متجرك صافي أرباح حقيقية بقيمة <strong className="text-gray-900 font-black">{Math.round(metrics.profitGrowth.currentVal).toLocaleString()} د.ج</strong> مقابل <span className="text-gray-500 font-bold">{Math.round(metrics.profitGrowth.previousVal).toLocaleString()} د.ج</span> للفترة السابقة، أي بفارق نمو قدره <strong className={metrics.profitGrowth.isPositive ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{metrics.profitGrowth.deltaFormatted} ({metrics.profitGrowth.percentFormatted})</strong>.
              {' '}وبلغت نسبة التوصيل <strong className="text-teal-700 font-black">{metrics.deliveryRateGrowth.currentVal.toFixed(1)}%</strong> بفارق <strong className={metrics.deliveryRateGrowth.isPositive ? 'text-emerald-600' : 'text-rose-600'}>{metrics.deliveryRateGrowth.deltaFormatted}</strong>، مع نسبة روتورن بلغت <strong className="text-gray-900 font-bold">{metrics.returnRateGrowth.currentVal.toFixed(1)}%</strong> ({metrics.returnRateGrowth.isPositive ? 'تحسن ممتاز بانخفاض الإرجاع 🟢' : 'ارتفاع في الإرجاع يتطلب التدقيق 🔴'}).
            </p>
          </div>
        </div>

        <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center shrink-0 border-t md:border-t-0 md:border-r border-gray-100 pt-4 md:pt-0 md:pr-6 gap-2">
          <span className="text-xs font-bold text-gray-500">معدل تغير الأرباح</span>
          <div className={`text-2xl sm:text-3xl font-black flex items-center gap-1.5 ${
            metrics.profitGrowth.isPositive ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {metrics.profitGrowth.isPositive ? <ArrowUpRight className="w-7 h-7" /> : <ArrowDownRight className="w-7 h-7" />}
            <span>{metrics.profitGrowth.percentFormatted}</span>
          </div>
          <span className="text-[11px] font-bold text-gray-400">
            {metrics.profitGrowth.deltaFormatted}
          </span>
        </div>
      </div>

      {/* 8 Primary Growth Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Net Profit Growth */}
        <GrowthCard
          title="صافي الأرباح الحقيقية"
          currentValue={`${Math.round(metrics.profitGrowth.currentVal).toLocaleString()} د.ج`}
          previousValue={`${Math.round(metrics.profitGrowth.previousVal).toLocaleString()} د.ج`}
          deltaFormatted={metrics.profitGrowth.deltaFormatted}
          percentFormatted={metrics.profitGrowth.percentFormatted}
          isPositive={metrics.profitGrowth.isPositive}
          subtitle="الأرباح المستلمة بعد خصم الإعلانات والشحن والمصاريف"
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
          gradient="from-emerald-500/10 to-teal-500/10"
        />

        {/* Card 2: Revenue Growth */}
        <GrowthCard
          title="المبيعات والإيرادات المحصلة"
          currentValue={`${Math.round(metrics.revenueGrowth.currentVal).toLocaleString()} د.ج`}
          previousValue={`${Math.round(metrics.revenueGrowth.previousVal).toLocaleString()} د.ج`}
          deltaFormatted={metrics.revenueGrowth.deltaFormatted}
          percentFormatted={metrics.revenueGrowth.percentFormatted}
          isPositive={metrics.revenueGrowth.isPositive}
          subtitle="قيمة الطرود المسلمة والمحصلة فعلياً"
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          gradient="from-blue-500/10 to-indigo-500/10"
        />

        {/* Card 3: Delivered Orders Growth */}
        <GrowthCard
          title="الطلبيات المسلّمة (الناجحة)"
          currentValue={`${metrics.deliveredGrowth.currentVal.toLocaleString()} طلب`}
          previousValue={`${metrics.deliveredGrowth.previousVal.toLocaleString()} طلب`}
          deltaFormatted={`${metrics.deliveredGrowth.deltaFormatted} طرد`}
          percentFormatted={metrics.deliveredGrowth.percentFormatted}
          isPositive={metrics.deliveredGrowth.isPositive}
          subtitle="حجم الطرود التي استلمها الزبائن ودفعوا قيمتها"
          icon={<CheckCircle2 className="w-5 h-5 text-teal-600" />}
          gradient="from-teal-500/10 to-emerald-500/10"
        />

        {/* Card 4: Total Entered Orders */}
        <GrowthCard
          title="إجمالي الطلبيات المسجلة"
          currentValue={`${metrics.totalOrdersGrowth.currentVal.toLocaleString()} طلب`}
          previousValue={`${metrics.totalOrdersGrowth.previousVal.toLocaleString()} طلب`}
          deltaFormatted={`${metrics.totalOrdersGrowth.deltaFormatted} طلب`}
          percentFormatted={metrics.totalOrdersGrowth.percentFormatted}
          isPositive={metrics.totalOrdersGrowth.isPositive}
          subtitle="معدل تدفق الطلبات من المتجر وقنوات البيع"
          icon={<Package className="w-5 h-5 text-purple-600" />}
          gradient="from-purple-500/10 to-pink-500/10"
        />

        {/* Card 5: Delivery Rate */}
        <GrowthCard
          title="معدل التوصيل والاستلام"
          currentValue={`${metrics.deliveryRateGrowth.currentVal.toFixed(1)}%`}
          previousValue={`${metrics.deliveryRateGrowth.previousVal.toFixed(1)}%`}
          deltaFormatted={metrics.deliveryRateGrowth.deltaFormatted}
          percentFormatted={metrics.deliveryRateGrowth.percentFormatted}
          isPositive={metrics.deliveryRateGrowth.isPositive}
          subtitle="نسبة الطرود المستلمة من إجمالي الطلبات المؤكدة"
          icon={<Truck className="w-5 h-5 text-indigo-600" />}
          gradient="from-indigo-500/10 to-cyan-500/10"
        />

        {/* Card 6: Return Rate (Lower is Better) */}
        <GrowthCard
          title="معدل الروتورن (الإرجاع)"
          currentValue={`${metrics.returnRateGrowth.currentVal.toFixed(1)}%`}
          previousValue={`${metrics.returnRateGrowth.previousVal.toFixed(1)}%`}
          deltaFormatted={metrics.returnRateGrowth.deltaFormatted}
          percentFormatted={metrics.returnRateGrowth.percentFormatted}
          isPositive={metrics.returnRateGrowth.isPositive}
          subtitle={metrics.returnRateGrowth.isPositive ? "انخفاض الروتورن مؤشر ممتاز لحماية الأرباح" : "ارتفاع الإرجاع يقلص أرباحك"}
          icon={<Ban className="w-5 h-5 text-rose-600" />}
          gradient="from-rose-500/10 to-orange-500/10"
          highlightNote={metrics.returnRateGrowth.isPositive ? "انخفاض إيجابي 🟢" : "ارتفاع سلبي 🔴"}
        />

        {/* Card 7: Ad Cost per Delivered Order (CPA) */}
        <GrowthCard
          title="تكلفة الإعلان لكل طلبية مستلمة (CPA)"
          currentValue={`${Math.round(metrics.cpaGrowth.currentVal).toLocaleString()} د.ج`}
          previousValue={`${Math.round(metrics.cpaGrowth.previousVal).toLocaleString()} د.ج`}
          deltaFormatted={metrics.cpaGrowth.deltaFormatted}
          percentFormatted={metrics.cpaGrowth.percentFormatted}
          isPositive={metrics.cpaGrowth.isPositive}
          subtitle={metrics.cpaGrowth.isPositive ? "كفاءة أفضل: انخفاض تكلفة الاستحواذ" : "ارتفاع تكلفة الحصول على كل طلب ناجح"}
          icon={<Target className="w-5 h-5 text-amber-600" />}
          gradient="from-amber-500/10 to-yellow-500/10"
          highlightNote={metrics.cpaGrowth.isPositive ? "توفير إيجابي 🟢" : "زيادة تكلفة 🔴"}
        />

        {/* Card 8: Average Order Value (AOV) */}
        <GrowthCard
          title="متوسط قيمة الطلبية (AOV)"
          currentValue={`${Math.round(metrics.aovGrowth.currentVal).toLocaleString()} د.ج`}
          previousValue={`${Math.round(metrics.aovGrowth.previousVal).toLocaleString()} د.ج`}
          deltaFormatted={metrics.aovGrowth.deltaFormatted}
          percentFormatted={metrics.aovGrowth.percentFormatted}
          isPositive={metrics.aovGrowth.isPositive}
          subtitle="معدل السلة الشرائية لكل عميل مستلم"
          icon={<Percent className="w-5 h-5 text-blue-600" />}
          gradient="from-cyan-500/10 to-blue-500/10"
        />
      </div>

      {/* Product-by-Product Growth Breakdown Table */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              جدول نمو المنتجات: أي المنتجات قادت النمو وأيها تراجعت؟
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              مقارنة مبيعات وأرباح كل منتج بين المرحلتين لمعرفة مصادر نموك وأين يجب توجيه الإعلانات.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="بحث عن منتج..."
              className="px-3.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />

            <select
              value={productSortBy}
              onChange={(e) => setProductSortBy(e.target.value as any)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700"
            >
              <option value="growthValue">ترتيب حسب فارق الربح (+ د.ج)</option>
              <option value="growthPercent">ترتيب حسب نسبة النمو (%)</option>
              <option value="currentProfit">ترتيب حسب أرباح الفترة الحالية</option>
              <option value="currentDelivered">ترتيب حسب عدد الطلبات المسلمة</option>
            </select>
          </div>
        </div>

        {productGrowthList.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full text-xs text-right">
              <thead className="bg-gray-50 text-gray-600 font-black border-b border-gray-200">
                <tr>
                  <th className="p-3.5 rounded-tr-2xl">المنتج</th>
                  <th className="p-3.5 text-center">الطلبات المسلّمة (الحالية 🆚 السابقة)</th>
                  <th className="p-3.5 text-center">الإيرادات الحالية</th>
                  <th className="p-3.5 text-center">أرباح الفترة الحالية</th>
                  <th className="p-3.5 text-center">أرباح الفترة السابقة</th>
                  <th className="p-3.5 text-center">فارق قيمة النمو</th>
                  <th className="p-3.5 text-center">نسبة النمو %</th>
                  <th className="p-3.5 text-center rounded-tl-2xl">تقييم الأداء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-bold">
                {productGrowthList.map((p, idx) => {
                  const isUp = p.profitDelta >= 0;
                  return (
                    <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="font-black text-gray-900">{p.name}</div>
                        {p.sku && <div className="text-[10px] text-gray-400 font-mono">{p.sku}</div>}
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-gray-900 font-black">{p.curDelivered}</span>
                          <span className="text-gray-400 font-normal">مقابل</span>
                          <span className="text-gray-500">{p.prevDelivered}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                            p.deliveredDelta >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                          }`}>
                            {p.deliveredDelta >= 0 ? `+${p.deliveredDelta}` : p.deliveredDelta}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 text-center text-gray-900 font-black">
                        {Math.round(p.curRevenue).toLocaleString()} د.ج
                      </td>

                      <td className="p-3.5 text-center text-emerald-700 font-black">
                        {Math.round(p.curProfit).toLocaleString()} د.ج
                      </td>

                      <td className="p-3.5 text-center text-gray-500 font-medium">
                        {Math.round(p.prevProfit).toLocaleString()} د.ج
                      </td>

                      <td className="p-3.5 text-center">
                        <span className={`font-black ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isUp ? '+' : ''}{Math.round(p.profitDelta).toLocaleString()} د.ج
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-black border ${
                          isUp ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {p.profitPercent > 0 ? '+' : ''}{p.profitPercent.toFixed(1)}%
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        {p.profitDelta > 10000 && p.profitPercent > 20 ? (
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black">
                            🚀 قائد النمو
                          </span>
                        ) : p.profitDelta > 0 ? (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black">
                            📈 نمو إيجابي
                          </span>
                        ) : p.profitDelta === 0 ? (
                          <span className="px-2 py-0.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-200 text-[10px] font-black">
                            ⚖️ أداء مستقر
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black">
                            🔻 تراجع يتطلب تدقيق
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-200 text-xs font-bold text-gray-400">
            لا توجد منتجات مسجلة ذات مبيعات في الفترتين المختارتين.
          </div>
        )}
      </div>
    </div>
  );
}

// Reusable Growth Metric Card
interface GrowthCardProps {
  title: string;
  currentValue: string;
  previousValue: string;
  deltaFormatted: string;
  percentFormatted: string;
  isPositive: boolean;
  subtitle: string;
  icon: React.ReactNode;
  gradient?: string;
  highlightNote?: string;
}

function GrowthCard({
  title,
  currentValue,
  previousValue,
  deltaFormatted,
  percentFormatted,
  isPositive,
  subtitle,
  icon,
  gradient = 'from-indigo-500/10 to-blue-500/10',
  highlightNote
}: GrowthCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
      {/* Background soft tint */}
      <div className={`absolute -right-8 -top-8 w-28 h-28 bg-gradient-to-br ${gradient} rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform`}></div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-black text-gray-600 truncate">{title}</span>
          <div className="p-2 bg-gray-50 rounded-xl border border-gray-100 shadow-2xs">
            {icon}
          </div>
        </div>

        {/* Current Value */}
        <div className="text-2xl font-black text-gray-900 tracking-tight">
          {currentValue}
        </div>

        {/* Growth Badge & Delta */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black border shadow-2xs ${
            isPositive 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            <span>{percentFormatted}</span>
          </span>

          <span className={`text-[11px] font-bold ${
            isPositive ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            ({deltaFormatted})
          </span>
        </div>
      </div>

      {/* Comparison & Context */}
      <div className="mt-4 pt-3 border-t border-gray-100 space-y-1">
        <div className="flex items-center justify-between text-[11px] text-gray-500 font-bold">
          <span>المرحلة السابقة:</span>
          <span className="text-gray-700 font-mono">{previousValue}</span>
        </div>
        <p className="text-[10px] text-gray-400 font-medium leading-tight">
          {subtitle}
        </p>
        {highlightNote && (
          <div className="text-[10px] font-black text-indigo-600 pt-0.5">
            {highlightNote}
          </div>
        )}
      </div>
    </div>
  );
}
