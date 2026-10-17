import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { getOrderUnitAndTotalCost } from './productCostUtils';
import { getEffectiveShippingCost } from './shippingFees';

export interface ExportColumnDef {
  id: string;
  label: string;
  category: 'basic' | 'customer' | 'product' | 'shipping' | 'finance';
  defaultSelected: boolean;
  width?: number;
}

export const ALL_FINANCE_EXPORT_COLUMNS: ExportColumnDef[] = [
  { id: 'index', label: 'الرقم التسلسلي', category: 'basic', defaultSelected: true, width: 8 },
  { id: 'orderId', label: 'رقم الطلبية', category: 'basic', defaultSelected: true, width: 14 },
  { id: 'tracking', label: 'رقم التتبع', category: 'basic', defaultSelected: true, width: 18 },
  { id: 'orderDate', label: 'تاريخ الطلبية', category: 'basic', defaultSelected: true, width: 18 },
  { id: 'deliveryDate', label: 'تاريخ التوصيل / المعالجة', category: 'basic', defaultSelected: true, width: 20 },
  
  { id: 'customerName', label: 'اسم الزبون', category: 'customer', defaultSelected: true, width: 22 },
  { id: 'phone', label: 'رقم الهاتف', category: 'customer', defaultSelected: true, width: 15 },
  { id: 'wilaya', label: 'الولاية', category: 'customer', defaultSelected: true, width: 15 },
  { id: 'commune', label: 'البلدية', category: 'customer', defaultSelected: true, width: 15 },
  
  { id: 'productName', label: 'اسم المنتج', category: 'product', defaultSelected: true, width: 26 },
  { id: 'variation', label: 'النوع / الموديل', category: 'product', defaultSelected: true, width: 18 },
  { id: 'sku', label: 'رمز المنتج (SKU)', category: 'product', defaultSelected: true, width: 16 },
  { id: 'quantity', label: 'الكمية', category: 'product', defaultSelected: true, width: 10 },

  { id: 'deliveryCompany', label: 'شركة التوصيل', category: 'shipping', defaultSelected: true, width: 16 },
  { id: 'status1', label: 'حالة التأكيد', category: 'shipping', defaultSelected: false, width: 14 },
  { id: 'status2', label: 'حالة التوصيل', category: 'shipping', defaultSelected: true, width: 16 },
  { id: 'profitType', label: 'نوع الربحية', category: 'finance', defaultSelected: true, width: 18 },

  { id: 'revenue', label: 'سعر البيع / التحصيل (د.ج)', category: 'finance', defaultSelected: true, width: 18 },
  { id: 'customerShipping', label: 'شحن الزبون (د.ج)', category: 'finance', defaultSelected: false, width: 16 },
  { id: 'realShipping', label: 'سعر الشحن الحقيقي (د.ج)', category: 'finance', defaultSelected: true, width: 20 },
  { id: 'cogs', label: 'تكلفة البضاعة من المخزن (د.ج)', category: 'finance', defaultSelected: true, width: 20 },
  { id: 'extraCost', label: 'تكاليف إضافية (د.ج)', category: 'finance', defaultSelected: false, width: 16 },
  { id: 'returnCost', label: 'تكلفة المرتجع (د.ج)', category: 'finance', defaultSelected: true, width: 16 },
  { id: 'netProfit', label: 'صافي الفائدة والأرباح (د.ج)', category: 'finance', defaultSelected: true, width: 20 },

  { id: 'confirmedBy', label: 'المؤكد / المسؤول', category: 'basic', defaultSelected: true, width: 16 },
  { id: 'notes', label: 'ملاحظات', category: 'basic', defaultSelected: false, width: 26 }
];

export interface ExportFinanceOrdersOptions {
  orders: any[];
  inventoryProducts?: any[];
  settings?: any;
  filterLabel?: string;
  fileNamePrefix?: string;
  mapStatusFn?: (statusText: string, order?: any) => string;
  getOrderCostsFn?: (order: any) => { totalCogs: number; extCost: number };
  getEffectiveShippingCostFn?: (order: any) => number;
  getDeliveryDateFn?: (order: any) => Date | null;
  selectedColumnIds?: string[];
}

