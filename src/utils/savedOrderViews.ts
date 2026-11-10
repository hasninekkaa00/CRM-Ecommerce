export interface SavedOrderViewFilters {
  statusFilter: string;
  hiddenStatuses: string[];
  status2Filter: string;
  hiddenStatuses2: string[];
  tagFilter: string;
  hiddenTags: string[];
  channelFilter: string;
  hiddenChannels: string[];
  productFilter: string;
  dateFilter: string;
  confirmedByFilter?: string;
  deliveryMethodFilter?: string;
  deliveryCompanyFilter?: string;
  activeFilterTab?: 'all' | 'status1' | 'status2' | 'tags' | 'channels';
  collapseAllFilters?: boolean;
  showFilters?: boolean;
  viewMode?: 'detailed' | 'compact';
  currentTab?: 'active' | 'archived' | 'trash';
}

export interface SavedOrderView {
  id: string;
  name: string;
  badge?: string;
  isDefault?: boolean;
  isBuiltIn?: boolean;
  createdAt: string;
  updatedAt?: string;
  filters: SavedOrderViewFilters;
}

export const DEFAULT_BUILTIN_ORDER_VIEWS: SavedOrderView[] = [
  {
    id: 'view-all',
    name: 'كل الطلبيات (شامل)',
    badge: 'الكل',
    isBuiltIn: true,
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    filters: {
      statusFilter: 'all',
      hiddenStatuses: [],
      status2Filter: 'all',
      hiddenStatuses2: [],
      tagFilter: 'all',
      hiddenTags: [],
      channelFilter: 'all',
      hiddenChannels: [],
      productFilter: 'all',
      dateFilter: 'all',
      confirmedByFilter: 'all',
      deliveryMethodFilter: 'all',
      deliveryCompanyFilter: 'all',
      activeFilterTab: 'all',
      collapseAllFilters: false,
      showFilters: false,
      viewMode: 'detailed',
      currentTab: 'active'
    }
  },
  {
    id: 'view-no-canceled',
    name: 'الطلبيات النشطة (بدون ملغى)',
    badge: 'نشطة',
    isBuiltIn: true,
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    filters: {
      statusFilter: 'all',
      hiddenStatuses: ['ملغى'],
      status2Filter: 'all',
      hiddenStatuses2: [],
      tagFilter: 'all',
      hiddenTags: [],
      channelFilter: 'all',
      hiddenChannels: [],
      productFilter: 'all',
      dateFilter: 'all',
      confirmedByFilter: 'all',
      deliveryMethodFilter: 'all',
      deliveryCompanyFilter: 'all',
      activeFilterTab: 'all',
      collapseAllFilters: false,
      showFilters: false,
      viewMode: 'detailed',
      currentTab: 'active'
    }
  },
  {
    id: 'view-confirmed-ready',
    name: 'المؤكدة الجاهزة للشحن',
    badge: 'مؤكدة',
    isBuiltIn: true,
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    filters: {
      statusFilter: 'مؤكد',
      hiddenStatuses: [],
      status2Filter: 'قيد التجهيز',
      hiddenStatuses2: [],
      tagFilter: 'all',
      hiddenTags: [],
      channelFilter: 'all',
      hiddenChannels: [],
      productFilter: 'all',
      dateFilter: 'all',
      confirmedByFilter: 'all',
      deliveryMethodFilter: 'all',
      deliveryCompanyFilter: 'all',
      activeFilterTab: 'all',
      collapseAllFilters: false,
      showFilters: false,
      viewMode: 'detailed',
      currentTab: 'active'
    }
  },
  {
    id: 'view-followup-calls',
    name: 'متابعة الاتصال (لا يرد ومؤجل)',
    badge: 'متابعة',
    isBuiltIn: true,
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    filters: {
      statusFilter: 'all',
      hiddenStatuses: ['مؤكد', 'ملغى', 'جديد'],
      status2Filter: 'all',
      hiddenStatuses2: [],
      tagFilter: 'all',
      hiddenTags: [],
      channelFilter: 'all',
      hiddenChannels: [],
      productFilter: 'all',
      dateFilter: 'all',
      confirmedByFilter: 'all',
      deliveryMethodFilter: 'all',
      deliveryCompanyFilter: 'all',
      activeFilterTab: 'status1',
      collapseAllFilters: false,
      showFilters: false,
      viewMode: 'detailed',
      currentTab: 'active'
    }
  }
];

const ORDER_VIEWS_STORAGE_KEY = 'app_saved_order_filter_views_v1';
const ACTIVE_ORDER_VIEW_KEY = 'app_active_order_filter_view_id_v1';

export function getSavedOrderViews(): SavedOrderView[] {
  try {
    const raw = localStorage.getItem(ORDER_VIEWS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure default built-in views exist
        const customViews = parsed.filter((v: SavedOrderView) => !v.isBuiltIn);
        return [...DEFAULT_BUILTIN_ORDER_VIEWS, ...customViews];
      }
    }
  } catch (e) {
    console.error('Failed to load saved order views:', e);
  }
  return DEFAULT_BUILTIN_ORDER_VIEWS;
}

export function saveOrderViews(views: SavedOrderView[]): void {
  try {
    localStorage.setItem(ORDER_VIEWS_STORAGE_KEY, JSON.stringify(views));
  } catch (e) {
    console.error('Failed to persist saved order views:', e);
  }
}

export function getActiveOrderViewId(): string | null {
  return localStorage.getItem(ACTIVE_ORDER_VIEW_KEY) || 'view-all';
}

export function setActiveOrderViewId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_ORDER_VIEW_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_ORDER_VIEW_KEY);
  }
}
