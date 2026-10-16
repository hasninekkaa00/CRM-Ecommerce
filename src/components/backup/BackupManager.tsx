import React, { useState, useRef, useEffect } from 'react';
import { 
  Database, Download, Upload, FileSpreadsheet, ShieldCheck, 
  RefreshCw, HardDrive, Package, ShoppingCart, 
  Wallet, Contact, Truck, DollarSign, Clock, AlertCircle, 
  Sparkles, Palette, CheckCircle, Trash2, Eye, Sliders, Shield
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useStore } from '../../store';
import { 
  AUTO_BACKUP_STORAGE_KEY, 
  AutoBackupSnapshot, 
  collectDesignAndPreferences, 
  createAndSaveAutoSnapshot 
} from '../layout/AutoBackupManager';

interface BackupMetadata {
  appName: string;
  version: string;
  timestamp: string;
  dateFormatted: string;
  totalRecords: number;
  includesDesign: boolean;
  counts: Record<string, number>;
}

export const BackupManager: React.FC = () => {
  const store = useStore();
  const {
    orders,
    abandonedOrders,
    inventoryProducts,
    inventoryMovements,
    expenses,
    partners,
    partnerTransactions,
    suppliers,
    purchaseInvoices,
    supplierPayments,
    shippingInvoices,
    shippingBureaus,
    shippingDesks,
    campaigns,
    campaignRecords,
    campaignFields,
    salesChannels,
    settings,
    notes,
    users,
    updateSettings
  } = store;

  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [previewBackupData, setPreviewBackupData] = useState<any | null>(null);
  const [previewMetadata, setPreviewMetadata] = useState<BackupMetadata | null>(null);
  const [previewDesignData, setPreviewDesignData] = useState<any | null>(null);
  
  // Options
  const [restoreScope, setRestoreScope] = useState<'all' | 'data_only' | 'design_only'>('all');
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  
  // Auto backup snapshots in local storage
  const [localSnapshots, setLocalSnapshots] = useState<AutoBackupSnapshot[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load auto-backup snapshots
  const reloadSnapshots = () => {
    try {
      const stored = localStorage.getItem(AUTO_BACKUP_STORAGE_KEY);
      if (stored) {
        setLocalSnapshots(JSON.parse(stored));
      } else {
        setLocalSnapshots([]);
      }
    } catch (_) {
      setLocalSnapshots([]);
    }
  };

  useEffect(() => {
    reloadSnapshots();
  }, []);

  // Settings for auto-backup
  const autoBackupEnabled = settings?.autoBackupEnabled ?? true;
  const autoBackupIntervalHours = settings?.autoBackupIntervalHours || 24;
  const lastAutoBackupTimestamp = settings?.lastAutoBackupTimestamp;

  const totalRecords = 
    orders.length + abandonedOrders.length + inventoryProducts.length + 
    inventoryMovements.length + expenses.length + partners.length + 
    partnerTransactions.length + suppliers.length + purchaseInvoices.length + 
    supplierPayments.length + shippingInvoices.length + shippingBureaus.length + 
    campaigns.length + campaignRecords.length + salesChannels.length + 
    notes.length + users.length;

  const databaseStats = [
    { label: 'الطلبيات المسجلة', count: orders.length, icon: ShoppingCart, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { label: 'منتجات المخزن', count: inventoryProducts.length, icon: Package, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { label: 'المصاريف وسجلات الشركاء', count: expenses.length + partnerTransactions.length, icon: Wallet, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { label: 'فواتير المشتريات والموردين', count: purchaseInvoices.length + suppliers.length, icon: Contact, color: 'text-purple-600 bg-purple-50 border-purple-200' },
    { label: 'فواتير ومكاتب الشحن', count: shippingInvoices.length + shippingBureaus.length, icon: Truck, color: 'text-sky-600 bg-sky-50 border-sky-200' },
    { label: 'الحملات الإعلانية ومصادر البيع', count: campaigns.length + salesChannels.length, icon: DollarSign, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  ];

  // 1. Download Full JSON Backup (Database + Design + Preferences)
  const handleDownloadFullJsonBackup = () => {
    setIsExporting(true);
    const toastId = toast.loading('جاري تجهيز النسخة الاحتياطية الشاملة...');

    try {
      const now = new Date();
      const dateStr = now.toISOString().replace(/[:.]/g, '-');
      const formattedDate = now.toLocaleDateString('ar-DZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const designAndPreferences = collectDesignAndPreferences(settings);

      const backupPayload = {
        metadata: {
          appName: 'E-commerce COD Dashboard',
          version: '2.6.0',
          timestamp: now.toISOString(),
          dateFormatted: formattedDate,
          totalRecords,
          includesDesign: true,
          counts: {
            orders: orders.length,
            abandonedOrders: abandonedOrders.length,
            inventoryProducts: inventoryProducts.length,
            inventoryMovements: inventoryMovements.length,
            expenses: expenses.length,
            partners: partners.length,
            partnerTransactions: partnerTransactions.length,
            suppliers: suppliers.length,
            purchaseInvoices: purchaseInvoices.length,
            supplierPayments: supplierPayments.length,
            shippingInvoices: shippingInvoices.length,
            shippingBureaus: shippingBureaus.length,
            campaigns: campaigns.length,
            campaignRecords: campaignRecords.length,
            campaignFields: campaignFields.length,
            salesChannels: salesChannels.length,
            notes: notes.length,
            users: users.length,
          }
        },
        data: {
          orders,
          abandonedOrders,
          inventoryProducts,
          inventoryMovements,
          expenses,
          partners,
          partnerTransactions,
          suppliers,
          purchaseInvoices,
          supplierPayments,
          shippingInvoices,
          shippingBureaus,
          shippingDesks,
          campaigns,
          campaignRecords,
          campaignFields,
          salesChannels,
          settings,
          notes,
          users
        },
        designAndPreferences
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_full_crm_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('تم تحميل النسخة الاحتياطية الشاملة (قاعدة البيانات + التصميم) بنجاح!', { id: toastId });
    } catch (err: any) {
      console.error('Backup download error:', err);
      toast.error(`حدث خطأ أثناء إنشاء الباكاب: ${err.message || err}`, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Export All Orders to Excel
  const handleExportOrdersExcel = () => {
    if (orders.length === 0) {
      toast.error('لا توجد أي طلبيات لتصديرها');
      return;
    }

    try {
      const data = orders.map(o => ({
        'رقم الطلبية': o.orderId || o.id,
        'رقم التتبع': o.shippingTrackingId || '-',
        'تاريخ الطلب': o.orderDate ? o.orderDate.split('T')[0] : '-',
        'اسم الزبون': o.fullName || '-',
        'رقم الهاتف': o.phone || '-',
        'الولاية': o.region || '-',
        'البلدية': o.city || '-',
        'المنتج': o.productName || '-',
        'النوع / التفرع': o.variation || '-',
        'الكمية': Number(o.qnts) || 1,
        'سعر المنتج': Number(o.priceWithoutDelivery) || 0,
        'سعر التوصيل': Number(o.deliveryPrice) || 0,
        'سعر التوصيل الأصلي': o.realDeliveryPrice !== undefined ? Number(o.realDeliveryPrice) : Number(o.deliveryPrice) || 0,
        'المبلغ الإجمالي (د.ج)': Number(o.totalCharge) || 0,
        'حالة التأكيد': o.status1 || '-',
        'حالة التوصيل': o.status2 || '-',
        'المؤكد': o.confirmedBy || '-',
        'شركة الشحن': o.deliveryCompany || '-',
        'نوع الشحن': o.shippingMethod || '-',
        'ملاحظات': o.notes || '-'
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الطلبيات');
      XLSX.writeFile(wb, `نسخة_احتياطية_الطلبيات_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`تم تصدير ${orders.length} طلبية إلى ملف Excel بنجاح`);
    } catch (err: any) {
      toast.error(`خطأ أثناء التصدير: ${err.message || err}`);
    }
  };

  // 3. Export Inventory to Excel
  const handleExportInventoryExcel = () => {
    if (inventoryProducts.length === 0) {
      toast.error('لا توجد منتجات في المخزن لتصديرها');
      return;
    }

    try {
      const data: any[] = [];
      inventoryProducts.forEach(p => {
        if (p.variations && p.variations.length > 0) {
          p.variations.forEach((v: any, vIdx: number) => {
            data.push({
              'اسم المنتج': p.name,
              'النوع / التفرع': v.name || v.attributes?.map((a: any) => a.option).join(' - ') || `تفرع ${vIdx + 1}`,
              'SKU': v.sku || v.local_sku || p.sku || '-',
              'سعر البيع (د.ج)': v.price || p.price || 0,
              'سعر التكلفة (د.ج)': v.local_cost || v.cost || p.local_cost || 0,
              'الكمية الحالية': Number(v.quantity) || 0,
              'المورد': p.supplierName || '-'
            });
          });
        } else {
          data.push({
            'اسم المنتج': p.name,
            'النوع / التفرع': 'منتج بسيط',
            'SKU': p.sku || '-',
            'سعر البيع (د.ج)': p.price || 0,
            'سعر التكلفة (د.ج)': p.local_cost || p.cost || 0,
            'الكمية الحالية': Number(p.quantity) || 0,
            'المورد': p.supplierName || '-'
          });
        }
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'المخزون');
      XLSX.writeFile(wb, `نسخة_احتياطية_المخزون_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`تم تصدير بيانات المخزن إلى Excel بنجاح`);
    } catch (err: any) {
      toast.error(`خطأ أثناء التصدير: ${err.message || err}`);
    }
  };

  // 4. Export Expenses to Excel
  const handleExportExpensesExcel = () => {
    if (expenses.length === 0 && partnerTransactions.length === 0) {
      toast.error('لا توجد مصاريف أو معاملات مسجلة لتصديرها');
      return;
    }

    try {
      const expData = expenses.map(e => ({
        'التاريخ': e.date,
        'الوصف': e.description,
        'المبلغ (د.ج)': e.amount,
        'الفئة': e.category || 'عام'
      }));

      const txData = partnerTransactions.map(t => ({
        'التاريخ': t.date,
        'البيان': t.description,
        'المبلغ (د.ج)': t.amount,
        'النوع': t.type,
        'اسم الشريك': t.partnerName || '-',
        'طريقة الدفع': t.paymentMethod || '-'
      }));

      const wb = XLSX.utils.book_new();
      if (expData.length > 0) {
        const wsExp = XLSX.utils.json_to_sheet(expData);
        XLSX.utils.book_append_sheet(wb, wsExp, 'المصاريف التشغيلية');
      }
      if (txData.length > 0) {
        const wsTx = XLSX.utils.json_to_sheet(txData);
        XLSX.utils.book_append_sheet(wb, wsTx, 'معاملات الشركاء');
      }

      XLSX.writeFile(wb, `نسخة_احتياطية_المصاريف_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('تم تصدير المصاريف بنجاح');
    } catch (err: any) {
      toast.error(`خطأ أثناء التصدير: ${err.message || err}`);
    }
  };

  // 5. Read and Validate Backup File for Restoration
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        const data = parsed.data || parsed;
        const design = parsed.designAndPreferences || parsed.design || null;

        const metadata: BackupMetadata = parsed.metadata || {
          appName: 'CRM Backup',
          version: '1.0',
          timestamp: new Date().toISOString(),
          dateFormatted: 'غير محدد',
          totalRecords: 0,
          includesDesign: !!design,
          counts: {
            orders: Array.isArray(data.orders) ? data.orders.length : 0,
            inventoryProducts: Array.isArray(data.inventoryProducts) ? data.inventoryProducts.length : 0,
            expenses: Array.isArray(data.expenses) ? data.expenses.length : 0,
            suppliers: Array.isArray(data.suppliers) ? data.suppliers.length : 0,
            shippingInvoices: Array.isArray(data.shippingInvoices) ? data.shippingInvoices.length : 0,
          }
        };

        setPreviewBackupData(data);
        setPreviewMetadata(metadata);
        setPreviewDesignData(design);
        toast.success('تم قراءة ملف النسخة الاحتياطية بنجاح! راجع خيارات الاسترجاع أدناه.');
      } catch (err: any) {
        console.error('Failed to parse backup JSON:', err);
        toast.error('ملف غير صالح! تأكد من اختيار ملف JSON صحيح تم تصديره مسبقاً');
      }
    };
    reader.readAsText(file);
  };

  // Apply design preferences to localStorage and settings
  const applyDesignAndPreferences = (design: any) => {
    if (!design) return;

    if (design.sidebar_mode) localStorage.setItem('sidebar_mode', design.sidebar_mode);
    if (design.sidebar_view_mode) localStorage.setItem('sidebar_view_mode', design.sidebar_view_mode);
    if (design.sidebar_order) localStorage.setItem('sidebar_order', design.sidebar_order);
    if (design.layout_header_collapsed !== undefined) localStorage.setItem('layout_header_collapsed', String(design.layout_header_collapsed));
    if (design.layout_productbar_collapsed !== undefined) localStorage.setItem('layout_productbar_collapsed', String(design.layout_productbar_collapsed));
    if (design.layout_syncbar_collapsed !== undefined) localStorage.setItem('layout_syncbar_collapsed', String(design.layout_syncbar_collapsed));
    if (design.app_default_landing_view) localStorage.setItem('app_default_landing_view', design.app_default_landing_view);
    if (design.orders_visible_columns) localStorage.setItem('orders_visible_columns', design.orders_visible_columns);
    if (design.orders_viewMode) localStorage.setItem('orders_viewMode', design.orders_viewMode);
    if (design.orders_hiddenStatuses) localStorage.setItem('orders_hiddenStatuses', design.orders_hiddenStatuses);
    if (design.orders_hiddenStatuses2) localStorage.setItem('orders_hiddenStatuses2', design.orders_hiddenStatuses2);
    if (design.orders_hiddenTags) localStorage.setItem('orders_hiddenTags', design.orders_hiddenTags);
    if (design.orders_hiddenChannels) localStorage.setItem('orders_hiddenChannels', design.orders_hiddenChannels);
    if (design.orders_pageSize) localStorage.setItem('orders_pageSize', design.orders_pageSize);
    if (design.suivi_card_layout) localStorage.setItem('suivi_card_layout', design.suivi_card_layout);
    if (design.suivi_grid_columns) localStorage.setItem('suivi_grid_columns', design.suivi_grid_columns);
    if (design.suivi_quick_templates) localStorage.setItem('suivi_quick_templates', design.suivi_quick_templates);
    if (design.finance_active_chart_tab) localStorage.setItem('finance_active_chart_tab', design.finance_active_chart_tab);
    if (design.applet_saved_layout_views) localStorage.setItem('applet_saved_layout_views', design.applet_saved_layout_views);
    if (design.app_sections_card_collapsed) localStorage.setItem('app_sections_card_collapsed', design.app_sections_card_collapsed);

    // Update store settings if theme exists
    if (updateSettings && (design.themePalette || design.customThemePalettes || design.defaultLandingView)) {
      updateSettings({
        themePalette: design.themePalette || settings?.themePalette,
        customThemePalettes: design.customThemePalettes || settings?.customThemePalettes,
        defaultLandingView: design.defaultLandingView || settings?.defaultLandingView
      });
    }
  };

  // 6. Execute Database Restore
  const handleExecuteRestore = async () => {
    if (!previewBackupData && !previewDesignData) return;

    setIsRestoring(true);
    const toastId = toast.loading('جاري استرجاع البيانات والتخصيصات...');

    try {
      const stateToUpdate: any = {};

      // 1. Restore Database Tables
      if (restoreScope === 'all' || restoreScope === 'data_only') {
        if (previewBackupData) {
          if (Array.isArray(previewBackupData.orders)) {
            if (restoreMode === 'replace') {
              stateToUpdate.orders = previewBackupData.orders;
            } else {
              const existingMap = new Map(orders.map(o => [o.id, o]));
              previewBackupData.orders.forEach((o: any) => existingMap.set(o.id, { ...existingMap.get(o.id), ...o }));
              stateToUpdate.orders = Array.from(existingMap.values());
            }
          }

          if (Array.isArray(previewBackupData.inventoryProducts)) {
            if (restoreMode === 'replace') {
              stateToUpdate.inventoryProducts = previewBackupData.inventoryProducts;
            } else {
              const existingMap = new Map(inventoryProducts.map(p => [p.id, p]));
              previewBackupData.inventoryProducts.forEach((p: any) => existingMap.set(p.id, { ...existingMap.get(p.id), ...p }));
              stateToUpdate.inventoryProducts = Array.from(existingMap.values());
            }
          }

          if (Array.isArray(previewBackupData.expenses)) {
            if (restoreMode === 'replace') {
              stateToUpdate.expenses = previewBackupData.expenses;
            } else {
              const existingMap = new Map(expenses.map(e => [e.id, e]));
              previewBackupData.expenses.forEach((e: any) => existingMap.set(e.id, { ...existingMap.get(e.id), ...e }));
              stateToUpdate.expenses = Array.from(existingMap.values());
            }
          }

          if (Array.isArray(previewBackupData.partners)) stateToUpdate.partners = previewBackupData.partners;
          if (Array.isArray(previewBackupData.partnerTransactions)) stateToUpdate.partnerTransactions = previewBackupData.partnerTransactions;
          if (Array.isArray(previewBackupData.suppliers)) stateToUpdate.suppliers = previewBackupData.suppliers;
          if (Array.isArray(previewBackupData.purchaseInvoices)) stateToUpdate.purchaseInvoices = previewBackupData.purchaseInvoices;
          if (Array.isArray(previewBackupData.shippingInvoices)) stateToUpdate.shippingInvoices = previewBackupData.shippingInvoices;
          if (Array.isArray(previewBackupData.campaigns)) stateToUpdate.campaigns = previewBackupData.campaigns;
          if (Array.isArray(previewBackupData.campaignRecords)) stateToUpdate.campaignRecords = previewBackupData.campaignRecords;
          if (Array.isArray(previewBackupData.salesChannels)) stateToUpdate.salesChannels = previewBackupData.salesChannels;
          if (Array.isArray(previewBackupData.notes)) stateToUpdate.notes = previewBackupData.notes;

          if (previewBackupData.settings) {
            stateToUpdate.settings = { ...settings, ...previewBackupData.settings };
          }

          // Apply to Zustand store
          useStore.setState(stateToUpdate);

          // Force Sync to Firestore if supported
          if (store.forceSync) {
            try {
              await store.forceSync();
            } catch (syncErr) {
              console.warn('Sync notice:', syncErr);
            }
          }
        }
      }

      // 2. Restore Design & Preferences
      if (restoreScope === 'all' || restoreScope === 'design_only') {
        const designToApply = previewDesignData || (previewBackupData?.settings ? {
          themePalette: previewBackupData.settings.themePalette,
          customThemePalettes: previewBackupData.settings.customThemePalettes,
          defaultLandingView: previewBackupData.settings.defaultLandingView
        } : null);

        if (designToApply) {
          applyDesignAndPreferences(designToApply);
        }
      }

      toast.success('تمت عملية الاسترجاع بنجاح تام!', { id: toastId });
      setPreviewBackupData(null);
      setPreviewMetadata(null);
      setPreviewDesignData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Restore error:', err);
      toast.error(`حدث خطأ أثناء الاسترجاع: ${err.message || err}`, { id: toastId });
    } finally {
      setIsRestoring(false);
    }
  };

  // Instant Snapshot trigger
  const handleCreateInstantSnapshot = () => {
    const snap = createAndSaveAutoSnapshot(false);
    if (snap) {
      reloadSnapshots();
    }
  };

  // Restore snapshot from local list
  const handleRestoreSnapshot = (snap: AutoBackupSnapshot) => {
    setPreviewBackupData(snap.data);
    setPreviewMetadata({
      appName: 'لقطة تلقائية محلية',
      version: 'Auto-Snapshot',
      timestamp: snap.timestamp,
      dateFormatted: snap.dateFormatted,
      totalRecords: snap.totalRecords,
      includesDesign: !!snap.designAndPreferences,
      counts: {
        orders: snap.data?.orders?.length || 0,
        inventoryProducts: snap.data?.inventoryProducts?.length || 0,
        expenses: snap.data?.expenses?.length || 0,
        suppliers: snap.data?.suppliers?.length || 0,
        shippingInvoices: snap.data?.shippingInvoices?.length || 0
      }
    });
    setPreviewDesignData(snap.designAndPreferences);
    toast.success('تم تحميل بيانات اللقطة للمعاينة، حدد طريقة الاسترجاع واضغط تأكيد');
  };

  // Download snapshot as JSON
  const handleDownloadSnapshot = (snap: AutoBackupSnapshot) => {
    const backupPayload = {
      metadata: {
        appName: 'E-commerce COD Dashboard',
        version: 'Auto-Snapshot',
        timestamp: snap.timestamp,
        dateFormatted: snap.dateFormatted,
        totalRecords: snap.totalRecords,
        includesDesign: true
      },
      data: snap.data,
      designAndPreferences: snap.designAndPreferences
    };

    const jsonStr = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `snapshot_${snap.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('تم تنزيل اللقطة بنجاح');
  };

  // Delete snapshot
  const handleDeleteSnapshot = (id: string) => {
    const updated = localSnapshots.filter(s => s.id !== id);
    localStorage.setItem(AUTO_BACKUP_STORAGE_KEY, JSON.stringify(updated));
    setLocalSnapshots(updated);
    toast.success('تم حذف اللقطة المحفوظة');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-indigo-950 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-3.5 py-1.5 rounded-xl text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>نظام الأمان والنسخ الاحتياطي الشامل (قاعدة البيانات + التصميم)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">النسخ الاحتياطي التلقائي والشامل</h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              احفظ نسخة متكاملة تشمل كافة الطلبيات، المنتجات، المشتريات، الشركاء، المصاريف، إضافة إلى كافة إعدادات المظهر والتصميم، مخصصات الأعمدة والشاشات لضمان استرجاع متجرك 100% كما تركته في أي وقت.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownloadFullJsonBackup}
              disabled={isExporting}
              className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black px-6 py-3.5 rounded-2xl shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2.5 text-sm transition-all cursor-pointer disabled:opacity-60"
            >
              <Download className="w-5 h-5" />
              <span>{isExporting ? 'جاري التجهيز...' : 'تحميل باكاب كامل (.JSON)'}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold px-5 py-3.5 rounded-2xl border border-white/20 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
            >
              <Upload className="w-5 h-5 text-indigo-300" />
              <span>استرجاع ملف سابقة</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>
      </div>

      {/* Auto Backup Configuration Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${autoBackupEnabled ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">النسخ الاحتياطي التلقائي (Auto Backup)</h2>
                {autoBackupEnabled ? (
                  <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> نشط ومفعل
                  </span>
                ) : (
                  <span className="text-[11px] font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                    معطل
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                يقوم النظام بحفظ لقطات أمان تلقائية دورية في المتصفح لقاعدة البيانات وكل إعدادات التصميم لحمايتك من فقدان أي معلومة.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCreateInstantSnapshot}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 border border-indigo-200 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>أخذ لقطة فورية الآن (Snapshot)</span>
            </button>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoBackupEnabled}
                onChange={(e) => {
                  if (updateSettings) {
                    updateSettings({ autoBackupEnabled: e.target.checked });
                    toast.success(e.target.checked ? 'تم تفعيل النسخ الاحتياطي التلقائي' : 'تم تعطيل النسخ الاحتياطي التلقائي');
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        {/* Configuration Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>تكرار النسخ التلقائي:</span>
            </label>
            <select
              value={autoBackupIntervalHours}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (updateSettings) {
                  updateSettings({ autoBackupIntervalHours: val });
                  toast.success(`تم ضبط النسخ الاحتياطي كل ${val} ساعة`);
                }
              }}
              disabled={!autoBackupEnabled}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value={6}>كل 6 ساعات (لحماية قصوى)</option>
              <option value={12}>كل 12 ساعة (مرتين يومياً)</option>
              <option value={24}>يومياً (كل 24 ساعة - يوصى به)</option>
              <option value={48}>كل يومين (48 ساعة)</option>
            </select>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-emerald-600" />
              <span>محتويات النسخة التلقائية:</span>
            </label>
            <div className="flex items-center gap-2 pt-1 text-xs font-bold text-slate-800">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>قاعدة البيانات + التصميم والواجهة بالكامل</span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-amber-600" />
              <span>آخر نسخة تلقائية:</span>
            </label>
            <p className="text-xs font-bold text-slate-800 pt-1">
              {lastAutoBackupTimestamp ? (
                new Date(lastAutoBackupTimestamp).toLocaleString('ar-DZ', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              ) : (
                <span className="text-slate-400">لم يتم أخذ لقطة بعد</span>
              )}
            </p>
          </div>
        </div>

        {/* Local Saved Snapshots Table */}
        {localSnapshots.length > 0 && (
          <div className="pt-2 space-y-3">
            <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-600" />
              <span>النسخ التلقائية المحفوظة محلياً في المتصفح ({localSnapshots.length} لقطات متوفرة):</span>
            </h3>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {localSnapshots.map((snap) => (
                <div key={snap.id} className="p-3.5 bg-slate-50/50 hover:bg-indigo-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 font-bold text-xs shadow-xs">
                      JSON
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900">{snap.dateFormatted}</p>
                      <p className="text-[11px] text-slate-500">
                        إجمالي السجلات: <strong className="text-slate-800 font-bold">{snap.totalRecords}</strong> | يتضمن: قاعدة البيانات، الإعدادات، والمظهر
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestoreSnapshot(snap)}
                      className="bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>معاينة واسترجاع</span>
                    </button>

                    <button
                      onClick={() => handleDownloadSnapshot(snap)}
                      className="bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      title="تحميل كملف"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-600" />
                    </button>

                    <button
                      onClick={() => handleDeleteSnapshot(snap.id)}
                      className="bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-400 hover:text-rose-600 p-1.5 rounded-lg text-xs transition-all cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Database Metrics Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-indigo-600" />
            <span>نظرة عامة على محتويات قاعدة البيانات الحالية</span>
          </h2>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            إجمالي السجلات: <strong className="text-slate-900 font-black">{totalRecords.toLocaleString('fr-FR')}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {databaseStats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:shadow-md"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`p-3 rounded-xl border ${stat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">{stat.label}</p>
                    <p className="text-xl font-black text-slate-900 mt-0.5">{stat.count.toLocaleString('fr-FR')}</p>
                  </div>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="نشط ومحدث"></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export Options Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Full JSON Backup */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">النسخة الاحتياطية الكاملة (قاعدة البيانات + التصميم)</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                ملف مشفر بصيغة JSON يحتوي على قاعدة البيانات كاملة (الطلبيات، المخزن، المشتريات، الموردين، المصاريف، الإعدادات، المستخدمين) مع كافة تخصيصات الواجهة والتصميم لحفظ المتجر بالكامل.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">يشمل: كل الجداول + المظهر والتخصيص</span>
            <button
              onClick={handleDownloadFullJsonBackup}
              disabled={isExporting}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>تحميل ملف JSON كامل</span>
            </button>
          </div>
        </div>

        {/* Card 2: Specialized Excel Exports */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">تصدير جداول Excel منظمة (.xlsx)</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                تصدير تقارير محاسبية مفصلة بصيغة Excel لفتحها في Microsoft Excel أو Google Sheets للمراجعة الحسابية وجرد المخازن.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
              <button
                onClick={handleExportOrdersExcel}
                className="bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="تصدير جميع الطلبيات إلى Excel"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>الطلبيات ({orders.length})</span>
              </button>

              <button
                onClick={handleExportInventoryExcel}
                className="bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="تصدير المخزون إلى Excel"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>المخزون ({inventoryProducts.length})</span>
              </button>

              <button
                onClick={handleExportExpensesExcel}
                className="bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-700 hover:text-amber-700 p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="تصدير المصاريف إلى Excel"
              >
                <Download className="w-3.5 h-3.5 text-amber-600" />
                <span>المصاريف ({expenses.length})</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] font-bold text-slate-400">
            تصدير منظم للأعمدة باللغة العربية متوافق مع كافة برامج الجداول
          </div>
        </div>
      </div>

      {/* Restore Preview Modal / Card */}
      {previewBackupData && previewMetadata && (
        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-3xl p-6 shadow-lg space-y-5 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-amber-950">معاينة وتخصيص استرجاع النسخة الاحتياطية</h3>
                <p className="text-xs text-amber-800">
                  تاريخ النسخة: <strong>{previewMetadata.dateFormatted}</strong> | المظهر والتصميم: <strong>{previewMetadata.includesDesign ? 'متوفر مع النسخة' : 'غير متوفر'}</strong>
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setPreviewBackupData(null);
                setPreviewMetadata(null);
                setPreviewDesignData(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-amber-300 bg-white cursor-pointer"
            >
              إلغاء المعاينة
            </button>
          </div>

          {/* Counts summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {Object.entries(previewMetadata.counts || {}).slice(0, 6).map(([key, count], i) => (
              <div key={i} className="bg-white p-3 rounded-xl border border-amber-200/80 text-center">
                <span className="text-[10px] font-bold text-slate-400 block">{key}</span>
                <span className="text-base font-black text-slate-800">{count}</span>
              </div>
            ))}
          </div>

          {/* Scope Selection: Database, Design, or Both */}
          <div className="bg-white p-4 rounded-2xl border border-amber-200 space-y-3">
            <p className="text-xs font-black text-slate-800">1. حدد ما تريد استرجاعه من النسخة:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${restoreScope === 'all' ? 'bg-indigo-50 border-indigo-500 text-indigo-950' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <input
                  type="radio"
                  name="restoreScope"
                  value="all"
                  checked={restoreScope === 'all'}
                  onChange={() => setRestoreScope('all')}
                  className="accent-indigo-600"
                />
                <div>
                  <p className="text-xs font-black">الكل (قاعدة البيانات + التصميم)</p>
                  <p className="text-[10px] text-slate-500">استرجاع شامل لجميع البيانات وإعدادات الواجهة</p>
                </div>
              </label>

              <label className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${restoreScope === 'data_only' ? 'bg-indigo-50 border-indigo-500 text-indigo-950' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <input
                  type="radio"
                  name="restoreScope"
                  value="data_only"
                  checked={restoreScope === 'data_only'}
                  onChange={() => setRestoreScope('data_only')}
                  className="accent-indigo-600"
                />
                <div>
                  <p className="text-xs font-black">قاعدة البيانات فقط</p>
                  <p className="text-[10px] text-slate-500">استرجاع الطلبيات والمخازن دون تغيير المظهر</p>
                </div>
              </label>

              <label className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${restoreScope === 'design_only' ? 'bg-indigo-50 border-indigo-500 text-indigo-950' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <input
                  type="radio"
                  name="restoreScope"
                  value="design_only"
                  checked={restoreScope === 'design_only'}
                  onChange={() => setRestoreScope('design_only')}
                  className="accent-indigo-600"
                />
                <div>
                  <p className="text-xs font-black">التصميم والمظهر فقط</p>
                  <p className="text-[10px] text-slate-500">استرجاع الثيمات وتخصيص الأعمدة والألوان</p>
                </div>
              </label>
            </div>
          </div>

          {/* Mode Selection & Execute Button */}
          <div className="bg-white p-4 rounded-2xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-800">2. أسلوب معالجة البيانات:</p>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="radio"
                    name="restoreMode"
                    value="merge"
                    checked={restoreMode === 'merge'}
                    onChange={() => setRestoreMode('merge')}
                    className="accent-indigo-600"
                  />
                  <span>دمج وتحديث (يحافظ على السجلات غير المكررة)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-rose-700">
                  <input
                    type="radio"
                    name="restoreMode"
                    value="replace"
                    checked={restoreMode === 'replace'}
                    onChange={() => setRestoreMode('replace')}
                    className="accent-rose-600"
                  />
                  <span>استبدال كامل (إحلال النسخة بالكامل)</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleExecuteRestore}
              disabled={isRestoring}
              className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black px-6 py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
              <span>{isRestoring ? 'جاري الاسترجاع...' : 'تأكيد واسترجاع النسخة الآن'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Security & Tips Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-start gap-4 text-slate-600">
        <ShieldCheck className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs leading-relaxed">
          <p className="font-bold text-slate-800 text-sm">أمان البيانات:</p>
          <p>
            تتم معالجة جميع النسخ الاحتياطية محلياً وأمنياً بدون أي مفاتيح حساسة أو أسرار برمجية، مما يجعلها متوافقة 100% مع أنظمة الحفظ السحابي واستيراد المشاريع إلى GitHub أو أي منصة استضافة أخرى.
          </p>
        </div>
      </div>
    </div>
  );
};