export interface AdvancedExportOptions extends ExportFinanceOrdersOptions {
  exportMode: 'detailed' | 'grouped' | 'both';
}

const defaultGetOrderCosts = (o: any, inventoryProducts: any[] = [], settings?: any) => {
  const costInfo = getOrderUnitAndTotalCost(o, inventoryProducts, settings);
  const extCost = Number(o.customAdditionalCost) || 0;
  return { totalCogs: costInfo.totalCogs, extCost };
};

const defaultGetEffectiveShipping = (o: any) => {
  return getEffectiveShippingCost(o);
};

/**
 * Builds rows for the Detailed Orders sheet based on selected columns
 */
function buildDetailedOrdersData(
  orders: any[],
  selectedColumnIds: string[],
  options: ExportFinanceOrdersOptions
) {
  const {
    inventoryProducts = [],
    settings = {},
    filterLabel = '',
    mapStatusFn,
    getOrderCostsFn,
    getEffectiveShippingCostFn,
    getDeliveryDateFn
  } = options;

  const getCosts = getOrderCostsFn || ((o) => defaultGetOrderCosts(o, inventoryProducts, settings));
  const getShipping = getEffectiveShippingCostFn || defaultGetEffectiveShipping;
  const defaultReturnCost = Number(settings?.returnCost) || 400;
  const isMonthlySub = settings?.returnCostMode === 'monthly_subscription';

  const activeCols = ALL_FINANCE_EXPORT_COLUMNS.filter(c => selectedColumnIds.includes(c.id));
  const colMap = new Map(activeCols.map(c => [c.id, c.label]));

  let sumQty = 0;
  let sumRev = 0;
  let sumCustShp = 0;
  let sumRealShp = 0;
  let sumCogs = 0;
  let sumExtCost = 0;
  let sumReturnCost = 0;
  let sumNetProfit = 0;

  const rows = orders.map((o, idx) => {
    const { totalCogs, extCost } = getCosts(o);
    const rev = Number(o.totalCharge) || 0;
    const customerShp = Number(o.deliveryPrice) || 0;
    const realShp = getShipping(o);
    const qty = Number(o.qnts) || 1;

    let realStatus = o.status2 || '';
    if (mapStatusFn) {
      realStatus = (o.isExchangedReturn ? 'مستلم' : mapStatusFn(o.status2 || '', o));
    } else {
      realStatus = o.isExchangedReturn ? 'مستلم' : (o.status2 || 'تم الشحن');
    }

    const isDelivered = realStatus === 'مستلم';
    const isReturned = realStatus === 'مرتجع';
    const returnCostToUse = isReturned ? (isMonthlySub ? 0 : (o.customReturnCost !== undefined ? Number(o.customReturnCost) : defaultReturnCost)) : 0;

    let netProfit = 0;
    let profitType = 'معلقة (متوقعة)';

    if (isDelivered) {
      profitType = 'مستلمة (حقيقية)';
      netProfit = rev - realShp - totalCogs - extCost;
    } else if (isReturned) {
      profitType = isMonthlySub ? 'مرتجع (اشتراك)' : 'مرتجع (خسارة)';
      netProfit = isMonthlySub ? 0 : (-returnCostToUse - extCost);
    } else {
      profitType = 'قيد التوصيل';
      netProfit = rev - realShp - totalCogs - extCost;
    }

    sumQty += qty;
    sumRev += rev;
    sumCustShp += customerShp;
    sumRealShp += realShp;
    sumCogs += totalCogs;
    sumExtCost += extCost;
    sumReturnCost += returnCostToUse;
    sumNetProfit += netProfit;

    let orderDateFormatted = '';
    if (o.orderDate) {
      try {
        orderDateFormatted = format(parseISO(o.orderDate), 'yyyy-MM-dd HH:mm');
      } catch {
        orderDateFormatted = String(o.orderDate);
      }
    }

    let deliveryDateFormatted = '';
    if (getDeliveryDateFn) {
      const dDate = getDeliveryDateFn(o);
      if (dDate) {
        deliveryDateFormatted = format(dDate, 'yyyy-MM-dd HH:mm');
      }
    } else if (o.deliveryDate) {
      try {
        deliveryDateFormatted = format(parseISO(o.deliveryDate), 'yyyy-MM-dd');
      } catch {
        deliveryDateFormatted = String(o.deliveryDate);
      }
    }

    const rowObj: Record<string, any> = {};

    activeCols.forEach(col => {
      switch (col.id) {
        case 'index': rowObj[col.label] = idx + 1; break;
        case 'orderId': rowObj[col.label] = o.orderId || o.id || ''; break;
        case 'tracking': rowObj[col.label] = o.shippingTrackingId || 'بدون تتبع'; break;
        case 'orderDate': rowObj[col.label] = orderDateFormatted; break;
        case 'deliveryDate': rowObj[col.label] = deliveryDateFormatted; break;
        case 'customerName': rowObj[col.label] = o.fullName || ''; break;
        case 'phone': rowObj[col.label] = o.phone ? String(o.phone) : ''; break;
        case 'wilaya': rowObj[col.label] = o.region || o.wilaya || ''; break;
        case 'commune': rowObj[col.label] = o.city || o.commune || ''; break;
        case 'productName': rowObj[col.label] = o.productName || ''; break;
        case 'variation': rowObj[col.label] = o.variation || ''; break;
        case 'sku': rowObj[col.label] = o.sku || ''; break;
        case 'quantity': rowObj[col.label] = qty; break;
        case 'deliveryCompany': rowObj[col.label] = o.deliveryCompany || ''; break;
        case 'status1': rowObj[col.label] = o.status1 || ''; break;
        case 'status2': rowObj[col.label] = realStatus; break;
        case 'profitType': rowObj[col.label] = profitType; break;
        case 'revenue': rowObj[col.label] = rev; break;
        case 'customerShipping': rowObj[col.label] = customerShp; break;
        case 'realShipping': rowObj[col.label] = realShp; break;
        case 'cogs': rowObj[col.label] = totalCogs; break;
        case 'extraCost': rowObj[col.label] = extCost; break;
        case 'returnCost': rowObj[col.label] = returnCostToUse; break;
        case 'netProfit': rowObj[col.label] = netProfit; break;
        case 'confirmedBy': rowObj[col.label] = o.confirmedBy || ''; break;
        case 'notes': rowObj[col.label] = o.notes || ''; break;
      }
    });

    return rowObj;
  });

  // Summary Row
  const summaryObj: Record<string, any> = {};
  activeCols.forEach((col, cIdx) => {
    if (cIdx === 0) {
      summaryObj[col.label] = 'المجموع الكلي';
    } else if (col.id === 'orderId') {
      summaryObj[col.label] = `${orders.length} طلبية`;
    } else if (col.id === 'quantity') {
      summaryObj[col.label] = sumQty;
    } else if (col.id === 'revenue') {
      summaryObj[col.label] = sumRev;
    } else if (col.id === 'customerShipping') {
      summaryObj[col.label] = sumCustShp;
    } else if (col.id === 'realShipping') {
      summaryObj[col.label] = sumRealShp;
    } else if (col.id === 'cogs') {
      summaryObj[col.label] = sumCogs;
    } else if (col.id === 'extraCost') {
      summaryObj[col.label] = sumExtCost;
    } else if (col.id === 'returnCost') {
      summaryObj[col.label] = sumReturnCost;
    } else if (col.id === 'netProfit') {
      summaryObj[col.label] = sumNetProfit;
    } else if (col.id === 'notes' && filterLabel) {
      summaryObj[col.label] = `الفلترة: ${filterLabel}`;
    } else {
      summaryObj[col.label] = '';
    }
  });

  const finalRows = [...rows, summaryObj];
  const worksheet = XLSX.utils.json_to_sheet(finalRows);
  worksheet['!cols'] = activeCols.map(c => ({ wch: c.width || 16 }));
  worksheet['!views'] = [{ rightToLeft: true }];

  return worksheet;
}

