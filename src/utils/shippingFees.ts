import { fetchUniversalShippingFees } from './universalShippingApi';

export function extractWilayaCode(order: any): number {
  if (!order) return 16;
  
  // Explicit numeric wilayaId property if present
  if (order.wilayaId || order.wilaya_id || order.codeWilaya) {
    const val = Number(order.wilayaId || order.wilaya_id || order.codeWilaya);
    if (val >= 1 && val <= 58) return val;
  }

  const searchSources = [order.region, order.city, order.address].filter(Boolean) as string[];

  // 1. Look for explicit number (1-58)
  for (const src of searchSources) {
    const str = String(src).trim();
    const m = str.match(/\b([1-9]|[1-5][0-8])\b/) || str.match(/\d{1,2}/);
    if (m) {
      const val = parseInt(m[0], 10);
      if (val >= 1 && val <= 58) {
        return val;
      }
    }
  }

  // 2. Wilaya names index
  const wilayasNames = [
    "adrar", "chlef", "laghouat", "oum el bouaghi", "batna", "bejaia", "biskra", "bechar", "blida", "bouira",
    "tamanrasset", "tebessa", "tlemcen", "tiaret", "tizi ouzou", "alger", "djelfa", "jijel", "setif", "saida",
    "skikda", "sidi bel abbes", "annaba", "guelma", "constantine", "medea", "mostaganem", "msila", "mascara", "ouargla",
    "oran", "el bayadh", "illizi", "bordj bou arreridj", "boumerdes", "el tarf", "tindouf", "tissemsilt", "el oued", "khenchela",
    "souk ahras", "tipaza", "mila", "ain defla", "naama", "ain temouchent", "ghardaia", "relizane", "timimoun", "bordj badji mokhtar",
    "ouled djellal", "beni abbes", "in salah", "in guezzam", "touggourt", "djanet", "el mghair", "el meniaa",
    "أدرار", "الشلف", "الأغواط", "أم البواقي", "باتنة", "بجاية", "بسكرة", "بشار", "البليدة", "البويرة",
    "تمنراست", "تبسة", "تلمسان", "تيارت", "تيزي وزو", "الجزائر", "الجلفة", "جيجل", "سطيف", "سعيدة",
    "سكيكدة", "سيدي بلعباس", "عنابة", "قالمة", "قسنطينة", "المدية", "مستغانم", "المسيلة", "معسكر", "ورقلة",
    "وهران", "البيض", "إيليزي", "برج بوعريريج", "بومرداس", "الطارف", "تندوف", "تيسمسيلت", "الوادي", "خنشلة",
    "سوق أهراس", "تيبازة", "ميلة", "عين الدفلى", "النعامة", "عين تموشنت", "غرداية", "غليزان", "تيميمون", "برج باجي مختار",
    "أولاد جلال", "بني عباس", "عين صالح", "عين قزام", "تقرت", "جانت", "المغير", "المنيعة"
  ];

  for (const src of searchSources) {
    const r = String(src).toLowerCase();
    const idx = wilayasNames.findIndex(w => r.includes(w));
    if (idx !== -1) {
      return (idx % 58) + 1;
    }
  }

  return 16; // Default to Alger if undetectable
}

export function isStopDeskOrder(order: any): boolean {
  if (!order) return false;
  const method = String(order.shippingMethod || '').toLowerCase();
  return method.includes('مكتب') || method.includes('stop') || method.includes('bureau') || method.includes('retrait') || order.stop_desk === 1;
}

export async function fetchCompanyFeesAPI(integration: { domain?: string, token?: string }) {
  if (!integration || !integration.token) return null;
  return await fetchUniversalShippingFees(integration);
}

export function getWilayaFeeFromFeesData(feesData: any, wilayaId: number, isStopDesk: boolean): number | null {
  if (!feesData) return null;

  let list: any[] = [];
  if (Array.isArray(feesData)) {
    list = feesData;
  } else if (feesData.livraison && Array.isArray(feesData.livraison)) {
    list = feesData.livraison;
  } else if (feesData.data && feesData.data.livraison && Array.isArray(feesData.data.livraison)) {
    list = feesData.data.livraison;
  } else if (feesData.data && Array.isArray(feesData.data)) {
    list = feesData.data;
  } else if (feesData.fees && Array.isArray(feesData.fees)) {
    list = feesData.fees;
  }

  if (!list || list.length === 0) return null;

  const match = list.find((item: any) => {
    const id = Number(item.wilaya_id ?? item.code_wilaya ?? item.id ?? item.wilaya);
    return id === wilayaId;
  });

  if (!match) return null;

  let feeRaw: any = null;
  if (isStopDesk) {
    feeRaw = match.tarif_stopdesk ?? match.tarif_stop_desk ?? match.tarif_stop ?? match.tarif;
  } else {
    feeRaw = match.tarif ?? match.tarif_domicile ?? match.tarif_home;
  }

  const feeNum = Number(feeRaw);
  if (!isNaN(feeNum) && feeNum > 0) {
    return feeNum;
  }

  return null;
}

