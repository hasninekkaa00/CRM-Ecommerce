import React, { useState, useMemo } from 'react';
import { Order, InventoryProduct } from '../../types';
import { 
  format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, 
  startOfMonth, endOfMonth, eachDayOfInterval, differenceInDays, isSameDay, isValid 
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  ResponsiveContainer, ComposedChart, Area, Line, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip as RechartsTooltip, Legend 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Package, Calendar, 
  DollarSign, Activity, CheckCircle, AlertTriangle, AlertCircle, Sparkles, 
  Filter, Layers, BarChart3, HelpCircle, ChevronRight, Eye, RefreshCw, Zap,
  Search, ShieldAlert, Award, Compass, ArrowRight, Download, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { safeParseDate } from '../../utils/financeCalculations';
import { checkProductMatch } from '../../utils/productFilters';
import { normalizeText } from '../../utils/productCostUtils';

interface RevenueTrendsAndProductImpactProps {
  orders: Order[];
  inventoryProducts: InventoryProduct[];
  campaigns?: any[];
  campaignRecords?: any[];
  expenses?: any[];
  settings: any;
  dateFilter: string;
  startDate: Date;
  endDate: Date;
  customStart?: string;
  customEnd?: string;
  productFilter: string;
  onSelectProductFilter: (prodName: string) => void;
  getOrderCosts: (o: any) => { totalCogs: number; extCost: number };
  getDeliveryDate: (o: any) => Date | null;
  getReturnDate: (o: any) => Date | null;
  getShippingDate: (o: any) => Date | null;
  mapStatusFn: (statusText: string, order?: any) => string;
}

const formatCurrency = (val: number): string => {
  return Math.round(Number(val) || 0).toLocaleString('fr-FR');
};

export function RevenueTrendsAndProductImpact({
  orders,
  inventoryProducts,
  campaigns = [],
  campaignRecords = [],
  expenses = [],
  settings,
  dateFilter,
  startDate,
  endDate,
  productFilter,
  onSelectProductFilter,
  getOrderCosts,
  getDeliveryDate,
  getReturnDate,
  getShippingDate,
  mapStatusFn
}: RevenueTrendsAndProductImpactProps) {
  // 1. Grouping interval mode: 'days' | 'weeks' | 'months'
  const [intervalMode, setIntervalMode] = useState<'days' | 'weeks' | 'months'>('weeks');

  // 2. Chart metric focus: 'net' | 'revenue' | 'costs' | 'all'
  const [chartMetric, setChartMetric] = useState<'net' | 'revenue' | 'costs' | 'all'>('all');

  // 3. Product analysis filter & search
  const [productVerdictFilter, setProductVerdictFilter] = useState<'all' | 'beneficial' | 'moderate' | 'waste'>('all');
  const [productSearch, setProductSearch] = useState('');
  const [inspectedProduct, setInspectedProduct] = useState<any | null>(null);

  // Return cost per order
  const defaultReturnCost = Number(settings?.returnCost) || 400;

  // Filter orders by productFilter if one is set
  const scopeOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.status1 === 'ملغى') return false;
      if (productFilter === 'all') return true;
      return checkProductMatch(o, productFilter, inventoryProducts);
    });
  }, [orders, productFilter, inventoryProducts]);

  // --------------------------------------------------------------------------
  // A. Build Interval Evolution Data (Days / Weeks / Months)
  // --------------------------------------------------------------------------
  const intervalEvolution = useMemo(() => {
    const sDate = startOfDay(startDate);
    const eDate = endOfDay(endDate);

    // Grouping container
    interface IntervalBucket {
      id: string;
      label: string;
      subLabel: string;
      startDate: Date;
      endDate: Date;
      deliveredOrders: Order[];
      returnedOrders: Order[];
      shippedOrders: Order[];
      deliveredCount: number;
      returnedCount: number;
      shippedCount: number;
      revenue: number;
      cogs: number;
      shippingCost: number;
      returnCost: number;
      netProfit: number;
      deliveryRate: number;
      productProfitMap: Map<string, { name: string; net: number; count: number }>;
    }

    const bucketsMap = new Map<string, IntervalBucket>();

    // Generate buckets according to intervalMode
    if (intervalMode === 'days') {
      const allDays = eachDayOfInterval({ start: sDate, end: eDate });
      allDays.forEach(day => {
        const id = format(day, 'yyyy-MM-dd');
        const label = format(day, 'yyyy-MM-dd');
        const subLabel = format(day, 'EEEE d MMMM', { locale: ar });
        bucketsMap.set(id, {
          id,
          label,
          subLabel,
          startDate: startOfDay(day),
          endDate: endOfDay(day),
          deliveredOrders: [],
          returnedOrders: [],
          shippedOrders: [],
          deliveredCount: 0,
          returnedCount: 0,
          shippedCount: 0,
          revenue: 0,
          cogs: 0,
          shippingCost: 0,
          returnCost: 0,
          netProfit: 0,
          deliveryRate: 0,
          productProfitMap: new Map()
        });
      });
    } else if (intervalMode === 'weeks') {
      let current = startOfWeek(sDate, { weekStartsOn: 6 }); // Starts Saturday (Standard in Algeria/MENA)
      while (current <= eDate) {
        const wEnd = endOfWeek(current, { weekStartsOn: 6 });
        const id = format(current, 'yyyy-') + 'W' + format(current, 'ww');
        const label = `الأسبوع ${format(current, 'ww')}`;
        const subLabel = `${format(current, 'd MMM')} - ${format(wEnd, 'd MMM', { locale: ar })}`;
        bucketsMap.set(id, {
          id,
          label,
          subLabel,
          startDate: startOfDay(current),
          endDate: endOfDay(wEnd),
          deliveredOrders: [],
          returnedOrders: [],
          shippedOrders: [],
          deliveredCount: 0,
          returnedCount: 0,
          shippedCount: 0,
          revenue: 0,
          cogs: 0,
          shippingCost: 0,
          returnCost: 0,
          netProfit: 0,
          deliveryRate: 0,
          productProfitMap: new Map()
        });
        current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    } else {
      // Months
      let current = startOfMonth(sDate);
      while (current <= eDate) {
        const mEnd = endOfMonth(current);
        const id = format(current, 'yyyy-MM');
        const label = format(current, 'MMMM yyyy', { locale: ar });
        const subLabel = format(current, 'yyyy-MM');
        bucketsMap.set(id, {
          id,
          label,
          subLabel,
          startDate: startOfDay(current),
          endDate: endOfDay(mEnd),
          deliveredOrders: [],
          returnedOrders: [],
          shippedOrders: [],
          deliveredCount: 0,
          returnedCount: 0,
          shippedCount: 0,
          revenue: 0,
          cogs: 0,
          shippingCost: 0,
          returnCost: 0,
          netProfit: 0,
          deliveryRate: 0,
          productProfitMap: new Map()
        });
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }
    }

    // Populate orders into buckets based on effective date
    scopeOrders.forEach(o => {
      const realStatus = o.isExchangedReturn ? 'مستلم' : mapStatusFn(o.status2 || '', o);
      if (['ملغى', 'ملغاة', 'إلغاء'].includes(realStatus)) return;

      const isDelivered = realStatus === 'مستلم';
      const isReturned = realStatus === 'مرتجع';
      const isShipped = !!o.shippingTrackingId || ['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع'].includes(o.status2 || '');

      const dDate = getDeliveryDate(o);
      const rDate = getReturnDate(o);
      const sDate = getShippingDate(o);

      // Target event date: Delivery date if delivered, return date if returned, order/ship date otherwise
      const effectiveDate = (isDelivered && dDate) ? dDate : ((isReturned && rDate) ? rDate : (sDate || safeParseDate(o.orderDate)));
      if (!effectiveDate) return;

      // Find matching bucket
      for (const bucket of bucketsMap.values()) {
        if (effectiveDate >= bucket.startDate && effectiveDate <= bucket.endDate) {
          const qty = Number(o.qnts) || 1;
          const rev = Number(o.totalCharge) || 0;
          const { totalCogs, extCost } = getOrderCosts(o);
          const realShp = Number(o.realDeliveryPrice) || Number(o.deliveryPrice) || 0;
          const pName = String(o.productName || 'منتج غير محدد').trim();

          if (isShipped) {
            bucket.shippedOrders.push(o);
            bucket.shippedCount += qty;
          }

          if (isDelivered) {
            bucket.deliveredOrders.push(o);
            bucket.deliveredCount += qty;
            bucket.revenue += rev;
            bucket.cogs += totalCogs;
            bucket.shippingCost += realShp;
            
            const itemNet = rev - realShp - totalCogs - extCost;
            bucket.netProfit += itemNet;

            // Track product contribution inside interval
            const pEntry = bucket.productProfitMap.get(pName) || { name: pName, net: 0, count: 0 };
            pEntry.net += itemNet;
            pEntry.count += qty;
            bucket.productProfitMap.set(pName, pEntry);
          } else if (isReturned) {
            bucket.returnedOrders.push(o);
            bucket.returnedCount += qty;
            const rCost = o.customReturnCost !== undefined ? Number(o.customReturnCost) : defaultReturnCost;
            bucket.returnCost += (rCost + extCost);
            bucket.netProfit -= (rCost + extCost);

            const pEntry = bucket.productProfitMap.get(pName) || { name: pName, net: 0, count: 0 };
            pEntry.net -= (rCost + extCost);
            pEntry.count += qty;
            bucket.productProfitMap.set(pName, pEntry);
          }
          break;
        }
      }
    });

    // Convert map to sorted list and compute delivery rates & top products
    const list = Array.from(bucketsMap.values()).map(b => {
      const closedOrders = b.deliveredCount + b.returnedCount;
      const deliveryRate = closedOrders > 0 ? Number(((b.deliveredCount / closedOrders) * 100).toFixed(1)) : 0;
      
      // Top contributing product
      let topProdName = '—';
      let topProdNet = -Infinity;
      b.productProfitMap.forEach((entry) => {
        if (entry.net > topProdNet) {
          topProdNet = entry.net;
          topProdName = entry.name;
        }
      });

      return {
        ...b,
        deliveryRate,
        topProductName: topProdNet > 0 ? topProdName : '—',
        topProductNet: topProdNet > 0 ? topProdNet : 0,
        totalCosts: b.cogs + b.shippingCost + b.returnCost
      };
    });

    // Compute period-over-period differences (النمو والتطور مقارنة بالفترة السابقة)
    const withDiffs = list.map((item, idx) => {
      const prev = idx > 0 ? list[idx - 1] : null;
      let netDiff = 0;
      let netGrowthPercent = 0;
      let revDiff = 0;
      let revGrowthPercent = 0;

      if (prev) {
        netDiff = item.netProfit - prev.netProfit;
        if (prev.netProfit !== 0) {
          netGrowthPercent = Number(((netDiff / Math.abs(prev.netProfit)) * 100).toFixed(1));
        } else {
          netGrowthPercent = item.netProfit > 0 ? 100 : 0;
        }

        revDiff = item.revenue - prev.revenue;
        if (prev.revenue !== 0) {
          revGrowthPercent = Number(((revDiff / prev.revenue) * 100).toFixed(1));
        } else {
          revGrowthPercent = item.revenue > 0 ? 100 : 0;
        }
      }

      return {
        ...item,
        prevNetProfit: prev ? prev.netProfit : null,
        netDiff,
        netGrowthPercent,
        revDiff,
        revGrowthPercent,
        hasPrev: !!prev
      };
    });

    return withDiffs;
  }, [scopeOrders, intervalMode, startDate, endDate, defaultReturnCost, getDeliveryDate, getReturnDate, getShippingDate, getOrderCosts, mapStatusFn]);

  // Comparative Headline: Current Period vs Previous Period
  const comparativeSummary = useMemo(() => {
    if (!intervalEvolution || intervalEvolution.length === 0) return null;

    // Filter buckets that have at least some activity or the last 2 valid buckets
    const activeBuckets = intervalEvolution.filter(b => b.deliveredCount > 0 || b.returnedCount > 0 || b.shippedCount > 0);
    if (activeBuckets.length === 0) {
      return {
        current: intervalEvolution[intervalEvolution.length - 1] || null,
        previous: null,
        growthDiff: 0,
        growthPercent: 0,
        isPositive: true
      };
    }

    const current = activeBuckets[activeBuckets.length - 1];
    const previous = activeBuckets.length > 1 ? activeBuckets[activeBuckets.length - 2] : null;

    let growthDiff = 0;
    let growthPercent = 0;
    if (previous) {
      growthDiff = current.netProfit - previous.netProfit;
      if (previous.netProfit !== 0) {
        growthPercent = Number(((growthDiff / Math.abs(previous.netProfit)) * 100).toFixed(1));
      } else {
        growthPercent = current.netProfit > 0 ? 100 : 0;
      }
    }

    return {
      current,
      previous,
      growthDiff,
      growthPercent,
      isPositive: growthDiff >= 0
    };
  }, [intervalEvolution]);

  // --------------------------------------------------------------------------
  // B. Product Profitability & ROI Matrix ("هل المنتج مفيد أم جهد إضافي؟")
  // --------------------------------------------------------------------------
  const productsAnalysis = useMemo(() => {
    interface ProductStats {
      id: string;
      name: string;
      sku: string;
      shippedCount: number;
      deliveredCount: number;
      returnedCount: number;
      revenue: number;
      cogs: number;
      shippingCost: number;
      returnCost: number;
      netProfit: number;
      deliveryRate: number;
      marginPercent: number;
      profitPerShipped: number;
      firstOrderDate: string;
      daysSinceLaunch: number;
      verdict: 'beneficial' | 'moderate' | 'waste';
      verdictLabel: string;
      verdictDescription: string;
    }

    const map = new Map<string, ProductStats>();

    // Process all orders for product impact
    orders.forEach(o => {
      const realStatus = o.isExchangedReturn ? 'مستلم' : mapStatusFn(o.status2 || '', o);
      if (['ملغى', 'ملغاة', 'إلغاء'].includes(realStatus)) return;

      const pName = String(o.productName || 'منتج غير محدد').trim();
      const normName = normalizeText(pName);
      if (!normName) return;

      const qty = Number(o.qnts) || 1;
      const rev = Number(o.totalCharge) || 0;
      const { totalCogs, extCost } = getOrderCosts(o);
      const realShp = Number(o.realDeliveryPrice) || Number(o.deliveryPrice) || 0;
      const oDateStr = o.orderDate ? o.orderDate.substring(0, 10) : '';

      const isDelivered = realStatus === 'مستلم';
      const isReturned = realStatus === 'مرتجع';
      const isShipped = !!o.shippingTrackingId || ['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع'].includes(o.status2 || '');

      let st = map.get(normName);
      if (!st) {
        st = {
          id: normName,
          name: pName,
          sku: o.sku || '',
          shippedCount: 0,
          deliveredCount: 0,
          returnedCount: 0,
          revenue: 0,
          cogs: 0,
          shippingCost: 0,
          returnCost: 0,
          netProfit: 0,
          deliveryRate: 0,
          marginPercent: 0,
          profitPerShipped: 0,
          firstOrderDate: oDateStr,
          daysSinceLaunch: 0,
          verdict: 'moderate',
          verdictLabel: '',
          verdictDescription: ''
        };
        map.set(normName, st);
      }

      // Track earliest date
      if (oDateStr && (!st.firstOrderDate || oDateStr < st.firstOrderDate)) {
        st.firstOrderDate = oDateStr;
      }
      if (!st.sku && o.sku) {
        st.sku = o.sku;
      }

      if (isShipped) {
        st.shippedCount += qty;
      }

      if (isDelivered) {
        st.deliveredCount += qty;
        st.revenue += rev;
        st.cogs += totalCogs;
        st.shippingCost += realShp;
        st.netProfit += (rev - realShp - totalCogs - extCost);
      } else if (isReturned) {
        st.returnedCount += qty;
        const rCost = o.customReturnCost !== undefined ? Number(o.customReturnCost) : defaultReturnCost;
        st.returnCost += (rCost + extCost);
        st.netProfit -= (rCost + extCost);
      }
    });

    const now = new Date();

    // Finalize metrics and classify verdict
    const evaluated = Array.from(map.values()).map(st => {
      const closed = st.deliveredCount + st.returnedCount;
      const deliveryRate = closed > 0 ? Number(((st.deliveredCount / closed) * 100).toFixed(1)) : 0;
      const marginPercent = st.revenue > 0 ? Number(((st.netProfit / st.revenue) * 100).toFixed(1)) : 0;
      const profitPerShipped = st.shippedCount > 0 ? Math.round(st.netProfit / st.shippedCount) : 0;

      let daysSinceLaunch = 0;
      if (st.firstOrderDate) {
        try {
          daysSinceLaunch = differenceInDays(now, parseISO(st.firstOrderDate));
        } catch {}
      }

      // 🧠 Smart Verdict Logic
      // 1. Waste (جهد إضافي): Negative profit, or very low margin (< 150 DZD/shipped order), or awful delivery (< 50%)
      // 2. Beneficial (مفيد ومربح): Net profit > 0, profitPerShipped >= 400 DZD, deliveryRate >= 65%
      // 3. Moderate: In-between
      let verdict: 'beneficial' | 'moderate' | 'waste' = 'moderate';
      let verdictLabel = 'منتج متوسط / أرباح متوازنة';
      let verdictDescription = 'يحقق ربحاً صافياً مقبولاً مع هامش متوسط. يستحق الاستمرار مع ضبط مصاريف الشحن.';

      if (st.netProfit <= 0 || (deliveryRate < 50 && st.shippedCount >= 5) || (profitPerShipped < 200 && st.shippedCount >= 10)) {
        verdict = 'waste';
        verdictLabel = '⚠️ جهد إضافي دون فائدة كافية';
        verdictDescription = st.netProfit <= 0
          ? 'المنتج يسبب خسارة صافية بعد احتساب الشحن المرتجع وتكلفة السلعة. يُفضل إيقافه فوراً.'
          : 'الربح الصافي ضئيل جداً مقارنة بالمجهود اللوجستي ومصاريف المرتجع (أقل من 200 د.ج للطلبية).';
      } else if (st.netProfit > 0 && profitPerShipped >= 450 && deliveryRate >= 65) {
        verdict = 'beneficial';
        verdictLabel = '🌟 منتج عالي الجدوى والربحية';
        verdictDescription = `منتج ممتاز يدر متوسط ${formatCurrency(profitPerShipped)} د.ج صافي لكل طرد مشحون بنسبة تسليم ${deliveryRate}%. ركّز عليه وزد كمياته.`;
      }

      return {
        ...st,
        deliveryRate,
        marginPercent,
        profitPerShipped,
        daysSinceLaunch,
        verdict,
        verdictLabel,
        verdictDescription
      };
    });

    // Sort by Net Profit descending
    return evaluated.sort((a, b) => b.netProfit - a.netProfit);
  }, [orders, defaultReturnCost, getDeliveryDate, getReturnDate, getOrderCosts, mapStatusFn]);

  // Filtered Products Analysis
  const filteredProducts = useMemo(() => {
    let list = productsAnalysis;

    if (productVerdictFilter !== 'all') {
      list = list.filter(p => p.verdict === productVerdictFilter);
    }

    if (productSearch.trim()) {
      const q = productSearch.toLowerCase().trim();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }

    return list;
  }, [productsAnalysis, productVerdictFilter, productSearch]);

  // Overall Totals
  const totals = useMemo(() => {
    let totalRevenue = 0;
    let totalNet = 0;
    let totalDelivered = 0;
    let totalShipped = 0;
    let totalReturned = 0;

    intervalEvolution.forEach(b => {
      totalRevenue += b.revenue;
      totalNet += b.netProfit;
      totalDelivered += b.deliveredCount;
      totalShipped += b.shippedCount;
      totalReturned += b.returnedCount;
    });

    const totalClosed = totalDelivered + totalReturned;
    const overallDeliveryRate = totalClosed > 0 ? Number(((totalDelivered / totalClosed) * 100).toFixed(1)) : 0;
    const avgProfitPerShipped = totalShipped > 0 ? Math.round(totalNet / totalShipped) : 0;

    return {
      totalRevenue,
      totalNet,
      totalDelivered,
      totalShipped,
      totalReturned,
      overallDeliveryRate,
      avgProfitPerShipped
    };
  }, [intervalEvolution]);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* 🚀 Top Comparative Evolution Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-900/50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 rounded-full text-xs font-black text-indigo-300">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <span>مؤشر تطور المداخيل وصافي الأرباح الحقيقية</span>
            </div>
            
            <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>تطور الأرباح:</span>
              <span className="text-emerald-400 font-mono">
                {comparativeSummary?.current ? formatCurrency(comparativeSummary.current.netProfit) : 0} د.ج
              </span>
              {comparativeSummary?.previous && (
                <span className={`inline-flex items-center gap-1 text-sm font-black px-2.5 py-1 rounded-full ${
                  comparativeSummary.isPositive 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {comparativeSummary.isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  <span dir="ltr">{comparativeSummary.growthPercent > 0 ? `+${comparativeSummary.growthPercent}%` : `${comparativeSummary.growthPercent}%`}</span>
                </span>
              )}
            </h3>

            {/* Explanatory sentence for the user */}
            <p className="text-sm text-slate-300 font-medium leading-relaxed max-w-2xl">
              {comparativeSummary?.previous ? (
                <>
                  في {intervalMode === 'days' ? 'اليوم السابق' : intervalMode === 'weeks' ? 'الأسبوع السابق' : 'الشهر السابق'} ({comparativeSummary.previous.label}) حققت صافي <strong className="text-white">{formatCurrency(comparativeSummary.previous.netProfit)} د.ج</strong>، بينما في الفاصل الحالي ({comparativeSummary.current?.label}) تحقق صافي <strong className="text-emerald-400">{formatCurrency(comparativeSummary.current?.netProfit || 0)} د.ج</strong> ({comparativeSummary.isPositive ? 'بزيادة صافية قدرها' : 'بانخفاض قدره'} {formatCurrency(Math.abs(comparativeSummary.growthDiff))} د.ج).
                </>
              ) : (
                'يعرض هذا القسم مسار نمو صافي أرباحك الحقيقية بعد خصم تكلفة شراء السلع، ومصاريف الشحن، وتكاليف الطرود المرتجعة.'
              )}
            </p>
          </div>

          {/* Quick Interval Switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 shrink-0">
            <span className="text-xs font-bold text-slate-300 px-3 hidden sm:inline">تقسيم التطور:</span>
            <button
              type="button"
              onClick={() => setIntervalMode('days')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                intervalMode === 'days' 
                  ? 'bg-white text-slate-900 shadow-md scale-102' 
                  : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>يومي (Days)</span>
            </button>
            <button
              type="button"
              onClick={() => setIntervalMode('weeks')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                intervalMode === 'weeks' 
                  ? 'bg-white text-slate-900 shadow-md scale-102' 
                  : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>أسبوعي (Weeks)</span>
            </button>
            <button
              type="button"
              onClick={() => setIntervalMode('months')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                intervalMode === 'months' 
                  ? 'bg-white text-slate-900 shadow-md scale-102' 
                  : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>شهري (Months)</span>
            </button>
          </div>
        </div>

        {/* Quick KPI stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] font-bold text-slate-400 block">إجمالي الصافي في هذه الفترة</span>
            <span className="text-lg font-black text-emerald-400 font-mono mt-0.5 block">
              {formatCurrency(totals.totalNet)} د.ج
            </span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] font-bold text-slate-400 block">إجمالي المبيعات (رقم الأعمال)</span>
            <span className="text-lg font-black text-white font-mono mt-0.5 block">
              {formatCurrency(totals.totalRevenue)} د.ج
            </span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] font-bold text-slate-400 block">نسبة التوصيل العامة</span>
            <span className="text-lg font-black text-indigo-300 font-mono mt-0.5 block">
              {totals.overallDeliveryRate}%
            </span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] font-bold text-slate-400 block">معدل الصافي لكل طرد مشحون</span>
            <span className="text-lg font-black text-amber-300 font-mono mt-0.5 block">
              {formatCurrency(totals.avgProfitPerShipped)} د.ج
            </span>
          </div>
        </div>
      </div>

      {/* 📊 Evolution Chart Section */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h4 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <span>مخطط مسار تطور المداخيل وصافي الأرباح</span>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold">
                {intervalMode === 'days' ? 'عرض يومي' : intervalMode === 'weeks' ? 'عرض أسبوعي' : 'عرض شهري'}
              </span>
            </h4>
            <p className="text-xs text-slate-500 font-medium mt-1">
              تتبع الارتفاعات والانخفاضات في صافي الأرباح لتحديد أفضل الفترات التي حقق فيها المتجر عائداً مجزياً.
            </p>
          </div>

          {/* Metric Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setChartMetric('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                chartMetric === 'all' ? 'bg-white text-indigo-700 shadow-xs font-black' : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              شامل (الصافي والمبيعات)
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('net')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                chartMetric === 'net' ? 'bg-white text-emerald-700 shadow-xs font-black' : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              صافي الربح فقط
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('revenue')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                chartMetric === 'revenue' ? 'bg-white text-blue-700 shadow-xs font-black' : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              المبيعات والتكاليف
            </button>
          </div>
        </div>

        {/* Recharts Canvas */}
        <div className="h-80 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={intervalEvolution} margin={{ top: 15, right: 15, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="gradientNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradientRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} 
                axisLine={false} 
                tickLine={false}
                dy={10} 
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} 
                dx={-10}
              />
              <RechartsTooltip
                formatter={(value: any, name: any) => [
                  `${formatCurrency(value)} د.ج`,
                  name
                ]}
                labelFormatter={(label) => `الفترة: ${label}`}
                contentStyle={{ 
                  borderRadius: '16px', 
                  border: 'none', 
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', 
                  direction: 'rtl',
                  fontFamily: 'inherit',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '15px', fontWeight: 'bold', fontSize: '12px' }} />

              {(chartMetric === 'all' || chartMetric === 'revenue') && (
                <Bar 
                  dataKey="revenue" 
                  name="المبيعات (رقم الأعمال)" 
                  fill="#6366f1" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={32} 
                />
              )}

              {(chartMetric === 'all' || chartMetric === 'costs') && (
                <Bar 
                  dataKey="totalCosts" 
                  name="إجمالي التكاليف (سلعة + شحن + مرتجع)" 
                  fill="#f43f5e" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={32} 
                />
              )}

              {(chartMetric === 'all' || chartMetric === 'net') && (
                <Area 
                  type="monotone" 
                  dataKey="netProfit" 
                  name="صافي الربح الحقيقي" 
                  stroke="#10b981" 
                  strokeWidth={3.5} 
                  fill="url(#gradientNet)" 
                  dot={intervalEvolution.length <= 25 ? { r: 3.5, strokeWidth: 2, fill: '#10b981' } : false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 📅 Period-by-Period Evolution Breakdown Table */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <span>جدول مقارنة الفترات وتحولات المداخيل</span>
            </h4>
            <p className="text-xs text-slate-500 font-medium mt-1">
              مقارنة رقمية دقيقة لكل {intervalMode === 'days' ? 'يوم' : intervalMode === 'weeks' ? 'أسبوع' : 'شهر'} مع بيان نسبة النمو والفارق المالي.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black">
              <tr>
                <th className="py-3 px-4">الفترة الزمنية</th>
                <th className="py-3 px-4 text-center">الطلبيات المستلمة</th>
                <th className="py-3 px-4 text-center">نسبة التوصيل</th>
                <th className="py-3 px-4">رقم الأعمال</th>
                <th className="py-3 px-4">التكاليف (السلعة والشحن)</th>
                <th className="py-3 px-4">تكلفة المرتجع</th>
                <th className="py-3 px-4">صافي الربح الفعلي</th>
                <th className="py-3 px-4 text-center">التطور vs السابق</th>
                <th className="py-3 px-4">المنتج الأعلى ربحاً</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {intervalEvolution.map((bucket, idx) => (
                <tr key={bucket.id} className="hover:bg-indigo-50/40 transition-colors">
                  <td className="py-3 px-4 font-black text-slate-900">
                    <div>{bucket.label}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{bucket.subLabel}</div>
                  </td>
                  <td className="py-3 px-4 text-center font-bold font-mono">
                    {bucket.deliveredCount} <span className="text-[10px] text-slate-400">من {bucket.shippedCount}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      bucket.deliveryRate >= 70 ? 'bg-emerald-100 text-emerald-800' :
                      bucket.deliveryRate >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {bucket.deliveryRate}%
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    {formatCurrency(bucket.revenue)} د.ج
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {formatCurrency(bucket.cogs + bucket.shippingCost)} د.ج
                  </td>
                  <td className="py-3 px-4 font-mono text-rose-600">
                    {bucket.returnCost > 0 ? `-${formatCurrency(bucket.returnCost)} د.ج` : '0 د.ج'}
                  </td>
                  <td className={`py-3 px-4 font-black font-mono text-sm ${
                    bucket.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {bucket.netProfit >= 0 ? '+' : ''}{formatCurrency(bucket.netProfit)} د.ج
                  </td>
                  <td className="py-3 px-4 text-center">
                    {bucket.hasPrev ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black ${
                        bucket.netDiff >= 0 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {bucket.netDiff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span dir="ltr">{bucket.netGrowthPercent > 0 ? `+${bucket.netGrowthPercent}%` : `${bucket.netGrowthPercent}%`}</span>
                      </span>
                    ) : (
                      <span className="text-slate-300 text-[10px]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {bucket.topProductName !== '—' ? (
                      <button
                        type="button"
                        onClick={() => onSelectProductFilter(bucket.topProductName)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
                        title="فلترة التقارير لهذا المنتج"
                      >
                        <span className="truncate max-w-[140px]">{bucket.topProductName}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[10px]">لا توجد مبيعات</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🎯 CORE USER QUESTION: "هل المنتج الجديد عاد علينا بالفائدة أم مجرد جهد إضافي؟" */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/80 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full text-[11px] font-black">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>مصفوفة جدوى المنتجات والعائد الحقيقي</span>
            </div>
            <h4 className="text-xl font-black text-slate-900 tracking-tight">
              هل المنتج الجديد عاد علينا بالفائدة أم مجرد جهد إضافي؟
            </h4>
            <p className="text-xs text-slate-500 font-medium max-w-2xl">
              تحليل دقيق لصافي أرباح كل منتج، ونسبة التسليم، وهامش الربح الحقيقي لكل طرد تم شحنه لتحديد المنتجات الرابحة فعلياً وفرز المنتجات التي تستهلك الوقت ومصاريف المرتجع دون فائدة.
            </p>
          </div>

          {/* Verdict Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setProductVerdictFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                productVerdictFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({productsAnalysis.length})
            </button>
            <button
              type="button"
              onClick={() => setProductVerdictFilter('beneficial')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                productVerdictFilter === 'beneficial' ? 'bg-emerald-600 text-white shadow-xs font-black' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>رابحة وذات جدوى</span>
            </button>
            <button
              type="button"
              onClick={() => setProductVerdictFilter('waste')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                productVerdictFilter === 'waste' ? 'bg-rose-600 text-white shadow-xs font-black' : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>جهد إضافي / خسارة</span>
            </button>
            <button
              type="button"
              onClick={() => setProductVerdictFilter('moderate')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                productVerdictFilter === 'moderate' ? 'bg-amber-600 text-white shadow-xs font-black' : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              متوسطة
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="ابحث عن منتج أو رمز SKU لتقييم جدواه..."
              className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>
          {productFilter !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectProductFilter('all')}
              className="px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>إلغاء عزل المنتج الحالي: {productFilter}</span>
            </button>
          )}
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              className={`rounded-2xl p-5 border transition-all duration-150 flex flex-col justify-between ${
                prod.verdict === 'beneficial' 
                  ? 'bg-emerald-50/30 border-emerald-200 hover:border-emerald-400 shadow-2xs' 
                  : prod.verdict === 'waste'
                  ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400 shadow-2xs'
                  : 'bg-slate-50/40 border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="space-y-3">
                {/* Header: Title + Verdict badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h5 className="font-black text-sm text-slate-900 leading-snug line-clamp-2" title={prod.name}>
                      {prod.name}
                    </h5>
                    {prod.sku && (
                      <span className="text-[10px] font-mono font-bold text-slate-400 block mt-0.5">
                        SKU: {prod.sku}
                      </span>
                    )}
                  </div>

                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 ${
                    prod.verdict === 'beneficial' ? 'bg-emerald-100 text-emerald-800' :
                    prod.verdict === 'waste' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {prod.verdict === 'beneficial' ? <ThumbsUp className="w-3 h-3" /> : prod.verdict === 'waste' ? <ThumbsDown className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                    <span>{prod.verdict === 'beneficial' ? 'مفيد ورابح' : prod.verdict === 'waste' ? 'جهد إضافي' : 'متوسط'}</span>
                  </span>
                </div>

                {/* Net Profit & Margin Banner */}
                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">صافي الربح المحقق</span>
                    <span className={`text-base font-black font-mono ${prod.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {prod.netProfit >= 0 ? '+' : ''}{formatCurrency(prod.netProfit)} د.ج
                    </span>
                  </div>
                  <div className="text-left border-r border-slate-100 pr-3">
                    <span className="text-[10px] text-slate-400 font-bold block">هامش الربح</span>
                    <span className={`text-sm font-black font-mono ${prod.marginPercent >= 25 ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {prod.marginPercent}%
                    </span>
                  </div>
                </div>

                {/* Key operational metrics */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-bold">المستلم</span>
                    <span className="font-black text-slate-800 font-mono">{prod.deliveredCount}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-bold">نسبة التوصيل</span>
                    <span className={`font-black font-mono ${prod.deliveryRate >= 65 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {prod.deliveryRate}%
                    </span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-bold">الصافي/طرد</span>
                    <span className={`font-black font-mono text-[11px] ${prod.profitPerShipped >= 400 ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {formatCurrency(prod.profitPerShipped)} د.ج
                    </span>
                  </div>
                </div>

                {/* Intelligent Verdict Explanation */}
                <div className={`p-2.5 rounded-xl text-[11px] leading-relaxed font-medium ${
                  prod.verdict === 'beneficial' ? 'bg-emerald-100/60 text-emerald-900 border border-emerald-200/60' :
                  prod.verdict === 'waste' ? 'bg-rose-100/60 text-rose-900 border border-rose-200/60' :
                  'bg-amber-100/60 text-amber-900 border border-amber-200/60'
                }`}>
                  {prod.verdictDescription}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400 font-bold">
                  بدء البيع: {prod.firstOrderDate || 'غير محدد'} ({prod.daysSinceLaunch} يوم)
                </span>

                <button
                  type="button"
                  onClick={() => onSelectProductFilter(prod.name)}
                  className="px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                >
                  <span>عزل وتحليل</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 font-bold text-xs">
            لا توجد منتجات تطابق معايير البحث والفلترة المحددة.
          </div>
        )}
      </div>

    </div>
  );
}
