import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store';
import { 
  Search, Edit2, Check, X, ExternalLink, ShoppingCart, Archive, ArchiveRestore, 
  Trash2, AlertTriangle, RefreshCw, CheckCircle, Tag, Phone, MessageSquare, 
  Eye, EyeOff, DollarSign, Clock, Users, ArrowUpDown, ChevronDown, ChevronUp, CheckSquare, 
  Square, PhoneCall, Sparkles, Filter, MapPin, Building2, Plus, Layers
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatWilaya, WILAYAS_MAP } from '../../utils/algeriaWilayas';
import ecotrackCommunes from '../../ecotrack-communes.json';
import { 
  getOrderTagsHistory, 
  getLatestTag, 
  getLatestTagName, 
  addTagToOrder, 
  removeTagFromOrder, 
  formatTagTimestamp 
} from '../../utils/tagUtils';
import { TAGS_OPTIONS } from '../orders/OrdersList';
import { QuickAddTagModal } from '../orders/QuickAddTagModal';
import { calculateDefaultShippingFee } from '../../utils/shippingFees';
import { AbandonedOrder, Order, OrderTagEntry } from '../../types';
import toast from 'react-hot-toast';
import { playActionSound } from '../../utils/audioUtils';
import { TablePagination } from '../common/TablePagination';

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

const getAbandonedStatusClass = (val: string) => {
  switch (val) {
    case 'لم يتم التواصل': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'تم الإتصال': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'تم الإسترجاع كطلبية': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'مكالمة فائتة': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'لا يرد': return 'bg-purple-100 text-purple-700 border-purple-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const formatWhatsAppLink = (phone: string, customerName?: string, productName?: string, templateText?: string) => {
  if (!phone) return '#';
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '213' + clean.slice(1);
  } else if (!clean.startsWith('213')) {
    clean = '213' + clean;
  }
  
  let defaultMsg = `مرحباً ${customerName || 'عزيزي الزبون'}، لاحظنا اهتمامك بمنتج (${productName || 'في متجرنا'}) ولم تكمل طلبك. هل ترغب في تأكيد الطلبية وتوصيلها لعنوانك؟`;
  if (templateText) {
    defaultMsg = templateText
      .replace('{customer_name}', customerName || 'الزبون')
      .replace('{product_name}', productName || '')
      .replace('{checkout_url}', '');
  }
  return `https://wa.me/${clean}?text=${encodeURIComponent(defaultMsg)}`;
};

