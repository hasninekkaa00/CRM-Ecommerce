import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store';
import { checkProductMatch, renderProductFilterOptions, isCampaignMatchedToProduct } from '../../utils/productFilters';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, subDays, subWeeks, subMonths } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ComposedChart, AreaChart, Area } from 'recharts';
import { DollarSign, Filter, Plus, Trash2, Save, ShoppingBag, Target, TrendingUp, TrendingDown, RefreshCw, Activity, HeartPulse, CreditCard, Banknote, User, Package, Calendar, X, Info, Edit2, Maximize2, Minimize2, Search, FileSpreadsheet, Download, Eye, AlertTriangle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAndMapMetaMetrics } from '../../utils/metaSync';
import { getAttemptCount } from '../../utils/orderUtils';
import { fetchCompanyFeesAPI, getWilayaFeeFromFeesData, extractWilayaCode, isStopDeskOrder, calculateDefaultShippingFee, getEffectiveShippingCost } from '../../utils/shippingFees';
import { exportFinanceOrdersToExcel } from '../../utils/excelExport';
import { getOrderUnitAndTotalCost, extractOrderSkus, cleanSku, normalizeText, getProductCostValue } from '../../utils/productCostUtils';
import { getPeriodReturnCost, safeParseDate, safeIsWithinInterval, createFinanceCalculator } from '../../utils/financeCalculations';
import { ViewOrderModal } from '../orders/ViewOrderModal';
import { TablePagination } from '../common/TablePagination';
import { ZeroOrNegativeProfitModal } from './ZeroOrNegativeProfitModal';
import { AdvancedFinanceExportModal } from './AdvancedFinanceExportModal';
import { FinanceTableRow } from './FinanceTableRow';

const formatCurrency = (val: number) => {
  return Math.round(Number(val) || 0).toLocaleString('fr-FR');
};

