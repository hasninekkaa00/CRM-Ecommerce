import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { getOrderUnitAndTotalCost } from '../../utils/productCostUtils';
import { getEffectiveShippingCost } from '../../utils/shippingFees';
import { checkProductMatch, isCampaignMatchedToProduct } from '../../utils/productFilters';

import { mapStatusToStatus2, getDeliveryDate, getReturnDate, getOrderCosts, calculateTotalCampaignSpend, createFinanceCalculator } from '../../utils/financeCalculations';

import { format, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  TrendingUp, TrendingDown, DollarSign, Activity, Package, Percent, Target, 
  Truck, Megaphone, Banknote, Calendar, PieChart as PieChartIcon,
  Coins, AlertTriangle, ArrowUpDown, Search, Sparkles, ShieldAlert, 
  CheckCircle2, Layers, HelpCircle, Info, Zap, ArrowUpRight, ArrowDownRight,
  Filter, X
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area, LineChart, Line, Legend
} from 'recharts';

const formatCurrency = (val: number) => {
  return Math.round(Number(val) || 0).toLocaleString('fr-FR');
};

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function IndicatorsDashboard() {
  const { 
    orders, campaigns, campaignRecords, inventoryProducts, 
    expenses, settings, campaignFields,
    globalProductFilter
  } = useStore();

  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>(() => {
    const saved = localStorage.getItem('indicators_dateFilter');
    return (saved === 'today' || saved === 'week' || saved === 'month' || saved === 'all') ? saved : 'month';
  });

  // State for products analysis table
  const [productSearch, setProductSearch] = useState('');
  const [productSortBy, setProductSortBy] = useState<'returnToAdSpendRatio' | 'profitRoas' | 'revenueRoas' | 'adSpend' | 'realNet' | 'returnedCount'>('returnToAdSpendRatio');
  const [productSortOrder, setProductSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showInfoModal, setShowInfoModal] = useState(false);

  React.useEffect(() => {
    localStorage.setItem('indicators_dateFilter', dateFilter);
  }, [dateFilter]);

  // Time periods
  const now = new Date();
  const periods = useMemo(() => {
    return {
      today: { start: startOfDay(now), end: endOfDay(now) },
      week: { start: startOfWeek(now, { weekStartsOn: 6 }), end: endOfWeek(now, { weekStartsOn: 6 }) },
      month: { start: startOfMonth(now), end: endOfDay(now) }
    };
  }, [now]);

  // Active Period
  const activePeriod = dateFilter === 'all' ? null : periods[dateFilter];

  // 1. Calculate Days since first order
  const daysSinceStart = useMemo(() => {
    if (orders.length === 0) return 1;
    let earliest = now.getTime();
    orders.forEach(o => {
      if (o.orderDate) {
        const d = parseISO(o.orderDate).getTime();
        if (d < earliest) earliest = d;
      }
    });
    const diff = differenceInDays(now, new Date(earliest));
    return diff > 0 ? diff : 1;
  }, [orders, now]);

  // 2. Finance Metrics Calculation Function
  const calculateFinance = (periodStart?: Date, periodEnd?: Date, forceAll: boolean = false) => {
    const activeFilter = forceAll ? 'all' : dateFilter;
    const pStart = periodStart || null;
    const pEnd = periodEnd || null;
    const startParam = periods['month']?.start || null;

    const calc = createFinanceCalculator(
      orders,
      expenses,
      campaigns,
      campaignRecords,
      settings,
      inventoryProducts,
      activeFilter,
      pStart,
      pEnd,
      globalProductFilter || 'all',
      'all',
      startParam
    );

    return { 
        expectedNet: calc.expectedNetProfit, 
        realNet: calc.realNetProfit, 
        combinedNet: calc.totalCombinedNetProfit, 
        realRevTotal: calc.realRev, 
        expectedRevTotal: calc.expectedRev,
        realCount: calc.realCount,
        expectedCount: calc.expectedCount,
        returnedCount: calc.returnedCount,
        returnCostTotal: calc.returnCostTotal || 0,
        adSpendDZD: calc.adSpendDZD || 0,
        totalCosts: calc.totalCosts,
        realRev: calc.realRev
    };
  };

  const currentMetrics = calculateFinance(activePeriod?.start, activePeriod?.end);
  const totalMetrics = calculateFinance(undefined, undefined, true); // For daily average (All time)

  // Core ROAS & Return vs Ad Spend Metrics (Global)
  const globalProfitRoas = currentMetrics.adSpendDZD > 0 
    ? (currentMetrics.realNet / currentMetrics.adSpendDZD) 
    : 0;

  const globalRevenueRoas = currentMetrics.adSpendDZD > 0 
    ? (currentMetrics.realRev / currentMetrics.adSpendDZD) 
    : 0;

  const globalReturnToAdSpendRatio = currentMetrics.adSpendDZD > 0 
    ? (currentMetrics.returnCostTotal / currentMetrics.adSpendDZD) * 100 
    : 0;

  // 3. Shipped Orders Stats
  const shippedOrdersStats = useMemo(() => {
    const filtered = orders.filter(o => {
      if (globalProductFilter && globalProductFilter !== 'all' && !checkProductMatch(o, globalProductFilter, inventoryProducts)) return false;
      if (!o.orderDate) return false;
      if (activePeriod) {
        return isWithinInterval(parseISO(o.orderDate), { start: activePeriod.start, end: activePeriod.end });
      }
      return true;
    });

    const totalReceived = filtered.length;
    const confirmed = filtered.filter(o => o.status1 === 'مؤكد' || o.status1 === 'مؤكد جزئيا' || o.status2).length;
    const cancelled = filtered.filter(o => o.status1 === 'ملغى' || o.status1 === 'ملغاة' || o.status1 === 'إلغاء').length;
    const pending = totalReceived - confirmed - cancelled;

    return {
      totalReceived,
      confirmed,
      pending: pending > 0 ? pending : 0,
      confirmedPct: totalReceived > 0 ? (confirmed / totalReceived) * 100 : 0,
      pendingPct: totalReceived > 0 ? (pending > 0 ? pending / totalReceived : 0) * 100 : 0
    };
  }, [orders, activePeriod, globalProductFilter, inventoryProducts]);

  const funnelData = [
    { name: 'مستلمة', value: shippedOrdersStats.totalReceived, color: '#9ca3af' },
    { name: 'مؤكدة', value: shippedOrdersStats.confirmed, color: '#3b82f6' },
    { name: 'قيد الانتظار', value: shippedOrdersStats.pending, color: '#f59e0b' }
  ];

  // 3.5 Weekly Performance Data (Last 7 Days)
  const weeklyPerformanceData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = startOfDay(d);
      const dayEnd = endOfDay(d);
      
      const dayMetrics = calculateFinance(dayStart, dayEnd);
      days.push({
        name: format(d, 'EEEE', { locale: ar }),
        shortDate: format(d, 'MM/dd'),
        الربح: dayMetrics.realNet,
        المبيعات: dayMetrics.realRevTotal,
      });
    }
    return days;
  }, [orders, expenses, campaignRecords, settings, globalProductFilter, inventoryProducts]);

  // 4. Products Analysis: Return Cost vs Ad Spend & Profit ROAS Breakdown
  const productsPerformanceList = useMemo(() => {
    const pMap = new Map<string, { id: string; name: string; sku: string; category?: string }>();

    (inventoryProducts || []).forEach(p => {
      if (p.id) {
        pMap.set(p.id, {
          id: p.id,
          name: p.name || 'بدون اسم',
          sku: p.sku || '',
          category: p.category
        });
      }
    });

    (orders || []).forEach(o => {
      const pName = (o.productName || '').trim();
      if (pName && !Array.from(pMap.values()).some(p => p.name === pName || (p.sku && p.sku === o.sku))) {
        const key = `ord_${pName}`;
        if (!pMap.has(key)) {
          pMap.set(key, {
            id: pName,
            name: pName,
            sku: o.sku || '',
            category: 'من الطلبيات'
          });
        }
      }
    });

    let list = Array.from(pMap.values());
    if (globalProductFilter && globalProductFilter !== 'all') {
      list = list.filter(p => p.id === globalProductFilter || p.sku === globalProductFilter || p.name === globalProductFilter);
    }

    return list.map(prod => {
      const calc = createFinanceCalculator(
        orders,
        expenses,
        campaigns,
        campaignRecords,
        settings,
        inventoryProducts,
        dateFilter,
        activePeriod?.start || null,
        activePeriod?.end || null,
        prod.id,
        'all',
        periods['month']?.start || null
      );

      const adSpend = calc.adSpendDZD || 0;
      const realRev = calc.realRev || 0;
      const realCount = calc.realCount || 0;
      const returnedCount = calc.returnedCount || 0;
      const returnCost = calc.returnCostTotal || 0;
      
      // Calculate product-level net profit (Gross minus product return costs and product ad spend)
      const realNet = calc.realGrossProfit - returnCost - adSpend;
      const totalShippedAndDelivered = realCount + returnedCount;

      // Delivery and Return Rates
      const returnRate = totalShippedAndDelivered > 0 ? (returnedCount / totalShippedAndDelivered) * 100 : 0;
      const deliveryRate = totalShippedAndDelivered > 0 ? (realCount / totalShippedAndDelivered) * 100 : 0;

      // 1. ROAS الفائدة (Profit ROAS / POAS)
      const profitRoas = adSpend > 0 ? (realNet / adSpend) : 0;

      // 2. ROAS المبيعات (Revenue ROAS)
      const revenueRoas = adSpend > 0 ? (realRev / adSpend) : 0;

      // 3. نسبة الروتورن للمصروف الإعلاني (Return Cost / Ad Spend %)
      const returnToAdSpendRatio = adSpend > 0 ? (returnCost / adSpend) * 100 : 0;

      // Cost of returns per 1,000 DZD of ad spend
      const returnCostPer1kAds = adSpend > 0 ? (returnCost / adSpend) * 1000 : 0;

      // Diagnosis status
      let status: 'high_profit' | 'warning_return' | 'danger_bleed' | 'healthy' | 'no_ads' = 'healthy';
      if (adSpend === 0) {
        status = 'no_ads';
      } else if (returnToAdSpendRatio > 40 || realNet < 0) {
        status = 'danger_bleed';
      } else if (returnToAdSpendRatio >= 20 || returnRate > 25) {
        status = 'warning_return';
      } else if (profitRoas >= 1.5) {
        status = 'high_profit';
      }

      return {
        id: prod.id,
        name: prod.name,
        sku: prod.sku,
        category: prod.category || 'عام',
        adSpend,
        realRev,
        realNet,
        realCount,
        returnedCount,
        returnCost,
        totalShippedAndDelivered,
        returnRate,
        deliveryRate,
        profitRoas,
        revenueRoas,
        returnToAdSpendRatio,
        returnCostPer1kAds,
        status
      };
    }).filter(p => p.adSpend > 0 || p.realRev > 0 || p.returnedCount > 0 || p.realCount > 0);
  }, [inventoryProducts, orders, campaigns, campaignRecords, settings, expenses, dateFilter, activePeriod, globalProductFilter, periods]);

  // Filtered & Sorted Products List
  const filteredAndSortedProducts = useMemo(() => {
    let result = [...productsPerformanceList];

    if (productSearch.trim()) {
      const q = productSearch.trim().toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.sku.toLowerCase().includes(q) || 
        (p.category && p.category.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      let valA = a[productSortBy];
      let valB = b[productSortBy];
      if (productSortOrder === 'asc') {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });

    return result;
  }, [productsPerformanceList, productSearch, productSortBy, productSortOrder]);

  // Aggregate Products Summary
  const productsSummary = useMemo(() => {
    const totalProdAdSpend = productsPerformanceList.reduce((acc, p) => acc + p.adSpend, 0);
    const totalProdReturnCost = productsPerformanceList.reduce((acc, p) => acc + p.returnCost, 0);
    const totalProdNet = productsPerformanceList.reduce((acc, p) => acc + p.realNet, 0);
    const totalProdRev = productsPerformanceList.reduce((acc, p) => acc + p.realRev, 0);
    const totalReturned = productsPerformanceList.reduce((acc, p) => acc + p.returnedCount, 0);
    const totalDelivered = productsPerformanceList.reduce((acc, p) => acc + p.realCount, 0);
    const overallReturnToAdSpend = totalProdAdSpend > 0 ? (totalProdReturnCost / totalProdAdSpend) * 100 : 0;
    const overallProfitRoas = totalProdAdSpend > 0 ? (totalProdNet / totalProdAdSpend) : 0;
    const overallRevenueRoas = totalProdAdSpend > 0 ? (totalProdRev / totalProdAdSpend) : 0;

    return {
      totalProdAdSpend,
      totalProdReturnCost,
      totalProdNet,
      totalProdRev,
      totalReturned,
      totalDelivered,
      overallReturnToAdSpend,
      overallProfitRoas,
      overallRevenueRoas,
      countWithAds: productsPerformanceList.filter(p => p.adSpend > 0).length,
      highBleedCount: productsPerformanceList.filter(p => p.status === 'danger_bleed').length,
      highProfitCount: productsPerformanceList.filter(p => p.status === 'high_profit').length
    };
  }, [productsPerformanceList]);

  // 5. Active Campaigns Cost
  const activeCampaignsData = useMemo(() => {
    const active = campaigns.filter(c => !c.isArchived && (!(globalProductFilter && globalProductFilter !== 'all') || isCampaignMatchedToProduct(c, globalProductFilter, inventoryProducts)));
    const purchasesField = campaignFields.find(f => f.name.toLowerCase() === 'purchases');
    const exchangeRate = settings?.exchangeRate || 220;

    return active.map(c => {
      const records = campaignRecords.filter(r => r.campaignId === c.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      let spend = 0, purchases = 0, cpa = 0;
      
      if (activePeriod) {
        const periodRecords = records.filter(r => r.date && isWithinInterval(parseISO(r.date), { start: activePeriod.start, end: activePeriod.end }));
        periodRecords.forEach(r => {
          spend += (r.spend || 0) * exchangeRate;
          if (purchasesField && r.dynamicFields && r.dynamicFields[purchasesField.id]) {
            purchases += Number(r.dynamicFields[purchasesField.id]) || 0;
          }
        });
      } else {
        records.forEach(r => {
          spend += (r.spend || 0) * exchangeRate;
          if (purchasesField && r.dynamicFields && r.dynamicFields[purchasesField.id]) {
            purchases += Number(r.dynamicFields[purchasesField.id]) || 0;
          }
        });
      }

      cpa = purchases > 0 ? spend / purchases : spend;
      
      let prodName = c.productName || 'غير محدد';
      if (c.linkedProducts && c.linkedProducts.length > 0) {
        const linked = inventoryProducts.filter(p => c.linkedProducts?.includes(p.id)).map(p => p.name).join(', ');
        if (linked) prodName = linked;
      }

      return {
        name: c.name || 'بدون اسم',
        productName: prodName,
        spend,
        purchases,
        cpa
      };
    }).sort((a, b) => b.spend - a.spend);
  }, [campaigns, campaignRecords, settings, inventoryProducts, activePeriod, campaignFields]);

  return (
    <div className="p-4 md:p-8 space-y-8 bg-gray-50/50 min-h-screen" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-100">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                مؤشرات الأداء الشاملة
              </h2>
              <p className="text-gray-500 mt-1 text-sm font-medium">لوحة تحكم إحصائية راقية لجميع مؤشرات المالية، الإعلانات، نسبة الروتورن، و ROAS الفائدة الصافية.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowInfoModal(true)}
            className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            title="دليل فهم مؤشرات ROAS والروتورن"
          >
            <HelpCircle className="w-4 h-4" />
            <span>شرح المؤشرات</span>
          </button>
          <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex-1 md:flex-initial">
            {['today', 'week', 'month', 'all'].map((f) => (
              <button
                key={f}
                onClick={() => setDateFilter(f as any)}
                className={`flex-1 md:flex-initial px-5 py-2 rounded-lg font-bold text-xs md:text-sm transition-all ${dateFilter === f ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {f === 'today' ? 'اليوم' : f === 'week' ? 'الأسبوع' : f === 'month' ? 'الشهر' : 'الكل'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 1: Finance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard 
          title="صافي الأرباح الحقيقية" 
          amount={currentMetrics.realNet} 
          icon={<Banknote className="w-6 h-6 text-emerald-500" />}
          gradient="from-emerald-500 to-teal-700"
          subtitle="الأرباح المستلمة فعلياً بعد خصم كل التكاليف"
        />
        <MetricCard 
          title="صافي الأرباح المتوقعة" 
          amount={currentMetrics.expectedNet} 
          icon={<TrendingUp className="w-6 h-6 text-orange-500" />}
          gradient="from-orange-400 to-orange-600"
          subtitle="أرباح الطلبيات قيد المعالجة والشحن"
        />
        <MetricCard 
          title="إجمالي الأرباح (متوقع + حقيقي)" 
          amount={currentMetrics.combinedNet} 
          icon={<DollarSign className="w-6 h-6 text-indigo-500" />}
          gradient="from-indigo-500 to-purple-700"
          subtitle="مجموع الأرباح المحصلة والمتوقعة"
        />
      </div>

      {/* Row 1.5: Rates & Core Advertising / Return KPIs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            المؤشرات المالية والإعلانية الحيوية (ROAS & الروتورن)
          </h3>
          <span className="text-xs text-gray-400 font-medium">
            المصروف الإعلاني للفترة: <strong className="text-gray-700 font-bold">{formatCurrency(currentMetrics.adSpendDZD)} د.ج</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* 1. ROAS الفائدة الصافية (POAS) */}
          <RateCard 
            title="ROAS الفائدة (POAS)" 
            value={globalProfitRoas} 
            isMultiplier
            formula="صافي الأرباح الحقيقية ÷ المصروف الإعلاني"
            icon={<Coins className="w-5 h-5 text-emerald-600" />}
            valueColor={globalProfitRoas >= 1.5 ? 'text-emerald-600' : globalProfitRoas >= 1.0 ? 'text-teal-600' : globalProfitRoas > 0 ? 'text-blue-600' : 'text-rose-600'}
            badge={
              currentMetrics.adSpendDZD === 0 
                ? 'لا يوجد صرف' 
                : globalProfitRoas >= 1.5 
                  ? 'عائد ممتاز 🚀' 
                  : globalProfitRoas >= 1.0 
                    ? 'ربح إيجابي ✅' 
                    : globalProfitRoas > 0 
                      ? 'ربح ضعيف ⚠️' 
                      : 'خسارة إعلانية 🛑'
            }
            badgeClass={
              currentMetrics.adSpendDZD === 0
                ? 'bg-gray-100 text-gray-600'
                : globalProfitRoas >= 1.0
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
            }
            subtext={
              currentMetrics.adSpendDZD > 0 
                ? `${formatCurrency(currentMetrics.realNet)} د.ج فائدة لكل ${formatCurrency(currentMetrics.adSpendDZD)} د.ج إعلانات`
                : 'بدون إعلانات'
            }
          />

          {/* 2. نسبة الروتورن للمصروف الإعلاني */}
          <RateCard 
            title="نسبة الروتورن للإعلانات" 
            value={globalReturnToAdSpendRatio} 
            isPercentage
            formula="تكلفة المرتجع ÷ المصروف الإعلاني × 100"
            icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
            valueColor={globalReturnToAdSpendRatio > 40 ? 'text-rose-600' : globalReturnToAdSpendRatio > 20 ? 'text-amber-600' : 'text-emerald-600'}
            badge={
              currentMetrics.adSpendDZD === 0
                ? 'لا يوجد صرف'
                : globalReturnToAdSpendRatio > 40
                  ? 'استنزاف حرج 🛑'
                  : globalReturnToAdSpendRatio > 20
                    ? 'تنبيه روتورن ⚠️'
                    : 'استنزاف آمن 🟢'
            }
            badgeClass={
              currentMetrics.adSpendDZD === 0
                ? 'bg-gray-100 text-gray-600'
                : globalReturnToAdSpendRatio > 40
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : globalReturnToAdSpendRatio > 20
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }
            subtext={`${formatCurrency(currentMetrics.returnCostTotal)} د.ج تكلفة ${currentMetrics.returnedCount} روتورن`}
          />

          {/* 3. ROAS المبيعات الإعلاني */}
          <RateCard 
            title="ROAS المبيعات الإعلاني" 
            value={globalRevenueRoas} 
            isMultiplier
            formula="المداخيل الحقيقية ÷ المصروف الإعلاني"
            icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
            valueColor="text-purple-700"
            badge={currentMetrics.adSpendDZD > 0 ? `مضاعف المبيعات` : 'لا يوجد صرف'}
            badgeClass="bg-purple-50 text-purple-700 border border-purple-200"
            subtext={`المداخيل: ${formatCurrency(currentMetrics.realRev)} د.ج`}
          />

          {/* 4. هامش الربح الصافي */}
          <RateCard 
            title="هامش الربح الصافي" 
            value={currentMetrics.realRev > 0 ? (currentMetrics.realNet / currentMetrics.realRev) * 100 : 0} 
            isPercentage 
            formula="صافي الأرباح الحقيقية ÷ المداخيل الحقيقية"
            icon={<Percent className="w-5 h-5 text-blue-500" />}
            valueColor="text-blue-700"
            badge={currentMetrics.realRev > 0 ? 'من إجمالي المبيعات' : '-'}
          />

          {/* 5. تكلفة اكتساب العميل (CPA) */}
          <RateCard 
            title="تكلفة اكتساب العميل (CPA)" 
            value={currentMetrics.realCount > 0 ? (currentMetrics.adSpendDZD / currentMetrics.realCount) : 0} 
            isCurrency 
            formula="إجمالي الإنفاق الإعلاني ÷ الطلبيات المستلمة"
            icon={<Target className="w-5 h-5 text-rose-500" />}
            valueColor="text-rose-700"
            badge={currentMetrics.realCount > 0 ? `${currentMetrics.realCount} طلبية مستلمة` : 'لا توجد مستلمة'}
          />

          {/* 6. معدل التوصيل الحقيقي */}
          <RateCard 
            title="معدل التوصيل الحقيقي" 
            value={(currentMetrics.realCount + currentMetrics.returnedCount) > 0 ? (currentMetrics.realCount / (currentMetrics.realCount + currentMetrics.returnedCount)) * 100 : 0} 
            isPercentage 
            formula="الطلبيات المستلمة ÷ (المستلمة + المرتجعة)"
            icon={<Truck className="w-5 h-5 text-indigo-500" />}
            valueColor="text-indigo-700"
            badge={`${currentMetrics.realCount} مستلم / ${currentMetrics.returnedCount} روتورن`}
          />
        </div>
      </div>

      {/* Row 2: Daily Averages & Shipped Orders Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Averages */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-black text-gray-800 flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-purple-500" />
              معدل الأرباح اليومي
            </h3>
            <p className="text-xs text-gray-500 font-bold mb-6">
              مبني على فترة عمل <strong>{daysSinceStart}</strong> يوماً منذ تسجيل أول طلبية.
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
              <span className="font-bold text-emerald-900 text-sm">متوسط المداخيل الحقيقية / يوم</span>
              <span className="font-black text-xl text-emerald-700">{formatCurrency(totalMetrics.realRevTotal / daysSinceStart)} د.ج</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
              <span className="font-bold text-emerald-900 text-sm">متوسط الربح الحقيقي / يوم</span>
              <span className="font-black text-xl text-emerald-700">{formatCurrency(totalMetrics.realNet / daysSinceStart)} د.ج</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
              <span className="font-bold text-orange-900 text-sm">متوسط الربح المتوقع / يوم</span>
              <span className="font-black text-xl text-orange-700">{formatCurrency(totalMetrics.expectedNet / daysSinceStart)} د.ج</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
              <span className="font-bold text-indigo-900 text-sm">متوسط الربح الإجمالي / يوم</span>
              <span className="font-black text-xl text-indigo-700">{formatCurrency(totalMetrics.combinedNet / daysSinceStart)} د.ج</span>
            </div>
          </div>
        </div>

        {/* Shipped Orders Interactive Chart */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-black text-gray-800 flex items-center gap-2 mb-6">
            <Truck className="w-5 h-5 text-blue-500" />
            تحليل مسار الطلبيات
          </h3>
          <div className="flex flex-col md:flex-row items-center justify-between h-64">
            <div className="w-full md:w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={funnelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`${value} طلبية`, 'العدد']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 flex flex-col justify-center space-y-4 mt-4 md:mt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                  <span className="font-bold text-gray-700 text-sm">مستلمة</span>
                </div>
                <span className="font-black text-gray-900">{shippedOrdersStats.totalReceived}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="font-bold text-gray-700 text-sm">مؤكدة ({Math.round(shippedOrdersStats.confirmedPct)}%)</span>
                </div>
                <span className="font-black text-gray-900">{shippedOrdersStats.confirmed}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="font-bold text-gray-700 text-sm">قيد الانتظار ({Math.round(shippedOrdersStats.pendingPct)}%)</span>
                </div>
                <span className="font-black text-gray-900">{shippedOrdersStats.pending}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2.5: Weekly Performance Line Chart */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 mb-6">
        <h3 className="text-lg font-black text-gray-800 flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5 text-indigo-500" />
          الأداء الأسبوعي (آخر 7 أيام)
        </h3>
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyPerformanceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="shortDate" tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 'bold' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 'bold' }} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                itemStyle={{ fontWeight: 'black' }}
                formatter={(value: any) => [`${formatCurrency(value)} د.ج`]}
                labelFormatter={(label, payload) => {
                   const dayName = payload?.[0]?.payload?.name || label;
                   return `${dayName} - ${label}`;
                }}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold', fontSize: '14px' }} />
              <Line type="monotone" name="المبيعات" dataKey="المبيعات" stroke="#10b981" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              <Line type="monotone" name="الربح" dataKey="الربح" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* NEW: Dedicated Products Performance Analysis (Return vs Ads & Profit ROAS) */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">
                تحليل أداء المنتجات: نسبة الروتورن مقارنة بالمصروف الإعلاني و ROAS الفائدة
              </h3>
            </div>
            <p className="text-gray-500 text-xs mt-1 font-medium">
              مقارنة دقيقة لكل منتج تكشف مدى استنزاف المرتجعات للميزانية الإعلانية، ومقدار الربح الصافي المحقق لكل دينار إعلاني (POAS).
            </p>
          </div>

          {/* Quick Filter & Search Bar */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="بحث عن منتج أو SKU..."
                className="w-full pl-3 pr-9 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all"
              />
              {productSearch && (
                <button
                  onClick={() => setProductSearch('')}
                  className="absolute left-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-200">
              <span className="text-[11px] font-bold text-gray-400 px-2">ترتيب حسب:</span>
              <select
                value={productSortBy}
                onChange={(e) => setProductSortBy(e.target.value as any)}
                className="bg-white border-0 text-xs font-bold text-gray-700 rounded-lg px-2.5 py-1.5 focus:ring-0 cursor-pointer shadow-2xs"
              >
                <option value="returnToAdSpendRatio">الأعلى استنزافاً بالروتورن (%)</option>
                <option value="profitRoas">الأعلى ROAS فائدة (POAS)</option>
                <option value="revenueRoas">الأعلى ROAS مبيعات</option>
                <option value="adSpend">الأعلى صرفاً إعلانياً</option>
                <option value="realNet">الأعلى ربحاً صافياً</option>
                <option value="returnedCount">الأكثر مرتجعاً (عدد)</option>
              </select>

              <button
                onClick={() => setProductSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="p-1.5 bg-white text-gray-600 hover:text-indigo-600 rounded-lg shadow-2xs transition-colors"
                title={productSortOrder === 'desc' ? 'تنازلي (من الأكبر للأصغر)' : 'تصاعدي (من الأصغر للأكبر)'}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Product Performance Summary Pill Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-purple-50/30 rounded-2xl border border-gray-100 mb-6">
          <div className="p-3 bg-white/80 rounded-xl border border-gray-200/60 shadow-2xs">
            <span className="text-[10px] font-bold text-gray-400 block">إجمالي إعلانات المنتجات</span>
            <span className="text-base font-black text-gray-900 mt-0.5 block">{formatCurrency(productsSummary.totalProdAdSpend)} د.ج</span>
            <span className="text-[10px] font-medium text-gray-500">{productsSummary.countWithAds} منتج له إعلانات</span>
          </div>

          <div className="p-3 bg-white/80 rounded-xl border border-gray-200/60 shadow-2xs">
            <span className="text-[10px] font-bold text-gray-400 block">إجمالي تكلفة المرتجعات</span>
            <span className="text-base font-black text-rose-600 mt-0.5 block">{formatCurrency(productsSummary.totalProdReturnCost)} د.ج</span>
            <span className="text-[10px] font-medium text-gray-500">{productsSummary.totalReturned} طلبية روتورن</span>
          </div>

          <div className="p-3 bg-white/80 rounded-xl border border-gray-200/60 shadow-2xs">
            <span className="text-[10px] font-bold text-gray-400 block">متوسط استنزاف الروتورن للإعلانات</span>
            <span className={`text-base font-black mt-0.5 block ${productsSummary.overallReturnToAdSpend > 30 ? 'text-rose-600' : 'text-amber-600'}`}>
              {productsSummary.overallReturnToAdSpend.toFixed(1)}%
            </span>
            <span className="text-[10px] font-medium text-gray-500">
              {productsSummary.highBleedCount > 0 ? `${productsSummary.highBleedCount} منتجات في دائرة الخطر` : 'جميع المنتجات في النطاق الآمن'}
            </span>
          </div>

          <div className="p-3 bg-white/80 rounded-xl border border-gray-200/60 shadow-2xs">
            <span className="text-[10px] font-bold text-gray-400 block">متوسط ROAS الفائدة العام</span>
            <span className={`text-base font-black mt-0.5 block ${productsSummary.overallProfitRoas >= 1.0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {productsSummary.overallProfitRoas.toFixed(2)}x
            </span>
            <span className="text-[10px] font-medium text-gray-500">
              صافي الفائدة: {formatCurrency(productsSummary.totalProdNet)} د.ج
            </span>
          </div>
        </div>

        {/* Interactive Products Table */}
        {filteredAndSortedProducts.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50/90 text-gray-600 font-black border-b border-gray-200 text-xs">
                <tr>
                  <th className="p-4 rounded-tr-2xl">المنتج</th>
                  <th className="p-4 text-center">المصروف الإعلاني</th>
                  <th className="p-4 text-center">المبيعات والتسليم</th>
                  <th className="p-4 text-center">المرتجع (العدد والنسبة)</th>
                  <th className="p-4 text-center">تكلفة الروتورن</th>
                  <th className="p-4 text-center bg-rose-50/60 text-rose-900 border-x border-rose-100">
                    <div className="flex items-center justify-center gap-1">
                      <span>نسبة الروتورن للإعلانات</span>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    </div>
                  </th>
                  <th className="p-4 text-center bg-emerald-50/60 text-emerald-900 border-x border-emerald-100">
                    <div className="flex items-center justify-center gap-1">
                      <span>ROAS الفائدة (POAS)</span>
                      <Coins className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  </th>
                  <th className="p-4 text-center">ROAS المبيعات</th>
                  <th className="p-4 text-center">صافي الأرباح</th>
                  <th className="p-4 text-left rounded-tl-2xl">تقييم الأداء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAndSortedProducts.map((p) => {
                  const isHighBleed = p.returnToAdSpendRatio > 40;
                  const isMedBleed = p.returnToAdSpendRatio >= 20 && p.returnToAdSpendRatio <= 40;
                  const isProfitable = p.profitRoas >= 1.0;

                  return (
                    <tr 
                      key={p.id} 
                      className={`hover:bg-indigo-50/30 transition-colors ${
                        isHighBleed && p.adSpend > 0 ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Product details */}
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-black text-gray-900 hover:text-indigo-600 transition-colors text-sm">
                            {p.name}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            {p.sku && (
                              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                                {p.sku}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400 font-medium">
                              {p.category}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Ad Spend */}
                      <td className="p-4 text-center">
                        {p.adSpend > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className="font-black text-gray-900">
                              {formatCurrency(p.adSpend)} <span className="text-[10px] text-gray-500 font-normal">د.ج</span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                            عضوي (بدون إعلانات)
                          </span>
                        )}
                      </td>

                      {/* Delivered sales & count */}
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-black text-emerald-700">
                            {formatCurrency(p.realRev)} <span className="text-[10px] text-emerald-600 font-normal">د.ج</span>
                          </span>
                          <span className="text-[10px] font-bold text-gray-500 mt-0.5">
                            {p.realCount} طلبية مستلمة
                          </span>
                        </div>
                      </td>

                      {/* Returned count & rate */}
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-black text-rose-600">
                            {p.returnedCount} <span className="text-[10px] font-medium text-gray-500">طرد</span>
                          </span>
                          <span className="text-[10px] font-bold text-gray-500 mt-0.5">
                            معدل: {p.returnRate.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Return Cost */}
                      <td className="p-4 text-center">
                        <span className="font-black text-rose-600">
                          {formatCurrency(p.returnCost)} <span className="text-[10px] text-rose-400 font-normal">د.ج</span>
                        </span>
                      </td>

                      {/* Return vs Ad Spend % (Key User Metric) */}
                      <td className="p-4 text-center bg-rose-50/40 border-x border-rose-100">
                        {p.adSpend > 0 ? (
                          <div className="flex flex-col items-center max-w-[140px] mx-auto">
                            <div className="flex items-center justify-between w-full mb-1">
                              <span className={`text-xs font-black ${
                                isHighBleed ? 'text-rose-700' : isMedBleed ? 'text-amber-700' : 'text-emerald-700'
                              }`}>
                                {p.returnToAdSpendRatio.toFixed(1)}%
                              </span>
                              <span className="text-[9px] text-gray-400 font-medium">
                                من الإعلانات
                              </span>
                            </div>
                            {/* Visual Progress Bar */}
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  isHighBleed ? 'bg-rose-500' : isMedBleed ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, p.returnToAdSpendRatio)}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-gray-500 font-bold mt-1">
                              {Math.round(p.returnCostPer1kAds)} د.ج / 1,000 د.ج إعلانات
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-gray-400">
                            -
                          </span>
                        )}
                      </td>

                      {/* Profit ROAS / POAS (Key User Metric) */}
                      <td className="p-4 text-center bg-emerald-50/40 border-x border-emerald-100">
                        {p.adSpend > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className={`text-sm font-black ${
                              p.profitRoas >= 1.5 
                                ? 'text-emerald-700' 
                                : p.profitRoas >= 1.0 
                                  ? 'text-teal-700' 
                                  : p.profitRoas > 0 
                                    ? 'text-blue-700' 
                                    : 'text-rose-700'
                            }`}>
                              {p.profitRoas.toFixed(2)}x
                            </span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                              p.profitRoas >= 1.0 
                                ? 'bg-emerald-100/80 text-emerald-800' 
                                : 'bg-rose-100/80 text-rose-800'
                            }`}>
                              {p.profitRoas >= 0 ? `+${(p.profitRoas * 100).toFixed(0)}%` : `${(p.profitRoas * 100).toFixed(0)}%`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-gray-400">
                            -
                          </span>
                        )}
                      </td>

                      {/* Revenue ROAS */}
                      <td className="p-4 text-center">
                        {p.adSpend > 0 ? (
                          <span className="font-black text-purple-700 text-sm">
                            {p.revenueRoas.toFixed(2)}x
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-gray-400">-</span>
                        )}
                      </td>

                      {/* Net Profit */}
                      <td className="p-4 text-center">
                        <span className={`font-black text-sm ${p.realNet >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {formatCurrency(p.realNet)} <span className="text-[10px] font-normal">د.ج</span>
                        </span>
                      </td>

                      {/* Actionable Status Assessment */}
                      <td className="p-4 text-left">
                        {p.status === 'no_ads' ? (
                          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2.5 py-1 rounded-xl text-xs font-bold">
                            <Package className="w-3.5 h-3.5 text-gray-400" />
                            عضوي (بدون إعلانات)
                          </span>
                        ) : p.status === 'high_profit' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-xl text-xs font-bold border border-emerald-200">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            🚀 POAS ممتاز ومربح
                          </span>
                        ) : p.status === 'warning_return' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-xl text-xs font-bold border border-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            ⚠️ روتورن مرتفع
                          </span>
                        ) : p.status === 'danger_bleed' ? (
                          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2.5 py-1 rounded-xl text-xs font-bold border border-rose-200">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            🛑 استنزاف إعلاني بالروتورن
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 px-2.5 py-1 rounded-xl text-xs font-bold border border-blue-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                            ✅ أداء متوازن
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
          <div className="p-12 text-center bg-gray-50/60 rounded-2xl border border-dashed border-gray-200">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-bold text-sm">لم يتم العثور على منتجات مطابقة لخيارات البحث أو الفلتر الزمني المحدد.</p>
          </div>
        )}
      </div>

      {/* Row 3: Ads Campaigns */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-black text-gray-800 flex items-center gap-2 mb-6">
          <Megaphone className="w-5 h-5 text-rose-500" />
          الحملات الإعلانية النشطة والتكلفة
        </h3>
        
        {activeCampaignsData.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100">
                <tr>
                  <th className="p-4 rounded-tr-xl">اسم الحملة</th>
                  <th className="p-4">المنتج المرتبط</th>
                  <th className="p-4 text-center">الإنفاق الحالي (د.ج)</th>
                  <th className="p-4 text-center">مبيعات الحملة</th>
                  <th className="p-4 text-left rounded-tl-xl">تكلفة الشراء (CPA)</th>
                </tr>
              </thead>
              <tbody>
                {activeCampaignsData.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-rose-50/30 transition-colors">
                    <td className="p-4 font-bold text-gray-900">{c.name}</td>
                    <td className="p-4 font-medium text-gray-600">
                      <span className="bg-gray-100 px-2 py-1 rounded-md text-xs">{c.productName}</span>
                    </td>
                    <td className="p-4 text-center font-black text-rose-600">{formatCurrency(c.spend)}</td>
                    <td className="p-4 text-center font-bold text-emerald-600">{c.purchases}</td>
                    <td className="p-4 text-left font-black text-indigo-700 bg-indigo-50/50">
                      {formatCurrency(c.cpa)} <span className="text-[10px] text-indigo-400">د.ج</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-bold text-lg">لا توجد حملات إعلانية نشطة حالياً.</p>
          </div>
        )}
      </div>

      {/* Guide & Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">دليل فهم مؤشرات ROAS والروتورن</h3>
                  <p className="text-xs text-gray-500 font-medium">كيف تُحلل أداء حملاتك ومنتجاتك بأمان ودقة مالية متناهية</p>
                </div>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-medium text-gray-700 leading-relaxed">
              <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-900 font-black text-sm mb-1">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  <span>1. ما هو ROAS الفائدة الصافية (POAS - Profit On Ad Spend)؟</span>
                </div>
                <p className="text-emerald-800">
                  على عكس ROAS المبيعات التقليدي الذي يخدعك بحجم المداخيل الإجمالية، يقيس <strong>ROAS الفائدة</strong> مقدار الأرباح الحقيقية الصافية التي تدخل جيبك بعد خصم كافة التكاليف (سعر الجملة للمنتج، تكاليف الشحن والتوصيل، خسائر الروتورن، والمصاريف الإضافية) مقسوماً على ما دفعته في الإعلانات.
                </p>
                <div className="mt-2 p-2 bg-white rounded-xl border border-emerald-200 text-emerald-900 font-bold font-mono">
                  المعادلة: صافي الربح الحقيقي ÷ المصروف الإعلاني
                </div>
                <ul className="mt-2 space-y-1 list-disc list-inside text-emerald-800">
                  <li><strong>أعلى من 1.5x:</strong> ممتاز، كل دينار إعلاني يدر أكثر من 1.5 د.ج فائدة صافية.</li>
                  <li><strong>بين 1.0x و 1.5x:</strong> ربحي ومستقر، كل دينار إعلانات يغطي نفسه ويزيد.</li>
                  <li><strong>أقل من 1.0x:</strong> أرباحك الصافية أقل من مصروف الإعلانات، يجب تحسين التسليم أو رفع الهامش.</li>
                  <li><strong>سالب:</strong> خسارة صريحة في الحملة يجب إيقافها فوراً.</li>
                </ul>
              </div>

              <div className="p-4 bg-rose-50/70 rounded-2xl border border-rose-100">
                <div className="flex items-center gap-2 text-rose-900 font-black text-sm mb-1">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>2. ما هي نسبة الروتورن بالنسبة للمصروف الإعلاني؟</span>
                </div>
                <p className="text-rose-800">
                  توضح هذه النسبة الخطيرة ما يلتهمه المرتجع (خسائر شحن الطرود المرتجعة وتلف المنتجات) كنسبة مئوية من ميزانية الإعلانات. فإذا أنفقت 100,000 د.ج إعلانات وخسرت 25,000 د.ج في الروتورن، فإن نسبة الروتورن للإعلانات هي 25%.
                </p>
                <div className="mt-2 p-2 bg-white rounded-xl border border-rose-200 text-rose-900 font-bold font-mono">
                  المعادلة: (إجمالي تكلفة المرتجع ÷ إجمالي المصروف الإعلاني) × 100
                </div>
                <ul className="mt-2 space-y-1 list-disc list-inside text-rose-800">
                  <li><strong>أقل من 20%:</strong> مستوى آمن وطبيعي في التجارة الإلكترونية والدفع عند الاستلام (COD).</li>
                  <li><strong>بين 20% و 40%:</strong> تنبيه! الروتورن يستنزف جزءاً كبيراً من ميزانيتك الإعلانية ويقلل أرباحك.</li>
                  <li><strong>أعلى من 40%:</strong> نزيف إعلاني خطير! تكلفة الروتورن تبتلع الحملة وتلغي جدواها الاقتصادية.</li>
                </ul>
              </div>

              <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-100">
                <div className="flex items-center gap-2 text-purple-900 font-black text-sm mb-1">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <span>3. ما الفرق بين ROAS المبيعات و ROAS الفائدة؟</span>
                </div>
                <p className="text-purple-800">
                  <strong>ROAS المبيعات (المداخيل ÷ الإعلانات):</strong> يقيس فقط حجم الدخل الكلي، لكنه يتجاهل تكلفة المنتج والشحن والروتورن، ولذلك قد يكون ROAS المبيعات 4x بينما المتجر يخسر فعلياً بسبب روتورن 50%! بينما <strong>ROAS الفائدة (POAS)</strong> هو الحقيقة الصادقة لأرباحك في أرض الواقع.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowInfoModal(false)}
                className="px-6 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-indigo-700 transition-colors"
              >
                فهمت، إغلاق الدليل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, amount, icon, gradient, subtitle }: any) {
  return (
    <div className={`relative overflow-hidden rounded-3xl p-6 shadow-lg border border-transparent bg-gradient-to-br ${gradient} text-white`}>
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10 pointer-events-none"></div>
      <div className="relative z-10 flex flex-col h-full justify-between gap-6">
        <div className="flex justify-between items-start">
          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
            {icon}
          </div>
          <span className="text-white/90 font-bold text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm shadow-inner transition-colors">
            {title}
          </span>
        </div>
        <div>
          <span className="block text-4xl font-black text-white tracking-tight drop-shadow-md" dir="ltr">
            {formatCurrency(amount)} <span className="text-xl font-bold opacity-80">DZD</span>
          </span>
          <div className="text-white/80 text-xs font-medium mt-2">
            {subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

function RateCard({ 
  title, 
  value, 
  formula, 
  icon, 
  isPercentage, 
  isCurrency,
  isMultiplier,
  valueColor,
  badge,
  badgeClass,
  subtext
}: any) {
  const displayValue = isMultiplier
    ? `${value.toFixed(2)}x`
    : isPercentage 
      ? `${value.toFixed(1)}%` 
      : isCurrency 
        ? `${formatCurrency(value)} د.ج`
        : formatCurrency(value);

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="flex justify-between items-start mb-3">
        <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
          {icon}
        </div>
        <div className="text-left flex flex-col items-end" dir="ltr">
          <span className={`block text-2xl font-black tracking-tight ${valueColor || 'text-gray-900'}`}>
            {displayValue}
          </span>
          {badge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${badgeClass || 'bg-gray-100 text-gray-700'}`}>
              {badge}
            </span>
          )}
        </div>
      </div>
      <div>
        <h4 className="text-gray-800 font-bold text-sm mb-1">{title}</h4>
        {subtext && (
          <div className="text-[11px] font-semibold text-gray-500 mb-1.5 leading-snug">
            {subtext}
          </div>
        )}
        <p className="text-gray-400 text-[10px] font-medium leading-relaxed bg-gray-50/80 p-2 rounded-lg border border-gray-100">
          {formula}
        </p>
      </div>
    </div>
  );
}