export function calculateDefaultShippingFee(wilayaId: number, isStopDesk: boolean): { realDeliveryPrice: number; suggestedCustomerDeliveryPrice: number } {
  let baseHome = 650;
  let baseDesk = 450;

  if (wilayaId === 16) {
    baseHome = 400;
    baseDesk = 300;
  } else if ([9, 35, 42].includes(wilayaId)) {
    baseHome = 500;
    baseDesk = 350;
  } else if ([2, 6, 10, 13, 15, 18, 19, 21, 23, 25, 26, 27, 29, 31, 34, 38, 41, 43, 44, 48].includes(wilayaId)) {
    baseHome = 650;
    baseDesk = 450;
  } else if ([3, 5, 7, 12, 14, 17, 20, 22, 24, 28, 39, 40, 45, 46, 47].includes(wilayaId)) {
    baseHome = 800;
    baseDesk = 550;
  } else if (wilayaId >= 1 && wilayaId <= 58) {
    baseHome = 1200;
    baseDesk = 800;
  }

  const real = isStopDesk ? baseDesk : baseHome;
  return {
    realDeliveryPrice: real,
    suggestedCustomerDeliveryPrice: real,
  };
}

/**
 * 🚚 دالة استخراج وتحديد التكلفة الحقيقية لشركة الشحن بدقة للطلبيات (المعلقة، المشحونة، والمستلمة)
 * تضمن عدم تضخيم الأرباح المتوقعة عند استخدام الشحن المجاني أو تسعير الزبون المخفض
 */
export function getEffectiveShippingCost(order: any, settings?: any, feesData?: any): number {
  if (!order) return 0;

  // 1. إذا كان سعر الشحن الأصلي الحقيقي محفوظاً ومحدداً (> 0)
  if (order.realDeliveryPrice !== undefined && order.realDeliveryPrice !== null && Number(order.realDeliveryPrice) > 0) {
    return Number(order.realDeliveryPrice);
  }

  // 2. إذا تم تحديد وضع الشحن يدوياً وتم إدخال سعر صريح
  if (order.shippingFeeMode === 'manual') {
    if (order.realDeliveryPrice !== undefined && order.realDeliveryPrice !== null) {
      return Number(order.realDeliveryPrice);
    }
    return Number(order.deliveryPrice) || 0;
  }

  // 3. للطلبيات المعلقة أو التي لم يتم مزامنتها بعد: حساب تكلفة شركة الشحن تلقائياً
  const wilayaId = extractWilayaCode(order);
  const isStopDesk = isStopDeskOrder(order);

  // إذا تم تمرير بيانات أسعار شركة الشحن
  if (feesData) {
    const feeFromApi = getWilayaFeeFromFeesData(feesData, wilayaId, isStopDesk);
    if (feeFromApi && feeFromApi > 0) {
      return feeFromApi;
    }
  }

  // استخدام جدول تسعيرة الولاية الافتراضي لشركات التوصيل
  const defaultFee = calculateDefaultShippingFee(wilayaId, isStopDesk).realDeliveryPrice;
  if (defaultFee && defaultFee > 0) {
    return defaultFee;
  }

  return Number(order.deliveryPrice) || 0;
}

/**
 * دالة لتحديد سعر الشحن الحقيقي لطلبية بناءً على شركة الشحن المربوطة أو جدول الولايات
 */
export function resolveOrderRealShippingPrice(order: any, feesData?: any): number {
  const wilayaId = extractWilayaCode(order);
  const isStopDesk = isStopDeskOrder(order);

  if (feesData) {
    const feeFromApi = getWilayaFeeFromFeesData(feesData, wilayaId, isStopDesk);
    if (feeFromApi && feeFromApi > 0) {
      return feeFromApi;
    }
  }

  const def = calculateDefaultShippingFee(wilayaId, isStopDesk);
  return def.realDeliveryPrice;
}

