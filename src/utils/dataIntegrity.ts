import { AppUser, InventoryProduct, Order, PurchaseInvoice, SalesChannel, Supplier, SystemSettings } from '../types';

export class DataIntegrityError extends Error {
  title: string;
  details: string[];
  suggestions: string[];

  constructor(message: string, options?: { title?: string; details?: string[]; suggestions?: string[] }) {
    super(message);
    this.name = 'DataIntegrityError';
    this.title = options?.title || 'عملية غير مسموحة للحفاظ على سلامة البيانات';
    this.details = options?.details || [];
    this.suggestions = options?.suggestions || [];
  }
}

export interface IntegrityCheckResult {
  canDelete: boolean;
  title: string;
  reason: string;
  details: string[];
  suggestions: string[];
  counts?: Record<string, number>;
}

/**
 * 🔒 فحص تماسك وحماية حذف المنتج من المخزن
 */
export function checkProductDeletionIntegrity(
  product: InventoryProduct | null | undefined,
  context: {
    orders: Order[];
    purchaseInvoices: PurchaseInvoice[];
    settings?: SystemSettings | null;
  }
): IntegrityCheckResult {
  if (!product) {
    return {
      canDelete: false,
      title: 'منتج غير موجود',
      reason: 'لم يتم العثور على بيانات المنتج المطلوب حذفه.',
      details: [],
      suggestions: []
    };
  }

  const pName = (product.name || '').trim().toLowerCase();
  const pSku = (product.sku || '').trim().toLowerCase();
  const varSkus = (product.variations || []).map(v => (v.sku || '').trim().toLowerCase()).filter(Boolean);

  // 1. فحص الطلبيات المرتبطة بالمنتج
  const linkedOrders = context.orders.filter(o => {
    const oProd = (o.productName || '').trim().toLowerCase();
    const oSku = (o.sku || '').trim().toLowerCase();
    
    if (pName && oProd && (oProd === pName || oProd.includes(pName) || pName.includes(oProd))) return true;
    if (pSku && oSku && oSku === pSku) return true;
    if (varSkus.length > 0 && oSku && varSkus.includes(oSku)) return true;
    if (o.items && Array.isArray(o.items)) {
      return o.items.some((item: any) => {
        const iName = (item.productName || '').trim().toLowerCase();
        const iSku = (item.sku || '').trim().toLowerCase();
        return (pName && iName === pName) || (pSku && iSku === pSku) || (varSkus.length > 0 && varSkus.includes(iSku));
      });
    }
    return false;
  });

  // 2. فحص فواتير الشراء المرتبطة
  const linkedPurchases = context.purchaseInvoices.filter(inv => {
    return (inv.items || []).some(item => {
      const iName = (item.productName || '').trim().toLowerCase();
      const iSku = (item.sku || '').trim().toLowerCase();
      return (pName && iName === pName) || (pSku && iSku === pSku) || (varSkus.length > 0 && varSkus.includes(iSku));
    });
  });

  // 3. فحص قواعد التوزيع التلقائي
  const assignmentProductRules = ((context.settings?.assignmentSettings as any)?.productRules || []).filter((r: any) => {
    return (pSku && r.sku === pSku) || (pName && r.productName === product.name);
  });

  const details: string[] = [];
  const suggestions: string[] = [];

  if (linkedOrders.length > 0) {
    details.push(`يوجد ${linkedOrders.length} طلبية مسجلة مرتبطة بهذا المنتج في النظام.`);
  }
  if (linkedPurchases.length > 0) {
    details.push(`يوجد ${linkedPurchases.length} فاتورة شراء مسجلة تحتوي على هذا المنتج.`);
  }
  if (assignmentProductRules.length > 0) {
    details.push(`المنتج مستخدم في قواعد التوزيع التلقائي للطلبيات.`);
  }

  if (details.length > 0) {
    suggestions.push('حذف هذا المنتج سيؤدي إلى كسر روابط السجلات وتقارير الأرباح والمحاسبة التاريخية.');
    suggestions.push('يمكنك تصفير كمية المخزن أو تعديل بيانات المنتج بدلاً من حذفه نهائياً.');

    return {
      canDelete: false,
      title: 'لا يمكن حذف المنتج للحفاظ على تماسك البيانات',
      reason: `لا يمكن حذف المنتج "${product.name}" نظراً لوجود سجلات ومعاملات تجارية مرتبطة به.`,
      details,
      suggestions,
      counts: {
        orders: linkedOrders.length,
        purchases: linkedPurchases.length,
        rules: assignmentProductRules.length
      }
    };
  }

  return {
    canDelete: true,
    title: 'تأكيد الحذف',
    reason: `المنتج "${product.name}" غير مرتبط بأي طلبيات أو فواتير. يمكن حذفه بأمان.`,
    details: [],
    suggestions: []
  };
}

