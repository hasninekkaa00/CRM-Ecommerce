import toast from 'react-hot-toast';
import { create } from 'zustand';
import { 
  Order, AbandonedOrder, Campaign, CampaignRecord, CampaignField, 
  SalesChannel, SystemSettings, Expense, InventoryProduct, Supplier, 
  PurchaseInvoice, SupplierPayment, ShippingInvoice, Partner, PartnerTransaction, 
  AppUser, ConfirmerInvoice, AutoAssignmentStrategy, OrderTag 
} from '../types';
import { DEFAULT_TAGS } from '../utils/tagUtils';
import { db, safeFirestoreWrite } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, writeBatch, arrayUnion } from 'firebase/firestore';
import { fetchCompanyFeesAPI, getWilayaFeeFromFeesData, extractWilayaCode, isStopDeskOrder, calculateDefaultShippingFee, resolveOrderRealShippingPrice, getEffectiveShippingCost } from '../utils/shippingFees';
import { 
  checkProductDeletionIntegrity, 
  checkSalesChannelDeletionIntegrity, 
  checkUserDeletionIntegrity, 
  checkSupplierDeletionIntegrity, 
  checkPurchaseInvoiceDeletionIntegrity, 
  checkOrderDeletionIntegrity,
  DataIntegrityError 
} from '../utils/dataIntegrity';
import { triggerStatusNotification } from '../utils/notifications';
import { recordDeletedItem, removeDeletedRecord, getDeletedHistory } from '../utils/undoManager';
import { showUndoToast } from '../utils/undoToast';
import { universalSyncWooCommerce } from '../utils/universalWooCommerceApi';

let cachedFeesData: any = null;
let lastFeesFetchTime = 0;

async function getOrFetchCompanyFees(integration: any) {
  const now = Date.now();
  if (cachedFeesData && (now - lastFeesFetchTime < 300000)) {
    return cachedFeesData;
  }
  const data = await fetchCompanyFeesAPI(integration);
  if (data) {
    cachedFeesData = data;
    lastFeesFetchTime = now;
  }
  return data;
}

export async function calculateRealShippingFeeForOrder(order: any, settings: any): Promise<number> {
  if (!order) return 650;

  const integration = settings?.shippingIntegrations?.find((i: any) => i.name === order.deliveryCompany && i.isActive)
                   || settings?.shippingIntegrations?.find((i: any) => i.isActive);

  if (integration && integration.token) {
    try {
      const feesData = await getOrFetchCompanyFees(integration);
      if (feesData) {
        const wilayaId = extractWilayaCode(order);
        const isStopDesk = isStopDeskOrder(order);
        const fee = getWilayaFeeFromFeesData(feesData, wilayaId, isStopDesk);
        if (fee && fee > 0) return fee;
      }
    } catch (e) {
      console.warn('Could not fetch fees from carrier integration', e);
    }
  }

  const wilayaId = extractWilayaCode(order);
  const isStopDesk = isStopDeskOrder(order);
  const def = calculateDefaultShippingFee(wilayaId, isStopDesk);
  return def.realDeliveryPrice || 650;
}

const triggerSmsForStatus = async (order: any, status: string, settings: any) => {
  if (!settings || !settings.smsEnabled) return;
  
  const autoSendStatuses = settings.smsAutoSendOnStatus || [];
  if (!autoSendStatuses.includes(status)) return;

  const templates = settings.smsTemplates || {};
  let templateKey = '';
  if (status === 'مؤكد') templateKey = 'confirmation';
  else if (status === 'تم الشحن') templateKey = 'shipping';
  else if (status === 'في الطريق') templateKey = 'out_for_delivery';
  else if (status === 'مرتجع') templateKey = 'return';

  if (!templateKey) return;

  const rawTemplate = templates[templateKey] || '';
  if (!rawTemplate) return;

  // Replace placeholders
  const message = rawTemplate
    .replace(/{customer_name}/g, order.customerName || order.fullName || '')
    .replace(/{order_id}/g, order.orderId || '')
    .replace(/{tracking_id}/g, order.shippingTrackingId || '')
    .replace(/{delivery_company}/g, order.deliveryCompany || '')
    .replace(/{store_name}/g, order.sourceChannel || 'متجرنا')
    .replace(/{total}/g, `${order.totalCharge || 0}`);

  const phone = order.phone || '';
  if (!phone) {
    console.log('Skipping SMS: No phone number in order');
    return;
  }

  console.log(`Sending auto SMS to ${phone} for status ${status}:`, message);

  try {
    const response = await fetch('/api/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        gateway: settings.smsGateway || 'sms_algerie',
        to: phone,
        message,
        smsAlgerieToken: settings.smsAlgerieToken || '',
        smsAlgerieSender: settings.smsAlgerieSender || '',
        smsTwilioSid: settings.smsTwilioSid || '',
        smsTwilioToken: settings.smsTwilioToken || '',
        smsTwilioNumber: settings.smsTwilioNumber || ''
      })
    });
    const result = await response.json();
    console.log('Auto SMS send result:', result);
    
    // Add note to order history
    if (result.success) {
      try {
        const docRef = doc(db, 'orders', order.id);
        const orderNotes = order.notes || '';
        await updateDoc(docRef, {
          notes: (orderNotes ? orderNotes + '\n' : '') + `[إرسال آلي SMS]: تم إرسال إشعار للزبون لتغيير الحالة لـ "${status}" بنجاح.`
        });
      } catch (noteErr) {
        console.error('Failed to append notes for auto SMS:', noteErr);
      }
    }
  } catch (err) {
    console.error('Failed to send auto SMS:', err);
  }
};

export interface AppState {
  createConsignmentSettlement: (supplierId: string, invoice: any, orderIds: string[]) => Promise<void>;
  notes: import('../types').Note[];
  addNote: (note: import('../types').Note) => Promise<void>;
  updateNote: (id: string, updates: Partial<import('../types').Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  orders: Order[];
  abandonedOrders: AbandonedOrder[];
  campaigns: Campaign[];
  campaignRecords: CampaignRecord[];
  campaignFields: CampaignField[];
  salesChannels: SalesChannel[];
  settings: SystemSettings | null;
  expenses: Expense[];
  partners: Partner[];
  partnerTransactions: PartnerTransaction[];
  inventoryProducts: InventoryProduct[];
  inventoryMovements: import('../types').InventoryMovement[];
  suppliers: Supplier[];
  purchaseInvoices: PurchaseInvoice[];
  supplierPayments: SupplierPayment[];
  shippingInvoices: ShippingInvoice[];
  shippingBureaus: import('../types').ShippingBureau[];
  shippingDesks: Record<string, any[]>;
  fetchShippingDesks: (companyName: string) => Promise<void>;
  users: AppUser[];
  currentUserProfile: AppUser | null;
  confirmerInvoices: ConfirmerInvoice[];
  syncProgress: { isSyncing: boolean; message: string; percent: number; label?: string } | null;
  nextSyncTime: number | null;
  
  undoHistory: { id: string; label: string; timestamp: number; undoFn: () => Promise<void> }[];
  pushUndo: (label: string, undoFn: () => Promise<void>) => void;
  popUndo: () => Promise<void>;
  clearUndoHistory: () => void;
  
  // Tracking Sync Queue
  trackingQueue: string[];
  trackingQueueTotal: number;
  isTrackingQueueProcessing: boolean;
  currentTrackingProcessingId: string | null;
  addToTrackingQueue: (ids: string[]) => void;
  setTrackingQueueState: (updates: Partial<{
    trackingQueue: string[];
    trackingQueueTotal: number;
    isTrackingQueueProcessing: boolean;
  currentTrackingProcessingId: string | null;
  }>) => void;
  clearTrackingQueue: () => void;
  
  globalProductFilter: string;
  setGlobalProductFilter: (filter: string) => void;

  setNotes: (notes: import('../types').Note[]) => void;
  setOrders: (orders: Order[]) => void;
  setAbandonedOrders: (orders: AbandonedOrder[]) => void;
  setCampaigns: (campaigns: Campaign[]) => void;
  setCampaignRecords: (records: CampaignRecord[]) => void;
  setCampaignFields: (fields: CampaignField[]) => void;
  setSalesChannels: (channels: SalesChannel[]) => void;
  setSettings: (settings: SystemSettings | null) => void;
  setExpenses: (expenses: Expense[]) => void;
  setPartners: (partners: Partner[]) => void;
  setPartnerTransactions: (transactions: PartnerTransaction[]) => void;
  setInventoryProducts: (products: InventoryProduct[]) => void;
  setInventoryMovements: (movements: import('../types').InventoryMovement[]) => void;
  setUsers: (users: AppUser[]) => void;
  setCurrentUserProfile: (user: AppUser | null) => void;
  setConfirmerInvoices: (invoices: ConfirmerInvoice[]) => void;
  addConfirmerInvoice: (invoice: ConfirmerInvoice) => Promise<void>;
  updateConfirmerInvoice: (id: string, updates: Partial<ConfirmerInvoice>) => Promise<void>;
  deleteConfirmerInvoice: (id: string) => Promise<void>;
  assignOrders: (orderIds: string[], confirmerId: string, confirmerName: string) => Promise<void>;
  unassignOrders: (orderIds: string[]) => Promise<void>;
  autoAssignPendingOrders: (orderIds?: string[], strategyOverride?: AutoAssignmentStrategy) => Promise<{ assignedCount: number; summary: Record<string, number> }>;
  claimNextUnassignedOrder: (confirmerId: string, confirmerName: string) => Promise<Order | null>;
  addInventoryMovement: (movement: import('../types').InventoryMovement) => Promise<void>;
  updateInventoryMovement: (id: string, updates: Partial<import('../types').InventoryMovement>) => Promise<void>;
  deleteInventoryMovement: (id: string) => Promise<void>;
  deleteInventoryProduct: (productId: string, force?: boolean) => Promise<void>;
  recordStockAdjustment: (params: {
    productId: string;
    variationId?: string | null;
    changeQty: number;
    typeName: string;
    date?: string;
    note?: string;
  }) => Promise<void>;
  setSuppliers: (suppliers: Supplier[]) => void;
  setPurchaseInvoices: (invoices: PurchaseInvoice[]) => void;
  setSupplierPayments: (payments: SupplierPayment[]) => void;
  setShippingInvoices: (invoices: ShippingInvoice[]) => void;
  setShippingBureaus: (bureaus: import('../types').ShippingBureau[]) => void;
  setSyncProgress: (progress: { isSyncing: boolean; message: string; percent: number; label?: string } | null) => void;
  setNextSyncTime: (time: number | null) => void;

  addOrder: (order: Order) => Promise<void>;
  updateOrder: (id: string, updates: Partial<Order>, skipUndo?: boolean) => Promise<void>;
  deleteOrder: (id: string, force?: boolean) => Promise<void>;
  bulkDeleteOrders: (ids: string[]) => Promise<void>;
  
  addAbandonedOrder: (order: AbandonedOrder) => Promise<void>;
  updateAbandonedOrder: (id: string, updates: Partial<AbandonedOrder>) => Promise<void>;
  deleteAbandonedOrder: (id: string) => Promise<void>;
  bulkDeleteAbandonedOrders: (ids: string[]) => Promise<void>;
  
  addCampaign: (campaign: Campaign) => Promise<void>;
  updateCampaign: (id: string, updates: Partial<Campaign>) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;

  addCampaignRecord: (record: CampaignRecord) => Promise<void>;
  updateCampaignRecord: (id: string, updates: Partial<CampaignRecord>) => Promise<void>;
  deleteCampaignRecord: (id: string) => Promise<void>;
  
  addCampaignField: (field: CampaignField) => Promise<void>;
  updateCampaignField: (id: string, updates: Partial<CampaignField>) => Promise<void>;
  removeCampaignField: (id: string) => Promise<void>;
  
  addSalesChannel: (channel: SalesChannel) => Promise<void>;
  updateSalesChannel: (id: string, updates: Partial<SalesChannel>) => Promise<void>;
  deleteSalesChannel: (id: string, force?: boolean) => Promise<void>;

  updateSettings: (updates: Partial<SystemSettings>) => Promise<void>;
  addTag: (tag: OrderTag) => Promise<void>;
  removeTag: (tagName: string) => Promise<void>;
  updateTag: (oldName: string, updatedTag: OrderTag) => Promise<void>;

  addExpense: (expense: Expense) => Promise<void>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  addPartner: (partner: Partner) => Promise<void>;
  updatePartner: (id: string, updates: Partial<Partner>) => Promise<void>;
  deletePartner: (id: string) => Promise<void>;

  addPartnerTransaction: (transaction: PartnerTransaction) => Promise<void>;
  updatePartnerTransaction: (id: string, updates: Partial<PartnerTransaction>) => Promise<void>;
  deletePartnerTransaction: (id: string) => Promise<void>;

  addUser: (user: AppUser) => Promise<void>;
  updateUser: (id: string, updates: Partial<AppUser>) => Promise<void>;
  deleteUser: (id: string, force?: boolean) => Promise<void>;

  addSupplier: (supplier: Supplier) => Promise<void>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string, force?: boolean) => Promise<void>;

  addPurchaseInvoice: (invoice: PurchaseInvoice) => Promise<void>;
  updatePurchaseInvoice: (id: string, updates: Partial<PurchaseInvoice>) => Promise<void>;
  deletePurchaseInvoice: (id: string, force?: boolean) => Promise<void>;

  addSupplierPayment: (payment: SupplierPayment) => Promise<void>;
  deleteSupplierPayment: (id: string) => Promise<void>;

  addShippingInvoice: (invoice: ShippingInvoice) => Promise<void>;
  updateShippingInvoice: (id: string, updates: Partial<ShippingInvoice>) => Promise<void>;
  deleteShippingInvoice: (id: string) => Promise<void>;

  addShippingBureau: (bureau: import('../types').ShippingBureau) => Promise<void>;
  updateShippingBureau: (id: string, updates: Partial<import('../types').ShippingBureau>) => Promise<void>;
  deleteShippingBureau: (id: string) => Promise<void>;
  bulkUpsertShippingBureaus: (bureaus: import('../types').ShippingBureau[]) => Promise<void>;

  bulkUpsertInventory: (products: InventoryProduct[]) => Promise<void>;
  restoreDeletedItem: (recordId: string) => Promise<void>;
  forceSync: () => Promise<void>;
  deduplicateOrders: () => Promise<{ mergedCount: number; deletedCount: number }>;
  deduplicateAbandonedOrders: () => Promise<{ mergedCount: number; deletedCount: number }>;
}

