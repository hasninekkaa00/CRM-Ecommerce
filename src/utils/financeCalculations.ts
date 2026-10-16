import { checkProductMatch, isCampaignMatchedToProduct } from './productFilters';
import { parseISO, isWithinInterval, startOfDay, endOfDay, eachDayOfInterval, isSameDay, format } from 'date-fns';
import { getOrderUnitAndTotalCost } from './productCostUtils';
import { getEffectiveShippingCost } from './shippingFees';

export function safeParseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    try {
      const iso = parseISO(trimmed.includes(' ') && !trimmed.includes('T') ? trimmed.replace(' ', 'T') : trimmed);
      if (!isNaN(iso.getTime())) return iso;
    } catch {}
    try {
      const native = new Date(trimmed);
      if (!isNaN(native.getTime())) return native;
    } catch {}
  }
  return null;
}

export function safeIsWithinInterval(date: any, interval: { start: any; end: any }): boolean {
  const d = safeParseDate(date);
  const s = safeParseDate(interval.start);
  const e = safeParseDate(interval.end);
  if (!d || !s || !e) return false;
  return d.getTime() >= s.getTime() && d.getTime() <= e.getTime();
}

export function getPeriodReturnCost({
  settings,
  orders,
  dateFilter,
  periodStart,
  periodEnd,
  returnedOrders = [],
  returnedExtCostSum = 0
}: {
  settings: any;
  orders: any[];
  dateFilter: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  returnedOrders?: any[];
  returnedExtCostSum?: number;
}): { returnCostTotal: number; isMonthlySub: boolean; monthsCount: number; monthlySub: number } {
  const isMonthlySub = settings?.returnCostMode === 'monthly_subscription';
  const monthlySub = Number(settings?.returnMonthlySubscription) || 0;
  const defaultRCost = Number(settings?.returnCost) || 400;

  if (!isMonthlySub) {
    let sum = 0;
    returnedOrders.forEach(o => {
      const c = o.customReturnCost !== undefined ? Number(o.customReturnCost) : defaultRCost;
      sum += c;
    });
    return {
      returnCostTotal: sum + returnedExtCostSum,
      isMonthlySub: false,
      monthsCount: 0,
      monthlySub: 0
    };
  }

  // Monthly subscription mode:
  // In monthly subscription mode, no individual order return costs are deducted;
  // all carrier returns are covered strictly by the monthly subscription fee.
  let monthsCount = 1;

  if (dateFilter === 'all') {
    // Collect all distinct months from orders that have dates
    const distinctMonths = new Set<string>();
    orders.forEach(o => {
      if (o.orderDate) {
        try {
          distinctMonths.add(format(parseISO(o.orderDate), 'yyyy-MM'));
        } catch {}
      }
    });
    monthsCount = Math.max(1, distinctMonths.size);
    const totalCarrierReturn = monthsCount * monthlySub;
    return {
      returnCostTotal: totalCarrierReturn,
      isMonthlySub: true,
      monthsCount,
      monthlySub
    };
  }

  if (dateFilter === 'month') {
    monthsCount = 1;
    return {
      returnCostTotal: monthlySub,
      isMonthlySub: true,
      monthsCount: 1,
      monthlySub
    };
  }

  if (dateFilter === 'today' || dateFilter === 'yesterday') {
    const dailyShare = Math.round(monthlySub / 30);
    return {
      returnCostTotal: dailyShare,
      isMonthlySub: true,
      monthsCount: 1 / 30,
      monthlySub
    };
  }

  if (dateFilter === 'week') {
    const weekShare = Math.round((7 / 30) * monthlySub);
    return {
      returnCostTotal: weekShare,
      isMonthlySub: true,
      monthsCount: 7 / 30,
      monthlySub
    };
  }

  // Custom filter or interval
  if (periodStart && periodEnd) {
    const days = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
    if (days >= 27 && periodStart.getMonth() === periodEnd.getMonth() && periodStart.getFullYear() === periodEnd.getFullYear()) {
      // Full month selection in the past or present
      monthsCount = 1;
      return {
        returnCostTotal: monthlySub,
        isMonthlySub: true,
        monthsCount: 1,
        monthlySub
      };
    } else if (days < 27) {
      // Fraction of month
      const partial = Math.round((days / 30) * monthlySub);
      return {
        returnCostTotal: partial,
        isMonthlySub: true,
        monthsCount: Number((days / 30).toFixed(2)),
        monthlySub
      };
    } else {
      // Spans multiple months in previous history:
      const monthSpan = new Set<string>();
      let curr = new Date(periodStart);
      while (curr <= periodEnd) {
        monthSpan.add(format(curr, 'yyyy-MM'));
        curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
      }
      monthsCount = Math.max(1, monthSpan.size);
      return {
        returnCostTotal: monthsCount * monthlySub,
        isMonthlySub: true,
        monthsCount,
        monthlySub
      };
    }
  }

  return {
    returnCostTotal: monthlySub,
    isMonthlySub: true,
    monthsCount: 1,
    monthlySub
  };
}

