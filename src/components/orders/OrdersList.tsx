import { MobileOrderCard } from './MobileOrderCard';
import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { format, parseISO, isToday, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Search, Filter, Save, User, Clock, ArrowLeft, ArrowRight, Edit2, Check, X, Plus, Trash2, Archive, ArchiveRestore, AlertTriangle, ArrowUpDown, Package, Truck, CheckCircle, XCircle, AlignJustify, List, Link, EyeOff, Eye, RefreshCw, Bell, MessageSquare, Tag, ChevronDown, ChevronUp, Layers, Maximize2, Minimize2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { TablePagination } from '../common/TablePagination';
import { safeParseDate, safeIsWithinInterval } from '../../utils/financeCalculations';

export const TAGS_OPTIONS = [
  { name: 'متروكة ناجحة', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold' },
  { name: 'طلبية مؤكدة', color: 'bg-green-100 text-green-800 border-green-300' },
  { name: 'زبون VIP', color: 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold' },
  { name: 'لا يرد - محاولة 1', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { name: 'لا يرد - محاولة 2', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { name: 'لا يرد - محاولة 3', color: 'bg-red-100 text-red-800 border-red-300' },
  { name: 'توصيل سريع', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { name: 'مشكلة في العنوان', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  { name: 'طلب خاص', color: 'bg-blue-100 text-blue-800 border-blue-300' }
];

import { AddOrderModal } from './AddOrderModal';
import { ViewOrderModal } from './ViewOrderModal';
import { ReplaceOrderModal } from './ReplaceOrderModal';
import { PickingListModal } from './PickingListModal';
import { checkProductMatch, renderProductFilterOptions } from '../../utils/productFilters';
import { ShoppingCart } from 'lucide-react';
import { formatWilaya, WILAYAS_MAP } from '../../utils/algeriaWilayas';
import ecotrackCommunes from '../../ecotrack-communes.json';
import { ShippingDeskInfo } from '../shipping/ShippingDeskInfo';
import { playActionSound } from '../../utils/audioUtils';
import { SourceChannelBadge, getOrderChannelName, CHANNEL_PRESETS } from '../../utils/channelUtils';
import { SourceChannelFilterBar } from './SourceChannelFilterBar';
import { 
  calculateDefaultShippingFee, 
  fetchCompanyFeesAPI, 
  getWilayaFeeFromFeesData, 
  extractWilayaCode, 
  isStopDeskOrder 
} from '../../utils/shippingFees';
import { createShippingOrder } from '../../utils/universalShippingApi';
import { 
  getOrderTagsHistory, 
  getLatestTag, 
  getLatestTagName, 
  addTagToOrder, 
  removeTagFromOrder, 
  formatTagTimestamp 
} from '../../utils/tagUtils';
import { checkOrderDeletionIntegrity, IntegrityCheckResult } from '../../utils/dataIntegrity';
import { IntegrityProtectionModal } from '../common/IntegrityProtectionModal';
import { resolveShippingDisplayNames, getOrderUnitAndTotalCost } from '../../utils/productCostUtils';

const ALGERIA_WILAYAS = Object.entries(WILAYAS_MAP).map(([code, name]) => ({
  code,
  id: parseInt(code, 10),
  name,
})).sort((a, b) => a.id - b.id);

const getWilayaCode = (regionStr: string | undefined | null): string => {
  if (!regionStr) return "";
  const trimmed = regionStr.trim();
  const m = trimmed.match(/\d{1,2}/);
  if (m && parseInt(m[0], 10) > 0 && parseInt(m[0], 10) <= 58) {
    const codeVal = parseInt(m[0], 10);
    return codeVal < 10 ? `0${codeVal}` : `${codeVal}`;
  }
  // Try fallback to name-based match
  const cleanLower = trimmed.toLowerCase();
  for (const [code, arabicLabel] of Object.entries(WILAYAS_MAP)) {
    const withoutNumber = arabicLabel.split(" - ")[1] || "";
    const englishName = withoutNumber.includes("(") ? withoutNumber.split("(")[1]?.replace(")", "")?.trim() : "";
    const arabicName = withoutNumber.split(" (")[0]?.trim();
    if (
      cleanLower === code ||
      cleanLower === englishName?.toLowerCase() ||
      trimmed === arabicName ||
      cleanLower.includes(englishName?.toLowerCase() || "___") ||
      trimmed.includes(arabicName || "___")
    ) {
      return code;
    }
  }
  return "";
};

const getStatus1Class = (val: string) => {
  switch (val) {
    case 'جديد': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'مؤكد': return 'bg-green-50 text-green-700 border-green-200';
    case 'ملغى': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'مؤجل': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'قيد المراجعة': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'لا يرد': return 'bg-gray-100 text-gray-700 border-gray-300';
    default: return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

const getTagClass = (val: string | undefined | null, customTags: any[] = TAGS_OPTIONS) => {
  if (!val) return 'bg-white border-gray-200 text-slate-500';
  const tagObj = customTags.find(t => t.name === val);
  return tagObj ? `${tagObj.color}` : 'bg-slate-100 text-slate-700 border-slate-300';
};

const getStatus2Class = (val: string) => {
  switch (val) {
    case 'قيد التجهيز': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'تم الشحن': return 'bg-sky-50 text-sky-700 border-sky-00';
    case 'في الطريق': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'مستلم': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'مرتجع': return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'قابلة للشحن': return 'bg-purple-50 text-purple-700 border-purple-200';
    default: return 'bg-gray-50 text-gray-600 border-gray-200';
  }
};

const getRowStyle = (val: string) => {
  switch (val) {
    case 'جديد': return 'bg-blue-50/30 hover:bg-blue-50/60 text-blue-900 border-blue-100';
    case 'مؤكد': return 'bg-green-50/40 hover:bg-green-50/70 text-green-900 border-green-100';
    case 'ملغى': return 'bg-rose-50/30 hover:bg-rose-50/60 text-rose-900 opacity-80 border-rose-100';
    case 'مؤجل': return 'bg-purple-50/30 hover:bg-purple-50/60 text-purple-900 border-purple-100';
    case 'قيد المراجعة': return 'bg-amber-50/30 hover:bg-amber-50/60 text-amber-900 border-amber-100';
    case 'لا يرد': return 'bg-gray-100/60 hover:bg-gray-100/90 text-gray-600 border-gray-200';
    default: return 'bg-white hover:bg-gray-50/80 text-gray-800 border-gray-100';
  }
};

interface StopDeskStatus {
  isStopDesk: boolean;
  isValid: boolean;
  message?: string;
  matchedCity?: any;
  availableCommunes: any[];
  defaultCommune?: string;
}

const getStopDeskStatus = (order: any): StopDeskStatus => {
  const method = String(order.shippingMethod || '').toLowerCase();
  const isStopDesk = method.includes('مكتب') || method.includes('stop') || method.includes('bureau') || method.includes('retrait');
  
  if (!isStopDesk) return { isStopDesk: false, isValid: true, availableCommunes: [] };

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

  let parsedWilaya = 0;
  const searchSources = [order.region, order.city, order.address].filter(Boolean) as string[];

  // 1. Explicit number matching
  for (const src of searchSources) {
    const str = String(src).trim();
    const m = str.match(/\b([1-9]|[1-5][0-8])\b/) || str.match(/\d{1,2}/);
    if (m) {
      const val = parseInt(m[0], 10);
      if (val >= 1 && val <= 58) {
        parsedWilaya = val;
        break;
      }
    }
  }

  // 2. String matching wilaya names
  if (!parsedWilaya) {
    for (const src of searchSources) {
      const r = String(src).toLowerCase();
      const idx = wilayasNames.findIndex(w => r.includes(w));
      if (idx !== -1) {
        parsedWilaya = (idx % 58) + 1;
        break;
      }
    }
  }

  // 3. Match against ecotrackCommunes
  if (!parsedWilaya && ecotrackCommunes && (ecotrackCommunes as any[]).length > 0) {
    for (const src of searchSources) {
      const clean = String(src).toLowerCase().trim().replace(/[^a-z0-9]/gi, '');
      if (clean.length > 2) {
        const found = (ecotrackCommunes as any[]).find((c: any) => {
          const cNom = c.nom.toLowerCase().replace(/[^a-z0-9]/gi, '');
          return cNom === clean || (cNom.length > 3 && (cNom.includes(clean) || clean.includes(cNom)));
        });
        if (found && found.wilaya_id) {
          parsedWilaya = found.wilaya_id;
          break;
        }
      }
    }
  }

  if (!parsedWilaya || parsedWilaya < 1 || parsedWilaya > 58) {
    parsedWilaya = 16; 
  }

  const wilayaCommunes = (ecotrackCommunes as any[]).filter((c: any) => c.wilaya_id === parsedWilaya);
  const availableCommunes = wilayaCommunes.filter(c => c.has_stop_desk === 1);
  
  let defaultCommune = availableCommunes.length > 0 ? availableCommunes[0].nom : undefined;
  if (parsedWilaya >= 1 && parsedWilaya <= 58) {
      const defaultCommunesMap: Record<number, string> = {
            1: "Adrar", 2: "Chlef", 3: "Laghouat", 4: "Oum El Bouaghi", 5: "Batna", 6: "Bejaia", 7: "Biskra", 8: "Bechar", 9: "Blida", 10: "Bouira",
            11: "Tamanrasset", 12: "Tebessa", 13: "Tlemcen", 14: "Tiaret", 15: "Tizi Ouzou", 16: "Alger", 17: "Djelfa", 18: "Jijel", 19: "Setif", 20: "Saida",
            21: "Skikda", 22: "Sidi Bel Abbes", 23: "Annaba", 24: "Guelma", 25: "Constantine", 26: "Medea", 27: "Mostaganem", 28: "M'Sila", 29: "Mascara", 30: "Ouargla",
            31: "Oran", 32: "El Bayadh", 33: "Illizi", 34: "Bordj Bou Arreridj", 35: "Boumerdes", 36: "El Tarf", 37: "Tindouf", 38: "Tissemsilt", 39: "El Oued", 40: "Khenchela",
            41: "Souk Ahras", 42: "Tipaza", 43: "Mila", 44: "Ain Defla", 45: "Naama", 46: "Ain Temouchent", 47: "Ghardaia", 48: "Relizane",
            49: "Timimoun", 50: "Bordj Badji Mokhtar", 51: "Ouled Djellal", 52: "Beni Abbes", 53: "In Salah", 54: "In Guezzam", 55: "Touggourt", 56: "Djanet", 57: "El M'Ghair", 58: "El Meniaa"
      };
      const chefLieuName = defaultCommunesMap[parsedWilaya] || "";
      const chefLieuMatch = wilayaCommunes.find(c => c.nom.toLowerCase().includes(chefLieuName.toLowerCase()) || chefLieuName.toLowerCase().includes(c.nom.toLowerCase()));
      if (chefLieuMatch) {
         defaultCommune = chefLieuMatch.nom;
      }
  }
  
  const communeToCheck = String(order.stopdeskCommune || order.city || '').trim();
  if (wilayaCommunes.length > 0 && communeToCheck) {
    const arabicToFrenchMap: Record<string, string> = {
      "تمنراست": "Tamanrasset", "تامنراست": "Tamanrasset", "تمنرست": "Tamanrasset", "تمنغاست": "Tamanrasset",
      "أباليسا": "Abalessa", "اباليسا": "Abalessa", "عين أمقل": "Ain Amguel", "إدلس": "Idles", "تاظروك": "Tazrouk",
      "أدرار": "Adrar", "الشلف": "Chlef", "الأغواط": "Laghouat", "أم البواقي": "Oum El Bouaghi", "باتنة": "Batna",
      "بجاية": "Bejaia", "بسكرة": "Biskra", "بشار": "Bechar", "البليدة": "Blida", "البويرة": "Bouira",
      "تبسة": "Tebessa", "تلمسان": "Tlemcen", "تيارت": "Tiaret", "تيزي وزو": "Tizi Ouzou", "الجزائر": "Alger",
      "الجلفة": "Djelfa", "جيجل": "Jijel", "سطيف": "Setif", "سعيدة": "Saida", "سكيكدة": "Skikda",
      "سيدي بلعباس": "Sidi Bel Abbes", "عنابة": "Annaba", "قالمة": "Guelma", "قسنطينة": "Constantine",
      "المدية": "Medea", "مستغانم": "Mostaganem", "المسيلة": "M'Sila", "معسكر": "Mascara", "ورقلة": "Ouargla",
      "وهران": "Oran", "البيض": "El Bayadh", "إيليزي": "Illizi", "برج بوعريريج": "Bordj Bou Arreridj",
      "بومرداس": "Boumerdes", "الطارف": "El Tarf", "تندوف": "Tindouf", "تيسمسيلت": "Tissemsilt",
      "الوادي": "El Oued", "خنشلة": "Khenchela", "سوق أهراس": "Souk Ahras", "تيبازة": "Tipaza",
      "ميلة": "Mila", "عين الدفلى": "Ain Defla", "النعامة": "Naama", "عين تموشنت": "Ain Temouchent",
      "غرداية": "Ghardaia", "غليزان": "Relizane", "تيميمون": "Timimoun", "برج باجي مختار": "Bordj Badji Mokhtar",
      "أولاد جلال": "Ouled Djellal", "بني عباس": "Beni Abbes", "عين صالح": "In Salah", "عين قزام": "In Guezzam",
      "تقرت": "Touggourt", "جانت": "Djanet", "المغير": "El M'Ghair", "المنيعة": "El Meniaa"
    };

    let matchingCity = null;

    // 1. Check Arabic dictionary
    for (const [ar, fr] of Object.entries(arabicToFrenchMap)) {
      if (communeToCheck.includes(ar) || ar.includes(communeToCheck)) {
        matchingCity = wilayaCommunes.find((c: any) => c.nom.toLowerCase().includes(fr.toLowerCase()) || fr.toLowerCase().includes(c.nom.toLowerCase()));
        if (matchingCity) break;
      }
    }

    if (!matchingCity) {
      matchingCity = wilayaCommunes.find((c: any) => c.nom.toLowerCase() === communeToCheck.toLowerCase());
    }

    const cityStr = communeToCheck.toLowerCase().replace(/[^a-z0-9]/gi, '');
    if (!matchingCity && cityStr.length > 2) {
        matchingCity = wilayaCommunes.find((c: any) => c.nom.toLowerCase().replace(/[^a-z0-9]/gi, '') === cityStr);
    }
    if (!matchingCity && cityStr.length > 2) {
        matchingCity = wilayaCommunes.find((c: any) => {
           const cleanNom = c.nom.toLowerCase().replace(/[^a-z0-9]/gi, '');
           return cleanNom.includes(cityStr) || cityStr.includes(cleanNom);
        });
    }
    
    if (matchingCity && matchingCity.has_stop_desk === 0) {
      return {
          isStopDesk: true,
          isValid: true, // Allow user to push, server will use wilaya capital stopdesk
          matchedCity: matchingCity,
          availableCommunes,
          defaultCommune,
          message: `المكتب الرئيسي بالولايات متوفر (${defaultCommune || matchingCity.nom})`
      };
    } else if (matchingCity && matchingCity.has_stop_desk === 1) {
        return {
          isStopDesk: true,
          isValid: true,
          matchedCity: matchingCity,
          availableCommunes,
          defaultCommune
        };
    } else {
         return {
          isStopDesk: true,
          isValid: true,
          availableCommunes,
          defaultCommune,
          message: `سيتم الاعتماد على مكتب الولاية الرئيسي`
      };
    }
  }
  
  return { isStopDesk: true, isValid: true, availableCommunes, defaultCommune };
};

export function OrdersList() {
  const {  orders, updateOrder, deleteOrder, deduplicateOrders, settings, inventoryProducts, salesChannels, globalProductFilter, setGlobalProductFilter , users } = useStore();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);

  // Data Integrity Protection States
  const [integrityBlockResult, setIntegrityBlockResult] = useState<IntegrityCheckResult | null>(null);
  const [showIntegrityModal, setShowIntegrityModal] = useState(false);
  const [blockedOrderForSafeAction, setBlockedOrderForSafeAction] = useState<any>(null);

  const handleInitiateDeleteOrder = (order: any) => {
    const check = checkOrderDeletionIntegrity(order, { settings });
    if (!check.canDelete) {
      setIntegrityBlockResult(check);
      setBlockedOrderForSafeAction(order);
      setShowIntegrityModal(true);
      return;
    }
    setConfirmAction({ type: 'delete', id: order.id, name: `#${order.orderId}` });
  };

  const handleSafeArchiveOrder = async () => {
    if (blockedOrderForSafeAction) {
      await updateOrder(blockedOrderForSafeAction.id, { archived: true });
      toast.success(`تمت أرشفة الطلبية #${blockedOrderForSafeAction.orderId} بنجاح كإجراء آمن لحفظ سلامة الحسابات.`);
      setBlockedOrderForSafeAction(null);
    }
  };

  const duplicateOrdersCount = React.useMemo(() => {
    const seen = new Set<string>();
    let count = 0;
    for (let i = 0; i < orders.length; i++) {
      const o1 = orders[i];
      if (seen.has(o1.id)) continue;
      for (let j = i + 1; j < orders.length; j++) {
        const o2 = orders[j];
        if (seen.has(o2.id)) continue;

        const id1 = String(o1.orderId || '').trim().replace(/^[#\-_]/, '');
        const id2 = String(o2.orderId || '').trim().replace(/^[#\-_]/, '');
        const phone1 = String(o1.phone || '').replace(/\D/g, '');
        const phone2 = String(o2.phone || '').replace(/\D/g, '');

        let isDup = false;
        if (o1.id === o2.id) {
          isDup = true;
        } else if (id1 && id2 && id1 === id2) {
          const chan1 = String(o1.sourceChannel || '').trim().toLowerCase();
          const chan2 = String(o2.sourceChannel || '').trim().toLowerCase();
          if (!chan1 || !chan2 || chan1 === chan2 || phone1 === phone2 || !phone1 || !phone2) {
            isDup = true;
          }
        } else if (o1.id.endsWith('-' + o2.id) || o2.id.endsWith('-' + o1.id) || (id1 && o2.id.endsWith('-' + id1)) || (id2 && o1.id.endsWith('-' + id2))) {
          isDup = true;
        } else if (phone1 && phone2 && phone1.length >= 8 && (phone1 === phone2 || phone1.endsWith(phone2) || phone2.endsWith(phone1))) {
          const p1 = (o1.productName || '').trim().toLowerCase();
          const p2 = (o2.productName || '').trim().toLowerCase();
          const tot1 = Number(o1.totalCharge || 0);
          const tot2 = Number(o2.totalCharge || 0);
          if (p1 && p2 && p1 === p2 && (tot1 === tot2 || tot1 === 0 || tot2 === 0)) {
            const d1 = o1.orderDate ? new Date(o1.orderDate).getTime() : 0;
            const d2 = o2.orderDate ? new Date(o2.orderDate).getTime() : 0;
            if (d1 && d2 && Math.abs(d1 - d2) < 24 * 60 * 60 * 1000) {
              isDup = true;
            }
          }
        }

        if (isDup) {
          seen.add(o2.id);
          count++;
        }
      }
    }
    return count;
  }, [orders]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };



  const activeTags = React.useMemo(() => {
    return settings?.tags || TAGS_OPTIONS;
  }, [settings?.tags]);

  const phoneCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      // Don't count trashed or archived orders
      if (o.phone && !o.trashed && !o.archived) {
        counts[o.phone] = (counts[o.phone] || 0) + 1;
      }
    });
    return counts;
  }, [orders]);

  const getSyncedProductInfo = React.useCallback((orderSku: string | undefined, originalName: string, originalVariation: string | undefined) => {
     if (!orderSku || !inventoryProducts) return { name: originalName, variation: originalVariation, isSynced: false };
     const skus = typeof orderSku === 'string' ? orderSku.split(',').map(s => s.trim()).filter(Boolean) : [];
     if (skus.length === 0) return { name: originalName, variation: originalVariation, isSynced: false };
     
     const targetSku = skus[0];
     let matchedName = '';
     let matchedVariation = '';
     let found = false;

     for (const p of inventoryProducts) {
        if (p.sku === targetSku) {
           matchedName = p.name;
           found = true;
           break;
        }
        if (p.variations) {
           const matchVar = p.variations.find((v: any) => v.sku === targetSku);
           if (matchVar) {
              matchedName = p.name;
              matchedVariation = matchVar.attributes?.map((a: any) => a.option).join(' - ') || '';
              found = true;
              break;
           }
        }
     }
     
     if (found) {
        return { name: matchedName, variation: matchedVariation, isSynced: true };
     }
     return { name: originalName, variation: originalVariation, isSynced: false };
  }, [inventoryProducts]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [currentTab, setCurrentTab] = useState<'active' | 'archived' | 'trash'>('active');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showPickingList, setShowPickingList] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'archive' | 'restore' | 'trash' | 'restoreTrash' | 'directDelivery' | 'bulkDelete' | 'bulkShipping', id: string, name: string } | null>(null);
  const [confirmShipping, setConfirmShipping] = useState<{ order: any, integration: any } | null>(null);
  const [manualTrackingModal, setManualTrackingModal] = useState<{ order: any } | null>(null);
  const [manualTrackingId, setManualTrackingId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>(() => (localStorage.getItem('orders_viewMode') as 'detailed' | 'compact') || 'detailed');
  const [shippingLoading, setShippingLoading] = useState<string | null>(null);
  const [viewOrderModal, setViewOrderModal] = useState<any | null>(null);
  const [focusModeOrderId, setFocusModeOrderId] = useState<string | null>(null);
  const [focusEditDraft, setFocusEditDraft] = useState<any | null>(null);

  useEffect(() => {
    if (focusModeOrderId) {
      const order = orders.find(o => o.id === focusModeOrderId);
      if (order) {
         setFocusEditDraft({ ...order });
      }
    } else {
      setFocusEditDraft(null);
    }
  }, [focusModeOrderId]);
  const [replaceOrderModal, setReplaceOrderModal] = useState<any | null>(null);
  const [reminderModalOrder, setReminderModalOrder] = useState<any | null>(null);
  const [smsModalOrder, setSmsModalOrder] = useState<any | null>(null);
  const [smsModalMessage, setSmsModalMessage] = useState('');
  const [smsModalLoading, setSmsModalLoading] = useState(false);
  const [smsModalStatus, setSmsModalStatus] = useState<{ success?: boolean; message: string } | null>(null);
  const [showDetailedStats, setShowDetailedStats] = useState(() => {
    return localStorage.getItem('orders_showDetailedStats') === 'false' ? false : false; // default to compact single-row
  });
  const [collapseAllFilters, setCollapseAllFilters] = useState(() => {
    return localStorage.getItem('orders_collapseAllFilters') === 'true';
  });
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'status1' | 'status2' | 'tags' | 'channels'>(() => {
    return (localStorage.getItem('orders_activeFilterTab') as any) || 'all';
  });
  const [showStatusCounts, setShowStatusCounts] = useState(() => {
    const saved = localStorage.getItem('orders_showStatusCounts');
    return saved === 'true';
  });
  const [showStatusFilterBar, setShowStatusFilterBar] = useState(() => {
    const saved = localStorage.getItem('orders_showStatusFilterBar');
    return saved !== 'false';
  });
  const [showStatus2FilterBar, setShowStatus2FilterBar] = useState(() => {
    const saved = localStorage.getItem('orders_showStatus2FilterBar');
    return saved !== 'false';
  });
  const [showTagFilterBar, setShowTagFilterBar] = useState(() => {
    const saved = localStorage.getItem('orders_showTagFilterBar');
    return saved !== 'false';
  });

  useEffect(() => {
    const handleFilter = (e: any) => {
      if (e.detail && e.detail.searchTerm) {
        setSearchTerm(e.detail.searchTerm);
        setStatusFilter('all');
        setHiddenStatuses([]);
        setHiddenTags([]);
        setStatus2Filter('all');
        setProductFilter('all');
        setDateFilter('all');
        setConfirmedByFilter('all');
        setDeliveryMethodFilter('all');
        setDeliveryCompanyFilter('all');
        setTagFilter('all');
        setChannelFilter('all');
        setHiddenChannels([]);
        if (e.detail.targetTab) {
          setCurrentTab(e.detail.targetTab);
        } else if (e.detail.order) {
          if (e.detail.order.trashed) setCurrentTab('trash');
          else if (e.detail.order.archived) setCurrentTab('archived');
          else setCurrentTab('active');
        }
      }
    };
    document.addEventListener('filter-orders', handleFilter);
    return () => document.removeEventListener('filter-orders', handleFilter);
  }, []);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    const saved = localStorage.getItem('orders_pageSize');
    return saved ? Number(saved) : 50;
  });

  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    localStorage.setItem('orders_pageSize', String(newSize));
    setCurrentPage(1);
  };

  useEffect(() => {
    localStorage.setItem('orders_viewMode', viewMode);
  }, [viewMode]);

  const handleOpenSmsModal = (order: any) => {
    setSmsModalOrder(order);
    setSmsModalStatus(null);
    setSmsModalLoading(false);
    
    const templates = settings?.smsTemplates || {};
    const templateKey = order.status2 === 'تم الشحن' ? 'shipping' : 
                        order.status2 === 'في الطريق' ? 'out_for_delivery' :
                        order.status2 === 'مرتجع' ? 'return' : 'confirmation';

    const rawTemplate = templates[templateKey] || (
      templateKey === 'shipping' ? 'زبوننا الكريم {customer_name}، تم شحن طلبيتك رقم {order_id} عبر شركة {delivery_company}. رقم التتبع الخاص بك هو {tracking_id}.' :
      templateKey === 'out_for_delivery' ? 'مرحباً {customer_name}، طلبيتك رقم {order_id} قيد التوصيل الآن مع المندوب. يرجى إبقاء هاتفك متاحاً لتسهيل التسليم.' :
      templateKey === 'return' ? 'زبوننا الكريم، نأسف لعدم استلام طلبيتك رقم {order_id}. تم تسجيلها كمرتجعة. يرجى التواصل معنا لإعادة المحاولة.' :
      'مرحباً {customer_name}، تم تأكيد طلبيتك رقم {order_id} بنجاح. سنقوم بشحنها قريباً! شكراً لثقتك بنا.'
    );

    const message = rawTemplate
      .replace(/{customer_name}/g, order.customerName || '')
      .replace(/{order_id}/g, order.orderId || '')
      .replace(/{tracking_id}/g, order.shippingTrackingId || '')
      .replace(/{delivery_company}/g, order.deliveryCompany || '')
      .replace(/{store_name}/g, order.sourceChannel || 'متجرنا')
      .replace(/{total}/g, `${order.totalCharge || 0}`);

    setSmsModalMessage(message);
  };

  const handleSendManualSms = async () => {
    if (!smsModalOrder || !smsModalMessage.trim()) return;
    setSmsModalLoading(true);
    setSmsModalStatus(null);

    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gateway: settings?.smsGateway || 'sms_algerie',
          to: smsModalOrder.phone || '',
          message: smsModalMessage,
          smsAlgerieToken: settings?.smsAlgerieToken || '',
          smsAlgerieSender: settings?.smsAlgerieSender || '',
          smsTwilioSid: settings?.smsTwilioSid || '',
          smsTwilioToken: settings?.smsTwilioToken || '',
          smsTwilioNumber: settings?.smsTwilioNumber || ''
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSmsModalStatus({ success: true, message: `تم إرسال الرسالة بنجاح! معرف الرسالة: ${data.messageId}` });
        const orderNotes = smsModalOrder.notes || '';
        await updateOrder(smsModalOrder.id, {
          notes: (orderNotes ? orderNotes + '\n' : '') + `[إرسال SMS يدوي]: تم إرسال رسالة نصية للزبون: "${smsModalMessage}"`
        });
        toast.success('تم إرسال الرسالة النصية وحفظها في السجل!');
      } else {
        setSmsModalStatus({ success: false, message: data.message || 'فشل إرسال الرسالة. يرجى التحقق من إعدادات البوابة.' });
      }
    } catch (err: any) {
      console.error(err);
      setSmsModalStatus({ success: false, message: `خطأ اتصال: ${err.message || err}` });
    } finally {
      setSmsModalLoading(false);
    }
  };

  const handleSaveManualTracking = async () => {
    if (!manualTrackingModal) return;
    try {
      await updateOrder(manualTrackingModal.order.id, {
        shippingTrackingId: manualTrackingId.trim() || '',
        status2: 'تم الشحن'
      });
      playActionSound('success');
      toast.success(`تم نقل الطلبية وتعيين التتبع يدوياً بنجاح!`);
      setManualTrackingModal(null);
      setManualTrackingId('');
    } catch (e) {
      playActionSound('error');
      toast.error('حدث خطأ أثناء التحديث.');
    }
  };

  const handlePushToShipping = async (order: any, integration: any) => {
    setConfirmShipping(null);
    setShippingLoading(order.id);
    
    let nextOrderId = null;
    
    // Resolve product for Shipping Alias according to user's 3-tier hierarchy:
    // 1. Variation alias if written ("الاسم المستعار المدون")
    // 2. Or general product alias + variation if variation alias is empty ("الاسم العام مع زيادة النوع")
    // 3. Or original product name + variation if both empty ("إذا تركت فارغة يتم أخذ الاسم الأصلي")
    let shippingOrder = { ...order };
    if (typeof inventoryProducts !== 'undefined' && inventoryProducts) {
       const resolved = resolveShippingDisplayNames(order, inventoryProducts);
       shippingOrder.productName = resolved.productName;
       shippingOrder.variation = resolved.variation;

       // Support variation and product aliases inside order.items array if present
       if (order.items && Array.isArray(order.items) && order.items.length > 0) {
           shippingOrder.items = order.items.map((it: any) => {
               const itResolved = resolveShippingDisplayNames(
                   { productName: it.name || it.productName, variation: it.variation || it.variationName, sku: it.sku },
                   inventoryProducts
               );
               return {
                   ...it,
                   name: itResolved.productName,
                   productName: itResolved.productName,
                   variation: itResolved.variation,
                   variationName: itResolved.variation
               };
           });
       }

       // Calculate Total Weight
       let totalWeight = 0;
       const getProductWeight = (sku: string, pName: string, vName: string) => {
           let prod = null;
           if (sku) {
               const currentSkus = String(sku).split(',').map((s: string) => s.trim().toLowerCase());
               prod = inventoryProducts.find((p: any) => 
                   (p.sku && currentSkus.includes(p.sku.toLowerCase().trim())) ||
                   (p.variations && p.variations.some((v:any) => v.sku && currentSkus.includes(v.sku.toLowerCase().trim())))
               );
               if (prod && prod.variations) {
                   const matchedVar = prod.variations.find((v:any) => v.sku && currentSkus.includes(v.sku.toLowerCase().trim()));
                   if (matchedVar && typeof matchedVar.weight !== 'undefined' && matchedVar.weight !== null) {
                       return Number(matchedVar.weight);
                   }
               }
           }
           if (!prod && pName) {
               const oName = String(pName).trim().toLowerCase();
               prod = inventoryProducts.find((p: any) => {
                   const ppName = (p.name || '').trim().toLowerCase();
                   return ppName === oName || oName.includes(ppName) || ppName.includes(oName);
               });
           }
           if (prod) {
               if (vName && prod.variations) {
                   const oVName = String(vName).trim().toLowerCase();
                   const matchedVar = prod.variations.find((v:any) => {
                       const vvName = String(v.name || v.attributes?.map((a:any)=>a.option).join(' ') || '').trim().toLowerCase();
                       return vvName === oVName || oVName.includes(vvName);
                   });
                   if (matchedVar && typeof matchedVar.weight !== 'undefined' && matchedVar.weight !== null) {
                       return Number(matchedVar.weight);
                   }
               }
               if (typeof prod.weight !== 'undefined' && prod.weight !== null) {
                   return Number(prod.weight);
               }
           }
           return 0;
       };

       if (order.items && Array.isArray(order.items) && order.items.length > 0) {
           order.items.forEach((it: any) => {
               const qty = Number(it.quantity ?? it.qnts ?? 1) || 1;
               const w = getProductWeight(it.sku, it.name || it.productName, it.variation);
               totalWeight += w * qty;
           });
       } else {
           const qty = Number(order.qnts ?? 1) || 1;
           const w = getProductWeight(order.sku, order.productName, order.variation);
           totalWeight += w * qty;
       }
       
       shippingOrder.calculatedWeight = totalWeight;
    }
    if (focusModeOrderId === order.id) {
       const currentIndex = filteredOrders.findIndex(o => o.id === order.id);
       if (currentIndex > -1 && currentIndex < filteredOrders.length - 1) {
           nextOrderId = filteredOrders[currentIndex + 1].id;
       }
    }
    try {
      const data = await createShippingOrder(shippingOrder, integration);
      
      if (!data.success) {
         let errMsg = data.message || 'حدث خطأ أثناء تمرير الطلبية لشركة الشحن.';
         if (data.details && data.details.errors) {
            const errs = Object.values(data.details.errors).flat().join(' | ');
            errMsg += ' - التفاصيل: ' + errs;
         }
         console.log("Shipping API Error Details:", data);
         playActionSound('error');
         toast.error(errMsg, { duration: 6000 });
         return;
      }

      const assignedTracking = data.tracking || (data.data && (data.data.tracking || data.data.tracking_number || data.data.id)) || `${order.id.slice(0, 10)}`;

      // Calculate cost now from inventory to "lock" it using the robust central utility
      let lockedCogs = 0;
      if (typeof inventoryProducts !== "undefined" && inventoryProducts) {
        const costInfo = getOrderUnitAndTotalCost(order, inventoryProducts, settings);
        lockedCogs = costInfo.totalCogs;
      }

      // 🚚 حساب سعر التوصيل الأصلي تلقائياً من شركة الشحن عند التمرير مباشرة
      let calculatedShippingFee: number | null = null;
      const apiTarif = (data?.data as any)?.tarif ?? (data?.data as any)?.prix_livraison ?? (data?.data as any)?.shipping_price ?? (data?.data as any)?.delivery_fee ?? (data?.data as any)?.frais_livraison ?? (data as any)?.tarif ?? (data as any)?.prix_livraison;
      
      if (apiTarif !== undefined && !isNaN(Number(apiTarif)) && Number(apiTarif) > 0) {
        calculatedShippingFee = Number(apiTarif);
      } else if (integration && integration.token) {
        try {
          const feesData = await fetchCompanyFeesAPI(integration);
          if (feesData) {
            const wilayaId = extractWilayaCode(order);
            const isStopDesk = isStopDeskOrder(order);
            calculatedShippingFee = getWilayaFeeFromFeesData(feesData, wilayaId, isStopDesk);
          }
        } catch (err) {
          console.warn('Failed to fetch shipping company fees on dispatch:', err);
        }
      }

      if (!calculatedShippingFee || calculatedShippingFee <= 0) {
        const wilayaId = extractWilayaCode(order);
        const isStopDesk = isStopDeskOrder(order);
        calculatedShippingFee = calculateDefaultShippingFee(wilayaId, isStopDesk).realDeliveryPrice;
      }

      const updates: any = {
        shippingTrackingId: assignedTracking,
        deliveryCompany: integration?.name || order.deliveryCompany || 'شركة الشحن',
        status2: 'تم الشحن'
      };

      if (calculatedShippingFee && calculatedShippingFee > 0 && order.shippingFeeMode !== 'manual') {
        updates.realDeliveryPrice = calculatedShippingFee;
        updates.shippingFeeMode = 'auto';
      }

      if (lockedCogs > 0) {
         updates.customProductCost = lockedCogs;
      }

      await updateOrder(order.id, updates);
      playActionSound('success');
      toast.success(`تم تمرير الطلبية للشحن بنجاح! رقم التتبع: ${assignedTracking} | سعر الشحن: ${calculatedShippingFee || updates.realDeliveryPrice || 'افتراضي'} د.ج`);
      if (nextOrderId) {
         setFocusModeOrderId(nextOrderId);
      }
    } catch (e) {
      playActionSound('error');
      toast.error('حدث خطأ أثناء الاتصال بالخادم.');
    } finally {
      setShippingLoading(null);
    }
  };

  // Filter States
  const [statusFilter, setStatusFilter] = useState(() => localStorage.getItem('orders_statusFilter') || 'all');
  const [hiddenStatuses, setHiddenStatuses] = useState<string[]>(() => JSON.parse(localStorage.getItem('orders_hiddenStatuses') || '[]'));
  const [hiddenStatuses2, setHiddenStatuses2] = useState<string[]>(() => JSON.parse(localStorage.getItem('orders_hiddenStatuses2') || '[]'));
  const [hiddenTags, setHiddenTags] = useState<string[]>(() => JSON.parse(localStorage.getItem('orders_hiddenTags') || '[]'));
  const [status2Filter, setStatus2Filter] = useState(() => localStorage.getItem('orders_status2Filter') || 'all');
  const [productFilter, setProductFilter] = useState(() => globalProductFilter || localStorage.getItem('orders_productFilter') || 'all');

  useEffect(() => {
    if (globalProductFilter !== undefined) {
      setProductFilter(prev => (prev === globalProductFilter ? prev : globalProductFilter));
    }
  }, [globalProductFilter]);
  const [dateFilter, setDateFilter] = useState(() => localStorage.getItem('orders_dateFilter') || 'all');
  const [confirmedByFilter, setConfirmedByFilter] = useState(() => localStorage.getItem('orders_confirmedByFilter') || 'all');
  const [deliveryMethodFilter, setDeliveryMethodFilter] = useState(() => localStorage.getItem('orders_deliveryMethodFilter') || 'all');
  const [deliveryCompanyFilter, setDeliveryCompanyFilter] = useState(() => localStorage.getItem('orders_deliveryCompanyFilter') || 'all');
  const [tagFilter, setTagFilter] = useState(() => localStorage.getItem('orders_tagFilter') || 'all');
  const [channelFilter, setChannelFilter] = useState(() => localStorage.getItem('orders_channelFilter') || 'all');
  const [hiddenChannels, setHiddenChannels] = useState<string[]>(() => JSON.parse(localStorage.getItem('orders_hiddenChannels') || '[]'));

  useEffect(() => {
    localStorage.setItem('orders_statusFilter', statusFilter);
    localStorage.setItem('orders_hiddenStatuses', JSON.stringify(hiddenStatuses));
    localStorage.setItem('orders_hiddenStatuses2', JSON.stringify(hiddenStatuses2));
    localStorage.setItem('orders_hiddenTags', JSON.stringify(hiddenTags));
    localStorage.setItem('orders_status2Filter', status2Filter);
    localStorage.setItem('orders_productFilter', productFilter);
    localStorage.setItem('orders_dateFilter', dateFilter);
    localStorage.setItem('orders_confirmedByFilter', confirmedByFilter);
    localStorage.setItem('orders_deliveryMethodFilter', deliveryMethodFilter);
    localStorage.setItem('orders_deliveryCompanyFilter', deliveryCompanyFilter);
    localStorage.setItem('orders_tagFilter', tagFilter);
    localStorage.setItem('orders_channelFilter', channelFilter);
    localStorage.setItem('orders_hiddenChannels', JSON.stringify(hiddenChannels));
  }, [statusFilter, hiddenStatuses, hiddenStatuses2, hiddenTags, status2Filter, productFilter, dateFilter, confirmedByFilter, deliveryMethodFilter, deliveryCompanyFilter, tagFilter, channelFilter, hiddenChannels]);

  // Sorting
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>({key: 'orderDate', direction: 'desc'});
  const tableScrollRef = React.useRef<HTMLDivElement>(null);

  // Flexible columns width state

  const defaultVisibleColumns = ['orderId', 'orderDate', 'fullName', 'phone', 'region', 'city', 'productName', 'qnts', 'totalCharge', 'status1', 'tag', 'tagActions', 'deliveryCompany', 'status2', 'confirmedBy', 'actions'];
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('orders_visible_columns');
    if (saved) {
      try {
        let parsed = JSON.parse(saved);
        if (!parsed.includes('deliveryCompany')) parsed.push('deliveryCompany');
        return parsed;
      } catch (e) {}
    }
    return defaultVisibleColumns;
  });
  const [showColSettings, setShowColSettings] = useState(false);

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => {
      const next = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
      localStorage.setItem('orders_visible_columns', JSON.stringify(next));
      return next;
    });
  };

  const ALL_COLUMNS = [
    { id: 'orderId', label: '#الطلب' },
    { id: 'orderDate', label: 'التاريخ' },
    { id: 'fullName', label: 'الاسم' },
    { id: 'phone', label: 'الهاتف' },
    { id: 'region', label: 'الولاية' },
    { id: 'city', label: 'البلدية' },
    { id: 'productName', label: 'المنتج' },
    { id: 'qnts', label: 'الكمية' },
    { id: 'totalCharge', label: 'السعر' },
    { id: 'status1', label: 'حالة التأكيد' },
    { id: 'tag', label: 'التاغ' },
    { id: 'tagActions', label: 'أ.التاغ' },
    { id: 'deliveryCompany', label: 'شركة التوصيل' },
    { id: 'sourceChannel', label: 'قناة البيع' },
    { id: 'status2', label: 'حالة الشحن' },
    { id: 'confirmedBy', label: 'المؤكد' },
    { id: 'actions', label: 'إجراءات' }
  ];

  const [colWidths, setColWidths] = useState<Record<string, number>>({
    
    
    orderId: 85,
    orderDate: 110,
    fullName: 140,
    phone: 115,
    region: 150,
    city: 110,
    productName: 175,
    qnts: 70,
    priceWithoutDelivery: 90,
    shippingMethod: 105,
    deliveryPrice: 90,
    totalCharge: 100,
    confirmedBy: 110,
    status1: 120,
    tag: 120,
    deliveryCompany: 110,
    postponementDate: 110,
    status2: 120,
    notes: 150,
    actions: 95
  });

  const handleMouseDown = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // In RTL dir layout, moving the mouse to the left increases the width of the column
      const deltaX = startX - moveEvent.clientX;
      const newWidth = Math.max(50, startWidth + deltaX);
      setColWidths(prev => ({
        ...prev,
        [colKey]: newWidth
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, currentTab, statusFilter, status2Filter, dateFilter, confirmedByFilter, deliveryMethodFilter, deliveryCompanyFilter, hiddenStatuses, hiddenTags, channelFilter, hiddenChannels]);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key === columnKey) {
       return <ArrowUpDown className={`w-3 h-3 ml-1 inline-block ${sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-blue-600 rotate-180'}`} />;
    }
    return <ArrowUpDown className="w-3 h-3 ml-1 inline-block text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
  };

  const productFilterOptionsJSX = React.useMemo(() => {
    return renderProductFilterOptions(inventoryProducts, orders);
  }, [orders, inventoryProducts]);


  const isSearching = !!searchTerm.trim();

  let filteredOrders = orders.filter((o) => {
    if (currentTab === 'trash') return o.trashed;
    if (currentTab === 'archived') return o.archived && !o.trashed;
    if (isSearching) {
      return !o.archived && !o.trashed;
    }
    if (status2Filter !== 'all') {
      return !o.archived && !o.trashed;
    }
    const isShipped = !!o.shippingTrackingId || ['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع', 'تم شحن', 'تم التوصيل', 'مسلمة', 'مسترجعة', 'في طريق التسليم', 'في مركز العبور', 'قابلة للشحن'].some(s => (o.status2 || '').includes(s) || (o.status1 || '').includes(s));
    return !o.archived && !o.trashed && !isShipped;
  }).filter(
    (o) => {
      if (!isSearching) return true;
      const term = searchTerm.toLowerCase().trim();
      return (
        (o.fullName || '').toLowerCase().includes(term) ||
        (o.phone || '').toLowerCase().includes(term) ||
        (String(o.orderId || '')).toLowerCase().includes(term) ||
        (o.shippingTrackingId || '').toLowerCase().includes(term) ||
        (o.id || '').toLowerCase().includes(term)
      );
    }
  );

  // Apply Advanced Filters
  if (!isSearching) {
    if (statusFilter !== 'all') {
       filteredOrders = filteredOrders.filter(o => o.status1 === statusFilter);
    }
    if (hiddenStatuses.length > 0) {
       filteredOrders = filteredOrders.filter(o => !hiddenStatuses.includes(o.status1 || ''));
    }
    if (hiddenStatuses2.length > 0) {
       filteredOrders = filteredOrders.filter(o => !hiddenStatuses2.includes(o.status2 || ''));
    }
    if (status2Filter !== 'all') {
       filteredOrders = filteredOrders.filter(o => o.status2 === status2Filter);
    }
    if (productFilter !== 'all') {
       filteredOrders = filteredOrders.filter(o => checkProductMatch(o, productFilter, inventoryProducts));
    }
    if (dateFilter !== 'all') {
       const now = new Date();
       let s: Date | null = null;
       let e: Date | null = null;
       if (dateFilter === 'today') {
         s = startOfDay(now);
         e = endOfDay(now);
       } else if (dateFilter === 'yesterday') {
         s = startOfDay(subDays(now, 1));
         e = endOfDay(subDays(now, 1));
       } else if (dateFilter === 'week') {
         s = startOfWeek(now, { weekStartsOn: 6 });
         e = endOfDay(now);
       } else if (dateFilter === 'month') {
         s = startOfMonth(now);
         e = endOfMonth(now);
       }
       if (s && e) {
         filteredOrders = filteredOrders.filter(o => {
           const d = safeParseDate(o.orderDate);
           return d && safeIsWithinInterval(d, { start: s!, end: e! });
         });
       }
    }
    if (confirmedByFilter !== 'all') {
       filteredOrders = filteredOrders.filter(o => o.confirmedBy === confirmedByFilter);
    }
    if (deliveryMethodFilter !== 'all') {
       filteredOrders = filteredOrders.filter(o => o.shippingMethod === deliveryMethodFilter);
    }
    if (deliveryCompanyFilter !== 'all') {
       filteredOrders = filteredOrders.filter(o => o.deliveryCompany === deliveryCompanyFilter);
    }
    if (tagFilter !== 'all') {
       if (tagFilter === 'none') {
          filteredOrders = filteredOrders.filter(o => !getLatestTagName(o, activeTags));
       } else {
          filteredOrders = filteredOrders.filter(o => getLatestTagName(o, activeTags) === tagFilter);
       }
    }
    if (hiddenTags.length > 0) {
       filteredOrders = filteredOrders.filter(o => !hiddenTags.includes(getLatestTagName(o, activeTags) || 'none'));
    }
    if (channelFilter !== 'all') {
       filteredOrders = filteredOrders.filter(o => getOrderChannelName(o, salesChannels) === channelFilter);
    }
    if (hiddenChannels.length > 0) {
       filteredOrders = filteredOrders.filter(o => !hiddenChannels.includes(getOrderChannelName(o, salesChannels)));
    }
  }

  // Apply Sorting
  if (sortConfig !== null) {
      filteredOrders.sort((a, b) => {
          const aValue = a[sortConfig.key as keyof typeof a];
          const bValue = b[sortConfig.key as keyof typeof b];
          
          if (aValue < bValue) {
             return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (aValue > bValue) {
             return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
      });
  }

  const statCards = React.useMemo(() => {
     const baseOrders = orders.filter(o => !o.trashed && !o.archived);
     const total = baseOrders.length;
     const confirmed = baseOrders.filter(o => o.status1 === 'مؤكد').length;
     const newOrders = baseOrders.filter(o => o.status1 === 'جديد').length;
     const delivered = baseOrders.filter(o => o.status2 === 'مستلم').length;
     const returnOrders = baseOrders.filter(o => o.status2 === 'مرتجع').length;
     const canceledOrders = baseOrders.filter(o => o.status1 === 'ملغى').length;
     return { total, confirmed, newOrders, delivered, returnOrders, canceledOrders };
  }, [orders]);

  const status1Options = Array.from(new Set(settings?.status1Options || ['جديد', 'قيد المراجعة', 'مؤكد', 'ملغى', 'مؤجل', 'لا يرد']));

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    status1Options.forEach(status => {
      counts[status] = 0;
    });
    
    orders.forEach(o => {
      let matchesTab = false;
      if (currentTab === 'trash') {
        matchesTab = !!o.trashed;
      } else if (currentTab === 'archived') {
        matchesTab = !!o.archived && !o.trashed;
      } else {
        const isShipped = !!o.shippingTrackingId || ['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع', 'تم شحن', 'تم التوصيل', 'مسلمة', 'مسترجعة', 'في طريق التسليم', 'في مركز العبور', 'قابلة للشحن'].some(s => (o.status2 || '').includes(s) || (o.status1 || '').includes(s));
        matchesTab = !o.archived && !o.trashed && !isShipped;
      }
      
      if (matchesTab && o.status1) {
        counts[o.status1] = (counts[o.status1] || 0) + 1;
      }
    });
    
    return counts;
  }, [orders, currentTab, status1Options]);

  const totalTabOrdersCount = React.useMemo(() => {
    return orders.filter(o => {
      if (currentTab === 'trash') return o.trashed;
      if (currentTab === 'archived') return o.archived && !o.trashed;
      const isShipped = !!o.shippingTrackingId || ['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع', 'تم شحن', 'تم التوصيل', 'مسلمة', 'مسترجعة', 'في طريق التسليم', 'في مركز العبور', 'قابلة للشحن'].some(s => (o.status2 || '').includes(s) || (o.status1 || '').includes(s));
      return !o.archived && !o.trashed && !isShipped;
    }).length;
  }, [orders, currentTab]);

  const tagCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    activeTags.forEach(tag => {
      counts[tag.name] = 0;
    });
    counts['none'] = 0;
    
    orders.forEach(o => {
      let matchesTab = false;
      if (currentTab === 'trash') {
        matchesTab = !!o.trashed;
      } else if (currentTab === 'archived') {
        matchesTab = !!o.archived && !o.trashed;
      } else {
        const isShipped = !!o.shippingTrackingId || ['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع', 'تم شحن', 'تم التوصيل', 'مسلمة', 'مسترجعة', 'في طريق التسليم', 'في مركز العبور', 'قابلة للشحن'].some(s => (o.status2 || '').includes(s) || (o.status1 || '').includes(s));
        matchesTab = !o.archived && !o.trashed && !isShipped;
      }
      
      if (matchesTab) {
        const latestTagName = getLatestTagName(o, activeTags);
        if (latestTagName) {
          counts[latestTagName] = (counts[latestTagName] || 0) + 1;
        } else {
          counts['none'] = (counts['none'] || 0) + 1;
        }
      }
    });
    
    return counts;
  }, [orders, currentTab, activeTags]);
  const status2Options = Array.from(new Set(settings?.status2Options || ['قيد التجهيز', 'تم الشحن', 'في الطريق', 'مستلم', 'مرتجع', 'قابلة للشحن']));
  
  const status2Counts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    status2Options.forEach(s => {
      counts[s] = 0;
    });
    
    orders.forEach(o => {
      let matchesTab = false;
      if (currentTab === 'trash') {
        matchesTab = !!o.trashed;
      } else if (currentTab === 'archived') {
        matchesTab = !!o.archived && !o.trashed;
      } else {
        matchesTab = !o.archived && !o.trashed;
      }
      
      if (matchesTab && o.status2) {
        counts[o.status2] = (counts[o.status2] || 0) + 1;
      }
    });
    
    return counts;
  }, [orders, currentTab, status2Options]);
  
  const defaultDeliveryList = ['ياليدين', 'مايسترو', 'زد آر إكسبريس', 'إيكوتراك', 'أرامكس', 'توصيل محلي'];
  const customDelivery = Array.isArray(settings?.deliveryCompanies)
    ? settings.deliveryCompanies 
    : defaultDeliveryList;
  const integrationDelivery = settings?.shippingIntegrations?.filter(i => i.isActive).map(i => i.name).filter(Boolean) || [];
  const deliveryCompanies = Array.from(new Set([...customDelivery, ...integrationDelivery]));
  
  const confirmers = Array.from(new Set(users.filter(u => u.role === 'confirmer' || (u.commissionConfig && u.isActive)).map(u => u.displayName).filter(Boolean)));
  const uniqueDeliveryMethods = React.useMemo(() => Array.from(new Set(orders.map(o => o.shippingMethod).filter(Boolean))), [orders]);

  const handleEdit = (order: any) => {
    setEditingId(order.id);
    setEditDraft({ ...order });
  };

  const handleSave = async () => {
    if (editingId && editDraft) {
      let finalCity = (editDraft.city || '').trim();
      if (finalCity.toLowerCase().includes('ain azal') || finalCity.includes('عين ازال') || finalCity.includes('عين أزال')) {
         finalCity = 'Ain Azel';
      }
      await updateOrder(editingId, { ...editDraft, city: finalCity });
    }
    setEditingId(null);
    setEditDraft(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    
    if (type === 'bulkDelete') {
      try {
        await useStore.getState().bulkDeleteOrders(selectedOrders);
        toast.success('تم حذف الطلبيات بنجاح');
        setSelectedOrders([]);
      } catch (err) {
        toast.error('حدث خطأ أثناء الحذف');
      }
      setConfirmAction(null);
      return;
    }

    if (type === 'bulkShipping') {
      let successCount = 0;
      let failCount = 0;
      toast.loading('جاري الإرسال...', { id: 'bulk-shipping' });
      for (const orderId of selectedOrders) {
        const ord = orders.find(o => o.id === orderId);
        if (ord && !ord.shippingTrackingId) {
          const integration = settings?.shippingIntegrations?.find(i => i.isActive) || { name: 'Expedigo', vendor: 'expedigo', token: 'placeholder', isActive: true };
          try {
            await handlePushToShipping(ord, integration);
            successCount++;
          } catch (err) {
            failCount++;
          }
        }
      }
      toast.success(`تم الإرسال: ${successCount} نجاح, ${failCount} فشل`, { id: 'bulk-shipping' });
      setConfirmAction(null);
      return;
    }
    
    if (type === 'delete') {
      try {
        await deleteOrder(id);
        toast.success('تم حذف الطلبية بنجاح');
      } catch (e: any) {
        if (e?.name === 'DataIntegrityError') {
          setIntegrityBlockResult({
            canDelete: false,
            title: e.title || 'محظور لحماية تماسك البيانات',
            reason: e.message,
            details: e.details || [],
            suggestions: e.suggestions || []
          });
          const targetOrd = orders.find(o => o.id === id);
          if (targetOrd) {
            setBlockedOrderForSafeAction(targetOrd);
          }
          setShowIntegrityModal(true);
        } else {
          toast.error('حدث خطأ أثناء حذف الطلبية');
        }
      }
    } else if (type === 'trash') {
      updateOrder(id, { trashed: true });
    } else if (type === 'archive') {
      updateOrder(id, { archived: true });
    } else if (type === 'restore') {
      updateOrder(id, { archived: false });
    } else if (type === 'restoreTrash') {
      updateOrder(id, { trashed: false });
    } else if (type === 'directDelivery') {
      updateOrder(id, { 
        shippingTrackingId: 'تسليم يدوي', 
        status2: 'تم الشحن'
      });
      playActionSound('success');
      toast.success('تم تحويل الطلبية للتوصيل اليدوي بنجاح!');
    }
    setConfirmAction(null);
  };

  // Pagination logic
  const totalItems = filteredOrders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div 
      ref={containerRef}
      className={`p-3 sm:p-4 space-y-3 flex-1 min-h-0 flex flex-col transition-all duration-200 ${
        isFullscreen 
          ? 'fixed inset-0 z-[9999] bg-slate-900 text-slate-100 overflow-auto p-4 sm:p-6 shadow-2xl' 
          : 'bg-gray-50/50 w-full'
      }`}
    >
      {/* Fullscreen Quick Top Bar */}
      {isFullscreen && (
        <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-3.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-slate-800 mb-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl font-bold text-xs">
              <ShoppingCart className="w-4 h-4 text-blue-400" />
              <span>جدول الطلبيات</span>
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black">{filteredOrders.length}</span>
            </div>
            
            {/* Quick Stats Chips */}
            <div className="hidden lg:flex items-center gap-2 text-[11px] font-bold">
              <span className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-600">
                الكل: <strong className="text-slate-900">{statCards.total}</strong>
              </span>
              <span className="bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-lg text-cyan-700">
                جديدة: <strong className="text-cyan-900">{statCards.newOrders}</strong>
              </span>
              <span className="bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-emerald-700">
                مؤكدة: <strong className="text-emerald-900">{statCards.confirmed}</strong>
              </span>
              <span className="bg-amber-900/60 border border-amber-700/50 px-2.5 py-1 rounded-lg text-amber-300">
                ملغاة: <strong className="text-amber-100">{statCards.canceledOrders}</strong>
              </span>
              <span className="bg-purple-900/60 border border-purple-700/50 px-2.5 py-1 rounded-lg text-purple-300">
                مستلمة: <strong className="text-purple-100">{statCards.delivered}</strong>
              </span>
            </div>
          </div>

          {/* Search bar in quick bar */}
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="بحث في الطلبيات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700 text-white rounded-xl text-xs py-1.5 pr-8 pl-3 focus:ring-2 focus:ring-blue-500 shadow-inner placeholder-slate-400"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              إضافة طلبية
            </button>

            <button 
              onClick={toggleFullscreen}
              className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 text-xs transition-all cursor-pointer"
              title="إنهاء ملء الشاشة"
            >
              <Minimize2 className="w-4 h-4" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      )}

      {/* Duplicate Orders Detection Banner */}
      {duplicateOrdersCount > 0 && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3.5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-white p-2 rounded-lg shrink-0 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-amber-950 flex items-center gap-2">
                <span>تم رصد {duplicateOrdersCount} طلبية مكررة في النظام</span>
                <span className="bg-amber-200/80 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">مكتشف آلياً</span>
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">حدث هذا بسبب تكرار سحب الطلبيات من المتجر. يمكنك دمجها وحذف النسخ المكررة فوراً مع الحفاظ على كافة التعديلات وحالات الشحن.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              disabled={isDeduplicating}
              onClick={async () => {
                setIsDeduplicating(true);
                try {
                  const res = await deduplicateOrders();
                  playActionSound('success');
                  if (res.deletedCount > 0) {
                    toast.success(`تم بنجاح دمج وحذف ${res.deletedCount} طلبية مكررة والاحتفاظ بالنسخ المحدثة!`);
                  } else {
                    toast.success('تم فحص الطلبيات، ولا توجد مكررات متبقية.');
                  }
                } catch (e) {
                  playActionSound('error');
                  toast.error('حدث خطأ أثناء تنظيف المكررات');
                } finally {
                  setIsDeduplicating(false);
                }
              }}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isDeduplicating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري التنظيف...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>تنظيف وحذف المكررات الآن ({duplicateOrdersCount})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Stats Section - Compact Bar with Toggle to Detailed Cards */}
      {showDetailedStats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 shrink-0">
          <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600"><ShoppingCart className="w-4 h-4"/></div>
              <div><p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">الكل</p><p className="text-base font-black text-gray-900">{statCards.total}</p></div>
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-cyan-50 p-1.5 rounded-lg text-cyan-600"><Plus className="w-4 h-4"/></div>
              <div><p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">جديدة</p><p className="text-base font-black text-gray-900">{statCards.newOrders}</p></div>
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-green-50 p-1.5 rounded-lg text-green-600"><CheckCircle className="w-4 h-4"/></div>
              <div><p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">مؤكدة</p><p className="text-base font-black text-gray-900">{statCards.confirmed}</p></div>
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-amber-50 p-1.5 rounded-lg text-amber-600"><AlertTriangle className="w-4 h-4"/></div>
              <div><p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">ملغاة</p><p className="text-base font-black text-gray-900">{statCards.canceledOrders}</p></div>
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-600"><Truck className="w-4 h-4"/></div>
              <div><p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">مستلمة</p><p className="text-base font-black text-gray-900">{statCards.delivered}</p></div>
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-rose-50 p-1.5 rounded-lg text-rose-600"><XCircle className="w-4 h-4"/></div>
              <div><p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">مرتجعة</p><p className="text-base font-black text-gray-900">{statCards.returnOrders}</p></div>
            </div>
            <button 
              onClick={() => {
                setShowDetailedStats(false);
                localStorage.setItem('orders_showDetailedStats', 'false');
              }}
              className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-50 rounded"
              title="طي الإحصائيات لتوسيع مساحة الجدول"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white px-3 py-1.5 rounded-xl border border-gray-200/80 shadow-2xs flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold scrollbar-none py-0.5">
            <span className="text-gray-400 text-[10px] whitespace-nowrap">الإحصائيات:</span>
            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md whitespace-nowrap text-[11px]">الكل: <strong className="text-slate-900">{statCards.total}</strong></span>
            <span className="bg-cyan-50 text-cyan-800 px-2 py-0.5 rounded-md whitespace-nowrap text-[11px]">جديدة: <strong className="text-cyan-900">{statCards.newOrders}</strong></span>
            <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md whitespace-nowrap text-[11px]">مؤكدة: <strong className="text-emerald-900">{statCards.confirmed}</strong></span>
            <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md whitespace-nowrap text-[11px]">ملغاة: <strong className="text-amber-900">{statCards.canceledOrders}</strong></span>
            <span className="bg-purple-50 text-purple-800 px-2 py-0.5 rounded-md whitespace-nowrap text-[11px]">مستلمة: <strong className="text-purple-900">{statCards.delivered}</strong></span>
            <span className="bg-rose-50 text-rose-800 px-2 py-0.5 rounded-md whitespace-nowrap text-[11px]">مرتجعة: <strong className="text-rose-900">{statCards.returnOrders}</strong></span>
          </div>
          <button 
            onClick={() => {
              setShowDetailedStats(true);
              localStorage.setItem('orders_showDetailedStats', 'true');
            }}
            className="text-[10px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 shrink-0 bg-blue-50/70 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-100 transition-colors cursor-pointer"
            title="عرض بطاقات الإحصائيات التفصيلية"
          >
            <span>📊 تفصيل</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Main Header & Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-black text-gray-800 tracking-tight flex items-center gap-2">
            <span>إدارة الطلبيات</span>
            <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200">
              {filteredOrders.length} طلبية
            </span>
          </h2>
          <div className="bg-gray-100 p-0.5 rounded-lg flex border border-gray-200">
            <button 
              onClick={() => setCurrentTab('active')}
              className={`px-2.5 py-1 text-[11px] font-bold transition-all rounded-md cursor-pointer ${currentTab === 'active' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
            >
              نشطة
            </button>
            <button 
              onClick={() => setCurrentTab('archived')}
              className={`px-2.5 py-1 text-[11px] font-bold transition-all rounded-md cursor-pointer ${currentTab === 'archived' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
            >
              مؤرشفة
            </button>
            <button 
              onClick={() => setCurrentTab('trash')}
              className={`px-2.5 py-1 text-[11px] font-bold transition-all rounded-md cursor-pointer ${currentTab === 'trash' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
            >
              سلة المهملات
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="بحث سريع برقم الهاتف أو الاسم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl text-xs py-1.5 pr-8 pl-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition-all"
            />
          </div>

          {/* Filters Toggle Button */}
          <button 
             onClick={() => {
               const next = !collapseAllFilters;
               setCollapseAllFilters(next);
               localStorage.setItem('orders_collapseAllFilters', String(next));
             }}
             className={`border px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold shadow-2xs cursor-pointer ${
               collapseAllFilters 
                 ? 'bg-amber-50/80 border-amber-200 text-amber-800 hover:bg-amber-100' 
                 : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
             }`}
             title={collapseAllFilters ? "توسيع شريط الفلاتر" : "طي الفلاتر لتوسيع مساحة الجدول"}
          >
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            <span>{collapseAllFilters ? 'إظهار الفلاتر' : 'طي الفلاتر'}</span>
          </button>

          {/* Advanced Filters Button */}
          <button 
             onClick={() => setShowFilters(!showFilters)}
             className={`border p-1.5 rounded-xl transition-all flex items-center gap-1 shadow-2xs cursor-pointer ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
             title="التصفية المتقدمة والتاريخ"
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
          
          {/* Detailed / Compact View Toggle */}
          <button 
             onClick={() => setViewMode(prev => prev === 'detailed' ? 'compact' : 'detailed')}
             className="border p-1.5 rounded-xl transition-all flex items-center gap-1 shadow-2xs bg-white border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
             title={viewMode === 'detailed' ? "التبديل إلى الوضع المضغوط" : "التبديل إلى الوضع المفصل"}
          >
            {viewMode === 'detailed' ? <AlignJustify className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
          </button>

          {/* Picking List */}
          <button 
            onClick={() => setShowPickingList(true)}
            className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs shadow-2xs cursor-pointer"
            title="استخراج وتصدير قائمة تجهيز المنتجات"
          >
            <Package className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">قائمة التجهيز</span>
          </button>

          {/* Sequential Confirmation Mode (Renamed cleanly from ambiguous 'Focus Mode') */}
          <button 
            onClick={() => {
              if (filteredOrders.length > 0) {
                setFocusModeOrderId(filteredOrders[0].id);
              } else {
                toast.error('لا توجد طلبيات مطابقة للبدء في تأكيدها');
              }
            }}
            className="bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/80 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs shadow-2xs cursor-pointer"
            title="بدء جولة تأكيد الطلبيات واحدة تلو الأخرى"
          >
            <Eye className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">تأكيد متسلسل</span>
          </button>

          {/* Add Order Primary Action */}
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة طلبية</span>
          </button>
        </div>
      </div>

      {/* Collapsed Filter Active Summary (when filters are collapsed) */}
      {collapseAllFilters ? (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 shrink-0 text-xs text-amber-900">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="font-bold flex items-center gap-1 text-[11px]">
              <span>🎛️ أشرطة الفلاتر مطوية لتوفير أقصى ارتفاع للجدول</span>
            </span>
            {(statusFilter !== 'all' || status2Filter !== 'all' || tagFilter !== 'all' || channelFilter !== 'all' || hiddenStatuses.length > 0 || hiddenTags.length > 0 || hiddenChannels.length > 0) && (
              <span className="bg-amber-200/80 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                توجد فلاتر نشطة
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(statusFilter !== 'all' || status2Filter !== 'all' || tagFilter !== 'all' || channelFilter !== 'all' || hiddenStatuses.length > 0 || hiddenTags.length > 0 || hiddenChannels.length > 0) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setHiddenStatuses([]);
                  setStatus2Filter('all');
                  setTagFilter('all');
                  setHiddenTags([]);
                  setChannelFilter('all');
                  setHiddenChannels([]);
                }}
                className="text-[10px] text-rose-600 hover:text-rose-800 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200 cursor-pointer"
              >
                إلغاء جميع الفلاتر
              </button>
            )}
            <button
              onClick={() => {
                setCollapseAllFilters(false);
                localStorage.setItem('orders_collapseAllFilters', 'false');
              }}
              className="text-[10px] text-amber-800 hover:text-amber-950 font-bold bg-white px-2 py-0.5 rounded border border-amber-300 shadow-2xs cursor-pointer"
            >
              توسيع الفلاتر
            </button>
          </div>
        </div>
      ) : (
        /* Expanded Filter Hub with Filter Tab Selector */
        <div className="space-y-1.5 shrink-0">
          {/* Filter Sub-Tabs Selector */}
          <div className="flex items-center justify-between gap-2 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              <button
                onClick={() => {
                  setActiveFilterTab('all');
                  localStorage.setItem('orders_activeFilterTab', 'all');
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeFilterTab === 'all' 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                عرض كل أشرطة التصفية
              </button>
              <button
                onClick={() => {
                  setActiveFilterTab('status1');
                  localStorage.setItem('orders_activeFilterTab', 'status1');
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeFilterTab === 'status1' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                حالات التأكيد (1) {statusFilter !== 'all' && '●'}
              </button>
              <button
                onClick={() => {
                  setActiveFilterTab('status2');
                  localStorage.setItem('orders_activeFilterTab', 'status2');
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeFilterTab === 'status2' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                حالات الشحن والتجهيز (2) {status2Filter !== 'all' && '●'}
              </button>
              <button
                onClick={() => {
                  setActiveFilterTab('tags');
                  localStorage.setItem('orders_activeFilterTab', 'tags');
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeFilterTab === 'tags' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                التاغات {tagFilter !== 'all' && '●'}
              </button>
              <button
                onClick={() => {
                  setActiveFilterTab('channels');
                  localStorage.setItem('orders_activeFilterTab', 'channels');
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeFilterTab === 'channels' 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                قنوات البيع {channelFilter !== 'all' && '●'}
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  const newVal = !showStatusCounts;
                  setShowStatusCounts(newVal);
                  localStorage.setItem('orders_showStatusCounts', String(newVal));
                }}
                className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                  showStatusCounts 
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                    : 'bg-white border-slate-200 text-slate-500'
                }`}
                title="تفعيل/تعطيل إظهار أرقام الطلبيات داخل أزرار الحالات"
              >
                {showStatusCounts ? 'إخفاء الأرقام' : 'أرقام الإشعارات'}
              </button>
            </div>
          </div>

          {/* Status 1 Filter Bar */}
          {(activeFilterTab === 'all' || activeFilterTab === 'status1') && (
            <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200/80 shadow-2xs overflow-x-auto scrollbar-thin">
              <span className="text-[10px] font-bold text-slate-500 shrink-0 px-1">الحالة (1):</span>
              <button 
                onClick={() => { setStatusFilter('all'); setHiddenStatuses([]); }} 
                className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border transition-colors shrink-0 cursor-pointer flex items-center gap-1 ${statusFilter === 'all' && hiddenStatuses.length === 0 ? 'bg-slate-800 text-white border-slate-800 shadow-2xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                <span>الكل</span>
                {showStatusCounts && (
                  <span className={`px-1 py-0.2 text-[8px] font-black rounded-md ${statusFilter === 'all' && hiddenStatuses.length === 0 ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {totalTabOrdersCount}
                  </span>
                )}
              </button>
              {status1Options.map(status => {
                 const isActive = statusFilter === status;
                 const isHidden = hiddenStatuses.includes(status);
                 let baseColors = 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
                 if (isHidden) {
                     baseColors = 'bg-slate-100 text-slate-400 border-slate-200 opacity-60';
                 } else if (isActive) {
                     baseColors = 'bg-blue-50 text-blue-700 border-blue-300 shadow-2xs';
                 }
                 return (
                    <div key={status} className={`flex items-center rounded-lg border transition-colors shrink-0 overflow-hidden text-[10px] ${baseColors}`}>
                      <button 
                        onClick={() => {
                            if (isHidden) setHiddenStatuses(prev => prev.filter(s => s !== status));
                            setStatusFilter(isActive ? 'all' : status);
                        }}
                        className="px-2 py-0.5 font-bold outline-none flex items-center gap-1 cursor-pointer"
                      >
                        <span>{status}</span>
                        {showStatusCounts && (
                          <span className={`px-1 py-0.2 text-[8px] font-black rounded-md ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                            {statusCounts[status] || 0}
                          </span>
                        )}
                      </button>
                      <button 
                        onClick={() => {
                            if (isHidden) {
                                setHiddenStatuses(prev => prev.filter(s => s !== status));
                            } else {
                                setHiddenStatuses(prev => [...prev, status]);
                                if (isActive) setStatusFilter('all');
                            }
                        }}
                        className={`px-1 py-0.5 outline-none hover:bg-black/5 ${isHidden ? 'text-rose-500' : 'text-slate-400 opacity-50 hover:opacity-100'}`}
                        title={isHidden ? "إظهار الحالة" : "إخفاء الحالة"}
                      >
                        {isHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                 );
              })}
            </div>
          )}

          {/* Status 2 Filter Bar */}
          {(activeFilterTab === 'all' || activeFilterTab === 'status2') && (
            <div className="flex items-center gap-1.5 bg-blue-50/40 p-1.5 rounded-xl border border-blue-100 shadow-2xs overflow-x-auto scrollbar-thin">
              <span className="text-[10px] font-bold text-blue-700 shrink-0 px-1">الحالة (2):</span>
              <button 
                onClick={() => setStatus2Filter('all')} 
                className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border transition-colors shrink-0 cursor-pointer flex items-center gap-1 ${status2Filter === 'all' ? 'bg-blue-800 text-white border-blue-800 shadow-2xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                <span>الكل</span>
              </button>
              {status2Options.map(status => {
                 const isActive = status2Filter === status;
                 const isHidden = hiddenStatuses2.includes(status);
                 let baseColors = 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
                 if (isHidden) {
                     baseColors = 'bg-slate-100 text-slate-400 border-slate-200 opacity-60';
                 } else if (isActive) {
                     baseColors = 'bg-blue-50 text-blue-700 border-blue-300 shadow-2xs';
                 }
                 return (
                    <div key={status} className={`flex items-center rounded-lg border transition-colors shrink-0 overflow-hidden text-[10px] ${baseColors}`}>
                      <button 
                        onClick={() => {
                            if (isHidden) setHiddenStatuses2(prev => prev.filter(s => s !== status));
                            setStatus2Filter(isActive ? 'all' : status);
                        }}
                        className="px-2 py-0.5 font-bold outline-none flex items-center gap-1"
                      >
                        <span>{status}</span>
                        {showStatusCounts && !isHidden && (
                          <span className={`px-1 py-0.2 text-[8px] font-black rounded-md ${isActive ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>
                            {status2Counts[status] || 0}
                          </span>
                        )}
                      </button>
                      <button 
                        onClick={() => {
                            if (isHidden) {
                                setHiddenStatuses2(prev => prev.filter(s => s !== status));
                            } else {
                                setHiddenStatuses2(prev => [...prev, status]);
                                if (isActive) setStatus2Filter('all');
                            }
                        }}
                        className={`px-1 py-0.5 outline-none hover:bg-black/5 ${isHidden ? 'text-rose-500' : 'text-slate-400 opacity-50 hover:opacity-100'}`}
                        title={isHidden ? "إظهار الحالة" : "إخفاء الحالة"}
                      >
                        {isHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                 );
              })}
            </div>
          )}

          {/* Tag Filter Bar */}
          {(activeFilterTab === 'all' || activeFilterTab === 'tags') && (
            <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200/80 shadow-2xs overflow-x-auto scrollbar-thin">
              <span className="text-[10px] font-bold text-indigo-700 shrink-0 px-1">التاغ:</span>
              <button 
                onClick={() => { setTagFilter('all'); setHiddenTags([]); }} 
                className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border transition-colors shrink-0 cursor-pointer flex items-center gap-1 ${tagFilter === 'all' && hiddenTags.length === 0 ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                <span>الكل</span>
                {showStatusCounts && (
                  <span className={`px-1 py-0.2 text-[8px] font-black rounded-md ${tagFilter === 'all' && hiddenTags.length === 0 ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {totalTabOrdersCount}
                  </span>
                )}
              </button>

              {(() => {
                 const isActive = tagFilter === 'none';
                 const isHidden = hiddenTags.includes('none');
                 let baseColors = 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
                 if (isHidden) {
                     baseColors = 'bg-slate-100 text-slate-400 border-slate-200 opacity-60';
                 } else if (isActive) {
                     baseColors = 'bg-slate-800 text-white border-slate-800 shadow-2xs';
                 }
                 return (
                    <div className={`flex items-center rounded-lg border transition-colors shrink-0 overflow-hidden text-[10px] ${baseColors}`}>
                      <button 
                        onClick={() => {
                            if (isHidden) setHiddenTags(prev => prev.filter(t => t !== 'none'));
                            setTagFilter(isActive ? 'all' : 'none');
                        }}
                        className="px-2 py-0.5 font-bold outline-none flex items-center gap-1 cursor-pointer"
                      >
                        <span>بدون تاغ</span>
                        {showStatusCounts && (
                          <span className={`px-1 py-0.2 text-[8px] font-black rounded-md ${isActive ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                            {tagCounts['none'] || 0}
                          </span>
                        )}
                      </button>
                      <button 
                        onClick={() => {
                            if (isHidden) {
                                setHiddenTags(prev => prev.filter(t => t !== 'none'));
                            } else {
                                setHiddenTags(prev => [...prev, 'none']);
                                if (isActive) setTagFilter('all');
                            }
                        }}
                        className={`px-1 py-0.5 outline-none hover:bg-black/5 ${isHidden ? 'text-rose-500' : 'text-slate-400 opacity-50 hover:opacity-100'}`}
                        title={isHidden ? "إظهار بدون تاغ" : "إخفاء بدون تاغ"}
                      >
                        {isHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                 );
              })()}

              {activeTags.map(tag => {
                 const isActive = tagFilter === tag.name;
                 const isHidden = hiddenTags.includes(tag.name);
                 let baseColors = 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
                 if (isHidden) {
                     baseColors = 'bg-slate-100 text-slate-400 border-slate-200 opacity-60';
                 } else if (isActive) {
                     baseColors = 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs';
                 }
                 return (
                    <div key={tag.name} className={`flex items-center rounded-lg border transition-colors shrink-0 overflow-hidden text-[10px] ${baseColors}`}>
                      <button 
                        onClick={() => {
                            if (isHidden) setHiddenTags(prev => prev.filter(t => t !== tag.name));
                            setTagFilter(isActive ? 'all' : tag.name);
                        }}
                        className="px-2 py-0.5 font-bold outline-none flex items-center gap-1 cursor-pointer"
                      >
                        <span>{tag.name}</span>
                        {showStatusCounts && (
                          <span className={`px-1 py-0.2 text-[8px] font-black rounded-md ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                            {tagCounts[tag.name] || 0}
                          </span>
                        )}
                      </button>
                      <button 
                        onClick={() => {
                            if (isHidden) {
                                setHiddenTags(prev => prev.filter(t => t !== tag.name));
                            } else {
                                setHiddenTags(prev => [...prev, tag.name]);
                                if (isActive) setTagFilter('all');
                            }
                        }}
                        className={`px-1 py-0.5 outline-none hover:bg-black/5 ${isHidden ? 'text-rose-500' : 'text-slate-400 opacity-50 hover:opacity-100'}`}
                        title={isHidden ? "إظهار التاغ" : "إخفاء التاغ"}
                      >
                        {isHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                 );
              })}
            </div>
          )}

          {/* Source Channel Filter Bar */}
          {(activeFilterTab === 'all' || activeFilterTab === 'channels') && (
            <SourceChannelFilterBar
              orders={orders}
              selectedChannel={channelFilter}
              hiddenChannels={hiddenChannels}
              onSelectChannel={(ch) => setChannelFilter(ch)}
              onToggleHideChannel={(ch) => {
                setHiddenChannels(prev => 
                  prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
                );
              }}
              onResetChannelFilter={() => {
                setChannelFilter('all');
                setHiddenChannels([]);
              }}
            />
          )}
        </div>
      )}

      {selectedOrders.length > 0 && (
         <div className="bg-indigo-50 border border-indigo-100 p-2 sm:p-3 rounded-lg flex items-center justify-between mb-4 flex-wrap gap-2">
           <div className="flex items-center gap-2">
             <span className="text-sm font-bold text-indigo-900 bg-indigo-100 px-2 py-1 rounded-md">تم تحديد {selectedOrders.length}</span>
           </div>
           <div className="flex items-center gap-2">
             <button onClick={() => setConfirmAction({ type: 'bulkDelete', id: 'bulk', name: `${selectedOrders.length} طلبية` })} className="bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-sm">
               <Trash2 className="w-3.5 h-3.5" />
               حذف جماعي
             </button>
             <button onClick={async () => {
               if (window.confirm('هل أنت متأكد من إرسال الطلبيات المحددة لشركة الشحن؟ (سيتم إرسال الطلبيات غير المرسلة فقط)')) {
                 let successCount = 0;
                 let failCount = 0;
                 toast.loading('جاري الإرسال...', { id: 'bulk-shipping' });
                 for (const id of selectedOrders) {
                   const ord = orders.find(o => o.id === id);
                   if (ord && !ord.shippingTrackingId) {
                     // Get active integration
                     const integration = settings?.shippingIntegrations?.find(i => i.isActive) || { name: 'Expedigo', vendor: 'expedigo', token: 'placeholder', isActive: true };
                     try {
                       await handlePushToShipping(ord, integration);
                       successCount++;
                     } catch(e) {
                       failCount++;
                     }
                   }
                 }
                 toast.success(`تم الإرسال: ${successCount} نجاح, ${failCount} فشل`, { id: 'bulk-shipping' });
                 setSelectedOrders([]);
               }
             }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-sm">
               <Truck className="w-3.5 h-3.5" />
               إرسال جماعي للشحن
             </button>
             <button onClick={() => setSelectedOrders([])} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
               إلغاء التحديد
             </button>
           </div>
         </div>
      )}
      {showFilters && (
         <div className="bg-white p-2.5 rounded-xl border border-gray-200 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 shadow-xs shrink-0 items-end mb-1 text-xs">
            <div>
               <label className="block text-[9px] font-bold text-gray-500 mb-0.5">المنتج</label>
               <select value={productFilter} onChange={e => { setProductFilter(e.target.value); setGlobalProductFilter(e.target.value); }} className="w-full text-[11px] border border-gray-200 rounded-md py-1 px-1.5 bg-gray-50 font-bold outline-none focus:border-blue-400">
                  <option value="all">كل المنتجات</option>
                  {productFilterOptionsJSX}
               </select>
            </div>
            <div>
               <label className="block text-[9px] font-bold text-gray-500 mb-0.5">اسم القناة</label>
               <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)} className="w-full text-[11px] border border-gray-200 rounded-md py-1 px-1.5 bg-gray-50 font-bold outline-none focus:border-blue-400 font-bold">
                  <option value="all">كل القنوات</option>
                  {salesChannels && salesChannels.length > 0 && (
                     <optgroup label="--- قنوات البيع المربوطة ---">
                       {salesChannels.map(sc => (
                         <option key={sc.id} value={sc.name}>{sc.name}</option>
                       ))}
                     </optgroup>
                  )}
                  <optgroup label="--- قنوات أخرى ---">
                    {CHANNEL_PRESETS.map(ch => (
                                <option key={'preset-'+ch.id} value={ch.name}>{ch.name}</option>
                    ))}
                  </optgroup>
               </select>
            </div>
            <div>
               <label className="block text-[9px] font-bold text-gray-500 mb-0.5">الحالة (1)</label>
               <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full text-[11px] border border-gray-200 rounded-md py-1 px-1.5 bg-gray-50 font-bold outline-none focus:border-blue-400">
                  <option value="all">الكل</option>
                  {status1Options.map(p => <option key={p} value={p}>{p}</option>)}
               </select>
            </div>
            <div>
               <label className="block text-[9px] font-bold text-gray-500 mb-0.5">الحالة (2)</label>
               <select value={status2Filter} onChange={e => setStatus2Filter(e.target.value)} className="w-full text-[11px] border border-gray-200 rounded-md py-1 px-1.5 bg-gray-50 font-bold outline-none focus:border-blue-400">
                  <option value="all">الكل</option>
                  {status2Options.map(p => <option key={p} value={p}>{p}</option>)}
               </select>
            </div>
            <div>
               <label className="block text-[9px] font-bold text-gray-500 mb-0.5">المؤكد</label>
               <select value={confirmedByFilter} onChange={e => setConfirmedByFilter(e.target.value)} className="w-full text-[11px] border border-gray-200 rounded-md py-1 px-1.5 bg-gray-50 font-bold outline-none focus:border-blue-400">
                  <option value="all">الكل</option>
                  {confirmers.map(p => <option key={p} value={p}>{p}</option>)}
               </select>
            </div>
            <div>
               <label className="block text-[9px] font-bold text-gray-500 mb-0.5">طريقة التوصيل</label>
               <select value={deliveryMethodFilter} onChange={e => setDeliveryMethodFilter(e.target.value)} className="w-full text-[11px] border border-gray-200 rounded-md py-1 px-1.5 bg-gray-50 font-bold outline-none focus:border-blue-400">
                  <option value="all">الكل</option>
                  {uniqueDeliveryMethods.map(p => <option key={p as string} value={p as string}>{p as string}</option>)}
               </select>
            </div>
            <div>
               <label className="block text-[9px] font-bold text-gray-500 mb-0.5">شركة التوصيل</label>
               <select value={deliveryCompanyFilter} onChange={e => setDeliveryCompanyFilter(e.target.value)} className="w-full text-[11px] border border-gray-200 rounded-md py-1 px-1.5 bg-gray-50 font-bold outline-none focus:border-blue-400">
                  <option value="all">الكل</option>
                  {deliveryCompanies.map(p => <option key={p} value={p}>{p}</option>)}
               </select>
            </div>
            <div>
               <label className="block text-[9px] font-bold text-gray-500 mb-0.5">تاريخ الطلب</label>
               <select value={dateFilter} onChange={e => { setDateFilter(e.target.value); setCurrentPage(1); }} className="w-full text-[11px] border border-gray-200 rounded-md py-1 px-1.5 bg-gray-50 font-bold outline-none focus:border-blue-400">
                  <option value="all">كل الأوقات</option>
                  <option value="today">اليوم</option>
                  <option value="yesterday">الأمس</option>
                  <option value="week">هذا الأسبوع</option>
                  <option value="month">هذا الشهر</option>
               </select>
            </div>
            {(productFilter !== 'all' || statusFilter !== 'all' || status2Filter !== 'all' || confirmedByFilter !== 'all' || deliveryMethodFilter !== 'all' || deliveryCompanyFilter !== 'all' || dateFilter !== 'all' || channelFilter !== 'all' || hiddenChannels.length > 0) && (
               <button onClick={() => { setProductFilter('all'); setStatusFilter('all'); setStatus2Filter('all'); setConfirmedByFilter('all'); setDeliveryMethodFilter('all'); setDeliveryCompanyFilter('all'); setDateFilter('all'); setChannelFilter('all'); setHiddenChannels([]); }} className="text-[10px] font-bold text-rose-500 hover:text-rose-700 transition px-2 mb-0.5 lg:col-span-1 cursor-pointer">إعادة ضبط</button>
            )}
         </div>
      )}

      {/* Main Table Container: fills full height with min-h-[480px] and overflow-hidden */}
      <div className="md:hidden flex-1 min-h-0 space-y-2 mb-4 overflow-y-auto pb-20 px-1">
        {paginatedOrders.map((order: any) => (
          <MobileOrderCard key={order.id} order={order} />
        ))}
      </div>
      <div className="hidden md:flex bg-white rounded-xl shadow-xs border border-gray-200 flex-1 min-h-[480px] flex flex-col overflow-hidden">
        <div 
          ref={tableScrollRef} 
          className={`overflow-x-auto overflow-y-auto flex-1 min-h-[380px] select-text ${viewMode === 'compact' ? 'table-compact' : ''}`}
          style={{ overscrollBehaviorX: 'contain' }}
        >
          <style>{`
            .table-compact td, .table-compact th {
              padding: 4px 6px !important;
              font-size: 11px !important;
            }
            .table-compact input, .table-compact select {
              padding: 0px 4px !important;
              font-size: 10px !important;
            }
          `}</style>
          <table 
            className="text-left border-collapse text-[12px] bg-white text-right table-layout-fixed" 
            style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}
          >
            <thead>
              <tr className="bg-gray-100 sticky top-0 text-[11px] uppercase text-gray-600 border-b z-10 font-bold select-none h-10">
                <th className="p-2 border-r border-gray-200 relative group text-center" style={{ width: colWidths.select, minWidth: colWidths.select, maxWidth: colWidths.select }}>
                  <input type="checkbox" onChange={(e) => {
                    if (e.target.checked) setSelectedOrders(paginatedOrders.map(o => o.id));
                    else setSelectedOrders([]);
                  }} checked={paginatedOrders.length > 0 && selectedOrders.length === paginatedOrders.length} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group cursor-pointer hover:bg-gray-200 transition" onClick={() => handleSort('orderId')} style={{ width: colWidths.orderId, minWidth: colWidths.orderId, maxWidth: colWidths.orderId }}>
                  <div className="flex items-center"><span>#الطلب</span><SortIcon columnKey="orderId" /></div>
                  <div onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'orderId') }} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-200/50 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group cursor-pointer hover:bg-gray-200 transition" onClick={() => handleSort('orderDate')} style={{ width: colWidths.orderDate, minWidth: colWidths.orderDate, maxWidth: colWidths.orderDate }}>
                  <div className="flex items-center"><span>التاريخ</span><SortIcon columnKey="orderDate" /></div>
                  <div onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'orderDate') }} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-200/50 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group cursor-pointer hover:bg-gray-200 transition" onClick={() => handleSort('fullName')} style={{ width: colWidths.fullName, minWidth: colWidths.fullName, maxWidth: colWidths.fullName }}>
                  <div className="flex items-center"><span>الزبون</span><SortIcon columnKey="fullName" /></div>
                  <div onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'fullName') }} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-200/50 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group" style={{ width: colWidths.phone, minWidth: colWidths.phone, maxWidth: colWidths.phone }}>
                  <span>الهاتف</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'phone')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-200/50 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group bg-blue-50/20 text-blue-900 cursor-pointer hover:bg-blue-100 transition" onClick={() => handleSort('region')} style={{ width: colWidths.region, minWidth: colWidths.region, maxWidth: colWidths.region }}>
                  <div className="flex items-center"><span>الولاية</span><SortIcon columnKey="region" /></div>
                  <div onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'region') }} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-200/50 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group cursor-pointer hover:bg-gray-200 transition" onClick={() => handleSort('city')} style={{ width: colWidths.city, minWidth: colWidths.city, maxWidth: colWidths.city }}>
                  <div className="flex items-center"><span>المدينة</span><SortIcon columnKey="city" /></div>
                  <div onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'city') }} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-200/50 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group cursor-pointer hover:bg-gray-200 transition" onClick={() => handleSort('productName')} style={{ width: colWidths.productName, minWidth: colWidths.productName, maxWidth: colWidths.productName }}>
                  <div className="flex items-center"><span>المنتج</span><SortIcon columnKey="productName" /></div>
                  <div onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'productName') }} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-200/50 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group cursor-pointer hover:bg-gray-200 transition" onClick={() => handleSort('qnts')} style={{ width: colWidths.qnts, minWidth: colWidths.qnts, maxWidth: colWidths.qnts }}>
                  <div className="flex items-center"><span>الكمية</span><SortIcon columnKey="qnts" /></div>
                  <div onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'qnts') }} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-200/50 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group bg-emerald-50/20 text-emerald-950 font-bold" style={{ width: colWidths.priceWithoutDelivery, minWidth: colWidths.priceWithoutDelivery, maxWidth: colWidths.priceWithoutDelivery }}>
                  <span>سعر المنتج</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'priceWithoutDelivery')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-200/50 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group bg-emerald-50/20 text-emerald-950 font-bold" style={{ width: colWidths.shippingMethod, minWidth: colWidths.shippingMethod, maxWidth: colWidths.shippingMethod }}>
                  <span>طريقة التوصيل</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'shippingMethod')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-200/50 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group bg-emerald-50/20 text-emerald-950 font-bold" style={{ width: colWidths.deliveryPrice, minWidth: colWidths.deliveryPrice, maxWidth: colWidths.deliveryPrice }}>
                  <span>سعر التوصيل</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'deliveryPrice')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-200/50 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group" style={{ width: colWidths.totalCharge, minWidth: colWidths.totalCharge, maxWidth: colWidths.totalCharge }}>
                  <span>المجموع</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'totalCharge')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-200/50 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group text-blue-800 bg-blue-50/50 font-extrabold" style={{ width: colWidths.confirmedBy, minWidth: colWidths.confirmedBy, maxWidth: colWidths.confirmedBy }}>
                  <span>المؤكد</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'confirmedBy')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-200 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group text-blue-800 bg-blue-50/50 font-extrabold cursor-pointer hover:bg-blue-100 transition" onClick={() => handleSort('status1')} style={{ width: colWidths.status1, minWidth: colWidths.status1, maxWidth: colWidths.status1 }}>
                  <div className="flex items-center"><span>حالة 1</span><SortIcon columnKey="status1" /></div>
                  <div onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'status1') }} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-200 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group text-indigo-800 bg-indigo-50/50 font-extrabold cursor-pointer hover:bg-indigo-100 transition" onClick={() => handleSort('tag')} style={{ width: colWidths.tag, minWidth: colWidths.tag, maxWidth: colWidths.tag }}>
                  <div className="flex items-center"><span>التاغ</span><SortIcon columnKey="tag" /></div>
                  <div onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'tag') }} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-indigo-200 group-hover:bg-indigo-400 active:bg-indigo-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group text-blue-800 bg-blue-50/50 font-extrabold" style={{ width: colWidths.deliveryCompany, minWidth: colWidths.deliveryCompany, maxWidth: colWidths.deliveryCompany }}>
                  <span>شركة التوصيل</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'deliveryCompany')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-200 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group text-blue-800 bg-blue-50/50 font-extrabold" style={{ width: colWidths.postponementDate, minWidth: colWidths.postponementDate, maxWidth: colWidths.postponementDate }}>
                  <span>تأجيل</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'postponementDate')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-200 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group text-blue-800 bg-blue-50/50 font-extrabold cursor-pointer hover:bg-blue-100 transition" onClick={() => handleSort('status2')} style={{ width: colWidths.status2, minWidth: colWidths.status2, maxWidth: colWidths.status2 }}>
                  <div className="flex items-center"><span>حالة 2</span><SortIcon columnKey="status2" /></div>
                  <div onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'status2') }} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-200 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-gray-200 relative group" style={{ width: colWidths.notes, minWidth: colWidths.notes, maxWidth: colWidths.notes }}>
                  <span>ملاحظات</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'notes')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-200/50 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 text-center sticky left-0 bg-gray-50 z-20 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.05)]" style={{ width: colWidths.actions, minWidth: colWidths.actions, maxWidth: colWidths.actions }}>
                  <span>إجراءات</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedOrders.map((order) => {
                const isEditing = editingId === order.id;
                const stopDeskStatus = getStopDeskStatus(isEditing && editDraft ? editDraft : order);

                return (
                  <tr key={order.id} className={`transition-colors border-b ${getRowStyle(order.status1)}`}>
                    <td className="p-2 text-center border-r border-gray-100/50" style={{ width: colWidths.select, minWidth: colWidths.select, maxWidth: colWidths.select }}>
                      <input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={(e) => {
                        if (e.target.checked) setSelectedOrders([...selectedOrders, order.id]);
                        else setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                      }} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    </td>
                    <td className="p-2 font-bold font-mono border-r border-gray-100/50" style={{ width: colWidths.orderId, minWidth: colWidths.orderId, maxWidth: colWidths.orderId, overflow: 'visible' }}>
                      <div className="flex flex-col gap-1 items-start">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span>#{order.orderId}</span>
                          {!isEditing && <SourceChannelBadge order={order} size="xs" configuredSalesChannels={salesChannels} />}
                        </div>
                        {isEditing && editDraft && (
                          <select
                            value={editDraft.sourceChannel || getOrderChannelName(order, salesChannels) || ''}
                            onChange={(e) => setEditDraft({ ...editDraft, sourceChannel: e.target.value })}
                            className="text-[10px] py-0.5 px-1 rounded border border-indigo-200 bg-indigo-50 font-sans font-bold text-indigo-800 outline-none"
                            title="تعديل قناة البيع"
                          >
                            {salesChannels && salesChannels.length > 0 && (
                              <optgroup label="قنوات البيع المربوطة">
                                {salesChannels.map(sc => (
                                  <option key={sc.id} value={sc.name}>{sc.name}</option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="قنوات أخرى">
                              {CHANNEL_PRESETS.map(ch => (
                                <option key={'preset-'+ch.id} value={ch.name}>{ch.name}</option>
                              ))}
                            </optgroup>
                          </select>
                        )}
                        {order.isExchangedReturn && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-700 w-fit" title={`تم استبدالها بالطلبية: ${order.replacementOrderId || 'غير معروف'}`}>
                            <RefreshCw className="w-3 h-3" /> تم الإستبدال
                          </span>
                        )}
                        {order.isReplacement && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 w-fit" title={`بديلة عن: ${order.replacedOrderId || 'غير معروف'}`}>
                            <RefreshCw className="w-3 h-3" /> بديلة
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 font-bold opacity-90 border-r border-gray-100/50" style={{ width: colWidths.orderDate, minWidth: colWidths.orderDate, maxWidth: colWidths.orderDate, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={format(parseISO(order.orderDate), 'dd MMM yyyy HH:mm', { locale: ar })}>
                      <div className="flex flex-col justify-center">
                        <span>{format(parseISO(order.orderDate), 'dd MMM', { locale: ar })}</span>
                        <span className="text-[10px] text-gray-500 font-medium">{format(parseISO(order.orderDate), 'HH:mm')}</span>
                      </div>
                    </td>
                    <td className="p-2 font-extrabold border-r border-gray-100/50 whitespace-nowrap" style={{ width: colWidths.fullName, minWidth: colWidths.fullName, maxWidth: colWidths.fullName }}>
                      {isEditing && editDraft ? (
                        <input
                          type="text"
                          value={editDraft.fullName || ''}
                          onChange={(e) => setEditDraft({ ...editDraft, fullName: e.target.value })}
                          className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-[11px] font-bold focus:outline-none focus:border-blue-500"
                        />
                      ) : (
                        order.fullName
                      )}
                    </td>
                    <td className="p-2 font-bold text-blue-600 border-r border-gray-100 whitespace-nowrap" dir="ltr" style={{ width: colWidths.phone, minWidth: colWidths.phone, maxWidth: colWidths.phone, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isEditing && editDraft ? (
                        <input
                          type="text"
                          value={editDraft.phone || ''}
                          onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })}
                          className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-[11px] font-bold focus:outline-none focus:border-blue-500 text-left"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 justify-end">
                           <a href={`tel:${order.phone}`} className="hover:underline hover:text-blue-800">
                             {order.phone}
                           </a>
                           {order.phone && phoneCounts[order.phone] > 1 && (
                             <span className="bg-red-100 text-red-700 text-[9px] px-1.5 py-0.5 rounded-md font-black" title="طلب مكرر بنفس رقم الهاتف">مكرر</span>
                           )}
                        </div>
                      )}
                    </td>
                    <td className="p-2 border-r border-gray-100 font-extrabold bg-blue-50/10 text-blue-950 text-ellipsis overflow-hidden whitespace-nowrap" style={{ width: colWidths.region, minWidth: colWidths.region, maxWidth: colWidths.region }}>
                      {isEditing && editDraft ? (
                        <select
                          value={getWilayaCode(editDraft.region)}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              const label = WILAYAS_MAP[val];
                              const codeNum = parseInt(val, 10);
                              const isDesk = editDraft.shippingMethod?.includes('المكتب') || editDraft.shippingMethod?.includes('Stop');
                              const calc = calculateDefaultShippingFee(codeNum, isDesk);
                              const priceTotal = Number(String(editDraft.priceWithoutDelivery || '0').replace(/[^0-9.]/g, ''));
                              const newDeliv = calc.suggestedCustomerDeliveryPrice;
                              setEditDraft({ 
                                ...editDraft, 
                                region: label,
                                city: '',
                                realDeliveryPrice: calc.realDeliveryPrice,
                                deliveryPrice: newDeliv,
                                totalCharge: priceTotal + newDeliv
                              });
                            } else {
                              setEditDraft({ ...editDraft, region: '', city: '' });
                            }
                          }}
                          className="w-full border border-gray-300 rounded px-1 py-0.5 text-[11px] font-bold focus:outline-none focus:border-blue-500 bg-white"
                        >
                          <option value="">اختر الولاية...</option>
                          {ALGERIA_WILAYAS.map((w) => (
                            <option key={w.code} value={w.code}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        formatWilaya(order.region)
                      )}
                    </td>
                    <td className="p-2 border-r border-gray-100 font-bold text-gray-800 whitespace-nowrap relative" style={{ width: colWidths.city, minWidth: colWidths.city, maxWidth: colWidths.city, overflow: 'visible', textOverflow: 'ellipsis' }}>
                      {isEditing && editDraft ? (
                        <div className="flex flex-col gap-1 w-full relative">
                          {(() => {
                            const wilayaCode = getWilayaCode(editDraft.region);
                            const wilayaId = wilayaCode ? parseInt(wilayaCode, 10) : null;
                            const communes = wilayaId 
                              ? (ecotrackCommunes as any[]).filter((c: any) => c.wilaya_id === wilayaId) 
                              : [];

                            if (communes.length > 0) {
                              return (
                                <div className="flex flex-col gap-1">
                                <select
                                  value={editDraft.city || ''}
                                  onChange={(e) => setEditDraft({ ...editDraft, city: e.target.value })}
                                  className={`w-full border rounded px-1.5 py-0.5 text-[11px] font-bold focus:outline-none ${stopDeskStatus.isStopDesk ? (stopDeskStatus.isValid ? 'border-green-400 focus:border-green-500' : 'border-red-400 focus:border-red-500') : 'border-gray-300 focus:border-blue-500'} bg-white`}
                                >
                                  <option value="">اختر البلدية...</option>
                                  {communes.map((c, idx) => (
                                    <option key={`commune-${idx}`} value={c.nom}>
                                      {c.nom} {c.has_stop_desk === 1 ? '🏪 (مكتب)' : ''}
                                    </option>
                                  ))}
                                </select>
                                <ShippingDeskInfo 
                                  wilayaName={editDraft.region}
                                  communeName={editDraft.city}
                                  deliveryCompany={editDraft.deliveryCompany || order.deliveryCompany}
                                  isStopDesk={stopDeskStatus.isStopDesk}
                                />
                                </div>
                              );
                            } else {
                              return (
                                <input
                                  type="text"
                                  value={editDraft.city || ''}
                                  onChange={(e) => setEditDraft({ ...editDraft, city: e.target.value })}
                                  className={`w-full border rounded px-1.5 py-0.5 text-[11px] font-bold focus:outline-none ${stopDeskStatus.isStopDesk ? (stopDeskStatus.isValid ? 'border-green-400 focus:border-green-500' : 'border-red-400 focus:border-red-500') : 'border-gray-300 focus:border-blue-500'}`}
                                  placeholder="البلدية/المدينة"
                                />
                              );
                            }
                          })()}
                          {stopDeskStatus.isStopDesk && !stopDeskStatus.isValid && stopDeskStatus.availableCommunes.length > 0 && (
                            <select
                               onChange={(e) => setEditDraft({ ...editDraft, stopdeskCommune: e.target.value })}
                               className="w-full mt-1 border border-red-300 rounded text-[10px] bg-red-50 text-red-900 py-0.5"
                               defaultValue={stopDeskStatus.defaultCommune || ""}
                            >
                               <option value="" disabled>تصحيح للمكتب...</option>
                               {stopDeskStatus.availableCommunes.map((c: any, idx: number) => (
                                 <option key={`edit-city-${idx}`} value={c.nom}>{c.nom}</option>
                                ))}
                            </select>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 w-full">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{order.city || '-'}</span>
                          </div>
                          {(order.stopdeskCommune || (stopDeskStatus.isValid && stopDeskStatus.isStopDesk && stopDeskStatus.matchedCity)) && (
                            <div className="text-[9px] text-blue-700 bg-blue-50 px-1 py-0.5 rounded border border-blue-100 font-bold w-max">
                               مكتب: {order.stopdeskCommune || stopDeskStatus.matchedCity?.nom}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-2 border-r border-gray-100 font-semibold text-gray-900" style={{ width: colWidths.productName, minWidth: colWidths.productName, maxWidth: colWidths.productName }}>
                      {isEditing && editDraft ? (
                        <div className="flex flex-col gap-1 w-full">
                           <select
                              className="w-full border border-gray-300 rounded px-1.5 py-1 text-[11px] font-bold focus:outline-none focus:border-blue-500 bg-white"
                              value={editDraft.sku ? JSON.stringify({ sku: editDraft.sku, name: editDraft.productName, variation: editDraft.variation || '' }) : ''}
                              onChange={(e) => {
                                 if (!e.target.value) return;
                                 try {
                                    const parsed = JSON.parse(e.target.value);
                                    const updates = { ...editDraft, sku: parsed.sku, productName: parsed.name, variation: parsed.variation };
                                    
                                    const newPriceStr = parsed.price;
                                    if (newPriceStr !== undefined) {
                                        const newPrice = Number(newPriceStr);
                                        const qnts = Number(editDraft.qnts) || 1;
                                        const delivery = Number(String(editDraft.deliveryPrice || '0').replace(/[^0-9.]/g, ''));
                                        if (!isNaN(newPrice) && newPrice > 0) {
                                            const newPriceTotal = newPrice * qnts;
                                            updates.priceWithoutDelivery = newPriceTotal;
                                            updates.totalCharge = newPriceTotal + delivery;
                                        }
                                    }
                                    
                                    setEditDraft(updates);
                                 } catch (err) {}
                              }}
                           >
                              <option value="">-- اختر من المخزن --</option>
                              {inventoryProducts?.map(p => {
                                 const hasVariations = p.variations && p.variations.length > 0;
                                 if (hasVariations) {
                                    return (
                                       <optgroup key={p.id} label={p.name}>
                                          {p.variations.map((v: any, vIdx: number) => {
                                             const varName = v.attributes?.map((a:any) => a.option).join(' - ') || `تفرع ${vIdx+1}`;
                                             const varPrice = v.price || p.price || p.regular_price || 0;
                                             const vSku = v.sku || v.local_sku || (p.sku ? `${p.sku}-${vIdx + 1}` : ''); const val = JSON.stringify({ sku: vSku, name: p.name, variation: varName, price: varPrice });
                                             return (
                                                <option key={`${p.id}-${vIdx}`} value={val}>
                                                   {varName} {vSku ? `[${vSku}]` : ''} - {varPrice} د.ج
                                                </option>
                                             )
                                          })}
                                       </optgroup>
                                    );
                                 } else {
                                    const basePrice = p.price || p.regular_price || 0;
                                    const val = JSON.stringify({ sku: p.sku || '', name: p.name, variation: '', price: basePrice });
                                    return (
                                       <option key={p.id} value={val}>
                                          {p.name} {p.sku ? `[${p.sku}]` : ''} - {basePrice} د.ج
                                       </option>
                                    );
                                 }
                               })}
                            </select>
                          <input
                            type="text"
                            value={editDraft.productName || ''}
                            onChange={(e) => setEditDraft({ ...editDraft, productName: e.target.value })}
                            className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-[11px] font-bold focus:outline-none focus:border-blue-500"
                            placeholder="اسم المنتج"
                          />
                          <input
                            type="text"
                            value={editDraft.variation || ''}
                            onChange={(e) => setEditDraft({ ...editDraft, variation: e.target.value })}
                            className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-[11px] font-bold focus:outline-none focus:border-blue-500"
                            placeholder="تفاصيل"
                          />
                          <input
                            type="text"
                            value={editDraft.sku || ''}
                            onChange={(e) => setEditDraft({ ...editDraft, sku: e.target.value })}
                            className="w-full border border-indigo-300 rounded px-1.5 py-0.5 text-[11px] font-mono focus:outline-none focus:border-indigo-500 bg-indigo-50 placeholder:text-indigo-500"
                            placeholder="رمز SKU للمزامنة"
                            title="ادخل SKU لربط المنتج بالمخزن"
                          />
                        </div>
                      ) : (
                        <div className="truncate w-full font-bold relative group/product">
                          {(() => {
                             const synced = getSyncedProductInfo(order.sku, order.productName, order.variation);
                             return (
                                <div className="flex flex-col gap-0.5">
                                   <div className="flex items-center gap-1.5" title={synced.name}>
                                      <span className={`truncate ${synced.isSynced ? "text-indigo-700 font-black cursor-help" : ""}`}>{synced.name}</span>
                                      {synced.isSynced && (
                                         <span className="shrink-0 bg-indigo-100 text-indigo-600 text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5" title="مرتبط بالمخزن تلقائياً">
                                            <Check className="w-2.5 h-2.5" />
                                         </span>
                                      )}
                                   </div>
                                   {synced.variation && <span className={`text-[10px] ${synced.isSynced ? "text-indigo-500" : "text-gray-400"} font-normal truncate`} title={synced.variation}>({synced.variation})</span>}
                                   {order.sku && <span className="text-[9px] font-mono font-bold text-gray-400 mt-0.5 block truncate" title={order.sku}>SKU: {order.sku}</span>}
                                </div>
                             );
                          })()}
                        </div>
                      )}
                    </td>
                    <td className="p-2 border-r border-gray-100 font-bold text-gray-900" style={{ width: colWidths.qnts, minWidth: colWidths.qnts, maxWidth: colWidths.qnts, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isEditing && editDraft ? (
                        <input
                          type="number"
                          min="1"
                          value={Number(editDraft.qnts) || 1}
                          onChange={(e) => {
                             const newQnts = Number(e.target.value) || 1;
                             const oldQnts = Number(editDraft.qnts) || 1;
                             const currentPriceTotal = Number(String(editDraft.priceWithoutDelivery || '0').replace(/[^0-9.]/g, ''));
                             const unitPrice = oldQnts > 0 ? (currentPriceTotal / oldQnts) : currentPriceTotal;
                             const newPriceTotal = unitPrice * newQnts;
                             const delivery = Number(String(editDraft.deliveryPrice || '0').replace(/[^0-9.]/g, ''));
                             setEditDraft({ ...editDraft, qnts: newQnts, priceWithoutDelivery: newPriceTotal, totalCharge: newPriceTotal + delivery });
                          }}
                          className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-[11px] font-bold focus:outline-none focus:border-blue-500"
                        />
                      ) : (
                        <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded shadow-sm text-xs border border-gray-200">
                          {order.qnts || 1}
                        </span>
                      )}
                    </td>
                    <td className="p-2 border-r border-gray-100 bg-emerald-50/10 font-black text-emerald-950" style={{ width: colWidths.priceWithoutDelivery, minWidth: colWidths.priceWithoutDelivery, maxWidth: colWidths.priceWithoutDelivery, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isEditing && editDraft ? (
                        <input
                          type="number"
                          value={Number(String(editDraft.priceWithoutDelivery || '0').replace(/[^0-9.]/g, ''))}
                          onChange={(e) => {
                             const newPriceTotal = Number(e.target.value);
                             const delivery = Number(String(editDraft.deliveryPrice || '0').replace(/[^0-9.]/g, ''));
                             setEditDraft({ ...editDraft, priceWithoutDelivery: newPriceTotal, totalCharge: newPriceTotal + delivery })
                          }}
                          className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-[11px] font-bold focus:outline-none focus:border-blue-500"
                        />
                      ) : (
                        `${order.priceWithoutDelivery || 0} د.ج`
                      )}
                    </td>
                    <td className="p-2 border-r border-gray-100 bg-emerald-50/10 font-bold text-gray-800" style={{ width: colWidths.shippingMethod, minWidth: colWidths.shippingMethod, maxWidth: colWidths.shippingMethod, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isEditing && editDraft ? (
                        <select
                          value={editDraft.shippingMethod || ''}
                          onChange={(e) => {
                            const newMethod = e.target.value;
                            const wilayaCode = getWilayaCode(editDraft.region);
                            const codeNum = wilayaCode ? parseInt(wilayaCode, 10) : 16;
                            const isDesk = newMethod.includes('المكتب') || newMethod.includes('Stop');
                            const calc = calculateDefaultShippingFee(codeNum, isDesk);
                            const priceTotal = Number(String(editDraft.priceWithoutDelivery || '0').replace(/[^0-9.]/g, ''));
                            const newDeliv = calc.suggestedCustomerDeliveryPrice;
                            setEditDraft({
                              ...editDraft,
                              shippingMethod: newMethod,
                              realDeliveryPrice: calc.realDeliveryPrice,
                              deliveryPrice: newDeliv,
                              totalCharge: priceTotal + newDeliv
                            });
                          }}
                          className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-[11px] font-bold focus:outline-none focus:border-blue-500 bg-white"
                        >
                          <option value="">اختر الطريقة...</option>
                          <option value="توصيل للمكتب">توصيل للمكتب</option>
                          <option value="توصيل للمنزل">توصيل للمنزل</option>
                          {editDraft.shippingMethod && editDraft.shippingMethod !== 'توصيل للمكتب' && editDraft.shippingMethod !== 'توصيل للمنزل' && (
                             <option value={editDraft.shippingMethod}>{editDraft.shippingMethod}</option>
                          )}
                        </select>
                      ) : (
                        order.shippingMethod || '-'
                      )}
                    </td>
                    <td className="p-2 border-r border-gray-100 bg-emerald-50/10 font-black text-gray-900" style={{ width: colWidths.deliveryPrice, minWidth: colWidths.deliveryPrice, maxWidth: colWidths.deliveryPrice, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isEditing && editDraft ? (
                        <input
                          type="number"
                          value={Number(String(editDraft.deliveryPrice || '0').replace(/[^0-9.]/g, ''))}
                          onChange={(e) => {
                             const delivery = Number(e.target.value);
                             const priceTotal = Number(String(editDraft.priceWithoutDelivery || '0').replace(/[^0-9.]/g, ''));
                             setEditDraft({ ...editDraft, deliveryPrice: delivery, totalCharge: priceTotal + delivery });
                          }}
                          className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-[11px] font-bold focus:outline-none focus:border-blue-500"
                        />
                      ) : (
                        `${order.deliveryPrice || 0} د.ج`
                      )}
                    </td>
                    <td className="p-2 border-r border-gray-100 font-extrabold text-blue-950 bg-blue-50/5" style={{ width: colWidths.totalCharge, minWidth: colWidths.totalCharge, maxWidth: colWidths.totalCharge, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isEditing && editDraft ? (
                        <input
                          type="number"
                          value={Number(String(editDraft.totalCharge || '0').replace(/[^0-9.]/g, ''))}
                          onChange={(e) => setEditDraft({ ...editDraft, totalCharge: Number(e.target.value) })}
                          className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-[11px] font-bold focus:outline-none focus:border-blue-500"
                        />
                      ) : (
                        `${order.totalCharge || 0} د.ج`
                      )}
                    </td>

                    {/* Editable Fields (Direct or Draft depending on editing state) */}
                    <td className="p-1.5 bg-blue-50/10 border-r border-blue-50" style={{ width: colWidths.confirmedBy, minWidth: colWidths.confirmedBy, maxWidth: colWidths.confirmedBy }}>
                      {confirmers.length > 0 ? (
                        <select
                          value={isEditing && editDraft ? (editDraft.confirmedBy || '') : (order.confirmedBy || '')}
                          onChange={(e) => {
                            if (isEditing && editDraft) {
                              setEditDraft({ ...editDraft, confirmedBy: e.target.value });
                            } else {
                              updateOrder(order.id, { confirmedBy: e.target.value });
                            }
                          }}
                          className="w-full bg-transparent border-none rounded px-1.5 py-1 text-[11px] font-bold focus:outline-none transition-colors text-center cursor-pointer"
                        >
                          <option value="">-</option>
                          {confirmers.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={isEditing && editDraft ? (editDraft.confirmedBy || '') : (order.confirmedBy || '')}
                          onChange={(e) => {
                            if (isEditing && editDraft) {
                              setEditDraft({ ...editDraft, confirmedBy: e.target.value });
                            } else {
                              updateOrder(order.id, { confirmedBy: e.target.value });
                            }
                          }}
                          className="w-full bg-transparent border-none rounded px-1.5 py-1 text-[11px] font-bold focus:outline-none transition-colors text-center"
                          placeholder="-"
                        />
                      )}
                    </td>
                    <td className="p-1.5 bg-blue-50/10 border-r border-blue-50" style={{ width: colWidths.status1, minWidth: colWidths.status1, maxWidth: colWidths.status1 }}>
                      <select
                          value={isEditing && editDraft ? (editDraft.status1 || '') : (order.status1 || '')}
                          onChange={(e) => {
                            if (isEditing && editDraft) {
                              setEditDraft({ ...editDraft, status1: e.target.value });
                            } else {
                              updateOrder(order.id, { status1: e.target.value });
                            }
                          }}
                          className={`w-full bg-white border rounded-full px-2 py-0.5 text-[11px] font-black focus:outline-none transition-all cursor-pointer text-center ${
                            getStatus1Class(isEditing && editDraft ? editDraft.status1 : order.status1)
                          }`}
                        >
                          <option value="">إختر...</option>
                          {status1Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </td>
                    <td className="p-1.5 bg-indigo-50/10 border-r border-indigo-50" style={{ width: colWidths.tag, minWidth: colWidths.tag, maxWidth: colWidths.tag }}>
                      <div className="flex flex-col gap-1 text-right">
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar">
                          {getOrderTagsHistory(order, activeTags).length === 0 ? (
                            <span className="text-[10px] text-slate-400 italic">بدون تاغ</span>
                          ) : (
                            getOrderTagsHistory(order, activeTags).map((t) => (
                              <span
                                key={t.id}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black border shadow-2xs ${t.color || 'bg-slate-100 text-slate-700 border-slate-200'}`}
                              >
                                <span>{t.name}</span>
                                <span className="text-[8px] opacity-75 font-mono dir-ltr">
                                  ({formatTagTimestamp(t.createdAt)})
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const res = removeTagFromOrder(order, t.id, activeTags);
                                    updateOrder(order.id, { tag: res.tag, tagsHistory: res.tagsHistory });
                                  }}
                                  className="hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                                  title="حذف هذا التاغ"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))
                          )}
                        </div>

                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              const res = addTagToOrder(order, e.target.value, activeTags);
                              updateOrder(order.id, { tag: res.tag, tagsHistory: res.tagsHistory });
                              e.target.value = '';
                            }
                          }}
                          className="w-full bg-white border border-indigo-200 hover:border-indigo-400 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold text-indigo-700 focus:outline-none transition-all cursor-pointer text-center"
                        >
                          <option value="">+ إضافة تاغ</option>
                          {activeTags.map(opt => <option key={opt.name} value={opt.name}>{opt.name}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="p-1.5 bg-blue-50/10 border-r border-blue-50" style={{ width: colWidths.deliveryCompany, minWidth: colWidths.deliveryCompany, maxWidth: colWidths.deliveryCompany, overflow: 'visible' }}>
                      <div className="flex flex-col gap-1 w-full">
                        <select
                          value={isEditing && editDraft ? (editDraft.deliveryCompany || '') : (order.deliveryCompany || '')}
                          onChange={(e) => {
                            if (isEditing && editDraft) {
                              setEditDraft({ ...editDraft, deliveryCompany: e.target.value });
                            } else {
                              updateOrder(order.id, { deliveryCompany: e.target.value });
                            }
                          }}
                          className="w-full bg-white border border-gray-200 rounded px-1 py-0.5 text-[11px] font-black text-gray-750 focus:outline-none transition-colors cursor-pointer text-center"
                        >
                          <option value="">إختر...</option>
                          {order.deliveryCompany && !deliveryCompanies.includes(order.deliveryCompany) && (
                            <option value={order.deliveryCompany}>{order.deliveryCompany}</option>
                          )}
                          {deliveryCompanies.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        
                        {(() => {
                          const activeIntegration = settings?.shippingIntegrations?.find(i => i.name === order.deliveryCompany && i.isActive);
                          return (
                            <>
                              {!isEditing && order.status1 === 'مؤكد' && !order.shippingTrackingId && (
                                <div className="flex w-full gap-0.5 mt-0.5">
                                  {activeIntegration && (
                                    <button 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        const status = getStopDeskStatus(order);
                                        if (status.isStopDesk && !status.isValid) {
                                          toast.error(status.message || "المكتب غير متوفر", { duration: 6000, style: { minWidth: '350px' } });
                                          return;
                                        }
                                        setConfirmShipping({ order, integration: activeIntegration }); 
                                      }}
                                      disabled={shippingLoading === order.id}
                                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-[10px] font-bold py-1 px-1 rounded flex items-center justify-center gap-1 transition-all shadow-sm"
                                      title={`إرسال إلى ${activeIntegration.name}`}
                                    >
                                      {shippingLoading === order.id ? (
                                        <div className="w-3 h-3 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
                                      ) : (
                                        <>
                                          <Truck className="w-3 h-3 shrink-0" />
                                          <span className="truncate">إرسال</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: 'directDelivery', id: order.id, name: `#${order.orderId}` }); }}
                                    className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 flex-[0.5] py-1 px-1 rounded flex items-center justify-center transition-colors"
                                    title="توصيل يدوي / شخصي"
                                  >
                                    <CheckCircle className="w-3 h-3 shrink-0" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setManualTrackingModal({ order }); setManualTrackingId(''); }}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 flex-[0.5] py-1 px-1 rounded flex items-center justify-center transition-colors"
                                    title="إدخال رقم التتبع يدوياً (مزامنة)"
                                  >
                                    <Link className="w-3 h-3 shrink-0" />
                                  </button>
                                </div>
                              )}
                              {!isEditing && order.shippingTrackingId && (
                                <div className="w-full mt-0.5 bg-gray-100 text-indigo-700 border border-indigo-100 text-[9px] font-bold py-0.5 px-1 rounded flex items-center justify-center gap-0.5 cursor-help" title={`رقم التتبع: ${order.shippingTrackingId}`}>
                                  <CheckCircle className="w-2.5 h-2.5 shrink-0 text-indigo-500" />
                                  <span className="truncate" dir="ltr">{order.shippingTrackingId}</span>
                                </div>
                              )}
                              {!isEditing && activeIntegration && stopDeskStatus.isStopDesk && (
                                 <div className={`mt-1 flex flex-col gap-1 w-full`}>
                                   <div className={`flex items-center justify-center gap-1 text-[10px] font-bold py-0.5 rounded border relative group ${stopDeskStatus.isValid ? 'bg-green-50 text-green-700 border-green-200 cursor-default' : 'bg-red-50 text-red-700 border-red-200 cursor-help'}`}>
                                      {stopDeskStatus.isValid ? (
                                        <>
                                          <CheckCircle className="w-3 h-3 text-green-600" />
                                          <span>مكتب متوفر</span>
                                        </>
                                      ) : (
                                        <>
                                          <AlertTriangle className="w-3 h-3 text-red-600" />
                                          <span>غير متوفر</span>
                                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max bg-red-600 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-md whitespace-nowrap">
                                            {stopDeskStatus.message || "مكتب شحن غير متوفر"}
                                          </div>
                                        </>
                                      )}
                                   </div>
                                   {!stopDeskStatus.isValid && stopDeskStatus.availableCommunes.length > 0 && (
                                     <select
                                       onChange={(e) => {
                                         if (e.target.value) updateOrder(order.id, { stopdeskCommune: e.target.value });
                                       }}
                                       className="w-full border border-red-300 rounded text-[10px] bg-red-50 text-red-900 py-0.5 font-semibold text-center cursor-pointer shadow-sm hover:bg-red-100 transition-colors focus:outline-none focus:ring-1 focus:ring-red-400"
                                       defaultValue=""
                                       onClick={(e) => e.stopPropagation()}
                                     >
                                       <option value="" disabled>اختر مكتب متوفر...</option>
                                       {stopDeskStatus.availableCommunes.map((c: any, idx: number) => (
                                          <option key={`view-city-${idx}`} value={c.nom}>{c.nom}</option>
                                       ))}
                                     </select>
                                   )}
                                 </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="p-1.5 bg-blue-50/10 border-r border-blue-50" style={{ width: colWidths.postponementDate, minWidth: colWidths.postponementDate, maxWidth: colWidths.postponementDate }}>
                      <input
                        type="date"
                        value={isEditing && editDraft ? (editDraft.postponementDate || '') : (order.postponementDate || '')}
                        onChange={(e) => {
                          if (isEditing && editDraft) {
                            setEditDraft({ ...editDraft, postponementDate: e.target.value });
                          } else {
                            updateOrder(order.id, { postponementDate: e.target.value });
                          }
                        }}
                        className="w-full bg-white border border-gray-200 rounded px-1 py-0.5 text-[11px] font-bold focus:outline-none transition-colors text-center cursor-pointer"
                      />
                    </td>
                    <td className="p-1.5 bg-blue-50/10 border-r border-blue-50" style={{ width: colWidths.status2, minWidth: colWidths.status2, maxWidth: colWidths.status2 }}>
                      <select
                        value={isEditing && editDraft ? (editDraft.status2 || '') : (order.status2 || '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (isEditing && editDraft) {
                            setEditDraft({ ...editDraft, status2: val });
                          } else {
                            updateOrder(order.id, { status2: val });
                            if (['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع'].includes(val)) {
                              toast.success(`تم تغيير الحالة إلى "${val}". تم نقل الطلبية لجدول الطلبيات المشحونة (المتابعة).`);
                            } else if (val) {
                              toast.success(`تم تحديث الحالة (2) إلى "${val}".`);
                            }
                          }
                        }}
                        className={`w-full bg-white border rounded-full px-2 py-0.5 text-[11px] font-black focus:outline-none transition-all cursor-pointer text-center ${
                          getStatus2Class(isEditing && editDraft ? editDraft.status2 : order.status2)
                        }`}
                      >
                        <option value="">إختر...</option>
                        {status2Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </td>
                    <td className="p-2 border-r border-gray-100" style={{ width: colWidths.notes, minWidth: colWidths.notes, maxWidth: colWidths.notes }}>
                      {isEditing && editDraft ? (
                        <input
                          key="edit-notes"
                          type="text"
                          value={editDraft.notes || ''}
                          onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                          className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-[11px] font-bold focus:outline-none focus:border-blue-500"
                          placeholder="ملاحظات"
                        />
                      ) : (
                        <input
                          key={`view-notes-${order.id}`}
                          type="text"
                          defaultValue={order.notes || ''}
                          onBlur={(e) => {
                            if (e.target.value !== (order.notes || '')) {
                              updateOrder(order.id, { notes: e.target.value });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 hover:bg-gray-50 focus:border-blue-400 focus:bg-white rounded px-1 w-[120px] py-0.5 text-[11px] font-semibold focus:outline-none transition-all text-right"
                          placeholder="أضف ملاحظة..."
                        />
                      )}
                    </td>

                    <td className="p-2 text-center sticky left-0 bg-white z-10 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.05)] transition-colors group-hover:bg-blue-50/50" style={{ width: colWidths.actions, minWidth: colWidths.actions, maxWidth: colWidths.actions }}>
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-50 rounded" title="حفظ">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={handleCancel} className="p-1 text-red-600 hover:bg-red-50 rounded" title="إلغاء">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setViewOrderModal(order)} className="p-1 text-slate-600 hover:bg-slate-100 rounded" title="عرض التفاصيل كاملة">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {settings?.smsEnabled && (
                            <button onClick={() => handleOpenSmsModal(order)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="إرسال رسالة SMS">
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => setReplaceOrderModal(order)} className="p-1 text-purple-600 hover:bg-purple-50 rounded" title="إنشاء طلبية بديلة">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          {currentTab !== 'trash' && (
                            <button onClick={() => handleEdit(order)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="تعديل">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {currentTab === 'active' && (() => {
                            const isShipped = !!order.shippingTrackingId || ['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع', 'تم شحن', 'تم التوصيل', 'مسلمة', 'مسترجعة', 'في طريق التسليم', 'في مركز العبور', 'قابلة للشحن'].some(s => (order.status2 || '').includes(s) || (order.status1 || '').includes(s));
                            return !isShipped && (
                              <button 
                                onClick={() => setReminderModalOrder(order)} 
                                className={`p-1 rounded transition-all duration-300 border ${
                                  order.reminderDate && !order.reminderDismissed
                                    ? 'text-amber-600 hover:bg-amber-100 bg-amber-50 animate-pulse border-amber-300' 
                                    : 'text-slate-500 hover:bg-slate-100 border-transparent'
                                }`}
                                title={order.reminderDate && !order.reminderDismissed ? `تنبيه مؤقت مجدول: ${new Date(order.reminderDate).toLocaleString('ar-DZ')}` : "إعداد تنبيه للاتصال/تذكير"}
                              >
                                <Bell className="w-3.5 h-3.5" />
                              </button>
                            );
                          })()}
                          {currentTab === 'active' && (
                            <button 
                              onClick={() => setConfirmAction({ type: 'archive', id: order.id, name: `#${order.orderId}` })}
                              className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                              title="أرشفة"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {currentTab === 'archived' && (
                            <button 
                              onClick={() => setConfirmAction({ type: 'restore', id: order.id, name: `#${order.orderId}` })}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="إسترجاع من الأرشيف"
                            >
                              <ArchiveRestore className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {currentTab === 'trash' ? (
                            <>
                              <button 
                                onClick={() => setConfirmAction({ type: 'restoreTrash', id: order.id, name: `#${order.orderId}` })}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="إسترجاع من السلة"
                              >
                                <ArchiveRestore className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleInitiateDeleteOrder(order)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="حذف نهائي"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => setConfirmAction({ type: 'trash', id: order.id, name: `#${order.orderId}` })}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="نقل إلى السلة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
                      {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={18} className="p-12 text-center">
                     <div className="flex flex-col items-center justify-center text-gray-400">
                        <AlertTriangle className="w-10 h-10 mb-3 opacity-50" />
                        <h3 className="text-base font-bold text-gray-600">لا توجد طلبيات مطابقة</h3>
                        <p className="text-[11px]">حاول تغيير معايير البحث أو الفلترة</p>
                     </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={itemsPerPage}
          totalItems={totalItems}
          pageSizeOptions={[25, 50, 100, 200]}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
          itemLabel="طلبية"
          className="shrink-0"
        />
      </div>
      <AddOrderModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

      {/* Reminder Config Modal */}
      {reminderModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-gray-100">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                <span className="text-lg">🔔</span>
                <span>ضبط تذكير للطلب #{reminderModalOrder.orderId}</span>
              </h3>
              <button 
                onClick={() => setReminderModalOrder(null)} 
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">تاريخ ووقت التنبيه *</label>
                <input
                  type="datetime-local"
                  required
                  value={reminderModalOrder?.reminderDate ? reminderModalOrder.reminderDate.substring(0, 16) : ''}
                  onChange={(e) => setReminderModalOrder({ ...reminderModalOrder, reminderDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">سبب التذكير / ملاحظة (اختياري)</label>
                <textarea
                  rows={2}
                  value={reminderModalOrder.reminderNote || ''}
                  onChange={(e) => setReminderModalOrder({ ...reminderModalOrder, reminderNote: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  placeholder="مثال: الاتصال لتأكيد العنوان، الزبون طلب تأجيل الاتصال..."
                />
              </div>

              {reminderModalOrder.reminderDate && (
                <div className="bg-amber-50 text-amber-800 p-2.5 rounded-lg border border-amber-100 text-[11px] font-bold">
                  سيظهر تنبيه فوري في هذا التوقيت لتذكيرك بهذه الطلبية. وإذا كان البرنامج مغلقاً، فسيظهر التنبيه بمجرد فتحه بعد ذلك الوقت.
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2 justify-end bg-slate-50">
              {reminderModalOrder.reminderDate && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await updateOrder(reminderModalOrder.id, {
                        reminderDate: '',
                        reminderNote: '',
                        reminderDismissed: false
                      });
                      toast.success('تم حذف التنبيه بنجاح');
                      setReminderModalOrder(null);
                    } catch (err) {
                      toast.error('حدث خطأ أثناء حذف التنبيه');
                    }
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs border border-rose-200 transition-colors ml-auto"
                >
                  حذف التنبيه
                </button>
              )}
              <button
                type="button"
                onClick={() => setReminderModalOrder(null)}
                className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded-lg text-xs border border-gray-300 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!reminderModalOrder.reminderDate) {
                    toast.error('يرجى تحديد تاريخ ووقت التنبيه أولاً');
                    return;
                  }
                  try {
                    await updateOrder(reminderModalOrder.id, {
                      reminderDate: reminderModalOrder.reminderDate,
                      reminderNote: reminderModalOrder.reminderNote || '',
                      reminderDismissed: false
                    });
                    toast.success('تم ضبط التنبيه بنجاح');
                    setReminderModalOrder(null);
                  } catch (err) {
                    toast.error('حدث خطأ أثناء حفظ التنبيه');
                  }
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm transition-colors"
              >
                حفظ التنبيه
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden" dir="rtl">
            <div className={`p-4 flex items-start gap-3 border-b ${
              confirmAction.type === 'delete' || confirmAction.type === 'bulkDelete' || confirmAction.type === 'trash' ? 'border-red-100 bg-red-50/50' : 
              confirmAction.type === 'archive' ? 'border-orange-100 bg-orange-50/50' : 
              confirmAction.type === 'directDelivery' || confirmAction.type === 'bulkShipping' ? 'border-indigo-100 bg-indigo-50/50' :
              'border-green-100 bg-green-50/50'
            }`}>
              <div className={`p-2 rounded-full ${
                confirmAction.type === 'delete' || confirmAction.type === 'bulkDelete' || confirmAction.type === 'trash' ? 'bg-red-100 text-red-600' : 
                confirmAction.type === 'archive' ? 'bg-orange-100 text-orange-600' : 
                confirmAction.type === 'directDelivery' || confirmAction.type === 'bulkShipping' ? 'bg-indigo-100 text-indigo-600' :
                'bg-green-100 text-green-600'
              }`}>
                {confirmAction.type === 'delete' || confirmAction.type === 'bulkDelete' || confirmAction.type === 'trash' ? <Trash2 className="w-5 h-5" /> : 
                 confirmAction.type === 'archive' ? <Archive className="w-5 h-5" /> : 
                 confirmAction.type === 'directDelivery' || confirmAction.type === 'bulkShipping' ? <CheckCircle className="w-5 h-5" /> :
                 <ArchiveRestore className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mt-1">
                  {confirmAction.type === 'delete' || confirmAction.type === 'bulkDelete' ? 'تأكيد الحذف النهائي' : 
                   confirmAction.type === 'trash' ? 'نقل إلى السلة' : 
                   confirmAction.type === 'archive' ? 'تأكيد الأرشفة' : 
                   confirmAction.type === 'bulkShipping' ? 'تأكيد الشحن الجماعي' :
                   confirmAction.type === 'directDelivery' ? 'تأكيد التوصيل اليدوي' :
                   'تأكيد الإسترجاع'}
                </h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  {confirmAction.type === 'delete' ? `هل أنت متأكد من حذف الطلبية ${confirmAction.name} بشكل نهائي؟ لا يمكن التراجع عن هذه الخطوة.` : 
                   confirmAction.type === 'bulkDelete' ? `هل أنت متأكد من حذف ${confirmAction.name}؟` : 
                   confirmAction.type === 'trash' ? `هل أنت متأكد من نقل الطلبية ${confirmAction.name} إلى السلة؟` : 
                   confirmAction.type === 'archive' ? `هل أنت متأكد من أرشفة الطلبية ${confirmAction.name}؟ لن تظهر في قائمة الطلبيات النشطة.` : 
                   confirmAction.type === 'bulkShipping' ? `هل أنت متأكد من إرسال ${confirmAction.name} لشركة الشحن؟ (سيتم إرسال الطلبيات غير المرسلة فقط)` :
                   confirmAction.type === 'directDelivery' ? `هل أنت متأكد من تحويل الطلبية ${confirmAction.name} إلى توصيل يدوي؟ سيتم إدراجها في الطلبيات المشحونة كـ "تم الشحن" لتتمكن من تغيير حالتها لاحقاً.` :
                   `هل أنت متأكد من إسترجاع الطلبية ${confirmAction.name}؟ ستعود إلى القائمة السابقة.`}
                </p>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-1.5 rounded text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmAction}
                className={`px-4 py-1.5 rounded text-sm font-bold text-white transition-colors ${
                  confirmAction.type === 'delete' || confirmAction.type === 'bulkDelete' || confirmAction.type === 'trash' ? 'bg-red-600 hover:bg-red-700' : 
                  confirmAction.type === 'archive' ? 'bg-orange-600 hover:bg-orange-700' : 
                  confirmAction.type === 'directDelivery' || confirmAction.type === 'bulkShipping' ? 'bg-indigo-600 hover:bg-indigo-700' :
                  'bg-green-600 hover:bg-green-700'
                }`}
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Confirmation Modal */}
      {confirmShipping && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden" dir="rtl">
            <div className={`p-4 flex items-start gap-3 border-b border-indigo-100 bg-indigo-50/50`}>
              <div className={`p-2 rounded-full bg-indigo-100 text-indigo-600`}>
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mt-1">
                  تأكيد إرسال الطلبية
                </h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  هل أنت متأكد من إرسال الطلبية لزبون {confirmShipping.order.fullName} إلى شركة الشحن {confirmShipping.integration.name}؟ لن تتمكن من التعديل عليها هنا حتى يتم استرجاعها.
                </p>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2">
              <button
                onClick={() => setConfirmShipping(null)}
                className="px-4 py-1.5 rounded text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                disabled={shippingLoading === confirmShipping.order.id}
              >
                إلغاء
              </button>
              <button
                onClick={() => handlePushToShipping(confirmShipping.order, confirmShipping.integration)}
                className={`px-4 py-1.5 rounded text-sm font-bold text-white transition-colors bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2`}
                disabled={shippingLoading === confirmShipping.order.id}
              >
                {shippingLoading === confirmShipping.order.id ? (
                    <div className="w-3 h-3 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
                ) : null}
                تأكيد الإرسال
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Tracking Modal */}
      {manualTrackingModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden" dir="rtl">
            <div className={`p-4 flex items-start gap-3 border-b border-gray-100 bg-gray-50`}>
              <div className={`p-2 rounded-full bg-gray-200 text-gray-700`}>
                <Link className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mt-1">
                  مزامنة طلبية سابقة
                </h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  أدخل رقم التتبع (البوليصة) للطلبية الخاصة بالزبون {manualTrackingModal.order.fullName} ليتم نقلها لقسم "تم الشحن".
                </p>
              </div>
            </div>
            <div className="p-4">
              <input 
                type="text" 
                value={manualTrackingId}
                onChange={(e) => setManualTrackingId(e.target.value)}
                placeholder="اتركه فارغاً للنقل بدون تتبع، أو أدخل رقم تتبع (Ex: TRK-123)"
                className="w-full text-right bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                dir="rtl"
              />
            </div>
            <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2">
              <button
                onClick={() => setManualTrackingModal(null)}
                className="px-4 py-1.5 rounded text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveManualTracking}
                className={`px-4 py-1.5 rounded text-sm font-bold text-white transition-colors bg-gray-800 hover:bg-gray-900 flex items-center gap-2`}
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Focus Mode Modal */}
      {focusModeOrderId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] h-[95dvh] sm:h-[90dvh] animate-in fade-in zoom-in-95 duration-150">
            {(() => {
              const focusedOrder = orders.find(o => o.id === focusModeOrderId);
              if (!focusedOrder) return null;
              const currentIndex = filteredOrders.findIndex(o => o.id === focusModeOrderId);
              const shippingIntegration = settings?.shippingIntegrations?.[0]; // Default to first available
              const stopDeskStatus = getStopDeskStatus(focusEditDraft || focusedOrder);

              return (
                <>
                  {/* Modal Header */}
                  <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-500 text-white text-xs font-black px-2.5 py-1 rounded-xl font-mono">
                        #{focusedOrder.orderId || focusedOrder.id}
                      </span>
                      <span className="bg-slate-800 text-amber-400 text-xs font-black px-2.5 py-1 rounded-xl border border-slate-700">
                        {focusedOrder.status1 || 'غير محدد'} {focusedOrder.status2 ? ` - ${focusedOrder.status2}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setFocusModeOrderId(null)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors cursor-pointer">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Modal Body */}
                  <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 bg-slate-50 flex flex-col md:flex-row gap-5 custom-scrollbar">
                    
                    {/* Customer & Order Info */}
                    <div className="flex-1 space-y-4">
                                             {/* Summary Card */}
                      <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 shadow-sm flex flex-col gap-2">
                         <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4 text-indigo-500" />
                            <h4 className="text-xs font-black text-indigo-900">ملخص الطلبية</h4>
                         </div>
                         <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="bg-white p-2.5 rounded-xl border border-indigo-50 shadow-xs">
                               <div className="text-[9px] text-slate-400 font-bold mb-0.5">الزبون</div>
                               <div className="font-black text-slate-700 truncate" title={focusEditDraft?.fullName || ''}>{focusEditDraft?.fullName || '-'}</div>
                               <div className="font-mono text-slate-500">{focusEditDraft?.phone || '-'}</div>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-indigo-50 shadow-xs">
                               <div className="text-[9px] text-slate-400 font-bold mb-0.5">العنوان والشحن</div>
                               <div className="font-black text-slate-700 truncate" title={focusEditDraft?.region || ''}>{focusEditDraft?.region || '-'} - {focusEditDraft?.city || '-'}</div>
                               <div className="text-slate-500 truncate">{focusEditDraft?.shippingMethod || '-'}</div>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-indigo-50 shadow-xs">
                               <div className="text-[9px] text-slate-400 font-bold mb-0.5">المنتج</div>
                               <div className="font-black text-slate-700 truncate" title={focusEditDraft?.productName || ''}>{focusEditDraft?.productName || '-'}</div>
                               <div className="text-slate-500">الكمية: {focusEditDraft?.qnts || 1}</div>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-indigo-50 shadow-xs">
                               <div className="text-[9px] text-slate-400 font-bold mb-0.5">الحساب (د.ج)</div>
                               <div className="flex justify-between items-center"><span className="text-slate-400">المنتج:</span><span className="font-black">{focusEditDraft?.priceWithoutDelivery || 0}</span></div>
                               <div className="flex justify-between items-center"><span className="text-slate-400">التوصيل:</span><span className="font-black">{focusEditDraft?.deliveryPrice || 0}</span></div>
                               <div className="flex justify-between items-center mt-0.5 pt-0.5 border-t border-slate-100"><span className="text-slate-500 font-black">الإجمالي:</span><span className="font-black text-emerald-600">{focusEditDraft?.totalCharge || 0}</span></div>
                            </div>
                         </div>
                      </div>
                      
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                          <h3 className="text-sm font-black text-slate-800 mb-4 border-b pb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Edit2 className="w-4 h-4 text-amber-600" />
                              تعديل معلومات الطلبية
                            </div>
                            <button
                              onClick={() => {
                                updateOrder(focusedOrder.id, focusEditDraft);
                                toast.success('تم حفظ التعديلات بنجاح');
                              }}
                              className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-lg text-xs font-black transition-colors flex items-center gap-1 shadow-sm"
                            >
                              <Save className="w-3.5 h-3.5" />
                              حفظ التعديلات
                            </button>
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-bold">
                            {/* Main Info */}
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">المصدر (القناة)</label>
                              <select 
                                value={focusEditDraft?.sourceChannel || ''}
                                onChange={(e) => { const v = e.target.value; setFocusEditDraft({...focusEditDraft, sourceChannel: v}); updateOrder(focusedOrder.id, { sourceChannel: v }); }}
                                className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                              >
                                <option value="">إختر...</option>
                                {salesChannels?.map((ch: any) => (
                                    <option key={ch.id} value={ch.name}>{ch.name}</option>
                                ))}
                                {CHANNEL_PRESETS.map((ch) => (
                                    <option key={'preset-'+ch.id} value={ch.name}>{ch.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">اسم الزبون</label>
                              <input 
                                type="text"
                                value={focusEditDraft?.fullName || ''}
                                onChange={(e) => setFocusEditDraft({...focusEditDraft, fullName: e.target.value})} onBlur={(e) => updateOrder(focusedOrder.id, { fullName: e.target.value })}
                                className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">رقم الهاتف</label>
                              <input 
                                type="text"
                                value={focusEditDraft?.phone || ''}
                                onChange={(e) => setFocusEditDraft({...focusEditDraft, phone: e.target.value})} onBlur={(e) => updateOrder(focusedOrder.id, { phone: e.target.value })}
                                className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500 font-mono"
                                dir="ltr"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">الولاية</label>
                              <select
                                value={getWilayaCode(focusEditDraft?.region) || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val) {
                                    const label = WILAYAS_MAP[val];
                                    const codeNum = parseInt(val, 10);
                                    const isDesk = focusEditDraft?.shippingMethod?.includes('المكتب') || focusEditDraft?.shippingMethod?.includes('Stop');
                                    const calc = calculateDefaultShippingFee(codeNum, isDesk);
                                    const priceTotal = Number(String(focusEditDraft?.priceWithoutDelivery || '0').replace(/[^0-9.]/g, ''));
                                    const newDeliv = calc.suggestedCustomerDeliveryPrice;
                                    setFocusEditDraft({ 
                                      ...focusEditDraft, 
                                      region: label,
                                      city: '',
                                      realDeliveryPrice: calc.realDeliveryPrice,
                                      deliveryPrice: newDeliv,
                                      totalCharge: priceTotal + newDeliv
                                    });
                                  } else {
                                    setFocusEditDraft({ ...focusEditDraft, region: '', city: '' }); updateOrder(focusedOrder.id, { region: '', city: '' });
                                  }
                                }}
                                className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                              >
                                <option value="">اختر الولاية...</option>
                                {ALGERIA_WILAYAS.map((w) => (
                                  <option key={w.code} value={w.code}>
                                    {w.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between items-center">
                                <label className="block text-[10px] text-slate-400 mb-1">البلدية</label>
                                {stopDeskStatus.isStopDesk && (
                                  <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${stopDeskStatus.isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {stopDeskStatus.isValid ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                    {stopDeskStatus.isValid ? 'مكتب متوفر' : 'غير متوفر'}
                                  </div>
                                )}
                              </div>
                              {(() => {
                                const wilayaCode = getWilayaCode(focusEditDraft?.region);
                                const wilayaId = wilayaCode ? parseInt(wilayaCode, 10) : null;
                                const communes = wilayaId
                                   ? (ecotrackCommunes as any[]).filter((c: any) => c.wilaya_id === wilayaId)
                                  : [];
                                if (communes.length > 0) {
                                  return (
                                    <div className="flex flex-col gap-1">
                                      <select
                                        value={focusEditDraft?.city || ''}
                                        onChange={(e) => { const v = e.target.value; setFocusEditDraft({ ...focusEditDraft, city: v }); updateOrder(focusedOrder.id, { city: v }); }}
                                        className={`w-full p-2 bg-white rounded-lg border ${stopDeskStatus.isStopDesk ? (stopDeskStatus.isValid ? 'border-green-400 focus:border-green-500' : 'border-red-400 focus:border-red-500') : 'border-slate-200 focus:border-amber-500'} text-slate-800 focus:outline-none`}
                                      >
                                        <option value="">اختر البلدية...</option>
                                        {communes.map((c, idx) => (
                                          <option key={`commune-${idx}`} value={c.nom}>
                                            {c.nom} {c.has_stop_desk === 1 ? '🏪 (مكتب)' : ''}
                                          </option>
                                        ))}
                                      </select>
                                      <ShippingDeskInfo 
                                        wilayaName={focusEditDraft?.region || ''}
                                        communeName={focusEditDraft?.city || ''}
                                        deliveryCompany={focusEditDraft?.deliveryCompany || focusedOrder.deliveryCompany || ''}
                                        isStopDesk={stopDeskStatus.isStopDesk}
                                      />
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div className="flex flex-col gap-1">
                                      <input 
                                        type="text"
                                        value={focusEditDraft?.city || ''}
                                        onChange={(e) => setFocusEditDraft({...focusEditDraft, city: e.target.value})} onBlur={(e) => updateOrder(focusedOrder.id, { city: e.target.value })}
                                        className={`w-full p-2 bg-white rounded-lg border ${stopDeskStatus.isStopDesk ? (stopDeskStatus.isValid ? 'border-green-400 focus:border-green-500' : 'border-red-400 focus:border-red-500') : 'border-slate-200 focus:border-amber-500'} text-slate-800 focus:outline-none`}
                                      />
                                      <ShippingDeskInfo 
                                        wilayaName={focusEditDraft?.region || ''}
                                        communeName={focusEditDraft?.city || ''}
                                        deliveryCompany={focusEditDraft?.deliveryCompany || focusedOrder.deliveryCompany || ''}
                                        isStopDesk={stopDeskStatus.isStopDesk}
                                      />
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">تصحيح مكتب الشحن</label>
                              {stopDeskStatus.isStopDesk && !stopDeskStatus.isValid && stopDeskStatus.availableCommunes.length > 0 ? (
                                <select
                                  onChange={(e) => { const v = e.target.value; setFocusEditDraft({ ...focusEditDraft, stopdeskCommune: v }); updateOrder(focusedOrder.id, { stopdeskCommune: v }); }}
                                  className="w-full p-2 bg-red-50 border border-red-300 rounded-lg text-red-900 focus:outline-none focus:border-red-500 font-bold"
                                  value={focusEditDraft?.stopdeskCommune || stopDeskStatus.defaultCommune || ""}
                                >
                                  <option value="" disabled>تصحيح للمكتب المتوفر...</option>
                                  {stopDeskStatus.availableCommunes.map((c: any, idx: number) => (
                                    <option key={`edit-city-${idx}`} value={c.nom}>{c.nom}</option>
                                   ))}
                                </select>
                              ) : (
                                <input 
                                  type="text"
                                  value={focusEditDraft?.stopdeskCommune || ''}
                                  onChange={(e) => setFocusEditDraft({...focusEditDraft, stopdeskCommune: e.target.value})} onBlur={(e) => updateOrder(focusedOrder.id, { stopdeskCommune: e.target.value })}
                                  className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                                  placeholder={stopDeskStatus.isStopDesk ? "مكتب يدوي" : "اختياري"}
                                />
                              )}
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">طريقة الشحن</label>
                              <select 
                                value={focusEditDraft?.shippingMethod || 'توصيل للمنزل'}
                                onChange={(e) => {
                                   const val = e.target.value;
                                   const wilayaCode = getWilayaCode(focusEditDraft?.region);
                                   const codeNum = parseInt(wilayaCode, 10);
                                   const isDesk = val.includes('المكتب') || val.includes('Stop');
                                   const calc = calculateDefaultShippingFee(codeNum, isDesk);
                                   const priceTotal = Number(String(focusEditDraft?.priceWithoutDelivery || '0').replace(/[^0-9.]/g, ''));
                                   const newDeliv = calc.suggestedCustomerDeliveryPrice;
                                   const updates = { shippingMethod: val, realDeliveryPrice: calc.realDeliveryPrice, deliveryPrice: newDeliv, totalCharge: priceTotal + newDeliv }; setFocusEditDraft({...focusEditDraft, ...updates}); updateOrder(focusedOrder.id, updates);
                                }}
                                className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                              >
                                <option value="توصيل للمنزل">توصيل للمنزل</option>
                                <option value="توصيل للمكتب">توصيل للمكتب</option>
                                {focusEditDraft?.shippingMethod && focusEditDraft.shippingMethod !== 'توصيل للمكتب' && focusEditDraft.shippingMethod !== 'توصيل للمنزل' && (
                                   <option value={focusEditDraft.shippingMethod}>{focusEditDraft.shippingMethod}</option>
                                )}
                              </select>
                            </div>
                            <div className="lg:col-span-3">
                              <label className="block text-[10px] text-slate-400 mb-1">العنوان</label>
                              <input 
                                type="text"
                                value={focusEditDraft?.address || ''}
                                onChange={(e) => setFocusEditDraft({...focusEditDraft, address: e.target.value})} onBlur={(e) => updateOrder(focusedOrder.id, { address: e.target.value } as any)}
                                className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            
                            {/* Product details */}
                            <div className="lg:col-span-3 border-t pt-3 mt-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">المنتج (من المخزن)</label>
                                <select
                                  value={focusEditDraft?.sku ? JSON.stringify({ sku: focusEditDraft.sku, name: focusEditDraft.productName, variation: focusEditDraft.variation || '' }) : ''}
                                  onChange={(e) => {
                                     if (!e.target.value) return;
                                     try {
                                        const parsed = JSON.parse(e.target.value);
                                        const updates = { ...focusEditDraft, sku: parsed.sku, productName: parsed.name, variation: parsed.variation };
                                        
                                        const newPriceStr = parsed.price;
                                        if (newPriceStr !== undefined) {
                                            const newPrice = Number(newPriceStr);
                                            const qnts = Number(focusEditDraft.qnts) || 1;
                                            const delivery = Number(String(focusEditDraft.deliveryPrice || '0').replace(/[^0-9.]/g, ''));
                                            if (!isNaN(newPrice) && newPrice > 0) {
                                                const newPriceTotal = newPrice * qnts;
                                                updates.priceWithoutDelivery = newPriceTotal;
                                                updates.totalCharge = newPriceTotal + delivery;
                                            }
                                        }
                                        
                                        setFocusEditDraft(updates);
                                     } catch (err) {}
                                  }}
                                  className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                                >
                                  <option value="">-- اختر من المخزن --</option>
                                  {inventoryProducts?.map(p => {
                                     const hasVariations = p.variations && p.variations.length > 0;
                                     if (hasVariations) {
                                        return (
                                           <optgroup key={p.id} label={p.name}>
                                              {p.variations.map((v: any, vIdx: number) => {
                                                 const varName = v.attributes?.map((a:any) => a.option).join(' - ') || `تفرع ${vIdx+1}`;
                                                 const varPrice = v.price || p.price || p.regular_price || 0;
                                                 const vSku = v.sku || v.local_sku || (p.sku ? `${p.sku}-${vIdx + 1}` : ''); const val = JSON.stringify({ sku: vSku, name: p.name, variation: varName, price: varPrice });
                                                 return (
                                                    <option key={`${p.id}-${vIdx}`} value={val}>
                                                       {varName} {vSku ? `[${vSku}]` : ''} - {varPrice} د.ج
                                                    </option>
                                                 )
                                              })}
                                           </optgroup>
                                        )
                                     } else {
                                        const pPrice = p.price || p.regular_price || 0;
                                        const val = JSON.stringify({ sku: p.sku || '', name: p.name, variation: '', price: pPrice });
                                        return (
                                           <option key={p.id} value={val}>
                                              {p.name} {p.sku ? `[${p.sku}]` : ''} - {pPrice} د.ج
                                           </option>
                                        )
                                     }
                                  })}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">تعديل يدوي للمنتج / النوع</label>
                                <div className="flex gap-1">
                                    <input 
                                    type="text"
                                    value={focusEditDraft?.productName || ''}
                                    onChange={(e) => setFocusEditDraft({...focusEditDraft, productName: e.target.value})}
                                    className="w-1/2 p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                                    placeholder="اسم المنتج"
                                    />
                                    <input 
                                    type="text"
                                    value={focusEditDraft?.variation || ''}
                                    onChange={(e) => setFocusEditDraft({...focusEditDraft, variation: e.target.value})}
                                    className="w-1/2 p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                                    placeholder="النوع"
                                    />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <div className="w-1/4">
                                  <label className="block text-[10px] text-slate-400 mb-1">الكمية</label>
                                  <input 
                                    type="number"
                                    value={focusEditDraft?.qnts || 1}
                                    onChange={(e) => {
                                      const oldQnts = Number(focusEditDraft.qnts) || 1;
                                      const newQnts = Number(e.target.value) || 1;
                                      const currentPriceTotal = Number(String(focusEditDraft.priceWithoutDelivery || '0').replace(/[^0-9.]/g, ''));
                                      const unitPrice = oldQnts > 0 ? (currentPriceTotal / oldQnts) : currentPriceTotal;
                                      const newPriceTotal = unitPrice * newQnts;
                                      const delivery = Number(String(focusEditDraft.deliveryPrice || '0').replace(/[^0-9.]/g, ''));
                                      setFocusEditDraft({...focusEditDraft, qnts: newQnts, priceWithoutDelivery: newPriceTotal, totalCharge: newPriceTotal + delivery});
                                    }}
                                    className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                                  />
                                </div>
                                <div className="w-1/3">
                                  <label className="block text-[10px] text-slate-400 mb-1">التوصيل</label>
                                  <input 
                                    type="number"
                                    value={focusEditDraft?.deliveryPrice || 0}
                                    onChange={(e) => {
                                      const delivery = Number(e.target.value);
                                      const priceTotal = Number(String(focusEditDraft.priceWithoutDelivery || '0').replace(/[^0-9.]/g, ''));
                                      setFocusEditDraft({...focusEditDraft, deliveryPrice: delivery, totalCharge: priceTotal + delivery});
                                    }}
                                    className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-[10px] text-slate-400 mb-1">الإجمالي (دج)</label>
                                  <input 
                                    type="number"
                                    value={focusEditDraft?.totalCharge || 0}
                                    onChange={(e) => {
                                      const newTotal = Number(e.target.value);
                                      const delivery = Number(String(focusEditDraft?.deliveryPrice || '0').replace(/[^0-9.]/g, ''));
                                      setFocusEditDraft({...focusEditDraft, totalCharge: newTotal, priceWithoutDelivery: newTotal - delivery});
                                    }}
                                    className="w-full p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 focus:outline-none focus:border-emerald-500 font-black"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {/* Statuses & Notes */}
                                                        <div className="lg:col-span-3 border-t pt-3 mt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-1">الحالة (Status 1)</label>
                                  <select 
                                    value={focusEditDraft?.status1 || ''}
                                    onChange={(e) => { const v = e.target.value; setFocusEditDraft({...focusEditDraft, status1: v}); updateOrder(focusedOrder.id, { status1: v }); }}
                                    className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                                  >
                                    <option value="">إختر...</option>
                                    {status1Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-1">المؤكد</label>
                                  {confirmers.length > 0 ? (
                                    <select 
                                      value={focusEditDraft?.confirmedBy || ''}
                                      onChange={(e) => { const v = e.target.value; setFocusEditDraft({...focusEditDraft, confirmedBy: v}); updateOrder(focusedOrder.id, { confirmedBy: v }); }}
                                      className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                                    >
                                      <option value="">غير محدد</option>
                                      {confirmers.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                  ) : (
                                    <input 
                                      type="text"
                                      value={focusEditDraft?.confirmedBy || ''}
                                      onChange={(e) => { const v = e.target.value; setFocusEditDraft({...focusEditDraft, confirmedBy: v}); updateOrder(focusedOrder.id, { confirmedBy: v }); }}
                                      className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                                      placeholder="اسم المؤكد..."
                                    />
                                  )}
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-1">الحالة الفرعية (Status 2)</label>
                                  <select 
                                    value={focusEditDraft?.status2 || ''}
                                    onChange={(e) => { const v = e.target.value; setFocusEditDraft({...focusEditDraft, status2: v}); updateOrder(focusedOrder.id, { status2: v }); }}
                                    className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                                  >
                                    <option value="">إختر...</option>
                                    {status2Options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-1">شركة الشحن</label>
                                  <select 
                                    value={focusEditDraft?.deliveryCompany || ''}
                                    onChange={(e) => { const v = e.target.value; setFocusEditDraft({...focusEditDraft, deliveryCompany: v}); updateOrder(focusedOrder.id, { deliveryCompany: v }); }}
                                    className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                                  >
                                    <option value="">غير محدد</option>
                                    {focusEditDraft?.deliveryCompany && !deliveryCompanies.includes(focusEditDraft.deliveryCompany) && (
                                      <option value={focusEditDraft.deliveryCompany}>{focusEditDraft.deliveryCompany}</option>
                                    )}
                                    {deliveryCompanies.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-1">رقم التتبع / التوصيل</label>
                                  <input 
                                    type="text"
                                    value={focusEditDraft?.trackingNumber || ''}
                                    onChange={(e) => setFocusEditDraft({...focusEditDraft, trackingNumber: e.target.value})} onBlur={(e) => updateOrder(focusedOrder.id, { shippingTrackingId: e.target.value })}
                                    className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500 font-mono"
                                  />
                                </div>
                                <div className="lg:col-span-5">
                                  <label className="block text-[10px] text-slate-400 mb-1">ملاحظات الطلبية</label>
                                  <input 
                                    type="text"
                                    value={focusEditDraft?.notes || ''}
                                    onChange={(e) => setFocusEditDraft({...focusEditDraft, notes: e.target.value})} onBlur={(e) => updateOrder(focusedOrder.id, { notes: e.target.value })}
                                    className="w-full p-2 bg-white rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                                  />
                                </div>
                            </div>
                                                        {/* Tags Section */}
                            <div className="lg:col-span-3 border-t pt-3 mt-1">
                                <label className="block text-[10px] text-slate-400 mb-2">تاغات الطلبية (Tags)</label>
                                <div className="flex flex-wrap gap-2 items-center">
                                    {getOrderTagsHistory(focusedOrder, settings?.tags || []).map((t) => (
                                        <span
                                            key={t.id}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black border shadow-2xs bg-slate-100 text-slate-700 border-slate-200"
                                        >
                                            <span>{t.name}</span>
                                            <button
                                                onClick={() => {
                                                    const result = removeTagFromOrder(focusedOrder, t.id);
                                                    updateOrder(focusedOrder.id, {
                                                        tag: result.tag,
                                                        tagsHistory: result.tagsHistory,
                                                    });
                                                }}
                                                className="hover:text-rose-600 p-0.5 rounded-md transition-colors cursor-pointer"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                    <select
                                        value=""
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                const result = addTagToOrder(focusedOrder, e.target.value, settings?.tags || []);
                                                updateOrder(focusedOrder.id, {
                                                    tag: result.tag,
                                                    tagsHistory: result.tagsHistory,
                                                });
                                                e.target.value = '';
                                            }
                                        }}
                                        className="bg-indigo-50 text-indigo-900 text-[11px] font-black px-2 py-1.5 rounded-xl border border-indigo-200 outline-none cursor-pointer"
                                    >
                                        <option value="">+ إضافة تاغ جديد</option>
                                        {(settings?.tags || []).map((t: any) => (
                                            <option key={t.name} value={t.name}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                          </div>
                       </div>
                    </div>
                    {/* Actions Panel */}
                    <div className="w-full md:w-64 shrink-0 flex flex-col gap-3">
                       <button
                         onClick={() => {
                            let nextOrderId = null;
                            if (currentIndex > -1 && currentIndex < filteredOrders.length - 1) {
                               nextOrderId = filteredOrders[currentIndex + 1].id;
                            }
                            updateOrder(focusedOrder.id, { ...focusEditDraft, status1: 'مؤكد' });
                            toast.success('تم تأكيد الطلبية');
                            if (nextOrderId) setFocusModeOrderId(nextOrderId);
                         }}
                         className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-black transition-all shadow-md active:scale-95"
                       >
                         <CheckCircle className="w-5 h-5" />
                         تأكيد الطلبية (مؤكد)
                       </button>

                       <button
                         onClick={() => {
                            let nextOrderId = null;
                            if (currentIndex > -1 && currentIndex < filteredOrders.length - 1) {
                               nextOrderId = filteredOrders[currentIndex + 1].id;
                            }
                            updateOrder(focusedOrder.id, { ...focusEditDraft, status1: 'ملغى' });
                            toast.success('تم إلغاء الطلبية');
                            if (nextOrderId) setFocusModeOrderId(nextOrderId);
                         }}
                         className="w-full bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-200 p-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-black transition-all"
                       >
                         <XCircle className="w-4 h-4" />
                         إلغاء الطلبية (ملغى)
                       </button>
                       
                       <button
                         onClick={() => {
                            let nextOrderId = null;
                            if (currentIndex > -1 && currentIndex < filteredOrders.length - 1) {
                               nextOrderId = filteredOrders[currentIndex + 1].id;
                            }
                            updateOrder(focusedOrder.id, { ...focusEditDraft, status1: 'مؤجل' });
                            toast.success('تم تأجيل الطلبية');
                            if (nextOrderId) setFocusModeOrderId(nextOrderId);
                         }}
                         className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 p-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-black transition-all"
                       >
                         <Clock className="w-4 h-4 text-slate-500" />
                         تأجيل (مؤجل)
                       </button>

                       <hr className="my-2 border-slate-200" />

                       {shippingIntegration ? (
                         <button
                           disabled={shippingLoading === focusedOrder.id}
                           onClick={() => handlePushToShipping(focusedOrder, shippingIntegration)}
                           className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-black transition-all shadow-md active:scale-95 disabled:opacity-50"
                         >
                           {shippingLoading === focusedOrder.id ? (
                             <RefreshCw className="w-5 h-5 animate-spin" />
                           ) : (
                             <Truck className="w-5 h-5" />
                           )}
                           إرسال لشركة الشحن
                         </button>
                       ) : (
                         <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold text-center">
                           يرجى إضافة إعدادات شركة الشحن لتفعيل زر الإرسال.
                         </div>
                       )}
                    </div>
                  </div>

                  {/* Modal Footer (Navigation & Global Actions) */}
                  <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap justify-between items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                           if (currentIndex > -1 && currentIndex < filteredOrders.length - 1) {
                              setFocusModeOrderId(filteredOrders[currentIndex + 1].id);
                           }
                        }}
                        disabled={currentIndex === filteredOrders.length - 1}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:opacity-50 text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-sm"
                        title="الطلبية التالية (سهم يسار)"
                      >
                        التالي <ArrowLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                           if (currentIndex > 0) {
                              setFocusModeOrderId(filteredOrders[currentIndex - 1].id);
                           }
                        }}
                        disabled={currentIndex === 0}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:opacity-50 text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-sm"
                        title="الطلبية السابقة (سهم يمين)"
                      >
                        <ArrowRight className="w-4 h-4" /> السابق
                      </button>
                      <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-inner">
                         طلبية {currentIndex + 1} من {filteredOrders.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 hidden sm:inline mr-2">استخدم ◄ ► للتنقل</span>
                      <button
                        onClick={() => setFocusModeOrderId(null)}
                        className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-black px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md"
                      >
                        إنهاء وضع التركيز
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      
      {/* View Order Modal */}
      {viewOrderModal && (
        <ViewOrderModal order={viewOrderModal} onClose={() => setViewOrderModal(null)} />
      )}
      <ReplaceOrderModal originalOrder={replaceOrderModal} isOpen={!!replaceOrderModal} onClose={() => setReplaceOrderModal(null)} />

      {/* Manual SMS Modal */}
      {smsModalOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fadeIn" dir="rtl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 text-right">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-gray-800">إرسال رسالة نصية للزبون</h3>
              </div>
              <button onClick={() => setSmsModalOrder(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-right">
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 text-xs text-emerald-800">
                <p><strong>اسم الزبون:</strong> {smsModalOrder.customerName || smsModalOrder.fullName}</p>
                <p className="mt-1"><strong>رقم الهاتف:</strong> {smsModalOrder.phone}</p>
                <p className="mt-1"><strong>حالة الطلبية الحالية:</strong> {smsModalOrder.status2 || smsModalOrder.status1 || 'جديد'}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">اختر قالب سريع</label>
                <select
                  onChange={(e) => {
                    const templates = settings?.smsTemplates || {};
                    const key = e.target.value;
                    if (key) {
                      const rawTemplate = templates[key] || '';
                      if (rawTemplate) {
                        const filled = rawTemplate
                          .replace(/{customer_name}/g, smsModalOrder.customerName || smsModalOrder.fullName || '')
                          .replace(/{order_id}/g, smsModalOrder.orderId || '')
                          .replace(/{tracking_id}/g, smsModalOrder.shippingTrackingId || '')
                          .replace(/{delivery_company}/g, smsModalOrder.deliveryCompany || '')
                          .replace(/{store_name}/g, smsModalOrder.sourceChannel || 'متجرنا')
                          .replace(/{total}/g, `${smsModalOrder.totalCharge || 0}`);
                        setSmsModalMessage(filled);
                      }
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- اختر قالباً لتطبيقه --</option>
                  <option value="confirmation">قالب تأكيد الطلب</option>
                  <option value="shipping">قالب شحن الطلبية</option>
                  <option value="out_for_delivery">قالب قيد التوصيل (في الطريق)</option>
                  <option value="return">قالب مرتجع للطلب</option>
                  <option value="abandoned">قالب تذكير بالسلة المتروكة</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-400">سيتم إرسالها عبر بوابة: {settings?.smsGateway === 'twilio' ? 'Twilio' : 'SMS Algerie'}</span>
                  <label className="block text-xs font-bold text-gray-700">محتوى الرسالة</label>
                </div>
                <textarea
                  rows={4}
                  value={smsModalMessage}
                  onChange={(e) => setSmsModalMessage(e.target.value)}
                  placeholder="اكتب رسالتك المخصصة هنا للزبون..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  dir="auto"
                />
              </div>

              {smsModalStatus && (
                <div className={`p-3 rounded-lg text-xs font-medium border ${smsModalStatus.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {smsModalStatus.message}
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-3 flex justify-end gap-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSmsModalOrder(null)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                disabled={smsModalLoading}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSendManualSms}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                disabled={smsModalLoading || !smsModalMessage.trim()}
              >
                {smsModalLoading ? 'جاري الإرسال...' : 'إرسال الرسالة الآن'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Integrity Safeguard Protection Modal */}
      <IntegrityProtectionModal
        isOpen={showIntegrityModal}
        onClose={() => {
          setShowIntegrityModal(false);
          setIntegrityBlockResult(null);
          setBlockedOrderForSafeAction(null);
        }}
        checkResult={integrityBlockResult}
        onSafeAction={blockedOrderForSafeAction ? handleSafeArchiveOrder : undefined}
      />

      {showPickingList && (
        <PickingListModal 
          orders={filteredOrders} 
          allShippedOrders={orders.filter(o => !o.trashed && !o.archived)}
          onClose={() => setShowPickingList(false)} 
        />
      )}
    </div>
  );
}
