export interface Order {
  id: string;
  orderId: string;
  sku: string;
  orderDate: string;
  fullName: string;
  phone: string;
  region: string;
  city: string;
  stopdeskCommune?: string;
  productName: string;
  variation: string;
  qnts: number;
  priceWithoutDelivery: number;
  deliveryPrice: number;
  realDeliveryPrice?: number;
  shippingFeeMode?: 'auto' | 'manual';
  totalCharge: number;
  shippingMethod: string;
  confirmedBy: string;
  status1: string; // e.g., 'جديد', 'مؤكد', 'ملغى'
  deliveryCompany: string;
  postponementDate: string;
  status2: string; // e.g., 'تم الشحن', 'مستلم', 'مرتجع'
  ip: string;
  notes?: string;
  trackingHistory?: any[];
  archived?: boolean;
  trashed?: boolean;
  shippingTrackingId?: string | null;
  trackingNumber?: string;
  lastTrackingSync?: string;
  lastSyncType?: string;
  stockDeducted?: boolean;
  consignmentSettlementId?: string;
  stockRestocked?: boolean;
  stockReshipped?: boolean;
  customProductCost?: number;
  customAdditionalCost?: number;
  customReturnCost?: number;
  items?: any[];
  isReplacement?: boolean;
  replacedOrderId?: string;
  replacementOrderId?: string;
  isExchangedReturn?: boolean;
  reminderDate?: string;
  reminderNote?: string;
  reminderDismissed?: boolean;
  sourceChannel?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  pysLanding?: string;
  pysSource?: string;
  pysFirstVisit?: string;
  pysLastVisit?: string;
  pysUtmSource?: string;
  pysUtmMedium?: string;
  pysUtmCampaign?: string;
  tag?: string;
  tagsHistory?: OrderTagEntry[];
  assignedTo?: string; // Confirmer UID/ID
  assignedToName?: string; // Confirmer display name
  assignedAt?: string; // ISO date of assignment
  isPaidToConfirmer?: boolean;
  confirmerInvoiceId?: string;
  confirmerCommissionAmount?: number;
  confirmedAt?: string;
}

export interface OrderTagEntry {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  subInvoices?: SubInvoice[];
}

export interface AbandonedOrder {
  id: string;
  orderId?: string;
  sku?: string;
  orderDate: string;
  fullName?: string;
  phone: string;
  region?: string;
  city?: string;
  stopdeskCommune?: string;
  productName?: string;
  variation?: string;
  qnts?: number;
  priceWithoutDelivery?: number;
  deliveryPrice?: number;
  realDeliveryPrice?: number;
  shippingFeeMode?: 'auto' | 'manual';
  totalCharge?: number;
  shippingMethod?: string;
  confirmedBy?: string;
  status: string; // e.g., 'لم يتم التواصل', 'تم الإتصال', 'مسترجع'
  notes: string;
  deliveryCompany?: string;
  archived?: boolean;
  trashed?: boolean;
  tag?: string;
  tagsHistory?: OrderTagEntry[];
  sourceChannel?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  pysLanding?: string;
  pysSource?: string;
  pysFirstVisit?: string;
  pysLastVisit?: string;
  pysUtmSource?: string;
  pysUtmMedium?: string;
  pysUtmCampaign?: string;
}

export interface Campaign {
  id: string;
  name: string;
  productName: string;
  linkedProducts?: string[];
  baseDailyBudget?: number;
  createdAt: string;
  isArchived?: boolean;
  archivedAt?: string;
  platform?: string;
  metaCampaignId?: string;
  metaAccountId?: string;
}

export interface CampaignField {
  id: string;
  name: string;
  type: 'number' | 'text';
}

export interface CampaignRecord {
  id: string;
  campaignId: string;
  date: string;
  spend: number;
  dynamicFields: Record<string, any>;
}

export interface SalesChannel {
  id: string;
  name: string;
  type: 'woocommerce' | 'shopify' | 'sheets' | 'custom';
  isActive: boolean;
  logoUrl?: string;
  config: Record<string, any>; // e.g. storeUrl, consumerKey, etc.
}

export interface Partner {
  id: string;
  name: string;
  phone?: string;
  sharePercentage?: number;
  initialCapital?: number;
  notes?: string;
  createdAt: string;
}

export type PartnerTransactionType = 
  | 'contribution'
  | 'withdrawal'
  | 'ad_spend'
  | 'goods_purchase'
  | 'shipping_expense'
  | 'operational_expense'
  | 'partner_settlement'
  | 'other';

