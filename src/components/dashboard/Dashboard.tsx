import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store';
import { checkProductMatch, renderProductFilterOptions } from '../../utils/productFilters';
import { createFinanceCalculator } from '../../utils/financeCalculations';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { format, subDays, parseISO, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, subMonths, subWeeks, subDays as subDaysDateFns } from 'date-fns';
import { ar } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Package, Percent, DollarSign, Calendar, Filter, Truck, Ban, Megaphone, Activity, AlertTriangle, ArrowRight, ChevronDown, X, Search, LayoutGrid, List, ChevronLeft, ChevronRight, Layers, Tag, SlidersHorizontal, Boxes, Banknote } from 'lucide-react';
import { needsAction, getActionPriority } from '../../utils/orderUtils';
import { AppSectionsCard } from '../layout/AppSectionsCard';

export function Dashboard({ onViewChange }: { onViewChange?: (view: any) => void }) {
  const { orders, campaigns, campaignRecords, settings, inventoryProducts, globalProductFilter, setGlobalProductFilter, users, expenses } = useStore();
  const [isAlertExpanded, setIsAlertExpanded] = useState(false);
  const [isSmartAlertDismissed, setIsSmartAlertDismissed] = useState(false);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'custom'>(() => {
    return (localStorage.getItem('dashboard_dateFilter') as any) || 'month';
  });
  const [customStart, setCustomStart] = useState<string>(() => localStorage.getItem('dashboard_customStart') || '');
  const [customEnd, setCustomEnd] = useState<string>(() => localStorage.getItem('dashboard_customEnd') || '');
  const [confirmerFilter, setConfirmerFilter] = useState<string>(() => localStorage.getItem('dashboard_confirmerFilter') || 'all');
  const [productFilter, setProductFilter] = useState<string>(() => globalProductFilter || localStorage.getItem('dashboard_productFilter') || 'all');

  useEffect(() => {
    if (globalProductFilter !== undefined) {
      setProductFilter(prev => (prev === globalProductFilter ? prev : globalProductFilter));
    }
  }, [globalProductFilter]);
  const [comparePeriod, setComparePeriod] = useState<boolean>(() => localStorage.getItem('dashboard_compare') === 'true');
  const [compareType, setCompareType] = useState<'auto' | 'custom'>(() => (localStorage.getItem('dashboard_compareType') as any) || 'auto');
  const [compareCustomStart, setCompareCustomStart] = useState<string>(() => localStorage.getItem('dashboard_compareCustomStart') || '');
  const [compareCustomEnd, setCompareCustomEnd] = useState<string>(() => localStorage.getItem('dashboard_compareCustomEnd') || '');

  // CPA Table Controls State
  const [cpaSearch, setCpaSearch] = useState('');
  const [cpaFilter, setCpaFilter] = useState<'all' | 'funded' | 'sales' | 'variations'>('all');
  const [cpaViewMode, setCpaViewMode] = useState<'table' | 'cards'>('table');
  const [cpaPage, setCpaPage] = useState(1);
  const [cpaPerPage, setCpaPerPage] = useState<number>(12);

  useEffect(() => {
    localStorage.setItem('dashboard_dateFilter', dateFilter);
    localStorage.setItem('dashboard_customStart', customStart);
    localStorage.setItem('dashboard_customEnd', customEnd);
    localStorage.setItem('dashboard_confirmerFilter', confirmerFilter);
    localStorage.setItem('dashboard_productFilter', productFilter);
    localStorage.setItem('dashboard_compare', comparePeriod.toString());
    localStorage.setItem('dashboard_compareType', compareType);
    localStorage.setItem('dashboard_compareCustomStart', compareCustomStart);
    localStorage.setItem('dashboard_compareCustomEnd', compareCustomEnd);
  }, [dateFilter, customStart, customEnd, confirmerFilter, productFilter, comparePeriod, compareType, compareCustomStart, compareCustomEnd]);

  const productFilterOptionsJSX = useMemo(() => {
    return renderProductFilterOptions(inventoryProducts, orders);
  }, [orders, inventoryProducts]);

  const { start, end, compareStart, compareEnd } = useMemo(() => {
    const now = new Date();
    let s: Date;
    let e: Date = endOfDay(now);
    let cS: Date | null = null;
    let cE: Date | null = null;

    switch (dateFilter) {
      case 'today':
        s = startOfDay(now);
        cS = startOfDay(subDaysDateFns(s, 1));
        cE = endOfDay(subDaysDateFns(e, 1));
        break;
      case 'week':
        s = startOfWeek(now, { weekStartsOn: 6 });
        cS = startOfWeek(subWeeks(s, 1), { weekStartsOn: 6 });
        cE = endOfWeek(subWeeks(e, 1), { weekStartsOn: 6 });
        break;
      case 'month':
        s = startOfMonth(now);
        cS = startOfMonth(subMonths(s, 1));
        cE = endOfDay(subMonths(e, 1));
        break;
      case 'custom':
        s = customStart ? startOfDay(parseISO(customStart)) : startOfMonth(now);
        e = customEnd ? endOfDay(parseISO(customEnd)) : endOfDay(now);
        const diff = e.getTime() - s.getTime();
        cE = new Date(s.getTime() - 1);
        cS = new Date(cE.getTime() - diff);
        break;
      default:
        s = startOfMonth(now);
        cS = startOfMonth(subMonths(s, 1));
        cE = endOfDay(subMonths(e, 1));
    }

    if (compareType === 'custom') {
      cS = compareCustomStart ? startOfDay(parseISO(compareCustomStart)) : cS;
      cE = compareCustomEnd ? endOfDay(parseISO(compareCustomEnd)) : cE;
    }

    return { start: s, end: e, compareStart: cS, compareEnd: cE };
  }, [dateFilter, customStart, customEnd, compareType, compareCustomStart, compareCustomEnd]);

  const { filteredOrders, previousOrders } = useMemo(() => {
    const curr: typeof orders = [];
    const prev: typeof orders = [];

    orders.forEach(o => {
      if (confirmerFilter !== 'all' && o.confirmedBy !== confirmerFilter) return;
      if (!checkProductMatch(o, productFilter, inventoryProducts)) return;
      if (!o.orderDate) return;

      const oDate = parseISO(o.orderDate);
      if (isWithinInterval(oDate, { start, end })) {
        curr.push(o);
      } else if (comparePeriod && compareStart && compareEnd && isWithinInterval(oDate, { start: compareStart, end: compareEnd })) {
        prev.push(o);
      }
    });

    return { filteredOrders: curr, previousOrders: prev };
  }, [orders, start, end, compareStart, compareEnd, confirmerFilter, productFilter, comparePeriod]);

  // Metrics Calculations (Current)
  const totalSales = filteredOrders.filter(o => o.status1 === 'مؤكد').reduce((acc, curr) => acc + curr.totalCharge, 0);
  const deliveredSales = filteredOrders.filter(o => (o.status2 === 'مستلم' || o.isExchangedReturn)).reduce((acc, curr) => acc + curr.totalCharge, 0);
  
  const getQty = (o: any) => Number(o.qnts) || 1;
  const totalOrders = filteredOrders.reduce((acc, o) => acc + getQty(o), 0);
  const confirmedOrders = filteredOrders.filter(o => o.status1 === 'مؤكد').reduce((acc, o) => acc + getQty(o), 0);
  const returnedOrders = filteredOrders.filter(o => (o.status2 === 'مرتجع' && !o.isExchangedReturn)).reduce((acc, o) => acc + getQty(o), 0);
  const canceledOrders = filteredOrders.filter(o => o.status1 === 'ملغى').reduce((acc, o) => acc + getQty(o), 0);
  const deliveredOrders = filteredOrders.filter(o => (o.status2 === 'مستلم' || o.isExchangedReturn)).reduce((acc, o) => acc + getQty(o), 0);
  
  const confirmationRate = totalOrders > 0 ? ((confirmedOrders / totalOrders) * 100).toFixed(1) : '0';
  const returnRate = confirmedOrders > 0 ? ((returnedOrders / confirmedOrders) * 100).toFixed(1) : '0';
  const deliveryRate = confirmedOrders > 0 ? ((deliveredOrders / confirmedOrders) * 100).toFixed(1) : '0';
  const cancellationRate = totalOrders > 0 ? ((canceledOrders / totalOrders) * 100).toFixed(1) : '0';

  // Metrics Calculations (Previous for comparison)
  const prevTotalOrders = previousOrders.reduce((acc, o) => acc + getQty(o), 0);
  const prevConfirmedOrders = previousOrders.filter(o => o.status1 === 'مؤكد').reduce((acc, o) => acc + getQty(o), 0);
  const prevReturnedOrders = previousOrders.filter(o => (o.status2 === 'مرتجع' && !o.isExchangedReturn)).reduce((acc, o) => acc + getQty(o), 0);
  const prevDeliveredOrders = previousOrders.filter(o => (o.status2 === 'مستلم' || o.isExchangedReturn)).reduce((acc, o) => acc + getQty(o), 0);
  const prevCanceledOrders = previousOrders.filter(o => o.status1 === 'ملغى').reduce((acc, o) => acc + getQty(o), 0);
  const prevTotalSales = previousOrders.filter(o => o.status1 === 'مؤكد').reduce((acc, curr) => acc + curr.totalCharge, 0);
  const prevDeliveredSales = previousOrders.filter(o => (o.status2 === 'مستلم' || o.isExchangedReturn)).reduce((acc, curr) => acc + curr.totalCharge, 0);

  const prevConfirmationRate = prevTotalOrders > 0 ? ((prevConfirmedOrders / prevTotalOrders) * 100).toFixed(1) : '0';
  const prevReturnRate = prevConfirmedOrders > 0 ? ((prevReturnedOrders / prevConfirmedOrders) * 100).toFixed(1) : '0';
  const prevDeliveryRate = prevConfirmedOrders > 0 ? ((prevDeliveredOrders / prevConfirmedOrders) * 100).toFixed(1) : '0';
  const prevCancellationRate = prevTotalOrders > 0 ? ((prevCanceledOrders / prevTotalOrders) * 100).toFixed(1) : '0';

  const calcTrend = (curr: number, prev: number) => {
    if (!comparePeriod) return null;
    if (prev === 0) return curr > 0 ? { value: '+100%', up: true } : { value: '0%', up: true };
    const diff = ((curr - prev) / prev) * 100;
    return { value: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`, up: diff >= 0 };
  };

  // Total Ad Spend from Campaigns
  const { filteredCampaigns, previousCampaigns } = useMemo(() => {
    const curr: typeof campaignRecords = [];
    const prev: typeof campaignRecords = [];

    campaignRecords.forEach(c => {
      if (!c.date) return;
      const cDate = parseISO(c.date);
      if (isWithinInterval(cDate, { start, end })) {
        curr.push(c);
      } else if (comparePeriod && compareStart && compareEnd && isWithinInterval(cDate, { start: compareStart, end: compareEnd })) {
        prev.push(c);
      }
    });

    return { filteredCampaigns: curr, previousCampaigns: prev };
  }, [campaignRecords, start, end, compareStart, compareEnd, comparePeriod]);

  const totalAdSpend = filteredCampaigns.reduce((acc, curr) => acc + curr.spend, 0);

  const dashboardFinance = useMemo(() => {
    return createFinanceCalculator(
      orders,
      expenses || [],
      campaigns,
      campaignRecords,
      settings,
      inventoryProducts,
      dateFilter,
      start,
      end,
      productFilter || 'all',
      confirmerFilter || 'all'
    );
  }, [orders, expenses, campaigns, campaignRecords, settings, inventoryProducts, dateFilter, start, end, productFilter, confirmerFilter]);

  const prevDashboardFinance = useMemo(() => {
    if (!comparePeriod || !compareStart || !compareEnd) return null;
    return createFinanceCalculator(
      orders,
      expenses || [],
      campaigns,
      campaignRecords,
      settings,
      inventoryProducts,
      dateFilter,
      compareStart,
      compareEnd,
      productFilter || 'all',
      confirmerFilter || 'all'
    );
  }, [orders, expenses, campaigns, campaignRecords, settings, inventoryProducts, dateFilter, compareStart, compareEnd, productFilter, confirmerFilter, comparePeriod]);

  const netProfitAmount = dashboardFinance.realNetProfit;
  const prevAdSpend = previousCampaigns.reduce((acc, curr) => acc + curr.spend, 0);
  const prevNetProfit = prevDashboardFinance ? prevDashboardFinance.realNetProfit : 0;

  // Additional Campaign Metrics
  const costPerOrder = confirmedOrders > 0 ? totalAdSpend / confirmedOrders : 0;
  const costPerDelivered = deliveredOrders > 0 ? totalAdSpend / deliveredOrders : 0;
  const roas = totalAdSpend > 0 ? (deliveredSales / totalAdSpend).toFixed(2) : '0';

  const prevCostPerOrder = prevConfirmedOrders > 0 ? prevAdSpend / prevConfirmedOrders : 0;
  const prevCostPerDelivered = previousOrders.filter(o => (o.status2 === 'مستلم' || o.isExchangedReturn)).length > 0 
    ? prevAdSpend / previousOrders.filter(o => (o.status2 === 'مستلم' || o.isExchangedReturn)).length 
    : 0;

  const productMetrics = useMemo(() => {
    const metrics: Record<string, { 
      id: string;
      spend: number; 
      shippedCount: number; 
      deliveredCount: number; 
      name: string; 
      sku: string; 
      image: string;
      avgCost: number;
      variationsCount: number;
      isOffer: boolean;
      hasCampaign: boolean;
      hasActiveCampaign: boolean;
    }> = {};

    // 1. Pre-populate metrics with ALL products from inventory
    (inventoryProducts || []).forEach(p => {
      const key = String(p.id);
      let avgCost = Number(p.local_cost || 0);
      const vars = p.variations || [];
      const hasVars = vars.length > 0;
      
      if (hasVars) {
        const varCosts = vars.map((v: any) => Number(v.local_cost ?? p.local_cost ?? 0)).filter((c: number) => c > 0);
        if (varCosts.length > 0) {
          avgCost = varCosts.reduce((a: number, b: number) => a + b, 0) / varCosts.length;
        }
      }

      const isOffer = Boolean(p.local_is_offers) || vars.some((v: any) => 
        v.attributes?.some((a: any) => a.option && (a.option.includes('عرض') || a.option.includes('pack') || a.option.includes('كمية')))
      );

      metrics[key] = {
        id: key,
        spend: 0,
        shippedCount: 0,
        deliveredCount: 0,
        name: p.name || key,
        sku: p.sku || '',
        image: p.image || '',
        avgCost,
        variationsCount: vars.length,
        isOffer,
        hasCampaign: false,
        hasActiveCampaign: false
      };
    });

    // Helper to find the parent grouping key (use parent inventory ID if found, otherwise the raw string)
    const getGroupKey = (rawSkuOrName: string) => {
        if (!rawSkuOrName) return 'UNKNOWN';
        const raw = rawSkuOrName.trim();
        const rawLower = raw.toLowerCase();
        
        // 1. Is it a parent product ID?
        let inv = inventoryProducts.find(p => p.id.toString() === raw);
        if (inv) return inv.id.toString();

        // 2. Is it a parent product SKU?
        inv = inventoryProducts.find(p => p.sku && p.sku.toLowerCase() === rawLower);
        if (inv) return inv.id.toString();

        // 3. Is it a variation SKU?
        inv = inventoryProducts.find(p => p.variations && p.variations.some((v:any) => v.sku && v.sku.toLowerCase() === rawLower));
        if (inv) return inv.id.toString();

        // 4. Is it a parent product Name?
        inv = inventoryProducts.find(p => p.name && p.name.toLowerCase() === rawLower);
        if (inv) return inv.id.toString();

        // 5. Look in orders: if this raw string matches an order's SKU, Variation, or productName, use order's productName to find parent
        const matchingOrder = orders.find(o => 
             (o.sku && o.sku.toLowerCase() === rawLower) || 
             (o.variation && o.variation.toLowerCase() === rawLower) ||
             (o.productName && o.productName.toLowerCase() === rawLower)
        );
        if (matchingOrder && matchingOrder.productName) {
             const ordProdNameLower = matchingOrder.productName.toLowerCase();
             const sortedInv = [...inventoryProducts].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
             const parentInv = sortedInv.find(p => 
                 p.name && (
                     p.name.toLowerCase() === ordProdNameLower || 
                     ordProdNameLower.startsWith(p.name.toLowerCase() + ' -') ||
                     ordProdNameLower.startsWith(p.name.toLowerCase() + '-') ||
                     ordProdNameLower.includes(p.name.toLowerCase()) ||
                     p.name.toLowerCase().includes(ordProdNameLower)
                 )
             );
             if (parentInv) return parentInv.id.toString();
        }

        // 6. Fuzzy match for deleted variations
        const sortedInvForFuzzy = [...inventoryProducts].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
        inv = sortedInvForFuzzy.find(p => {
            const hasNameMatch = p.name && (rawLower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(rawLower));
            const hasSkuMatch = p.sku && rawLower.startsWith(p.sku.toLowerCase() + '-');
            return hasNameMatch || hasSkuMatch;
        });
        if (inv) return inv.id.toString();

        return raw;
    };

    // Group spend by product
    campaigns.forEach(campaign => {
       const isActiveCampaign = !campaign.isArchived && 
         (campaign as any).status !== 'PAUSED' && 
         (campaign as any).status !== 'paused' && 
         (campaign as any).status !== 'ARCHIVED';

       if (campaign.linkedProducts && campaign.linkedProducts.length > 0) {
           campaign.linkedProducts.forEach(sku => {
              if (sku) {
                 const groupKey = getGroupKey(sku);
                 if (!metrics[groupKey]) {
                   metrics[groupKey] = { id: groupKey, spend: 0, shippedCount: 0, deliveredCount: 0, name: groupKey, sku: groupKey, image: '', avgCost: 0, variationsCount: 0, isOffer: false, hasCampaign: true, hasActiveCampaign: false };
                 }
                 metrics[groupKey].hasCampaign = true;
                 if (isActiveCampaign) metrics[groupKey].hasActiveCampaign = true;
              }
           });
       } else if (campaign.productName) {
           const groupKey = getGroupKey(campaign.productName);
           if (!metrics[groupKey]) {
             metrics[groupKey] = { id: groupKey, spend: 0, shippedCount: 0, deliveredCount: 0, name: groupKey, sku: groupKey, image: '', avgCost: 0, variationsCount: 0, isOffer: false, hasCampaign: true, hasActiveCampaign: false };
           }
           metrics[groupKey].hasCampaign = true;
           if (isActiveCampaign) metrics[groupKey].hasActiveCampaign = true;
       }
    });

    filteredCampaigns.forEach(record => {
      const campaign = campaigns.find(c => c.id === record.campaignId);
      const isActiveCampaign = campaign ? (!campaign.isArchived && 
         (campaign as any).status !== 'PAUSED' && 
         (campaign as any).status !== 'paused' && 
         (campaign as any).status !== 'ARCHIVED') : false;

      if (campaign && campaign.linkedProducts && campaign.linkedProducts.length > 0) {
        const validLinked = campaign.linkedProducts.filter(Boolean);
        validLinked.forEach(sku => {
          const groupKey = getGroupKey(sku);
          if (!metrics[groupKey]) {
            metrics[groupKey] = { id: groupKey, spend: 0, shippedCount: 0, deliveredCount: 0, name: groupKey, sku: groupKey, image: '', avgCost: 0, variationsCount: 0, isOffer: false, hasCampaign: true, hasActiveCampaign: false };
          }
          metrics[groupKey].hasCampaign = true;
          if (isActiveCampaign) metrics[groupKey].hasActiveCampaign = true;
          metrics[groupKey].spend += (record.spend / validLinked.length);
        });
      } else if (campaign && campaign.productName) {
        const groupKey = getGroupKey(campaign.productName);
        if (!metrics[groupKey]) {
          metrics[groupKey] = { id: groupKey, spend: 0, shippedCount: 0, deliveredCount: 0, name: groupKey, sku: groupKey, image: '', avgCost: 0, variationsCount: 0, isOffer: false, hasCampaign: true, hasActiveCampaign: false };
        }
        metrics[groupKey].hasCampaign = true;
        if (isActiveCampaign) metrics[groupKey].hasActiveCampaign = true;
        metrics[groupKey].spend += record.spend;
      }
    });

    // Group orders by product sku (rolling up to parent)
    filteredOrders.forEach(order => {
      let groupKey = getGroupKey(order.sku || '');
      if (groupKey === (order.sku?.trim() || 'UNKNOWN') || groupKey === 'UNKNOWN') {
          const nameGroupKey = getGroupKey(order.productName || '');
          if (nameGroupKey !== (order.productName?.trim() || 'UNKNOWN') && nameGroupKey !== 'UNKNOWN') {
              groupKey = nameGroupKey;
          } else {
             const varGroupKey = getGroupKey(order.variation || '');
             if (varGroupKey !== (order.variation?.trim() || 'UNKNOWN') && varGroupKey !== 'UNKNOWN') {
                 groupKey = varGroupKey;
             } else {
                 groupKey = nameGroupKey !== 'UNKNOWN' ? nameGroupKey : groupKey;
             }
          }
      }
      
      if (!groupKey || groupKey === 'UNKNOWN') return;

      const s2 = order.status2;
      const isDelivered = s2 === 'مستلم' || order.isExchangedReturn;
      const isShipped = isDelivered || s2 === 'تم الشحن' || s2 === 'في الطريق' || s2 === 'مرتجع';
      const qty = Number(order.qnts) || 1;

      if (!metrics[groupKey]) {
        metrics[groupKey] = { id: groupKey, spend: 0, shippedCount: 0, deliveredCount: 0, name: groupKey, sku: groupKey, image: '', avgCost: 0, variationsCount: 0, isOffer: false, hasCampaign: false, hasActiveCampaign: false };
      }
      if (isDelivered) metrics[groupKey].deliveredCount += qty;
      if (isShipped && !isDelivered) metrics[groupKey].shippedCount += qty; 
      if (isShipped && isDelivered) metrics[groupKey].shippedCount += qty;
    });
    
    // Resolve Parent Product Names & images
    Object.keys(metrics).forEach(key => {
        const inv = inventoryProducts.find(p => p.id.toString() === key || p.sku === key || p.name === key);
        if (inv) {
           metrics[key].name = inv.name || key;
           metrics[key].sku = inv.sku || key;
           if (inv.image) metrics[key].image = inv.image;
        } else {
           const ord = filteredOrders.find(o => o.productName === key || (o.sku && o.sku.includes(key)));
           if (ord) metrics[key].name = ord.productName || key;
        }
    });

    return Object.values(metrics).sort((a, b) => {
      if (b.spend !== a.spend) return b.spend - a.spend;
      if (b.deliveredCount !== a.deliveredCount) return b.deliveredCount - a.deliveredCount;
      return b.shippedCount - a.shippedCount;
    });
  }, [filteredCampaigns, filteredOrders, campaigns, inventoryProducts, orders]);

  // Filtered Product Metrics for CPA Section
  const filteredProductMetrics = useMemo(() => {
    return productMetrics.filter(m => {
      // Search
      if (cpaSearch) {
        const searchLower = cpaSearch.trim().toLowerCase();
        const matchesName = m.name?.toLowerCase().includes(searchLower);
        const matchesSku = m.sku?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesSku) return false;
      }

      // Filter tabs
      if (cpaFilter === 'funded') {
        return m.hasActiveCampaign || m.spend > 0;
      }
      if (cpaFilter === 'sales') {
        return m.shippedCount > 0 || m.deliveredCount > 0;
      }
      if (cpaFilter === 'variations') {
        return m.variationsCount > 0 || m.isOffer;
      }

      return true;
    });
  }, [productMetrics, cpaSearch, cpaFilter]);

  // Pagination for CPA Section
  const totalCpaPages = Math.max(1, Math.ceil(filteredProductMetrics.length / cpaPerPage));
  const currentPageClamped = Math.min(cpaPage, totalCpaPages);
  const paginatedProductMetrics = useMemo(() => {
    if (cpaPerPage >= 1000) return filteredProductMetrics;
    const startIdx = (currentPageClamped - 1) * cpaPerPage;
    return filteredProductMetrics.slice(startIdx, startIdx + cpaPerPage);
  }, [filteredProductMetrics, currentPageClamped, cpaPerPage]);

  const exchangeRate = settings?.exchangeRate || 245;

  // Status Breakdowns
  const status1Stats = useMemo(() => {
    const stats: Record<string, number> = {};
    const options = settings?.status1Options || [];
    options.forEach(opt => stats[opt] = 0);
    filteredOrders.forEach(o => {
      const qty = Number(o.qnts) || 1;
      if (stats[o.status1] !== undefined) stats[o.status1] += qty;
      else stats[o.status1] = qty;
    });
    return Object.entries(stats).sort((a,b) => b[1] - a[1]);
  }, [filteredOrders, settings?.status1Options]);

  const status2Stats = useMemo(() => {
    const stats: Record<string, number> = {};
    const options = settings?.status2Options || [];
    options.forEach(opt => stats[opt] = 0);
    filteredOrders.forEach(o => {
      const qty = Number(o.qnts) || 1;
      if (o.status2) {
        if (stats[o.status2] !== undefined) stats[o.status2] += qty;
        else stats[o.status2] = qty;
      }
    });
    return Object.entries(stats).sort((a,b) => b[1] - a[1]);
  }, [filteredOrders, settings?.status2Options]);

  // Last 7 days data for charts (Fixed to always show relative last 7 days from selected end date or today)
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const baseDate = dateFilter === 'custom' && customEnd ? parseISO(customEnd) : new Date();
    return format(subDaysDateFns(baseDate, i), 'yyyy-MM-dd');
  }).reverse();
  
  const chartData = last7Days.map(date => {
    const dayOrders = orders.filter(o => o.orderDate?.startsWith(date));
    const dayTotal = dayOrders.reduce((sum, o) => sum + (Number(o.qnts) || 1), 0);
    const dayConfirmed = dayOrders.filter(o => o.status1 === 'مؤكد').reduce((sum, o) => sum + (Number(o.qnts) || 1), 0);
    const daySales = dayOrders.filter(o => o.status1 === 'مؤكد').reduce((sum, o) => sum + o.totalCharge, 0);
    return {
      date: format(parseISO(date), 'dd MMM', { locale: ar }),
      الطلبات: dayTotal,
      المؤكدة: dayConfirmed,
      المبيعات: daySales
    };
  });

  const actionRequiredOrders = useMemo(() => {
    const shippedStatus = ['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع'];
    const shippedOrders = orders.filter(o => !o.trashed && (o.shippingTrackingId || shippedStatus.includes(o.status2 || '')));
    return shippedOrders.filter(needsAction).sort((a, b) => {
        const pA = getActionPriority(a)?.days || 0;
        const pB = getActionPriority(b)?.days || 0;
        return pB - pA;
    });
  }, [orders]);
  
  const actionRequiredCount = actionRequiredOrders.length;

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* 📦 Collapsible App Sections Card */}
      {onViewChange && (
        <AppSectionsCard onSelectView={onViewChange} currentView="dashboard" />
      )}

      {!isSmartAlertDismissed && actionRequiredCount > 0 && (
        <div className="bg-gradient-to-r from-rose-50 to-white border border-rose-200 rounded-xl shadow-[0_0_15px_rgba(225,29,72,0.15)] relative overflow-hidden transition-all duration-300">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-rose-500 z-10 shadow-[0_0_8px_rgba(225,29,72,0.6)]"></div>
          
          <button 
             onClick={(e) => { e.stopPropagation(); setIsSmartAlertDismissed(true); }}
             className="absolute top-2 left-2 z-30 p-1 bg-white hover:bg-rose-100 text-rose-400 hover:text-rose-700 rounded-full transition-colors border border-rose-100"
             title="إخفاء"
          >
             <X className="w-4 h-4" />
          </button>
          
          <div 
            onClick={() => setIsAlertExpanded(!isAlertExpanded)}
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-rose-50/50 relative z-20 pr-5 pl-10"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 group-hover:scale-110 transition-transform relative">
                <div className="absolute inset-0 rounded-full bg-rose-400 opacity-20 animate-ping" style={{ animationDuration: '3s' }}></div>
                <AlertTriangle className="w-5 h-5 relative z-10" />
              </div>
              <div>
                <h3 className="font-bold text-rose-900 text-sm md:text-base flex items-center gap-2">
                  تنبيهات ذكية لـ <span className="bg-white border border-rose-200 px-2 py-0.5 rounded-md text-rose-600 font-black shadow-sm">
                    {actionRequiredCount}
                  </span> طلبيات
                </h3>
                <p className="text-xs font-medium text-rose-700 mt-1">يوجد طلبيات في التوصيل تتطلب المتابعة مع الزبائن لتفادي الروتور.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  localStorage.setItem('dashboard_nav_action_required', 'true');
                  if (onViewChange) onViewChange('shipped_orders');
                }}
                className="hidden sm:flex text-rose-500 items-center gap-1 text-xs font-bold hover:text-rose-700 bg-rose-100/50 px-3 py-1.5 rounded-lg border border-rose-100 hover:border-rose-200 transition-colors"
               >
                عرض الكل
                <ArrowRight className="w-3.5 h-3.5 transform rotate-180" />
              </button>
              <div className={`p-1 bg-rose-100 rounded-full text-rose-600 transition-transform duration-300 ${isAlertExpanded ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
          
          {isAlertExpanded && (
            <div className="px-4 pb-4 pt-1 animate-in slide-in-from-top-2">
                <div className="bg-white border border-rose-100 rounded-lg shadow-inner divide-y divide-rose-50 max-h-64 overflow-y-auto">
                   {actionRequiredOrders.slice(0, 5).map(order => {
                       const priority = getActionPriority(order);
                       const isHigh = priority?.level === 'high';
                       const isMed = priority?.level === 'medium';
                       const colorCls = isHigh ? 'text-red-700 bg-red-50' : isMed ? 'text-orange-700 bg-orange-50' : 'text-rose-600 bg-rose-50/50';
                       
                       return (
                           <div key={order.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                               <div className="flex items-center gap-3">
                                   <div className={`font-bold text-sm ${isHigh ? 'text-red-600' : 'text-slate-700'}`}>{order.fullName}</div>
                                   <div className="text-xs text-slate-500 font-mono" dir="ltr">{order.phone}</div>
                               </div>
                               <div className="flex items-center gap-2">
                                  <span className={`text-[10px] items-center gap-1 font-bold px-2 py-1 rounded-md border ${isHigh ? 'border-red-200 bg-red-100/50 text-red-700 animate-pulse' : isMed ? 'border-orange-200 bg-orange-100/50 text-orange-700' : 'border-rose-100 bg-rose-50 text-rose-600'}`}>
                                      أولوية {isHigh ? 'عالية' : isMed ? 'متوسطة' : 'عادية'} (+{priority?.days || 0} يوم)
                                  </span>
                                  <button onClick={(e) => {
                                       e.stopPropagation();
                                       localStorage.setItem('dashboard_nav_action_required', 'true');
                                       if (onViewChange) onViewChange('shipped_orders');
                                  }} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors">
                                      <ArrowRight className="w-3.5 h-3.5 transform rotate-180" />
                                  </button>
                               </div>
                           </div>
                       )
                   })}
                   {actionRequiredOrders.length > 5 && (
                       <div 
                         onClick={() => {
                             localStorage.setItem('dashboard_nav_action_required', 'true');
                             if (onViewChange) onViewChange('shipped_orders');
                         }}
                         className="p-3 text-center text-xs font-bold text-rose-600 bg-rose-50/30 hover:bg-rose-50 cursor-pointer"
                       >
                           عرض {actionRequiredOrders.length - 5} طلبيات إضافية بحاجة لتدخل
                       </div>
                   )}
                </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800 tracking-tight">نظرة عامة على الأداء</h2>
          
          <label className="flex items-center gap-2 bg-white px-2 py-1 rounded text-xs font-bold border border-gray-200 cursor-pointer shadow-sm mt-1 md:mt-0">
            <input 
              type="checkbox" 
              checked={comparePeriod} 
              onChange={e => setComparePeriod(e.target.checked)} 
              className="rounded text-indigo-600 focus:ring-indigo-500" 
            />
            مقارنة بالفترة السابقة
          </label>
          
          {comparePeriod && (
            <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm text-xs mt-1 md:mt-0">
              <select 
                value={compareType} 
                onChange={(e) => setCompareType(e.target.value as any)}
                className="bg-transparent font-bold border-none py-0 pl-1 pr-6 focus:ring-0 cursor-pointer"
              >
                <option value="auto">تلقائي</option>
                <option value="custom">مخصص</option>
              </select>
              
              {compareType === 'custom' && (
                <div className="flex items-center gap-1 border-r border-gray-200 pr-2">
                  <input 
                    type="date" 
                    value={compareCustomStart} 
                    onChange={(e) => setCompareCustomStart(e.target.value)}
                    className="text-[10px] sm:text-xs bg-gray-50 border border-gray-200 rounded px-1 py-0.5 outline-none font-medium"
                  />
                  <span className="text-gray-400">-</span>
                  <input 
                    type="date" 
                    value={compareCustomEnd} 
                    onChange={(e) => setCompareCustomEnd(e.target.value)}
                    className="text-[10px] sm:text-xs bg-gray-50 border border-gray-200 rounded px-1 py-0.5 outline-none font-medium"
                  />
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex flex-col md:flex-row flex-wrap items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-1 border-l border-gray-200 pl-2 ml-2">
            <Package className="w-4 h-4 text-gray-400 mx-1" />
            <select 
              value={productFilter} 
              onChange={(e) => {
                setProductFilter(e.target.value);
                setGlobalProductFilter(e.target.value);
              }}
              className="bg-transparent text-sm font-bold border-none focus:ring-0 cursor-pointer w-36 truncate"
            >
              <option value="all">كل المنتجات</option>
              {productFilterOptionsJSX}
            </select>
          </div>

          <div className="flex items-center gap-1 border-l border-gray-200 pl-2 ml-2">
            <Filter className="w-4 h-4 text-gray-400 mx-1" />
            <select 
              value={confirmerFilter} 
              onChange={(e) => setConfirmerFilter(e.target.value)}
              className="bg-transparent text-sm font-bold border-none focus:ring-0 cursor-pointer"
            >
              <option value="all">كل المؤكدين</option>
              {Array.from(new Set(users.filter(u => u.role === 'confirmer' || (u.commissionConfig && u.isActive)).map(u => u.displayName).filter(Boolean))).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4 text-gray-400 mx-1" />
            <select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="bg-transparent text-sm font-bold border-none focus:ring-0 cursor-pointer"
            >
              <option value="today">اليوم</option>
              <option value="week">هذا الأسبوع</option>
              <option value="month">هذا الشهر</option>
              <option value="custom">مخصص</option>
            </select>
          </div>
          
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 pr-2 border-r border-gray-200 bg-gray-50 rounded pl-2">
              <input 
                type="date" 
                value={customStart} 
                onChange={(e) => setCustomStart(e.target.value)}
                className="text-xs bg-transparent border-none py-1 focus:outline-none font-medium"
              />
              <span className="text-gray-400 text-xs">-</span>
              <input 
                type="date" 
                value={customEnd} 
                onChange={(e) => setCustomEnd(e.target.value)}
                className="text-xs bg-transparent border-none py-1 focus:outline-none font-medium"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard 
          title="إجمالي الطلبيات" 
          value={totalOrders.toString()} 
          icon={<Package className="w-5 h-5 text-indigo-600" />}
          subtext="كل الطلبات المدخلة"
          trend={calcTrend(totalOrders, prevTotalOrders)?.value}
          trendUp={calcTrend(totalOrders, prevTotalOrders)?.up}
          prevValue={comparePeriod && prevTotalOrders !== undefined ? prevTotalOrders : undefined}
        />
        <StatCard 
          title="المبيعات المؤكدة" 
          value={`${totalSales.toLocaleString()} د.ج`} 
          icon={<DollarSign className="w-5 h-5 text-green-600" />}
          subtext={`${confirmedOrders} طلب مؤكد`}
          trend={calcTrend(totalSales, prevTotalSales)?.value}
          trendUp={calcTrend(totalSales, prevTotalSales)?.up}
          prevValue={comparePeriod && prevTotalSales !== undefined ? `${prevTotalSales.toLocaleString()} د.ج` : undefined}
        />
        <StatCard 
          title="صافي الأرباح الحقيقية" 
          value={`${netProfitAmount.toLocaleString()} د.ج`} 
          icon={<Banknote className="w-5 h-5 text-emerald-600" />}
          subtext={`متوقع: ${dashboardFinance.expectedNetProfit.toLocaleString()} د.ج`}
          trend={calcTrend(netProfitAmount, prevNetProfit)?.value}
          trendUp={calcTrend(netProfitAmount, prevNetProfit)?.up}
          prevValue={comparePeriod && prevNetProfit !== undefined ? `${prevNetProfit.toLocaleString()} د.ج` : undefined}
        />
        <StatCard 
          title="معدل التأكيد" 
          value={`${confirmationRate}%`} 
          icon={<Percent className="w-5 h-5 text-purple-600" />}
          subtext={`${confirmedOrders}/${totalOrders} إجمالي الطلبيات`}
          trend={calcTrend(Number(confirmationRate), Number(prevConfirmationRate))?.value}
          trendUp={calcTrend(Number(confirmationRate), Number(prevConfirmationRate))?.up}
          prevValue={comparePeriod && prevConfirmationRate !== undefined ? `${prevConfirmationRate}%` : undefined}
        />
        <StatCard 
          title="نسبة التوصيل" 
          value={`${deliveryRate}%`} 
          icon={<Truck className="w-5 h-5 text-teal-600" />}
          subtext={`${deliveredOrders}/${confirmedOrders} تم استلامها`}
          trend={calcTrend(Number(deliveryRate), Number(prevDeliveryRate))?.value}
          trendUp={calcTrend(Number(deliveryRate), Number(prevDeliveryRate))?.up}
          prevValue={comparePeriod && prevDeliveryRate !== undefined ? `${prevDeliveryRate}%` : undefined}
        />
        <StatCard 
          title="معدل الإرجاع" 
          value={`${returnRate}%`} 
          icon={<Ban className="w-5 h-5 text-red-600" />}
          subtext={`${returnedOrders} مرتجع`}
          trend={calcTrend(Number(returnRate), Number(prevReturnRate))?.value}
          trendUp={calcTrend(Number(returnRate), Number(prevReturnRate)) ? !calcTrend(Number(returnRate), Number(prevReturnRate))?.up : undefined}
          prevValue={comparePeriod && prevReturnRate !== undefined ? `${prevReturnRate}%` : undefined}
        />
      </div>

      {/* Product Cost & CPA Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4 animate-fadeIn" id="cpa-section">
        {/* Header */}
        <div className="p-3 bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-800 flex items-center gap-2">
                تكلفة المبيعة ومعدل التكلفة لكل منتج (CPA & Product Cost)
              </h3>
              <p className="text-[11px] text-gray-500">
                عرض شامل لجميع المنتجات وتجميع تكاليف الأنواع والعروض لمتابعة الأداء الإعلاني بدقة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 bg-white px-2.5 py-1 rounded-md border border-gray-200 self-start sm:self-auto">
            <span>إجمالي المنتجات: <strong className="text-indigo-600">{productMetrics.length}</strong></span>
            <span className="text-gray-300">|</span>
            <span>الظاهر: <strong className="text-gray-900">{filteredProductMetrics.length}</strong></span>
          </div>
        </div>

        {/* Filter & View Controls Bar */}
        <div className="p-3 bg-white border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Search & Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={cpaSearch}
                onChange={(e) => { setCpaSearch(e.target.value); setCpaPage(1); }}
                placeholder="بحث باسم المنتج أو SKU..."
                className="w-full pl-7 pr-8 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {cpaSearch && (
                <button
                  onClick={() => { setCpaSearch(''); setCpaPage(1); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-lg overflow-x-auto text-[11px] font-semibold">
              <button
                onClick={() => { setCpaFilter('all'); setCpaPage(1); }}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                  cpaFilter === 'all'
                    ? 'bg-white text-indigo-600 shadow-sm font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                الكل ({productMetrics.length})
              </button>
              <button
                onClick={() => { setCpaFilter('funded'); setCpaPage(1); }}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                  cpaFilter === 'funded'
                    ? 'bg-white text-indigo-600 shadow-sm font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                الممولة فقط ({productMetrics.filter(m => m.spend > 0 || m.hasCampaign).length})
              </button>
              <button
                onClick={() => { setCpaFilter('sales'); setCpaPage(1); }}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                  cpaFilter === 'sales'
                    ? 'bg-white text-indigo-600 shadow-sm font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ذات مبيعات ({productMetrics.filter(m => m.shippedCount > 0 || m.deliveredCount > 0).length})
              </button>
              <button
                onClick={() => { setCpaFilter('variations'); setCpaPage(1); }}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                  cpaFilter === 'variations'
                    ? 'bg-white text-indigo-600 shadow-sm font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                أنواع/عروض ({productMetrics.filter(m => m.variationsCount > 0 || m.isOffer).length})
              </button>
            </div>
          </div>

          {/* Right: View Mode & Page Size */}
          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              <button
                onClick={() => setCpaViewMode('table')}
                title="عرض الجدول"
                className={`p-1.5 rounded-md flex items-center gap-1 font-medium transition-all ${
                  cpaViewMode === 'table'
                    ? 'bg-white text-indigo-600 shadow-sm font-bold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">جدول</span>
              </button>
              <button
                onClick={() => setCpaViewMode('cards')}
                title="عرض بطاقات مصغرة"
                className={`p-1.5 rounded-md flex items-center gap-1 font-medium transition-all ${
                  cpaViewMode === 'cards'
                    ? 'bg-white text-indigo-600 shadow-sm font-bold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">بطاقات</span>
              </button>
            </div>

            {/* Per Page Selector */}
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <span>عرض:</span>
              <select
                value={cpaPerPage}
                onChange={(e) => { setCpaPerPage(Number(e.target.value)); setCpaPage(1); }}
                className="bg-gray-50 border border-gray-200 text-gray-700 py-1 px-2 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value={6}>6</option>
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={50}>50</option>
                <option value={10000}>الكل</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {filteredProductMetrics.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Package className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-semibold">لا توجد منتجات تطابق الفلتر أو البحث المحدد</p>
          </div>
        ) : cpaViewMode === 'table' ? (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-right bg-white">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-[11px] text-gray-600 font-bold uppercase">
                <tr>
                  <th className="px-3 py-2.5 border-l border-gray-100">المنتج والرمز</th>
                  <th className="px-3 py-2.5 border-l border-gray-100 text-center">معدل تكلفة الوحدة</th>
                  <th className="px-3 py-2.5 border-l border-gray-100 text-center">الصرف والكميات</th>
                  <th className="px-3 py-2.5 border-l border-gray-100 text-center">تكلفة المبيعة المتوقعة</th>
                  <th className="px-3 py-2.5 text-center">التكلفة الحقيقية (CPA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {paginatedProductMetrics.map((metrics) => {
                  const expectedCpaUsd = metrics.shippedCount > 0 ? metrics.spend / metrics.shippedCount : 0;
                  const actualCpaUsd = metrics.deliveredCount > 0 ? metrics.spend / metrics.deliveredCount : 0;
                  const expectedCpaDzd = expectedCpaUsd * exchangeRate;
                  const actualCpaDzd = actualCpaUsd * exchangeRate;

                  return (
                    <tr key={metrics.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Product details */}
                      <td className="px-3 py-2.5 border-l border-gray-100">
                        <div className="flex items-center gap-2.5">
                          {metrics.image ? (
                            <img src={metrics.image} alt={metrics.name} className="w-9 h-9 object-cover rounded-md border border-gray-200 flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 flex-shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-gray-800 text-xs truncate max-w-[220px]" title={metrics.name}>
                              {metrics.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {metrics.sku && (
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-mono">
                                  {metrics.sku}
                                </span>
                              )}
                              {metrics.variationsCount > 0 && (
                                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                                  <Layers className="w-2.5 h-2.5" />
                                  {metrics.variationsCount} أنواع
                                </span>
                              )}
                              {metrics.isOffer && (
                                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                                  <Tag className="w-2.5 h-2.5" />
                                  عرض/Pack
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Average Unit Cost */}
                      <td className="px-3 py-2.5 border-l border-gray-100 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-gray-900 text-xs">
                            {metrics.avgCost > 0 ? `${metrics.avgCost.toLocaleString()} د.ج` : 'غير محدد'}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {metrics.variationsCount > 0 ? 'معدل الأنواع' : 'تكلفة الشراء'}
                          </span>
                        </div>
                      </td>

                      {/* Ad Spend & Sales Counts */}
                      <td className="px-3 py-2.5 border-l border-gray-100 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-indigo-600 text-xs">
                            ${metrics.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            ({(metrics.spend * exchangeRate).toLocaleString()} د.ج)
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-600 mt-0.5">
                            <span className="text-blue-600 font-semibold" title="المشحونة">شحن: {metrics.shippedCount}</span>
                            <span>•</span>
                            <span className="text-emerald-600 font-semibold" title="المستلمة">استلام: {metrics.deliveredCount}</span>
                          </div>
                        </div>
                      </td>

                      {/* Expected CPA */}
                      <td className="px-3 py-2.5 border-l border-gray-100 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-black text-blue-600 text-sm">
                            ${expectedCpaUsd.toFixed(2)}
                          </span>
                          <span className="font-bold text-gray-700 text-[11px]">
                            {expectedCpaDzd.toFixed(0)} د.ج
                          </span>
                          <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-100 mt-0.5">
                            ${metrics.spend.toFixed(1)} ÷ {metrics.shippedCount} شحنة
                          </span>
                        </div>
                      </td>

                      {/* Actual CPA */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-black text-rose-600 text-sm">
                            ${actualCpaUsd.toFixed(2)}
                          </span>
                          <span className="font-bold text-gray-700 text-[11px]">
                            {actualCpaDzd.toFixed(0)} د.ج
                          </span>
                          <span className="text-[9px] bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded border border-rose-100 mt-0.5">
                            ${metrics.spend.toFixed(1)} ÷ {metrics.deliveredCount} مستلمة
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Compact Mini Cards View */
          <div className="p-3 bg-gray-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {paginatedProductMetrics.map((metrics) => {
                const expectedCpaUsd = metrics.shippedCount > 0 ? metrics.spend / metrics.shippedCount : 0;
                const actualCpaUsd = metrics.deliveredCount > 0 ? metrics.spend / metrics.deliveredCount : 0;
                const expectedCpaDzd = expectedCpaUsd * exchangeRate;
                const actualCpaDzd = actualCpaUsd * exchangeRate;

                return (
                  <div
                    key={metrics.id}
                    className="bg-white rounded-lg border border-gray-200 p-3 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top: Image + Title */}
                      <div className="flex items-start gap-2 mb-2">
                        {metrics.image ? (
                          <img src={metrics.image} alt={metrics.name} className="w-10 h-10 object-cover rounded-md border border-gray-200 flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 flex-shrink-0">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-gray-900 truncate" title={metrics.name}>
                            {metrics.name}
                          </h4>
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            {metrics.sku && (
                              <span className="text-[9px] bg-gray-100 text-gray-600 px-1 py-0.2 rounded font-mono">
                                {metrics.sku}
                              </span>
                            )}
                            {metrics.variationsCount > 0 && (
                              <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.2 rounded">
                                {metrics.variationsCount} أنواع
                              </span>
                            )}
                            {metrics.isOffer && (
                              <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.2 rounded">
                                عرض
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Cost & Spend Bar */}
                      <div className="bg-gray-50 rounded-md p-2 mb-2 flex items-center justify-between text-[11px]">
                        <div>
                          <div className="text-[9px] text-gray-500">معدل التكلفة</div>
                          <div className="font-bold text-gray-900">
                            {metrics.avgCost > 0 ? `${metrics.avgCost.toLocaleString()} د.ج` : '-'}
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="text-[9px] text-gray-500">إجمالي الصرف</div>
                          <div className="font-bold text-indigo-600">
                            ${metrics.spend.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Sales Counts */}
                      <div className="flex items-center justify-between text-[10px] text-gray-600 px-1 mb-2">
                        <span>مهمة الشحن: <strong className="text-blue-600">{metrics.shippedCount}</strong></span>
                        <span>مستلمة: <strong className="text-emerald-600">{metrics.deliveredCount}</strong></span>
                      </div>
                    </div>

                    {/* CPA Metrics Comparison */}
                    <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-1 text-center">
                      <div className="bg-blue-50/60 p-1.5 rounded border border-blue-100">
                        <div className="text-[9px] text-blue-700 font-medium">CPA المتوقعة</div>
                        <div className="font-black text-blue-700 text-xs">${expectedCpaUsd.toFixed(2)}</div>
                        <div className="text-[9px] text-gray-600">{expectedCpaDzd.toFixed(0)} د.ج</div>
                      </div>

                      <div className="bg-rose-50/60 p-1.5 rounded border border-rose-100">
                        <div className="text-[9px] text-rose-700 font-medium">CPA الحقيقية</div>
                        <div className="font-black text-rose-700 text-xs">${actualCpaUsd.toFixed(2)}</div>
                        <div className="text-[9px] text-gray-600">{actualCpaDzd.toFixed(0)} د.ج</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination Footer */}
        {totalCpaPages > 1 && (
          <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="text-gray-500 text-[11px]">
              عرض المنتجات {((currentPageClamped - 1) * cpaPerPage) + 1} إلى {Math.min(currentPageClamped * cpaPerPage, filteredProductMetrics.length)} من أصل {filteredProductMetrics.length}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCpaPage(prev => Math.max(1, prev - 1))}
                disabled={currentPageClamped === 1}
                className="p-1.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 px-2 font-semibold text-gray-700 text-[11px]">
                <span>صفحة {currentPageClamped} من {totalCpaPages}</span>
              </div>

              <button
                onClick={() => setCpaPage(prev => Math.min(totalCpaPages, prev + 1))}
                disabled={currentPageClamped === totalCpaPages}
                className="p-1.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status 1 Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-3 bg-gray-50 border-b">
            <h3 className="font-bold text-xs uppercase tracking-tighter text-gray-600">تفصيل الحالة 1 (المكتب)</h3>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {status1Stats.map(([status, count]) => (
              <div key={status} className="flex flex-col p-2 bg-gray-50/50 rounded border border-gray-100 items-center justify-center text-center">
                <span className="text-[11px] font-bold text-gray-500 mb-1">{status || 'بدون حالة'}</span>
                <span className="font-black text-lg text-gray-800">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status 2 Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-3 bg-gray-50 border-b">
            <h3 className="font-bold text-xs uppercase tracking-tighter text-gray-600">تفصيل الحالة 2 (التوصيل)</h3>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {status2Stats.map(([status, count]) => (
              <div key={status} className="flex flex-col p-2 bg-gray-50/50 rounded border border-gray-100 items-center justify-center text-center">
                <span className="text-[11px] font-bold text-gray-500 mb-1">{status || 'غير محدد'}</span>
                <span className="font-black text-lg text-gray-800">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-3 bg-gray-50 border-b">
            <h3 className="font-bold text-xs uppercase tracking-tighter text-gray-600 flex items-center gap-2">حجم الطلبات والمؤكدة (آخر 7 أيام)</h3>
          </div>
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#93c5fd" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorConfirmed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 10}} />
                <RechartsTooltip contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 2px 4px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                <Area type="monotone" dataKey="الطلبات" stroke="#93c5fd" fillOpacity={1} fill="url(#colorOrders)" />
                <Area type="monotone" dataKey="المؤكدة" stroke="#3b82f6" fillOpacity={1} fill="url(#colorConfirmed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-3 bg-gray-50 border-b">
            <h3 className="font-bold text-xs uppercase tracking-tighter text-gray-600 flex items-center gap-2">المبيعات اليومية (آخر 7 أيام)</h3>
          </div>
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 10}} />
                <RechartsTooltip contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 2px 4px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                <Bar dataKey="المبيعات" fill="#10b981" radius={[2, 2, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendBadge({ trend, reverseColors = false }: { trend: any, reverseColors?: boolean }) {
  if (!trend) return null;
  // If reverseColors (like Cost, lower is better) -> down is green, up is red
  // For normal (sales, upper is better) -> up is green, down is red
  
  const isUp = trend.up;
  const isGood = reverseColors ? !isUp : isUp;

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${isGood ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {trend.value.replace('+', '')}
    </span>
  );
}

function StatCard({ title, value, icon, subtext, trend, trendUp, prevValue }: any) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">{title}</p>
          <div className="flex items-center gap-2">
             <h4 className="text-xl font-black text-gray-900">{value}</h4>
             {trend && (
               <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${trendUp ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                 {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                 {trend.replace('+', '')}
               </span>
             )}
          </div>
        </div>
        <div className="p-2 bg-gray-50 rounded">
          {icon}
        </div>
      </div>
      <div>
        {subtext && (
          <div className="mt-2 flex items-center text-[11px] font-bold">
            <span className="text-gray-400">{subtext}</span>
          </div>
        )}
        {prevValue !== undefined && (
          <div className="mt-0.5 flex items-center text-[10px] font-bold text-gray-400 bg-gray-50 w-fit px-1.5 py-0.5 rounded">
            السابق: {prevValue}
          </div>
        )}
      </div>
    </div>
  );
}