export const mapStatusToStatus2 = (statusText: string, order?: any): string => {
    let s = (statusText || '').toLowerCase().trim();
    
    const isGeneric = s === 'تم الشحن' || s === '' || s === 'shipped';
    if (order && isGeneric) {
      const history = order.trackingHistory || [];
      if (history.length > 0) {
         const lastStatus = (history[history.length - 1].status || '').toLowerCase().trim();
         if (lastStatus && !lastStatus.includes('تم الشحن')) {
            s = lastStatus;
         }
      } else if (order.notes) {
         const lastNoteLine = order.notes.split('\n').pop();
         if (lastNoteLine && lastNoteLine.includes('[حالة الشحن]:')) {
             const extracted = lastNoteLine.split('[حالة الشحن]:')[1].split('-')[0].trim().toLowerCase();
             if (extracted) s = extracted;
         }
      }
    }

    if (!s) return 'تم الشحن';

    if (
      s.includes('prêt') || s.includes('pret') || s.includes('ready') ||
      s.includes('جاهزة للإرسال') || s.includes('جاهزة لارسال') || s.includes('جاهز للإرسال') || s.includes('جاهز لارسال') ||
      s.includes('جاهزة للشحن') || s.includes('جاهز للشحن') || s.includes('قابلة للشحن') ||
      s.includes('انشاء') || s.includes('أنشئ') || s.includes('تسجيل') || s.includes('créé') || s.includes('cree') || s.includes('created') ||
      s.includes('enregistré') || s.includes('enregistre') || s.includes('orderinformationreceivedbycarrier') || s.includes('demande') ||
      s.includes('تم استقبال الطلبية من طرف شركة التوصيل') || s.includes('تم تسجيل الطلبية')
    ) {
      return 'تم الشحن';
    }

    if (
      s.includes('تم التوصيل') || s.includes('تم تحصيل المبلغ') || s.includes('تم الدفع للمتجر') || 
      s.includes('livred') || s.includes('encaissed') || s.includes('payed') || s.includes('paid') ||
      s.includes('livré') || s.includes('livre') || s.includes('delivered') || 
      (s.includes('توصيل') && !s.includes('محاولة') && !s.includes('شركة التوصيل') && !s.includes('قيد') && !s.includes('رسوم') && !s.includes('إلى') && !s.includes('مركز')) ||
      (s.includes('مستلم') && !s.includes('مركز الفرز') && !s.includes('استلام') && !s.includes('شركة'))
    ) {
      return 'مستلم';
    }

    if (
      s.includes('anomalie') || s.includes('retour') || s.includes('مرتجع') || 
      s.includes('echoué') || s.includes('échoué') || s.includes('canceled') || s.includes('annulé') || s.includes('annule') ||
      s.includes('refusé') || s.includes('refuse') || s.includes('مرفوض') || s.includes('non abouti') || 
      s.includes('إلغاء') || s.includes('ملغى') || s.includes('فشل')
    ) {
      return 'مرتجع';
    }

    if (
      s.includes('en attente') || s.includes('en cours') || s.includes('ramassé') || s.includes('ramasse') ||
      s.includes('hub') || s.includes('bureau') || s.includes('مركز') || s.includes('wilaya') || s.includes('ولاية') ||
      s.includes('transit') || s.includes('dispatch') || s.includes('transfert') || s.includes('transferé') || s.includes('transféré') ||
      s.includes('en route') || s.includes('في الطريق') || s.includes('vers') || s.includes('إلى') || 
      s.includes('centre de tri') || s.includes('Sorti pour la livraison') || s.includes('en livraison') ||
      s.includes('قيد التوصيل') || s.includes('محاولة توصيل') || s.includes('sortie') || s.includes('معلق') ||
      s.includes('تأجيل') || s.includes('reporté') || s.includes('reporte') || s.includes('مؤجل') || s.includes('لا يرد') ||
      s.includes('pas de reponse') || s.includes('injoignable') || s.includes('hors zone') || s.includes('خارج التغطية') ||
      s.includes('خطأ في العنوان') || s.includes('adresse')
    ) {
      return 'في الطريق';
    }

    return 'في الطريق';
};