export interface PartnerTransaction {
  id: string;
  partnerId: string;
  partnerName: string;
  targetPartnerId?: string;
  targetPartnerName?: string;
  date: string;
  amount: number;
  currency?: 'DZD' | 'USD';
  exchangeRate?: number;
  originalAmount?: number;
  type: PartnerTransactionType;
  category?: string;
  paymentMethod?: string;
  description: string;
  notes?: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  description: string;
  category?: string;
  partnerId?: string;
  partnerName?: string;
  paymentMethod?: string;
  type?: PartnerTransactionType;
}

export interface SystemSettings {
  id?: string;
  status1Options: string[];
  status2Options: string[];
  deliveryCompanies: string[];
  confirmers: string[];
  defaultStatus1?: string;
  defaultStatus2?: string;
  defaultDeliveryCompany?: string;
  defaultConfirmedBy?: string;
  productCosts?: Record<string, number>;
  deletedWooOrderIds?: string[];
  returnCost?: number;
  returnCostMode?: 'per_order' | 'monthly_subscription';
  returnMonthlySubscription?: number;
  exchangeRate?: number;
  autoSyncEnabled?: boolean;
  autoSyncIntervalSeconds?: number;
  
  metaAdsToken?: string;
  
  notificationStatuses?: string[];
  soundNotificationEnabled?: boolean;
  cityCorrections?: Record<string, string>;
  visualNotificationEnabled?: boolean;
  
  lowInventoryAlertEnabled?: boolean;
  lowInventoryThreshold?: number;
  inventoryManagementMode?: 'sync' | 'local';

  shippingIntegrations?: ShippingIntegration[];
  
  themePalette?: string;
  customThemePalettes?: CustomThemePalette[];
  defaultLandingView?: ViewState;

  smsEnabled?: boolean;
  smsGateway?: 'sms_algerie' | 'twilio';
  smsAlgerieToken?: string;
  smsAlgerieSender?: string;
  smsTwilioSid?: string;
  smsTwilioToken?: string;
  smsTwilioNumber?: string;
  smsTemplates?: Record<string, string>;
  smsAutoSendOnStatus?: string[];
  tags?: OrderTag[];
  statusColors?: Record<string, string>;
  orderRowColorMode?: 'auto' | 'status1' | 'status2';
  assignmentSettings?: AssignmentSettings;

  // Auto Backup & Design Settings
  autoBackupEnabled?: boolean;
  autoBackupIntervalHours?: number;
  lastAutoBackupTimestamp?: string;
  autoBackupIncludeDesign?: boolean;
}

export interface OrderTag {
  name: string;
  color: string;
}

export interface CustomThemePalette {
  id: string;
  name: string;
  sidebarBg: string;
  sidebarActiveBg: string;
  primaryColor: string;
  primaryHover: string;
  primaryLight: string;
  primaryLightBorder: string;
}

export interface ShippingIntegration {
  id: string;
  name: string;
  vendor: 'expedigo' | 'other';
  token: string;
  domain?: string;
  phones?: string[];
  isActive: boolean;
}

export interface ProductVariation {
  id?: string | number;
  sku?: string;
  name?: string;
  price?: string | number;
  regular_price?: string | number;
  sale_price?: string | number;
  weight?: number;
  local_price?: string | number;
  local_cost?: number | null;
  local_stock_quantity?: number | null;
  local_manage_stock?: boolean;
  attributes?: any[];
  shippingAliasName?: string;
  offer_quantity?: number;
  [key: string]: any;
}