/**
 * 🔒 فحص تماسك وحماية حذف قناة البيع / المتجر
 */
export function checkSalesChannelDeletionIntegrity(
  channel: SalesChannel | null | undefined,
  context: {
    orders: Order[];
    abandonedOrders?: any[];
    settings?: SystemSettings | null;
  }
): IntegrityCheckResult {
  if (!channel) {
    return {
      canDelete: false,
      title: 'قناة غير موجودة',
      reason: 'لم يتم العثور على بيانات القناة المطلوب حذفها.',
      details: [],
      suggestions: []
    };
  }

  const chName = (channel.name || '').trim().toLowerCase();
  const chId = String(channel.id).trim().toLowerCase();

  // فحص الطلبيات
  const linkedOrders = context.orders.filter(o => {
    const oChan = (o.sourceChannel || '').trim().toLowerCase();
    const oId = String(o.id || '').toLowerCase();
    return oChan === chName || oId.startsWith(`woo-${chId}-`) || oId.startsWith(`woo-${chName}-`);
  });

  // فحص السلات المتروكة
  const linkedAbandoned = (context.abandonedOrders || []).filter(o => {
    const oChan = (o.sourceChannel || '').trim().toLowerCase();
    const oId = String(o.id || '').toLowerCase();
    return oChan === chName || oId.startsWith(`woo-abn-${chId}-`) || oId.startsWith(`woo-abn-${chName}-`);
  });

  // فحص قواعد التوزيع
  const channelRules = ((context.settings?.assignmentSettings as any)?.channelRules || []).filter((r: any) => {
    return (r.channelId && r.channelId === channel.id) || (r.channelName && r.channelName.toLowerCase() === chName);
  });

  const details: string[] = [];
  const suggestions: string[] = [];

  if (linkedOrders.length > 0) {
    details.push(`يوجد ${linkedOrders.length} طلبية مسجلة ومستوردة من هذا المتجر.`);
  }
  if (linkedAbandoned.length > 0) {
    details.push(`يوجد ${linkedAbandoned.length} سلة متروكة مسجلة باسم هذه القناة.`);
  }
  if (channelRules.length > 0) {
    details.push(`القناة مستخدمة في قواعد التوزيع التلقائي للمؤكدين.`);
  }

  if (details.length > 0) {
    suggestions.push('قم بإلغاء تفعيل القناة (تعطيل المزامنة) بدلاً من الحذف للحفاظ على السجلات التاريخية.');
    suggestions.push('حذف المتجر سيفقد النظام القدرة على تصنيف الطلبيات وحساب أرباح القناة بدقة.');

    return {
      canDelete: false,
      title: 'لا يمكن حذف قناة البيع',
      reason: `قناة البيع "${channel.name}" تحتوي على طلبيات وسجلات تاريخية نشطة في النظام.`,
      details,
      suggestions,
      counts: {
        orders: linkedOrders.length,
        abandoned: linkedAbandoned.length,
        rules: channelRules.length
      }
    };
  }

  return {
    canDelete: true,
    title: 'تأكيد الحذف',
    reason: `قناة البيع "${channel.name}" فارغة من أي طلبيات، يمكنك حذفها بأمان.`,
    details: [],
    suggestions: []
  };
}

/**
 * 🔒 فحص تماسك وحماية حذف المستخدمين والمؤكدين
 */
