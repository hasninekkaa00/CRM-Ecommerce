import React, { useMemo, useState } from 'react';
import { 
  X, 
  Printer, 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Search, 
  Layers, 
  Boxes,
  Filter,
  RefreshCw,
  Eye,
  Maximize2,
  Minimize2,
  ArrowRightLeft,
  Edit2,
  ExternalLink,
  Phone,
  MapPin,
  Truck,
  Calendar,
  User,
  DollarSign,
  Tag,
  AlignLeft,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { useStore } from '../../store';
import { getAttemptCount } from '../../utils/orderUtils';
import { calculateDynamicStock } from '../../utils/inventoryCalc';
import { getProductDisplayPrice, getProductDisplayCost, getProductCostValue } from '../../utils/productCostUtils';
import { DeficitListModal } from '../inventory/DeficitListModal';
import { QuickReclassifyModal } from './QuickReclassifyModal';
import { ViewOrderModal } from './ViewOrderModal';
import { triggerPrint } from '../../utils/printUtils';

interface PickingListModalProps {
  orders: any[]; // Filtered or passed orders
  allShippedOrders?: any[]; // Full list of candidate orders
  onClose: () => void;
}

interface OrderRef {
  order: any;
  requiredQty: number;
}

interface VariationItem {
  id: string;
  productName: string;
  variationName: string;
  displayVariation: string;
  sku: string;
  unitPrice: string | number;
  unitCost: string | number;
  requiredQty: number;
  orders: OrderRef[];
  availableStock: number;
  hasInventoryMatch: boolean;
  stockStatusStr: string;
  isShortage: boolean;
  deficitQty: number;
}

interface ProductGroup {
  productName: string;
  productSku: string;
  displayPrice: string;
  displayCost: string;
  totalQty: number;
  totalVariantsCount: number;
  readyVariantsCount: number;
  isFullyPrepared: boolean;
  hasShortage: boolean;
  variations: VariationItem[];
}

// Arabic & text normalization helper for accurate matching
function normalizeText(text: any): string {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // Remove tashkeel/diacritics
    .replace(/[-_/\\|:,.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactSku(sku: any): string {
  if (!sku) return '';
  return String(sku)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]/gi, '');
}

// Helper safe quantity extractor
function getSafeQty(qval: any): number {
  if (qval === undefined || qval === null || qval === '') return 1;
  if (typeof qval === 'number') return isNaN(qval) || qval <= 0 ? 1 : qval;
  const digits = String(qval).match(/\d+/);
  const parsed = digits ? parseInt(digits[0], 10) : 1;
  return isNaN(parsed) || parsed <= 0 ? 1 : parsed;
}

// Helper to extract tokens for exact token set matching
function extractTokens(str: string): string[] {
  return normalizeText(str)
    .split(/[\s\-_/\\|:,\.]+/)
    .filter(Boolean);
}

// Clean variation display name
function cleanVariationName(varName: string, prodName: string): string {
  if (!varName) return '';
  let cleaned = String(varName).trim();
  if (
    cleaned === '-' || 
    cleaned.toLowerCase() === 'null' || 
    cleaned.toLowerCase() === 'undefined' || 
    cleaned.toLowerCase() === 'default' || 
    cleaned.toLowerCase() === 'none'
  ) {
    return '';
  }
  // If variation starts with product name, strip it
  if (prodName && cleaned.toLowerCase().startsWith(prodName.toLowerCase() + ' - ')) {
    cleaned = cleaned.substring(prodName.length + 3).trim();
  } else if (prodName && cleaned.toLowerCase().startsWith(prodName.toLowerCase() + ': ')) {
    cleaned = cleaned.substring(prodName.length + 2).trim();
  }
  return cleaned;
}

// Helper to extract all items/variants from an order (handles arrays, JSON strings, single items, compound variation packs, multi-SKU strings)
function parseOrderItems(order: any, inventoryProducts: any[] = []): Array<{ productName: string; variation: string; sku: string; quantity: number }> {
  const results: Array<{ productName: string; variation: string; sku: string; quantity: number }> = [];

  // Check if order has items in array or stringified JSON format
  let rawItems = order.items || order.products || order.line_items || order.cart || order.orderedItems;
  
  if (typeof rawItems === 'string') {
    try {
      rawItems = JSON.parse(rawItems);
    } catch {
      rawItems = null;
    }
  }

  if (Array.isArray(rawItems) && rawItems.length > 0) {
    // If order was converted to a single product or has 1 item, ensure updated root values take precedence
    if (rawItems.length === 1) {
      const item = rawItems[0];
      const itName = String(order.productName || item.name || item.product_name || item.productName || item.title || 'منتج غير محدد').trim();
      const itVar = order.variation !== undefined && String(order.variation).trim() !== ''
        ? String(order.variation).trim()
        : (item.variation || item.variation_name || item.variationName || '');
      const itSku = String(order.sku || item.sku || item.variation_sku || item.product_sku || '').trim();
      const itQty = getSafeQty(order.qnts ?? order.quantity ?? item.quantity ?? item.qnts ?? 1);

      results.push({
        productName: itName,
        variation: cleanVariationName(String(itVar), itName),
        sku: itSku,
        quantity: itQty
      });
      return results;
    }

    // If order has multiple raw items, but order.productName is a single product that does not contain '+'
    // and doesn't match the multi-items, the order was updated to a single product:
    const mainProdName = String(order.productName || '').trim();
    if (mainProdName && !mainProdName.includes('+') && !rawItems.some(it => (it.name || it.productName) === mainProdName)) {
      results.push({
        productName: mainProdName,
        variation: cleanVariationName(String(order.variation || ''), mainProdName),
        sku: String(order.sku || '').trim(),
        quantity: getSafeQty(order.qnts ?? order.quantity ?? 1)
      });
      return results;
    }

    rawItems.forEach((item: any, idx: number) => {
      const itName = item.name || item.product_name || item.productName || item.title || order.productName || 'منتج غير محدد';
      
      let itVar = item.variation || item.variation_name || item.variationName || item.variant_title || item.variant || item.options || '';
      
      if (Array.isArray(itVar)) {
        itVar = itVar.map((a: any) => (typeof a === 'object' ? (a.option || a.value || a.name || '') : String(a))).filter(Boolean).join(' - ');
      } else if (typeof itVar === 'object' && itVar !== null) {
        itVar = Object.values(itVar).join(' - ');
      }

      if (!itVar && Array.isArray(item.meta_data) && item.meta_data.length > 0) {
        const metaVals = item.meta_data
          .filter((m: any) => !String(m.key || '').startsWith('_'))
          .map((m: any) => String(m.value || '').trim())
          .filter(Boolean);
        if (metaVals.length > 0) {
          itVar = metaVals.join(' - ');
        }
      }

      let itSku = item.sku || item.variation_sku || item.product_sku || '';
      if (!itSku && order.sku) {
        const skuTokens = String(order.sku).split(/[,;+]+/).map((s: string) => s.trim()).filter(Boolean);
        if (skuTokens[idx]) {
          itSku = skuTokens[idx];
        } else if (skuTokens.length === 1) {
          itSku = skuTokens[0];
        }
      }

      if (!itSku && inventoryProducts && inventoryProducts.length > 0) {
        const normName = normalizeText(itName);
        for (const p of inventoryProducts) {
          if (Array.isArray(p.variations) && itVar) {
            const vNorm = normalizeText(cleanVariationName(String(itVar), itName));
            const foundV = p.variations.find((v: any) => normalizeText(cleanVariationName(v.name || '', p.name)) === vNorm);
            if (foundV && foundV.sku) {
              itSku = foundV.sku;
              break;
            }
          }
          if (normalizeText(p.name) === normName && p.sku) {
            itSku = p.sku;
            break;
          }
        }
      }

      const itQty = getSafeQty(item.quantity ?? item.qnts ?? item.qty ?? 1);

      // Check if itVar contains multiple split variations with explicit + (e.g. "2 x أحمر + 1 x أزرق")
      const subItems = trySplitExplicitPlusVariation(itName, itVar, itSku, itQty);
      if (subItems.length > 0) {
        results.push(...subItems);
      } else {
        results.push({
          productName: String(itName).trim(),
          variation: cleanVariationName(String(itVar), itName),
          sku: String(itSku).trim(),
          quantity: itQty
        });
      }
    });
    return results;
  }

  // Single product order fallback
  const mainName = String(order.productName || 'منتج غير محدد').trim();
  const mainVar = String(order.variation || '').trim();
  const mainSku = String(order.sku || '').trim();
  const mainQty = getSafeQty(order.qnts);

  // If order has multiple products in title separated by '+' e.g. "منتج 1 + منتج 2"
  if (mainName.includes('+')) {
    const nameParts = mainName.split('+').map(s => s.trim()).filter(Boolean);
    if (nameParts.length > 1) {
      const varParts = mainVar ? mainVar.split('+').map(s => s.trim()).filter(Boolean) : [];
      const skuParts = mainSku ? mainSku.split(/[,;\+]+/).map(s => s.trim()).filter(Boolean) : [];
      
      nameParts.forEach((nPart, idx) => {
        results.push({
          productName: nPart,
          variation: cleanVariationName(varParts[idx] || (varParts.length === 1 ? varParts[0] : ''), nPart),
          sku: skuParts[idx] || (skuParts.length === 1 ? skuParts[0] : ''),
          quantity: mainQty
        });
      });
      return results;
    }
  }

  // Check if mainSku has multiple comma or plus separated SKUs that match inventory variations
  if (mainSku && (mainSku.includes(',') || mainSku.includes('+') || mainSku.includes(';'))) {
    const rawSkuParts = mainSku.split(/[,;\+]+/).map(s => s.trim()).filter(Boolean);
    if (rawSkuParts.length > 1) {
      const allKnownSkus = new Set<string>();
      (inventoryProducts || []).forEach((p: any) => {
        if (p.sku) allKnownSkus.add(p.sku.trim().toLowerCase());
        if (Array.isArray(p.variations)) {
          p.variations.forEach((v: any) => {
            if (v.sku) allKnownSkus.add(v.sku.trim().toLowerCase());
          });
        }
      });

      const matchedCount = rawSkuParts.filter(s => allKnownSkus.has(s.toLowerCase())).length;
      if (matchedCount >= 1) {
        rawSkuParts.forEach(s => {
          results.push({
            productName: mainName,
            variation: '',
            sku: s,
            quantity: 1
          });
        });
        return results;
      }
    }
  }

  // Check if mainVar contains multiple split variations with explicit + (e.g. "2 x أسود + 1 x أحمر")
  const subItems = trySplitExplicitPlusVariation(mainName, mainVar, mainSku, mainQty);
  if (subItems.length > 0) {
    results.push(...subItems);
  } else {
    results.push({
      productName: mainName,
      variation: cleanVariationName(mainVar, mainName),
      sku: mainSku,
      quantity: mainQty
    });
  }

  return results;
}

// Split compound variation strings ONLY when explicit '+' with counts is present (e.g. "2 x أحمر + 1 x أزرق" or "أحمر (2) + أسود (1)")
function trySplitExplicitPlusVariation(
  prodName: string, 
  varStr: string, 
  skuStr: string, 
  totalQty: number
): Array<{ productName: string; variation: string; sku: string; quantity: number }> {
  if (!varStr || typeof varStr !== 'string') return [];
  const trimmed = varStr.trim();

  // ONLY split if there is an explicit '+' sign
  if (!trimmed.includes('+')) return [];

  const parts = trimmed.split('+').map(p => p.trim()).filter(Boolean);
  if (parts.length <= 1) return [];

  const parsedSubItems: Array<{ productName: string; variation: string; sku: string; quantity: number }> = [];

  for (const part of parts) {
    let q = 1;
    let vName = part;

    const patternParenthesis = part.match(/^(.*?)\s*\((\d+)\s*(?:قطع|حبات|حبة|قطعة|pcs)?\)$/i);
    const patternPrefixMult = part.match(/^(\d+)\s*(?:x|×|\*)\s*(.*?)$/i);
    const patternSuffixMult = part.match(/^(.*?)\s*(?:x|×|\*)\s*(\d+)$/i);
    const patternLeadingNum = part.match(/^(\d+)\s+([^\d]+.*)$/);

    if (patternParenthesis) {
      vName = patternParenthesis[1].trim();
      q = parseInt(patternParenthesis[2], 10) || 1;
    } else if (patternPrefixMult) {
      q = parseInt(patternPrefixMult[1], 10) || 1;
      vName = patternPrefixMult[2].trim();
    } else if (patternSuffixMult) {
      vName = patternSuffixMult[1].trim();
      q = parseInt(patternSuffixMult[2], 10) || 1;
    } else if (patternLeadingNum && !['pack', 'pack2', 'pack3', 'set'].includes(patternLeadingNum[1].toLowerCase())) {
      q = parseInt(patternLeadingNum[1], 10) || 1;
      vName = patternLeadingNum[2].trim();
    }

    if (vName) {
      parsedSubItems.push({
        productName: prodName,
        variation: cleanVariationName(vName, prodName),
        sku: skuStr,
        quantity: q
      });
    }
  }

  if (parsedSubItems.length > 1) {
    return parsedSubItems;
  }

  return [];
}

const getStatus1Badge = (val: string) => {
  switch (val) {
    case 'جديد': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'مؤكد': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'ملغى': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'مؤجل': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'قيد المراجعة': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'لا يرد': return 'bg-gray-100 text-gray-700 border-gray-300';
    default: return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

const getStatus2Badge = (val: string) => {
  switch (val) {
    case 'قيد التجهيز': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'تم الشحن': return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'في الطريق': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'مستلم': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'مرتجع': return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'قابلة للشحن': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'جاهز للشحن': return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'لم يتم الشحن': return 'bg-slate-100 text-slate-700 border-slate-200';
    default: return 'bg-gray-50 text-gray-600 border-gray-200';
  }
};


// Helper to accurately determine "تم الشحن" vs "في الطريق" vs others
const mapStatusToStatus2 = (statusText: string, order?: any) => {
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

    // 1. Ready / Created / Ready to Ship (جاهزة للإرسال / prêt à expédier / crééd) -> تم الشحن
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

    // 2. Explicit Delivered / Received -> مستلم
    if (
      s.includes('تم التوصيل') || s.includes('تم تحصيل المبلغ') || s.includes('تم الدفع للمتجر') || 
      s.includes('livred') || s.includes('encaissed') || s.includes('payed') || s.includes('paid') ||
      s.includes('livré') || s.includes('livre') || s.includes('delivered') || 
      (s.includes('توصيل') && !s.includes('محاولة') && !s.includes('شركة التوصيل') && !s.includes('قيد') && !s.includes('رسوم') && !s.includes('إلى') && !s.includes('مركز')) ||
      (s.includes('مستلم') && !s.includes('مركز الفرز') && !s.includes('استلام') && !s.includes('شركة'))
    ) {
      return 'مستلم';
    }

    // 3. Explicit Returned -> مرتجع
    if (
      s.includes('مرتجع') || s.includes('طلب إرجاع') || s.includes('فشل') || s.includes('إرجاع') || s.includes('مسترجع') ||
      s.includes('return') || s.includes('returned') || s.includes('retour') || s.includes('échoué') || 
      s.includes('annul') || s.includes('echec') || s.includes('echoue') || s.includes('echoué') || s.includes('canceled') || s.includes('cancelled')
    ) {
      return 'مرتجع';
    }

    // 4. In Transit / Sorting Center / Out for Delivery -> في الطريق
    if (
      s.includes('محاولة توصيل') || s.includes('قيد التوصيل') || s.includes('قيد التوزيع') || s.includes('محاولة') ||
      s.includes('مركز الفرز') || s.includes('الفرز') || s.includes('موزعة للمندوب') || s.includes('في الطريق') ||
      s.includes('sortie') || s.includes('distribution') || s.includes('hub') || s.includes('centre de tri') || s.includes('transit') ||
      s.includes('cours') || s.includes('vers') || s.includes('route') || s.includes('توجيه') || s.includes('dispatch') ||
      s.includes('sorti') || s.includes('transfert') || s.includes('transfer') || s.includes('voyage') || s.includes('en voyage') ||
      ((s.includes('expedie') || s.includes('expédié') || s.includes('expédition') || s.includes('expedition')) && !s.includes('prêt') && !s.includes('pret') && !s.includes('جاهز'))
    ) {
      return 'في الطريق';
    }

    if (order && getAttemptCount(order) > 0) {
      return 'في الطريق';
    }

    return 'تم الشحن';
};

export function PickingListModal({ orders: passedOrders, allShippedOrders, onClose }: PickingListModalProps) {
  const { inventoryProducts, settings, purchaseInvoices, orders: allOrders } = useStore();
  const isLocal = settings?.inventoryManagementMode === 'local';
  
  // Scope selection: allows viewing all preparation orders or filtered orders
  const [orderScope, setOrderScope] = useState<'all_preparation' | 'current_filtered'>('all_preparation');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // UI state
  const [isMaximized, setIsMaximized] = useState(false);
  const [showStats, setShowStats] = useState(false); // Collapsed by default or toggleable to give maximum vertical workspace
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'deficit' | 'pending' | 'ready'>('all');
  const [showDeficitModal, setShowDeficitModal] = useState(false);

  // Sub modals for editing/viewing orders
  const [reclassifyingOrderData, setReclassifyingOrderData] = useState<{ order: any; variationText?: string; productNameText?: string; skuText?: string; quantity?: number } | null>(null);
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);

  // Compute the pool of orders based on orderScope and selectedStatusFilter
  const activeOrders = useMemo(() => {
    const fullCandidateList = allShippedOrders && allShippedOrders.length > 0 
      ? allShippedOrders 
      : (allOrders || []).filter((o: any) => !o.trashed);
      
    let baseList = orderScope === 'current_filtered' ? passedOrders : fullCandidateList;

    // Rule: يتم اعتماد قائمة التجهيز بناءا على المنتجات التي تم تمريرها الى طلبيات المشحونة و حالتها تم الشحن فقط
    baseList = baseList.filter((o: any) => mapStatusToStatus2(o.status2 || '', o) === 'تم الشحن');

    return baseList;
  }, [orderScope, passedOrders, allShippedOrders, allOrders]);

  const toggleCheck = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroupCheck = (group: ProductGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    const allChecked = group.variations.every(v => checkedItems.has(v.id));
    setCheckedItems(prev => {
      const next = new Set(prev);
      group.variations.forEach(v => {
        if (allChecked) {
          next.delete(v.id);
        } else {
          next.add(v.id);
        }
      });
      return next;
    });
  };

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroupCollapse = (productName: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(productName)) next.delete(productName);
      else next.add(productName);
      return next;
    });
  };

  const handleExpandAllGroups = () => {
    setCollapsedGroups(new Set());
  };

  const handleCollapseAllGroups = () => {
    const allGroupNames = new Set(productGroups.map(g => g.productName));
    setCollapsedGroups(allGroupNames);
  };

  const handleCheckAll = () => {
    const allIds = new Set<string>();
    productGroups.forEach(g => {
      g.variations.forEach(v => allIds.add(v.id));
    });
    setCheckedItems(allIds);
  };

  const handleUncheckAll = () => {
    setCheckedItems(new Set());
  };

  // 1. Group & aggregate orders by base product and unified variants
  const productGroups: ProductGroup[] = useMemo(() => {
    // A. Pre-index inventory products for instant, authoritative SKU lookups
    const invExactSkuMap = new Map<string, { parent: any; variation: any }>();
    const invCompactSkuMap = new Map<string, { parent: any; variation: any }>();
    const invNormalizedNameMap = new Map<string, any>();

    (inventoryProducts || []).forEach((p: any) => {
      if (!p) return;
      if (p.name) invNormalizedNameMap.set(normalizeText(p.name), p);

      if (p.sku) {
        const exact = p.sku.trim().toLowerCase();
        const comp = compactSku(p.sku);
        if (exact) invExactSkuMap.set(exact, { parent: p, variation: null });
        if (comp) invCompactSkuMap.set(comp, { parent: p, variation: null });
      }

      if (Array.isArray(p.variations)) {
        p.variations.forEach((v: any) => {
          if (!v) return;
          if (v.sku) {
            const vExact = v.sku.trim().toLowerCase();
            const vComp = compactSku(v.sku);
            if (vExact) invExactSkuMap.set(vExact, { parent: p, variation: v });
            if (vComp) invCompactSkuMap.set(vComp, { parent: p, variation: v });
          }
        });
      }
    });

    // B. Parse all items across active orders
    const allParsedItems: Array<{ productName: string; variation: string; sku: string; quantity: number; order: any }> = [];
    activeOrders.forEach(order => {
      const orderItems = parseOrderItems(order, inventoryProducts);
      orderItems.forEach(item => {
        allParsedItems.push({
          productName: item.productName,
          variation: item.variation,
          sku: item.sku,
          quantity: item.quantity,
          order
        });
      });
    });

    // C. Pre-index unlisted items by SKU so all items sharing the same SKU share the same canonical product name
    const unlistedSkuCanonicalMap = new Map<string, { canonicalName: string; canonicalSku: string }>();
    const skuCandidates = new Map<string, { names: string[]; originalSkus: string[] }>();

    allParsedItems.forEach(item => {
      const cSku = compactSku(item.sku);
      if (!cSku) return;
      // If already matches inventory, inventory is the canonical source
      if (invCompactSkuMap.has(cSku) || invExactSkuMap.has((item.sku || '').trim().toLowerCase())) {
        return;
      }
      if (!skuCandidates.has(cSku)) {
        skuCandidates.set(cSku, { names: [], originalSkus: [] });
      }
      const entry = skuCandidates.get(cSku)!;
      const cleanN = (item.productName || '').trim();
      if (cleanN && cleanN !== 'منتج غير محدد') {
        entry.names.push(cleanN);
      }
      if (item.sku && !entry.originalSkus.includes(item.sku.trim())) {
        entry.originalSkus.push(item.sku.trim());
      }
    });

    skuCandidates.forEach((data, cSku) => {
      // Pick best name: prefer longest non-generic name or most frequent
      let bestName = 'منتج غير محدد';
      if (data.names.length > 0) {
        const freqMap = new Map<string, number>();
        data.names.forEach(n => freqMap.set(n, (freqMap.get(n) || 0) + 1));
        let maxCount = 0;
        freqMap.forEach((count, n) => {
          if (count > maxCount || (count === maxCount && n.length > bestName.length)) {
            maxCount = count;
            bestName = n;
          }
        });
      }
      const bestSku = data.originalSkus[0] || cSku;
      unlistedSkuCanonicalMap.set(cSku, { canonicalName: bestName, canonicalSku: bestSku });
    });

    // Map to hold aggregated items: key = canonical unique key
    const rawMap = new Map<string, {
      canonicalKey: string;
      groupKey: string;
      parentName: string;
      variationName: string;
      displayVariation: string;
      sku: string;
      qty: number;
      orders: OrderRef[];
      matchedParent: any;
      matchedVariation: any;
    }>();

    // Helper to resolve canonical identity with 100% SKU priority & strict product boundaries
    const resolveItemIdentity = (pName: string, vName: string, skuStr: string) => {
      const cleanPName = (pName || 'منتج غير محدد').trim();
      const rawVName = (vName || '').trim();
      const cleanSku = (skuStr || '').trim();
      let dispVName = cleanVariationName(rawVName, cleanPName);
      const normPName = normalizeText(cleanPName);
      const normSku = cleanSku.toLowerCase();
      const cSku = compactSku(cleanSku);

      let matchedParent: any = null;
      let matchedVariation: any = null;

      // =========================================================================
      // STAGE 0: Match by SKU FIRST (Strictly Authoritative - no restrictive name filtering)
      // =========================================================================
      if (cleanSku) {
        const skuMatch = invExactSkuMap.get(normSku) || (cSku ? invCompactSkuMap.get(cSku) : null);
        if (skuMatch) {
          matchedParent = skuMatch.parent;
          matchedVariation = skuMatch.variation;
        }
      }

      // =========================================================================
      // STAGE 1: Match Parent Product if not matched by SKU
      // =========================================================================
      if (!matchedParent && normPName && normPName !== 'منتج غير محدد') {
        // 1A. Exact normalized product name match
        matchedParent = invNormalizedNameMap.get(normPName);

        // 1B. Word-boundary prefix match
        if (!matchedParent) {
          for (const p of (inventoryProducts || [])) {
            if (!p.name) continue;
            const pNorm = normalizeText(p.name);
            if (normPName.startsWith(pNorm + ' ') || normPName.startsWith(pNorm + ' -') || normPName === pNorm) {
              matchedParent = p;
              if (!dispVName) {
                const remainder = cleanPName.substring(p.name.length).replace(/^[-_/\\|:\s]+/, '').trim();
                if (remainder) {
                  dispVName = cleanVariationName(remainder, p.name);
                }
              }
              break;
            }
          }
        }
      }

      // =========================================================================
      // STAGE 2: If matchedParent is found and has variations, resolve variation if not matched yet
      // =========================================================================
      if (matchedParent && !matchedVariation && Array.isArray(matchedParent.variations) && matchedParent.variations.length > 0) {
        const candidateVarText = dispVName || rawVName;
        const targetNormVar = normalizeText(candidateVarText);

        // 2A. Match variation SKU
        if (cleanSku) {
          matchedVariation = matchedParent.variations.find((v: any) => {
            const vSku = (v.sku || '').trim().toLowerCase();
            return vSku && (vSku === normSku || (cSku && compactSku(vSku) === cSku));
          });
        }

        // 2B. Check if variation string itself is an SKU
        if (!matchedVariation && candidateVarText) {
          const targetVarSku = candidateVarText.trim().toLowerCase();
          const cVarSku = compactSku(targetVarSku);
          matchedVariation = matchedParent.variations.find((v: any) => {
            const vSku = (v.sku || '').trim().toLowerCase();
            return vSku && (vSku === targetVarSku || (cVarSku && compactSku(vSku) === cVarSku));
          });
        }

        // 2C. Exact normalized variation name or attribute match
        if (!matchedVariation && targetNormVar) {
          matchedVariation = matchedParent.variations.find((v: any) => {
            if (v.name && normalizeText(cleanVariationName(v.name, matchedParent.name)) === targetNormVar) return true;
            const attrStr = normalizeText(v.attributes?.map((a: any) => a.option || a.value || '').filter(Boolean).join(' ') || '');
            if (attrStr && attrStr === targetNormVar) return true;
            return false;
          });
        }

        // 2D. Individual attribute option match
        if (!matchedVariation && targetNormVar) {
          matchedVariation = matchedParent.variations.find((v: any) => {
            if (Array.isArray(v.attributes)) {
              return v.attributes.some((a: any) => {
                const optVal = a.option || a.value || '';
                return optVal && normalizeText(optVal) === targetNormVar;
              });
            }
            return false;
          });
        }

        // 2E. Strict token set equality
        if (!matchedVariation && targetNormVar) {
          const targetTokensSorted = extractTokens(targetNormVar).sort().join(' ');
          if (targetTokensSorted) {
            matchedVariation = matchedParent.variations.find((v: any) => {
              const vTokens = extractTokens(cleanVariationName(v.name || '', matchedParent.name)).sort().join(' ');
              const attrTokens = extractTokens(v.attributes?.map((a: any) => a.option || a.value || '').filter(Boolean).join(' ') || '').sort().join(' ');
              return (vTokens && vTokens === targetTokensSorted) || (attrTokens && attrTokens === targetTokensSorted);
            });
          }
        }
      }

      // =========================================================================
      // STAGE 3: Derive canonical names, display variations, and SKU
      // =========================================================================
      let finalParentName = matchedParent?.name;
      if (!finalParentName) {
        if (cSku && unlistedSkuCanonicalMap.has(cSku)) {
          finalParentName = unlistedSkuCanonicalMap.get(cSku)!.canonicalName;
        } else {
          finalParentName = cleanPName;
        }
      }

      let finalVarName = dispVName;
      if (matchedVariation) {
        if (Array.isArray(matchedVariation.attributes) && matchedVariation.attributes.length > 0) {
          const opts = matchedVariation.attributes.map((a: any) => (a.option || a.value || a.name || '').trim()).filter(Boolean).join(' - ');
          if (opts) {
            finalVarName = opts;
          }
        }
        if (!finalVarName && matchedVariation.name) {
          finalVarName = cleanVariationName(matchedVariation.name, finalParentName);
        }
        if (!finalVarName) {
          finalVarName = dispVName || matchedVariation.sku || 'نوع محدد';
        }
      } else if (!finalVarName) {
        if (matchedParent?.variations?.length) {
          finalVarName = 'نوع غير محدد';
        } else {
          finalVarName = 'منتج أساسي (بدون نوع)';
        }
      }

      let finalSku = matchedVariation?.sku || cleanSku || matchedParent?.sku || '';
      if (!finalSku && cSku && unlistedSkuCanonicalMap.has(cSku)) {
        finalSku = unlistedSkuCanonicalMap.get(cSku)!.canonicalSku;
      }

      // STAGE 4: Construct deterministic canonical key to NEVER mix different variations or split items
      let canonicalKey = '';
      let groupKey = '';

      if (matchedParent) {
        groupKey = `inv_p_${matchedParent.id || normalizeText(matchedParent.name)}`;
        if (matchedVariation) {
          const vKey = matchedVariation.id || compactSku(matchedVariation.sku) || normalizeText(finalVarName);
          canonicalKey = `${groupKey}_var_${vKey}`;
        } else {
          const vKey = compactSku(finalSku) || normalizeText(finalVarName) || 'main';
          canonicalKey = `${groupKey}_custvar_${vKey}`;
        }
      } else {
        // Unlisted product
        const cFinalSku = compactSku(finalSku);
        groupKey = cFinalSku ? `unlisted_sku_${cFinalSku}` : `unlisted_name_${normalizeText(finalParentName)}`;
        const vKey = normalizeText(finalVarName) || cFinalSku || 'main';
        canonicalKey = `${groupKey}_var_${vKey}`;
      }

      return {
        canonicalKey,
        groupKey,
        parentName: finalParentName,
        variationName: rawVName,
        displayVariation: finalVarName,
        sku: finalSku,
        matchedParent,
        matchedVariation
      };
    };

    const addItem = (pName: string, vName: string, skuStr: string, qty: number, order: any) => {
      const resolved = resolveItemIdentity(pName, vName, skuStr);
      const key = resolved.canonicalKey;

      if (rawMap.has(key)) {
        const existing = rawMap.get(key)!;
        existing.qty += qty;
        existing.orders.push({ order, requiredQty: qty });

        // Update with richer metadata if available
        if (!existing.displayVariation && resolved.displayVariation) {
          existing.displayVariation = resolved.displayVariation;
        }
        if (!existing.sku && resolved.sku) {
          existing.sku = resolved.sku;
        }
        if (!existing.matchedVariation && resolved.matchedVariation) {
          existing.matchedVariation = resolved.matchedVariation;
        }
        if (!existing.matchedParent && resolved.matchedParent) {
          existing.matchedParent = resolved.matchedParent;
        }
      } else {
        rawMap.set(key, {
          canonicalKey: key,
          groupKey: resolved.groupKey,
          parentName: resolved.parentName,
          variationName: resolved.variationName,
          displayVariation: resolved.displayVariation,
          sku: resolved.sku,
          qty,
          orders: [{ order, requiredQty: qty }],
          matchedParent: resolved.matchedParent,
          matchedVariation: resolved.matchedVariation
        });
      }
    };

    // Add all parsed items from active orders
    allParsedItems.forEach(item => {
      addItem(item.productName, item.variation, item.sku, item.quantity, item.order);
    });

    // 2. Calculate stock, price, cost and match inventory for each variant
    const processedVariations: (VariationItem & { groupKey: string; matchedParentRef: any })[] = [];

    rawMap.forEach((val) => {
      const { parentName, variationName, displayVariation, sku, qty, orders, matchedParent, matchedVariation, canonicalKey, groupKey } = val;

      let availableStock = 0;
      let hasInventoryMatch = false;
      let stockStatusStr = 'غير مدرج بالمخزن';

      // Price & Cost derivation
      let unitPrice: string | number = '—';
      let unitCost: string | number = '—';

      if (matchedVariation) {
        unitPrice = matchedVariation.price || matchedVariation.regular_price || matchedParent?.price || '—';
        const rawCost = getProductCostValue(matchedVariation) || (matchedParent ? getProductCostValue(matchedParent) : 0);
        unitCost = rawCost > 0 ? `${rawCost} د.ج` : '—';
      } else if (matchedParent) {
        unitPrice = getProductDisplayPrice(matchedParent);
        unitCost = getProductDisplayCost(matchedParent);
      }

      if (matchedParent) {
        const targetObj = matchedVariation || matchedParent;
        const isParentObj = !matchedVariation;

        if (!isLocal) {
          availableStock = Number(targetObj.stock_quantity ?? targetObj.local_stock_quantity ?? 0);
        } else {
          availableStock = calculateDynamicStock(targetObj, isParentObj, matchedParent, purchaseInvoices, allOrders);
        }

        hasInventoryMatch = true;
        stockStatusStr = `${availableStock} قطعة`;
      }

      // Shortage calculation
      const isShortage = hasInventoryMatch && availableStock < qty;
      const deficitQty = isShortage ? Math.max(0, qty - availableStock) : 0;

      // Determine display title for variant
      let finalDisplayVariation = displayVariation;
      if (!finalDisplayVariation) {
        if (matchedParent?.variations?.length) {
          finalDisplayVariation = 'نوع غير محدد';
        } else {
          finalDisplayVariation = 'منتج أساسي (بدون نوع)';
        }
      }

      processedVariations.push({
        id: canonicalKey,
        groupKey,
        matchedParentRef: matchedParent,
        productName: parentName,
        variationName,
        displayVariation: finalDisplayVariation,
        sku,
        unitPrice,
        unitCost,
        requiredQty: qty,
        orders,
        availableStock,
        hasInventoryMatch,
        stockStatusStr,
        isShortage,
        deficitQty
      });
    });

    // 3. Group variations by canonical groupKey
    const groupsMap = new Map<string, { parentName: string; matchedP: any; variations: VariationItem[] }>();

    processedVariations.forEach(item => {
      const gKey = item.groupKey;
      if (!groupsMap.has(gKey)) {
        const matchedP = item.matchedParentRef || inventoryProducts?.find((p: any) => normalizeText(p.name) === normalizeText(item.productName) || (p.sku && compactSku(p.sku) === compactSku(item.sku)));
        groupsMap.set(gKey, {
          parentName: matchedP?.name || item.productName,
          matchedP,
          variations: []
        });
      }
      groupsMap.get(gKey)!.variations.push(item);
    });

    const initialGroups: ProductGroup[] = [];

    groupsMap.forEach((gData) => {
      const { parentName: pName, matchedP, variations: variationsList } = gData;

      // Sort variations by requiredQty desc
      variationsList.sort((a, b) => b.requiredQty - a.requiredQty);

      const totalQty = variationsList.reduce((sum, v) => sum + v.requiredQty, 0);
      const totalVariantsCount = variationsList.length;
      const readyVariantsCount = variationsList.filter(v => checkedItems.has(v.id)).length;
      const isFullyPrepared = totalVariantsCount > 0 && readyVariantsCount === totalVariantsCount;
      const hasShortage = variationsList.some(v => v.isShortage);

      // Derive accurate product SKU
      const productSku = matchedP?.sku || variationsList.find(v => v.sku)?.sku || '';
      const displayPrice = matchedP ? getProductDisplayPrice(matchedP) : (variationsList[0]?.unitPrice ? `${variationsList[0].unitPrice} د.ج` : 'غير محدد');
      const displayCost = matchedP ? getProductDisplayCost(matchedP) : (variationsList[0]?.unitCost ? String(variationsList[0].unitCost) : '—');

      initialGroups.push({
        productName: pName,
        productSku,
        displayPrice,
        displayCost,
        totalQty,
        totalVariantsCount,
        readyVariantsCount,
        isFullyPrepared,
        hasShortage,
        variations: variationsList
      });
    });

    // 4. Final consolidation check: Merge any groups that share the exact same SKU so no product is ever split into two sections
    const consolidatedBySkuOrName = new Map<string, ProductGroup>();

    initialGroups.forEach(group => {
      const groupSkuComp = compactSku(group.productSku);
      let matchKey = '';

      if (groupSkuComp) {
        for (const [key, existing] of consolidatedBySkuOrName.entries()) {
          if (compactSku(existing.productSku) === groupSkuComp) {
            matchKey = key;
            break;
          }
        }
      }

      if (!matchKey) {
        matchKey = groupSkuComp ? `sku_${groupSkuComp}` : `name_${normalizeText(group.productName)}`;
      }

      if (consolidatedBySkuOrName.has(matchKey)) {
        const existing = consolidatedBySkuOrName.get(matchKey)!;
        // Merge variations
        group.variations.forEach(newVar => {
          const existingVar = existing.variations.find(v => 
            v.id === newVar.id || 
            (compactSku(v.sku) && compactSku(v.sku) === compactSku(newVar.sku) && normalizeText(v.displayVariation) === normalizeText(newVar.displayVariation))
          );
          if (existingVar) {
            existingVar.requiredQty += newVar.requiredQty;
            existingVar.orders.push(...newVar.orders);
            if (newVar.availableStock > existingVar.availableStock) {
              existingVar.availableStock = newVar.availableStock;
            }
            existingVar.isShortage = existingVar.hasInventoryMatch && existingVar.availableStock < existingVar.requiredQty;
            existingVar.deficitQty = existingVar.isShortage ? Math.max(0, existingVar.requiredQty - existingVar.availableStock) : 0;
          } else {
            existing.variations.push(newVar);
          }
        });

        // Recalculate group totals
        existing.totalQty += group.totalQty;
        existing.totalVariantsCount = existing.variations.length;
        existing.readyVariantsCount = existing.variations.filter(v => checkedItems.has(v.id)).length;
        existing.isFullyPrepared = existing.totalVariantsCount > 0 && existing.readyVariantsCount === existing.totalVariantsCount;
        existing.hasShortage = existing.variations.some(v => v.isShortage);
        if (!existing.productSku && group.productSku) {
          existing.productSku = group.productSku;
        }
      } else {
        consolidatedBySkuOrName.set(matchKey, { ...group });
      }
    });

    const finalResult = Array.from(consolidatedBySkuOrName.values());
    return finalResult.sort((a, b) => b.totalQty - a.totalQty);
  }, [activeOrders, inventoryProducts, isLocal, allOrders, purchaseInvoices, checkedItems]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalPieces = 0;
    let totalVariations = 0;
    let totalShortageVariations = 0;
    let totalReadyVariations = 0;

    productGroups.forEach(g => {
      totalPieces += g.totalQty;
      totalVariations += g.totalVariantsCount;
      totalReadyVariations += g.readyVariantsCount;
      g.variations.forEach(v => {
        if (v.isShortage) totalShortageVariations++;
      });
    });

    const completionPercent = totalVariations > 0 ? Math.round((totalReadyVariations / totalVariations) * 100) : 0;

    return {
      totalOrders: activeOrders.length,
      totalProducts: productGroups.length,
      totalVariations,
      totalPieces,
      totalShortageVariations,
      totalReadyVariations,
      completionPercent
    };
  }, [productGroups, activeOrders.length]);

  // Filtered display based on search & filter mode
  const filteredProductGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qNorm = normalizeText(q);

    return productGroups
      .map(group => {
        const matchingVariations = group.variations.filter(v => {
          // Search query check: matches product, variation, sku, or any customer/phone/tracking in its orders
          if (q) {
            const matchesPName = normalizeText(group.productName).includes(qNorm);
            const matchesVName = normalizeText(v.displayVariation).includes(qNorm);
            const matchesSku = v.sku.toLowerCase().includes(q);
            const matchesOrder = v.orders.some(o => {
              const custName = normalizeText(o.order?.fullName || o.order?.customerName || '');
              const phone = String(o.order?.phone || '');
              const tracking = String(o.order?.shippingTrackingId || o.order?.trackingNumber || '').toLowerCase();
              const orderId = String(o.order?.id || o.order?.orderId || '').toLowerCase();
              return custName.includes(qNorm) || phone.includes(q) || tracking.includes(q) || orderId.includes(q);
            });

            if (!matchesPName && !matchesVName && !matchesSku && !matchesOrder) return false;
          }

          // Filter Mode check
          if (filterMode === 'deficit') {
            return v.isShortage;
          }
          if (filterMode === 'pending') {
            return !checkedItems.has(v.id);
          }
          if (filterMode === 'ready') {
            return checkedItems.has(v.id);
          }

          return true;
        });

        if (matchingVariations.length === 0) return null;

        return {
          ...group,
          variations: matchingVariations,
          filteredTotalQty: matchingVariations.reduce((s, v) => s + v.requiredQty, 0)
        };
      })
      .filter(Boolean) as (ProductGroup & { filteredTotalQty?: number })[];
  }, [productGroups, searchQuery, filterMode, checkedItems]);

  const handlePrint = () => {
    triggerPrint({ printableElementId: 'picking-list-modal', title: 'قائمة_تجهيز_الطلبيات' });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-[9999] flex items-center justify-center p-1 sm:p-2 md:p-3 animate-in fade-in duration-200">
      <div 
        id="picking-list-modal"
        className={`bg-slate-50 w-full flex flex-col shadow-2xl overflow-hidden border border-slate-200 transition-all duration-300 ${
          isMaximized 
            ? 'fixed inset-0 w-screen h-screen rounded-none z-[9999]' 
            : 'w-[98vw] max-w-[1650px] h-[98vh] rounded-3xl'
        }`} 
        dir="rtl"
      >
        {/* Top Header Bar (Hidden in Print) */}
        <div className="bg-white px-4 sm:px-6 py-3 border-b border-slate-200 print:hidden shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>قائمة تجهيز الطلبيات والأنواع</span>
                  <span className="bg-indigo-100 text-indigo-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-indigo-200">
                    {stats.totalPieces} قطعة مطلوبة
                  </span>
                </h2>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  تجهيز دقيق لـ <span className="text-indigo-600 font-black">{stats.totalOrders}</span> طلبية عبر <span className="text-slate-700 font-black">{stats.totalProducts}</span> منتجات أساسية
                </p>
              </div>
            </div>

            {/* Header Control Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {stats.totalShortageVariations > 0 && (
                <button 
                  id="btn-open-deficit-modal"
                  onClick={() => setShowDeficitModal(true)} 
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-rose-200 transition-all cursor-pointer shadow-xs animate-pulse"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>العجز والمشتريات ({stats.totalShortageVariations})</span>
                </button>
              )}

              {/* Stats Bar Toggle Button */}
              <button
                onClick={() => setShowStats(!showStats)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  showStats 
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title={showStats ? 'إخفاء شريط الإحصائيات لتوسيع مساحة العمل' : 'إظهار شريط الإحصائيات والتقدم'}
              >
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <span>{showStats ? 'إخفاء الإحصائيات' : 'إحصائيات التجهيز'}</span>
              </button>

              <button 
                id="btn-print-picking-list"
                onClick={handlePrint} 
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-200 transition-all cursor-pointer"
                title="طباعة قائمة التجهيز مع مربعات التأشير اليدوي"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">طباعة القائمة</span>
              </button>

              {/* Fullscreen / Maximize Toggle */}
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-1.5 rounded-xl transition-all cursor-pointer"
                title={isMaximized ? 'تصغير النافذة' : 'ملء الشاشة بالكامل'}
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button 
                id="btn-close-picking-modal"
                onClick={onClose} 
                className="bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 p-1.5 rounded-xl transition-all cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Sub-bar: Scope Selector & View Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-2.5 pt-2.5 border-t border-slate-100 bg-slate-50/90 -mx-4 sm:-mx-6 px-4 sm:px-6 py-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>نطاق الطلبيات:</span>
              </span>
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-xs">
                <button
                  onClick={() => setOrderScope('all_preparation')}
                  className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors cursor-pointer ${orderScope === 'all_preparation' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  جميع طلبيات التجهيز والشحن ({allShippedOrders?.length || allOrders?.length || 0})
                </button>
                <button
                  onClick={() => setOrderScope('current_filtered')}
                  className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors cursor-pointer ${orderScope === 'current_filtered' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  الطلبيات المعروضة بالجدول فقط ({passedOrders.length})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500">حالة الشحن:</span>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">كل الحالات المشمولة</option>
                  <option value="تم الشحن">تم الشحن</option>
                  <option value="قيد التجهيز">قيد التجهيز</option>
                  <option value="قابلة للشحن">قابلة للشحن</option>
                  <option value="جاهز للشحن">جاهز للشحن</option>
                  <option value="في الطريق">في الطريق</option>
                </select>
              </div>

              {/* View options: Expand/Collapse All */}
              <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-1">
                <button
                  onClick={handleExpandAllGroups}
                  className="text-[11px] font-bold text-slate-600 hover:text-indigo-600 px-2 py-1 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                >
                  توسيع الكل
                </button>
                <button
                  onClick={handleCollapseAllGroups}
                  className="text-[11px] font-bold text-slate-600 hover:text-indigo-600 px-2 py-1 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                >
                  طي الكل
                </button>
              </div>
            </div>
          </div>

          {/* Quick Statistics Counters (Toggleable to maximize vertical space) */}
          {showStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-2.5 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400">إجمالي الطلبيات</div>
                  <div className="text-sm font-black text-slate-800">{stats.totalOrders}</div>
                </div>
                <Package className="w-4 h-4 text-slate-400" />
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400">المنتجات الأساسية</div>
                  <div className="text-sm font-black text-slate-800">{stats.totalProducts}</div>
                </div>
                <Layers className="w-4 h-4 text-slate-400" />
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400">الأنواع والمقاسات</div>
                  <div className="text-sm font-black text-indigo-700">{stats.totalVariations}</div>
                </div>
                <Boxes className="w-4 h-4 text-indigo-400" />
              </div>

              <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-2 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-indigo-600">إجمالي القطع المطلوبة</div>
                  <div className="text-sm font-black text-indigo-900">{stats.totalPieces}</div>
                </div>
                <div className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-lg">قطعة</div>
              </div>

              <div className={`border rounded-2xl p-2 flex items-center justify-between ${stats.totalShortageVariations > 0 ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <div>
                  <div className="text-[10px] font-bold opacity-75">أنواع بها عجز بالمخزن</div>
                  <div className="text-sm font-black flex items-center gap-1">
                    <span>{stats.totalShortageVariations}</span>
                    {stats.totalShortageVariations > 0 && <span className="text-[10px] font-bold text-rose-600">نوع</span>}
                  </div>
                </div>
                <AlertTriangle className={`w-4 h-4 ${stats.totalShortageVariations > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2 flex items-center justify-between">
                <div className="w-full">
                  <div className="flex justify-between items-center text-[10px] font-bold text-emerald-800 mb-1">
                    <span>نسبة الإنجاز</span>
                    <span>{stats.completionPercent}%</span>
                  </div>
                  <div className="w-full bg-emerald-200/80 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${stats.completionPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم المنتج، النوع، المقاس، SKU، الزبون، أو رقم التتبع..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pr-10 pl-4 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${filterMode === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
              >
                الكل ({stats.totalVariations})
              </button>
              <button
                onClick={() => setFilterMode('deficit')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${filterMode === 'deficit' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'}`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>به عجز ({stats.totalShortageVariations})</span>
              </button>
              <button
                onClick={() => setFilterMode('pending')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${filterMode === 'pending' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
              >
                قيد التجهيز ({stats.totalVariations - stats.totalReadyVariations})
              </button>
              <button
                onClick={() => setFilterMode('ready')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${filterMode === 'ready' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'}`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>جاهزة ({stats.totalReadyVariations})</span>
              </button>
            </div>

            {/* Bulk Check / Uncheck Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCheckAll}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                تحديد الكل كجاهز
              </button>
              <button
                onClick={handleUncheckAll}
                className="text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area - Expansive Height & Scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 md:p-6 printable-area custom-scrollbar space-y-5">

          {/* Printable Header for Paper */}
          <div className="hidden print:block mb-6 border-b-2 border-slate-800 pb-4 text-center">
            <h1 className="text-2xl font-black text-slate-900 mb-1">قائمة تجهيز الطلبيات (Picking List)</h1>
            <div className="text-xs font-bold text-slate-600 flex justify-center gap-6">
              <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-DZ')} {new Date().toLocaleTimeString('ar-DZ')}</span>
              <span>إجمالي الطلبيات: {stats.totalOrders}</span>
              <span>إجمالي القطع المطلوبة: {stats.totalPieces} قطعة</span>
            </div>
          </div>

          {filteredProductGroups.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-sm max-w-lg mx-auto my-8">
              <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-700 mb-1">
                {searchQuery || filterMode !== 'all' ? 'لا توجد نتائج مطابقة للبحث أو الفلتر' : 'لا توجد طلبيات للتجهيز'}
              </h3>
              <p className="text-xs font-bold text-slate-500">
                {searchQuery || filterMode !== 'all' 
                  ? 'جرب تغيير كلمة البحث أو اختيار فلتر آخر لإظهار كافة المنتجات والأنواع.' 
                  : 'تم تجهيز كافة الطلبيات أو لا توجد طلبيات في نطاق التجهيز المحدد.'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredProductGroups.map((group, gIdx) => {
                const isCollapsed = collapsedGroups.has(group.productName);
                const allGroupChecked = group.variations.every(v => checkedItems.has(v.id));

                return (
                  <div 
                    key={gIdx} 
                    className={`bg-white rounded-3xl border transition-all duration-200 shadow-sm overflow-hidden ${
                      allGroupChecked 
                        ? 'border-emerald-200 bg-emerald-50/10' 
                        : group.hasShortage 
                        ? 'border-rose-300 ring-1 ring-rose-300/30' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Product Group Header Banner */}
                    <div 
                      onClick={() => toggleGroupCollapse(group.productName)}
                      className={`px-5 py-4 border-b flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                        allGroupChecked 
                          ? 'bg-emerald-50/60 border-emerald-200' 
                          : group.hasShortage 
                          ? 'bg-rose-50/60 border-rose-200' 
                          : 'bg-slate-50/90 border-slate-200 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <button
                          onClick={(e) => toggleGroupCheck(group, e)}
                          className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-colors print:hidden ${
                            allGroupChecked 
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' 
                              : 'bg-white border-slate-300 hover:border-slate-400'
                          }`}
                          title={allGroupChecked ? 'إلغاء تحديد كل أنواع هذا المنتج' : 'تحديد كل أنواع هذا المنتج كجاهزة'}
                        >
                          {allGroupChecked && <Check className="w-4 h-4 stroke-[3]" />}
                        </button>

                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-base font-black text-slate-900">{group.productName}</h3>
                            {group.productSku && (
                              <span className="text-[10px] font-mono font-bold bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-300">
                                SKU: {group.productSku}
                              </span>
                            )}
                            {/* Price and Cost on Parent Product */}
                            <span className="text-xs font-black text-slate-800 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                              السعر: {group.displayPrice}
                            </span>
                            {group.displayCost !== '—' && (
                              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                                التكلفة: {group.displayCost}
                              </span>
                            )}
                          </div>
                          
                          <div className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                            <span>يحتوي على <strong className="text-indigo-600 font-black">{group.totalVariantsCount}</strong> نوع/مقاس</span>
                            {group.readyVariantsCount > 0 && (
                              <span className="text-emerald-700 font-bold bg-emerald-100/60 px-2 py-0.5 rounded-lg border border-emerald-200">
                                ({group.readyVariantsCount}/{group.totalVariantsCount} جاهز)
                              </span>
                            )}
                            {group.hasShortage && (
                              <span className="text-rose-700 font-black flex items-center gap-1 bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-200">
                                <AlertTriangle className="w-3.5 h-3.5" /> به عجز في المخزون
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Total Quantity for this product */}
                        <div className="bg-indigo-600 text-white font-black text-sm px-4 py-2 rounded-2xl shadow-sm flex items-center gap-1.5 border border-indigo-700">
                          <span className="text-base">{group.filteredTotalQty ?? group.totalQty}</span>
                          <span className="text-xs text-indigo-200 font-bold">قطعة مطلوبة</span>
                        </div>

                        <button 
                          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 bg-white border border-slate-200 print:hidden transition-colors"
                          title={isCollapsed ? 'توسيع' : 'طي'}
                        >
                          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Variations Table */}
                    {!isCollapsed && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-3 text-center w-12 print:hidden">جاهز</th>
                              <th className="px-4 py-3 text-center w-14 print:hidden">الطلبيات</th>
                              <th className="px-5 py-3 text-right">النوع / المقاس / العرض</th>
                              <th className="px-4 py-3 text-center w-28">السعر والتكلفة</th>
                              <th className="px-4 py-3 text-center w-28">الكمية المطلوبة</th>
                              <th className="px-4 py-3 text-center w-32">المخزون المتوفر</th>
                              <th className="px-5 py-3 text-right w-44">حالة المخزون</th>
                              <th className="hidden print:table-cell px-4 py-3 text-center w-20">تم التجهيز</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.variations.map((v, vIdx) => {
                              const isChecked = checkedItems.has(v.id);
                              const isExpanded = expandedItems.has(v.id);

                              return (
                                <React.Fragment key={v.id || vIdx}>
                                  <tr 
                                    onClick={() => toggleCheck(v.id)}
                                    className={`cursor-pointer transition-colors ${
                                      isChecked 
                                        ? 'bg-emerald-50/40 text-slate-500' 
                                        : v.isShortage 
                                          ? 'bg-rose-50/40 hover:bg-rose-50/70' 
                                          : 'hover:bg-slate-50/80'
                                    }`}
                                  >
                                    {/* Checkbox (Screen) */}
                                    <td className="px-4 py-3.5 text-center align-middle print:hidden">
                                      <button
                                        onClick={(e) => toggleCheck(v.id, e)}
                                        className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors mx-auto ${
                                          isChecked 
                                            ? 'bg-emerald-600 border-emerald-600 text-white' 
                                            : 'bg-white border-slate-300 hover:border-slate-400'
                                        }`}
                                      >
                                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                      </button>
                                    </td>

                                    {/* Orders Accordion Toggle */}
                                    <td className="px-4 py-3.5 text-center align-middle print:hidden">
                                      <button
                                        onClick={(e) => toggleExpand(v.id, e)}
                                        className={`p-1.5 rounded-xl transition-colors border flex items-center gap-1 mx-auto ${
                                          isExpanded 
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-xs' 
                                            : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                                        }`}
                                        title="عرض كافة تفاصيل الطلبيات وتعديل التصنيف"
                                      >
                                        <span className="font-bold text-[10px]">{v.orders.length}</span>
                                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                      </button>
                                    </td>

                                    {/* Variation / Type Name */}
                                    <td className={`px-5 py-3.5 align-middle ${isChecked ? 'line-through opacity-60' : ''}`}>
                                      <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                                        <span>{v.displayVariation}</span>
                                      </div>
                                      {v.sku && (
                                        <div className="text-[10px] font-mono font-bold text-slate-500 mt-1 bg-slate-100 px-2 py-0.5 rounded-md w-fit border border-slate-200">
                                          SKU: {v.sku}
                                        </div>
                                      )}
                                    </td>

                                    {/* Unit Price & Cost */}
                                    <td className="px-4 py-3.5 text-center align-middle">
                                      <div className="font-bold text-slate-800 text-xs">
                                        {v.unitPrice !== '—' ? `${v.unitPrice} د.ج` : '—'}
                                      </div>
                                      {v.unitCost !== '—' && (
                                        <div className="text-[11px] font-bold text-indigo-700 mt-0.5">
                                          {v.unitCost}
                                        </div>
                                      )}
                                    </td>

                                    {/* Required Quantity */}
                                    <td className="px-4 py-3.5 text-center align-middle">
                                      <span className={`inline-flex items-center justify-center min-w-[48px] px-3 py-1 font-black rounded-xl text-sm border shadow-xs ${
                                        isChecked 
                                          ? 'bg-slate-100 text-slate-500 border-slate-200' 
                                          : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                      }`}>
                                        {v.requiredQty} <span className="text-[10px] font-bold mr-1">قطع</span>
                                      </span>
                                    </td>

                                    {/* Available Stock */}
                                    <td className="px-4 py-3.5 text-center align-middle">
                                      <span className={`font-black text-xs px-3 py-1 rounded-xl inline-block border ${
                                        !v.hasInventoryMatch 
                                          ? 'text-slate-400 border-slate-200 border-dashed bg-slate-50' 
                                          : v.isShortage 
                                            ? 'text-rose-700 bg-rose-100 border-rose-200' 
                                            : 'text-emerald-800 bg-emerald-50 border-emerald-200'
                                      }`}>
                                        {v.stockStatusStr}
                                      </span>
                                    </td>

                                    {/* Stock Status Badge */}
                                    <td className="px-5 py-3.5 align-middle">
                                      {!v.hasInventoryMatch ? (
                                        <span className="text-[11px] text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl font-bold inline-block">
                                          غير مربوط بالمخزن
                                        </span>
                                      ) : v.isShortage ? (
                                        <span className="text-[11px] text-rose-700 bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-xl font-black flex items-center gap-1.5 w-fit">
                                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                          <span>عجز ({v.deficitQty} قطع ناقصة)</span>
                                        </span>
                                      ) : (
                                        <span className="text-[11px] text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 w-fit">
                                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                                          <span>المخزون كافٍ</span>
                                        </span>
                                      )}
                                    </td>

                                    {/* Print Box for Paper Pen Check */}
                                    <td className="hidden print:table-cell px-4 py-3.5 text-center align-middle">
                                      <div className="print-box mx-auto" />
                                    </td>
                                  </tr>

                                  {/* Detailed Orders Sub-Table & Quick Reclassify Actions */}
                                  {isExpanded && v.orders && v.orders.length > 0 && (
                                    <tr className="bg-slate-50/90 border-t border-slate-200 print:hidden">
                                      <td colSpan={7} className="px-4 sm:px-6 py-4">
                                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                          {/* Orders Header */}
                                          <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 font-black text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                              <FileText className="w-4 h-4 text-indigo-600" />
                                              <span>كافة تفاصيل الطلبيات المرتبطة بهذا النوع ({v.orders.length} طلبية)</span>
                                            </div>
                                            <span className="text-slate-500 font-bold text-xs bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                                              إجمالي القطع في هذه الطلبيات: {v.requiredQty} قطعة
                                            </span>
                                          </div>

                                          {/* Orders Detailed Table */}
                                          <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                                            <table className="w-full text-xs">
                                              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] font-black uppercase">
                                                <tr>
                                                  <th className="px-3 py-2 text-right">رقم الطلبية</th>
                                                  <th className="px-3 py-2 text-right">الزبون والهاتف</th>
                                                  <th className="px-3 py-2 text-right">الولاية والعنوان</th>
                                                  <th className="px-3 py-2 text-center">الكمية</th>
                                                  <th className="px-3 py-2 text-right">الإجمالي</th>
                                                  <th className="px-3 py-2 text-center">حالة التأكيد والشحن</th>
                                                  <th className="px-3 py-2 text-center">شركة التوصيل</th>
                                                  <th className="px-3 py-2 text-center w-28">إجراءات وتصنيف</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100">
                                                {v.orders.map((ordData, oIdx) => {
                                                  const o = ordData.order;
                                                  const orderNumber = o.id ? String(o.id).slice(-6).toUpperCase() : o.orderId;

                                                  return (
                                                    <tr key={o.id || oIdx} className="hover:bg-slate-50/80 transition-colors">
                                                      {/* Order ID */}
                                                      <td className="px-3 py-2.5 font-mono font-black text-indigo-600">
                                                        #{orderNumber}
                                                      </td>

                                                      {/* Customer & Phone */}
                                                      <td className="px-3 py-2.5">
                                                        <div className="font-extrabold text-slate-900">
                                                          {o.fullName || o.customerName || 'زبون غير محدد'}
                                                        </div>
                                                        {o.phone && (
                                                          <a 
                                                            href={`tel:${o.phone}`}
                                                            className="font-mono text-slate-500 text-[11px] hover:text-indigo-600 block mt-0.5" 
                                                            dir="ltr"
                                                          >
                                                            {o.phone}
                                                          </a>
                                                        )}
                                                      </td>

                                                      {/* Wilaya & Address */}
                                                      <td className="px-3 py-2.5">
                                                        <span className="font-bold text-slate-800 block">
                                                          {o.city || o.region || 'ولاية غير محددة'}
                                                        </span>
                                                        {o.address && (
                                                          <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                                                            {o.address}
                                                          </span>
                                                        )}
                                                      </td>

                                                      {/* Required Quantity */}
                                                      <td className="px-3 py-2.5 text-center">
                                                        <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 font-black rounded-lg text-xs bg-indigo-50 text-indigo-800 border border-indigo-100">
                                                          {ordData.requiredQty}
                                                        </span>
                                                      </td>

                                                      {/* Total Charge */}
                                                      <td className="px-3 py-2.5 font-black text-slate-900">
                                                        {o.totalCharge || o.total || '—'} د.ج
                                                      </td>

                                                      {/* Status Badges */}
                                                      <td className="px-3 py-2.5 text-center">
                                                        <div className="flex flex-col gap-1 items-center">
                                                          {o.status1 && (
                                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatus1Badge(o.status1)}`}>
                                                              {o.status1}
                                                            </span>
                                                          )}
                                                          {o.status2 && (
                                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatus2Badge(o.status2)}`}>
                                                              {o.status2}
                                                            </span>
                                                          )}
                                                        </div>
                                                      </td>

                                                      {/* Delivery Company & Tracking */}
                                                      <td className="px-3 py-2.5 text-center">
                                                        <span className="font-bold text-slate-700 block text-[11px]">
                                                          {o.deliveryCompany || 'غير محددة'}
                                                        </span>
                                                        {o.shippingTrackingId && (
                                                          <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                                                            {o.shippingTrackingId}
                                                          </span>
                                                        )}
                                                      </td>

                                                      {/* Actions: Reclassify / Edit Product & Full View */}
                                                      <td className="px-3 py-2.5 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                          {/* Quick Reclassify Button */}
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setReclassifyingOrderData({ order: o, variationText: v.displayVariation, productNameText: (v as any).parentName || o.productName, skuText: v.sku, quantity: ordData.requiredQty });
                                                            }}
                                                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-lg text-[11px] transition-colors flex items-center gap-1"
                                                            title="تعديل المنتج أو اختيار نوع آخر ليعاد تصنيف الطلبية فوراً"
                                                          >
                                                            <ArrowRightLeft className="w-3 h-3" />
                                                            <span>تعديل النوع</span>
                                                          </button>

                                                          {/* View Full Order Button */}
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setViewingOrder(o);
                                                            }}
                                                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                            title="عرض تفاصيل الطلبية بالكامل"
                                                          >
                                                            <Eye className="w-3.5 h-3.5" />
                                                          </button>
                                                        </div>
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer (Hidden in Print) */}
        <div className="bg-white px-6 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
          <div className="text-xs font-bold text-slate-500 flex items-center gap-4">
            <span>
              تم تجهيز <strong className="text-emerald-700 font-black">{stats.totalReadyVariations}</strong> من أصل <strong className="text-slate-800 font-black">{stats.totalVariations}</strong> نوع
            </span>
            {stats.totalShortageVariations > 0 && (
              <span className="text-rose-600 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>يوجد {stats.totalShortageVariations} نوع به عجز عن تلبية الكميات</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة ورقة التجهيز</span>
            </button>

            <button
              onClick={onClose}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              إتمام وإغلاق
            </button>
          </div>
        </div>
      </div>

      {/* Quick Reclassify Modal */}
      {reclassifyingOrderData && (
        <QuickReclassifyModal
          order={reclassifyingOrderData.order}
          
          onClose={() => setReclassifyingOrderData(null)}
        />
      )}

      {/* Full View Order Modal */}
      {viewingOrder && (
        <ViewOrderModal
          order={viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}

      {/* Deficit Modal if requested */}
      {showDeficitModal && (
        <DeficitListModal onClose={() => setShowDeficitModal(false)} />
      )}
    </div>
  );
}