export function ProfitSimulator() {
  const { orders, campaigns, campaignRecords, expenses, settings, updateSettings, addExpense, deleteExpense, inventoryProducts, updateOrder, addCampaignRecord, campaignFields, addCampaignField, addToTrackingQueue, setTrackingQueueState, globalProductFilter, setGlobalProductFilter, bulkUpsertInventory } = useStore();

  const hasSyncedMetaRef = React.useRef(false);

  // Auto-sync Meta Ads spend for today when entering Finance
  useEffect(() => {
    if (!settings?.metaAdsToken || hasSyncedMetaRef.current) return;
    hasSyncedMetaRef.current = true;
    
    const syncMetaAds = async () => {
       const activeMetaCampaigns = campaigns.filter(c => c.platform === 'Meta' && !c.isArchived && c.metaCampaignId);
       if (activeMetaCampaigns.length === 0) return;
       
       const token = settings.metaAdsToken;
       
       const untilDate = new Date();
       const sinceDate = new Date();
       sinceDate.setDate(untilDate.getDate() - 7);
       const timeRange = JSON.stringify({
           since: sinceDate.toISOString().split('T')[0],
           until: untilDate.toISOString().split('T')[0]
       });
       
       let currentFields = campaignFields;
       if (currentFields.length === 0) {
           const defaults = ["Impressions", "Reach", "CPM", "Link clicks", "CPC", "CTR", "Landing page views", "Purchases", "Cost per purchase"];
           for (let i = 0; i < defaults.length; i++) {
              const newField = { id: 'f_default_' + i + '_' + Date.now().toString(), name: defaults[i], type: 'number' as const };
              await addCampaignField(newField);
              currentFields = [...currentFields, newField];
           }
       }
       
       let syncedCount = 0;
       
       for (const mc of activeMetaCampaigns) {
           try {
              const res = await fetch(`https://graph.facebook.com/v19.0/${mc.metaCampaignId}/insights?time_range=${encodeURIComponent(timeRange)}&time_increment=1&fields=spend,date_start,impressions,reach,cpm,clicks,cpc,ctr,actions,cost_per_action_type&access_token=${token}`);
              const text = await res.text();
              let data;
              try {
                data = JSON.parse(text);
              } catch (e) {
                throw new Error(`Meta API returned invalid JSON: ${text.substring(0, 100)}`);
              }
              if (!res.ok) {
                throw new Error(data.error?.message || `Meta API error: ${text.substring(0, 100)}`);
              }
              
              if (data.data && data.data.length > 0) {
                 const parsedMetrics = fetchAndMapMetaMetrics(data, currentFields);
                 for (const record of parsedMetrics) {
                     const recordId = `meta_record_${mc.metaCampaignId}_${record.date}`;
                     const existingRecord = campaignRecords.find(r => r.id === recordId);
                     
                     const isDiff = !existingRecord || existingRecord.spend !== record.spend || JSON.stringify(existingRecord.dynamicFields) !== JSON.stringify({...existingRecord.dynamicFields, ...record.metrics});
                     
                     if (isDiff) {
                        await addCampaignRecord({
                           id: recordId,
                           campaignId: mc.id,
                           date: record.date,
                           spend: record.spend,
                           dynamicFields: existingRecord ? { ...existingRecord.dynamicFields, ...record.metrics } : record.metrics
                        });
                        syncedCount++;
                     }
                 }
              }
           } catch (e) {
              console.error("Failed to sync Meta campaign", mc.name, e);
           }
       }
       if (syncedCount > 0) {
          toast.success(`تم تحديث بيانات ميتا (سجلات ${syncedCount})`);
       }
    };
    
    syncMetaAds();
  }, [settings?.metaAdsToken]);

  const mapStatusToStatus2 = (statusText: string, order?: any): string => {
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

  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>(() => (localStorage.getItem('profit_dateFilter') as any) || 'month');
  const [customStart, setCustomStart] = useState(() => localStorage.getItem('profit_customStart') || '');
  const [customEnd, setCustomEnd] = useState(() => localStorage.getItem('profit_customEnd') || '');
  const [comparePeriod, setComparePeriod] = useState<boolean>(() => localStorage.getItem('profit_compare') === 'true');
  const [compareType, setCompareType] = useState<'auto' | 'custom'>(() => (localStorage.getItem('profit_compareType') as any) || 'auto');
  const [compareCustomStart, setCompareCustomStart] = useState<string>(() => localStorage.getItem('profit_compareCustomStart') || '');
  const [compareCustomEnd, setCompareCustomEnd] = useState<string>(() => localStorage.getItem('profit_compareCustomEnd') || '');

  const [confirmerFilter, setConfirmerFilter] = useState<string>(() => localStorage.getItem('profit_confirmerFilter') || 'all');
  const [productFilter, setProductFilter] = useState<string>(() => globalProductFilter || localStorage.getItem('profit_productFilter') || 'all');

  useEffect(() => {
    if (globalProductFilter !== undefined) {
      setProductFilter(prev => (prev === globalProductFilter ? prev : globalProductFilter));
    }
  }, [globalProductFilter]);
  const [defaultGlobalProductCost, setDefaultGlobalProductCost] = useState<number>(() => Number(localStorage.getItem('profit_defaultGlobalProductCost')) || 0);

  const [chart1Mode, setChart1Mode] = useState<'cumulative' | 'daily'>('cumulative');
  const [chart2Mode, setChart2Mode] = useState<'both' | 'daily' | 'cumulative'>('both');
  const [financeActiveTab, setFinanceActiveTab] = useState<'all' | 'overview' | 'table' | 'settings'>(
    () => (localStorage.getItem('finance_active_tab') as any) || 'all'
  );
  const [activeChartTab, setActiveChartTab] = useState<'all' | 'chart1' | 'chart2' | 'chart3' | 'hidden'>(
    () => (localStorage.getItem('finance_active_chart_tab') as any) || 'all'
  );

  useEffect(() => {
    localStorage.setItem('finance_active_tab', financeActiveTab);
  }, [financeActiveTab]);

  useEffect(() => {
    localStorage.setItem('finance_active_chart_tab', activeChartTab);
  }, [activeChartTab]);

  useEffect(() => {
    localStorage.setItem('profit_dateFilter', dateFilter);
    localStorage.setItem('profit_customStart', customStart);
    localStorage.setItem('profit_customEnd', customEnd);
    localStorage.setItem('profit_confirmerFilter', confirmerFilter);
    localStorage.setItem('profit_productFilter', productFilter);
    localStorage.setItem('profit_defaultGlobalProductCost', defaultGlobalProductCost.toString());

    localStorage.setItem('profit_compare', comparePeriod.toString());
    localStorage.setItem('profit_compareType', compareType);
    localStorage.setItem('profit_compareCustomStart', compareCustomStart);
    localStorage.setItem('profit_compareCustomEnd', compareCustomEnd);
  }, [dateFilter, customStart, customEnd, confirmerFilter, productFilter, defaultGlobalProductCost, comparePeriod, compareType, compareCustomStart, compareCustomEnd]);

  const [returnCostInput, setReturnCostInput] = useState(settings?.returnCost?.toString() || '400');
  const [returnCostModeInput, setReturnCostModeInput] = useState<'per_order' | 'monthly_subscription'>(settings?.returnCostMode || 'per_order');
  const [returnMonthlySubInput, setReturnMonthlySubInput] = useState(settings?.returnMonthlySubscription?.toString() || '0');
  const [exchangeRateInput, setExchangeRateInput] = useState(settings?.exchangeRate?.toString() || '245');

  useEffect(() => {
    if (settings) {
      if (settings.returnCost !== undefined) setReturnCostInput(settings.returnCost.toString());
      if (settings.returnCostMode !== undefined) setReturnCostModeInput(settings.returnCostMode);
      if (settings.returnMonthlySubscription !== undefined) setReturnMonthlySubInput(settings.returnMonthlySubscription.toString());
      if (settings.exchangeRate !== undefined) setExchangeRateInput(settings.exchangeRate.toString());
    }
  }, [settings]);

  const isMonthlySub = settings?.returnCostMode === 'monthly_subscription';
  const monthlySubAmount = Number(settings?.returnMonthlySubscription) || 0;
  
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  const handleBulkSync = async (ordersToSyncList: any[], force = false) => {
    const activeOrders = ordersToSyncList.filter(o => o.shippingTrackingId && o.shippingTrackingId !== 'تسليم يدوي');
    if (activeOrders.length === 0) {
        toast('لا توجد طلبيات صالحة للمزامنة بأرقام تتبع في الجدول الحالي', { icon: 'ℹ️' });
        return;
    }

    const cooldownMs = force ? 0 : 10 * 60 * 1000; // 10 minutes instead of 4 hours
    const now = new Date().getTime();

    // Filter by eligibility (not synced within cooldown)
    const eligibleOrders = activeOrders.filter(o => {
        if (!o.lastTrackingSync) return true;
        return (now - new Date(o.lastTrackingSync).getTime()) > cooldownMs;
    });

    const skippedCount = activeOrders.length - eligibleOrders.length;
    const maxBatchSize = 30;

    // Sort by oldest lastTrackingSync first
    eligibleOrders.sort((a, b) => {
        const tA = a.lastTrackingSync ? new Date(a.lastTrackingSync).getTime() : 0;
        const tB = b.lastTrackingSync ? new Date(b.lastTrackingSync).getTime() : 0;
        return tA - tB;
    });

    const batch = eligibleOrders.slice(0, maxBatchSize);

    if (batch.length === 0) {
        if (skippedCount > 0) {
            const confirmForce = window.confirm(`المزامنة الذكية: تم تحديث جميع الطلبيات (${skippedCount}) مؤخراً لتفادي الحظر.\n\nهل ترغب في تحديثها إجبارياً وتخطي فترة الانتظار الآمنة الآن؟`);
            if (confirmForce) {
                handleBulkSync(ordersToSyncList, true);
                return;
            }
        } else {
            toast('لا توجد طلبيات تحتاج إلى تحديث حالياً.', { icon: 'ℹ️' });
        }
        return;
    }

    // Add to background queue
    addToTrackingQueue(batch.map(o => o.id));
    setTrackingQueueState({ isTrackingQueueProcessing: true });

    toast.success(`تمت إضافة ${batch.length} طلبية إلى قائمة الانتظار للمزامنة الذكية بالخلفية.`);
  };

  const syncOrderFinancials = async (order: any) => {
    if (!order.shippingTrackingId) {
      toast.error('رقم التتبع غير متوفر لهذه الطلبية.');
      return;
    }
    const integration = settings?.shippingIntegrations?.find(i => i.name === order.deliveryCompany && i.isActive)
                     || settings?.shippingIntegrations?.find(i => i.isActive);
    if (!integration || !integration.token) {
      toast.error(`إعدادات شركة الشحن أو التوكن غير متوفر لشركة ${order.deliveryCompany || 'التوصيل'}. يرجى التحقق من تفعيل الربط في الإعدادات.`);
      return;
    }

    setSyncingOrderId(order.id);
    try {
      const res = await fetch('/api/shipping/ecotrack/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: integration.domain || 'https://expedigo.ecotrack.dz',
          token: integration.token,
          trackingId: order.shippingTrackingId
        })
      });

      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || 'خطأ في جلب بيانات الطرد');
        setSyncingOrderId(null);
        return;
      }

      let responseData = data.data;
      if (responseData && typeof responseData === 'object' && !Array.isArray(responseData) && responseData.data) {
          responseData = responseData.data;
      }

      if (!responseData) {
        toast.error('لا توجد بيانات لهذه الطلبية في شركة الشحن.');
        setSyncingOrderId(null);
        return;
      }

      let updates: any = {};
      const tarif = responseData.tarif ?? responseData.prix_livraison ?? responseData.shipping_price ?? responseData.delivery_fee ?? responseData.frais_livraison ?? responseData.frais_expedition ?? responseData.frais ?? responseData.livraison ?? responseData.cout_livraison;
      const amount = responseData.montant || responseData.price || responseData.total || responseData.cod_amount;

      let updated = false;

      let numTarif = (tarif !== undefined && !isNaN(Number(tarif))) ? Number(tarif) : 0;

      // Fallback: If tracking response didn't return direct tariff, fetch from company Fees API
      if (numTarif <= 0) {
        const feesData = await fetchCompanyFeesAPI(integration);
        if (feesData) {
          const wilayaId = extractWilayaCode(order);
          const isStopDesk = isStopDeskOrder(order);
          const feeFromApi = getWilayaFeeFromFeesData(feesData, wilayaId, isStopDesk);
          if (feeFromApi && feeFromApi > 0) {
            numTarif = feeFromApi;
          }
        }
      }

      if (numTarif > 0 && order.shippingFeeMode !== 'manual') {
         updates.realDeliveryPrice = numTarif;
         updated = true;
      }

      if (amount !== undefined && !isNaN(Number(amount))) {
          const numAmount = Number(amount);
          if (numAmount > 0 && Number(order.totalCharge) !== numAmount) {
              updates.totalCharge = numAmount;
              updated = true;
          }
      }

      // Always save tracking check timestamp on success
      updates.lastTrackingSync = new Date().toISOString();

      await updateOrder(order.id, updates);
      
      if (updated) {
          toast.success('تم جلب وتحديث الأسعار من شركة الشحن بنجاح!');
      } else {
          toast('الأسعار متطابقة بالفعل مع شركة الشحن.', { icon: 'ℹ️' });
      }
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء الاتصال بشركة الشحن.');
    } finally {
      setSyncingOrderId(null);
    }
  };

  const handleSingleOrderAutoShipping = async (order: any) => {
    const integration = settings?.shippingIntegrations?.find(i => i.isActive);
    let fee: number | null = null;
    if (integration && integration.token) {
      try {
        const feesData = await fetchCompanyFeesAPI(integration);
        if (feesData) {
          const wilayaId = extractWilayaCode(order);
          const isStopDesk = isStopDeskOrder(order);
          fee = getWilayaFeeFromFeesData(feesData, wilayaId, isStopDesk);
        }
      } catch (e) {
        console.warn('API fee fetch error', e);
      }
    }

    if (!fee || fee <= 0) {
      const wilayaId = extractWilayaCode(order);
      const isStopDesk = isStopDeskOrder(order);
      const calc = calculateDefaultShippingFee(wilayaId, isStopDesk);
      fee = calc.realDeliveryPrice;
    }

    await updateOrder(order.id, {
      realDeliveryPrice: fee,
      shippingFeeMode: 'auto'
    });
    toast.success(`تم تحديث سعر الشحن الأصلي تلقائياً: ${fee} د.ج`);
  };

  const syncCompanyFeesForOrders = async (targetOrders: any[]) => {
    const integration = settings?.shippingIntegrations?.find(i => i.isActive);
    let feesData = null;
    if (integration && integration.token) {
      feesData = await fetchCompanyFeesAPI(integration);
    }

    const toastId = toast.loading('جاري حساب وتطبيق أسعار الشحن التلقائية لجميع الطلبيات...');
    try {
      let updatedCount = 0;
      for (const order of targetOrders) {
        if (order.shippingFeeMode === 'manual') {
          continue; // Skip manually set shipping fees
        }
        const wilayaId = extractWilayaCode(order);
        const isStopDesk = isStopDeskOrder(order);
        let fee: number | null = null;

        if (feesData) {
          fee = getWilayaFeeFromFeesData(feesData, wilayaId, isStopDesk);
        }

        if (!fee || fee <= 0) {
          const calc = calculateDefaultShippingFee(wilayaId, isStopDesk);
          fee = calc.realDeliveryPrice;
        }

        if (fee && fee > 0) {
          if (Number(order.realDeliveryPrice) !== fee || order.shippingFeeMode !== 'auto') {
            await updateOrder(order.id, {
              realDeliveryPrice: fee,
              shippingFeeMode: 'auto'
            });
            updatedCount++;
          }
        }
      }

      if (updatedCount > 0) {
        toast.success(`تم تطبيق سعر الشحن التلقائي لـ ${updatedCount} طلبية بنجاح!`, { id: toastId });
      } else {
        toast.success(`جميع الطلبيات محدثة بالفعل وفق أسعار شركات الشحن التلقائية.`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(`خطأ أثناء مزامنة أسعار الشحن: ${err.message || err}`, { id: toastId });
    }
  };

  const [showCostsModal, setShowCostsModal] = useState(false);
  const [showZeroOrNegativeModal, setShowZeroOrNegativeModal] = useState(false);
  const [productCostsTemp, setProductCostsTemp] = useState<Record<string, number>>(settings?.productCosts || {});
  const [infoModalOrders, setInfoModalOrders] = useState<{title: string, orders: any[]} | null>(null);

  // Initialize product & variation costs pulling directly from warehouse inventory
  const initializeProductCostsFromInventory = () => {
    const initial: Record<string, number> = { ...(settings?.productCosts || {}) };
    inventoryProducts.forEach((inv) => {
      const invWarehouseCost = getProductCostValue(inv);
      if (invWarehouseCost > 0) {
        initial[inv.name] = invWarehouseCost;
        if (inv.sku) initial[inv.sku] = invWarehouseCost;
      }
      if (Array.isArray(inv.variations)) {
        inv.variations.forEach((v: any) => {
          const variationName = v.attributes?.map((a: any) => a.option).join(' ') || v.name || v.sku;
          const key = `${inv.name}::${variationName}`;
          const vWarehouseCost = getProductCostValue(v);
          if (vWarehouseCost > 0) {
            initial[key] = vWarehouseCost;
            if (v.sku) initial[v.sku] = vWarehouseCost;
          }
        });
      }
    });
    setProductCostsTemp(initial);
  };

  // Save product and variation costs directly back into the warehouse (inventory) and settings
  const handleSaveInventoryCosts = async () => {
    // 1. Update settings.productCosts dictionary
    await updateSettings({ productCosts: productCostsTemp });

    // 2. Direct update to inventory products and variations in the warehouse
    if (bulkUpsertInventory && inventoryProducts.length > 0) {
      const updatedProducts = inventoryProducts.map((inv) => {
        const prodCopy = { ...inv };
        const hasVariations = Array.isArray(prodCopy.variations) && prodCopy.variations.length > 0;

        if (!hasVariations) {
          if (productCostsTemp[inv.name] !== undefined) {
            prodCopy.local_cost = Number(productCostsTemp[inv.name]) || null;
          }
        } else {
          prodCopy.variations = prodCopy.variations.map((v: any) => {
            const variationName = v.attributes?.map((a: any) => a.option).join(' ') || v.name || v.sku;
            const key = `${inv.name}::${variationName}`;
            const newCost = productCostsTemp[key] !== undefined 
              ? Number(productCostsTemp[key]) 
              : (v.sku && productCostsTemp[v.sku] !== undefined ? Number(productCostsTemp[v.sku]) : null);
            return {
              ...v,
              local_cost: newCost !== null && newCost > 0 ? newCost : (v.local_cost ?? null)
            };
          });
          if (!prodCopy.local_cost && prodCopy.variations.length > 0) {
            const firstVarCost = prodCopy.variations.find((v: any) => v.local_cost && v.local_cost > 0);
            if (firstVarCost) prodCopy.local_cost = firstVarCost.local_cost;
          }
        }
        return prodCopy;
      });

      await bulkUpsertInventory(updatedProducts);
    }

    setShowCostsModal(false);
    toast.success('تم حفظ وتحديث تكاليف المنتجات والأنواع في المخزن والمالية بنجاح!');
  };

  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const [isTableFullscreen, setIsTableFullscreen] = useState(false);

  const toggleTableFullscreen = () => {
    if (!document.fullscreenElement && !isTableFullscreen) {
      if (tableContainerRef.current?.requestFullscreen) {
        tableContainerRef.current.requestFullscreen().then(() => setIsTableFullscreen(true)).catch(() => {
          setIsTableFullscreen(!isTableFullscreen);
        });
      } else {
        setIsTableFullscreen(!isTableFullscreen);
      }
    } else {
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().then(() => setIsTableFullscreen(false)).catch(() => setIsTableFullscreen(false));
      } else {
        setIsTableFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFSChange = () => {
      setIsTableFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const [tableProductFilter, setTableProductFilter] = useState<string>(() => localStorage.getItem('profit_tableProductFilter') || 'all');
  const [tableStatusFilter, setTableStatusFilter] = useState<string>(() => localStorage.getItem('profit_tableStatusFilter') || 'all');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState<number>(1);
  const [tablePageSize, setTablePageSize] = useState<number>(25);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<any | null>(null);
  const [showAdvancedExportModal, setShowAdvancedExportModal] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('profit_tableProductFilter', tableProductFilter);
    localStorage.setItem('profit_tableStatusFilter', tableStatusFilter);
    setTablePage(1);
  }, [tableProductFilter, tableStatusFilter, productFilter, dateFilter, customStart, customEnd]);

  // Direct navigation from Zero/Negative profit modal to the order in the Finance table
  const handleGoToOrderInTable = (order: any) => {
    if (!order) return;

    // 1. Close modal
    setShowZeroOrNegativeModal(false);

    // 2. Switch to table view tab
    setFinanceActiveTab('table');

    // 3. Clear product and status filters that could hide the order
    setTableProductFilter('all');
    setTableStatusFilter('all');

    // 4. Set quick search to this order ID so it is immediately isolated and displayed
    const targetSearch = String(order.orderId || order.id || '');
    setTableSearchQuery(targetSearch);
    setTablePage(1);

    // 5. Highlight the row
    const targetId = String(order.id || order.orderId || '');
    setHighlightedOrderId(targetId);

    // 6. Smoothly scroll into view
    setTimeout(() => {
      const rowEl = document.getElementById(`finance-order-row-${targetId}`) || 
                    document.getElementById(`finance-order-row-${order.orderId}`) ||
                    document.getElementById(`finance-order-row-${order.id}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        tableContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 250);

    // 7. Clear highlight after 5 seconds
    setTimeout(() => {
      setHighlightedOrderId(null);
    }, 5000);

    toast.success(`تم الانتقال للطلبية #${order.orderId || order.id} في جدول المالية`, {
      icon: '📍',
      duration: 3500
    });
  };

  const handleSaveSettings = () => {
    updateSettings({ 
      returnCost: Number(returnCostInput) || 0,
      returnCostMode: returnCostModeInput,
      returnMonthlySubscription: Number(returnMonthlySubInput) || 0,
      exchangeRate: Number(exchangeRateInput) || 245
    });
    toast.success('تم حفظ إعدادات المحاسبة وإعادة احتساب الأرباح بنجاح');
  };

  const handleAddExpense = () => {
    if (!expenseDesc || !expenseAmount) return;
    addExpense({
      id: Date.now().toString(),
      date: expenseDate,
      amount: Number(expenseAmount),
      description: expenseDesc
    });
    setExpenseDesc('');
    setExpenseAmount('');
    setEditingExpenseId(null);
  };

  const handleUpdateExpense = () => {
    if (!expenseDesc || !expenseAmount || !editingExpenseId) return;
    const { updateExpense } = useStore.getState();
    if(updateExpense) {
      updateExpense(editingExpenseId, {
        date: expenseDate,
        amount: Number(expenseAmount),
        description: expenseDesc
      });
    }
    setExpenseDesc('');
    setExpenseAmount('');
    setEditingExpenseId(null);
  };

  const startEditExpense = (exp: any) => {
    setEditingExpenseId(exp.id);
    setExpenseDesc(exp.description);
    setExpenseAmount(exp.amount.toString());
    setExpenseDate(exp.date);
  };

  const cancelEditExpense = () => {
    setEditingExpenseId(null);
    setExpenseDesc('');
    setExpenseAmount('');
    setExpenseDate(format(new Date(), 'yyyy-MM-dd'));
  };

  // Dates handling
  const getDeliveryDate = (order: any) => {
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

  const getReturnDate = (order: any) => {
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

  const getShippingDate = (order: any) => {
    if (order.shippedDate) return safeParseDate(order.shippedDate);
    if (order.shippingDate) return safeParseDate(order.shippingDate);
    if (order.trackingHistory && Array.isArray(order.trackingHistory) && order.trackingHistory.length > 0) {
      const hist = order.trackingHistory.find((h: any) => {
        const st = (h.status || '').toLowerCase();
        return st.includes('شحن') || st.includes('طريق') || st.includes('expédi') || st.includes('expedie') || st.includes('رمت');
      });
      if (hist && hist.date) {
        const d = safeParseDate(hist.date);
        if (d) return d;
      }
    }
    return safeParseDate(order.orderDate);
  };

  // 1. Calculate Period Filters
  const { start, end, compareStart, compareEnd } = useMemo(() => {
    const now = new Date();
    let s: Date = startOfMonth(now), e: Date = endOfDay(now);
    let cS: Date | null = null;
    let cE: Date | null = null;
    
    switch (dateFilter) {
      case 'today': 
        s = startOfDay(now); 
        e = endOfDay(now);
        cS = startOfDay(subDays(s, 1));
        cE = endOfDay(subDays(e, 1));
        break;
      case 'yesterday': {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        s = startOfDay(y);
        e = endOfDay(y);
        cS = startOfDay(subDays(s, 1));
        cE = endOfDay(subDays(e, 1));
        break;
      }
      case 'week': 
        s = startOfWeek(now, { weekStartsOn: 6 }); 
        e = endOfWeek(now, { weekStartsOn: 6 });
        cS = startOfWeek(subWeeks(s, 1), { weekStartsOn: 6 });
        cE = endOfWeek(subWeeks(e, 1), { weekStartsOn: 6 });
        break;
      case 'month': 
        s = startOfMonth(now); 
        e = endOfMonth(now);
        cS = startOfMonth(subMonths(now, 1));
        cE = endOfMonth(subMonths(now, 1));
        break;
      case 'all': 
        s = new Date(2000, 0, 1); 
        e = new Date(2100, 0, 1); 
        break;
      case 'custom':
        s = customStart ? startOfDay(parseISO(customStart)) : startOfMonth(now);
        e = customEnd ? endOfDay(parseISO(customEnd)) : endOfDay(now);
        const diff = e.getTime() - s.getTime();
        cE = new Date(s.getTime() - 1);
        cS = new Date(cE.getTime() - diff);
        break;
    }

    if (compareType === 'custom') {
      cS = compareCustomStart ? startOfDay(parseISO(compareCustomStart)) : cS;
      cE = compareCustomEnd ? endOfDay(parseISO(compareCustomEnd)) : cE;
    }

    return { start: s, end: e, compareStart: cS, compareEnd: cE };
  }, [dateFilter, customStart, customEnd, compareType, compareCustomStart, compareCustomEnd]);

  // Unique Select Data
  const productFilterOptionsJSX = useMemo(() => {
    return renderProductFilterOptions(inventoryProducts, orders);
  }, [orders, inventoryProducts]);

  const uniqueConfirmers = useMemo(() => {
    const list = new Set<string>();
    orders.forEach(o => {
      if (o.confirmedBy && o.confirmedBy.trim() !== '') {
        list.add(o.confirmedBy);
      }
    });
    return Array.from(list).sort();
  }, [orders]);

  const calculateTotalCampaignSpend = (campaign: any, records: any[], startObj?: Date, endObj?: Date) => {
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
    } catch (err) {
       console.error('Error calculating spend', err);
    }
    return totalSpend;
  };

  const orderByIdMap = useMemo(() => {
    const map = new Map<string, any>();
    orders.forEach((o) => {
      if (o.id) map.set(o.id, o);
      if (o.orderId) map.set(String(o.orderId), o);
    });
    return map;
  }, [orders]);

  const getBaseOrderCogs = (o: any) => {
    const costInfo = getOrderUnitAndTotalCost(o, inventoryProducts, settings);
    return costInfo.totalCogs;
  };

  const orderCostsMap = useMemo(() => {
    const map = new Map<string, { totalCogs: number; extCost: number }>();
    orders.forEach((o) => {
      let extCost = o.customAdditionalCost || 0;
      let totalCogs = getBaseOrderCogs(o);

      if (o.isReplacement && o.replacedOrderId) {
        const orig = orderByIdMap.get(o.replacedOrderId);
        if (orig) {
          const origCogs = getBaseOrderCogs(orig);
          totalCogs = Math.max(0, totalCogs - origCogs);
        }
      }

      map.set(o.id, { totalCogs, extCost });
    });
    return map;
  }, [orders, inventoryProducts, settings, orderByIdMap]);

  const getOrderCosts = (o: any) => {
    if (!o || !o.id) {
      let extCost = o?.customAdditionalCost || 0;
      let totalCogs = getBaseOrderCogs(o);
      return { totalCogs, extCost };
    }
    const cached = orderCostsMap.get(o.id);
    if (cached) return cached;
    let extCost = o.customAdditionalCost || 0;
    let totalCogs = getBaseOrderCogs(o);
    return { totalCogs, extCost };
  };

  const checkProductMatchLocal = (orderOrSku: any) => {
      return checkProductMatch(orderOrSku, productFilter, inventoryProducts);
  };

  const handleApplyCostGlobally = async (targetOrder: any, costValue: number) => {
    if (!costValue || costValue <= 0) {
      toast.error('يرجى إدخال قيمة تكلفة صالحة أكبر من 0');
      return;
    }

    const costMatch = getOrderUnitAndTotalCost(targetOrder, inventoryProducts, settings);
    const targetSkus = extractOrderSkus(targetOrder);
    const targetProductName = targetOrder.productName?.trim();

    // 1. Update settings.productCosts dictionary
    const currentProductCosts = { ...(settings?.productCosts || {}) };
    targetSkus.forEach(s => {
      currentProductCosts[s] = costValue;
      const clean = cleanSku(s);
      if (clean) currentProductCosts[clean] = costValue;
    });
    if (targetProductName) {
      currentProductCosts[normalizeText(targetProductName)] = costValue;
      currentProductCosts[targetProductName] = costValue;
    }
    await updateSettings({ productCosts: currentProductCosts });

    // 2. If an inventory product is matched, update its local_cost or variation's local_cost
    if (costMatch.recognizedProduct && bulkUpsertInventory) {
      const p = { ...costMatch.recognizedProduct };
      if (costMatch.recognizedVariation && Array.isArray(p.variations)) {
        p.variations = p.variations.map((v: any) => {
          if (v.id === costMatch.recognizedVariation.id || (v.sku && v.sku === costMatch.recognizedVariation.sku)) {
            return { ...v, local_cost: costValue };
          }
          return v;
        });
      } else {
        p.local_cost = costValue;
      }
      await bulkUpsertInventory([p]);
    }

    toast.success(`تم تعميم تكلفة (${costValue} دج) وتحديثها في المخزن وإعدادات المنتجات بنجاح`);
  };

  // CASH FLOW: Today / Week / Month based purely on delivery date (مستلم)
  const cashFlowStats = useMemo(() => {
    let tProfit = 0, wProfit = 0, mProfit = 0;
    const tOrders: any[] = [];
    const wOrders: any[] = [];
    const mOrders: any[] = [];
    
    // Quick Stats Counts
    let tShippedCount = 0, wShippedCount = 0, mShippedCount = 0;
    let tDeliveredCount = 0, wDeliveredCount = 0, mDeliveredCount = 0;
    let tReturnedCount = 0, wReturnedCount = 0, mReturnedCount = 0;

    const now = new Date();
    const tStart = startOfDay(now);
    const wStart = startOfWeek(now, { weekStartsOn: 6 });
    const mStart = startOfMonth(now);
    const eDay = endOfDay(now);

    const rCost = settings?.returnCost || 400;
    const exRate = settings?.exchangeRate || 245;

    // We filter campaigns and expenses for these fixed periods for Quick Stats
    const getCampaignOrExpenseSum = (items: any[], startD: Date) => {
        return items.filter((i:any) => i.date && parseISO(i.date) >= startD && parseISO(i.date) <= eDay).reduce((s, x) => s + (x.spend || x.amount || 0), 0);
    };

    const exT = getCampaignOrExpenseSum(expenses, tStart);
    const exW = getCampaignOrExpenseSum(expenses, wStart);
    const exM = getCampaignOrExpenseSum(expenses, mStart);

    // Ads calculation requires checking if it belongs to selected product if filtered!
    const getAdSpend = (startD: Date) => {
        let spendUSD = 0;
        const matchingCampaigns = campaigns.filter(camp => isCampaignMatchedToProduct(camp, productFilter, inventoryProducts));

        matchingCampaigns.forEach(camp => {
            const records = campaignRecords.filter(r => r.campaignId === camp.id);
            spendUSD += calculateTotalCampaignSpend(camp, records, startD, eDay);
        });
        return spendUSD * exRate;
    };

    const adT = getAdSpend(tStart);
    const adW = getAdSpend(wStart);
    const adM = getAdSpend(mStart);

    orders.forEach(o => {
      // Global quick stats respond to Product / Confirmer filter
      if (confirmerFilter !== 'all' && o.confirmedBy !== confirmerFilter) return;
      if (!checkProductMatchLocal(o)) return;

      const isShipped = !!o.shippingTrackingId || ['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع'].includes(o.status2 || '');
      if (!isShipped) return;

      const realStatus = (o.isExchangedReturn ? 'مستلم' : mapStatusToStatus2(o.status2 || '', o));
      if (o.status1 === 'ملغى' || realStatus === 'ملغى' || realStatus === 'ملغاة' || realStatus === 'إلغاء') return;
      
      const isStatusExpected = realStatus !== 'مستلم' && realStatus !== 'مرتجع' && (o.status1 === 'مؤكد' || realStatus === 'تم الشحن' || realStatus === 'في الطريق');

      // Shipped Count (based on order date)
      if (o.orderDate) {
        const oDate = parseISO(o.orderDate);
        const qty = Number(o.qnts) || 1;
        if (oDate >= mStart && oDate <= eDay) mShippedCount += qty;
        if (oDate >= wStart && oDate <= eDay) wShippedCount += qty;
        if (oDate >= tStart && oDate <= eDay) tShippedCount += qty;
      }

      const { totalCogs, extCost } = getOrderCosts(o);

      if (realStatus === 'مستلم') {
        const dDate = getDeliveryDate(o);
        if (!dDate) return;
        const rev = Number(o.totalCharge) || 0;
        const shp = getEffectiveShippingCost(o, settings);
        const effectiveExtCost = productFilter !== 'all' ? 0 : extCost;
        const margin = rev - shp - totalCogs - effectiveExtCost;
        const qty = Number(o.qnts) || 1;

        if (dDate >= mStart && dDate <= eDay) { mProfit += margin; mOrders.push(o); mDeliveredCount += qty; }
        if (dDate >= wStart && dDate <= eDay) { wProfit += margin; wOrders.push(o); wDeliveredCount += qty; }
        if (dDate >= tStart && dDate <= eDay) { tProfit += margin; tOrders.push(o); tDeliveredCount += qty; }
      } 
      else if (realStatus === 'مرتجع') {
        const rDate = getReturnDate(o);
        if (!rDate) return;
        
        // When in monthly subscription mode, return fees are handled as fixed monthly store subscription; otherwise per-order return cost applies
        const effectiveRCost = isMonthlySub ? 0 : ((o.customReturnCost !== undefined ? o.customReturnCost : rCost) + extCost);
        const qty = Number(o.qnts) || 1;

        if (rDate >= mStart && rDate <= eDay) { mProfit -= effectiveRCost; mOrders.push(o); mReturnedCount += qty; }
        if (rDate >= wStart && rDate <= eDay) { wProfit -= effectiveRCost; wOrders.push(o); wReturnedCount += qty; }
        if (rDate >= tStart && rDate <= eDay) { tProfit -= effectiveRCost; tOrders.push(o); tReturnedCount += qty; }
      }
    });

    const isProdFiltered = productFilter !== 'all';
    const finalExT = isProdFiltered ? 0 : exT;
    const finalExW = isProdFiltered ? 0 : exW;
    const finalExM = isProdFiltered ? 0 : exM;
    const mSubDeduction = (!isProdFiltered && isMonthlySub) ? monthlySubAmount : 0;
    const wSubDeduction = (!isProdFiltered && isMonthlySub) ? Math.round((7 / 30) * monthlySubAmount) : 0;
    const tSubDeduction = (!isProdFiltered && isMonthlySub) ? Math.round(monthlySubAmount / 30) : 0;

    return { 
        tProfit: tProfit - finalExT - adT - tSubDeduction, 
        wProfit: wProfit - finalExW - adW - wSubDeduction, 
        mProfit: mProfit - finalExM - adM - mSubDeduction,
        tOrders,
        wOrders,
        mOrders,
        tShippedCount, wShippedCount, mShippedCount,
        tDeliveredCount, wDeliveredCount, mDeliveredCount,
        tReturnedCount, wReturnedCount, mReturnedCount
    };
  }, [orders, settings, expenses, campaignRecords, confirmerFilter, productFilter, inventoryProducts]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (confirmerFilter !== 'all' && o.confirmedBy !== confirmerFilter) return false;
      if (!checkProductMatchLocal(o)) return false;
      
      const isShipped = !!o.shippingTrackingId || ['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع'].includes(o.status2 || '');
      if (!isShipped) return false;

      const realStatus = (o.isExchangedReturn ? 'مستلم' : mapStatusToStatus2(o.status2 || '', o));
      if (o.status1 === 'ملغى' || realStatus === 'ملغى' || realStatus === 'ملغاة' || realStatus === 'إلغاء') return false;
      
      const isStatusExpected = realStatus !== 'مستلم' && realStatus !== 'مرتجع' && (o.status1 === 'مؤكد' || realStatus === 'تم الشحن' || realStatus === 'في الطريق');
      if (!isStatusExpected && realStatus !== 'مستلم' && realStatus !== 'مرتجع') {
          return false;
      }
      
      const oDate = safeParseDate(o.orderDate);
      let targetDate = oDate;
      if (realStatus === 'مستلم') {
        const dDate = getDeliveryDate(o);
        if (dDate) targetDate = dDate;
      } else if (realStatus === 'مرتجع') {
        const rDate = getReturnDate(o);
        if (rDate) targetDate = rDate;
      }
      return dateFilter === 'all' || (targetDate && safeIsWithinInterval(targetDate, { start, end }));
    }).sort((a,b) => new Date(b.orderDate as string).getTime() - new Date(a.orderDate as string).getTime());
  }, [orders, confirmerFilter, productFilter, dateFilter, start, end]);

  // Compute all orders with zero or negative profit (فائدة ≤ 0)
  const zeroOrNegativeOrders = useMemo(() => {
    return filteredOrders.map(o => {
      const { totalCogs, extCost } = getOrderCosts(o);
      const realStatus = (o.isExchangedReturn ? 'مستلم' : mapStatusToStatus2(o.status2 || '', o));
      const rev = Number(o.totalCharge) || 0;
      const customerShp = Number(o.deliveryPrice) || 0;
      const realShp = getEffectiveShippingCost(o, settings);
      
      const isReturned = realStatus === 'مرتجع';
      const isDelivered = realStatus === 'مستلم';
      
      const rawReturnCost = isMonthlySub ? 0 : (o.customReturnCost !== undefined ? o.customReturnCost : (settings?.returnCost || 400));
      const returnCostToUse = isMonthlySub ? 0 : rawReturnCost;

      let netProfit = 0;
      let statusType = 'معلقة';
      let lossReason = '';

      if (isDelivered) {
        statusType = 'مستلمة';
        netProfit = rev - realShp - totalCogs - extCost;
        if (netProfit < 0) {
          lossReason = 'تكلفة البضاعة والتوصيل تتجاوز سعر التحصيل الفعلي';
        } else if (netProfit === 0) {
          lossReason = 'سعر التحصيل يغطي التكاليف فقط دون أي هامش ربح (0 د.ج)';
        }
      } else if (isReturned) {
        statusType = 'مرتجع';
        netProfit = isMonthlySub ? 0 : (-returnCostToUse - extCost);
        lossReason = isMonthlySub 
          ? 'طرد مرتجع (تكلفة المرتجع مشمولة بالاشتراك الشهري الثابت)' 
          : `طرد مرتجع (تكلفة الإرجاع ${formatCurrency(returnCostToUse)} د.ج)`;
      } else {
        statusType = 'معلقة / في الطريق';
        netProfit = rev - realShp - totalCogs - extCost;
        if (netProfit < 0) {
          lossReason = 'صافي الربح المتوقع سالب (التكلفة أعلى من سعر البيع)';
        } else if (netProfit === 0) {
          lossReason = 'صافي الربح المتوقع صفر (0 د.ج)';
        }
      }

      return {
        order: o,
        realStatus,
        statusType,
        rev,
        customerShp,
        realShp,
        totalCogs,
        extCost,
        returnCostToUse,
        netProfit,
        lossReason,
        isZero: Math.round(netProfit) === 0,
        isNegative: netProfit < 0
      };
    }).filter(item => item.netProfit <= 0);
  }, [filteredOrders, settings, inventoryProducts, isMonthlySub]);

  // Export Financial Orders to Excel (.xlsx)
  const handleExportOrders = (ordersToExport?: any[], customLabel?: string) => {
    const targetOrders = ordersToExport && ordersToExport.length > 0 ? ordersToExport : filteredOrders;
    if (!targetOrders || targetOrders.length === 0) {
      toast.error('لا توجد أي طلبيات تطابق الفلترة الحالية لتصديرها');
      return;
    }

    try {
      const dateLabel = dateFilter === 'today' ? 'اليوم'
        : dateFilter === 'yesterday' ? 'الأمس'
        : dateFilter === 'week' ? 'هذا_الأسبوع'
        : dateFilter === 'month' ? 'هذا_الشهر'
        : dateFilter === 'custom' ? `فترة_${customStart || 'بداية'}_إلى_${customEnd || 'نهاية'}`
        : 'كل_الفترات';
      
      let prodName = 'كل_المنتجات';
      if (productFilter !== 'all') {
        if (productFilter.startsWith('P::')) {
          const sku = productFilter.substring(3);
          const p = inventoryProducts.find(x => x.sku === sku);
          prodName = p?.name || sku;
        } else if (productFilter.startsWith('V::')) {
          const vSku = productFilter.substring(3);
          prodName = vSku;
        } else {
          prodName = productFilter;
        }
      }

      const filterDesc = customLabel || `${dateLabel} | منتج: ${prodName}${confirmerFilter !== 'all' ? ` | مؤكد: ${confirmerFilter}` : ''}`;
      
      const { fileName, count } = exportFinanceOrdersToExcel({
        orders: targetOrders,
        inventoryProducts,
        settings,
        filterLabel: filterDesc,
        fileNamePrefix: `طلبيات_المالية_${dateLabel}`,
        mapStatusFn: mapStatusToStatus2,
        getOrderCostsFn: getOrderCosts,
        getEffectiveShippingCostFn: getEffectiveShippingCost,
        getDeliveryDateFn: getDeliveryDate
      });

      toast.success(`تم تصدير ${count} طلبية بنجاح إلى ملف Excel (${fileName})`, { duration: 4000 });
    } catch (err: any) {
      console.error('Export Error:', err);
      toast.error(err.message || 'حدث خطأ أثناء تصدير ملف Excel');
    }
  };

  // PERIOD CALCULATION based on `start` and `end` filter
  const createCalc = (periodStart: Date | null, periodEnd: Date | null) => {
    return createFinanceCalculator(
      orders,
      expenses,
      campaigns,
      campaignRecords,
      settings,
      inventoryProducts,
      dateFilter,
      periodStart,
      periodEnd,
      productFilter,
      confirmerFilter
    );
  };

  const calc = useMemo(() => createCalc(start, end), [orders, settings, expenses, campaigns, campaignRecords, start, end, dateFilter, confirmerFilter, productFilter, inventoryProducts]);
  
  const prevCalc = useMemo(() => {
    if (!comparePeriod || !compareStart || !compareEnd) return null;
    return createCalc(compareStart, compareEnd);
  }, [orders, settings, expenses, campaigns, campaignRecords, compareStart, compareEnd, dateFilter, confirmerFilter, productFilter, inventoryProducts, comparePeriod]);

  const calcTrend = (curr: number, prev: number | undefined) => {
    if (!comparePeriod || prev === undefined) return null;
    if (prev === 0) return curr > 0 ? { value: '+100%', up: true } : { value: '0%', up: true };
    const diff = ((curr - prev) / prev) * 100;
    return { value: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`, up: diff >= 0 };
  };

  const chartData = useMemo(() => {
    let effectiveStart = start;
    let effectiveEnd = end;
    
    if (dateFilter === 'all') {
      const allDates = [
        ...orders.map(o => o.orderDate),
        ...expenses.map(e => e.date),
        ...campaignRecords.map(c => c.date)
      ].filter(Boolean).map(d => parseISO(d as string).getTime());
      
      if (allDates.length > 0) {
        effectiveStart = new Date(Math.min(...allDates));
        effectiveEnd = new Date(Math.max(...allDates));
      } else {
        effectiveStart = startOfMonth(new Date());
        effectiveEnd = endOfMonth(new Date());
      }
    }
    
    // Safety check just in case range is huge (limit to 365 days max for daily chart rendering)
    if ((effectiveEnd.getTime() - effectiveStart.getTime()) > 365 * 24 * 60 * 60 * 1000) {
       effectiveStart = new Date(effectiveEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    const days = eachDayOfInterval({ start: startOfDay(effectiveStart), end: endOfDay(effectiveEnd) });
    const rCost = settings?.returnCost || 400;
    const exRate = settings?.exchangeRate || 245;

    // 1. Group daily expenses ONCE: O(Expenses)
    const expensesByDay = new Map<string, number>();
    expenses.forEach(e => {
      if (!e.date) return;
      const dStr = e.date.substring(0, 10);
      expensesByDay.set(dStr, (expensesByDay.get(dStr) || 0) + (Number(e.amount) || 0));
    });

    // 2. Pre-aggregate campaign daily spend ONCE: O(Campaigns + Records)
    const campaignSpendByDay = new Map<string, number>();
    const matchingCampaigns = campaigns.filter(camp => isCampaignMatchedToProduct(camp, productFilter, inventoryProducts));
    
    matchingCampaigns.forEach(camp => {
      const campStart = startOfDay(parseISO(camp.createdAt));
      const campEnd = camp.archivedAt ? endOfDay(parseISO(camp.archivedAt)) : endOfDay(new Date());
      const records = campaignRecords.filter(r => r.campaignId === camp.id);
      
      const recordedDays = new Set<string>();
      records.forEach(r => {
        if (r.date) {
          const dStr = r.date.substring(0, 10);
          recordedDays.add(dStr);
          campaignSpendByDay.set(dStr, (campaignSpendByDay.get(dStr) || 0) + (Number(r.spend) || 0));
        }
      });

      if (camp.baseDailyBudget) {
        days.forEach(day => {
          const dStr = format(day, 'yyyy-MM-dd');
          if (!recordedDays.has(dStr) && day >= campStart && day <= campEnd) {
            campaignSpendByDay.set(dStr, (campaignSpendByDay.get(dStr) || 0) + camp.baseDailyBudget);
          }
        });
      }
    });

    // 3. Pre-aggregate orders by dates in a single pass: O(Orders)
    interface DayOrderStats {
      expRev: number;
      expCogs: number;
      expShip: number;
      expExtCost: number;
      realRev: number;
      realCogs: number;
      realShip: number;
      realExtCost: number;
      retCostDay: number;
      delivCountDay: number;
    }
    const dayStatsMap = new Map<string, DayOrderStats>();
    const getDayStats = (key: string): DayOrderStats => {
      let st = dayStatsMap.get(key);
      if (!st) {
        st = {
          expRev: 0, expCogs: 0, expShip: 0, expExtCost: 0,
          realRev: 0, realCogs: 0, realShip: 0, realExtCost: 0,
          retCostDay: 0, delivCountDay: 0
        };
        dayStatsMap.set(key, st);
      }
      return st;
    };

    orders.forEach(o => {
      if (confirmerFilter !== 'all' && o.confirmedBy !== confirmerFilter) return;
      if (!checkProductMatchLocal(o)) return;

      const isShipped = !!o.shippingTrackingId || ['تم الشحن', 'في الطريق', 'مستلم', 'مرتجع'].includes(o.status2 || '');
      if (!isShipped) return;

      const realStatus = (o.isExchangedReturn ? 'مستلم' : mapStatusToStatus2(o.status2 || '', o));
      if (o.status1 === 'ملغى' || realStatus === 'ملغى' || realStatus === 'ملغاة' || realStatus === 'إلغاء') return;

      const { totalCogs, extCost } = getOrderCosts(o);
      const shp = getEffectiveShippingCost(o, settings);
      const rev = Number(o.totalCharge) || 0;

      const shipDate = getShippingDate(o);
      const dDate = getDeliveryDate(o);
      const rDate = getReturnDate(o);

      if (shipDate) {
        const sKey = format(shipDate, 'yyyy-MM-dd');
        const st = getDayStats(sKey);
        st.expRev += rev;
        st.expCogs += totalCogs;
        st.expShip += shp;
        st.expExtCost += extCost;
      }

      if (realStatus === 'مستلم' && dDate) {
        const dKey = format(dDate, 'yyyy-MM-dd');
        const st = getDayStats(dKey);
        st.realRev += rev;
        st.realCogs += totalCogs;
        st.realShip += shp;
        st.realExtCost += extCost;
        st.delivCountDay += (Number(o.qnts) || 1);
      }

      if (realStatus === 'مرتجع' && rDate) {
        if (productFilter === 'all') {
          const rKey = format(rDate, 'yyyy-MM-dd');
          const st = getDayStats(rKey);
          st.retCostDay += (isMonthlySub ? 0 : (o.customReturnCost !== undefined ? o.customReturnCost : rCost)) + extCost;
        }
      }
    });

    let runningCumExpNet = 0;
    let runningCumRealNet = 0;
    let runningCumDelivRev = 0;
    let runningCumDelivNetGross = 0;

    return days.map(day => {
      const formattedDate = format(day, 'yyyy-MM-dd');
      const st = dayStatsMap.get(formattedDate);
      const expRev = st?.expRev || 0;
      const expCogs = st?.expCogs || 0;
      const expShip = st?.expShip || 0;
      const expExtCost = st?.expExtCost || 0;

      const realRev = st?.realRev || 0;
      const realCogs = st?.realCogs || 0;
      const realShip = st?.realShip || 0;
      const realExtCost = st?.realExtCost || 0;
      let retCostDay = st?.retCostDay || 0;
      const delivCountDay = st?.delivCountDay || 0;

      const dayAdSpendUSD = campaignSpendByDay.get(formattedDate) || 0;
      const dayAdSpendDZD = dayAdSpendUSD * exRate;
      const dayExtraExp = expensesByDay.get(formattedDate) || 0;

      if (productFilter === 'all' && isMonthlySub && monthlySubAmount > 0) {
        retCostDay += Math.round(monthlySubAmount / 30);
      }

      const dayEffectiveExtraExp = productFilter !== 'all' ? 0 : dayExtraExp;
      const dayExpGross = expRev - expCogs - expShip - (productFilter !== 'all' ? 0 : expExtCost);
      const dayExpNetWithExpenses = dayExpGross - dayAdSpendDZD - dayEffectiveExtraExp;
      
      const dayRealGross = realRev - realCogs - realShip - (productFilter !== 'all' ? 0 : realExtCost);
      const dayRealNetWithExpenses = dayRealGross - retCostDay - dayAdSpendDZD - dayEffectiveExtraExp;

      runningCumExpNet += dayExpNetWithExpenses;
      runningCumRealNet += dayRealNetWithExpenses;
      runningCumDelivRev += realRev;
      runningCumDelivNetGross += dayRealGross;

      const dailyLoss = dayExpNetWithExpenses - dayRealNetWithExpenses;

      return {
         date: format(day, 'MMM dd'),
         fullDate: formattedDate,
         // Chart 1
         'صافي الأرباح المتوقعة': Math.round(dayExpNetWithExpenses),
         'صافي الأرباح الحقيقية': Math.round(dayRealNetWithExpenses),
         'نمو الأرباح المتوقعة التراكمية': Math.round(runningCumExpNet),
         'نمو الأرباح الحقيقية التراكمية': Math.round(runningCumRealNet),
         'المصاريف (إعلانات وأخرى)': Math.round(dayAdSpendDZD + dayExtraExp),

         // Chart 2 (Net Revenues on Delivery)
         'صافي المداخيل اليومية': Math.round(dayRealGross),
         'تراكمي صافي المداخيل عند الاستلام': Math.round(runningCumDelivNetGross),
         'إجمالي المداخيل اليومية': Math.round(realRev),
         'المداخيل التراكمية عند الاستلام': Math.round(runningCumDelivRev),
         'عدد الطلبيات المستلمة': delivCountDay,

         // Legacy fields for Loss Chart
         'صافي المتوقع مع المصاريف': Math.round(dayExpNetWithExpenses),
         'صافي الحقيقي مع المصاريف': Math.round(dayRealNetWithExpenses),
         'الخسارة اليومية': Math.round(dailyLoss)
      };
    });
  }, [orders, settings, expenses, campaignRecords, campaigns, start, end, dateFilter, confirmerFilter, productFilter, inventoryProducts, isMonthlySub, monthlySubAmount, orderCostsMap]);

  const chartTotals = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { totalExpNet: 0, totalRealNet: 0, totalDelivRev: 0, totalDelivNetGross: 0, totalDelivCount: 0, avgDailyRev: 0, avgDailyNetGross: 0, realizationRate: 0 };
    }
    const lastDay = chartData[chartData.length - 1];
    const totalDelivRev = lastDay['المداخيل التراكمية عند الاستلام'] || 0;
    const totalDelivNetGross = lastDay['تراكمي صافي المداخيل عند الاستلام'] || 0;
    const totalExpNet = lastDay['نمو الأرباح المتوقعة التراكمية'] || 0;
    const totalRealNet = lastDay['نمو الأرباح الحقيقية التراكمية'] || 0;
    const totalDelivCount = chartData.reduce((sum, d) => sum + (d['عدد الطلبيات المستلمة'] || 0), 0);
    
    return {
      totalExpNet,
      totalRealNet,
      totalDelivRev,
      totalDelivNetGross,
      totalDelivCount,
      avgDailyRev: Math.round(totalDelivRev / (chartData.length || 1)),
      avgDailyNetGross: Math.round(totalDelivNetGross / (chartData.length || 1)),
      realizationRate: totalExpNet > 0 ? Math.round((totalRealNet / totalExpNet) * 100) : 0
    };
  }, [chartData]);

  const ComparingRow = ({ label, curr, prev, bg = '', textClass = 'text-gray-500', valClass = 'text-gray-700', prefix = '' }: any) => {
     const trend = calcTrend(curr, prev);
     return (
       <div className={`flex justify-between items-center py-2 px-3 ${bg}`}>
         <div className="flex flex-col gap-0.5">
           <span className={`${textClass} font-bold text-xs`}>{label}</span>
           {trend && (
             <span className="text-[9px] text-gray-400 font-bold">السابق: {prefix}{formatCurrency(prev)} د.ج</span>
           )}
         </div>
         <div className="flex items-center gap-3">
           {trend && (
             <span dir="ltr" className={`text-[10px] font-black px-1.5 py-0.5 rounded ${trend.up ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}`}>
               {trend.value}
             </span>
           )}
           <span className={`font-bold ${valClass}`}>{prefix}{formatCurrency(curr)} د.ج</span>
         </div>
       </div>
     );
  };

  const uniqueTableProducts = useMemo(() => {
    return Array.from(new Set(filteredOrders.map(o => o.sku || o.productName))).filter(Boolean);
  }, [filteredOrders]);

  const filteredTableOrders = useMemo(() => {
    const q = tableSearchQuery.trim().toLowerCase();

    return filteredOrders.filter((o: any) => {
      if (tableProductFilter !== 'all') {
        if (o.sku !== tableProductFilter && o.productName !== tableProductFilter) return false;
      }
      if (tableStatusFilter !== 'all') {
        const realStatus = (o.isExchangedReturn ? 'مستلم' : mapStatusToStatus2(o.status2 || '', o));
        const isDelivered = realStatus === 'مستلم';
        const isReturned = realStatus === 'مرتجع';
        const isPending = !isDelivered && !isReturned;
        
        if (tableStatusFilter === 'مستلمة' && !isDelivered) return false;
        if (tableStatusFilter === 'مرتجع' && !isReturned) return false;
        if (tableStatusFilter === 'معلقة' && !isPending) return false;
      }
      if (q) {
        const orderId = String(o.orderId || o.id || '').toLowerCase();
        const tracking = String(o.shippingTrackingId || '').toLowerCase();
        const name = String(o.fullName || '').toLowerCase();
        const phone = String(o.phone || '').toLowerCase();
        const prod = String(o.productName || '').toLowerCase();
        const variation = String(o.variation || o.variationName || '').toLowerCase();
        const wilaya = String(o.region || o.city || '').toLowerCase();
        const deliveryCompany = String(o.deliveryCompany || '').toLowerCase();
        const confirmer = String(o.confirmedBy || '').toLowerCase();

        if (
          !orderId.includes(q) &&
          !tracking.includes(q) &&
          !name.includes(q) &&
          !phone.includes(q) &&
          !prod.includes(q) &&
          !variation.includes(q) &&
          !wilaya.includes(q) &&
          !deliveryCompany.includes(q) &&
          !confirmer.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [filteredOrders, tableProductFilter, tableStatusFilter, tableSearchQuery]);

  const isTableProdFiltered = tableProductFilter !== 'all' || productFilter !== 'all';

  const quickTableStats = useMemo(() => {
    let totalNet = 0;
    let totalRev = 0;
    let totalShip = 0;
    let totalCogs = 0;
    let totalExtAndReturn = 0;
    let deliveredCount = 0;
    let returnedCount = 0;
    let pendingCount = 0;

    filteredTableOrders.forEach((o: any) => {
      const { totalCogs: cogs, extCost } = getOrderCosts(o);
      const realStatus = (o.isExchangedReturn ? 'مستلم' : mapStatusToStatus2(o.status2 || '', o));
      const rev = Number(o.totalCharge) || 0;
      const realShp = getEffectiveShippingCost(o, settings);
      const isReturned = realStatus === 'مرتجع';
      const isDelivered = realStatus === 'مستلم';
      
      const effectiveOrderExtCost = isTableProdFiltered ? 0 : extCost;
      const rawReturnCost = isMonthlySub ? 0 : (o.customReturnCost !== undefined ? o.customReturnCost : (settings?.returnCost || 400));
      const returnCostToUse = isTableProdFiltered ? 0 : rawReturnCost;

      if (isDelivered) {
        deliveredCount++;
        totalRev += rev;
        totalShip += realShp;
        totalCogs += cogs;
        totalExtAndReturn += effectiveOrderExtCost;
        totalNet += (rev - realShp - cogs - effectiveOrderExtCost);
      } else if (isReturned) {
        returnedCount++;
        const effectiveReturnDeduction = isMonthlySub ? 0 : (returnCostToUse + effectiveOrderExtCost);
        totalExtAndReturn += effectiveReturnDeduction;
        totalNet -= effectiveReturnDeduction;
      } else {
        pendingCount++;
        totalRev += rev;
        totalShip += realShp;
        totalCogs += cogs;
        totalExtAndReturn += effectiveOrderExtCost;
        totalNet += (rev - realShp - cogs - effectiveOrderExtCost);
      }
    });

    return {
      totalNet,
      totalRev,
      totalShip,
      totalCogs,
      totalExtAndReturn,
      deliveredCount,
      returnedCount,
      pendingCount
    };
  }, [filteredTableOrders, isTableProdFiltered, isMonthlySub, settings, orderCostsMap]);

  const paginatedTableOrders = useMemo(() => {
    return filteredTableOrders.slice(
      (tablePage - 1) * tablePageSize,
      tablePage * tablePageSize
    );
  }, [filteredTableOrders, tablePage, tablePageSize]);

  const tableTotalPages = Math.ceil(filteredTableOrders.length / tablePageSize) || 1;

  return (
    <div className="p-4 md:p-8 space-y-8 bg-gray-50/50 min-h-screen" dir="rtl">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <Banknote className="w-8 h-8 text-emerald-600" />
            المالية والمحاسبة الذكية
          </h2>
          <p className="text-gray-500 mt-2 font-medium">لوحة تحكم احترافية لتتبع الإيرادات، والمصاريف، والأرباح الصافية بدقة متناهية.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-200/60">
          <div className="flex items-center gap-2 px-3 border-l border-gray-100">
            <Package className="w-4 h-4 text-emerald-500" />
            <select 
              value={productFilter} 
              onChange={(e) => {
                setProductFilter(e.target.value);
                setGlobalProductFilter(e.target.value);
              }}
              className="bg-transparent text-sm font-bold text-gray-700 border-none focus:ring-0 cursor-pointer outline-none w-36 truncate"
            >
              <option value="all">كل المنتجات</option>
              {productFilterOptionsJSX}
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 border-l border-gray-100">
            <User className="w-4 h-4 text-blue-500" />
            <select 
              value={confirmerFilter} 
              onChange={(e) => setConfirmerFilter(e.target.value)}
              className="bg-transparent text-sm font-bold text-gray-700 border-none focus:ring-0 cursor-pointer outline-none w-28 truncate"
            >
              <option value="all">كل المؤكدين</option>
              {uniqueConfirmers.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 px-3">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="bg-transparent text-sm font-bold text-gray-700 border-none focus:ring-0 cursor-pointer outline-none"
            >
              <option value="today">اليوم</option>
              <option value="yesterday">الأمس</option>
              <option value="week">هذا الأسبوع</option>
              <option value="month">هذا الشهر</option>
              <option value="all">كل الفترات (إجمالي)</option>
              <option value="custom">فترة مخصصة</option>
            </select>
          </div>
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 px-4 py-1 border-r border-gray-100">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400 transition-colors" />
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400 transition-colors" />
            </div>
          )}
          {dateFilter !== 'all' && (
            <div className="flex items-center gap-2 px-4 py-1 border-r border-gray-100 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={comparePeriod} 
                  onChange={(e) => setComparePeriod(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-bold text-gray-700">مقارنة</span>
              </label>

              {comparePeriod && (
                <div className="flex items-center gap-2">
                  <select 
                    value={compareType} 
                    onChange={(e) => setCompareType(e.target.value as any)}
                    className="bg-gray-50 text-[10px] sm:text-xs font-bold text-gray-700 border border-gray-200 focus:ring-0 cursor-pointer outline-none rounded py-1 pl-1 pr-6"
                  >
                    <option value="auto">تلقائي</option>
                    <option value="custom">مخصص</option>
                  </select>
                  
                  {compareType === 'custom' && (
                    <div className="flex items-center gap-1">
                      <input 
                        type="date" 
                        value={compareCustomStart} 
                        onChange={(e) => setCompareCustomStart(e.target.value)} 
                        className="text-[10px] sm:text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none font-medium" 
                      />
                      <span className="text-gray-400">-</span>
                      <input 
                        type="date" 
                        value={compareCustomEnd} 
                        onChange={(e) => setCompareCustomEnd(e.target.value)} 
                        className="text-[10px] sm:text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none font-medium" 
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mr-auto flex-wrap">
            <button
              onClick={() => setShowAdvancedExportModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs hover:shadow-emerald-200/50 cursor-pointer border border-emerald-500"
              title="تصدير متقدم Excel: فلاتر متعددة، تجميع الموديلات والأنواع، تحكم بالأعمدة والتواريخ"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تصدير متقدم Excel</span>
            </button>

            <button
              onClick={() => handleExportOrders(filteredOrders)}
              disabled={filteredOrders.length === 0}
              className="hidden sm:flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl text-xs font-bold transition-all border border-emerald-200 cursor-pointer disabled:opacity-50"
              title={`تصدير سريع لـ ${filteredOrders.length} طلبية معروضة حالياً`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير سريع ({filteredOrders.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Finance Section Navigation Bar (Tabs for Performance & Organization) */}
      <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-gray-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFinanceActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              financeActiveTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>🌟</span>
            <span>عرض شامل (كل الأقسام)</span>
          </button>

          <button
            type="button"
            onClick={() => setFinanceActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              financeActiveTab === 'overview'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>📊</span>
            <span>المؤشرات والرسوم البيانية</span>
          </button>

          <button
            type="button"
            onClick={() => setFinanceActiveTab('table')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              financeActiveTab === 'table'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>📋</span>
            <span>جدول الطلبيات المالية</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              financeActiveTab === 'table' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {filteredTableOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFinanceActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              financeActiveTab === 'settings'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>⚙️</span>
            <span>إعدادات المحاسبة والمصاريف</span>
          </button>
        </div>

        {/* Quick Toggle for Charts inside 'all' or 'overview' */}
        {(financeActiveTab === 'all' || financeActiveTab === 'overview') && (
          <div className="flex items-center gap-2 mr-auto">
            <button
              type="button"
              onClick={() => setActiveChartTab(prev => prev === 'hidden' ? 'all' : 'hidden')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border ${
                activeChartTab === 'hidden'
                  ? 'bg-amber-50 border-amber-200 text-amber-900 shadow-2xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title={activeChartTab === 'hidden' ? 'إظهار الرسوم البيانية' : 'إخفاء الرسوم البيانية لتسريع الواجهة وتوفير الذاكرة'}
            >
              <span>{activeChartTab === 'hidden' ? '📈 إظهار المنحنيات' : '⚡ إخفاء المنحنيات (تسريع الواجهة)'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Return Cost Mode Quick Control Banner */}
      <div className={`p-5 rounded-3xl border transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 shadow-xs ${
        isMonthlySub 
          ? 'bg-gradient-to-r from-indigo-50/90 via-indigo-50/60 to-purple-50/70 border-indigo-200' 
          : 'bg-white border-gray-200/80'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-xs shrink-0 ${
            isMonthlySub ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            {isMonthlySub ? '📅' : '📦'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-gray-600">طريقة احتساب مصاريف المرتجع الحالية:</span>
              <span className={`text-xs font-black px-3 py-1 rounded-full ${
                isMonthlySub 
                  ? 'bg-indigo-600 text-white shadow-2xs' 
                  : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}>
                {isMonthlySub 
                  ? `اشتراك شهري ثابت (${formatCurrency(monthlySubAmount)} د.ج / شهر)` 
                  : `دفع لكل طلبية مرتجعة (${formatCurrency(settings?.returnCost || 400)} د.ج / طلبية)`}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              {isMonthlySub 
                ? `✨ وضع الاشتراك الشهري مُفعل: يتم احتساب ${formatCurrency(monthlySubAmount)} د.ج لكل شهر في جميع الفترات والحسابات السابقة والحالية، دون خصم أي تكلفة فردية لكل طلبية مرتجعة.` 
                : `📦 وضع الدفع بالطلبية مُفعل: يتم خصم ${formatCurrency(settings?.returnCost || 400)} د.ج عن كل طرد مرتجع تسجله شركة التوصيل.`}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap self-stretch lg:self-auto justify-end">
          {isMonthlySub && (
            <div className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-xl border border-indigo-200 shadow-2xs">
              <span className="text-xs font-bold text-indigo-900">قيمة الاشتراك:</span>
              <input
                type="number"
                value={returnMonthlySubInput}
                onChange={(e) => setReturnMonthlySubInput(e.target.value)}
                onBlur={async () => {
                  const val = Number(returnMonthlySubInput) || 0;
                  await updateSettings({ returnMonthlySubscription: val });
                  toast.success(`تم تحديث قيمة الاشتراك الشهري: ${formatCurrency(val)} د.ج`);
                }}
                className="w-24 text-xs font-black text-indigo-950 border border-indigo-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center bg-indigo-50/40"
                placeholder="5000"
              />
              <span className="text-[11px] font-bold text-gray-500">د.ج/شهر</span>
            </div>
          )}

          {/* Direct Switch Button */}
          <button
            type="button"
            onClick={async () => {
              const newMode = isMonthlySub ? 'per_order' : 'monthly_subscription';
              setReturnCostModeInput(newMode);
              await updateSettings({
                returnCostMode: newMode,
                returnMonthlySubscription: Number(returnMonthlySubInput) || (settings?.returnMonthlySubscription || 0),
                returnCost: Number(returnCostInput) || (settings?.returnCost || 400)
              });
              toast.success(newMode === 'monthly_subscription' 
                ? 'تم التبديل إلى نظام الاشتراك الشهري للمرتجع بنجاح!' 
                : 'تم التبديل إلى نظام الدفع لكل طلبية مرتجعة!');
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
              isMonthlySub 
                ? 'bg-amber-600 hover:bg-amber-700 active:scale-95 text-white' 
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-indigo-200'
            }`}
          >
            <span>🔄</span>
            <span>{isMonthlySub ? 'التبديل إلى دفع لكل طلبية' : 'التبديل إلى اشتراك شهري للمرتجع'}</span>
          </button>

          {/* Quick Settings link */}
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('accounting-settings-section');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
                el.classList.add('ring-4', 'ring-indigo-400');
                setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-400'), 2500);
              }
            }}
            className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="الانتقال لبطاقة إعدادات المحاسبة وتكاليف المرتجع الكاملة"
          >
            <span>⚙️</span>
            <span>تخصيص الإعدادات</span>
          </button>
        </div>
      </div>

      {/* Zero or Negative Profit Alert Banner */}
      {zeroOrNegativeOrders.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200 rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-600/10 border border-rose-200 flex items-center justify-center text-rose-600 shadow-2xs shrink-0">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-rose-950">
                  تنبيه مالي: يوجد {zeroOrNegativeOrders.length} طلبية ذات فائدة 0 أو أقل (خاسرة أو بدون ربح)
                </h4>
                <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  فائدة ≤ 0
                </span>
              </div>
              <p className="text-xs text-rose-800/80 mt-1 leading-relaxed">
                تم رصد طلبيات مرتجعة أو تجاوزت فيها تكاليف البضاعة والتوصيل سعر البيع. اضغط على الزر لمعاينة جميع هذه الطلبيات وفحص تفاصيل كل طلبية بالكامل.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowZeroOrNegativeModal(true)}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-rose-600/20 cursor-pointer flex items-center gap-2 shrink-0 mr-auto lg:mr-0"
          >
            <Eye size={15} />
            <span>فتح نافذة الطلبيات (فائدة ≤ 0)</span>
            <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
              {zeroOrNegativeOrders.length}
            </span>
          </button>
        </div>
      )}

      {/* Overview KPIs and Profits Section */}
      {(financeActiveTab === 'all' || financeActiveTab === 'overview') && (
        <>
          {/* Quick Cash Flow Stats */}
          <h3 className="text-lg font-black text-gray-800 pr-2">ملخص التدفق النقدي والأرباح الحقيقية</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2 mb-6">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-emerald-100 hover:shadow-md transition-shadow flex flex-col gap-3 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-125 transition-transform"></div>
          <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-widest">
            <span className="flex items-center gap-2">أرباح اليوم <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full">صافي</span></span>
            <button onClick={() => setInfoModalOrders({ title: 'طلبيات أرباح اليوم', orders: cashFlowStats.tOrders })} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><Info className="w-4 h-4 text-gray-400 hover:text-emerald-600" /></button>
          </div>
          <p className={`text-2xl font-black tracking-tight ${cashFlowStats.tProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {cashFlowStats.tProfit >= 0 ? '+' : ''}{formatCurrency(cashFlowStats.tProfit)} <span className="text-sm font-bold opacity-80">د.ج</span>
          </p>
        </div>
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-emerald-100 hover:shadow-md transition-shadow flex flex-col gap-3 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-125 transition-transform"></div>
          <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-widest">
            <span className="flex items-center gap-2">أرباح الأسبوع <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full">صافي</span></span>
            <button onClick={() => setInfoModalOrders({ title: 'طلبيات أرباح الأسبوع', orders: cashFlowStats.wOrders })} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><Info className="w-4 h-4 text-gray-400 hover:text-emerald-600" /></button>
          </div>
          <p className={`text-2xl font-black tracking-tight ${cashFlowStats.wProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {cashFlowStats.wProfit >= 0 ? '+' : ''}{formatCurrency(cashFlowStats.wProfit)} <span className="text-sm font-bold opacity-80">د.ج</span>
          </p>
        </div>
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-emerald-100 hover:shadow-md transition-shadow flex flex-col gap-3 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-125 transition-transform"></div>
          <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-widest">
            <span className="flex items-center gap-2">أرباح الشهر <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full">صافي</span></span>
            <button onClick={() => setInfoModalOrders({ title: 'طلبيات أرباح الشهر', orders: cashFlowStats.mOrders })} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><Info className="w-4 h-4 text-gray-400 hover:text-emerald-600" /></button>
          </div>
          <p className={`text-2xl font-black tracking-tight ${cashFlowStats.mProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {cashFlowStats.mProfit >= 0 ? '+' : ''}{formatCurrency(cashFlowStats.mProfit)} <span className="text-sm font-bold opacity-80">د.ج</span>
          </p>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200/60 mt-8 mb-4">
        <h3 className="text-lg font-black text-gray-800 pr-2">إحصائيات وخلاصات الفترة المحددة ({dateFilter === 'custom' ? 'مخصص' : dateFilter === 'all' ? 'جميع الطلبيات' : dateFilter === 'today' ? 'اليوم' : dateFilter === 'yesterday' ? 'الأمس' : dateFilter === 'week' ? 'هذا الأسبوع' : 'هذا الشهر'})</h3>
      </div>

      {/* Primary Net Profit Cards */}
      {(() => {
        const totalOrdersForPeriod = calc.expectedCount + calc.realCount + calc.returnedCount;
        const expectedPercent = totalOrdersForPeriod > 0 ? Math.round((calc.expectedCount / totalOrdersForPeriod) * 100) : 0;
        const realPercent = totalOrdersForPeriod > 0 ? Math.round((calc.realCount / totalOrdersForPeriod) * 100) : 0;
        
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Expected Net Profit Card */}
            <div className={`relative overflow-hidden rounded-3xl p-6 shadow-lg border transition-transform hover:-translate-y-1 ${calc.expectedNetProfit >= 0 ? 'bg-gradient-to-br from-orange-400 to-orange-600 border-orange-500' : 'bg-gradient-to-br from-red-500 to-rose-700 border-red-600'}`}>
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10 pointer-events-none"></div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                    {calc.expectedNetProfit >= 0 ? <TrendingUp className="w-6 h-6 text-white" /> : <TrendingDown className="w-6 h-6 text-white" />}
                  </div>
                  <div className="flex gap-2">
                    {comparePeriod && prevCalc && (
                      <span dir="ltr" className={`text-[11px] font-black border px-2 py-1 flex justify-center items-center rounded-full shadow-sm backdrop-blur-sm ${calcTrend(calc.expectedNetProfit, prevCalc.expectedNetProfit)?.up ? 'bg-white/20 text-white border-white/40' : 'bg-red-500/50 text-white border-red-400'}`}>
                        {calcTrend(calc.expectedNetProfit, prevCalc.expectedNetProfit)?.value}
                      </span>
                    )}
                    <span className="text-white/90 font-bold text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm shadow-inner transition-colors">
                      صافي الأرباح المتوقعة
                    </span>
                  </div>
                </div>
                <div className="mt-6 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                  <div>
                    <span className="block text-4xl font-black text-white tracking-tight drop-shadow-md">
                      {formatCurrency(calc.expectedNetProfit)} <span className="text-2xl font-bold opacity-80">د.ج</span>
                    </span>
                    {comparePeriod && prevCalc && (
                      <div className="text-white/80 text-[11px] font-bold mt-1 bg-white/10 w-fit px-2 py-0.5 rounded backdrop-blur border border-white/20">
                        سابقاً: {formatCurrency(prevCalc.expectedNetProfit)} د.ج
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-white/90 text-xs font-medium">لكل الطلبيات (مؤكدة، قيد التوصيل) لتاريخ الاختيار</span>
                    </div>
                  </div>
                  <div className="text-right bg-white/10 p-3 rounded-2xl backdrop-blur-sm min-w-[140px] flex flex-col justify-center">
                    <span className="flex items-center justify-between text-xs text-white/90 font-medium mb-1">
                      <span>عدد الطلبيات المفتوحة</span>
                      {totalOrdersForPeriod > 0 && <span className="text-[11px] font-black bg-white/20 px-1.5 py-0.5 rounded-md" dir="ltr">{expectedPercent}%</span>}
                    </span>
                    <span className="block text-xl font-black text-white mt-1">
                      {calc.expectedCount} <span className="text-sm font-normal opacity-80">طلبية</span>
                    </span>
                    {comparePeriod && prevCalc && (
                       <span className="block text-[10px] text-white/70 font-bold mt-1.5 border-t border-white/10 pt-1">
                         سابقاً: {prevCalc.expectedCount} طلبية
                       </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Real Net Profit Card */}
            <div className={`relative overflow-hidden rounded-3xl p-6 shadow-lg border transition-transform hover:-translate-y-1 ${calc.realNetProfit >= 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-700 border-teal-600' : 'bg-gradient-to-br from-rose-500 to-red-700 border-red-600'}`}>
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10 pointer-events-none"></div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                    {calc.realNetProfit >= 0 ? <Banknote className="w-6 h-6 text-white" /> : <TrendingDown className="w-6 h-6 text-white" />}
                  </div>
                  <div className="flex gap-2">
                    {comparePeriod && prevCalc && (
                      <span dir="ltr" className={`text-[11px] font-black border px-2 py-1 flex justify-center items-center rounded-full shadow-sm backdrop-blur-sm ${calcTrend(calc.realNetProfit, prevCalc.realNetProfit)?.up ? 'bg-white/20 text-white border-white/40' : 'bg-red-500/50 text-white border-red-400'}`}>
                        {calcTrend(calc.realNetProfit, prevCalc.realNetProfit)?.value}
                      </span>
                    )}
                    <span className="text-white/90 font-bold text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm shadow-inner transition-colors">
                      صافي الأرباح الحقيقية
                    </span>
                  </div>
                </div>
                <div className="mt-6 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                  <div>
                    <span className="block text-4xl font-black text-white tracking-tight drop-shadow-md">
                      {formatCurrency(calc.realNetProfit)} <span className="text-2xl font-bold opacity-80">د.ج</span>
                    </span>
                    {comparePeriod && prevCalc && (
                      <div className="text-white/80 text-[11px] font-bold mt-1 bg-white/10 w-fit px-2 py-0.5 rounded backdrop-blur border border-white/20">
                        سابقاً: {formatCurrency(prevCalc.realNetProfit)} د.ج
                      </div>
                    )}
                    <div className="flex flex-col gap-3 mt-3">
                      <span className="text-white/90 text-xs font-medium">للطلبيات التي سُلمت فعلياً ضمن تاريخ الاختيار</span>
                      <div className="bg-white/20 p-3 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-2 border border-white/20 shadow-inner">
                        <div className="flex flex-col">
                          <span className="text-white font-bold text-xs">الصافي الإجمالي المتوقع (مستلم + متوقع)</span>
                          <span className="text-white/80 text-[10px]">بعد خصم جميع المصاريف وتكاليف الإعلانات وكل شيء</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xl font-black text-white whitespace-nowrap">{formatCurrency(calc.totalCombinedNetProfit)} د.ج</span>
                          {comparePeriod && prevCalc && (
                            <span className="text-[10px] text-white/80 font-bold border-t border-white/10 pt-0.5 mt-0.5">
                              سابقاً: {formatCurrency(prevCalc.totalCombinedNetProfit)} د.ج
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right bg-white/10 p-3 rounded-2xl backdrop-blur-sm min-w-[140px] flex flex-col justify-center">
                    <span className="flex items-center justify-between text-xs text-white/90 font-medium mb-1">
                      <span>الطلبيات المستلمة</span>
                      {totalOrdersForPeriod > 0 && <span className="text-[11px] font-black bg-white/20 px-1.5 py-0.5 rounded-md" dir="ltr">{realPercent}%</span>}
                    </span>
                    <span className="block text-xl font-black text-white mt-1">
                      {calc.realCount} <span className="text-sm font-normal opacity-80">مستلم</span>
                    </span>
                    {comparePeriod && prevCalc && (
                       <span className="block text-[10px] text-white/70 font-bold mt-1.5 border-t border-white/10 pt-1">
                         سابقاً: {prevCalc.realCount} مستلم
                       </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm font-medium mt-4">
        {/* Expected Breakdown */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 flex flex-col h-full shadow-sm">
          <h4 className="text-sm font-black text-gray-800 mb-5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 block"></span>
             تفصيل العمليات (المتوقعة للطلبيات المفتوحة)
          </h4>
          
          <div className="space-y-3 flex-grow">
            <ComparingRow label="إجمالي المبيعات المؤكدة وقيد الشحن" curr={calc.expectedRev} prev={prevCalc?.expectedRev} bg="bg-gray-50/50 rounded-xl" valClass="text-blue-700" />
            <ComparingRow label="تكلفة البضاعة المفتوحة" curr={calc.expectedCogs} prev={prevCalc?.expectedCogs} prefix="− " />
            <ComparingRow label="مصاريف توصيل متوقعة" curr={calc.expectedShip} prev={prevCalc?.expectedShip} prefix="− " />
            
            <div className="flex justify-between items-center py-2 px-3 bg-gray-100/80 rounded-xl my-2">
              <span className="text-gray-800 font-bold text-xs">صافي الأرباح المتوقعة</span>
              <div className="flex items-center gap-2">
                {comparePeriod && prevCalc && calcTrend(calc.expectedGrossProfit, prevCalc.expectedGrossProfit) && (
                  <span dir="ltr" className={`text-[10px] font-black px-1.5 py-0.5 rounded ${calcTrend(calc.expectedGrossProfit, prevCalc.expectedGrossProfit)?.up ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}`}>
                    {calcTrend(calc.expectedGrossProfit, prevCalc.expectedGrossProfit)?.value}
                  </span>
                )}
                <span className="font-black text-gray-900">{formatCurrency(calc.expectedGrossProfit)} د.ج</span>
              </div>
            </div>
          </div>
        </div>

        {/* Real Breakdown */}
        <div className="bg-white rounded-3xl p-6 border border-emerald-100 flex flex-col h-full shadow-sm">
          <h4 className="text-sm font-black text-emerald-900 mb-5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block"></span>
             تفصيل العمليات (المستلمة والمرتجعة فعلياً)
          </h4>
          
          <div className="space-y-3 flex-grow">
            <ComparingRow label="إجمالي المبيعات المستلمة" curr={calc.realRev} prev={prevCalc?.realRev} bg="bg-emerald-50/50 rounded-xl" textClass="text-emerald-800" valClass="text-emerald-700" />
            <ComparingRow label="تكلفة بضاعة الطلبيات المستلمة" curr={calc.realCogs} prev={prevCalc?.realCogs} valClass="text-emerald-900/70" prefix="− " />
            <ComparingRow label="رسوم التوصيل المقتطعة" curr={calc.realShip} prev={prevCalc?.realShip} valClass="text-emerald-900/70" prefix="− " />
            
            <div className="flex justify-between items-center py-2 px-3 bg-emerald-100/50 rounded-xl my-2">
              <span className="text-emerald-900 font-bold text-xs">إجمالي الأرباح الحقيقية</span>
               <div className="flex items-center gap-2">
                  {comparePeriod && prevCalc && calcTrend(calc.realGrossProfit, prevCalc.realGrossProfit) && (
                    <span dir="ltr" className={`text-[10px] font-black px-1.5 py-0.5 rounded ${calcTrend(calc.realGrossProfit, prevCalc.realGrossProfit)?.up ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}`}>
                      {calcTrend(calc.realGrossProfit, prevCalc.realGrossProfit)?.value}
                    </span>
                  )}
                  <span className="font-black text-emerald-900">{formatCurrency(calc.realGrossProfit)} د.ج</span>
               </div>
            </div>
            
            <ComparingRow label="الإنفاق الإعلاني بالدينار" curr={calc.adSpendDZD} prev={prevCalc?.adSpendDZD} valClass="text-amber-600" prefix="− " />
            <ComparingRow 
              label={
                isMonthlySub 
                  ? `إجمالي مصاريف المرتجع (${calc.returnedCount} مرتجع - اشتراك شهري${calc.monthsCount > 1 ? ` × ${calc.monthsCount} أشهر` : ''})` 
                  : `إجمالي مصاريف المرتجع الحالية (${calc.returnedCount})`
              } 
              curr={calc.returnCostTotal} 
              prev={prevCalc?.returnCostTotal} 
              valClass="text-rose-600" 
              prefix="− " 
            />
            <ComparingRow label="مصاريف إضافية (أخرى)" curr={calc.extraExpenses} prev={prevCalc?.extraExpenses} valClass="text-emerald-900/70" prefix="− " bg="mb-2" />

            {/* Final Real Net Profit */}
            <div className="flex justify-between items-center py-2 px-3 bg-slate-900 text-white rounded-xl mt-3 shadow-xs">
              <span className="font-black text-xs">صافي الربح الحقيقي النهائي:</span>
              <span className={`font-black text-sm ${calc.realNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {calc.realNetProfit >= 0 ? '+' : ''}{formatCurrency(calc.realNetProfit)} د.ج
              </span>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Charts Section */}
      {(financeActiveTab === 'all' || financeActiveTab === 'overview') && activeChartTab !== 'hidden' && (
        <div className="space-y-6">
          {/* Chart Filter/Selector Tabs */}
          <div className="bg-white p-2.5 rounded-2xl shadow-xs border border-gray-200/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 pr-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <span className="text-xs font-black text-gray-800">عرض المنحنيات البيانية:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveChartTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeChartTab === 'all'
                    ? 'bg-indigo-600 text-white font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                🌟 جميع المنحنيات (3)
              </button>

              <button
                type="button"
                onClick={() => setActiveChartTab('chart1')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeChartTab === 'chart1'
                    ? 'bg-emerald-600 text-white font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                📈 نمو الأرباح
              </button>

              <button
                type="button"
                onClick={() => setActiveChartTab('chart2')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeChartTab === 'chart2'
                    ? 'bg-blue-600 text-white font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                💰 المداخيل عند الاستلام
              </button>

              <button
                type="button"
                onClick={() => setActiveChartTab('chart3')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeChartTab === 'chart3'
                    ? 'bg-rose-600 text-white font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                📉 الخسارة والفارق
              </button>
            </div>
          </div>

          {/* Chart 1: Real vs Expected Daily & Cumulative Profit Growth */}
          {(activeChartTab === 'all' || activeChartTab === 'chart1') && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200/60 overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                  منحنى نمو الأرباح اليومية والتراكمية (الحقيقية ضد المتوقعة)
                </h3>
                <p className="text-xs text-gray-500 font-medium mt-1">
                  مقارنة بين الأرباح المتوقعة بناءً على تواريخ الشحن الحقيقية للطلبيات، والأرباح الصافية المحققة بتاريخ الاستلام الفعلي للزبون.
                </p>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-2xl shrink-0 self-start lg:self-center">
                <button
                  type="button"
                  onClick={() => setChart1Mode('cumulative')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                    chart1Mode === 'cumulative'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  نمو الأرباح التراكمية
                </button>
                <button
                  type="button"
                  onClick={() => setChart1Mode('daily')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                    chart1Mode === 'daily'
                      ? 'bg-white text-indigo-800 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  تفصيل الأرباح اليومية
                </button>
              </div>
            </div>

            {/* Quick KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-blue-700">إجمالي الأرباح المتوقعة (تاريخ الشحن)</span>
                <span className="text-base font-black text-blue-950 mt-1" dir="ltr">
                  {formatCurrency(chartTotals.totalExpNet)} <span className="text-xs font-bold">د.ج</span>
                </span>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3.5 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-emerald-700">إجمالي الأرباح الحقيقية (تاريخ الاستلام)</span>
                <span className="text-base font-black text-emerald-950 mt-1" dir="ltr">
                  {formatCurrency(chartTotals.totalRealNet)} <span className="text-xs font-bold">د.ج</span>
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-amber-50/70 border border-amber-100 rounded-2xl p-3.5 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-amber-800">نسبة تحقق الأرباح المحصلة</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-base font-black text-amber-950">{chartTotals.realizationRate}%</span>
                  <span className="text-[10px] text-amber-700 font-bold">(الحقيقي / المتوقع)</span>
                </div>
              </div>
            </div>

            <div className="h-80 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                {chart1Mode === 'cumulative' ? (
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 'bold' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `${(value / 1000)}k`}
                      tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 'bold' }}
                      dx={-10}
                    />
                    <Tooltip 
                       contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', fontWeight: 'bold', fontSize: '13px', direction: 'rtl' }}
                       formatter={(value: any, name: any) => [`${formatCurrency(value)} د.ج`, name]}
                       labelStyle={{ color: '#374151', marginBottom: '8px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 'bold' }} />
                    
                    <Line type="monotone" dataKey="نمو الأرباح المتوقعة التراكمية" stroke="#3B82F6" strokeWidth={3} strokeDasharray="5 5" dot={chartData.length <= 31 ? { r: 3, strokeWidth: 1.5 } : false} isAnimationActive={chartData.length <= 40} activeDot={{ r: 5 }} name="نمو الأرباح المتوقعة التراكمية (تاريخ الشحن)" />
                    <Line type="monotone" dataKey="نمو الأرباح الحقيقية التراكمية" stroke="#10B981" strokeWidth={3.5} dot={chartData.length <= 31 ? { r: 3, strokeWidth: 1.5 } : false} isAnimationActive={chartData.length <= 40} activeDot={{ r: 5 }} name="نمو الأرباح الحقيقية التراكمية (تاريخ الاستلام)" />
                  </ComposedChart>
                ) : (
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 'bold' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `${(value / 1000)}k`}
                      tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 'bold' }}
                      dx={-10}
                    />
                    <Tooltip 
                       contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', fontWeight: 'bold', fontSize: '13px', direction: 'rtl' }}
                       formatter={(value: any, name: any) => [`${formatCurrency(value)} د.ج`, name]}
                       labelStyle={{ color: '#374151', marginBottom: '8px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 'bold' }} />
                    
                    <Bar dataKey="المصاريف (إعلانات وأخرى)" fill="#F87171" radius={[4, 4, 0, 0]} maxBarSize={32} name="المصاريف اليومية" />
                    <Line type="monotone" dataKey="صافي الأرباح المتوقعة" stroke="#3B82F6" strokeWidth={3} strokeDasharray="5 5" dot={chartData.length <= 31 ? { r: 3, strokeWidth: 1.5 } : false} isAnimationActive={chartData.length <= 40} activeDot={{ r: 5 }} name="الأرباح الصافية المتوقعة اليومية (تاريخ الشحن)" />
                    <Line type="monotone" dataKey="صافي الأرباح الحقيقية" stroke="#10B981" strokeWidth={3} dot={chartData.length <= 31 ? { r: 3, strokeWidth: 1.5 } : false} isAnimationActive={chartData.length <= 40} activeDot={{ r: 5 }} name="الأرباح الصافية الحقيقية اليومية (تاريخ الاستلام)" />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
          )}

      {/* Chart 2: Daily Net Revenues based on Order Delivery Dates */}
      {(activeChartTab === 'all' || activeChartTab === 'chart2') && (
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200/60 overflow-hidden mt-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-indigo-600" />
              منحنى صافي المداخيل اليومية بناءً على تواريخ استلام الطلبيات
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-1">
              يمثل التدفق المالي الصافي (بعد خصم تكلفة المنتجات ومصاريف الشحن) المحصل في تواريخ تسليم الطلبيات للزبائن بالفعل.
            </p>
          </div>

          {/* Toggle Mode */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-2xl shrink-0 self-start lg:self-center">
            <button
              type="button"
              onClick={() => setChart2Mode('both')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                chart2Mode === 'both'
                  ? 'bg-white text-indigo-800 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              يومي وتراكمي
            </button>
            <button
              type="button"
              onClick={() => setChart2Mode('daily')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                chart2Mode === 'daily'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              يومي فقط
            </button>
            <button
              type="button"
              onClick={() => setChart2Mode('cumulative')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                chart2Mode === 'cumulative'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              تراكمي فقط
            </button>
          </div>
        </div>

        {/* Quick KPI Strip for Chart 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-indigo-700">إجمالي صافي المداخيل المحصلة (عند الاستلام)</span>
            <span className="text-base font-black text-indigo-950 mt-1" dir="ltr">
              {formatCurrency(chartTotals.totalDelivNetGross)} <span className="text-xs font-bold">د.ج</span>
            </span>
            <span className="text-[10px] text-indigo-600 font-bold mt-0.5">(بعد خصم السلعة والشحن)</span>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-emerald-700">متوسط صافي المدخول اليومي</span>
            <span className="text-base font-black text-emerald-950 mt-1" dir="ltr">
              {formatCurrency(chartTotals.avgDailyNetGross)} <span className="text-xs font-bold">د.ج</span>
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-purple-50/70 border border-purple-100 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-purple-800">إجمالي الطلبيات المستلمة</span>
            <span className="text-base font-black text-purple-950 mt-1">
              {chartTotals.totalDelivCount} <span className="text-xs font-bold">طلبية</span>
            </span>
          </div>
        </div>

        <div className="h-80 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 'bold' }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${(value / 1000)}k`}
                tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 'bold' }}
                dx={-10}
              />
              <Tooltip 
                 contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', fontWeight: 'bold', fontSize: '13px', direction: 'rtl' }}
                 formatter={(value: any, name: any) => [
                   name.includes('عدد') ? `${value} طلبية` : `${formatCurrency(value)} د.ج`,
                   name
                 ]}
                 labelStyle={{ color: '#374151', marginBottom: '8px' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 'bold' }} />
              
              {(chart2Mode === 'both' || chart2Mode === 'daily') && (
                <Bar dataKey="صافي المداخيل اليومية" fill="#6366F1" radius={[6, 6, 0, 0]} maxBarSize={36} name="صافي المداخيل اليومية (تاريخ الاستلام)" />
              )}
              
              {(chart2Mode === 'both' || chart2Mode === 'cumulative') && (
                <Line type="monotone" dataKey="تراكمي صافي المداخيل عند الاستلام" stroke="#10B981" strokeWidth={3.5} dot={chartData.length <= 31 ? { r: 3, strokeWidth: 1.5 } : false} isAnimationActive={chartData.length <= 40} activeDot={{ r: 5 }} name="تراكمي صافي المداخيل عند الاستلام (د.ج)" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      )}

      {/* Chart 3: Daily Loss & Performance Difference */}
      {(activeChartTab === 'all' || activeChartTab === 'chart3') && (
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200/60 overflow-hidden mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <TrendingDown className="w-6 h-6 text-rose-500" />
            تحليل الخسارة اليومية وفارق الأداء (المتوقع ضد الحقيقي)
          </h3>
          <span className="text-[11px] font-black text-rose-700 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl">
            ملاحظة: يشمل الحساب خصم مصاريف الإعلانات والمصاريف الأخرى لتسوية ومقارنة الأرباح الصافية
          </span>
        </div>
        <div className="h-80 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 'bold' }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${(value / 1000)}k`}
                tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 'bold' }}
                dx={-10}
              />
              <Tooltip 
                 contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', fontWeight: 'bold', fontSize: '13px', direction: 'rtl' }}
                 formatter={(value: any, name: any) => [`${formatCurrency(value)} د.ج`, name]}
                 labelStyle={{ color: '#374151', marginBottom: '8px' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 'bold' }} />
              
              <Bar dataKey="الخسارة اليومية" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={40} name="الفارق / الخسارة اليومية" />
              <Line type="monotone" dataKey="صافي المتوقع مع المصاريف" stroke="#3B82F6" strokeWidth={3} strokeDasharray="5 5" dot={chartData.length <= 31 ? { r: 3, strokeWidth: 1.5 } : false} isAnimationActive={chartData.length <= 40} activeDot={{ r: 5 }} name="صافي المتوقع مع المصاريف" />
              <Line type="monotone" dataKey="صافي الحقيقي مع المصاريف" stroke="#10B981" strokeWidth={3} dot={chartData.length <= 31 ? { r: 3, strokeWidth: 1.5 } : false} isAnimationActive={chartData.length <= 40} activeDot={{ r: 5 }} name="صافي الحقيقي مع المصاريف" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      )}
        </div>
      )}

      {/* Orders Finance Table */}
      {(financeActiveTab === 'all' || financeActiveTab === 'table') && (
      <div 
        ref={tableContainerRef}
        className={`bg-white transition-all duration-200 ${
          isTableFullscreen 
            ? 'fixed inset-0 z-[9999] bg-slate-900 text-slate-100 overflow-auto p-4 sm:p-6 shadow-2xl rounded-none' 
            : 'rounded-3xl shadow-sm border border-gray-200/60 overflow-hidden'
        }`}
      >
        {/* Fullscreen Quick Top Bar for Finance Table */}
        {isTableFullscreen && (
          <div className="sticky top-0 z-50 bg-slate-800/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl flex flex-wrap items-center justify-between gap-3 text-white mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl font-bold text-xs">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>جدول المحاسبة والمالية</span>
                <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black">{filteredTableOrders.length}</span>
              </div>

              {/* Quick Financial Metrics */}
              <div className="hidden lg:flex items-center gap-2 text-[11px] font-bold">
                <span className="bg-emerald-900/60 border border-emerald-700/50 px-2.5 py-1 rounded-lg text-emerald-300">
                  صافي الأرباح: <strong className="text-emerald-100">{formatCurrency(quickTableStats.totalNet)} د.ج</strong>
                </span>
                <span className="bg-blue-900/60 border border-blue-700/50 px-2.5 py-1 rounded-lg text-blue-300">
                  المبيعات المحصلة: <strong className="text-blue-100">{formatCurrency(quickTableStats.totalRev)} د.ج</strong>
                </span>
                <span className="bg-purple-900/60 border border-purple-700/50 px-2.5 py-1 rounded-lg text-purple-300">
                  طلبيات مستلمة: <strong className="text-purple-100">{quickTableStats.deliveredCount}</strong>
                </span>
              </div>
            </div>

            {/* Quick Actions & Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Fullscreen Quick Search */}
              <div className="relative min-w-[200px] max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="بحث سريع برقم الطلبية، التتبع..."
                  value={tableSearchQuery}
                  onChange={(e) => {
                    setTableSearchQuery(e.target.value);
                    setTablePage(1);
                  }}
                  className="w-full pr-8 pl-7 py-1.5 bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-500"
                />
                {tableSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setTableSearchQuery('');
                      setTablePage(1);
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="مسح البحث"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <select
                className="bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 rounded-xl py-1.5 px-2 focus:ring-1 focus:ring-emerald-500"
                value={tableProductFilter}
                onChange={(e) => setTableProductFilter(e.target.value)}
              >
                <option value="all">كل المنتجات</option>
                {uniqueTableProducts.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <select
                className="bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 rounded-xl py-1.5 px-2 focus:ring-1 focus:ring-emerald-500"
                value={tableStatusFilter}
                onChange={(e) => setTableStatusFilter(e.target.value)}
              >
                <option value="all">كل الحالات المالية</option>
                <option value="مستلمة">مستلمة (خالص)</option>
                <option value="معلقة">معلقة (قيد الشحن)</option>
                <option value="مرتجع">مرتجع (خسارة)</option>
              </select>

              {/* Zero or Negative Profit Modal Button */}
              <button
                onClick={() => setShowZeroOrNegativeModal(true)}
                className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 px-3 py-1.5 rounded-xl text-xs font-black transition-all shadow-2xs cursor-pointer border border-rose-200 group"
                title="عرض جميع الطلبيات التي لم تحقق فائدة أو سببت خسارة مالية (فائدة ≤ 0)"
              >
                <AlertTriangle size={14} className="text-rose-600 group-hover:scale-110 transition-transform" />
                <span>طلبيات فائدتها ≤ 0</span>
                <span className="bg-rose-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black">
                  {zeroOrNegativeOrders.length}
                </span>
              </button>

              {/* Warehouse Costs Modal Button */}
              <button
                onClick={() => {
                  initializeProductCostsFromInventory();
                  setShowCostsModal(true);
                }}
                className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-black transition-all shadow-2xs cursor-pointer border border-indigo-200"
                title="عرض وتحديث تكاليف البضاعة والأنواع المسحوبة مباشرة من المخزن"
              >
                <Package size={14} className="text-indigo-600" />
                <span>تكاليف المنتجات والأنواع من المخزن</span>
              </button>

              <button
                onClick={() => setShowAdvancedExportModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white border border-emerald-400/40 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 text-xs transition-all cursor-pointer shadow-xs"
                title="تصدير متقدم Excel (فلاتر متعددة، تجميع الموديلات، اختيار الأعمدة والتواريخ)"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تصدير متقدم (Excel)</span>
              </button>

              <button 
                onClick={toggleTableFullscreen}
                className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 text-xs transition-all cursor-pointer"
                title="إنهاء ملء الشاشة"
              >
                <Minimize2 className="w-4 h-4" />
                <span>خروج</span>
              </button>
            </div>
          </div>
        )}

        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-black text-gray-900 tracking-tight">جدول المالية والمحاسبة الذكية للطلبيات</h3>
            <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold">{filteredTableOrders.length} طلبية</span>
            {tableSearchQuery && (
              <span className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-2">
                <span>بحث: "{tableSearchQuery}"</span>
                <button
                  type="button"
                  onClick={() => {
                    setTableSearchQuery('');
                    setTablePage(1);
                  }}
                  className="hover:bg-indigo-100 text-indigo-700 p-0.5 rounded-full cursor-pointer font-black text-xs"
                  title="إلغاء البحث وعرض كل الطلبيات"
                >
                  ✕
                </button>
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
             {/* Normal View Quick Search */}
             <div className="relative min-w-[220px] sm:min-w-[270px] flex-1 sm:flex-initial">
               <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
               <input
                 type="text"
                 placeholder="بحث سريع: رقم الطلبية، التتبع، العميل، الهاتف، المنتج..."
                 value={tableSearchQuery}
                 onChange={(e) => {
                   setTableSearchQuery(e.target.value);
                   setTablePage(1);
                 }}
                 className="w-full pr-9 pl-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs font-bold text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
               />
               {tableSearchQuery && (
                 <button
                   type="button"
                   onClick={() => {
                     setTableSearchQuery('');
                     setTablePage(1);
                   }}
                   className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 cursor-pointer"
                   title="مسح البحث"
                 >
                   <X size={13} />
                 </button>
               )}
             </div>

             <button
               onClick={() => setShowAdvancedExportModal(true)}
               className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer border border-emerald-500"
               title="تصدير متقدم Excel: فلاتر متعددة، تجميع الموديلات والأنواع، تحكم بالأعمدة والتواريخ"
             >
               <FileSpreadsheet size={14} />
               <span>تصدير متقدم (Excel)</span>
             </button>
             <button
               onClick={toggleTableFullscreen}
               className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
               title={isTableFullscreen ? "خروج من ملء الشاشة" : "ملء الشاشة"}
             >
               {isTableFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
               <span>{isTableFullscreen ? 'خروج' : 'ملء الشاشة'}</span>
             </button>
             <button
               onClick={() => syncCompanyFeesForOrders(filteredTableOrders)}
               disabled={filteredTableOrders.length === 0}
               className="flex items-center gap-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-black transition-colors disabled:opacity-50"
               title="جلب خصومات أسعار الشحن بالولايات من API شركة التوصيل وتطبيقها على حساب المالية"
             >
               <CreditCard size={14} className="text-amber-600" />
               جلب أسعار الشحن بالولايات (API)
             </button>
             <button
               onClick={() => handleBulkSync(filteredTableOrders)}
               disabled={isBulkSyncing || filteredTableOrders.length === 0}
               className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
             >
               <RefreshCw size={14} className={isBulkSyncing ? 'animate-spin' : ''} />
               تحديث الأسعار ({filteredTableOrders.filter(o => o.shippingTrackingId).length})
             </button>
             <div className="flex bg-slate-100 rounded-xl p-1 w-full md:w-auto max-w-sm border border-slate-200/60">
                 <select
                   className="bg-transparent border-none text-sm font-bold text-slate-700 focus:outline-none focus:ring-0 ml-2 py-1.5 px-2"
                   value={tableProductFilter}
                   onChange={(e) => setTableProductFilter(e.target.value)}
                 >
                   <option value="all">كل المنتجات</option>
                   {uniqueTableProducts.map(p => (
                       <option key={p} value={p}>{p}</option>
                   ))}
                 </select>
                 <div className="w-[1px] bg-slate-300 mx-1"></div>
                 <select
                   className="bg-transparent border-none text-sm font-bold text-slate-700 focus:outline-none focus:ring-0 py-1.5 px-2"
                   value={tableStatusFilter}
                   onChange={(e) => setTableStatusFilter(e.target.value)}
                 >
                   <option value="all">كل الحالات المالية</option>
                   <option value="مستلمة">مستلمة (خالص)</option>
                   <option value="معلقة">معلقة (قيد الشحن)</option>
                   <option value="مرتجع">مرتجع (خسارة)</option>
                 </select>
             </div>
          </div>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-4 rounded-tr-3xl min-w-[220px]">الطلبية / التتبع</th>
                <th className="p-4 min-w-[140px]">العميل / المنتج</th>
                <th className="p-4 text-center">حالة المالية</th>
                <th className="p-4">الإجمالي / التوصيل</th>
                <th className="p-4">تكلفة البضاعة (د.ج)</th>
                <th className="p-4">إضافية / مرتجع (د.ج)</th>
                <th className="p-4">صافي الربح</th>
                <th className="p-4 rounded-tl-3xl text-center min-w-[70px]">تفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedTableOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400 font-medium">لا توجد طلبيات تطابق الفلتر</td>
                </tr>
              ) : (
                paginatedTableOrders.map(o => (
                  <FinanceTableRow
                    key={o.id}
                    order={o}
                    orderCosts={getOrderCosts(o)}
                    settings={settings}
                    isMonthlySub={isMonthlySub}
                    isTableProdFiltered={isTableProdFiltered}
                    syncingOrderId={syncingOrderId}
                    onUpdateOrder={updateOrder}
                    onSyncFinancials={syncOrderFinancials}
                    onSingleOrderAutoShipping={handleSingleOrderAutoShipping}
                    onApplyCostGlobally={handleApplyCostGlobally}
                    onSelectForDetails={setSelectedOrderForDetails}
                    mapStatusToStatus2={mapStatusToStatus2}
                    isHighlighted={highlightedOrderId === o.id || highlightedOrderId === String(o.orderId)}
                  />
                ))
              )}
            </tbody>
            {filteredTableOrders.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 text-slate-800 font-bold text-xs">
                <tr>
                  <td className="p-4" colSpan={2}>
                    <div className="flex flex-col gap-1">
                      <span className="font-black text-sm text-slate-900">
                        مجموع الطلبيات المطابقة بالجدول ({filteredTableOrders.length} طلبية)
                      </span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        مستلمة: <strong className="text-emerald-700">{quickTableStats.deliveredCount}</strong> | مرتجعة: <strong className="text-rose-700">{quickTableStats.returnedCount} {isMonthlySub && '(مشمولة بالاشتراك الشهري)'}</strong> | معلقة: <strong className="text-blue-700">{quickTableStats.pendingCount}</strong>
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className="px-2.5 py-1 bg-slate-200/80 rounded-lg text-[10px] font-black text-slate-700">
                      ملخص الإجمالي
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="space-y-0.5">
                      <div className="text-slate-900 font-black text-sm">
                        {formatCurrency(quickTableStats.totalRev)} <span className="text-[10px] text-slate-500 font-bold">د.ج</span>
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        − {formatCurrency(quickTableStats.totalShip)} د.ج توصيل
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-slate-900 font-black text-sm">
                      − {formatCurrency(quickTableStats.totalCogs)} <span className="text-[10px] text-slate-500 font-bold">د.ج</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-normal">تكلفة البضاعة</span>
                  </td>
                  <td className="p-4">
                    <div className="text-rose-700 font-black text-sm">
                      − {formatCurrency(quickTableStats.totalExtAndReturn)} <span className="text-[10px] text-rose-500 font-bold">د.ج</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {isTableProdFiltered ? 'محيدة بالفلترة (0 د.ج)' : isMonthlySub ? 'مصاريف إضافية (المرتجع باشتراك)' : 'إضافية ومرتجعات'}
                    </span>
                  </td>
                  <td className="p-4" colSpan={2}>
                    <div className={`text-lg font-black tracking-tight ${quickTableStats.totalNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {quickTableStats.totalNet >= 0 ? '+' : ''}{formatCurrency(quickTableStats.totalNet)} <span className="text-xs">د.ج</span>
                    </div>
                    <span className="text-[9px] text-slate-400 block font-normal leading-tight">
                      {isTableProdFiltered
                        ? '*عند فلترة منتج محدد، لا يتم خصم تكاليف المرتجع والمصاريف الإضافية العامة وتحسب فقط في الإجمالي العام'
                        : isMonthlySub 
                        ? `*تُخصم الإعلانات والاشتراك الشهري للمرتجع (${formatCurrency(monthlySubAmount)} د.ج/شهر) والمصاريف العامة إجمالياً في البطاقات أعلاه`
                        : '*تُخصم الإعلانات والمصاريف العامة إجمالياً في البطاقات أعلاه'
                      }
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        
        {/* Pagination bar for Finance Orders Table */}
        {filteredTableOrders.length > 0 && (
          <div className="border-t border-slate-200">
            <TablePagination
              currentPage={tablePage}
              totalPages={tableTotalPages}
              pageSize={tablePageSize}
              totalItems={filteredTableOrders.length}
              pageSizeOptions={[10, 25, 50, 100, 200]}
              onPageChange={setTablePage}
              onPageSizeChange={(newSize) => {
                setTablePageSize(newSize);
                setTablePage(1);
              }}
              itemLabel="طلبية مالية"
              className="bg-slate-50/70"
            />
          </div>
        )}
      </div>
      )}

      {/* Bottom config panels */}
      {(financeActiveTab === 'all' || financeActiveTab === 'settings') && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        
        {/* Settings Panel */}
        <div id="accounting-settings-section" className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200/60 overflow-hidden transition-all duration-500">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">إعدادات المحاسبة وتكاليف المرتجع</h3>
              <p className="text-xs text-gray-500 mt-0.5">خصص طريقة احتساب المرتجع وتكاليف البضاعة وسعر الصرف</p>
            </div>
          </div>
          
          <div className="space-y-5">
            {/* Return Cost Configuration Block */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <span className="block text-xs font-black text-gray-800 uppercase tracking-wider">
                    طريقة احتساب مصاريف المرتجع (شركة الشحن)
                  </span>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    اختر هل تدفع تكلفة المرتجع لشركة التوصيل على كل طلبية، أو كاشتراك شهري ثابت؟
                  </p>
                </div>

                {/* Mode Selector Tabs */}
                <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl shadow-xs self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setReturnCostModeInput('per_order')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                      returnCostModeInput === 'per_order'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span>📦</span>
                    <span>دفع لكل طلبية</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReturnCostModeInput('monthly_subscription')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                      returnCostModeInput === 'monthly_subscription'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span>📅</span>
                    <span>اشتراك شهري ثابت</span>
                  </button>
                </div>
              </div>

              {returnCostModeInput === 'per_order' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-white p-3.5 rounded-xl border border-slate-200/80">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      تكلفة المرتجع لكل طلبية (الدفع بالقطعة)
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={returnCostInput} 
                        onChange={(e) => setReturnCostInput(e.target.value)}
                        className="w-full text-base border-2 border-slate-200 rounded-xl py-2 px-3 bg-slate-50 font-bold text-gray-900 outline-none focus:border-indigo-400 focus:bg-white transition-all pl-12"
                        placeholder="400"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">د.ج / طلبية</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                    📌 <strong>نظام الدفع بالطلبية:</strong> يتم خصم هذا المبلغ عن كل طرد مرتجع تسجله شركة التوصيل (الافتراضي 400 د.ج). يمكن أيضاً تعديله لكل طلبية بشكل مخصص من الجدول.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-200/70">
                  <div>
                    <label className="block text-xs font-bold text-indigo-950 mb-1.5 flex items-center gap-1.5">
                      <span>قيمة الاشتراك الشهري للمرتجع (ثابت لكل شهر)</span>
                      <span className="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-black">مفعل</span>
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={returnMonthlySubInput} 
                        onChange={(e) => setReturnMonthlySubInput(e.target.value)}
                        className="w-full text-base border-2 border-indigo-300 rounded-xl py-2 px-3 bg-white font-black text-indigo-950 outline-none focus:border-indigo-600 transition-all pl-14"
                        placeholder="مثال: 5000"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 font-bold text-xs">د.ج / شهر</span>
                    </div>
                  </div>
                  <div className="text-xs text-indigo-900 leading-relaxed bg-white/90 p-3 rounded-lg border border-indigo-100">
                    ✨ <strong>نظام الاشتراك الشهري:</strong> يتم احتساب تكلفة المرتجعات كاشتراك ثابت ({formatCurrency(Number(returnMonthlySubInput) || 0)} د.ج/شهر) لكل شهر نشط في الفترات السابقة والحالية، ولا يتم خصم أي مبلغ إضافي لكل طلبية مرتجعة بمفردها.
                  </div>
                </div>
              )}
            </div>

            {/* Other Financial Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">تكلفة البضاعة الافتراضية</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={defaultGlobalProductCost} 
                    onChange={(e) => setDefaultGlobalProductCost(Number(e.target.value) || 0)}
                    className="w-full text-lg border-2 border-slate-200 rounded-xl py-3 px-4 bg-slate-50 font-bold text-gray-900 outline-none focus:border-indigo-400 focus:bg-white transition-all pl-12"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">د.ج</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">سعر صرف الدولار (الإعلانات)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={exchangeRateInput} 
                    onChange={(e) => setExchangeRateInput(e.target.value)}
                    className="w-full text-lg border-2 border-slate-200 rounded-xl py-3 px-4 bg-slate-50 font-bold text-gray-900 outline-none focus:border-indigo-400 focus:bg-white transition-all pl-12"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">د.ج</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-between items-center">
            
            <button 
              onClick={handleSaveSettings}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-md shadow-slate-900/10 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Save className="w-5 h-5" />
              حفظ الإعدادات
            </button>
          </div>
        </div>

        {/* Expenses Panel */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200/60 overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight">
              {editingExpenseId ? 'تعديل المصروف' : 'إضافة مصروف جديد'}
            </h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                 <input 
                  type="text" 
                  placeholder="وصف المصروف (مثال: تغليف، موظفين...)" 
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="w-full text-sm border-2 border-slate-200 rounded-xl py-3 px-4 bg-slate-50 font-bold text-gray-900 outline-none focus:border-orange-400 transition-all"
                />
              </div>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="المبلغ"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full text-sm border-2 border-slate-200 rounded-xl py-3 px-4 bg-slate-50 font-bold text-gray-900 outline-none focus:border-orange-400 transition-all pl-12"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">د.ج</span>
              </div>
            </div>
            
            <div className="flex gap-4 items-center">
               <input 
                  type="date" 
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="text-sm border-2 border-slate-200 rounded-xl py-3 px-4 bg-slate-50 font-bold text-gray-900 outline-none focus:border-orange-400 transition-all flex-grow"
                />
                {editingExpenseId ? (
                  <div className="flex gap-2">
                    <button 
                      onClick={handleUpdateExpense}
                      className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <Save className="w-5 h-5" />
                      حفظ
                    </button>
                    <button 
                      onClick={cancelEditExpense}
                      className="flex items-center gap-2 px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={handleAddExpense}
                    className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold shadow-md shadow-orange-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Plus className="w-5 h-5" />
                    إضافة
                  </button>
                )}
            </div>
          </div>
          
          {expenses.length > 0 && (
            <div className="mt-8 border-t border-gray-100 pt-6">
              <h4 className="text-sm font-bold text-gray-500 mb-4">المصاريف السابقة</h4>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {expenses.slice().sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(exp => (
                  <div key={exp.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <div className="font-bold text-slate-800">{exp.description}</div>
                      <div className="text-xs text-slate-500 font-medium mt-1">{format(new Date(exp.date), 'dd MMM yyyy')}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="font-black text-rose-600">
                        {exp.amount.toLocaleString()} د.ج
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEditExpense(exp)} className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-blue-500 hover:bg-blue-50 shadow-sm border border-slate-200 transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteExpense(exp.id)} className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-rose-500 hover:bg-rose-50 shadow-sm border border-slate-200 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {showCostsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Package className="w-6 h-6 text-indigo-500" />
                تعيين تكاليف البضاعة من المخزن
              </h2>
              <button 
                onClick={() => setShowCostsModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 bg-indigo-50/60 border-b border-indigo-100 text-xs text-indigo-900 leading-relaxed">
              💡 <strong>ربط مباشر مع المخزن:</strong> يتم سحب التكاليف المعروضة هنا تلقائياً من بطاقات المنتجات والأنواع في المخزن، وأي تعديل تقوم به هنا سيتم حفظه وتحديثه فوراً في المخزن وفي حسابات الأرباح المالية.
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {inventoryProducts.length === 0 ? (
                <div className="text-center py-12 text-slate-500">لا توجد منتجات في المخزن حالياً</div>
              ) : (
                inventoryProducts.map((inv) => {
                  const hasVariations = inv.variations && inv.variations.length > 0;
                  const currentWhCost = getProductCostValue(inv);
                  const displayCostVal = productCostsTemp[inv.name] !== undefined 
                    ? productCostsTemp[inv.name] 
                    : (currentWhCost > 0 ? currentWhCost : '');
                  
                  return (
                    <div key={inv.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-200 last:border-0 last:mb-0 last:pb-0">
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{inv.name}</span>
                            {inv.sku && (
                              <span className="text-[10px] bg-slate-200/80 text-slate-600 font-mono px-1.5 py-0.5 rounded">
                                SKU: {inv.sku}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                              المخزن: {currentWhCost > 0 ? `${formatCurrency(currentWhCost)} د.ج` : 'غير مسعر'}
                            </span>
                            {hasVariations && (
                              <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-bold">
                                {inv.variations?.length} أنواع / خيارات
                              </span>
                            )}
                          </div>
                        </div>

                        {!hasVariations && (
                          <div className="relative w-44">
                            <input 
                              type="number" 
                              value={displayCostVal}
                              onChange={(e) => setProductCostsTemp({...productCostsTemp, [inv.name]: Number(e.target.value) || 0})}
                              placeholder="تكلفة الشراء (د.ج)"
                              className="w-full text-sm font-bold bg-white border border-slate-300 rounded-lg py-2 px-3 outline-none focus:border-indigo-500 transition-colors"
                            />
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">د.ج</span>
                          </div>
                        )}
                      </div>
                      
                      {hasVariations && (
                        <div className="space-y-2 mt-2 pr-2 border-r-2 border-indigo-200">
                          {inv.variations?.map((v: any, idx: number) => {
                            const variationName = v.attributes?.map((a:any)=>a.option).join(' ') || v.name || v.sku || `نوع ${idx + 1}`;
                            const key = `${inv.name}::${variationName}`;
                            const varWhCost = getProductCostValue(v) || currentWhCost;
                            const varDisplayVal = productCostsTemp[key] !== undefined 
                              ? productCostsTemp[key] 
                              : (varWhCost > 0 ? varWhCost : '');
                            
                            return (
                              <div key={idx} className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs">
                                <div>
                                  <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                                    <span>{variationName}</span>
                                    {v.sku && (
                                      <span className="text-[9px] bg-slate-100 text-slate-500 font-mono px-1 rounded">
                                        {v.sku}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
                                    تكلفة المخزن: {varWhCost > 0 ? `${formatCurrency(varWhCost)} د.ج` : '0 د.ج'}
                                  </div>
                                </div>

                                <div className="relative w-36">
                                  <input 
                                    type="number" 
                                    value={varDisplayVal}
                                    onChange={(e) => setProductCostsTemp({...productCostsTemp, [key]: Number(e.target.value) || 0})}
                                    placeholder="التكلفة"
                                    className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 transition-colors"
                                  />
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">د.ج</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex justify-between items-center gap-3">
              <span className="text-xs text-slate-500 font-bold hidden sm:inline">
                سيتم تحديث التكاليف في المخزن والمالية فور الحفظ
              </span>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button 
                  onClick={() => setShowCostsModal(false)}
                  className="px-6 py-2.5 font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  onClick={handleSaveInventoryCosts}
                  className="px-6 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Save size={16} />
                  <span>حفظ وتحديث في المخزن والمالية</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Info Modal for Orders Breakdown */}
      {infoModalOrders && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50 rounded-t-3xl text-sm">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-500" />
                  {infoModalOrders.title} <span className="mr-2 text-sm text-gray-500 font-medium">({infoModalOrders.orders.length} طلبية)</span>
                </h2>
                {infoModalOrders.orders.length > 0 && (
                  <button 
                    onClick={() => handleExportOrders(infoModalOrders.orders, infoModalOrders.title)}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs border border-emerald-500"
                    title="تصدير هذه القائمة إلى Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>تصدير Excel</span>
                  </button>
                )}
              </div>
              <button 
                onClick={() => setInfoModalOrders(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto w-full">
               {infoModalOrders.orders.length > 0 ? (
                  <div className="w-full overflow-x-auto rounded-xl border border-gray-100">
                     <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-gray-100">
                           <tr>
                              <th className="px-4 py-3 whitespace-nowrap">رقم التتبع / الطلب</th>
                              <th className="px-4 py-3 whitespace-nowrap">الزبون</th>
                              <th className="px-4 py-3 min-w-[150px]">المنتج</th>
                              <th className="px-4 py-3 whitespace-nowrap text-center">تكلفة الشراء</th>
                              <th className="px-4 py-3 whitespace-nowrap text-center">تكلفة الإضافة</th>
                              <th className="px-4 py-3 whitespace-nowrap text-center">الإيراد</th>
                              <th className="px-4 py-3 whitespace-nowrap text-center">تكلفة الشحن</th>
                              <th className="px-4 py-3 whitespace-nowrap text-center text-indigo-700">الصافي</th>
                              <th className="px-4 py-3 whitespace-nowrap text-center">الحالة</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-gray-700 font-medium">
                           {infoModalOrders.orders.map((o: any) => {
                              const r = (o.isExchangedReturn ? 'مستلم' : mapStatusToStatus2(o.status2 || '', o));
                              const { totalCogs, extCost } = getOrderCosts(o);
                              const rev = Number(o.totalCharge) || 0;
                              const shp = getEffectiveShippingCost(o, settings);
                              let net = 0;
                              if (r === 'مستلم') net = rev - shp - totalCogs - extCost;
                              else if (r === 'مرتجع') {
                                 const returnC = o.customReturnCost !== undefined ? o.customReturnCost : (settings?.returnCost || 400);
                                 net = -returnC - extCost;
                              }
                              return (
                                 <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-2 text-xs">
                                       <div className="font-bold text-gray-900">{o.shippingTrackingId || o.orderId}</div>
                                    </td>
                                    <td className="px-4 py-2 font-bold">{o.fullName}</td>
                                    <td className="px-4 py-2">
                                       <div className="text-indigo-600 font-semibold truncate max-w-[150px]" title={`${o.productName} ${o.variation ? '- ' + o.variation : ''}`}>{o.productName}</div>
                                       <div className="text-[10px] text-gray-400 font-mono">SKU: {o.sku || '-'}</div>
                                    </td>
                                    <td className="px-4 py-2 text-center text-xs">{formatCurrency(totalCogs)}</td>
                                    <td className="px-4 py-2 text-center text-xs">{formatCurrency(extCost)}</td>
                                    <td className="px-4 py-2 text-center text-emerald-600 font-bold">{formatCurrency(rev)}</td>
                                    <td className="px-4 py-2 text-center text-rose-500 font-bold">{r === 'مرتجع' ? formatCurrency(o.customReturnCost !== undefined ? o.customReturnCost : (settings?.returnCost||400)) : formatCurrency(shp)}</td>
                                    <td className="px-4 py-2 text-center">
                                       <span className={`inline-block px-2 py-0.5 rounded text-xs font-black ${net > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                          {net > 0 ? '+' : ''}{formatCurrency(net)}
                                       </span>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                       <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${r === 'مستلم' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{r}</span>
                                    </td>
                                 </tr>
                              );
                           })}
                        </tbody>
                     </table>
                  </div>
               ) : (
                  <div className="text-center py-12">
                     <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShoppingBag className="w-8 h-8 text-gray-300" />
                     </div>
                     <p className="text-gray-500 font-bold">لا توجد طلبيات للفترة المحددة.</p>
                  </div>
               )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex justify-between items-center">
               <div>
                  {infoModalOrders.orders.length > 0 && (
                    <button 
                      onClick={() => handleExportOrders(infoModalOrders.orders, infoModalOrders.title)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>تصدير إلى Excel ({infoModalOrders.orders.length})</span>
                    </button>
                  )}
               </div>
               <button onClick={() => setInfoModalOrders(null)} className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition-all text-sm cursor-pointer">
                  إغلاق
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Zero or Negative Profit Orders Modal */}
      {showZeroOrNegativeModal && (
        <ZeroOrNegativeProfitModal
          isOpen={showZeroOrNegativeModal}
          onClose={() => setShowZeroOrNegativeModal(false)}
          items={zeroOrNegativeOrders}
          onSelectOrder={(order) => {
            setSelectedOrderForDetails(order);
          }}
          onGoToOrderInTable={handleGoToOrderInTable}
          settings={settings}
          isMonthlySub={isMonthlySub}
        />
      )}

      {/* Advanced Finance Excel Export Modal */}
      {showAdvancedExportModal && (
        <AdvancedFinanceExportModal
          isOpen={showAdvancedExportModal}
          onClose={() => setShowAdvancedExportModal(false)}
          allOrders={orders}
          currentFilteredOrders={filteredTableOrders.length > 0 ? filteredTableOrders : filteredOrders}
          inventoryProducts={inventoryProducts}
          settings={settings}
          currentDateFilterLabel={
            dateFilter === 'today' ? 'اليوم' :
            dateFilter === 'yesterday' ? 'الأمس' :
            dateFilter === 'week' ? 'هذا الأسبوع' :
            dateFilter === 'month' ? 'هذا الشهر' :
            dateFilter === 'custom' ? `${customStart} إلى ${customEnd}` : 'جميع الفترات'
          }
          mapStatusFn={mapStatusToStatus2}
          getOrderCostsFn={getOrderCosts}
          getEffectiveShippingCostFn={getEffectiveShippingCost}
          getDeliveryDateFn={getDeliveryDate}
        />
      )}

      {/* Full Order Details Modal */}
      {selectedOrderForDetails && (
        <ViewOrderModal
          order={selectedOrderForDetails}
          onClose={() => setSelectedOrderForDetails(null)}
        />
      )}
    </div>
  );
}