/**
 * Builds rows for the Grouped / Aggregated sheet by Product & Variation/Model
 */
function buildGroupedModelsData(
  orders: any[],
  options: ExportFinanceOrdersOptions
) {
  const {
    inventoryProducts = [],
    settings = {},
    mapStatusFn,
    getOrderCostsFn,
    getEffectiveShippingCostFn
  } = options;

  const getCosts = getOrderCostsFn || ((o) => defaultGetOrderCosts(o, inventoryProducts, settings));
  const getShipping = getEffectiveShippingCostFn || defaultGetEffectiveShipping;
  const defaultReturnCost = Number(settings?.returnCost) || 400;
  const isMonthlySub = settings?.returnCostMode === 'monthly_subscription';

  interface GroupAgg {
    productName: string;
    variation: string;
    sku: string;
    totalOrders: number;
    deliveredOrders: number;
    returnedOrders: number;
    pendingOrders: number;
    totalQty: number;
    deliveredQty: number;
    returnedQty: number;
    totalRev: number;
    totalRealShp: number;
    totalCogs: number;
    totalExtCost: number;
    totalReturnCost: number;
    netProfit: number;
  }

  const groupMap = new Map<string, GroupAgg>();

  orders.forEach(o => {
    const prod = (o.productName || 'منتج غير محدد').trim();
    const vari = (o.variation || 'افتراضي / عام').trim();
    const key = `${prod}_____${vari}`;

    let agg = groupMap.get(key);
    if (!agg) {
      agg = {
        productName: prod,
        variation: vari,
        sku: o.sku || '',
        totalOrders: 0,
        deliveredOrders: 0,
        returnedOrders: 0,
        pendingOrders: 0,
        totalQty: 0,
        deliveredQty: 0,
        returnedQty: 0,
        totalRev: 0,
        totalRealShp: 0,
        totalCogs: 0,
        totalExtCost: 0,
        totalReturnCost: 0,
        netProfit: 0
      };
      groupMap.set(key, agg);
    }

    const { totalCogs, extCost } = getCosts(o);
    const rev = Number(o.totalCharge) || 0;
    const realShp = getShipping(o);
    const qty = Number(o.qnts) || 1;

    let realStatus = o.status2 || '';
    if (mapStatusFn) {
      realStatus = (o.isExchangedReturn ? 'مستلم' : mapStatusFn(o.status2 || '', o));
    } else {
      realStatus = o.isExchangedReturn ? 'مستلم' : (o.status2 || 'تم الشحن');
    }

    const isDelivered = realStatus === 'مستلم';
    const isReturned = realStatus === 'مرتجع';
    const returnCostToUse = isReturned ? (isMonthlySub ? 0 : (o.customReturnCost !== undefined ? Number(o.customReturnCost) : defaultReturnCost)) : 0;

    let netProfit = 0;
    if (isDelivered) {
      netProfit = rev - realShp - totalCogs - extCost;
      agg.deliveredOrders++;
      agg.deliveredQty += qty;
      agg.totalRev += rev;
      agg.totalCogs += totalCogs;
      agg.totalRealShp += realShp;
      agg.totalExtCost += extCost;
      agg.netProfit += netProfit;
    } else if (isReturned) {
      netProfit = isMonthlySub ? 0 : (-returnCostToUse - extCost);
      agg.returnedOrders++;
      agg.returnedQty += qty;
      agg.totalRealShp += realShp;
      agg.totalReturnCost += returnCostToUse;
      agg.totalExtCost += extCost;
      agg.netProfit += netProfit;
    } else {
      netProfit = rev - realShp - totalCogs - extCost;
      agg.pendingOrders++;
      agg.totalRealShp += realShp;
      agg.totalCogs += totalCogs;
      agg.totalExtCost += extCost;
      agg.netProfit += netProfit;
    }

    agg.totalOrders++;
    agg.totalQty += qty;
    if (!agg.sku && o.sku) agg.sku = o.sku;
  });

  const sortedGroups = Array.from(groupMap.values()).sort((a, b) => {
    if (b.deliveredOrders !== a.deliveredOrders) return b.deliveredOrders - a.deliveredOrders;
    return b.totalOrders - a.totalOrders;
  });

  let grandTotalOrders = 0;
  let grandDeliveredOrders = 0;
  let grandReturnedOrders = 0;
  let grandPendingOrders = 0;
  let grandTotalQty = 0;
  let grandDeliveredQty = 0;
  let grandRev = 0;
  let grandCogs = 0;
  let grandRealShp = 0;
  let grandReturnCost = 0;
  let grandNetProfit = 0;

  const rows = sortedGroups.map((g, idx) => {
    grandTotalOrders += g.totalOrders;
    grandDeliveredOrders += g.deliveredOrders;
    grandReturnedOrders += g.returnedOrders;
    grandPendingOrders += g.pendingOrders;
    grandTotalQty += g.totalQty;
    grandDeliveredQty += g.deliveredQty;
    grandRev += g.totalRev;
    grandCogs += g.totalCogs;
    grandRealShp += g.totalRealShp;
    grandReturnCost += g.totalReturnCost;
    grandNetProfit += g.netProfit;

    const deliveryRate = g.totalOrders > 0 ? (g.deliveredOrders / g.totalOrders) * 100 : 0;
    const returnRate = g.totalOrders > 0 ? (g.returnedOrders / g.totalOrders) * 100 : 0;
    const avgProfitPerDelivered = g.deliveredOrders > 0 ? Math.round(g.netProfit / g.deliveredOrders) : 0;

    return {
      'الرقم': idx + 1,
      'اسم المنتج': g.productName,
      'النوع / الموديل': g.variation,
      'رمز المنتج (SKU)': g.sku || '-',
      'إجمالي الطلبيات': g.totalOrders,
      'الطلبيات المستلمة': g.deliveredOrders,
      'نسبة التوصيل (%)': `${deliveryRate.toFixed(1)}%`,
      'الطلبيات المرتجعة': g.returnedOrders,
      'نسبة الروتور (%)': `${returnRate.toFixed(1)}%`,
      'قيد الشحن / معلقة': g.pendingOrders,
      'الكمية المستلمة': g.deliveredQty,
      'إجمالي الكميات': g.totalQty,
      'المداخيل المحصلة (د.ج)': g.totalRev,
      'تكلفة البضاعة (د.ج)': g.totalCogs,
      'مصاريف الشحن (د.ج)': g.totalRealShp,
      'تكاليف المرتجع (د.ج)': g.totalReturnCost,
      'صافي الأرباح (د.ج)': g.netProfit,
      'متوسط الربح للطلبية المستلمة (د.ج)': avgProfitPerDelivered
    };
  });

  const grandDeliveryRate = grandTotalOrders > 0 ? (grandDeliveredOrders / grandTotalOrders) * 100 : 0;
  const grandReturnRate = grandTotalOrders > 0 ? (grandReturnedOrders / grandTotalOrders) * 100 : 0;
  const grandAvgProfit = grandDeliveredOrders > 0 ? Math.round(grandNetProfit / grandDeliveredOrders) : 0;

  const summaryRow = {
    'الرقم': 'المجموع الكلي',
    'اسم المنتج': `${sortedGroups.length} منتج وموديل`,
    'النوع / الموديل': '',
    'رمز المنتج (SKU)': '',
    'إجمالي الطلبيات': grandTotalOrders,
    'الطلبيات المستلمة': grandDeliveredOrders,
    'نسبة التوصيل (%)': `${grandDeliveryRate.toFixed(1)}%`,
    'الطلبيات المرتجعة': grandReturnedOrders,
    'نسبة الروتور (%)': `${grandReturnRate.toFixed(1)}%`,
    'قيد الشحن / معلقة': grandPendingOrders,
    'الكمية المستلمة': grandDeliveredQty,
    'إجمالي الكميات': grandTotalQty,
    'المداخيل المحصلة (د.ج)': grandRev,
    'تكلفة البضاعة (د.ج)': grandCogs,
    'مصاريف الشحن (د.ج)': grandRealShp,
    'تكاليف المرتجع (د.ج)': grandReturnCost,
    'صافي الأرباح (د.ج)': grandNetProfit,
    'متوسط الربح للطلبية المستلمة (د.ج)': grandAvgProfit
  };

  const finalRows = [...rows, summaryRow];
  const worksheet = XLSX.utils.json_to_sheet(finalRows);

  worksheet['!cols'] = [
    { wch: 8 },  // الرقم
    { wch: 28 }, // اسم المنتج
    { wch: 22 }, // النوع / الموديل
    { wch: 16 }, // SKU
    { wch: 14 }, // إجمالي الطلبيات
    { wch: 15 }, // الطلبيات المستلمة
    { wch: 15 }, // نسبة التوصيل
    { wch: 15 }, // الطلبيات المرتجعة
    { wch: 15 }, // نسبة الروتور
    { wch: 15 }, // قيد الشحن
    { wch: 15 }, // الكمية المستلمة
    { wch: 14 }, // إجمالي الكميات
    { wch: 18 }, // المداخيل
    { wch: 18 }, // تكلفة البضاعة
    { wch: 18 }, // مصاريف الشحن
    { wch: 16 }, // تكاليف المرتجع
    { wch: 20 }, // صافي الأرباح
    { wch: 24 }  // متوسط الربح للطلبية المستلمة
  ];
  worksheet['!views'] = [{ rightToLeft: true }];

  return worksheet;
}

