import { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import toast from 'react-hot-toast';

export interface AutoBackupSnapshot {
  id: string;
  timestamp: string;
  dateFormatted: string;
  totalRecords: number;
  data: any;
  designAndPreferences: any;
}

export const AUTO_BACKUP_STORAGE_KEY = 'auto_backups_snapshots';
const MAX_SNAPSHOTS = 5;

// Helper to collect all design and layout preferences from localStorage and settings
export function collectDesignAndPreferences(settings: any) {
  return {
    themePalette: settings?.themePalette || 'classic',
    customThemePalettes: settings?.customThemePalettes || [],
    defaultLandingView: settings?.defaultLandingView || 'dashboard',
    sidebar_mode: localStorage.getItem('sidebar_mode') || 'full',
    sidebar_view_mode: localStorage.getItem('sidebar_view_mode') || 'list',
    sidebar_order: localStorage.getItem('sidebar_order'),
    layout_header_collapsed: localStorage.getItem('layout_header_collapsed'),
    layout_productbar_collapsed: localStorage.getItem('layout_productbar_collapsed'),
    layout_syncbar_collapsed: localStorage.getItem('layout_syncbar_collapsed'),
    app_default_landing_view: localStorage.getItem('app_default_landing_view'),
    orders_visible_columns: localStorage.getItem('orders_visible_columns'),
    orders_viewMode: localStorage.getItem('orders_viewMode'),
    orders_hiddenStatuses: localStorage.getItem('orders_hiddenStatuses'),
    orders_hiddenStatuses2: localStorage.getItem('orders_hiddenStatuses2'),
    orders_hiddenTags: localStorage.getItem('orders_hiddenTags'),
    orders_hiddenChannels: localStorage.getItem('orders_hiddenChannels'),
    orders_pageSize: localStorage.getItem('orders_pageSize'),
    suivi_card_layout: localStorage.getItem('suivi_card_layout'),
    suivi_grid_columns: localStorage.getItem('suivi_grid_columns'),
    suivi_quick_templates: localStorage.getItem('suivi_quick_templates'),
    finance_active_chart_tab: localStorage.getItem('finance_active_chart_tab'),
    app_sections_card_collapsed: localStorage.getItem('app_sections_card_collapsed'),
    applet_saved_layout_views: localStorage.getItem('applet_saved_layout_views')
  };
}

// Helper to create and save a new snapshot
export function createAndSaveAutoSnapshot(silent: boolean = false): AutoBackupSnapshot | null {
  try {
    const store = useStore.getState();
    const {
      orders = [],
      abandonedOrders = [],
      inventoryProducts = [],
      inventoryMovements = [],
      expenses = [],
      partners = [],
      partnerTransactions = [],
      suppliers = [],
      purchaseInvoices = [],
      supplierPayments = [],
      shippingInvoices = [],
      shippingBureaus = [],
      shippingDesks = [],
      campaigns = [],
      campaignRecords = [],
      campaignFields = [],
      salesChannels = [],
      settings = {},
      notes = [],
      users = []
    } = store;

    const totalRecords =
      orders.length + abandonedOrders.length + inventoryProducts.length +
      inventoryMovements.length + expenses.length + partners.length +
      partnerTransactions.length + suppliers.length + purchaseInvoices.length +
      supplierPayments.length + shippingInvoices.length + shippingBureaus.length +
      campaigns.length + campaignRecords.length + salesChannels.length +
      notes.length + users.length;

    const now = new Date();
    const formattedDate = now.toLocaleDateString('ar-DZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const snapshot: AutoBackupSnapshot = {
      id: `snapshot_${now.getTime()}`,
      timestamp: now.toISOString(),
      dateFormatted: formattedDate,
      totalRecords,
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
      designAndPreferences: collectDesignAndPreferences(settings)
    };

    // Load existing snapshots
    let existing: AutoBackupSnapshot[] = [];
    try {
      const stored = localStorage.getItem(AUTO_BACKUP_STORAGE_KEY);
      if (stored) {
        existing = JSON.parse(stored);
      }
    } catch (_) {
      existing = [];
    }

    // Keep up to MAX_SNAPSHOTS (newest first)
    const updated = [snapshot, ...existing.filter(s => s.id !== snapshot.id)].slice(0, MAX_SNAPSHOTS);
    localStorage.setItem(AUTO_BACKUP_STORAGE_KEY, JSON.stringify(updated));

    // Update settings timestamp
    if (store.updateSettings) {
      store.updateSettings({ lastAutoBackupTimestamp: now.toISOString() });
    }

    if (!silent) {
      toast.success(`تم حفظ نسخة احتياطية تلقائية بنجاح (${totalRecords} سجل + إعدادات المظهر والواجهة)`, {
        icon: '🛡️',
        duration: 4000
      });
    }

    return snapshot;
  } catch (err: any) {
    console.error('Failed to create auto backup snapshot:', err);
    return null;
  }
}

export function AutoBackupManager() {
  const autoBackupEnabled = useStore(state => state.settings?.autoBackupEnabled ?? true);
  const autoBackupIntervalHours = useStore(state => state.settings?.autoBackupIntervalHours || 24);
  const lastAutoBackupTimestamp = useStore(state => state.settings?.lastAutoBackupTimestamp);
  const isInitialCheckDone = useRef(false);

  useEffect(() => {
    if (!autoBackupEnabled) return;

    const checkAndRunAutoBackup = () => {
      const intervalMs = (autoBackupIntervalHours || 24) * 60 * 60 * 1000;
      const lastTime = lastAutoBackupTimestamp ? new Date(lastAutoBackupTimestamp).getTime() : 0;
      const now = Date.now();

      // If never backed up or interval elapsed, trigger snapshot
      if (!lastTime || (now - lastTime >= intervalMs)) {
        createAndSaveAutoSnapshot(false);
      }
    };

    // Run once on initial startup after slight delay
    if (!isInitialCheckDone.current) {
      isInitialCheckDone.current = true;
      const initialTimer = setTimeout(() => {
        checkAndRunAutoBackup();
      }, 5000);
      return () => clearTimeout(initialTimer);
    }

    // Check periodically every 5 minutes
    const intervalId = setInterval(checkAndRunAutoBackup, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [autoBackupEnabled, autoBackupIntervalHours, lastAutoBackupTimestamp]);

  return null;
}