export function checkUserDeletionIntegrity(
  user: AppUser | null | undefined,
  context: {
    users: AppUser[];
    currentUserProfile?: AppUser | null;
    orders: Order[];
    confirmerInvoices?: any[];
    settings?: SystemSettings | null;
  }
): IntegrityCheckResult {
  if (!user) {
    return {
      canDelete: false,
      title: 'مستخدم غير موجود',
      reason: 'لم يتم العثور على بيانات المستخدم.',
      details: [],
      suggestions: []
    };
  }

  // 1. منع حذف الحساب الحالي
  if (context.currentUserProfile && context.currentUserProfile.id === user.id) {
    return {
      canDelete: false,
      title: 'عملية محظورة',
      reason: 'لا يمكنك حذف حسابك الحالي المسجل به حالياً في لوحة التحكم.',
      details: ['أنت مسجل الدخول بهذا الحساب حالياً.'],
      suggestions: ['لتغيير الحساب، يرجى تسجيل الدخول بحساب مدير آخر ثم المتابعة.']
    };
  }

  // 2. منع حذف المدير العام الأخير
  const activeAdmins = context.users.filter(u => u.role === 'admin' && u.isActive);
  if (user.role === 'admin' && activeAdmins.length <= 1) {
    return {
      canDelete: false,
      title: 'حماية إدارية قصوى',
      reason: 'لا يمكن حذف المدير الأخير النشط في النظام لتجنب إغلاق لوحة التحكم وفقدان الوصول الإداري.',
      details: ['هذا هو الحساب الإداري الوحيد في النظام حالياً.'],
      suggestions: ['قم بترقية مستخدم آخر لرتبة "مدير عام" أولاً قبل محاولة حذف هذا الحساب.']
    };
  }

  // 3. فحص الطلبيات النشطة المسندة للمؤكد
  const activeAssignedOrders = context.orders.filter(o => {
    const isAssigned = o.assignedTo === user.id;
    const isPending = !['ملغى', 'مستلم', 'مرتجع'].includes(o.status1 || '') && !['مستلم', 'مرتجع'].includes(o.status2 || '');
    return isAssigned && isPending;
  });

  // 4. فحص الفواتير المالية للمؤكد
  const linkedInvoices = (context.confirmerInvoices || []).filter(inv => inv.confirmerId === user.id);

  const details: string[] = [];
  const suggestions: string[] = [];

  if (activeAssignedOrders.length > 0) {
    details.push(`لدى هذا المؤكد ${activeAssignedOrders.length} طلبية نشطة قيد المعالجة حالياً.`);
    suggestions.push('يرجى إعادة إسناد طلبياته النشطة لمؤكد آخر أولاً.');
  }

  if (linkedInvoices.length > 0) {
    details.push(`يوجد ${linkedInvoices.length} فاتورة عمولات ومستحقات مالية مسجلة باسم هذا المستخدم.`);
    suggestions.push('ينصح بتعطيل الحساب (إيقاف النشاط) بدلاً من حذفه للحفاظ على تاريخ العمولات والفواتير.');
  }

  if (details.length > 0) {
    return {
      canDelete: false,
      title: 'لا يمكن حذف المستخدم لوجود ارتباطات نشطة',
      reason: `المستخدم "${user.displayName}" مرتبط بطلبيات نشطة أو فواتير مالية.`,
      details,
      suggestions,
      counts: {
        activeOrders: activeAssignedOrders.length,
        invoices: linkedInvoices.length
      }
    };
  }

  return {
    canDelete: true,
    title: 'تأكيد الحذف',
    reason: `لا توجد ارتباطات حرجة للمستخدم "${user.displayName}". هل أنت متأكد من الحذف؟`,
    details: [],
    suggestions: []
  };
}

/**
 * 🔒 فحص تماسك وحماية حذف المورد
 */
export function checkSupplierDeletionIntegrity(
  supplier: Supplier | null | undefined,
  context: {
    purchaseInvoices: PurchaseInvoice[];
    supplierPayments?: any[];
  }
): IntegrityCheckResult {
  if (!supplier) {
    return {
      canDelete: false,
      title: 'مورد غير موجود',
      reason: 'لم يتم العثور على بيانات المورد.',
      details: [],
      suggestions: []
    };
  }

  const linkedInvoices = context.purchaseInvoices.filter(i => String(i.supplierId) === String(supplier.id));
  const linkedPayments = (context.supplierPayments || []).filter(p => String(p.supplierId) === String(supplier.id));

  const details: string[] = [];
  const suggestions: string[] = [];

  if (linkedInvoices.length > 0) {
    details.push(`يوجد ${linkedInvoices.length} فاتورة شراء مسجلة باسم هذا المورد.`);
  }
  if (linkedPayments.length > 0) {
    details.push(`يوجد ${linkedPayments.length} سجل دفعات مالية مسجلة لهذا المورد.`);
  }

  if (details.length > 0) {
    suggestions.push('حذف المورد سيترك فواتير الشراء بدون مورد مرجعي وسيعطل كشوفات الحساب المحاسبية.');
    suggestions.push('يمكنك تعديل بيانات المورد أو إضافة ملاحظة "غير نشط" بدلاً من الحذف.');

    return {
      canDelete: false,
      title: 'لا يمكن حذف المورد',
      reason: `المورد "${supplier.name}" مسجل لديه معاملات وفواتير مالية سابقة.`,
      details,
      suggestions,
      counts: {
        invoices: linkedInvoices.length,
        payments: linkedPayments.length
      }
    };
  }

  return {
    canDelete: true,
    title: 'تأكيد الحذف',
    reason: `المورد "${supplier.name}" ليس لديه أي معاملات مالية أو فواتير، يمكنك حذفه بأمان.`,
    details: [],
    suggestions: []
  };
}