export const useStore = create<AppState>()((set, get) => ({
  notes: [],
  orders: [],
  abandonedOrders: [],
  campaigns: [],
  campaignRecords: [],
  campaignFields: [],
  salesChannels: [],
  settings: null,
  expenses: [],
  partners: [],
  partnerTransactions: [],
  inventoryProducts: [],
  inventoryMovements: [],
  suppliers: [],
  purchaseInvoices: [],
  supplierPayments: [],
  shippingInvoices: [],
  shippingBureaus: [],
  shippingDesks: {},
  users: [],
  currentUserProfile: null,
  confirmerInvoices: [],
  syncProgress: null,
  nextSyncTime: null,
  undoHistory: [],
  trackingQueue: [],
  trackingQueueTotal: 0,
  isTrackingQueueProcessing: false,
  currentTrackingProcessingId: null,
  globalProductFilter: typeof window !== 'undefined' ? (localStorage.getItem('globalProductFilter') || 'all') : 'all',
  setGlobalProductFilter: (filter) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('globalProductFilter', filter);
    }
    set((state) => (state.globalProductFilter === filter ? state : { globalProductFilter: filter }));
  },
  setSyncProgress: (syncProgress) => set((state) => (state.syncProgress === syncProgress ? state : { syncProgress })),
  setNextSyncTime: (nextSyncTime) => set((state) => (state.nextSyncTime === nextSyncTime ? state : { nextSyncTime })),

  pushUndo: (label, undoFn) => {
    set((state) => {
      const newAction = { id: Date.now().toString() + Math.random().toString(36).substr(2, 5), label, timestamp: Date.now(), undoFn };
      // Keep only last 10 actions to avoid memory issues
      const newHistory = [newAction, ...state.undoHistory].slice(0, 10);
      return { undoHistory: newHistory };
    });
  },
  popUndo: async () => {
    const state = get();
    if (state.undoHistory.length === 0) return;
    const action = state.undoHistory[0];
    try {
      await action.undoFn();
      set((s) => ({ undoHistory: s.undoHistory.slice(1) }));
      toast.success(`تم التراجع عن: ${action.label}`);
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء التراجع');
    }
  },
  clearUndoHistory: () => set({ undoHistory: [] }),
  addToTrackingQueue: (ids) => {
    const { trackingQueue, isTrackingQueueProcessing, trackingQueueTotal } = get();
    const uniqueNewIds = ids.filter(id => !trackingQueue.includes(id));
    if (uniqueNewIds.length === 0) return;
    
    set((state) => {
      const newQueue = [...state.trackingQueue, ...uniqueNewIds];
      return {
        trackingQueue: newQueue,
        trackingQueueTotal: isTrackingQueueProcessing ? trackingQueueTotal + uniqueNewIds.length : newQueue.length
      };
    });
  },
  setTrackingQueueState: (updates) => set((state) => ({ ...state, ...updates })),
  clearTrackingQueue: () => set({ trackingQueue: [], trackingQueueTotal: 0, isTrackingQueueProcessing: false }),

  setNotes: (notes) => set((state) => (state.notes === notes ? state : { notes })),
  setOrders: (orders) => set((state) => (state.orders === orders ? state : { orders })),
  setAbandonedOrders: (abandonedOrders) => set((state) => (state.abandonedOrders === abandonedOrders ? state : { abandonedOrders })),
  setCampaigns: (campaigns) => set((state) => (state.campaigns === campaigns ? state : { campaigns })),
  setCampaignRecords: (campaignRecords) => set((state) => (state.campaignRecords === campaignRecords ? state : { campaignRecords })),
  setCampaignFields: (campaignFields) => set((state) => (state.campaignFields === campaignFields ? state : { campaignFields })),
  setSalesChannels: (salesChannels) => set((state) => (state.salesChannels === salesChannels ? state : { salesChannels })),
  setSettings: (settings) => set((state) => (state.settings === settings ? state : { settings })),
  setExpenses: (expenses) => set((state) => (state.expenses === expenses ? state : { expenses })),
  setPartners: (partners) => set((state) => (state.partners === partners ? state : { partners })),
  setPartnerTransactions: (partnerTransactions) => set((state) => (state.partnerTransactions === partnerTransactions ? state : { partnerTransactions })),
  setInventoryProducts: (inventoryProducts) => set((state) => (state.inventoryProducts === inventoryProducts ? state : { inventoryProducts })),
  setInventoryMovements: (inventoryMovements) => set((state) => (state.inventoryMovements === inventoryMovements ? state : { inventoryMovements })),
  setUsers: (users) => set((state) => (state.users === users ? state : { users })),
  setCurrentUserProfile: (currentUserProfile) => set((state) => (state.currentUserProfile === currentUserProfile ? state : { currentUserProfile })),
  setConfirmerInvoices: (confirmerInvoices) => set((state) => (state.confirmerInvoices === confirmerInvoices ? state : { confirmerInvoices })),
  addInventoryMovement: async (movement) => {
    const cleanMovement = JSON.parse(JSON.stringify(movement));
    set((state) => ({ 
      inventoryMovements: [cleanMovement, ...state.inventoryMovements.filter(m => m.id !== cleanMovement.id)] 
    }));
    await safeFirestoreWrite(() => setDoc(doc(db, 'inventoryMovements', cleanMovement.id), cleanMovement), 'addInventoryMovement');
  },
  updateInventoryMovement: async (id, updates) => {
    const state = get();
    const mov = state.inventoryMovements.find(m => m.id === id);
    if (!mov) return;

    const updatedMov = JSON.parse(JSON.stringify({ ...mov, ...updates }));
    const changeQtyDiff = (updates.changeQty !== undefined ? updates.changeQty : mov.changeQty) - mov.changeQty;

    if (changeQtyDiff !== 0) {
      const product = state.inventoryProducts.find(p => p.id === mov.productId);
      if (product) {
        const updatedProduct = { ...product };
        if (mov.variationId && updatedProduct.variations && Array.isArray(updatedProduct.variations)) {
          const vIndex = updatedProduct.variations.findIndex((v: any) => v.id === mov.variationId || `${updatedProduct.id}-${v.name}` === mov.variationId);
          if (vIndex !== -1) {
            const v = updatedProduct.variations[vIndex];
            const curStock = Number(v.local_stock_quantity ?? v.stock_quantity ?? 0);
            const newStock = curStock + changeQtyDiff;
            updatedProduct.variations = [...updatedProduct.variations];
            updatedProduct.variations[vIndex] = {
              ...v,
              local_stock_quantity: newStock,
              stock_quantity: newStock,
              local_manage_stock: true
            };
            updatedMov.newStock = newStock;
          }
        } else {
          const curStock = Number(updatedProduct.local_stock_quantity ?? updatedProduct.stock_quantity ?? 0);
          const newStock = curStock + changeQtyDiff;
          updatedProduct.local_stock_quantity = newStock;
          updatedProduct.stock_quantity = newStock;
          updatedProduct.local_manage_stock = true;
          updatedMov.newStock = newStock;
        }
        set((s) => ({
          inventoryProducts: s.inventoryProducts.map(p => p.id === product.id ? updatedProduct : p)
        }));
        await safeFirestoreWrite(() => setDoc(doc(db, 'inventory', product.id), JSON.parse(JSON.stringify(updatedProduct))), 'updateInventory');
      }
    }

    set((s) => ({
      inventoryMovements: s.inventoryMovements.map(m => m.id === id ? updatedMov : m)
    }));
    await safeFirestoreWrite(() => setDoc(doc(db, 'inventoryMovements', id), JSON.parse(JSON.stringify(updatedMov))), 'updateInventoryMovement');
  },
  deleteInventoryMovement: async (id) => {
    const state = get();
    const mov = state.inventoryMovements.find(m => m.id === id);
    let updatedProduct: any = null;

    if (mov) {
      // Reverse the movement effect on stock
      const product = state.inventoryProducts.find(p => p.id === mov.productId);
      if (product) {
        updatedProduct = { ...product };
        if (mov.variationId && updatedProduct.variations && Array.isArray(updatedProduct.variations)) {
          const vIndex = updatedProduct.variations.findIndex((v: any) => v.id === mov.variationId || `${updatedProduct.id}-${v.name}` === mov.variationId);
          if (vIndex !== -1) {
            const v = updatedProduct.variations[vIndex];
            const curStock = Number(v.local_stock_quantity ?? v.stock_quantity ?? 0);
            const reversedStock = curStock - mov.changeQty;
            updatedProduct.variations = [...updatedProduct.variations];
            updatedProduct.variations[vIndex] = {
              ...v,
              local_stock_quantity: reversedStock,
              stock_quantity: reversedStock
            };
          }
        } else {
          const curStock = Number(updatedProduct.local_stock_quantity ?? updatedProduct.stock_quantity ?? 0);
          const reversedStock = curStock - mov.changeQty;
          updatedProduct.local_stock_quantity = reversedStock;
          updatedProduct.stock_quantity = reversedStock;
        }

        await safeFirestoreWrite(() => setDoc(doc(db, 'inventory', product.id), JSON.parse(JSON.stringify(updatedProduct))), 'deleteInventoryMovement stock restore');
      }
    }

    set((s) => ({
      inventoryProducts: updatedProduct ? s.inventoryProducts.map(p => p.id === updatedProduct.id ? updatedProduct : p) : s.inventoryProducts,
      inventoryMovements: s.inventoryMovements.filter(m => m.id !== id)
    }));

    await safeFirestoreWrite(() => deleteDoc(doc(db, 'inventoryMovements', id)), 'deleteInventoryMovement');
  },
  deleteInventoryProduct: async (productId: string, force?: boolean) => {
    const state = get();
    const product = state.inventoryProducts.find(p => p.id === productId);
    if (product && !force) {
      const check = checkProductDeletionIntegrity(product, {
        orders: state.orders,
        purchaseInvoices: state.purchaseInvoices,
        settings: state.settings
      });
      if (!check.canDelete) {
        throw new DataIntegrityError(check.reason, {
          title: check.title,
          details: check.details,
          suggestions: check.suggestions
        });
      }
    }

    if (product) {
      const record = recordDeletedItem({
        entityType: 'inventory_product',
        originalId: product.id,
        title: product.name,
        subtitle: `SKU: ${product.sku || 'N/A'} - المخزون: ${product.stockQuantity || 0}`,
        data: product
      });
      showUndoToast({
        record,
        customMessage: `تم حذف المنتج "${product.name}"`
      });
    }

    set((state) => ({
      inventoryProducts: state.inventoryProducts.filter(p => p.id !== productId)
    }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'inventory', productId)), 'deleteInventoryProduct');
  },
  recordStockAdjustment: async ({ productId, variationId, changeQty, typeName, date, note }) => {
    const state = get();
    const product = state.inventoryProducts.find(p => p.id === productId);
    if (!product) return;

    let oldStock = 0;
    let newStock = 0;
    let variationName = undefined;
    let sku = product.sku;

    const updatedProduct = { ...product };

    if (variationId && updatedProduct.variations && Array.isArray(updatedProduct.variations)) {
      const vIndex = updatedProduct.variations.findIndex((v: any) => v.id === variationId || `${updatedProduct.id}-${v.name}` === variationId);
      if (vIndex !== -1) {
        const v = updatedProduct.variations[vIndex];
        oldStock = Number(v.local_stock_quantity ?? v.stock_quantity ?? v.quantity ?? 0);
        newStock = oldStock + changeQty;
        variationName = v.name || v.attributes?.map((a: any) => a.option).join(' ');
        if (v.sku) sku = v.sku;

        updatedProduct.variations = [...updatedProduct.variations];
        updatedProduct.variations[vIndex] = {
          ...v,
          local_stock_quantity: newStock,
          stock_quantity: newStock,
          local_manage_stock: true
        };
      }
    } else {
      oldStock = Number(updatedProduct.local_stock_quantity ?? updatedProduct.stock_quantity ?? updatedProduct.quantity ?? 0);
      newStock = oldStock + changeQty;
      updatedProduct.local_stock_quantity = newStock;
      updatedProduct.stock_quantity = newStock;
      updatedProduct.local_manage_stock = true;
    }

    const movement: import('../types').InventoryMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      productId,
      productName: product.name || '',
      variationId: variationId || undefined,
      variationName: variationName || undefined,
      sku: sku || undefined,
      type: changeQty >= 0 ? 'addition' : 'reduction',
      typeName: typeName || '',
      oldStock,
      changeQty,
      newStock,
      date: date || new Date().toISOString(),
      note: note || ''
    };

    const cleanMovement = JSON.parse(JSON.stringify(movement));

    set((s) => ({
      inventoryProducts: s.inventoryProducts.map(p => p.id === productId ? updatedProduct : p),
      inventoryMovements: [cleanMovement, ...s.inventoryMovements.filter(m => m.id !== cleanMovement.id)]
    }));

    await safeFirestoreWrite(() => setDoc(doc(db, 'inventory', productId), JSON.parse(JSON.stringify(updatedProduct))), 'recordStockAdjustment product');
    await safeFirestoreWrite(() => setDoc(doc(db, 'inventoryMovements', cleanMovement.id), cleanMovement), 'recordStockAdjustment movement');
  },
  setSuppliers: (suppliers) => set((state) => (state.suppliers === suppliers ? state : { suppliers })),
  setPurchaseInvoices: (purchaseInvoices) => set((state) => (state.purchaseInvoices === purchaseInvoices ? state : { purchaseInvoices })),
  setSupplierPayments: (supplierPayments) => set((state) => (state.supplierPayments === supplierPayments ? state : { supplierPayments })),
  setShippingInvoices: (shippingInvoices) => set((state) => (state.shippingInvoices === shippingInvoices ? state : { shippingInvoices })),
  setShippingBureaus: (shippingBureaus) => set((state) => (state.shippingBureaus === shippingBureaus ? state : { shippingBureaus })),

  fetchShippingDesks: async (companyName: string) => {
    const state = get();
    const integration = state.settings?.shippingIntegrations?.find(i => i.name === companyName && i.isActive);
    if (!integration || !integration.token) return;
    const domain = (integration.domain || 'https://expedigo.ecotrack.dz').replace(/\/+$/, '');
    let targetDomain = domain.startsWith('http') ? domain : `https://${domain}`;
    
    try {
      const res = await fetch('/api/shipping/ecotrack/desks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: targetDomain, token: integration.token })
      });
      const json = await res.json();
      if (json && json.success && json.data) {
         let allDesks = [];
         if (json.data.my_desk) allDesks.push(json.data.my_desk);
         if (json.data.other_desks && Array.isArray(json.data.other_desks)) {
            allDesks = allDesks.concat(json.data.other_desks);
         }
         if (json.data.desks && Array.isArray(json.data.desks)) {
            allDesks = allDesks.concat(json.data.desks);
         }
         if (Array.isArray(json.data)) {
            allDesks = json.data;
         }
         
         set((s) => ({
           shippingDesks: { ...s.shippingDesks, [companyName]: allDesks }
         }));
      }
    } catch (e) {
      console.error("fetchShippingDesks error:", e);
    }
  },

  addOrder: async (order) => {
    try {
      const state = get();
      const settings = state.settings;
      
      // Blacklist check for deleted synced orders
      if (order.id && settings?.deletedWooOrderIds?.includes(order.id)) {
        return;
      }
      
      // Auto-correct city/commune names based on past manual corrections
      if (settings?.cityCorrections) {
        if (order.city && settings.cityCorrections[order.city.trim()]) {
          order.city = settings.cityCorrections[order.city.trim()];
        }
        if (order.stopdeskCommune && settings.cityCorrections[order.stopdeskCommune.trim()]) {
          order.stopdeskCommune = settings.cityCorrections[order.stopdeskCommune.trim()];
        }
      }
      
      const invProducts = state.inventoryProducts;
      
      // 🚚 حساب سعر التوصيل الأصلي الحقيقي تلقائياً فور تسجيل الطلبية
      let initialRealDeliveryPrice = order.realDeliveryPrice;
      if ((initialRealDeliveryPrice === undefined || initialRealDeliveryPrice === null || Number(initialRealDeliveryPrice) <= 0) && order.shippingFeeMode !== 'manual') {
        const wilayaId = extractWilayaCode(order);
        const isStopDesk = isStopDeskOrder(order);
        const def = calculateDefaultShippingFee(wilayaId, isStopDesk);
        initialRealDeliveryPrice = def.realDeliveryPrice;
      }

      const enrichedOrder = {
        ...order,
        status1: order.status1 || settings?.defaultStatus1 || 'جديد',
        status2: order.status2 || settings?.defaultStatus2 || '',
        confirmedBy: order.confirmedBy || settings?.defaultConfirmedBy || '',
        deliveryCompany: order.deliveryCompany || settings?.defaultDeliveryCompany || '',
        realDeliveryPrice: initialRealDeliveryPrice !== undefined ? Number(initialRealDeliveryPrice) : undefined,
        shippingFeeMode: order.shippingFeeMode || 'auto',
        ...(order.customProductCost !== undefined && order.customProductCost !== null && Number(order.customProductCost) > 0 
          ? { customProductCost: Number(order.customProductCost) } 
          : {}),
      };
      
      const exists = get().orders.find(o => {
        if (o.id === enrichedOrder.id) return true;
        const oOrderId = String(o.orderId || '').trim().replace(/^[#\-_]/, '');
        const nOrderId = String(enrichedOrder.orderId || '').trim().replace(/^[#\-_]/, '');
        const oChan = String(o.sourceChannel || '').trim().toLowerCase();
        const nChan = String(enrichedOrder.sourceChannel || '').trim().toLowerCase();
        
        const isSameChannel = !oChan || !nChan || oChan === nChan;

        if (oOrderId && nOrderId && oOrderId === nOrderId) {
          const p1 = String(o.phone || '').replace(/\D/g, '');
          const p2 = String(enrichedOrder.phone || '').replace(/\D/g, '');
          if (isSameChannel || (p1 && p2 && p1 === p2)) {
            return true;
          }
        }
        if (o.id && enrichedOrder.id && isSameChannel) {
          if (o.id.endsWith('-' + enrichedOrder.id) || enrichedOrder.id.endsWith('-' + o.id)) return true;
          if (nOrderId && o.id.endsWith('-' + nOrderId)) return true;
          if (oOrderId && enrichedOrder.id.endsWith('-' + oOrderId)) return true;
        }
        // Match identical phone + same product + same total created close in time
        const phone1 = String(o.phone || '').replace(/\D/g, '');
        const phone2 = String(enrichedOrder.phone || '').replace(/\D/g, '');
        if (phone1 && phone2 && phone1.length >= 8 && (phone1 === phone2 || phone1.endsWith(phone2) || phone2.endsWith(phone1))) {
          const prod1 = (o.productName || '').trim().toLowerCase();
          const prod2 = (enrichedOrder.productName || '').trim().toLowerCase();
          const tot1 = Number(o.totalCharge || 0);
          const tot2 = Number(enrichedOrder.totalCharge || 0);
          if (prod1 && prod2 && prod1 === prod2 && (tot1 === tot2 || tot1 === 0 || tot2 === 0)) {
            const d1 = o.orderDate ? new Date(o.orderDate).getTime() : 0;
            const d2 = enrichedOrder.orderDate ? new Date(enrichedOrder.orderDate).getTime() : 0;
            if (d1 && d2 && Math.abs(d1 - d2) < 24 * 60 * 60 * 1000) {
              return true;
            }
          }
        }
        return false;
      });

      if (exists) {
        // Skip duplicate insertion and merge any missing fields or UTM parameters
        const hasUtmChanges = 
          (enrichedOrder.utmSource && exists.utmSource !== enrichedOrder.utmSource) ||
          (enrichedOrder.utmMedium && exists.utmMedium !== enrichedOrder.utmMedium) ||
          (enrichedOrder.utmCampaign && exists.utmCampaign !== enrichedOrder.utmCampaign) ||
          (enrichedOrder.utmContent && exists.utmContent !== enrichedOrder.utmContent) ||
          (enrichedOrder.pysLanding && exists.pysLanding !== enrichedOrder.pysLanding) ||
          (enrichedOrder.pysSource && exists.pysSource !== enrichedOrder.pysSource) ||
          (enrichedOrder.pysFirstVisit && exists.pysFirstVisit !== enrichedOrder.pysFirstVisit) ||
          (enrichedOrder.pysLastVisit && exists.pysLastVisit !== enrichedOrder.pysLastVisit) ||
          (enrichedOrder.pysUtmSource && exists.pysUtmSource !== enrichedOrder.pysUtmSource) ||
          (enrichedOrder.pysUtmMedium && exists.pysUtmMedium !== enrichedOrder.pysUtmMedium) ||
          (enrichedOrder.pysUtmCampaign && exists.pysUtmCampaign !== enrichedOrder.pysUtmCampaign);
          
        const additionalUpdates: Partial<Order> = {};
        if (!exists.sourceChannel && enrichedOrder.sourceChannel) additionalUpdates.sourceChannel = enrichedOrder.sourceChannel;
        if (!exists.notes && enrichedOrder.notes) additionalUpdates.notes = enrichedOrder.notes;

        if (hasUtmChanges || Object.keys(additionalUpdates).length > 0) {
          const updatedOrder = {
            ...exists,
            ...additionalUpdates,
            utmSource: enrichedOrder.utmSource || exists.utmSource || "",
            utmMedium: enrichedOrder.utmMedium || exists.utmMedium || "",
            utmCampaign: enrichedOrder.utmCampaign || exists.utmCampaign || "",
            utmContent: enrichedOrder.utmContent || exists.utmContent || "",
            pysLanding: enrichedOrder.pysLanding || exists.pysLanding || "",
            pysSource: enrichedOrder.pysSource || exists.pysSource || "",
            pysFirstVisit: enrichedOrder.pysFirstVisit || exists.pysFirstVisit || "",
            pysLastVisit: enrichedOrder.pysLastVisit || exists.pysLastVisit || "",
            pysUtmSource: enrichedOrder.pysUtmSource || exists.pysUtmSource || "",
            pysUtmMedium: enrichedOrder.pysUtmMedium || exists.pysUtmMedium || "",
            pysUtmCampaign: enrichedOrder.pysUtmCampaign || exists.pysUtmCampaign || "",
          };
          
          set((state) => ({
            orders: state.orders.map(o => o.id === exists.id ? updatedOrder : o)
          }));
          await safeFirestoreWrite(() => updateDoc(doc(db, 'orders', exists.id), {
            ...additionalUpdates,
            utmSource: updatedOrder.utmSource,
            utmMedium: updatedOrder.utmMedium,
            utmCampaign: updatedOrder.utmCampaign,
            utmContent: updatedOrder.utmContent,
            pysLanding: updatedOrder.pysLanding,
            pysSource: updatedOrder.pysSource,
            pysFirstVisit: updatedOrder.pysFirstVisit,
            pysLastVisit: updatedOrder.pysLastVisit,
            pysUtmSource: updatedOrder.pysUtmSource,
            pysUtmMedium: updatedOrder.pysUtmMedium,
            pysUtmCampaign: updatedOrder.pysUtmCampaign,
          }), 'updateExistingOrderUTM');
        }
        return;
      } else {
        if (enrichedOrder.status1 && settings?.notificationStatuses?.includes(enrichedOrder.status1)) {
          triggerStatusNotification(enrichedOrder.id, enrichedOrder.status1!, { 
            sound: settings.soundNotificationEnabled, 
            visual: settings.visualNotificationEnabled 
          });
        }
        
        set((state) => ({ orders: state.orders.some(o => o.id === enrichedOrder.id) ? state.orders : [enrichedOrder, ...state.orders] }));
        await safeFirestoreWrite(() => setDoc(doc(db, 'orders', enrichedOrder.id), JSON.parse(JSON.stringify(enrichedOrder))), 'addOrder');
      }
    } catch (err) {
      console.warn("Order add error:", err);
    }
  },
  updateOrder: async (id, updates, skipUndo) => {
    const prevOrders = get().orders;
    const settings = get().settings;
    const existingOrder = prevOrders.find(o => o.id === id);
    if (existingOrder && !skipUndo) {
      // Setup undo action for update (specifically status updates or similar)
      const previousState = { ...existingOrder };
      get().pushUndo(`تعديل طلبية #${existingOrder.orderId}`, async () => {
        set((state) => ({
          orders: state.orders.map((o) => (o.id === id ? previousState : o)),
        }));
        await safeFirestoreWrite(() => updateDoc(doc(db, 'orders', id), JSON.parse(JSON.stringify(previousState))), 'undoUpdateOrder');
      });
    }

    if (existingOrder) {
      // Auto-learn city/commune corrections
      const isChangingRegion = updates.region && updates.region.trim() !== (existingOrder.region || '').trim();
      if (!isChangingRegion) {
        let newCorrections = null;
        
        if (updates.city && existingOrder.city) {
          const oldCity = existingOrder.city.trim();
          const newCity = updates.city.trim();
          if (oldCity && newCity && oldCity !== newCity && oldCity.length > 2) {
            newCorrections = { ...(newCorrections || settings?.cityCorrections || {}), [oldCity]: newCity };
          }
        }
        
        if (updates.stopdeskCommune && existingOrder.stopdeskCommune) {
          const oldComm = existingOrder.stopdeskCommune.trim();
          const newComm = updates.stopdeskCommune.trim();
          if (oldComm && newComm && oldComm !== newComm && oldComm.length > 2) {
            newCorrections = { ...(newCorrections || settings?.cityCorrections || {}), [oldComm]: newComm };
          }
        }
        
        if (newCorrections) {
          get().updateSettings({ cityCorrections: newCorrections });
        }
      }

      // If product details were manually updated, invalidate raw items 
      // so PickingList falls back to the manual edits
      if (
        ('productName' in updates && updates.productName !== existingOrder.productName) ||
        ('variation' in updates && updates.variation !== existingOrder.variation) ||
        ('sku' in updates && updates.sku !== existingOrder.sku)
      ) {
         updates.items = null;
         (updates as any).line_items = null;
         (updates as any).products = null;
         (updates as any).cart = null;
         (updates as any).orderedItems = null;
      }
    }
    
    if (existingOrder && updates.status1 && updates.status1 !== existingOrder.status1) {
      if (settings?.notificationStatuses?.includes(updates.status1)) {
        triggerStatusNotification(id, updates.status1!, { 
          sound: settings.soundNotificationEnabled, 
          visual: settings.visualNotificationEnabled 
        });
      }
    }

    if (existingOrder) {
      // 💬 إرسال رسالة SMS تلقائية عند تغير الحالة
      const mergedOrderForSms = { ...existingOrder, ...updates };
      if (updates.status1 && updates.status1 !== existingOrder.status1) {
        triggerSmsForStatus(mergedOrderForSms, updates.status1, settings);
      }
      if (updates.status2 && updates.status2 !== existingOrder.status2) {
        triggerSmsForStatus(mergedOrderForSms, updates.status2, settings);
      }

      // 🔄 معالجة التبديل والـ Rotoor (تخصيص شركة الشحن للتبديل)
      const isBecomingReturned = updates.status2 === 'مرتجع' && existingOrder.status2 !== 'مرتجع';
      if (existingOrder.isReplacement && existingOrder.replacedOrderId && isBecomingReturned) {
        const originalOrder = prevOrders.find(o => o.orderId === existingOrder.replacedOrderId || o.id === existingOrder.replacedOrderId);
        if (originalOrder) {
          // 1. استخراج بيانات المنتجات للطرفين لتبديلها
          const originalProductFields = {
            sku: originalOrder.sku || '',
            productName: originalOrder.productName || '',
            variation: originalOrder.variation || '',
            qnts: originalOrder.qnts || 1,
            priceWithoutDelivery: originalOrder.priceWithoutDelivery || 0,
            items: originalOrder.items || [],
          };

          const replacementProductFields = {
            sku: existingOrder.sku || '',
            productName: existingOrder.productName || '',
            variation: existingOrder.variation || '',
            qnts: existingOrder.qnts || 1,
            priceWithoutDelivery: existingOrder.priceWithoutDelivery || 0,
            items: existingOrder.items || [],
          };

          // 2. تحديث المخزون (إرجاع المنتج القديم المستبدل إلى المخزن)
          const invProducts = get().inventoryProducts;
          let updatedProductsToSync: any[] = [];

          // - إرجاع المنتج القديم المستبدل (Product A) للمستودع لأن الطرد رجع روتور
          if (originalOrder.stockDeducted) {
            const prodA = invProducts.find(p => p.name === originalProductFields.productName || (originalProductFields.sku && p.sku === originalProductFields.sku) || (p.variations && p.variations.some((v:any) => v.sku === originalProductFields.sku)));
            if (prodA) {
              const updatedA = JSON.parse(JSON.stringify(prodA));
              const hasVariations = updatedA.variations && updatedA.variations.length > 0;
              const targetVarIndex = hasVariations ? updatedA.variations.findIndex((v:any) => (originalProductFields.sku && v.sku === originalProductFields.sku) || (originalProductFields.variation && v.attributes?.some((a:any) => a.option === originalProductFields.variation))) : -1;
              
              if (targetVarIndex !== -1) {
                const v = updatedA.variations[targetVarIndex];
                v.local_stock_quantity = (v.local_stock_quantity || 0) + originalProductFields.qnts;
                v.local_manage_stock = true;
              } else {
                updatedA.local_stock_quantity = (updatedA.local_stock_quantity || 0) + originalProductFields.qnts;
                updatedA.local_manage_stock = true;
              }
              updatedProductsToSync.push(updatedA);
            }
          }

          // - إرجاع المنتج الجديد (Product B) الذي كان مخصوماً من الطلبية البديلة لمنع الازدواجية
          if (existingOrder.stockDeducted) {
            const prodB = invProducts.find(p => p.name === replacementProductFields.productName || (replacementProductFields.sku && p.sku === replacementProductFields.sku) || (p.variations && p.variations.some((v:any) => v.sku === replacementProductFields.sku)));
            if (prodB) {
              let updatedB = updatedProductsToSync.find(p => p.id === prodB.id);
              if (!updatedB) {
                updatedB = JSON.parse(JSON.stringify(prodB));
              }
              const hasVariations = updatedB.variations && updatedB.variations.length > 0;
              const targetVarIndex = hasVariations ? updatedB.variations.findIndex((v:any) => (replacementProductFields.sku && v.sku === replacementProductFields.sku) || (replacementProductFields.variation && v.attributes?.some((a:any) => a.option === replacementProductFields.variation))) : -1;
              
              if (targetVarIndex !== -1) {
                const v = updatedB.variations[targetVarIndex];
                v.local_stock_quantity = (v.local_stock_quantity || 0) + replacementProductFields.qnts;
                v.local_manage_stock = true;
              } else {
                updatedB.local_stock_quantity = (updatedB.local_stock_quantity || 0) + replacementProductFields.qnts;
                updatedB.local_manage_stock = true;
              }
              if (!updatedProductsToSync.some(p => p.id === updatedB.id)) {
                updatedProductsToSync.push(updatedB);
              }
            }
          }

          // - خصم المنتج الجديد (Product B) من الطلبية الأصلية التي أصبحت مستلمة بالمنتج الجديد
          const prodB = invProducts.find(p => p.name === replacementProductFields.productName || (replacementProductFields.sku && p.sku === replacementProductFields.sku) || (p.variations && p.variations.some((v:any) => v.sku === replacementProductFields.sku)));
          if (prodB) {
            let updatedB = updatedProductsToSync.find(p => p.id === prodB.id);
            if (!updatedB) {
              updatedB = JSON.parse(JSON.stringify(prodB));
            }
            const hasVariations = updatedB.variations && updatedB.variations.length > 0;
            const targetVarIndex = hasVariations ? updatedB.variations.findIndex((v:any) => (replacementProductFields.sku && v.sku === replacementProductFields.sku) || (replacementProductFields.variation && v.attributes?.some((a:any) => a.option === replacementProductFields.variation))) : -1;
            
            if (targetVarIndex !== -1) {
              const v = updatedB.variations[targetVarIndex];
              v.local_stock_quantity = (v.local_stock_quantity || 0) - replacementProductFields.qnts;
              v.local_manage_stock = true;
            } else {
              updatedB.local_stock_quantity = (updatedB.local_stock_quantity || 0) - replacementProductFields.qnts;
              updatedB.local_manage_stock = true;
            }
            if (!updatedProductsToSync.some(p => p.id === updatedB.id)) {
              updatedProductsToSync.push(updatedB);
            }
          }

          // مزامنة المخزون المستجد
          if (updatedProductsToSync.length > 0) {
            set((state) => ({
              inventoryProducts: state.inventoryProducts.map(p => {
                const updated = updatedProductsToSync.find(u => u.id === p.id);
                return updated ? updated : p;
              })
            }));
            try {
              get().bulkUpsertInventory(updatedProductsToSync);
            } catch (e) {
              console.error('Failed to sync swapped inventory stock', e);
            }
          }

          // 3. تحديث الطلبية الأصلية لتأخذ المنتج الجديد وتضاف إليها أموال الفارق والتعليقات التوضيحية
          const originalUpdates: Partial<Order> = {
            ...replacementProductFields,
            totalCharge: (originalOrder.totalCharge || 0) + (existingOrder.totalCharge || 0),
            stockDeducted: true,
            notes: (originalOrder.notes ? originalOrder.notes + '\n' : '') + `[تبديل ناجح Rotoor]: تم تعديل المنتج إلى الجديد (${replacementProductFields.productName}) نتيجة تبديل ناجح للطلبية البديلة #${existingOrder.orderId}. تم دمج سعر الفرق والمجموع الكلي للمبيعات إلى: ${(originalOrder.totalCharge || 0) + (existingOrder.totalCharge || 0)} دج.`
          };

          set((state) => ({
            orders: state.orders.map(o => o.id === originalOrder.id ? { ...o, ...originalUpdates } : o)
          }));
          try {
            await updateDoc(doc(db, 'orders', originalOrder.id), JSON.parse(JSON.stringify(originalUpdates)));
          } catch (e) {
            console.error('Failed to update original order during swap', e);
          }

          // 4. تعديل الحقول الممررة للطلبية الجديدة (البديلة) لتأخذ المنتج القديم الروتّور، وتصبح قيمتها المادية 0 لأنها تحولت لمرتجع بالكامل
          Object.assign(updates, {
            ...originalProductFields,
            totalCharge: 0,
            stockDeducted: false,
            notes: ((updates.notes !== undefined ? updates.notes : existingOrder.notes) || '') + `\n[تبديل ناجح Rotoor]: تم إرجاع الطرد التبديلي كـ (Rotoor) يحتوي على المنتج القديم (${originalProductFields.productName}). تم نقل المنتج الجديد للطلبية الأصلية #${originalOrder.orderId} وتصفير الحساب المالي لهذه الطلبية للسلامة المحاسبية.`
          });
        }
      }

      const isDelivered = updates.status2 === 'مستلم' || (updates.status1 === 'مستلم' && !updates.status2);
      const isReturned = updates.status2 === 'مرتجع' || (updates.status1 === 'مرتجع' && !updates.status2);
      
      const targetStatus2 = updates.status2 !== undefined ? updates.status2 : existingOrder.status2;
      const targetStatus1 = updates.status1 !== undefined ? updates.status1 : existingOrder.status1;
      
      const willBeDelivered = targetStatus2 === 'مستلم' || targetStatus1 === 'مستلم' || targetStatus2 === 'تم التسليم' || targetStatus1 === 'تم التسليم' || targetStatus2 === 'مستلمة' || targetStatus1 === 'مستلمة';
      const willBeReturned = targetStatus2 === 'مرتجع' || targetStatus1 === 'مرتجع';
      
      // 🚚 مزامنة سعر الشحن الحقيقي تلقائياً فور تمرير الطلبية للشحن أو تحولها لمستلمة أو تعيين شركة الشحن
      const isManualMode = updates.shippingFeeMode === 'manual' || (updates.shippingFeeMode === undefined && existingOrder.shippingFeeMode === 'manual');
      const isShippedOrDeliveredOrAssigned = 
        willBeDelivered ||
        ['تم الشحن', 'في الطريق', 'قيد التجهيز', 'قابلة للشحن', 'قيد التسليم'].includes(targetStatus2) ||
        ['تم الشحن', 'في الطريق', 'مستلم', 'تم التسليم', 'مستلمة'].includes(targetStatus1) ||
        !!updates.shippingTrackingId || !!existingOrder.shippingTrackingId ||
        (updates.deliveryCompany !== undefined && updates.deliveryCompany !== existingOrder.deliveryCompany);

      if (isShippedOrDeliveredOrAssigned && !isManualMode) {
        const currentRealPrice = updates.realDeliveryPrice !== undefined ? updates.realDeliveryPrice : existingOrder.realDeliveryPrice;
        if (currentRealPrice === undefined || currentRealPrice === null || Number(currentRealPrice) <= 0) {
          try {
            const mergedForFee = { ...existingOrder, ...updates };
            const calculatedFee = await calculateRealShippingFeeForOrder(mergedForFee, settings);
            if (calculatedFee && calculatedFee > 0) {
              updates.realDeliveryPrice = calculatedFee;
              updates.shippingFeeMode = 'auto';
            }
          } catch (e) {
            console.error('Error auto-syncing realDeliveryPrice on shipping status change:', e);
            const wilayaId = extractWilayaCode({ ...existingOrder, ...updates });
            const isStopDesk = isStopDeskOrder({ ...existingOrder, ...updates });
            const def = calculateDefaultShippingFee(wilayaId, isStopDesk);
            updates.realDeliveryPrice = def.realDeliveryPrice;
          }
        }
      }
      
      const qnts = Number(updates.qnts !== undefined ? updates.qnts : existingOrder.qnts) || 1;
      const oldQnts = Number(existingOrder.qnts) || 1;
      const invProducts = get().inventoryProducts;
      
      // Match by product name or sku
      const product = invProducts.find(p => p.name === existingOrder.productName || (existingOrder.sku && p.sku === existingOrder.sku) || (p.variations && p.variations.some((v:any) => v.sku === existingOrder.sku)));

      if (product) {
        let isOffer = false;
        let targetVariation = null;
        let targetVariationIndex = -1;

        const hasVariations = product.variations && product.variations.length > 0;
        if (hasVariations) {
           const fallbackOffer = product.variations.some((v:any) => v.attributes?.some((a:any) => a.option && (a.option.includes('عرض') || a.option.includes('كمية') || a.option.includes('pack'))));
           isOffer = product.local_is_offers !== undefined ? product.local_is_offers : fallbackOffer;
           
           targetVariationIndex = product.variations.findIndex((v:any) => 
               (existingOrder.sku && v.sku === existingOrder.sku) || 
               (existingOrder.variation && v.attributes?.some((a:any) => a.option === existingOrder.variation))
           );
           if (targetVariationIndex !== -1) {
              targetVariation = product.variations[targetVariationIndex];
           }
        }

        let oldActualQuantity = oldQnts;
        let newActualQuantity = qnts;

        if (isOffer && targetVariation) {
           let extractedQ = 1;
           const varName = targetVariation.name || targetVariation.attributes?.map((a:any) => a.option).join(' ') || '';
           const match = varName.match(/\d+/);
           if (match) extractedQ = parseInt(match[0], 10);
           const multiplier = targetVariation.offer_quantity || extractedQ || 1;
           oldActualQuantity = oldQnts * multiplier;
           newActualQuantity = qnts * multiplier;
        }

        // Check if status is shipped or delivered
        const isShippedOrDelivered = 
          ['تم الشحن', 'في الطريق', 'مستلم', 'تم التسليم', 'مستلمة', 'قابلة للشحن', 'قيد التسليم'].includes(targetStatus2) ||
          ['تم الشحن', 'في الطريق', 'مستلم', 'تم التسليم', 'مستلمة'].includes(targetStatus1);

        const isReturnedOrCancelled = 
          ['مرتجع', 'ملغى', 'ملغاة', 'إلغاء'].includes(targetStatus2) ||
          ['مرتجع', 'ملغى', 'ملغاة', 'إلغاء'].includes(targetStatus1);

        let stockChange = 0;

        if (isShippedOrDelivered && !existingOrder.stockDeducted) {
          stockChange = -newActualQuantity;
          updates.stockDeducted = true;
        } else if ((isReturnedOrCancelled || !isShippedOrDelivered) && existingOrder.stockDeducted) {
          stockChange = oldActualQuantity; // Return the amount we previously deducted
          updates.stockDeducted = false;
        } else if (isShippedOrDelivered && existingOrder.stockDeducted && oldActualQuantity !== newActualQuantity) {
          stockChange = oldActualQuantity - newActualQuantity;
        }

        // Clean up any legacy auto stock notes from notes
        let rawNotes = updates.notes !== undefined ? updates.notes : existingOrder.notes;
        if (rawNotes && typeof rawNotes === 'string' && rawNotes.includes('[مخزون]:')) {
          updates.notes = rawNotes
            .split('\n')
            .filter(line => !line.trim().startsWith('[مخزون]:'))
            .join('\n')
            .trim();
        }

        if (stockChange !== 0) {
          const updatedProduct = JSON.parse(JSON.stringify(product));
          let currentStock = 0;
          let newStockVal = 0;
          
          if (!isOffer && targetVariation) {
              // Deduct from variation
              const v = updatedProduct.variations[targetVariationIndex];
              currentStock = v.local_stock_quantity !== undefined && v.local_stock_quantity !== null 
                ? Number(v.local_stock_quantity) 
                : Number(v.stock_quantity ?? v.quantity ?? 0);
              newStockVal = currentStock + stockChange;
              v.local_stock_quantity = newStockVal;
              v.stock_quantity = newStockVal;
              v.local_manage_stock = true;
          } else {
              // Deduct from main product
              currentStock = updatedProduct.local_stock_quantity !== undefined && updatedProduct.local_stock_quantity !== null 
                ? Number(updatedProduct.local_stock_quantity) 
                : Number(updatedProduct.stock_quantity ?? updatedProduct.quantity ?? 0);
              newStockVal = currentStock + stockChange;
              updatedProduct.local_stock_quantity = newStockVal;
              updatedProduct.stock_quantity = newStockVal;
              updatedProduct.local_manage_stock = true;
          }
          
          set((state) => ({
             inventoryProducts: state.inventoryProducts.map(p => p.id === updatedProduct.id ? updatedProduct : p)
          }));

          // Log movement record
          const movementRecord: import('../types').InventoryMovement = {
            id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            productId: product.id,
            productName: product.name || '',
            variationId: targetVariation?.id || undefined,
            variationName: targetVariation?.name || targetVariation?.attributes?.map((a:any) => a.option).join(' ') || undefined,
            sku: targetVariation?.sku || product.sku || undefined,
            type: stockChange < 0 ? 'order_deduct' : 'order_return',
            typeName: stockChange < 0 ? 'خصم طلبية (شحن)' : 'إعادة للمخزن (إرجاع/إلغاء)',
            oldStock: currentStock,
            changeQty: stockChange,
            newStock: newStockVal,
            date: new Date().toISOString(),
            note: stockChange < 0 
              ? `خصم تلقائي للطلبية رقم #${existingOrder.orderId || id}`
              : `إعادة تلقائية للمخزن للطلبية رقم #${existingOrder.orderId || id}`
          };

          get().addInventoryMovement(movementRecord);
          
          try {
            // Background sync
            get().bulkUpsertInventory([updatedProduct]);
          } catch (e) {
            console.error('Failed to update inventory stock', e);
          }
        }
      }
    }

    const cleanUpdates = JSON.parse(JSON.stringify(updates));
    set((state) => ({ orders: state.orders.map(o => o.id === id ? { ...o, ...updates } : o) }));
    
    await safeFirestoreWrite(() => updateDoc(doc(db, 'orders', id), cleanUpdates), 'updateOrder');
    
    // Auto-return the replaced order if this replacement order is delivered
    if (existingOrder && existingOrder.isReplacement && existingOrder.replacedOrderId) {
      const isBecomingDelivered = updates.status2 === 'مستلم' && existingOrder.status2 !== 'مستلم';
      if (isBecomingDelivered) {
        const currentOrders = get().orders;
        const replacedOrder = currentOrders.find(o => o.orderId === existingOrder.replacedOrderId || o.id === existingOrder.replacedOrderId);
        if (replacedOrder && replacedOrder.status2 !== 'مرتجع') {
          const newTrackingId = updates.shippingTrackingId || existingOrder.shippingTrackingId || '';
          const newOrderIdStr = updates.orderId || existingOrder.orderId || '';
          await get().updateOrder(replacedOrder.id, {
            status2: 'مرتجع',
            shippingTrackingId: newTrackingId || replacedOrder.shippingTrackingId,
            notes: (replacedOrder.notes ? replacedOrder.notes + '\n' : '') + `[تحديث آلي]: تم تحويل المنتج المستبدل إلى مرتجع برقم الطلبية الجديدة ${newOrderIdStr} ورقم التتبع ${newTrackingId || 'نفس رقم تتبع البديل'} بعد تأكيد استلام الطرد البديل الجديد.`
          });
          console.log(`Auto-returned replaced order ${replacedOrder.orderId} with tracking ID ${newTrackingId}`);
        }
      }
    }
  },
  bulkDeleteOrders: async (ids) => {
    const state = get();
    const ordersToDelete = state.orders.filter(o => ids.includes(o.id));
    
    if (ordersToDelete.length > 0) {
      get().pushUndo(`حذف ${ordersToDelete.length} طلبية`, async () => {
        set((state) => ({ orders: [...ordersToDelete, ...state.orders] }));
        const promises = ordersToDelete.map(o => safeFirestoreWrite(() => setDoc(doc(db, 'orders', o.id), JSON.parse(JSON.stringify(o))), 'undoBulkDelete'));
        await Promise.all(promises);
      });
    }

    const wooIdsToBlacklist = ids.filter(id => String(id).startsWith('WOO-'));
    if (wooIdsToBlacklist.length > 0) {
      const currentDeleted = state.settings?.deletedWooOrderIds || [];
      const newDeleted = [...new Set([...currentDeleted, ...wooIdsToBlacklist])];
      if (newDeleted.length !== currentDeleted.length) {
        set((s) => ({ settings: { ...s.settings, deletedWooOrderIds: newDeleted } as SystemSettings }));
        const settingsId = state.settings?.id || 'general';
        safeFirestoreWrite(() => setDoc(doc(db, 'settings', settingsId), { deletedWooOrderIds: arrayUnion(...wooIdsToBlacklist) }, { merge: true }), 'bulkDeleteWooOrderBlacklist').catch(console.error);
      }
    }
    
    set((state) => ({ orders: state.orders.filter(o => !ids.includes(o.id)) }));
    const promises = ids.map(id => safeFirestoreWrite(() => deleteDoc(doc(db, 'orders', id)), 'bulkDeleteOrder'));
    await Promise.all(promises);
  },
  deleteOrder: async (id: string, force?: boolean) => {
    const state = get();
    const order = state.orders.find(o => o.id === id);
    
    if (order) {
      get().pushUndo(`حذف طلبية #${order.orderId}`, async () => {
        set((state) => ({ orders: [order, ...state.orders] }));
        await safeFirestoreWrite(() => setDoc(doc(db, 'orders', order.id), JSON.parse(JSON.stringify(order))), 'undoDeleteOrder');
      });
    }
    if (order && !force) {
      const check = checkOrderDeletionIntegrity(order, {
        confirmerInvoices: state.confirmerInvoices,
        shippingInvoices: state.shippingInvoices
      });
      if (!check.canDelete) {
        throw new DataIntegrityError(check.reason, {
          title: check.title,
          details: check.details,
          suggestions: check.suggestions
        });
      }
    }

    if (order) {
      const record = recordDeletedItem({
        entityType: 'order',
        originalId: order.id,
        title: `طلبية #${order.orderId || order.id} (${order.fullName || 'بدون اسم'})`,
        subtitle: `${order.phone || ''} - ${order.region || ''} - ${(order.totalCharge || 0).toLocaleString()} دج`,
        data: order
      });
      showUndoToast({
        record,
        customMessage: `تم حذف الطلبية #${order.orderId || order.id}`
      });
    }

    if (order && String(order.id).startsWith('WOO-')) {
      const currentDeleted = state.settings?.deletedWooOrderIds || [];
      if (!currentDeleted.includes(order.id)) {
        const updatedDeleted = [...currentDeleted, order.id];
        set((s) => ({ settings: { ...s.settings, deletedWooOrderIds: updatedDeleted } as SystemSettings }));
        const settingsId = state.settings?.id || 'general';
        await safeFirestoreWrite(() => setDoc(doc(db, 'settings', settingsId), { deletedWooOrderIds: arrayUnion(order.id) }, { merge: true }), 'deleteWooOrderBlacklist');
      }
    }
    
    set((state) => ({ orders: state.orders.filter(o => o.id !== id) }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'orders', id)), 'deleteOrder');
  },

  addAbandonedOrder: async (order) => {
    const state = get();
    if (order.id && state.settings?.deletedWooOrderIds?.includes(order.id)) {
      return;
    }

    const exists = state.abandonedOrders.find(o => {
      if (o.id === order.id) return true;
      const oOrderId = String(o.orderId || '').trim().replace(/^[#\-_]/, '');
      const nOrderId = String(order.orderId || '').trim().replace(/^[#\-_]/, '');
      const oChan = String(o.sourceChannel || '').trim().toLowerCase();
      const nChan = String(order.sourceChannel || '').trim().toLowerCase();
      
      const isSameChannel = !oChan || !nChan || oChan === nChan;

      if (oOrderId && nOrderId && oOrderId === nOrderId) {
        if (isSameChannel || o.phone === order.phone) {
          return true;
        }
      }
      if (o.id && order.id && isSameChannel) {
        if (o.id.endsWith('-' + order.id) || order.id.endsWith('-' + o.id)) return true;
        if (nOrderId && o.id.endsWith('-' + nOrderId)) return true;
        if (oOrderId && order.id.endsWith('-' + oOrderId)) return true;
      }
      const phone1 = String(o.phone || '').replace(/\D/g, '');
      const phone2 = String(order.phone || '').replace(/\D/g, '');
      if (phone1 && phone2 && phone1.length >= 8 && (phone1 === phone2 || phone1.endsWith(phone2) || phone2.endsWith(phone1))) {
        const prod1 = (o.productName || '').trim().toLowerCase();
        const prod2 = (order.productName || '').trim().toLowerCase();
        if (prod1 && prod2 && prod1 === prod2) {
          const d1 = o.orderDate ? new Date(o.orderDate).getTime() : 0;
          const d2 = order.orderDate ? new Date(order.orderDate).getTime() : 0;
          if (d1 && d2 && Math.abs(d1 - d2) < 24 * 60 * 60 * 1000) {
            return true;
          }
        }
      }
      return false;
    });

    if (exists) {
      // Update UTM and PixelYourSite parameters if they are missing or different.
      const hasUtmChanges = 
        (order.utmSource && exists.utmSource !== order.utmSource) ||
        (order.utmMedium && exists.utmMedium !== order.utmMedium) ||
        (order.utmCampaign && exists.utmCampaign !== order.utmCampaign) ||
        (order.utmContent && exists.utmContent !== order.utmContent) ||
        (order.pysLanding && exists.pysLanding !== order.pysLanding) ||
        (order.pysSource && exists.pysSource !== order.pysSource) ||
        (order.pysFirstVisit && exists.pysFirstVisit !== order.pysFirstVisit) ||
        (order.pysLastVisit && exists.pysLastVisit !== order.pysLastVisit) ||
        (order.pysUtmSource && exists.pysUtmSource !== order.pysUtmSource) ||
        (order.pysUtmMedium && exists.pysUtmMedium !== order.pysUtmMedium) ||
        (order.pysUtmCampaign && exists.pysUtmCampaign !== order.pysUtmCampaign);
        
      const additionalUpdates: Partial<AbandonedOrder> = {};
      if (!exists.sourceChannel && order.sourceChannel) additionalUpdates.sourceChannel = order.sourceChannel;
      if (!exists.notes && order.notes) additionalUpdates.notes = order.notes;

      if (hasUtmChanges || Object.keys(additionalUpdates).length > 0) {
        const updatedOrder = {
          ...exists,
          ...additionalUpdates,
          utmSource: order.utmSource || exists.utmSource || "",
          utmMedium: order.utmMedium || exists.utmMedium || "",
          utmCampaign: order.utmCampaign || exists.utmCampaign || "",
          utmContent: order.utmContent || exists.utmContent || "",
          pysLanding: order.pysLanding || exists.pysLanding || "",
          pysSource: order.pysSource || exists.pysSource || "",
          pysFirstVisit: order.pysFirstVisit || exists.pysFirstVisit || "",
          pysLastVisit: order.pysLastVisit || exists.pysLastVisit || "",
          pysUtmSource: order.pysUtmSource || exists.pysUtmSource || "",
          pysUtmMedium: order.pysUtmMedium || exists.pysUtmMedium || "",
          pysUtmCampaign: order.pysUtmCampaign || exists.pysUtmCampaign || "",
        };
        
        set((state) => ({
          abandonedOrders: state.abandonedOrders.map(o => o.id === exists.id ? updatedOrder : o)
        }));
        await updateDoc(doc(db, 'abandonedOrders', exists.id), {
          ...additionalUpdates,
          utmSource: updatedOrder.utmSource,
          utmMedium: updatedOrder.utmMedium,
          utmCampaign: updatedOrder.utmCampaign,
          utmContent: updatedOrder.utmContent,
          pysLanding: updatedOrder.pysLanding,
          pysSource: updatedOrder.pysSource,
          pysFirstVisit: updatedOrder.pysFirstVisit,
          pysLastVisit: updatedOrder.pysLastVisit,
          pysUtmSource: updatedOrder.pysUtmSource,
          pysUtmMedium: updatedOrder.pysUtmMedium,
          pysUtmCampaign: updatedOrder.pysUtmCampaign,
        });
      }
      return;
    } else {
      set((state) => ({ abandonedOrders: state.abandonedOrders.some(o => o.id === order.id) ? state.abandonedOrders : [order, ...state.abandonedOrders] }));
      await safeFirestoreWrite(() => setDoc(doc(db, 'abandonedOrders', order.id), JSON.parse(JSON.stringify(order))), 'addAbandonedOrder');
    }
  },
  updateAbandonedOrder: async (id, updates) => {
    set((state) => ({
      abandonedOrders: state.abandonedOrders.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      ),
    }));
    await safeFirestoreWrite(() => updateDoc(doc(db, 'abandonedOrders', id), JSON.parse(JSON.stringify(updates))), 'updateAbandonedOrder');
  },
  bulkDeleteAbandonedOrders: async (ids) => {
    const state = get();
    const ordersToDelete = state.abandonedOrders.filter(o => ids.includes(o.id));
    
    if (ordersToDelete.length > 0) {
      get().pushUndo(`حذف ${ordersToDelete.length} سلة`, async () => {
        set((state) => ({ abandonedOrders: [...ordersToDelete, ...state.abandonedOrders] }));
        const promises = ordersToDelete.map(o => safeFirestoreWrite(() => setDoc(doc(db, 'abandonedOrders', o.id), JSON.parse(JSON.stringify(o))), 'undoBulkDeleteAbandoned'));
        await Promise.all(promises);
      });
    }

    const wooIdsToBlacklist = ids.filter(id => String(id).startsWith('WOO-'));
    if (wooIdsToBlacklist.length > 0) {
      const currentDeleted = state.settings?.deletedWooOrderIds || [];
      const newDeleted = [...new Set([...currentDeleted, ...wooIdsToBlacklist])];
      if (newDeleted.length !== currentDeleted.length) {
        set((s) => ({ settings: { ...s.settings, deletedWooOrderIds: newDeleted } as SystemSettings }));
        const settingsId = state.settings?.id || 'general';
        safeFirestoreWrite(() => setDoc(doc(db, 'settings', settingsId), { deletedWooOrderIds: arrayUnion(...wooIdsToBlacklist) }, { merge: true }), 'bulkDeleteWooOrderBlacklist').catch(console.error);
      }
    }
    
    set((state) => ({ abandonedOrders: state.abandonedOrders.filter(o => !ids.includes(o.id)) }));
    const promises = ids.map(id => safeFirestoreWrite(() => deleteDoc(doc(db, 'abandonedOrders', id)), 'bulkDeleteAbandonedOrder'));
    await Promise.all(promises);
  },
  deleteAbandonedOrder: async (id) => {
    const state = get();
    const order = state.abandonedOrders.find(o => o.id === id);
    if (order) {
      get().pushUndo(`حذف سلة #${order.orderId || order.id}`, async () => {
        set((state) => ({ abandonedOrders: [order, ...state.abandonedOrders] }));
        await safeFirestoreWrite(() => setDoc(doc(db, 'abandonedOrders', order.id), JSON.parse(JSON.stringify(order))), 'undoDeleteAbandonedOrder');
      });
    }
    if (id && String(id).startsWith('WOO-')) {
      const currentDeleted = state.settings?.deletedWooOrderIds || [];
      if (!currentDeleted.includes(id)) {
        const updatedDeleted = [...currentDeleted, id];
        set((s) => ({ settings: { ...s.settings, deletedWooOrderIds: updatedDeleted } as SystemSettings }));
        const settingsId = state.settings?.id || 'general';
        safeFirestoreWrite(() => setDoc(doc(db, 'settings', settingsId), { deletedWooOrderIds: arrayUnion(id) }, { merge: true }), 'deleteWooOrderBlacklist').catch(console.error);
      }
    }
    set((state) => ({ abandonedOrders: state.abandonedOrders.filter(o => o.id !== id) }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'abandonedOrders', id)), 'deleteAbandonedOrder');
  },

  addCampaign: async (campaign) => {
    const clean = JSON.parse(JSON.stringify(campaign));
    set((s) => ({ campaigns: [clean, ...s.campaigns.filter(c => c.id !== clean.id)] }));
    await safeFirestoreWrite(() => setDoc(doc(db, 'campaigns', clean.id), clean), 'addCampaign');
  },
  updateCampaign: async (id, updates) => {
    const clean = JSON.parse(JSON.stringify(updates));
    set((s) => ({ campaigns: s.campaigns.map(c => c.id === id ? { ...c, ...clean } : c) }));
    await safeFirestoreWrite(() => updateDoc(doc(db, 'campaigns', id), clean), 'updateCampaign');
  },
  deleteCampaign: async (id) => {
    const state = get();
    const camp = state.campaigns.find(c => c.id === id);
    if (camp) {
      const record = recordDeletedItem({
        entityType: 'campaign',
        originalId: camp.id,
        title: `حملة: ${camp.name}`,
        data: camp
      });
      showUndoToast({ record, customMessage: `تم حذف الحملة "${camp.name}"` });
    }
    set((s) => ({ campaigns: s.campaigns.filter(c => c.id !== id) }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'campaigns', id)), 'deleteCampaign');
  },

  addCampaignRecord: async (record) => {
    const clean = JSON.parse(JSON.stringify(record));
    set((s) => ({ campaignRecords: [clean, ...s.campaignRecords.filter(r => r.id !== clean.id)] }));
    await safeFirestoreWrite(() => setDoc(doc(db, 'campaignRecords', clean.id), clean), 'addCampaignRecord');
  },
  updateCampaignRecord: async (id, updates) => {
    const clean = JSON.parse(JSON.stringify(updates));
    set((s) => ({ campaignRecords: s.campaignRecords.map(r => r.id === id ? { ...r, ...clean } : r) }));
    await safeFirestoreWrite(() => updateDoc(doc(db, 'campaignRecords', id), clean), 'updateCampaignRecord');
  },
  deleteCampaignRecord: async (id) => {
    const state = get();
    const rec = state.campaignRecords.find(r => r.id === id);
    if (rec) {
      const record = recordDeletedItem({
        entityType: 'campaign_record',
        originalId: rec.id,
        title: `سجل إعلاني بتاريخ ${rec.date}`,
        subtitle: `المصروف: ${(rec.spend || 0).toLocaleString()} دج`,
        data: rec
      });
      showUndoToast({ record, customMessage: `تم حذف السجل الإعلاني (${rec.date})` });
    }
    set((s) => ({ campaignRecords: s.campaignRecords.filter(r => r.id !== id) }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'campaignRecords', id)), 'deleteCampaignRecord');
  },

  addCampaignField: async (field) => {
    const clean = JSON.parse(JSON.stringify(field));
    set((s) => ({ campaignFields: [...s.campaignFields.filter(f => f.id !== clean.id), clean] }));
    await safeFirestoreWrite(() => setDoc(doc(db, 'campaignFields', clean.id), clean), 'addCampaignField');
  },
  updateCampaignField: async (id, updates) => {
    const clean = JSON.parse(JSON.stringify(updates));
    set((s) => ({ campaignFields: s.campaignFields.map(f => f.id === id ? { ...f, ...clean } : f) }));
    await safeFirestoreWrite(() => updateDoc(doc(db, 'campaignFields', id), clean), 'updateCampaignField');
  },
  removeCampaignField: async (id) => {
    set((s) => ({ campaignFields: s.campaignFields.filter(f => f.id !== id) }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'campaignFields', id)), 'removeCampaignField');
  },

  addSalesChannel: async (channel) => {
    const clean = JSON.parse(JSON.stringify(channel));
    set((s) => ({ salesChannels: [...s.salesChannels.filter(c => c.id !== clean.id), clean] }));
    await safeFirestoreWrite(() => setDoc(doc(db, 'salesChannels', clean.id), clean), 'addSalesChannel');
  },
  updateSalesChannel: async (id, updates) => {
    const clean = JSON.parse(JSON.stringify(updates));
    set((s) => ({ salesChannels: s.salesChannels.map(c => c.id === id ? { ...c, ...clean } : c) }));
    await safeFirestoreWrite(() => updateDoc(doc(db, 'salesChannels', id), clean), 'updateSalesChannel');
  },
  deleteSalesChannel: async (id: string, force?: boolean) => {
    const state = get();
    const channel = state.salesChannels.find(c => c.id === id);
    if (channel && !force) {
      const check = checkSalesChannelDeletionIntegrity(channel, {
        orders: state.orders,
        abandonedOrders: state.abandonedOrders,
        settings: state.settings
      });
      if (!check.canDelete) {
        throw new DataIntegrityError(check.reason, {
          title: check.title,
          details: check.details,
          suggestions: check.suggestions
        });
      }
    }

    set((s) => ({ salesChannels: s.salesChannels.filter(c => c.id !== id) }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'salesChannels', id)), 'deleteSalesChannel');
  },

  updateSettings: async (updates) => {
    const currentSettings = get().settings || {
      status1Options: ['جديد', 'قيد المراجعة', 'مؤكد', 'ملغى', 'مؤجل', 'لا يرد'],
      status2Options: ['قيد التجهيز', 'تم الشحن', 'في الطريق', 'مستلم', 'مرتجع', 'قابلة للشحن'],
      deliveryCompanies: ['أرامكس', 'سمسا', 'ياليدين', 'مايان', 'زاجل', 'توصيل محلي'],
      confirmers: [],
    };
    
    // Construct complete non-partial object to satisfy all schema requirements and allow complete array overrides
    const newSettings: SystemSettings = {
      ...currentSettings,
      status1Options: updates.status1Options !== undefined ? updates.status1Options : (currentSettings.status1Options || []),
      status2Options: updates.status2Options !== undefined ? updates.status2Options : (currentSettings.status2Options || []),
      deliveryCompanies: updates.deliveryCompanies !== undefined ? updates.deliveryCompanies : (currentSettings.deliveryCompanies || []),
      confirmers: updates.confirmers !== undefined ? updates.confirmers : (currentSettings.confirmers || []),
      defaultStatus1: updates.defaultStatus1 !== undefined ? updates.defaultStatus1 : (currentSettings.defaultStatus1 || ''),
      defaultStatus2: updates.defaultStatus2 !== undefined ? updates.defaultStatus2 : (currentSettings.defaultStatus2 || ''),
      defaultDeliveryCompany: updates.defaultDeliveryCompany !== undefined ? updates.defaultDeliveryCompany : (currentSettings.defaultDeliveryCompany || ''),
      defaultConfirmedBy: updates.defaultConfirmedBy !== undefined ? updates.defaultConfirmedBy : (currentSettings.defaultConfirmedBy || ''),
      productCosts: updates.productCosts !== undefined ? updates.productCosts : currentSettings.productCosts,
      returnCost: updates.returnCost !== undefined ? updates.returnCost : currentSettings.returnCost,
      returnCostMode: updates.returnCostMode !== undefined ? updates.returnCostMode : (currentSettings.returnCostMode || 'per_order'),
      returnMonthlySubscription: updates.returnMonthlySubscription !== undefined ? updates.returnMonthlySubscription : (currentSettings.returnMonthlySubscription || 0),
      exchangeRate: updates.exchangeRate !== undefined ? updates.exchangeRate : currentSettings.exchangeRate,
      autoSyncEnabled: updates.autoSyncEnabled !== undefined ? updates.autoSyncEnabled : currentSettings.autoSyncEnabled,
      autoSyncIntervalSeconds: updates.autoSyncIntervalSeconds !== undefined ? updates.autoSyncIntervalSeconds : currentSettings.autoSyncIntervalSeconds,
      metaAdsToken: updates.metaAdsToken !== undefined ? updates.metaAdsToken : currentSettings.metaAdsToken,
      notificationStatuses: updates.notificationStatuses !== undefined ? updates.notificationStatuses : currentSettings.notificationStatuses,
      soundNotificationEnabled: updates.soundNotificationEnabled !== undefined ? updates.soundNotificationEnabled : currentSettings.soundNotificationEnabled,
      visualNotificationEnabled: updates.visualNotificationEnabled !== undefined ? updates.visualNotificationEnabled : currentSettings.visualNotificationEnabled,
      lowInventoryAlertEnabled: updates.lowInventoryAlertEnabled !== undefined ? updates.lowInventoryAlertEnabled : currentSettings.lowInventoryAlertEnabled,
      lowInventoryThreshold: updates.lowInventoryThreshold !== undefined ? updates.lowInventoryThreshold : currentSettings.lowInventoryThreshold,
      inventoryManagementMode: updates.inventoryManagementMode !== undefined ? updates.inventoryManagementMode : (currentSettings.inventoryManagementMode || 'local'),
      shippingIntegrations: updates.shippingIntegrations !== undefined ? updates.shippingIntegrations : currentSettings.shippingIntegrations,
      themePalette: updates.themePalette !== undefined ? updates.themePalette : currentSettings.themePalette,
      customThemePalettes: updates.customThemePalettes !== undefined ? updates.customThemePalettes : currentSettings.customThemePalettes,
      smsEnabled: updates.smsEnabled !== undefined ? updates.smsEnabled : currentSettings.smsEnabled,
      smsGateway: updates.smsGateway !== undefined ? updates.smsGateway : currentSettings.smsGateway,
      smsAlgerieToken: updates.smsAlgerieToken !== undefined ? updates.smsAlgerieToken : currentSettings.smsAlgerieToken,
      smsAlgerieSender: updates.smsAlgerieSender !== undefined ? updates.smsAlgerieSender : currentSettings.smsAlgerieSender,
      smsTwilioSid: updates.smsTwilioSid !== undefined ? updates.smsTwilioSid : currentSettings.smsTwilioSid,
      smsTwilioToken: updates.smsTwilioToken !== undefined ? updates.smsTwilioToken : currentSettings.smsTwilioToken,
      smsTwilioNumber: updates.smsTwilioNumber !== undefined ? updates.smsTwilioNumber : currentSettings.smsTwilioNumber,
      smsTemplates: updates.smsTemplates !== undefined ? updates.smsTemplates : currentSettings.smsTemplates,
      smsAutoSendOnStatus: updates.smsAutoSendOnStatus !== undefined ? updates.smsAutoSendOnStatus : currentSettings.smsAutoSendOnStatus,
      tags: updates.tags !== undefined ? updates.tags : currentSettings.tags,
    };

    set({ settings: newSettings });

    const plainSettings = JSON.parse(JSON.stringify(newSettings));
    delete plainSettings.id;
    // Protect deletedWooOrderIds from being accidentally overwritten by stale local state
    delete plainSettings.deletedWooOrderIds; 
    
    await safeFirestoreWrite(() => setDoc(doc(db, 'settings', 'general'), plainSettings, { merge: true }), 'updateSettings');
  },

  addTag: async (tag: OrderTag) => {
    const state = get();
    const currentSettings = state.settings || {
      status1Options: [],
      status2Options: [],
      deliveryCompanies: [],
      confirmers: [],
      inventoryManagementMode: 'local',
      tags: DEFAULT_TAGS,
    } as SystemSettings;
    const currentTags = Array.isArray(currentSettings.tags) && currentSettings.tags.length > 0
      ? [...currentSettings.tags]
      : [...DEFAULT_TAGS];

    const trimmedName = tag.name.trim();
    if (!trimmedName) return;

    const existingIndex = currentTags.findIndex(t => t.name.toLowerCase() === trimmedName.toLowerCase());
    let updatedTags: OrderTag[];
    if (existingIndex >= 0) {
      updatedTags = currentTags.map((t, idx) => idx === existingIndex ? { ...t, name: trimmedName, color: tag.color || t.color } : t);
    } else {
      updatedTags = [...currentTags, { name: trimmedName, color: tag.color || 'bg-indigo-100 text-indigo-800 border-indigo-300' }];
    }

    const newSettings = { ...currentSettings, tags: updatedTags };
    set({ settings: newSettings });

    await safeFirestoreWrite(
      () => setDoc(doc(db, 'settings', 'general'), { tags: updatedTags }, { merge: true }),
      'addTag'
    );
  },

  removeTag: async (tagName: string) => {
    const state = get();
    const currentSettings = state.settings || {} as SystemSettings;
    const currentTags = Array.isArray(currentSettings.tags) ? currentSettings.tags : DEFAULT_TAGS;
    const updatedTags = currentTags.filter(t => t.name.toLowerCase() !== tagName.trim().toLowerCase());

    const newSettings = { ...currentSettings, tags: updatedTags };
    set({ settings: newSettings });

    await safeFirestoreWrite(
      () => setDoc(doc(db, 'settings', 'general'), { tags: updatedTags }, { merge: true }),
      'removeTag'
    );
  },

  updateTag: async (oldName: string, updatedTag: OrderTag) => {
    const state = get();
    const currentSettings = state.settings || {} as SystemSettings;
    const currentTags = Array.isArray(currentSettings.tags) ? currentSettings.tags : DEFAULT_TAGS;
    const updatedTags = currentTags.map(t => t.name.toLowerCase() === oldName.trim().toLowerCase() ? updatedTag : t);

    const newSettings = { ...currentSettings, tags: updatedTags };
    set({ settings: newSettings });

    await safeFirestoreWrite(
      () => setDoc(doc(db, 'settings', 'general'), { tags: updatedTags }, { merge: true }),
      'updateTag'
    );
  },

  addExpense: async (expense) => {
    const clean = JSON.parse(JSON.stringify(expense));
    set((s) => ({ expenses: [clean, ...s.expenses.filter(e => e.id !== clean.id)] }));
    await safeFirestoreWrite(() => setDoc(doc(db, 'expenses', clean.id), clean), 'addExpense');
  },

  updateExpense: async (id, updates) => {
    const clean = JSON.parse(JSON.stringify(updates));
    set((s) => ({ expenses: s.expenses.map(e => e.id === id ? { ...e, ...clean } : e) }));
    await safeFirestoreWrite(() => updateDoc(doc(db, 'expenses', id), clean), 'updateExpense');
  },

  deleteExpense: async (id) => {
    const state = get();
    const exp = state.expenses.find(e => e.id === id);
    if (exp) {
      const expTitle = exp.description || exp.category || 'مصروف';
      const record = recordDeletedItem({
        entityType: 'expense',
        originalId: exp.id,
        title: `مصروف: ${expTitle}`,
        subtitle: `${(exp.amount || 0).toLocaleString()} دج (${exp.category || 'عام'})`,
        data: exp
      });
      showUndoToast({ record, customMessage: `تم حذف المصروف "${expTitle}"` });
    }
    set((s) => ({ expenses: s.expenses.filter(e => e.id !== id) }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'expenses', id)), 'deleteExpense');
  },

  addPartner: async (partner) => {
    const clean = JSON.parse(JSON.stringify(partner));
    set((state) => ({ partners: [clean, ...state.partners.filter(p => p.id !== clean.id)] }));
    await safeFirestoreWrite(() => setDoc(doc(db, 'partners', clean.id), clean), 'addPartner');
  },

  updatePartner: async (id, updates) => {
    const clean = JSON.parse(JSON.stringify(updates));
    set((state) => ({
      partners: state.partners.map(p => p.id === id ? { ...p, ...clean } : p)
    }));
    await safeFirestoreWrite(() => updateDoc(doc(db, 'partners', id), clean), 'updatePartner');
  },

  deletePartner: async (id) => {
    set((state) => ({ partners: state.partners.filter(p => p.id !== id) }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'partners', id)), 'deletePartner');
  },

  addPartnerTransaction: async (transaction) => {
    const clean = JSON.parse(JSON.stringify(transaction));
    set((state) => ({ partnerTransactions: [clean, ...state.partnerTransactions.filter(t => t.id !== clean.id)] }));
    await safeFirestoreWrite(() => setDoc(doc(db, 'partnerTransactions', clean.id), clean), 'addPartnerTransaction');
  },

  updatePartnerTransaction: async (id, updates) => {
    const clean = JSON.parse(JSON.stringify(updates));
    set((state) => ({
      partnerTransactions: state.partnerTransactions.map(t => t.id === id ? { ...t, ...clean } : t)
    }));
    await safeFirestoreWrite(() => updateDoc(doc(db, 'partnerTransactions', id), clean), 'updatePartnerTransaction');
  },

  deletePartnerTransaction: async (id) => {
    set((state) => ({ partnerTransactions: state.partnerTransactions.filter(t => t.id !== id) }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'partnerTransactions', id)), 'deletePartnerTransaction');
  },

  addSupplier: async (supplier) => {
    const clean = JSON.parse(JSON.stringify(supplier));
    set((state) => ({ suppliers: [clean, ...state.suppliers.filter(s => s.id !== clean.id)] }));
    await safeFirestoreWrite(() => setDoc(doc(db, 'suppliers', clean.id), clean), 'addSupplier');
  },

  updateSupplier: async (id, updates) => {
    const clean = JSON.parse(JSON.stringify(updates));
    set((state) => ({ suppliers: state.suppliers.map(s => s.id === id ? { ...s, ...clean } : s) }));
    await safeFirestoreWrite(() => updateDoc(doc(db, 'suppliers', id), clean), 'updateSupplier');
  },

  deleteSupplier: async (id: string, force?: boolean) => {
    const state = get();
    const supplier = state.suppliers.find(s => String(s.id) === String(id));
    if (supplier && !force) {
      const check = checkSupplierDeletionIntegrity(supplier, {
        purchaseInvoices: state.purchaseInvoices,
        supplierPayments: state.supplierPayments
      });
      if (!check.canDelete) {
        throw new DataIntegrityError(check.reason, {
          title: check.title,
          details: check.details,
          suggestions: check.suggestions
        });
      }
    }

    set((state) => ({ suppliers: state.suppliers.filter(s => String(s.id) !== String(id)) }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'suppliers', String(id))), 'deleteSupplier');
  },

    createConsignmentSettlement: async (supplierId, invoice, orderIds) => {
    const cleanInvoice = JSON.parse(JSON.stringify(invoice));
    
    set((state) => ({
      purchaseInvoices: [cleanInvoice, ...state.purchaseInvoices],
      orders: state.orders.map(o => orderIds.includes(o.id) ? { ...o, consignmentSettlementId: invoice.id } : o)
    }));

    const batch = writeBatch(db);
    batch.set(doc(db, 'purchaseInvoices', cleanInvoice.id), cleanInvoice);
    
    orderIds.forEach(id => {
      batch.update(doc(db, 'orders', id), { consignmentSettlementId: invoice.id });
    });
    
    await safeFirestoreWrite(() => batch.commit(), 'createConsignmentSettlement');
  },

  addPurchaseInvoice: async (invoice) => {
    const cleanInvoice = JSON.parse(JSON.stringify(invoice));
    set((state) => ({ purchaseInvoices: [cleanInvoice, ...state.purchaseInvoices.filter(i => String(i.id) !== String(cleanInvoice.id))] }));
    await safeFirestoreWrite(() => setDoc(doc(db, 'purchaseInvoices', String(invoice.id)), cleanInvoice), 'addPurchaseInvoice');
    
    // Update local_cost for products/variations if unit cost > 0
    const currentProducts = get().inventoryProducts;
    const productsToUpdateMap = new Map<string, any>();

    for (const item of invoice.items || []) {
       const unitCost = Number(item.unitCost) || 0;
       if (unitCost <= 0) continue;
       const iSku = (item.sku || '').trim().toLowerCase();
       const iName = (item.productName || '').trim().toLowerCase();

       for (const p of currentProducts) {
          let updatedProduct = productsToUpdateMap.get(p.id) || JSON.parse(JSON.stringify(p));

          const parentName = (p.name || '').trim().toLowerCase();
          const parentSku = (p.sku || '').trim().toLowerCase();

          if (p.variations && p.variations.length > 0) {
              let varMatched = false;
              updatedProduct.variations = updatedProduct.variations.map((v: any) => {
                 const vSku = (v.sku || '').trim().toLowerCase();
                 const vName = (v.name || v.attributes?.map((a:any) => a.option).join(' ') || '').trim().toLowerCase();
                 const combinedName = `${parentName} - ${vName}`.trim().toLowerCase();

                 let isVarMatch = false;
                 if (iSku && vSku && iSku === vSku) isVarMatch = true;
                 else if (iName && combinedName && (iName === combinedName || iName.includes(combinedName))) isVarMatch = true;
                 else if (iName && parentName && vName && iName.includes(parentName) && iName.includes(vName)) isVarMatch = true;

                 if (isVarMatch) {
                    varMatched = true;
                    return { ...v, local_cost: unitCost };
                 }
                 return v;
              });

              if (varMatched) {
                 delete updatedProduct.local_cost;
                 productsToUpdateMap.set(p.id, updatedProduct);
              }
          } else {
              let isMainMatch = false;
              if (iSku && parentSku && iSku === parentSku) isMainMatch = true;
              else if (iName && parentName && (iName === parentName || iName.includes(parentName))) isMainMatch = true;

              if (isMainMatch) {
                 updatedProduct.local_cost = unitCost;
                 productsToUpdateMap.set(p.id, updatedProduct);
              }
          }
       }
    }

    const productsToUpdate = Array.from(productsToUpdateMap.values());
    if (productsToUpdate.length > 0) {
        set((state) => ({
             inventoryProducts: state.inventoryProducts.map(p => {
                 const updated = productsToUpdate.find(u => u.id === p.id);
                 return updated ? updated : p;
             })
        }));
        try {
           await get().bulkUpsertInventory(productsToUpdate);
        } catch (e) {
           console.error('Failed to update product cost from purchase invoice', e);
        }
    }
  },

  updatePurchaseInvoice: async (id, updates) => {
    const cleanUpdates = JSON.parse(JSON.stringify(updates));
    set((state) => ({
      purchaseInvoices: state.purchaseInvoices.map((i) => (String(i.id) === String(id) ? { ...i, ...cleanUpdates } : i))
    }));
    await safeFirestoreWrite(() => updateDoc(doc(db, 'purchaseInvoices', String(id)), cleanUpdates), 'updatePurchaseInvoice');

    if (updates.items && Array.isArray(updates.items)) {
      const currentProducts = get().inventoryProducts;
      const productsToUpdateMap = new Map<string, any>();

      for (const item of updates.items) {
         const unitCost = Number(item.unitCost) || 0;
         if (unitCost <= 0) continue;
         const iSku = (item.sku || '').trim().toLowerCase();
         const iName = (item.productName || '').trim().toLowerCase();

         for (const p of currentProducts) {
            let updatedProduct = productsToUpdateMap.get(p.id) || JSON.parse(JSON.stringify(p));
            const parentName = (p.name || '').trim().toLowerCase();
            const parentSku = (p.sku || '').trim().toLowerCase();

            if (p.variations && p.variations.length > 0) {
                let varMatched = false;
                updatedProduct.variations = updatedProduct.variations.map((v: any) => {
                   const vSku = (v.sku || '').trim().toLowerCase();
                   const vName = (v.name || v.attributes?.map((a:any) => a.option).join(' ') || '').trim().toLowerCase();
                   const combinedName = `${parentName} - ${vName}`.trim().toLowerCase();

                   let isVarMatch = false;
                   if (iSku && vSku && iSku === vSku) isVarMatch = true;
                   else if (iName && combinedName && (iName === combinedName || iName.includes(combinedName))) isVarMatch = true;
                   else if (iName && parentName && vName && iName.includes(parentName) && iName.includes(vName)) isVarMatch = true;

                   if (isVarMatch) {
                      varMatched = true;
                      return { ...v, local_cost: unitCost };
                   }
                   return v;
                });

                if (varMatched) {
                   delete updatedProduct.local_cost;
                   productsToUpdateMap.set(p.id, updatedProduct);
                }
            } else {
                let isMainMatch = false;
                if (iSku && parentSku && iSku === parentSku) isMainMatch = true;
                else if (iName && parentName && (iName === parentName || iName.includes(parentName))) isMainMatch = true;

                if (isMainMatch) {
                   updatedProduct.local_cost = unitCost;
                   productsToUpdateMap.set(p.id, updatedProduct);
                }
            }
         }
      }

      const productsToUpdate = Array.from(productsToUpdateMap.values());
      if (productsToUpdate.length > 0) {
          set((state) => ({
               inventoryProducts: state.inventoryProducts.map(p => {
                   const updated = productsToUpdate.find(u => u.id === p.id);
                   return updated ? updated : p;
               })
          }));
          try {
             await get().bulkUpsertInventory(productsToUpdate);
          } catch (e) {
             console.error('Failed to update product cost from purchase invoice', e);
          }
      }
    }
  },

  deletePurchaseInvoice: async (id: string, force?: boolean) => {
    const state = get();
    const invoice = state.purchaseInvoices.find(i => String(i.id) === String(id));
    if (invoice && !force) {
      const check = checkPurchaseInvoiceDeletionIntegrity(invoice);
      if (!check.canDelete) {
        throw new DataIntegrityError(check.reason, {
          title: check.title,
          details: check.details,
          suggestions: check.suggestions
        });
      }
    }

    set((state) => ({ purchaseInvoices: state.purchaseInvoices.filter(i => String(i.id) !== String(id)) }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'purchaseInvoices', String(id))), 'deletePurchaseInvoice');
  },

  addSupplierPayment: async (payment) => {
    const clean = JSON.parse(JSON.stringify(payment));
    set((state) => ({ supplierPayments: [clean, ...state.supplierPayments.filter(p => String(p.id) !== String(clean.id))] }));
    await safeFirestoreWrite(() => setDoc(doc(db, 'supplierPayments', String(payment.id)), clean), 'addSupplierPayment');
  },

  deleteSupplierPayment: async (id) => {
    set((state) => ({ supplierPayments: state.supplierPayments.filter(p => String(p.id) !== String(id)) }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'supplierPayments', String(id))), 'deleteSupplierPayment');
  },

  addShippingInvoice: async (invoice) => {
    const clean = JSON.parse(JSON.stringify(invoice));
    set((state) => ({ shippingInvoices: [clean, ...state.shippingInvoices.filter(i => i.id !== clean.id)] }));
    await safeFirestoreWrite(() => setDoc(doc(db, 'shippingInvoices', invoice.id), clean), 'addShippingInvoice');
  },

  updateShippingInvoice: async (id, updates) => {
    const clean = JSON.parse(JSON.stringify(updates));
    set((state) => ({
      shippingInvoices: state.shippingInvoices.map((i) => (i.id === id ? { ...i, ...clean } : i))
    }));
    await safeFirestoreWrite(() => updateDoc(doc(db, 'shippingInvoices', id), clean), 'updateShippingInvoice');
  },

  deleteShippingInvoice: async (id) => {
    set((state) => ({ shippingInvoices: state.shippingInvoices.filter(i => i.id !== id) }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'shippingInvoices', id)), 'deleteShippingInvoice');
  },

  addShippingBureau: async (bureau) => {
    const clean = JSON.parse(JSON.stringify(bureau));
    set((state) => ({ shippingBureaus: [clean, ...state.shippingBureaus.filter(b => b.id !== clean.id)] }));
    await safeFirestoreWrite(() => setDoc(doc(db, 'shippingBureaus', bureau.id), clean), 'addShippingBureau');
  },

  updateShippingBureau: async (id, updates) => {
    const clean = JSON.parse(JSON.stringify(updates));
    set((state) => ({ shippingBureaus: state.shippingBureaus.map(b => b.id === id ? { ...b, ...clean } : b) }));
    await safeFirestoreWrite(() => updateDoc(doc(db, 'shippingBureaus', id), clean), 'updateShippingBureau');
  },

  deleteShippingBureau: async (id) => {
    set((state) => ({ shippingBureaus: state.shippingBureaus.filter(b => b.id !== id) }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'shippingBureaus', id)), 'deleteShippingBureau');
  },

  addUser: async (user) => {
    const clean = JSON.parse(JSON.stringify(user));
    set((state) => ({ users: [clean, ...state.users.filter(u => u.id !== clean.id)] }));
    await safeFirestoreWrite(() => setDoc(doc(db, 'users', user.id), clean), 'addUser');
  },

  updateUser: async (id, updates) => {
    const clean = JSON.parse(JSON.stringify(updates));
    set((state) => ({
      users: state.users.map(u => u.id === id ? { ...u, ...clean } : u),
      currentUserProfile: state.currentUserProfile?.id === id 
        ? { ...state.currentUserProfile, ...clean } 
        : state.currentUserProfile
    }));
    await safeFirestoreWrite(() => updateDoc(doc(db, 'users', id), clean), 'updateUser');
  },

  deleteUser: async (id: string, force?: boolean) => {
    const state = get();
    const user = state.users.find(u => u.id === id);
    if (user && !force) {
      const check = checkUserDeletionIntegrity(user, {
        users: state.users,
        currentUserProfile: state.currentUserProfile,
        orders: state.orders,
        confirmerInvoices: state.confirmerInvoices
      });
      if (!check.canDelete) {
        throw new DataIntegrityError(check.reason, {
          title: check.title,
          details: check.details,
          suggestions: check.suggestions
        });
      }
    }

    set((state) => ({ users: state.users.filter(u => u.id !== id) }));
    await safeFirestoreWrite(() => deleteDoc(doc(db, 'users', id)), 'deleteUser');
  },

  addConfirmerInvoice: async (invoice) => {
    const cleanInvoice = JSON.parse(JSON.stringify(invoice));
    set((state) => ({
      confirmerInvoices: [cleanInvoice, ...state.confirmerInvoices.filter(inv => inv.id !== cleanInvoice.id)],
      orders: state.orders.map(o => {
        if (cleanInvoice.includedOrderIds?.includes(o.id)) {
          return {
            ...o,
            isPaidToConfirmer: cleanInvoice.status === 'paid',
            confirmerInvoiceId: cleanInvoice.id
          };
        }
        return o;
      })
    }));

    await safeFirestoreWrite(() => setDoc(doc(db, 'confirmerInvoices', cleanInvoice.id), cleanInvoice), 'addConfirmerInvoice');

    // Update orders in batches if included
    if (cleanInvoice.includedOrderIds && cleanInvoice.includedOrderIds.length > 0) {
      const orderIds: string[] = cleanInvoice.includedOrderIds;
      const chunkSize = 400;
      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(orderId => {
          batch.update(doc(db, 'orders', orderId), {
            isPaidToConfirmer: cleanInvoice.status === 'paid',
            confirmerInvoiceId: cleanInvoice.id
          });
        });
        await safeFirestoreWrite(() => batch.commit(), 'addConfirmerInvoice_batch');
      }
    }
  },

  updateConfirmerInvoice: async (id, updates) => {
    const cleanUpdates = JSON.parse(JSON.stringify(updates));
    set((state) => ({
      confirmerInvoices: state.confirmerInvoices.map(inv => inv.id === id ? { ...inv, ...cleanUpdates } : inv)
    }));
    await safeFirestoreWrite(() => updateDoc(doc(db, 'confirmerInvoices', id), cleanUpdates), 'updateConfirmerInvoice');
  },

  deleteConfirmerInvoice: async (id) => {
    const inv = get().confirmerInvoices.find(i => i.id === id);
    set((state) => ({
      confirmerInvoices: state.confirmerInvoices.filter(i => i.id !== id),
      orders: state.orders.map(o => {
        if (o.confirmerInvoiceId === id) {
          return { ...o, isPaidToConfirmer: false, confirmerInvoiceId: '' };
        }
        return o;
      })
    }));

    await safeFirestoreWrite(() => deleteDoc(doc(db, 'confirmerInvoices', id)), 'deleteConfirmerInvoice');

    // Unlink orders in DB
    if (inv && inv.includedOrderIds && inv.includedOrderIds.length > 0) {
      const orderIds = inv.includedOrderIds;
      const chunkSize = 400;
      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(orderId => {
          batch.update(doc(db, 'orders', orderId), {
            isPaidToConfirmer: false,
            confirmerInvoiceId: ''
          });
        });
        await safeFirestoreWrite(() => batch.commit(), 'deleteConfirmerInvoice_batch');
      }
    }
  },

  assignOrders: async (orderIds, confirmerId, confirmerName) => {
    if (!orderIds || orderIds.length === 0) return;
    const now = new Date().toISOString();

    set((state) => ({
      orders: state.orders.map(o => {
        if (orderIds.includes(o.id)) {
          return {
            ...o,
            assignedTo: confirmerId,
            assignedToName: confirmerName,
            assignedAt: now,
            confirmedBy: confirmerName || o.confirmedBy
          };
        }
        return o;
      })
    }));

    const chunkSize = 400;
    for (let i = 0; i < orderIds.length; i += chunkSize) {
      const chunk = orderIds.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(orderId => {
        batch.update(doc(db, 'orders', orderId), {
          assignedTo: confirmerId,
          assignedToName: confirmerName,
          assignedAt: now,
          confirmedBy: confirmerName
        });
      });
      await safeFirestoreWrite(() => batch.commit(), 'assignOrders_batch');
    }
  },

  unassignOrders: async (orderIds) => {
    if (!orderIds || orderIds.length === 0) return;
    set((state) => ({
      orders: state.orders.map(o => {
        if (orderIds.includes(o.id)) {
          return {
            ...o,
            assignedTo: '',
            assignedToName: '',
            assignedAt: ''
          };
        }
        return o;
      })
    }));

    const chunkSize = 400;
    for (let i = 0; i < orderIds.length; i += chunkSize) {
      const chunk = orderIds.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(orderId => {
        batch.update(doc(db, 'orders', orderId), {
          assignedTo: '',
          assignedToName: '',
          assignedAt: ''
        });
      });
      await safeFirestoreWrite(() => batch.commit(), 'unassignOrders_batch');
    }
  },

  autoAssignPendingOrders: async (specificOrderIds, strategyOverride) => {
    const { orders, users, settings } = get();
    
    // Active confirmers or fallback to active users
    let activeConfirmers = users.filter(u => u.role === 'confirmer' && u.isActive);
    if (activeConfirmers.length === 0) {
      activeConfirmers = users.filter(u => u.isActive);
    }
    if (activeConfirmers.length === 0) {
      throw new Error('لا يوجد مؤكدون نشطون في النظام لتوزيع الطلبيات عليهم');
    }

    // Determine target orders
    let targetOrders: Order[] = [];
    if (specificOrderIds && specificOrderIds.length > 0) {
      targetOrders = orders.filter(o => specificOrderIds.includes(o.id));
    } else {
      // Unassigned new orders
      targetOrders = orders.filter(o => !o.assignedTo && (!o.status1 || o.status1 === 'جديد' || o.status1 === 'قيد المراجعة'));
    }

    if (targetOrders.length === 0) {
      return { assignedCount: 0, summary: {} };
    }

    const strategy = strategyOverride || settings?.assignmentSettings?.defaultStrategy || 'round_robin';
    const assignments: Record<string, { confirmerId: string; confirmerName: string; orderIds: string[] }> = {};

    activeConfirmers.forEach(c => {
      assignments[c.id] = {
        confirmerId: c.id,
        confirmerName: c.displayName,
        orderIds: []
      };
    });

    if (strategy === 'by_product') {
      // Assign by product SKU or name match
      targetOrders.forEach((order, idx) => {
        const matchingConfirmer = activeConfirmers.find(c => {
          if (!c.assignedProducts || c.assignedProducts.length === 0) return false;
          return c.assignedProducts.some(p => 
            (order.sku && order.sku.toLowerCase().includes(p.toLowerCase())) ||
            (order.productName && order.productName.toLowerCase().includes(p.toLowerCase()))
          );
        });

        const chosen = matchingConfirmer || activeConfirmers[idx % activeConfirmers.length];
        assignments[chosen.id].orderIds.push(order.id);
      });
    } else if (strategy === 'by_wilaya') {
      // Assign by customer wilaya
      targetOrders.forEach((order, idx) => {
        const matchingConfirmer = activeConfirmers.find(c => {
          if (!c.assignedWilayas || c.assignedWilayas.length === 0) return false;
          return c.assignedWilayas.some(w => 
            (order.region && order.region.includes(w)) ||
            (order.city && order.city.includes(w))
          );
        });

        const chosen = matchingConfirmer || activeConfirmers[idx % activeConfirmers.length];
        assignments[chosen.id].orderIds.push(order.id);
      });
    } else if (strategy === 'by_channel') {
      // Assign by sales channel
      targetOrders.forEach((order, idx) => {
        const matchingConfirmer = activeConfirmers.find(c => {
          if (!c.assignedChannels || c.assignedChannels.length === 0) return false;
          return c.assignedChannels.includes(order.sourceChannel || '');
        });

        const chosen = matchingConfirmer || activeConfirmers[idx % activeConfirmers.length];
        assignments[chosen.id].orderIds.push(order.id);
      });
    } else if (strategy === 'ratio') {
      // Weighted distribution
      const weightedList: AppUser[] = [];
      activeConfirmers.forEach(c => {
        const weight = Math.max(1, c.assignmentWeight || 1);
        for (let i = 0; i < weight; i++) {
          weightedList.push(c);
        }
      });

      targetOrders.forEach((order, idx) => {
        const chosen = weightedList[idx % weightedList.length];
        assignments[chosen.id].orderIds.push(order.id);
      });
    } else if (strategy === 'least_busy') {
      // Assign to confirmer with fewest active pending orders
      const pendingCounts: Record<string, number> = {};
      activeConfirmers.forEach(c => {
        pendingCounts[c.id] = orders.filter(o => o.assignedTo === c.id && (o.status1 === 'جديد' || o.status1 === 'قيد المراجعة')).length;
      });

      targetOrders.forEach(order => {
        // Find minimum
        let minConfirmer = activeConfirmers[0];
        let minCount = pendingCounts[minConfirmer.id] || 0;

        activeConfirmers.forEach(c => {
          const count = pendingCounts[c.id] || 0;
          if (count < minCount) {
            minCount = count;
            minConfirmer = c;
          }
        });

        assignments[minConfirmer.id].orderIds.push(order.id);
        pendingCounts[minConfirmer.id] = (pendingCounts[minConfirmer.id] || 0) + 1;
      });
    } else {
      // Default: Round Robin
      targetOrders.forEach((order, idx) => {
        const chosen = activeConfirmers[idx % activeConfirmers.length];
        assignments[chosen.id].orderIds.push(order.id);
      });
    }

    const summary: Record<string, number> = {};
    let totalAssigned = 0;

    for (const confId of Object.keys(assignments)) {
      const data = assignments[confId];
      if (data.orderIds.length > 0) {
        await get().assignOrders(data.orderIds, data.confirmerId, data.confirmerName);
        summary[data.confirmerName] = data.orderIds.length;
        totalAssigned += data.orderIds.length;
      }
    }

    return { assignedCount: totalAssigned, summary };
  },

  claimNextUnassignedOrder: async (confirmerId, confirmerName) => {
    const { orders, assignOrders } = get();
    const nextOrder = orders.find(o => !o.assignedTo && (!o.status1 || o.status1 === 'جديد' || o.status1 === 'قيد المراجعة'));
    if (!nextOrder) return null;

    await assignOrders([nextOrder.id], confirmerId, confirmerName);
    return { ...nextOrder, assignedTo: confirmerId, assignedToName: confirmerName, assignedAt: new Date().toISOString() };
  },
  
  bulkUpsertShippingBureaus: async (bureaus) => {
    try {
      const batch = writeBatch(db);
      for (const bureau of bureaus) {
        const docRef = doc(db, 'shippingBureaus', bureau.id);
        batch.set(docRef, JSON.parse(JSON.stringify(bureau)), { merge: true });
      }
      await safeFirestoreWrite(() => batch.commit(), 'bulkUpsertShippingBureaus');
    } catch (error) {
      console.error("Error bulk upserting shipping bureaus", error);
      throw error;
    }
  },

  bulkUpsertInventory: async (products) => {
    try {
      // Immediately reflect updates in local Zustand state
      set((state) => {
        const productMap = new Map<string, InventoryProduct>(state.inventoryProducts.map(p => [String(p.id), p]));
        products.forEach(p => {
          const existing = productMap.get(String(p.id));
          productMap.set(String(p.id), existing ? { ...existing, ...p } : p);
        });
        return { inventoryProducts: Array.from(productMap.values()) };
      });

      const chunkSize = 400;
      for (let i = 0; i < products.length; i += chunkSize) {
        const chunk = products.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        
        chunk.forEach((product) => {
          const idStr = String(product.id);
          const docRef = doc(db, 'inventory', idStr);
          batch.set(docRef, JSON.parse(JSON.stringify(product)), { merge: true });
        });

        await safeFirestoreWrite(() => batch.commit(), 'bulkUpsertInventory');
      }
    } catch (err) {
      console.error("Failed to sync inventory to Firestore:", err);
      throw err;
    }
  },

  
  addNote: async (note) => {
    try {
      await safeFirestoreWrite(() => setDoc(doc(db, 'settings', 'notes_data', 'items', note.id), note), 'addNote');
      set((state) => ({ notes: state.notes.some(n => n.id === note.id) ? state.notes : [note, ...state.notes] }));
    } catch (error) {
      console.error('Error adding note:', error);
      throw error;
    }
  },
  updateNote: async (id, updates) => {
    try {
      const noteRef = doc(db, 'settings', 'notes_data', 'items', id);
      const updateData = { ...updates, updatedAt: new Date().toISOString() };
      await safeFirestoreWrite(() => updateDoc(noteRef, updateData), 'updateNote');
      set((state) => ({
        notes: state.notes.map((n) => (n.id === id ? { ...n, ...updateData } : n)),
      }));
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  },
  deleteNote: async (id) => {
    try {
      await safeFirestoreWrite(() => deleteDoc(doc(db, 'settings', 'notes_data', 'items', id)), 'deleteNote');
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== id),
      }));
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  },

  forceSync: async () => {
    const { salesChannels, settings, setSyncProgress, addOrder, addAbandonedOrder } = get();
    const wooChannels = salesChannels.filter(c => c.type === 'woocommerce' && c.isActive);
    if (wooChannels.length === 0) {
      setSyncProgress(null);
      return;
    }

    let totalOrders = 0;
    let totalAbandoned = 0;
    
    setSyncProgress({ isSyncing: true, message: 'جاري تحديث الطلبات يدوياً...', percent: 10, label: 'تحديث يدوي' });

    for (let i = 0; i < wooChannels.length; i++) {
        const channel = wooChannels[i];
        if (!channel.config?.storeUrl || !channel.config?.consumerKey || !channel.config?.consumerSecret) continue;

        try {
          setSyncProgress({ isSyncing: true, message: `جاري سحب الطلبات من ${channel.name}...`, percent: 20 + i * (60 / wooChannels.length), label: 'سحب الطلبات' });
          
          const syncResult = await universalSyncWooCommerce({
            storeUrl: channel.config.storeUrl,
            consumerKey: channel.config.consumerKey,
            consumerSecret: channel.config.consumerSecret,
            status: 'processing',
            channelName: channel.name
          });

          if (syncResult && syncResult.success && Array.isArray(syncResult.orders) && syncResult.orders.length > 0) {
            for (const order of syncResult.orders) {
              const uniqueId = String(order.id).startsWith('WOO-') ? order.id : `WOO-${channel.id}-${order.id}`;
              await addOrder({ 
                ...order, 
                id: uniqueId, 
                orderId: String(order.orderId || order.id),
                sourceChannel: order.sourceChannel || channel.name 
              });
              totalOrders++;
            }
          } else if (syncResult && !syncResult.success && syncResult.message) {
            console.warn(`Sync notice for channel ${channel.name}:`, syncResult.message);
            toast.error(`قناة ${channel.name}: ${syncResult.message}`, { duration: 6000 });
          }

          setSyncProgress({ isSyncing: true, message: `جاري سحب السلات المتروكة من ${channel.name}...`, percent: 60 + i * (30 / wooChannels.length), label: 'سحب السلات' });
          
          const abandonedResult = await universalSyncWooCommerce({
            storeUrl: channel.config.storeUrl,
            consumerKey: channel.config.consumerKey,
            consumerSecret: channel.config.consumerSecret,
            status: 'pending,on-hold',
            channelName: channel.name
          });

          if (abandonedResult && abandonedResult.success && Array.isArray(abandonedResult.orders) && abandonedResult.orders.length > 0) {
            for (const order of abandonedResult.orders) {
              const uniqueAbnId = String(order.id).startsWith('WOO-ABN-') ? order.id : `WOO-ABN-${channel.id}-${order.id}`;
              await addAbandonedOrder({
                ...order,
                id: uniqueAbnId,
                orderId: String(order.orderId || order.id),
                sourceChannel: order.sourceChannel || channel.name,
                status: 'لم يتم التواصل',
                notes: order.notes || ''
              });
              totalAbandoned++;
            }
          }
        } catch (error: any) {
          console.error(`Manual sync notice for ${channel.name}:`, error);
          const errorMsg = error.message?.includes('Failed to fetch') 
              ? `تعذر الاتصال بالخادم. يرجى التأكد من عمل المتجر وصلاحية الروابط.` 
              : (error.message || 'حدث خطأ أثناء التحديث');
          toast.error(`فشل التحديث من ${channel.name}: ${errorMsg}`, { duration: 5000 });
        }
    }

    setSyncProgress({ 
      isSyncing: true, 
      message: totalOrders > 0 || totalAbandoned > 0 
        ? `اكتمل التحديث: تم استيراد ${totalOrders} طلب و ${totalAbandoned} سلة متروكة` 
        : 'اكتمل فحص ومزامنة القنوات', 
      percent: 100, 
      label: 'مكتمل' 
    });
    setTimeout(() => setSyncProgress(null), 2500);
  },

  deduplicateOrders: async () => {
    const currentOrders = [...get().orders];
    if (currentOrders.length <= 1) return { mergedCount: 0, deletedCount: 0 };

    const duplicatesToDelete: string[] = [];
    const updatesToApply: { id: string; data: Partial<Order> }[] = [];
    const processedIds = new Set<string>();

    for (let i = 0; i < currentOrders.length; i++) {
      const o1 = currentOrders[i];
      if (processedIds.has(o1.id) || duplicatesToDelete.includes(o1.id)) continue;

      const group: Order[] = [o1];
      for (let j = i + 1; j < currentOrders.length; j++) {
        const o2 = currentOrders[j];
        if (processedIds.has(o2.id) || duplicatesToDelete.includes(o2.id)) continue;

        // Check duplicate conditions
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
          group.push(o2);
        }
      }

      if (group.length > 1) {
        // Sort group to find the most complete/authoritative primary order
        const sortedGroup = [...group].sort((a, b) => {
          const scoreA = (a.shippingTrackingId ? 100 : 0) + 
                         (a.status2 && a.status2 !== 'قيد التجهيز' ? 50 : 0) + 
                         (a.status1 && a.status1 !== 'جديد' ? 30 : 0) + 
                         (a.confirmedBy ? 20 : 0) + 
                         (a.deliveryCompany ? 20 : 0) + 
                         (a.notes ? 10 : 0);
          const scoreB = (b.shippingTrackingId ? 100 : 0) + 
                         (b.status2 && b.status2 !== 'قيد التجهيز' ? 50 : 0) + 
                         (b.status1 && b.status1 !== 'جديد' ? 30 : 0) + 
                         (b.confirmedBy ? 20 : 0) + 
                         (b.deliveryCompany ? 20 : 0) + 
                         (b.notes ? 10 : 0);
          return scoreB - scoreA;
        });

        const primary = sortedGroup[0];
        const secondaries = sortedGroup.slice(1);

        const mergedFields: Partial<Order> = {};
        for (const sec of secondaries) {
          duplicatesToDelete.push(sec.id);
          processedIds.add(sec.id);

          if (!primary.shippingTrackingId && sec.shippingTrackingId) mergedFields.shippingTrackingId = sec.shippingTrackingId;
          if ((!primary.status2 || primary.status2 === 'قيد التجهيز') && sec.status2) mergedFields.status2 = sec.status2;
          if ((!primary.status1 || primary.status1 === 'جديد') && sec.status1) mergedFields.status1 = sec.status1;
          if (!primary.confirmedBy && sec.confirmedBy) mergedFields.confirmedBy = sec.confirmedBy;
          if (!primary.deliveryCompany && sec.deliveryCompany) mergedFields.deliveryCompany = sec.deliveryCompany;
          if (!primary.tag && sec.tag) mergedFields.tag = sec.tag;
          if (!primary.sourceChannel && sec.sourceChannel) mergedFields.sourceChannel = sec.sourceChannel;
          if (!primary.notes && sec.notes) mergedFields.notes = sec.notes;
          else if (sec.notes && primary.notes && !primary.notes.includes(sec.notes)) {
            mergedFields.notes = `${primary.notes}\n${sec.notes}`;
          }
          if (!primary.utmSource && sec.utmSource) mergedFields.utmSource = sec.utmSource;
          if (!primary.utmMedium && sec.utmMedium) mergedFields.utmMedium = sec.utmMedium;
          if (!primary.utmCampaign && sec.utmCampaign) mergedFields.utmCampaign = sec.utmCampaign;
        }

        if (Object.keys(mergedFields).length > 0) {
          updatesToApply.push({ id: primary.id, data: mergedFields });
        }

        processedIds.add(primary.id);
      }
    }

    if (duplicatesToDelete.length === 0) {
      return { mergedCount: 0, deletedCount: 0 };
    }

    // Update store state immediately
    set((state) => ({
      orders: state.orders
        .filter(o => !duplicatesToDelete.includes(o.id))
        .map(o => {
          const update = updatesToApply.find(u => u.id === o.id);
          return update ? { ...o, ...update.data } : o;
        })
    }));

    // Perform Firestore updates and deletions
    for (const upd of updatesToApply) {
      await safeFirestoreWrite(() => updateDoc(doc(db, 'orders', upd.id), JSON.parse(JSON.stringify(upd.data))), 'deduplicateOrders_update');
    }

    for (const delId of duplicatesToDelete) {
      await safeFirestoreWrite(() => deleteDoc(doc(db, 'orders', delId)), 'deduplicateOrders_delete');
    }

    return { mergedCount: updatesToApply.length, deletedCount: duplicatesToDelete.length };
  },

  deduplicateAbandonedOrders: async () => {
    const currentOrders = [...get().abandonedOrders];
    if (currentOrders.length <= 1) return { mergedCount: 0, deletedCount: 0 };

    const duplicatesToDelete: string[] = [];
    const updatesToApply: { id: string; data: Partial<AbandonedOrder> }[] = [];
    const processedIds = new Set<string>();

    for (let i = 0; i < currentOrders.length; i++) {
      const o1 = currentOrders[i];
      if (processedIds.has(o1.id) || duplicatesToDelete.includes(o1.id)) continue;

      const group: AbandonedOrder[] = [o1];
      for (let j = i + 1; j < currentOrders.length; j++) {
        const o2 = currentOrders[j];
        if (processedIds.has(o2.id) || duplicatesToDelete.includes(o2.id)) continue;

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
          group.push(o2);
        }
      }

      if (group.length > 1) {
        const sortedGroup = [...group].sort((a, b) => {
          const scoreA = (a.status && a.status !== 'لم يتم التواصل' ? 30 : 0) + (a.notes ? 10 : 0);
          const scoreB = (b.status && b.status !== 'لم يتم التواصل' ? 30 : 0) + (b.notes ? 10 : 0);
          return scoreB - scoreA;
        });

        const primary = sortedGroup[0];
        const secondaries = sortedGroup.slice(1);

        const mergedFields: Partial<AbandonedOrder> = {};
        for (const sec of secondaries) {
          duplicatesToDelete.push(sec.id);
          processedIds.add(sec.id);

          if ((!primary.status || primary.status === 'لم يتم التواصل') && sec.status) mergedFields.status = sec.status;
          if (!primary.sourceChannel && sec.sourceChannel) mergedFields.sourceChannel = sec.sourceChannel;
          if (!primary.notes && sec.notes) mergedFields.notes = sec.notes;
          else if (sec.notes && primary.notes && !primary.notes.includes(sec.notes)) {
            mergedFields.notes = `${primary.notes}\n${sec.notes}`;
          }
          if (!primary.utmSource && sec.utmSource) mergedFields.utmSource = sec.utmSource;
          if (!primary.utmMedium && sec.utmMedium) mergedFields.utmMedium = sec.utmMedium;
          if (!primary.utmCampaign && sec.utmCampaign) mergedFields.utmCampaign = sec.utmCampaign;
        }

        if (Object.keys(mergedFields).length > 0) {
          updatesToApply.push({ id: primary.id, data: mergedFields });
        }

        processedIds.add(primary.id);
      }
    }

    if (duplicatesToDelete.length === 0) {
      return { mergedCount: 0, deletedCount: 0 };
    }

    set((state) => ({
      abandonedOrders: state.abandonedOrders
        .filter(o => !duplicatesToDelete.includes(o.id))
        .map(o => {
          const update = updatesToApply.find(u => u.id === o.id);
          return update ? { ...o, ...update.data } : o;
        })
    }));

    for (const upd of updatesToApply) {
      await safeFirestoreWrite(() => updateDoc(doc(db, 'abandonedOrders', upd.id), JSON.parse(JSON.stringify(upd.data))), 'deduplicateAbandonedOrders_update');
    }

    for (const delId of duplicatesToDelete) {
      await safeFirestoreWrite(() => deleteDoc(doc(db, 'abandonedOrders', delId)), 'deduplicateAbandonedOrders_delete');
    }

    return { mergedCount: updatesToApply.length, deletedCount: duplicatesToDelete.length };
  },

  restoreDeletedItem: async (recordId: string) => {
    const history = getDeletedHistory();
    const item = history.find(i => i.id === recordId);
    if (!item || !item.data) {
      throw new Error('لم يتم العثور على بيانات العنصر المحذوف');
    }

    const { entityType, originalId, data } = item;
    const cleanData = JSON.parse(JSON.stringify(data));

    if (entityType === 'order') {
      set((s) => ({ orders: [cleanData, ...s.orders.filter(o => o.id !== originalId)] }));
      await safeFirestoreWrite(() => setDoc(doc(db, 'orders', originalId), cleanData), 'restoreOrder');
    } else if (entityType === 'inventory_product') {
      set((s) => ({ inventoryProducts: [cleanData, ...s.inventoryProducts.filter(p => p.id !== originalId)] }));
      await safeFirestoreWrite(() => setDoc(doc(db, 'inventory', originalId), cleanData), 'restoreInventoryProduct');
    } else if (entityType === 'expense') {
      set((s) => ({ expenses: [cleanData, ...s.expenses.filter(e => e.id !== originalId)] }));
      await safeFirestoreWrite(() => setDoc(doc(db, 'expenses', originalId), cleanData), 'restoreExpense');
    } else if (entityType === 'campaign_record') {
      set((s) => ({ campaignRecords: [cleanData, ...s.campaignRecords.filter(r => r.id !== originalId)] }));
      await safeFirestoreWrite(() => setDoc(doc(db, 'campaignRecords', originalId), cleanData), 'restoreCampaignRecord');
    } else if (entityType === 'campaign') {
      set((s) => ({ campaigns: [cleanData, ...s.campaigns.filter(c => c.id !== originalId)] }));
      await safeFirestoreWrite(() => setDoc(doc(db, 'campaigns', originalId), cleanData), 'restoreCampaign');
    }

    removeDeletedRecord(recordId);
  }
}));
