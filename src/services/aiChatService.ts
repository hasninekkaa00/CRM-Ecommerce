import { useStore } from '../store';
import { AiChatMessage, AiProposedOperation, Order, AiSourceCitation } from '../types';

export interface AiChatResponse {
  reply: string;
  matchingOrderIds?: string[];
  matchingProductIds?: string[];
  suggestedActions?: string[];
  proposedOperation?: AiProposedOperation;
  dataInsights?: Array<{ label: string; value: string; type?: 'info' | 'success' | 'warning' | 'danger' }>;
  sources?: AiSourceCitation[];
}

export async function sendAiChatMessage(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  selectedOrderIds: string[] = []
): Promise<AiChatResponse> {
  const store = useStore.getState();

  // 1. Core database collections from store
  const orders = store.orders || [];
  const inventoryProducts = store.inventoryProducts || [];
  const inventoryMovements = store.inventoryMovements || [];
  const abandonedOrders = store.abandonedOrders || [];
  const campaigns = store.campaigns || [];
  const campaignRecords = store.campaignRecords || [];
  const partners = store.partners || [];
  const partnerTransactions = store.partnerTransactions || [];
  const expenses = store.expenses || [];
  const users = store.users || [];
  const salesChannels = store.salesChannels || [];
  const settings = store.settings;
  const shippingIntegrations = settings?.shippingIntegrations || [];
  const confirmers = settings?.confirmers || [];

  // 2. Analytical summaries & cross-entity metrics
  const totalOrders = orders.length;
  const status1Counts: Record<string, number> = {};
  const status2Counts: Record<string, number> = {};
  const wilayaStats: Record<string, { total: number; delivered: number; returned: number; revenue: number }> = {};
  const shippingCompanyStats: Record<string, { total: number; delivered: number; returned: number }> = {};
  const confirmerStats: Record<string, { total: number; delivered: number; returned: number }> = {};
  const productSalesMap: Record<string, { count: number; totalCharge: number; deliveredCount: number }> = {};

  let totalRevenue = 0;
  let deliveredRevenue = 0;
  let deliveredCount = 0;
  let confirmedCount = 0;
  let returnedCount = 0;
  let canceledCount = 0;
  let postponedCount = 0;

  for (const o of orders) {
    const s1 = (o.status1 || 'جديد').trim();
    status1Counts[s1] = (status1Counts[s1] || 0) + 1;

    const s2 = (o.status2 || 'غير مشحون').trim();
    status2Counts[s2] = (status2Counts[s2] || 0) + 1;

    const charge = Number(o.totalCharge) || 0;
    totalRevenue += charge;

    if (s1 === 'مؤكد') confirmedCount++;
    if (s1 === 'ملغى' || s1 === 'ملغي') canceledCount++;
    if (s1 === 'مؤجل') postponedCount++;

    const isDelivered = s2 === 'مستلم' || s2 === 'تم التوصيل' || s2 === 'livré' || s2 === 'livre';
    const isReturned = s2 === 'مرتجع' || s2 === 'retour';

    if (isDelivered) {
      deliveredRevenue += charge;
      deliveredCount++;
    }
    if (isReturned) {
      returnedCount++;
    }

    // Wilaya aggregation
    const region = (o.region || o.city || 'غير محدد').trim();
    if (!wilayaStats[region]) {
      wilayaStats[region] = { total: 0, delivered: 0, returned: 0, revenue: 0 };
    }
    wilayaStats[region].total++;
    wilayaStats[region].revenue += charge;
    if (isDelivered) wilayaStats[region].delivered++;
    if (isReturned) wilayaStats[region].returned++;

    // Shipping company aggregation
    const comp = (o.deliveryCompany || 'غير محددة').trim();
    if (!shippingCompanyStats[comp]) {
      shippingCompanyStats[comp] = { total: 0, delivered: 0, returned: 0 };
    }
    shippingCompanyStats[comp].total++;
    if (isDelivered) shippingCompanyStats[comp].delivered++;
    if (isReturned) shippingCompanyStats[comp].returned++;

    // Confirmer aggregation
    const conf = (o.confirmedBy || o.assignedToName || 'غير معين').trim();
    if (!confirmerStats[conf]) {
      confirmerStats[conf] = { total: 0, delivered: 0, returned: 0 };
    }
    confirmerStats[conf].total++;
    if (isDelivered) confirmerStats[conf].delivered++;
    if (isReturned) confirmerStats[conf].returned++;

    // Product frequency
    const pName = (o.productName || 'منتج غير مسمى').trim();
    if (!productSalesMap[pName]) {
      productSalesMap[pName] = { count: 0, totalCharge: 0, deliveredCount: 0 };
    }
    productSalesMap[pName].count += (Number(o.qnts) || 1);
    productSalesMap[pName].totalCharge += charge;
    if (isDelivered) productSalesMap[pName].deliveredCount += (Number(o.qnts) || 1);
  }

  const deliveryRatePct = totalOrders > 0 ? `${((deliveredCount / totalOrders) * 100).toFixed(1)}%` : '0%';
  const confirmationRatePct = totalOrders > 0 ? `${((confirmedCount / totalOrders) * 100).toFixed(1)}%` : '0%';
  const returnRatePct = totalOrders > 0 ? `${((returnedCount / totalOrders) * 100).toFixed(1)}%` : '0%';

  // 3. Inventory analysis
  const lowThreshold = settings?.lowInventoryThreshold || 5;
  const lowStockProducts = inventoryProducts.filter(p => {
    const q = p.local_stock_quantity;
    return q !== null && q !== undefined && q > 0 && q <= lowThreshold;
  });
  const outOfStockProducts = inventoryProducts.filter(p => {
    const q = p.local_stock_quantity;
    return q !== null && q !== undefined && q <= 0;
  });

  // 4. Abandoned Carts analysis
  const abandonedCount = abandonedOrders.length;
  const abandonedUncontacted = abandonedOrders.filter(a => !a.status || a.status === 'لم يتم التواصل' || a.status === 'جديد').length;
  const abandonedRecovered = abandonedOrders.filter(a => a.status === 'مسترجع' || a.status === 'تم التحويل').length;
  const abandonedPotentialRevenue = abandonedOrders.reduce((sum, a) => sum + (Number(a.totalCharge) || Number(a.priceWithoutDelivery) || 0), 0);

  // 5. Campaigns & Ad Spend analysis
  const totalAdSpend = campaignRecords.reduce((sum, r) => sum + (Number(r.spend) || 0), 0);
  const totalCampaignSales = campaignRecords.reduce((sum, r) => sum + (Number((r as any).sales || r.dynamicFields?.sales) || 0), 0);
  const totalCampaignProfit = campaignRecords.reduce((sum, r) => sum + (Number((r as any).profit || r.dynamicFields?.profit) || 0), 0);

  // 6. Expenses & Partners analysis
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const partnerContributions = partnerTransactions.filter(t => t.type === 'contribution').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const partnerWithdrawals = partnerTransactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // 7. Database Sources Manifest
  const dbSourcesManifest: AiSourceCitation[] = [
    { collection: 'orders', name: 'قاعدة بيانات الطلبيات', count: orders.length, description: 'سجل الطلبيات والزبائن والشحن' },
    { collection: 'inventoryProducts', name: 'كتالوج المخزون والمنتجات', count: inventoryProducts.length, description: 'الكميات المتوفرة وأسعار الشراء والبيع' },
    { collection: 'abandonedOrders', name: 'السلات المتروكة', count: abandonedOrders.length, description: 'محاولات الشراء غير المكتملة' },
    { collection: 'campaignRecords', name: 'سجلات الحملات الإعلانية', count: campaignRecords.length, description: 'مصاريف الإعلانات ومبيعات الحملات' },
    { collection: 'partnerTransactions', name: 'حركات الشركاء والمالية', count: partnerTransactions.length, description: 'المساهمات والمسحوبات والمصاريف' },
    { collection: 'expenses', name: 'جدول المصاريف العامة', count: expenses.length, description: 'المصاريف التشغيلية والإدارية' },
    { collection: 'users', name: 'المستخدمين وفريق التأكيد', count: users.length, description: 'المشرفين ومسؤولي التأكيد' },
    { collection: 'settings', name: 'إعدادات النظام والربط', count: 1, description: 'شركات الشحن والاشتراكات والأسعار' }
  ];

  // 8. Prepare comprehensive context payload
  const contextPayload = {
    dbSourcesManifest,
    stats: {
      totalOrders,
      status1Counts,
      status2Counts,
      totalRevenue,
      deliveredRevenue,
      deliveredCount,
      confirmedCount,
      returnedCount,
      canceledCount,
      postponedCount,
      deliveryRatePct,
      confirmationRatePct,
      returnRatePct,
      wilayaStatsTop: Object.entries(wilayaStats)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 12)
        .map(([wilaya, data]) => ({
          wilaya,
          total: data.total,
          delivered: data.delivered,
          returned: data.returned,
          deliveryRate: data.total > 0 ? `${((data.delivered / data.total) * 100).toFixed(0)}%` : '0%'
        })),
      shippingCompanyStats,
      confirmerStats,
      topSoldProducts: Object.entries(productSalesMap)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 8)
        .map(([product, data]) => ({
          product,
          unitsSold: data.count,
          totalCharge: data.totalCharge,
          deliveredUnits: data.deliveredCount
        })),
      returnCostMode: settings?.returnCostMode || 'per_order',
      returnMonthlySubscription: settings?.returnMonthlySubscription || 0,
      activeShippingCompanies: shippingIntegrations.filter(s => s.isActive).map(s => s.name || s.vendor),
      confirmersCount: confirmers.length
    },
    inventory: {
      totalProducts: inventoryProducts.length,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      lowStockItems: lowStockProducts.slice(0, 15).map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku || '',
        stock: p.local_stock_quantity,
        price: p.sale_price || p.price
      })),
      outOfStockItems: outOfStockProducts.slice(0, 10).map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku || '',
        price: p.sale_price || p.price
      })),
      productsCatalogSample: inventoryProducts.slice(0, 30).map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku || '',
        stock: p.local_stock_quantity,
        price: p.sale_price || p.price,
        stock_status: p.stock_status
      })),
      recentMovements: inventoryMovements.slice(0, 8).map(m => ({
        productName: m.productName,
        type: m.typeName || m.type,
        changeQty: m.changeQty,
        newStock: m.newStock,
        date: m.date
      }))
    },
    abandonedCarts: {
      total: abandonedCount,
      uncontacted: abandonedUncontacted,
      recovered: abandonedRecovered,
      potentialRevenue: abandonedPotentialRevenue,
      sample: abandonedOrders.slice(0, 10).map(a => ({
        id: a.id,
        orderId: a.orderId,
        fullName: a.fullName,
        phone: a.phone,
        productName: a.productName,
        totalCharge: a.totalCharge || a.priceWithoutDelivery,
        status: a.status,
        region: a.region
      }))
    },
    financials: {
      totalRevenue,
      deliveredRevenue,
      totalAdSpend,
      totalCampaignProfit,
      totalExpenses,
      partnerContributions,
      partnerWithdrawals,
      partnersCount: partners.length,
      estimatedNetCashFlow: deliveredRevenue - totalAdSpend - totalExpenses
    },
    salesChannels: {
      activeChannels: salesChannels.filter(c => c.isActive).map(c => ({ name: c.name, type: c.type })),
      totalConfigured: salesChannels.length
    },
    selectedOrderIds,
    orders: orders.slice(0, 80).map(o => ({
      id: o.id,
      orderId: o.orderId,
      orderDate: o.orderDate,
      fullName: o.fullName,
      phone: o.phone,
      region: o.region,
      city: o.city,
      productName: o.productName,
      variation: o.variation || '',
      qnts: o.qnts,
      totalCharge: o.totalCharge,
      deliveryPrice: o.deliveryPrice,
      priceWithoutDelivery: o.priceWithoutDelivery,
      status1: o.status1,
      status2: o.status2,
      deliveryCompany: o.deliveryCompany,
      tag: o.tag,
      confirmedBy: o.confirmedBy,
      notes: o.notes ? String(o.notes).slice(0, 150) : '',
      postponementDate: o.postponementDate
    }))
  };

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages,
      context: contextPayload
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`خطأ في استجابة المساعد الذكي (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  if (!json.success || !json.data) {
    throw new Error(json.message || 'فشل في استلام رد الذكاء الاصطناعي');
  }

  return json.data;
}

/**
 * Executes a proposed operation on the client store & Firestore database
 */
export async function executeAiOperation(operation: AiProposedOperation): Promise<{ success: boolean; message: string }> {
  const store = useStore.getState();
  const orderIds = operation.orderIds || [];
  const params = operation.params || {};

  try {
    switch (operation.actionType) {
      case 'UPDATE_ORDER_STATUS':
      case 'BULK_UPDATE_ORDERS': {
        if (orderIds.length === 0) {
          throw new Error('لم يتم تحديد أي طلبيات للتحديث');
        }

        const updates: Partial<Order> = {};
        if (params.status1) updates.status1 = params.status1;
        if (params.status2) updates.status2 = params.status2;
        if (params.deliveryCompany) updates.deliveryCompany = params.deliveryCompany;
        if (params.tag) updates.tag = params.tag;
        if (params.notes) updates.notes = params.notes;
        if (params.postponementDate) updates.postponementDate = params.postponementDate;

        for (const id of orderIds) {
          await store.updateOrder(id, updates);
        }

        return {
          success: true,
          message: `تم تحديث ${orderIds.length} طلبية بنجاح في قاعدة البيانات!`
        };
      }

      case 'ASSIGN_TO_CONFIRMER': {
        if (orderIds.length === 0) throw new Error('لم يتم تحديد طلبيات لتعيينها');
        const confirmerId = params.confirmerId || 'confirmer_1';
        const confirmerName = params.confirmerName || params.confirmer || 'المؤكد';
        await store.assignOrders(orderIds, confirmerId, confirmerName);
        return {
          success: true,
          message: `تم تعيين ${orderIds.length} طلبية للمؤكد (${confirmerName}) بنجاح!`
        };
      }

      case 'ASSIGN_TAG': {
        if (orderIds.length === 0) throw new Error('لم يتم تحديد طلبيات لإضافة التاغ');
        const tag = params.tag || 'VIP';
        for (const id of orderIds) {
          await store.updateOrder(id, { tag });
        }
        return {
          success: true,
          message: `تم إضافة التاغ "${tag}" لـ ${orderIds.length} طلبية بنجاح!`
        };
      }

      case 'ASSIGN_SHIPPING': {
        if (orderIds.length === 0) throw new Error('لم يتم تحديد طلبيات لتعيين شركة الشحن');
        const deliveryCompany = params.deliveryCompany || 'Expedigo';
        for (const id of orderIds) {
          await store.updateOrder(id, { deliveryCompany });
        }
        return {
          success: true,
          message: `تم تعيين شركة الشحن "${deliveryCompany}" لـ ${orderIds.length} طلبية بنجاح!`
        };
      }

      case 'SEND_TO_SHIPPING': {
        if (orderIds.length === 0) throw new Error('لم يتم تحديد طلبيات للشحن');
        const deliveryCompany = params.deliveryCompany || 'Expedigo';
        for (const id of orderIds) {
          await store.updateOrder(id, { 
            deliveryCompany, 
            status2: 'قيد التجهيز' 
          });
        }
        return {
          success: true,
          message: `تم تحويل ${orderIds.length} طلبية إلى حالة الشحن وجاهزة للإرسال إلى ${deliveryCompany}!`
        };
      }

      case 'UPDATE_INVENTORY': {
        const productId = params.productId;
        const changeQty = Number(params.changeQty) || 0;
        if (!productId) throw new Error('معرف المنتج غير محدد');

        await store.recordStockAdjustment({
          productId,
          changeQty,
          typeName: params.typeName || 'تعديل آلي من المساعد الذكي',
          note: params.note || 'تم بواسطة الذكاء الاصطناعي'
        });

        return {
          success: true,
          message: `تم تعديل كمية المخزون للمنتج في قاعدة البيانات بنجاح!`
        };
      }

      case 'ADD_EXPENSE': {
        const newExpense = {
          id: `exp_${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          amount: Number(params.amount) || 0,
          description: params.description || 'مصروف مسجل بواسطة المساعد الذكي',
          category: params.category || 'عام'
        };
        await store.addExpense(newExpense);
        return {
          success: true,
          message: `تم تسجيل المصروف بقيمة ${newExpense.amount} د.ج في السجلات المالية بنجاح!`
        };
      }

      case 'UPDATE_SETTINGS': {
        await store.updateSettings(params);
        return {
          success: true,
          message: 'تم تحديث إعدادات النظام في قاعدة البيانات بنجاح!'
        };
      }

      default:
        throw new Error(`نوع العملية غير معروف: ${operation.actionType}`);
    }
  } catch (err: any) {
    console.error('Failed to execute AI operation:', err);
    throw new Error(err.message || 'فشل في تنفيذ العملية');
  }
}
