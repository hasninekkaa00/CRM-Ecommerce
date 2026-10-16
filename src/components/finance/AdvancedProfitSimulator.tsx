import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store';
import { checkProductMatch, renderProductFilterOptions, isCampaignMatchedToProduct } from '../../utils/productFilters';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { differenceInDays, addDays, format, parseISO, isAfter, isBefore } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Calculator, Target, TrendingUp, Settings2, Package, Calendar, DollarSign, Activity, Percent, ArrowLeftRight, BarChart3, AlertTriangle, Coins, Clock, Sparkles } from 'lucide-react';
import { fetchAndMapMetaMetrics } from '../../utils/metaSync';
import { getOrderUnitAndTotalCost } from '../../utils/productCostUtils';
import { getEffectiveShippingCost } from '../../utils/shippingFees';

const formatCurrency = (val: number) => {
  return Math.round(Number(val) || 0).toLocaleString('fr-FR');
};

export function AdvancedProfitSimulator() {
  const { orders, inventoryProducts, settings, campaigns, campaignRecords, campaignFields, addCampaignRecord, addCampaignField, globalProductFilter, setGlobalProductFilter } = useStore();

  const hasSyncedMetaRef = React.useRef(false);

  // Auto-sync Meta Ads spend for today when entering Finance
  useEffect(() => {
    if (!settings?.metaAdsToken || hasSyncedMetaRef.current) return;
    hasSyncedMetaRef.current = true;
    
    const syncMetaAds = async () => {
       const activeMetaCampaigns = campaigns.filter(c => c.platform === 'Meta' && !c.isArchived && c.metaCampaignId);
       if (activeMetaCampaigns.length === 0) return;
       
       const token = settings.metaAdsToken;
       const untilDate = new Date();
       const sinceDate = new Date();
       sinceDate.setDate(untilDate.getDate() - 7);
       const timeRange = JSON.stringify({
           since: sinceDate.toISOString().split('T')[0],
           until: untilDate.toISOString().split('T')[0]
       });
       
       let currentFields = campaignFields;
       if (currentFields.length === 0) {
           const defaults = ["Impressions", "Reach", "CPM", "Link clicks", "CPC", "CTR", "Landing page views", "Purchases", "Cost per purchase"];
           for (let i = 0; i < defaults.length; i++) {
              const newField = { id: 'f_default_' + i + '_' + Date.now().toString(), name: defaults[i], type: 'number' as const };
              await addCampaignField(newField);
              currentFields = [...currentFields, newField];
           }
       }
       
       let syncedCount = 0;
       
       for (const mc of activeMetaCampaigns) {
           try {
              const res = await fetch(`https://graph.facebook.com/v19.0/${mc.metaCampaignId}/insights?time_range=${encodeURIComponent(timeRange)}&time_increment=1&fields=spend,date_start,impressions,reach,cpm,clicks,cpc,ctr,actions,cost_per_action_type&access_token=${token}`);
              const text = await res.text();
              let data;
              try {
                data = JSON.parse(text);
              } catch (e) {
                throw new Error(`Meta API returned invalid JSON: ${text.substring(0, 100)}`);
              }
              if (!res.ok) {
                throw new Error(data.error?.message || `Meta API error: ${text.substring(0, 100)}`);
              }
              
              if (data.data && data.data.length > 0) {
                 const parsedMetrics = fetchAndMapMetaMetrics(data, currentFields);
                 
                 for (const record of parsedMetrics) {
                     const recordId = `meta_record_${mc.metaCampaignId}_${record.date}`;
                     const existingRecord = campaignRecords.find(r => r.id === recordId);
                     
                     const isDiff = !existingRecord || existingRecord.spend !== record.spend || JSON.stringify(existingRecord.dynamicFields) !== JSON.stringify({...existingRecord.dynamicFields, ...record.metrics});
                     
                     if (isDiff) {
                        await addCampaignRecord({
                           id: recordId,
                           campaignId: mc.id,
                           date: record.date,
                           spend: record.spend,
                           dynamicFields: existingRecord ? { ...existingRecord.dynamicFields, ...record.metrics } : record.metrics
                        });
                        syncedCount++;
                     }
                 }
              }
           } catch (e) {
              console.error("Failed to sync Meta campaign", mc.name, e);
           }
       }
       // Optional: we can skip the toast here to avoid double toasting if they mount simultaneously, but they are separate routes.
    };
    
    syncMetaAds();
  }, [settings?.metaAdsToken]);
  
  const [mode, setMode] = useState<'auto' | 'manual'>(() => (localStorage.getItem('adv_profit_mode') as any) || 'auto');
  const [selectedProduct, setSelectedProduct] = useState<string>(() => globalProductFilter || localStorage.getItem('adv_profit_product') || 'all');

  useEffect(() => {
    if (globalProductFilter !== undefined) {
      setSelectedProduct(prev => (prev === globalProductFilter ? prev : globalProductFilter));
    }
  }, [globalProductFilter]);
  const [targetDate, setTargetDate] = useState<string>(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dailyBudget, setDailyBudget] = useState<number>(() => Number(localStorage.getItem('adv_profit_dailyBudget')) || 50);
  const [averagesSource, setAveragesSource] = useState<'actual' | 'simulation'>('actual');

  // Manual Mode Inputs
  const [manualInputs, setManualInputs] = useState(() => {
    const saved = localStorage.getItem('adv_profit_manualInputs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      dailyOrders: 20,
      confirmationRate: 70,
      deliveryRate: 65,
      sellingPrice: 4500,
      productCost: 1000,
      deliveryCost: 600,
      returnCost: settings?.returnCost || 400,
      cpa: 3 // USD
    };
  });

  useEffect(() => {
    localStorage.setItem('adv_profit_mode', mode);
    localStorage.setItem('adv_profit_product', selectedProduct);
    localStorage.setItem('adv_profit_dailyBudget', dailyBudget.toString());
    localStorage.setItem('adv_profit_manualInputs', JSON.stringify(manualInputs));
  }, [mode, selectedProduct, dailyBudget, manualInputs]);

  const exchangeRate = settings?.exchangeRate || 245;

  // Auto Mode Calculations based on historical data
  const historicalStats = useMemo(() => {
    if (mode !== 'auto') return null;

    let filteredOrders = orders;
    if (selectedProduct !== 'all') {
      filteredOrders = filteredOrders.filter(o => checkProductMatch(o, selectedProduct, inventoryProducts));
    }

    const getQty = (o: any) => Number(o.qnts) || 1;
    const totalOrdersCount = filteredOrders.reduce((sum, o) => sum + getQty(o), 0);
    if (totalOrdersCount === 0) return null;

    const confirmedOrders = filteredOrders.filter(o => o.status1 === 'مؤكد' || ['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع'].includes(o.status2 || ''));
    const confirmedCount = confirmedOrders.reduce((sum, o) => sum + getQty(o), 0);
    
    // We map delivery status
    const getStatus = (s: string, o?: any) => {
        if (o && o.isExchangedReturn) return 'delivered';
        if (!s) return '';
        const st = s.trim().toLowerCase();
        if (st.includes('مستلم') || st.includes('livré') || st.includes('تم التوصيل')) return 'delivered';
        if (st.includes('مرتجع') || st.includes('retour') || st.includes('فشل')) return 'returned';
        return 'other';
    };

    const deliveredOrders = filteredOrders.filter(o => getStatus(o.status2 || '', o) === 'delivered');
    const returnedOrders = filteredOrders.filter(o => getStatus(o.status2 || '', o) === 'returned');
    
    const deliveredCount = deliveredOrders.reduce((sum, o) => sum + getQty(o), 0);
    const returnedCount = returnedOrders.reduce((sum, o) => sum + getQty(o), 0);

    const confRate = totalOrdersCount > 0 ? (confirmedCount / totalOrdersCount) * 100 : 0;
    
    const resolvedShippedCount = deliveredCount + returnedCount;
    const delivRate = resolvedShippedCount > 0 ? (deliveredCount / resolvedShippedCount) * 100 : 0;
    
    // Avg Prices
    const avgSellingPrice = filteredOrders.reduce((sum, o) => sum + (Number(o.totalCharge) || 0), 0) / (totalOrdersCount || 1);
    const avgDeliveryCost = filteredOrders.reduce((sum, o) => sum + getEffectiveShippingCost(o), 0) / (totalOrdersCount || 1);
    
    // Calculate daily average orders (last 30 days)
    const thirtyDaysAgo = addDays(new Date(), -30);
    const recentOrders = filteredOrders.filter(o => o.orderDate && isAfter(parseISO(o.orderDate), thirtyDaysAgo));
    const recentOrdersCount = recentOrders.reduce((sum, o) => sum + getQty(o), 0);
    const dailyOrdersAvg = recentOrdersCount / 30;

    // We can use actual product cost if selected
    let prodCost = 0;
    if (selectedProduct !== 'all') {
        const fakeOrder = { sku: selectedProduct.startsWith('P::') || selectedProduct.startsWith('V::') ? selectedProduct.substring(3) : selectedProduct, qnts: 1 };
        const costInfo = getOrderUnitAndTotalCost(fakeOrder, inventoryProducts, settings);
        prodCost = costInfo.unitCost || 0;
    } else {
        // Average product cost across orders
        const ordersWithCost = filteredOrders.map(o => getOrderUnitAndTotalCost(o, inventoryProducts, settings)).filter(c => c.unitCost > 0);
        if (ordersWithCost.length > 0) {
            prodCost = ordersWithCost.reduce((sum, c) => sum + c.unitCost, 0) / ordersWithCost.length;
        }
    }

    // CPA calculation
    let totalAdSpend = 0;
    const matchingCampaigns = campaigns.filter(c => isCampaignMatchedToProduct(c, selectedProduct, inventoryProducts));
    const matchingCampaignIds = matchingCampaigns.map(c => c.id);
    campaignRecords.forEach(r => {
        if (matchingCampaignIds.includes(r.campaignId)) {
            totalAdSpend += (Number(r.spend) || 0);
        }
    });
    
    // Average CPA per order (in USD)
    const cpaUSD = totalOrdersCount > 0 ? (totalAdSpend / totalOrdersCount) : 0;

    return {
        dailyOrders: dailyOrdersAvg,
        confirmationRate: confRate,
        deliveryRate: delivRate,
        sellingPrice: avgSellingPrice,
        productCost: prodCost,
        deliveryCost: avgDeliveryCost,
        returnCost: settings?.returnCost || 400,
        cpa: cpaUSD
    };
  }, [orders, selectedProduct, mode, inventoryProducts, settings, campaigns, campaignRecords]);

  // Simulation Data Generation
  const simulationData = useMemo(() => {
    const days = Math.max(1, differenceInDays(parseISO(targetDate), new Date()));
    const data = [];
    
    const stats = mode === 'auto' ? (historicalStats || manualInputs) : manualInputs;
    
    // Fallback if auto mode lacks data
    const dailyOrders = stats.dailyOrders || 10;
    const confRate = (stats.confirmationRate || 0) / 100;
    const delivRate = (stats.deliveryRate || 0) / 100;
    const cpaDZD = (stats.cpa || 0) * exchangeRate;
    
    let cumulativeProfit = 0;
    let cumulativeRevenue = 0;
    let cumulativeCost = 0;
    let cumulativeOrders = 0;
    let cumulativeDelivered = 0;

    for (let i = 1; i <= days; i++) {
        const date = addDays(new Date(), i);
        
        // Simulating the funnel for this day
        const dayOrders = dailyOrders;
        const dayConfirmed = dayOrders * confRate;
        const dayShipped = dayConfirmed; // assuming all confirmed are shipped
        const dayDelivered = dayShipped * delivRate;
        const dayReturned = dayShipped * (1 - delivRate);

        // Financials
        const dayRevenue = dayDelivered * stats.sellingPrice;
        const dayProductCost = dayDelivered * stats.productCost; // cost for delivered
        const dayLostProductCost = dayReturned * (stats.productCost * 0.1); // assumed 10% damage/loss on returns
        
        const dayDeliveryCost = dayDelivered * stats.deliveryCost;
        const dayReturnCost = dayReturned * stats.returnCost;
        const dayAdSpend = dayOrders * cpaDZD; // ads paid for all generated orders

        const dayTotalCost = dayProductCost + dayLostProductCost + dayDeliveryCost + dayReturnCost + dayAdSpend;
        const dayNetProfit = dayRevenue - dayTotalCost;

        cumulativeProfit += dayNetProfit;
        cumulativeRevenue += dayRevenue;
        cumulativeCost += dayTotalCost;
        cumulativeOrders += dayOrders;
        cumulativeDelivered += dayDelivered;

        data.push({
            date: format(date, 'dd MMM', { locale: ar }),
            fullDate: format(date, 'yyyy-MM-dd'),
            dayOrders: Math.round(dayOrders),
            dayDelivered: Math.round(dayDelivered),
            dayRevenue,
            dayCost: dayTotalCost,
            dayProfit: dayNetProfit,
            cumulativeProfit,
            cumulativeRevenue,
            cumulativeCost,
            cumulativeOrders,
            cumulativeDelivered
        });
    }

    return data;
  }, [mode, targetDate, manualInputs, historicalStats, exchangeRate]);

  const totals = simulationData.length > 0 ? simulationData[simulationData.length - 1] : null;

  // 📊 Calculate Historical Actual Net Averages (since start)
  const historicalActuals = useMemo(() => {
    let filteredOrders = orders;
    if (selectedProduct !== 'all') {
      filteredOrders = filteredOrders.filter(o => checkProductMatch(o, selectedProduct, inventoryProducts));
    }

    if (filteredOrders.length === 0) return null;

    const getStatus = (s: string, o?: any) => {
      if (o && o.isExchangedReturn) return 'delivered';
      if (!s) return '';
      const st = s.trim().toLowerCase();
      if (st.includes('مستلم') || st.includes('livré') || st.includes('تم التوصيل')) return 'delivered';
      if (st.includes('مرتجع') || st.includes('retour') || st.includes('فشل')) return 'returned';
      return 'other';
    };

    const delivered = filteredOrders.filter(o => getStatus(o.status2 || '', o) === 'delivered');
    const returned = filteredOrders.filter(o => getStatus(o.status2 || '', o) === 'returned');

    const dates = filteredOrders.map(o => o.orderDate).filter(Boolean).map(d => parseISO(d)).filter(d => !isNaN(d.getTime()));
    if (dates.length === 0) return null;

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date();
    const daysSpan = Math.max(1, differenceInDays(maxDate, minDate) + 1);

    const totalRevenue = delivered.reduce((sum, o) => sum + (Number(o.totalCharge) || 0), 0);

    const totalDeliveryCost = delivered.reduce((sum, o) => {
      return sum + getEffectiveShippingCost(o);
    }, 0);

    const totalProductCost = delivered.reduce((sum, o) => {
      const qty = Number(o.qnts) || 1;
      const sku = o.sku ? o.sku.split(',')[0].trim() : '';
      const invProd = inventoryProducts.find(p => p.sku === sku || p.variations?.some((v: any) => v.sku === sku));
      const cost = invProd ? (invProd.cost || 0) : 0;
      return sum + (cost * qty);
    }, 0);

    const returnCostPerOrder = settings?.returnCost || 400;
    const totalReturnCost = returned.length * returnCostPerOrder;

    let totalAdSpend = 0;
    const matchingCampaigns = campaigns.filter(c => isCampaignMatchedToProduct(c, selectedProduct, inventoryProducts));
    const matchingCampaignIds = matchingCampaigns.map(c => c.id);
    const rate = settings?.exchangeRate || 245;

    campaignRecords.forEach(r => {
      if (matchingCampaignIds.includes(r.campaignId)) {
        totalAdSpend += (Number(r.spend) || 0) * rate;
      }
    });

    const totalCosts = totalDeliveryCost + totalProductCost + totalReturnCost + totalAdSpend;
    const totalNetProfit = totalRevenue - totalCosts;

    const dailyNetAvg = totalNetProfit / daysSpan;
    const weeklyNetAvg = dailyNetAvg * 7;
    const monthlyNetAvg = dailyNetAvg * 30;

    return {
      minDate: format(minDate, 'yyyy-MM-dd'),
      daysSpan,
      totalNetProfit,
      dailyNetAvg,
      weeklyNetAvg,
      monthlyNetAvg,
      totalDelivered: delivered.length,
      totalRevenue,
      totalCosts
    };
  }, [orders, selectedProduct, inventoryProducts, settings, campaigns, campaignRecords]);

  // 📊 Calculate Simulation Net Averages
  const simulationAverages = useMemo(() => {
    if (!simulationData || simulationData.length === 0) return null;
    const totalDays = simulationData.length;
    const lastRow = simulationData[simulationData.length - 1];
    const totalNetProfit = lastRow.cumulativeProfit;

    const dailyNetAvg = totalNetProfit / totalDays;
    const weeklyNetAvg = dailyNetAvg * 7;
    const monthlyNetAvg = dailyNetAvg * 30;

    return {
      minDate: simulationData[0]?.fullDate || '',
      daysSpan: totalDays,
      totalNetProfit,
      dailyNetAvg,
      weeklyNetAvg,
      monthlyNetAvg
    };
  }, [simulationData]);

  // 📈 Historical Chart Data
  const historicalChartData = useMemo(() => {
    let filteredOrders = orders;
    if (selectedProduct !== 'all') {
      filteredOrders = filteredOrders.filter(o => checkProductMatch(o, selectedProduct, inventoryProducts));
    }

    if (filteredOrders.length === 0) return [];

    const getStatus = (s: string, o?: any) => {
      if (o && o.isExchangedReturn) return 'delivered';
      if (!s) return '';
      const st = s.trim().toLowerCase();
      if (st.includes('مستلم') || st.includes('livré') || st.includes('تم التوصيل')) return 'delivered';
      if (st.includes('مرتجع') || st.includes('retour') || st.includes('فشل')) return 'returned';
      return 'other';
    };

    const mapByDate: Record<string, { revenue: number; deliveryCost: number; prodCost: number; returnCost: number; ordersCount: number }> = {};

    filteredOrders.forEach(o => {
      if (!o.orderDate) return;
      const dateStr = o.orderDate.substring(0, 10);
      if (!mapByDate[dateStr]) {
        mapByDate[dateStr] = { revenue: 0, deliveryCost: 0, prodCost: 0, returnCost: 0, ordersCount: 0 };
      }
      const st = getStatus(o.status2 || '', o);
      const qty = Number(o.qnts) || 1;
      mapByDate[dateStr].ordersCount += qty;

      if (st === 'delivered') {
        mapByDate[dateStr].revenue += (Number(o.totalCharge) || 0);
        mapByDate[dateStr].deliveryCost += getEffectiveShippingCost(o);

        const sku = o.sku ? o.sku.split(',')[0].trim() : '';
        const invProd = inventoryProducts.find(p => p.sku === sku || p.variations?.some((v: any) => v.sku === sku));
        const cost = invProd ? (invProd.cost || 0) : 0;
        mapByDate[dateStr].prodCost += (cost * qty);
      } else if (st === 'returned') {
        const returnFee = settings?.returnCost || 400;
        mapByDate[dateStr].returnCost += returnFee;
      }
    });

    const sortedDates = Object.keys(mapByDate).sort();
    if (sortedDates.length === 0) return [];

    const adSpendByDate: Record<string, number> = {};
    const matchingCampaigns = campaigns.filter(c => isCampaignMatchedToProduct(c, selectedProduct, inventoryProducts));
    const matchingCampaignIds = matchingCampaigns.map(c => c.id);
    const rate = settings?.exchangeRate || 245;

    campaignRecords.forEach(r => {
      if (matchingCampaignIds.includes(r.campaignId) && r.date) {
        const dateStr = r.date.substring(0, 10);
        adSpendByDate[dateStr] = (adSpendByDate[dateStr] || 0) + (Number(r.spend) || 0) * rate;
      }
    });

    const startDate = parseISO(sortedDates[0]);
    const endDate = new Date();
    const daysTotal = Math.max(1, differenceInDays(endDate, startDate) + 1);

    const result = [];
    let cumProfit = 0;

    for (let i = 0; i < daysTotal; i++) {
      const curDate = addDays(startDate, i);
      const dateStr = format(curDate, 'yyyy-MM-dd');
      const displayDate = format(curDate, 'dd MMM', { locale: ar });

      const dayData = mapByDate[dateStr] || { revenue: 0, deliveryCost: 0, prodCost: 0, returnCost: 0, ordersCount: 0 };
      const dayAdSpend = adSpendByDate[dateStr] || 0;

      const dayTotalCost = dayData.deliveryCost + dayData.prodCost + dayData.returnCost + dayAdSpend;
      const dayProfit = dayData.revenue - dayTotalCost;
      cumProfit += dayProfit;

      const dayIndex = i + 1;
      const runningDailyAvg = cumProfit / dayIndex;
      const runningWeeklyAvg = runningDailyAvg * 7;
      const runningMonthlyAvg = runningDailyAvg * 30;

      result.push({
        date: displayDate,
        fullDate: dateStr,
        dayProfit,
        revenue: dayData.revenue,
        cost: dayTotalCost,
        cumulativeProfit: cumProfit,
        runningDailyAvg: Math.round(runningDailyAvg),
        runningWeeklyAvg: Math.round(runningWeeklyAvg),
        runningMonthlyAvg: Math.round(runningMonthlyAvg)
      });
    }

    return result;
  }, [orders, selectedProduct, inventoryProducts, settings, campaigns, campaignRecords]);

  // 📈 Simulation Chart Data with Averages
  const simulationChartData = useMemo(() => {
    return simulationData.map((row, idx) => {
      const dayNum = idx + 1;
      const runningDailyAvg = row.cumulativeProfit / dayNum;
      const runningWeeklyAvg = runningDailyAvg * 7;
      const runningMonthlyAvg = runningDailyAvg * 30;

      return {
        ...row,
        runningDailyAvg: Math.round(runningDailyAvg),
        runningWeeklyAvg: Math.round(runningWeeklyAvg),
        runningMonthlyAvg: Math.round(runningMonthlyAvg)
      };
    });
  }, [simulationData]);

  return (
    <div className="p-4 md:p-8 space-y-8 bg-gray-50/50 min-h-screen" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <Target className="w-8 h-8 text-purple-600" />
            محاكي الأرباح المستقبلي
          </h2>
          <p className="text-gray-500 mt-2 font-medium">توقع أرباحك وتتبع مسار نمو مشروعك بناءً على معطيات واقعية أو افتراضية.</p>
        </div>
        
        <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
            <button 
                onClick={() => setMode('auto')}
                className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${mode === 'auto' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
            >
                <Activity className="w-4 h-4" />
                محاكاة آلية (حسب بياناتك)
            </button>
            <button 
                onClick={() => setMode('manual')}
                className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${mode === 'manual' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
            >
                <Settings2 className="w-4 h-4" />
                إدخال يدوي
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Panel */}
          <div className="lg:col-span-1 space-y-6">
             {/* Target Date */}
             <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                    تاريخ الهدف
                </h3>
                <input 
                    type="date"
                    value={targetDate}
                    min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                />
                <p className="text-xs text-gray-500 mt-2 font-medium">سيتم المحاكاة من اليوم وحتى هذا التاريخ.</p>
             </div>

             {mode === 'auto' && (
                 <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                     <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-emerald-500" />
                        المنتج المستهدف
                     </h3>
                     <select 
                        value={selectedProduct} 
                        onChange={(e) => {
                          setSelectedProduct(e.target.value);
                          setGlobalProductFilter(e.target.value);
                        }}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      >
                        <option value="all">كل المنتجات (إجمالي المتجر)</option>
                        {renderProductFilterOptions(inventoryProducts, orders)}
                      </select>

                      {historicalStats ? (
                          <div className="mt-6 p-4 bg-purple-50 rounded-xl border border-purple-100 space-y-3">
                              <h4 className="font-bold text-purple-800 text-sm border-b border-purple-200 pb-2 mb-3">النسب الحالية المستخرجة:</h4>
                              <div className="flex justify-between text-xs font-bold text-gray-700">
                                  <span>متوسط الطلبيات اليومية:</span>
                                  <span>{Math.round(historicalStats.dailyOrders)} طلبية</span>
                              </div>
                              <div className="flex justify-between text-xs font-bold text-gray-700">
                                  <span>نسبة التأكيد:</span>
                                  <span>{Math.round(historicalStats.confirmationRate)}%</span>
                              </div>
                              <div className="flex justify-between text-xs font-bold text-gray-700">
                                  <span>نسبة التوصيل:</span>
                                  <span>{Math.round(historicalStats.deliveryRate)}%</span>
                              </div>
                          </div>
                      ) : (
                          <div className="mt-4 p-4 bg-orange-50 text-orange-700 rounded-xl text-sm font-bold flex items-start gap-2">
                              <AlertTriangle className="w-5 h-5 shrink-0" />
                              <p>لا توجد بيانات كافية لهذا المنتج لاستخراج النسب الآلية.</p>
                          </div>
                      )}
                 </div>
             )}

             {mode === 'manual' && (
                 <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                     <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-blue-500" />
                        المعطيات اليدوية
                     </h3>
                     
                     <div className="space-y-4 mt-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5">الطلبيات اليومية المتوقعة</label>
                            <input type="number" value={manualInputs.dailyOrders} onChange={(e) => setManualInputs({...manualInputs, dailyOrders: Number(e.target.value)})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">نسبة التأكيد (%)</label>
                                <input type="number" value={manualInputs.confirmationRate} onChange={(e) => setManualInputs({...manualInputs, confirmationRate: Number(e.target.value)})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">نسبة التوصيل (%)</label>
                                <input type="number" value={manualInputs.deliveryRate} onChange={(e) => setManualInputs({...manualInputs, deliveryRate: Number(e.target.value)})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">سعر البيع (د.ج)</label>
                                <input type="number" value={manualInputs.sellingPrice} onChange={(e) => setManualInputs({...manualInputs, sellingPrice: Number(e.target.value)})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">تكلفة المنتج (د.ج)</label>
                                <input type="number" value={manualInputs.productCost} onChange={(e) => setManualInputs({...manualInputs, productCost: Number(e.target.value)})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">تكلفة التوصيل (د.ج)</label>
                                <input type="number" value={manualInputs.deliveryCost} onChange={(e) => setManualInputs({...manualInputs, deliveryCost: Number(e.target.value)})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1.5">تكلفة الروتور (د.ج)</label>
                                <input type="number" value={manualInputs.returnCost} onChange={(e) => setManualInputs({...manualInputs, returnCost: Number(e.target.value)})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5">تكلفة جلب الطلبية (CPA - دولار)</label>
                            <input type="number" value={manualInputs.cpa} onChange={(e) => setManualInputs({...manualInputs, cpa: Number(e.target.value)})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500" />
                        </div>
                     </div>
                 </div>
             )}
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-6">
             {/* Key Metrics */}
             <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                 <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden md:col-span-2">
                    <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500"></div>
                    <p className="text-xs font-bold text-gray-500 mb-1">الربح الصافي المتوقع</p>
                    <h3 className="text-xl font-black text-emerald-600">{formatCurrency(totals?.cumulativeProfit || 0)} <span className="text-[10px] font-bold">د.ج</span></h3>
                 </div>
                 <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden md:col-span-1">
                    <div className="absolute top-0 right-0 w-1 h-full bg-blue-500"></div>
                    <p className="text-xs font-bold text-gray-500 mb-1">رقم الأعمال</p>
                    <h3 className="text-lg font-black text-blue-600">{formatCurrency(totals?.cumulativeRevenue || 0)} <span className="text-[10px] font-bold">د.ج</span></h3>
                 </div>
                 <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden md:col-span-1">
                    <div className="absolute top-0 right-0 w-1 h-full bg-rose-500"></div>
                    <p className="text-xs font-bold text-gray-500 mb-1">التكاليف (إجمالي)</p>
                    <h3 className="text-lg font-black text-rose-600">{formatCurrency(totals?.cumulativeCost || 0)} <span className="text-[10px] font-bold">د.ج</span></h3>
                 </div>
                 <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden md:col-span-1">
                    <div className="absolute top-0 right-0 w-1 h-full bg-amber-500"></div>
                    <p className="text-xs font-bold text-gray-500 mb-1">الطلبيات المباعة (مستلمة)</p>
                    <h3 className="text-lg font-black text-amber-600">{Math.round(totals?.cumulativeDelivered || 0)} <span className="text-[10px] font-bold">طلبية</span></h3>
                 </div>
             </div>

             {/* 📊 Daily, Weekly, Monthly Net Profit Averages Cards & Chart */}
             <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                      <Coins className="w-5 h-5 text-amber-500" />
                      معدل الصافي اليومي، الأسبوعي والشهري
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">
                      حساب معدل الدخل الصافي الحقيقي أو المتوقع بقسمة إجمالي أرباح المستلم على عدد الأيام.
                    </p>
                  </div>

                  {/* Toggle Source */}
                  <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold border border-gray-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => setAveragesSource('actual')}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        averagesSource === 'actual' ? 'bg-white text-indigo-700 shadow-xs font-black' : 'text-gray-600 hover:bg-gray-200/60'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5 text-indigo-500" />
                      البيانات الفعلية (منذ البداية)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAveragesSource('simulation')}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        averagesSource === 'simulation' ? 'bg-white text-purple-700 shadow-xs font-black' : 'text-gray-600 hover:bg-gray-200/60'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      توقعات المحاكاة
                    </button>
                  </div>
                </div>

                {/* Averages Cards Grid */}
                {(() => {
                  const currentAvg = averagesSource === 'actual' ? historicalActuals : simulationAverages;
                  
                  if (!currentAvg) {
                    return (
                      <div className="p-6 bg-amber-50 text-amber-800 rounded-xl text-xs font-bold text-center">
                        لا توجد بيانات كافية لحساب المعدلات المالية لهذه الفئة.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Daily Net Average */}
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 rounded-xl border border-emerald-200 shadow-2xs relative">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-800 mb-1">
                          <span>معدل الصافي اليومي</span>
                          <span className="text-[10px] bg-emerald-200/60 text-emerald-900 px-1.5 py-0.5 rounded font-mono">يومي</span>
                        </div>
                        <div className="text-2xl font-black text-emerald-700">
                          {formatCurrency(currentAvg.dailyNetAvg)} <span className="text-xs font-bold">د.ج / يوم</span>
                        </div>
                        <div className="text-[10px] text-emerald-600 font-medium mt-1">
                          الصافي ({formatCurrency(currentAvg.totalNetProfit)} د.ج) ÷ {currentAvg.daysSpan} يوم
                        </div>
                      </div>

                      {/* Weekly Net Average */}
                      <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 p-4 rounded-xl border border-indigo-200 shadow-2xs relative">
                        <div className="flex items-center justify-between text-xs font-bold text-indigo-800 mb-1">
                          <span>معدل الصافي الأسبوعي</span>
                          <span className="text-[10px] bg-indigo-200/60 text-indigo-900 px-1.5 py-0.5 rounded font-mono">أسبوعي</span>
                        </div>
                        <div className="text-2xl font-black text-indigo-700">
                          {formatCurrency(currentAvg.weeklyNetAvg)} <span className="text-xs font-bold">د.ج / أسبوع</span>
                        </div>
                        <div className="text-[10px] text-indigo-600 font-medium mt-1">
                          المعدل اليومي × 7 أيام
                        </div>
                      </div>

                      {/* Monthly Net Average */}
                      <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50/50 p-4 rounded-xl border border-purple-200 shadow-2xs relative">
                        <div className="flex items-center justify-between text-xs font-bold text-purple-800 mb-1">
                          <span>معدل الصافي الشهري</span>
                          <span className="text-[10px] bg-purple-200/60 text-purple-900 px-1.5 py-0.5 rounded font-mono">شهري</span>
                        </div>
                        <div className="text-2xl font-black text-purple-700">
                          {formatCurrency(currentAvg.monthlyNetAvg)} <span className="text-xs font-bold">د.ج / شهر</span>
                        </div>
                        <div className="text-[10px] text-purple-600 font-medium mt-1">
                          المعدل اليومي × 30 يوم
                        </div>
                      </div>

                      {/* Calculation Period */}
                      <div className="bg-gradient-to-br from-slate-50 to-gray-100 p-4 rounded-xl border border-slate-200 shadow-2xs relative">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                          <span>فترة المحاسبة المحسوبة</span>
                          <Clock className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="text-2xl font-black text-slate-800">
                          {currentAvg.daysSpan} <span className="text-xs font-bold">يوم</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-1">
                          {averagesSource === 'actual' ? `منذ أول طلبية (${currentAvg.minDate || '-'})` : `فترة أهداف المحاكاة`}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Averages Chart */}
                <div className="pt-2">
                  <h4 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                    مخطط مسار المعدل اليومي والأسبوعي للصافي على مدار الفترة
                  </h4>
                  <div className="h-72 w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={averagesSource === 'actual' ? historicalChartData : simulationChartData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{fontSize: 11, fill: '#64748b', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 11, fill: '#64748b', fontWeight: 'bold'}} axisLine={false} tickLine={false} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} />
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [
                            formatCurrency(value) + ' د.ج',
                            name === 'dayProfit' ? 'الربح الصافي لليوم' : name === 'runningDailyAvg' ? 'معدل الصافي اليومي' : name === 'runningWeeklyAvg' ? 'معدل الصافي الأسبوعي' : 'معدل الصافي الشهري'
                          ]}
                          labelFormatter={(label) => `التاريخ: ${label}`}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend wrapperStyle={{ fontWeight: 'bold', fontSize: '11px', marginTop: '10px' }} />
                        <Line type="monotone" name="الربح الصافي لليوم" dataKey="dayProfit" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                        <Line type="monotone" name="معدل الصافي اليومي" dataKey="runningDailyAvg" stroke="#10b981" strokeWidth={3} dot={false} />
                        <Line type="monotone" name="معدل الصافي الأسبوعي" dataKey="runningWeeklyAvg" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" name="معدل الصافي الشهري" dataKey="runningMonthlyAvg" stroke="#a855f7" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
             </div>

             {/* Charts */}
             <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    منحنى التطور التراكمي
                </h3>
                <div className="h-80 w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={simulationData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748b', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                            <YAxis tick={{fontSize: 12, fill: '#64748b', fontWeight: 'bold'}} axisLine={false} tickLine={false} tickFormatter={(val) => `${(val/1000000).toFixed(1)}M`} />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <RechartsTooltip 
                                formatter={(value: number, name: string) => [formatCurrency(value) + ' د.ج', name === 'cumulativeProfit' ? 'الربح الصافي' : name === 'cumulativeRevenue' ? 'المبيعات' : 'التكاليف']}
                                labelFormatter={(label) => `التاريخ: ${label}`}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend wrapperStyle={{ fontWeight: 'bold', fontSize: '12px', marginTop: '10px' }} />
                            <Area type="monotone" name="المبيعات (رقم الأعمال)" dataKey="cumulativeRevenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                            <Area type="monotone" name="الربح الصافي التراكمي" dataKey="cumulativeProfit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
             </div>
             
             {/* Daily Breakdown Table */}
             <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
                 <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
                    <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-slate-500" />
                        التفاصيل اليومية
                    </h3>
                 </div>
                 <div className="flex-1 overflow-auto custom-scrollbar">
                     <table className="w-full text-right text-xs">
                         <thead className="bg-white sticky top-0 shadow-sm z-10">
                             <tr>
                                 <th className="p-3 font-bold text-gray-500 border-b border-gray-200">التاريخ</th>
                                 <th className="p-3 font-bold text-gray-500 border-b border-gray-200">الطلبيات</th>
                                 <th className="p-3 font-bold text-gray-500 border-b border-gray-200">المستلمة</th>
                                 <th className="p-3 font-bold text-gray-500 border-b border-gray-200">المبيعات</th>
                                 <th className="p-3 font-bold text-gray-500 border-b border-gray-200">التكاليف</th>
                                 <th className="p-3 font-bold text-emerald-600 border-b border-gray-200">الربح الصافي</th>
                             </tr>
                         </thead>
                         <tbody>
                             {simulationData.map((row, idx) => (
                                 <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                     <td className="p-3 font-bold text-gray-800">{row.date}</td>
                                     <td className="p-3 text-gray-600 font-medium">{row.dayOrders}</td>
                                     <td className="p-3 text-gray-600 font-medium">{row.dayDelivered}</td>
                                     <td className="p-3 text-blue-600 font-bold">{formatCurrency(row.dayRevenue)} د.ج</td>
                                     <td className="p-3 text-rose-600 font-bold">{formatCurrency(row.dayCost)} د.ج</td>
                                     <td className="p-3 text-emerald-600 font-black bg-emerald-50/30">{formatCurrency(row.dayProfit)} د.ج</td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
             </div>

          </div>
      </div>
    </div>
  );
}
