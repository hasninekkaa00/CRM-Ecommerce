import { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, isWithinInterval, parseISO, eachDayOfInterval, format, isSameDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Megaphone, DollarSign, Target, CheckCircle, Package, ChevronDown, Check } from 'lucide-react';
import { getEffectiveShippingCost } from '../../utils/shippingFees';

export function CampaignDashboard() {
  const { campaigns, campaignRecords, orders, inventoryProducts, settings, expenses } = useStore();

  const exchangeRate = settings?.exchangeRate || 245;

  const isStatusExpected = (s1: string, s2: string) => {
      const s = s2 || '';
      return s !== 'مستلم' && s !== 'مرتجع' && s !== 'ملغى' && s !== 'إلغاء' && s !== 'ملغاة' && (s1 === 'مؤكد' || s === 'تم الشحن' || s === 'في الطريق');
  };

  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'all' | 'custom'>(() => {
    return (localStorage.getItem('campaign_dashboard_dateFilter') as any) || 'all';
  });

  useEffect(() => {
    localStorage.setItem('campaign_dashboard_dateFilter', dateFilter);
  }, [dateFilter]);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]); // SKUs
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [utmTab, setUtmTab] = useState<'campaign' | 'adset' | 'ad' | 'source'>('campaign');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
         setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Extract unique products
  const uniqueProductsData = useMemo(() => {
    const list = new Map<string, { key: string, label: string }>();
    const offerSkus = new Set<string>();

    inventoryProducts.forEach(inv => {
        if (!inv.name) return;
        const isOffer = inv.local_is_offers !== undefined ? inv.local_is_offers : (inv.variations && inv.variations.some((v:any) => v.attributes?.some((a:any) => a.option && (a.option.includes('عرض') || a.option.includes('كمية') || a.option.includes('pack')))));

        if (isOffer) {
            if (inv.sku) list.set(inv.sku, { key: inv.sku, label: inv.name });
            if (inv.variations) {
                inv.variations.forEach((v:any) => { if (v.sku) offerSkus.add(v.sku); });
            }
        } else if (inv.variations && inv.variations.length > 0) {
            if (inv.sku) list.set(inv.sku, { key: inv.sku, label: `${inv.name} (كل الأنواع)` });
            
            inv.variations.forEach((v:any) => {
                const variationName = v.name || v.attributes?.map((a:any)=>a.option).join(' ') || '';
                const key = v.sku;
                const label = `${inv.name} - ${variationName}`;
                if (key) list.set(key, { key, label });
            });
        } else {
            const key = inv.sku;
            if (key) list.set(key, { key, label: inv.name });
        }
    });

    orders.forEach(o => {
       if (o.sku && !list.has(o.sku) && !offerSkus.has(o.sku)) {
          list.set(o.sku, { key: o.sku, label: o.productName || o.sku });
       }
    });

    return Array.from(list.values()).sort((a,b) => a.label.localeCompare(b.label));
  }, [inventoryProducts, orders]);

  const dateRange = useMemo(() => {
    const now = new Date();
    let start = startOfDay(now);
    let end = endOfDay(now);

    if (dateFilter === 'today') {
      // already set
    } else if (dateFilter === 'week') {
      start = startOfWeek(now, { weekStartsOn: 6 }); // Saturday start typical in Arab region
      end = endOfWeek(now, { weekStartsOn: 6 });
    } else if (dateFilter === 'custom') {
      if (customStart) start = startOfDay(parseISO(customStart));
      if (customEnd) end = endOfDay(parseISO(customEnd));
    } else if (dateFilter === 'all') {
      return null; // represents all time
    }
    return { start, end };
  }, [dateFilter, customStart, customEnd]);

  // Helpers
  const isDateInRange = (dateStr: string) => {
    if (!dateRange || !dateStr) return true;
    const date = parseISO(dateStr);
    return isWithinInterval(date, { start: dateRange.start, end: dateRange.end });
  };

  const calculateTotalCampaignSpend = (campaign: any, records: any[], startObj?: Date, endObj?: Date) => {
    let totalSpend = 0;
    try {
      const campStart = startOfDay(parseISO(campaign.createdAt));
      const campEnd = campaign.archivedAt ? endOfDay(parseISO(campaign.archivedAt)) : endOfDay(new Date());
      
      const calcStart = startObj && startObj > campStart ? startObj : campStart;
      const calcEnd = endObj && endObj < campEnd ? endObj : campEnd;

      if (calcStart > calcEnd) {
        // Find if manual records exist in this out-of-bounds period
        records.forEach(r => {
           if (r.date) {
               const rDate = parseISO(r.date);
               if ((!startObj || rDate >= startObj) && (!endObj || rDate <= endObj)) {
                   totalSpend += (Number(r.spend) || 0);
               }
           }
        });
        return totalSpend;
      }

      const periodDays = eachDayOfInterval({ start: calcStart, end: calcEnd });
      
      periodDays.forEach(day => {
        const manualRecordsForDay = records.filter(r => r.date && isSameDay(parseISO(r.date), day));
        if (manualRecordsForDay.length > 0) {
            totalSpend += manualRecordsForDay.reduce((sum, r) => sum + (Number(r.spend) || 0), 0);
        } else if (campaign.baseDailyBudget) {
            totalSpend += campaign.baseDailyBudget;
        }
      });

      // Add any manual records that are OUTSIDE the campaign period but IN the requested period
      records.forEach(r => {
         if (r.date) {
            const rDate = startOfDay(parseISO(r.date));
            if ((rDate < campStart || rDate > campEnd) && (!startObj || rDate >= startObj) && (!endObj || rDate <= endObj)) {
                 totalSpend += (Number(r.spend) || 0);
            }
         }
      });
    } catch (e) {
      totalSpend = records.reduce((sum, r) => sum + (Number(r.spend) || 0), 0);
    }
    return totalSpend;
  };

  // Filter campaigns
  const relevantCampaigns = useMemo(() => {
    return campaigns.filter(c => {
       if (selectedProducts.length > 0) {
           const linked = c.linkedProducts || [];
           const pName = c.productName;
           // If campaign is linked to any of selected products
           const hasMatch = selectedProducts.some(p => linked.includes(p) || pName === p);
           if (!hasMatch) return false;
       }
       return true;
    });
  }, [campaigns, selectedProducts]);

  const totalAdSpend = useMemo(() => {
    let spend = 0;
    relevantCampaigns.forEach(c => {
        const records = campaignRecords.filter(r => r.campaignId === c.id);
        spend += calculateTotalCampaignSpend(c, records, dateRange?.start, dateRange?.end);
    });
    return spend;
  }, [relevantCampaigns, campaignRecords, dateRange]);

  const filteredOrders = useMemo(() => {
    // Helper to expand selected SKUs to include variations if parent is selected
    const getExpandedSkus = (skus: string[]) => {
        const expanded = new Set<string>();
        skus.forEach(sku => {
            expanded.add(sku);
            const parentProduct = inventoryProducts.find(p => p.sku === sku);
            if (parentProduct && parentProduct.variations) {
                parentProduct.variations.forEach((v:any) => {
                    if (v.sku) expanded.add(v.sku);
                });
            }
        });
        return Array.from(expanded);
    };

    const expandedSelectedSkus = getExpandedSkus(selectedProducts);

    return orders.filter(o => !o.trashed && !o.archived).filter(o => {
        if (!isDateInRange(o.orderDate)) return false;
        if (selectedProducts.length > 0) {
            const isMatch = expandedSelectedSkus.includes(o.sku) || selectedProducts.includes(o.productName);
            if (!isMatch) return false;
        }
        return true;
    });
  }, [orders, dateRange, selectedProducts, inventoryProducts]);

  const utmStats = useMemo(() => {
    const campaignsMap = new Map<string, { name: string; total: number; confirmed: number; shipped: number; received: number; spend: number }>();
    const mediumsMap = new Map<string, { name: string; total: number; confirmed: number; shipped: number; received: number }>();
    const contentsMap = new Map<string, { name: string; total: number; confirmed: number; shipped: number; received: number }>();
    const sourcesMap = new Map<string, { name: string; total: number; confirmed: number; shipped: number; received: number }>();

    filteredOrders.forEach(o => {
      const camp = (o.utmCampaign || "").trim();
      const med = (o.utmMedium || "").trim();
      const cont = (o.utmContent || "").trim();
      const src = (o.utmSource || "").trim();

      const isConf = isStatusExpected(o.status1 || '', o.status2 || '') || o.status2 === 'مستلم';
      const isShip = (o.status2 === 'تم الشحن' || o.status2 === 'في الطريق' || o.status2 === 'مستلم');
      const isRec = (o.status2 === 'مستلم');

      if (camp) {
        const existing = campaignsMap.get(camp) || { name: camp, total: 0, confirmed: 0, shipped: 0, received: 0, spend: 0 };
        existing.total++;
        if (isConf) existing.confirmed++;
        if (isShip) existing.shipped++;
        if (isRec) existing.received++;
        campaignsMap.set(camp, existing);
      }

      if (med) {
        const existing = mediumsMap.get(med) || { name: med, total: 0, confirmed: 0, shipped: 0, received: 0 };
        existing.total++;
        if (isConf) existing.confirmed++;
        if (isShip) existing.shipped++;
        if (isRec) existing.received++;
        mediumsMap.set(med, existing);
      }

      if (cont) {
        const existing = contentsMap.get(cont) || { name: cont, total: 0, confirmed: 0, shipped: 0, received: 0 };
        existing.total++;
        if (isConf) existing.confirmed++;
        if (isShip) existing.shipped++;
        if (isRec) existing.received++;
        contentsMap.set(cont, existing);
      }

      if (src) {
        const existing = sourcesMap.get(src) || { name: src, total: 0, confirmed: 0, shipped: 0, received: 0 };
        existing.total++;
        if (isConf) existing.confirmed++;
        if (isShip) existing.shipped++;
        if (isRec) existing.received++;
        sourcesMap.set(src, existing);
      }
    });

    campaignsMap.forEach((val, key) => {
      const matchingCamp = campaigns.find(c => c.name.toLowerCase() === key.toLowerCase());
      if (matchingCamp) {
        const records = campaignRecords.filter(r => r.campaignId === matchingCamp.id);
        const campSpend = calculateTotalCampaignSpend(matchingCamp, records, dateRange?.start, dateRange?.end);
        val.spend = campSpend * exchangeRate;
      }
    });

    return {
      campaigns: Array.from(campaignsMap.values()).sort((a, b) => b.total - a.total),
      mediums: Array.from(mediumsMap.values()).sort((a, b) => b.total - a.total),
      contents: Array.from(contentsMap.values()).sort((a, b) => b.total - a.total),
      sources: Array.from(sourcesMap.values()).sort((a, b) => b.total - a.total)
    };
  }, [filteredOrders, campaigns, campaignRecords, dateRange, exchangeRate]);

  const getOrderCosts = (o: any) => {
      let extCost = o.customAdditionalCost || 0;
      let calculatedQnts = Number(o.qnts) || 1;
      let baseCost = 0;

      let invProduct = null;
      if (o.sku) {
          const currentSkus = String(o.sku).split(',').map((s: string) => s.trim().toLowerCase());
          invProduct = inventoryProducts.find(p => 
              (p.sku && currentSkus.includes(p.sku.toLowerCase().trim())) || 
              (p.variations && p.variations.some((v:any) => v.sku && currentSkus.includes(v.sku.toLowerCase().trim())))
          );
      }
      if (!invProduct && o.productName) {
          const oName = String(o.productName).trim().toLowerCase();
          invProduct = inventoryProducts.find(p => {
              const pName = (p.name || '').trim().toLowerCase();
              return pName === oName || oName.includes(pName) || pName.includes(oName);
          });
      }

      let targetVariation: any = null;
      let isOffer = false;
      const hasVars = invProduct?.variations && invProduct.variations.length > 0;

      if (invProduct && hasVars) {
         const fallbackOffer = invProduct.variations.some((v:any) => v.attributes?.some((a:any) => a.option && (a.option.includes('عرض') || a.option.includes('كمية') || a.option.includes('pack'))));
         isOffer = invProduct.local_is_offers !== undefined ? invProduct.local_is_offers : fallbackOffer;
         
         if (o.sku) {
             const currentSkus = String(o.sku).split(',').map((s: string) => s.trim().toLowerCase());
             const tv = invProduct.variations.find((v:any) => v.sku && currentSkus.includes(v.sku.toLowerCase().trim()));
             if (tv) targetVariation = tv;
         }
         if (!targetVariation && o.variation) {
             const oVar = String(o.variation).trim().toLowerCase();
             const tv = invProduct.variations.find((v:any) => {
                 const vName = (v.name || v.attributes?.map((a:any) => a.option).join(' ') || '').trim().toLowerCase();
                 return vName === oVar || vName.includes(oVar) || oVar.includes(vName) ||
                        (v.attributes && v.attributes.some((a:any) => a.option && (a.option.toLowerCase() === oVar || oVar.includes(a.option.toLowerCase()))));
             });
             if (tv) targetVariation = tv;
         }
      }

      if (hasVars) {
          if (targetVariation) {
              let pCostOffer = Number(targetVariation.local_cost) || 0;
              if (pCostOffer > 0) {
                 baseCost = pCostOffer;
                 calculatedQnts = Number(o.qnts) || 1;
              } else if (isOffer) {
                 const singleVar = invProduct.variations.find((v:any) => (Number(v.local_cost) || 0) > 0 && !v.attributes?.some((a:any) => a.option && (a.option.includes('عرض') || a.option.includes('كمية') || a.option.includes('pack'))));
                 const singleCost = singleVar ? Number(singleVar.local_cost) : 0;
                 let extractedQ = 1;
                 const varName = targetVariation.name || targetVariation.attributes?.map((a:any) => a.option).join(' ') || '';
                 const match = varName.match(/\d+/);
                 if (match) extractedQ = parseInt(match[0], 10);
                 calculatedQnts = (Number(o.qnts) || 1) * (targetVariation.offer_quantity || extractedQ || 1);
                 baseCost = singleCost;
              } else {
                 baseCost = Number(targetVariation.local_cost) || 0;
                 calculatedQnts = Number(o.qnts) || 1;
              }
          } else {
              baseCost = 0;
          }
      } else {
          baseCost = Number(invProduct?.local_cost) || 0;
          calculatedQnts = Number(o.qnts) || 1;
      }
      
      const totalCogs = o.customProductCost !== undefined ? o.customProductCost : (baseCost * calculatedQnts);
      return { totalCogs, extCost };
  };

  const calculateNet = (o: any) => {
      const { totalCogs, extCost } = getOrderCosts(o);
      const rev = Number(o.totalCharge) || 0;
      const shp = getEffectiveShippingCost(o);
      return rev - shp - totalCogs - extCost;
  };

  const expectedGrossValue = filteredOrders.filter(o => isStatusExpected(o.status1 || '', o.status2 || '')).reduce((sum, o) => sum + calculateNet(o), 0);
  const receivedGrossValue = filteredOrders.filter(o => (o.status2 || '') === 'مستلم').reduce((sum, o) => sum + calculateNet(o), 0);
  
  const isMonthlySub = settings?.returnCostMode === 'monthly_subscription';
  const returnCostTotal = isMonthlySub ? 0 : filteredOrders.filter(o => (o.status2 || '') === 'مرتجع').reduce((sum, o) => {
       const returnCostToUse = o.customReturnCost !== undefined ? o.customReturnCost : (settings?.returnCost || 400);
       const { extCost } = getOrderCosts(o);
       return sum + returnCostToUse + extCost;
  }, 0);

  const totalAdSpendDZD = totalAdSpend * exchangeRate;

  const extraExpensesTotal = useMemo(() => {
     let filteredExpenses = expenses;
     if (dateFilter !== 'all' && dateRange) {
         filteredExpenses = filteredExpenses.filter(e => e.date && isWithinInterval(parseISO(e.date), { start: dateRange.start, end: dateRange.end }));
     }
     return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses, dateFilter, dateRange]);

  const confirmedSalesValue = expectedGrossValue; // Do not subtract ad spend or expenses
  const receivedSalesValue = receivedGrossValue - returnCostTotal - totalAdSpendDZD - extraExpensesTotal;
  const totalExpectedNetValue = expectedGrossValue + receivedGrossValue - returnCostTotal - totalAdSpendDZD - extraExpensesTotal;
  
  const confirmedOrdersCount = filteredOrders.filter(o => isStatusExpected(o.status1 || '', o.status2 || '')).length;
  const receivedOrdersCount = filteredOrders.filter(o => o.status2 === 'مستلم').length;
  const shippedOrdersCount = filteredOrders.filter(o => {
      const s2 = o.status2 || '';
      return s2 === 'تم الشحن' || s2 === 'في الطريق' || s2 === 'مستلم';
  }).length;

  const costPerConfirmed = confirmedOrdersCount > 0 ? (totalAdSpend * exchangeRate) / confirmedOrdersCount : 0;
  const costPerReceived = receivedOrdersCount > 0 ? (totalAdSpend * exchangeRate) / receivedOrdersCount : 0;
  const costPerShippedExpectedDZD = shippedOrdersCount > 0 ? (totalAdSpend * exchangeRate) / shippedOrdersCount : 0;
  const costPerShippedExpectedUSD = shippedOrdersCount > 0 ? totalAdSpend / shippedOrdersCount : 0;

  // Chart Data
  const chartData = useMemo(() => {
    if (!dateRange || (dateFilter === 'all')) {
      // Group by month
      const months = new Map<string, { date: string, spend: number, confirmed: number, received: number, cpa: number, _rcvCount?: number }>();
      const start = dateRange?.start || (filteredOrders.length > 0 ? parseISO(filteredOrders[filteredOrders.length-1].orderDate) : new Date(2023, 0, 1));
      const end = dateRange?.end || new Date();
      
      const interval = eachDayOfInterval({start: start > end ? end : start, end});
      interval.forEach(day => {
          const monthStr = format(day, 'yyyy-MM');
          if (!months.has(monthStr)) {
              months.set(monthStr, { date: monthStr, spend: 0, confirmed: 0, received: 0, cpa: 0, _rcvCount: 0 });
          }
          
          let daySpend = 0;
          relevantCampaigns.forEach(c => {
             const records = campaignRecords.filter(r => r.campaignId === c.id);
             daySpend += calculateTotalCampaignSpend(c, records, day, day);
          });
          const m = months.get(monthStr) as any;
          const daySpendDZD = daySpend * exchangeRate;
          m.spend += daySpendDZD;

          const dayOrders = filteredOrders.filter(o => o.orderDate.startsWith(format(day, 'yyyy-MM-dd')));
          const dayExtraExp = expenses.filter(e => e.date && e.date.startsWith(format(day, 'yyyy-MM-dd'))).reduce((sum, e) => sum + e.amount, 0);
          
          const expectedGross = dayOrders.filter(o => isStatusExpected(o.status1 || '', o.status2 || '')).reduce((s,o)=>s+calculateNet(o), 0);
          const receivedGross = dayOrders.filter(o => (o.status2 || '') === 'مستلم').reduce((s,o)=>s+calculateNet(o), 0);
          const receivedCountDay = dayOrders.filter(o => (o.status2 || '') === 'مستلم').length;
          
          const returnCosts = isMonthlySub ? 0 : dayOrders.filter(o => (o.status2 || '') === 'مرتجع').reduce((acc, o) => {
             const rc = o.customReturnCost !== undefined ? o.customReturnCost : (settings?.returnCost || 400);
             const { extCost } = getOrderCosts(o);
             return acc + rc + extCost;
          }, 0);

          const dayConfirmedNet = expectedGross;
          const dayReceivedNet = receivedGross - returnCosts - daySpendDZD - dayExtraExp;

          m.confirmed += dayConfirmedNet;
          m.received += dayReceivedNet;
          m._rcvCount += receivedCountDay;

          // Cost per order for the month
          m.cpa = m._rcvCount > 0 ? Number((m.spend / m._rcvCount).toFixed(0)) : 0;
      });
      return Array.from(months.values());
    } else {
      // Group by day
      const days = new Map<string, { date: string, spend: number, confirmed: number, received: number, cpa: number }>();
      const interval = eachDayOfInterval({start: dateRange.start, end: dateRange.end});
      
      interval.forEach(day => {
          const dayStr = format(day, 'yyyy-MM-dd');
          if (!days.has(dayStr)) {
              days.set(dayStr, { date: dayStr, spend: 0, confirmed: 0, received: 0, cpa: 0 });
          }
          
          let daySpend = 0;
          relevantCampaigns.forEach(c => {
             const records = campaignRecords.filter(r => r.campaignId === c.id);
             daySpend += calculateTotalCampaignSpend(c, records, day, day);
          });
          const d = days.get(dayStr)!;
          const daySpendDZD = daySpend * exchangeRate;
          d.spend += daySpendDZD;

          const dayOrders = filteredOrders.filter(o => o.orderDate.startsWith(dayStr));
          const dayExtraExp = expenses.filter(e => e.date && e.date.startsWith(dayStr)).reduce((sum, e) => sum + e.amount, 0);
          
          const expectedGross = dayOrders.filter(o => isStatusExpected(o.status1 || '', o.status2 || '')).reduce((s,o)=>s+calculateNet(o), 0);
          const receivedGross = dayOrders.filter(o => (o.status2 || '') === 'مستلم').reduce((s,o)=>s+calculateNet(o), 0);
          const receivedCountDay = dayOrders.filter(o => (o.status2 || '') === 'مستلم').length;
          
          const returnCosts = isMonthlySub ? 0 : dayOrders.filter(o => (o.status2 || '') === 'مرتجع').reduce((acc, o) => {
             const rc = o.customReturnCost !== undefined ? o.customReturnCost : (settings?.returnCost || 400);
             const { extCost } = getOrderCosts(o);
             return acc + rc + extCost;
          }, 0);

          d.confirmed += expectedGross;
          d.received += (receivedGross - returnCosts - daySpendDZD - dayExtraExp);
          
          // CPA = Spend / Count
          d.cpa = receivedCountDay > 0 ? Number((daySpendDZD / receivedCountDay).toFixed(0)) : 0;
      });
      return Array.from(days.values());
    }
  }, [dateRange, dateFilter, filteredOrders, relevantCampaigns, campaignRecords, exchangeRate, settings]);

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200/80 mb-8 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
           <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
             <Target className="w-6 h-6 text-indigo-600" />
             لوحة قيادة الإعلانات
           </h2>
           <p className="text-sm font-medium text-gray-500 mt-1">تتبع كفاءة إنفاقك الإعلاني مقارنة بالمبيعات</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="bg-gray-50 border border-gray-200 text-sm font-bold rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-100 outline-none"
          >
            <option value="today">اليوم</option>
            <option value="week">هذا الأسبوع</option>
            <option value="all">كل الأوقات</option>
            <option value="custom">مخصص</option>
          </select>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 text-sm">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border rounded-xl px-3 py-2 w-36" />
              <span>إلى</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border rounded-xl px-3 py-2 w-36" />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center justify-between w-64 bg-white border border-gray-200 text-sm font-bold text-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-100 outline-none hover:bg-gray-50 transition-colors"
          >
            <span className="truncate">
               {selectedProducts.length === 0 
                  ? 'كل المنتجات' 
                  : selectedProducts.length === 1 
                     ? uniqueProductsData.find(p => p.key === selectedProducts[0])?.label 
                     : `تم تحديد (${selectedProducts.length}) منتجات`}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          
          {isDropdownOpen && (
            <div className="absolute z-50 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 max-h-80 overflow-y-auto overflow-x-hidden right-0 py-2">
               <button 
                  onClick={() => setSelectedProducts([])}
                  className={`flex items-center w-full px-4 py-2.5 text-sm font-bold text-right transition-colors ${selectedProducts.length === 0 ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
               >
                  <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center flex-shrink-0 transition-colors ${selectedProducts.length === 0 ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                     {selectedProducts.length === 0 && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  الكل (الافتراضي)
               </button>
               <div className="h-px bg-gray-100 my-1 mx-2"></div>
               {uniqueProductsData.map(p => {
                  const isSelected = selectedProducts.includes(p.key);
                  return (
                     <button
                        key={p.key}
                        onClick={() => {
                           if (isSelected) {
                              setSelectedProducts(selectedProducts.filter(key => key !== p.key));
                           } else {
                              setSelectedProducts([...selectedProducts, p.key]);
                           }
                        }}
                        className={`flex items-center w-full px-4 py-2 text-sm font-bold text-right transition-colors ${isSelected ? 'bg-indigo-50/50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
                     >
                        <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                           {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className="truncate">{p.label}</span>
                     </button>
                  );
               })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
         <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5"><Megaphone className="w-16 h-16" /></div>
             <p className="text-sm font-bold text-gray-600 mb-1">الإنفاق الإعلاني الإجمالي</p>
             <h3 className="text-3xl font-black text-gray-900 mb-2">${totalAdSpend.toLocaleString()} <span className="text-base text-gray-400 font-bold block mt-1">{(totalAdSpend * exchangeRate).toLocaleString()} <span className="text-xs">د.ج</span></span></h3>
         </div>
         <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-600"><CheckCircle className="w-16 h-16" /></div>
             <p className="text-sm font-bold text-emerald-800 mb-1">صافي الأرباح المتوقعة (مؤكدة فقط)</p>
             <h3 className="text-3xl font-black text-emerald-900 mb-2">{confirmedSalesValue.toLocaleString()} <span className="text-sm">د.ج</span></h3>
             <p className="text-xs font-bold text-emerald-700">بدون خصم الإنفاق الإعلاني</p>
         </div>
         <div className="bg-violet-50 rounded-2xl p-4 border border-violet-100 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10 text-violet-600"><CheckCircle className="w-16 h-16" /></div>
             <p className="text-sm font-bold text-violet-800 mb-1">الصافي الكامل المتوقع</p>
             <h3 className="text-3xl font-black text-violet-900 mb-2">{totalExpectedNetValue.toLocaleString()} <span className="text-sm">د.ج</span></h3>
             <p className="text-xs font-bold text-violet-700">مستلم + مؤكد (بعد خصم الإنفاق)</p>
         </div>
         <div className="bg-fuchsia-50 rounded-2xl p-4 border border-fuchsia-100 relative overflow-hidden flex flex-col justify-between">
             <div className="absolute top-0 right-0 p-4 opacity-10 text-fuchsia-600"><Target className="w-16 h-16" /></div>
             <p className="text-sm font-bold text-fuchsia-800 mb-1 leading-tight">تكلفة المتوقع (المشحون والمستلم)</p>
             <div className="mt-1">
                 <h3 className="text-3xl font-black text-fuchsia-900 leading-none">${costPerShippedExpectedUSD.toLocaleString(undefined, {maximumFractionDigits:2})}</h3>
                 <span className="text-base text-fuchsia-700 font-bold block mt-1.5">{costPerShippedExpectedDZD.toLocaleString(undefined, {maximumFractionDigits:0})} <span className="text-xs">د.ج</span></span>
             </div>
             <p className="text-[10px] font-bold text-fuchsia-700/70 mt-2">مبنياً على {shippedOrdersCount} طلب</p>
         </div>
         <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-600"><Package className="w-16 h-16" /></div>
             <p className="text-sm font-bold text-blue-800 mb-1">صافي الأرباح الحقيقية (مستلمة)</p>
             <h3 className="text-3xl font-black text-blue-900 mb-2">{receivedSalesValue.toLocaleString()} <span className="text-sm">د.ج</span></h3>
             <p className="text-xs font-bold text-blue-700">التكلفة للطلب: {costPerReceived.toLocaleString(undefined, {maximumFractionDigits:0})} د.ج</p>
         </div>
         <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-600"><DollarSign className="w-16 h-16" /></div>
             <p className="text-sm font-bold text-amber-800 mb-1">العائد على الاستثمار (ROI مستلم)</p>
             <h3 className="text-3xl font-black text-amber-900 mb-2">
                {totalAdSpend > 0 ? (receivedSalesValue / (totalAdSpend * exchangeRate)).toFixed(2) : '0.0'} x
             </h3>
             <p className="text-xs font-bold text-amber-700">مبني على الإنفاق وصافي المستلم</p>
         </div>
      </div>

      <div className="h-64 mt-8">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorConfirmed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
            <RechartsTooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}
            />
            <Area type="monotone" name="الإنفاق" dataKey="spend" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSpend)" />
            <Area type="monotone" name="صافي المؤكد" dataKey="confirmed" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorConfirmed)" />
            <Area type="monotone" name="صافي المستلم" dataKey="received" stroke="#3b82f6" strokeWidth={2} fillOpacity={0} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="pt-6 border-t border-gray-100 mt-6">
         <h3 className="text-sm font-black text-gray-700 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-500" />
            تطور تكلفة المبيعة المستلمة (CPA / Cost Per Sale)
         </h3>
         <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                 <defs>
                   <linearGradient id="colorCpa" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                 <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                 <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}`} />
                 <RechartsTooltip 
                     contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                     labelStyle={{ fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}
                     formatter={(value: any, name: any) => [`${value} د.ج`, 'تكلفة المبيعة (CPA)']}
                 />
                 <Area type="monotone" name="التكلفة (CPA)" dataKey="cpa" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorCpa)" />
               </AreaChart>
            </ResponsiveContainer>
         </div>
      </div>

      <div className="pt-6 border-t border-slate-100 mt-8 space-y-4">
         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
               <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-indigo-500" />
                  تحليل الـ UTM وتتبع كفاءة الإعلانات التفصيلي
               </h3>
               <p className="text-xs font-bold text-slate-400 mt-0.5">تتبع نسب التأكيد، الشحن والتسليم لكل حملة، مجموعة إعلانية وإعلان تلقائياً</p>
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs font-bold w-full sm:w-auto">
               <button
                  onClick={() => setUtmTab('campaign')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all ${utmTab === 'campaign' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
               >
                  الحملات (Campaigns)
               </button>
               <button
                  onClick={() => setUtmTab('adset')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all ${utmTab === 'adset' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
               >
                  المجموعات (Ad Sets / Medium)
               </button>
               <button
                  onClick={() => setUtmTab('ad')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all ${utmTab === 'ad' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
               >
                  الإعلانات (Ads / Content)
               </button>
               <button
                  onClick={() => setUtmTab('source')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all ${utmTab === 'source' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
               >
                  المصادر (Sources)
               </button>
            </div>
         </div>

         {(() => {
            const dataToRender = utmTab === 'campaign' 
               ? utmStats.campaigns 
               : utmTab === 'adset' 
                  ? utmStats.mediums 
                  : utmTab === 'ad'
                     ? utmStats.contents
                     : utmStats.sources;

            if (dataToRender.length === 0) {
               return (
                  <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-400 text-sm">
                     لا توجد بيانات تتبع UTM مسجلة للخيارات المحددة في هذه الفترة.
                     <br />
                     <span className="text-xs font-medium text-slate-400 mt-2 block">يرجى التأكد من أن طلبيات متجر ووردبريس تحتوي على بارامترات التتبع (utm_campaign, utm_medium, utm_content).</span>
                  </div>
               );
            }

            return (
               <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-right text-xs">
                     <thead className="bg-slate-50 text-slate-500 font-black border-b border-slate-200">
                        <tr>
                           <th className="p-3.5">الاسم / المعرف</th>
                           <th className="p-3.5 text-center">الطلبات الكلية</th>
                           <th className="p-3.5 text-center">المؤكدة %</th>
                           <th className="p-3.5 text-center">المشحونة %</th>
                           <th className="p-3.5 text-center">المستلمة %</th>
                           {utmTab === 'campaign' && <th className="p-3.5 text-center">الإنفاق الإجمالي</th>}
                           {utmTab === 'campaign' && <th className="p-3.5 text-center">كلفة المستلم (CPA)</th>}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 bg-white font-bold text-slate-700">
                        {dataToRender.map((row: any, idx: number) => {
                           const confRate = row.total > 0 ? (row.confirmed / row.total * 100) : 0;
                           const shipRate = row.confirmed > 0 ? (row.shipped / row.confirmed * 100) : 0;
                           const recRate = row.shipped > 0 ? (row.received / row.shipped * 100) : 0;
                           const cpa = row.received > 0 ? (row.spend / row.received) : 0;

                           return (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                 <td className="p-3.5 max-w-xs truncate font-black text-slate-800">{row.name}</td>
                                 <td className="p-3.5 text-center font-mono">{row.total}</td>
                                 <td className="p-3.5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                       <span className="font-mono">{confRate.toFixed(0)}%</span>
                                       <span className="text-[10px] text-slate-400">({row.confirmed})</span>
                                    </div>
                                 </td>
                                 <td className="p-3.5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                       <span className="font-mono text-indigo-600">{shipRate.toFixed(0)}%</span>
                                       <span className="text-[10px] text-slate-400">({row.shipped})</span>
                                    </div>
                                 </td>
                                 <td className="p-3.5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                       <span className="font-mono text-emerald-600">{recRate.toFixed(0)}%</span>
                                       <span className="text-[10px] text-slate-400">({row.received})</span>
                                    </div>
                                 </td>
                                 {utmTab === 'campaign' && (
                                    <td className="p-3.5 text-center font-mono text-slate-600">
                                       {row.spend > 0 ? `${row.spend.toLocaleString(undefined, {maximumFractionDigits:0})} د.ج` : '-'}
                                    </td>
                                 )}
                                 {utmTab === 'campaign' && (
                                    <td className="p-3.5 text-center font-mono">
                                       {cpa > 0 ? (
                                          <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                             {cpa.toLocaleString(undefined, {maximumFractionDigits:0})} د.ج
                                          </span>
                                       ) : row.spend > 0 ? (
                                          <span className="text-rose-500">لا تسليم بعد</span>
                                       ) : '-'}
                                    </td>
                                 )}
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            );
         })()}
      </div>

    </div>
  );
}