/**
 * 🔒 فحص تماسك وحماية حذف فاتورة الشراء
 */
export function checkPurchaseInvoiceDeletionIntegrity(
  invoice: PurchaseInvoice | null | undefined,
  context?: {
    inventoryProducts?: InventoryProduct[];
    orders?: Order[];
    purchaseInvoices?: PurchaseInvoice[];
    supplierPayments?: any[];
    settings?: SystemSettings | null;
  }
): IntegrityCheckResult {
  if (!invoice) {
    return {
      canDelete: false,
      title: 'فاتورة غير موجودة',
      reason: 'لم يتم العثور على الفاتورة.',
      details: [],
      suggestions: []
    };
  }

  const paid = Number((invoice as any).paidAmount || 0);
  if (paid > 0) {
    return {
      canDelete: false,
      title: 'لا يمكن حذف الفاتورة المسددة',
      reason: `تم سداد مبلغ (${paid.toLocaleString()} د.ج) من هذه الفاتورة.`,
      details: ['حذف فاتورة مسددة جزئياً أو كلياً يؤدي لخلل في أرصدة المدفوعات والديون المحاسبية.'],
      suggestions: ['يجب حذف أو إلغاء سجلات الدفعات المرتبطة بهذه الفاتورة أولاً قبل محاولة حذفها.']
    };
  }

  return {
    canDelete: true,
    title: 'تأكيد حذف الفاتورة',
    reason: 'هل أنت متأكد من حذف هذه الفاتورة؟ (سيتم عكس تعديلات المخزون إن وجدت وتحديث كشف حساب المورد).',
    details: [],
    suggestions: []
  };
}

/**
 * 🔒 فحص تماسك وحماية حذف الطلبية
 */
export function checkOrderDeletionIntegrity(
  order: Order | null | undefined,
  context?: {
    confirmerInvoices?: any[];
    shippingInvoices?: any[];
    settings?: SystemSettings | null;
  }
): IntegrityCheckResult {
  if (!order) {
    return {
      canDelete: false,
      title: 'طلبية غير موجودة',
      reason: 'لم يتم العثور على الطلبية.',
      details: [],
      suggestions: []
    };
  }

  const details: string[] = [];
  const suggestions: string[] = [];

  // فحص ارتباطها بفاتورة عمولات مؤكد
  if (order.confirmerInvoiceId) {
    details.push('الطلبية مدرجة ضمن فاتورة حساب عمولات مؤكد.');
  } else if (context?.confirmerInvoices?.some(inv => inv.includedOrderIds?.includes(order.id))) {
    details.push('الطلبية مضافة في كشف حساب فاتورة مؤكد.');
  }

  // فحص ارتباطها بفاتورة شركة شحن
  if (context?.shippingInvoices?.some(inv => inv.includedOrderIds?.includes(order.id))) {
    details.push('الطلبية مسجلة في كشف حساب شركة شحن.');
  }

  if (details.length > 0) {
    suggestions.push('لحذف هذه الطلبية، يرجى فك ارتباطها من الفاتورة المالية أو حذف مسودة الفاتورة أولاً.');
    suggestions.push('يمكنك نقل الطلبية إلى سلة المهملات أو الأرشيف بدلاً من الحذف النهائي.');

    return {
      canDelete: false,
      title: 'الطلبية مرتبطة بسجلات محاسبية نشطة',
      reason: `لا يمكن الحذف المباشر للطلبية رقم #${order.orderId || order.id} لأنها مثبتة في سجلات محاسبية.`,
      details,
      suggestions
    };
  }

  return {
    canDelete: true,
    title: 'تأكيد الحذف',
    reason: `هل أنت متأكد من حذف الطلبية #${order.orderId || order.id}؟`,
    details: [],
    suggestions: []
  };
}