export interface InventoryProduct {
  id: string; // The WooCommerce product ID or internal ID
  name: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  stock_status?: string;
  images?: any[];
  sku?: string;
  weight?: number;
  variations?: ProductVariation[];
  local_stock_quantity?: number | null;
  local_manage_stock?: boolean;
  shippingAliasName?: string;
  useShippingAlias?: boolean;
  [key: string]: any;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  variationId?: string;
  variationName?: string;
  sku?: string;
  type: 'addition' | 'reduction' | 'adjustment' | 'purchase' | 'order_deduct' | 'order_return' | 'delete';
  typeName: string;
  oldStock: number;
  changeQty: number;
  newStock: number;
  date: string;
  note?: string;
  userName?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface PurchaseInvoiceItem {
  id: string;
  sku: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface SubInvoice {
  id: string;
  subInvoiceNumber: string;
  date: string;
  items: PurchaseInvoiceItem[];
  additionalExpenses: number;
  totalAmount: number;
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  paymentNotes?: string;
  notes?: string;
  createdAt: string;
}

export interface PurchaseInvoice {
  subInvoices?: SubInvoice[];
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName?: string;
  date: string;
  items: PurchaseInvoiceItem[];
  totalAmount: number;
  paymentStatus?: 'paid' | 'unpaid' | 'partial';
  paymentNotes?: string;
  notes?: string;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface ShippingInvoice {
  id: string;
  amount: number;
  companyName: string;
  date: string;
  attachmentUrl?: string;
  notes?: string;
  createdAt: string;
  linkedSupplierId?: string;
  linkedSupplierAmount?: number;
}

export interface ShippingBureau {
  id: string;
  wilayaCode: string;
  wilayaName: string;
  address: string;
  phones: string;
}

export type UserRole = 'admin' | 'confirmer';

export type ConfirmerCommissionType = 
  | 'per_assigned' 
  | 'per_confirmed' 
  | 'per_delivered' 
  | 'hybrid' 
  | 'fixed_monthly';

export interface ConfirmerCommissionConfig {
  type: ConfirmerCommissionType;
  ratePerAssigned: number;
  ratePerConfirmed: number;
  ratePerDelivered: number;
  fixedMonthlySalary?: number;
}

export interface AppUser {
  id: string;
  uid?: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  phone?: string;
  createdAt: string;
  lastLoginAt?: string;
  notes?: string;
  allowedViews?: ViewState[];
  commissionConfig?: ConfirmerCommissionConfig;
  assignedProducts?: string[];
  assignedWilayas?: string[];
  assignedChannels?: string[];
  assignmentWeight?: number;
}

export type AutoAssignmentStrategy = 
  | 'round_robin' 
  | 'by_product' 
  | 'by_wilaya' 
  | 'by_channel' 
  | 'ratio' 
  | 'least_busy';

export interface AutoAssignmentRule {
  id: string;
  name: string;
  strategy: AutoAssignmentStrategy;
  isActive: boolean;
  targetConfirmerIds: string[];
  productSkus?: string[];
  wilayas?: string[];
  channelIds?: string[];
  weights?: Record<string, number>; // confirmerId -> weight
  createdAt: string;
}

export interface ConfirmerInvoice {
  id: string;
  invoiceNumber: string;
  confirmerId: string;
  confirmerName: string;
  confirmerEmail?: string;
  periodFrom: string;
  periodTo: string;
  commissionType: ConfirmerCommissionType;
  rates: {
    ratePerAssigned: number;
    ratePerConfirmed: number;
    ratePerDelivered: number;
  };
  stats: {
    totalAssigned: number;
    totalConfirmed: number;
    totalDelivered: number;
    totalCanceled: number;
    totalReturned: number;
  };
  baseAmount: number;
  bonusAmount: number;
  bonusReason?: string;
  deductionAmount: number;
  deductionReason?: string;
  finalTotal: number;
  includedOrderIds: string[];
  status: 'paid' | 'draft' | 'pending';
  paidAt?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface AssignmentSettings {
  enabled: boolean;
  defaultStrategy: AutoAssignmentStrategy;
  autoAssignOnImport: boolean;
  allowSelfClaim: boolean;
  rules: AutoAssignmentRule[];
  defaultCommission: ConfirmerCommissionConfig;
}

export type ViewState = 
  | 'dashboard' | 'notes' 
  | 'sections'
  | 'analytics' | 'indicators' 
  | 'orders' 
  | 'shipped_orders' 
  | 'suivi' 
  | 'inventory' 
  | 'purchases' 
  | 'abandoned' 
  | 'campaigns' 
  | 'channels' 
  | 'expenses' 
  | 'profits' 
  | 'advanced_simulator' 
  | 'settings' 
  | 'backup'
  | 'shipping' 
  | 'shipping_invoices' 
  | 'shipping_bureaus'
  | 'confirmers'
  | 'users'
  | 'ai_assistant';

export interface AiSourceCitation {
  collection: string;
  name: string;
  count?: number;
  description: string;
}

export interface AiProposedOperation {
  id?: string;
  actionType: 
    | 'UPDATE_ORDER_STATUS' 
    | 'ASSIGN_TAG' 
    | 'ASSIGN_SHIPPING' 
    | 'SEND_TO_SHIPPING' 
    | 'BULK_UPDATE_ORDERS' 
    | 'ASSIGN_TO_CONFIRMER'
    | 'UPDATE_INVENTORY' 
    | 'ADD_EXPENSE' 
    | 'UPDATE_SETTINGS';
  orderIds?: string[];
  summaryArabic: string;
  params?: Record<string, any>;
  status?: 'pending' | 'executed' | 'cancelled';
  executedAt?: string;
}

export interface AiDataInsight {
  label: string;
  value: string;
  type?: 'info' | 'success' | 'warning' | 'danger';
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  matchingOrderIds?: string[];
  matchingProductIds?: string[];
  sources?: AiSourceCitation[];
  suggestedActions?: string[];
  proposedOperation?: AiProposedOperation;
  dataInsights?: AiDataInsight[];
  isError?: boolean;
}

export interface NoteTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
  isChecklist?: boolean;
  tasks?: NoteTask[];
}
