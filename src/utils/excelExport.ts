import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { getOrderUnitAndTotalCost } from './productCostUtils';
import { getEffectiveShippingCost } from './shippingFees';

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
}

/**
 * Calculates COGS for an order if getOrderCostsFn is not provided
 */
const defaultGetOrderCosts = (o: any, inventoryProducts: any[] = [], settings?: any) => {
  const costInfo = getOrderUnitAndTotalCost(o, inventoryProducts, settings);
  const extCost = Number(o.customAdditionalCost) || 0;
  return { totalCogs: costInfo.totalCogs, extCost };
};

const defaultGetEffectiveShipping = (o: any) => {
  return getEffectiveShippingCost(o);
};

/**
 * Export financial orders to an Excel (.xlsx) file
 */
export function exportFinanceOrdersToExcel({
  orders,
  inventoryProducts = [],
  settings = {},
  filterLabel = '',
  fileNamePrefix = 'طلبيات_المحاسبة_والمالية',
  mapStatusFn,
  getOrderCostsFn,
  getEffectiveShippingCostFn,
  getDeliveryDateFn
}: ExportFinanceOrdersOptions) {
  if (!orders || orders.length === 0) {
    throw new Error('لا توجد طلبيات للتصدير');
  }

  const getCosts = getOrderCostsFn || ((o) => defaultGetOrderCosts(o, inventoryProducts));
  const getShipping = getEffectiveShippingCostFn || defaultGetEffectiveShipping;
  const defaultReturnCost = Number(settings?.returnCost) || 400;

  let totalQtySum = 0;
  let totalRevenueSum = 0;
  let totalCustomerShipSum = 0;
  let totalRealShipSum = 0;
  let totalCogsSum = 0;
  let totalExtCostSum = 0;
  let totalReturnCostSum = 0;
  let totalNetProfitSum = 0;

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
    const isMonthlySub = settings?.returnCostMode === 'monthly_subscription';
    const returnCostToUse = isReturned ? (isMonthlySub ? 0 : (o.customReturnCost !== undefined ? Number(o.customReturnCost) : defaultReturnCost)) : 0;

    let netProfit = 0;
    let profitType = 'معلقة (متوقعة)';

    if (isDelivered) {
      profitType = 'مستلمة (حقيقية)';
      netProfit = rev - realShp - totalCogs - extCost;
    } else if (isReturned) {
      profitType = isMonthlySub ? 'مرتجع (مشمول بالاشتراك الشهري)' : 'مرتجع (خسارة)';
      netProfit = isMonthlySub ? 0 : (-returnCostToUse - extCost);
    } else {
      profitType = 'قيد الشحن / معلقة';
      netProfit = rev - realShp - totalCogs - extCost;
    }

    // Accumulate totals
    totalQtySum += qty;
    totalRevenueSum += rev;
    totalCustomerShipSum += customerShp;
    totalRealShipSum += realShp;
    totalCogsSum += totalCogs;
    totalExtCostSum += extCost;
    totalReturnCostSum += returnCostToUse;
    totalNetProfitSum += netProfit;

    // Format Dates
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

    return {
      'الرقم': idx + 1,
      'رقم الطلبية': o.orderId || '',
      'رقم التتبع': o.shippingTrackingId || 'بدون تتبع',
      'اسم الزبون': o.fullName || '',
      'رقم الهاتف': o.phone ? String(o.phone) : '',
      'الولاية': o.wilaya || '',
      'البلدية': o.commune || '',
      'المنتج': o.productName || '',
      'النوع / التفرع': o.variation || '',
      'رمز المنتج (SKU)': o.sku || '',
      'الكمية': qty,
      'شركة التوصيل': o.deliveryCompany || '',
      'الحالة 1 (التأكيد)': o.status1 || '',
      'الحالة 2 (التوصيل)': realStatus,
      'نوع الربحية': profitType,
      'سعر البيع (د.ج)': rev,
      'شحن الزبون (د.ج)': customerShp,
      'شحن الشركة الحقيقي (د.ج)': realShp,
      'تكلفة البضاعة (د.ج)': totalCogs,
      'تكاليف إضافية (د.ج)': extCost,
      'تكلفة المرتجع (د.ج)': returnCostToUse,
      'الفائدة الصافية (د.ج)': netProfit,
      'تاريخ الطلبية': orderDateFormatted,
      'تاريخ التوصيل / المعالجة': deliveryDateFormatted,
      'المؤكد (المسؤول)': o.confirmedBy || '',
      'ملاحظات': o.notes || ''
    };
  });

  // Summary Row
  const summaryRow = {
    'الرقم': 'المجموع الكلي',
    'رقم الطلبية': `${orders.length} طلبية`,
    'رقم التتبع': '',
    'اسم الزبون': '',
    'رقم الهاتف': '',
    'الولاية': '',
    'البلدية': '',
    'المنتج': '',
    'النوع / التفرع': '',
    'رمز المنتج (SKU)': '',
    'الكمية': totalQtySum,
    'شركة التوصيل': '',
    'الحالة 1 (التأكيد)': '',
    'الحالة 2 (التوصيل)': '',
    'نوع الربحية': '',
    'سعر البيع (د.ج)': totalRevenueSum,
    'شحن الزبون (د.ج)': totalCustomerShipSum,
    'شحن الشركة الحقيقي (د.ج)': totalRealShipSum,
    'تكلفة البضاعة (د.ج)': totalCogsSum,
    'تكاليف إضافية (د.ج)': totalExtCostSum,
    'تكلفة المرتجع (د.ج)': totalReturnCostSum,
    'الفائدة الصافية (د.ج)': totalNetProfitSum,
    'تاريخ الطلبية': '',
    'تاريخ التوصيل / المعالجة': '',
    'المؤكد (المسؤول)': '',
    'ملاحظات': filterLabel ? `الفلترة: ${filterLabel}` : ''
  };

  const finalData = [...rows, summaryRow];

  // Convert to Sheet
  const worksheet = XLSX.utils.json_to_sheet(finalData);

  // Set column widths (characters count)
  worksheet['!cols'] = [
    { wch: 8 },  // الرقم
    { wch: 14 }, // رقم الطلبية
    { wch: 18 }, // رقم التتبع
    { wch: 22 }, // اسم الزبون
    { wch: 14 }, // رقم الهاتف
    { wch: 14 }, // الولاية
    { wch: 14 }, // البلدية
    { wch: 24 }, // المنتج
    { wch: 18 }, // النوع / التفرع
    { wch: 16 }, // رمز المنتج (SKU)
    { wch: 8 },  // الكمية
    { wch: 16 }, // شركة التوصيل
    { wch: 14 }, // الحالة 1
    { wch: 16 }, // الحالة 2
    { wch: 18 }, // نوع الربحية
    { wch: 16 }, // سعر البيع
    { wch: 16 }, // شحن الزبون
    { wch: 20 }, // شحن الشركة الحقيقي
    { wch: 18 }, // تكلفة البضاعة
    { wch: 16 }, // تكاليف إضافية
    { wch: 16 }, // تكلفة المرتجع
    { wch: 18 }, // الفائدة الصافية
    { wch: 18 }, // تاريخ الطلبية
    { wch: 20 }, // تاريخ التوصيل
    { wch: 16 }, // المؤكد
    { wch: 26 }  // ملاحظات
  ];

  // Set RTL direction on worksheet views if supported
  if (!worksheet['!views']) {
    worksheet['!views'] = [{ rightToLeft: true }];
  }

  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(workbook, worksheet, 'الطلبيات المحاسبية');

  const dateStamp = format(new Date(), 'yyyy-MM-dd_HHmm');
  const safePrefix = fileNamePrefix.replace(/[/\\?%*:|"<>]/g, '_');
  const fullFileName = `${safePrefix}_${dateStamp}.xlsx`;

  XLSX.writeFile(workbook, fullFileName);
  return { fileName: fullFileName, count: orders.length };
}