export const getDeliveryDate = (order: any) => {
    if (mapStatusToStatus2(order.status2 || '', order) !== 'مستلم') return null;
    if (order.deliveredDate) return safeParseDate(order.deliveredDate);
    if (order.deliveredAt) return safeParseDate(order.deliveredAt);
    if (order.deliveryDate) return safeParseDate(order.deliveryDate);
    if (order.trackingHistory && order.trackingHistory.length > 0) {
      const hist = [...order.trackingHistory].reverse().find((h:any) => mapStatusToStatus2(h.status || '', order) === 'مستلم');
      if (hist && hist.date) {
        const d = safeParseDate(hist.date);
        if (d) return d;
      }
    }
    return safeParseDate(order.orderDate);
};

export const getReturnDate = (order: any) => {
    if (mapStatusToStatus2(order.status2 || '', order) !== 'مرتجع') return null;
    if (order.returnedDate) return safeParseDate(order.returnedDate);
    if (order.returnedAt) return safeParseDate(order.returnedAt);
    if (order.returnDate) return safeParseDate(order.returnDate);
    if (order.trackingHistory && order.trackingHistory.length > 0) {
      const hist = [...order.trackingHistory].reverse().find((h:any) => mapStatusToStatus2(h.status || '', order) === 'مرتجع');
      if (hist && hist.date) {
        const d = safeParseDate(hist.date);
        if (d) return d;
      }
    }
    return safeParseDate(order.orderDate);
};

export const getBaseOrderCogs = (o: any, inventoryProducts: any[], settings: any) => {
    const costInfo = getOrderUnitAndTotalCost(o, inventoryProducts, settings);
    return costInfo.totalCogs;
};

export const getOrderCosts = (o: any, inventoryProducts: any[], settings: any, orders: any[]) => {
    let extCost = o.customAdditionalCost || 0;
    let totalCogs = getBaseOrderCogs(o, inventoryProducts, settings);
    
    if (o.isReplacement && o.replacedOrderId) {
        const orig = orders.find(x => x.id === o.replacedOrderId || x.orderId === o.replacedOrderId);
        if (orig) {
            const origCogs = getBaseOrderCogs(orig, inventoryProducts, settings);
            totalCogs = Math.max(0, totalCogs - origCogs);
        }
    }
    
    return { totalCogs, extCost };
};

