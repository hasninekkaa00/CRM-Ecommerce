import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../store';
import { checkProductMatch, renderProductFilterOptions } from '../../utils/productFilters';
import { 
  Truck, CheckCircle, Search, RefreshCw, Undo2, Printer, MapPin, Package, 
  ChevronDown, ChevronUp, ChevronLeft, Filter, ArrowUpDown, TrendingUp, CheckSquare, XSquare, Clock, Link, X, AlertTriangle, EyeOff, Eye, RotateCcw, Edit2, Save, Maximize2, Minimize2
} from 'lucide-react';
import { format, subDays, isAfter, parseISO, startOfDay, endOfDay, startOfWeek, subMonths, isSameDay, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { fetchUniversalTrackingInfo } from '../../utils/universalShippingApi';
import { TablePagination } from '../common/TablePagination';
import { safeParseDate, safeIsWithinInterval } from '../../utils/financeCalculations';

const translateActivityStatus = (status: string) => {
  if (!status) return '';
  const lowerStatus = String(status).toLowerCase().trim().replace(/[\s_-]+/g, '');
  const map: Record<string, string> = {
    'orderinformationreceivedbycarrier': 'جاهزة للإرسال',
    'created': 'جاهزة للإرسال',
    'prêtàexpédier': 'جاهزة للإرسال',
    'pretaexpedier': 'جاهزة للإرسال',
    'prêt': 'جاهزة للإرسال',
    'pret': 'جاهزة للإرسال',
    'coliscréé': 'جاهزة للإرسال',
    'coliscree': 'جاهزة للإرسال',
    'enregistré': 'جاهزة للإرسال',
    'enregistre': 'جاهزة للإرسال',
    'demanded\'enlèvement': 'جاهزة للإرسال',
    'demanded\'expedition': 'جاهزة للإرسال',
    'picked': 'تم استلام الطلبية',
    'acceptedbycarrier': 'مستلمة في مركز الفرز (Hub)',
    'dispatchedtodriver': 'قيد التوصيل (موزعة للمندوب)',
    'attemptdelivery': 'محاولة توصيل',
    'returnasked': 'طلب إرجاع',
    'returnintransit': 'مرتجع في الطريق',
    'returnreceived': 'تم استقبال المرتجع',
    'livred': 'تم التوصيل',
    'livré': 'تم التوصيل',
    'livre': 'تم التوصيل',
    'delivered': 'تم التوصيل',
    'encaissed': 'تم تحصيل المبلغ',
    'encaissé': 'تم تحصيل المبلغ',
    'encaisse': 'تم تحصيل المبلغ',
    'payed': 'تم الدفع للمتجر',
    'payé': 'تم الدفع للمتجر',
    'paye': 'تم الدفع للمتجر',
    'paid': 'تم الدفع للمتجر',
    'retour': 'مرتجع',
    'retourné': 'مرتجع',
    'returned': 'مرتجع',
    'deliveryfailed': 'فشل التوصيل',
    'canceled': 'ملغى',
    'cancelled': 'ملغى'
  };
  return map[lowerStatus] || status;
};

import { needsAction, getActionPriority, getLastAttemptDate, getAttemptCount } from '../../utils/orderUtils';
import { ViewOrderModal } from './ViewOrderModal';
import { ReplaceOrderModal } from './ReplaceOrderModal';
import { playActionSound } from '../../utils/audioUtils';
import { PickingListModal } from './PickingListModal';
import { SourceChannelBadge } from '../../utils/channelUtils';

export function ShippedOrdersList() {
  const {  
    orders, 
    updateOrder, 
    settings, 
    inventoryProducts, 
    bulkUpsertInventory,
    trackingQueue,
    addToTrackingQueue,
    setTrackingQueueState,
    isTrackingQueueProcessing,
    salesChannels,
    globalProductFilter,
    setGlobalProductFilter
  , users } = useStore();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };


  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleFilter = (e: any) => {
      if (e.detail && e.detail.searchTerm) {
        setSearchTerm(e.detail.searchTerm);
        setStatusFilter('all');
        setHiddenStatuses([]);
        setDateFilter('all');
        setCompanyFilter('all');
        setConfirmedByFilter('all');
        setActionRequiredFilter(false);
        setAttemptFilter('all');
        setAttemptDateFrom('');
        setAttemptDateTo('');
      }
    };
    document.addEventListener('filter-orders', handleFilter);
    return () => document.removeEventListener('filter-orders', handleFilter);
  }, []);
  const [confirmReturn, setConfirmReturn] = useState<string | null>(null);
  const [confirmRestock, setConfirmRestock] = useState<string | null>(null);
  const [confirmReshipped, setConfirmReshipped] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [lastAutoSyncTime, setLastAutoSyncTime] = useState<number>(() => {
    const saved = localStorage.getItem('shipped_orders_last_auto_sync');
    return saved ? parseInt(saved, 10) : 0;
  });

  const getLastSyncLabel = () => {
    if (!lastAutoSyncTime) return 'لم يتم التحديث التلقائي بعد';
    const diffMins = Math.floor((Date.now() - lastAutoSyncTime) / 60000);
    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return 'منذ ساعة';
    if (diffHours === 2) return 'منذ ساعتين';
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'منذ يوم';
    if (diffDays === 2) return 'منذ يومين';
    return `منذ ${diffDays} يوم`;
  };
  const [manualTrackingModal, setManualTrackingModal] = useState<{ order: any } | null>(null);
  const [manualTrackingId, setManualTrackingId] = useState('');
  const [trackingHistoryModal, setTrackingHistoryModal] = useState<{ order: any } | null>(null);
  const [manualStatusModal, setManualStatusModal] = useState<{ order: any } | null>(null);
  const [selectedManualStatus, setSelectedManualStatus] = useState('مستلم');
  const [manualStatusNote, setManualStatusNote] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [viewOrderModal, setViewOrderModal] = useState<any | null>(null);
  const [replaceOrderModal, setReplaceOrderModal] = useState<any | null>(null);
  const [editProductModal, setEditProductModal] = useState<{ order: any, sku: string, productName: string, variation: string, priceWithoutDelivery: number } | null>(null);
  const [showPickingList, setShowPickingList] = useState(false);

  const toggleRowExpand = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedRows(newSet);
  };
  
  const [hasShownToast, setHasShownToast] = useState(false);
  
  // Filters & Sorting
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>(() => {
    const saved = localStorage.getItem('shipped_dateFilter');
    return (saved as any) || 'all';
  });

  useEffect(() => {
    localStorage.setItem('shipped_dateFilter', dateFilter);
  }, [dateFilter]);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [statusFilter, setStatusFilter] = useState('all');
  const [hiddenStatuses, setHiddenStatuses] = useState<string[]>([]);
  const [status2Filter, setStatus2Filter] = useState('all');
  const [hiddenStatuses2, setHiddenStatuses2] = useState<string[]>([]);

  const [companyFilter, setCompanyFilter] = useState('all');
  const [productFilter, setProductFilter] = useState(() => globalProductFilter || localStorage.getItem('shipped_orders_productFilter') || 'all');

  useEffect(() => {
    if (globalProductFilter !== undefined) {
      setProductFilter(prev => (prev === globalProductFilter ? prev : globalProductFilter));
    }
  }, [globalProductFilter]);
  const [confirmedByFilter, setConfirmedByFilter] = useState('all');
  const [actionRequiredFilter, setActionRequiredFilter] = useState(false);
  const [attemptDateFrom, setAttemptDateFrom] = useState('');
  const [attemptDateTo, setAttemptDateTo] = useState('');
  const [attemptFilter, setAttemptFilter] = useState<'all' | '0' | '1' | '2+'>('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = localStorage.getItem('shipped_pageSize');
    return saved ? Number(saved) : 50;
  });

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    localStorage.setItem('shipped_pageSize', String(newSize));
    setCurrentPage(1);
  };
  
  useEffect(() => {
    if (localStorage.getItem('dashboard_nav_action_required') === 'true') {
      setActionRequiredFilter(true);
      setShowFilters(true);
      localStorage.removeItem('dashboard_nav_action_required');
    }
  }, []);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const shippedStatus = useMemo(() => ['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع', 'قابلة للشحن'], []);
  const status2Options = settings?.status2Options || ['قيد التجهيز', 'تم الشحن', 'في الطريق', 'مستلم', 'مرتجع', 'قابلة للشحن'];

  const shippedOrders = useMemo(() => {
    return orders.filter(o => !o.trashed && (o.shippingTrackingId || shippedStatus.includes(o.status2 || '')));
  }, [orders, shippedStatus]);

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

  const deliveryCompanies = useMemo(() => {
    const defaultDeliveryList = ['ياليدين', 'مايسترو', 'زد آر إكسبريس', 'إيكوتراك', 'أرامكس', 'توصيل محلي'];
    const customDelivery = Array.isArray(settings?.deliveryCompanies)
      ? settings.deliveryCompanies 
      : defaultDeliveryList;
    const integrationDelivery = settings?.shippingIntegrations?.filter(i => i.isActive).map(i => i.name).filter(Boolean) || [];
    return Array.from(new Set([...customDelivery, ...integrationDelivery]));
  }, [settings]);

  const checkProductMatchLocal = (orderOrSku: any) => {
      return checkProductMatch(orderOrSku, productFilter, inventoryProducts || []);
  };

  const productFilterOptionsJSX = useMemo(() => {
    return renderProductFilterOptions(inventoryProducts || [], shippedOrders);
  }, [shippedOrders, inventoryProducts]);
  const confirmers = Array.from(new Set(users.filter(u => u.role === 'confirmer' || (u.commissionConfig && u.isActive)).map(u => u.displayName).filter(Boolean)));

  const { start, end } = useMemo(() => {
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
      e = endOfDay(now);
    } else if (dateFilter === 'custom' && customStart && customEnd) {
      s = startOfDay(new Date(customStart));
      e = endOfDay(new Date(customEnd));
    }
    return { start: s, end: e };
  }, [dateFilter, customStart, customEnd]);

  // KPIs Calculation
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    
    let total = 0, delivered = 0, returned = 0, inTransit = 0;
    let recentDelivered = 0, recentReturned = 0;
    let attempt1 = 0, attempt2Plus = 0, shippedOnly = 0;
    
    // Quick Stats Counts for today, week, month
    let tShippedCount = 0, wShippedCount = 0, mShippedCount = 0;
    let tDeliveredCount = 0, wDeliveredCount = 0, mDeliveredCount = 0;
    let tReturnedCount = 0, wReturnedCount = 0, mReturnedCount = 0;

    const tStart = startOfDay(now);
    const wStart = startOfWeek(now, { weekStartsOn: 6 });
    const mStart = startOfMonth(now);
    const eDay = endOfDay(now);

    const isSearching = !!searchTerm.trim();

    const baseSearchProductCompanyConfirmerFilter = shippedOrders.filter(o => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !isSearching || (
        (o.fullName || '').toLowerCase().includes(term) ||
        (o.phone || '').toLowerCase().includes(term) ||
        (o.shippingTrackingId || '').toLowerCase().includes(term) ||
        (String(o.orderId || '')).toLowerCase().includes(term) ||
        (o.id || '').toLowerCase().includes(term)
      );
      if (isSearching) {
        return matchesSearch;
      }
      const matchesCompany = companyFilter === 'all' || o.deliveryCompany === companyFilter;
      const matchesProduct = checkProductMatchLocal(o);
      const matchesConfirmedBy = confirmedByFilter === 'all' || o.confirmedBy === confirmedByFilter;
      
      return matchesSearch && matchesCompany && matchesProduct && matchesConfirmedBy;
    });

    const getDeliveryDate = (ord: any) => {
       let matchedDate = null;
       if (ord.activity && Array.isArray(ord.activity)) {
          const act = [...ord.activity].reverse().find(a => a.status === 'livred' || a.status === 'encaissed' || a.status === 'payed');
          if (act && act.date) matchedDate = safeParseDate(act.date);
       }
       if (!matchedDate && ord.trackingHistory && Array.isArray(ord.trackingHistory)) {
          const hist = [...ord.trackingHistory].reverse().find(a => a.status?.includes('مستلم') || a.status?.includes('تم التوصيل'));
          if (hist && hist.date) matchedDate = safeParseDate(hist.date);
       }
       if (!matchedDate && ord.manualActivity && Array.isArray(ord.manualActivity)) {
           const mAct = ord.manualActivity.find((a:any) => a.status === 'مستلم');
           if (mAct && mAct.date) matchedDate = safeParseDate(mAct.date);
       }
       if (!matchedDate && ord.orderDate) {
           matchedDate = safeParseDate(ord.orderDate);
       }
       return matchedDate;
    };

    const getReturnDate = (ord: any) => {
       let matchedDate = null;
       if (ord.activity && Array.isArray(ord.activity)) {
          const act = [...ord.activity].reverse().find(a => a.status === 'Return_received' || a.status === 'return_received' || a.status === 'return_asks' || a.status === 'return_in_transit');
          if (act && act.date) matchedDate = safeParseDate(act.date);
       }
       if (!matchedDate && ord.trackingHistory && Array.isArray(ord.trackingHistory)) {
          const hist = [...ord.trackingHistory].reverse().find(a => a.status?.includes('مرتجع') || a.status?.includes('تم الإسترجاع'));
          if (hist && hist.date) matchedDate = safeParseDate(hist.date);
       }
       if (!matchedDate && ord.manualActivity && Array.isArray(ord.manualActivity)) {
           const mAct = ord.manualActivity.find((a:any) => a.status === 'مرتجع');
           if (mAct && mAct.date) matchedDate = safeParseDate(mAct.date);
       }
       if (!matchedDate && ord.orderDate) {
           matchedDate = safeParseDate(ord.orderDate);
       }
       return matchedDate;
    };

    baseSearchProductCompanyConfirmerFilter.forEach(o => {
      const st = mapStatusToStatus2(o.status2 || '', o);
      const isShippedExpected = !['ملغى', 'ملغاة', 'إلغاء'].includes(st) && (o.status1 === 'مؤكد' || st === 'تم الشحن' || st === 'في الطريق' || st === 'مستلم' || st === 'مرتجع' || st === 'قابلة للشحن');

      if (o.orderDate && isShippedExpected) {
        const oDate = safeParseDate(o.orderDate);
        if (oDate) {
          if (oDate >= mStart && oDate <= eDay) mShippedCount++;
          if (oDate >= wStart && oDate <= eDay) wShippedCount++;
          if (oDate >= tStart && oDate <= eDay) tShippedCount++;
        }
      }

      if (st === 'مستلم') {
        const dDate = getDeliveryDate(o);
        if (dDate) {
           if (dDate >= mStart && dDate <= eDay) mDeliveredCount++;
           if (dDate >= wStart && dDate <= eDay) wDeliveredCount++;
           if (dDate >= tStart && dDate <= eDay) tDeliveredCount++;
        }
      } else if (st === 'مرتجع') {
        const rDate = getReturnDate(o);
        if (rDate) {
           if (rDate >= mStart && rDate <= eDay) mReturnedCount++;
           if (rDate >= wStart && rDate <= eDay) wReturnedCount++;
           if (rDate >= tStart && rDate <= eDay) tReturnedCount++;
        }
      }
    });

    const baseOrdersForStats = baseSearchProductCompanyConfirmerFilter.filter(o => {
      if (isSearching) return true;
      let matchesDate = true;
      if (start && end) {
         const oDate = safeParseDate(o.orderDate);
         const st = mapStatusToStatus2(o.status2 || '', o);
         let targetDate = oDate;
         if (st === 'مستلم') {
           const dDate = getDeliveryDate(o);
           if (dDate) targetDate = dDate;
         } else if (st === 'مرتجع') {
           const rDate = getReturnDate(o);
           if (rDate) targetDate = rDate;
         }
         matchesDate = !!targetDate && safeIsWithinInterval(targetDate, { start, end });
      }
      return matchesDate;
    });

    baseOrdersForStats.forEach(o => {
      total++;
      const st = mapStatusToStatus2(o.status2 || '', o);
      
      if (st === 'مستلم') {
        delivered++;
        if (o.orderDate && isAfter(new Date(o.orderDate), thirtyDaysAgo)) recentDelivered++;
      } else if (st === 'مرتجع') {
        returned++;
        if (o.orderDate && isAfter(new Date(o.orderDate), thirtyDaysAgo)) recentReturned++;
      } else {
        inTransit++;
        const attempts = getAttemptCount(o);
        if (attempts === 1) attempt1++;
        else if (attempts >= 2) attempt2Plus++;
        else shippedOnly++;
      }
    });

    const deliveryRate = total > 0 ? ((delivered / total) * 100).toFixed(1) : '0';
    const returnRate = total > 0 ? ((returned / total) * 100).toFixed(1) : '0';

    return { 
      total, delivered, returned, inTransit, deliveryRate, returnRate, 
      recentDelivered, recentReturned, attempt1, attempt2Plus, shippedOnly, baseOrdersForStats,
      tShippedCount, wShippedCount, mShippedCount,
      tDeliveredCount, wDeliveredCount, mDeliveredCount,
      tReturnedCount, wReturnedCount, mReturnedCount
    };
  }, [shippedOrders, searchTerm, companyFilter, productFilter, confirmedByFilter, start, end]);

  let filteredOrders = stats.baseOrdersForStats.filter((o) => {
    if (searchTerm.trim()) {
      return true;
    }
    if (hiddenStatuses2.length > 0 && hiddenStatuses2.includes(o.status2 || '')) {
       return false;
    }
    if (status2Filter !== 'all' && o.status2 !== status2Filter) {
       return false;
    }

    const computedStatus = mapStatusToStatus2(o.status2 || '', o);
    const matchesStatus = (
      statusFilter === 'all' || 
      computedStatus === statusFilter || 
      (statusFilter === 'in_transit_all' && (computedStatus === 'في الطريق' || computedStatus === 'تم الشحن')) ||
      (statusFilter === 'returned_restocked' && computedStatus === 'مرتجع' && !!o.stockRestocked) ||
      (statusFilter === 'returned_pending' && computedStatus === 'مرتجع' && !o.stockRestocked)
    ) && !hiddenStatuses.includes(computedStatus);
    const matchesAction = !actionRequiredFilter || needsAction(o);

    let matchesAttemptDate = true;
    if (attemptDateFrom || attemptDateTo) {
      const lastAttempt = getLastAttemptDate(o);
      if (!lastAttempt) {
        matchesAttemptDate = false;
      } else {
        const attemptTime = startOfDay(lastAttempt).getTime();
        const fromTime = attemptDateFrom ? startOfDay(parseISO(attemptDateFrom)).getTime() : 0;
        const toTime = attemptDateTo ? startOfDay(parseISO(attemptDateTo)).getTime() : Infinity;
        
        matchesAttemptDate = attemptTime >= fromTime && attemptTime <= toTime;
      }
    }

    let matchesAttemptCount = true;
    if (attemptFilter !== 'all') {
      const attempts = getAttemptCount(o);
      if (attemptFilter === '0' && attempts !== 0) matchesAttemptCount = false;
      if (attemptFilter === '1' && attempts !== 1) matchesAttemptCount = false;
      if (attemptFilter === '2+' && attempts < 2) matchesAttemptCount = false;
    }

    return matchesStatus && matchesAction && matchesAttemptDate && matchesAttemptCount;
  });

  if (sortConfig !== null) {
      filteredOrders.sort((a, b) => {
          let aValue: any = a[sortConfig.key as keyof typeof a];
          let bValue: any = b[sortConfig.key as keyof typeof b];
          
          if (sortConfig.key === 'totalCharge') {
             aValue = Number(aValue) || 0;
             bValue = Number(bValue) || 0;
          }

          if (sortConfig.key === 'status2') {
             aValue = mapStatusToStatus2(aValue || '', a);
             bValue = mapStatusToStatus2(bValue || '', b);
          }

          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }

  const totalItems = filteredOrders.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key === columnKey) {
      return <ArrowUpDown className={`w-3 h-3 ml-1 inline-block ${sortConfig.direction === 'asc' ? 'text-indigo-600' : 'text-indigo-400 opacity-70'} transition-opacity`} />;
    }
    return <ArrowUpDown className="w-3 h-3 ml-1 inline-block text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
  };

  const handleReturnOrder = async (id: string) => {
    const order = orders.find(o => o.id === id);
    let cleanNotes = order?.notes || '';
    if (cleanNotes.includes('[مخزون]:')) {
      cleanNotes = cleanNotes
        .split('\n')
        .filter((line: string) => !line.trim().startsWith('[مخزون]:'))
        .join('\n')
        .trim();
    }
    updateOrder(id, {
      shippingTrackingId: null,
      status2: '',
      notes: cleanNotes
    });
    toast.success(`تم استرجاع الطلبية بنجاح إلى قسم الطلبيات العادية.`);
    playActionSound('alert');
    setConfirmReturn(null);
  };

  const handleRestockOnly = async (order: any) => {
      try {
          const qnts = Number(order.qnts) || 1;
          let actualQuantityToAdd = qnts;
          const product = inventoryProducts.find(p => p.name === order.productName || (order.sku && p.sku === order.sku) || (p.variations && p.variations.some((v:any) => v.sku === order.sku)));
          
          if (product) {
              let isOffer = false;
              let targetVariation = null;
              let targetVariationIndex = -1;

              const hasVariations = product.variations && product.variations.length > 0;
              if (hasVariations) {
                 const fallbackOffer = product.variations.some((v:any) => v.attributes?.some((a:any) => a.option && (a.option.includes('عرض') || a.option.includes('كمية') || a.option.includes('pack'))));
                 isOffer = product.local_is_offers !== undefined ? product.local_is_offers : fallbackOffer;
                 
                 targetVariationIndex = product.variations.findIndex((v:any) => 
                     (order.sku && v.sku === order.sku) || 
                     (order.variation && v.attributes?.some((a:any) => a.option === order.variation))
                 );
                 if (targetVariationIndex !== -1) {
                    targetVariation = product.variations[targetVariationIndex];
                 }
              }

              if (isOffer && targetVariation) {
                 let extractedQ = 1;
                 const varName = targetVariation.name || targetVariation.attributes?.map((a:any) => a.option).join(' ') || '';
                 const match = varName.match(/\d+/);
                 if (match) extractedQ = parseInt(match[0], 10);
                 actualQuantityToAdd = qnts * (targetVariation.offer_quantity || extractedQ || 1);
              }

              const updatedProduct = JSON.parse(JSON.stringify(product));
              let stockUpdated = false;

              if (!isOffer && targetVariation) {
                  const v = updatedProduct.variations[targetVariationIndex];
                  const currentStock = v.local_stock_quantity !== undefined && v.local_stock_quantity !== null 
                    ? Number(v.local_stock_quantity) 
                    : Number(v.stock_quantity ?? v.quantity ?? 0);
                  v.local_stock_quantity = currentStock + actualQuantityToAdd;
                  v.local_manage_stock = true;
                  stockUpdated = true;
              } else {
                  const currentStock = updatedProduct.local_stock_quantity !== undefined && updatedProduct.local_stock_quantity !== null 
                    ? Number(updatedProduct.local_stock_quantity) 
                    : Number(updatedProduct.stock_quantity ?? updatedProduct.quantity ?? 0);
                  updatedProduct.local_stock_quantity = currentStock + actualQuantityToAdd;
                  updatedProduct.local_manage_stock = true;
                  stockUpdated = true;
              }

              if (stockUpdated) {
                  useStore.getState().setInventoryProducts(
                      useStore.getState().inventoryProducts.map(p => p.id === updatedProduct.id ? updatedProduct : p)
                  );
                  await bulkUpsertInventory([updatedProduct]);
              }
          }
          
          await updateOrder(order.id, {
             stockRestocked: true,
             notes: ((order.notes || '') + `\n[تحديث]: تم إرجاع ${actualQuantityToAdd} قطعة للمخزن يدوياً.`).trim()
          });
          
          toast.success('تم إرجاع منتجات الطلبية إلى المخزن بنجاح.');
          playActionSound('success');
          setConfirmRestock(null);
      } catch (e) {
          toast.error('حدث خطأ أثناء التحديث.');
          console.error(e);
      }
  };

  const handleSaveManualTracking = async () => {
    if (!manualTrackingModal) return;
    try {
      await updateOrder(manualTrackingModal.order.id, {
        shippingTrackingId: manualTrackingId.trim() || ''
      });
      playActionSound('success');
      toast.success(`تم حفظ رقم التتبع بنجاح!`);
      setManualTrackingModal(null);
      setManualTrackingId('');
    } catch (e) {
      toast.error('حدث خطأ أثناء التحديث.');
    }
  };

  const handleSaveManualStatus = async () => {
    if (!manualStatusModal) return;
    try {
      const existingNote = manualStatusModal.order.notes || '';
      const trackingNote = manualStatusNote.trim() ? `[تدخل من الدعم]: ${selectedManualStatus} - ${manualStatusNote.trim()}` : `[تدخل من الدعم]: ${selectedManualStatus}`;
      const updates: any = {
        status2: selectedManualStatus,
        notes: existingNote ? `${existingNote}\n${trackingNote}` : trackingNote
      };
      
      const newHistoryItem = {
          status: `تحديث يدوي: ${selectedManualStatus}`,
          remarque: manualStatusNote.trim() || 'تم التحديث بواسطة المستخدم',
          date: new Date().toISOString(),
          livreur: 'فريق الدعم',
          station: ''
      };
      
      updates.trackingHistory = [...(manualStatusModal.order.trackingHistory || []), newHistoryItem];

      await updateOrder(manualStatusModal.order.id, updates);
      playActionSound('success');
      toast.success(`تم تحديث حالة الطلبية واستبعادها من المزامنة (إذا أصبحت مستلمة أو مرتجعة) بنجاح!`);
      setManualStatusModal(null);
      setManualStatusNote('');
      setSelectedManualStatus('مستلم');
    } catch (e) {
      toast.error('حدث خطأ أثناء التحديث.');
    }
  };

  const handlePrintBordereau = (order: any) => {
    toast.success(`جارٍ الاستعداد لطباعة البرودرو الخاص بالطلبية...`);
  };

  const syncOrderTracking = async (order: any, silent = false) => {
    if (!order.shippingTrackingId) {
      if (!silent) toast.error('رقم التتبع غير متوفر لهذه الطلبية.');
      return false;
    }
    
    if (order.shippingTrackingId === 'تسليم يدوي') {
      if (!silent) toast.error('هذه الطلبية تسليم يدوي، يتم تحديث حالتها يدوياً بالنقر على أيقونة التعديل.');
      return false;
    }
    
    const integration = settings?.shippingIntegrations?.find(i => i.name === order.deliveryCompany && i.isActive)
                     || settings?.shippingIntegrations?.find(i => i.isActive);
    if (!integration) {
      if (!silent) toast.error(`إعدادات شركة الشحن غير متوفرة. يرجى تفعيل إعدادات شركة التوصيل في قسم الإعدادات.`);
      return false;
    }
    
    if (!integration.token) {
      if (!silent) toast.error(`مفتاح الربط (Token) غير متوفر لشركة ${order.deliveryCompany}.`);
      return false;
    }

    if (!silent) setSyncingId(order.id);
    try {
      const data = await fetchUniversalTrackingInfo(integration, order.shippingTrackingId);

      if (!data.success) {
        if (!silent) toast.error(data.message || 'خطأ في جلب حالة الطلبية');
        return false;
      }

      let mainStatus = '';
      let remarque = '';
      let responseData = data.data;

      // Unwrap if EcoTrack wraps the response inside its own 'data' property
      if (responseData && typeof responseData === 'object' && !Array.isArray(responseData) && responseData.data) {
          responseData = responseData.data;
      }

      let rawHistoryArray: any[] = [];

      if (typeof responseData === 'string') {
         try {
             const parsed = JSON.parse(responseData);
             if (typeof parsed === 'object' && parsed !== null) {
                 responseData = parsed;
             } else {
                 mainStatus = responseData;
             }
         } catch(e) {
             mainStatus = responseData;
         }
      }

      if (Array.isArray(responseData)) {
          rawHistoryArray = responseData;
          responseData = responseData[0] || {};
      } else if (typeof responseData === 'object' && responseData !== null) {
          rawHistoryArray = responseData.historique || responseData.history || responseData.activity || [];
      }
      
      if (typeof responseData === 'object' && responseData !== null && !mainStatus) {
         mainStatus = responseData.status || responseData.etat || responseData.state || responseData.statut || responseData.situation || (responseData.tracking_info && responseData.tracking_info.status) || '';
         
         if (Array.isArray(rawHistoryArray) && rawHistoryArray.length > 0) {
             const latest = rawHistoryArray[rawHistoryArray.length - 1];
             if (latest) {
                 remarque = latest.commentaires || latest.remarque || latest.observation || latest.note || latest.comment || latest.reason || '';
                 if (!remarque && latest.station && typeof latest.station === 'string') {
                     remarque = `المحطة: ${latest.station}`;
                 }
                 if (latest.status || latest.etat || latest.state || latest.statut) {
                     mainStatus = latest.status || latest.etat || latest.state || latest.statut || mainStatus;
                 }
             }
         }

         if (!remarque) {
             remarque = responseData.commentaires || responseData.remarque || responseData.observation || responseData.note || responseData.comment || responseData.currentStation || '';
         }
      }

      const getCleanRemark = (r: any) => {
         if (!r) return '';
         let clean = r.toString().trim().toLowerCase();
      clean = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
         if (clean === 'ecrire une remarque' || clean === 'أكتب ملاحظة') return '';
         return r.toString().trim();
      };
      
      remarque = getCleanRemark(remarque);

      let parsedHistory: any[] = [];
      if (Array.isArray(rawHistoryArray)) {
          parsedHistory = rawHistoryArray.map((item: any) => ({
              status: translateActivityStatus(item.status || item.etat || item.state || item.statut || item.activity || mainStatus || ''),
              remarque: getCleanRemark(item.commentaires || item.remarque || item.observation || item.note || item.comment || item.reason || ''),
              station: item.station || item.hub || '',
              livreur: item.livreur || item.driver || item.livreur_name || '',
              date: item.created_at || item.date || item.time || ''
          })).filter((item: any) => item.status || item.remarque || item.station || item.livreur);
      }

      try {
          const remarksRes = await fetch('/api/shipping/ecotrack/remarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              domain: integration.domain || 'https://expedigo.ecotrack.dz',
              token: integration.token,
              trackingId: order.shippingTrackingId
            })
          });
          
          let remarksData: any = null;
          if (remarksRes.ok) {
            const rawText = await remarksRes.text();
            if (rawText && !rawText.trim().startsWith('<')) {
              try {
                remarksData = JSON.parse(rawText);
              } catch {
                remarksData = null;
              }
            }
          }

          let rawRemarksArray: any[] = [];
          if (remarksData && remarksData.success && Array.isArray(remarksData.data)) {
              rawRemarksArray = remarksData.data;
          } else if (remarksData && remarksData.success && Array.isArray(remarksData.data?.data)) {
              rawRemarksArray = remarksData.data.data;
          }

          if (rawRemarksArray.length > 0) {
              const newRemarks = rawRemarksArray.map((item: any) => ({
                  status: 'ملاحظة',
                  remarque: getCleanRemark(item.commentaires || item.remarque || ''),
                  station: item.station || '',
                  livreur: item.livreur || '',
                  date: item.created_at || ''
              })).filter((item: any) => item.remarque || item.station || item.livreur);
              
              const existingSignatures = new Set(parsedHistory.map(h => `${h.date}-${h.remarque}`));
              const uniqueNewRemarks = newRemarks.filter(r => !existingSignatures.has(`${r.date}-${r.remarque}`));

              if (uniqueNewRemarks.length > 0) {
                  parsedHistory = [...parsedHistory, ...uniqueNewRemarks];
                  parsedHistory.sort((a, b) => {
                      if (!a.date) return 1;
                      if (!b.date) return -1;
                      return new Date(a.date).getTime() - new Date(b.date).getTime();
                  });
              }
          }
      } catch (err) {
          console.warn("Could not fetch optional remarks:", err);
      }

      if (typeof mainStatus !== 'string' || mainStatus.startsWith('{')) mainStatus = '';
      if (typeof remarque !== 'string') remarque = '';
      mainStatus = translateActivityStatus(mainStatus);

      let shouldUpdate = false;
      const updates: any = {};

      const tarif = responseData.tarif ?? responseData.prix_livraison ?? responseData.shipping_price ?? responseData.delivery_fee ?? responseData.frais_livraison ?? responseData.frais_expedition ?? responseData.frais ?? responseData.livraison ?? responseData.cout_livraison;
      const amount = responseData.montant || responseData.price || responseData.total || responseData.cod_amount;

      if (tarif !== undefined && !isNaN(Number(tarif))) {
         const numTarif = Number(tarif);
         if (numTarif > 0 && Number(order.realDeliveryPrice) !== numTarif && order.shippingFeeMode !== 'manual') {
             updates.realDeliveryPrice = numTarif;
             shouldUpdate = true;
         }
      }

      if (amount !== undefined && !isNaN(Number(amount))) {
          const numAmount = Number(amount);
          if (numAmount > 0 && Number(order.totalCharge) !== numAmount) {
              updates.totalCharge = numAmount;
              shouldUpdate = true;
          }
      }

      const tempMergedOrder = {
          ...order,
          trackingHistory: parsedHistory.length > 0 ? (() => {
              const existingManualUpdates = (order.trackingHistory || []).filter((h: any) => h.status && h.status.includes('تحديث يدوي'));
              let mergedHistory = [...parsedHistory, ...existingManualUpdates];
              mergedHistory.sort((a, b) => {
                  if (!a.date) return 1;
                  if (!b.date) return -1;
                  return new Date(a.date).getTime() - new Date(b.date).getTime();
              });
              return mergedHistory;
          })() : (order.trackingHistory || [])
      };

      if (mainStatus) {
        const newStatus2 = mapStatusToStatus2(mainStatus, tempMergedOrder);
        const trackingNote = remarque ? `[حالة الشحن]: ${mainStatus} - أحدث ملاحظة: ${remarque}` : `[حالة الشحن]: ${mainStatus}`;
        
        if (newStatus2 !== order.status2) {
            updates.status2 = newStatus2;
            shouldUpdate = true;
        }
        
        const existingNote = order.notes || '';
        if (!existingNote.includes(trackingNote)) {
            updates.notes = existingNote ? `${existingNote}\n${trackingNote}` : trackingNote;
            shouldUpdate = true;
        }
      }

      if (parsedHistory.length > 0) {
          // preserve user manual updates
          const existingManualUpdates = (order.trackingHistory || []).filter((h: any) => h.status && h.status.includes('تحديث يدوي'));
          
          let mergedHistory = [...parsedHistory, ...existingManualUpdates];
          
          // sort merged history by date (ascending - oldest to newest)
          mergedHistory.sort((a, b) => {
              if (!a.date) return 1;
              if (!b.date) return -1;
              return new Date(a.date).getTime() - new Date(b.date).getTime();
          });
          
          const currentHistoryString = JSON.stringify(order.trackingHistory || []);
          const newHistoryString = JSON.stringify(mergedHistory);
          if (currentHistoryString !== newHistoryString) {
              updates.trackingHistory = mergedHistory;
              shouldUpdate = true;
          }
      }

      // Always record when the tracking API was successfully queried
      updates.lastTrackingSync = new Date().toISOString();
      shouldUpdate = true;

      if (shouldUpdate) {
          await updateOrder(order.id, updates);
      }

      if (mainStatus || parsedHistory.length > 0) {
        if (!silent) {
            playActionSound('success');
            toast.success(`نجاح: تم تحديث الملاحظات`);
        }
        return true;
      } else {
        if (!silent) {
            playActionSound('alert');
            toast.error('لم يتم العثور على حالة التتبع في رد الخادم.');
        }
        return false;
      }
    } catch (err) {
      if (!silent) {
          playActionSound('error');
          toast.error('خطأ في الاتصال بالخادم.');
      }
      return false;
    } finally {
      if (!silent) {
        setSyncingId(null);
      }
    }
  };

  const syncAllOrders = async (silent = false, force = false) => {
    // Filter out orders that are in a terminal state
    const activeOrders = filteredOrders.filter(o => {
        const s2 = mapStatusToStatus2(o.status2 || '', o);
        return s2 !== 'مستلم' && s2 !== 'مرتجع';
    });

    const cooldownMs = force ? 0 : (silent ? 12 * 60 * 60 * 1000 : 10 * 60 * 1000); // 12 hours for background, 10 minutes for manual
    const now = new Date().getTime();

    // Filter by eligibility (has tracking, not manual delivery, not synced within cooldown)
    const eligibleOrders = activeOrders.filter(o => {
        if (!o.shippingTrackingId || o.shippingTrackingId === 'تسليم يدوي') return false;
        if (!o.lastTrackingSync) return true;
        return (now - new Date(o.lastTrackingSync).getTime()) > cooldownMs;
    });

    const skippedCount = activeOrders.filter(o => o.shippingTrackingId && o.shippingTrackingId !== 'تسليم يدوي').length - eligibleOrders.length;

    // Limit maximum batch size to protect the client and server from getting banned
    const maxBatchSize = silent ? 15 : 30;

    // Sort by oldest lastTrackingSync first
    eligibleOrders.sort((a, b) => {
        const tA = a.lastTrackingSync ? new Date(a.lastTrackingSync).getTime() : 0;
        const tB = b.lastTrackingSync ? new Date(b.lastTrackingSync).getTime() : 0;
        return tA - tB;
    });

    const batch = eligibleOrders.slice(0, maxBatchSize);

    if (batch.length === 0) {
        if (!silent) {
            playActionSound('bell');
            if (skippedCount > 0) {
                const confirmForce = window.confirm(`المزامنة الذكية: تم تحديث جميع الطلبيات (${skippedCount}) مؤخراً لتفادي حظر سيرفر شركة الشحن.\n\nهل ترغب في تحديثها إجبارياً وتخطي فترة الانتظار الآمنة الآن؟`);
                if (confirmForce) {
                    syncAllOrders(false, true);
                    return;
                }
            } else {
                toast.success(`لا توجد طلبيات تحتاج إلى تحديث حالياً.`);
            }
        }
        return;
    }

    // Add to background queue
    addToTrackingQueue(batch.map(o => o.id));
    setTrackingQueueState({ isTrackingQueueProcessing: true });

    // Update auto sync timestamp
    const nowSyncTime = Date.now();
    setLastAutoSyncTime(nowSyncTime);
    localStorage.setItem('shipped_orders_last_auto_sync', nowSyncTime.toString());

    if (!silent) {
        playActionSound('success');
        toast.success(`تمت جدولة ${batch.length} طلبية وتمريرها لقائمة الانتظار بنجاح.`);
    }
  };

  const hasAutoSyncedRef = useRef(false);
  useEffect(() => {
     if (hasAutoSyncedRef.current) return;
     if (shippedOrders.length > 0 && settings?.shippingIntegrations?.length) {
         const now = Date.now();
         const AUTO_SYNC_COOLDOWN = 6 * 60 * 60 * 1000; // 6 hours
         if (now - lastAutoSyncTime > AUTO_SYNC_COOLDOWN) {
             hasAutoSyncedRef.current = true;
             // Auto background sync uses silent mode with strict cooldowns
             syncAllOrders(true);
         }
     }
  }, [shippedOrders.length, lastAutoSyncTime, settings?.shippingIntegrations]);

  useEffect(() => {
     if (hasShownToast) return;
     const reqCount = shippedOrders.filter(needsAction).length;
     if (reqCount > 0) {
         toast.error(`تنبيه: يوجد ${reqCount} طلبيات تتطلب التدخل (محاولة توصيل)!`, {
             icon: '⚠️',
             duration: 6000,
         });
         setHasShownToast(true);
     }
  }, [shippedOrders.length, hasShownToast]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'مستلم': return 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm';
      case 'مرتجع': return 'bg-rose-50 text-rose-700 border-rose-200 shadow-sm';
      case 'قابلة للشحن': return 'bg-purple-50 text-purple-700 border-purple-200 shadow-sm';
      case 'في الطريق': return 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm';
      case 'تم الشحن': 
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm';
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`p-4 md:p-8 text-right mx-auto font-sans transition-all duration-200 ${
        isFullscreen 
          ? 'fixed inset-0 z-[9999] bg-slate-900 text-slate-100 overflow-auto p-4 sm:p-6 shadow-2xl max-w-none' 
          : 'max-w-[1400px] min-h-[80vh] bg-slate-50/50'
      }`} 
      dir="rtl"
    >
      {/* Fullscreen Quick Top Bar */}
      {isFullscreen && (
        <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-3.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-slate-800 mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl font-bold text-xs">
              <Truck className="w-4 h-4 text-indigo-400" />
              <span>جدول الطلبيات المشحونة</span>
              <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black">{filteredOrders.length}</span>
            </div>
            
            {/* Quick Stats Chips */}
            <div className="hidden lg:flex items-center gap-2 text-[11px] font-bold">
              <span className="bg-slate-700/80 border border-slate-600/60 px-2.5 py-1 rounded-lg text-slate-300">
                المشحون: <strong className="text-white">{stats.total}</strong>
              </span>
              <span className="bg-emerald-900/60 border border-emerald-700/50 px-2.5 py-1 rounded-lg text-emerald-300">
                مستلمة: <strong className="text-emerald-100">{stats.delivered}</strong>
              </span>
              <span className="bg-rose-900/60 border border-rose-700/50 px-2.5 py-1 rounded-lg text-rose-300">
                مرتجعة: <strong className="text-rose-100">{stats.returned}</strong>
              </span>
            </div>
          </div>

          {/* Quick Search */}
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="بحث برقم التتبع/الاسم/الهاتف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700 text-white rounded-xl text-xs py-1.5 pr-8 pl-3 focus:ring-2 focus:ring-indigo-500 shadow-inner placeholder-slate-400"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => syncAllOrders(false)}
              disabled={isTrackingQueueProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTrackingQueueProcessing ? 'animate-spin' : ''}`} />
              <span>{isTrackingQueueProcessing ? 'مزامنة...' : 'تحديث الحالات'}</span>
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

      {/* Header & Stats Section */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3 mb-2">
              <span className="bg-indigo-600 p-2.5 rounded-xl shadow-indigo-600/20 shadow-lg text-white">
                <Truck className="w-6 h-6" />
              </span>
              الطلبيات المشحونة
            </h1>
            <p className="text-slate-500 font-medium">متابعة دقيقة، وتحديثات لحظية ومزامنة آلية لحالات التوصيل.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
             {lastAutoSyncTime > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-200/60 shadow-sm">
                   <Clock className="w-3.5 h-3.5 text-slate-400" />
                   <span>آخر تحديث: {getLastSyncLabel()}</span>
                </div>
             )}
             <button
                onClick={toggleFullscreen}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-md text-sm whitespace-nowrap cursor-pointer"
                title={isFullscreen ? "خروج من ملء الشاشة" : "وضع التركيز المتقدم"}
             >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                <span>{isFullscreen ? 'خروج' : 'وضع التركيز'}</span>
             </button>
             <button
                onClick={() => setShowPickingList(true)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10 text-sm whitespace-nowrap"
             >
                <Package className="w-4 h-4" />
                <span>استخراج قائمة التجهيز</span>
             </button>
             <button
                onClick={() => syncAllOrders(false)}
                disabled={isTrackingQueueProcessing}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 focus:ring-4 focus:ring-slate-900/10 disabled:opacity-70 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all whitespace-nowrap text-sm shadow-xl shadow-slate-900/10"
              >
                <RefreshCw className={`w-4 h-4 ${isTrackingQueueProcessing ? 'animate-spin text-indigo-400' : ''}`} />
                <span>{isTrackingQueueProcessing ? 'جاري التحديث...' : 'تحديث الحالات'}</span>
              </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div 
             onClick={() => { setStatusFilter('all'); setHiddenStatuses([]); setAttemptFilter('all'); }} 
             className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between cursor-pointer hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-bold text-slate-500">إجمالي المشحون</h3>
               <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600">
                  <Package className="w-4 h-4" />
               </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 mb-4">{stats.total}</div>
              <div className="grid grid-cols-3 gap-1">
                 <div className="bg-slate-50 rounded-lg p-1.5 text-center flex flex-col border border-slate-100/50">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">اليوم</span>
                    <span className="text-xs font-black text-slate-600">{stats.tShippedCount}</span>
                 </div>
                 <div className="bg-slate-50 rounded-lg p-1.5 text-center flex flex-col border border-slate-100/50">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">أسبوع</span>
                    <span className="text-xs font-black text-slate-600">{stats.wShippedCount}</span>
                 </div>
                 <div className="bg-slate-50 rounded-lg p-1.5 text-center flex flex-col border border-slate-100/50">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">شهر</span>
                    <span className="text-xs font-black text-slate-600">{stats.mShippedCount}</span>
                 </div>
              </div>
            </div>
          </div>

          <div 
             onClick={() => { setStatusFilter('مستلم'); setHiddenStatuses(prev => prev.filter(s => s !== 'مستلم')); setAttemptFilter('all'); }} 
             className="bg-white p-5 rounded-2xl border border-emerald-100/50 shadow-sm shadow-emerald-100/20 flex flex-col justify-between group cursor-pointer hover:border-emerald-300 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-bold text-emerald-600">المستلمة</h3>
               <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckSquare className="w-4 h-4" />
               </div>
            </div>
            <div className="flex items-end justify-between mb-4">
              <div className="text-3xl font-black text-slate-900">{stats.delivered}</div>
              <div className="flex flex-col items-end">
                 <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mb-1">نسبة التوصيل</span>
                 <span className="text-sm font-bold text-slate-700">{stats.deliveryRate}%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1">
                 <div className="bg-emerald-50/50 rounded-lg p-1.5 text-center flex flex-col border border-emerald-100/30">
                    <span className="text-[9px] text-emerald-600/70 font-bold mb-0.5">اليوم</span>
                    <span className="text-xs font-black text-emerald-600">{stats.tDeliveredCount}</span>
                 </div>
                 <div className="bg-emerald-50/50 rounded-lg p-1.5 text-center flex flex-col border border-emerald-100/30">
                    <span className="text-[9px] text-emerald-600/70 font-bold mb-0.5">أسبوع</span>
                    <span className="text-xs font-black text-emerald-600">{stats.wDeliveredCount}</span>
                 </div>
                 <div className="bg-emerald-50/50 rounded-lg p-1.5 text-center flex flex-col border border-emerald-100/30">
                    <span className="text-[9px] text-emerald-600/70 font-bold mb-0.5">شهر</span>
                    <span className="text-xs font-black text-emerald-600">{stats.mDeliveredCount}</span>
                 </div>
            </div>
          </div>

          <div 
             onClick={() => { setStatusFilter('مرتجع'); setHiddenStatuses(prev => prev.filter(s => s !== 'مرتجع')); setAttemptFilter('all'); }} 
             className="bg-white p-5 rounded-2xl border border-rose-100/50 shadow-sm shadow-rose-100/20 flex flex-col justify-between group cursor-pointer hover:border-rose-300 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-bold text-rose-600">المرتجعة</h3>
               <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                  <XSquare className="w-4 h-4" />
               </div>
            </div>
            <div className="flex items-end justify-between mb-4">
              <div className="text-3xl font-black text-slate-900">{stats.returned}</div>
              <div className="flex flex-col items-end">
                 <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full mb-1">نسبة الروتور</span>
                 <span className="text-sm font-bold text-slate-700">{stats.returnRate}%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1">
                 <div className="bg-rose-50/50 rounded-lg p-1.5 text-center flex flex-col border border-rose-100/30">
                    <span className="text-[9px] text-rose-600/70 font-bold mb-0.5">اليوم</span>
                    <span className="text-xs font-black text-rose-600">{stats.tReturnedCount}</span>
                 </div>
                 <div className="bg-rose-50/50 rounded-lg p-1.5 text-center flex flex-col border border-rose-100/30">
                    <span className="text-[9px] text-rose-600/70 font-bold mb-0.5">أسبوع</span>
                    <span className="text-xs font-black text-rose-600">{stats.wReturnedCount}</span>
                 </div>
                 <div className="bg-rose-50/50 rounded-lg p-1.5 text-center flex flex-col border border-rose-100/30">
                    <span className="text-[9px] text-rose-600/70 font-bold mb-0.5">شهر</span>
                    <span className="text-xs font-black text-rose-600">{stats.mReturnedCount}</span>
                 </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-blue-100/50 shadow-sm flex flex-col justify-between">
            <div 
               className="flex items-center justify-between mb-4 cursor-pointer group"
               onClick={() => { setStatusFilter('in_transit_all'); setHiddenStatuses(prev => prev.filter(s => s !== 'في الطريق' && s !== 'تم الشحن')); setAttemptFilter('all'); }}
            >
               <h3 className="text-sm font-bold text-blue-600 group-hover:text-blue-800 transition-colors">في الطريق</h3>
               <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                  <Clock className="w-4 h-4" />
               </div>
            </div>
            <div 
               className="flex items-end justify-between cursor-pointer"
               onClick={() => { setStatusFilter('in_transit_all'); setHiddenStatuses(prev => prev.filter(s => s !== 'في الطريق' && s !== 'تم الشحن')); setAttemptFilter('all'); }}
            >
              <div className="text-3xl font-black text-slate-900 hover:text-blue-600 transition-colors">{stats.inTransit}</div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
               <div 
                  onClick={() => { setStatusFilter('in_transit_all'); setHiddenStatuses(prev => prev.filter(s => s !== 'في الطريق' && s !== 'تم الشحن')); setAttemptFilter(attemptFilter === '0' ? 'all' : '0'); }}
                  className={`rounded p-1.5 border cursor-pointer transition-colors ${attemptFilter === '0' ? 'bg-slate-200 border-slate-300 shadow-inner' : 'bg-slate-50 border-slate-200/50 hover:bg-slate-100'}`}
               >
                  <div className="text-[10px] font-bold text-slate-500 mb-0.5">مشحونة</div>
                  <div className="text-sm font-black text-slate-700">{stats.shippedOnly}</div>
               </div>
               <div 
                  onClick={() => { setStatusFilter('in_transit_all'); setHiddenStatuses(prev => prev.filter(s => s !== 'في الطريق' && s !== 'تم الشحن')); setAttemptFilter(attemptFilter === '1' ? 'all' : '1'); }}
                  className={`rounded p-1.5 border cursor-pointer transition-colors ${attemptFilter === '1' ? 'bg-orange-200 border-orange-300 shadow-inner' : 'bg-orange-50 border-orange-100/50 hover:bg-orange-100'}`}
               >
                  <div className="text-[10px] font-bold text-orange-600 mb-0.5">محاولة 1</div>
                  <div className="text-sm font-black text-orange-700">{stats.attempt1}</div>
               </div>
               <div 
                  onClick={() => { setStatusFilter('in_transit_all'); setHiddenStatuses(prev => prev.filter(s => s !== 'في الطريق' && s !== 'تم الشحن')); setAttemptFilter(attemptFilter === '2+' ? 'all' : '2+'); }}
                  className={`rounded p-1.5 border cursor-pointer transition-colors ${attemptFilter === '2+' ? 'bg-rose-200 border-rose-300 shadow-inner' : 'bg-rose-50 border-rose-100/50 hover:bg-rose-100'}`}
               >
                  <div className="text-[10px] font-bold text-rose-600 mb-0.5">محاولة +2</div>
                  <div className="text-sm font-black text-rose-700">{stats.attempt2Plus}</div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Alerts Section */}
      {(() => {
        const actionRequiredCount = stats.baseOrdersForStats.filter(needsAction).length;
        if (!actionRequiredFilter) {
          return (
            <div className={`mb-6 border rounded-2xl p-5 shadow-sm relative overflow-hidden transition-all ${actionRequiredCount > 0 ? 'bg-gradient-to-r from-rose-50 to-white border-rose-200' : 'bg-gradient-to-r from-emerald-50 to-white border-emerald-200'}`}>
               <div className={`absolute top-0 right-0 w-2 h-full ${actionRequiredCount > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
               <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-start gap-3 w-full">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${actionRequiredCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {actionRequiredCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                     </div>
                     <div className="flex-1">
                        <h3 className={`font-bold text-sm md:text-base mb-1 ${actionRequiredCount > 0 ? 'text-rose-900' : 'text-emerald-900'}`}>
                          {actionRequiredCount > 0 ? (
                             <>لديك تنبيهات ذكية لـ <span className="mx-1 bg-white border border-rose-200 w-6 h-6 inline-flex items-center justify-center rounded-md text-rose-600 font-black">{actionRequiredCount}</span> طلبيات!</>
                          ) : (
                             <>لا توجد طلبيات تتطلب التدخل حالياً</>
                          )}
                        </h3>
                        <p className={`text-xs font-medium leading-relaxed md:max-w-2xl ${actionRequiredCount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                           {actionRequiredCount > 0 
                             ? 'هذه الطلبيات تواجه محاولات توصيل متعددة أو توشك على الرجوع. يرجى الاتصال بالزبائن وتأكيد الاستلام لتفادي نسبة الروتور المرتفعة، ثم قم بتحديث حالتها يدوياً.'
                             : 'جميع الطلبيات في مسارها الطبيعي. سيقوم النظام بتنبيهك هنا فور وصول أي طلبية إلى مرحلة (محاولة توصيل) لاتخاذ الإجراء المناسب.'}
                        </p>
                     </div>
                  </div>
                  {actionRequiredCount > 0 && (
                      <button 
                         onClick={() => {
                           setShowFilters(true);
                           setStatusFilter('all');
                           setCompanyFilter('all');
                           setActionRequiredFilter(true);
                         }}
                         className="whitespace-nowrap w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-rose-200"
                      >
                         عرض ومتابعة الطلبيات 
                      </button>
                  )}
               </div>
            </div>
          );
        }
        return null;
      })()}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden mb-6 flex flex-col">
        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
             <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input
               type="text"
               placeholder="ابحث بالاسم، الهاتف، البوليصة..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-4 pr-10 py-2 border border-slate-200 bg-white rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm placeholder:text-slate-400"
             />
          </div>
          
          <div className="flex items-center gap-3">
             <button
               onClick={() => setShowFilters(!showFilters)}
               className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm border ${showFilters ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
             >
               <Filter className="w-4 h-4" />
               تصفية
               {(dateFilter !== 'all' || statusFilter !== 'all' || companyFilter !== 'all' || productFilter !== 'all' || confirmedByFilter !== 'all' || actionRequiredFilter || attemptDateFrom || attemptDateTo) && (
                 <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] ml-1">
                   {(dateFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (companyFilter !== 'all' ? 1 : 0) + (productFilter !== 'all' ? 1 : 0) + (confirmedByFilter !== 'all' ? 1 : 0) + (actionRequiredFilter ? 1 : 0) + (attemptDateFrom || attemptDateTo ? 1 : 0)}
                 </span>
               )}
             </button>
          </div>
        </div>

        <div className="px-4 pb-4 pt-2 bg-slate-50/50 flex flex-wrap items-center gap-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-500 ml-1">تصفية سريعة:</span>
            <button onClick={() => { setStatusFilter('all'); setHiddenStatuses([]); setAttemptFilter('all'); }} className={`text-[11px] px-3 py-1.5 rounded-full font-bold border transition-colors ${statusFilter === 'all' && hiddenStatuses.length === 0 && attemptFilter === 'all' ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>الكل</button>
            {['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع', 'قابلة للشحن'].map(status => {
               const isActive = (statusFilter === status || (status === 'مرتجع' && (statusFilter === 'returned_restocked' || statusFilter === 'returned_pending'))) && attemptFilter === 'all';
               const isHidden = hiddenStatuses.includes(status);
               
               let baseColors = 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
               if (isHidden) {
                   baseColors = 'bg-slate-100 text-slate-400 border-slate-200 opacity-60';
               } else if (isActive) {
                   baseColors = {
                     'تم الشحن': 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm',
                     'في الطريق': 'bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm',
                     'مستلم': 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-sm',
                     'مرتجع': 'bg-rose-100 text-rose-700 border-rose-200 shadow-sm',
                     'قابلة للشحن': 'bg-purple-100 text-purple-700 border-purple-200 shadow-sm',
                   }[status as 'تم الشحن' | 'في الطريق' | 'مستلم' | 'مرتجع' | 'قابلة للشحن'] || baseColors;
               }
                 
               return (
                  <div key={status} className={`flex items-center rounded-full border transition-colors overflow-hidden ${baseColors}`}>
                    <button 
                      onClick={() => {
                          if (isHidden) setHiddenStatuses(prev => prev.filter(s => s !== status));
                          setStatusFilter(isActive && statusFilter === status ? 'all' : status);
                          setAttemptFilter('all');
                      }}
                      className="text-[11px] px-2.5 py-1.5 font-bold outline-none"
                    >
                      {status}
                    </button>
                    <button 
                      onClick={() => {
                          if (isHidden) {
                              setHiddenStatuses(prev => prev.filter(s => s !== status));
                          } else {
                              setHiddenStatuses(prev => [...prev, status]);
                              if (statusFilter === status || (status === 'مرتجع' && (statusFilter === 'returned_restocked' || statusFilter === 'returned_pending'))) setStatusFilter('all');
                              setAttemptFilter('all');
                          }
                      }}
                      className={`px-1.5 py-1.5 outline-none hover:bg-black/5 ${isHidden ? 'text-rose-500' : 'text-slate-400 opacity-50 hover:opacity-100'}`}
                      title={isHidden ? "إظهار الحالة" : "إخفاء الحالة"}
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
               )
            })}
            
            {(statusFilter === 'مرتجع' || statusFilter === 'returned_restocked' || statusFilter === 'returned_pending') && (
               <div className="w-full flex items-center gap-2 mt-2 pt-2 border-t border-slate-100/50">
                  <span className="text-[10px] font-bold text-rose-500 ml-1">تصفية المرتجع:</span>
                  <button 
                     onClick={() => setStatusFilter(statusFilter === 'returned_restocked' ? 'مرتجع' : 'returned_restocked')} 
                     className={`text-[10px] px-2.5 py-1 rounded-full font-bold border transition-colors ${statusFilter === 'returned_restocked' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                  >
                     متاح في المخزن
                  </button>
                  <button 
                     onClick={() => setStatusFilter(statusFilter === 'returned_pending' ? 'مرتجع' : 'returned_pending')} 
                     className={`text-[10px] px-2.5 py-1 rounded-full font-bold border transition-colors ${statusFilter === 'returned_pending' ? 'bg-purple-100 text-purple-700 border-purple-200 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                  >
                     عالق
                  </button>
               </div>
            )}
            
            <div className="w-full flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100/50 overflow-x-auto scrollbar-thin">
              <span className="text-[10px] font-bold text-blue-700 shrink-0 px-1">الحالة (2):</span>
              <button 
                onClick={() => setStatus2Filter('all')} 
                className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border transition-colors shrink-0 cursor-pointer flex items-center gap-1 ${status2Filter === 'all' ? 'bg-blue-800 text-white border-blue-800 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
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
                     baseColors = 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm';
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
         </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-5 border-b border-slate-100 bg-white space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 items-end">
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1.5">الفترة</label>
                 <select 
                   value={dateFilter} 
                   onChange={e => setDateFilter(e.target.value as any)} 
                   className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3 bg-slate-50 font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                 >
                    <option value="all">كل الأوقات</option>
                    <option value="today">اليوم</option>
                    <option value="yesterday">الأمس</option>
                    <option value="week">هذا الأسبوع</option>
                    <option value="month">هذا الشهر</option>
                    <option value="custom">مخصص</option>
                 </select>
              </div>
              {dateFilter === 'custom' && (
                <div className="col-span-1 sm:col-span-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">من</label>
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3 bg-slate-50 font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">إلى</label>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3 bg-slate-50 font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white" />
                  </div>
                </div>
              )}
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1.5">الحالة</label>
                 <select 
                   value={statusFilter} 
                   onChange={e => setStatusFilter(e.target.value)} 
                   className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3 bg-slate-50 font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                 >
                    <option value="all">كل الحالات</option>
                    <option value="تم الشحن">تم الشحن</option>
                    <option value="في الطريق">في الطريق</option>
                    <option value="مستلم">مستلم</option>
                    <option value="مرتجع">مرتجع (الكل)</option>
                    <option value="returned_restocked">مرتجع (متاح في المخزن)</option>
                    <option value="returned_pending">مرتجع (عالق)</option>
                    <option value="قابلة للشحن">قابلة للشحن</option>
                 </select>
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1.5">المنتج</label>
                 <select 
                   value={productFilter} 
                   onChange={e => {
                     setProductFilter(e.target.value);
                     setGlobalProductFilter(e.target.value);
                   }} 
                   className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3 bg-slate-50 font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                 >
                    <option value="all">كل المنتجات</option>
                    {productFilterOptionsJSX}
                 </select>
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1.5">المؤكد</label>
                 <select 
                   value={confirmedByFilter} 
                   onChange={e => setConfirmedByFilter(e.target.value)} 
                   className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3 bg-slate-50 font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                 >
                    <option value="all">الكل</option>
                    {confirmers.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1.5">شركة التوصيل</label>
                 <select 
                   value={companyFilter} 
                   onChange={e => setCompanyFilter(e.target.value)} 
                   className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3 bg-slate-50 font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                 >
                    <option value="all">الكل</option>
                    {deliveryCompanies.map(p => <option key={p} value={p}>{p}</option>)}
                 </select>
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1.5">متابعة الزبون</label>
                 <div className="flex items-center h-[38px]">
                    <button 
                      onClick={() => setActionRequiredFilter(!actionRequiredFilter)}
                      className={`flex items-center gap-2 px-3 h-[38px] rounded-lg border text-xs font-bold transition-colors w-full ${actionRequiredFilter ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${actionRequiredFilter ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-300 bg-white'}`}>
                         {actionRequiredFilter && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      عرض مطلوبة التدخل
                    </button>
                 </div>
              </div>
              <div className="flex items-end">
                 {(dateFilter !== 'all' || statusFilter !== 'all' || companyFilter !== 'all' || productFilter !== 'all' || confirmedByFilter !== 'all' || actionRequiredFilter || attemptDateFrom || attemptDateTo) && (
                   <button onClick={() => { setDateFilter('all'); setCustomStart(''); setCustomEnd(''); setStatusFilter('all'); setCompanyFilter('all'); setProductFilter('all'); setConfirmedByFilter('all'); setActionRequiredFilter(false); setAttemptDateFrom(''); setAttemptDateTo(''); }} className="text-xs font-bold text-rose-600 hover:text-rose-700 mb-2.5 underline underline-offset-4 mr-4">
                     مسح الفلاتر
                   </button>
                 )}
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1.5">آخر محاولة توصيل (من)</label>
                 <input 
                   type="date" 
                   value={attemptDateFrom}
                   onChange={e => setAttemptDateFrom(e.target.value)}
                   className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3 bg-slate-50 font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                 />
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 mb-1.5">آخر محاولة توصيل (إلى)</label>
                 <input 
                   type="date" 
                   value={attemptDateTo}
                   onChange={e => setAttemptDateTo(e.target.value)}
                   className="w-full text-sm border border-slate-200 rounded-lg py-2 px-3 bg-slate-50 font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                 />
              </div>
            </div>
          </div>
        )}

        {/* Table View */}
        <div className="overflow-x-auto overflow-y-auto relative min-h-[400px] max-h-[65vh] border-t border-slate-100">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-bold tracking-wider text-xs sticky top-0 z-30 shadow-sm">
              <tr>
                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100/50 transition-colors group w-1/5 sticky right-0 bg-[#F8FAFC] z-40 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] border-l border-slate-200" onClick={() => handleSort('fullName')}>
                  الزبون <SortIcon columnKey="fullName" />
                </th>
                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100/50 transition-colors group text-right" onClick={() => handleSort('shippingTrackingId')}>
                  معلومات التتبع <SortIcon columnKey="shippingTrackingId" />
                </th>
                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100/50 transition-colors group w-[160px] text-center" onClick={() => handleSort('status2')}>
                  الحالة <SortIcon columnKey="status2" />
                </th>
                <th className="px-4 py-3 text-right max-w-[200px]">آخر تحديث</th>
                <th className="px-4 py-3 cursor-pointer hover:bg-slate-100/50 transition-colors group text-left" onClick={() => handleSort('totalCharge')}>
                  المبلغ <SortIcon columnKey="totalCharge" />
                </th>
                <th className="px-4 py-3 text-center w-24 sticky left-0 bg-[#F8FAFC] z-20 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.05)] border-r border-slate-200">إجراءات</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map(order => {
                  const priority = needsAction(order) ? getActionPriority(order) : null;
                  const rowBg = priority?.level === 'high' ? 'bg-red-50' : priority?.level === 'medium' ? 'bg-orange-50/40' : priority?.level === 'low' ? 'bg-rose-50/20' : '';
                  const barColor = priority?.level === 'high' ? 'bg-red-500' : priority?.level === 'medium' ? 'bg-orange-400' : 'bg-rose-400';
                  const isExpanded = expandedRows.has(order.id);
                  const notesHistory = order.trackingHistory && order.trackingHistory.filter((h: any) => h.remarque || h.status || h.station).reverse() || [];
                  const latestNote = notesHistory[0];
                  
                  return (
                  <React.Fragment key={order.id}>
                  <tr onClick={() => toggleRowExpand(order.id)} className={`hover:bg-slate-50/80 cursor-pointer transition-colors group/row text-slate-800 relative ${rowBg} ${isExpanded ? 'bg-slate-50 shadow-inner' : ''}`}>
                    <td className={`px-4 py-3 align-middle sticky right-0 z-20 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] border-l border-slate-100 transition-colors ${rowBg || 'bg-white group-hover/row:bg-slate-50'}`}>
                      {priority && (
                        <div className={`absolute right-0 top-0 bottom-0 w-1.5 ${barColor} rounded-l-md`}></div>
                      )}
                      <div className="font-bold text-slate-900 text-sm">{order.fullName}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium mt-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[120px]">{order.city} - {order.region || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-col gap-1 relative group/tracking">
                        {order.shippingTrackingId ? (
                          <div className="font-mono bg-white text-slate-700 px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 w-fit border border-slate-200" title="تعديل البوليصة" onClick={(e) => {e.stopPropagation(); setManualTrackingModal({order}); setManualTrackingId(order.shippingTrackingId)}}>
                            <CheckCircle className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span dir="ltr">{order.shippingTrackingId}</span>
                          </div>
                        ) : (
                          <div className="font-sans bg-slate-50 text-slate-500 px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 w-fit border border-slate-200" title="تعيين رقم التتبع" onClick={(e) => {e.stopPropagation(); setManualTrackingModal({order}); setManualTrackingId('')}}>
                            <Package className="w-3 h-3 shrink-0" />
                            <span>مضاف يدوياً</span>
                          </div>
                        )}
                        <div className="flex gap-1 items-center flex-wrap">
                          <span className="text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200 w-fit">
                             {order.deliveryCompany || 'غير محدد'}
                          </span>
                          <SourceChannelBadge order={order} size="xs" configuredSalesChannels={salesChannels} />
                          {order.isExchangedReturn && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 w-fit border border-rose-200" title={`تم استبدالها بالطلبية: ${order.replacementOrderId || 'غير معروف'}`}>
                              <RefreshCw className="w-2.5 h-2.5" /> تم الإستبدال
                            </span>
                          )}
                          {order.isReplacement && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 w-fit border border-purple-200" title={`بديلة عن: ${order.replacedOrderId || 'غير معروف'}`}>
                              <RefreshCw className="w-2.5 h-2.5" /> بديلة
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                         <div className="flex flex-col items-center gap-1">
                         <span className={`inline-flex items-center justify-center min-w-[70px] px-2 py-1 text-[11px] font-bold rounded border ${getStatusBadge(mapStatusToStatus2(order.status2 || '', order))}`}>
                           {mapStatusToStatus2(order.status2 || '', order)}
                         </span>
                         {mapStatusToStatus2(order.status2 || '', order) === 'مرتجع' && (
                           <span className={`mt-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold rounded border ${order.stockReshipped ? 'bg-blue-50 text-blue-700 border-blue-200' : order.stockRestocked ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                             {order.stockReshipped ? 'تم شحنه من جديد' : order.stockRestocked ? 'متاح بالمخزن' : 'عالق'}
                           </span>
                         )}
                         {priority && (
                             <div className={`mt-1 inline-flex items-center gap-1 text-[9px] font-bold ${priority.level === 'high' ? 'text-red-700' : priority.level === 'medium' ? 'text-orange-700' : 'text-rose-600'}`}>
                               <AlertTriangle className="w-3 h-3" /> تدخل مطلوب
                             </div>
                         )}
                       </div>
                    </td>
                    <td className="px-4 py-3 align-middle max-w-[200px]">
                      {latestNote ? (
                           <div className="group/tooltip relative">
                             <div className="text-[10px] font-bold text-slate-600 line-clamp-2 leading-snug" title={latestNote.remarque || latestNote.status}>
                                {latestNote.remarque || latestNote.status}
                             </div>
                             {latestNote.date && <div className="text-[9px] text-slate-400 font-mono mt-0.5 leading-none" dir="ltr">{latestNote.date.substring(0,10)}</div>}
                           </div>
                      ) : (
                         <span className="text-[10px] text-slate-400 font-medium">لا توجد ملاحظات</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-left">
                      <div className="font-black text-slate-900 text-sm" dir="ltr">
                        {order.totalCharge}
                        <span className="text-[9px] text-slate-400 ml-1">DA</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 align-middle sticky left-0 bg-white z-10 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.05)] border-r border-slate-100 transition-colors" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center justify-center gap-1">
                              <div className="flex items-center gap-1">
                                  <button onClick={() => syncOrderTracking(order, false)} disabled={syncingId === order.id} title="تحديث الحالة" className="w-6 h-6 flex items-center justify-center text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded transition-all">
                                      <RefreshCw className={`w-3 h-3 ${syncingId === order.id ? 'animate-spin' : ''}`} />
                                  </button>
                                  <button onClick={() => setManualStatusModal({ order })} title="تحديث الحالة يدوياً" className="w-6 h-6 flex items-center justify-center text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 rounded transition-all">
                                      <AlertTriangle className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setConfirmReturn(order.id)} title="إرجاع" className="w-6 h-6 flex items-center justify-center text-red-600 bg-slate-50 hover:bg-red-50 border border-slate-200 rounded transition-all">
                                      <Undo2 className="w-3 h-3" />
                                  </button>
                                  {mapStatusToStatus2(order.status2 || '', order) === 'مرتجع' && !order.stockRestocked && (
                                     <button onClick={() => setConfirmRestock(order.id)} title="إرجاع منتجات الطلبية للمخزن" className="w-6 h-6 flex items-center justify-center text-emerald-600 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded transition-all">
                                         <RotateCcw className="w-3 h-3" />
                                     </button>
                                  )}
                                  {mapStatusToStatus2(order.status2 || '', order) === 'مرتجع' && order.stockRestocked && !order.stockReshipped && (
                                     <button onClick={() => setConfirmReshipped(order.id)} title="تم شحن المنتج من جديد" className="w-6 h-6 flex items-center justify-center text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded transition-all">
                                         <Package className="w-3 h-3" />
                                     </button>
                                  )}
                                  <button onClick={(e) => { e.stopPropagation(); setEditProductModal({ order, sku: order.sku || '', productName: order.productName || '', variation: order.variation || '', priceWithoutDelivery: order.priceWithoutDelivery || 0 }); }} title="تعديل منتج الطلبية (مفيد في حالات الإرجاع الخاطئ)" className="w-6 h-6 flex items-center justify-center text-purple-600 bg-slate-50 hover:bg-purple-50 border border-slate-200 rounded transition-all">
                                      <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); setViewOrderModal(order); }} title="عرض التفاصيل كاملة" className="w-6 h-6 flex items-center justify-center text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded transition-all">
                                      <Eye className="w-3 h-3" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); setReplaceOrderModal(order); }} title="إنشاء طلبية بديلة" className="w-6 h-6 flex items-center justify-center text-purple-600 bg-slate-50 hover:bg-purple-50 border border-slate-200 rounded transition-all">
                                      <RefreshCw className="w-3 h-3" />
                                  </button>
                              </div>
                        </div>
                    </td>
                    <td className="px-2 py-3 align-middle text-slate-400">
                       {isExpanded ? <ChevronUp className="w-5 h-5 mx-auto text-indigo-500" /> : <ChevronDown className="w-5 h-5 mx-auto group-hover/row:text-indigo-400" />}
                    </td>
                  </tr>
                  {/* Expanded Row Content */}
                  {isExpanded && (
                      <tr className="bg-slate-50/80 border-b border-t border-indigo-100 shadow-inner">
                         <td colSpan={7} className="px-6 py-6">
                            <div className="flex flex-col lg:flex-row gap-6 items-start">
                               {/* Tracking Info Panel */}
                               <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm w-full">
                                  <h4 className="text-xs font-black text-slate-700 mb-3 flex items-center gap-2">
                                     <Truck className="w-4 h-4 text-indigo-500" /> سجل التتبع بالتفصيل
                                  </h4>
                                  {notesHistory.length > 0 ? (
                                     <div className="space-y-3 max-h-[160px] overflow-y-auto pl-2 custom-scrollbar">
                                         {notesHistory.map((note: any, idx: number) => (
                                             <div key={idx} className="flex gap-3 text-[11px]">
                                                <div className="w-1.5 rounded-full bg-slate-200 shrink-0"></div>
                                                <div className="flex-1 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                                                   {note.date && <div className="text-slate-400 font-mono mb-1 leading-none text-[9px]" dir="ltr">{note.date}</div>}
                                                   {note.status && <div className="font-bold text-indigo-600 leading-snug">{note.status}</div>}
                                                   {note.remarque && <div className="font-medium text-slate-700 leading-relaxed break-words">{note.remarque}</div>}
                                                   {(note.station || note.livreur) && (
                                                      <div className="flex flex-wrap gap-2 mt-1.5">
                                                         {note.station && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold border border-slate-200 inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {note.station}</span>}
                                                         {note.livreur && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold border border-slate-200 inline-flex items-center gap-1"><Truck className="w-3 h-3" /> {note.livreur}</span>}
                                                      </div>
                                                   )}
                                                </div>
                                             </div>
                                         ))}
                                     </div>
                                  ) : (
                                     <div className="text-center py-6 text-slate-400 font-medium text-xs">لا يوجد سجل تتبع متاح</div>
                                  )}
                               </div>
                               
                               {/* Order Detail Quick Panel */}
                               <div className="w-full lg:w-1/3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                                  <div className="flex flex-col gap-1">
                                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">المنتج والمواصفات</span>
                                     <span className="text-xs font-bold text-slate-800 flex flex-col gap-1">
                                        <span><Package className="w-3 h-3 inline-block" /> {order.productName || 'غير محدد'}</span>
                                        {order.variation && <span className="text-indigo-600 text-[11px] mr-4 border border-indigo-100 bg-indigo-50 px-1.5 rounded">{order.variation}</span>}
                                     </span>
                                  </div>
                                  
                                  <div className="w-full h-px bg-slate-100" />
                                  <div className="flex flex-col gap-1">
                                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">معلومات الاتصال</span>
                                     <div className="text-xs font-bold text-slate-800" dir="ltr">{order.phone}</div>
                                  </div>

                                  {order.postponementDate && (
                                     <>
                                        <div className="w-full h-px bg-slate-100" />
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">تأجيل التوصيل</span>
                                            <div className="text-xs font-bold text-rose-700 flex items-center gap-1"><Clock className="w-3 h-3" /> إلى {order.postponementDate}</div>
                                        </div>
                                     </>
                                  )}

                                  <div className="mt-auto pt-3 flex flex-wrap items-center gap-2">
                                      <button onClick={() => handlePrintBordereau(order)} className="text-[10px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 flex-1 rounded-lg border border-slate-200 transition-colors">
                                          طباعة البوليصة
                                      </button>
                                  </div>
                               </div>
                            </div>
                         </td>
                      </tr>
                  )}
                  </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-28 text-center border-none">
                    <div className="bg-[#f1f5f9] w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.05),inset_0_2px_4px_rgba(0,0,0,0.02)]">
                      <Truck className="w-10 h-10 text-slate-400" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">لا توجد سجلات مطابقة</h3>
                    <p className="text-slate-500 font-medium text-sm max-w-sm mx-auto leading-relaxed">
                       لم يتم العثور على طلبيات مشحونة تتطابق مع بحثك. يمكنك تغيير محددات التصفية، أو مزامنة الحالات.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            pageSizeOptions={[25, 50, 100, 200]}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
            itemLabel="طلبية مشحونة"
            className="shrink-0"
          />
        </div>
      </div>

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
                  تعديل رقم التتبع
                </h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  أدخل رقم التتبع (البوليصة) للطلبية الخاصة بالزبون {manualTrackingModal.order.fullName}.
                </p>
              </div>
            </div>
            <div className="p-4">
              <input 
                type="text" 
                value={manualTrackingId}
                onChange={(e) => setManualTrackingId(e.target.value)}
                placeholder="Ex: TRK-123"
                className="w-full text-right bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                dir="rtl"
              />
            </div>
            <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setManualTrackingModal(null);
                  setManualTrackingId('');
                }}
                className="px-4 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-200 font-bold transition-colors"
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

      {/* Tracking History Modal */}
      {trackingHistoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" dir="rtl">
            <div className="bg-indigo-600 px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-black text-lg flex items-center gap-2 tracking-tight">
                <Clock className="w-5 h-5 text-indigo-200" />
                تاريخ التتبع
              </h3>
              <button 
                onClick={() => setTrackingHistoryModal(null)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 max-h-[60vh] overflow-y-auto">
                {trackingHistoryModal.order.trackingHistory && trackingHistoryModal.order.trackingHistory.length > 0 ? (
                    <div className="flex flex-col gap-3 relative border-r-2 border-indigo-100 pr-3">
                        {[...trackingHistoryModal.order.trackingHistory]
                            .filter((h: any) => h.remarque || h.status || h.station)
                            .reverse()
                            .map((note: any, i: number) => (
                            <div key={i} className="bg-white border border-slate-100 p-3.5 rounded-xl text-right shadow-sm relative hover:border-indigo-200 transition-colors">
                                <div className={`absolute w-3 h-3 rounded-full ${i === 0 ? 'bg-indigo-500' : 'bg-slate-300'} right-[-19px] top-4 border-2 border-white shadow-sm`}></div>
                                
                                {note.status && (
                                    <div className={`text-[11px] font-black mb-1.5 ${i === 0 ? 'text-indigo-600' : 'text-slate-500'}`}>
                                        {note.status}
                                    </div>
                                )}
                                
                                {note.remarque && (
                                    <div className="text-[12px] font-bold text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                        {note.remarque}
                                    </div>
                                )}
                                
                                {(note.livreur || note.date || note.station) && (
                                <div className="flex flex-wrap items-center justify-between mt-2.5 pt-2 border-t border-slate-100 gap-2">
                                    {note.livreur ? (
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-bold bg-white border border-slate-200 px-2 py-1 rounded-md">
                                            <Truck className="w-3 h-3 text-indigo-400" />
                                            <span>{note.livreur}</span>
                                        </div>
                                    ) : (
                                        note.station ? (
                                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold">
                                                <MapPin className="w-3 h-3" />
                                                <span>{note.station}</span>
                                            </div>
                                        ) : <div />
                                    )}
                                    
                                    {note.date && (
                                        <div className="text-[10px] text-slate-400 font-mono tracking-tight bg-slate-50 px-2 py-1 rounded-md border border-slate-100" dir="ltr">
                                            {note.date.substring(0, 16)}
                                        </div>
                                    )}
                                </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500 font-bold text-sm">
                        لا يوجد سجل تتبع لهذه الطلبية
                    </div>
                )}
            </div>
            
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setTrackingHistoryModal(null)}
                className="px-5 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-200 font-black transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Status Modal */}
      {manualStatusModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100" dir="rtl">
            <div className={`p-5 flex items-start gap-4 border-b border-rose-100 bg-rose-50`}>
              <div className={`p-2.5 rounded-xl bg-white shadow-sm border border-rose-100 text-rose-600`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="pt-1">
                <h3 className="font-bold text-rose-900 text-lg tracking-tight">
                  تحديث الحالة يدوياً
                </h3>
                <p className="text-xs text-rose-700/80 mt-1.5 leading-relaxed font-bold">
                  تحديث حالة ومتابعة طلبية الزبون <span className="font-black underline mx-0.5">{manualStatusModal.order.fullName}</span>.
                </p>
              </div>
            </div>
            
            <div className="p-5 space-y-4 bg-white">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">اختر الحالة الجديدة</label>
                <div className="relative">
                  <select 
                     value={selectedManualStatus}
                     onChange={(e) => setSelectedManualStatus(e.target.value)}
                     className="w-full text-sm border-2 border-slate-200 rounded-xl py-3 px-4 bg-slate-50 font-bold text-slate-900 outline-none focus:border-rose-400 focus:bg-white transition-all appearance-none pr-4 pl-10"
                  >
                     <option value="مستلم">مستلم (تم التوصيل بنجاح)</option>
                     <option value="مرتجع">مرتجع (تم إلغاء الطلب أو فشل)</option>
                     <option value="في الطريق">في الطريق (تأجيل / محاولة أخرى)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-bold leading-relaxed">
                  ملاحظة: اختيار "مستلم" أو "مرتجع" سيؤدي إلى إيقاف المزامنة الآلية لهذه الطلبية لضمان عدم استبدال حالتك اليدوية.
                </p>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">القرار أو نتيجة الاتصال (اختياري)</label>
                <textarea
                  value={manualStatusNote}
                  onChange={(e) => setManualStatusNote(e.target.value)}
                  placeholder="مثال: اتصلت بالزبون وسيستلم غداً، أو الزبون لا يرد على الهاتف..."
                  className="w-full text-sm border-2 border-slate-200 rounded-xl py-3 px-4 bg-slate-50 font-medium text-slate-900 outline-none focus:border-rose-400 focus:bg-white transition-all resize-none h-24 placeholder:text-slate-400"
                />
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-2">
              <button
                onClick={handleSaveManualStatus}
                className="flex-1 px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-sm shadow-rose-200 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                حفظ التحديث
              </button>
              <button
                onClick={() => setManualStatusModal(null)}
                className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Return to Normal Orders Confirmation Modal */}
      {confirmReturn && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100" dir="rtl">
             <div className="p-5 flex items-start gap-4 border-b border-indigo-100 bg-indigo-50">
               <div className="p-2.5 rounded-xl bg-white shadow-sm border border-indigo-100 text-indigo-600">
                  <Undo2 className="w-6 h-6" />
               </div>
               <div className="pt-1">
                 <h3 className="font-bold text-indigo-900 text-lg tracking-tight">
                   إرجاع الطلبية
                 </h3>
                 <p className="text-xs text-indigo-700/80 mt-1.5 leading-relaxed font-bold">
                   هل أنت متأكد من إرجاع الطلبية إلى قائمة الطلبيات العادية وإلغاء حالة الشحن؟
                 </p>
               </div>
             </div>
             <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-2">
               <button
                 onClick={() => handleReturnOrder(confirmReturn)}
                 className="flex-1 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-sm shadow-indigo-200 flex items-center justify-center gap-2"
               >
                 نعم، إرجاع الطلبية
               </button>
               <button
                 onClick={() => setConfirmReturn(null)}
                 className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold transition-all"
               >
                 إلغاء
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Restock and Shippable Confirmation Modal */}
      {confirmRestock && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100" dir="rtl">
             <div className="p-5 flex items-start gap-4 border-b border-emerald-100 bg-emerald-50">
               <div className="p-2.5 rounded-xl bg-white shadow-sm border border-emerald-100 text-emerald-600">
                  <RotateCcw className="w-6 h-6" />
               </div>
               <div className="pt-1">
                 <h3 className="font-bold text-emerald-900 text-lg tracking-tight">
                   استرجاع للمخزن
                 </h3>
                 <p className="text-xs text-emerald-700/80 mt-1.5 leading-relaxed font-bold">
                   هل أنت متأكد من إرجاع كمية منتج هذه الطلبية المرتجعة إلى المخزن (إضافة عدد القطع للمخزون)؟
                 </p>
               </div>
             </div>
             <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-2">
               <button
                 onClick={() => {
                    const order = orders.find(o => o.id === confirmRestock);
                    if (order) handleRestockOnly(order);
                 }}
                 className="flex-1 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-sm shadow-emerald-200 flex items-center justify-center gap-2 text-sm"
               >
                 تأكيد
               </button>
               <button
                 onClick={() => setConfirmRestock(null)}
                 className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold transition-all text-sm"
               >
                 إلغاء
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Reshipped Confirmation Modal */}
      {confirmReshipped && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100" dir="rtl">
             <div className="p-5 flex items-start gap-4 border-b border-blue-100 bg-blue-50">
               <div className="p-2.5 rounded-xl bg-white shadow-sm border border-blue-100 text-blue-600">
                  <Package className="w-6 h-6" />
               </div>
               <div className="pt-1">
                 <h3 className="font-bold text-blue-900 text-lg tracking-tight">
                   تأكيد شحن المنتج
                 </h3>
                 <p className="text-xs text-blue-700/80 mt-1.5 leading-relaxed font-bold">
                   هل قمت بشحن هذا المنتج المرتجع لعميل آخر؟ بتأكيد هذا الإجراء، ستتغير حالة هذا المرتجع لـ "تم شحنه من جديد".
                 </p>
               </div>
             </div>
             <div className="bg-slate-50 p-4 border-t border-slate-100 flex gap-2">
               <button
                 onClick={() => {
                    const order = orders.find(o => o.id === confirmReshipped);
                    if (order) {
                       updateOrder(order.id, {
                          stockReshipped: true,
                          notes: ((order.notes || '') + `\n[تحديث]: تم شحن المنتج من جديد.`).trim()
                       });
                       toast.success('تم تحديث الحالة بنجاح.');
                       playActionSound('success');
                       setConfirmReshipped(null);
                    }
                 }}
                 className="flex-1 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-sm shadow-blue-200 flex items-center justify-center gap-2 text-sm"
               >
                 نعم، تم الشحن
               </button>
               <button
                 onClick={() => setConfirmReshipped(null)}
                 className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold transition-all text-sm"
               >
                 إلغاء
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative border border-slate-100 overflow-hidden" onClick={(e) => e.stopPropagation()}>
             <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
             
             <button onClick={() => setEditProductModal(null)} className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
               <X className="w-5 h-5" />
             </button>
             
             <div className="flex items-center gap-4 mb-6">
               <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center border border-purple-200 shrink-0">
                  <Package className="w-6 h-6 text-purple-600" />
               </div>
               <div>
                 <h2 className="text-lg font-black text-slate-800 tracking-tight">تعديل منتج الطلبية</h2>
                 <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1.5">
                   الزبون: <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{editProductModal.order.fullName}</span>
                 </p>
               </div>
             </div>
             
             <div className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">اختر المنتج من المخزن</label>
                    <select
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-purple-500 bg-white shadow-sm"
                      value={editProductModal.sku ? JSON.stringify({ sku: editProductModal.sku, name: editProductModal.productName, variation: editProductModal.variation, price: editProductModal.priceWithoutDelivery }) : ''}
                      onChange={(e) => {
                         if (!e.target.value) return;
                         try {
                             const parsed = JSON.parse(e.target.value);
                             const newPrice = Number(parsed.price) || 0;
                             const qnts = Number(editProductModal.order.qnts) || 1;
                             setEditProductModal({
                                 ...editProductModal,
                                 sku: parsed.sku,
                                 productName: parsed.name,
                                 variation: parsed.variation,
                                 priceWithoutDelivery: newPrice * qnts
                             });
                         } catch(err) {}
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
                                            {varName} {vSku ? `[${vSku}]` : ''}
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
                                   {p.name} {p.sku ? `[${p.sku}]` : ''}
                                </option>
                             );
                          }
                       })}
                    </select>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المنتج</label>
                        <input
                           type="text"
                           value={editProductModal.productName ?? ''}
                           onChange={(e) => setEditProductModal({ ...editProductModal, productName: e.target.value })}
                           className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-purple-500 shadow-sm"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">التفرع (Variation)</label>
                        <input
                           type="text"
                           value={editProductModal.variation ?? ''}
                           onChange={(e) => setEditProductModal({ ...editProductModal, variation: e.target.value })}
                           className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-purple-500 shadow-sm"
                        />
                     </div>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">رمز SKU</label>
                    <input
                       type="text"
                       value={editProductModal.sku ?? ''}
                       onChange={(e) => setEditProductModal({ ...editProductModal, sku: e.target.value })}
                       className="w-full border border-purple-300 bg-purple-50 text-purple-800 font-mono rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 shadow-sm"
                    />
                 </div>
             </div>
             
             <div className="flex gap-3 mt-8">
                 <button
                    onClick={() => setEditProductModal(null)}
                    className="flex-1 py-2.5 px-4 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold transition-all"
                 >
                    إلغاء
                 </button>
                 <button
                    onClick={async () => {
                        const qnts = Number(editProductModal.order.qnts) || 1;
                        const delivery = Number(String(editProductModal.order.deliveryPrice || '0').replace(/[^0-9.]/g, ''));
                        const totalCharge = editProductModal.priceWithoutDelivery + delivery;
                        
                        await updateOrder(editProductModal.order.id, {
                           sku: editProductModal.sku,
                           productName: editProductModal.productName,
                           variation: editProductModal.variation,
                           priceWithoutDelivery: editProductModal.priceWithoutDelivery,
                           totalCharge: totalCharge
                        });
                        toast.success('تم تحديث منتج الطلبية بنجاح');
                        setEditProductModal(null);
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-500/20 font-bold transition-all flex items-center justify-center gap-2"
                 >
                    <Save className="w-4 h-4" /> حفظ التعديل
                 </button>
             </div>
          </div>
        </div>
      )}

      {/* View Order Full Details Modal */}
      {viewOrderModal && (
        <ViewOrderModal order={viewOrderModal} onClose={() => setViewOrderModal(null)} />
      )}
      <ReplaceOrderModal originalOrder={replaceOrderModal} isOpen={!!replaceOrderModal} onClose={() => setReplaceOrderModal(null)} />
      
      {showPickingList && (
        <PickingListModal 
          orders={filteredOrders} 
          allShippedOrders={shippedOrders}
          onClose={() => setShowPickingList(false)} 
        />
      )}
    </div>
  );
}