/**
 * Advanced Excel Exporter supporting Multi-Filters, Column selection, and Grouped/Model exports
 */
export function exportAdvancedFinanceExcel(options: AdvancedExportOptions) {
  const {
    orders,
    exportMode = 'detailed',
    selectedColumnIds = ALL_FINANCE_EXPORT_COLUMNS.filter(c => c.defaultSelected).map(c => c.id),
    fileNamePrefix = 'تقرير_المالية_المتقدم'
  } = options;

  if (!orders || orders.length === 0) {
    throw new Error('لا توجد أي طلبيات مطابقة للفلاتر المحددة لتصديرها');
  }

  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] };

  if (exportMode === 'detailed' || exportMode === 'both') {
    const detailedSheet = buildDetailedOrdersData(orders, selectedColumnIds, options);
    XLSX.utils.book_append_sheet(workbook, detailedSheet, 'الطلبيات التفصيلية');
  }

  if (exportMode === 'grouped' || exportMode === 'both') {
    const groupedSheet = buildGroupedModelsData(orders, options);
    XLSX.utils.book_append_sheet(workbook, groupedSheet, 'تجميع الموديلات والأنواع');
  }

  const dateStamp = format(new Date(), 'yyyy-MM-dd_HHmm');
  const safePrefix = fileNamePrefix.replace(/[/\\?%*:|"<>]/g, '_');
  const fullFileName = `${safePrefix}_${dateStamp}.xlsx`;

  XLSX.writeFile(workbook, fullFileName);
  return { fileName: fullFileName, count: orders.length };
}

/**
 * Legacy wrapper for backward compatibility
 */
export function exportFinanceOrdersToExcel(options: ExportFinanceOrdersOptions) {
  return exportAdvancedFinanceExcel({
    ...options,
    exportMode: 'detailed'
  });
}