export const calculateTotalCampaignSpend = (campaign: any, records: any[], startObj?: Date, endObj?: Date) => {
    let totalSpend = 0;
    try {
      const campStart = startOfDay(parseISO(campaign.createdAt));
      const campEnd = campaign.archivedAt ? endOfDay(parseISO(campaign.archivedAt)) : endOfDay(new Date());
      
      const calcStart = startObj && startObj > campStart ? startObj : campStart;
      const calcEnd = endObj && endObj < campEnd ? endObj : campEnd;

      if (calcStart > calcEnd) {
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

      records.forEach(r => {
         if (r.date) {
            const rDate = startOfDay(parseISO(r.date));
            if ((rDate < campStart || rDate > campEnd) && (!startObj || rDate >= startObj) && (!endObj || rDate <= endObj)) {
                 totalSpend += (Number(r.spend) || 0);
            }
         }
      });

      return totalSpend;
    } catch (e) {
      return 0;
    }
};




export const createFinanceCalculator = (
  orders: any[],
  expenses: any[],
  campaigns: any[],
  campaignRecords: any[],
  settings: any,
  inventoryProducts: any[],
  dateFilter: string,
  periodStart: Date | null,
  periodEnd: Date | null,
  productFilter: string,
  confirmerFilter: string,
  start: Date | null
) => {
    let expectedRev = 0, expectedCogs = 0, expectedShip = 0, expectedCount = 0, expectedExtCost = 0;
    let realRev = 0, realCogs = 0, realShip = 0, realCount = 0, realExtCost = 0;
    let returnedCount = 0;
    const returnedOrdersInPeriod: any[] = [];
    let returnedExtCostSum = 0;

    const exRate = settings?.exchangeRate || 245;





    orders.forEach(o => {
      if (confirmerFilter !== 'all' && o.confirmedBy !== confirmerFilter) return;
      if (!checkProductMatch(o, productFilter, inventoryProducts)) return;

      const isShipped = !!o.shippingTrackingId || ['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع'].includes(o.status2 || '');
      if (!isShipped) return;

      const realStatus = (o.isExchangedReturn ? 'مستلم' : mapStatusToStatus2(o.status2 || '', o));
      if (o.status1 === 'ملغى' || realStatus === 'ملغى' || realStatus === 'ملغاة' || realStatus === 'إلغاء') return;

      const { totalCogs, extCost } = getOrderCosts(o, inventoryProducts, settings, orders);
      const oDate = safeParseDate(o.orderDate);
      
      const isStatusExpected = realStatus !== 'مستلم' && realStatus !== 'مرتجع' && (o.status1 === 'مؤكد' || realStatus === 'تم الشحن' || realStatus === 'في الطريق');

      const isInside = (d: Date | null) => {
        if (!d) return false;
        if (dateFilter === 'all') return true;
        if (!periodStart || !periodEnd) return false;
        return safeIsWithinInterval(d, { start: periodStart, end: periodEnd });
      };

      // EXPECTED Calculation (Based on Order Date)
      if (isStatusExpected) {
        if (isInside(oDate)) {
            const qty = Number(o.qnts) || 1;
            expectedCount += qty;
            expectedRev += Number(o.totalCharge) || 0;
            expectedShip += getEffectiveShippingCost(o, settings);
            expectedCogs += totalCogs;
            expectedExtCost += extCost;
        }
      }

      // REALIZED Calculation (Based on Delivery Date)
      if (realStatus === 'مستلم') {
        const dDate = getDeliveryDate(o);
        if (isInside(dDate)) {
            const qty = Number(o.qnts) || 1;
            realCount += qty;
            realRev += Number(o.totalCharge) || 0;
            realShip += getEffectiveShippingCost(o, settings);
            realCogs += totalCogs;
            realExtCost += extCost;
        }
      }

      // RETURNS Calculation (Based on Return Date)
      if (realStatus === 'مرتجع') {
        const rDate = getReturnDate(o);
        if (isInside(rDate)) {
            const qty = Number(o.qnts) || 1;
            returnedCount += qty;
            returnedOrdersInPeriod.push(o);
            returnedExtCostSum += extCost;
        }
      }
    });

    const { returnCostTotal, isMonthlySub, monthsCount, monthlySub } = getPeriodReturnCost({
      settings,
      orders,
      dateFilter,
      periodStart,
      periodEnd,
      returnedOrders: returnedOrdersInPeriod,
      returnedExtCostSum
    });

    let adSpendUSD = 0;
    
    // Auto + Manual daily spend calculation
    const matchingCampaigns = campaigns.filter(camp => isCampaignMatchedToProduct(camp, productFilter, inventoryProducts));

    matchingCampaigns.forEach(camp => {
        const records = campaignRecords.filter(r => r.campaignId === camp.id);
        const calcStart = (dateFilter === 'all' || !periodStart) ? undefined : periodStart;
        const calcEnd = (dateFilter === 'all' || !periodEnd) ? undefined : periodEnd;
        adSpendUSD += calculateTotalCampaignSpend(camp, records, calcStart, calcEnd);
    });

    const adSpendDZD = adSpendUSD * exRate;

    const extraExpenses = expenses.filter(e => {
       if (dateFilter === 'all') return periodStart === null || periodStart === start;
       if (!periodStart || !periodEnd) return false;
       const eDate = safeParseDate(e.date);
       return eDate && safeIsWithinInterval(eDate, { start: periodStart, end: periodEnd });
    }).reduce((sum, e) => sum + e.amount, 0);

    const isProdFiltered = productFilter !== 'all';
    // For a filtered product, calculate its real per-order return costs; if monthly subscription mode is used for whole store, return cost is 0 for individual products
    const effectiveReturnCostTotal = isProdFiltered ? (isMonthlySub ? 0 : returnCostTotal) : returnCostTotal;
    const effectiveExtraExpenses = isProdFiltered ? 0 : extraExpenses;
    const effectiveExpectedExtCost = isProdFiltered ? 0 : expectedExtCost;
    const effectiveRealExtCost = isProdFiltered ? 0 : realExtCost;

    const expectedGrossProfit = expectedRev - expectedCogs - expectedShip - effectiveExpectedExtCost;
    const expectedNetProfit = expectedGrossProfit; // Do not subtract ad spend or expenses

    const realGrossProfit = realRev - realCogs - realShip - effectiveRealExtCost;
    const realNetProfit = realGrossProfit - effectiveReturnCostTotal - adSpendDZD - effectiveExtraExpenses;
    
    const totalCombinedNetProfit = expectedGrossProfit + realGrossProfit - effectiveReturnCostTotal - adSpendDZD - effectiveExtraExpenses;
    const totalCosts = realCogs + realShip + effectiveRealExtCost + effectiveReturnCostTotal + adSpendDZD + effectiveExtraExpenses;
    
    return {
      expectedRev, expectedCogs, expectedShip, expectedCount, expectedExtCost: effectiveExpectedExtCost,
      realRev, realCogs, realShip, realCount, realExtCost: effectiveRealExtCost,
      returnCostTotal: effectiveReturnCostTotal, returnedCount,
      isMonthlySub, monthsCount, monthlySub,
      adSpendUSD, adSpendDZD, extraExpenses: effectiveExtraExpenses,
      expectedGrossProfit, expectedNetProfit,
      realGrossProfit, realNetProfit,
      totalCombinedNetProfit,
      totalCosts
    };
};