export function AbandonedList() {
  const { 
    abandonedOrders, 
    updateAbandonedOrder, 
    addOrder, 
    deleteAbandonedOrder, 
    deduplicateAbandonedOrders,
    settings 
  } = useStore();

  const [currentTab, setCurrentTab] = useState<'active' | 'archived' | 'trash'>('active');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [hiddenTags, setHiddenTags] = useState<string[]>([]);
  const [showTagFilterBar, setShowTagFilterBar] = useState(true);
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'archive' | 'restore' | 'trash' | 'restoreTrash' | 'bulkDelete', id: string, name: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRecovering, setIsRecovering] = useState<string | null>(null);
  const [isBatchRecovering, setIsBatchRecovering] = useState(false);
  const [quickTagTargetOrder, setQuickTagTargetOrder] = useState<AbandonedOrder | null>(null);
  const [isQuickTagModalOpen, setIsQuickTagModalOpen] = useState(false);

  // Active tags from settings or defaults
  const activeTags = useMemo(() => {
    return settings?.tags || TAGS_OPTIONS;
  }, [settings?.tags]);

  const duplicateAbandonedCount = useMemo(() => {
    const seen = new Set<string>();
    let count = 0;
    for (let i = 0; i < abandonedOrders.length; i++) {
      const o1 = abandonedOrders[i];
      if (seen.has(o1.id)) continue;
      for (let j = i + 1; j < abandonedOrders.length; j++) {
        const o2 = abandonedOrders[j];
        if (seen.has(o2.id)) continue;

        const id1 = String(o1.orderId || '').trim().replace(/^[#\-_]/, '');
        const id2 = String(o2.orderId || '').trim().replace(/^[#\-_]/, '');
        const phone1 = String(o1.phone || '').replace(/\D/g, '');
        const phone2 = String(o2.phone || '').replace(/\D/g, '');

        let isDup = false;
        if (o1.id === o2.id) {
          isDup = true;
        } else if (id1 && id2 && id1 === id2) {
          isDup = true;
        } else if (o1.id.endsWith('-' + o2.id) || o2.id.endsWith('-' + o1.id) || (id1 && o2.id.endsWith('-' + id1)) || (id2 && o1.id.endsWith('-' + id2))) {
          isDup = true;
        } else if (phone1 && phone2 && phone1.length >= 8 && (phone1 === phone2 || phone1.endsWith(phone2) || phone2.endsWith(phone1))) {
          const p1 = (o1.productName || '').trim().toLowerCase();
          const p2 = (o2.productName || '').trim().toLowerCase();
          if (p1 && p2 && p1 === p2) {
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
  }, [abandonedOrders]);

  useEffect(() => {
    const handleFilter = (e: any) => {
      if (e.detail && e.detail.searchTerm) {
        setSearchTerm(e.detail.searchTerm);
        if (e.detail.targetTab) {
          setCurrentTab(e.detail.targetTab);
        }
      }
    };
    document.addEventListener('filter-orders', handleFilter);
    return () => document.removeEventListener('filter-orders', handleFilter);
  }, []);

  // Column widths
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    select: 40,
    orderId: 90,
    orderDate: 120,
    fullName: 140,
    phone: 135,
    region: 160,
    city: 145,
    productName: 175,
    priceWithoutDelivery: 95,
    shippingMethod: 110,
    deliveryPrice: 90,
    totalCharge: 100,
    tag: 155,
    status: 125,
    notes: 140,
    actions: 150
  });

  const handleMouseDown = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const newWidth = Math.max(40, startWidth + deltaX);
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

  const statuses = ['لم يتم التواصل', 'تم الإتصال', 'مكالمة فائتة', 'لا يرد'];

  // Base list by tab
  const tabOrders = useMemo(() => {
    return abandonedOrders.filter((o) => {
      if (currentTab === 'trash') return !!o.trashed;
      if (currentTab === 'archived') return !!o.archived && !o.trashed;
      return !o.archived && !o.trashed;
    });
  }, [abandonedOrders, currentTab]);

  // Statistics
  const stats = useMemo(() => {
    const total = tabOrders.length;
    const notContacted = tabOrders.filter(o => o.status === 'لم يتم التواصل' || !o.status).length;
    const contacted = tabOrders.filter(o => o.status === 'تم الإتصال').length;
    const totalPotentialValue = tabOrders.reduce((sum, o) => {
      const val = Number(o.totalCharge) || (Number(o.priceWithoutDelivery) || 0) + (Number(o.deliveryPrice) || 0);
      return sum + val;
    }, 0);

    return { total, notContacted, contacted, totalPotentialValue };
  }, [tabOrders]);

  // Tag Counts
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = { none: 0 };
    activeTags.forEach(t => { counts[t.name] = 0; });

    tabOrders.forEach(o => {
      const tags = getOrderTagsHistory(o, activeTags);
      if (tags.length === 0) {
        counts['none'] = (counts['none'] || 0) + 1;
      } else {
        tags.forEach(t => {
          counts[t.name] = (counts[t.name] || 0) + 1;
        });
      }
    });

    return counts;
  }, [tabOrders, activeTags]);

  // Filtered orders
  const filtered = useMemo(() => {
    return tabOrders.filter((o) => {
      // Status filter
      if (statusFilter !== 'all' && (o.status || 'لم يتم التواصل') !== statusFilter) {
        return false;
      }

      // Tag filter
      const oTags = getOrderTagsHistory(o, activeTags);
      const latestTag = getLatestTagName(o, activeTags);

      if (hiddenTags.length > 0) {
        if (oTags.length === 0 && hiddenTags.includes('none')) return false;
        if (latestTag && hiddenTags.includes(latestTag)) return false;
      }

      if (tagFilter !== 'all') {
        if (tagFilter === 'none') {
          if (oTags.length > 0) return false;
        } else {
          if (!oTags.some(t => t.name === tagFilter)) return false;
        }
      }

      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matches = 
          (o.fullName && o.fullName.toLowerCase().includes(term)) ||
          (o.phone && o.phone.toLowerCase().includes(term)) ||
          (o.region && o.region.toLowerCase().includes(term)) ||
          (o.city && o.city.toLowerCase().includes(term)) ||
          (o.orderId && String(o.orderId).toLowerCase().includes(term)) ||
          (o.productName && o.productName.toLowerCase().includes(term)) ||
          (o.notes && o.notes.toLowerCase().includes(term)) ||
          (o.id && o.id.toLowerCase().includes(term)) ||
          (o.sourceChannel && o.sourceChannel.toLowerCase().includes(term));
        if (!matches) return false;
      }

      return true;
    });
  }, [tabOrders, statusFilter, tagFilter, hiddenTags, searchTerm, activeTags]);

  const handleActionConfirm = async () => {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    
    if (type === 'bulkDelete') {
      try {
        await useStore.getState().bulkDeleteAbandonedOrders(selectedIds);
        setSelectedIds([]);
        toast.success('تم حذف السلات بنجاح');
      } catch (e) {
        toast.error('حدث خطأ أثناء الحذف');
      }
      setConfirmAction(null);
      return;
    }
    
    if (type === 'trash') {
      await updateAbandonedOrder(id, { trashed: true });
      toast.success('تم نقل السلة إلى سلة المهملات');
    } else if (type === 'restoreTrash') {
      await updateAbandonedOrder(id, { trashed: false });
      toast.success('تمت استعادة السلة');
    } else if (type === 'archive') {
      await updateAbandonedOrder(id, { archived: true });
      toast.success('تمت أرشفة السلة');
    } else if (type === 'restore') {
      await updateAbandonedOrder(id, { archived: false });
      toast.success('تمت استعادة السلة من الأرشيف');
    } else if (type === 'delete') {
      await deleteAbandonedOrder(id);
      toast.success('تم الحذف النهائي للسلة');
    }
    
    setConfirmAction(null);
  };

  const handleEdit = (order: AbandonedOrder) => {
    setEditingId(order.id);
    setEditDraft({ ...order });
  };

  const handleSave = async () => {
    if (editingId && editDraft) {
      await updateAbandonedOrder(editingId, editDraft);
      playActionSound('success');
      toast.success('تم حفظ التعديلات بنجاح');
    }
    setEditingId(null);
    setEditDraft(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  // Quick inline update helper for Wilaya / Commune / Status
  const handleQuickUpdate = async (orderId: string, updates: Partial<AbandonedOrder>) => {
    await updateAbandonedOrder(orderId, updates);
    toast.success('تم التحديث');
  };

  // Tag manipulation
  const handleAddTag = async (order: AbandonedOrder, tagName: string) => {
    if (!tagName) return;
    const res = addTagToOrder(order, tagName, activeTags);
    await updateAbandonedOrder(order.id, { tag: res.tag, tagsHistory: res.tagsHistory });
    toast.success(`تمت إضافة التاغ "${tagName}"`);
  };

  const handleRemoveTag = async (order: AbandonedOrder, tagId: string) => {
    const res = removeTagFromOrder(order, tagId, activeTags);
    await updateAbandonedOrder(order.id, { tag: res.tag, tagsHistory: res.tagsHistory });
    toast.success(`تمت إزالة التاغ`);
  };

  // Converting / Recovering Abandoned Cart into a Confirmed Order
  const handleConvertToOrder = async (abandoned: AbandonedOrder, isBatch = false) => {
    if (!isBatch) setIsRecovering(abandoned.id);
    try {
      const recoveredTagEntry: OrderTagEntry = {
        id: `tag-${Date.now()}-recovered-${Math.floor(Math.random() * 1000)}`,
        name: 'متروكة ناجحة',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold',
        createdAt: new Date().toISOString(),
      };

      const existingTagsHistory = getOrderTagsHistory(abandoned, activeTags);
      const updatedTagsHistory = [
        ...existingTagsHistory.filter(t => t.name !== 'متروكة ناجحة'),
        recoveredTagEntry
      ];

      // Calculate default shipping price if not set or 0
      const wilayaCode = getWilayaCode(abandoned.region);
      const wilayaId = wilayaCode ? parseInt(wilayaCode, 10) : 16;
      const isStopDesk = String(abandoned.shippingMethod || '').includes('مكتب') || 
                         String(abandoned.shippingMethod || '').includes('Stop') ||
                         String(abandoned.shippingMethod || '').includes('stopdesk');
      const defShipping = calculateDefaultShippingFee(wilayaId, isStopDesk);

      const deliveryFee = (abandoned.deliveryPrice !== undefined && Number(abandoned.deliveryPrice) > 0)
        ? Number(abandoned.deliveryPrice)
        : defShipping.suggestedCustomerDeliveryPrice;

      const prodPrice = Number(abandoned.priceWithoutDelivery) || 0;
      const totalCharge = (abandoned.totalCharge && Number(abandoned.totalCharge) > 0)
        ? Number(abandoned.totalCharge)
        : (prodPrice + deliveryFee);

      const newOrder: Order = {
        id: abandoned.id.startsWith('WOO-ABN-') ? abandoned.id.replace('WOO-ABN-', 'WOO-') : `ORD-REC-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        orderId: abandoned.orderId || Math.floor(Math.random() * 1000000).toString(),
        sku: abandoned.sku || 'SKU-' + Math.floor(Math.random() * 10000).toString(),
        orderDate: new Date().toISOString(),
        fullName: abandoned.fullName || 'زبون مسترجع',
        phone: abandoned.phone,
        region: abandoned.region || '',
        city: abandoned.city || '',
        stopdeskCommune: abandoned.stopdeskCommune || '',
        productName: abandoned.productName || 'منتج مسترجع',
        variation: abandoned.variation || '',
        qnts: abandoned.qnts || 1,
        priceWithoutDelivery: prodPrice,
        deliveryPrice: deliveryFee,
        realDeliveryPrice: abandoned.realDeliveryPrice || defShipping.realDeliveryPrice,
        shippingFeeMode: abandoned.shippingFeeMode || 'auto',
        totalCharge: totalCharge,
        shippingMethod: abandoned.shippingMethod || (isStopDesk ? 'توصيل للمكتب (Stop Desk)' : 'توصيل للمنزل'),
        confirmedBy: abandoned.confirmedBy || '',
        status1: 'مؤكد',
        deliveryCompany: abandoned.deliveryCompany || '',
        postponementDate: '',
        status2: 'قيد التجهيز',
        ip: '',
        notes: (abandoned.notes ? `${abandoned.notes} | ` : '') + 'تم استرجاع الطلب من السلات المتروكة بنجاح',
        tag: 'متروكة ناجحة',
        tagsHistory: updatedTagsHistory,
        sourceChannel: abandoned.sourceChannel || '',
        utmSource: abandoned.utmSource || '',
        utmMedium: abandoned.utmMedium || '',
        utmCampaign: abandoned.utmCampaign || '',
        utmContent: abandoned.utmContent || '',
        pysLanding: abandoned.pysLanding || '',
        pysSource: abandoned.pysSource || '',
        pysFirstVisit: abandoned.pysFirstVisit || '',
        pysLastVisit: abandoned.pysLastVisit || '',
        pysUtmSource: abandoned.pysUtmSource || '',
        pysUtmMedium: abandoned.pysUtmMedium || '',
        pysUtmCampaign: abandoned.pysUtmCampaign || '',
      };

      // 1. Add order to regular orders
      await addOrder(newOrder);

      // 2. Remove completely from abandoned carts
      await deleteAbandonedOrder(abandoned.id);

      if (!isBatch) {
        playActionSound('success');
        toast.success(`تم استرجاع السلة بنجاح ونقلها إلى الطلبيات المؤكدة مع تاغ (متروكة ناجحة)!`);
      }
    } catch (err) {
      console.error('Error recovering abandoned cart:', err);
      if (!isBatch) {
        playActionSound('error');
        toast.error('حدث خطأ أثناء استرجاع السلة.');
      }
      throw err;
    } finally {
      if (!isBatch) setIsRecovering(null);
    }
  };

  // Batch Recovery
  const handleBatchRecover = async () => {
    if (selectedIds.length === 0) return;
    setIsBatchRecovering(true);
    let count = 0;
    try {
      const toRecover = abandonedOrders.filter(o => selectedIds.includes(o.id));
      for (const order of toRecover) {
        await handleConvertToOrder(order, true);
        count++;
      }
      setSelectedIds([]);
      playActionSound('success');
      toast.success(`تم استرجاع ${count} سلة متروكة ونقلها إلى الطلبيات مع تاغ (متروكة ناجحة)!`);
    } catch (e) {
      toast.error('حدث خطأ أثناء الاسترجاع الجماعي');
    } finally {
      setIsBatchRecovering(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(o => o.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = localStorage.getItem('abandoned_pageSize');
    return saved ? Number(saved) : 50;
  });

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    localStorage.setItem('abandoned_pageSize', String(newSize));
    setCurrentPage(1);
  };

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedCarts = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, currentTab, tagFilter, hiddenTags]);

  return (
    <div className="space-y-2 flex-1 min-h-0 flex flex-col h-full bg-slate-50/50" dir="rtl">
      {/* Compact Stats Bar with toggle to detailed cards */}
      {showDetailedStats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          <div 
            onClick={() => setStatusFilter('all')}
            className={`bg-white p-2.5 rounded-xl border shadow-2xs flex items-center justify-between cursor-pointer transition-all ${statusFilter === 'all' ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'}`}
          >
            <div>
              <span className="text-[10px] font-bold text-slate-500 block">إجمالي السلات</span>
              <span className="text-base font-black text-slate-900">{stats.total}</span>
            </div>
            <div className="bg-slate-100 p-2 rounded-lg text-slate-600"><ShoppingCart className="w-4 h-4"/></div>
          </div>
          <div 
            onClick={() => setStatusFilter(statusFilter === 'لم يتم التواصل' ? 'all' : 'لم يتم التواصل')}
            className={`bg-white p-2.5 rounded-xl border shadow-2xs flex items-center justify-between cursor-pointer transition-all ${statusFilter === 'لم يتم التواصل' ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/30' : 'border-rose-100 hover:border-rose-200'}`}
          >
            <div>
              <span className="text-[10px] font-bold text-rose-600 block">لم يتم التواصل</span>
              <span className="text-base font-black text-rose-700">{stats.notContacted}</span>
            </div>
            <div className="bg-rose-50 p-2 rounded-lg text-rose-600"><Phone className="w-4 h-4"/></div>
          </div>
          <div 
            onClick={() => setStatusFilter(statusFilter === 'تم الإتصال' ? 'all' : 'تم الإتصال')}
            className={`bg-white p-2.5 rounded-xl border shadow-2xs flex items-center justify-between cursor-pointer transition-all ${statusFilter === 'تم الإتصال' ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-50/30' : 'border-blue-100 hover:border-blue-200'}`}
          >
            <div>
              <span className="text-[10px] font-bold text-blue-600 block">تم التواصل</span>
              <span className="text-base font-black text-blue-700">{stats.contacted}</span>
            </div>
            <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><CheckCircle className="w-4 h-4"/></div>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-emerald-100 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 block">القيمة المحتملة</span>
              <span className="text-base font-black text-emerald-700">{Math.round(stats.totalPotentialValue).toLocaleString('fr-FR')} <span className="text-[10px]">دج</span></span>
            </div>
            <button
              onClick={() => setShowDetailedStats(false)}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded cursor-pointer"
              title="طي الإحصائيات لتوسيع الجدول"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold scrollbar-none py-0.5">
            <span className="text-slate-400 text-[10px] whitespace-nowrap">الإحصائيات:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded-md whitespace-nowrap text-[11px] cursor-pointer transition-all ${statusFilter === 'all' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
            >
              الكل: <strong className={statusFilter === 'all' ? 'text-white' : 'text-slate-900'}>{stats.total}</strong>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'لم يتم التواصل' ? 'all' : 'لم يتم التواصل')}
              className={`px-2 py-0.5 rounded-md whitespace-nowrap text-[11px] cursor-pointer transition-all ${statusFilter === 'لم يتم التواصل' ? 'bg-rose-600 text-white shadow-2xs' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'}`}
            >
              لم يتم التواصل: <strong className={statusFilter === 'لم يتم التواصل' ? 'text-white' : 'text-rose-900'}>{stats.notContacted}</strong>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'تم الإتصال' ? 'all' : 'تم الإتصال')}
              className={`px-2 py-0.5 rounded-md whitespace-nowrap text-[11px] cursor-pointer transition-all ${statusFilter === 'تم الإتصال' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'}`}
            >
              تم التواصل: <strong className={statusFilter === 'تم الإتصال' ? 'text-white' : 'text-blue-900'}>{stats.contacted}</strong>
            </button>
            <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md whitespace-nowrap text-[11px]">القيمة: <strong className="text-emerald-900">{Math.round(stats.totalPotentialValue).toLocaleString('fr-FR')} دج</strong></span>
          </div>
          <button 
            onClick={() => setShowDetailedStats(true)}
            className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 shrink-0 bg-indigo-50/70 hover:bg-indigo-100 px-2 py-1 rounded-lg border border-indigo-100 transition-colors cursor-pointer"
            title="عرض بطاقات الإحصائيات"
          >
            <span>📊 تفصيل</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Main Header & Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>السلات المتروكة</span>
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
              {tabOrders.length} سلة
            </span>
          </h2>
          {/* Main Tabs */}
          <div className="bg-slate-100 p-0.5 rounded-lg flex border border-slate-200">
            <button
              onClick={() => { setCurrentTab('active'); setSelectedIds([]); }}
              className={`px-2.5 py-1 text-[11px] font-bold transition-all rounded-md cursor-pointer ${currentTab === 'active' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
            >
              النشطة ({abandonedOrders.filter(o => !o.archived && !o.trashed).length})
            </button>
            <button
              onClick={() => { setCurrentTab('archived'); setSelectedIds([]); }}
              className={`px-2.5 py-1 text-[11px] font-bold transition-all rounded-md cursor-pointer ${currentTab === 'archived' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
            >
              الأرشيف ({abandonedOrders.filter(o => o.archived && !o.trashed).length})
            </button>
            <button
              onClick={() => { setCurrentTab('trash'); setSelectedIds([]); }}
              className={`px-2.5 py-1 text-[11px] font-bold transition-all rounded-md cursor-pointer ${currentTab === 'trash' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
            >
              المهملات ({abandonedOrders.filter(o => o.trashed).length})
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {/* Selected items batch action */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200">
              <span className="text-[10px] font-bold text-indigo-900">{selectedIds.length} محدد</span>
              <button
                onClick={() => setConfirmAction({ type: 'bulkDelete', id: 'bulk', name: `${selectedIds.length} سلة متروكة` })}
                className="bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-1 shadow-sm"
                title="حذف السلات المحددة"
              >
                <Trash2 className="w-3.5 h-3.5" />
                حذف
              </button>
              <button
                disabled={isBatchRecovering}
                onClick={handleBatchRecover}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-1"
                title="استرجاع السلات المحددة كطلبيات مع تاغ متروكة ناجحة"
              >
                <ShoppingCart className="w-3 h-3" />
                <span>استرجاع كطلبيات</span>
              </button>
            </div>
          )}

          {/* Search */}
          <div className="relative flex-1 sm:w-52">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم، الهاتف، الولاية..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-xs py-1.5 pr-8 pl-2 focus:ring-1 focus:ring-indigo-500 shadow-2xs font-bold placeholder:font-normal"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Status Filter Indicator */}
          {statusFilter !== 'all' && (
            <div className="flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 px-2 py-1 rounded-lg text-[11px] font-bold shadow-2xs shrink-0">
              <span>الحالة: {statusFilter}</span>
              <button 
                onClick={() => setStatusFilter('all')} 
                className="text-amber-600 hover:text-amber-900 cursor-pointer p-0.5"
                title="إلغاء فلتر الحالة"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <button
            onClick={() => setShowTagFilterBar(!showTagFilterBar)}
            className={`border px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs ${showTagFilterBar ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            title="إظهار / إخفاء شريط التاغات"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>التاغات</span>
          </button>

          <button
            onClick={async () => {
              setIsDeduplicating(true);
              try {
                const res = await deduplicateAbandonedOrders();
                playActionSound('success');
                if (res.deletedCount > 0) {
                  toast.success(`تم بنجاح تنظيف ودمج ${res.deletedCount} سلة متروكة مكررة!`);
                } else {
                  toast.success('لا توجد سلات متروكة مكررة.');
                }
              } catch (e) {
                playActionSound('error');
                toast.error('حدث خطأ أثناء تنظيف السلات المتروكة');
              } finally {
                setIsDeduplicating(false);
              }
            }}
            disabled={isDeduplicating}
            className="border px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-2xs bg-white border-amber-300 text-amber-800 hover:bg-amber-50 text-[11px] font-bold disabled:opacity-50 cursor-pointer"
            title="فحص وتنظيف السلات المتروكة المكررة"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDeduplicating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">فحص المكررات</span>
          </button>
        </div>
      </div>

      {/* Duplicate alert banner */}
      {duplicateAbandonedCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-amber-900 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-bold text-xs text-amber-950">
              تم رصد {duplicateAbandonedCount} سلة متروكة مكررة في النظام
            </span>
          </div>
          <button
            disabled={isDeduplicating}
            onClick={async () => {
              setIsDeduplicating(true);
              try {
                const res = await deduplicateAbandonedOrders();
                playActionSound('success');
                if (res.deletedCount > 0) {
                  toast.success(`تم بنجاح تنظيف ودمج ${res.deletedCount} سلة متروكة مكررة!`);
                } else {
                  toast.success('لا توجد مكررات.');
                }
              } catch (e) {
                playActionSound('error');
                toast.error('حدث خطأ أثناء تنظيف السلات');
              } finally {
                setIsDeduplicating(false);
              }
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] flex items-center justify-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <CheckCircle className="w-3 h-3" />
            <span>تنظيف الآن</span>
          </button>
        </div>
      )}

      {/* Tag & Status Filter Bars (compact) */}
      {showTagFilterBar && (
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs shrink-0 overflow-x-auto scrollbar-thin">
          <span className="text-[10px] font-bold text-slate-500 shrink-0 px-1 flex items-center gap-1">
            <Tag className="w-3 h-3 text-indigo-500" />
            <span>التاغات:</span>
          </span>

          <button 
            onClick={() => { setTagFilter('all'); setHiddenTags([]); }} 
            className={`text-[10px] px-2.5 py-0.5 rounded-lg font-bold border transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${tagFilter === 'all' && hiddenTags.length === 0 ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            <span>الكل</span>
            <span className={`px-1 py-0.2 rounded-md text-[8px] font-black ${tagFilter === 'all' && hiddenTags.length === 0 ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {tabOrders.length}
            </span>
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
              <div className={`flex items-center rounded-lg border transition-colors overflow-hidden shrink-0 text-[10px] ${baseColors}`}>
                <button 
                  onClick={() => {
                    if (isHidden) setHiddenTags(prev => prev.filter(t => t !== 'none'));
                    setTagFilter(isActive ? 'all' : 'none');
                  }}
                  className="px-2 py-0.5 font-bold outline-none flex items-center gap-1 cursor-pointer"
                >
                  <span>بدون تاغ</span>
                  <span className={`px-1 py-0.2 rounded-md text-[8px] font-black ${isActive ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {tagCounts['none'] || 0}
                  </span>
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
                  className={`px-1 py-0.5 outline-none hover:bg-black/5 cursor-pointer ${isHidden ? 'text-rose-500' : 'text-slate-400 opacity-50 hover:opacity-100'}`}
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
              baseColors = 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs font-bold';
            }
            return (
              <div key={tag.name} className={`flex items-center rounded-lg border transition-colors overflow-hidden shrink-0 text-[10px] ${baseColors}`}>
                <button 
                  onClick={() => {
                    if (isHidden) setHiddenTags(prev => prev.filter(t => t !== tag.name));
                    setTagFilter(isActive ? 'all' : tag.name);
                  }}
                  className="px-2 py-0.5 font-bold outline-none flex items-center gap-1 cursor-pointer"
                >
                  <span>{tag.name}</span>
                  <span className={`px-1 py-0.2 rounded-md text-[8px] font-black ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {tagCounts[tag.name] || 0}
                  </span>
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
                  className={`px-1 py-0.5 outline-none hover:bg-black/5 cursor-pointer ${isHidden ? 'text-rose-500' : 'text-slate-400 opacity-50 hover:opacity-100'}`}
                  title={isHidden ? "إظهار التاغ" : "إخفاء التاغ"}
                >
                  {isHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Table Container: fills full height with min-h-0 and overflow-hidden */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left border-collapse text-xs bg-white text-right" style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr className="bg-slate-100/90 sticky top-0 text-[11px] uppercase text-slate-700 border-b border-slate-200 z-10 font-black select-none h-10">
                <th className="p-2 border-r border-slate-200 text-center" style={{ width: colWidths.select }}>
                  <button onClick={toggleSelectAll} className="cursor-pointer text-slate-500 hover:text-slate-800">
                    {selectedIds.length > 0 && selectedIds.length === filtered.length ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-2 border-r border-slate-200 relative group" style={{ width: colWidths.orderId }}>
                  <span>#السلة</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'orderId')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-slate-200 group-hover:bg-indigo-400 active:bg-indigo-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-slate-200 relative group" style={{ width: colWidths.orderDate }}>
                  <span>التاريخ</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'orderDate')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-slate-200 group-hover:bg-indigo-400 active:bg-indigo-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-slate-200 relative group" style={{ width: colWidths.fullName }}>
                  <span>الزبون</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'fullName')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-slate-200 group-hover:bg-indigo-400 active:bg-indigo-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-slate-200 relative group" style={{ width: colWidths.phone }}>
                  <span>الهاتف والتواصل</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'phone')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-slate-200 group-hover:bg-indigo-400 active:bg-indigo-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-slate-200 relative group bg-indigo-50/40 text-indigo-950 font-black" style={{ width: colWidths.region }}>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-indigo-600"/> الولاية</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'region')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-indigo-200 group-hover:bg-indigo-400 active:bg-indigo-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-slate-200 relative group bg-indigo-50/40 text-indigo-950 font-black" style={{ width: colWidths.city }}>
                  <span className="flex items-center gap-1"><Building2 className="w-3 h-3 text-indigo-600"/> البلدية</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'city')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-indigo-200 group-hover:bg-indigo-400 active:bg-indigo-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-slate-200 relative group" style={{ width: colWidths.productName }}>
                  <span>المنتج والتفاصيل</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'productName')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-slate-200 group-hover:bg-indigo-400 active:bg-indigo-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-slate-200 relative group text-emerald-950 font-black" style={{ width: colWidths.priceWithoutDelivery }}>
                  <span>سعر المنتج</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'priceWithoutDelivery')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-slate-200 group-hover:bg-indigo-400 active:bg-indigo-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-slate-200 relative group" style={{ width: colWidths.shippingMethod }}>
                  <span>نوع التوصيل</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'shippingMethod')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-slate-200 group-hover:bg-indigo-400 active:bg-indigo-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-slate-200 relative group text-emerald-950 font-black" style={{ width: colWidths.deliveryPrice }}>
                  <span>سعر التوصيل</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'deliveryPrice')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-slate-200 group-hover:bg-indigo-400 active:bg-indigo-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-slate-200 relative group text-indigo-950 font-black" style={{ width: colWidths.totalCharge }}>
                  <span>المجموع</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'totalCharge')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-slate-200 group-hover:bg-indigo-400 active:bg-indigo-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-slate-200 relative group bg-indigo-50/40 text-indigo-900 font-black" style={{ width: colWidths.tag }}>
                  <span>التاغات</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'tag')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-indigo-200 group-hover:bg-indigo-400 active:bg-indigo-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-slate-200 relative group text-blue-900 bg-blue-50/40 font-black" style={{ width: colWidths.status }}>
                  <span>حالة التواصل</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'status')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-200 group-hover:bg-blue-400 active:bg-blue-600 z-20 transition-all" />
                </th>
                <th className="p-2 border-r border-slate-200 relative group" style={{ width: colWidths.notes }}>
                  <span>ملاحظات</span>
                  <div onMouseDown={(e) => handleMouseDown(e, 'notes')} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-slate-200 group-hover:bg-indigo-400 active:bg-indigo-600 z-20 transition-all" />
                </th>
                <th className="p-2 text-center sticky left-0 bg-slate-100 z-20 border-r border-slate-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] font-black" style={{ width: colWidths.actions }}>
                  <span>إجراءات</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={16} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShoppingCart className="w-8 h-8 text-slate-300 stroke-1" />
                      <span className="font-bold text-sm text-slate-600">لا توجد سلات متروكة تطابق بحثك حالياً</span>
                      <span className="text-xs text-slate-400">جرب تغيير كلمات البحث أو معايير الفلترة</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCarts.map((order) => {
                  const isEditing = editingId === order.id;
                  const isChecked = selectedIds.includes(order.id);
                  const displayDate = order.orderDate ? format(parseISO(order.orderDate), 'dd MMM yyyy HH:mm', { locale: ar }) : '-';
                  const tagsHistory = getOrderTagsHistory(order, activeTags);

                  // Extract wilaya & communes for current draft or order
                  const currentRegion = isEditing && editDraft ? editDraft.region : order.region;
                  const wilayaCode = getWilayaCode(currentRegion);
                  const wilayaId = wilayaCode ? parseInt(wilayaCode, 10) : null;
                  const communesList = wilayaId 
                    ? (ecotrackCommunes as any[]).filter((c: any) => c.wilaya_id === wilayaId) 
                    : [];

                  return (
                    <tr key={order.id} className={`hover:bg-slate-50/90 transition-colors border-b border-slate-100 ${isChecked ? 'bg-indigo-50/40' : ''}`}>
                      {/* Checkbox */}
                      <td className="p-2 text-center border-r border-slate-100" style={{ width: colWidths.select }}>
                        <button onClick={() => toggleSelect(order.id)} className="cursor-pointer text-slate-400 hover:text-slate-700">
                          {isChecked ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>

                      {/* Order / Cart ID */}
                      <td className="p-2 font-bold font-mono text-indigo-700 border-r border-slate-100" style={{ width: colWidths.orderId, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.orderId ? `#${order.orderId}` : '-'}
                      </td>

                      {/* Date */}
                      <td className="p-2 font-bold text-slate-700 border-r border-slate-100" style={{ width: colWidths.orderDate, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayDate}
                      </td>

                      {/* Full Name */}
                      <td className="p-2 font-black text-slate-900 border-r border-slate-100 whitespace-nowrap" style={{ width: colWidths.fullName }}>
                        {isEditing && editDraft ? (
                          <input
                            type="text"
                            value={editDraft.fullName || ''}
                            onChange={(e) => setEditDraft({ ...editDraft, fullName: e.target.value })}
                            className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none focus:border-indigo-500 bg-white"
                            placeholder="اسم الزبون"
                          />
                        ) : (
                          <span className="truncate block font-bold" title={order.fullName || '-'}>
                            {order.fullName || '-'}
                          </span>
                        )}
                      </td>

                      {/* Phone & Contact Quick Buttons */}
                      <td className="p-2 font-bold text-slate-800 border-r border-slate-100 whitespace-nowrap" style={{ width: colWidths.phone }}>
                        {isEditing && editDraft ? (
                          <input
                            type="text"
                            value={editDraft.phone || ''}
                            onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })}
                            className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none focus:border-indigo-500 text-left bg-white font-mono"
                            placeholder="الهاتف"
                          />
                        ) : (
                          <div className="flex items-center justify-between gap-1.5">
                            <a href={`tel:${order.phone}`} className="font-mono text-xs text-blue-700 hover:underline font-black" dir="ltr">
                              {order.phone}
                            </a>
                            <div className="flex items-center gap-1">
                              <a
                                href={formatWhatsAppLink(order.phone, order.fullName, order.productName, settings?.smsTemplates?.abandoned)}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded transition-colors"
                                title="مراسلة عبر واتساب"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`tel:${order.phone}`}
                                className="p-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition-colors"
                                title="اتصال بالزبون"
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Wilaya Selection - Editable right in cell or via Edit mode */}
                      <td className="p-1.5 border-r border-slate-100 font-bold bg-indigo-50/15 text-slate-900" style={{ width: colWidths.region }}>
                        {isEditing && editDraft ? (
                          <select
                            value={editDraft.region ? getWilayaCode(editDraft.region) : ''}
                            onChange={(e) => {
                              const selCode = e.target.value;
                              if (selCode) {
                                const wilayaObj = ALGERIA_WILAYAS.find(w => w.code === selCode);
                                const label = wilayaObj ? `${wilayaObj.code} - ${wilayaObj.name}` : selCode;
                                const wilayaNum = parseInt(selCode, 10);
                                const isDesk = String(editDraft.shippingMethod || '').includes('مكتب');
                                const defPricing = calculateDefaultShippingFee(wilayaNum, isDesk);
                                
                                setEditDraft({
                                  ...editDraft,
                                  region: label,
                                  city: '',
                                  deliveryPrice: editDraft.deliveryPrice || defPricing.suggestedCustomerDeliveryPrice
                                });
                              } else {
                                setEditDraft({ ...editDraft, region: '', city: '' });
                              }
                            }}
                            className="w-full border border-indigo-300 rounded px-1.5 py-1 text-xs font-bold focus:outline-none focus:border-indigo-500 bg-white"
                          >
                            <option value="">اختر الولاية...</option>
                            {ALGERIA_WILAYAS.map((w) => (
                              <option key={w.code} value={w.code}>
                                {w.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={order.region ? getWilayaCode(order.region) : ''}
                            onChange={(e) => {
                              const selCode = e.target.value;
                              if (selCode) {
                                const wilayaObj = ALGERIA_WILAYAS.find(w => w.code === selCode);
                                const label = wilayaObj ? `${wilayaObj.code} - ${wilayaObj.name}` : selCode;
                                const wilayaNum = parseInt(selCode, 10);
                                const isDesk = String(order.shippingMethod || '').includes('مكتب');
                                const defPricing = calculateDefaultShippingFee(wilayaNum, isDesk);
                                const newDeliv = order.deliveryPrice || defPricing.suggestedCustomerDeliveryPrice;
                                const prodPrice = Number(order.priceWithoutDelivery) || 0;
                                
                                handleQuickUpdate(order.id, {
                                  region: label,
                                  city: '',
                                  deliveryPrice: newDeliv,
                                  totalCharge: prodPrice + newDeliv
                                });
                              } else {
                                handleQuickUpdate(order.id, { region: '', city: '' });
                              }
                            }}
                            className="w-full border border-transparent hover:border-slate-300 rounded px-1 py-0.5 text-[11px] font-black focus:outline-none focus:border-indigo-500 bg-transparent hover:bg-white transition-all cursor-pointer"
                          >
                            <option value="">اختر الولاية...</option>
                            {ALGERIA_WILAYAS.map((w) => (
                              <option key={w.code} value={w.code}>
                                {w.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* Commune Selection - Editable right in cell with Wilaya integration */}
                      <td className="p-1.5 border-r border-slate-100 font-bold text-slate-800" style={{ width: colWidths.city }}>
                        {isEditing && editDraft ? (
                          communesList.length > 0 ? (
                            <select
                              value={editDraft.city || ''}
                              onChange={(e) => setEditDraft({ ...editDraft, city: e.target.value })}
                              className="w-full border border-indigo-300 rounded px-1.5 py-1 text-xs font-bold focus:outline-none focus:border-indigo-500 bg-white"
                            >
                              <option value="">اختر البلدية...</option>
                              {communesList.map((c: any, idx: number) => (
                                <option key={`abn-commune-${idx}`} value={c.nom}>
                                  {c.nom} {c.has_stop_desk === 1 ? '🏪 (مكتب)' : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={editDraft.city || ''}
                              onChange={(e) => setEditDraft({ ...editDraft, city: e.target.value })}
                              className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs font-bold focus:outline-none focus:border-indigo-500 bg-white"
                              placeholder="البلدية/المدينة"
                            />
                          )
                        ) : (
                          communesList.length > 0 ? (
                            <select
                              value={order.city || ''}
                              onChange={(e) => handleQuickUpdate(order.id, { city: e.target.value })}
                              className="w-full border border-transparent hover:border-slate-300 rounded px-1 py-0.5 text-[11px] font-bold focus:outline-none focus:border-indigo-500 bg-transparent hover:bg-white transition-all cursor-pointer truncate"
                            >
                              <option value="">اختر البلدية...</option>
                              {communesList.map((c: any, idx: number) => (
                                <option key={`abn-view-commune-${idx}`} value={c.nom}>
                                  {c.nom} {c.has_stop_desk === 1 ? '🏪 (مكتب)' : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              defaultValue={order.city || ''}
                              onBlur={(e) => {
                                if (e.target.value !== (order.city || '')) {
                                  handleQuickUpdate(order.id, { city: e.target.value });
                                }
                              }}
                              className="w-full bg-transparent border border-transparent hover:border-slate-300 rounded px-1 py-0.5 text-[11px] font-bold focus:bg-white focus:border-indigo-400 outline-none"
                              placeholder="البلدية..."
                            />
                          )
                        )}
                      </td>

                      {/* Product Name & Variation */}
                      <td className="p-2 border-r border-slate-100" style={{ width: colWidths.productName }} title={order.productName || ''}>
                        {isEditing && editDraft ? (
                          <div className="flex flex-col gap-1 w-full">
                            <input
                              type="text"
                              value={editDraft.productName || ''}
                              onChange={(e) => setEditDraft({ ...editDraft, productName: e.target.value })}
                              className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none focus:border-indigo-500 bg-white"
                              placeholder="اسم المنتج"
                            />
                            <input
                              type="text"
                              value={editDraft.variation || ''}
                              onChange={(e) => setEditDraft({ ...editDraft, variation: e.target.value })}
                              className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-bold focus:outline-none focus:border-indigo-500 bg-white"
                              placeholder="الخصائص / الحجم / اللون"
                            />
                          </div>
                        ) : (
                          <div className="truncate w-full font-bold text-slate-900">
                            {order.productName || '-'} {order.variation && <span className="text-slate-500 font-normal">({order.variation})</span>}
                          </div>
                        )}
                      </td>

                      {/* Product Price */}
                      <td className="p-2 border-r border-slate-100 font-black text-emerald-950" style={{ width: colWidths.priceWithoutDelivery }}>
                        {isEditing && editDraft ? (
                          <input
                            type="number"
                            value={editDraft.priceWithoutDelivery || 0}
                            onChange={(e) => {
                              const p = Number(e.target.value) || 0;
                              const d = Number(editDraft.deliveryPrice) || 0;
                              setEditDraft({ ...editDraft, priceWithoutDelivery: p, totalCharge: p + d });
                            }}
                            className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none focus:border-indigo-500 bg-white"
                          />
                        ) : (
                          order.priceWithoutDelivery ? `${order.priceWithoutDelivery} دج` : '-'
                        )}
                      </td>

                      {/* Shipping Method */}
                      <td className="p-2 border-r border-slate-100 font-bold text-slate-700" style={{ width: colWidths.shippingMethod }}>
                        {isEditing && editDraft ? (
                          <select
                            value={editDraft.shippingMethod || 'توصيل للمنزل'}
                            onChange={(e) => {
                              const method = e.target.value;
                              const wilayaNum = getWilayaCode(editDraft.region) ? parseInt(getWilayaCode(editDraft.region), 10) : 16;
                              const isDesk = method.includes('مكتب');
                              const defPrice = calculateDefaultShippingFee(wilayaNum, isDesk);
                              setEditDraft({
                                ...editDraft,
                                shippingMethod: method,
                                deliveryPrice: defPrice.suggestedCustomerDeliveryPrice,
                                totalCharge: (Number(editDraft.priceWithoutDelivery) || 0) + defPrice.suggestedCustomerDeliveryPrice
                              });
                            }}
                            className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs font-bold focus:outline-none focus:border-indigo-500 bg-white"
                          >
                            <option value="توصيل للمنزل">توصيل للمنزل</option>
                            <option value="توصيل للمكتب (Stop Desk)">توصيل للمكتب (Stop Desk)</option>
                          </select>
                        ) : (
                          <span className="truncate block">
                            {order.shippingMethod || '-'}
                          </span>
                        )}
                      </td>

                      {/* Delivery Price */}
                      <td className="p-2 border-r border-slate-100 font-black text-slate-900" style={{ width: colWidths.deliveryPrice }}>
                        {isEditing && editDraft ? (
                          <input
                            type="number"
                            value={editDraft.deliveryPrice || 0}
                            onChange={(e) => {
                              const d = Number(e.target.value) || 0;
                              const p = Number(editDraft.priceWithoutDelivery) || 0;
                              setEditDraft({ ...editDraft, deliveryPrice: d, totalCharge: p + d });
                            }}
                            className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none focus:border-indigo-500 bg-white"
                          />
                        ) : (
                          order.deliveryPrice ? `${order.deliveryPrice} دج` : '-'
                        )}
                      </td>

                      {/* Total Charge */}
                      <td className="p-2 border-r border-slate-100 font-black text-indigo-950 bg-indigo-50/10" style={{ width: colWidths.totalCharge }}>
                        {isEditing && editDraft ? (
                          <input
                            type="number"
                            value={editDraft.totalCharge || 0}
                            onChange={(e) => setEditDraft({ ...editDraft, totalCharge: Number(e.target.value) })}
                            className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none focus:border-indigo-500 bg-white"
                          />
                        ) : (
                          order.totalCharge ? `${order.totalCharge} دج` : '-'
                        )}
                      </td>

                      {/* Tag Column with full history and quick-add/remove */}
                      <td className="p-1.5 bg-indigo-50/10 border-r border-indigo-50" style={{ width: colWidths.tag }}>
                        <div className="flex flex-col gap-1 text-right">
                          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                            {tagsHistory.length === 0 ? (
                              <span className="text-[10px] text-slate-400 italic">بدون تاغ</span>
                            ) : (
                              tagsHistory.map((t) => (
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
                                      handleRemoveTag(order, t.id);
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

                          <div className="flex items-center gap-1">
                            <select
                              value=""
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__CREATE_NEW_TAG__') {
                                  setQuickTagTargetOrder(order);
                                  setIsQuickTagModalOpen(true);
                                } else if (val) {
                                  handleAddTag(order, val);
                                }
                                e.target.value = '';
                              }}
                              className="w-full bg-white border border-indigo-200 hover:border-indigo-400 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 focus:outline-none transition-all cursor-pointer text-center"
                            >
                              <option value="">+ إضافة تاغ...</option>
                              <option value="__CREATE_NEW_TAG__" className="text-indigo-600 font-extrabold bg-indigo-50">✨ + إنشاء تاغ جديد...</option>
                              {activeTags.map(opt => (
                                <option key={opt.name} value={opt.name}>{opt.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                setQuickTagTargetOrder(order);
                                setIsQuickTagModalOpen(true);
                              }}
                              title="إنشاء تاغ جديد وحفظه في السحابة"
                              className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md border border-indigo-200 transition-colors cursor-pointer shrink-0"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Communication Status */}
                      <td className="p-1.5 bg-blue-50/10 border-r border-blue-50 font-black" style={{ width: colWidths.status }}>
                        <select
                          value={isEditing && editDraft ? (editDraft.status || 'لم يتم التواصل') : (order.status || 'لم يتم التواصل')}
                          onChange={(e) => {
                            const newStatus = e.target.value;
                            if (isEditing && editDraft) {
                              setEditDraft({ ...editDraft, status: newStatus });
                            } else {
                              updateAbandonedOrder(order.id, { status: newStatus });
                              toast.success(`تم تحديث الحالة: ${newStatus}`);
                            }
                          }}
                          className={`w-full bg-white border rounded-full px-2 py-0.5 text-[10px] font-black focus:outline-none cursor-pointer text-center ${
                            getAbandonedStatusClass(isEditing && editDraft ? editDraft.status : (order.status || 'لم يتم التواصل'))
                          }`}
                        >
                          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>

                      {/* Notes */}
                      <td className="p-2 border-r border-slate-100" style={{ width: colWidths.notes }}>
                        {isEditing && editDraft ? (
                          <input
                            type="text"
                            value={editDraft.notes || ''}
                            onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                            className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none focus:border-indigo-500 bg-white"
                            placeholder="ملاحظات..."
                          />
                        ) : (
                          <input
                            key={`view-notes-${order.id}`}
                            type="text"
                            defaultValue={order.notes || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (order.notes || '')) {
                                updateAbandonedOrder(order.id, { notes: e.target.value });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 hover:bg-slate-50 focus:border-indigo-400 focus:bg-white rounded px-1 py-0.5 text-xs font-medium focus:outline-none transition-all text-right"
                            placeholder="أضف ملاحظة..."
                          />
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-2 text-center sticky left-0 bg-white z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] border-r border-slate-100" style={{ width: colWidths.actions }}>
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={handleSave} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors" title="حفظ التعديلات">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={handleCancel} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors" title="إلغاء">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* Recover Button: Instant transition to regular orders with 'متروكة ناجحة' tag */}
                            <button 
                              disabled={isRecovering === order.id}
                              onClick={() => handleConvertToOrder(order)} 
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg flex items-center justify-center gap-1 text-[11px] font-black shadow-xs transition-all cursor-pointer disabled:opacity-50"
                              title="إسترجاع كطلبية مؤكدة مع تاغ (متروكة ناجحة)"
                            >
                              <ShoppingCart className="w-3 h-3" />
                              <span>إسترجاع</span>
                            </button>

                            {/* Edit Button */}
                            <button 
                              onClick={() => handleEdit(order)} 
                              className="p-1.5 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg bg-slate-50 border border-slate-200 transition-colors cursor-pointer" 
                              title="تعديل تفاصيل السلة"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {currentTab === 'trash' ? (
                              <>
                                <button
                                  onClick={() => setConfirmAction({ type: 'restoreTrash', id: order.id, name: `#${order.orderId}` })}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer"
                                  title="استعادة من سلة المهملات"
                                >
                                  <ArchiveRestore className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setConfirmAction({ type: 'delete', id: order.id, name: `#${order.orderId}` })}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer"
                                  title="حذف نهائي"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : currentTab === 'archived' ? (
                              <>
                                <button
                                  onClick={() => setConfirmAction({ type: 'restore', id: order.id, name: `#${order.orderId}` })}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer"
                                  title="استعادة من الأرشيف"
                                >
                                  <ArchiveRestore className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setConfirmAction({ type: 'trash', id: order.id, name: `#${order.orderId}` })}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer"
                                  title="نقل لسلة المهملات"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => setConfirmAction({ type: 'archive', id: order.id, name: `#${order.orderId}` })}
                                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer"
                                  title="أرشفة السلة"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setConfirmAction({ type: 'trash', id: order.id, name: `#${order.orderId}` })}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer"
                                  title="حذف إلى المهملات"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          pageSizeOptions={[25, 50, 100, 200]}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
          itemLabel="سلة متروكة"
          className="shrink-0"
        />
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden" dir="rtl">
            <div className={`p-4 flex items-start gap-3 border-b ${
              confirmAction.type === 'delete' || confirmAction.type === 'bulkDelete' || confirmAction.type === 'trash' ? 'border-rose-100 bg-rose-50/50' : 
              confirmAction.type === 'archive' ? 'border-amber-100 bg-amber-50/50' : 
              'border-emerald-100 bg-emerald-50/50'
            }`}>
              <div className={`p-2 rounded-full ${
                confirmAction.type === 'delete' || confirmAction.type === 'bulkDelete' || confirmAction.type === 'trash' ? 'bg-rose-100 text-rose-600' : 
                confirmAction.type === 'archive' ? 'bg-amber-100 text-amber-600' : 
                'bg-emerald-100 text-emerald-600'
              }`}>
                {confirmAction.type === 'delete' || confirmAction.type === 'bulkDelete' || confirmAction.type === 'trash' ? <Trash2 className="w-5 h-5" /> : 
                 confirmAction.type === 'archive' ? <Archive className="w-5 h-5" /> : 
                 <ArchiveRestore className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mt-1">
                  {confirmAction.type === 'delete' || confirmAction.type === 'bulkDelete' ? 'تأكيد الحذف النهائي' : 
                   confirmAction.type === 'trash' ? 'نقل إلى سلة المهملات' : 
                   confirmAction.type === 'archive' ? 'تأكيد الأرشفة' : 
                   'تأكيد الإستعادة'}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {confirmAction.type === 'delete' ? `هل أنت متأكد من حذف السلة ${confirmAction.name} بشكل نهائي؟ لا يمكن التراجع عن هذه الخطوة.` : 
                   confirmAction.type === 'bulkDelete' ? `هل أنت متأكد من حذف ${confirmAction.name} بشكل نهائي؟` : 
                   confirmAction.type === 'trash' ? `هل أنت متأكد من نقل السلة ${confirmAction.name} إلى سلة المهملات؟` : 
                   confirmAction.type === 'archive' ? `هل أنت متأكد من أرشفة السلة ${confirmAction.name}؟` : 
                   `هل أنت متأكد من إستعادة السلة ${confirmAction.name}؟`}
                </p>
              </div>
            </div>
            <div className="bg-slate-50 px-4 py-3 flex justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleActionConfirm}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-colors cursor-pointer ${
                  confirmAction.type === 'delete' || confirmAction.type === 'bulkDelete' || confirmAction.type === 'trash' ? 'bg-rose-600 hover:bg-rose-700' : 
                  confirmAction.type === 'archive' ? 'bg-amber-600 hover:bg-amber-700' : 
                  'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Tag Modal */}
      <QuickAddTagModal
        isOpen={isQuickTagModalOpen}
        targetOrder={quickTagTargetOrder}
        isAbandoned={true}
        onClose={() => {
          setIsQuickTagModalOpen(false);
          setQuickTagTargetOrder(null);
        }}
      />
    </div>
  );
}
